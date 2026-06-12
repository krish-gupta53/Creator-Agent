import { Buffer } from 'node:buffer';

export const nowIso = () => new Date().toISOString();
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export function cleanText(value) {
  return String(value ?? '').replace(/\u0000/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();
}

export function normalizeText(value) {
  return cleanText(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizeStringArray(value, maxItems = 20, maxLength = 500) {
  const values = Array.isArray(value) ? value : String(value ?? '').split(/\r?\n|,/);
  return [...new Set(values.map(cleanText).filter(Boolean).map(item => item.slice(0, maxLength)))].slice(0, maxItems);
}

export function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function intEnv(env, key, fallback) {
  return clampInt(env?.[key], Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, fallback);
}

export function numberEnv(env, key, fallback) {
  const parsed = Number(env?.[key]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseJson(value, fallback = null) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

export function stringify(value) {
  return JSON.stringify(value ?? null);
}

export function sanitizeId(value) {
  return String(value ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 160);
}

export function safeFilename(value) {
  const safe = String(value || 'file').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  return (safe || 'file').slice(0, 160);
}

export function extensionFromMime(type) {
  const map = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
    'application/pdf': 'pdf', 'text/plain': 'txt', 'text/markdown': 'md', 'text/html': 'html',
    'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/mp4': 'm4a', 'audio/webm': 'webm',
    'video/mp4': 'mp4', 'video/webm': 'webm', 'text/csv': 'csv',
  };
  return map[String(type || '').toLowerCase()] || 'bin';
}

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders },
  });
}

export function html(value, status = 200) {
  return new Response(value, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export function httpError(status, message, code = null) {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
}

export function safeError(error) {
  return { name: error?.name, message: error?.message, stack: error?.stack, status: error?.status, code: error?.code };
}

export async function readJson(request, fallback = undefined) {
  try { return await request.json(); } catch (error) {
    if (fallback !== undefined) return fallback;
    throw httpError(400, 'Invalid JSON request body.');
  }
}

export function isStateChanging(method) {
  return !['GET', 'HEAD', 'OPTIONS'].includes(String(method || '').toUpperCase());
}

export function parseCookies(header) {
  const output = {};
  for (const pair of String(header || '').split(';')) {
    const index = pair.indexOf('=');
    if (index < 0) continue;
    output[pair.slice(0, index).trim()] = decodeURIComponent(pair.slice(index + 1).trim());
  }
  return output;
}

export function base64UrlEncode(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return Buffer.from(bytes).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export function base64UrlDecode(value) {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - normalized.length % 4) % 4);
  return Buffer.from(normalized + padding, 'base64').toString('utf8');
}

export async function sha256Bytes(value) {
  const bytes = value instanceof Uint8Array ? value : new TextEncoder().encode(String(value));
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}

export async function sha256Hex(value) {
  const bytes = await sha256Bytes(value);
  return [...bytes].map(v => v.toString(16).padStart(2, '0')).join('');
}

export async function hmacSign(value, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64UrlEncode(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))));
}

export async function constantTimeStringEqual(a, b) {
  const left = await sha256Bytes(String(a));
  const right = await sha256Bytes(String(b));
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) diff |= (left[i % left.length] ?? 0) ^ (right[i % right.length] ?? 0);
  return diff === 0;
}

export async function withRetry(fn, max = 2, label = 'operation') {
  let last;
  for (let attempt = 1; attempt <= max; attempt += 1) {
    try { return await fn(attempt); } catch (error) {
      last = error;
      if (attempt >= max) break;
      console.warn(`[retry] ${label} attempt ${attempt} failed`, safeError(error));
      await sleep(Math.min(2500, 300 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 200));
    }
  }
  throw last;
}

export function round4(value) {
  return Number.isFinite(Number(value)) ? Math.round(Number(value) * 10000) / 10000 : null;
}

export function id(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
}

export function getPath(object, path) {
  return String(path).split('.').reduce((value, part) => value?.[part], object);
}

export function setPath(object, path, value) {
  const parts = String(path).split('.');
  let cursor = object;
  for (let index = 0; index < parts.length - 1; index += 1) {
    cursor[parts[index]] ??= {};
    cursor = cursor[parts[index]];
  }
  cursor[parts.at(-1)] = structuredClone(value);
  return object;
}

export function requestId(request) {
  return request.headers.get('CF-Ray') || crypto.randomUUID();
}

export function wordEstimate(text) {
  return cleanText(text).split(/\s+/).filter(Boolean).length;
}

export function charTokenEstimate(text) {
  return Math.ceil(cleanText(text).length / 4);
}
