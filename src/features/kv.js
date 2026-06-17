import { Buffer } from 'node:buffer';
import { base64UrlEncode, cleanText, httpError, nowIso, safeFilename, sha256Bytes } from '../utils.js';

const COLLECTIONS = ['research', 'instagram', 'saved'];
const indexKey = type => `creatoriq:index:${type}`;
const recordKey = (type, id) => `creatoriq:${type}:${id}`;
const settingsKey = 'creatoriq:settings:v1';
const secretKey = name => `creatoriq:secret:${name}`;
const defaults = { model: 'cloudflare', default_research_mode: 'deep', response_length: 'balanced', theme: 'dark', sidebar_collapsed: false };

async function index(env, type) { return (await env.APP_KV.get(indexKey(type), 'json')) || []; }
async function writeIndex(env, type, ids) { await env.APP_KV.put(indexKey(type), JSON.stringify(ids.slice(0, 300))); }
export async function getRecord(env, type, id) { return env.APP_KV.get(recordKey(type, id), 'json'); }
export async function putRecord(env, type, input) {
  if (!COLLECTIONS.includes(type)) throw httpError(400, 'Unknown CreatorIQ collection.');
  const item = { ...input, id: String(input.id || crypto.randomUUID()), type: input.type || type, created_at: input.created_at || nowIso(), updated_at: nowIso(), pinned: Boolean(input.pinned) };
  await env.APP_KV.put(recordKey(type, item.id), JSON.stringify(item));
  const ids = await index(env, type); await writeIndex(env, type, [item.id, ...ids.filter(id => id !== item.id)]); return item;
}
export async function listCollection(env, type, { type: filter = '', query = '', limit = 100 } = {}) {
  const records = (await Promise.all((await index(env, type)).slice(0, Math.min(300, limit)).map(id => getRecord(env, type, id)))).filter(Boolean);
  const q = cleanText(query).toLowerCase(); return records.filter(item => (!filter || item.type === filter || item.source_type === filter) && (!q || JSON.stringify([item.title, item.query, item.content, item.report]).toLowerCase().includes(q)));
}
export async function removeRecord(env, type, id) { await env.APP_KV.delete(recordKey(type, id)); await writeIndex(env, type, (await index(env, type)).filter(value => value !== id)); }
export async function togglePin(env, type, id) { const item = await getRecord(env, type, id); if (!item) throw httpError(404, 'Item not found.'); item.pinned = !item.pinned; return putRecord(env, type, item); }
export async function saveLibraryItem(env, input) {
  const sourceType = ['research', 'instagram'].includes(input.source_collection) ? input.source_collection : '';
  const source = sourceType && input.source_id ? await getRecord(env, sourceType, String(input.source_id)) : null;
  const content = cleanText(input.content || source?.content || source?.report || ''); if (!content) throw httpError(400, 'There is no content to save.');
  return putRecord(env, 'saved', { type: input.type || source?.mode || sourceType || 'research', source_type: sourceType || 'manual', source_id: input.source_id || null, title: cleanText(input.title || source?.title || source?.query || 'Saved insight').slice(0, 180), content, metadata: input.metadata || source?.metrics || {}, pinned: Boolean(input.pinned) });
}

async function cryptoKey(env, pin = '') { if (!env.APP_SESSION_SECRET) throw httpError(503, 'APP_SESSION_SECRET is required to encrypt credentials.'); return crypto.subtle.importKey('raw', await sha256Bytes(`${env.APP_SESSION_SECRET}:${pin}`), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']); }
async function storeSecret(env, name, value, pin = '') { const iv = crypto.getRandomValues(new Uint8Array(12)); const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await cryptoKey(env, pin), new TextEncoder().encode(value)); await env.APP_KV.put(secretKey(name), JSON.stringify({ iv: base64UrlEncode(iv), data: base64UrlEncode(new Uint8Array(data)), pin: Boolean(pin) })); }
export async function readStoredSecret(env, name, pin = '') {
  const record = await env.APP_KV.get(secretKey(name), 'json'); if (!record) return ''; if (record.pin && !pin) throw httpError(401, 'A PIN is required to unlock the stored credential.');
  try { const iv = Buffer.from(record.iv.replace(/-/g, '+').replace(/_/g, '/'), 'base64'); const data = Buffer.from(record.data.replace(/-/g, '+').replace(/_/g, '/'), 'base64'); return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await cryptoKey(env, pin), data)); } catch { throw httpError(401, 'The credential PIN is incorrect.'); }
}
export async function getSettings(env) {
  const saved = (await env.APP_KV.get(settingsKey, 'json')) || {}; const openai = Boolean(env.OPENAI_API_KEY || await env.APP_KV.get(secretKey('openai'))); const instagram = Boolean(env.INSTAGRAM_ACCESS_TOKEN || await env.APP_KV.get(secretKey('instagram')));
  return { ...defaults, ...saved, has_openai_key: openai, has_instagram_token: instagram, openai_key_mask: env.OPENAI_API_KEY ? 'Worker secret configured' : openai ? '••••••••••••' : '', instagram_token_mask: env.INSTAGRAM_ACCESS_TOKEN ? 'Worker secret configured' : instagram ? '••••••••••••' : '' };
}
export async function updateSettings(env, input = {}) {
  const current = await getSettings(env); const next = { model: ['cloudflare', 'gpt55'].includes(input.model) ? input.model : current.model, default_research_mode: ['quick','deep','competitor','trend','scripts','hooks','calendar'].includes(input.default_research_mode) ? input.default_research_mode : current.default_research_mode, response_length: ['concise','balanced','detailed'].includes(input.response_length) ? input.response_length : current.response_length, theme: ['dark','light'].includes(input.theme) ? input.theme : current.theme, sidebar_collapsed: input.sidebar_collapsed == null ? current.sidebar_collapsed : Boolean(input.sidebar_collapsed) };
  await env.APP_KV.put(settingsKey, JSON.stringify(next)); if (input.openai_key) await storeSecret(env, 'openai', String(input.openai_key)); if (input.instagram_token) await storeSecret(env, 'instagram', String(input.instagram_token), String(input.instagram_pin || '')); if (input.clear_openai_key) await env.APP_KV.delete(secretKey('openai')); if (input.clear_instagram_token) await env.APP_KV.delete(secretKey('instagram')); return getSettings(env);
}
export async function getBootstrap(env) {
  const [settings, research, instagram, saved] = await Promise.all([getSettings(env), listCollection(env,'research',{limit:30}), listCollection(env,'instagram',{limit:20}), listCollection(env,'saved',{limit:100})]);
  const all = [...research, ...instagram]; const pinned = [...all, ...saved].filter(item => item.pinned).sort((a,b) => String(b.updated_at).localeCompare(String(a.updated_at))).slice(0,8);
  return { ok:true, app:'CreatorIQ', settings, recent:all.sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at))).slice(0,12), pinned, stats:{ research_sessions:research.length, instagram_reports:instagram.length, saved_items:saved.length, pinned_items:pinned.length }, models:{ cloudflare:env.REASONING_MODEL || '@cf/meta/llama-4-scout-17b-16e-instruct', fast:env.FAST_MODEL || '@cf/meta/llama-3.1-8b-instruct', gpt55:env.OPENAI_MODEL || 'gpt-5.5' } };
}
export async function clearAllData(env) { for (const type of COLLECTIONS) { const ids = await index(env,type); await Promise.all(ids.map(id => env.APP_KV.delete(recordKey(type,id)))); await env.APP_KV.delete(indexKey(type)); } await Promise.all([env.APP_KV.delete(settingsKey), env.APP_KV.delete(secretKey('openai')), env.APP_KV.delete(secretKey('instagram'))]); }

const u16 = n => Uint8Array.of(n&255,n>>>8&255), u32 = n => Uint8Array.of(n&255,n>>>8&255,n>>>16&255,n>>>24&255);
function join(parts){ const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0)); let at=0; for(const p of parts){out.set(p,at);at+=p.length;} return out; }
function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^(0xedb88320&-(c&1));}return(c^0xffffffff)>>>0;}
function zip(files){const e=new TextEncoder(),locals=[],centrals=[];let offset=0;for(const file of files){const name=e.encode(file.name),data=e.encode(file.content),crc=crc32(data);const local=join([u32(0x04034b50),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data]);locals.push(local);centrals.push(join([u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]));offset+=local.length;}const central=join(centrals);return join([...locals,central,u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(central.length),u32(offset),u16(0)]);}
export async function exportAllZip(env){let records=[];for(const type of COLLECTIONS)records.push(...await listCollection(env,type,{limit:300}));const files=records.map((item,i)=>({name:`${String(i+1).padStart(3,'0')}-${safeFilename(item.title||item.query||item.id)}.md`,content:`# ${item.title||item.query||'CreatorIQ item'}\n\n${item.content||item.report||''}\n`}));if(!files.length)files.push({name:'README.md',content:'# CreatorIQ export\n\nNo saved data.'});return new Response(zip(files),{headers:{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="creatoriq-export.zip"','Cache-Control':'no-store'}});}
