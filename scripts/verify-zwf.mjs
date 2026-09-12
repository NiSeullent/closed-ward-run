import { readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import { inspectWebZwf, PROFILE_CHUNK } from './zwf-web-profile.mjs';

const path = process.argv[2];
if (!path) throw new Error('usage: node scripts/verify-zwf.mjs <file.zwf>');
const chunks = inspectWebZwf(await readFile(path));
const web = chunks.find((chunk) => chunk.id === PROFILE_CHUNK);
const files = unzipSync(web.payload);
if (!files['index.html']) throw new Error('WEBZ archive has no index.html');
if (!files['jump.manifest.json']) throw new Error('WEBZ archive has no jump.manifest.json');
console.log(JSON.stringify({ valid: true, profile: 'html5-sandbox/1', files: Object.keys(files).length }));
