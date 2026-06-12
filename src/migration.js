import { LEGACY_CONTEXT_KEY, LEGACY_CONVERSATION_INDEX_KEY, LEGACY_INSIGHTS_INDEX_KEY, blankDecisionSnapshot, normalizeCreatorContext } from './config.js';
import { createPackage, getConversation, insertInsightReport, saveCreatorContext } from './db.js';
import { cleanText, id, nowIso, stringify } from './utils.js';

const MIGRATION_MARKER = 'migration:v4:d1:completed';

export async function migrateLegacyKvToD1(env, { force = false } = {}) {
  const previous = await env.APP_KV.get(MIGRATION_MARKER, 'json');
  if (previous && !force) return { ...previous, already_completed: true };
  const report = { started_at: nowIso(), context_migrated: false, conversations_seen: 0, conversations_migrated: 0, messages_migrated: 0, attachments_migrated: 0, packages_migrated: 0, insights_migrated: 0, warnings: [] };

  const legacyContext = await env.APP_KV.get(LEGACY_CONTEXT_KEY, 'json');
  if (legacyContext) {
    await saveCreatorContext(env, normalizeCreatorContext(legacyContext));
    report.context_migrated = true;
  }

  const index = await env.APP_KV.get(LEGACY_CONVERSATION_INDEX_KEY, 'json') || [];
  report.conversations_seen = index.length;
  for (const summary of index) {
    try {
      const legacy = await env.APP_KV.get(`conversation:${summary.id}`, 'json');
      if (!legacy) { report.warnings.push(`Missing KV conversation ${summary.id}.`); continue; }
      const existing = await getConversation(env, legacy.id, { includeMessages: false, includeAttachments: false, includePackages: false });
      if (!existing) {
        await env.DB.prepare(`INSERT INTO conversations
          (id, title, stage, ready_to_generate, decision_json, summary_json, missing_decisions_json, last_summarized_sequence, version, message_sequence, generation_job_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, NULL, ?, 0, 1, 0, ?, ?, ?)`)
          .bind(legacy.id, cleanText(legacy.title).slice(0, 120) || 'Imported conversation', legacy.stage || 'discovery', legacy.ready_to_generate ? 1 : 0,
            stringify({ ...blankDecisionSnapshot(), ...(legacy.decision_snapshot || {}) }), stringify(legacy.missing_decisions || []), legacy.generation_job_id || null,
            legacy.created_at || nowIso(), legacy.updated_at || nowIso()).run();
      }

      let sequence = 0;
      for (const message of legacy.messages || []) {
        sequence += 1;
        const duplicate = await env.DB.prepare('SELECT id FROM messages WHERE conversation_id = ? AND sequence_number = ?').bind(legacy.id, sequence).first();
        const messageId = duplicate?.id || id('m');
        if (!duplicate) {
          await env.DB.prepare('INSERT INTO messages (id, conversation_id, sequence_number, role, content, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .bind(messageId, legacy.id, sequence, message.role === 'assistant' ? 'assistant' : 'user', cleanText(message.content), stringify({ imported_from_kv: true }), message.at || legacy.created_at || nowIso()).run();
          report.messages_migrated += 1;
        }
        for (const attachment of message.attachments || []) {
          const attachmentId = attachment.id || id('att');
          const existsAttachment = await env.DB.prepare('SELECT id FROM attachments WHERE id = ?').bind(attachmentId).first();
          if (!existsAttachment && attachment.key) {
            await env.DB.prepare(`INSERT INTO attachments
              (id, conversation_id, message_id, r2_key, original_name, mime_type, size_bytes, status, summary, extraction_method, checksum, metadata_json, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
              .bind(attachmentId, legacy.id, messageId, attachment.key, attachment.name || 'Imported attachment', attachment.type || 'application/octet-stream', Number(attachment.size || 0), 'ready', attachment.summary || '', 'legacy_import', '', stringify({ imported_from_kv: true }), message.at || nowIso(), nowIso()).run();
            const extracted = cleanText(attachment.extracted_text || '');
            if (extracted) {
              await env.DB.prepare('INSERT INTO document_chunks (id, attachment_id, conversation_id, chunk_number, page_start, page_end, text, vector_id, token_count, checksum, created_at) VALUES (?, ?, ?, 0, NULL, NULL, ?, NULL, ?, ?, ?)')
                .bind(id('chunk'), attachmentId, legacy.id, extracted.slice(0, 200000), Math.ceil(extracted.length / 4), '', nowIso()).run();
              await env.AGENT_QUEUE.send({ type: 'index_attachment', attachment_id: attachmentId, migrated: true });
            }
            report.attachments_migrated += 1;
          }
        }
      }

      await env.DB.prepare('UPDATE conversations SET message_sequence = MAX(message_sequence, ?), updated_at = ? WHERE id = ?')
        .bind(sequence, legacy.updated_at || nowIso(), legacy.id).run();

      if (legacy.final_package) {
        const existingPackage = await env.DB.prepare('SELECT id FROM packages WHERE conversation_id = ? LIMIT 1').bind(legacy.id).first();
        if (!existingPackage) {
          const fp = legacy.final_package;
          await createPackage(env, {
            id: fp.id || id('pkg'), conversation_id: legacy.id, status: 'completed', change_type: 'legacy_import',
            plan: legacy.decision_snapshot || {}, package: fp.package || fp.content_package || fp, review: fp.review || null,
            manifest_r2_key: fp.manifest_key || fp.manifest_r2_key || null, script_r2_key: fp.script_key || fp.script_r2_key || null,
            shot_list_r2_key: fp.shot_list_key || fp.shot_list_r2_key || null,
            assets: [
              ...(fp.images || fp.image_assets || []).filter(item => item?.key).map(item => ({ asset_type: 'image', shot_id: item.shot_id || item.id, key: item.key, status: item.status || 'generated', metadata: item })),
              ...(fp.tts?.key ? [{ asset_type: 'tts', key: fp.tts.key, status: 'generated', metadata: fp.tts }] : []),
            ],
          });
          report.packages_migrated += 1;
        }
      }
      report.conversations_migrated += 1;
    } catch (error) {
      report.warnings.push(`${summary.id}: ${error.message}`);
    }
  }

  const insights = await env.APP_KV.get(LEGACY_INSIGHTS_INDEX_KEY, 'json') || [];
  for (const item of insights) {
    try {
      const exists = await env.DB.prepare('SELECT id FROM insight_reports WHERE id = ?').bind(item.id).first();
      if (!exists) { await insertInsightReport(env, { id: item.id || id('insight'), status: item.status || 'ready', analysis: item.analysis || {}, reels: item.reels || [], created_at: item.created_at || nowIso() }); report.insights_migrated += 1; }
    } catch (error) { report.warnings.push(`Insight ${item.id}: ${error.message}`); }
  }

  report.completed_at = nowIso();
  await env.APP_KV.put(MIGRATION_MARKER, JSON.stringify(report));
  return report;
}
