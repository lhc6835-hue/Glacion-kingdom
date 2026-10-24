// Dev tool: screenshots the built game. usage:
//   node tools/shot.mjs out.png [waitMs] [js-to-eval-before-shot]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { serve } from './serve.mjs';

const [out = 'shot.png', wait = '4000', script = ''] = process.argv.slice(2);
const server = await serve(new URL('../dist', import.meta.url).pathname);
const url = `http://127.0.0.1:${server.address().port}/index.html${process.env.QS ?? '?lowres'}`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +(process.env.W || 1280), height: +(process.env.H || 720) } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url);
await page.waitForTimeout(+wait);
if (script) { const r = await page.evaluate(script); if (r !== undefined) console.log('eval:', JSON.stringify(r)); await page.waitForTimeout(+(process.env.AFTER || 2500)); }
await page.screenshot({ path: out, timeout: 120000 });
console.log(logs.filter((l) => !l.includes('GPU stall')).slice(0, 30).join('\n'));
await browser.close();
server.close();
