// Sawmill production. Jobs run on the sawmill's own clock (game seconds + capped offline time),
// so changing the system clock cannot finish work early.
import { SAWMILL_LEVELS, RECIPES, OFFLINE_CAP_SECONDS } from '../data/processing.js';
import { ITEMS, WOOD_IDS } from '../data/items.js';
import { TREES } from '../data/trees.js';
import { CLASS_BY_ID } from '../data/classes.js';
import { add, remove, count, pay, canAfford } from './GameState.js';

const HARDNESS = Object.fromEntries(Object.values(TREES).map((t) => [t.log.slice(4), t.hardness]));

export class Processing {
  constructor(state, events, rng = Math.random) { this.state = state; this.events = events; this.rng = rng; }

  get mill() { return this.state.sawmill; }
  get level() { return this.mill.level; }
  get info() { return SAWMILL_LEVELS[this.level] || null; }
  classMods() { return CLASS_BY_ID[this.state.classes.active].mods; }

  slots() { return this.level ? this.info.slots + (this.classMods().procSlots || 0) : 0; }
  speed() { return this.level ? this.info.speed * (this.classMods().procSpeed || 1) : 1; }

  upgradeCost() {
    const next = SAWMILL_LEVELS[this.level + 1];
    if (!next) return null;
    const disc = this.classMods().upgradeDiscount || 0;
    const cost = { ...next.cost };
    if (disc) cost.gold = Math.round(cost.gold * (1 - disc));
    return cost;
  }

  upgrade() {
    const c = this.upgradeCost();
    if (!c || !pay(this.state, c)) return false;
    this.mill.level++;
    this.events.emit('sawmillLevel', { level: this.mill.level });
    return true;
  }

  // All recipe variants available now: stage recipes expanded per wood.
  options() {
    const out = [];
    for (const r of RECIPES) {
      if (r.level > this.level) continue;
      if (r.from) {
        for (const w of WOOD_IDS) {
          const input = `${r.from}_${w}`, output = `${r.to}_${w}`;
          out.push({ recipe: r, key: `${r.id}:${w}`, inputs: { [input]: r.n }, out: output, time: r.time * (HARDNESS[w] || 1) });
        }
      } else {
        const inputs = { ...r.inputs };
        if (r.essence) inputs.essence = r.essence;
        out.push({ recipe: r, key: r.id, inputs, out: r.out, time: r.time * r.hardness });
      }
    }
    return out;
  }

  option(key) { return this.options().find((o) => o.key === key) || null; }

  jobTime(opt) { return opt.time / this.speed(); }

  maxBatch(opt) {
    let n = Infinity;
    for (const [id, k] of Object.entries(opt.inputs)) n = Math.min(n, Math.floor(count(this.state, id) / k));
    return n;
  }

  freeSlot() {
    const used = new Set(this.mill.jobs.map((j) => j.slot));
    for (let i = 0; i < this.slots(); i++) if (!used.has(i)) return i;
    return -1;
  }

  // Queues `batch` outputs of one option into a free slot. Inputs are taken up front.
  start(key, batch = 1) {
    const opt = this.option(key);
    if (!opt || batch < 1) return false;
    const slot = this.freeSlot();
    if (slot < 0 || this.maxBatch(opt) < batch) return false;
    const cost = Object.fromEntries(Object.entries(opt.inputs).map(([id, k]) => [id, k * batch]));
    if (!canAfford(this.state, cost)) return false;
    pay(this.state, cost);
    const per = this.jobTime(opt);
    const quality = this.info.quality;
    this.mill.jobs.push({ slot, key, out: opt.out, total: batch, done: 0, per, next: this.mill.clock + per, quality, refund: cost });
    this.events.emit('jobStarted', { key, batch });
    return true;
  }

  cancel(slot) {
    const i = this.mill.jobs.findIndex((j) => j.slot === slot);
    if (i < 0) return false;
    const j = this.mill.jobs[i];
    // Refund the inputs of the outputs not yet made.
    const left = (j.total - j.done) / j.total;
    for (const [id, n] of Object.entries(j.refund)) add(this.state, id, Math.floor(n * left));
    this.mill.jobs.splice(i, 1);
    return true;
  }

  // Advances the sawmill clock. Finished outputs go straight to the inventory.
  tick(seconds) {
    if (seconds <= 0) return;
    this.mill.clock += seconds;
    for (let i = this.mill.jobs.length - 1; i >= 0; i--) {
      const j = this.mill.jobs[i];
      let made = 0;
      while (j.done < j.total && this.mill.clock >= j.next) { j.done++; made++; j.next += j.per; }
      if (made) {
        add(this.state, j.out, made);
        // Better mills sometimes produce an extra piece (quality above 1).
        let bonus = 0;
        for (let k = 0; k < made; k++) if (this.rng() < j.quality - 1) bonus++;
        if (bonus) add(this.state, j.out, bonus);
        this.events.emit('produced', { id: j.out, n: made + bonus });
      }
      if (j.done >= j.total) this.mill.jobs.splice(i, 1);
    }
  }

  advance(seconds) {
    if (!this.mill.jobs.length) return false;
    this.tick(seconds);
    return true;
  }

  // Offline progress since the last save. Backwards clocks give nothing; long absences are capped.
  applyOffline(savedAt, now) {
    if (!savedAt || now <= savedAt) return 0;
    const s = Math.min(OFFLINE_CAP_SECONDS, (now - savedAt) / 1000);
    if (this.mill.jobs.length) this.tick(s);
    return s;
  }

  jobProgress(j) {
    const startOfCurrent = j.next - j.per;
    const cur = Math.min(1, Math.max(0, (this.mill.clock - startOfCurrent) / j.per));
    return { cur, done: j.done, total: j.total, left: Math.max(0, j.next - this.mill.clock) + (j.total - j.done - 1) * j.per };
  }

  profit(opt) {
    let inV = 0;
    for (const [id, n] of Object.entries(opt.inputs)) inV += (id === 'essence' ? 30 : ITEMS[id].value) * n;
    return ITEMS[opt.out].value - inV;
  }
}
