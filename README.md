# Personalized Content Agent v4

A private, password-protected creator workspace running on Cloudflare Workers.

Version 4 keeps the working v3 experience and adds durable per-chat memory, D1 records, semantic source retrieval, versioned content packages, selective regeneration, locks, feedback learning, publication tracking, Instagram performance learning, usage telemetry, URL/audio inputs, and optional evidence research.

## What is new

### Memory

- **Page Memory** remains global across every conversation.
- Every chat now keeps **all raw messages in D1** instead of deleting old turns.
- A rolling **per-chat structured summary** preserves intent, constraints, rejected ideas, examples, factual cautions, and unresolved questions.
- The agent receives Page Memory + chat summary + pins + recent turns + relevant source chunks + approved performance learnings.
- Important statements can be manually pinned so they are always present.

### Sources

- PDFs retain page information where extraction provides it.
- Documents are split into chunks and indexed in Cloudflare Vectorize.
- The planner retrieves only the passages relevant to the current request.
- Cloudflare Markdown Conversion is used as a fallback for difficult PDFs and supported office documents.
- Low-text scanned PDFs can be sent to an optional `OCR_PROCESSOR_URL` adapter, then chunked and indexed like any other source.
- Images are described with a vision-capable model.
- Audio is transcribed with Whisper.
- HTTPS URLs can be added as sources with redirect, size, and private-network protections.
- Video files can be stored immediately and analysed through the optional `MEDIA_PROCESSOR_URL` adapter.

### Production workflow

- Packages are append-only versions: v1, v2, v3, and so on.
- Regenerate only a hook, script, caption, hashtags, CTA, delivery notes, beat sheet, visual plan, one visual, or the full package.
- Lock JSON paths such as `selected_hook`, `script.spoken_script`, or `post_copy.cta`.
- Manual script edits create a new version rather than overwriting history.
- Independent criticism and evidence-aware revision remain part of full generation.
- Live research modes are available when `TAVILY_API_KEY` is configured.

### Learning loop

- Package feedback can generate Page Memory suggestions.
- Suggestions are never applied without your approval.
- Generated packages can be linked to published Instagram reels.
- Metric snapshots are stored over time.
- Performance learnings require linked examples and remain proposed until approved.
- Approved, relevant performance learnings become optional planning context.

### Reliability and operations

- D1 is the main source of truth for conversations and related records.
- Optimistic conversation versions prevent silent overwrites from multiple tabs.
- KV remains for login throttling, lightweight markers, and legacy import.
- R2 remains the source of truth for original and generated files.
- Queue jobs are retryable and independently recoverable.
- Every AI call records estimated tokens, latency, status, and task.
- AI Gateway can be enabled with `AI_GATEWAY_ID`.
- A protected one-time importer migrates existing v3 KV chats into D1 without deleting the old data.

---

## Cloudflare bindings

| Binding | Purpose |
|---|---|
| `AI` | Workers AI models and Markdown Conversion |
| `DB` | D1 structured application records |
| `SOURCE_VECTORS` | Semantic source retrieval |
| `CONTENT_BUCKET` | Uploads, generated images, audio, and package exports |
| `APP_KV` | Login throttling, migration markers, and legacy records |
| `AGENT_QUEUE` | Generation, source indexing, summaries, video processing, and insights |

## Model roles

| Role | Default model |
|---|---|
| Conversation, vision, final writing, revisions | `@cf/moonshotai/kimi-k2.6` |
| Summaries and lighter extraction | `@cf/zai-org/glm-4.7-flash` |
| Critic and performance analyst | `@cf/openai/gpt-oss-120b` |
| Generated images | `@cf/leonardo/lucid-origin` |
| Multilingual embeddings | `@cf/baai/bge-m3` |
| Retrieval reranking | `@cf/baai/bge-reranker-base` |
| Audio transcription | `@cf/openai/whisper-large-v3-turbo` |

The Vectorize index is created with **1024 dimensions** because BGE-M3 emits 1024-dimensional dense embeddings. Do not change the embedding model without creating a compatible new index.

---

# Upgrade from the working v3 project

The Worker name, KV namespace, R2 bucket, queue, and AI binding in this repository are intentionally unchanged. The repository keeps the same Worker name so existing secrets should remain associated with that Worker; verify them with `npx wrangler secret list` before deployment.

## 1. Back up the working release

Keep the old ZIP and make a copy of the current project folder. Do not delete the old KV records or R2 bucket.

```powershell
Copy-Item -Recurse . ..\personalized-content-agent-v3-backup
```

A rollback is simply deploying the previous project again. New v4-only chats would remain in D1 and would not appear in the old v3 interface.

## 2. Install dependencies

From the new folder:

```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
npm config set registry https://registry.npmjs.org/
npm install
```

This ZIP intentionally does not contain a `package-lock.json` so it cannot retain a machine-specific or internal registry URL.

## 3. Confirm the Cloudflare account

```powershell
npx wrangler whoami
```

## 4. Create D1

```powershell
npx wrangler d1 create personalized-content-db
```

Copy the returned `database_id` UUID.

Either run the helper:

```powershell
.\scripts\configure-cloudflare.ps1 -DatabaseId "PASTE-D1-UUID-HERE"
```

Or manually replace this placeholder in `wrangler.toml`:

```toml
database_id = "00000000-0000-0000-0000-000000000000"
```

The helper also attempts to create Vectorize and apply the remote D1 migration.

## 5. Create Vectorize manually when needed

If the helper says the index already exists, that is safe. Otherwise run:

```powershell
npx wrangler vectorize create creator-source-memory --dimensions=1024 --metric=cosine
```

The name must match this binding:

```toml
[[vectorize]]
binding = "SOURCE_VECTORS"
index_name = "creator-source-memory"
```

## 6. Apply D1 migrations before deployment

```powershell
npx wrangler d1 migrations list DB --remote
npx wrangler d1 migrations apply DB --remote
```

Do not skip this. The Worker expects the tables in `migrations/0001_v4_schema.sql`.

For local development:

```powershell
Copy-Item .dev.vars.example .dev.vars
npm run db:local
npm run dev
```

## 7. Verify existing secrets

Because the Worker name is still `personalized-content-agent`, your current secrets should remain attached:

```powershell
npx wrangler secret list
```

Required existing secrets:

```text
APP_PASSWORD
APP_SESSION_SECRET
```

Existing optional secrets:

```text
INSTAGRAM_ACCESS_TOKEN
INSTAGRAM_USER_ID
SARVAM_API_KEY
```

New optional configuration:

```powershell
npx wrangler secret put TAVILY_API_KEY
npx wrangler secret put MEDIA_PROCESSOR_TOKEN
npx wrangler secret put OCR_PROCESSOR_TOKEN
```

`AI_GATEWAY_ID`, `MEDIA_PROCESSOR_URL`, and `OCR_PROCESSOR_URL` may be added as encrypted secrets or as `[vars]`, depending on whether you consider their values sensitive.

None of these new optional values is required for the core application to run.

## 8. Validate and deploy

```powershell
npm run check
npm run deploy
npx wrangler tail
```

The health route should report `database: "ready"`:

```powershell
Invoke-RestMethod https://YOUR-WORKER.workers.dev/health
```

## 9. Import existing Page Memory and chats

After the first v4 deployment:

1. Open the application.
2. Sign in with the same password.
3. Open **Settings**.
4. Select **Import legacy KV data** once.
5. Review the migration report.
6. Refresh the application.

The import is idempotent unless force mode is explicitly used. It copies data into D1 and leaves the legacy KV records and R2 files untouched.

## 10. Run a controlled test

Use a new test conversation:

1. Save Page Memory.
2. Send at least two planning turns.
3. Pin one important constraint.
4. Upload a text PDF.
5. Approve the plan explicitly.
6. Generate a package.
7. Regenerate only the hook.
8. Lock `selected_hook` and regenerate the script.
9. Confirm a second package version appears.
10. Add feedback and approve or reject any proposed preference.
11. Mark the test package as published only when you have a real permalink.

---

# Runtime memory behavior

For one active conversation, the model context is assembled from:

```text
Global Page Memory
+ rolling per-chat summary
+ pinned notes
+ current structured decision
+ latest 12 raw messages
+ semantically relevant source chunks
+ relevant approved performance learnings
```

All raw messages remain in D1. Only a bounded recent window is sent on each model call, while the structured summary preserves long-term continuity.

Other conversations' messages, attachments, decisions, and packages are not included. Only global Page Memory and approved global performance learnings can cross conversations.

---

# Live research modes

The planning decision supports:

```text
none
uploaded_sources_only
quick_verification
deep_research
```

`quick_verification` and `deep_research` require `TAVILY_API_KEY`. Without the key, generation continues with uploaded sources and a clear research-unavailable note.

Research results are stored as:

- research run
- queries
- sources
- supported or contradicted claims
- caveats

The writer is instructed to reference uploaded chunks as `attachment:...` and web research sources as `research:...`.

---

# Optional video processor contract

Workers are not an ideal place to perform heavy video demuxing and frame extraction. The application therefore uses an adapter.

When `MEDIA_PROCESSOR_URL` is present, the Worker sends the video bytes as the POST body with:

```http
Content-Type: video/mp4
X-Filename: encoded-file-name.mp4
X-Attachment-Id: att_...
Authorization: Bearer MEDIA_PROCESSOR_TOKEN
```

Expected JSON response:

```json
{
  "summary": "Production-useful analysis",
  "transcript": "Time-aligned or plain transcript",
  "duration_seconds": 71.4,
  "speaking_rate_wps": 2.2,
  "longest_pause_seconds": 1.8,
  "shot_change_seconds": [0, 8.4, 16.2],
  "frames": [
    {
      "timestamp": 8.4,
      "description": "Creator speaking to camera with a title overlay",
      "text": "Visible caption"
    }
  ]
}
```

Without that service, video uploads are safely stored and marked `limited`; the rest of the application still works.

---


# Optional OCR processor contract

When `OCR_PROCESSOR_URL` is configured and a PDF still has very little text after normal extraction and Markdown Conversion, the Worker queues an OCR job. It sends the original document bytes with:

```http
Content-Type: application/pdf
X-Filename: encoded-file-name.pdf
X-Attachment-Id: att_...
Authorization: Bearer OCR_PROCESSOR_TOKEN
```

Expected JSON response:

```json
{
  "summary": "Optional document summary",
  "pages": [
    { "page": 1, "text": "Recognized page text", "confidence": 0.93 },
    { "page": 2, "text": "Recognized page text", "confidence": 0.88 }
  ]
}
```

The Worker stores page-level OCR text, average confidence, chunks, and Vectorize embeddings. Without the adapter, the document remains stored and is clearly marked as limited rather than being treated as reliable text.

---

## What is intentionally optional or adapter-based

The core application works with D1, Vectorize, R2, Queue, KV, and Workers AI. A few capabilities depend on extra services or configuration:

- **Live web research** is enabled only when `TAVILY_API_KEY` is configured. Without it, uploaded sources and creator-provided material remain available.
- **Heavy video analysis** requires `MEDIA_PROCESSOR_URL`; the Worker safely stores video files without attempting expensive frame extraction itself.
- **Scanned-document OCR** uses the optional `OCR_PROCESSOR_URL` adapter. Without it, Markdown Conversion is attempted and low-text scans are marked as limited.
- **Instagram OAuth** is not embedded in the interface; the current integration continues to use the secrets you configure with Wrangler.
- **Durable Objects are not required in this ZIP.** D1 optimistic versions, atomic message sequencing, and idempotent queue jobs provide the initial concurrency layer. A Durable Object coordinator can be added later if the app becomes multi-user or receives heavy simultaneous writes.
- **AI Gateway is optional.** When configured, the AI wrapper sends task metadata through it; decide your logging and retention policy before enabling prompt/response logging.

These limitations are surfaced rather than silently pretending the corresponding operation succeeded.

---

# Important cautions

1. **Do not deploy with the zero D1 UUID.**
2. **Apply remote migrations before deploying v4.**
3. **Do not delete the old KV data until the importer report is verified.**
4. **Do not recreate the existing R2 bucket or queue under a different name unless you also update `wrangler.toml`.**
5. **Do not create Vectorize with the wrong dimensions.** Dimensions cannot be changed in-place.
6. **Keep the same Worker name** if you want existing secrets to remain attached.
7. **Test the Instagram token after deployment.** Meta permissions and available metrics may vary by account and media type.
8. **Treat performance learnings as hypotheses.** The system requires your approval and avoids claiming causation.
9. **Use source deletion from the UI.** It removes R2, D1 chunks, and Vectorize IDs together.
10. **Back up before changing embedding models.** A model with different dimensions requires a new Vectorize index and re-indexing.

---

# Main API groups

```text
/auth                    Password-only sessions
/context                 Global Page Memory
/conversations           Chats, messages, pins, URLs, uploads
/attachments             Source status and deletion
/packages                Versions, locks, edits, regeneration, feedback
/publications             Package-to-reel links
/insights                 Instagram refresh and reports
/memory-suggestions       User-approved preference updates
/performance-learnings    User-approved performance memory
/usage                    Model and job telemetry
/admin/migrate-legacy     One-time KV-to-D1 import
/assets                   Authenticated R2 downloads
```

# Project structure

```text
src/
├── index.js          Router, cron, downloads, health
├── auth.js           Password sessions and rate limiting
├── db.js             D1 repositories
├── conversations.js  Planning, context builder, summaries, pins
├── sources.js        Uploads, conversion, chunking, Vectorize, URL/audio/video
├── research.js       Optional source collection and claim ledger
├── packages.js       Generation, review, versions, locks, feedback, publishing
├── performance.js    Instagram snapshots and proposed learnings
├── ai.js             Central Workers AI client and telemetry
├── jobs.js           Queue dispatcher
├── migration.js      Legacy KV importer
├── schemas.js        Structured model contracts
├── config.js         Models and creator defaults
├── utils.js          Shared helpers
└── ui.js             Embedded web application
```
