// Per-tree size, shared by logic (HP, logs) and art so a big tree both looks and plays big.
// k: 0 = young and slender, 1 = old and massive.
import { mulberry32 } from '../core/Rng.js';

export function treeShape(seed) {
  const r = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const k = Math.pow(r(), 0.9);
  return {
    k,
    h: 0.7 + k * 0.62 + (r() - 0.5) * 0.12,      // height scale
    w: 0.78 + k * 0.38 + (r() - 0.5) * 0.3,      // crown width scale, independent of height
    trunk: 0.72 + k * 1.15 + (r() - 0.5) * 0.35, // trunk thickness scale
    lean: (r() - 0.5) * 2,                       // -1..1
    crown: r(),                                  // crown style variant
  };
}

// HP and wood grow with age; old trees give an extra log.
export const sizeHp = (k) => 0.8 + 0.45 * k;
export const sizeLogs = (k) => (k > 0.72 ? 1 : 0);
