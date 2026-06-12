# Social video URL sources

Creator Agent can process public YouTube videos and Instagram Reels/posts added through the existing **Add URL / Video** action in chat.

## Setup

Create a Supadata API key, then add it to the existing Cloudflare Worker:

```powershell
npx wrangler secret put SUPADATA_API_KEY
```

For local development, add the same value to `.dev.vars`:

```text
SUPADATA_API_KEY=your-key
```

No D1 migration is required. Social-video records use the existing `attachments` and `document_chunks` tables.

## User flow

1. Open a conversation.
2. Select **Add URL / Video**.
3. Paste a public YouTube video, YouTube Short, or Instagram Reel/post URL.
4. The source appears immediately with a processing status.
5. The queue retrieves metadata and a timestamped transcript from Supadata.
6. Creator Agent generates a creator-focused analysis with the existing Workers AI fast model.
7. The transcript and analysis are chunked, embedded, and indexed in Vectorize.
8. Relevant passages become available to planning and package generation inside that conversation.

Normal article URLs continue through the existing generic URL ingestion path.

## Stored result

The complete normalized source JSON is stored in R2 and includes:

- canonical source URL and provider
- title, creator/channel, language, thumbnail, duration, and publication time when available
- timestamped transcript segments
- summary and main ideas
- key claims and short useful excerpts
- hook and story structure
- tone and content opportunities
- claims that should be independently verified

The searchable source document combines the analysis and transcript before chunking.

## Processing states

Social-video attachments use existing attachment statuses and include a more detailed `processing_stage` in metadata:

- `queued`
- `fetching_metadata_and_transcript`
- `analysing_transcript`
- `ready`
- `retrying`
- `limited_no_transcript`
- `missing_supadata_key`

The existing Sources view polls attachments while they are processing.

## Reliability

Supadata can return a transcript immediately or return a background job ID. Creator Agent supports both paths and polls asynchronous jobs before continuing.

Queue failures are retried using the existing Cloudflare Queue policy. During retries, the source remains visible as processing and includes the last error in its metadata.

If metadata retrieval fails but the transcript succeeds, processing continues and records the metadata error. If no transcript is available, the source is marked limited instead of being treated as reliable source text.

## Safety and copyright behavior

- Only supported public HTTPS YouTube and Instagram URLs use this path.
- The transcript is treated as untrusted reference material, never as model instructions.
- Analysis prompts ask for transformation and short excerpts rather than close reproduction.
- Factual claims are separated from items requiring independent verification.
- Sources stay scoped to the conversation where they were added.

Private, deleted, login-restricted, age-restricted, or region-restricted content may not be available to the transcript provider.

## Optional configuration

The default transcript mode is configured in `wrangler.toml`:

```toml
SUPADATA_TRANSCRIPT_MODE = "auto"
```

The following optional overrides are supported:

```text
SUPADATA_API_BASE_URL=https://api.supadata.ai/v1/transcript
SUPADATA_METADATA_URL=https://api.supadata.ai/v1/metadata
SUPADATA_TRANSCRIPT_MODE=auto
```

The defaults should normally be used.

## Validation and deployment

```powershell
npm install
npm run check
npx wrangler secret put SUPADATA_API_KEY
npm run deploy
```

After deployment, open **Settings** and confirm that the Supadata integration is shown as configured. Then add one public YouTube URL in a test conversation and confirm that the source reaches `ready` status and is retrieved by a follow-up planning message.
