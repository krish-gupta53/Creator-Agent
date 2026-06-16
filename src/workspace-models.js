import { getModels } from './config.js';

function modelName(id) {
  return String(id || '').replace(/^@cf\//, '').replace(/\//g, ' / ');
}

export function workspaceModelOptions(env) {
  const configured = getModels(env);
  const rows = [
    { id: configured.chat, label: `Balanced · ${modelName(configured.chat)}`, role: 'chat' },
    { id: configured.fast, label: `Fast · ${modelName(configured.fast)}`, role: 'fast' },
    { id: configured.critic, label: `Deep analysis · ${modelName(configured.critic)}`, role: 'critic' },
  ];
  const extra = String(env.WORKSPACE_MODELS || '').split(',').map(value => value.trim()).filter(Boolean);
  extra.forEach(id => rows.push({ id, label: modelName(id), role: 'custom' }));
  const seen = new Set();
  return rows.filter(item => /^@cf\//.test(item.id) && !seen.has(item.id) && seen.add(item.id));
}

export function resolveWorkspaceModel(env, requested) {
  const options = workspaceModelOptions(env);
  const selected = options.find(item => item.id === requested) || options[0];
  return selected || { id: getModels(env).chat, label: modelName(getModels(env).chat), role: 'chat' };
}

export async function saveRunModel(env, runId, requested) {
  const selected = resolveWorkspaceModel(env, requested);
  const row = await env.DB.prepare('SELECT options_json FROM workspace_runs WHERE id = ?').bind(runId).first();
  if (!row) return selected;
  let options = {};
  try { options = JSON.parse(row.options_json || '{}'); } catch { options = {}; }
  options.model = selected.id;
  options.model_label = selected.label;
  options.model_provider = 'cloudflare_workers_ai';
  await env.DB.prepare('UPDATE workspace_runs SET options_json = ?, updated_at = datetime(\'now\') WHERE id = ?').bind(JSON.stringify(options), runId).run();
  return selected;
}

export async function modelEnvironmentForRun(env, runId) {
  let requested = '';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const row = await env.DB.prepare('SELECT options_json FROM workspace_runs WHERE id = ?').bind(runId).first();
    try { requested = JSON.parse(row?.options_json || '{}').model || ''; } catch { requested = ''; }
    if (requested) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const selected = resolveWorkspaceModel(env, requested);
  return {
    selected,
    env: new Proxy(env, {
      get(target, property) {
        if (property === 'CRITIC_MODEL') return selected.id;
        if (property === 'OPENAI_API_KEY') return undefined;
        return target[property];
      },
    }),
  };
}
