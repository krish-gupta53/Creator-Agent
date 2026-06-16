PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workspace_runs (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('research','insight')),
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'deep_research',
  status TEXT NOT NULL DEFAULT 'queued',
  source_ids_json TEXT NOT NULL DEFAULT '[]',
  options_json TEXT NOT NULL DEFAULT '{}',
  result_json TEXT,
  error TEXT,
  job_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS workspace_runs_by_project
  ON workspace_runs(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS workspace_runs_by_status
  ON workspace_runs(status, updated_at DESC);
