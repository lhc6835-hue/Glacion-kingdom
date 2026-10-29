// Logic tests for combat, economy, gacha, processing and saving. Runs in Node with no browser.
import { createState, add, count } from '../src/game/GameState.js';
import { Events } from '../src/core/Events.js';
import { mulberry32 } from '../src/core/Rng.js';
import { TreeField } from '../src/game/Trees.js';
import { Combat } from '../src/game/Combat.js';
import { Economy } from '../src/game/Economy.js';
import { Gacha, gradeWeights } from '../src/game/Gacha.js';
import { Processing } from '../src/game/Processing.js';
import { SaveManager, memoryStorage } from '../src/game/SaveManager.js';
import { computeMods, zonesFor, judge, axeDamage } from '../src/game/AxeStats.js';
import { AXES } from '../src/data/axes.js';
import { GRADES } from '../src/data/grades.js';
import { TREES } from '../src/data/trees.js';
import { ITEMS } from '../src/data/items.js';
import { JUDGE, GACHA } from '../src/data/balance.js';
import { SAWMILL_LEVELS } from '../src/data/processing.js';

let pass = 0, fail = 0;
const check = (name, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };

function world(seed = 1) {
  const state = createState();
  const events = new Events();
  const rng = mulberry32(seed);
  const trees = new TreeField(events, rng);
  let day = true;
  const combat = new Combat({ state, trees, events, rng, isDay: () => day });
  const economy = new Economy(state, events);
  const gacha = new Gacha(state, economy, events, rng);
  const processing = new Processing(state, events, rng);
  return { state, events, rng, trees, combat, economy, gacha, processing, setDay: (d) => { day = d; } };
}

// Drives one swing at a chosen bar position and runs time until it lands.
function swingAt(w, pos, now) {
  w.combat.phase = pos; // phase in [0,1] maps straight to position
  const take = w.combat.attack(now.t);
  for (let i = 0; i < 40; i++) { now.t += 1 / 60; w.combat.update(1 / 60, now.t, 1 / 60); w.trees.update(1 / 60, now.t, () => {}); }
  return take;
}

// ── data integrity ──
check('15 grades', GRADES.length === 15);
check('gacha weights sum to exactly 100%', GRADES.reduce((a, g) => a + g.weight, 0) === 10000);
const perGrade = GRADES.map((_, g) => AXES.filter((a) => a.grade === g).length);
check('every grade has at least 3 axes', perGrade.every((n) => n >= 3), perGrade.join(','));
check('axe ids unique', new Set(AXES.map((a) => a.id)).size === AXES.length, `${AXES.length} axes`);
let allOk = true;
for (const a of AXES) try { computeMods(a.id, 5, 'pyroforger'); } catch (e) { allOk = false; console.log(e.message); }
check('every axe effect is implemented', allOk);
for (const t of Object.values(TREES)) if (!ITEMS[t.log]) allOk = false;
check('every tree drops a known log item', allOk);

// ── timing judgment ──
{
  const z = zonesFor(computeMods('worn_hatchet', 0, 'lumberjack'));
  check('crit at centre', judge(0.5, z) === 'crit');
  check('great just outside crit', judge(0.5 + z.crit + 0.005, z) === 'great');
  check('good band', judge(0.5 + z.great + 0.005, z) === 'good');
  check('weak band', judge(0.5 + z.good + 0.005, z) === 'weak');
  check('miss at the edge', judge(0.02, z) === 'miss');
  const zw = zonesFor(computeMods('broadbit', 0, 'lumberjack'));
  check('Broadbit widens zones', zw.great > z.great && zw.good > z.good);
  const zMax = zonesFor({ ...computeMods('eternal_balance', 5, 'precision_warden'), wide: 99, critZone: 99 });
  check('zones stay nested and inside the bar', zMax.crit < zMax.great && zMax.great < zMax.good && zMax.good < zMax.weak && zMax.weak <= 0.5);
}

// ── damage by judgment ──
{
  const w = world();
  const t = w.trees.spawn('sapling', 100);
  w.combat.engage(t);
  const now = { t: 0 };
  const base = axeDamage('worn_hatchet', 0);
  swingAt(w, 0.5, now);
  const afterCrit = t.hp;
  check('critical deals ×3 (sapling has no defence)', TREES.sapling.hp - afterCrit === Math.round(base * JUDGE.crit.mul * 1.02), `dealt ${TREES.sapling.hp - afterCrit}`);
  const hp0 = t.hp;
  swingAt(w, 0.01, now);
  check('miss deals nothing and breaks the combo', t.hp === hp0 && w.combat.combo === 0);
  check('stats count crits', w.state.stats.crits === 1 && w.state.stats.misses === 1);
}

// ── fell and rewards ──
{
  const w = world();
  const t = w.trees.spawn('sapling', 100);
  w.combat.engage(t);
  const now = { t: 0 };
  let fell = null;
  w.events.on('fell', (e) => { fell = e; });
  for (let i = 0; i < 10 && t.state === 'alive'; i++) swingAt(w, 0.5, now);
  check('tree falls at 0 HP', t.state !== 'alive' && t.hp === 0);
  const logs = count(w.state, 'log_sapling');
  check('felling grants logs (+1 lumberjack bonus)', logs === TREES.sapling.logs + 1 && !!fell, `logs=${logs}`);
  // Regrowth
  for (let i = 0; i < 60 * 40; i++) { now.t += 1 / 60; w.trees.update(1 / 60, now.t, () => {}); }
  check('tree regrows', t.state === 'alive' && t.hp === t.maxHp);
}

// ── defence, burn, chain, void ──
{
  const w = world(7);
  const t = w.trees.spawn('silverleaf', 100);
  w.combat.engage(t);
  const now = { t: 0 };
  const hp0 = t.hp;
  swingAt(w, 0.5 - 0.1, now); // good
  check('defence reduces weak axes to the minimum', hp0 - t.hp === Math.max(1, Math.round(Math.max(6 * 1.25 * 1.02 * 0.1, 6 * 1.25 * 1.02 - 7))), `dealt ${hp0 - t.hp}`);

  add(w.state, 'gold', 0);
  w.state.axes.flamebite = { stars: 0, count: 1 };
  w.economy.equip('flamebite'); w.combat.refreshMods();
  const h1 = t.hp;
  swingAt(w, 0.5, now);
  const afterHit = t.hp;
  for (let i = 0; i < 60 * 5; i++) { now.t += 1 / 60; w.trees.update(1 / 60, now.t, () => {}); }
  check('Flamebite burn keeps damaging after the hit', t.hp < afterHit && afterHit < h1, `hit ${h1 - afterHit}, burn ${afterHit - t.hp}`);

  t.hp = t.maxHp = 1e7; // keep the tree standing for the remaining checks
  w.state.axes.endless_chain = { stars: 0, count: 1 };
  w.economy.equip('endless_chain'); w.combat.refreshMods();
  let chains = 0; w.events.on('chain', () => chains++);
  swingAt(w, 0.5, now);
  check('Endless Chain strikes 3 extra times', chains === 3, `${chains}`);

  w.state.axes.abyss_fang = { stars: 0, count: 1 };
  w.economy.equip('abyss_fang'); w.combat.refreshMods();
  const voids = [];
  w.events.on('hit', (h) => voids.push(h.void));
  w.combat.landed = 0;
  for (let i = 0; i < 3 && t.state === 'alive'; i++) swingAt(w, 0.5 - 0.06, now);
  check('Abyss Fang: every 3rd landed hit ignores defence', voids.slice(-3).join() === 'false,false,true', voids.join());
}

// ── classes change combat ──
{
  const w = world();
  const lj = computeMods('worn_hatchet', 0, 'lumberjack');
  const pw = computeMods('worn_hatchet', 0, 'precision_warden');
  check('Precision Warden raises the crit multiplier', pw.critMul - lj.critMul > 0.5);
  check('Precision Warden widens the great zone', zonesFor(pw).great > zonesFor(lj).great);
  w.state.gold = 5000; w.state.essence = 50;
  check('class requirements block the purchase', !w.economy.buyClass('precision_warden'));
  w.state.stats.crits = 30;
  check('class can be bought once requirements are met', w.economy.buyClass('precision_warden') && w.state.classes.active === 'precision_warden' && w.state.gold === 5000 - 2200);
  w.combat.refreshMods();
  const t = w.trees.spawn('sapling', 100); w.combat.engage(t);
  const now = { t: 0 };
  swingAt(w, 0.6, now); // combo 1
  w.combat.combo = 6;
  swingAt(w, 0.01, now);
  check('Warden keeps half the combo on a miss', w.combat.combo === 3, `${w.combat.combo}`);
}

// ── economy ──
{
  const w = world();
  add(w.state, 'log_pine', 10);
  const g = w.economy.sell('log_pine', 10);
  check('selling pays item value', g === ITEMS.log_pine.value * 10 && w.state.gold === g && count(w.state, 'log_pine') === 0);
  w.state.gold = 50;
  check('cannot buy an axe without enough Gold', !w.economy.buyAxe('light_woodsaxe'));
  w.state.gold = 1000;
  check('buy axe from trader', w.economy.buyAxe('light_woodsaxe') && w.state.axes.light_woodsaxe && w.state.gold === 910);
  check('cannot buy the same axe twice', !w.economy.buyAxe('light_woodsaxe'));
  check('altar-only axes are not sold', !w.economy.buyAxe('flamebite'));
  w.state.shards = 100;
  check('star upgrade spends shards', w.economy.upgradeAxe('light_woodsaxe') && w.state.axes.light_woodsaxe.stars === 1 && w.state.shards === 88);
}

// ── gacha ──
{
  const w = world(3);
  w.state.gold = 1e9;
  const res = [];
  for (let i = 0; i < 300; i++) res.push(...w.gacha.pull(10));
  check('3000 pulls charged correctly', w.state.gold === 1e9 - 300 * GACHA.ten.gold);
  let gap = 0, maxGapRare = 0, gapE = 0, maxGapEpic = 0;
  for (const r of res) { gap = r.grade >= 3 ? 0 : gap + 1; gapE = r.grade >= 5 ? 0 : gapE + 1; maxGapRare = Math.max(maxGapRare, gap); maxGapEpic = Math.max(maxGapEpic, gapE); }
  check('Rare+ pity: never 10 pulls in a row without Rare+', maxGapRare <= GACHA.rarePity - 1, `max gap ${maxGapRare}`);
  check('Epic+ hard pity holds', maxGapEpic <= GACHA.epicHard - 1, `max gap ${maxGapEpic}`);
  const dups = res.filter((r) => r.dup).length;
  check('duplicates turn into shards', dups > 0 && w.state.shards > 0, `${dups} dups, ${w.state.shards} shards`);
  const wts = gradeWeights({ sinceRare: 0, sinceEpic: 0 });
  check('displayed weights equal data weights at zero pity', wts.every((v, i) => v === GRADES[i].weight));
  const common = res.filter((r) => r.grade === 0).length / res.length;
  check('Common rate near its 38% weight (pity lowers it a bit)', common > 0.28 && common < 0.4, (common * 100).toFixed(1) + '%');
}

// ── processing ──
{
  const w = world();
  w.state.gold = SAWMILL_LEVELS[1].cost.gold + 50;
  check('sawmill repair', w.processing.upgrade() && w.processing.level === 1 && w.state.gold === 50);
  add(w.state, 'log_pine', 10);
  const opt = w.processing.option('plank:pine');
  check('plank recipe is worth more than its logs', ITEMS.plank_pine.value > 2 * ITEMS.log_pine.value, `${ITEMS.plank_pine.value} vs ${2 * ITEMS.log_pine.value}`);
  check('job starts and takes inputs', w.processing.start('plank:pine', 5) && count(w.state, 'log_pine') === 0);
  check('only one slot at level 1', !w.processing.start('plank:pine', 1));
  w.processing.tick(opt.time * 2 + 0.01);
  check('two planks after two job times', count(w.state, 'plank_pine') === 2, `${count(w.state, 'plank_pine')}`);
  w.processing.tick(1e6);
  check('job finishes and frees the slot', count(w.state, 'plank_pine') === 5 && w.state.sawmill.jobs.length === 0);
  add(w.state, 'log_pine', 2);
  w.processing.start('plank:pine', 1);
  const t0 = Date.now();
  check('backwards clock gives no offline time', w.processing.applyOffline(t0, t0 - 3600e3) === 0);
  check('offline time is capped at 8h', w.processing.applyOffline(t0 - 48 * 3600e3, t0) === 8 * 3600);
  check('offline time completes jobs', count(w.state, 'plank_pine') === 6);
  w.state.gold = 1e6; w.state.amber_sap = 0; add(w.state, 'amber_sap', 20); w.state.essence = 100; add(w.state, 'moss_core', 10);
  w.processing.upgrade(); w.processing.upgrade(); w.processing.upgrade(); w.processing.upgrade();
  check('sawmill reaches level 5 and unlocks crafts', w.processing.level === 5 && !!w.processing.option('amber_panel'));
  check('no level 6 yet', w.processing.upgradeCost() === null);
}

// ── saving ──
{
  const store = memoryStorage();
  const sm = new SaveManager(store);
  const s = createState();
  s.gold = 1234; s.axes.flamebite = { stars: 2, count: 3 }; s.sawmill.level = 2;
  check('save succeeds', sm.save(s));
  const back = sm.load();
  check('load restores the same progress', back.source === 'save' && back.state.gold === 1234 && back.state.axes.flamebite.stars === 2 && back.state.sawmill.level === 2);
  s.gold = 99; sm.save(s);
  store.setItem('axenfall-save', '{broken');
  const rec = sm.load();
  check('corrupt save falls back to the backup', rec.source === 'backup' && rec.state.gold === 1234);
  const mig = sm.load.call({ storage: { getItem: (k) => (k === 'axenfall-save' ? JSON.stringify({ gold: 5, equipped: 'nope' }) : null) } });
  check('partial old saves are migrated', mig.state.gold === 5 && mig.state.equipped === 'worn_hatchet' && mig.state.classes.active === 'lumberjack');
}

console.log(`\n${pass}/${pass + fail} logic checks passed`);
process.exit(fail ? 1 : 0);
