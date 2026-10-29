// Builds a single self-contained page of the game (CSS and JS inlined) for publishing
// as a hosted artifact. usage: node tools/artifact.mjs out.html
import { build } from 'vite';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const out = process.argv[2] || 'artifact.html';
await build({
  logLevel: 'error',
  // inline the title fonts so the single page needs no other files
  build: { outDir: 'dist-artifact', emptyOutDir: true, rollupOptions: { input: 'index.html' }, modulePreload: false, assetsInlineLimit: 1e8 },
});
const dir = 'dist-artifact/assets/';
const files = readdirSync(dir);
const js = files.filter((f) => f.endsWith('.js')).map((f) => readFileSync(dir + f, 'utf8'));
if (js.length !== 1) throw new Error('expected a single JS bundle, got ' + js.length);
const css = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(dir + f, 'utf8')).join('\n');
const page = `<title>Axenfall</title>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<style>${css}</style>
<canvas id="game"></canvas>
<div id="ui"></div>
<script type="module">${js[0].replace(/<\/script/gi, '<\\/script')}</script>
`;
writeFileSync(out, page);
console.log('wrote', out, (page.length / 1024).toFixed(0), 'KB');
