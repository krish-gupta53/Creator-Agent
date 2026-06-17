const APP_VERSION = '6.0.0';
import { clearSessionCookie, login, readSession, requireSession, verifySameOrigin } from './auth.js';
import { handleResearch, handleResearchChat } from './features/research.js';
import { handleInstagramAnalysis, handleInstagramSync } from './features/instagram.js';
import { clearAllData, exportAllZip, getBootstrap, getSettings, listCollection, removeRecord, saveLibraryItem, updateSettings, togglePin } from './features/kv.js';
import { httpError, isStateChanging, json, readJson } from './utils.js';

export async function routeRequest(request, env) {
  const url = new URL(request.url); const path = url.pathname; const method = request.method.toUpperCase();
  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: { Allow: 'GET,POST,PUT,DELETE,OPTIONS' } });
  if (path === '/health') return json({ ok: true, app: 'CreatorIQ', version: APP_VERSION });

  // Preserve the existing password and signed-cookie authentication contract.
  if (path === '/api/auth/login' && method === 'POST') return login(request, env);
  if (path === '/api/auth/status' && method === 'GET') return json({ ok: true, authenticated: Boolean(await readSession(request, env)), version: APP_VERSION });
  if (path === '/api/auth/logout' && method === 'POST') {
    verifySameOrigin(request); const session = await readSession(request, env);
    if (session?.nonce) await env.APP_KV.delete(`session:nonce:${session.nonce}`);
    return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie(url.protocol === 'https:') });
  }
  if (!path.startsWith('/api/')) return env.ASSETS.fetch(request);

  await requireSession(request, env);
  if (isStateChanging(method)) verifySameOrigin(request);
  if (path === '/api/bootstrap' && method === 'GET') return json(await getBootstrap(env));
  if (path === '/api/research' && method === 'POST') return handleResearch(request, env);
  if (path === '/api/chat' && method === 'POST') return handleResearchChat(request, env);
  if (path === '/api/instagram/analyze' && method === 'POST') return handleInstagramAnalysis(request, env);
  if (path === '/api/instagram/sync' && method === 'POST') return handleInstagramSync(request, env);
  if (path === '/api/settings' && method === 'GET') return json({ ok: true, settings: await getSettings(env) });
  if (path === '/api/settings' && method === 'PUT') return json({ ok: true, settings: await updateSettings(env, await readJson(request)) });
  if (path === '/api/saved' && method === 'GET') return json({ ok: true, items: await listCollection(env, 'saved', { type: url.searchParams.get('type') || '', query: url.searchParams.get('q') || '', limit: 250 }) });
  if (path === '/api/saved' && method === 'POST') return json({ ok: true, item: await saveLibraryItem(env, await readJson(request)) }, 201);

  let match = path.match(/^\/api\/(research|instagram|saved)\/([^/]+)$/);
  if (match && method === 'DELETE') { await removeRecord(env, match[1], decodeURIComponent(match[2])); return json({ ok: true }); }
  match = path.match(/^\/api\/(research|instagram|saved)\/([^/]+)\/pin$/);
  if (match && method === 'POST') return json({ ok: true, item: await togglePin(env, match[1], decodeURIComponent(match[2])) });
  if (path === '/api/export/all' && method === 'GET') return exportAllZip(env);
  if (path === '/api/data/clear' && method === 'DELETE') {
    const body = await readJson(request, {}); if (body.confirmation !== 'DELETE') throw httpError(400, 'Type DELETE to confirm clearing CreatorIQ data.');
    await clearAllData(env); return json({ ok: true });
  }
  throw httpError(404, 'API route not found.');
}
