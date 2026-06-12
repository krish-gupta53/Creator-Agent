import { getModels, LAST_INSIGHTS_RUN_KEY } from './config.js';
import { runStructured } from './ai.js';
import {
  findPublicationByPermalink, getCreatorContext, getJob, insertInsightReport, insertMetricSnapshot,
  insertPerformanceLearning, listInsightReports, listPublications, setJob, upsertInstagramMedia,
} from './db.js';
import { INSIGHTS_ANALYSIS_SCHEMA } from './schemas.js';
import { cleanText, id, intEnv, nowIso, round4 } from './utils.js';

const PERFORMANCE_LEARNING_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    suggestions: {
      type: 'array', maxItems: 5,
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          statement: { type: 'string' }, observation: { type: 'string' }, hypothesis: { type: 'string' },
          recommended_test: { type: 'string' }, content_pillar: { type: 'string' }, platform: { type: 'string' },
          format: { type: 'string' }, metric: { type: 'string' }, evidence_count: { type: 'integer', minimum: 1 },
          confidence: { type: 'number', minimum: 0, maximum: 1 }, supporting_publication_ids: { type: 'array', items: { type: 'string' } },
        },
        required: ['statement', 'observation', 'hypothesis', 'recommended_test', 'content_pillar', 'platform', 'format', 'metric', 'evidence_count', 'confidence', 'supporting_publication_ids'],
      },
    },
  }, required: ['suggestions'],
};

export async function queueInsightsRefresh(env, force = true) {
  const jobId = id('insights');
  await setJob(env, jobId, { type: 'instagram_insights', state: 'queued', created_at: nowIso(), payload: { force } });
  await env.AGENT_QUEUE.send({ type: 'instagram_insights', job_id: jobId, force });
  return jobId;
}

export async function runInstagramInsightsJob(env, job) {
  if (!job.force && !(await insightsRunIsDue(env))) {
    await setJob(env, job.job_id, { ...(await getJob(env, job.job_id)), state: 'completed', skipped: true, completed_at: nowIso(), progress: 'Not due yet' });
    return;
  }
  await setJob(env, job.job_id, { ...(await getJob(env, job.job_id)), state: 'running', started_at: nowIso(), progress: 'Fetching the latest three reels' });
  if (!env.INSTAGRAM_ACCESS_TOKEN || !env.INSTAGRAM_USER_ID) {
    const report = buildUnconfiguredInsightsReport();
    await insertInsightReport(env, report);
    await setJob(env, job.job_id, { ...(await getJob(env, job.job_id)), state: 'completed', completed_at: nowIso(), progress: 'Instagram is not configured', result: { report_id: report.id } });
    return;
  }

  const media = await fetchLatestReels(env);
  const reels = [];
  for (const item of media.slice(0, 3)) {
    await upsertInstagramMedia(env, item);
    const metrics = await fetchReelMetrics(env, item.id);
    const reel = enrichReelMetrics(item, metrics);
    const publication = await findPublicationByPermalink(env, item.permalink || '');
    reel.publication_id = publication?.id || null;
    reel.package_id = publication?.package_id || null;
    await insertMetricSnapshot(env, {
      media_id: item.id,
      publication_id: publication?.id || null,
      snapshot_label: snapshotLabel(publication?.published_at, new Date()),
      metrics: reel.metrics,
    });
    reels.push(reel);
  }

  const previous = (await listInsightReports(env, 1))[0] || null;
  const context = await getCreatorContext(env);
  let analysis;
  try { analysis = await analyzeInstagramInsights(env, context, reels, previous, job.job_id); }
  catch (error) { analysis = fallbackInsightsAnalysis(reels, error.message); }

  const report = { id: id('insight'), created_at: nowIso(), status: 'ready', source: 'instagram_graph_api', reels, analysis, previous_report_id: previous?.id || null };
  await insertInsightReport(env, report);
  await env.APP_KV.put(LAST_INSIGHTS_RUN_KEY, report.created_at);

  try { await proposePerformanceLearnings(env, reels, analysis, job.job_id); }
  catch (error) { console.warn('[performance-learnings]', error.message); }

  await setJob(env, job.job_id, { ...(await getJob(env, job.job_id)), state: 'completed', completed_at: nowIso(), progress: 'Completed', result: { report_id: report.id } });
}

async function fetchLatestReels(env) {
  const base = (env.INSTAGRAM_GRAPH_BASE_URL || 'https://graph.instagram.com').replace(/\/$/, '');
  const version = env.INSTAGRAM_GRAPH_VERSION || 'v25.0';
  const fields = 'id,caption,media_type,media_product_type,permalink,timestamp,thumbnail_url,like_count,comments_count';
  const url = new URL(`${base}/${version}/${encodeURIComponent(env.INSTAGRAM_USER_ID)}/media`);
  url.searchParams.set('fields', fields);
  url.searchParams.set('limit', '15');
  url.searchParams.set('access_token', env.INSTAGRAM_ACCESS_TOKEN);
  const data = await fetchJson(url.toString());
  const list = Array.isArray(data.data) ? data.data : [];
  return list.filter(item => item.media_product_type === 'REELS' || item.media_type === 'VIDEO').slice(0, 3);
}

async function fetchReelMetrics(env, mediaId) {
  const candidates = ['views', 'reach', 'saved', 'shares', 'total_interactions', 'ig_reels_avg_watch_time', 'ig_reels_video_view_total_time'];
  const metrics = {};
  for (const metric of candidates) {
    try {
      const value = await fetchSingleInsightMetric(env, mediaId, metric);
      if (value !== null && value !== undefined) metrics[metric] = value;
    } catch {
      metrics[`${metric}_unavailable`] = true;
    }
  }
  return metrics;
}

async function fetchSingleInsightMetric(env, mediaId, metric) {
  const base = (env.INSTAGRAM_GRAPH_BASE_URL || 'https://graph.instagram.com').replace(/\/$/, '');
  const version = env.INSTAGRAM_GRAPH_VERSION || 'v25.0';
  const url = new URL(`${base}/${version}/${encodeURIComponent(mediaId)}/insights`);
  url.searchParams.set('metric', metric);
  url.searchParams.set('access_token', env.INSTAGRAM_ACCESS_TOKEN);
  const data = await fetchJson(url.toString());
  const row = Array.isArray(data.data) ? data.data[0] : null;
  if (!row) return null;
  if (row.total_value && typeof row.total_value.value !== 'undefined') return row.total_value.value;
  if (Array.isArray(row.values) && row.values.length) return row.values[row.values.length - 1].value;
  return null;
}

function enrichReelMetrics(item, metrics) {
  const likes = Number(item.like_count || 0);
  const comments = Number(item.comments_count || 0);
  const shares = Number(metrics.shares || 0);
  const saved = Number(metrics.saved || 0);
  const interactions = Number(metrics.total_interactions || (likes + comments + shares + saved));
  const reach = Number(metrics.reach || 0);
  const views = Number(metrics.views || 0);
  return {
    id: item.id, caption: cleanText(item.caption).slice(0, 1200), permalink: item.permalink || '', timestamp: item.timestamp || '', thumbnail_url: item.thumbnail_url || '',
    metrics: { ...metrics, likes, comments, calculated_interactions: interactions, engagement_rate_by_reach: reach > 0 ? round4(interactions / reach) : null, interaction_rate_by_views: views > 0 ? round4(interactions / views) : null },
  };
}

async function analyzeInstagramInsights(env, context, reels, previous, jobId) {
  const models = getModels(env);
  const system = `You are a careful Instagram performance analyst for one creator. Analyze only supplied metrics, captions, and linked package metadata.
- Compare the three reels and the previous report only where comparable.
- Separate observation, hypothesis, and recommended experiment. Never claim causation from correlation.
- Focus on hook, topic framing, saves, shares, comments, reach, views, and watch-time metrics when available.
- Give experiments that fit creator memory.
- Explicitly note missing, immature, or non-comparable metrics.
Return structured JSON only.`;
  return runStructured(env, models.critic, system, JSON.stringify({ creator_memory: context, current_reels: reels, previous_report: previous ? { created_at: previous.created_at, reels: previous.reels, analysis: previous.analysis } : null }), INSIGHTS_ANALYSIS_SCHEMA, { max_tokens: 3000, temperature: 0.2 }, { task: 'instagram_analysis', job_id: jobId });
}

async function proposePerformanceLearnings(env, reels, analysis, jobId) {
  const linked = reels.filter(reel => reel.publication_id);
  if (linked.length < 3) return;
  const publications = await listPublications(env, 30);
  const linkedIds = new Set(linked.map(item => item.publication_id));
  const evidence = publications.filter(item => linkedIds.has(item.id)).map(item => ({ publication_id: item.id, package_id: item.package_id, platform: item.platform, hook_used: item.hook_used, actual_duration_seconds: item.actual_duration_seconds, package: { brief: item.package.final_brief, selected_hook: item.package.selected_hook, visual_plan: item.package.visual_plan }, reel: linked.find(reel => reel.publication_id === item.id) }));
  const models = getModels(env);
  const result = await runStructured(env, models.critic,
    `Propose reusable performance learnings only when supported by at least three linked publications. Each item must clearly separate observation from hypothesis and recommend a controlled test. Keep confidence conservative. All items remain proposed until the creator approves them. Return JSON only.`,
    JSON.stringify({ evidence, latest_analysis: analysis }), PERFORMANCE_LEARNING_SCHEMA, { max_tokens: 2600, temperature: 0.15 }, { task: 'performance_learning_proposals', job_id: jobId });
  for (const learning of result.suggestions || []) {
    if (Number(learning.evidence_count || 0) < 3) continue;
    await insertPerformanceLearning(env, { ...learning, status: 'proposed' });
  }
}

function buildUnconfiguredInsightsReport() {
  return {
    id: id('insight'), created_at: nowIso(), status: 'not_configured', source: 'instagram_graph_api', reels: [],
    analysis: {
      headline: 'Connect Instagram to activate performance learning',
      summary: 'The application is ready, but INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_USER_ID are not available to this Worker.',
      wins: ['The scheduler, report storage, and dashboard remain available.'],
      improvements: ['Connect an Instagram Professional account with the required insights permissions.'],
      next_reel_experiments: ['After connecting, run a manual refresh to create the first baseline.', 'Link generated packages to their published reels for decision-level analysis.'],
      metric_notes: ['No Instagram data was requested because credentials are missing.'], confidence_note: 'No performance conclusions are available yet.',
    },
  };
}

function fallbackInsightsAnalysis(reels, reason) {
  const sorted = [...reels].sort((a, b) => (b.metrics.calculated_interactions || 0) - (a.metrics.calculated_interactions || 0));
  const best = sorted[0];
  return {
    headline: best ? 'A baseline report is ready' : 'No recent reels were returned',
    summary: best ? `The strongest fetched reel by recorded interactions was posted ${best.timestamp || 'at the latest available time'}.` : 'No comparable reel data was available.',
    wins: best ? [`The leading reel recorded ${best.metrics.calculated_interactions || 0} known interactions.`] : ['The pipeline completed without affecting content generation.'],
    improvements: ['Use this as a baseline and compare another snapshot after metrics have matured.'],
    next_reel_experiments: ['Test one sharper first-sentence hook while keeping other variables stable.', 'Give viewers one clear reason to save or share the reel.'],
    metric_notes: [`Automated narrative analysis used a fallback: ${reason}`], confidence_note: 'Low confidence because the independent analysis model or metric set was incomplete.',
  };
}

async function insightsRunIsDue(env) {
  const everyDays = Math.max(1, intEnv(env, 'INSIGHTS_EVERY_DAYS', 1));
  const last = await env.APP_KV.get(LAST_INSIGHTS_RUN_KEY);
  if (!last) return true;
  const elapsed = Date.now() - new Date(last).getTime();
  return elapsed >= everyDays * 24 * 60 * 60 * 1000;
}

function snapshotLabel(publishedAt, now) {
  if (!publishedAt) return 'latest';
  const hours = Math.max(0, (now.getTime() - new Date(publishedAt).getTime()) / 3600000);
  if (hours <= 30) return '24h';
  if (hours <= 90) return '72h';
  if (hours <= 192) return '7d';
  return 'latest';
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Instagram API failed (${response.status}): ${(await response.text()).slice(0, 1000)}`);
  return response.json();
}
