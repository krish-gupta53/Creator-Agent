import { httpError } from '../utils.js';
import { readStoredSecret } from '../features/kv.js';

function normalize(body) {
  const output = new TransformStream(); const writer = output.writable.getWriter(); const reader = body.getReader();
  const decoder = new TextDecoder(); const encoder = new TextEncoder();
  (async () => { let buffer = ''; try {
    while (true) { const { value, done } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const events = buffer.split(/\n\n/); buffer = events.pop() || '';
      for (const event of events) { const line = event.split(/\r?\n/).find(item => item.startsWith('data:')); if (!line) continue; const raw = line.slice(5).trim(); if (raw === '[DONE]') continue;
        try { const payload = JSON.parse(raw); if (payload.type === 'response.output_text.delta' && payload.delta) await writer.write(encoder.encode(payload.delta)); if (payload.type === 'error') throw new Error(payload.error?.message || 'OpenAI stream failed.'); } catch (error) { if (!(error instanceof SyntaxError)) throw error; }
      }
    } await writer.close();
  } catch (error) { await writer.abort(error); } })();
  return output.readable;
}

export async function streamOpenAI(env, { messages, maxTokens = 6000 }) {
  const apiKey = env.OPENAI_API_KEY || await readStoredSecret(env, 'openai');
  if (!apiKey) throw httpError(503, 'GPT-5.5 Thinking is not configured. Add OPENAI_API_KEY or save a key in Settings.');
  const instructions = messages.filter(item => item.role === 'system').map(item => item.content).join('\n\n');
  const input = messages.filter(item => item.role !== 'system').map(item => ({ role: item.role === 'assistant' ? 'assistant' : 'user', content: [{ type: item.role === 'assistant' ? 'output_text' : 'input_text', text: item.content }] }));
  const model = env.OPENAI_MODEL || 'gpt-5.5';
  const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, instructions, input, reasoning: { effort: 'high', summary: 'auto' }, text: { verbosity: 'high' }, max_output_tokens: maxTokens, stream: true, store: false }) });
  if (!response.ok || !response.body) { const detail = await response.text().catch(() => ''); throw httpError(response.status || 502, `OpenAI request failed${detail ? `: ${detail.slice(0, 300)}` : '.'}`); }
  return { stream: normalize(response.body), model, provider: 'openai' };
}
