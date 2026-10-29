// Folds an axe (with its stars) and the active class into one modifier set used by combat.
// Stacking rules: additive within a type, then clamped by TIMING.caps so no build trivialises the bar.
import { AXE_BY_ID } from '../data/axes.js';
import { GRADES } from '../data/grades.js';
import { CLASS_BY_ID } from '../data/classes.js';
import { TIMING, STARS } from '../data/balance.js';

export function axeDamage(axeId, stars = 0) {
  const a = AXE_BY_ID[axeId];
  return GRADES[a.grade].base * a.f * (1 + STARS.dmgPerStar * stars);
}

export function computeMods(axeId, stars, classId) {
  const a = AXE_BY_ID[axeId];
  const k = 1 + STARS.effectPerStar * stars; // stars strengthen effect magnitudes a little
  const m = {
    damage: axeDamage(axeId, stars),
    swift: 0, wide: 0, critZone: 0, steady: 0, greatZone: 0,
    critMul: 0, weakGuard: false, combo: 0,
    hard: [], execute: [], day: 0, night: 0,
    burn: null, frost: null, poison: null, chain: null, void: null,
    spirit: 0, harvest: 0, essence: [], rareMat: 0, gold: 0, regrow: 0,
    // class
    fellLogs: 0, critChain: 0, critChainMax: 0, missKeepsHalfCombo: false,
    burnMul: 1, statusDur: 1, critIgnite: null,
  };
  for (const e of a.effects) {
    switch (e.type) {
      case 'swift': m.swift += e.p * k; break;
      case 'wide': m.wide += e.p * k; break;
      case 'critZone': m.critZone += e.p * k; break;
      case 'steady': m.steady += e.p * k; break;
      case 'critMul': m.critMul += e.v * k; break;
      case 'weakGuard': m.weakGuard = true; break;
      case 'combo': m.combo += e.p * k; break;
      case 'hard': m.hard.push({ p: e.p * k, def: e.def }); break;
      case 'execute': m.execute.push({ p: e.p * k, below: e.below }); break;
      case 'day': m.day += e.p * k; break;
      case 'night': m.night += e.p * k; break;
      case 'burn': m.burn = { p: e.p * k, dur: e.dur }; break;
      case 'frost': m.frost = { def: e.def * k, dur: e.dur, shatter: e.shatter * k }; break;
      case 'poison': m.poison = { p: e.p * k, dur: e.dur, max: e.max, def: e.def }; break;
      case 'chain': m.chain = { chance: Math.min(1, e.chance * k), mul: e.mul, max: e.max, onCrit: !!e.onCrit }; break;
      case 'void': m.void = { every: e.every, mul: e.mul * k }; break;
      case 'spirit': m.spirit += e.p * k; break;
      case 'harvest': m.harvest += e.logs; break;
      case 'essence': m.essence.push({ p: Math.min(1, e.p * k), n: e.n }); break;
      case 'rareMat': m.rareMat += e.p * k; break;
      case 'gold': m.gold += e.p * k; break;
      case 'regrow': m.regrow += e.p * k; break;
      default: throw new Error('unimplemented axe effect ' + e.type);
    }
  }
  const c = CLASS_BY_ID[classId]?.mods || {};
  if (c.fellLogs) m.fellLogs += c.fellLogs;
  if (c.critMul) m.critMul += c.critMul;
  if (c.critChain) { m.critChain = c.critChain; m.critChainMax = c.critChainMax; }
  if (c.greatZone) m.greatZone += c.greatZone;
  if (c.missKeepsHalfCombo) m.missKeepsHalfCombo = true;
  if (c.burnMul) m.burnMul = c.burnMul;
  if (c.statusDur) m.statusDur = c.statusDur;
  if (c.critIgnite) m.critIgnite = c.critIgnite;

  const cap = TIMING.caps;
  m.wide = Math.min(m.wide, cap.wide);
  m.critZone = Math.min(m.critZone, cap.critZone);
  m.steady = Math.min(m.steady, cap.steady);
  m.swift = Math.min(m.swift, cap.swift);
  m.spirit = Math.min(m.spirit, 1);
  return m;
}

// Zone half-widths after modifiers. Zones stay nested: crit ⊂ great ⊂ good ⊂ weak.
export function zonesFor(m) {
  const z = TIMING.zones;
  const crit = Math.min(0.2, z.crit * (1 + m.critZone + m.wide * 0.5));
  const great = Math.min(0.3, Math.max(crit + 0.01, z.great * (1 + m.wide + m.greatZone)));
  const good = Math.min(0.4, Math.max(great + 0.01, z.good * (1 + m.wide)));
  const weak = Math.min(0.5, Math.max(good + 0.01, z.weak * (1 + m.wide)));
  return { crit, great, good, weak };
}

export function judge(pos, zones) {
  const d = Math.abs(pos - 0.5);
  if (d <= zones.crit) return 'crit';
  if (d <= zones.great) return 'great';
  if (d <= zones.good) return 'good';
  if (d <= zones.weak) return 'weak';
  return 'miss';
}
