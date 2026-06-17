import { httpError } from '../utils.js';

const textFrom = payload => payload?.response || payload?.delta || payload?.result?.response || payload?.choices?.[0]?.delta?.content || '';
function normalize(body) {
  const output = new TransformStream(); const writer = output.writable.getWriter(); const reader = body.getReader();
  const decoder = new TextDecoder(); const encoder = new TextEncoder();
  (async () => { let buffer = ''; try {
    while (true) { const { value, done } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const lines = buffer.split(/\r?\n/); buffer = lines.pop() || '';
      for (const line of lines) { const raw = line.trim().replace(/^data:\s*/, ''); if (!raw || raw === '[DONE]' || raw.startsWith('event:')) continue; try { const delta = textFrom(JSON.parse(raw)); if (delta) await writer.write(encoder.encode(delta)); } catch { await writer.write(encoder.encode(raw)); } }
    } await writer.close();
  } catch (error) { await writer.abort(error); } })();
  return output.readable;
}

export async function streamCloudflare(env, { messages, fast = false, maxTokens = 4096 }) {
  if (!env.AI) throw httpError(503, 'Cloudflare Workers AI is not configured.');
  const model = fast ? (env.FAST_MODEL || '@cf/meta/llama-3.1-8b-instruct') : (env.REASONING_MODEL || '@cf/meta/llama-4-scout-17b-16e-instruct');
  const result = await env.AI.run(model, { messages, max_tokens: maxTokens, temperature: fast ? .35 : .45, stream: true });
  if (result instanceof ReadableStream) return { stream: normalize(result), model, provider: 'cloudflare' };
  if (result instanceof Response && result.body) return { stream: normalize(result.body), model, provider: 'cloudflare' };
  const text = textFrom(result) || (typeof result === 'string' ? result : JSON.stringify(result));
  return { stream: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(text)); controller.close(); } }), model, provider: 'cloudflare' };
}
