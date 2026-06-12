import { APP_VERSION, getModels } from './config.js';
import { clearSessionCookie, login, readSession, requireSession, verifySameOrigin } from './auth.js';
import {
  getAttachment, getConversation, getCreatorContext, getJob, getPackage,
  listAttachments, listConversations, listInsightReports, listMemorySuggestions, listPackages, listPerformanceLearnings,
  listPublications, resolveMemorySuggestion, resolvePerformanceLearning, saveCreatorContext, updateConversation, usageSummary,
} from './db.js';
import { addConversationMessage, addConversationPin, createConversation, duplicateConversation, editConversationPin, removeConversationPin } from './conversations.js';
import { processQueueBatch } from './jobs.js';
import { migrateLegacyKvToD1 } from './migration.js';
import {
  editPackage, markPublished, queueGeneration, queueRegeneration, restorePackage, saveFeedback, setPackageLocks,
} from './packages.js';
import { queueInsightsRefresh } from './performance.js';
import { createUrlAttachment, deleteAttachment } from './sources.js';
import { runStructured } from './ai.js';
import { json, html, httpError, id, isStateChanging, nowIso, readJson, requestId, safeError, safeFilename } from './utils.js';
import { APP_HTML } from './ui.js';

export default {
  async fetch(request, env, ctx) {
    const rid = requestId(request);
    const started = Date.now();
    try {
      const response = await route(request, env, ctx);
      response.headers.set('X-Request-Id', rid);
      response.headers.set('X-Content-Type-Options', 'nosniff');
      response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
      console.log(JSON.stringify({ level: 'info', event: 'request', request_id: rid, method: request.method, path: new URL(request.url).pathname, status: response.status, duration_ms: Date.now() - started }));
      return response;
    } catch (error) {
      const status = error?.status || 500;
      console.error(JSON.stringify({ level: 'error', event: 'request_failed', request_id: rid, method: request.method, path: new URL(request.url).pathname, status, duration_ms: Date.now() - started, error: safeError(error) }));
      return json({ ok: false, error: error.message || 'Unexpected server error.', code: error.code || null, request_id: rid }, status, { 'X-Request-Id': rid });
    }
  },

  async scheduled(_event, env, ctx) {
    // Respect the user-controlled auto-refresh toggle (absence means enabled by default).
    const autoRefresh = await env.APP_KV.get('settings:insights_auto_refresh');
    if (autoRefresh !== '0') ctx.waitUntil(queueInsightsRefresh(env, false));
    // 2.8 — Enforce retention policy on every cron run.
    ctx.waitUntil(runRetentionCleanup(env));
  },

  async queue(batch, env) {
    await processQueueBatch(batch, env);
  },
};

async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: { Allow: 'GET,POST,PUT,DELETE,OPTIONS' } });
  if (path === '/health') return health(env);
  if (path === '/api/auth/login' && method === 'POST') return login(request, env);
  if (path === '/api/auth/status' && method === 'GET') return json({ ok: true, authenticated: Boolean(await readSession(request, env)), version: APP_VERSION });
  if (path === '/api/auth/logout' && method === 'POST') {
    verifySameOrigin(request);
    const session = await readSession(request, env);
    if (session?.nonce) await env.APP_KV.delete(`session:nonce:${session.nonce}`);
    return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie(url.protocol === 'https:') });
  }

  if (!path.startsWith('/api/')) return appHtml();
  await requireSession(request, env);
  if (isStateChanging(method)) verifySameOrigin(request);
  if (path === '/api/health/integrations' && method === 'GET') return json({ ok: true, integrations: integrationStatus(env) });

  if (path === '/api/bootstrap' && method === 'GET') {
    // 4.1 — Cache the expensive bootstrap payload for 30 s to reduce cold-start latency.
    const BOOTSTRAP_CACHE_KEY = 'cache:bootstrap:v1';
    const cached = await env.APP_KV.get(BOOTSTRAP_CACHE_KEY, 'json');
    if (cached) return json(cached);
    const [context, conversations, insights, suggestions, learnings, proposedLearnings, publications, usage, templates, autoRefreshValue] = await Promise.all([
      getCreatorContext(env), listConversations(env), listInsightReports(env, 30), listMemorySuggestions(env, 'proposed'),
      listPerformanceLearnings(env, 'approved', 30), listPerformanceLearnings(env, 'proposed', 30), listPublications(env, 100), usageSummary(env, 30),
      listConversationTemplates(env), env.APP_KV.get('settings:insights_auto_refresh'),
    ]);
    const payload = {
      ok: true, version: APP_VERSION, context, conversations, insights, suggestions, learnings,
      proposed_learnings: proposedLearnings, publications, usage, templates,
      insights_auto_refresh: autoRefreshValue !== '0', models: getModels(env),
    };
    await env.APP_KV.put(BOOTSTRAP_CACHE_KEY, JSON.stringify(payload), { expirationTtl: 60 });
    return json(payload);
  }

  if (path === '/api/context' && method === 'GET') return json({ ok: true, context: await getCreatorContext(env) });
  if (path === '/api/context' && method === 'PUT') {
    const result = await saveCreatorContext(env, await readJson(request));
    await invalidateBootstrapCache(env);
    return json({ ok: true, context: result });
  }

  if (path === '/api/conversations' && method === 'GET') return json({ ok: true, conversations: await listConversations(env) });
  if (path === '/api/conversations' && method === 'POST') {
    const body = await readJson(request, {});
    let conversation = await createConversation(env, body.title);
    if (body.template_id) {
      const template = await getConversationTemplate(env, String(body.template_id));
      if (!template) throw httpError(404, 'Conversation template not found.');
      conversation = await updateConversation(env, conversation.id, {
        title: cleanTemplateTitle(body.title, template.name),
        stage: 'planning',
        ready_to_generate: false,
        decision_snapshot: template.decision_snapshot || {},
        missing_decisions: [],
      });
    }
    await invalidateBootstrapCache(env);
    return json({ ok: true, conversation }, 201);
  }

  let match = path.match(/^\/api\/conversations\/([^/]+)$/);
  if (match && method === 'GET') {
    const conversation = await getConversation(env, decodeURIComponent(match[1]));
    if (!conversation) throw httpError(404, 'Conversation not found.');
    return json({ ok: true, conversation });
  }
  if (match && method === 'DELETE') {
    const conversationId = decodeURIComponent(match[1]);
    await deleteConversation(env, conversationId);
    await invalidateBootstrapCache(env);
    return json({ ok: true });
  }

  // 2.2 — Export conversation as Markdown.
  match = path.match(/^\/api\/conversations\/([^/]+)\/export$/);
  if (match && method === 'GET') {
    const conversation = await getConversation(env, decodeURIComponent(match[1]));
    if (!conversation) throw httpError(404, 'Conversation not found.');
    return new Response(buildExportMarkdown(conversation), {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeFilename(conversation.title) || 'conversation'}.md"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  // 2.3 — Duplicate conversation (copies messages, decision snapshot, and pins; no packages).
  match = path.match(/^\/api\/conversations\/([^/]+)\/duplicate$/);
  if (match && method === 'POST') {
    const duplicated = await duplicateConversation(env, decodeURIComponent(match[1]));
    await invalidateBootstrapCache(env);
    return json({ ok: true, conversation: duplicated }, 201);
  }

  match = path.match(/^\/api\/conversations\/([^/]+)\/messages$/);
  if (match && method === 'POST') {
    const conversation = await addConversationMessage(request, env, decodeURIComponent(match[1]));
    await invalidateBootstrapCache(env);
    return json({ ok: true, conversation });
  }

  match = path.match(/^\/api\/conversations\/([^/]+)\/pins$/);
  if (match && method === 'POST') {
    const body = await readJson(request);
    const pin = await addConversationPin(env, decodeURIComponent(match[1]), body.text);
    await invalidateBootstrapCache(env);
    return json({ ok: true, pin }, 201);
  }
  match = path.match(/^\/api\/conversations\/([^/]+)\/pins\/([^/]+)$/);
  if (match && method === 'DELETE') {
    await removeConversationPin(env, decodeURIComponent(match[1]), decodeURIComponent(match[2]));
    await invalidateBootstrapCache(env);
    return json({ ok: true });
  }
  // 2.6 — Edit an existing pin in place.
  if (match && method === 'PUT') {
    const pin = await editConversationPin(env, decodeURIComponent(match[1]), decodeURIComponent(match[2]), (await readJson(request)).text);
    await invalidateBootstrapCache(env);
    return json({ ok: true, pin });
  }

  // 2.7 — Global search across titles, messages, and generated package JSON.
  if (path === '/api/search' && method === 'GET') {
    const q = (url.searchParams.get('q') || '').trim();
    if (q.length < 2) return json({ ok: true, results: [] });
    const like = `%${q.slice(0, 100)}%`;
    const rows = await env.DB.prepare(`
      SELECT c.id, c.title, c.stage, c.updated_at,
        EXISTS(SELECT 1 FROM packages px WHERE px.conversation_id = c.id) AS has_package,
        (SELECT COUNT(*) FROM messages mx WHERE mx.conversation_id = c.id) AS message_count,
        (SELECT COUNT(*) FROM packages py WHERE py.conversation_id = c.id) AS package_count,
        CASE
          WHEN c.title LIKE ? THEN c.title
          WHEN EXISTS(SELECT 1 FROM messages m1 WHERE m1.conversation_id = c.id AND m1.content LIKE ?)
            THEN (SELECT substr(m2.content, 1, 240) FROM messages m2 WHERE m2.conversation_id = c.id AND m2.content LIKE ? ORDER BY m2.sequence_number DESC LIMIT 1)
          ELSE 'Matched generated package content'
        END AS snippet
      FROM conversations c
      WHERE c.title LIKE ?
         OR EXISTS(SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.content LIKE ?)
         OR EXISTS(SELECT 1 FROM packages p WHERE p.conversation_id = c.id AND p.package_json LIKE ?)
      ORDER BY c.updated_at DESC
      LIMIT 20
    `).bind(like, like, like, like, like, like).all();
    return json({ ok: true, results: rows.results || [] });
  }

  match = path.match(/^\/api\/conversations\/([^/]+)\/urls$/);
  if (match && method === 'POST') {
    const conversationId = decodeURIComponent(match[1]);
    const body = await readJson(request);
    const { insertMessage } = await import('./db.js');
    const message = await insertMessage(env, conversationId, 'user', `Reference URL: ${body.url}`, { source_url: body.url });
    const attachment = await createUrlAttachment(env, { conversationId, messageId: message.id, url: body.url });
    if (attachment.metadata?.ocr_pending) await env.AGENT_QUEUE.send({ type: 'ocr_attachment', attachment_id: attachment.id, conversation_id: conversationId });
    else if (attachment.metadata?.processor_pending) await env.AGENT_QUEUE.send({ type: 'analyze_video', attachment_id: attachment.id, conversation_id: conversationId });
    else await env.AGENT_QUEUE.send({ type: 'index_attachment', job_id: `index-${attachment.id}`, attachment_id: attachment.id, conversation_id: conversationId });
    return json({ ok: true, attachment }, 201);
  }

  match = path.match(/^\/api\/conversations\/([^/]+)\/attachments$/);
  if (match && method === 'GET') return json({ ok: true, attachments: await listAttachments(env, decodeURIComponent(match[1]), 200) });

  match = path.match(/^\/api\/conversations\/([^/]+)\/packages$/);
  if (match && method === 'GET') return json({ ok: true, packages: await listPackages(env, decodeURIComponent(match[1]), 50) });

  match = path.match(/^\/api\/conversations\/([^/]+)\/generate$/);
  if (match && method === 'POST') return json({ ok: true, job_id: await queueGeneration(env, decodeURIComponent(match[1])) }, 202);

  match = path.match(/^\/api\/attachments\/([^/]+)$/);
  if (match && method === 'GET') {
    const attachment = await getAttachment(env, decodeURIComponent(match[1]));
    if (!attachment) throw httpError(404, 'Attachment not found.');
    return json({ ok: true, attachment });
  }
  if (match && method === 'DELETE') {
    await deleteAttachment(env, decodeURIComponent(match[1]));
    return json({ ok: true });
  }

  match = path.match(/^\/api\/packages\/([^/]+)$/);
  if (match && method === 'GET') {
    const packageRecord = await getPackage(env, decodeURIComponent(match[1]));
    if (!packageRecord) throw httpError(404, 'Package not found.');
    return json({ ok: true, package: packageRecord });
  }
  match = path.match(/^\/api\/packages\/([^/]+)\/regenerate$/);
  if (match && method === 'POST') return json({ ok: true, job_id: await queueRegeneration(env, decodeURIComponent(match[1]), await readJson(request)) }, 202);
  match = path.match(/^\/api\/packages\/([^/]+)\/edit$/);
  if (match && method === 'POST') return json({ ok: true, package: await editPackage(env, decodeURIComponent(match[1]), await readJson(request)) }, 201);
  match = path.match(/^\/api\/packages\/([^/]+)\/locks$/);
  if (match && method === 'PUT') {
    const body = await readJson(request);
    return json({ ok: true, package: await setPackageLocks(env, decodeURIComponent(match[1]), body.paths || []) });
  }
  match = path.match(/^\/api\/packages\/([^/]+)\/feedback$/);
  if (match && method === 'POST') return json({ ok: true, feedback: await saveFeedback(env, decodeURIComponent(match[1]), await readJson(request)) }, 201);
  match = path.match(/^\/api\/packages\/([^/]+)\/publish$/);
  if (match && method === 'POST') return json({ ok: true, publication: await markPublished(env, decodeURIComponent(match[1]), await readJson(request)) }, 201);

  match = path.match(/^\/api\/conversations\/([^/]+)\/packages\/([^/]+)\/restore$/);
  if (match && method === 'POST') return json({ ok: true, package: await restorePackage(env, decodeURIComponent(match[1]), decodeURIComponent(match[2])) });

  match = path.match(/^\/api\/jobs\/([^/]+)$/);
  if (match && method === 'GET') {
    const job = await getJob(env, decodeURIComponent(match[1]));
    if (!job) throw httpError(404, 'Job not found.');
    return json({ ok: true, job });
  }

  if (path === '/api/insights' && method === 'GET') return json({ ok: true, insights: await listInsightReports(env, 30) });
  if (path === '/api/insights/refresh' && method === 'POST') return json({ ok: true, job_id: await queueInsightsRefresh(env, true) }, 202);

  // 6.4 — User-controlled daily auto-refresh toggle.
  if (path === '/api/settings/insights-auto-refresh' && method === 'GET') {
    const value = await env.APP_KV.get('settings:insights_auto_refresh');
    return json({ ok: true, enabled: value !== '0' });
  }
  if (path === '/api/settings/insights-auto-refresh' && (method === 'PUT' || method === 'POST')) {
    const body = await readJson(request);
    await env.APP_KV.put('settings:insights_auto_refresh', body.enabled ? '1' : '0');
    return json({ ok: true, enabled: Boolean(body.enabled) });
  }

  if (path === '/api/templates' && method === 'GET') return json({ ok: true, templates: await listConversationTemplates(env) });
  if (path === '/api/templates' && method === 'POST') {
    const template = await saveConversationTemplate(env, await readJson(request));
    await invalidateBootstrapCache(env);
    return json({ ok: true, template }, 201);
  }

  if (path === '/api/publications' && method === 'GET') return json({ ok: true, publications: await listPublications(env, 100) });
  if (path === '/api/memory-suggestions' && method === 'GET') return json({ ok: true, suggestions: await listMemorySuggestions(env, url.searchParams.get('status') || 'proposed') });
  match = path.match(/^\/api\/memory-suggestions\/([^/]+)\/(approve|reject)$/);
  if (match && method === 'POST') {
    const status = match[2] === 'approve' ? 'approved' : 'rejected';
    const suggestion = await resolveMemorySuggestion(env, decodeURIComponent(match[1]), status);
    if (status === 'approved') await applyMemorySuggestion(env, suggestion);
    await invalidateBootstrapCache(env);
    return json({ ok: true, suggestion });
  }

  if (path === '/api/performance-learnings' && method === 'GET') return json({ ok: true, learnings: await listPerformanceLearnings(env, url.searchParams.get('status') || 'approved', 100) });
  match = path.match(/^\/api\/performance-learnings\/([^/]+)\/(approve|reject)$/);
  if (match && method === 'POST') {
    await resolvePerformanceLearning(env, decodeURIComponent(match[1]), match[2] === 'approve' ? 'approved' : 'rejected');
    return json({ ok: true });
  }

  if (path === '/api/usage' && method === 'GET') return json({ ok: true, usage: await usageSummary(env, Number(url.searchParams.get('days') || 30)) });

  if (path === '/api/assets' && method === 'GET') return downloadAsset(env, url, request);

  if (path === '/api/admin/migrate-legacy' && method === 'POST') {
    const body = await readJson(request, {});
    return json({ ok: true, report: await migrateLegacyKvToD1(env, { force: Boolean(body.force) }) });
  }

  if (path === '/api/test-models' && method === 'POST') {
    const models = getModels(env);
    const result = await runStructured(env, models.fast, 'Return a tiny JSON status object.', 'Return {"ok":true,"version":"4"}.', { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean' }, version: { type: 'string' } }, required: ['ok', 'version'] }, { max_tokens: 80, temperature: 0 }, { task: 'model_test' });
    return json({ ok: true, models, result });
  }

  throw httpError(404, 'API route not found.');
}

async function health(env) {
  let database = 'unavailable';
  try { await env.DB.prepare('SELECT 1 ok').first(); database = 'ready'; } catch { database = env.DB ? 'migration_required' : 'not_bound'; }
  return json({ ok: database === 'ready', service: 'personalized-content-agent', version: APP_VERSION, database, time: nowIso() }, database === 'ready' ? 200 : 503);
}

function appHtml() {
  const response = html(APP_HTML);

  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob:",
      // 5.4 — Use explicit origins instead of data: for fonts.
      "font-src 'self' https://fonts.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "script-src 'self' 'unsafe-inline'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "form-action 'self'",
    ].join('; '),
  );

  response.headers.set(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, max-age=0',
  );

  return response;
}

async function downloadAsset(env, url, request) {
  const key = url.searchParams.get('key');
  if (!key) throw httpError(400, 'Missing asset key.');
  const object = await env.CONTENT_BUCKET.get(key);
  if (!object) throw httpError(404, 'Asset not found.');
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', 'private, max-age=300');
  const inline = url.searchParams.get('inline') === '1';
  if (!inline) headers.set('Content-Disposition', `attachment; filename="${key.split('/').pop().replace(/[^a-zA-Z0-9._-]/g, '-') || 'download'}"`);
  return new Response(object.body, { headers });
}

async function deleteConversation(env, conversationId) {
  const attachments = await listAttachments(env, conversationId, 500);
  for (const attachment of attachments) {
    try { await deleteAttachment(env, attachment.id); } catch (error) { console.warn('[delete-conversation-attachment]', error.message); }
  }
  const packageKeys = await env.DB.prepare(`SELECT manifest_r2_key, script_r2_key, shot_list_r2_key FROM packages WHERE conversation_id = ?`).bind(conversationId).all();
  const assets = await env.DB.prepare(`SELECT pa.r2_key FROM package_assets pa JOIN packages p ON p.id = pa.package_id WHERE p.conversation_id = ?`).bind(conversationId).all();
  for (const row of [...(packageKeys.results || []), ...(assets.results || [])]) {
    for (const key of [row.manifest_r2_key, row.script_r2_key, row.shot_list_r2_key, row.r2_key].filter(Boolean)) {
      try { await env.CONTENT_BUCKET.delete(key); } catch { /* best effort */ }
    }
  }
  await env.DB.prepare('DELETE FROM conversations WHERE id = ?').bind(conversationId).run();
}

async function applyMemorySuggestion(env, suggestion) {
  if (!suggestion) return;
  const context = await getCreatorContext(env);
  const field = String(suggestion.target_field || '').trim();
  const text = String(suggestion.suggestion || '').trim();
  if (!text) return;
  const arrayFields = new Set(['content_pillars', 'language_preferences', 'non_negotiables', 'avoid', 'default_platforms']);
  if (arrayFields.has(field)) context[field] = [...new Set([...(context[field] || []), text])];
  else if (field && Object.prototype.hasOwnProperty.call(context, field) && typeof context[field] === 'string') context[field] = [context[field], text].filter(Boolean).join('\n');
  else context.non_negotiables = [...new Set([...(context.non_negotiables || []), text])];
  await saveCreatorContext(env, context);
}

// 4.1 — Invalidate the 30-second bootstrap KV cache when state changes.
async function invalidateBootstrapCache(env) {
  try { await env.APP_KV.delete('cache:bootstrap:v1'); } catch { /* best effort */ }
}


const TEMPLATE_INDEX_KEY = 'conversation-templates:index:v1';

async function listConversationTemplates(env) {
  const ids = await env.APP_KV.get(TEMPLATE_INDEX_KEY, 'json') || [];
  const templates = await Promise.all(ids.slice(0, 50).map(templateId => getConversationTemplate(env, templateId)));
  return templates.filter(Boolean).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
}

async function getConversationTemplate(env, templateId) {
  const cleanId = String(templateId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 160);
  if (!cleanId) return null;
  return env.APP_KV.get(`conversation-template:${cleanId}`, 'json');
}

async function saveConversationTemplate(env, input) {
  const name = String(input?.name || '').trim().slice(0, 120);
  if (!name) throw httpError(400, 'Template name is required.');
  const template = {
    id: id('tpl'),
    name,
    decision_snapshot: input?.decision_snapshot && typeof input.decision_snapshot === 'object' ? input.decision_snapshot : {},
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  const ids = await env.APP_KV.get(TEMPLATE_INDEX_KEY, 'json') || [];
  await Promise.all([
    env.APP_KV.put(`conversation-template:${template.id}`, JSON.stringify(template)),
    env.APP_KV.put(TEMPLATE_INDEX_KEY, JSON.stringify([template.id, ...ids.filter(value => value !== template.id)].slice(0, 50))),
  ]);
  return template;
}

function cleanTemplateTitle(requestedTitle, templateName) {
  const title = String(requestedTitle || '').trim();
  if (title && title !== 'New content idea') return title.slice(0, 120);
  return `New ${String(templateName || 'template')} idea`.slice(0, 120);
}

// 1.9 — Map of optional integrations and whether they are configured.
function integrationStatus(env) {
  return {
    vectorize: Boolean(env.SOURCE_VECTORS),
    tavily: Boolean(env.TAVILY_API_KEY),
    ocr_processor: Boolean(env.OCR_PROCESSOR_URL),
    media_processor: Boolean(env.MEDIA_PROCESSOR_URL),
    sarvam_tts: Boolean(env.SARVAM_API_KEY),
    ai_gateway: Boolean(env.AI_GATEWAY_ID),
    instagram: Boolean(env.INSTAGRAM_ACCESS_TOKEN && env.INSTAGRAM_USER_ID),
  };
}

// 2.8 — Delete records older than the configured retention windows.
async function runRetentionCleanup(env) {
  try {
    const context = await getCreatorContext(env);
    const usageDays = context.retention?.usage_event_days || 180;
    const failedJobDays = context.retention?.failed_job_days || 30;
    await env.DB.prepare(`DELETE FROM usage_events WHERE created_at < datetime('now', '-' || ? || ' days')`).bind(usageDays).run();
    await env.DB.prepare(`DELETE FROM jobs WHERE state = 'failed' AND created_at < datetime('now', '-' || ? || ' days')`).bind(failedJobDays).run();
    console.log(JSON.stringify({ level: 'info', event: 'retention_cleanup', usage_days: usageDays, failed_job_days: failedJobDays }));
  } catch (error) {
    console.error('[retention-cleanup]', error.message);
  }
}

// 2.2 — Build a full Markdown export from a conversation object.
function buildExportMarkdown(c) {
  const lines = [
    `# ${c.title}`,
    '',
    `**Stage:** ${c.stage} | **Created:** ${c.created_at} | **Updated:** ${c.updated_at}`,
    '',
  ];
  const d = c.decision_snapshot || {};
  const decisionEntries = Object.entries(d).filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== 0 && v !== false);
  if (decisionEntries.length) {
    lines.push('## Decision Snapshot', '');
    for (const [k, v] of decisionEntries) lines.push(`- **${k}:** ${typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v}`);
    lines.push('');
  }
  if (c.pins && c.pins.length) {
    lines.push('## Pinned Notes', '');
    for (const pin of c.pins) lines.push(`- ${pin.text}`);
    lines.push('');
  }
  lines.push('## Conversation', '');
  for (const msg of c.messages || []) {
    lines.push(`### ${msg.role === 'user' ? 'You' : 'Assistant'}`, '', msg.content, '');
  }
  const pkg = c.final_package?.package;
  if (pkg) {
    lines.push('## Package', '');
    if (pkg.selected_hook) lines.push(`**Hook:** ${pkg.selected_hook}`, '');
    if (pkg.script?.spoken_script) lines.push('### Script', '', pkg.script.spoken_script, '');
    if (pkg.post_copy) {
      lines.push('### Post Copy', '');
      lines.push(`**Caption:** ${pkg.post_copy.caption}`, '');
      lines.push(`**Hashtags:** ${(pkg.post_copy.hashtags || []).join(' ')}`, '');
      lines.push(`**CTA:** ${pkg.post_copy.cta}`, '');
    }
  }
  return lines.join('\n');
}