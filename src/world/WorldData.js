import { Simplex2, smoothstep, clamp, lerp } from './noise.js';
import { IndexedPolyline, smoothPath } from './Polyline.js';
import {
  CELL, N, HALF, WATER, CITY_H, LAKE, MESAS, CITY_WALL, RIVERS, ROADS, START,
} from './Layout.js';

// The world as data: one cell every 2 m. Height, ground materials, water and flags.
// Rendering, collision and decoration placement all read from here.

export const F_WATER = 1, F_ROAD = 2, F_CITY = 4, F_NOTREE = 8, F_BRIDGE = 16, F_FALL = 32;

const nA = new Simplex2(1207), nB = new Simplex2(4421), nC = new Simplex2(9173);

function ellipseR(x, z, e) {
  return Math.sqrt(((x - e.x) / e.rx) ** 2 + ((z - e.z) / e.rz) ** 2);
}

function rimNoise(x, z, e, amt) {
  const a = Math.atan2(z - e.z, x - e.x);
  return (nA.noise(Math.cos(a) * 2.2 + e.x * 0.013, Math.sin(a) * 2.2 + e.z * 0.013) * 0.6
    + nB.noise(Math.cos(a) * 7 + e.x * 0.02, Math.sin(a) * 7) * 0.3
    + nC.noise(x / 9, z / 9) * 0.1) * amt;
}

export function cityR(x, z) { return ellipseR(x, z, CITY_WALL); }

// Land before rivers and roads are applied.
function landHeight(x, z) {
  let h = 2.2 + nA.fbm(x / 320, z / 320, 3) * 1.8 + nB.fbm(x / 70, z / 70, 2) * 0.45;
  // Sunmeadow Rise: a broad grassy hill overlooking the lake.
  const ds = Math.hypot(x - (START.x - 30), z - (START.z + 70));
  h += 9 * Math.exp(-(ds * ds) / (2 * 115 * 115));
  // Gentle swells in the south and east meadows.
  h += 3 * smoothstep(400, 900, z) * (0.5 + 0.5 * nA.noise(x / 200, z / 200));

  const lr = ellipseR(x, z, LAKE) + nA.noise(x / 110, z / 110) * 0.07;
  if (lr < 1.12) {
    const floor = WATER - 1.2 - 5 * (1 - smoothstep(0, 0.95, lr));
    h = lerp(floor, h, smoothstep(0.92, 1.12, lr));
  }
  for (const m of MESAS) {
    const r = ellipseR(x, z, m) + rimNoise(x, z, m, m.rim);
    if (r < 1) h = Math.max(h, m.h + nB.noise(x / 50, z / 50) * 0.25);
  }
  // A ring of mountains closes the edge of the map.
  const edge = Math.max(Math.abs(x), Math.abs(z));
  const edgeN = nA.noise(x / 90, z / 90) * 30;
  if (edge > HALF - 70 + edgeN) h = Math.max(h, 70 + nB.fbm(x / 120, z / 120, 2) * 10);
  return h;
}

const rivers = RIVERS.map((r) => ({ ...r, path: new IndexedPolyline(smoothPath(r.points, 3), { cell: 32, pad: 10 }) }));

const roads = ROADS.map((r) => {
  const pts = smoothPath(r.points, 3);
  // Interpolate forced heights; free points follow a smoothed profile of the land.
  const raw = pts.map((p) => landHeight(p.x, p.z));
  const forced = pts.map(() => undefined);
  let acc = 0; const dist = pts.map((p, i) => (i ? (acc += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z)) : 0));
  const ctrl = r.points.map((cp) => {
    let best = 0, bd = Infinity;
    pts.forEach((p, i) => { const d = Math.hypot(p.x - cp.x, p.z - cp.z); if (d < bd) { bd = d; best = i; } });
    return { i: best, y: cp.y };
  });
  for (let c = 0; c < ctrl.length - 1; c++) {
    const a = ctrl[c], b = ctrl[c + 1];
    if (a.y === undefined && b.y === undefined) continue;
    const ya = a.y ?? raw[a.i], yb = b.y ?? raw[b.i];
    for (let i = a.i; i <= b.i; i++) {
      const t = (dist[i] - dist[a.i]) / Math.max(1e-3, dist[b.i] - dist[a.i]);
      forced[i] = lerp(ya, yb, t);
    }
  }
  const sm = raw.map((_, i) => {
    let s = 0, c = 0;
    for (let k = -5; k <= 5; k++) { const j = clamp(i + k, 0, raw.length - 1); s += raw[j]; c++; }
    return s / c;
  });
  pts.forEach((p, i) => { p.y = forced[i] ?? Math.max(sm[i], 0.6); p.w = r.width / 2; p.forced = forced[i] !== undefined; });
  return { ...r, pts, path: new IndexedPolyline(pts, { cell: 32, pad: 8 }) };
});

export class WorldData {
  constructor() {
    this.N = N;
    this.height = new Float32Array(N * N);
    this.water = new Float32Array(N * N).fill(NaN);
    this.flags = new Uint8Array(N * N);
    this.mat = new Uint8Array(N * N * 4);   // R path, G paving, B shore, A forest floor
    this.forest = new Float32Array(N * N);
    this.rivers = rivers;
    this.roads = roads;
  }

  // Generation is split into row bands so the loading screen can update between them.
  *generate() {
    const { height, water, flags, mat, forest } = this;
    const nr = {};
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = -HALF + (i + 0.5) * CELL, z = -HALF + (j + 0.5) * CELL;
        const k = j * N + i;
        let h = landHeight(x, z);
        let f = 0, path = 0, pave = 0, shore = 0;

        const cr = cityR(x, z);
        const inCity = cr < 1;
        if (inCity) {
          f |= F_CITY | F_NOTREE;
          if (h < CITY_H + 10) h = CITY_H + nB.noise(x / 80, z / 80) * 0.15;
          pave = 0.55; // city ground is mostly paved; gardens are painted later
        }

        for (const r of rivers) {
          const n = r.path.nearest(x, z, nr);
          if (!n) continue;
          const w = n.seg.a.w + (n.seg.b.w - n.seg.a.w) * n.t;
          if (n.d < w) {
            const surf = h - (r.canal ? 0.5 : 0.35);
            h -= r.canal ? 1.4 : 1.1 + w * 0.05;
            water[k] = surf;
            f |= F_WATER | F_NOTREE;
          } else if (n.d < w + 3) {
            shore = Math.max(shore, 1 - (n.d - w) / 3);
            f |= F_NOTREE;
            if (r.canal) pave = 1;
          }
        }

        for (const r of roads) {
          const n = r.path.nearest(x, z, nr);
          if (!n) continue;
          const a = n.seg.a, b = n.seg.b;
          const w = a.w;
          if (n.d > w + 4) continue;
          const ry = lerp(a.y, b.y, n.t);
          const forcedRoad = a.forced || b.forced;
          if (n.d < w + 1) {
            if (f & F_WATER) { f |= F_BRIDGE; water[k] = water[k]; h = Math.max(h, water[k] + 0.7); }
            else h = ry;
            f |= F_ROAD | F_NOTREE;
            path = Math.max(path, 1 - smoothstep(w - 1.5, w + 1, n.d));
            if (forcedRoad) pave = Math.max(pave, 0.85); // ramps and causeways are paved
          } else if (!forcedRoad && Math.abs(h - ry) < 3) {
            h = lerp(ry, h, (n.d - w - 1) / 3);
            path = Math.max(path, 0.25 * (1 - (n.d - w - 1) / 3));
            f |= F_NOTREE;
          }
        }

        if (!(f & F_WATER) && h < WATER) { water[k] = WATER; f |= F_WATER | F_NOTREE; }
        if (!(f & F_WATER) && h < WATER + 1.4) shore = Math.max(shore, 1 - (h - WATER) / 1.4);

        // Forest density: big woods, groves and open meadows, thinned near roads and cliffs.
        let fd = nA.fbm(x / 260 + 17, z / 260, 3) * 0.7 + nB.noise(x / 60, z / 60) * 0.3;
        fd = smoothstep(-0.05, 0.45, fd);
        fd = Math.max(fd, smoothstep(320, 700, z) * 0.75 * smoothstep(-0.3, 0.3, nC.noise(x / 150, z / 150))); // Elderwood
        forest[k] = fd;

        height[k] = h;
        flags[k] = f;
        mat[k * 4] = path * 255;
        mat[k * 4 + 1] = pave * 255;
        mat[k * 4 + 2] = shore * 255;
        mat[k * 4 + 3] = fd * 255;
      }
      if ((j & 31) === 31) yield j / N;
    }
    this.blurMaterials();
    this.markFalls();
    yield 1;
  }

  // Soften the material map so paths and shores get organic edges instead of cell steps.
  blurMaterials() {
    const src = this.mat, tmp = new Uint8Array(src.length);
    for (let pass = 0; pass < 2; pass++) {
      for (let axis = 0; axis < 2; axis++) {
        const a = axis ? tmp : src, b = axis ? src : tmp;
        const step = axis ? N * 4 : 4;
        for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
          const k = (j * N + i) * 4;
          for (let c = 0; c < 3; c++) b[k + c] = (a[k + c - step] + a[k + c] * 2 + a[k + c + step]) >> 2;
          b[k + 3] = a[k + 3];
        }
      }
    }
  }

  // A water cell next to a much lower cell is the lip of a waterfall.
  markFalls() {
    const { water, height, flags } = this;
    this.falls = [];
    for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
      const k = j * N + i;
      if (Number.isNaN(water[k]) || !(flags[k] & F_WATER)) continue;
      // Camera faces north: falls that drop to the south (toward the viewer) matter most,
      // but east/west drops are also kept.
      for (const [di, dj] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
        const kk = (j + dj) * N + (i + di);
        const drop = water[k] - (Number.isNaN(water[kk]) ? height[kk] : water[kk]);
        if (drop > 2.5) {
          flags[k] |= F_FALL;
          this.falls.push({ i, j, di, dj, top: water[k], drop });
        }
      }
    }
  }

  idx(x, z) {
    const i = Math.floor((x + HALF) / CELL), j = Math.floor((z + HALF) / CELL);
    if (i < 0 || j < 0 || i >= N || j >= N) return -1;
    return j * N + i;
  }

  cellHeight(x, z) { const k = this.idx(x, z); return k < 0 ? 80 : this.height[k]; }
  waterAt(x, z) { const k = this.idx(x, z); return k < 0 ? NaN : this.water[k]; }
  flagAt(x, z) { const k = this.idx(x, z); return k < 0 ? 0 : this.flags[k]; }
  forestAt(x, z) { const k = this.idx(x, z); return k < 0 ? 0 : this.forest[k]; }

  // Smooth ground height for walking, matching the rendered surface: corners are averaged
  // only with neighbours on the same level, so cliffs stay sharp while slopes stay smooth.
  groundHeight(x, z) {
    const fx = (x + HALF) / CELL - 0.5, fz = (z + HALF) / CELL - 0.5;
    const i = Math.floor((x + HALF) / CELL), j = Math.floor((z + HALF) / CELL);
    if (i < 1 || j < 1 || i >= N - 1 || j >= N - 1) return 80;
    const hc = this.height[j * N + i];
    // Bilinear over neighbours on the same level as the current cell.
    const i0 = Math.floor(fx), j0 = Math.floor(fz);
    const tx = fx - i0, tz = fz - j0;
    let s = 0, wsum = 0;
    for (let b = 0; b <= 1; b++) for (let a = 0; a <= 1; a++) {
      const ii = clamp(i0 + a, 0, N - 1), jj = clamp(j0 + b, 0, N - 1);
      let h = this.height[jj * N + ii];
      if (Math.abs(h - hc) > LEVEL_STEP) h = hc;
      const w = (a ? tx : 1 - tx) * (b ? tz : 1 - tz);
      s += h * w; wsum += w;
    }
    return s / wsum;
  }
}

// Height differences above this become vertical cliff walls instead of slopes.
export const LEVEL_STEP = 1.6;
