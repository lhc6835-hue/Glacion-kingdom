// Axe altar. Weighted grade roll with a Rare+ pity every 10 pulls and an Epic+ soft/hard pity.
import { GRADES } from '../data/grades.js';
import { AXES } from '../data/axes.js';
import { GACHA } from '../data/balance.js';
import { pay } from './GameState.js';

const RARE = 3, EPIC = 5;
const POOLS = GRADES.map((_, g) => AXES.filter((a) => a.grade === g));

// Current grade weights given the pity counters; exported so the UI shows exactly what is rolled.
export function gradeWeights(g) {
  const w = GRADES.map((gr) => gr.weight);
  if (g.sinceEpic + 1 >= GACHA.epicHard) for (let i = 0; i < EPIC; i++) w[i] = 0;
  else {
    if (g.sinceEpic + 1 > GACHA.epicSoftStart) {
      const k = 1 + GACHA.epicSoftStep * (g.sinceEpic + 1 - GACHA.epicSoftStart);
      for (let i = EPIC; i < w.length; i++) w[i] *= k;
    }
    if (g.sinceRare + 1 >= GACHA.rarePity) for (let i = 0; i < RARE; i++) w[i] = 0;
  }
  return w;
}

export function rollGrade(weights, r) {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = r * total;
  for (let i = 0; i < weights.length; i++) { x -= weights[i]; if (x < 0) return i; }
  return weights.length - 1;
}

export class Gacha {
  constructor(state, economy, events, rng) { this.state = state; this.economy = economy; this.events = events; this.rng = rng; }

  pull(times) {
    const cost = times === 10 ? GACHA.ten : GACHA.single;
    if (!pay(this.state, cost)) return null;
    const results = [];
    for (let i = 0; i < times; i++) results.push(this.pullOne());
    this.events.emit('gacha', { results });
    return results;
  }

  pullOne() {
    const g = this.state.gacha;
    const grade = rollGrade(gradeWeights(g), this.rng());
    const pool = POOLS[grade];
    const axe = pool[Math.floor(this.rng() * pool.length)];
    g.pulls++;
    g.sinceRare = grade >= RARE ? 0 : g.sinceRare + 1;
    g.sinceEpic = grade >= EPIC ? 0 : g.sinceEpic + 1;
    const r = this.economy.grantAxe(axe.id);
    g.history.unshift({ id: axe.id, grade, dup: r.dup });
    if (g.history.length > 60) g.history.length = 60;
    return { id: axe.id, grade, ...r };
  }
}
