# CreatorIQ

CreatorIQ is a private, single-user creator intelligence workspace running on Cloudflare Workers. It combines a streaming research engine, Instagram export/API analysis, a KV-backed saved library, encrypted integration credentials, Cloudflare Workers AI, and optional GPT-5.5 Thinking.

The existing password login is preserved: `APP_PASSWORD` is checked with constant-time comparison, sessions are HMAC-signed HttpOnly cookies, login attempts are rate-limited in KV, and logout revokes the session nonce.

## Deploy

Confirm the `APP_KV` namespace ID in `wrangler.toml`, then run these three commands:

```bash
npm install
npx wrangler secret put APP_PASSWORD && npx wrangler secret put APP_SESSION_SECRET
npm run deploy
```

`OPENAI_API_KEY` is optional. Add it separately with `npx wrangler secret put OPENAI_API_KEY` to enable GPT-5.5 Thinking; without it, CreatorIQ uses Cloudflare Workers AI. An Instagram token can be set as `INSTAGRAM_ACCESS_TOKEN` or stored from Settings with PIN-based AES-GCM encryption.

## Runtime bindings

- `AI`: Cloudflare Workers AI
- `APP_KV`: research sessions, Instagram reports, saved items, preferences, encrypted credentials, and existing auth state
- `ASSETS`: the vanilla HTML/CSS/JS SPA

## Main routes

- `POST /api/auth/login`, `GET /api/auth/status`, `POST /api/auth/logout`
- `POST /api/research` — streaming research modes
- `POST /api/instagram/analyze` — pasted JSON analysis
- `POST /api/instagram/sync` — live Graph API analysis
- `POST /api/chat` — context-grounded follow-up chat
- `GET/POST /api/saved`, `GET /api/export/all`
- `GET/PUT /api/settings`, `DELETE /api/data/clear`

## Instagram JSON shape

CreatorIQ recursively detects post-like objects, so exports do not need one exact schema. A minimal example:

```json
{
  "posts": [
    {
      "id": "post-1",
      "timestamp": "2026-06-01T12:00:00Z",
      "media_type": "REELS",
      "caption": "A useful caption #creator",
      "likes": 120,
      "comments": 8,
      "saves": 16,
      "shares": 4,
      "reach": 2400,
      "impressions": 3100
    }
  ]
}
```
