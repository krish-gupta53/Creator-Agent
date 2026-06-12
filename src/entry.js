import app from './index.js';
import { requireSession, verifySameOrigin } from './auth.js';
import { insertMessage } from './db.js';
import { createSocialVideoAttachment, detectSocialVideoUrl } from './social-video.js';
import { json, readJson, safeError } from './utils.js';

const UI_REPLACEMENTS = [
  ['id="addUrlBtn">Add URL</button>', 'id="addUrlBtn">Add URL / Video</button>'],
  ["prompt('Paste a public HTTPS URL')", "prompt('Paste an article, YouTube video, or Instagram Reel URL')"],
  ["toast('URL added and queued for indexing')", "toast('Source added and queued for processing')"],
  ['Files and URLs are chunked, embedded, and retrieved only inside this chat.', 'Files, articles, YouTube videos, and Instagram Reels are processed, indexed, and retrieved only inside this chat.'],
  ['PDF pages, documents, images, and audio become text or descriptions.', 'PDFs, documents, images, audio, and supported social-video links become searchable source text and analysis.'],
  ["['media_processor','Video processor','Uploaded video analysis']", "['media_processor','Video processor','Uploaded video analysis'],['supadata','Supadata','YouTube and Instagram transcript sources']"]
];

function enhanceUi(htmlText) {
  return UI_REPLACEMENTS.reduce((value, [search, replacement]) => value.replace(search, replacement), htmlText);
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
