# Production upgrade checklist

## Before deployment

- [ ] Keep the current working ZIP.
- [ ] Confirm `name = "personalized-content-agent"` is unchanged.
- [ ] Confirm existing KV ID, R2 bucket, and queue names are correct.
- [ ] Run `npx wrangler d1 create personalized-content-db`.
- [ ] Replace the zero D1 UUID in `wrangler.toml`.
- [ ] Create Vectorize with 1024 dimensions and cosine distance.
- [ ] Apply D1 migrations remotely.
- [ ] Run `npx wrangler secret list`.
- [ ] Run `npm run check`.

## Immediately after deployment

- [ ] Open `/health` and verify `database = ready`.
- [ ] Log in with the existing password.
- [ ] Open Settings and import legacy KV data once.
- [ ] Confirm Page Memory appears.
- [ ] Open two migrated chats and inspect messages/packages.
- [ ] Create a new test chat.
- [ ] Upload a PDF and verify its source status.
- [ ] Generate a package.
- [ ] Regenerate one section and verify a second version.
- [ ] Open `wrangler tail` and check for errors.

## After confidence is established

- [ ] Configure Tavily only when live research is wanted.
- [ ] Configure an OCR processor only when scanned-PDF OCR is needed.
- [ ] Configure a media processor only when video-frame analysis is needed.
- [ ] Configure AI Gateway only after deciding log-retention policy.
- [ ] Link real generated packages to real published reels.
- [ ] Review proposed performance learnings before approval.
- [ ] Keep legacy KV data for at least one normal production cycle.
