import { requireSession, verifySameOrigin } from './auth.js';
import { getModels } from './config.js';
import { createConversation } from './conversations.js';
import { getConversation, getCreatorContext, insertAttachment, insertMessage, listAttachments } from './db.js';
import { runStructured } from './ai.js';
import { runResearch } from './research.js';
import { createUrlAttachment, processUploadedFile, retrieveRelevantSources } from './sources.js';
import { createSocialVideoAttachment, detectSocialVideoUrl } from './social-video.js';
import { cleanText, html, httpError, id, isStateChanging, json, nowIso, readJson, safeError, safeFilename, sha256Hex } from './utils.js';

const PENDING = new Set(['queued', 'processing', 'extracting', 'indexing', 'uploaded']);
const REPORT_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    title: { type: 'string' }, executive_summary: { type: 'string' }, direct_answer: { type: 'string' },
    key_findings: { type: 'array', maxItems: 12, items: { type: 'object', additionalProperties: false, properties: {
      title: { type: 'string' }, analysis: { type: 'string' }, confidence: { type: 'string', enum: ['high', 'medium', 'low'] }, evidence_refs: { type: 'array', items: { type: 'string' } },
    }, required: ['title', 'analysis', 'confidence', 'evidence_refs'] } },
    sections: { type: 'array', maxItems: 10, items: { type: 'object', additionalProperties: false, properties: {
      heading: { type: 'string' }, body: { type: 'string' }, evidence_refs: { type: 'array', items: { type: 'string' } },
    }, required: ['heading', 'body', 'evidence_refs'] } },
    analysis_dimensions: { type: 'array', maxItems: 12, items: { type: 'object', additionalProperties: false, properties: {
      label: { type: 'string' }, finding: { type: 'string' }, why_it_matters: { type: 'string' }, evidence_refs: { type: 'array', items: { type: 'string' } },
    }, required: ['label', 'finding', 'why_it_matters', 'evidence_refs'] } },
    recommendations: { type: 'array', maxItems: 10, items: { type: 'object', additionalProperties: false, properties: {
      action: { type: 'string' }, rationale: { type: 'string' }, priority: { type: 'string', enum: ['high', 'medium', 'low'] },
    }, required: ['action', 'rationale', 'priority'] } },
    limitations: { type: 'array', maxItems: 10, items: { type: 'string' } }, next_questions: { type: 'array', maxItems: 8, items: { type: 'string' } },
  },
  required: ['title', 'executive_summary', 'direct_answer', 'key_findings', 'sections', 'analysis_dimensions', 'recommendations', 'limitations', 'next_questions'],
};

let schemaReady;
async function ensureSchema(env) {
  if (!schemaReady) schemaReady = env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS workspace_runs (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL, prompt TEXT NOT NULL, mode TEXT NOT NULL DEFAULT 'deep_research', status TEXT NOT NULL DEFAULT 'queued', source_ids_json TEXT NOT NULL DEFAULT '[]', options_json TEXT NOT NULL DEFAULT '{}', result_json TEXT, error TEXT, job_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT, FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE)`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS workspace_runs_by_project ON workspace_runs(conversation_id, created_at DESC)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS workspace_runs_by_status ON workspace_runs(status, updated_at DESC)'),
  ]).catch(error => { schemaReady = null; throw error; });
  await schemaReady;
}
function parse(value, fallback = {}) { try { return value ? (typeof value === 'string' ? JSON.parse(value) : value) : fallback; } catch { return fallback; } }
function runRow(row) { return row ? { ...row, options: parse(row.options_json, {}), result: parse(row.result_json, null) } : null; }
function kind(value) { return value === 'insight' ? 'insight' : 'research'; }
function mode(value) { return ['sources_only', 'quick_research', 'deep_research'].includes(value) ? value : 'deep_research'; }
async function getRun(env, runId) { return runRow(await env.DB.prepare('SELECT * FROM workspace_runs WHERE id = ?').bind(runId).first()); }
async function listRuns(env, projectId = null, limit = 100) {
  const statement = projectId ? env.DB.prepare('SELECT * FROM workspace_runs WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?').bind(projectId, limit) : env.DB.prepare('SELECT * FROM workspace_runs ORDER BY created_at DESC LIMIT ?').bind(limit);
  const rows = await statement.all(); return (rows.results || []).map(runRow);
}
async function projects(env) {
  const rows = await env.DB.prepare(`SELECT c.id,c.title,c.stage,c.created_at,c.updated_at,(SELECT COUNT(*) FROM attachments a WHERE a.conversation_id=c.id) source_count,(SELECT COUNT(*) FROM workspace_runs w WHERE w.conversation_id=c.id) run_count,(SELECT kind FROM workspace_runs w2 WHERE w2.conversation_id=c.id ORDER BY created_at DESC LIMIT 1) last_kind,(SELECT status FROM workspace_runs w3 WHERE w3.conversation_id=c.id ORDER BY created_at DESC LIMIT 1) last_run_status FROM conversations c ORDER BY c.updated_at DESC LIMIT 100`).all();
  return (rows.results || []).map(row => ({ ...row, source_count: Number(row.source_count || 0), run_count: Number(row.run_count || 0) }));
}
async function touch(env, projectId) { await env.DB.prepare('UPDATE conversations SET stage = ?, updated_at = ?, version = version + 1 WHERE id = ?').bind('workspace', nowIso(), projectId).run(); }
function profileUrl(value) {
  try {
    const url = new URL(value); const host = url.hostname.replace(/^www\./, '').toLowerCase(); const path = url.pathname.replace(/\/+$/, '');
    if ((host === 'youtube.com' || host === 'm.youtube.com') && /^\/(?:@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)$/.test(path)) return { provider: 'youtube', type: 'channel', url: `https://www.youtube.com${path}` };
    const match = host === 'instagram.com' && path.match(/^\/([^/]+)$/); if (match && !['reel', 'p', 'tv', 'explore', 'accounts'].includes(match[1])) return { provider: 'instagram', type: 'profile', url: `https://www.instagram.com/${match[1]}/` };
  } catch { /* invalid */ } return null;
}
async function referenceAttachment(env, projectId, messageId, url, descriptor) {
  const attachmentId = id('att'); const timestamp = nowIso(); const key = `workspace-links/${projectId}/${attachmentId}.json`;
  await env.CONTENT_BUCKET.put(key, JSON.stringify({ url, descriptor, created_at: timestamp }), { httpMetadata: { contentType: 'application/json' } });
  return insertAttachment(env, { id: attachmentId, conversation_id: projectId, message_id: messageId, key, name: `${descriptor?.provider || new URL(url).hostname}-reference.json`, type: 'application/vnd.research-workspace.reference+json', size: 0, status: 'ready', summary: descriptor ? `Public ${descriptor.provider} ${descriptor.type} reference. Combine it with web research and individual video transcripts for evidence-backed analysis.` : `Public web reference saved for research: ${url}`, extraction_method: 'workspace_reference', checksum: await sha256Hex(new TextEncoder().encode(url)), metadata: { source_url: url, source_type: descriptor ? 'social_profile_url' : 'web_reference_url', source_provider: descriptor?.provider || new URL(url).hostname, reference_type: descriptor?.type || 'web' }, created_at: timestamp, updated_at: timestamp });
}
async function queueSource(env, attachment, projectId) {
  if (attachment.metadata?.source_type === 'social_video_url') { if (env.SUPADATA_API_KEY) await env.AGENT_QUEUE.send({ type: 'process_social_video_url', attachment_id: attachment.id, conversation_id: projectId }); return; }
  if (attachment.metadata?.ocr_pending || attachment.ocr_processing_pending) return env.AGENT_QUEUE.send({ type: 'ocr_attachment', attachment_id: attachment.id, conversation_id: projectId });
  if (attachment.metadata?.processor_pending || attachment.media_processing_pending) return env.AGENT_QUEUE.send({ type: 'analyze_video', attachment_id: attachment.id, conversation_id: projectId });
  if (attachment.index_pending || attachment.chunks_ready) await env.AGENT_QUEUE.send({ type: 'index_attachment', attachment_id: attachment.id, conversation_id: projectId });
}
async function addSources(request, env, projectId) {
  if (!await getConversation(env, projectId, { includeMessages: false })) throw httpError(404, 'Project not found.');
  const contentType = request.headers.get('Content-Type') || ''; let files = [], urls = [], note = '';
  if (contentType.includes('multipart/form-data')) { const form = await request.formData(); files = form.getAll('files').filter(file => file?.size); urls = form.getAll('urls').flatMap(value => String(value).split(/[\n,]+/)); note = cleanText(form.get('note') || ''); }
  else { const body = await readJson(request, {}); urls = (Array.isArray(body.urls) ? body.urls : [body.url]).flatMap(value => String(value || '').split(/[\n,]+/)); note = cleanText(body.note || ''); }
  urls = [...new Set(urls.map(cleanText).filter(Boolean))].slice(0, 20); if (!files.length && !urls.length) throw httpError(400, 'Add a file or URL.');
  const message = await insertMessage(env, projectId, 'user', note || `Added ${files.length + urls.length} source(s).`, { workspace_source_ingest: true, source_urls: urls }); const attachments = [];
  for (const file of files.slice(0, 8)) { const item = await processUploadedFile(env, { conversationId: projectId, messageId: message.id, file }); attachments.push(item); await queueSource(env, item, projectId); }
  for (const url of urls) {
    const social = detectSocialVideoUrl(url); const profile = profileUrl(url); let item;
    if (social) item = await createSocialVideoAttachment(env, { conversationId: projectId, messageId: message.id, url: social.canonical_url });
    else if (profile) item = await referenceAttachment(env, projectId, message.id, profile.url, profile);
    else { try { item = await createUrlAttachment(env, { conversationId: projectId, messageId: message.id, url }); } catch (error) { console.warn('[workspace-url-fallback]', error.message); item = await referenceAttachment(env, projectId, message.id, url, null); } }
    attachments.push(item); await queueSource(env, item, projectId);
  }
  await touch(env, projectId); return attachments;
}
async function createRun(env, projectId, input, ctx) {
  if (!await getConversation(env, projectId, { includeMessages: false })) throw httpError(404, 'Project not found.');
  const prompt = cleanText(input.prompt || input.question || '').slice(0, 30000); if (!prompt) throw httpError(400, 'Describe what to research or analyse.');
  const runId = id('run'), jobId = id('job'), timestamp = nowIso(), runKind = kind(input.kind), runMode = mode(input.mode), title = cleanText(input.title || prompt).slice(0, 140);
  const options = { focus: cleanText(input.focus || '').slice(0, 5000), output_style: cleanText(input.output_style || 'detailed report'), requested_dimensions: Array.isArray(input.requested_dimensions) ? input.requested_dimensions.map(cleanText).filter(Boolean).slice(0, 20) : [] };
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO workspace_runs (id,conversation_id,kind,title,prompt,mode,status,options_json,job_id,created_at,updated_at) VALUES (?,?,?,?,?,?,'queued',?,?,?,?)`).bind(runId, projectId, runKind, title, prompt, runMode, JSON.stringify(options), jobId, timestamp, timestamp),
    env.DB.prepare(`INSERT INTO jobs (id,type,state,progress,conversation_id,payload_json,created_at,updated_at) VALUES (?,'workspace_run','queued','Queued for analysis',?,?,?,?)`).bind(jobId, projectId, JSON.stringify({ run_id: runId }), timestamp, timestamp),
  ]); await touch(env, projectId);
  const payload = { type: 'workspace_run', job_id: jobId, run_id: runId, conversation_id: projectId };
  if (env.AGENT_QUEUE) await env.AGENT_QUEUE.send(payload); else if (ctx?.waitUntil) ctx.waitUntil(runWorkspaceJob(env, payload)); else await runWorkspaceJob(env, payload);
  return { run: await getRun(env, runId), job_id: jobId };
}
async function patchRun(env, runId, patch) {
  const row = await getRun(env, runId); if (!row) throw httpError(404, 'Run not found.');
  await env.DB.prepare('UPDATE workspace_runs SET status=?,result_json=?,error=?,completed_at=?,updated_at=? WHERE id=?').bind(patch.status ?? row.status, patch.result === undefined ? row.result_json : JSON.stringify(patch.result), patch.error === undefined ? row.error : patch.error, patch.completed_at === undefined ? row.completed_at : patch.completed_at, nowIso(), runId).run();
}
async function patchJob(env, jobId, state, progress, error = null, result = null) { if (!jobId) return; const timestamp = nowIso(); await env.DB.prepare('UPDATE jobs SET state=?,progress=?,error=?,result_json=?,started_at=COALESCE(started_at,?),completed_at=?,updated_at=? WHERE id=?').bind(state, progress, error, result ? JSON.stringify(result) : null, timestamp, ['completed', 'failed'].includes(state) ? timestamp : null, timestamp, jobId).run(); }
function researchMode(runMode) { return runMode === 'deep_research' ? 'deep_research' : runMode === 'quick_research' ? 'quick_verification' : 'uploaded_sources_only'; }
function catalog(chunks, attachments, research) {
  const items = chunks.map(source => ({ ref: source.ref, type: 'project_source', title: source.filename, url: null, page_start: source.page_start, page_end: source.page_end, excerpt: source.text })); const used = new Set(chunks.map(source => source.attachment_id));
  attachments.filter(item => !used.has(item.id)).forEach(item => items.push({ ref: `attachment-summary:${item.id}`, type: item.metadata?.source_type || 'attachment', title: item.name, url: item.metadata?.source_url || null, status: item.status, excerpt: cleanText(item.summary || '').slice(0, 6000) }));
  (research.sources || []).forEach(source => items.push({ ref: `research:${source.id}`, type: source.source_type || 'web', title: source.title || source.url, url: source.url, domain: source.domain, published_at: source.published_at, reliability_score: source.reliability_score, excerpt: source.excerpt })); return items.slice(0, 60);
}
function systemPrompt(runKind) { return `You are a senior analyst in a private research workspace. ${runKind === 'insight' ? 'Analyse the supplied creator, channel, profile, video, transcript, or content corpus. Evaluate evidence-backed hooks, topic selection, narrative structure, pacing, tone, positioning, recurring formats, audience promise, calls to action, strengths, weaknesses, and concrete experiments. Do not pretend to have watched frames or measured performance unless the source catalog contains that evidence.' : 'Produce a rigorous answer to the actual research question. Compare competing explanations where relevant and distinguish established evidence from inference.'} Use only the supplied catalog and claim ledger for external factual assertions. Every evidence_refs value must exactly match a catalog ref. Never fabricate metrics, quotes, dates, URLs, or support. State limitations. Return structured JSON only.`; }
export async function runWorkspaceJob(env, job) {
  await ensureSchema(env); const run = await getRun(env, job.run_id); if (!run) throw new Error('Workspace run not found.'); await patchRun(env, run.id, { status: 'running', error: null }); await patchJob(env, job.job_id, 'running', 'Collecting project evidence');
  const [project, memory, attachments] = await Promise.all([getConversation(env, run.conversation_id, { includeMessages: false, includePackages: false }), getCreatorContext(env), listAttachments(env, run.conversation_id, 200)]); if (!project) throw new Error('Project not found.');
  const chunks = await retrieveRelevantSources(env, run.conversation_id, run.prompt, 14); let research = { status: 'not_requested', sources: [], claims: [], note: 'Project sources only.' };
  if (run.mode !== 'sources_only') { await patchJob(env, job.job_id, 'running', run.mode === 'deep_research' ? 'Running deep web research' : 'Verifying on the web'); research = await runResearch(env, { conversationId: run.conversation_id, plan: { topic: run.prompt, core_message: run.prompt, objective: run.kind === 'insight' ? 'content intelligence' : 'research answer', research_mode: researchMode(run.mode), model_mode: env.OPENAI_API_KEY ? 'gpt-5.5' : 'existing' }, creatorMemory: memory, jobId: job.job_id }); }
  const sourceCatalog = catalog(chunks, attachments, research); await patchJob(env, job.job_id, 'running', 'Synthesising the report'); const models = getModels(env);
  const report = await runStructured(env, models.critic, systemPrompt(run.kind), JSON.stringify({ project: { id: project.id, title: project.title }, run: { kind: run.kind, prompt: run.prompt, mode: run.mode, options: run.options }, source_catalog: sourceCatalog, claim_ledger: research.claims || [], pending_sources: attachments.filter(item => PENDING.has(String(item.status).toLowerCase())).map(item => ({ title: item.name, status: item.status })), research_note: research.note || '' }), REPORT_SCHEMA, { max_tokens: 7000, temperature: 0.12, thinking: true, reasoning_effort: 'high' }, { task: run.kind === 'insight' ? 'workspace_content_insight' : 'workspace_research_report', conversation_id: run.conversation_id, job_id: job.job_id });
  const result = { ...report, kind: run.kind, mode: run.mode, prompt: run.prompt, generated_at: nowIso(), research_status: research.status, research_note: research.note || '', pending_source_count: attachments.filter(item => PENDING.has(String(item.status).toLowerCase())).length, source_catalog: sourceCatalog.map(({ excerpt, ...source }) => source) }; const completed = nowIso(); await patchRun(env, run.id, { status: 'completed', result, error: null, completed_at: completed }); await patchJob(env, job.job_id, 'completed', 'Report ready', null, { run_id: run.id }); await touch(env, run.conversation_id); return result;
}
export async function markWorkspaceRunFailed(env, job, error) { try { await ensureSchema(env); const message = cleanText(error?.message || error || 'Run failed').slice(0, 4000); if (job?.run_id) await patchRun(env, job.run_id, { status: 'failed', error: message, completed_at: nowIso() }); if (job?.job_id) await patchJob(env, job.job_id, 'failed', 'Failed', message); } catch (writeError) { console.error('[workspace-failure-write]', safeError(writeError)); } }
function markdown(run) { const result = run.result || {}, lines = [`# ${result.title || run.title}`, '', `**Type:** ${run.kind === 'insight' ? 'Content insight' : 'Research'}  `, `**Mode:** ${run.mode.replace(/_/g, ' ')}  `, `**Generated:** ${result.generated_at || run.completed_at || run.updated_at}`, '', '## Question', '', run.prompt, '', '## Executive summary', '', result.executive_summary || '', '', '## Direct answer', '', result.direct_answer || '']; (result.key_findings || []).forEach(item => lines.push('', `### ${item.title}`, '', item.analysis, '', `Confidence: ${item.confidence}. Evidence: ${(item.evidence_refs || []).join(', ') || 'None cited.'}`)); (result.sections || []).forEach(item => lines.push('', `## ${item.heading}`, '', item.body, '', `Evidence: ${(item.evidence_refs || []).join(', ') || 'None cited.'}`)); if (result.recommendations?.length) lines.push('', '## Recommendations', '', ...result.recommendations.map(item => `- **${item.priority}: ${item.action}** — ${item.rationale}`)); if (result.limitations?.length) lines.push('', '## Limitations', '', ...result.limitations.map(item => `- ${item}`)); if (result.source_catalog?.length) lines.push('', '## Sources', '', ...result.source_catalog.map(source => `- ${source.ref}: ${source.title}${source.url ? ` — ${source.url}` : ''}`)); return lines.join('\n'); }
function printable(run) { const escaped = markdown(run).replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char])).replace(/^# (.+)$/gm, '<h1>$1</h1>').replace(/^## (.+)$/gm, '<h2>$1</h2>').replace(/^### (.+)$/gm, '<h3>$1</h3>').replace(/^\- (.+)$/gm, '<li>$1</li>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').split(/\n{2,}/).map(block => /^(<h\d|<li)/.test(block) ? block : `<p>${block.replace(/\n/g, '<br>')}</p>`).join(''); return `<!doctype html><meta charset="utf-8"><title>${safeFilename(run.title)}</title><style>@page{margin:18mm}body{font-family:system-ui;color:#292722;max-width:820px;margin:auto;padding:36px;line-height:1.65}h1{font:40px Georgia,serif}h2{margin-top:34px;border-top:1px solid #ddd;padding-top:18px}button{float:right;padding:9px 14px}@media print{button{display:none}body{padding:0}}</style><button onclick="print()">Print / save as PDF</button>${escaped}`; }
export async function handleWorkspaceRequest(request, env, ctx) {
  const url = new URL(request.url); if (!url.pathname.startsWith('/api/workspace/')) return null; await requireSession(request, env); if (isStateChanging(request.method)) verifySameOrigin(request); await ensureSchema(env); const method = request.method.toUpperCase(), path = url.pathname;
  if (path === '/api/workspace/bootstrap' && method === 'GET') return json({ ok: true, projects: await projects(env), runs: await listRuns(env, null, 40), integrations: { web_research: Boolean(env.OPENAI_API_KEY || env.TAVILY_API_KEY), openai: Boolean(env.OPENAI_API_KEY), tavily: Boolean(env.TAVILY_API_KEY), social_transcripts: Boolean(env.SUPADATA_API_KEY), vector_search: Boolean(env.SOURCE_VECTORS), media_processor: Boolean(env.MEDIA_PROCESSOR_URL), ocr: Boolean(env.OCR_PROCESSOR_URL) } });
  if (path === '/api/workspace/projects' && method === 'POST') { const body = await readJson(request, {}), project = await createConversation(env, cleanText(body.title || (body.kind === 'insight' ? 'New content analysis' : 'New research project')).slice(0, 140)); await touch(env, project.id); return json({ ok: true, project: await getConversation(env, project.id) }, 201); }
  let match = path.match(/^\/api\/workspace\/projects\/([^/]+)$/); if (match && method === 'GET') { const projectId = decodeURIComponent(match[1]), [project, runs, attachments] = await Promise.all([getConversation(env, projectId), listRuns(env, projectId), listAttachments(env, projectId, 200)]); if (!project) throw httpError(404, 'Project not found.'); return json({ ok: true, project, runs, attachments }); }
  match = path.match(/^\/api\/workspace\/projects\/([^/]+)\/sources$/); if (match && method === 'POST') return json({ ok: true, attachments: await addSources(request, env, decodeURIComponent(match[1])) }, 201);
  match = path.match(/^\/api\/workspace\/projects\/([^/]+)\/runs$/); if (match && method === 'GET') return json({ ok: true, runs: await listRuns(env, decodeURIComponent(match[1])) }); if (match && method === 'POST') return json({ ok: true, ...await createRun(env, decodeURIComponent(match[1]), await readJson(request, {}), ctx) }, 202);
  match = path.match(/^\/api\/workspace\/runs\/([^/]+)$/); if (match && method === 'GET') { const run = await getRun(env, decodeURIComponent(match[1])); if (!run) throw httpError(404, 'Run not found.'); return json({ ok: true, run }); } if (match && method === 'DELETE') { await env.DB.prepare('DELETE FROM workspace_runs WHERE id=?').bind(decodeURIComponent(match[1])).run(); return json({ ok: true }); }
  match = path.match(/^\/api\/workspace\/runs\/([^/]+)\/export$/); if (match && method === 'GET') { const run = await getRun(env, decodeURIComponent(match[1])); if (!run) throw httpError(404, 'Run not found.'); if (run.status !== 'completed') throw httpError(409, 'The report is not ready.'); if (url.searchParams.get('format') === 'md') return new Response(markdown(run), { headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="${safeFilename(run.title) || 'report'}.md"` } }); const response = html(printable(run)); response.headers.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'none'"); return response; }
  throw httpError(404, 'Workspace route not found.');
}
