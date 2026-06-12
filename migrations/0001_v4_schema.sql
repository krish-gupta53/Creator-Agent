PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS creator_context (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  context_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'discovery',
  ready_to_generate INTEGER NOT NULL DEFAULT 0,
  decision_json TEXT NOT NULL DEFAULT '{}',
  summary_json TEXT,
  missing_decisions_json TEXT NOT NULL DEFAULT '[]',
  last_summarized_sequence INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  message_sequence INTEGER NOT NULL DEFAULT 0,
  package_sequence INTEGER NOT NULL DEFAULT 0,
  generation_job_id TEXT,
  active_package_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS conversations_updated ON conversations(updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sequence_number INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  UNIQUE(conversation_id, sequence_number)
);
CREATE INDEX IF NOT EXISTS messages_by_conversation ON messages(conversation_id, sequence_number);

CREATE TABLE IF NOT EXISTS chat_pins (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS pins_by_conversation ON chat_pins(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  message_id TEXT,
  r2_key TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  status TEXT NOT NULL,
  summary TEXT,
  extraction_method TEXT,
  checksum TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS attachments_by_conversation ON attachments(conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS document_chunks (
  id TEXT PRIMARY KEY,
  attachment_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  chunk_number INTEGER NOT NULL,
  page_start INTEGER,
  page_end INTEGER,
  text TEXT NOT NULL,
  vector_id TEXT,
  token_count INTEGER,
  checksum TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE CASCADE,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  UNIQUE(attachment_id, chunk_number)
);
CREATE INDEX IF NOT EXISTS chunks_by_attachment ON document_chunks(attachment_id, chunk_number);
CREATE INDEX IF NOT EXISTS chunks_by_conversation ON document_chunks(conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS packages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  parent_package_id TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  change_type TEXT NOT NULL DEFAULT 'full_generation',
  change_instruction TEXT,
  plan_json TEXT NOT NULL,
  package_json TEXT NOT NULL,
  review_json TEXT,
  research_json TEXT,
  locked_paths_json TEXT NOT NULL DEFAULT '[]',
  user_edited_paths_json TEXT NOT NULL DEFAULT '[]',
  manifest_r2_key TEXT,
  script_r2_key TEXT,
  shot_list_r2_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_package_id) REFERENCES packages(id) ON DELETE SET NULL,
  UNIQUE(conversation_id, version_number)
);
CREATE INDEX IF NOT EXISTS packages_by_conversation ON packages(conversation_id, version_number DESC);

CREATE TABLE IF NOT EXISTS package_assets (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  shot_id TEXT,
  r2_key TEXT,
  status TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS assets_by_package ON package_assets(package_id, created_at);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  ratings_json TEXT NOT NULL DEFAULT '{}',
  liked TEXT,
  change_requested TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS memory_suggestions (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  suggestion TEXT NOT NULL,
  evidence_json TEXT NOT NULL DEFAULT '[]',
  scope TEXT NOT NULL,
  target_field TEXT,
  status TEXT NOT NULL DEFAULT 'proposed',
  created_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS suggestions_by_status ON memory_suggestions(status, created_at DESC);

CREATE TABLE IF NOT EXISTS publications (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  permalink TEXT,
  platform_media_id TEXT,
  published_at TEXT,
  actual_duration_seconds INTEGER,
  hook_used TEXT,
  actual_changes TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS publications_by_platform ON publications(platform, published_at DESC);

CREATE TABLE IF NOT EXISTS instagram_media (
  media_id TEXT PRIMARY KEY,
  permalink TEXT,
  caption TEXT,
  media_type TEXT,
  timestamp TEXT,
  thumbnail_url TEXT,
  raw_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS instagram_metric_snapshots (
  id TEXT PRIMARY KEY,
  media_id TEXT NOT NULL,
  publication_id TEXT,
  snapshot_label TEXT NOT NULL,
  metrics_json TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  FOREIGN KEY (publication_id) REFERENCES publications(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS metric_snapshots_by_media ON instagram_metric_snapshots(media_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS insight_reports (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  analysis_json TEXT NOT NULL,
  reels_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS insight_reports_created ON insight_reports(created_at DESC);

CREATE TABLE IF NOT EXISTS performance_learnings (
  id TEXT PRIMARY KEY,
  statement TEXT NOT NULL,
  observation TEXT,
  hypothesis TEXT,
  recommended_test TEXT,
  content_pillar TEXT,
  platform TEXT,
  format TEXT,
  metric TEXT,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  confidence REAL NOT NULL DEFAULT 0,
  supporting_publication_ids_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'proposed',
  created_at TEXT NOT NULL,
  review_at TEXT
);
CREATE INDEX IF NOT EXISTS learnings_by_status ON performance_learnings(status, created_at DESC);

CREATE TABLE IF NOT EXISTS research_runs (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  package_id TEXT,
  mode TEXT NOT NULL,
  queries_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS research_sources (
  id TEXT PRIMARY KEY,
  research_run_id TEXT NOT NULL,
  title TEXT,
  url TEXT NOT NULL,
  domain TEXT,
  published_at TEXT,
  fetched_at TEXT NOT NULL,
  source_type TEXT,
  reliability_score REAL,
  excerpt TEXT,
  raw_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (research_run_id) REFERENCES research_runs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS research_claims (
  id TEXT PRIMARY KEY,
  research_run_id TEXT NOT NULL,
  claim TEXT NOT NULL,
  confidence TEXT,
  supporting_source_ids_json TEXT NOT NULL DEFAULT '[]',
  contradicting_source_ids_json TEXT NOT NULL DEFAULT '[]',
  caveat TEXT,
  FOREIGN KEY (research_run_id) REFERENCES research_runs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  state TEXT NOT NULL,
  progress TEXT,
  conversation_id TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  result_json TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS jobs_updated ON jobs(updated_at DESC);

CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  task TEXT NOT NULL,
  model TEXT,
  conversation_id TEXT,
  package_id TEXT,
  job_id TEXT,
  input_tokens_estimate INTEGER,
  output_tokens_estimate INTEGER,
  latency_ms INTEGER,
  status TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS usage_created ON usage_events(created_at DESC);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  response_json TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
