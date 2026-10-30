// Phone-sized screenshots with touch input. usage: node tests/mobile.mjs outPrefix
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] || 'm';
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPhone 13'] });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://localhost:5173/?offline');
await p.waitForTimeout(1500);
await p.screenshot({ path: out + '_title.png' });
await p.goto('http://localhost:5173/?offline&plaza');
await p.waitForTimeout(1500);
await p.screenshot({ path: out + '_plaza.png' });
await p.goto('http://localhost:5173/?offline&play&m=waffle&f=vanilla,mintchoco,strawberry&w=cherrybomb');
await p.waitForTimeout(3000);
// drag the move stick and the aim stick at once
const cdp = await ctx.newCDPSession(p);
const tp = (id, x, y) => ({ x, y, id });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [tp(1, 90, 650), tp(2, 300, 500)] });
for (let i = 0; i < 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [tp(1, 90 + i * 4, 650 - i * 3), tp(2, 300 + i * 5, 500 - i * 4)] }); await p.waitForTimeout(100); }
await p.screenshot({ path: out + '_arena.png' });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
console.log(errs.join('\n') || 'no errors');
await b.close();
