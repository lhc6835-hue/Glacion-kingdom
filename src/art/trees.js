// Procedural pixel-art trees. Each tree is a trunk sprite plus several canopy pieces that sway
// independently by whole pixels, so the silhouette stays crisp while the crown moves.
import { PixBuf } from '../gfx/PixBuf.js';
import { mulberry32, hash2 } from '../core/Rng.js';
import { PAL } from './palette.js';
import { TREES } from '../data/trees.js';
import { treeShape } from '../game/TreeShape.js';

const TAU = Math.PI * 2;
const LIGHT = [-0.62, -0.78]; // towards the key light (upper left)

// clusters: { kind:'blob', x, y, r } or { kind:'tri', x, y, w, h }, each with a piece index.
function inCluster(c, x, y, seed) {
  if (c.kind === 'blob') {
    const dx = x - c.x, dy = y - c.y;
    const d = Math.hypot(dx, dy);
    const a = Math.floor(((Math.atan2(dy, dx) + Math.PI) / TAU) * 20);
    const jag = 1 + (c.jag ?? 0.22) * (hash2(a, c.id, seed) - 0.5) + 0.12 * (hash2(x, y, seed + 9) - 0.5);
    const r = c.r * jag;
    return d < r ? { depth: (r - d) / r, nx: dx / r, ny: dy / r } : null;
  }
  // tri: pine tier with a ragged, drooping lower edge
  const t = (y - c.y) / c.h;
  if (t < 0 || t > 1.12) return null;
  const sag = 2.5 * hash2(Math.floor(x / 2), c.id, seed) + 1.5 * Math.abs(x - c.x) / c.w;
  if (y > c.y + c.h + sag - 2.5) return null;
  const half = c.w * Math.pow(Math.min(1, t), 0.85) + 1.2 * (hash2(y, c.id, seed + 3) - 0.5) * 2;
  const dx = x - c.x;
  if (Math.abs(dx) > half) return null;
  return { depth: 1 - Math.abs(dx) / Math.max(1, half), nx: dx / c.w, ny: t * 1.4 - 0.7 };
}

function paintCanopy(W, H, clusters, pal, seed, opts = {}) {
  const pieces = Math.max(...clusters.map((c) => c.piece)) + 1;
  const tone = new Int8Array(W * H).fill(-1);
  const member = new Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let best = null, bestD = -1, mem = 0;
    for (const c of clusters) {
      const r = inCluster(c, x, y, seed);
      if (!r) continue;
      mem |= 1 << c.piece;
      if (r.depth > bestD) { bestD = r.depth; best = r; }
    }
    if (!best) continue;
    member[y * W + x] = mem;
    let s = -(best.nx * LIGHT[0] + best.ny * LIGHT[1]) * 0.75 + (1 - best.depth) * 0.12 - 0.05;
    s += (hash2(x, y, seed) - 0.5) * 0.42;
    s += (y / H - 0.45) * -0.35; // crowns are lighter on top
    let k = s > 0.58 ? 4 : s > 0.18 ? 3 : s > -0.25 ? 2 : 1;
    // leaf clumps: short bright dashes and dark notches
    const h = hash2(x >> 1, y, seed + 5);
    if (k >= 2 && h < 0.1) k++;
    else if (h > 0.93) k--;
    tone[y * W + x] = Math.max(1, Math.min(5, k));
  }
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : tone[y * W + x]);
  const out = [];
  for (let p = 0; p < pieces; p++) out.push(new PixBuf(W, H));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let k = tone[y * W + x];
    if (k < 0) continue;
    const edge = at(x - 1, y) < 0 || at(x + 1, y) < 0 || at(x, y - 1) < 0 || at(x, y + 1) < 0;
    if (edge) {
      // sun-facing rim gets the brightest tone, the rest is inked
      k = at(x - 1, y - 1) < 0 && at(x, y + 1) >= 0 && (at(x - 1, y) < 0 || at(x, y - 1) < 0) ? Math.min(5, k + 2) : 0;
      if (opts.softEdge && k === 0 && hash2(x, y, seed + 11) < 0.4) k = 1;
    }
    const col = pal[k];
    const mem = member[y * W + x];
    for (let p = 0; p < pieces; p++) if (mem & (1 << p)) out[p].set(x, y, col);
  }
  return out.map((b) => b.toCanvas());
}

function paintTrunk(buf, ax, baseY, topY, wBase, wTop, pal, seed, opts = {}) {
  const rnd = mulberry32(seed);
  const lean = opts.lean ?? (rnd() - 0.5) * 3;
  for (let y = topY; y <= baseY; y++) {
    const t = (y - topY) / Math.max(1, baseY - topY);
    let w = wTop + (wBase - wTop) * t;
    if (baseY - y < 4) w += (4 - (baseY - y)) * 1.1; // root flare
    const cx = ax + lean * (1 - t);
    const x0 = Math.round(cx - w / 2), x1 = Math.round(cx + w / 2);
    for (let x = x0; x <= x1; x++) {
      const u = (x - x0) / Math.max(1, x1 - x0);
      let k = u < 0.22 ? 4 : u < 0.5 ? 3 : u < 0.8 ? 2 : 1;
      if (x === x0 || x === x1) k = 0;
      const streak = hash2(x, Math.floor(y / 3), seed);
      if (k > 0 && streak < 0.16) k = Math.max(1, k - 1);
      if (opts.birch) {
        // white bark with dark lenticels
        k = x === x0 || x === x1 ? 0 : u < 0.3 ? 4 : u < 0.75 ? 3 : 2;
        if (hash2(Math.floor(x / 2), y, seed + 2) < 0.08 || (hash2(0, Math.floor(y / 2), seed) < 0.12 && u > 0.15 && u < 0.85)) k = 0;
      }
      buf.set(x, y, pal[Math.min(pal.length - 1, k)]);
    }
    // moss creeping up the shaded side
    if (opts.moss && baseY - y < opts.moss && hash2(x1, y, seed + 4) < 0.7) buf.set(x1 - 1, y, PAL.moss[2 + (hash2(y, 1, seed) < 0.3 ? 1 : 0)]);
  }
  // roots
  for (let i = -1; i <= 1; i += 2) for (let k = 0; k < 3 + wBase / 3; k++) buf.set(Math.round(ax + i * (wBase / 2 + 1 + k)), baseY - (k < 2 ? 1 : 0), pal[1]);
  return lean;
}

function branch(buf, x, y, dx, dy, len, pal) {
  for (let i = 0; i < len; i++) {
    const px = Math.round(x + dx * i), py = Math.round(y + dy * i);
    buf.set(px, py, pal[2]); buf.set(px, py + 1, pal[0]);
  }
}

// Builds every sprite part of one tree. Anchor (ax, ay) is the trunk base.
export function buildTree(species, seed) {
  const a = TREES[species].art;
  const rnd = mulberry32(seed);
  const sh = treeShape(seed); // height, crown width and trunk thickness vary independently
  const H = Math.round(a.h * sh.h) + 4, W = Math.round(a.w * sh.w) + 10;
  const ax = Math.floor(W / 2), ay = H - 2;
  const tw = Math.max(2, a.trunk * sh.trunk);
  const trunk = new PixBuf(W, H);
  const clusters = [];
  let pal, id = 0;
  const blob = (x, y, r, piece, jag) => clusters.push({ kind: 'blob', x, y, r, piece, jag, id: id++ });
  // a loose crown of n blobs around (cx, cy), spread rx × ry
  const crown = (n, cx, cy, rx, ry, r0, jag) => {
    blob(cx, cy, r0, 0, jag);
    for (let i = 1; i < n; i++) {
      const ang = (i / (n - 1)) * Math.PI * 1.6 - Math.PI * 1.3 + (rnd() - 0.5) * 0.6;
      blob(cx + Math.cos(ang) * rx * (0.6 + rnd() * 0.4), cy + Math.sin(ang) * ry * (0.5 + rnd() * 0.5), r0 * (0.55 + rnd() * 0.35), 1 + (i % 3), jag);
    }
  };
  const lean = sh.lean * 2.5;

  if (a.kind === 'pine' || a.kind === 'mossheart') {
    pal = a.kind === 'mossheart' ? ['#0c2420', '#163d30', '#22573c', '#3a7a4a', '#6aa858', '#b0dc7a'] : PAL.pine;
    // young pines are crowned to the ground, old ones show a long bare trunk
    const top = 2, crownBottom = ay - Math.round(H * (0.1 + sh.k * 0.22));
    paintTrunk(trunk, ax, ay, top + 8, tw, Math.max(1.5, tw * 0.3), PAL.bark, seed, { moss: a.kind === 'mossheart' ? 30 : 4 + sh.k * 14, lean });
    const tiers = (a.kind === 'mossheart' ? 6 : 4) + Math.floor(sh.crown * 3);
    const span = crownBottom - top;
    const droop = 0.85 + sh.crown * 0.3;
    for (let i = 0; i < tiers; i++) {
      const ty = top + Math.round((span * i) / (tiers + 0.6));
      const th = Math.round((span / tiers) * droop) + 8;
      const tww = (W / 2 - 3) * (0.28 + 0.72 * Math.pow((i + 1) / tiers, 0.9)) * (0.86 + rnd() * 0.2);
      clusters.push({ kind: 'tri', x: ax + lean * (1 - i / tiers) + (rnd() - 0.5) * 2, y: ty, w: tww, h: th, piece: Math.min(3, Math.floor((tiers - 1 - i) / 1.5)), id: id++ });
    }
  } else if (a.kind === 'birch') {
    pal = PAL.birch;
    const crownY = H * (0.3 + (1 - sh.k) * 0.06);
    paintTrunk(trunk, ax, ay, Math.round(crownY - 4), tw, Math.max(1.5, tw * 0.5), PAL.birchBark, seed, { birch: true, lean });
    branch(trunk, ax, Math.round(H * 0.45), -0.9, -0.6, 6 + W * 0.08, PAL.birchBark);
    branch(trunk, ax + 1, Math.round(H * 0.38), 0.9, -0.7, 5 + W * 0.08, PAL.birchBark);
    crown(5 + Math.floor(sh.crown * 3), ax + lean, crownY, W * 0.34, H * 0.2, W * 0.27, 0.24);
  } else if (a.kind === 'silver') {
    pal = PAL.silver;
    const crownY = H * (0.32 + (1 - sh.k) * 0.06);
    paintTrunk(trunk, ax, ay, Math.round(crownY - 2), tw, Math.max(2, tw * 0.5), PAL.silverBark, seed, { moss: 6 + sh.k * 14, lean });
    branch(trunk, ax - 1, Math.round(H * 0.5), -1, -0.5, 7 + W * 0.1, PAL.silverBark);
    branch(trunk, ax + 1, Math.round(H * 0.46), 1, -0.55, 7 + W * 0.1, PAL.silverBark);
    crown(6 + Math.floor(sh.crown * 3), ax + lean, crownY, W * 0.34, H * 0.2, W * 0.27, 0.3);
  } else if (a.kind === 'oak' || a.kind === 'sunheart') {
    // broad, low, spreading crown on a thick short trunk
    pal = a.kind === 'sunheart' ? PAL.sunheart : PAL.oak;
    const crownY = H * (0.34 + (1 - sh.k) * 0.05);
    paintTrunk(trunk, ax, ay, Math.round(crownY + 2), tw, Math.max(3, tw * 0.6), PAL.oakBark, seed, { moss: 6 + sh.k * 10, lean });
    branch(trunk, ax - 1, Math.round(H * 0.5), -1, -0.45, 10 + W * 0.12, PAL.oakBark);
    branch(trunk, ax + 1, Math.round(H * 0.47), 1, -0.4, 10 + W * 0.12, PAL.oakBark);
    crown(7 + Math.floor(sh.crown * 3), ax + lean * 0.5, crownY, W * 0.36, H * 0.16, W * 0.22, 0.26);
  } else if (a.kind === 'maple') {
    pal = PAL.maple;
    const crownY = H * (0.32 + (1 - sh.k) * 0.06);
    paintTrunk(trunk, ax, ay, Math.round(crownY), tw, Math.max(2, tw * 0.5), PAL.oakBark, seed, { lean });
    branch(trunk, ax, Math.round(H * 0.46), -0.9, -0.7, 8 + W * 0.08, PAL.oakBark);
    branch(trunk, ax, Math.round(H * 0.42), 0.9, -0.75, 8 + W * 0.08, PAL.oakBark);
    crown(6 + Math.floor(sh.crown * 3), ax + lean, crownY, W * 0.32, H * 0.2, W * 0.24, 0.38); // jagged, leafy edge
  } else if (a.kind === 'honey') {
    pal = PAL.honeyLeaf;
    const crownY = H * (0.3 + (1 - sh.k) * 0.06);
    paintTrunk(trunk, ax, ay, Math.round(crownY), tw, Math.max(2, tw * 0.55), PAL.honeyBark, seed, { moss: 4, lean });
    crown(5 + Math.floor(sh.crown * 3), ax + lean, crownY, W * 0.3, H * 0.18, W * 0.26, 0.24);
  } else if (a.kind === 'dawn') {
    pal = PAL.dawn;
    const crownY = H * (0.28 + (1 - sh.k) * 0.06);
    paintTrunk(trunk, ax, ay, Math.round(crownY), tw, Math.max(2, tw * 0.45), PAL.dawnBark, seed, { birch: false, lean: lean + 2 });
    branch(trunk, ax + 1, Math.round(H * 0.44), 1, -0.6, 9 + W * 0.1, PAL.dawnBark);
    crown(6 + Math.floor(sh.crown * 3), ax + lean + 3, crownY, W * 0.3, H * 0.2, W * 0.25, 0.3);
  } else {
    pal = PAL.leafDeep;
    const crownY = H * (0.34 + (1 - sh.k) * 0.06);
    paintTrunk(trunk, ax, ay, Math.round(crownY + 4), tw, Math.max(1.5, tw * 0.55), PAL.bark, seed, { moss: 4, lean });
    crown(3 + Math.floor(sh.crown * 3), ax + lean * 0.5, crownY, W * 0.22, H * 0.12, W * 0.33, 0.22);
  }
  const pieces = paintCanopy(W, H, clusters, pal, seed, { softEdge: a.kind === 'silver' }).map((c, i) => ({ c, amp: 0.4 + i * 0.35 + sh.k * 0.3, phase: rnd() * TAU }));
  // sparkle pixels on silverleaf, pulsing glow spots on mossheart (drawn by the renderer)
  const sparkles = [];
  if (a.kind === 'maple' || a.kind === 'sunheart') for (let i = 0; i < 10; i++) sparkles.push({ x: Math.round(ax + (rnd() - 0.5) * W * 0.8), y: Math.round(H * (0.12 + rnd() * 0.35)), p: rnd() * TAU });
  // honey drips: glowing beads down the trunk
  const drips = [];
  if (a.kind === 'honey') for (let i = 0; i < 5; i++) { const y = Math.round(ay - H * (0.1 + rnd() * 0.45)), x = Math.round(ax + (rnd() - 0.5) * tw); drips.push({ x, y }); trunk.set(x, y, '#ffcc40'); trunk.set(x, y + 1, '#f0a020'); }
  if (a.kind === 'silver') for (let i = 0; i < 14; i++) sparkles.push({ x: Math.round(ax + (rnd() - 0.5) * W * 0.8), y: Math.round(H * (0.12 + rnd() * 0.4)), p: rnd() * TAU });
  const glow = a.kind === 'mossheart' ? { x: ax, y: Math.round(ay - H * 0.3), col: 'green' } : a.kind === 'sunheart' ? { x: ax, y: Math.round(ay - H * 0.32), col: 'gold' } : null;
  return { W, H, ax, ay, trunk: trunk.toCanvas(), pieces, sparkles, glow, drips, stump: buildStump(tw, a.kind, seed), logColor: pal[3] };
}

function buildStump(w, kind, seed) {
  const W = Math.round(w) + 10, H = 9;
  const b = new PixBuf(W, H);
  const pal = kind === 'birch' ? PAL.birchBark : kind === 'silver' ? PAL.silverBark : kind === 'honey' ? PAL.honeyBark : kind === 'dawn' ? PAL.dawnBark : (kind === 'oak' || kind === 'sunheart' || kind === 'maple') ? PAL.oakBark : PAL.bark;
  paintTrunk(b, W / 2, H - 2, 3, w, w * 0.9, pal, seed, { birch: kind === 'birch' });
  // cut face
  for (let x = Math.round(W / 2 - w / 2) + 1; x < W / 2 + w / 2; x++) { b.set(x, 3, '#c9a77a'); b.set(x, 2, '#e0c49a'); }
  return { c: b.toCanvas(), W, H };
}

// Silhouette trees for the parallax strips: two tones, no sway pieces.
export function silhouetteTree(b, x, baseY, h, kind, cols, seed) {
  const rnd = mulberry32(seed);
  const tw = Math.max(1, Math.round(h / 28));
  for (let y = baseY - Math.round(h * 0.5); y <= baseY; y++) for (let i = -tw; i <= tw; i++) b.set(x + i, y, cols[0]);
  if (kind === 'pine') {
    const tiers = 4 + Math.floor(rnd() * 2);
    for (let t = 0; t < tiers; t++) {
      const ty = baseY - h + (h * 0.78 * t) / tiers;
      const th = (h * 0.78) / tiers + h * 0.12;
      const w = h * 0.12 + (h * 0.24 * (t + 1)) / tiers;
      for (let y = 0; y < th; y++) {
        const half = w * (y / th) + (hash2(y, t, seed) - 0.5) * 2;
        for (let i = -Math.round(half); i <= Math.round(half); i++) {
          const lit = i < -half * 0.3 && hash2(x + i, y, seed) < 0.5;
          b.set(x + i, Math.round(ty + y), lit ? cols[1] : cols[0]);
        }
      }
    }
  } else {
    const n = 3 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      const cx = x + (rnd() - 0.5) * h * 0.4, cy = baseY - h * (0.55 + rnd() * 0.3), r = h * (0.16 + rnd() * 0.12);
      for (let y = -r; y <= r; y++) for (let i = -r; i <= r; i++) {
        if (i * i + y * y > r * r * (0.85 + hash2(i, y, seed + k) * 0.3)) continue;
        const lit = i + y < -r * 0.5 && hash2(i, y, seed) < 0.6;
        b.set(Math.round(cx + i), Math.round(cy + y), lit ? cols[1] : cols[0]);
      }
    }
  }
}
