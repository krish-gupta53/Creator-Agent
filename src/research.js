import { getModels } from './config.js';
import { runStructured } from './ai.js';
import { beginResearchRun, finishResearchRun } from './db.js';
import { cleanText, id, nowIso } from './utils.js';

const QUERY_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: { queries: { type: 'array', minItems: 2, maxItems: 6, items: { type: 'string' } } },
  required: ['queries'],
};

const CLAIM_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    claims: { type: 'array', maxItems: 20, items: { type: 'object', additionalProperties: false, properties: {
      claim: { type: 'string' }, confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      supporting_source_ids: { type: 'array', items: { type: 'string' } }, contradicting_source_ids: { type: 'array', items: { type: 'string' } }, caveat: { type: 'string' },
    }, required: ['claim', 'confidence', 'supporting_source_ids', 'contradicting_source_ids', 'caveat'] } },
  }, required: ['claims'],
};

export async function runResearch(env, { conversationId, plan, creatorMemory, jobId }) {
  const mode = plan.research_mode || 'uploaded_sources_only';
  if (!['quick_verification', 'deep_research'].includes(mode)) return { mode, status: 'not_requested', sources: [], claims: [], note: 'Live research was not requested.' };
  if (!env.TAVILY_API_KEY) return { mode, status: 'unavailable', sources: [], claims: [], note: 'Live research was requested, but TAVILY_API_KEY is not configured. The package must rely on uploaded sources and mark unsupported claims.' };

  const models = getModels(env);
  const queryResult = await runStructured(env, models.fast,
    'Create focused web-research queries for a creator script. Include current-date qualifiers when recency matters. Avoid broad generic queries. Return JSON only.',
    JSON.stringify({ creator_memory: creatorMemory, approved_plan: plan, depth: mode }), QUERY_SCHEMA,
    { max_tokens: 800, temperature: 0.15 }, { task: 'research_queries', conversation_id: conversationId, job_id: jobId });
  const queries = queryResult.queries.map(cleanText).filter(Boolean);
  const runId = await beginResearchRun(env, conversationId, mode, queries);
  const sources = [];
  const maxPerQuery = mode === 'deep_research' ? 5 : 3;
  for (const query of queries) {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: env.TAVILY_API_KEY, query, search_depth: mode === 'deep_research' ? 'advanced' : 'basic', max_results: maxPerQuery, include_answer: false, include_raw_content: mode === 'deep_research' }),
    });
    if (!response.ok) throw new Error(`Tavily search failed (${response.status}): ${await response.text()}`);
    const data = await response.json();
    for (const result of data.results || []) {
      if (!result.url || sources.some(item => item.url === result.url)) continue;
      let domain = '';
      try { domain = new URL(result.url).hostname.replace(/^www\./, ''); } catch { /* ignore */ }
      sources.push({
        id: id('src'), title: cleanText(result.title).slice(0, 500), url: result.url, domain,
        published_at: result.published_date || null, fetched_at: nowIso(), source_type: classifySource(domain),
        reliability_score: sourceScore(domain), excerpt: cleanText(result.raw_content || result.content).slice(0, 12000), raw: { score: result.score, query },
      });
    }
  }

  let claims = [];
  if (sources.length) {
    const claimResult = await runStructured(env, models.critic,
      `Build a cautious claim ledger from supplied web-search excerpts. A source ID may support a claim only if the excerpt actually supports it. Identify contradictions and uncertainty. Never invent details. Return JSON only.`,
      JSON.stringify({ approved_plan: plan, sources: sources.map(item => ({ id: item.id, title: item.title, url: item.url, domain: item.domain, published_at: item.published_at, excerpt: item.excerpt })) }),
      CLAIM_SCHEMA, { max_tokens: 3200, temperature: 0.1 }, { task: 'research_claim_ledger', conversation_id: conversationId, job_id: jobId });
    claims = (claimResult.claims || []).map(item => ({ ...item, id: id('claim') }));
  }
  await finishResearchRun(env, runId, sources, claims);
  return { run_id: runId, mode, status: sources.length ? 'completed' : 'empty', sources, claims, note: sources.length ? 'Live web research was collected through Tavily and converted into a claim ledger.' : 'No usable research sources were returned.' };
}

function classifySource(domain) {
  const d = String(domain || '').toLowerCase();
  if (/\.gov\.|\.gov$|\.nic\.in$/.test(d)) return 'official';
  if (/\.edu\.|\.ac\.|\.edu$/.test(d)) return 'academic';
  if (/who\.int$|un\.org$|unesco\.org$|worldbank\.org$/.test(d)) return 'institutional';
  return 'web';
}

function sourceScore(domain) {
  const type = classifySource(domain);
  return type === 'official' ? 0.95 : type === 'academic' ? 0.9 : type === 'institutional' ? 0.88 : 0.65;
}
