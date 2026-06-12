import { getModels, blankDecisionSnapshot } from './config.js';
import { runStructured } from './ai.js';
import {
  addPin, createConversationRecord, deletePin, getConversation, getCreatorContext, getLatestMessageSequence,
  insertMessage, listMessages, listPerformanceLearnings, updateConversation, updatePin,
} from './db.js';
import { CONVERSATION_SUMMARY_SCHEMA, PLAN_SCHEMA } from './schemas.js';
import { parseMessageRequest, processUploadedFile, retrieveRelevantSources } from './sources.js';
import { clampInt, cleanText, httpError, intEnv, normalizeStringArray, normalizeText } from './utils.js';

export async function createConversation(env, title) {
  return createConversationRecord(env, title);
}

export async function addConversationMessage(request, env, conversationId) {
  let conversation = await getConversation(env, conversationId);
  if (!conversation) throw httpError(404, 'Conversation not found.');
  const { text, files } = await parseMessageRequest(request);
  if (!cleanText(text) && !files.length) throw httpError(400, 'Write a message or attach a file.');
  const maxAttachments = intEnv(env, 'MAX_ATTACHMENTS_PER_MESSAGE', 6);
  if (files.length > maxAttachments) throw httpError(400, `Maximum ${maxAttachments} attachments per message.`);

  const userMessage = await insertMessage(env, conversationId, 'user', cleanText(text).slice(0, 20000), {});
  const attachments = [];
  for (const file of files) {
    const attachment = await processUploadedFile(env, { conversationId, messageId: userMessage.id, file });
    attachments.push(attachment);
    // Guard: only send index job when chunks exist and not yet vectorized.
    if (attachment.index_pending && !attachment.vector_id) {
      await env.AGENT_QUEUE.send({ type: 'index_attachment', attachment_id: attachment.id, conversation_id: conversationId });
    }
    if (attachment.media_processing_pending) await env.AGENT_QUEUE.send({ type: 'analyze_video', attachment_id: attachment.id, conversation_id: conversationId });
    if (attachment.ocr_processing_pending) await env.AGENT_QUEUE.send({ type: 'ocr_attachment', attachment_id: attachment.id, conversation_id: conversationId });
  }
  userMessage.attachments = attachments;

  // Trigger an immediate summary when a rich attachment is added (summary length > 200)
  // so the conversation summary captures source context without waiting 6 messages.
  const hasRichAttachment = attachments.some(a => a.summary && a.summary.length > 200);
  if (hasRichAttachment) {
    await env.AGENT_QUEUE.send({ type: 'refresh_conversation_summary', conversation_id: conversationId });
  }

  conversation = await getConversation(env, conversationId);
  const userMessages = conversation.messages.filter(item => item.role === 'user');
  if (userMessages.length === 1 && cleanText(text)) conversation.title = cleanText(text).slice(0, 82);

  const context = await buildConversationContext(env, conversationId, cleanText(text) || attachments.map(item => item.summary).join('\n'));
  let plan;
  try { plan = await planConversation(env, conversation, userMessage, context); }
  catch (error) {
    console.error('[planner] fallback', error);
    plan = fallbackPlan(conversation, userMessage, context.creator_memory);
  }

  const explicitApproval =
  userMessages.length >= 2 &&
  detectsApproval(userMessage.content);

plan.decision_snapshot = normalizeDecisionSnapshot(
  plan.decision_snapshot,
  conversation.decision_snapshot,
  context.creator_memory
);

plan.missing_decisions = [
  ...new Set([
    ...normalizeStringArray(plan.missing_decisions, 8, 180),
    ...computeEssentialMissingDecisions(plan.decision_snapshot),
  ]),
].slice(0, 8);

plan.options = Array.isArray(plan.options)
  ? plan.options.slice(0, 6)
  : [];

// The backend—not the LLM—owns the approval gate.
const canGenerate =
  explicitApproval &&
  plan.missing_decisions.length === 0;

plan.ready_to_generate = canGenerate;

if (canGenerate) {
  plan.stage = 'approved';
  plan.options = [];
  plan.suggested_action = 'generate';

  // Do not allow the planning model to write the final script here.
  plan.assistant_message = [
    'The production plan is approved and locked.',
    '',
    'Click "Generate package" to create the final script, visual plan, generated images, captions, review, and optional audio.',
  ].join('\n');
} else {
  if (plan.stage === 'approved') {
    plan.stage = 'awaiting_approval';
  }

  if (explicitApproval && plan.missing_decisions.length > 0) {
    plan.stage = 'planning';
    plan.ready_to_generate = false;
    plan.suggested_action = 'resolve_missing_decisions';

    plan.assistant_message = [
      'I have recorded your approval, but the production plan is still missing:',
      '',
      ...plan.missing_decisions.map(
        item => `• ${item}`
      ),
      '',
      'Let us settle these before generating the final package.',
    ].join('\n');
  }
}

  const updated = await updateConversation(env, conversationId, {
    title: conversation.title, stage: plan.stage, ready_to_generate: plan.ready_to_generate,
    decision_snapshot: plan.decision_snapshot, missing_decisions: plan.missing_decisions,
  });

  // Embed missing_decisions in message metadata so the UI can render chips.
  await insertMessage(env, conversationId, 'assistant', cleanText(plan.assistant_message), {
    options: plan.options, suggested_action: plan.suggested_action, decision_snapshot: plan.decision_snapshot,
    missing_decisions: plan.missing_decisions,
  });

  const latestSequence = await getLatestMessageSequence(env, conversationId);
  const summaryEvery = intEnv(env, 'SUMMARY_EVERY_MESSAGES', 6);
  if (!hasRichAttachment && latestSequence - Number(updated.last_summarized_sequence || 0) >= summaryEvery) {
    await env.AGENT_QUEUE.send({ type: 'refresh_conversation_summary', conversation_id: conversationId });
  }
  return getConversation(env, conversationId);
}

export async function buildConversationContext(env, conversationId, currentQuery = '') {
  // Fetch conversation meta, creator memory, performance learnings, recent messages,
  // and relevant sources all in parallel to reduce round-trip latency.
  const [conversation, creatorMemory, performanceLearnings, recentMessages, relevantSources] = await Promise.all([
    getConversation(env, conversationId, { includeMessages: false }),
    getCreatorContext(env),
    listPerformanceLearnings(env, 'approved', 12),
    listMessages(env, conversationId, intEnv(env, 'RECENT_CONTEXT_MESSAGES', 12), true),
    retrieveRelevantSources(env, conversationId, currentQuery, intEnv(env, 'RETRIEVAL_TOP_K', 7)),
  ]);
  if (!conversation) throw httpError(404, 'Conversation not found.');
  return {
    creator_memory: creatorMemory,
    conversation_summary: conversation.conversation_summary,
    decision_snapshot: conversation.decision_snapshot,
    pinned_notes: conversation.pins || [],
    recent_messages: recentMessages.map(message => ({
      id: message.id, sequence_number: message.sequence_number, role: message.role, content: message.content,
      options: message.metadata?.options || [],
      attachment_summaries: (message.attachments || []).map(item => ({ id: item.id, name: item.name, status: item.status, summary: item.summary })),
    })),
    relevant_sources: relevantSources,
    performance_learnings: performanceLearnings.map(item => ({ statement: item.statement, observation: item.observation, hypothesis: item.hypothesis, recommended_test: item.recommended_test, confidence: item.confidence, platform: item.platform, format: item.format })),
  };
}

async function planConversation(env, conversation, latestUserMessage, context) {
  const models = getModels(env);
  const system = `You are a collaborative content strategist and production partner, not a one-shot script generator.

Memory hierarchy:
1. Creator memory is the global editorial constitution.
2. Pinned notes and the per-chat summary are long-term memory for this conversation only.
3. The decision snapshot records current production decisions.
4. Recent messages preserve conversational nuance.
5. Retrieved sources are evidence from uploads or URLs in this conversation.
6. Approved performance learnings are hypotheses to consider, never absolute rules.

During conversation:
- Understand the creator's idea, intended impact, audience, evidence needs, and personal point of view.
- Discuss options before committing. Offer 2-4 genuinely different approaches when useful.
- Dynamically agree on platform, language, tone, duration, aspect ratio, format, research mode, visual strategy, image count, TTS, and CTA.
- The creator normally speaks on camera. Recommend zero AI images when talking head, captions, B-roll, or uploaded material is enough.
- This is a planning conversation only.
- Never write the final script, complete narration, final caption, complete shot list, final image prompts, or production package in a planning response.
- Even when the creator approves, do not generate the final content inside chat.
- When the creator approves a complete plan, return only a short approval confirmation.
- Set ready_to_generate to true when the latest user message explicitly approves and no meaningful decisions remain.
- The actual package pipeline can generate image files through Workers AI after the creator clicks Generate package.
- Never claim that the application cannot generate images.
- Never recommend external image tools merely because the creator asks for generated images.
- Preserve rejected approaches and explicit constraints from pins and summary.
- If performance learnings are relevant, present them as an option or test, not as causation.
- When the plan is complete, summarize it and ask for explicit approval.
- ready_to_generate may be true only when all meaningful decisions are settled and the latest user message explicitly approves/finalizes the plan.
- Do not claim live research unless retrieved research sources are explicitly present.
- Ask exactly ONE question per turn when the plan is incomplete. If multiple decisions are missing, address the most important one first.
Return structured JSON only.`;
  return runStructured(env, models.chat, system, JSON.stringify({ ...context, current_stage: conversation.stage, latest_user_message: latestUserMessage.content }), PLAN_SCHEMA, { max_tokens: 3000, temperature: 0.35 }, { task: 'conversation_planning', conversation_id: conversation.id });
}

export async function refreshConversationSummaryJob(env, job) {
  const conversation = await getConversation(env, job.conversation_id, { includeMessages: false });
  if (!conversation) return;
  const messages = await listMessages(env, conversation.id, 100, true, Number(conversation.last_summarized_sequence || 0));
  if (!messages.length) return;
  const models = getModels(env);
  const previous = conversation.conversation_summary || emptyConversationSummary();
  const system = `Update the long-term memory for one creator conversation.
Preserve accepted facts, important personal context, explicit constraints, rejected approaches, examples liked/disliked, open questions, source cautions, and the agreed creative direction.
Never turn speculation into fact. Never infer a preference from one casual sentence. Remove open questions that are clearly resolved. Avoid copying small talk. Include the IDs of messages that support important memory. Return structured JSON only.`;
  const summary = await runStructured(env, models.fast, system, JSON.stringify({ previous_summary: previous, current_decision_snapshot: conversation.decision_snapshot, pinned_notes: conversation.pins, new_messages: messages.map(item => ({ id: item.id, sequence: item.sequence_number, role: item.role, content: item.content, attachments: item.attachments.map(a => ({ name: a.name, summary: a.summary })) })) }), CONVERSATION_SUMMARY_SCHEMA, { max_tokens: 2600, temperature: 0.1 }, { task: 'conversation_summary', conversation_id: conversation.id });
  const latest = Math.max(...messages.map(item => Number(item.sequence_number || 0)));
  await updateConversation(env, conversation.id, { conversation_summary: normalizeConversationSummary(summary), last_summarized_sequence: latest });
}

function emptyConversationSummary() {
  return { original_intent: '', important_context: [], creator_statements: [], agreed_points: [], rejected_approaches: [], examples_the_creator_liked: [], examples_the_creator_disliked: [], factual_claims: [], source_notes: [], uncertainties: [], open_questions: [], creative_direction: '', message_ids_used: [] };
}

function normalizeConversationSummary(input) {
  const output = { ...emptyConversationSummary(), ...(input || {}) };
  for (const key of ['important_context', 'creator_statements', 'agreed_points', 'rejected_approaches', 'examples_the_creator_liked', 'examples_the_creator_disliked', 'factual_claims', 'source_notes', 'uncertainties', 'open_questions', 'message_ids_used']) output[key] = normalizeStringArray(output[key], 40, 1200);
  output.original_intent = cleanText(output.original_intent).slice(0, 3000);
  output.creative_direction = cleanText(output.creative_direction).slice(0, 3000);
  return output;
}

function fallbackPlan(conversation, latestUserMessage, context) {
  const previous = normalizeDecisionSnapshot(conversation.decision_snapshot, blankDecisionSnapshot(), context);
  if (!previous.topic && latestUserMessage.content) previous.topic = latestUserMessage.content.slice(0, 300);
  const missing = computeEssentialMissingDecisions(previous);
  const approval = detectsApproval(latestUserMessage.content) && missing.length === 0;
  return {
    assistant_message: approval ? 'The plan is approved. You can now generate the production package.' : `I have captured the idea. Before scripting, let us settle ${missing.slice(0, 1).join(' and ') || 'the final creative direction'}.`,
    stage: approval ? 'approved' : 'planning',
    options: [
      { label: 'Concise explainer', value: 'A clear talking-head explainer with minimal B-roll', description: 'Best for clarity and authority.' },
      { label: 'Personal story', value: 'A first-person story with a reflective payoff', description: 'Best for connection and emotional retention.' },
      { label: 'Strong opinion', value: 'A point-of-view reel built around one sharp argument', description: 'Best when the page has a clear stance.' },
    ],
    decision_snapshot: previous, missing_decisions: missing, ready_to_generate: approval, suggested_action: approval ? 'generate' : 'choose_option',
  };
}

export function normalizeDecisionSnapshot(input, previous, context) {
  const merged = { ...blankDecisionSnapshot(), ...(previous || {}), ...(input || {}) };
  for (const key of ['topic', 'core_message', 'objective', 'audience', 'platform', 'language', 'tone', 'aspect_ratio', 'format', 'research_depth', 'research_mode', 'visual_strategy', 'cta']) merged[key] = cleanText(merged[key]).slice(0, 1600);
  merged.audience ||= context.audience || '';
  merged.platform ||= context.default_platforms?.[0] || 'Instagram Reels';
  merged.language ||= context.language_preferences?.[0] || 'Hinglish';
  merged.duration_seconds = clampInt(merged.duration_seconds || context.default_duration_seconds, 10, 1800, 60);
  merged.aspect_ratio ||= context.default_aspect_ratio || '9:16';
  merged.format ||= context.default_format || 'talking_head';
  if (!['none', 'uploaded_sources_only', 'quick_verification', 'deep_research'].includes(merged.research_mode)) merged.research_mode = 'uploaded_sources_only';
  merged.image_count = clampInt(merged.image_count, 0, 20, 0);
  merged.tts_required = Boolean(merged.tts_required);
  return merged;
}

function detectsApproval(text) {
  const normalized = normalizeText(text);

  return /\b(approve|approved|approving|approval|finalize|finalise|finalized|finalised|generate|go ahead|looks good|proceed|done|lock it|yes final|final plan|i approve|i am approving|approved from my side|okay generate|ok generate|haan final|kar do|generate karo)\b/i.test(normalized);
}

function computeEssentialMissingDecisions(decision) {
  const missing = [];
  if (!cleanText(decision.topic)) missing.push('Topic or content premise');
  if (!cleanText(decision.core_message)) missing.push('Core message for the viewer');
  if (!cleanText(decision.audience)) missing.push('Primary audience');
  if (!cleanText(decision.platform)) missing.push('Publishing platform');
  if (!cleanText(decision.language)) missing.push('Language');
  if (!cleanText(decision.format)) missing.push('Content format');
  if (!cleanText(decision.visual_strategy)) missing.push('Visual approach');
  return missing;
}

export async function addConversationPin(env, conversationId, text) {
  const conversation = await getConversation(env, conversationId, { includeMessages: false });
  if (!conversation) throw httpError(404, 'Conversation not found.');
  return addPin(env, conversationId, text);
}

export async function removeConversationPin(env, conversationId, pinId) {
  await deletePin(env, conversationId, pinId);
}

export async function editConversationPin(env, conversationId, pinId, text) {
  const conversation = await getConversation(env, conversationId, { includeMessages: false });
  if (!conversation) throw httpError(404, 'Conversation not found.');
  return updatePin(env, conversationId, pinId, text);
}

export async function duplicateConversation(env, conversationId) {
  const source = await getConversation(env, conversationId, { includeMessages: true, includeAttachments: false, includePackages: false });
  if (!source) throw httpError(404, 'Conversation not found.');
  const newConv = await createConversationRecord(env, `Copy of ${source.title}`.slice(0, 120));
  // Copy non-greeting messages (skip the initial assistant greeting which createConversationRecord inserts).
  const messagesToCopy = (source.messages || []).filter(m => !(m.role === 'assistant' && m.sequence_number === 1));
  for (const m of messagesToCopy) {
    await insertMessage(env, newConv.id, m.role, m.content, { ...m.metadata, duplicated_from: m.id });
  }
  // Copy decision snapshot and pins.
  await updateConversation(env, newConv.id, {
    title: newConv.title,
    stage: 'planning',
    decision_snapshot: source.decision_snapshot,
    missing_decisions: source.missing_decisions,
    ready_to_generate: false,
  });
  for (const pin of source.pins || []) {
    await addPin(env, newConv.id, pin.text);
  }
  return getConversation(env, newConv.id);
}
