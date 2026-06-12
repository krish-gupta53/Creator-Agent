import app from './index.js';
import { requireSession, verifySameOrigin } from './auth.js';
import { insertMessage } from './db.js';
import { createSocialVideoAttachment, detectSocialVideoUrl } from './social-video.js';
import { json, readJson, safeError } from './utils.js';

const STAGED_SOURCE_UI = String.raw`
<style>
  .staged-source-list{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px;width:100%}
  .staged-source-chip{display:inline-flex;align-items:center;gap:7px;max-width:100%;padding:6px 9px;border:1px solid rgba(200,241,53,.24);border-radius:999px;background:rgba(200,241,53,.08);color:var(--accent);font-size:11px;line-height:1.3}
  .staged-source-chip span{max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .staged-source-remove{border:0;background:transparent;color:inherit;padding:0 2px;font-size:15px;line-height:1;box-shadow:none}
</style>
<script>
(() => {
  const stagedUrls = [];
  const nativeFetch = window.fetch.bind(window);

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

  window.fetch = async function stagedSourceFetch(input, init = {}) {
    const requestUrl = typeof input === 'string' ? input : input?.url || '';
    const method = String(init.method || (typeof input !== 'string' && input?.method) || 'GET').toUpperCase();
    const isMessageRequest = method === 'POST' && /\/api\/conversations\/[^/]+\/messages(?:\?|$)/.test(requestUrl);
    const body = init.body;

    if (isMessageRequest && body instanceof FormData && stagedUrls.length) {
      stagedUrls.forEach(url => body.append('source_urls', url));
    }

    const response = await nativeFetch(input, init);
    if (isMessageRequest && response.ok && stagedUrls.length) clearStagedUrls();
    return response;
  };

  new MutationObserver(() => {
    if (stagedUrls.length && !document.querySelector('.staged-source-list')) renderStagedUrls();
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
</script>`;

const UI_REPLACEMENTS = [
  ['id="addUrlBtn">Add URL</button>', 'id="addUrlBtn">Add URL / Video</button>'],
  ['Files and URLs are chunked, embedded, and retrieved only inside this chat.', 'Files, articles, YouTube videos, and Instagram Reels are processed, indexed, and retrieved only inside this chat.'],
  ['PDF pages, documents, images, and audio become text or descriptions.', 'PDFs, documents, images, audio, and supported social-video links become searchable source text and analysis.'],
  ["['media_processor','Video processor','Uploaded video analysis']", "['media_processor','Video processor','Uploaded video analysis'],['supadata','Supadata','YouTube and Instagram transcript sources']"]
];

function enhanceUi(htmlText) {
  const enhanced = UI_REPLACEMENTS.reduce((value, [search, replacement]) => value.replace(search, replacement), htmlText);
  return enhanced.replace('</body>', `${STAGED_SOURCE_UI}\n</body>`);
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
    {
      source_url: detected.canonical_url,
      source_provider: detected.provider,
      source_type: 'social_video_url'
    }
  );

  const attachment = await createSocialVideoAttachment(env, {
    conversationId,
    messageId: message.id,
    url: detected.canonical_url
  });

  if (env.SUPADATA_API_KEY) {
    await env.AGENT_QUEUE.send({
      type: 'process_social_video_url',
      attachment_id: attachment.id,
      conversation_id: conversationId
    });
  }

  return json(
    { ok: true, attachment },
    201,
    { 'X-Content-Type-Options': 'nosniff' }
  );
}

async function handleFetch(request, env, ctx) {
  try {
    const url = new URL(request.url);
    const socialResponse = await handleSocialVideoUrl(request, env, url);
    if (socialResponse) return socialResponse;

    const response = await app.fetch(request, env, ctx);

    if (request.method === 'GET' && url.pathname === '/api/health/integrations' && response.ok) {
      const data = await response.json();
      data.integrations = {
        ...(data.integrations || {}),
        supadata: Boolean(env.SUPADATA_API_KEY)
      };
      return json(data, response.status, { 'X-Content-Type-Options': 'nosniff' });
    }

    const contentType = response.headers.get('Content-Type') || '';
    if (request.method !== 'GET' || !contentType.includes('text/html')) return response;

    const headers = new Headers(response.headers);
    headers.delete('Content-Length');
    return new Response(enhanceUi(await response.text()), {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  } catch (error) {
    const status = error?.status || 500;
    console.error(JSON.stringify({
      level: 'error',
      event: 'social_video_route_failed',
      path: new URL(request.url).pathname,
      error: safeError(error)
    }));
    return json({
      ok: false,
      error: error?.message || 'Could not add this social-video source.',
      code: error?.code || null
    }, status, { 'X-Content-Type-Options': 'nosniff' });
  }
}

export default {
  fetch: handleFetch,
  scheduled(event, env, ctx) {
    return app.scheduled(event, env, ctx);
  },
  queue(batch, env) {
    return app.queue(batch, env);
  }
};
