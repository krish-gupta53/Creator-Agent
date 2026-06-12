import { clampInt, cleanText, normalizeStringArray, nowIso } from './utils.js';

export const APP_VERSION = '4.0.0';
export const COOKIE_NAME = 'creator_session';
export const LEGACY_CONTEXT_KEY = 'creator:context:v1';
export const LEGACY_CONVERSATION_INDEX_KEY = 'conversations:index:v1';
export const LEGACY_INSIGHTS_INDEX_KEY = 'insights:index:v1';
export const LAST_INSIGHTS_RUN_KEY = 'insights:last-success:v1';
export const SARVAM_TTS_STREAM_URL = 'https://api.sarvam.ai/text-to-speech/stream';

export const DEFAULT_MODELS = {
  chat: '@cf/moonshotai/kimi-k2.6',
  fast: '@cf/zai-org/glm-4.7-flash',
  critic: '@cf/openai/gpt-oss-120b',
  image: '@cf/leonardo/lucid-origin',
  embedding: '@cf/baai/bge-m3',
  reranker: '@cf/baai/bge-reranker-base',
  asr: '@cf/openai/whisper-large-v3-turbo',
};

export const DEFAULT_CONTEXT = {
  page_name: '', page_description: '', mission: '', intended_impact: '', audience: '',
  content_pillars: [], voice: '', language_preferences: ['Hinglish'], non_negotiables: [], avoid: [],
  evidence_policy: 'Clearly separate verified facts, interpretation, and opinion. Never invent sources or quotations.',
  default_platforms: ['Instagram Reels'], default_duration_seconds: 60, default_aspect_ratio: '9:16',
  default_format: 'talking_head',
  visual_preferences: 'Use visuals only when they improve understanding or retention. Prefer simple B-roll and on-screen text over unnecessary AI images.',
  cta_style: '', retention: { raw_upload_days: 90, failed_job_days: 30, usage_event_days: 180 }, updated_at: null,
};

export function normalizeCreatorContext(input = {}) {
  const context = { ...DEFAULT_CONTEXT, ...(input || {}) };
  for (const key of ['page_name', 'page_description', 'mission', 'intended_impact', 'audience', 'voice', 'evidence_policy', 'visual_preferences', 'cta_style']) {
    context[key] = cleanText(context[key]).slice(0, ['page_description', 'mission', 'intended_impact'].includes(key) ? 4000 : 1600);
  }
  for (const key of ['content_pillars', 'language_preferences', 'non_negotiables', 'avoid', 'default_platforms']) {
    context[key] = normalizeStringArray(context[key], 30, 600);
  }
  context.default_duration_seconds = clampInt(context.default_duration_seconds, 10, 1800, 60);
  context.default_aspect_ratio = cleanText(context.default_aspect_ratio) || '9:16';
  context.default_format = cleanText(context.default_format) || 'talking_head';
  context.retention = {
    raw_upload_days: clampInt(context.retention?.raw_upload_days, 1, 3650, 90),
    failed_job_days: clampInt(context.retention?.failed_job_days, 1, 3650, 30),
    usage_event_days: clampInt(context.retention?.usage_event_days, 7, 3650, 180),
  };
  context.updated_at = nowIso();
  return context;
}

export function getModels(env) {
  return {
    chat: env.CHAT_MODEL || DEFAULT_MODELS.chat,
    fast: env.FAST_MODEL || DEFAULT_MODELS.fast,
    critic: env.CRITIC_MODEL || DEFAULT_MODELS.critic,
    image: env.IMAGE_MODEL || DEFAULT_MODELS.image,
    embedding: env.EMBEDDING_MODEL || DEFAULT_MODELS.embedding,
    reranker: env.RERANKER_MODEL || DEFAULT_MODELS.reranker,
    asr: env.ASR_MODEL || DEFAULT_MODELS.asr,
  };
}

export function blankDecisionSnapshot() {
  return {
    topic: '', core_message: '', objective: '', audience: '', platform: '', language: '', tone: '',
    duration_seconds: 0, aspect_ratio: '', format: '', research_depth: '', research_mode: 'uploaded_sources_only',
    visual_strategy: '', image_count: 0, tts_required: false, cta: '',
  };
}
