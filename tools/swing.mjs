// Dev tool: freezes the hero at points of the swing and saves a zoomed contact sheet.
import { createRequire } from 'node:module';
import { serve } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] || 'swing.png';
const server = await serve(new URL('../dist', import.meta.url).pathname);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?play`);
await page.waitForFunction(() => window.__axenfall?.mode === 'play');
await page.evaluate(() => {
  const g = window.__axenfall;
  const t = g.trees.list.find((t) => t.species === 'pine');
  g.player.x = t.x - 13; g.player.anchor = t.x - 13; g.combat.engage(t); g.cam.x = t.x - g.engine.W / 2;
  g.combat.update = () => {};
  g.followCam = () => {};
});
const shots = [];
for (const st of [null, 0.03, 0.09, 0.12, 0.15, 0.19, 0.25, 0.35, 'idle', 'walk1', 'walk2', 'jump']) {
  const buf = await page.evaluate((st) => {
    const g = window.__axenfall;
    g.player.surpriseT = 0; g.player.cheerT = 0;
    if (typeof st === 'number') g.combat.swing = { t: st, total: g.combat.swingTotal(), impactAt: 0.15, landed: true, j: 'crit' };
    else g.combat.swing = null;
    if (st === 'idle' || st === 'walk1' || st === 'walk2' || st === 'jump') { g.combat.target = null; }
    if (st === 'walk1') { g.player.vx = 52; g.player.walkPhase = 1.2; }
    if (st === 'walk2') { g.player.vx = 52; g.player.walkPhase = 4.3; }
    if (st === 'jump') { g.player.onGround = false; g.player.vy = -60; }
    g.player.computePose(g.combat, Math.abs(g.player.vx), false);
    g.player.update = () => {};
    return null;
  }, st);
  await page.waitForTimeout(80);
  const box = await page.evaluate(() => { const g = window.__axenfall; const s = g.engine.cssScale; return { x: (g.player.x - Math.round(g.cam.x)) * s - 60, y: (g.player.y - Math.round(g.cam.y)) * s - 90, width: 120, height: 110 }; });
  shots.push(await page.screenshot({ clip: box }));
}
const { writeFileSync } = await import('node:fs');
shots.forEach((b, i) => writeFileSync(out.replace('.png', `_${i}.png`), b));
await browser.close(); server.close();
