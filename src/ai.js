import { getModels } from './config.js';
import { insertUsageEvent } from './db.js';
import { charTokenEstimate, cleanText, safeError, withRetry } from './utils.js';

function gatewayOptions(env, metadata = {}) {
  if (!env.AI_GATEWAY_ID) return undefined;
  return { gateway: { id: env.AI_GATEWAY_ID, metadata } };
}

function tokenOptionsForModel(model, tokenLimit) {
  return String(model || '').toLowerCase().includes('gpt-oss') ? { max_tokens: tokenLimit } : { max_completion_tokens: tokenLimit };
}

function modelTuning(model, thinking = false) {
  const name = String(model || '').toLowerCase();
  if (name.includes('kimi-k2.6')) return { chat_template_kwargs: { thinking: Boolean(thinking) } };
  if (name.includes('glm-4.7-flash')) return { reasoning_effort: 'low', chat_template_kwargs: { enable_thinking: false, clear_thinking: true } };
  return {};
}

async function invoke(env, model, input, context = {}) {
  const started = Date.now();
  let retryCount = 0;
  try {
    const response = await withRetry(async attempt => {
      retryCount = attempt - 1;
      return env.AI.run(model, input, gatewayOptions(env, { task: context.task || 'ai', conversation_id: context.conversation_id || '', package_id: context.package_id || '', job_id: context.job_id || '' }));
    }, 2, `${context.task || 'ai'}:${model}`);
    await insertUsageEvent(env, {
      task: context.task || 'ai', model, conversation_id: context.conversation_id, package_id: context.package_id, job_id: context.job_id,
      input_tokens_estimate: charTokenEstimate(JSON.stringify(input)), output_tokens_estimate: charTokenEstimate(JSON.stringify(response)),
      latency_ms: Date.now() - started, status: 'completed', retry_count: retryCount,
      metadata: { gateway: Boolean(env.AI_GATEWAY_ID) },
    });
    return response;
  } catch (error) {
    await insertUsageEvent(env, {
      task: context.task || 'ai', model, conversation_id: context.conversation_id, package_id: context.package_id, job_id: context.job_id,
      input_tokens_estimate: charTokenEstimate(JSON.stringify(input)), latency_ms: Date.now() - started, status: 'failed', retry_count: retryCount,
      metadata: { error: error.message },
    });
    throw error;
  }
}

export async function runModel(env, model, input, context = {}) {
  return invoke(env, model, input, context);
}

export async function runStructured(env, model, system, user, schema, options = {}, context = {}) {
  const schemaInstruction = `${system}\n\nReturn only data matching this JSON Schema. Do not use markdown fences.\n${JSON.stringify(schema)}`;
  const tokenLimit = options.max_tokens || 4000;
  const baseInput = {
    messages: [{ role: 'system', content: schemaInstruction }, { role: 'user', content: user }],
    temperature: options.temperature ?? 0.2,
    ...tokenOptionsForModel(model, tokenLimit), parallel_tool_calls: false, ...modelTuning(model, options.thinking),
  };
  const attempts = [
    { ...baseInput, response_format: { type: 'json_schema', json_schema: { name: 'structured_result', strict: true, schema } } },
    { ...baseInput, response_format: { type: 'json_object' } },
    baseInput,
  ];
  const failures = [];
  for (let index = 0; index < attempts.length; index += 1) {
    try {
      const response = await invoke(env, model, attempts[index], { ...context, task: `${context.task || 'structured'}:${index + 1}` });
      return extractStructuredPayload(response, schema);
    } catch (error) { failures.push(error.message); }
  }
  throw new Error(`Structured generation failed: ${failures.join(' | ')}`);
}

export async function runText(env, model, messages, options = {}, context = {}) {
  const tokenLimit = options.max_tokens || 1200;
  const response = await invoke(env, model, {
    messages, temperature: options.temperature ?? 0.2, ...tokenOptionsForModel(model, tokenLimit), ...modelTuning(model, options.thinking),
  }, { ...context, task: context.task || 'text' });
  return extractTextPayload(response);
}

export async function embedTexts(env, texts, context = {}) {
  const models = getModels(env);
  const values = Array.isArray(texts) ? texts : [texts];
  if (!values.length) return [];
  const started = Date.now();
  try {
    const response = await invoke(env, models.embedding, { text: values }, { ...context, task: context.task || 'embeddings' });
    const data = response?.data || response?.result?.data || response?.embeddings || response;
    if (Array.isArray(data) && Array.isArray(data[0])) return data;
    if (Array.isArray(data) && Array.isArray(data[0]?.embedding)) return data.map(item => item.embedding);
    if (Array.isArray(response?.result) && Array.isArray(response.result[0])) return response.result;
    throw new Error('Embedding model returned an unsupported response shape.');
  } catch (error) {
    console.error('[embeddings]', safeError(error), { elapsed: Date.now() - started });
    throw error;
  }
}

export async function rerank(env, query, passages, context = {}) {
  if (!passages.length) return [];
  const models = getModels(env);
  try {
    const response = await invoke(env, models.reranker, { query, contexts: passages.map(text => ({ text })), top_k: passages.length }, { ...context, task: 'rerank' });
    const scores = response?.response || response?.result || response?.data || response;
    if (!Array.isArray(scores)) return passages.map((text, index) => ({ index, text, score: 0 }));
    return scores.map((item, index) => ({ index: Number(item.id ?? item.index ?? index), text: passages[Number(item.id ?? item.index ?? index)], score: Number(item.score ?? item) || 0 })).sort((a, b) => b.score - a.score);
  } catch {
    return passages.map((text, index) => ({ index, text, score: passages.length - index }));
  }
}

function extractStructuredPayload(response, schema) {
  const required = Array.isArray(schema?.required) ? schema.required : [];
  const queue = [response];
  const seen = new Set();
  while (queue.length) {
    const value = queue.shift();
    if (value == null) continue;
    if (typeof value === 'string') {
      const parsed = parseJsonText(value);
      if (parsed !== undefined) queue.unshift(parsed);
      continue;
    }
    if (typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    if (!Array.isArray(value) && required.every(key => Object.prototype.hasOwnProperty.call(value, key))) return value;
    if (Array.isArray(value)) { queue.push(...value); continue; }
    const preferred = [value.response, value.result?.response, value.result, value.output, value.parsed, value.data, value.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments, value.choices?.[0]?.message?.content, value.choices?.[0]?.text, value.message?.content, value.content, value.text];
    for (const candidate of preferred) if (candidate !== undefined && candidate !== value) queue.push(candidate);
    if (Array.isArray(value.content)) for (const part of value.content) queue.push(part?.text ?? part?.content ?? part);
  }
  throw new Error('Could not locate structured JSON in the model response.');
}

function extractTextPayload(response) {
  if (typeof response === 'string') return cleanText(response);
  const candidates = [response?.response, response?.result?.response, response?.choices?.[0]?.message?.content, response?.choices?.[0]?.text, response?.message?.content, response?.text, response?.data];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return cleanText(candidate);
    if (Array.isArray(candidate)) {
      const text = candidate.map(part => part?.text || part?.content || '').join('\n');
      if (text.trim()) return cleanText(text);
    }
  }
  throw new Error('Model returned no readable text.');
}

function parseJsonText(raw) {
  const text = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const candidates = [text];
  const objectStart = text.indexOf('{');
  const objectEnd = text.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) candidates.push(text.slice(objectStart, objectEnd + 1));
  for (const candidate of candidates) {
    try { return JSON.parse(candidate); } catch { /* try next candidate */ }
  }
  return undefined;
}
