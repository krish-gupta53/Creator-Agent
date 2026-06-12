param(
  [Parameter(Mandatory=$true)][string]$DatabaseId,
  [switch]$SkipVectorize,
  [switch]$SkipMigrations
)
$ErrorActionPreference = "Stop"
if (Test-Path variable:PSNativeCommandUseErrorActionPreference) { $PSNativeCommandUseErrorActionPreference = $false }
Set-Location (Split-Path $PSScriptRoot -Parent)
if ($DatabaseId -notmatch '^[0-9a-fA-F-]{36}$') { throw "DatabaseId does not look like a D1 UUID." }
$path = Join-Path (Get-Location) "wrangler.toml"
$content = Get-Content $path -Raw
$content = $content -replace '00000000-0000-0000-0000-000000000000', $DatabaseId
Set-Content $path $content -NoNewline
Write-Host "Updated wrangler.toml with D1 database ID." -ForegroundColor Green
if (-not $SkipVectorize) {
  Write-Host "Creating Vectorize index (an already-exists error is safe to ignore)..." -ForegroundColor Cyan
  & npx wrangler vectorize create creator-source-memory --dimensions=1024 --metric=cosine
  if ($LASTEXITCODE -ne 0) { Write-Warning "Vectorize creation returned a non-zero status. Continue only if the index already exists with 1024 dimensions and cosine metric." }
}
if (-not $SkipMigrations) {
  & npx wrangler d1 migrations apply DB --remote
  if ($LASTEXITCODE -ne 0) { throw "Remote D1 migration failed. Do not deploy until this succeeds." }
}
Write-Host "Configuration complete. Run: npm run check; npm run deploy" -ForegroundColor Green
