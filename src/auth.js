import { COOKIE_NAME } from './config.js';
import { base64UrlDecode, base64UrlEncode, constantTimeStringEqual, hmacSign, httpError, intEnv, json, parseCookies, readJson } from './utils.js';

export async function login(request, env) {
  verifySameOrigin(request);
  if (!env.APP_PASSWORD || !env.APP_SESSION_SECRET) throw httpError(503, 'Authentication secrets are not configured.');
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateKey = `auth-rate:${ip}`;
  const rate = await env.APP_KV.get(rateKey, 'json');
  const now = Date.now();
  if (rate && rate.reset_at > now && rate.count >= 7) throw httpError(429, 'Too many login attempts. Try again later.');
  const body = await readJson(request);
  const ok = await constantTimeStringEqual(String(body.password || ''), env.APP_PASSWORD);
  if (!ok) {
    const next = rate && rate.reset_at > now ? { count: rate.count + 1, reset_at: rate.reset_at } : { count: 1, reset_at: now + 15 * 60 * 1000 };
    await env.APP_KV.put(rateKey, JSON.stringify(next), { expirationTtl: 15 * 60 });
    throw httpError(401, 'Incorrect password.');
  }
  await env.APP_KV.delete(rateKey);
  const ttlSeconds = Math.max(3600, intEnv(env, 'SESSION_TTL_HOURS', 168) * 3600);
  const token = await createSessionToken(env, ttlSeconds);
  return json({ ok: true, authenticated: true }, 200, { 'Set-Cookie': sessionCookie(token, ttlSeconds, new URL(request.url).protocol === 'https:') });
}

async function createSessionToken(env, ttlSeconds) {
  const nonce = crypto.randomUUID();
  const payload = { v: 1, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + ttlSeconds, nonce };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = await hmacSign(encoded, env.APP_SESSION_SECRET);
  // Store nonce in KV so we can invalidate sessions server-side on logout.
  await env.APP_KV.put(`session:nonce:${nonce}`, '1', { expirationTtl: ttlSeconds });
  return `${encoded}.${signature}`;
}

export async function readSession(request, env) {
  if (!env.APP_SESSION_SECRET) return null;
  const token = parseCookies(request.headers.get('Cookie') || '')[COOKIE_NAME];
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const expected = await hmacSign(parts[0], env.APP_SESSION_SECRET);
  if (!(await constantTimeStringEqual(parts[1], expected))) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(parts[0]));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    // Verify the nonce is still live in KV (allows server-side invalidation on logout).
    if (payload.nonce) {
      const valid = await env.APP_KV.get(`session:nonce:${payload.nonce}`);
      if (!valid) return null;
    }
    return { authenticated: true, expires_at: new Date(payload.exp * 1000).toISOString(), nonce: payload.nonce };
  } catch { return null; }
}

export async function requireSession(request, env) {
  const session = await readSession(request, env);
  if (!session) throw httpError(401, 'Authentication required.');
  return session;
}

export function verifySameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return;
  const expected = new URL(request.url).origin;
  if (origin !== expected) throw httpError(403, 'Cross-origin request rejected.');
}

export function sessionCookie(token, ttlSeconds, secure = true) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${ttlSeconds}${secure ? '; Secure' : ''}`;
}

export function clearSessionCookie(secure = true) {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`;
}
