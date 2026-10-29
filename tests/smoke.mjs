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
page.on('pageerror', (e) => errors.push(e.message));
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
  await page.mouse.click(640, 360);
  await page.waitForFunction(() => window.__axenfall.mode === 'cinematic');
  check('opening cinematic starts on click', true);
  await page.click('#skip');
  await page.waitForFunction(() => window.__axenfall.mode === 'play');
  check('skip button ends the cinematic once', await G(() => window.__axenfall.cine.done && !window.__axenfall.player.locked));

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
  check('sapling falls and drops logs', fell.felled === 1 && fell.logs === 3, JSON.stringify(fell));

  // ── trader: sell ──
  await G(() => { const g = window.__axenfall; g.player.x = 175; });
  await wait(100);
  await page.keyboard.press('e');
  await page.waitForSelector('[data-panel="trader"]');
  check('E opens the trader', true);
  await page.click('[data-act="sellAll"]');
  const sold = await G(() => ({ gold: window.__axenfall.state.gold, left: window.__axenfall.state.inv.log_sapling || 0 }));
  check('selling logs pays Gold', sold.gold === 12 && sold.left === 0, JSON.stringify(sold));
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
  await wait(200);
  const pulls = await G(() => ({ n: window.__axenfall.state.gacha.pulls, cards: document.querySelectorAll('.card').length, gold: window.__axenfall.state.gold }));
  check('10-pull shows 10 cards and charges 1080', pulls.n === 10 && pulls.cards === 10 && pulls.gold === 4860 - 1080, JSON.stringify(pulls));
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

  // ── night ──
  await G(() => window.__axenfall.day.set(22));
  await wait(150);
  check('time of day can be night', await G(() => window.__axenfall.day.cur.night > 0.9));

  // ── save + reload ──
  const snap = await G(() => { const g = window.__axenfall; g.save(); return { gold: g.state.gold, axes: Object.keys(g.state.axes).length, mill: g.state.sawmill.level, cls: g.state.classes.active }; });
  await page.goto(base + '?play');
  await page.waitForFunction(() => window.__axenfall && window.__axenfall.mode === 'play');
  const back = await G(() => { const g = window.__axenfall; return { gold: g.state.gold, axes: Object.keys(g.state.axes).length, mill: g.state.sawmill.level, cls: g.state.classes.active }; });
  check('progress survives a reload', JSON.stringify(snap) === JSON.stringify(back), JSON.stringify(back));

  // ── performance: let it run and measure ──
  await G(() => { const g = window.__axenfall; g.day.set(9); g.player.x = 1300; });
  await wait(3000);
  const fps = await G(() => window.__axenfall.engine.fps);
  check('frame rate (headless, software rendering)', fps > 20, `${fps.toFixed(0)} fps`);
  check('no runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (e) {
  check('test harness', false, e.message.split('\n')[0]);
}
await browser.close();
server.close();
console.log(`\n${pass}/${pass + fail} browser checks passed`);
process.exit(fail ? 1 : 0);
