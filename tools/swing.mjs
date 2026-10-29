// Dev tool: steps the real game at 60 fps and saves close-ups of the hero through a swing,
// a walk start/stop and a jump. usage: node tools/swing.mjs outdir
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { serve } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] || 'swing';
mkdirSync(out, { recursive: true });
const server = await serve(new URL('../dist', import.meta.url).pathname);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?play`);
await page.waitForFunction(() => window.__axenfall?.mode === 'play');
await page.evaluate(() => {
  const g = window.__axenfall;
  g._frame = g.frame.bind(g); g.frame = () => {};   // take over the clock
  g.step = (n) => { for (let i = 0; i < n; i++) g._frame(1 / 60); };
  const t = g.trees.list.find((t) => t.species === 'pine');
  g.player.x = t.x - 13; g.combat.engage(t); g.player.anchor = t.x - 13; g.cam.x = t.x - 20 - g.engine.W / 2;
  g.step(30);
});
const box = () => page.evaluate(() => { const g = window.__axenfall, s = g.engine.cssScale; return { x: (g.player.x - Math.round(g.cam.x)) * s - 70, y: (g.player.y - Math.round(g.cam.y)) * s - 110, width: 140, height: 125 }; });
let n = 0;
const snap = async () => { writeFileSync(`${out}/f${String(n++).padStart(2, '0')}.png`, await page.screenshot({ clip: await box() })); };
if (process.argv[3] === 'move') {
  // run right, stop, then jump
  await page.evaluate(() => { const g = window.__axenfall; g.combat.disengage(); g.player.anchor = null; g.followCam = () => {}; g.input.keys.add('d'); g.input.keys.add('Shift'); });
  for (let i = 0; i < 6; i++) { await page.evaluate(() => window.__axenfall.step(4)); await snap(); }
  await page.evaluate(() => { const g = window.__axenfall; g.input.keys.delete('d'); g.input.keys.delete('Shift'); });
  for (let i = 0; i < 3; i++) { await page.evaluate(() => window.__axenfall.step(3)); await snap(); }
  await page.evaluate(() => { const g = window.__axenfall; g.input.keys.add(' '); g.input.pressed.add(' '); });
  for (let i = 0; i < 9; i++) { await page.evaluate(() => window.__axenfall.step(4)); await snap(); }
} else {
  await page.evaluate(() => { const g = window.__axenfall; g.combat.phase = 0.5; g.combat.attack(g.now); });
  for (let i = 0; i < 12; i++) { await page.evaluate(() => window.__axenfall.step(3)); await snap(); }
}
await browser.close(); server.close();
