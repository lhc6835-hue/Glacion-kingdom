import { Simplex2, smoothstep, clamp, lerp } from './noise.js';
import { IndexedPolyline, smoothPath } from './Polyline.js';
import {
  LAKE, LAKE_LEVEL, ROYAL_PLATEAU, CASTLE, CITY_WALL, GREYSPIRE, RIVERS, ROADS, START, WORLD_HALF,
} from './WorldLayout.js';

// The single source of truth for the shape of the land.
// Terrain meshes, collision, vegetation placement and water all query this.

const noise = new Simplex2(1207);
const noiseB = new Simplex2(4421);
const noiseC = new Simplex2(9173);

function ellipseR(x, z, e, rot = 0) {
  let dx = x - e.x, dz = z - e.z;
  if (rot) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const rx = dx * c - dz * s; dz = dx * s + dz * c; dx = rx;
  }
  return Math.sqrt((dx / e.rx) ** 2 + (dz / e.rz) ** 2);
}

const rivers = RIVERS.map((r) => ({
  ...r, path: new IndexedPolyline(smoothPath(r.points, 5), { cell: 48, pad: 60 }),
}));

// --- pre-terrain without roads; roads are graded against it ---------------------------------

function mountainHeight(x, z) {
  // Northern Frostcrown range and the western Teeth, with a few hand-placed hero peaks
  // so the skyline behind the castle is composed rather than random.
  const north = smoothstep(-650, -1350, z + noise.noise(x / 700, 3.1) * 220);
  const west = smoothstep(-950, -1600, x + noise.noise(7.7, z / 600) * 260);
  const east = smoothstep(1900, 2700, x) * 0.6;
  const south = smoothstep(2200, 2900, z) * 0.4;
  const m = Math.max(north, west, east, south);
  if (m <= 0) return 0;
  // Domain-warped ridges with a slow amplitude swell: ranges, saddles and passes instead of uniform spikes.
  const wx = x + noise.noise(x / 900, z / 900) * 260, wz = z + noise.noise(z / 900 + 9, x / 900) * 260;
  const r = noise.ridged(wx / 900, wz / 900, 5);
  const r2 = noiseB.ridged(wx / 300, wz / 300, 3);
  const swell = 0.55 + 0.45 * noiseC.noise(x / 1600, z / 1600);
  let h = m * (60 + Math.pow(r, 1.5) * 640 * swell + r2 * 70 * m);
  // Hero peaks: Frostcrown (behind the castle), the Needles (behind Greyspire).
  h += peak(x, z, 260, -1650, 520, 980);
  h += peak(x, z, -760, -1250, 300, 640);
  h += peak(x, z, 900, -1450, 420, 720);
  h += peak(x, z, -1500, -300, 500, 700) * west;
  return h;
}

function peak(x, z, px, pz, radius, height) {
  const d = Math.hypot(x - px, z - pz) / radius;
  if (d > 1.6) return 0;
  const n = noiseC.ridged(x / 180, z / 180, 3) * 0.35 + 0.65;
  return height * Math.exp(-d * d * 2.2) * n;
}

function plateau(x, z, e, top, edgeFn, crag) {
  // Irregular rim: the ellipse radius is perturbed by noise so the cliffs have bays and spurs.
  const ang = Math.atan2(z - e.z, x - e.x);
  const r = ellipseR(x, z, e) + noise.noise(Math.cos(ang) * 2.3 + e.x * 0.01, Math.sin(ang) * 2.3) * 0.06
    + noise.noise(Math.cos(ang) * 9 + e.z * 0.01, Math.sin(ang) * 9) * 0.025
    + noiseB.noise(x / 60, z / 60) * 0.014;
  const width = edgeFn(ang); // falloff width in normalised radius units
  // Terraced cliff profile: ledges where trees and ivy can cling, a rounded lip at the top.
  let u = smoothstep(1 - width, 1, r);
  u = clamp(u + Math.sin(u * Math.PI * 3) * 0.05 * (1 - u), 0, 1);
  const m = 1 - u;
  const topH = top + noiseB.fbm(x / 160, z / 160, 3) * crag;
  return { m, topH, r };
}

function preHeight(x, z) {
  // Rolling base land.
  let h = 46 + noise.fbm(x / 1100, z / 1100, 4) * 38 + noiseB.fbm(x / 260, z / 260, 4) * 9;

  // Sunmeadow Rise — the opening viewpoint.
  const ds = Math.hypot(x - (START.x - 45), z - (START.z + 150));
  h += 70 * Math.exp(-(ds * ds) / (2 * 210 * 210));

  // Emberleaf highlands to the east: a broad rolling upland.
  h += 90 * smoothstep(900, 1400, x) * (1 - smoothstep(2000, 2600, x)) * (0.7 + 0.3 * noise.noise(x / 500, z / 500));

  // Mistfen: low, flat and wet to the south-west.
  const fen = 1 - smoothstep(250, 520, Math.hypot(x + 900, z - 1000));
  h = lerp(h, 31.5 + noise.fbm(x / 90, z / 90, 3) * 2.2, fen);

  // Lake basin.
  const lr = ellipseR(x, z, LAKE, LAKE.rot) + noise.noise(x / 180, z / 180) * 0.06;
  const lakeM = 1 - smoothstep(0.82, 1.18, lr);
  const lakeFloor = LAKE_LEVEL - 4 - 22 * (1 - smoothstep(0.0, 0.9, lr));
  h = lerp(h, Math.min(h, lakeFloor), lakeM);

  h += mountainHeight(x, z);

  // Greyspire heights: sheer cliffs on the east (gorge) side, gentler on the west.
  const g = plateau(x, z, GREYSPIRE, GREYSPIRE.height, (a) => {
    const east = Math.max(0, Math.cos(a)); // a≈0 → east face
    return lerp(0.55, 0.12, east);
  }, 14);
  h = lerp(h, Math.max(h, g.topH), g.m);
  // Crags on the cliff faces.
  const face = g.m * (1 - g.m) * 4;
  h += face * (noiseC.ridged(x / 34, z / 34, 3) * 24 + noiseB.noise(x / 12, z / 12) * 3);

  // Royal plateau: cliffs drop straight into the lake on the south-west, long ramp to the east.
  const p = plateau(x, z, ROYAL_PLATEAU, ROYAL_PLATEAU.height, (a) => {
    // a = atan2(dz, dx): south-west is (dx<0,dz>0) → a≈ 3π/4
    const sw = Math.max(0, Math.cos(a - Math.PI * 0.72));
    const west = Math.max(0, Math.cos(a - Math.PI));
    const east = Math.max(0, Math.cos(a - 0.1));
    const north = Math.max(0, Math.cos(a + Math.PI / 2));
    return clamp(0.34 - sw * 0.24 - west * 0.16 + east * 0.45 + north * 0.25, 0.11, 0.85);
  }, 3);
  h = lerp(h, Math.max(h * (1 - p.m), p.topH), p.m);
  const pface = p.m * (1 - p.m) * 4;
  h += pface * (noiseC.ridged(x / 30, z / 30, 3) * 16 + noiseB.noise(x / 11, z / 11) * 2.5);

  // Castle rock.
  const dc = Math.hypot(x - CASTLE.x, z - CASTLE.z);
  const rock = smoothstep(120, 62, dc + noise.noise(x / 30, z / 30) * 8);
  h += CASTLE.rockHeight * rock * p.m;

  // Rivers (and waterfalls) carve their beds last so they always have a channel.
  h = carveRivers(x, z, h);
  return h;
}

const _n = {};
function carveRivers(x, z, h) {
  for (const r of rivers) {
    const n = r.path.nearest(x, z, _n);
    if (!n) continue;
    const a = n.seg.a, b = n.seg.b;
    const surf = a.y + (b.y - a.y) * n.t;
    const w = a.w + (b.w - a.w) * n.t;
    const bank = r.canal ? 2.5 : w * 1.6 + 10;
    if (n.d > w + bank) continue;
    const depth = r.canal ? 2.2 : 1.6 + w * 0.12;
    let channel;
    if (n.d < w) channel = surf - depth * (1 - (n.d / w) ** 2) - 0.2;
    else channel = surf + 0.4 + (n.d - w) * (r.canal ? 0.0 : 0.25);
    if (r.canal && n.d >= w) channel = Math.max(channel, h); // canals cut into stone, never raise
    const t = smoothstep(w, w + bank, n.d);
    h = lerp(channel, h, t);
  }
  return h;
}

// --- roads ---------------------------------------------------------------------------------

const roads = ROADS.map((r) => {
  const pts = smoothPath(r.points, 6);
  // Grade: sample the land under the road, then smooth heavily so it climbs gently.
  const raw = pts.map((p) => preHeight(p.x, p.z));
  const sm = raw.map((_, i) => {
    let s = 0, c = 0;
    for (let k = -6; k <= 6; k++) {
      const j = clamp(i + k, 0, raw.length - 1);
      const wgt = 7 - Math.abs(k);
      s += raw[j] * wgt; c += wgt;
    }
    return s / c;
  });
  pts.forEach((p, i) => { p.y = Math.max(sm[i], LAKE_LEVEL + 1.2); p.w = r.width * 0.5; });
  return { ...r, path: new IndexedPolyline(pts, { cell: 48, pad: 24 }) };
});

function applyRoads(x, z, h) {
  let mask = 0;
  for (const r of roads) {
    const n = r.path.nearest(x, z, _n);
    if (!n) continue;
    const a = n.seg.a, b = n.seg.b;
    const ry = a.y + (b.y - a.y) * n.t;
    const w = a.w;
    const t = smoothstep(w + 0.5, w + 14, n.d);
    h = lerp(ry, h, t);
    mask = Math.max(mask, 1 - smoothstep(w - 0.8, w + 1.2, n.d));
  }
  return { h, mask };
}

// --- city ---------------------------------------------------------------------------------

export function cityMask(x, z) {
  const r = ellipseR(x, z, CITY_WALL);
  return 1 - smoothstep(1.0, 1.12, r);
}

export function insideCity(x, z, margin = 0) {
  return ellipseR(x, z, { ...CITY_WALL, rx: CITY_WALL.rx - margin, rz: CITY_WALL.rz - margin }) < 1;
}

function cityHeight(x, z) {
  // A gentle rise from the south gate toward the castle rock.
  const toCastle = smoothstep(260, 40, Math.hypot(x - CASTLE.x, z - CASTLE.z));
  return ROYAL_PLATEAU.height + 0.6 * noiseB.fbm(x / 120, z / 120, 2) + toCastle * 4;
}

// --- public API ---------------------------------------------------------------------------

// Full terrain sample: height plus the road mask (used for splatting).
const _sample = { h: 0, road: 0 };
export function terrainSample(x, z, out = _sample) {
  let h = preHeight(x, z);
  const road = applyRoads(x, z, h);
  h = road.h;
  const cm = cityMask(x, z);
  if (cm > 0) {
    const dc = Math.hypot(x - CASTLE.x, z - CASTLE.z);
    // Leave the castle rock and the canal standing out of the flattened city.
    const keep = smoothstep(150, 120, dc);
    const flat = carveRivers(x, z, cityHeight(x, z));
    h = lerp(h, lerp(flat, h, keep), cm);
  }
  // Keep the world edge closed by mountains.
  const edge = Math.max(Math.abs(x), Math.abs(z));
  h += smoothstep(WORLD_HALF - 500, WORLD_HALF, edge) * 500;
  out.h = h; out.road = road.mask;
  return out;
}

export function heightAt(x, z) {
  return terrainSample(x, z).h;
}

export function roadMaskAt(x, z) {
  return applyRoads(x, z, 0).mask;
}

export function normalAt(x, z, e = 1.5, out = { x: 0, y: 1, z: 0 }) {
  const hl = heightAt(x - e, z), hr = heightAt(x + e, z);
  const hd = heightAt(x, z - e), hu = heightAt(x, z + e);
  let nx = hl - hr, ny = 2 * e, nz = hd - hu;
  const l = Math.hypot(nx, ny, nz);
  out.x = nx / l; out.y = ny / l; out.z = nz / l;
  return out;
}

// Water surface above (x,z), or -Infinity if dry. Lake + rivers.
export function waterSurfaceAt(x, z) {
  let s = -Infinity;
  const lr = ellipseR(x, z, LAKE, LAKE.rot);
  if (lr < 1.35) s = LAKE_LEVEL;
  for (const r of rivers) {
    const n = r.path.nearest(x, z, _n);
    if (!n) continue;
    const a = n.seg.a, b = n.seg.b;
    const w = a.w + (b.w - a.w) * n.t;
    if (n.d < w + 1) s = Math.max(s, a.y + (b.y - a.y) * n.t);
  }
  return s;
}

export const riverPaths = rivers;
export const roadPaths = roads;
