import { readdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const src = path.join(root, 'src');
for (const name of await readdir(src)) {
  if (!name.endsWith('.js')) continue;
  execFileSync(process.execPath, ['--check', path.join(src, name)], { stdio: 'inherit' });
}
const uiSource = await readFile(path.join(src, 'ui.js'), 'utf8');
const scriptStart = uiSource.indexOf('<script>');
const scriptEnd = uiSource.lastIndexOf('</script>');
if (scriptStart < 0 || scriptEnd <= scriptStart) throw new Error('Could not locate the embedded browser script in src/ui.js.');
const browserCheckPath = path.join(root, '.ui-browser-check.mjs');
await writeFile(browserCheckPath, uiSource.slice(scriptStart + '<script>'.length, scriptEnd));
try { execFileSync(process.execPath, ['--check', browserCheckPath], { stdio: 'inherit' }); }
finally { await unlink(browserCheckPath).catch(() => {}); }
const wrangler = await readFile(path.join(root, 'wrangler.toml'), 'utf8');
if (wrangler.includes('00000000-0000-0000-0000-000000000000')) {
  console.warn('\nWARNING: Replace the placeholder D1 database_id before remote deploy.\n');
}
console.log('Source syntax checks passed.');
