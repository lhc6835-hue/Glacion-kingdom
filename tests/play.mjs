// Drives the arena for a while with simulated input and takes screenshots.
// usage: node tests/play.mjs "<query>" <outPrefix> [seconds]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [query = 'play', out = 'shot', secs = 12] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://localhost:5173/?' + query);
await p.waitForTimeout(1500);
await p.mouse.move(900, 300);
await p.mouse.down();
const keys = ['KeyD', 'KeyS', 'KeyA', 'KeyW'];
for (let i = 0; i < secs; i++) {
  await p.keyboard.down(keys[i % 4]);
  await p.mouse.move(640 + Math.cos(i) * 300, 360 + Math.sin(i) * 200);
  await p.waitForTimeout(500);
  if (i % 3 === 0) await p.keyboard.press('Space');
  await p.keyboard.up(keys[i % 4]);
  await p.waitForTimeout(500);
  if (i === Math.floor(secs / 2)) await p.screenshot({ path: out + '_mid.png' });
  // auto-pick toppings
  const pick = await p.$('.pick');
  if (pick) await pick.click();
}
await p.screenshot({ path: out + '_end.png' });
const st = await p.evaluate(() => { const a = window.__arena; return a ? { wave: a.wave, state: a.state, enemies: a.enemies.length, kills: a.kills, layers: a.me.layers.length, coins: Math.round(a.coins) } : null; });
console.log(JSON.stringify(st));
console.log(errs.slice(0, 5).join('\n---\n') || 'no errors');
await b.close();
