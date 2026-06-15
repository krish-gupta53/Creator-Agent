import { readdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const src = path.join(root, 'src');
for (const name of await readdir(src)) {
  if (!name.endsWith('.js')) continue;
  execFileSync(process.execPath, ['--check', path.join(src, name)], { stdio: 'inherit' });
}

for (const name of ['ui.js', 'ui-modern.js']) {
  const source = await readFile(path.join(src, name), 'utf8');
  const scriptStart = source.indexOf('<script>');
  const scriptEnd = source.lastIndexOf('</script>');
  if (scriptStart < 0 || scriptEnd <= scriptStart) throw new Error(`Could not locate the embedded browser script in src/${name}.`);
  const browserCheckPath = path.join(root, `.${name}-browser-check.mjs`);
  await writeFile(browserCheckPath, source.slice(scriptStart + '<script>'.length, scriptEnd));
  try { execFileSync(process.execPath, ['--check', browserCheckPath], { stdio: 'inherit' }); }
  finally { await unlink(browserCheckPath).catch(() => {}); }
}

const wrangler = await readFile(path.join(root, 'wrangler.toml'), 'utf8');
if (wrangler.includes('00000000-0000-0000-0000-000000000000')) {
  console.warn('\nWARNING: Replace the placeholder D1 database_id before remote deploy.\n');
}
console.log('Source and embedded browser syntax checks passed.');
