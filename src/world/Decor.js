import { Simplex2, hash2 } from './noise.js';
import { CELL, N, HALF, LAKE, START } from './Layout.js';
import { F_NOTREE, F_WATER, F_ROAD, LEVEL_STEP } from './WorldData.js';
import * as T from '../art/trees.js';

// Vegetation and natural clutter: paints the plant library once, then scatters it across the
// world by biome so each region has its own character (blossom by the lake, autumn to the east,
// dark firs to the north, an old deep forest to the south).

export const PPM = 20;

export function paintNatureLibrary(atlas) {
  const P = T.PALETTES;
  const lib = {};
  const add = (name, img) => { (lib[name] ||= []).push(atlas.add(img)); };
  let s = 100;
  const range = (a, b, k) => a + (b - a) * ((k * 0.618) % 1);
  for (let k = 0; k < 6; k++) add('oak', T.paintBroadleaf(s++, { ppm: PPM, palette: P.oak, height: range(8, 11, k), width: range(6, 8.5, k + 2), shape: k % 3 === 0 ? 'wide' : 'round' }));
  for (let k = 0; k < 5; k++) add('spring', T.paintBroadleaf(s++, { ppm: PPM, palette: P.spring, height: range(7, 10, k), width: range(5, 7, k + 1), shape: k % 2 ? 'tall' : 'round' }));
  for (let k = 0; k < 5; k++) add('deep', T.paintBroadleaf(s++, { ppm: PPM, palette: P.deep, height: range(10, 14, k), width: range(7, 10, k + 3), shape: 'wide' }));
  for (let k = 0; k < 6; k++) add('blossom', T.paintBroadleaf(s++, { ppm: PPM, palette: P.blossom, height: range(6, 8.5, k), width: range(6, 8, k + 1), shape: k % 2 ? 'wide' : 'round', trunkFrac: 0.38 }));
  for (let k = 0; k < 3; k++) add('magenta', T.paintBroadleaf(s++, { ppm: PPM, palette: P.magenta, height: range(5, 7, k), width: range(5, 6.5, k) }));
  for (let k = 0; k < 5; k++) add('autumn', T.paintBroadleaf(s++, { ppm: PPM, palette: P.autumn, height: range(7, 9.5, k), width: range(6, 8, k + 2) }));
  for (let k = 0; k < 3; k++) add('gold', T.paintBroadleaf(s++, { ppm: PPM, palette: P.gold, height: range(7, 9, k), width: range(5.5, 7, k) }));
  for (let k = 0; k < 6; k++) add('pine', T.paintConifer(s++, { ppm: PPM, height: range(10, 15, k), width: range(4.2, 6, k + 1) }));
  for (let k = 0; k < 4; k++) add('column', T.paintColumn(s++, { ppm: PPM, height: range(10, 14, k), width: range(2.6, 3.4, k) }));
  for (let k = 0; k < 4; k++) add('bush', T.paintBush(s++, { ppm: PPM, palette: k % 2 ? P.oak : P.spring, width: range(2.2, 3.4, k), height: range(1.4, 2.1, k) }));
  const fl = [[1, 0.62, 0.78], [1, 0.97, 0.92], [1, 0.86, 0.35], [0.78, 0.6, 1]];
  for (let k = 0; k < 4; k++) add('flowerbush', T.paintBush(s++, { ppm: PPM, palette: P.spring, flowers: fl[k], width: 2.4, height: 1.6 }));
  for (let k = 0; k < 2; k++) add('autumnbush', T.paintBush(s++, { ppm: PPM, palette: P.autumn, width: 2.6, height: 1.7 }));
  const tc = [[0.42, 0.66, 0.28], [0.55, 0.72, 0.3], [0.32, 0.55, 0.3]];
  for (let k = 0; k < 8; k++) add('tuft', T.paintGrassTuft(s++, { ppm: PPM, color: tc[k % 3], flower: k % 3 === 1 ? fl[k % 4] : null, width: 1.3, height: range(0.6, 1.1, k) }));
  for (let k = 0; k < 3; k++) add('reeds', T.paintReeds(s++, { ppm: PPM }));
  for (let k = 0; k < 6; k++) add('rock', T.paintRock(s++, { ppm: PPM, width: range(1.4, 3.6, k), height: range(1, 2.4, k), mossy: k % 3 !== 2 }));
  return lib;
}

const TREE_TRUNK = { oak: 0.55, spring: 0.45, deep: 0.7, blossom: 0.45, magenta: 0.4, autumn: 0.5, gold: 0.45, pine: 0.45, column: 0.35 };

export function scatterNature(world, lib, layer, shadows, collision) {
  const biome = new Simplex2(77), grove = new Simplex2(78);
  const H = world.height, F = world.flags;
  const pick = (arr, h) => arr[Math.floor(h * arr.length) % arr.length];
  let trees = 0, small = 0;

  const isEdge = (i, j) => {
    const h = H[j * N + i];
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const hn = H[(j + b) * N + (i + a)];
      if (Math.abs(h - hn) > LEVEL_STEP) return h > hn ? 1 : -1; // 1: top rim, -1: foot of a cliff
    }
    return 0;
  };

  for (let j = 2; j < N - 2; j += 2) for (let i = 2; i < N - 2; i += 2) {
    const r0 = hash2(i, j, 1), r1 = hash2(i, j, 2), r2 = hash2(i, j, 3), r3 = hash2(i, j, 4);
    const ii = i + (r0 < 0.5 ? 0 : 1), jj = j + (r1 < 0.5 ? 0 : 1);
    const k = jj * N + ii;
    const x = -HALF + (ii + r2) * CELL, z = -HALF + (jj + r3) * CELL;
    const f = F[k];
    const y = world.groundHeight(x, z);
    const edge = isEdge(ii, jj);
    const nearWater = !(f & F_WATER) && (F[k + 1] & F_WATER || F[k - 1] & F_WATER || F[k + N] & F_WATER || F[k - N] & F_WATER);

    if (f & F_WATER) continue;
    if (Math.hypot(x - START.x, z - START.z) < 7) continue; // keep the first view of the hero clear
    if (nearWater && r0 < 0.4) { addSmall('reeds', x, y, z, 0.25); continue; }
    if (f & F_NOTREE) {
      if (!(f & F_ROAD) && r1 < 0.05 && !(f & 4)) addSmall('tuft', x, y, z, 0.2);
      continue;
    }
    if (edge === 1) { // cliff rims: bushes and the odd tree spilling greenery over the edge
      if (r0 < 0.45) addSmall(r1 < 0.3 ? 'flowerbush' : 'bush', x, y, z, 0.15);
      else if (r0 < 0.55) addTree(pickTree(x, z, y, r1), x, y, z, r2);
      continue;
    }
    if (edge === -1) { if (r0 < 0.3) addSmall(r1 < 0.5 ? 'rock' : 'bush', x, y, z, 0.1); continue; }

    const dens = world.forest[k];
    const g = grove.noise(x / 70, z / 70);
    if (r0 < dens * 0.62 + 0.025 + Math.max(0, g) * 0.04) addTree(pickTree(x, z, y, r1), x, y, z, r2);
    else if (r0 < dens * 0.62 + 0.12) addSmall(r1 < 0.12 ? 'rock' : r1 < 0.5 ? 'tuft' : r1 < 0.75 ? 'bush' : 'flowerbush', x, y, z, 0.2);
    else if (r1 < 0.35) addSmall('tuft', x, y, z, 0.25);
  }

  function pickTree(x, z, y, h) {
    const b = biome.noise(x / 220, z / 220);
    const lakeD = Math.hypot((x - LAKE.x) / LAKE.rx, (z - LAKE.z) / LAKE.rz);
    if (z < -560 || y > 70) return h < 0.7 ? 'pine' : h < 0.85 ? 'column' : 'deep';
    if (x > 560) return h < 0.45 ? 'autumn' : h < 0.65 ? 'gold' : h < 0.85 ? 'oak' : 'pine';
    if (lakeD < 1.5) return h < 0.35 ? 'blossom' : h < 0.45 ? 'magenta' : h < 0.7 ? 'spring' : h < 0.85 ? 'oak' : 'column';
    if (z > 480) return h < 0.45 ? 'deep' : h < 0.75 ? 'oak' : h < 0.88 ? 'column' : 'autumn';
    if (y > 40) return h < 0.4 ? 'spring' : h < 0.6 ? 'oak' : h < 0.75 ? 'pine' : h < 0.88 ? 'column' : 'blossom';
    if (b > 0.35) return h < 0.6 ? 'autumn' : 'oak';
    if (b < -0.4) return h < 0.5 ? 'blossom' : 'spring';
    return h < 0.4 ? 'oak' : h < 0.65 ? 'spring' : h < 0.78 ? 'blossom' : h < 0.9 ? 'column' : 'deep';
  }

  function addTree(species, x, y, z, h) {
    const reg = pick(lib[species], h);
    const flip = h < 0.5 ? 1 : -1;
    const scale = 0.85 + h * 0.35;
    layer.add(reg, x, y - 0.1, z, PPM, { sway: species === 'pine' ? 0.05 : 0.11, flip, scale, bright: 0.92 + h * 0.16 });
    const w = (reg.w / PPM) * scale;
    shadows.add(x + w * 0.22, y, z + w * 0.08, w * 0.95, w * 0.45, 0.34);
    collision.circle(x, z, (TREE_TRUNK[species] || 0.5) * scale, { kind: 'tree' });
    trees++;
  }

  function addSmall(kind, x, y, z, sway) {
    const reg = pick(lib[kind], hash2(x | 0, z | 0, 9));
    layer.add(reg, x, y - 0.05, z, PPM, { sway, flip: hash2(x | 0, z | 0, 5) < 0.5 ? 1 : -1, bright: 0.9 + hash2(z | 0, x | 0, 3) * 0.2 });
    if (kind === 'rock' || kind === 'bush' || kind === 'flowerbush') {
      const w = reg.w / PPM;
      shadows.add(x + w * 0.15, y, z + 0.1, w * 1.1, w * 0.5, 0.25);
      if (kind === 'rock') collision.circle(x, z, w * 0.38, { kind: 'rock' });
    }
    small++;
  }
  return { trees, small };
}
