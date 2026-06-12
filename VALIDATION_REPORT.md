# Validation report

Validated on 2026-06-07 before packaging.

## Passed locally

- Syntax checks for every `src/*.js` module.
- Syntax check for the JavaScript embedded in `src/ui.js`.
- D1 migration execution in an in-memory SQLite database.
- Schema count and required conversation sequence columns.
- D1 repository smoke tests:
  - creator context
  - atomic message sequences
  - optimistic version conflicts
  - attachments and document chunks
  - append-only package versions
  - research JSON
  - job state updates
- Authenticated HTTP route smoke tests:
  - health
  - rejected and accepted login
  - signed session cookie
  - bootstrap
  - conversation creation
  - pinned notes
  - context update
  - usage endpoint
  - API 404 handling
- Content generation smoke test:
  - approved conversation
  - package writer response
  - critic response
  - versioned package storage
  - generated assistant completion message
  - manifest, script, and shot-list writes to mocked R2
- No embedded application passwords, API tokens, Gmail credentials, or Google OAuth values.

## Requires your Cloudflare environment

The following were not executed against your live account:

- `npm install` from the public npm registry in this sandbox.
- Wrangler production bundle dry-run with installed dependencies.
- Remote D1 creation and migration.
- Vectorize creation and real BGE-M3 indexing/querying.
- Real Workers AI model responses and generated images.
- Real Instagram Graph API calls.
- Real Sarvam TTS.
- Optional Tavily, OCR processor, media processor, or AI Gateway integrations.

After extraction, `npm run check` performs source checks and a Wrangler dry-run. Complete the steps in `UPGRADE_CHECKLIST.md` before deploying.
