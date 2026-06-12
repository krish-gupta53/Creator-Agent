import { DEFAULT_CONTEXT, blankDecisionSnapshot, normalizeCreatorContext } from './config.js';
import { cleanText, httpError, id, nowIso, parseJson, stringify } from './utils.js';

export function assertDb(env) {
  if (!env.DB) throw httpError(503, 'D1 binding DB is not configured. Create the database and apply migrations before deploying v4.');
}

export async function getCreatorContext(env) {
  assertDb(env);
  const row = await env.DB.prepare('SELECT context_json, version, updated_at FROM creator_context WHERE id = 1').first();
  if (!row) {
    const context = normalizeCreatorContext(DEFAULT_CONTEXT);
    await env.DB.prepare('INSERT INTO creator_context (id, context_json, version, updated_at) VALUES (1, ?, 1, ?)').bind(stringify(context), context.updated_at).run();
    return { ...context, _version: 1 };
  }
  return { ...normalizeCreatorContext(parseJson(row.context_json, DEFAULT_CONTEXT)), updated_at: row.updated_at, _version: row.version };
}

export async function saveCreatorContext(env, input) {
  assertDb(env);
  const context = normalizeCreatorContext(input);
  await env.DB.prepare(`INSERT INTO creator_context (id, context_json, version, updated_at)
    VALUES (1, ?, 1, ?)
    ON CONFLICT(id) DO UPDATE SET context_json = excluded.context_json, version = creator_context.version + 1, updated_at = excluded.updated_at`)
    .bind(stringify(context), context.updated_at).run();
  return getCreatorContext(env);
}

export async function createConversationRecord(env, title = 'New content idea') {
  assertDb(env);
  const conversationId = id('c');
  const timestamp = nowIso();
  const decision = blankDecisionSnapshot();
  await env.DB.prepare(`INSERT INTO conversations
    (id, title, stage, ready_to_generate, decision_json, summary_json, missing_decisions_json, last_summarized_sequence, version, created_at, updated_at)
    VALUES (?, ?, 'discovery', 0, ?, NULL, '[]', 0, 1, ?, ?)`)
    .bind(conversationId, cleanText(title).slice(0, 120) || 'New content idea', stringify(decision), timestamp, timestamp).run();
  await insertMessage(env, conversationId, 'assistant', 'Tell me what you are thinking about creating. I will first help shape the idea, offer options, and agree on the format before writing the final script.', {});
  return getConversation(env, conversationId);
}

function mapConversationRow(row) {
  if (!row) return null;
  return {
    id: row.id, title: row.title, stage: row.stage, ready_to_generate: Boolean(row.ready_to_generate),
    decision_snapshot: parseJson(row.decision_json, blankDecisionSnapshot()),
    conversation_summary: parseJson(row.summary_json, null),
    missing_decisions: parseJson(row.missing_decisions_json, []),
    last_summarized_sequence: Number(row.last_summarized_sequence || 0), version: Number(row.version || 1),
    message_sequence: Number(row.message_sequence || 0), package_sequence: Number(row.package_sequence || 0),
    generation_job_id: row.generation_job_id || null, active_package_id: row.active_package_id || null,
    created_at: row.created_at, updated_at: row.updated_at,
  };
}

export async function getConversation(env, conversationId, { includeMessages = true, messageLimit = 120, includeAttachments = true, includePackages = true } = {}) {
  assertDb(env);
  const row = await env.DB.prepare('SELECT * FROM conversations WHERE id = ?').bind(conversationId).first();
  const conversation = mapConversationRow(row);
  if (!conversation) return null;
  if (includeMessages) conversation.messages = await listMessages(env, conversationId, messageLimit, includeAttachments);
  if (includePackages) {
    conversation.packages = await listPackages(env, conversationId, 30);
    conversation.final_package = conversation.active_package_id ? await getPackage(env, conversation.active_package_id) : conversation.packages[0] || null;
  }
  conversation.pins = await listPins(env, conversationId);
  return conversation;
}

export async function listConversations(env, limit = 60) {
  assertDb(env);
  const result = await env.DB.prepare(`SELECT c.*, 
      (SELECT COUNT(*) FROM packages p WHERE p.conversation_id = c.id) package_count,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) message_count
    FROM conversations c ORDER BY c.updated_at DESC LIMIT ?`).bind(limit).all();
  return (result.results || []).map(row => ({
    ...mapConversationRow(row), has_package: Number(row.package_count || 0) > 0,
    package_count: Number(row.package_count || 0), message_count: Number(row.message_count || 0),
  }));
}

export async function updateConversation(env, conversationId, patch, expectedVersion = null) {
  assertDb(env);
  const current = await getConversation(env, conversationId, { includeMessages: false, includeAttachments: false, includePackages: false });
  if (!current) throw httpError(404, 'Conversation not found.');
  const next = { ...current, ...patch, decision_snapshot: patch.decision_snapshot ?? current.decision_snapshot, missing_decisions: patch.missing_decisions ?? current.missing_decisions };
  const timestamp = nowIso();
  const version = expectedVersion ?? current.version;
  const result = await env.DB.prepare(`UPDATE conversations SET title = ?, stage = ?, ready_to_generate = ?, decision_json = ?, summary_json = ?, missing_decisions_json = ?, last_summarized_sequence = ?, generation_job_id = ?, active_package_id = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?`)
    .bind(next.title, next.stage, next.ready_to_generate ? 1 : 0, stringify(next.decision_snapshot), next.conversation_summary ? stringify(next.conversation_summary) : null, stringify(next.missing_decisions || []), Number(next.last_summarized_sequence || 0), next.generation_job_id || null, next.active_package_id || null, timestamp, conversationId, version).run();
  if (!result.meta?.changes) throw httpError(409, 'This conversation changed in another tab. Reload it and try again.', 'VERSION_CONFLICT');
  return getConversation(env, conversationId);
}

export async function insertMessage(env, conversationId, role, content, metadata = {}) {
  assertDb(env);
  const messageId = id('m');
  const timestamp = nowIso();
  const allocated = await env.DB.prepare(`UPDATE conversations
    SET message_sequence = message_sequence + 1, updated_at = ?
    WHERE id = ? RETURNING message_sequence`).bind(timestamp, conversationId).first();
  if (!allocated) throw httpError(404, 'Conversation not found.');
  const sequence = Number(allocated.message_sequence);
  const cleaned = cleanText(content).slice(0, 50000);
  try {
    await env.DB.prepare('INSERT INTO messages (id, conversation_id, sequence_number, role, content, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(messageId, conversationId, sequence, role, cleaned, stringify(metadata), timestamp).run();
  } catch (error) {
    console.error('[message-insert]', { conversationId, sequence, error: error.message });
    throw error;
  }
  return { id: messageId, conversation_id: conversationId, sequence_number: sequence, role, content: cleaned, metadata, at: timestamp, attachments: [] };
}

export async function listMessages(env, conversationId, limit = 120, includeAttachments = true, afterSequence = 0) {
  assertDb(env);
  const result = await env.DB.prepare(`SELECT * FROM messages WHERE conversation_id = ? AND sequence_number > ? ORDER BY sequence_number DESC LIMIT ?`)
    .bind(conversationId, afterSequence, limit).all();
  const rows = (result.results || []).reverse();
  const messages = rows.map(row => ({ id: row.id, conversation_id: row.conversation_id, sequence_number: row.sequence_number, role: row.role, content: row.content, metadata: parseJson(row.metadata_json, {}), at: row.created_at, attachments: [] }));
  if (includeAttachments && messages.length) {
    const ids = messages.map(item => item.id);
    const placeholders = ids.map(() => '?').join(',');
    const attachments = await env.DB.prepare(`SELECT * FROM attachments WHERE message_id IN (${placeholders}) ORDER BY created_at`).bind(...ids).all();
    const byMessage = new Map();
    for (const row of attachments.results || []) {
      if (!byMessage.has(row.message_id)) byMessage.set(row.message_id, []);
      byMessage.get(row.message_id).push(mapAttachmentRow(row));
    }
    for (const message of messages) message.attachments = byMessage.get(message.id) || [];
  }
  return messages;
}

export async function getLatestMessageSequence(env, conversationId) {
  const row = await env.DB.prepare('SELECT COALESCE(MAX(sequence_number), 0) seq FROM messages WHERE conversation_id = ?').bind(conversationId).first();
  return Number(row?.seq || 0);
}

export async function addPin(env, conversationId, text) {
  const pin = { id: id('pin'), conversation_id: conversationId, text: cleanText(text).slice(0, 1500), created_at: nowIso() };
  if (!pin.text) throw httpError(400, 'Pin text is required.');
  await env.DB.prepare('INSERT INTO chat_pins (id, conversation_id, text, created_at) VALUES (?, ?, ?, ?)').bind(pin.id, conversationId, pin.text, pin.created_at).run();
  return pin;
}

export async function updatePin(env, conversationId, pinId, text) {
  const cleaned = cleanText(text).slice(0, 1500);
  if (!cleaned) throw httpError(400, 'Pin text is required.');
  const result = await env.DB.prepare('UPDATE chat_pins SET text = ? WHERE id = ? AND conversation_id = ?').bind(cleaned, pinId, conversationId).run();
  if (!result.meta?.changes) throw httpError(404, 'Pin not found.');
  return env.DB.prepare('SELECT * FROM chat_pins WHERE id = ?').bind(pinId).first();
}

export async function listPins(env, conversationId) {
  const result = await env.DB.prepare('SELECT * FROM chat_pins WHERE conversation_id = ? ORDER BY created_at').bind(conversationId).all();
  return result.results || [];
}

export async function deletePin(env, conversationId, pinId) {
  await env.DB.prepare('DELETE FROM chat_pins WHERE id = ? AND conversation_id = ?').bind(pinId, conversationId).run();
}

function mapAttachmentRow(row) {
  if (!row) return null;
  return {
    id: row.id, conversation_id: row.conversation_id, message_id: row.message_id, key: row.r2_key,
    name: row.original_name, type: row.mime_type, size: row.size_bytes, status: row.status, summary: row.summary || '',
    extraction_method: row.extraction_method || '', checksum: row.checksum || '', metadata: parseJson(row.metadata_json, {}),
    created_at: row.created_at, updated_at: row.updated_at,
    download_url: `/api/assets?key=${encodeURIComponent(row.r2_key)}`,
  };
}

export async function insertAttachment(env, attachment) {
  await env.DB.prepare(`INSERT INTO attachments (id, conversation_id, message_id, r2_key, original_name, mime_type, size_bytes, status, summary, extraction_method, checksum, metadata_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(attachment.id, attachment.conversation_id, attachment.message_id || null, attachment.key, attachment.name, attachment.type, attachment.size, attachment.status, attachment.summary || '', attachment.extraction_method || '', attachment.checksum || '', stringify(attachment.metadata || {}), attachment.created_at || nowIso(), attachment.updated_at || nowIso()).run();
  return getAttachment(env, attachment.id);
}

export async function updateAttachment(env, attachmentId, patch) {
  const current = await getAttachment(env, attachmentId);
  if (!current) throw httpError(404, 'Attachment not found.');
  const next = { ...current, ...patch, metadata: { ...(current.metadata || {}), ...(patch.metadata || {}) } };
  await env.DB.prepare('UPDATE attachments SET status = ?, summary = ?, extraction_method = ?, checksum = ?, metadata_json = ?, updated_at = ? WHERE id = ?')
    .bind(next.status, next.summary || '', next.extraction_method || '', next.checksum || '', stringify(next.metadata || {}), nowIso(), attachmentId).run();
  return getAttachment(env, attachmentId);
}

export async function attachToMessage(env, attachmentId, messageId) {
  await env.DB.prepare('UPDATE attachments SET message_id = ?, updated_at = ? WHERE id = ?').bind(messageId, nowIso(), attachmentId).run();
}

export async function getAttachment(env, attachmentId) {
  const row = await env.DB.prepare('SELECT * FROM attachments WHERE id = ?').bind(attachmentId).first();
  return mapAttachmentRow(row);
}

export async function listAttachments(env, conversationId, limit = 100) {
  const result = await env.DB.prepare('SELECT * FROM attachments WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?').bind(conversationId, limit).all();
  return (result.results || []).map(mapAttachmentRow);
}

export async function deleteAttachmentRecord(env, attachmentId) {
  const attachment = await getAttachment(env, attachmentId);
  if (!attachment) return null;
  const chunks = await listChunksByAttachment(env, attachmentId);
  await env.DB.prepare('DELETE FROM attachments WHERE id = ?').bind(attachmentId).run();
  return { attachment, chunks };
}

export async function replaceChunks(env, attachment, chunks) {
  await env.DB.prepare('DELETE FROM document_chunks WHERE attachment_id = ?').bind(attachment.id).run();
  if (!chunks.length) return [];
  const statements = chunks.map((chunk, index) => env.DB.prepare(`INSERT INTO document_chunks
    (id, attachment_id, conversation_id, chunk_number, page_start, page_end, text, vector_id, token_count, checksum, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(chunk.id, attachment.id, attachment.conversation_id, index + 1, chunk.page_start ?? null, chunk.page_end ?? null, chunk.text, chunk.vector_id || chunk.id, chunk.token_count || null, chunk.checksum || '', nowIso()));
  for (let start = 0; start < statements.length; start += 50) await env.DB.batch(statements.slice(start, start + 50));
  return listChunksByAttachment(env, attachment.id);
}

export async function listChunksByAttachment(env, attachmentId) {
  const result = await env.DB.prepare('SELECT * FROM document_chunks WHERE attachment_id = ? ORDER BY chunk_number').bind(attachmentId).all();
  return result.results || [];
}

export async function getChunksByIds(env, ids) {
  if (!ids.length) return [];
  const result = await env.DB.prepare(`SELECT dc.*, a.original_name FROM document_chunks dc JOIN attachments a ON a.id = dc.attachment_id WHERE dc.id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
  const order = new Map(ids.map((value, index) => [value, index]));
  return (result.results || []).sort((a, b) => order.get(a.id) - order.get(b.id));
}

export async function fallbackRelevantChunks(env, conversationId, limit = 6) {
  const result = await env.DB.prepare(`SELECT dc.*, a.original_name FROM document_chunks dc JOIN attachments a ON a.id = dc.attachment_id WHERE dc.conversation_id = ? ORDER BY dc.created_at DESC, dc.chunk_number LIMIT ?`).bind(conversationId, limit).all();
  return result.results || [];
}

function mapPackageRow(row, assets = []) {
  if (!row) return null;
  const packageData = parseJson(row.package_json, {});
  const review = parseJson(row.review_json, null);
  const mappedAssets = assets.map(asset => ({ id: asset.id, type: asset.asset_type, shot_id: asset.shot_id, key: asset.r2_key, status: asset.status, ...parseJson(asset.metadata_json, {}), url: asset.r2_key ? `/api/assets?key=${encodeURIComponent(asset.r2_key)}${asset.asset_type === 'image' ? '&inline=1' : ''}` : null }));
  return {
    id: row.id, conversation_id: row.conversation_id, version_number: row.version_number, parent_package_id: row.parent_package_id,
    status: row.status, change_type: row.change_type, change_instruction: row.change_instruction, approved_plan: parseJson(row.plan_json, {}),
    package: packageData, review, research: parseJson(row.research_json, null), locked_paths: parseJson(row.locked_paths_json, []), user_edited_paths: parseJson(row.user_edited_paths_json, []),
    created_at: row.created_at, updated_at: row.updated_at, assets: {
      images: mappedAssets.filter(item => item.type === 'image'),
      tts: mappedAssets.find(item => item.type === 'tts') || null,
    },
    downloads: {
      manifest: row.manifest_r2_key ? `/api/assets?key=${encodeURIComponent(row.manifest_r2_key)}` : null,
      script: row.script_r2_key ? `/api/assets?key=${encodeURIComponent(row.script_r2_key)}` : null,
      shot_list: row.shot_list_r2_key ? `/api/assets?key=${encodeURIComponent(row.shot_list_r2_key)}` : null,
    },
  };
}

export async function createPackage(env, input) {
  const packageId = input.id || id('pkg');
  const timestamp = nowIso();
  const allocated = await env.DB.prepare(`UPDATE conversations
    SET package_sequence = package_sequence + 1, updated_at = ?
    WHERE id = ? RETURNING package_sequence`).bind(timestamp, input.conversation_id).first();
  if (!allocated) throw httpError(404, 'Conversation not found.');
  const versionNumber = Number(allocated.package_sequence);
  const statements = [
    env.DB.prepare(`INSERT INTO packages
      (id, conversation_id, version_number, parent_package_id, status, change_type, change_instruction, plan_json, package_json, review_json, research_json, locked_paths_json, user_edited_paths_json, manifest_r2_key, script_r2_key, shot_list_r2_key, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(packageId, input.conversation_id, versionNumber, input.parent_package_id || null, input.status || 'completed', input.change_type || 'full_generation', input.change_instruction || null, stringify(input.plan || {}), stringify(input.package || {}), input.review ? stringify(input.review) : null, input.research ? stringify(input.research) : null, stringify(input.locked_paths || []), stringify(input.user_edited_paths || []), input.manifest_r2_key || null, input.script_r2_key || null, input.shot_list_r2_key || null, timestamp, timestamp),
  ];
  for (const asset of input.assets || []) statements.push(
    env.DB.prepare('INSERT INTO package_assets (id, package_id, asset_type, shot_id, r2_key, status, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(asset.id || id('asset'), packageId, asset.asset_type, asset.shot_id || null, asset.key || null, asset.status || 'generated', stringify(asset.metadata || {}), timestamp),
  );
  statements.push(env.DB.prepare('UPDATE conversations SET active_package_id = ?, stage = ?, ready_to_generate = 0, updated_at = ?, version = version + 1 WHERE id = ?')
    .bind(packageId, 'generated', timestamp, input.conversation_id));
  await env.DB.batch(statements);
  return getPackage(env, packageId);
}

export async function getPackage(env, packageId) {
  const row = await env.DB.prepare('SELECT * FROM packages WHERE id = ?').bind(packageId).first();
  if (!row) return null;
  const assets = await env.DB.prepare('SELECT * FROM package_assets WHERE package_id = ? ORDER BY created_at').bind(packageId).all();
  return mapPackageRow(row, assets.results || []);
}

export async function listPackages(env, conversationId, limit = 30) {
  const result = await env.DB.prepare('SELECT * FROM packages WHERE conversation_id = ? ORDER BY version_number DESC LIMIT ?').bind(conversationId, limit).all();
  const output = [];
  for (const row of result.results || []) output.push(await getPackage(env, row.id));
  return output;
}

export async function setActivePackage(env, conversationId, packageId) {
  const packageRecord = await getPackage(env, packageId);
  if (!packageRecord || packageRecord.conversation_id !== conversationId) throw httpError(404, 'Package version not found.');
  await env.DB.prepare('UPDATE conversations SET active_package_id = ?, updated_at = ?, version = version + 1 WHERE id = ?').bind(packageId, nowIso(), conversationId).run();
  return packageRecord;
}

export async function updatePackage(env, packageId, patch) {
  const current = await getPackage(env, packageId);
  if (!current) throw httpError(404, 'Package not found.');
  const next = { ...current, ...patch };
  await env.DB.prepare(`UPDATE packages SET package_json = ?, review_json = ?, locked_paths_json = ?, user_edited_paths_json = ?, status = ?, updated_at = ? WHERE id = ?`)
    .bind(stringify(next.package), next.review ? stringify(next.review) : null, stringify(next.locked_paths || []), stringify(next.user_edited_paths || []), next.status || 'completed', nowIso(), packageId).run();
  return getPackage(env, packageId);
}

export async function insertFeedback(env, input) {
  const feedbackId = id('fb');
  const packageRecord = await getPackage(env, input.package_id);
  if (!packageRecord) throw httpError(404, 'Package not found.');
  await env.DB.prepare('INSERT INTO feedback (id, package_id, conversation_id, ratings_json, liked, change_requested, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(feedbackId, input.package_id, packageRecord.conversation_id, stringify(input.ratings || {}), cleanText(input.liked).slice(0, 4000), cleanText(input.change_requested).slice(0, 4000), nowIso()).run();
  return { id: feedbackId, package_id: input.package_id, conversation_id: packageRecord.conversation_id, ratings: input.ratings || {}, liked: cleanText(input.liked), change_requested: cleanText(input.change_requested) };
}

/** Returns the most recent feedback record for a given package — used to seed regeneration context. */
export async function getLatestFeedback(env, packageId) {
  const row = await env.DB.prepare('SELECT * FROM feedback WHERE package_id = ? ORDER BY created_at DESC LIMIT 1').bind(packageId).first();
  if (!row) return null;
  return { id: row.id, package_id: row.package_id, conversation_id: row.conversation_id, ratings: parseJson(row.ratings_json, {}), liked: row.liked, change_requested: row.change_requested, created_at: row.created_at };
}

export async function insertMemorySuggestion(env, input) {
  const suggestionId = id('ms');
  await env.DB.prepare('INSERT INTO memory_suggestions (id, source_type, source_id, suggestion, evidence_json, scope, target_field, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(suggestionId, input.source_type, input.source_id, cleanText(input.suggestion).slice(0, 1800), stringify(input.evidence || []), input.scope || 'global', input.target_field || '', 'proposed', nowIso()).run();
  return suggestionId;
}

export async function listMemorySuggestions(env, status = 'proposed', limit = 50) {
  const result = await env.DB.prepare('SELECT * FROM memory_suggestions WHERE status = ? ORDER BY created_at DESC LIMIT ?').bind(status, limit).all();
  return (result.results || []).map(row => ({ ...row, evidence: parseJson(row.evidence_json, []) }));
}

export async function resolveMemorySuggestion(env, suggestionId, status) {
  if (!['approved', 'rejected'].includes(status)) throw httpError(400, 'Invalid suggestion status.');
  await env.DB.prepare('UPDATE memory_suggestions SET status = ?, resolved_at = ? WHERE id = ?').bind(status, nowIso(), suggestionId).run();
  return env.DB.prepare('SELECT * FROM memory_suggestions WHERE id = ?').bind(suggestionId).first();
}

export async function createPublication(env, input) {
  const packageRecord = await getPackage(env, input.package_id);
  if (!packageRecord) throw httpError(404, 'Package not found.');
  const publication = { id: id('pub'), package_id: input.package_id, conversation_id: packageRecord.conversation_id, platform: cleanText(input.platform || 'instagram').slice(0, 80), permalink: cleanText(input.permalink).slice(0, 1000), platform_media_id: cleanText(input.platform_media_id).slice(0, 200), published_at: input.published_at || nowIso(), actual_duration_seconds: input.actual_duration_seconds ? Number(input.actual_duration_seconds) : null, hook_used: cleanText(input.hook_used).slice(0, 3000), actual_changes: cleanText(input.actual_changes).slice(0, 5000), metadata: input.metadata || {}, created_at: nowIso(), updated_at: nowIso() };
  await env.DB.prepare(`INSERT INTO publications (id, package_id, conversation_id, platform, permalink, platform_media_id, published_at, actual_duration_seconds, hook_used, actual_changes, metadata_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(publication.id, publication.package_id, publication.conversation_id, publication.platform, publication.permalink || null, publication.platform_media_id || null, publication.published_at, publication.actual_duration_seconds, publication.hook_used || null, publication.actual_changes || null, stringify(publication.metadata), publication.created_at, publication.updated_at).run();
  return publication;
}

export async function listPublications(env, limit = 100) {
  const result = await env.DB.prepare(`SELECT p.*, pk.version_number, pk.package_json FROM publications p JOIN packages pk ON pk.id = p.package_id ORDER BY COALESCE(p.published_at, p.created_at) DESC LIMIT ?`).bind(limit).all();
  return (result.results || []).map(row => ({ ...row, package: parseJson(row.package_json, {}), metadata: parseJson(row.metadata_json, {}) }));
}

export async function findPublicationByPermalink(env, permalink) {
  return env.DB.prepare('SELECT * FROM publications WHERE permalink = ? LIMIT 1').bind(permalink).first();
}

export async function upsertInstagramMedia(env, item) {
  await env.DB.prepare(`INSERT INTO instagram_media (media_id, permalink, caption, media_type, timestamp, thumbnail_url, raw_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(media_id) DO UPDATE SET permalink=excluded.permalink, caption=excluded.caption, media_type=excluded.media_type, timestamp=excluded.timestamp, thumbnail_url=excluded.thumbnail_url, raw_json=excluded.raw_json, updated_at=excluded.updated_at`)
    .bind(item.id, item.permalink || null, item.caption || null, item.media_type || null, item.timestamp || null, item.thumbnail_url || null, stringify(item), nowIso()).run();
}

export async function insertMetricSnapshot(env, input) {
  const snapshotId = id('metric');
  await env.DB.prepare('INSERT INTO instagram_metric_snapshots (id, media_id, publication_id, snapshot_label, metrics_json, captured_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(snapshotId, input.media_id, input.publication_id || null, input.snapshot_label || 'latest', stringify(input.metrics || {}), input.captured_at || nowIso()).run();
  return snapshotId;
}

export async function insertInsightReport(env, report) {
  await env.DB.prepare('INSERT INTO insight_reports (id, status, analysis_json, reels_json, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(report.id, report.status, stringify(report.analysis || {}), stringify(report.reels || []), report.created_at).run();
  return report;
}

export async function listInsightReports(env, limit = 30) {
  const result = await env.DB.prepare('SELECT * FROM insight_reports ORDER BY created_at DESC LIMIT ?').bind(limit).all();
  return (result.results || []).map(row => ({ id: row.id, status: row.status, analysis: parseJson(row.analysis_json, {}), reels: parseJson(row.reels_json, []), created_at: row.created_at }));
}

export async function insertPerformanceLearning(env, learning) {
  const learningId = id('learn');
  await env.DB.prepare(`INSERT INTO performance_learnings
    (id, statement, observation, hypothesis, recommended_test, content_pillar, platform, format, metric, evidence_count, confidence, supporting_publication_ids_json, status, created_at, review_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(learningId, learning.statement, learning.observation || '', learning.hypothesis || '', learning.recommended_test || '', learning.content_pillar || '', learning.platform || '', learning.format || '', learning.metric || '', Number(learning.evidence_count || 0), Number(learning.confidence || 0), stringify(learning.supporting_publication_ids || []), learning.status || 'proposed', nowIso(), learning.review_at || null).run();
  return learningId;
}

export async function listPerformanceLearnings(env, status = 'approved', limit = 30) {
  const result = await env.DB.prepare('SELECT * FROM performance_learnings WHERE status = ? ORDER BY confidence DESC, created_at DESC LIMIT ?').bind(status, limit).all();
  return (result.results || []).map(row => ({ ...row, supporting_publication_ids: parseJson(row.supporting_publication_ids_json, []) }));
}

export async function resolvePerformanceLearning(env, learningId, status) {
  if (!['approved', 'rejected', 'proposed'].includes(status)) throw httpError(400, 'Invalid learning status.');
  await env.DB.prepare('UPDATE performance_learnings SET status = ? WHERE id = ?').bind(status, learningId).run();
}

export async function setJob(env, jobId, value) {
  const current = await getJob(env, jobId);
  const next = { ...(current || {}), ...(value || {}), id: jobId, updated_at: nowIso() };
  await env.DB.prepare(`INSERT INTO jobs (id, type, state, progress, conversation_id, payload_json, result_json, error, created_at, started_at, completed_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET type=excluded.type, state=excluded.state, progress=excluded.progress, conversation_id=excluded.conversation_id, payload_json=excluded.payload_json, result_json=excluded.result_json, error=excluded.error, started_at=excluded.started_at, completed_at=excluded.completed_at, updated_at=excluded.updated_at`)
    .bind(jobId, next.type || 'unknown', next.state || 'queued', next.progress || null, next.conversation_id || null, stringify(next.payload || {}), next.result ? stringify(next.result) : null, next.error || null, next.created_at || nowIso(), next.started_at || null, next.completed_at || null, next.updated_at).run();
  return getJob(env, jobId);
}

export async function getJob(env, jobId) {
  const row = await env.DB.prepare('SELECT * FROM jobs WHERE id = ?').bind(jobId).first();
  if (!row) return null;
  return { id: row.id, type: row.type, state: row.state, progress: row.progress, conversation_id: row.conversation_id, payload: parseJson(row.payload_json, {}), result: parseJson(row.result_json, null), error: row.error, created_at: row.created_at, started_at: row.started_at, completed_at: row.completed_at, updated_at: row.updated_at };
}

export async function insertUsageEvent(env, event) {
  if (!env.DB) return;
  try {
    await env.DB.prepare(`INSERT INTO usage_events (id, task, model, conversation_id, package_id, job_id, input_tokens_estimate, output_tokens_estimate, latency_ms, status, retry_count, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id('use'), event.task, event.model || null, event.conversation_id || null, event.package_id || null, event.job_id || null, event.input_tokens_estimate || null, event.output_tokens_estimate || null, event.latency_ms || null, event.status || 'completed', event.retry_count || 0, stringify(event.metadata || {}), nowIso()).run();
  } catch (error) { console.warn('[usage] failed to record', error.message); }
}

export async function usageSummary(env, days = 30) {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  const totals = await env.DB.prepare(`SELECT task, model, COUNT(*) calls, SUM(COALESCE(input_tokens_estimate,0)) input_tokens, SUM(COALESCE(output_tokens_estimate,0)) output_tokens, AVG(COALESCE(latency_ms,0)) avg_latency_ms, SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) failures FROM usage_events WHERE created_at >= ? GROUP BY task, model ORDER BY calls DESC`).bind(cutoff).all();
  const jobs = await env.DB.prepare(`SELECT type, state, COUNT(*) count FROM jobs WHERE created_at >= ? GROUP BY type, state`).bind(cutoff).all();
  const packages = await env.DB.prepare('SELECT COUNT(*) count FROM packages WHERE created_at >= ?').bind(cutoff).first();
  const assets = await env.DB.prepare("SELECT asset_type, COUNT(*) count FROM package_assets WHERE created_at >= ? GROUP BY asset_type").bind(cutoff).all();
  const rows = totals.results || [];
  return {
    days,
    totals: rows,
    total_calls: rows.reduce((sum, row) => sum + Number(row.calls || 0), 0),
    input_tokens: rows.reduce((sum, row) => sum + Number(row.input_tokens || 0), 0),
    output_tokens: rows.reduce((sum, row) => sum + Number(row.output_tokens || 0), 0),
    failures: rows.reduce((sum, row) => sum + Number(row.failures || 0), 0),
    jobs: jobs.results || [], package_count: Number(packages?.count || 0), assets: assets.results || [],
  };
}

export async function beginResearchRun(env, conversationId, mode, queries) {
  const runId = id('research');
  await env.DB.prepare('INSERT INTO research_runs (id, conversation_id, mode, queries_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(runId, conversationId, mode, stringify(queries || []), 'running', nowIso()).run();
  return runId;
}

export async function finishResearchRun(env, runId, sources, claims = []) {
  for (const source of sources || []) {
    await env.DB.prepare('INSERT INTO research_sources (id, research_run_id, title, url, domain, published_at, fetched_at, source_type, reliability_score, excerpt, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(source.id, runId, source.title || '', source.url, source.domain || '', source.published_at || null, source.fetched_at || nowIso(), source.source_type || '', source.reliability_score || null, source.excerpt || '', stringify(source.raw || {})).run();
  }
  for (const claim of claims || []) {
    await env.DB.prepare('INSERT INTO research_claims (id, research_run_id, claim, confidence, supporting_source_ids_json, contradicting_source_ids_json, caveat) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(claim.id || id('claim'), runId, claim.claim, claim.confidence || '', stringify(claim.supporting_source_ids || []), stringify(claim.contradicting_source_ids || []), claim.caveat || '').run();
  }
  await env.DB.prepare('UPDATE research_runs SET status = ?, completed_at = ? WHERE id = ?').bind('completed', nowIso(), runId).run();
}

/**
 * Global search across conversations, messages, and package titles.
 * Returns up to `limit` matching conversation IDs with snippets.
 */
export async function globalSearch(env, query, limit = 20) {
  assertDb(env);
  const q = `%${cleanText(query).slice(0, 200)}%`;
  const [convRows, msgRows] = await Promise.all([
    env.DB.prepare(`SELECT id, title, stage, updated_at FROM conversations WHERE title LIKE ? ORDER BY updated_at DESC LIMIT ?`).bind(q, limit).all(),
    env.DB.prepare(`SELECT DISTINCT conversation_id, content FROM messages WHERE content LIKE ? LIMIT ?`).bind(q, limit).all(),
  ]);
  const seen = new Set();
  const results = [];
  for (const row of convRows.results || []) {
    seen.add(row.id);
    results.push({ conversation_id: row.id, title: row.title, stage: row.stage, snippet: row.title, match_type: 'title' });
  }
  for (const row of msgRows.results || []) {
    if (seen.has(row.conversation_id)) continue;
    seen.add(row.conversation_id);
    const snippet = cleanText(row.content).slice(0, 120);
    results.push({ conversation_id: row.conversation_id, snippet, match_type: 'message' });
  }
  return results.slice(0, limit);
}

/**
 * Enforces retention policy from creator_context.
 * Called by the scheduled handler; safe to call multiple times.
 */
export async function runRetentionCleanup(env) {
  if (!env.DB) return;
  try {
    const ctx = await getCreatorContext(env);
    const ret = ctx.retention || {};
    const usageDays = Number(ret.usage_event_days || 180);
    const jobDays = Number(ret.failed_job_days || 30);
    const usageCutoff = new Date(Date.now() - usageDays * 86400000).toISOString();
    const jobCutoff = new Date(Date.now() - jobDays * 86400000).toISOString();
    await Promise.all([
      env.DB.prepare(`DELETE FROM usage_events WHERE created_at < ?`).bind(usageCutoff).run(),
      env.DB.prepare(`DELETE FROM jobs WHERE state = 'failed' AND created_at < ?`).bind(jobCutoff).run(),
    ]);
  } catch (error) {
    console.warn('[retention-cleanup]', error.message);
  }
}
