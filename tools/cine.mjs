// Dev tool: captures frames of the opening cinematic at fixed times. usage: node tools/cine.mjs outdir
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { serve } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

const out = process.argv[2] || 'cine';
mkdirSync(out, { recursive: true });
const server = await serve(new URL('../dist', import.meta.url).pathname);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
await page.waitForFunction(() => window.__axenfall);
await page.mouse.click(400, 300);
await page.waitForFunction(() => window.__axenfall.mode === 'cinematic');
for (const t of [0.3, 0.7, 1.2, 1.6, 2.1, 2.5, 2.75, 3.2, 3.9, 4.3]) {
  await page.evaluate((t) => { const c = window.__axenfall.cine; c.t = t - 0.016; }, t);
  await page.waitForTimeout(60);
  await page.screenshot({ path: `${out}/t${t.toFixed(2)}.png` });
}
await page.evaluate(() => window.__axenfall.skipCinematic());
await page.waitForTimeout(200);
console.log(JSON.stringify({ mode: await page.evaluate(() => window.__axenfall.mode), errs }));
await browser.close();
server.close();
