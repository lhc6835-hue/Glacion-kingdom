// Timing-bar axe combat. The judgment is taken the instant the player clicks; the swing animation
// then plays and the already-decided hit lands on the impact frame.
import { TIMING, JUDGE, SWING, COMBO, DEFENSE } from '../data/balance.js';
import { TREES } from '../data/trees.js';
import { CLASS_BY_ID } from '../data/classes.js';
import { computeMods, zonesFor, judge } from './AxeStats.js';

export class Combat {
  constructor({ state, trees, events, rng, isDay }) {
    this.state = state;
    this.trees = trees;
    this.events = events;
    this.rng = rng;
    this.isDay = isDay;
    this.target = null;
    this.phase = 0;            // marker phase; pos = triangle wave of phase
    this.swing = null;         // { t, total, impactAt, hit, landed }
    this.queued = null;        // a judgment taken during a swing, executed when the swing allows
    this.combo = 0;
    this.critStreak = 0;
    this.landed = 0;           // landed hits, for void counters
    this.lastJudge = null;     // { j, pos, at } for the bar's ghost marker
    this.cooldowns = {};
    this.focusUntil = 0;
    this.heavyReady = false;
    this.igniteCharges = 0;
    this.pending = [];         // delayed chain strikes { at, tree, amount }
    this.refreshMods();
  }

  refreshMods() {
    const s = this.state;
    this.mods = computeMods(s.equipped, s.axes[s.equipped]?.stars || 0, s.classes.active);
    this.zones = zonesFor(this.mods);
  }

  get markerPos() { const p = this.phase % 2; return p < 1 ? p : 2 - p; }

  speedMul(now) {
    const sp = this.target ? TREES[this.target.species].markerSpeed : 1;
    return sp * (1 - this.mods.steady) * (now < this.focusUntil ? 0.65 : 1);
  }

  engage(tree) {
    if (this.target === tree) return;
    this.target = tree;
    this.phase = 0;
    this.lastJudge = null;
    this.events.emit('engage', { tree });
  }

  disengage() {
    if (!this.target) return;
    this.target = null;
    this.queued = null;
    this.events.emit('disengage', {});
  }

  recoverTime() { return SWING.recover * (1 - this.mods.swift); }

  swingTotal() { return SWING.windup + SWING.strike + SWING.follow + this.recoverTime(); }

  // The player clicked: take the judgment now.
  attack(now) {
    if (!this.target || this.target.state !== 'alive') return null;
    let j = judge(this.markerPos, this.zones);
    if (j === 'miss' && this.mods.weakGuard) j = 'weak';
    const take = { j, pos: this.markerPos, at: now };
    this.lastJudge = take;
    if (this.swing && this.swing.t < SWING.windup + SWING.strike + SWING.follow) {
      this.queued = take; // buffered: lands after the current swing's follow-through
      return take;
    }
    this.startSwing(take, now);
    return take;
  }

  startSwing(take, now) {
    const hit = this.resolve(take.j, this.target, now);
    this.swing = { t: 0, total: this.swingTotal(), impactAt: SWING.windup + SWING.strike, hit, landed: false, j: take.j };
    this.events.emit('swing', { j: take.j, tree: this.target });
  }

  update(dt, now, worldDt) {
    if (this.target) this.phase += dt * TIMING.sweepsPerSecond * this.speedMul(now);
    if (this.swing) {
      const s = this.swing;
      s.t += worldDt; // swings respect hitstop; the marker does not
      if (!s.landed && s.t >= s.impactAt) { s.landed = true; this.land(s.hit, now); }
      if (s.t >= s.total) this.swing = null;
      else if (this.queued && s.t >= SWING.windup + SWING.strike + SWING.follow) {
        const q = this.queued; this.queued = null; this.startSwing(q, now);
      }
    } else if (this.queued) { const q = this.queued; this.queued = null; this.startSwing(q, now); }
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i];
      if (now >= p.at) {
        this.pending.splice(i, 1);
        if (p.tree.state === 'alive') {
          const felled = this.trees.damage(p.tree, p.amount, now);
          this.events.emit('chain', { tree: p.tree, amount: p.amount });
          if (felled) this.onFell(p.tree, now);
        }
      }
    }
    if (this.target && this.target.state !== 'alive' && !this.swing) this.disengage();
  }

  // Computes the full outcome of one swing. Nothing is applied yet.
  resolve(j, tree, now) {
    const m = this.mods;
    const d = TREES[tree.species];
    const hit = { j, tree, damage: 0, crit: j === 'crit', void: false, shatter: false, statuses: [], chains: [], combo: 0 };
    // Combo and crit streak bookkeeping happens at judgment time so queued swings stay consistent.
    if (j === 'miss') {
      this.combo = m.missKeepsHalfCombo ? Math.floor(this.combo / 2) : 0;
      this.critStreak = 0;
      hit.combo = this.combo;
      return hit;
    }
    if (j !== 'weak') this.combo = Math.min(COMBO.max, this.combo + 1);
    this.critStreak = j === 'crit' ? this.critStreak + 1 : 0;
    hit.combo = this.combo;
    this.landed++;

    let mul = JUDGE[j].mul;
    if (j === 'crit') {
      mul += m.critMul;
      if (m.frost && this.trees.isBrittle(tree, now)) { mul *= 1 + m.frost.shatter; hit.shatter = true; }
    }
    let bonus = this.combo * (COMBO.perStack + m.combo);
    for (const h of m.hard) if (d.def >= h.def) bonus += h.p;
    for (const e of m.execute) if (tree.hp / tree.maxHp < e.below) bonus += e.p;
    bonus += this.isDay() ? m.day : m.night;
    if (j === 'crit' && m.critChain) bonus += Math.min(this.critStreak - 1, m.critChainMax) * m.critChain;
    let raw = m.damage * mul * (1 + bonus);
    if (this.heavyReady) { raw *= 1.6; this.heavyReady = false; hit.heavy = true; }
    let def = this.trees.def(tree, now);
    if (m.void && this.landed % m.void.every === 0) { def = 0; raw *= m.void.mul; hit.void = true; }
    hit.raw = raw;
    hit.damage = Math.max(1, Math.round(Math.max(raw * DEFENSE.minFrac, raw - def)));

    const dur = m.statusDur;
    const burns = [];
    if (m.burn) burns.push(m.burn);
    if (j === 'crit' && m.critIgnite) burns.push(m.critIgnite);
    if (this.igniteCharges > 0) { burns.push({ p: 0.6, dur: 4 }); this.igniteCharges--; }
    for (const b of burns) {
      const total = raw * b.p * m.burnMul;
      const dps = Math.max(total * 0.25, total - def * 0.5 * b.dur) / b.dur;
      hit.statuses.push({ kind: 'burn', dps, dur: b.dur * dur });
    }
    if (m.frost) hit.statuses.push({ kind: 'frost', def: m.frost.def, dur: m.frost.dur * dur });
    if (m.poison) hit.statuses.push({ kind: 'poison', dps: raw * m.poison.p, dur: m.poison.dur * dur, max: m.poison.max, def: m.poison.def });
    if (m.chain) {
      const n0 = m.chain.onCrit && j === 'crit' ? 1 : 0;
      let n = 0;
      for (let i = 0; i < m.chain.max; i++) if (i < n0 || this.rng() < m.chain.chance) n++; else break;
      for (let i = 0; i < n; i++) hit.chains.push(Math.max(1, Math.round(Math.max(raw * m.chain.mul * DEFENSE.minFrac, raw * m.chain.mul - def))));
    }
    return hit;
  }

  land(hit, now) {
    const tree = hit.tree;
    const st = this.state.stats;
    if (hit.j === 'miss') { st.misses++; this.events.emit('hit', hit); return; }
    if (tree.state !== 'alive') return;
    st.hits++;
    if (hit.crit) st.crits++;
    st.bestCombo = Math.max(st.bestCombo, hit.combo);
    for (const s of hit.statuses) {
      if (s.kind === 'burn') {
        if (!tree.burn || tree.burn.dps < s.dps || tree.burn.until < now + s.dur) tree.burn = { dps: Math.max(s.dps, tree.burn?.dps || 0), until: now + s.dur };
      } else if (s.kind === 'frost') tree.frost = { def: s.def, until: now + s.dur };
      else if (s.kind === 'poison') {
        tree.poison.push({ dps: s.dps, until: now + s.dur, def: s.def });
        if (tree.poison.length > s.max) tree.poison.shift();
      }
    }
    tree.shake = hit.crit ? 1 : hit.j === 'great' ? 0.75 : 0.5;
    tree.shakeDir = 1;
    tree.hitFlash = 1;
    const felled = this.trees.damage(tree, hit.damage, now);
    this.events.emit('hit', hit);
    hit.chains.forEach((amount, i) => this.pending.push({ at: now + 0.09 * (i + 1), tree, amount }));
    if (felled) this.onFell(tree, now);
  }

  onFell(tree, now) {
    const rewards = this.trees.rewards(tree, this.state, this.mods, now);
    this.events.emit('fell', { tree, rewards });
    this.pending = this.pending.filter((p) => p.tree !== tree);
  }

  // Q: the active class ability.
  useActive(now, processing) {
    const c = CLASS_BY_ID[this.state.classes.active];
    const a = c.active;
    if ((this.cooldowns[a.id] || 0) > now) return false;
    if (a.id === 'heavy_chop') this.heavyReady = true;
    else if (a.id === 'focus') this.focusUntil = now + a.dur;
    else if (a.id === 'ignite') this.igniteCharges = a.charges;
    else if (a.id === 'overclock') { if (!processing.advance(20)) return false; }
    this.cooldowns[a.id] = now + a.cd;
    this.events.emit('active', { id: a.id, cls: c });
    return true;
  }

  cooldownLeft(now) {
    const a = CLASS_BY_ID[this.state.classes.active].active;
    return Math.max(0, (this.cooldowns[a.id] || 0) - now);
  }
}
