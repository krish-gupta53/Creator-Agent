import { Buffer } from 'node:buffer';
import { getModels, SARVAM_TTS_STREAM_URL } from './config.js';
import { runModel, runStructured } from './ai.js';
import {
  createPackage, createPublication, getConversation, getCreatorContext, getJob, getPackage, getLatestFeedback,
  insertFeedback, insertMemorySuggestion, insertMessage, setActivePackage, setJob, updatePackage,
} from './db.js';
import { buildConversationContext } from './conversations.js';
import { MEMORY_SUGGESTION_SCHEMA, PACKAGE_SCHEMA, REVIEW_SCHEMA } from './schemas.js';
import { runResearch } from './research.js';
import {
  clampInt, cleanText, getPath, httpError, id, intEnv, normalizeStringArray, normalizeText,
  nowIso, numberEnv, safeFilename, setPath, wordEstimate,
} from './utils.js';

const TARGET_SCHEMAS = {
  hook: { type: 'object', additionalProperties: false, properties: { hook_options: { type: 'array', minItems: 3, maxItems: 5, items: { type: 'string' } }, selected_hook: { type: 'string' } }, required: ['hook_options', 'selected_hook'] },
  spoken_script: {
    type: 'object',
    additionalProperties: false,
    properties: {
      spoken_script: { type: 'string', minLength: 40 },
      estimated_duration_seconds: { type: 'integer', minimum: 5, maximum: 1800 },
    },
    required: ['spoken_script', 'estimated_duration_seconds'],
  },
  caption: { type: 'object', additionalProperties: false, properties: { caption: { type: 'string' } }, required: ['caption'] },
  hashtags: { type: 'object', additionalProperties: false, properties: { hashtags: { type: 'array', minItems: 3, maxItems: 15, items: { type: 'string' } } }, required: ['hashtags'] },
  cta: { type: 'object', additionalProperties: false, properties: { cta: { type: 'string' } }, required: ['cta'] },
  delivery_notes: { type: 'object', additionalProperties: false, properties: { delivery_notes: { type: 'array', items: { type: 'string' } } }, required: ['delivery_notes'] },
  beat_sheet: { type: 'object', additionalProperties: false, properties: { beat_sheet: PACKAGE_SCHEMA.properties.script.properties.beat_sheet }, required: ['beat_sheet'] },
  visual_plan: { type: 'object', additionalProperties: false, properties: { visual_plan: PACKAGE_SCHEMA.properties.visual_plan }, required: ['visual_plan'] },
};

const TARGET_PATHS = {
  hook: ['hook_options', 'selected_hook'], spoken_script: ['script.spoken_script'], caption: ['post_copy.caption'], hashtags: ['post_copy.hashtags'],
  cta: ['post_copy.cta'], delivery_notes: ['script.delivery_notes'], beat_sheet: ['script.beat_sheet'], visual_plan: ['visual_plan'], full_package: [], single_visual: [],
};

/** Word-overlap similarity ratio (0–1). Used to detect cosmetically-only script changes. */
function scriptSimilarity(a, b) {
  const wordsA = new Set(a.split(/\s+/).filter(Boolean));
  const wordsB = new Set(b.split(/\s+/).filter(Boolean));
  if (!wordsA.size && !wordsB.size) return 1;
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  return intersection / Math.max(wordsA.size, wordsB.size);
}

export async function queueGeneration(env, conversationId) {
  const conversation = await getConversation(env, conversationId, { includeMessages: false });
  if (!conversation) throw httpError(404, 'Conversation not found.');
  if (!conversation.ready_to_generate) throw httpError(409, 'Approve the plan in the conversation before generating.');
  const jobId = id('generate');
  await setJob(env, jobId, { type: 'generate_package', state: 'queued', conversation_id: conversationId, created_at: nowIso(), payload: { conversation_id: conversationId } });
  await env.AGENT_QUEUE.send({ type: 'generate_package', job_id: jobId, conversation_id: conversationId });
  await import('./db.js').then(({ updateConversation }) => updateConversation(env, conversationId, { generation_job_id: jobId }));
  return jobId;
}

export async function generateContentPackageJob(env, job) {
  await setJob(env, job.job_id, { ...(await getJob(env, job.job_id)), type: 'generate_package', state: 'running', started_at: nowIso(), progress: 'Building memory and source context' });
  const conversation = await getConversation(env, job.conversation_id, { includeMessages: false });
  if (!conversation) throw new Error('Conversation no longer exists.');
  if (!conversation.ready_to_generate) throw new Error('Conversation plan is not approved.');
  const context = await buildConversationContext(env, conversation.id, `${conversation.decision_snapshot.topic}\n${conversation.decision_snapshot.core_message}`);
  const creatorMemory = context.creator_memory;
  const models = getModels(env);

  await setJob(env, job.job_id, { ...(await getJob(env, job.job_id)), progress: 'Running the approved research mode' });
  let research;
  try { research = await runResearch(env, { conversationId: conversation.id, plan: conversation.decision_snapshot, creatorMemory, jobId: job.job_id }); }
  catch (error) { research = { status: 'failed', sources: [], claims: [], note: `Research failed: ${error.message}` }; }

  await setJob(env, job.job_id, { ...(await getJob(env, job.job_id)), progress: 'Writing the production package' });
  const packageSystem = `You are the final writer, content director, and production planner for a creator-led video.
Use the approved decision snapshot, creator memory, chat memory, pins, relevant source chunks, and approved performance learnings as constraints.

Quality rules:
- Write for natural speech, not an essay. Match requested language, creator voice, duration, and format.
- Give 3-5 hook options and select the strongest one.
- Talking head is the default when appropriate. Use B-roll, uploaded assets, text overlays, or generated images only when each has a clear purpose.
- image_count must equal the number of generated_image shots and may be zero.
- Every generated-image prompt must be self-contained and include the agreed aspect ratio.
- Never fabricate citations, statistics, quotations, studies, or source content.
- A factual claim must reference a retrieved source/research source, be clearly labelled opinion, or be marked needs_verification/uncertain in claim_ledger.
- Use source references exactly as supplied, such as attachment:... or research:....
- Live web research occurred only when the research object says status=completed.
- Include practical delivery notes and a timed beat sheet.
Return structured JSON only.`;

  let contentPackage = await runStructured(env, models.chat, packageSystem, JSON.stringify({
    creator_memory: creatorMemory, approved_plan: conversation.decision_snapshot, conversation_summary: context.conversation_summary,
    pinned_notes: context.pinned_notes, recent_messages: context.recent_messages, relevant_sources: context.relevant_sources,
    approved_performance_learnings: context.performance_learnings,
    research: { ...research, sources: (research.sources || []).map(source => ({ ref: `research:${source.id}`, title: source.title, url: source.url, domain: source.domain, published_at: source.published_at, excerpt: source.excerpt })), claims: research.claims || [] },
  }), PACKAGE_SCHEMA, { max_tokens: 8500, temperature: 0.42 }, { task: 'final_package', conversation_id: conversation.id, job_id: job.job_id });
  contentPackage = normalizePackage(contentPackage, conversation.decision_snapshot, env);

  await setJob(env, job.job_id, { ...(await getJob(env, job.job_id)), progress: 'Running independent quality review' });
  let review = await reviewPackage(env, { creatorMemory, plan: conversation.decision_snapshot, contentPackage, context, research, conversationId: conversation.id, jobId: job.job_id });
  if (!review.approved && review.issues.some(issue => ['major', 'critical'].includes(issue.severity))) {
    await setJob(env, job.job_id, { ...(await getJob(env, job.job_id)), progress: 'Applying one evidence-aware quality revision' });
    contentPackage = await runStructured(env, models.chat,
      'Revise the complete package using the critic instructions. Preserve the approved plan and creator voice. Fix every major and critical issue. Do not add unsupported facts. Keep source references valid. Return the complete package JSON only.',
      JSON.stringify({ current_package: contentPackage, review, creator_memory: creatorMemory, approved_plan: conversation.decision_snapshot, relevant_sources: context.relevant_sources, research }),
      PACKAGE_SCHEMA, { max_tokens: 8500, temperature: 0.28 }, { task: 'package_revision', conversation_id: conversation.id, job_id: job.job_id });
    contentPackage = normalizePackage(contentPackage, conversation.decision_snapshot, env);
    review = await reviewPackage(env, { creatorMemory, plan: conversation.decision_snapshot, contentPackage, context, research, conversationId: conversation.id, jobId: job.job_id });
  }

  const packageId = id('pkg');
  const prefix = `packages/${conversation.id}/${packageId}/`;
  await setJob(env, job.job_id, { ...(await getJob(env, job.job_id)), progress: 'Generating only approved visual assets' });
  const imageAssets = await generatePackageImages(env, models, contentPackage, prefix, conversation.id, packageId, job.job_id);
  let ttsAsset = null;
  if (contentPackage.tts_requested && env.SARVAM_API_KEY) {
    try { ttsAsset = await generateOptionalTts(env, contentPackage.script.spoken_script, `${prefix}audio/narration.mp3`, contentPackage.final_brief.language); }
    catch (error) { review.issues.push({ severity: 'minor', area: 'tts', problem: error.message, fix: 'Use your own recorded voice or retry TTS.' }); }
  }

  const stored = await storePackageVersion(env, {
    packageId, conversationId: conversation.id, parentPackageId: conversation.active_package_id, changeType: 'full_generation', changeInstruction: null,
    plan: conversation.decision_snapshot, contentPackage, review, prefix, imageAssets, ttsAsset, lockedPaths: [], userEditedPaths: [], research,
  });
  await insertMessage(env, conversation.id, 'assistant', `Production package v${stored.version_number} is ready. It used the approved plan, per-chat memory, relevant sources, and only the justified visual assets.`, { package_id: stored.id, package_version: stored.version_number });
  await setJob(env, job.job_id, { ...(await getJob(env, job.job_id)), state: 'completed', completed_at: nowIso(), progress: 'Completed', result: { package_id: stored.id, version_number: stored.version_number } });

  // Optional webhook notification.
  await firePackageWebhook(env, { job_id: job.job_id, package_id: stored.id, version_number: stored.version_number, conversation_id: conversation.id, change_type: 'full_generation' });
}

async function reviewPackage(env, { creatorMemory, plan, contentPackage, context, research, conversationId, jobId }) {
  const models = getModels(env);
  try {
    return await runStructured(env, models.critic,
      `You are an independent editorial and evidence critic. Check natural speech, duration plausibility, message clarity, factual restraint, source alignment, creator-memory compliance, hook strength, talking-head practicality, excessive visuals, and whether the package follows the approved plan. Unsupported numbers or quotations are major issues. Invalid source references are major issues. Major or critical issues require approved=false. Return JSON only.`,
      JSON.stringify({ creator_memory: creatorMemory, approved_plan: plan, package: contentPackage, relevant_sources: context.relevant_sources, research }),
      REVIEW_SCHEMA, { max_tokens: 3000, temperature: 0.12 }, { task: 'package_review', conversation_id: conversationId, job_id: jobId });
  } catch (error) {
    return { approved: true, score: 72, strengths: ['Package generation completed.'], issues: [{ severity: 'minor', area: 'review', problem: `Automated critic unavailable: ${error.message}`, fix: 'Review manually before publishing.' }], revision_instructions: 'Manual review recommended.' };
  }
}

async function storePackageVersion(env, { packageId, conversationId, parentPackageId, changeType, changeInstruction, plan, contentPackage, review, prefix, imageAssets = [], ttsAsset = null, lockedPaths = [], userEditedPaths = [], research = null }) {
  const manifestKey = `${prefix}manifest.json`;
  const scriptKey = `${prefix}script.txt`;
  const shotListKey = `${prefix}shot-list.json`;
  const manifest = { schema_version: '4.0', package_id: packageId, conversation_id: conversationId, created_at: nowIso(), models: getModels(env), approved_plan: plan, package: contentPackage, review, assets: { images: imageAssets, tts: ttsAsset }, research };
  await env.CONTENT_BUCKET.put(manifestKey, JSON.stringify(manifest, null, 2), { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
  await env.CONTENT_BUCKET.put(scriptKey, buildScriptDownload(contentPackage), { httpMetadata: { contentType: 'text/plain; charset=utf-8' } });
  await env.CONTENT_BUCKET.put(shotListKey, JSON.stringify(contentPackage.visual_plan, null, 2), { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
  const assets = imageAssets.map(asset => ({ id: id('asset'), asset_type: 'image', shot_id: asset.shot_id, key: asset.key, status: asset.status, metadata: { error: asset.error || null, width: asset.width, height: asset.height } }));
  if (ttsAsset) assets.push({ id: id('asset'), asset_type: 'tts', key: ttsAsset.key, status: 'generated', metadata: { content_type: ttsAsset.content_type } });
  return createPackage(env, { id: packageId, conversation_id: conversationId, parent_package_id: parentPackageId || null, change_type: changeType, change_instruction: changeInstruction, plan, package: contentPackage, review, locked_paths: lockedPaths, user_edited_paths: userEditedPaths, manifest_r2_key: manifestKey, script_r2_key: scriptKey, shot_list_r2_key: shotListKey, research, assets });
}

export async function queueRegeneration(env, packageId, body) {
  const packageRecord = await getPackage(env, packageId);
  if (!packageRecord) throw httpError(404, 'Package not found.');

  const rawTargets = Array.isArray(body.targets) && body.targets.length
    ? body.targets.map(cleanText)
    : [cleanText(body.target)];

  const validTargets = [...Object.keys(TARGET_SCHEMAS), 'full_package', 'single_visual'];
  for (const t of rawTargets) {
    if (!validTargets.includes(t)) throw httpError(400, `Unsupported regeneration target: ${t}`);
    assertTargetUnlocked(packageRecord, t);
  }

  const targets = rawTargets.includes('full_package') ? ['full_package'] : [...new Set(rawTargets)];

  // Fetch latest feedback for this package to seed regeneration context.
  const latestFeedback = await getLatestFeedback(env, packageId);

  const jobId = id('regenerate');
  await setJob(env, jobId, { type: 'regenerate_package_section', state: 'queued', conversation_id: packageRecord.conversation_id, created_at: nowIso(), payload: { package_id: packageId, targets, instruction: cleanText(body.instruction), shot_id: cleanText(body.shot_id), latest_feedback: latestFeedback } });
  await env.AGENT_QUEUE.send({ type: 'regenerate_package_section', job_id: jobId, package_id: packageId, targets, instruction: cleanText(body.instruction), shot_id: cleanText(body.shot_id), latest_feedback: latestFeedback });
  return jobId;
}

export async function regeneratePackageJob(env, job) {
  const targets = Array.isArray(job.targets) && job.targets.length ? job.targets : [job.target];
  const targetsLabel = targets.join(', ');

  await setJob(env, job.job_id, { ...(await getJob(env, job.job_id)), state: 'running', started_at: nowIso(), progress: `Regenerating ${targetsLabel}` });
  const parent = await getPackage(env, job.package_id);
  if (!parent) throw new Error('Parent package not found.');
  for (const t of targets) assertTargetUnlocked(parent, t);
  const context = await buildConversationContext(env, parent.conversation_id, `${parent.package.final_brief?.topic || ''}\n${job.instruction || ''}`);
  const models = getModels(env);
  let nextPackage = structuredClone(parent.package);
  let imageAssets = parent.assets.images.map(asset => ({ shot_id: asset.shot_id, key: asset.key, status: asset.status, width: asset.width, height: asset.height, error: asset.error }));
  const ttsAsset = parent.assets.tts ? { key: parent.assets.tts.key, content_type: parent.assets.tts.content_type || 'audio/mpeg' } : null;

  const singleTarget = targets[0];
  if (singleTarget === 'full_package') {
    job.target = 'full_package';
    nextPackage = await runStructured(env, models.chat, 'Regenerate the complete production package according to the instruction. Preserve creator memory, approved plan, locked fields, factual cautions, and valid source references. Return JSON only.', JSON.stringify({ instruction: job.instruction, parent_package: parent.package, approved_plan: parent.approved_plan, context, latest_feedback: job.latest_feedback || null }), PACKAGE_SCHEMA, { max_tokens: 8500, temperature: 0.38 }, { task: 'regenerate_full', conversation_id: parent.conversation_id, package_id: parent.id, job_id: job.job_id });
    nextPackage = normalizePackage(nextPackage, parent.approved_plan, env);
    preserveLocks(parent.package, nextPackage, parent.locked_paths);
    imageAssets = await generatePackageImages(env, models, nextPackage, `packages/${parent.conversation_id}/${job.job_id}/`, parent.conversation_id, job.job_id, job.job_id);
  } else if (singleTarget === 'single_visual') {
    const shot = nextPackage.visual_plan?.shots?.find(item => item.id === job.shot_id);
    if (!shot) throw new Error('Shot not found.');
    const generated = await generateSingleImage(env, models, shot, nextPackage.visual_plan.aspect_ratio, `packages/${parent.conversation_id}/${job.job_id}/images/${safeFilename(shot.id)}.jpg`, parent.conversation_id, parent.id, job.job_id);
    imageAssets = imageAssets.filter(asset => asset.shot_id !== shot.id).concat(generated);
  } else {
    let visualPlanRegenerated = false;
    const completedTargets = [];

    for (const currentTarget of targets) {
      await setJob(env, job.job_id, { ...(await getJob(env, job.job_id)), progress: `Regenerating ${currentTarget} (${targets.indexOf(currentTarget) + 1}/${targets.length})` });
      const schema = TARGET_SCHEMAS[currentTarget];
      const isSpokenScript = currentTarget === 'spoken_script';

      // Build a note about which targets have already been updated in this pass.
      const batchNote = completedTargets.length
        ? `Previously updated in this pass: ${completedTargets.join(', ')}. The parent_package reflects those changes.`
        : '';

      const regenerationSystem = isSpokenScript
        ? `You are revising only the spoken narration of a creator-led video.

Requirements:
- Produce a materially revised spoken script.
- Follow the user's revision instruction precisely.
- Do not copy the previous narration with only cosmetic edits.
- Preserve the approved topic, core message, factual accuracy, creator voice, language, platform, and target duration.
- Write for natural speech, not as an article.
- Keep the existing hook, caption, CTA, delivery notes, beat sheet, visual plan, and all other package fields unchanged.
- Return only the fields required by the JSON schema.
- The new spoken_script must be meaningfully different from the previous spoken_script.`
        : `Regenerate only the requested package section.
Follow the user instruction, creator memory, approved plan, package context, and source cautions.
Do not rewrite unrelated fields.${batchNote ? '\n' + batchNote : ''}
Return JSON only.`;

      const regenerationInput = isSpokenScript
        ? {
            target: currentTarget,
            instruction: job.instruction || 'Rewrite the spoken script to improve clarity, naturalness, pacing, and impact.',
            previous_spoken_script: parent.package.script?.spoken_script || '',
            target_duration_seconds: parent.approved_plan?.duration_seconds,
            language: parent.approved_plan?.language,
            tone: parent.approved_plan?.tone,
            format: parent.approved_plan?.format,
            approved_plan: parent.approved_plan,
            creator_memory: context.creator_memory,
            conversation_summary: context.conversation_summary,
            pinned_notes: context.pinned_notes,
            relevant_sources: context.relevant_sources,
            latest_feedback: job.latest_feedback || null,
          }
        : {
            target: currentTarget,
            instruction: job.instruction,
            parent_package: nextPackage,
            approved_plan: parent.approved_plan,
            context,
            // Include research claims so the model doesn't drop sourced facts when
            // regenerating captions, beat sheets, etc.
            research_claims: parent.research?.claims || [],
            latest_feedback: job.latest_feedback || null,
          };

      const result = await runStructured(
        env,
        models.chat,
        regenerationSystem,
        JSON.stringify(regenerationInput),
        schema,
        {
          max_tokens: currentTarget === 'spoken_script' ? 4200 : currentTarget === 'visual_plan' ? 5000 : 1800,
          temperature: currentTarget === 'spoken_script' ? 0.5 : 0.35,
        },
        { task: `regenerate_${currentTarget}`, conversation_id: parent.conversation_id, package_id: parent.id, job_id: job.job_id },
      );
      applyTarget(nextPackage, currentTarget, result);
      completedTargets.push(currentTarget);

      if (currentTarget === 'spoken_script') {
        const previousScript = normalizeText(parent.package.script?.spoken_script || '');
        const regeneratedScript = normalizeText(nextPackage.script?.spoken_script || '');
        // Use word-overlap similarity: retry if >82% of words are the same.
        const tooSimilar = !regeneratedScript || scriptSimilarity(previousScript, regeneratedScript) > 0.82;
        if (tooSimilar) {
          const retryResult = await runStructured(
            env,
            models.chat,
            `Rewrite the spoken narration again.

The previous attempt was unchanged and is invalid.

Requirements:
- Make substantial changes to wording, sentence structure, transitions, pacing, and delivery.
- Follow the user's instruction exactly.
- Preserve factual meaning and the approved plan.
- Do not return the previous narration.
- Return only the JSON schema fields.`,
            JSON.stringify({
              instruction: job.instruction || 'Create a meaningfully improved alternative version.',
              previous_spoken_script: parent.package.script?.spoken_script || '',
              approved_plan: parent.approved_plan,
              creator_memory: context.creator_memory,
              relevant_sources: context.relevant_sources,
            }),
            TARGET_SCHEMAS.spoken_script,
            { max_tokens: 4200, temperature: 0.65 },
            { task: 'regenerate_spoken_script_retry', conversation_id: parent.conversation_id, package_id: parent.id, job_id: job.job_id },
          );
          applyTarget(nextPackage, 'spoken_script', retryResult);
        }
      }

      if (currentTarget === 'visual_plan') visualPlanRegenerated = true;
    }

    preserveLocks(parent.package, nextPackage, parent.locked_paths);
    nextPackage = normalizePackage(nextPackage, parent.approved_plan, env);
    if (visualPlanRegenerated) imageAssets = await generatePackageImages(env, models, nextPackage, `packages/${parent.conversation_id}/${job.job_id}/`, parent.conversation_id, parent.id, job.job_id);
  }

  const review = await reviewPackage(env, { creatorMemory: context.creator_memory, plan: parent.approved_plan, contentPackage: nextPackage, context, research: null, conversationId: parent.conversation_id, jobId: job.job_id });
  const packageId = id('pkg');
  const prefix = `packages/${parent.conversation_id}/${packageId}/`;
  const changeLabel = targets.join('+');
  const stored = await storePackageVersion(env, { packageId, conversationId: parent.conversation_id, parentPackageId: parent.id, changeType: `regenerate_${changeLabel}`, changeInstruction: job.instruction, plan: parent.approved_plan, contentPackage: nextPackage, review, prefix, imageAssets, ttsAsset, lockedPaths: parent.locked_paths, userEditedPaths: parent.user_edited_paths, research: parent.research });
  const sectionsLabel = targets.map(t => t.replace(/_/g, ' ')).join(', ');
  await insertMessage(env, parent.conversation_id, 'assistant', `Created package v${stored.version_number} by regenerating ${sectionsLabel}.`, { package_id: stored.id, package_version: stored.version_number });
  await setJob(env, job.job_id, { ...(await getJob(env, job.job_id)), state: 'completed', completed_at: nowIso(), progress: 'Completed', result: { package_id: stored.id, version_number: stored.version_number } });

  await firePackageWebhook(env, { job_id: job.job_id, package_id: stored.id, version_number: stored.version_number, conversation_id: parent.conversation_id, change_type: `regenerate_${changeLabel}` });
}

function applyTarget(pkg, target, result) {
  if (target === 'hook') { pkg.hook_options = result.hook_options; pkg.selected_hook = result.selected_hook; }
  else if (target === 'spoken_script') {
    pkg.script ||= {};
    pkg.script.spoken_script = cleanText(result.spoken_script);
    if (Number.isFinite(Number(result.estimated_duration_seconds))) {
      pkg.script.estimated_duration_seconds = Number(result.estimated_duration_seconds);
    }
  }
  else if (target === 'caption') pkg.post_copy.caption = result.caption;
  else if (target === 'hashtags') pkg.post_copy.hashtags = result.hashtags;
  else if (target === 'cta') pkg.post_copy.cta = result.cta;
  else if (target === 'delivery_notes') pkg.script.delivery_notes = result.delivery_notes;
  else if (target === 'beat_sheet') pkg.script.beat_sheet = result.beat_sheet;
  else if (target === 'visual_plan') pkg.visual_plan = result.visual_plan;
}

function assertTargetUnlocked(packageRecord, target) {
  const paths = TARGET_PATHS[target] || [];
  const blocked = paths.find(path => packageRecord.locked_paths.some(locked => path === locked || path.startsWith(`${locked}.`) || locked.startsWith(`${path}.`)));
  if (blocked) throw httpError(409, `${blocked} is locked. Unlock it before regenerating this section.`);
}

function preserveLocks(original, next, lockedPaths) {
  for (const path of lockedPaths || []) setPath(next, path, getPath(original, path));
}

export async function editPackage(env, packageId, body) {
  const parent = await getPackage(env, packageId);
  if (!parent) throw httpError(404, 'Package not found.');
  const next = structuredClone(body.package || parent.package);
  preserveLocks(parent.package, next, parent.locked_paths);
  const changedPaths = normalizeStringArray(body.changed_paths, 50, 200);
  const newId = id('pkg');
  return storePackageVersion(env, { packageId: newId, conversationId: parent.conversation_id, parentPackageId: parent.id, changeType: 'manual_edit', changeInstruction: cleanText(body.note), plan: parent.approved_plan, contentPackage: normalizePackage(next, parent.approved_plan, env), review: parent.review, prefix: `packages/${parent.conversation_id}/${newId}/`, imageAssets: parent.assets.images.map(asset => ({ shot_id: asset.shot_id, key: asset.key, status: asset.status, width: asset.width, height: asset.height })), ttsAsset: parent.assets.tts ? { key: parent.assets.tts.key, content_type: parent.assets.tts.content_type } : null, lockedPaths: parent.locked_paths, userEditedPaths: [...new Set([...(parent.user_edited_paths || []), ...changedPaths])], research: parent.research });
}

export async function setPackageLocks(env, packageId, paths) {
  const pkg = await getPackage(env, packageId);
  if (!pkg) throw httpError(404, 'Package not found.');
  return updatePackage(env, packageId, { locked_paths: normalizeStringArray(paths, 80, 200) });
}

export async function restorePackage(env, conversationId, packageId) {
  return setActivePackage(env, conversationId, packageId);
}

export async function saveFeedback(env, packageId, body) {
  const feedback = await insertFeedback(env, { package_id: packageId, ratings: body.ratings || {}, liked: body.liked, change_requested: body.change_requested });
  const packageRecord = await getPackage(env, packageId);
  const models = getModels(env);
  try {
    const result = await runStructured(env, models.fast,
      'Extract only durable creator preference suggestions from explicit package feedback. Do not infer a global preference from weak evidence. Suggestions are proposals requiring user approval. Return JSON only.',
      JSON.stringify({ package: { selected_hook: packageRecord.package.selected_hook, format: packageRecord.package.final_brief?.format, language: packageRecord.package.final_brief?.language }, feedback }),
      MEMORY_SUGGESTION_SCHEMA, { max_tokens: 1400, temperature: 0.1 }, { task: 'feedback_preference_extraction', conversation_id: packageRecord.conversation_id, package_id: packageId });
    for (const suggestion of result.suggestions || []) await insertMemorySuggestion(env, { source_type: 'feedback', source_id: feedback.id, ...suggestion });
  } catch (error) { console.warn('[feedback-suggestions]', error.message); }
  return feedback;
}

export async function markPublished(env, packageId, body) {
  const packageRecord = await getPackage(env, packageId);
  if (!packageRecord) throw httpError(404, 'Package not found.');
  if (!cleanText(body.permalink) && !cleanText(body.platform_media_id)) throw httpError(400, 'Provide an Instagram permalink or platform media ID.');
  return createPublication(env, { package_id: packageId, platform: body.platform || 'instagram', permalink: body.permalink, platform_media_id: body.platform_media_id, published_at: body.published_at, actual_duration_seconds: body.actual_duration_seconds, hook_used: body.hook_used || packageRecord.package.selected_hook, actual_changes: body.actual_changes, metadata: body.metadata || {} });
}

function normalizePackage(pkg, plan, env) {
  const output = pkg && typeof pkg === 'object' ? pkg : {};
  output.final_brief = { ...(output.final_brief || {}), topic: plan.topic, core_message: plan.core_message, audience: plan.audience, platform: plan.platform, duration_seconds: plan.duration_seconds, aspect_ratio: plan.aspect_ratio, format: plan.format, language: plan.language, tone: plan.tone };
  output.hook_options = normalizeStringArray(output.hook_options, 5, 1000);
  output.selected_hook = cleanText(output.selected_hook || output.hook_options[0]);
  output.script ||= { title: output.package_title || plan.topic, estimated_duration_seconds: plan.duration_seconds, spoken_script: '', delivery_notes: [], beat_sheet: [] };
  output.post_copy ||= { caption: '', hashtags: [], cta: plan.cta || '', thumbnail_text_options: [] };
  output.claim_ledger = Array.isArray(output.claim_ledger) ? output.claim_ledger : [];
  output.visual_plan ||= { strategy: plan.visual_strategy, requires_generated_images: false, image_count: 0, aspect_ratio: plan.aspect_ratio, shots: [] };
  output.visual_plan.aspect_ratio = plan.aspect_ratio;
  output.visual_plan.shots = Array.isArray(output.visual_plan.shots) ? output.visual_plan.shots : [];
  output.visual_plan.shots = output.visual_plan.shots.map((shot, index) => ({ ...shot, id: cleanText(shot.id) || `shot-${index + 1}`, source_refs: normalizeStringArray(shot.source_refs, 8, 300) }));
  const cap = intEnv(env, 'MAX_GENERATED_IMAGES', 8);
  const approvedImageCount = Math.min(cap, clampInt(plan.image_count, 0, cap, 0));
  let kept = 0;
  output.visual_plan.shots = output.visual_plan.shots.map(shot => {
    if (shot.type !== 'generated_image') return shot;
    kept += 1;
    return kept <= approvedImageCount ? shot : { ...shot, type: 'broll', image_prompt: '' };
  });
  output.visual_plan.image_count = output.visual_plan.shots.filter(shot => shot.type === 'generated_image').length;
  output.visual_plan.requires_generated_images = output.visual_plan.image_count > 0;
  output.tts_requested = Boolean(plan.tts_required);
  return output;
}

async function generatePackageImages(env, models, contentPackage, prefix, conversationId, packageId, jobId) {
  const shots = contentPackage.visual_plan.shots.filter(shot => shot.type === 'generated_image');
  const assets = [];
  for (let index = 0; index < shots.length; index += 1) {
    const shot = shots[index];
    const key = `${prefix}images/${String(index + 1).padStart(2, '0')}-${safeFilename(shot.id || 'visual')}.jpg`;
    assets.push(await generateSingleImage(env, models, shot, contentPackage.visual_plan.aspect_ratio, key, conversationId, packageId, jobId));
  }
  return assets;
}

async function generateSingleImage(env, models, shot, aspectRatio, key, conversationId, packageId, jobId) {
  const dimensions = dimensionsForAspectRatio(aspectRatio);
  try {
    const result = await runModel(env, models.image, {
      prompt: `${shot.image_prompt}\nAspect ratio: ${aspectRatio}. No watermark. No accidental text unless explicitly requested.`,
      width: dimensions.width,
      height: dimensions.height,
      num_steps: intEnv(env, 'IMAGE_STEPS', 28),
      guidance: 5,
    }, { task: 'image_generation', conversation_id: conversationId, package_id: packageId, job_id: jobId });
    const bytes = await normalizeImageResponse(result);
    await env.CONTENT_BUCKET.put(key, bytes, { httpMetadata: { contentType: 'image/jpeg' } });
    return { shot_id: shot.id, key, status: 'generated', width: dimensions.width, height: dimensions.height };
  } catch (error) {
    return { shot_id: shot.id, key: null, status: 'failed', error: error.message, width: dimensions.width, height: dimensions.height };
  }
}

async function normalizeImageResponse(result) {
  if (typeof ReadableStream !== 'undefined' && result instanceof ReadableStream) {
    return new Uint8Array(await new Response(result).arrayBuffer());
  }
  if (typeof Response !== 'undefined' && result instanceof Response) {
    return new Uint8Array(await result.arrayBuffer());
  }
  if (result instanceof ArrayBuffer) return new Uint8Array(result);
  if (ArrayBuffer.isView(result)) return new Uint8Array(result.buffer, result.byteOffset, result.byteLength);
  const nested = result?.result ?? result?.response ?? result;
  if (nested instanceof ArrayBuffer) return new Uint8Array(nested);
  if (ArrayBuffer.isView(nested)) return new Uint8Array(nested.buffer, nested.byteOffset, nested.byteLength);
  const base64 = result?.image || result?.result?.image || result?.response?.image || result?.data?.image;
  if (typeof base64 === 'string') {
    const payload = base64.includes(',') ? base64.slice(base64.indexOf(',') + 1) : base64;
    return new Uint8Array(Buffer.from(payload, 'base64'));
  }
  throw new Error('Image model returned an unsupported response shape.');
}

function dimensionsForAspectRatio(value) {
  const ratio = String(value || '9:16').replace(/\s/g, '');
  return ({ '9:16': { width: 720, height: 1280 }, '16:9': { width: 1280, height: 720 }, '1:1': { width: 1024, height: 1024 }, '4:5': { width: 1024, height: 1280 }, '3:4': { width: 960, height: 1280 } })[ratio] || { width: 720, height: 1280 };
}

async function generateOptionalTts(env, text, key, language) {
  const response = await fetch(SARVAM_TTS_STREAM_URL, { method: 'POST', headers: { 'api-subscription-key': env.SARVAM_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ text, target_language_code: sarvamLanguageCode(language), speaker: env.TTS_SPEAKER || 'aditya', model: 'bulbul:v3', pace: numberEnv(env, 'TTS_PACE', 1), temperature: numberEnv(env, 'TTS_TEMPERATURE', 0.75), output_audio_codec: 'mp3' }) });
  if (!response.ok) throw new Error(`TTS failed (${response.status}): ${await response.text()}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  await env.CONTENT_BUCKET.put(key, bytes, { httpMetadata: { contentType: 'audio/mpeg' } });
  return { key, content_type: 'audio/mpeg' };
}

function sarvamLanguageCode(language) {
  const value = normalizeText(language);
  if (value.includes('english')) return 'en-IN';
  if (value.includes('marathi')) return 'mr-IN';
  if (value.includes('bengali') || value.includes('bangla')) return 'bn-IN';
  if (value.includes('tamil')) return 'ta-IN';
  if (value.includes('telugu')) return 'te-IN';
  if (value.includes('gujarati')) return 'gu-IN';
  if (value.includes('kannada')) return 'kn-IN';
  if (value.includes('malayalam')) return 'ml-IN';
  if (value.includes('punjabi')) return 'pa-IN';
  return 'hi-IN';
}

function buildScriptDownload(pkg) {
  const beats = (pkg.script.beat_sheet || []).map(beat => `[${beat.start_second}-${beat.end_second}s] ${beat.purpose}\n${beat.spoken_point}\nDirection: ${beat.screen_direction}`).join('\n\n');
  const claims = (pkg.claim_ledger || []).map(item => `- [${item.status}] ${item.claim}${item.source_refs?.length ? ` (${item.source_refs.join(', ')})` : ''}${item.caveat ? ` — ${item.caveat}` : ''}`).join('\n');
  return `${pkg.package_title}\n\nSELECTED HOOK\n${pkg.selected_hook}\n\nSCRIPT\n${pkg.script.spoken_script}\n\nDELIVERY NOTES\n- ${(pkg.script.delivery_notes || []).join('\n- ')}\n\nBEAT SHEET\n${beats}\n\nCAPTION\n${pkg.post_copy.caption}\n\n${(pkg.post_copy.hashtags || []).join(' ')}\n\nCTA\n${pkg.post_copy.cta}\n\nCLAIM LEDGER\n${claims || 'No claim ledger entries.'}\n`;
}

/** Fire an optional webhook after package completion. No-throw: errors are logged and swallowed. */
async function firePackageWebhook(env, payload) {
  if (!env.PACKAGE_WEBHOOK_URL) return;
  try {
    await fetch(env.PACKAGE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'package.completed', ...payload, fired_at: nowIso() }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (error) {
    console.warn('[webhook]', error.message);
  }
}
