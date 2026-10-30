// Turns a loadout (mold + scoops + weapon) and the run's toppings into final stats and procs.
// Flavor traits only count while their scoop is still on the stack, and lower scoops are weaker.
import { MOLD } from '../../shared/molds.js';
import { FLAVOR } from '../../shared/flavors.js';
import { WEAPON } from '../../shared/weapons.js';
import { TOPPING } from '../data/toppings.js';
import { LAYER_STRENGTH, LEVEL_BONUS } from '../../shared/grades.js';

const BASE = {
  hp: 40, spd: 1, dmg: 1, atk: 1, crit: 0.05, critDmg: 1.6, dodge: 0, armor: 0, regen: 0, pickup: 1, coin: 1,
  dashCd: 1, proj: 0, pierce: 0, knock: 1, iframe: 1, area: 1, lifesteal: 0, size: 1, floaty: 0, dashDist: 1,
};
const INT = new Set(['proj', 'pierce']);

// layers: flavor ids bottom → top that are still alive. levels: { flavorId: lvl } (1-based)
export function computeStats({ mold, layers, weapon, toppings = [], levels = {} }) {
  const st = { ...BASE };
  const procs = [];
  const md = MOLD[mold];
  const noDecay = md && md.fx.procs && md.fx.procs.some((p) => p.k === 'noDecay');
  const vanillaAmp = layers.includes('vanilla') ? 0.4 * strengthOf(layers, layers.lastIndexOf('vanilla'), noDecay, levels.vanilla) : 0;

  const apply = (fx, s) => {
    if (!fx) return;
    for (const [k, v] of Object.entries(fx.stats || {})) {
      if (INT.has(k)) { if (s >= 0.55) st[k] += v; }
      else st[k] = (st[k] ?? 0) + v * s;
    }
    for (const p of fx.procs || []) procs.push({ ...p, s });
  };

  if (md) apply(md.fx, 1);
  layers.forEach((f, i) => {
    const fl = FLAVOR[f];
    if (!fl) return;
    let s = strengthOf(layers, i, noDecay, levels[f]);
    if (f !== 'vanilla') s *= 1 + vanillaAmp;
    apply(fl.fx, s);
  });
  for (const t of toppings) apply(TOPPING[t] && TOPPING[t].fx, 1);

  st.armor = Math.min(0.75, st.armor);
  st.dodge = Math.min(0.75, st.dodge);
  st.crit = Math.min(1, st.crit);
  st.dashCd = Math.max(0.35, st.dashCd);
  st.size = Math.max(0.6, st.size);
  st.hp = Math.round(st.hp);

  const w = WEAPON[weapon] || WEAPON.spoon;
  const wl = levels['w:' + w.id] || 1;
  st.weaponMul = 1 + LEVEL_BONUS * (wl - 1);
  return { stats: st, procs };
}

function strengthOf(layers, i, noDecay, lvl = 1) {
  const fromTop = layers.length - 1 - i;
  const base = noDecay ? 1 : LAYER_STRENGTH[Math.min(fromTop, LAYER_STRENGTH.length - 1)];
  return base * (1 + LEVEL_BONUS * (lvl - 1));
}
