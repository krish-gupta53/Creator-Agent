import app from './index.js';
import { processQueueBatch } from './jobs.js';
import { WORKSPACE_UI } from './workspace-ui-v2.js';
import { handleWorkspaceRequest, markWorkspaceRunFailed, runWorkspaceJob } from './workspace.js';
import { modelEnvironmentForRun, saveRunModel, workspaceModelOptions } from './workspace-models.js';
import { json, safeError } from './utils.js';

function injectWorkspace(htmlText) {
  if (htmlText.includes('id="researchWorkspaceRoot"')) return htmlText;
  return htmlText.replace('</body>', `${WORKSPACE_UI}\n</body>`);
}

async function routeWorkspace(request, env, ctx) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/workspace/')) return null;

  const deleteProject = request.method === 'DELETE' && url.pathname.match(/^\/api\/workspace\/projects\/([^/]+)$/);
  if (deleteProject) {
    const projectId = decodeURIComponent(deleteProject[1]);
    const target = new URL(request.url);
    target.pathname = `/api/conversations/${encodeURIComponent(projectId)}`;
    return app.fetch(new Request(target.toString(), request), env, ctx);
  }

  let requestedModel = '';
  const isRunCreate = request.method === 'POST' && /^\/api\/workspace\/projects\/[^/]+\/runs$/.test(url.pathname);
  if (isRunCreate) {
    try { requestedModel = String((await request.clone().json()).model || ''); } catch { requestedModel = ''; }
  }

  const response = await handleWorkspaceRequest(request, env, ctx);
  if (!response?.ok) return response;

  if (request.method === 'GET' && url.pathname === '/api/workspace/bootstrap') {
    const data = await response.json();
    const models = workspaceModelOptions(env);
    data.models = models;
    data.default_model = models[0]?.id || '';
    data.integrations = {
      ...(data.integrations || {}),
      workers_ai: Boolean(env.AI),
      openai_thinking: Boolean(env.OPENAI_API_KEY),
    };
    return json(data, response.status, { 'X-Content-Type-Options': 'nosniff' });
  }

  if (isRunCreate) {
    const data = await response.json();
    if (data.run?.id) {
      const selected = await saveRunModel(env, data.run.id, requestedModel);
      data.run.options = {
        ...(data.run.options || {}),
        model: selected.id,
        runtime_model: selected.model,
        model_label: selected.label,
        model_provider: selected.provider,
      };
    }
    return json(data, response.status, { 'X-Content-Type-Options': 'nosniff' });
  }

  return response;
}

async function handleFetch(request, env, ctx) {
  try {
    const workspaceResponse = await routeWorkspace(request, env, ctx);
    if (workspaceResponse) return workspaceResponse;
    const response = await app.fetch(request, env, ctx);
    const contentType = response.headers.get('Content-Type') || '';
    if (request.method !== 'GET' || !contentType.includes('text/html')) return response;
    const headers = new Headers(response.headers);
    headers.delete('Content-Length');
    return new Response(injectWorkspace(await response.text()), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    const status = error?.status || 500;
    console.error(JSON.stringify({ level: 'error', event: 'workspace_entry_failed', path: new URL(request.url).pathname, error: safeError(error) }));
    return json({ ok: false, error: error?.message || 'Could not process this request.' }, status, { 'X-Content-Type-Options': 'nosniff' });
  }
}

async function handleQueue(batch, env) {
  const legacyMessages = [];
  for (const message of batch.messages) {
    const job = message.body || {};
    if (job.type !== 'workspace_run') {
      legacyMessages.push(message);
      continue;
    }
    try {
      const routed = await modelEnvironmentForRun(env, job.run_id);
      await runWorkspaceJob(routed.env, job);
      message.ack();
    } catch (error) {
      console.error(JSON.stringify({ level: 'error', event: 'workspace_run_failed', job_id: job.job_id || null, run_id: job.run_id || null, error: safeError(error) }));
      await markWorkspaceRunFailed(env, job, error);
      message.ack();
    }
  }
  if (legacyMessages.length) await processQueueBatch({ ...batch, messages: legacyMessages }, env);
}

export default {
  fetch: handleFetch,
  scheduled(event, env, ctx) { return app.scheduled(event, env, ctx); },
  queue: handleQueue,
};
