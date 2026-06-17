import { routeRequest } from './router.js';
import { json, safeError } from './utils.js';

function securityHeaders(response, requestId) {
  const headers = new Headers(response.headers);
  headers.set('X-Request-Id', requestId);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env, ctx) {
    const requestId = request.headers.get('CF-Ray') || crypto.randomUUID();
    const startedAt = Date.now();
    try {
      const response = await routeRequest(request, env, ctx);
      console.log(JSON.stringify({ level: 'info', event: 'request', request_id: requestId, method: request.method, path: new URL(request.url).pathname, status: response.status, duration_ms: Date.now() - startedAt }));
      return securityHeaders(response, requestId);
    } catch (error) {
      const status = Number(error?.status) || 500;
      console.error(JSON.stringify({ level: 'error', event: 'request_failed', request_id: requestId, method: request.method, path: new URL(request.url).pathname, status, duration_ms: Date.now() - startedAt, error: safeError(error) }));
      return securityHeaders(json({ ok: false, error: status >= 500 ? 'CreatorIQ could not complete this request.' : error.message, code: error?.code || null, request_id: requestId }, status), requestId);
    }
  },
};
