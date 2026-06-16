import app from './index.js';
import { processQueueBatch } from './jobs.js';
import { WORKSPACE_UI } from './workspace-ui-v2.js';
import { handleWorkspaceRequest, markWorkspaceRunFailed, runWorkspaceJob } from './workspace.js';
import { json, safeError } from './utils.js';

function injectWorkspace(htmlText) {
  if (htmlText.includes('id="researchWorkspaceRoot"')) return htmlText;
  return htmlText.replace('</body>', `${WORKSPACE_UI}\n</body>`);
}

async function handleFetch(request, env, ctx) {
  try {
    const workspaceResponse = await handleWorkspaceRequest(request, env, ctx);
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
      await runWorkspaceJob(env, job);
      message.ack();
    } catch (error) {
      console.error(JSON.stringify({ level: 'error', event: 'workspace_run_failed', job_id: job.job_id || null, run_id: job.run_id || null, error: safeError(error) }));
      await markWorkspaceRunFailed(env, job, error);
      message.retry({ delaySeconds: 120 });
    }
  }
  if (legacyMessages.length) await processQueueBatch({ ...batch, messages: legacyMessages }, env);
}

export default {
  fetch: handleFetch,
  scheduled(event, env, ctx) { return app.scheduled(event, env, ctx); },
  queue: handleQueue,
};
