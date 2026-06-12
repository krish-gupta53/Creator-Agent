export const PLAN_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    assistant_message: { type: 'string' },
    stage: { type: 'string', enum: ['discovery', 'planning', 'awaiting_approval', 'approved'] },
    options: { type: 'array', maxItems: 6, items: { type: 'object', additionalProperties: false, properties: { label: { type: 'string' }, value: { type: 'string' }, description: { type: 'string' } }, required: ['label', 'value', 'description'] } },
    decision_snapshot: {
      type: 'object', additionalProperties: false,
      properties: {
        topic: { type: 'string' }, core_message: { type: 'string' }, objective: { type: 'string' }, audience: { type: 'string' },
        platform: { type: 'string' }, language: { type: 'string' }, tone: { type: 'string' },
        duration_seconds: { type: 'integer', minimum: 0, maximum: 1800 }, aspect_ratio: { type: 'string' }, format: { type: 'string' },
        research_depth: { type: 'string' }, research_mode: { type: 'string', enum: ['none', 'uploaded_sources_only', 'quick_verification', 'deep_research'] },
        visual_strategy: { type: 'string' }, image_count: { type: 'integer', minimum: 0, maximum: 20 }, tts_required: { type: 'boolean' }, cta: { type: 'string' },
      },
      required: ['topic', 'core_message', 'objective', 'audience', 'platform', 'language', 'tone', 'duration_seconds', 'aspect_ratio', 'format', 'research_depth', 'research_mode', 'visual_strategy', 'image_count', 'tts_required', 'cta'],
    },
    missing_decisions: { type: 'array', maxItems: 8, items: { type: 'string' } },
    ready_to_generate: { type: 'boolean' },
    suggested_action: { type: 'string', enum: ['answer_question', 'choose_option', 'approve_plan', 'generate'] },
  },
  required: ['assistant_message', 'stage', 'options', 'decision_snapshot', 'missing_decisions', 'ready_to_generate', 'suggested_action'],
};

export const CONVERSATION_SUMMARY_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    original_intent: { type: 'string' },
    important_context: { type: 'array', items: { type: 'string' } },
    creator_statements: { type: 'array', items: { type: 'string' } },
    agreed_points: { type: 'array', items: { type: 'string' } },
    rejected_approaches: { type: 'array', items: { type: 'string' } },
    examples_the_creator_liked: { type: 'array', items: { type: 'string' } },
    examples_the_creator_disliked: { type: 'array', items: { type: 'string' } },
    factual_claims: { type: 'array', items: { type: 'string' } },
    source_notes: { type: 'array', items: { type: 'string' } },
    uncertainties: { type: 'array', items: { type: 'string' } },
    open_questions: { type: 'array', items: { type: 'string' } },
    creative_direction: { type: 'string' },
    message_ids_used: { type: 'array', items: { type: 'string' } },
  },
  required: ['original_intent', 'important_context', 'creator_statements', 'agreed_points', 'rejected_approaches', 'examples_the_creator_liked', 'examples_the_creator_disliked', 'factual_claims', 'source_notes', 'uncertainties', 'open_questions', 'creative_direction', 'message_ids_used'],
};

export const PACKAGE_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    package_title: { type: 'string' }, creative_rationale: { type: 'string' },
    final_brief: { type: 'object', additionalProperties: true, properties: { topic: { type: 'string' }, core_message: { type: 'string' }, audience: { type: 'string' }, platform: { type: 'string' }, duration_seconds: { type: 'integer' }, aspect_ratio: { type: 'string' }, format: { type: 'string' }, language: { type: 'string' }, tone: { type: 'string' } }, required: ['topic', 'core_message', 'audience', 'platform', 'duration_seconds', 'aspect_ratio', 'format', 'language', 'tone'] },
    hook_options: { type: 'array', minItems: 3, maxItems: 5, items: { type: 'string' } }, selected_hook: { type: 'string' },
    script: {
      type: 'object', additionalProperties: false,
      properties: {
        title: { type: 'string' }, estimated_duration_seconds: { type: 'integer', minimum: 5, maximum: 1800 }, spoken_script: { type: 'string' },
        delivery_notes: { type: 'array', items: { type: 'string' } },
        beat_sheet: { type: 'array', minItems: 3, maxItems: 24, items: { type: 'object', additionalProperties: false, properties: { start_second: { type: 'integer', minimum: 0 }, end_second: { type: 'integer', minimum: 1 }, purpose: { type: 'string' }, spoken_point: { type: 'string' }, screen_direction: { type: 'string' } }, required: ['start_second', 'end_second', 'purpose', 'spoken_point', 'screen_direction'] } },
      }, required: ['title', 'estimated_duration_seconds', 'spoken_script', 'delivery_notes', 'beat_sheet'],
    },
    visual_plan: {
      type: 'object', additionalProperties: false,
      properties: {
        strategy: { type: 'string' }, requires_generated_images: { type: 'boolean' }, image_count: { type: 'integer', minimum: 0, maximum: 20 }, aspect_ratio: { type: 'string' },
        shots: { type: 'array', minItems: 1, maxItems: 30, items: { type: 'object', additionalProperties: false, properties: { id: { type: 'string' }, type: { type: 'string', enum: ['talking_head', 'broll', 'generated_image', 'uploaded_asset', 'text_overlay', 'screen_recording', 'none'] }, start_second: { type: 'integer', minimum: 0 }, end_second: { type: 'integer', minimum: 1 }, description: { type: 'string' }, purpose: { type: 'string' }, image_prompt: { type: 'string' }, on_screen_text: { type: 'string' }, source_refs: { type: 'array', items: { type: 'string' } } }, required: ['id', 'type', 'start_second', 'end_second', 'description', 'purpose', 'image_prompt', 'on_screen_text', 'source_refs'] } },
      }, required: ['strategy', 'requires_generated_images', 'image_count', 'aspect_ratio', 'shots'],
    },
    post_copy: { type: 'object', additionalProperties: false, properties: { caption: { type: 'string' }, hashtags: { type: 'array', minItems: 3, maxItems: 15, items: { type: 'string' } }, cta: { type: 'string' }, thumbnail_text_options: { type: 'array', minItems: 2, maxItems: 5, items: { type: 'string' } } }, required: ['caption', 'hashtags', 'cta', 'thumbnail_text_options'] },
    factual_cautions: { type: 'array', items: { type: 'string' } }, source_notes: { type: 'array', items: { type: 'string' } }, claim_ledger: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { claim: { type: 'string' }, status: { type: 'string', enum: ['supported', 'opinion', 'uncertain', 'needs_verification'] }, source_refs: { type: 'array', items: { type: 'string' } }, caveat: { type: 'string' } }, required: ['claim', 'status', 'source_refs', 'caveat'] } },
    tts_requested: { type: 'boolean' },
  },
  required: ['package_title', 'creative_rationale', 'final_brief', 'hook_options', 'selected_hook', 'script', 'visual_plan', 'post_copy', 'factual_cautions', 'source_notes', 'claim_ledger', 'tts_requested'],
};

export const REVIEW_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    approved: { type: 'boolean' }, score: { type: 'integer', minimum: 0, maximum: 100 }, strengths: { type: 'array', items: { type: 'string' } },
    issues: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { severity: { type: 'string', enum: ['minor', 'major', 'critical'] }, area: { type: 'string' }, problem: { type: 'string' }, fix: { type: 'string' } }, required: ['severity', 'area', 'problem', 'fix'] } },
    revision_instructions: { type: 'string' },
  }, required: ['approved', 'score', 'strengths', 'issues', 'revision_instructions'],
};

export const INSIGHTS_ANALYSIS_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: { headline: { type: 'string' }, summary: { type: 'string' }, wins: { type: 'array', minItems: 1, maxItems: 6, items: { type: 'string' } }, improvements: { type: 'array', minItems: 1, maxItems: 6, items: { type: 'string' } }, next_reel_experiments: { type: 'array', minItems: 2, maxItems: 6, items: { type: 'string' } }, metric_notes: { type: 'array', items: { type: 'string' } }, confidence_note: { type: 'string' } },
  required: ['headline', 'summary', 'wins', 'improvements', 'next_reel_experiments', 'metric_notes', 'confidence_note'],
};

export const MEMORY_SUGGESTION_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: { suggestions: { type: 'array', maxItems: 5, items: { type: 'object', additionalProperties: false, properties: { suggestion: { type: 'string' }, evidence: { type: 'array', items: { type: 'string' } }, scope: { type: 'string', enum: ['global', 'content_pillar', 'conversation'] }, target_field: { type: 'string' } }, required: ['suggestion', 'evidence', 'scope', 'target_field'] } } },
  required: ['suggestions'],
};
