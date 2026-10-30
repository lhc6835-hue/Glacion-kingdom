// Browser smoke test: runs the built game (dist/) in headless Chromium and plays the core loop
// through the real UI: chop with the timing bar, fell, sell, buy, pray, repair the sawmill,
// process, buy a class, save and reload. Usage: npm run build && node tests/smoke.mjs
import { createRequire } from 'node:module';
import { serve } from '../tools/serve.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const server = await serve(new URL('../dist', import.meta.url).pathname);
const base = `http://127.0.0.1:${server.address().port}/index.html`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 4).join(' ')));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

let pass = 0, fail = 0;
const check = (name, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
const G = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
// Holds the marker at `pos` (0..1 on the bar), then clicks through the real canvas pointer handler.
async function strikeAt(pos) {
  try { await page.waitForFunction(() => { const g = window.__axenfall; return g.combat.target && !g.combat.swing; }, null, { timeout: 8000 }); }
  catch (e) { console.log('strike wait:', await G(() => { const g = window.__axenfall; return JSON.stringify({ t: !!g.combat.target, st: g.combat.target?.state, hp: g.combat.target?.hp, sw: g.combat.swing && { t: g.combat.swing.t, total: g.combat.swing.total }, mode: g.mode, panel: g.ui.panel }); })); throw e; }
  await G((p) => { const c = window.__axenfall.combat; c._spd = c._spd || c.speedMul; c.speedMul = () => 0; c.phase = p; }, pos);
  await page.mouse.click(640, 300);
  await wait(60);
  await G(() => { const c = window.__axenfall.combat; c.speedMul = c._spd; });
}

try {
  // ── boot + opening ──
  await page.goto(base);
  await page.waitForFunction(() => window.__axenfall);
  check('title screen waits for input', await G(() => window.__axenfall.mode === 'boot'));
  check('title screen shows the styled title', await G(() => document.querySelectorAll('.boot-title span').length === 8 && getComputedStyle(document.querySelector('.boot-title')).fontFamily.includes('Cinzel')));
  await page.mouse.click(640, 360);
  await page.waitForFunction(() => window.__axenfall.mode === 'play');
  check('a click on the title goes straight into play (no cinematic)', await G(() => !window.__axenfall.player.locked));
  await wait(1100);
  check('title veil is gone', await G(() => document.getElementById('boot').classList.contains('hidden')));

  // ── movement ──
  const x0 = await G(() => window.__axenfall.player.x);
  await page.keyboard.down('a'); await wait(700); await page.keyboard.up('a');
  const x1 = await G(() => window.__axenfall.player.x);
  check('A walks left', x1 < x0 - 15, `${x0.toFixed(0)} → ${x1.toFixed(0)}`);
  const onGround = await G(() => { const g = window.__axenfall; return Math.abs(g.player.y - (200 + Math.round(5 * Math.sin(g.player.x / 170) + 3 * Math.sin(g.player.x / 53 + 1) + 4 * Math.sin(g.player.x / 410 + 2)))) < 0.5; });
  check('player follows the ground', onGround);

  // ── chopping with the timing bar ──
  await G(() => { const g = window.__axenfall; g.player.x = 800; });
  await wait(100);
  await page.mouse.click(640, 300);
  await wait(80);
  const eng = await G(() => { const g = window.__axenfall; return g.combat.target && g.combat.target.species; });
  check('click next to a tree engages it', eng === 'sapling', String(eng));
  const hp0 = await G(() => window.__axenfall.combat.target.hp);
  await strikeAt(0.5);
  await wait(400);
  const r1 = await G(() => { const g = window.__axenfall; return { hp: g.combat.target?.hp ?? 0, crits: g.state.stats.crits }; });
  check('click on the blue zone lands a critical', r1.crits === 1, `crits=${r1.crits}`);
  check('critical deals 3× damage', hp0 - r1.hp === 18, `dealt ${hp0 - r1.hp}`);
  check('swing squashes the hero on impact', await G(() => window.__axenfall.player.sq !== 0 || window.__axenfall.player.sqV !== 0));
  await strikeAt(0.02);
  await wait(400);
  check('click at the edge misses', await G(() => window.__axenfall.state.stats.misses === 1));
  for (let i = 0; i < 4; i++) {
    const alive = await G(() => window.__axenfall.combat.target?.state === 'alive');
    if (!alive) break;
    await strikeAt(0.5); await wait(350);
  }
  await wait(2500);
  const fell = await G(() => ({ logs: window.__axenfall.state.inv.log_sapling || 0, felled: window.__axenfall.state.stats.felled.sapling || 0 }));
  check('sapling falls and drops logs', fell.felled === 1 && fell.logs >= 3, JSON.stringify(fell));
  const stumped = await page.waitForFunction(() => window.__axenfall.trees.list.some((t) => t.species === 'sapling' && t.state === 'stump' && !t.fall), null, { timeout: 8000 }).then(() => true, () => false);
  check('felled tree lands, rests, dissolves to a stump', stumped);

  // ── trader: sell ──
  await G(() => { const g = window.__axenfall; g.player.x = 175; });
  await wait(100);
  await page.keyboard.press('e');
  await page.waitForSelector('[data-panel="trader"]');
  check('E opens the trader', true);
  await page.click('[data-act="sellAll"]');
  const sold = await G(() => ({ gold: window.__axenfall.state.gold, left: window.__axenfall.state.inv.log_sapling || 0 }));
  check('selling logs pays Gold', sold.gold === fell.logs * 4 && sold.left === 0, JSON.stringify(sold));
  await page.keyboard.press('Escape');
  await wait(100);
  check('Esc closes the panel', await G(() => !window.__axenfall.ui.panel));

  // ── buy an axe and equip it ──
  await G(() => { window.__axenfall.state.gold = 5000; });
  await page.keyboard.press('e');
  await page.waitForSelector('[data-panel="trader"]');
  await page.click('[data-act="tab"][data-arg="axes"]');
  await page.click('[data-act="buyAxe"][data-arg="broadbit"]');
  check('buy Broadbit for 140 Gold', await G(() => !!window.__axenfall.state.axes.broadbit && window.__axenfall.state.gold === 4860));
  await page.keyboard.press('Escape');
  await wait(100);
  await page.keyboard.press('i');
  await page.waitForSelector('[data-panel="bag"]');
  await page.click('[data-act="equip"][data-arg="broadbit"]');
  const z = await G(() => { const g = window.__axenfall; return { eq: g.state.equipped, great: g.combat.zones.great }; });
  check('equipping Broadbit widens the timing zones', z.eq === 'broadbit' && z.great > 0.075, JSON.stringify(z));
  await page.keyboard.press('Escape');

  // ── altar ──
  await G(() => { window.__axenfall.player.x = 318; });
  await wait(80);
  await page.keyboard.press('e');
  await page.waitForSelector('[data-panel="altar"]');
  await page.click('[data-act="pull"][data-arg="10"]');
  await wait(150);
  check('pull starts the full-screen reveal', await G(() => window.__axenfall.ui.fx.open && window.__axenfall.ui.fx.stageN === 'charge'));
  await page.waitForFunction(() => document.querySelectorAll('.gfx .gcard').length === 10, null, { timeout: 5000 });
  const pulls = await G(() => ({ n: window.__axenfall.state.gacha.pulls, gold: window.__axenfall.state.gold }));
  check('10-pull deals 10 cards and charges 1080', pulls.n === 10 && pulls.gold === 4860 - 1080, JSON.stringify(pulls));
  for (let i = 0; i < 3; i++) { await page.mouse.click(640, 360); await wait(120); }
  check('taps skip to the summary with every card face up', await G(() => window.__axenfall.ui.fx.stageN === 'done' && document.querySelectorAll('.gfx .gcard.flip').length === 10));
  await page.click('.gfx [data-g="ok"]');
  check('confirm closes the reveal and keeps the altar open', await G(() => !window.__axenfall.ui.fx.open && window.__axenfall.ui.panel === 'altar'));
  await page.keyboard.press('Escape');

  // ── sawmill ──
  await G(() => { const g = window.__axenfall; g.player.x = 610; g.state.inv.log_pine = 6; });
  await wait(80);
  await page.keyboard.press('e');
  await page.waitForSelector('[data-panel="sawmill"]');
  await page.click('[data-act="upgradeMill"]');
  check('repair the sawmill', await G(() => window.__axenfall.state.sawmill.level === 1));
  await page.click('[data-act="job"][data-arg="plank:pine"][data-n="max"]');
  check('start a plank job with all pine logs', await G(() => window.__axenfall.state.sawmill.jobs.length === 1 && !window.__axenfall.state.inv.log_pine));
  await G(() => window.__axenfall.processing.tick(60));
  await wait(400);
  check('planks are produced', await G(() => window.__axenfall.state.inv.plank_pine === 3), String(await G(() => window.__axenfall.state.inv.plank_pine)));
  await page.keyboard.press('Escape');

  // ── class ──
  await G(() => { const g = window.__axenfall; g.player.x = 440; g.state.stats.crits = 30; g.state.essence = 30; });
  await wait(80);
  await page.keyboard.press('e');
  await page.waitForSelector('[data-panel="guild"]');
  const before = await G(() => window.__axenfall.combat.mods.critMul);
  await page.click('[data-act="buyClass"][data-arg="precision_warden"]');
  const after = await G(() => ({ cls: window.__axenfall.state.classes.active, m: window.__axenfall.combat.mods.critMul }));
  check('buying Precision Warden activates it and raises crit power', after.cls === 'precision_warden' && after.m > before, JSON.stringify(after));
  await page.keyboard.press('Escape');
  await wait(100);
  await page.keyboard.press('q');
  await wait(60);
  check('Q uses the class ability (Focus)', await G(() => window.__axenfall.combat.focusUntil > window.__axenfall.now));

  // ── inspecting the elder tree zooms out, walking zooms back in ──
  await G(() => { const g = window.__axenfall; g.player.x = 925; });
  await wait(100);
  await page.keyboard.press('e');
  await page.waitForFunction(() => window.__axenfall.engine.zoom < 0.8, null, { timeout: 5000 }).catch(() => {});
  const zin = await G(() => ({ z: window.__axenfall.engine.zoom, H: window.__axenfall.engine.H }));
  check('inspecting Mossroot zooms the camera out to frame it', zin.z < 0.8 && zin.H > 300, JSON.stringify(zin));
  await wait(600);
  await page.keyboard.down('d'); await wait(400); await page.keyboard.up('d');
  const zback = await page.waitForFunction(() => window.__axenfall.engine.zoom > 0.99, null, { timeout: 6000 }).then(() => true, () => false);
  check('moving eases the camera back in', zback);

  // ── World 2: the rock path, travel, and back ──
  await G(() => { const g = window.__axenfall; g.player.x = 2290; });
  await wait(100);
  await page.keyboard.press('e');
  await page.waitForSelector('[data-panel="gate"]');
  check('locked rock path opens its unlock panel', await G(() => document.querySelector('[data-act="unlockGate"]').disabled));
  await G(() => { const g = window.__axenfall; g.state.stats.felled.silverleaf = 3; g.state.gold += 3000; g.state.essence += 12; g.ui.render(); });
  await page.click('[data-act="unlockGate"]');
  check('paying clears the path', await G(() => window.__axenfall.state.unlocks.sunveil === true && !window.__axenfall.ui.panel));
  await wait(200);
  await page.keyboard.press('e');
  await page.waitForFunction(() => window.__axenfall.state.region === 'sunveil' && !window.__axenfall.traveling, null, { timeout: 5000 }).catch(async (e) => { console.log(await G(() => { const g = window.__axenfall; return JSON.stringify({ r: g.state.region, tr: g.traveling, x: g.player.x, p: g.ui.panel, u: g.state.unlocks, en: g.input.enabled }); }), errors); throw e; });
  const sv = await G(() => { const g = window.__axenfall; return { trees: g.trees.list.map((t) => t.species), x: Math.round(g.player.x), card: document.getElementById('discover').classList.contains('show'), hud: document.getElementById('region').textContent }; });
  check('E on the open path travels to Sunveil Forest', sv.trees.includes('oak') && sv.trees.includes('dawnwood') && sv.x === 150 && sv.card, JSON.stringify(sv));
  check('HUD names the new region', sv.hud.includes('해비침 숲'), sv.hud);
  await G(() => { const g = window.__axenfall; g.player.x = 300; });
  await wait(100);
  await page.keyboard.press('e');
  await page.waitForSelector('[data-panel="trader"]');
  check('Sunveil has its own trader', await G(() => document.querySelector('.panel h2').textContent.includes('하니')));
  await page.keyboard.press('Escape');
  await G(() => { const g = window.__axenfall; g.player.x = 96; });
  await wait(100);
  await page.keyboard.press('e');
  await page.waitForFunction(() => window.__axenfall.state.region === 'evergreen' && !window.__axenfall.traveling, null, { timeout: 5000 });
  check('the west path leads back to the valley gate', await G(() => Math.round(window.__axenfall.player.x) === 2250));
  await G(() => { window.__axenfall.player.x = 2290; });
  await wait(100);
  await page.keyboard.press('e');
  await page.waitForFunction(() => window.__axenfall.state.region === 'sunveil' && !window.__axenfall.traveling, null, { timeout: 5000 });

  // ── night ──
  await G(() => window.__axenfall.day.set(22));
  await wait(150);
  check('time of day can be night', await G(() => window.__axenfall.day.cur.night > 0.9));

  // ── save + reload ──
  const snap = await G(() => { const g = window.__axenfall; g.save(); return { gold: g.state.gold, axes: Object.keys(g.state.axes).length, mill: g.state.sawmill.level, cls: g.state.classes.active, region: g.state.region }; });
  await page.goto(base + '?play');
  await page.waitForFunction(() => window.__axenfall && window.__axenfall.mode === 'play');
  const back = await G(() => { const g = window.__axenfall; return { gold: g.state.gold, axes: Object.keys(g.state.axes).length, mill: g.state.sawmill.level, cls: g.state.classes.active, region: g.state.region }; });
  check('progress survives a reload', JSON.stringify(snap) === JSON.stringify(back), JSON.stringify(back));

  // ── performance: let it run and measure ──
  await G(() => { const g = window.__axenfall; g.day.set(9); g.player.x = 1300; });
  await wait(3000);
  const fps = await G(() => window.__axenfall.engine.fps);
  check('frame rate (headless, software rendering)', fps > 20, `${fps.toFixed(0)} fps`);
  // ── phone: landscape touch screen ──
  const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const m = await mctx.newPage();
  m.on('pageerror', (e) => errors.push('mobile: ' + e.message));
  await m.goto(base);
  await m.waitForFunction(() => window.__axenfall);
  await m.touchscreen.tap(420, 200);
  await m.waitForFunction(() => window.__axenfall.mode === 'play');
  check('touch controls appear on a phone', await m.evaluate(() => !document.getElementById('touch').classList.contains('hidden')));
  const mx0 = await m.evaluate(() => window.__axenfall.player.x);
  await m.dispatchEvent('[data-key="d"]', 'pointerdown', { pointerId: 1 });
  await m.waitForTimeout(600);
  await m.dispatchEvent('[data-key="d"]', 'pointerup', { pointerId: 1 });
  check('▶ button walks right', (await m.evaluate(() => window.__axenfall.player.x)) > mx0 + 20);
  await m.evaluate(() => { window.__axenfall.player.x = 800; });
  await m.waitForTimeout(150);
  await m.dispatchEvent('[data-chop]', 'pointerdown', { pointerId: 2 });
  await m.waitForTimeout(150);
  check('도끼 button starts chopping', await m.evaluate(() => !!window.__axenfall.combat.target));
  await m.dispatchEvent('[data-chop]', 'pointerdown', { pointerId: 3 });
  await m.waitForTimeout(700);
  check('도끼 button strikes', await m.evaluate(() => window.__axenfall.state.stats.hits + window.__axenfall.state.stats.misses === 1));
  check('phone layout has no horizontal overflow', await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await mctx.close();
  // ── phone: portrait ──
  const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const pp = await pctx.newPage();
  pp.on('pageerror', (e) => errors.push('portrait: ' + e.message));
  await pp.goto(base);
  await pp.waitForFunction(() => window.__axenfall);
  await pp.touchscreen.tap(195, 300);
  await pp.waitForFunction(() => window.__axenfall.mode === 'play');
  const pv = await pp.evaluate(() => { const e = window.__axenfall.engine; return { portrait: e.portrait, H: e.H, W: e.W, view: e.display.getBoundingClientRect().height }; });
  check('portrait keeps a landscape-like game view', pv.portrait && pv.H <= 340 && pv.W >= 240 && pv.view < 844 - 200, JSON.stringify(pv));
  const boxes = await pp.evaluate(() => [...document.querySelectorAll('#touch .tb')].map((b) => { const r = b.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }));
  const overlap = boxes.some((a, i) => boxes.some((b, j) => j > i && a[0] < b[2] - 2 && b[0] < a[2] - 2 && a[1] < b[3] - 2 && b[1] < a[3] - 2));
  check('portrait controls sit in the deck without overlapping', !overlap && boxes.every((r) => r[1] >= pv.view - 1 && r[2] <= 390), JSON.stringify(boxes.map((r) => r.map(Math.round))));
  await pctx.close();
  check('no runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (e) {
  check('test harness', false, e.message.split('\n')[0]);
}
await browser.close();
server.close();
console.log(`\n${pass}/${pass + fail} browser checks passed`);
process.exit(fail ? 1 : 0);
