import { getModels } from './config.js';
import { insertUsageEvent } from './db.js';
import { charTokenEstimate, cleanText, safeError, withRetry } from './utils.js';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const GPT55_MODE = 'gpt-5.5';

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

async function conversationControls(env, context = {}) {
  const supplied = context.generation_controls;
  if (supplied && typeof supplied === 'object') return normalizeControls(supplied);
  if (!context.conversation_id || !env.DB) return normalizeControls({});
  try {
    const row = await env.DB.prepare('SELECT decision_json FROM conversations WHERE id = ?').bind(context.conversation_id).first();
    return normalizeControls(parseJson(row?.decision_json, {}));
  } catch (error) {
    console.warn('[generation-controls]', error.message);
    return normalizeControls({});
  }
}

function normalizeControls(input = {}) {
  return {
    model_mode: input.model_mode === GPT55_MODE ? GPT55_MODE : 'existing',
    deep_research_enabled: Boolean(input.deep_research_enabled),
    image_generation_enabled: Boolean(input.image_generation_enabled),
    captions_enabled: input.captions_enabled !== false,
  };
}

function controlsInstruction(controls, task) {
  const visualRule = controls.image_generation_enabled
    ? 'AI-generated images are enabled. Use them only when they materially improve the content.'
    : 'AI-generated images are disabled. Set image_count to 0 and use talking head, uploaded assets, or B-roll instead.';
  const captionRule = controls.captions_enabled
    ? 'Simple on-screen captions are enabled when useful.'
    : 'On-screen captions are disabled; do not ask whether to enable them.';
  const researchRule = controls.deep_research_enabled
    ? 'Deep web research is enabled and should be treated as the selected research mode.'
    : 'Deep web research is disabled; rely on uploaded sources and existing knowledge unless a source is explicitly supplied.';
  const planningRule = task.startsWith('conversation_planning')
    ? 'These controls are locked by the interface. Never ask the creator to choose research depth, AI images, or captions. Preserve them in the decision snapshot and continue with the next genuinely content-specific decision.'
    : 'Treat these controls as locked production constraints.';
  return `\n\nInterface-controlled production settings:\n- Model mode: ${controls.model_mode}\n- ${researchRule}\n- ${visualRule}\n- ${captionRule}\n- ${planningRule}`;
}

function applyLockedControls(result, controls) {
  if (!result || typeof result !== 'object') return result;
  const decision = result.decision_snapshot && typeof result.decision_snapshot === 'object' ? result.decision_snapshot : {};
  decision.model_mode = controls.model_mode;
  decision.deep_research_enabled = controls.deep_research_enabled;
  decision.image_generation_enabled = controls.image_generation_enabled;
  decision.captions_enabled = controls.captions_enabled;
  decision.research_mode = controls.deep_research_enabled ? 'deep_research' : 'uploaded_sources_only';
  if (!controls.image_generation_enabled) decision.image_count = 0;
  else if (!Number.isFinite(Number(decision.image_count)) || Number(decision.image_count) < 1) decision.image_count = 3;
  if (!cleanText(decision.visual_strategy)) {
    decision.visual_strategy = controls.image_generation_enabled
      ? `Talking head with selective AI-generated visuals${controls.captions_enabled ? ' and simple on-screen captions' : ''}.`
      : `Talking head with optional B-roll${controls.captions_enabled ? ' and simple on-screen captions' : ''}; no AI-generated images.`;
  }
  result.decision_snapshot = decision;
  if (Array.isArray(result.missing_decisions)) result.missing_decisions = result.missing_decisions.filter(item => !/(research|visual|image|caption)/i.test(String(item)));
  return result;
}

function finalizeStructuredResult(result, controls, task) {
  return task.startsWith('conversation_planning') ? applyLockedControls(result, controls) : result;
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
      metadata: { gateway: Boolean(env.AI_GATEWAY_ID), provider: 'cloudflare' },
    });
    return response;
  } catch (error) {
    await insertUsageEvent(env, {
      task: context.task || 'ai', model, conversation_id: context.conversation_id, package_id: context.package_id, job_id: context.job_id,
      input_tokens_estimate: charTokenEstimate(JSON.stringify(input)), latency_ms: Date.now() - started, status: 'failed', retry_count: retryCount,
      metadata: { error: error.message, provider: 'cloudflare' },
    });
    throw error;
  }
}

async function invokeOpenAI(env, payload, context = {}) {
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured.');
  const model = env.OPENAI_MODEL || GPT55_MODE;
  const started = Date.now();
  let retryCount = 0;
  try {
    const response = await withRetry(async attempt => {
      retryCount = attempt - 1;
      const request = await fetch(OPENAI_RESPONSES_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, store: false, ...payload }),
      });
      const data = await request.json().catch(() => ({}));
      if (!request.ok) throw new Error(`OpenAI Responses API failed (${request.status}): ${data?.error?.message || JSON.stringify(data).slice(0, 500)}`);
      return data;
    }, 2, `${context.task || 'openai'}:${model}`);
    await insertUsageEvent(env, {
      task: context.task || 'openai', model, conversation_id: context.conversation_id, package_id: context.package_id, job_id: context.job_id,
      input_tokens_estimate: Number(response?.usage?.input_tokens) || charTokenEstimate(JSON.stringify(payload)),
      output_tokens_estimate: Number(response?.usage?.output_tokens) || charTokenEstimate(JSON.stringify(response)),
      latency_ms: Date.now() - started, status: 'completed', retry_count: retryCount,
      metadata: { provider: 'openai', response_id: response?.id || null },
    });
    return response;
  } catch (error) {
    await insertUsageEvent(env, {
      task: context.task || 'openai', model, conversation_id: context.conversation_id, package_id: context.package_id, job_id: context.job_id,
      input_tokens_estimate: charTokenEstimate(JSON.stringify(payload)), latency_ms: Date.now() - started, status: 'failed', retry_count: retryCount,
      metadata: { provider: 'openai', error: error.message },
    });
    throw error;
  }
}

async function shouldUseGpt55(env, context = {}) {
  const controls = await conversationControls(env, context);
  return { controls, enabled: controls.model_mode === GPT55_MODE && Boolean(env.OPENAI_API_KEY) };
}

export async function runModel(env, model, input, context = {}) {
  const selection = await shouldUseGpt55(env, context);
  if (selection.enabled && context.task === 'image_generation') {
    try {
      const response = await invokeOpenAI(env, {
        input: String(input?.prompt || ''),
        tools: [{ type: 'image_generation', action: 'generate', size: openAIImageSize(input?.width, input?.height), quality: 'high', output_format: 'jpeg', output_compression: 90 }],
        tool_choice: { type: 'image_generation' },
      }, { ...context, task: 'image_generation_openai' });
      const image = (response.output || []).find(item => item?.type === 'image_generation_call' && item.result)?.result;
      if (!image) throw new Error('GPT-5.5 did not return an image generation result.');
      return { image, provider: 'openai', format: 'jpeg' };
    } catch (error) {
      console.warn('[openai-image-fallback]', error.message);
    }
  }
  return invoke(env, model, input, context);
}

export async function runStructured(env, model, system, user, schema, options = {}, context = {}) {
  const selection = await shouldUseGpt55(env, context);
  const task = context.task || 'structured';
  const effectiveSystem = `${system}${controlsInstruction(selection.controls, task)}`;
  if (selection.enabled) {
    const common = {
      input: [
        { role: 'system', content: [{ type: 'input_text', text: effectiveSystem }] },
        { role: 'user', content: [{ type: 'input_text', text: user }] },
      ],
      reasoning: { effort: options.reasoning_effort || (options.thinking ? 'high' : 'medium') },
      max_output_tokens: options.max_tokens || 4000,
      parallel_tool_calls: false,
    };
    try {
      const response = await invokeOpenAI(env, {
        ...common,
        text: { format: { type: 'json_schema', name: 'structured_result', strict: true, schema } },
      }, { ...context, task: `${task}:openai` });
      return finalizeStructuredResult(extractStructuredPayload(response, schema), selection.controls, task);
    } catch (error) {
      console.warn('[openai-structured-schema-retry]', task, error.message);
      try {
        const response = await invokeOpenAI(env, {
          ...common,
          input: [
            { role: 'system', content: [{ type: 'input_text', text: `${effectiveSystem}\n\nReturn only JSON matching this schema. Do not use markdown fences.\n${JSON.stringify(schema)}` }] },
            { role: 'user', content: [{ type: 'input_text', text: user }] },
          ],
        }, { ...context, task: `${task}:openai_json_retry` });
        return finalizeStructuredResult(extractStructuredPayload(response, schema), selection.controls, task);
      } catch (retryError) {
        console.warn('[openai-structured-fallback]', task, retryError.message);
      }
    }
  }

  const schemaInstruction = `${effectiveSystem}\n\nReturn only data matching this JSON Schema. Do not use markdown fences.\n${JSON.stringify(schema)}`;
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
      const response = await invoke(env, model, attempts[index], { ...context, task: `${task}:${index + 1}` });
      return finalizeStructuredResult(extractStructuredPayload(response, schema), selection.controls, task);
    } catch (error) { failures.push(error.message); }
  }
  throw new Error(`Structured generation failed: ${failures.join(' | ')}`);
}

export async function runText(env, model, messages, options = {}, context = {}) {
  const selection = await shouldUseGpt55(env, context);
  if (selection.enabled) {
    try {
      const response = await invokeOpenAI(env, {
        input: messages.map(message => ({ role: message.role, content: [{ type: 'input_text', text: String(message.content || '') }] })),
        reasoning: { effort: options.reasoning_effort || 'medium' },
        max_output_tokens: options.max_tokens || 1200,
      }, { ...context, task: `${context.task || 'text'}:openai` });
      return extractTextPayload(response);
    } catch (error) {
      console.warn('[openai-text-fallback]', error.message);
    }
  }
  const tokenLimit = options.max_tokens || 1200;
  const response = await invoke(env, model, {
    messages, temperature: options.temperature ?? 0.2, ...tokenOptionsForModel(model, tokenLimit), ...modelTuning(model, options.thinking),
  }, { ...context, task: context.task || 'text' });
  return extractTextPayload(response);
}

export async function runOpenAIWebResearch(env, { system, user, schema, mode = 'deep_research', context = {} }) {
  const response = await invokeOpenAI(env, {
    input: [
      { role: 'system', content: [{ type: 'input_text', text: system }] },
      { role: 'user', content: [{ type: 'input_text', text: user }] },
    ],
    reasoning: { effort: mode === 'deep_research' ? 'high' : 'medium' },
    max_output_tokens: mode === 'deep_research' ? 7000 : 4000,
    tools: [{ type: 'web_search', search_context_size: mode === 'deep_research' ? 'high' : 'medium' }],
    tool_choice: 'auto',
    text: { format: { type: 'json_schema', name: 'web_research_result', strict: true, schema } },
  }, { ...context, task: 'openai_web_research' });
  return extractStructuredPayload(response, schema);
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
    const preferred = [value.output_text, value.response, value.result?.response, value.result, value.output, value.parsed, value.data, value.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments, value.choices?.[0]?.message?.content, value.choices?.[0]?.text, value.message?.content, value.content, value.text];
    for (const candidate of preferred) if (candidate !== undefined && candidate !== value) queue.push(candidate);
    if (Array.isArray(value.content)) for (const part of value.content) queue.push(part?.text ?? part?.content ?? part);
  }
  throw new Error('Could not locate structured JSON in the model response.');
}

function extractTextPayload(response) {
  if (typeof response === 'string') return cleanText(response);
  const outputText = Array.isArray(response?.output)
    ? response.output.flatMap(item => item?.content || []).filter(part => part?.type === 'output_text' || typeof part?.text === 'string').map(part => part.text || '').join('\n')
    : '';
  const candidates = [response?.output_text, outputText, response?.response, response?.result?.response, response?.choices?.[0]?.message?.content, response?.choices?.[0]?.text, response?.message?.content, response?.text, response?.data];
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

function parseJson(raw, fallback) {
  if (!raw) return fallback;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return fallback; }
}

function openAIImageSize(width, height) {
  const w = Number(width) || 1024;
  const h = Number(height) || 1024;
  if (h > w * 1.15) return '1024x1536';
  if (w > h * 1.15) return '1536x1024';
  return '1024x1024';
}
