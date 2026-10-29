// Tree instances: health, status effects (burn / frost / poison), felling and regrowth.
// Pure logic; the renderer reads the same objects for shake, fall and regrow animation.
import { TREES } from '../data/trees.js';
import { ITEMS } from '../data/items.js';
import { add } from './GameState.js';

const DOT_TICK = 0.5;

export class TreeField {
  constructor(events, rng) {
    this.events = events;
    this.rng = rng;
    this.list = [];
    this.nextId = 1;
  }

  spawn(species, x, opts = {}) {
    const d = TREES[species];
    const t = {
      uid: this.nextId++, species, home: opts.home || species, x, seed: opts.seed ?? Math.floor(this.rng() * 1e9),
      hp: d.hp, maxHp: d.hp, state: 'alive', respawnAt: 0, felledAt: 0,
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
    if (t.hp <= 0) { t.state = 'falling'; t.felledAt = now; t.burn = null; t.frost = null; t.poison = []; return true; }
    return false;
  }

  update(dt, now, onDotFell) {
    for (const t of this.list) {
      if (t.shake > 0) t.shake = Math.max(0, t.shake - dt * 4);
      if (t.hitFlash > 0) t.hitFlash = Math.max(0, t.hitFlash - dt * 6);
      if (t.state === 'alive') this.tickDots(t, dt, now, onDotFell);
      else if (t.state === 'falling' && now - t.felledAt > this.fallTime(t) + 1.2) t.state = 'stump';
      else if (t.state === 'stump' && now >= t.respawnAt) this.regrow(t);
      else if (t.state === 'growing') {
        t.grow = Math.min(1, t.grow + dt / 2.5);
        if (t.grow >= 1) t.state = 'alive';
      }
    }
  }

  fallTime(t) { return 0.6 + TREES[t.species].art.h / 90; }

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
    t.hp = t.maxHp = sd.hp;
    t.state = 'growing';
    t.grow = 0;
    t.seed = Math.floor(this.rng() * 1e9);
    if (species !== t.home) this.events.emit('rareSpawn', { tree: t });
    return d;
  }

  // Rolls and grants the rewards of a felled tree. Returns the list for popups.
  rewards(t, state, mods, now) {
    const d = TREES[t.species];
    const r = this.rng;
    const out = [];
    let logs = d.logs + mods.fellLogs + mods.harvest + (r() < mods.spirit ? 1 : 0);
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
    t.respawnAt = now + this.fallTime(t) + 1.2 + d.respawn * (1 - Math.min(0.8, mods.regrow));
    return out;
  }
}
