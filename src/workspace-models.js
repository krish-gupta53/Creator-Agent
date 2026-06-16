import { getModels } from './config.js';

function modelName(id) {
  return String(id || '').replace(/^@cf\//, '').replace(/\//g, ' / ');
}

function openAiModel(env) {
  return String(env.OPENAI_MODEL || 'gpt-5.5').trim() || 'gpt-5.5';
}

export function workspaceModelOptions(env) {
  const configured = getModels(env);
  const rows = [
    { id: configured.chat, model: configured.chat, label: `Balanced · ${modelName(configured.chat)}`, role: 'chat', provider: 'cloudflare_workers_ai' },
    { id: configured.fast, model: configured.fast, label: `Fast · ${modelName(configured.fast)}`, role: 'fast', provider: 'cloudflare_workers_ai' },
    { id: configured.critic, model: configured.critic, label: `Deep analysis · ${modelName(configured.critic)}`, role: 'critic', provider: 'cloudflare_workers_ai' },
  ];

  const extra = String(env.WORKSPACE_MODELS || '').split(',').map(value => value.trim()).filter(Boolean);
  extra.forEach(id => rows.push({ id, model: id, label: modelName(id), role: 'custom', provider: 'cloudflare_workers_ai' }));

  if (env.OPENAI_API_KEY) {
    const model = openAiModel(env);
    rows.push({
      id: `openai:${model}`,
      model,
      label: `GPT-5.5 Thinking · OpenAI`,
      role: 'thinking',
      provider: 'openai',
    });
  }

  const seen = new Set();
  return rows.filter(item => {
    const valid = item.provider === 'openai' ? item.id === `openai:${openAiModel(env)}` : /^@cf\//.test(item.id);
    return valid && !seen.has(item.id) && seen.add(item.id);
  });
}

export function resolveWorkspaceModel(env, requested) {
  const options = workspaceModelOptions(env);
  const selected = options.find(item => item.id === requested) || options[0];
  return selected || {
    id: getModels(env).chat,
    model: getModels(env).chat,
    label: modelName(getModels(env).chat),
    role: 'chat',
    provider: 'cloudflare_workers_ai',
  };
}

export async function saveRunModel(env, runId, requested) {
  const selected = resolveWorkspaceModel(env, requested);
  const row = await env.DB.prepare('SELECT options_json FROM workspace_runs WHERE id = ?').bind(runId).first();
  if (!row) return selected;
  let options = {};
  try { options = JSON.parse(row.options_json || '{}'); } catch { options = {}; }
  options.model = selected.id;
  options.runtime_model = selected.model;
  options.model_label = selected.label;
  options.model_provider = selected.provider;
  await env.DB.prepare('UPDATE workspace_runs SET options_json = ?, updated_at = datetime(\'now\') WHERE id = ?').bind(JSON.stringify(options), runId).run();
  return selected;
}

async function setConversationProvider(env, conversationId, selected) {
  if (!conversationId) return;
  const row = await env.DB.prepare('SELECT decision_json FROM conversations WHERE id = ?').bind(conversationId).first();
  let decision = {};
  try { decision = JSON.parse(row?.decision_json || '{}'); } catch { decision = {}; }
  decision.model_mode = selected.provider === 'openai' ? 'gpt-5.5' : 'existing';
  await env.DB.prepare('UPDATE conversations SET decision_json = ?, updated_at = datetime(\'now\') WHERE id = ?').bind(JSON.stringify(decision), conversationId).run();
}

export async function modelEnvironmentForRun(env, runId) {
  let requested = '';
  let conversationId = '';
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const row = await env.DB.prepare('SELECT conversation_id, options_json FROM workspace_runs WHERE id = ?').bind(runId).first();
    conversationId = row?.conversation_id || conversationId;
    try { requested = JSON.parse(row?.options_json || '{}').model || ''; } catch { requested = ''; }
    if (requested) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const selected = resolveWorkspaceModel(env, requested);
  await setConversationProvider(env, conversationId, selected);

  return {
    selected,
    env: new Proxy(env, {
      get(target, property) {
        if (selected.provider === 'openai') {
          if (property === 'OPENAI_MODEL') return selected.model;
          return target[property];
        }
        if (property === 'CRITIC_MODEL') return selected.model;
        if (property === 'OPENAI_API_KEY') return undefined;
        return target[property];
      },
    }),
  };
}
