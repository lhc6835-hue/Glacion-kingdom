// Economy simulation on the real combat/economy code. A simulated player with an average hand
// (judgment mix below) walks the real tree layout, chops, sells, buys and processes, and we record
// how long each milestone takes. Usage: node tests/balance.mjs [minutes] [skill: casual|average|expert]
import { createState, count } from '../src/game/GameState.js';
import { Events } from '../src/core/Events.js';
import { mulberry32 } from '../src/core/Rng.js';
import { TreeField } from '../src/game/Trees.js';
import { Combat } from '../src/game/Combat.js';
import { Economy } from '../src/game/Economy.js';
import { Gacha } from '../src/game/Gacha.js';
import { Processing } from '../src/game/Processing.js';
import { axeDamage } from '../src/game/AxeStats.js';
import { TREE_SPOTS, STATIONS } from '../src/game/World.js';
import { ITEMS } from '../src/data/items.js';
import { TREES } from '../src/data/trees.js';
import { GACHA } from '../src/data/balance.js';
import { SAWMILL_LEVELS } from '../src/data/processing.js';

const REPAIR = SAWMILL_LEVELS[1].cost.gold;

const MIN = +(process.argv[2] || 90);
const SKILL = process.argv[3] || 'average';
// Probability of each judgment per swing for a player of this skill.
const HANDS = {
  casual: { crit: 0.06, great: 0.22, good: 0.32, weak: 0.22, miss: 0.18 },
  average: { crit: 0.14, great: 0.3, good: 0.3, weak: 0.16, miss: 0.1 },
  expert: { crit: 0.35, great: 0.4, good: 0.17, weak: 0.06, miss: 0.02 },
};
const POS = { crit: 0.5, great: 0.45, good: 0.4, weak: 0.33, miss: 0.02 };
const hand = HANDS[SKILL];
const rng = mulberry32(42);
const pickJ = () => { let r = rng(), acc = 0; for (const [j, p] of Object.entries(hand)) { acc += p; if (r < acc) return j; } return 'miss'; };

const state = createState();
const events = new Events();
const trees = new TreeField(events, rng);
TREE_SPOTS.forEach(([sp, x], i) => trees.spawn(sp, x, { seed: i }));
let now = 0, x = 905;
const combat = new Combat({ state, trees, events, rng, isDay: () => (now / 60) % 24 < 13 });
const eco = new Economy(state, events);
const gacha = new Gacha(state, eco, events, rng);
const mill = new Processing(state, events, rng);
const st = Object.fromEntries(STATIONS.map((s) => [s.id, s.x]));
const marks = {};
const mark = (k) => { if (!(k in marks)) marks[k] = now; };
const step = (dt) => { now += dt; trees.update(dt, now, (t) => combat.onFell(t, now)); combat.update(dt, now, dt); mill.tick(dt); };
const walk = (to) => { const t = Math.abs(to - x) / 85; /* players mostly run (Shift) */ for (let s = 0; s < t; s += 0.25) step(0.25); x = to; };
let felledValue = 0;
events.on('fell', ({ rewards }) => { for (const r of rewards) if (ITEMS[r.id]) felledValue += ITEMS[r.id].value * r.n; });

function bestAxe() {
  let best = state.equipped;
  for (const id of Object.keys(state.axes)) if (axeDamage(id, state.axes[id].stars) > axeDamage(best, state.axes[best].stars)) best = id;
  if (best !== state.equipped) { eco.equip(best); combat.refreshMods(); }
}

// Gold per second of chopping one tree of this species with the current axe (rough estimate).
function rate(sp) {
  const d = TREES[sp];
  const m = combat.mods;
  let avg = 0;
  for (const [j, p] of Object.entries(hand)) {
    const mul = { crit: 3 + m.critMul, great: 1.7, good: 1.25, weak: 0.75, miss: 0 }[j];
    if (!mul) continue;
    const raw = m.damage * mul;
    avg += p * Math.max(raw * 0.1, raw - d.def);
  }
  const swings = d.hp / Math.max(0.01, avg);
  const secs = swings * (combat.swingTotal() + 0.12) + 1.5;
  return ((d.logs + 1) * ITEMS[d.log].value) / secs;
}

const haveWardenOr = () => state.classes.owned.length > 1 || state.gold > 4000;
function sellAndShop() {
  walk(st.trader);
  // feed the mill first when it is running (logs are worth more as planks)
  if (mill.level) {
    walk(st.sawmill);
    for (const o of mill.options()) { const n = mill.maxBatch(o); if (n > 0 && mill.freeSlot() >= 0 && o.recipe.from) mill.start(o.key, n); }
    walk(st.trader);
  }
  eco.sellAllWood();
  if (state.gold > 0) mark('firstSale');
  if (!state.axes.broadbit && state.gold >= 140) { eco.buyAxe('broadbit'); mark('firstAxe'); bestAxe(); }
  if (state.sawmill.level && !state.axes.ironheart && state.gold >= 560 + 200) { eco.buyAxe('ironheart'); mark('ironheart'); bestAxe(); }
  if (state.sawmill.level === 0 && state.gold >= REPAIR) { mill.upgrade(); mark('sawmill1'); }
  if (state.sawmill.level === 1 && haveWardenOr() && state.gold >= 1400 + 200) { mill.upgrade(); mark('sawmill2'); }
  if (eco.canBuyClass('precision_warden')) { eco.buyClass('precision_warden'); combat.refreshMods(); mark('classWarden'); }
  const haveWarden = state.classes.owned.includes('precision_warden');
  if ((haveWarden || state.gacha.pulls === 0) && state.gold >= GACHA.ten.gold + 300 && state.gacha.pulls < 10 * (1 + state.classes.owned.length)) { gacha.pull(10); mark('first10pull'); bestAxe(); }
  if (eco.canBuyClass('pyroforger')) { eco.buyClass('pyroforger'); eco.setClass('precision_warden'); combat.refreshMods(); mark('classPyro'); }
  if (state.sawmill.level === 2 && eco.state.gold >= 5200 && count(state, 'amber_sap') >= 8) { mill.upgrade(); mark('sawmill3'); }
}

while (now < MIN * 60) {
  // choose the best standing tree by gold/sec minus walking
  let best = null, bs = -1;
  for (const t of trees.list) {
    if (t.state !== 'alive') continue;
    // once Gold is no longer the bottleneck, go after amber for the Pyroforger and the drying shed
    const wantAmber = state.gold > 3000 && count(state, 'amber_sap') < 20 && t.species === 'birch';
    const score = rate(t.species) * (wantAmber ? 4 : 1) / (1 + Math.abs(t.x - x) / 85 / 20);
    if (score > bs) { bs = score; best = t; }
  }
  if (!best) { step(1); continue; }
  walk(best.x - 13);
  combat.engage(best);
  while (best.state === 'alive' && now < MIN * 60) {
    combat.phase = POS[pickJ()];
    combat.attack(now);
    const T = combat.swingTotal() + 0.12;
    for (let s = 0; s < T; s += 1 / 30) step(1 / 30);
  }
  combat.disengage();
  for (let s = 0; s < 1.5; s++) step(1);
  mark('firstFell');
  const invValue = Object.entries(state.inv).filter(([id]) => ITEMS[id].kind !== 'mat').reduce((a, [id, n]) => a + ITEMS[id].value * n, 0);
  const goal = !state.axes.broadbit ? 140 : !state.sawmill.level ? REPAIR : 600;
  if (state.gold + invValue >= goal || invValue > 400) sellAndShop();
}

const fm = (s) => (s === undefined ? '—' : `${(s / 60).toFixed(1)}분`);
console.log(`Axenfall economy sim · ${SKILL} hand · ${MIN} min`);
for (const k of ['firstFell', 'firstSale', 'firstAxe', 'sawmill1', 'ironheart', 'first10pull', 'sawmill2', 'classWarden', 'classPyro', 'sawmill3']) console.log(`  ${k.padEnd(12)} ${fm(marks[k])}`);
console.log(`  gold now ${state.gold}, earned ${state.stats.goldEarned}, essence ${state.essence}, amber ${count(state, 'amber_sap')}`);
console.log(`  felled ${JSON.stringify(state.stats.felled)}`);
console.log(`  crits ${state.stats.crits}, pulls ${state.gacha.pulls}, axes ${Object.keys(state.axes).length}, equipped ${state.equipped}`);
console.log(`  gold/min overall ${(state.stats.goldEarned / MIN).toFixed(0)}`);
