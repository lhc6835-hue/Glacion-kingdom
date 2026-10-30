// Filmstrip of one attack: captures frames around the hero while firing once.
// usage: node tests/film.mjs <weapon> <out.png> [frames] [gapMs]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [w = 'spoon', out = 'film.png', n = 10, gap = 35] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(`http://localhost:5173/?offline&play&w=${w}&m=waffle&f=vanilla,mintchoco,strawberry`);
await p.waitForTimeout(1800);
await p.evaluate(() => { const A = window.__arena; A.enemies.length = 0; A.dir = { done: true, budget: 0, spent: 0 }; A.state = 'idle'; for (let i = 0; i < 3; i++) A.spawnEnemy('magma', A.me.x + 120, A.me.y - 40 + i * 40); });
await p.mouse.move(700, 280);
await p.waitForTimeout(500);
const shots = [];
await p.mouse.down();
for (let i = 0; i < +n; i++) { shots.push(await p.screenshot({ clip: { x: 250, y: 120, width: 420, height: 340 } })); await p.waitForTimeout(+gap); if (i === 2) await p.mouse.up(); }
const { writeFileSync } = await import('node:fs');
shots.forEach((s, i) => writeFileSync(out.replace('.png', `_${i}.png`), s));
await b.close();
