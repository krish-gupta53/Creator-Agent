import app from './index.js';
import { requireSession, verifySameOrigin } from './auth.js';
import { getConversation, insertMessage, updateConversation } from './db.js';
import { createSocialVideoAttachment, detectSocialVideoUrl } from './social-video.js';
import { json, readJson, safeError } from './utils.js';

const ENHANCED_CREATOR_UI = String.raw`
<style>
  .staged-source-list{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px;width:100%}
  .staged-source-chip{display:inline-flex;align-items:center;gap:7px;max-width:100%;padding:6px 9px;border:1px solid rgba(200,241,53,.24);border-radius:999px;background:rgba(200,241,53,.08);color:var(--accent);font-size:11px;line-height:1.3}
  .staged-source-chip span{max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .staged-source-remove{border:0;background:transparent;color:inherit;padding:0 2px;font-size:15px;line-height:1;box-shadow:none}
  .generation-controls{display:grid;grid-template-columns:minmax(145px,1.35fr) repeat(3,minmax(105px,1fr));gap:8px;margin:0 0 10px;padding:9px;border:1px solid var(--line);border-radius:10px;background:rgba(12,13,16,.38)}
  .generation-control{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0;padding:7px 9px;border:1px solid var(--line);border-radius:8px;background:var(--surface3);font-size:11px;color:var(--ink2)}
  .generation-control strong{font-size:11px;font-weight:600;white-space:nowrap}
  .generation-control select{min-width:0;width:100%;border:0;background:transparent;color:var(--ink);outline:0;font-size:11px;cursor:pointer}
  .generation-control input{accent-color:var(--accent);width:15px;height:15px;flex:0 0 auto}
  .control-help{grid-column:1/-1;color:var(--muted);font-size:10px;line-height:1.4;padding:0 2px}
  .model-mode-indicator{display:inline-flex;align-items:center;gap:5px;margin-left:6px;padding:2px 7px;border-radius:999px;border:1px solid rgba(79,142,247,.25);background:var(--blue-bg);color:var(--blue);font-size:10px;font-weight:700}
  @media(min-width:1101px){
    .app{grid-template-columns:178px minmax(0,1fr)}
    .rail{padding:14px 9px}.rail-brand{padding:4px 6px 18px}.nav button{padding:8px 9px;font-size:12px}
    .main{padding:14px 16px 24px}.topbar{margin-bottom:10px}.page-title{font-size:22px}.eyebrow{margin-bottom:1px}
    .create-grid{grid-template-columns:188px minmax(560px,1fr) 220px;gap:10px;min-height:calc(100vh - 78px)}
    .create-grid>.card:first-child,.decision-panel{padding:13px}
    .chat-card{height:calc(100vh - 78px);min-height:720px}
    .conversation-list{height:calc(100vh - 145px);margin-top:8px}
    .decision-panel{height:calc(100vh - 78px)}
    .chat-head{padding:11px 15px}.messages{padding:22px 24px;gap:16px}.message{max-width:88%;font-size:14.5px}
    .composer{padding:11px 13px}.composer-box{padding:10px 11px}.composer textarea{min-height:76px}
    .decision-row{padding:7px 0}.decision-row strong{font-size:12px}
  }
  @media(min-width:1500px){.create-grid{grid-template-columns:205px minmax(680px,1fr) 238px}.app{grid-template-columns:188px minmax(0,1fr)}}
  @media(max-width:1180px) and (min-width:781px){.generation-controls{grid-template-columns:repeat(2,minmax(130px,1fr))}}
  @media(max-width:780px){.generation-controls{grid-template-columns:1fr 1fr}.control-help{grid-column:1/-1}}
  @media(max-width:520px){.generation-controls{grid-template-columns:1fr}}
</style>
<script>
(() => {
  const stagedUrls = [];
  const conversationControls = new Map();
  const nativeFetch = window.fetch.bind(window);
  const DEFAULT_CONTROLS = { model_mode: 'existing', deep_research_enabled: false, image_generation_enabled: false, captions_enabled: true };

  function normalizeUrl(value) {
    try {
      const url = new URL(String(value || '').trim());
      if (url.protocol !== 'https:') return null;
      return url.toString();
    } catch {
      return null;
    }
  }

  function sourceLabel(value) {
    try {
      const url = new URL(value);
      const host = url.hostname.replace(/^www\./, '');
      if (host === 'youtu.be' || host.endsWith('youtube.com')) return 'YouTube video';
      if (host.endsWith('instagram.com')) return 'Instagram video';
      return host;
    } catch {
      return 'URL source';
    }
  }

  function activeConversationId() {
    const link = document.querySelector('.chat-head a[href*="/api/conversations/"][href$="/export"]');
    const match = link?.getAttribute('href')?.match(/\/api\/conversations\/([^/]+)\/export/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function normalizeControls(value = {}) {
    return {
      model_mode: value.model_mode === 'gpt-5.5' ? 'gpt-5.5' : 'existing',
      deep_research_enabled: Boolean(value.deep_research_enabled),
      image_generation_enabled: Boolean(value.image_generation_enabled),
      captions_enabled: value.captions_enabled !== false,
    };
  }

  function storageKey(id) { return 'creator-generation-controls:' + (id || 'default'); }

  function getControls(id = activeConversationId()) {
    if (conversationControls.has(id)) return conversationControls.get(id);
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey(id)) || 'null');
      if (saved) return normalizeControls(saved);
    } catch { /* ignore invalid local preference */ }
    return { ...DEFAULT_CONTROLS };
  }

  function saveControls(id, value) {
    const normalized = normalizeControls(value);
    conversationControls.set(id, normalized);
    try { localStorage.setItem(storageKey(id), JSON.stringify(normalized)); } catch { /* storage may be disabled */ }
    updateModeIndicator(normalized.model_mode);
    return normalized;
  }

  function captureConversation(payload) {
    const conversation = payload?.conversation;
    if (!conversation?.id) return;
    const decision = conversation.decision_snapshot || {};
    const hasStoredControls = ['model_mode', 'deep_research_enabled', 'image_generation_enabled', 'captions_enabled'].some(key => Object.prototype.hasOwnProperty.call(decision, key));
    if (hasStoredControls) saveControls(conversation.id, decision);
  }

  function clearStagedUrls() {
    if (!stagedUrls.length) return;
    stagedUrls.splice(0, stagedUrls.length);
    renderStagedUrls();
  }

  function renderStagedUrls() {
    document.querySelectorAll('.staged-source-list').forEach(node => node.remove());
    if (!stagedUrls.length) return;
    const button = document.getElementById('addUrlBtn');
    if (!button) return;
    const list = document.createElement('div');
    list.className = 'staged-source-list';
    stagedUrls.forEach((url, index) => {
      const chip = document.createElement('div');
      chip.className = 'staged-source-chip';
      chip.title = url;
      const label = document.createElement('span');
      label.textContent = sourceLabel(url) + ': ' + url;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'staged-source-remove';
      remove.setAttribute('aria-label', 'Remove URL source');
      remove.textContent = '×';
      remove.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        stagedUrls.splice(index, 1);
        renderStagedUrls();
      });
      chip.append(label, remove);
      list.appendChild(chip);
    });
    const host = button.parentElement || button;
    host.appendChild(list);
  }

  function updateModeIndicator(mode) {
    const title = document.querySelector('.chat-head strong');
    if (!title) return;
    let indicator = document.querySelector('.model-mode-indicator');
    if (!indicator) {
      indicator = document.createElement('span');
      indicator.className = 'model-mode-indicator';
      title.insertAdjacentElement('afterend', indicator);
    }
    indicator.textContent = mode === 'gpt-5.5' ? 'GPT-5.5 Thinking' : 'Existing pipeline';
  }

  function renderGenerationControls() {
    const composer = document.querySelector('#messageForm .composer-box');
    if (!composer || composer.querySelector('.generation-controls')) return;
    const id = activeConversationId();
    if (!id) return;
    const controls = getControls(id);
    const panel = document.createElement('div');
    panel.className = 'generation-controls';
    panel.innerHTML = `
      <label class="generation-control"><strong>Model</strong><select data-generation-control="model_mode"><option value="existing">Existing pipeline</option><option value="gpt-5.5">GPT-5.5 Thinking</option></select></label>
      <label class="generation-control"><strong>Deep research</strong><input type="checkbox" data-generation-control="deep_research_enabled"></label>
      <label class="generation-control"><strong>AI images</strong><input type="checkbox" data-generation-control="image_generation_enabled"></label>
      <label class="generation-control"><strong>On-screen captions</strong><input type="checkbox" data-generation-control="captions_enabled"></label>
      <div class="control-help">These settings are authoritative. The agent will not ask you to choose research, images, or captions in chat. GPT-5.5 automatically falls back to the existing pipeline when a capability or API call is unavailable.</div>`;
    const textarea = composer.querySelector('textarea');
    composer.insertBefore(panel, textarea);
    const model = panel.querySelector('[data-generation-control="model_mode"]');
    model.value = controls.model_mode;
    panel.querySelector('[data-generation-control="deep_research_enabled"]').checked = controls.deep_research_enabled;
    panel.querySelector('[data-generation-control="image_generation_enabled"]').checked = controls.image_generation_enabled;
    panel.querySelector('[data-generation-control="captions_enabled"]').checked = controls.captions_enabled;
    panel.addEventListener('change', () => {
      saveControls(id, {
        model_mode: model.value,
        deep_research_enabled: panel.querySelector('[data-generation-control="deep_research_enabled"]').checked,
        image_generation_enabled: panel.querySelector('[data-generation-control="image_generation_enabled"]').checked,
        captions_enabled: panel.querySelector('[data-generation-control="captions_enabled"]').checked,
      });
    });
    updateModeIndicator(controls.model_mode);
  }

  function appendControls(body, controls) {
    Object.entries(controls).forEach(([key, value]) => body.set(key, String(value)));
  }

  document.addEventListener('click', event => {
    const conversation = event.target.closest('[data-chat]');
    if (conversation && stagedUrls.length) clearStagedUrls();

    const button = event.target.closest('#addUrlBtn');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const value = window.prompt('Paste an article, YouTube video, or Instagram Reel URL');
    if (!value) return;
    const normalized = normalizeUrl(value);
    if (!normalized) {
      window.alert('Enter a valid public HTTPS URL.');
      return;
    }
    if (!stagedUrls.includes(normalized)) stagedUrls.push(normalized);
    renderStagedUrls();

    const textareas = [...document.querySelectorAll('textarea')].filter(node => node.offsetParent !== null && !node.disabled);
    textareas.at(-1)?.focus();
  }, true);

  window.fetch = async function enhancedCreatorFetch(input, init = {}) {
    const requestUrl = typeof input === 'string' ? input : input?.url || '';
    const method = String(init.method || (typeof input !== 'string' && input?.method) || 'GET').toUpperCase();
    const messageMatch = requestUrl.match(/\/api\/conversations\/([^/]+)\/messages(?:\?|$)/);
    const generateMatch = requestUrl.match(/\/api\/conversations\/([^/]+)\/generate(?:\?|$)/);
    const body = init.body;

    if (method === 'POST' && messageMatch && body instanceof FormData) {
      const id = decodeURIComponent(messageMatch[1]);
      if (stagedUrls.length) stagedUrls.forEach(url => body.append('source_urls', url));
      appendControls(body, getControls(id));
    } else if (method === 'POST' && generateMatch) {
      const id = decodeURIComponent(generateMatch[1]);
      let payload = {};
      try { payload = typeof body === 'string' ? JSON.parse(body) : {}; } catch { /* use empty payload */ }
      init.body = JSON.stringify({ ...payload, ...getControls(id) });
    }

    const response = await nativeFetch(input, init);
    if (method === 'POST' && messageMatch && response.ok && stagedUrls.length) clearStagedUrls();
    if (response.ok && /\/api\/conversations\/[^/]+(?:\/messages)?(?:\?|$)/.test(requestUrl)) {
      response.clone().json().then(captureConversation).catch(() => {});
    }
    return response;
  };

  new MutationObserver(() => {
    if (stagedUrls.length && !document.querySelector('.staged-source-list')) renderStagedUrls();
    renderGenerationControls();
  }).observe(document.documentElement, { childList: true, subtree: true });
  renderGenerationControls();
})();
</script>`;

const UI_REPLACEMENTS = [
  ['id="addUrlBtn">Add URL</button>', 'id="addUrlBtn">Add URL / Video</button>'],
  ['Files and URLs are chunked, embedded, and retrieved only inside this chat.', 'Files, articles, YouTube videos, and Instagram Reels are processed, indexed, and retrieved only inside this chat.'],
  ['PDF pages, documents, images, and audio become text or descriptions.', 'PDFs, documents, images, audio, and supported social-video links become searchable source text and analysis.'],
  ["['media_processor','Video processor','Uploaded video analysis']", "['media_processor','Video processor','Uploaded video analysis'],['supadata','Supadata','YouTube and Instagram transcript sources'],['openai','OpenAI','GPT-5.5 direct generation and web search']"]
];

function enhanceUi(htmlText) {
  const enhanced = UI_REPLACEMENTS.reduce((value, [search, replacement]) => value.replace(search, replacement), htmlText);
  return enhanced.replace('</body>', `${ENHANCED_CREATOR_UI}\n</body>`);
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

async function requestControls(request) {
  const contentType = request.headers.get('Content-Type') || '';
  if (contentType.includes('multipart/form-data')) {
    const form = await request.clone().formData();
    return {
      model_mode: form.get('model_mode'),
      deep_research_enabled: form.get('deep_research_enabled'),
      image_generation_enabled: form.get('image_generation_enabled'),
      captions_enabled: form.get('captions_enabled'),
    };
  }
  const body = await readJson(request.clone(), {});
  return body || {};
}

async function persistGenerationControls(request, env, url) {
  if (request.method !== 'POST') return;
  const messageMatch = url.pathname.match(/^\/api\/conversations\/([^/]+)\/messages$/);
  const generateMatch = url.pathname.match(/^\/api\/conversations\/([^/]+)\/generate$/);
  const match = messageMatch || generateMatch;
  if (!match) return;

  await requireSession(request, env);
  verifySameOrigin(request);
  const input = await requestControls(request);
  if (!['existing', 'gpt-5.5'].includes(String(input.model_mode || ''))) return;

  const conversationId = decodeURIComponent(match[1]);
  const conversation = await getConversation(env, conversationId, { includeMessages: false, includeAttachments: false, includePackages: false });
  if (!conversation) return;
  const previous = conversation.decision_snapshot || {};
  const modelMode = input.model_mode === 'gpt-5.5' ? 'gpt-5.5' : 'existing';
  const deepResearch = parseBoolean(input.deep_research_enabled, Boolean(previous.deep_research_enabled));
  const images = parseBoolean(input.image_generation_enabled, Boolean(previous.image_generation_enabled));
  const captions = parseBoolean(input.captions_enabled, previous.captions_enabled !== false);
  const decision = {
    ...previous,
    model_mode: modelMode,
    deep_research_enabled: deepResearch,
    image_generation_enabled: images,
    captions_enabled: captions,
    research_mode: deepResearch ? 'deep_research' : 'uploaded_sources_only',
    image_count: images ? Math.max(1, Number(previous.image_count) || 3) : 0,
    visual_strategy: images
      ? `Talking head with selective AI-generated visuals${captions ? ' and simple on-screen captions' : ''}.`
      : `Talking head with optional B-roll${captions ? ' and simple on-screen captions' : ''}; no AI-generated images.`,
  };
  await updateConversation(env, conversationId, { decision_snapshot: decision });
}

async function handleSocialVideoUrl(request, env, url) {
  if (request.method !== 'POST') return null;
  const match = url.pathname.match(/^\/api\/conversations\/([^/]+)\/urls$/);
  if (!match) return null;

  await requireSession(request, env);
  verifySameOrigin(request);

  const body = await readJson(request.clone());
  const detected = detectSocialVideoUrl(body.url);
  if (!detected) return null;

  const conversationId = decodeURIComponent(match[1]);
  const message = await insertMessage(
    env,
    conversationId,
    'user',
    `Reference ${detected.provider} video: ${detected.canonical_url}`,
    { source_url: detected.canonical_url, source_provider: detected.provider, source_type: 'social_video_url' }
  );

  const attachment = await createSocialVideoAttachment(env, { conversationId, messageId: message.id, url: detected.canonical_url });
  if (env.SUPADATA_API_KEY) {
    await env.AGENT_QUEUE.send({ type: 'process_social_video_url', attachment_id: attachment.id, conversation_id: conversationId });
  }
  return json({ ok: true, attachment }, 201, { 'X-Content-Type-Options': 'nosniff' });
}

async function handleFetch(request, env, ctx) {
  try {
    const url = new URL(request.url);
    const socialResponse = await handleSocialVideoUrl(request, env, url);
    if (socialResponse) return socialResponse;
    await persistGenerationControls(request, env, url);

    const response = await app.fetch(request, env, ctx);

    if (request.method === 'GET' && url.pathname === '/api/health/integrations' && response.ok) {
      const data = await response.json();
      data.integrations = { ...(data.integrations || {}), supadata: Boolean(env.SUPADATA_API_KEY), openai: Boolean(env.OPENAI_API_KEY) };
      return json(data, response.status, { 'X-Content-Type-Options': 'nosniff' });
    }

    const contentType = response.headers.get('Content-Type') || '';
    if (request.method !== 'GET' || !contentType.includes('text/html')) return response;

    const headers = new Headers(response.headers);
    headers.delete('Content-Length');
    return new Response(enhanceUi(await response.text()), { status: response.status, statusText: response.statusText, headers });
  } catch (error) {
    const status = error?.status || 500;
    console.error(JSON.stringify({ level: 'error', event: 'enhanced_entry_failed', path: new URL(request.url).pathname, error: safeError(error) }));
    return json({ ok: false, error: error?.message || 'Could not process this request.', code: error?.code || null }, status, { 'X-Content-Type-Options': 'nosniff' });
  }
}

export default {
  fetch: handleFetch,
  scheduled(event, env, ctx) { return app.scheduled(event, env, ctx); },
  queue(batch, env) { return app.queue(batch, env); }
};
