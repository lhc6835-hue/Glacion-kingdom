// Builds a single self-contained page of the game (CSS and JS inlined) for publishing
// as a hosted artifact. usage: node tools/artifact.mjs out.html
import { build } from 'vite';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const out = process.argv[2] || 'artifact.html';
await build({
  logLevel: 'error',
  build: { outDir: 'dist-artifact', emptyOutDir: true, rollupOptions: { input: 'index.html' }, modulePreload: false },
});
const dir = 'dist-artifact/assets/';
const files = readdirSync(dir);
const js = files.filter((f) => f.endsWith('.js')).map((f) => readFileSync(dir + f, 'utf8'));
if (js.length !== 1) throw new Error('expected a single JS bundle, got ' + js.length);
const css = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(dir + f, 'utf8')).join('\n');
const page = `<title>글래시온 왕국</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap">
<style>${css}</style>
<canvas id="game"></canvas>
<div id="ui"></div>
<script type="module">${js[0].replace(/<\/script/gi, '<\\/script')}</script>
`;
writeFileSync(out, page);
console.log('wrote', out, (page.length / 1024).toFixed(0), 'KB');
