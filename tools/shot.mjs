// Screenshot helper: node tools/shot.mjs <url> <out.png> [width] [height] [waitMs]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [url, out, w = 1600, h = 1200, wait = 1500] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w, height: +h } });
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE', m.text()); });
await p.goto(url);
await p.waitForTimeout(+wait);
await p.screenshot({ path: out });
await b.close();
