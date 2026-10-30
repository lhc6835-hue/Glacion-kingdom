// Tree instances: health, status effects (burn / frost / poison), felling and regrowth.
// Pure logic; the renderer reads the same objects for shake, fall and regrow animation.
import { TREES } from '../data/trees.js';
import { ITEMS } from '../data/items.js';
import { add } from './GameState.js';
import { treeShape, sizeHp, sizeLogs } from './TreeShape.js';

const DOT_TICK = 0.5;
// Felling: a short creak, then the trunk tips over like a rod hinged at the stump, bounces off
// the ground, rests, and dissolves. Regrowth: the stump sinks, a sprout pops up, the tree springs up.
export const FALL = { creak: 0.42, rest: 0.85, fade: 0.75, lie: Math.PI / 2 - 0.07 };
export const GROW = { sprout: 0.9, rise: 2.0 };

export class TreeField {
  constructor(events, rng) {
    this.events = events;
    this.rng = rng;
    this.list = [];
    this.nextId = 1;
  }

  spawn(species, x, opts = {}) {
    const seed = opts.seed ?? Math.floor(this.rng() * 1e9);
    const hp = Math.round(TREES[species].hp * sizeHp(treeShape(seed).k));
    const t = {
      uid: this.nextId++, species, home: opts.home || species, x, seed,
      hp, maxHp: hp, state: 'alive', respawnAt: 0, felledAt: 0,
      burn: null, frost: null, poison: [], dotAcc: 0, dotTimer: 0,
      shake: 0, shakeDir: 1, hitFlash: 0, fallDir: 1, grow: 1, lastHitAt: -99,
    };
    this.list.push(t);
    return t;
  }

  def(t, now) {
    const d = TREES[t.species];
    let def = d.def;
    if (t.frost && t.frost.until > now) def -= t.frost.def;
    for (const p of t.poison) if (p.until > now) def -= p.def;
    return Math.max(0, def);
  }

  isBrittle(t, now) { return !!(t.frost && t.frost.until > now); }

  // Returns true when this damage fells the tree.
  damage(t, amount, now) {
    if (t.state !== 'alive' || amount <= 0) return false;
    t.hp = Math.max(0, t.hp - amount);
    t.lastHitAt = now;
    if (t.hp <= 0) {
      t.state = 'falling'; t.felledAt = now; t.burn = null; t.frost = null; t.poison = [];
      t.fall = { phase: 'creak', t: 0, a: 0, w: 0, flex: 0, bounces: 0, alpha: 1 };
      return true;
    }
    return false;
  }

  update(dt, now, onDotFell) {
    for (const t of this.list) {
      if (t.shake > 0) t.shake = Math.max(0, t.shake - dt * 4);
      if (t.hitFlash > 0) t.hitFlash = Math.max(0, t.hitFlash - dt * 6);
      if (t.state === 'alive') this.tickDots(t, dt, now, onDotFell);
      else if (t.state === 'falling') this.stepFall(t, dt);
      else if (t.state === 'stump' && now >= t.respawnAt) this.regrow(t);
      else if (t.state === 'growing') {
        t.growT += dt;
        t.grow = Math.min(1, t.growT / (GROW.sprout + GROW.rise));
        if (!t.sprung && t.growT >= GROW.sprout) { t.sprung = true; this.events.emit('treeSprouted', { tree: t }); }
        if (t.grow >= 1) { t.state = 'alive'; this.events.emit('treeSprung', { tree: t }); }
      }
    }
  }

  // Tall trees fall slower: the hinge constant scales like g / length.
  height(t) { return TREES[t.species].art.h * treeShape(t.seed).h; }

  stepFall(t, dt) {
    const f = t.fall;
    f.t += dt;
    if (f.phase === 'creak') {
      // the cut gives: a few shudders while it starts to lean
      const u = Math.min(1, f.t / FALL.creak);
      f.a = 0.05 * u * u + Math.sin(f.t * 38) * 0.008 * (1 - u);
      if (u >= 1) { f.phase = 'fall'; f.w = 0.32; f.t = 0; }
      return;
    }
    if (f.phase === 'fall') {
      const k = 1500 / Math.max(40, this.height(t));
      // small substeps keep the hinge smooth even through a hitstop-chopped dt
      const n = Math.ceil(dt / 0.005);
      for (let i = 0; i < n; i++) {
        const h = dt / n;
        f.w += k * Math.sin(f.a) * h;
        f.a += f.w * h;
        // the crown trails the trunk while it accelerates, then whips through on impact
        f.flex += ((-f.w * 0.05) - f.flex) * Math.min(1, h * 9);
        if (f.a >= FALL.lie) {
          f.a = FALL.lie;
          const impact = f.w;
          if (f.bounces < 2 && impact > 0.5) {
            f.w = -impact * (f.bounces ? 0.18 : 0.26);
            f.flex = impact * 0.09;
            this.events.emit('treeLanded', { tree: t, impact, first: f.bounces === 0 });
            f.bounces++;
          } else { f.w = 0; f.phase = 'rest'; f.t = 0; if (!f.bounces) this.events.emit('treeLanded', { tree: t, impact, first: true }); break; }
        }
      }
      return;
    }
    f.flex *= Math.max(0, 1 - dt * 6);
    if (f.phase === 'rest' && f.t >= FALL.rest) { f.phase = 'fade'; f.t = 0; this.events.emit('treeDissolve', { tree: t }); }
    if (f.phase === 'fade') {
      f.alpha = Math.max(0, 1 - f.t / FALL.fade);
      if (f.alpha <= 0) { t.state = 'stump'; t.fall = null; }
    }
  }

  // Rough length of the whole felling animation, used to schedule regrowth.
  fallTime(t) { return FALL.creak + 1.4 * Math.sqrt(this.height(t) / 90) + FALL.rest + FALL.fade; }

  tickDots(t, dt, now, onDotFell) {
    let dps = 0;
    if (t.burn) { if (t.burn.until > now) dps += t.burn.dps; else t.burn = null; }
    if (t.poison.length) {
      t.poison = t.poison.filter((p) => p.until > now);
      for (const p of t.poison) dps += p.dps;
    }
    if (!dps) { t.dotAcc = 0; t.dotTimer = 0; return; }
    t.dotAcc += dps * dt;
    t.dotTimer += dt;
    if (t.dotTimer >= DOT_TICK) {
      t.dotTimer -= DOT_TICK;
      const n = Math.floor(t.dotAcc);
      if (n >= 1) {
        t.dotAcc -= n;
        const kind = t.burn ? 'burn' : 'poison';
        const felled = this.damage(t, n, now);
        this.events.emit('dot', { tree: t, amount: n, kind });
        if (felled) onDotFell(t);
      }
    }
  }

  regrow(t) {
    const d = TREES[t.home];
    let species = t.home;
    // A felled pine sometimes comes back as the rare Mossheart Pine.
    for (const [id, td] of Object.entries(TREES)) {
      if (td.rareSpawn && td.rareSpawn.replaces === t.home && this.rng() < td.rareSpawn.chance) species = id;
    }
    const sd = TREES[species];
    t.species = species;
    t.seed = Math.floor(this.rng() * 1e9);
    t.hp = t.maxHp = Math.round(sd.hp * sizeHp(treeShape(t.seed).k));
    t.state = 'growing';
    t.grow = 0; t.growT = 0; t.sprung = false;
    if (species !== t.home) this.events.emit('rareSpawn', { tree: t });
    return d;
  }

  // Rolls and grants the rewards of a felled tree. Returns the list for popups.
  rewards(t, state, mods, now) {
    const d = TREES[t.species];
    const r = this.rng;
    const out = [];
    let logs = d.logs + sizeLogs(treeShape(t.seed).k) + mods.fellLogs + mods.harvest + (r() < mods.spirit ? 1 : 0);
    add(state, d.log, logs);
    out.push({ id: d.log, n: logs });
    for (const drop of d.drops) {
      const chance = Math.min(1, drop.chance * (drop.item ? 1 + mods.rareMat : 1));
      if (r() < chance) {
        const n = drop.min + Math.floor(r() * (drop.max - drop.min + 1));
        if (drop.essence) { add(state, 'essence', n); out.push({ id: 'essence', n }); }
        else { add(state, drop.item, n); out.push({ id: drop.item, n }); }
      }
    }
    for (const e of mods.essence) if (r() < e.p) { add(state, 'essence', e.n); out.push({ id: 'essence', n: e.n }); }
    if (mods.gold > 0) {
      const g = Math.max(1, Math.round(logs * ITEMS[d.log].value * mods.gold));
      add(state, 'gold', g); out.push({ id: 'gold', n: g });
    }
    state.stats.felled[t.species] = (state.stats.felled[t.species] || 0) + 1;
    state.codex.trees[t.species] = true;
    t.respawnAt = now + this.fallTime(t) + 0.5 + d.respawn * (1 - Math.min(0.8, mods.regrow));
    return out;
  }
}
