#!/usr/bin/env sh
set -eu
DB_ID="${1:-}"
if [ -z "$DB_ID" ]; then echo "Usage: ./scripts/configure-cloudflare.sh D1_DATABASE_ID"; exit 1; fi
cd "$(dirname "$0")/.."
python3 - "$DB_ID" <<'PY'
from pathlib import Path
import sys
p=Path('wrangler.toml')
s=p.read_text().replace('00000000-0000-0000-0000-000000000000',sys.argv[1])
p.write_text(s)
PY
npx wrangler vectorize create creator-source-memory --dimensions=1024 --metric=cosine || true
npx wrangler d1 migrations apply DB --remote
echo "Configuration complete. Run: npm run check && npm run deploy"
