import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { createWebZwf, inspectWebZwf } from './zwf-web-profile.mjs';

const input = new URL('../dist/zwf-web/', import.meta.url);
const output = new URL('../dist/closed-ward-run.zwf', import.meta.url);

async function collect(dir, root = dir, files = {}) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await collect(path, root, files);
    else {
      const name = relative(root, path).replaceAll('\\', '/');
      if (!name.startsWith('audio/')) files[name] = new Uint8Array(await readFile(path));
    }
  }
  return files;
}

const files = await collect(fileURLToPath(input));
files['jump.manifest.json'] = strToU8(JSON.stringify({
  schema_version: '1',
  format: 'html5',
  entry_point: 'index.html',
  permissions: { network: 'none', storage: 'sandbox' },
}));
const zip = zipSync(files, { level: 9 });
const zwf = createWebZwf({ zip, title: '폐쇄런 · Closed Ward Run' });
inspectWebZwf(zwf);
await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
await writeFile(output, zwf);
console.log(`created ${fileURLToPath(output)} (${zwf.length} bytes)`);
