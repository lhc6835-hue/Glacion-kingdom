// Builds the game into one page, bundles the server with it and uploads both to Cloudflare
// Workers through the API. usage: node tools/deploy-worker.mjs   (needs network access to
// api.cloudflare.com; credentials come from the environment's proxy or CLOUDFLARE_API_TOKEN)
import { build } from 'vite';
import { build as esbuild } from 'esbuild';
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';

const NAME = process.env.WORKER_NAME || 'glacion-icecream';
const API = 'https://api.cloudflare.com/client/v4';
const headers = process.env.CLOUDFLARE_API_TOKEN ? { authorization: 'Bearer ' + process.env.CLOUDFLARE_API_TOKEN } : { authorization: 'Bearer proxy-injected' };

// 1. single self-contained page
await build({ logLevel: 'error', build: { outDir: 'dist-worker/client', emptyOutDir: true, modulePreload: false, assetsInlineLimit: 100000000 } });
const dir = 'dist-worker/client/assets/';
const files = readdirSync(dir);
const js = files.filter((f) => f.endsWith('.js')).map((f) => readFileSync(dir + f, 'utf8'));
if (js.length !== 1) throw new Error('expected one JS bundle, got ' + js.length);
const css = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(dir + f, 'utf8')).join('\n');
const html = readFileSync('dist-worker/client/index.html', 'utf8')
  .replace(/<link rel="stylesheet" crossorigin href="[^"]+">/, `<style>${css}</style>`)
  .replace(/<script type="module" crossorigin src="[^"]+"><\/script>/, () => `<script type="module">${js[0].replace(/<\/script/gi, '<\\/script')}</script>`);
mkdirSync('server', { recursive: true });
writeFileSync('server/page.html', html);
console.log('page', (html.length / 1024).toFixed(0), 'KB');

// 2. bundle the worker
await esbuild({ entryPoints: ['server/worker.js'], bundle: true, format: 'esm', outfile: 'dist-worker/worker.js', loader: { '.html': 'text' }, minify: true, target: 'es2022' });
const code = readFileSync('dist-worker/worker.js');
console.log('worker', (code.length / 1024).toFixed(0), 'KB');

// 3. upload
const acc = (await (await fetch(API + '/accounts', { headers })).json()).result[0].id;
const existing = await (await fetch(`${API}/accounts/${acc}/workers/scripts`, { headers })).json();
const exists = existing.result.some((s) => s.id === NAME);
const metadata = {
  main_module: 'worker.js',
  compatibility_date: '2025-09-01',
  bindings: [
    { type: 'durable_object_namespace', name: 'STORE', class_name: 'Store' },
    { type: 'durable_object_namespace', name: 'PLAZA', class_name: 'Plaza' },
    { type: 'durable_object_namespace', name: 'ROOM', class_name: 'Room' },
  ],
};
if (!exists) metadata.migrations = { new_tag: 'v1', new_sqlite_classes: ['Store', 'Plaza', 'Room'] };
const form = new FormData();
form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
form.append('worker.js', new Blob([code], { type: 'application/javascript+module' }), 'worker.js');
const up = await (await fetch(`${API}/accounts/${acc}/workers/scripts/${NAME}`, { method: 'PUT', headers, body: form })).json();
if (!up.success) { console.error(JSON.stringify(up.errors)); process.exit(1); }
await fetch(`${API}/accounts/${acc}/workers/scripts/${NAME}/subdomain`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ enabled: true, previews_enabled: false }) });
const sub = (await (await fetch(`${API}/accounts/${acc}/workers/subdomain`, { headers })).json()).result.subdomain;
console.log(`deployed: https://${NAME}.${sub}.workers.dev/`);
