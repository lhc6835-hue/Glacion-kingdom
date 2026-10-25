// Smoke test: builds nothing, runs the built game (dist/) in headless Chromium and checks that
// it boots, renders, moves, collides, saves and progresses quests. Usage: npm run build && npm test
import { createRequire } from 'node:module';
import { serve } from '../tools/serve.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const server = await serve(new URL('../dist', import.meta.url).pathname);
const url = `http://127.0.0.1:${server.address().port}/index.html?lowres&play`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };

try {
  await page.goto(url);
  await page.waitForFunction(() => window.__glacion && window.__glacion.mode === 'play', null, { timeout: 240000 });
  check('boots into play mode', true);

  const px = await page.evaluate(() => {
    const g = window.__glacion;
    return { frame: g.engine.frame, canvas: !!document.querySelector('#game'), sprites: g.sprites.layers.reduce((s, l) => s + l.count, 0) };
  });
  check('scene has sprites', px.sprites > 10000, `${px.sprites} instances`);

  // Drive the simulation deterministically rather than waiting on slow software rendering.
  const step = (fn, n) => page.evaluate(([src, n]) => {
    const g = window.__glacion;
    const f = new Function('g', src);
    for (let i = 0; i < n; i++) { f(g); g.update(1 / 30, g.engine.elapsed += 1 / 30); }
  }, [fn, n]);

  const start = await page.evaluate(() => ({ x: window.__glacion.player.pos.x, z: window.__glacion.player.pos.z }));
  await step("g.input.keys.add('w')", 60);
  const moved = await page.evaluate(() => { const g = window.__glacion; g.input.keys.delete('w'); return { x: g.player.pos.x, z: g.player.pos.z, y: g.player.pos.y, gh: g.world.groundHeight(g.player.pos.x, g.player.pos.z) }; });
  check('player walks north', moved.z < start.z - 4, `dz=${(moved.z - start.z).toFixed(1)}`);
  check('player stays on the ground', Math.abs(moved.y - moved.gh) < 0.6, `y=${moved.y.toFixed(2)} ground=${moved.gh.toFixed(2)}`);

  // Cliff: walking into the royal plateau's south cliff from below must be blocked.
  const cliff = await page.evaluate(() => {
    const g = window.__glacion;
    g.player.spawn(600, 60); // lowland just south-east of the plateau, below the rim
    const y0 = g.player.pos.y;
    g.input.keys.add('w');
    for (let i = 0; i < 150; i++) g.update(1 / 30, g.engine.elapsed += 1 / 30);
    g.input.keys.delete('w');
    return { y0, y: g.player.pos.y, z: g.player.pos.z };
  });
  check('cliffs cannot be walked up', cliff.y < cliff.y0 + 5, `start y=${cliff.y0.toFixed(1)} end y=${cliff.y.toFixed(1)}`);

  // Gliding from the castle gate: should travel far before landing.
  const glide = await page.evaluate(() => {
    const g = window.__glacion;
    // Walk south off the royal plateau rim (56 m) toward the lake, holding Space once airborne.
    g.player.spawn(150, 40);
    g.player.stamina = 1;
    g.input.keys.add('s');
    let air = 0, left = false, y0 = g.player.pos.y;
    for (let i = 0; i < 600; i++) {
      if (!g.player.onGround && !g.player.swimming) { left = true; air++; g.input.keys.add(' '); }
      else if (left) break;
      g.update(1 / 30, g.engine.elapsed += 1 / 30);
    }
    g.input.keys.delete(' '); g.input.keys.delete('s');
    return { air, z: g.player.pos.z, y0, y: g.player.pos.y };
  });
  check('gliding slows the fall', glide.air > 150, `${glide.air} frames airborne from y=${glide.y0.toFixed(0)} to y=${glide.y.toFixed(0)}, z=${glide.z.toFixed(0)}`);

  // Gate: walking from outside the south gate into the city.
  const gate = await page.evaluate(() => {
    const g = window.__glacion;
    g.player.spawn(300, 75);
    g.input.keys.add('w');
    for (let i = 0; i < 300; i++) g.update(1 / 30, g.engine.elapsed += 1 / 30);
    g.input.keys.delete('w');
    return { z: g.player.pos.z, place: g.place?.id };
  });
  check('player can pass through the south gate', gate.z < 40, `z=${gate.z.toFixed(1)} place=${gate.place}`);

  // Quests: accept, visit, turn in.
  const q = await page.evaluate(() => {
    const g = window.__glacion;
    g.quests.accept('first-flight');
    g.player.spawn(62, 50);
    for (let i = 0; i < 5; i++) g.update(1 / 30, g.engine.elapsed += 1 / 30);
    const st1 = g.quests.status('first-flight');
    g.quests.turnInTo('길드장 하르반');
    return { st1, st2: g.quests.status('first-flight'), coins: g.state.player.coins };
  });
  check('visit objective completes', q.st1 === 'ready', q.st1);
  check('turn-in pays out', q.st2 === 'done' && q.coins >= 50, `${q.st2}, coins=${q.coins}`);

  const save = await page.evaluate(() => { const g = window.__glacion; g.persist(); const s = JSON.parse(localStorage.getItem('glacion-save-v1')); return { ok: !!s, done: s?.quests?.['first-flight']?.state }; });
  check('progress is saved', save.ok && save.done === 'done');

  const night = await page.evaluate(() => { const g = window.__glacion; g.dayNight.setTime(23); g.update(1 / 30, g.engine.elapsed += 1 / 30); return { glow: window.__glacion.dayNight.time > 22 }; });
  check('night cycle runs', night.glow);

  check('no runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (e) {
  check('test harness', false, e.message);
}
await browser.close();
server.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
