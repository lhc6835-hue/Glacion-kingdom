// The battlefield: a sunny candy meadow on an island in a sea of strawberry milk.
// Ground is painted per chunk into offscreen canvases (lazily, small LRU): a soft colour field,
// painterly brush dabs, grass clumps, flower patches, clover, cookie stones and soda ponds.
// Tall props are y-sorted with the actors. Cloud shadows drift over everything.
import { rng, TAU, mix, rgba, shade, clamp } from '../core/math.js';
import { makeSprite, atop, drawSprite } from './sprite.js';

export const HALF = 1200; // island half-size: playable area is about [-HALF, HALF]^2
const CH = 512;

function hash2(x, y, s) { let h = x * 374761393 + y * 668265263 + s * 982451653; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, s = 1) { let t = 0, a = 0.5, f = 1; for (let i = 0; i < 4; i++) { t += vnoise(x * f, y * f, s + i) * a; f *= 2; a *= 0.5; } return t; }

export function shoreDist(x, y) {
  const k = 6;
  const d = Math.pow(Math.pow(Math.abs(x), k) + Math.pow(Math.abs(y), k), 1 / k);
  const wob = (fbm(x / 300, y / 300, 77) - 0.5) * 90;
  return HALF + 60 + wob - d; // > 0 on land
}
// soda ponds: a few fixed blobs on the meadow (decoration only)
const PONDS = [[-620, 380, 120], [700, -520, 95], [520, 640, 80], [-760, -640, 105]];
function pondDist(x, y) {
  let best = 1e9;
  for (const [px, py, r] of PONDS) {
    const wob = (fbm(x / 80, y / 80, 41) - 0.5) * 40;
    best = Math.min(best, Math.hypot(x - px, (y - py) * 1.25) - r - wob);
  }
  return best; // < 0 inside a pond
}

// palette: bright spring meadow
const G_LIGHT = '#d4f7b4', G_MID = '#b5eea6', G_COOL = '#a3e8bf', G_DEEP = '#8edcb0';

export class ArenaWorld {
  constructor(seed = 7) {
    this.seed = seed;
    this.chunks = new Map();
    this.order = [];
    this.props = [];
    this.makeProps();
  }

  makeProps() {
    const r = rng(this.seed * 13 + 1);
    const kinds = ['tree', 'tree', 'tree', 'tree2', 'rock', 'gum', 'gum', 'lamp', 'lolli', 'shroom', 'shroom'];
    for (let i = 0; i < 320 && this.props.length < 80; i++) {
      const x = (r() * 2 - 1) * (HALF - 80), y = (r() * 2 - 1) * (HALF - 80);
      if (Math.hypot(x, y) < 280) continue; // keep the spawn clearing open
      if (shoreDist(x, y) < 120 || pondDist(x, y) < 40) continue;
      // trees like company: favour spots near other trees, giving little groves
      const kind = kinds[(r() * kinds.length) | 0];
      const minGap = kind === 'shroom' || kind === 'lolli' ? 120 : 170;
      if (this.props.some((p) => Math.hypot(p.x - x, p.y - y) < minGap)) continue;
      const v = (r() * 4) | 0;
      this.props.push({ x, y, kind, v, r: PROP_R[kind], sprite: propSprite(kind, v), ph: r() * TAU });
    }
  }

  chunk(cx, cy) {
    const key = cx + ',' + cy;
    let c = this.chunks.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = CH;
    paintChunk(c.getContext('2d'), cx * CH, cy * CH, this.seed);
    this.chunks.set(key, c);
    this.order.push(key);
    if (this.order.length > 24) { const old = this.order.shift(); this.chunks.delete(old); }
    return c;
  }

  drawGround(g, x0, y0, x1, y1, t) {
    g.fillStyle = '#ffd9e6';
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
    const cx0 = Math.floor(x0 / CH), cy0 = Math.floor(y0 / CH), cx1 = Math.floor(x1 / CH), cy1 = Math.floor(y1 / CH);
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      if (Math.abs(cx * CH + CH / 2) > HALF + 900 || Math.abs(cy * CH + CH / 2) > HALF + 900) continue;
      g.drawImage(this.chunk(cx, cy), cx * CH, cy * CH, CH + 0.5, CH + 0.5);
    }
    // living water: sparkles on the sea and the soda ponds
    g.save();
    const step = 110;
    for (let y = Math.floor(y0 / step) * step; y < y1; y += step) {
      for (let x = Math.floor(x0 / step) * step; x < x1; x += step) {
        const h = hash2(x / step, y / step, 5);
        const ox = x + h * 70, oy = y + hash2(y, x, 9) * 70;
        const sea = shoreDist(ox, oy) < -40, pond = pondDist(ox, oy) < -12;
        if (!sea && !pond) continue;
        const ph = t * 1.1 + h * 6;
        const a = Math.max(0, Math.sin(ph));
        g.globalAlpha = a * 0.85;
        g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.lineCap = 'round';
        const w = pond ? 9 : 15;
        g.beginPath(); g.moveTo(ox - w, oy); g.quadraticCurveTo(ox - w / 2, oy - 4, ox, oy); g.quadraticCurveTo(ox + w / 2, oy + 4, ox + w, oy); g.stroke();
        if (h > 0.7) { g.fillStyle = '#ffffff'; star4(g, ox + 12, oy - 8, 4 * a); }
      }
    }
    // foam that breathes along the shoreline
    g.globalAlpha = 1;
    g.restore();
  }

  // Soft shadows of clouds drifting over the meadow, plus warm sunlight — drawn above actors.
  drawSky(g, x0, y0, x1, y1, t) {
    g.save();
    for (let i = 0; i < 6; i++) {
      const cx = ((i * 913 + t * 22) % 3600) - 1800, cy = ((i * 577) % 2600) - 1300 + Math.sin(t * 0.1 + i) * 60;
      if (cx < x0 - 400 || cx > x1 + 400 || cy < y0 - 300 || cy > y1 + 300) continue;
      g.fillStyle = 'rgba(90,110,180,0.07)';
      for (const [dx, dy, r] of [[0, 0, 170], [140, 30, 130], [-130, 40, 120], [40, -60, 110]]) {
        g.beginPath(); g.ellipse(cx + dx, cy + dy, r, r * 0.6, 0, 0, TAU); g.fill();
      }
    }
    g.restore();
  }
}

const PROP_R = { tree: 30, tree2: 26, rock: 34, gum: 24, lamp: 10, lolli: 10, shroom: 16 };

function star4(g, x, y, s) {
  if (s <= 0.3) return;
  g.beginPath(); g.moveTo(x, y - s); g.quadraticCurveTo(x, y, x + s, y); g.quadraticCurveTo(x, y, x, y + s); g.quadraticCurveTo(x, y, x - s, y); g.quadraticCurveTo(x, y, x, y - s); g.fill();
}

function paintChunk(g, wx, wy, seed) {
  // 1. smooth colour field at quarter resolution
  const Q = CH / 4;
  const img = g.createImageData(Q, Q);
  const d = img.data;
  for (let j = 0; j < Q; j++) for (let i = 0; i < Q; i++) {
    const x = wx + i * 4, y = wy + j * 4;
    const sd = shoreDist(x, y);
    const pd = pondDist(x, y);
    const n = fbm(x / 520, y / 520, seed);
    const n2 = fbm(x / 140, y / 140, seed + 9);
    let c;
    if (sd < -26) {
      const deep = clamp(-sd / 320, 0, 1);
      c = mix('#ffd3e2', '#ffbcd3', deep * 0.85 + n2 * 0.15);
    } else if (sd < 8) c = mix('#fff4df', '#ffe6c6', clamp((8 - sd) / 34, 0, 1) * 0.7 + n2 * 0.3);
    else if (sd < 34) c = mix('#fff4df', G_LIGHT, (sd - 8) / 26);
    else {
      c = mix(G_MID, n > 0.5 ? G_LIGHT : G_COOL, clamp(Math.abs(n - 0.5) * 3.2, 0, 1));
      c = mix(c, G_DEEP, clamp((n2 - 0.62) * 2.4, 0, 0.5));
      const p = Math.abs(fbm(x / 700, y / 700, seed + 31) - 0.5);
      if (p < 0.032) c = mix(c, '#fff6e6', clamp((0.032 - p) / 0.012, 0, 1) * 0.9);
      if (pd < 14) c = mix(c, '#f6fff0', clamp((14 - pd) / 14, 0, 1) * 0.8);
      if (pd < 0) c = mix('#c9f1ff', '#a6e4ff', clamp(-pd / 60, 0, 1));
    }
    const v = parseInt(c.slice(1), 16), k = (j * Q + i) * 4;
    d[k] = (v >> 16) & 255; d[k + 1] = (v >> 8) & 255; d[k + 2] = v & 255; d[k + 3] = 255;
  }
  const small = document.createElement('canvas');
  small.width = small.height = Q;
  small.getContext('2d').putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(small, 0, 0, CH, CH);

  const r = rng(((wx * 73856093) ^ (wy * 19349663) ^ seed) >>> 0);
  const at = (lx, ly) => ({ sd: shoreDist(wx + lx, wy + ly), pd: pondDist(wx + lx, wy + ly) });
  g.lineCap = 'round';

  // 2. painterly brush dabs give the grass a soft, hand-painted grain
  for (let i = 0; i < 900; i++) {
    const lx = r() * CH, ly = r() * CH;
    const { sd, pd } = at(lx, ly);
    if (sd < 30 || pd < 6) continue;
    const light = r() < 0.55;
    g.fillStyle = light ? 'rgba(240,255,215,0.28)' : 'rgba(110,200,150,0.16)';
    g.beginPath(); g.ellipse(lx, ly, 6 + r() * 10, 2.5 + r() * 3, -0.3 + r() * 0.2, 0, TAU); g.fill();
  }
  // 3. sea foam and wet sand
  for (let i = 0; i < 500; i++) {
    const lx = r() * CH, ly = r() * CH;
    const { sd } = at(lx, ly);
    if (sd > -34 && sd < -6) { g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.ellipse(lx, ly, 6 + r() * 9, 2.5 + r() * 3, 0, 0, TAU); g.fill(); }
    else if (sd > -6 && sd < 6) { g.fillStyle = 'rgba(230,180,150,0.18)'; g.beginPath(); g.arc(lx, ly, 2 + r() * 3, 0, TAU); g.fill(); }
  }
  // 4. pond rims: sugar-crystal shores and candy lily pads
  for (let i = 0; i < 260; i++) {
    const lx = r() * CH, ly = r() * CH;
    const { pd } = at(lx, ly);
    if (pd > -4 && pd < 6) { g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.ellipse(lx, ly, 3 + r() * 4, 1.5 + r() * 1.5, 0, 0, TAU); g.fill(); }
    else if (pd < -24 && r() < 0.05) lilyPad(g, lx, ly, r);
  }
  // 5. clustered details — clumps feel natural where single scattered items feel random
  for (let i = 0; i < 70; i++) {
    const cx = r() * CH, cy = r() * CH;
    const { sd, pd } = at(cx, cy);
    if (pd < 16) continue;
    if (sd < 20) { if (sd > -10 && r() < 0.25) shell(g, cx, cy, r); continue; }
    const roll = r();
    if (roll < 0.42) for (let k = 0; k < 5 + r() * 6; k++) grassClump(g, cx + (r() - 0.5) * 50, cy + (r() - 0.5) * 30, r);
    else if (roll < 0.66) { const col = FLOWERS[(r() * FLOWERS.length) | 0]; for (let k = 0; k < 4 + r() * 7; k++) flower(g, cx + (r() - 0.5) * 46, cy + (r() - 0.5) * 28, col, r); }
    else if (roll < 0.78) for (let k = 0; k < 4; k++) clover(g, cx + (r() - 0.5) * 30, cy + (r() - 0.5) * 18, r);
    else if (roll < 0.8) cookie(g, cx, cy, r);
    else if (roll < 0.92) for (let k = 0; k < 6; k++) sprinkle(g, cx + (r() - 0.5) * 40, cy + (r() - 0.5) * 24, r);
    else candyPebbles(g, cx, cy, r);
  }
  // single tufts everywhere so no patch looks empty
  for (let i = 0; i < 80; i++) {
    const lx = r() * CH, ly = r() * CH;
    const { sd, pd } = at(lx, ly);
    if (sd < 34 || pd < 10) continue;
    grassClump(g, lx, ly, r, 0.8);
  }
}

const FLOWERS = [['#ffb3cc', '#ffe066'], ['#fff6a6', '#ffb347'], ['#d6c2ff', '#fff6c2'], ['#ffffff', '#ffd25a'], ['#a8dcff', '#ffffff'], ['#ff9eb8', '#ffffff']];

function grassClump(g, x, y, r, s = 1) {
  const h = (7 + r() * 7) * s;
  for (let k = -2; k <= 2; k++) {
    const gr = g.createLinearGradient(x, y, x, y - h);
    gr.addColorStop(0, '#7fd09a'); gr.addColorStop(1, r() < 0.5 ? '#c8f5a8' : '#a9ecb4');
    g.strokeStyle = gr;
    g.lineWidth = 2.2 * s;
    const lean = k * 2.2 + (r() - 0.5) * 2;
    g.beginPath(); g.moveTo(x + k * 1.8, y); g.quadraticCurveTo(x + k * 2 + lean * 0.3, y - h * 0.6, x + k * 1.5 + lean, y - h * (k === 0 ? 1.15 : 0.85)); g.stroke();
  }
}
function flower(g, x, y, [petal, center], r) {
  const s = 2.6 + r() * 1.8;
  g.fillStyle = 'rgba(70,140,90,0.25)'; g.beginPath(); g.ellipse(x + 1, y + s * 1.6, s * 1.4, s * 0.5, 0, 0, TAU); g.fill();
  g.strokeStyle = '#7fd09a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y + s * 1.5); g.lineTo(x, y); g.stroke();
  g.fillStyle = petal;
  for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU + r(); g.beginPath(); g.ellipse(x + Math.cos(a) * s, y + Math.sin(a) * s * 0.8, s * 0.8, s * 0.62, a, 0, TAU); g.fill(); }
  g.fillStyle = center; g.beginPath(); g.arc(x, y, s * 0.55, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(x - s * 0.5, y - s * 0.5, s * 0.3, 0, TAU); g.fill();
}
function clover(g, x, y, r) {
  g.fillStyle = r() < 0.5 ? '#86d6a0' : '#9be0ac';
  for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU - Math.PI / 2; g.beginPath(); g.arc(x + Math.cos(a) * 3.2, y + Math.sin(a) * 2.6, 3.2, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(x - 1, y - 3, 1.2, 0, TAU); g.fill();
}
function cookie(g, x, y, r) {
  const s = 11 + r() * 6;
  g.fillStyle = 'rgba(90,120,80,0.2)'; g.beginPath(); g.ellipse(x + 2, y + 4, s * 1.05, s * 0.5, 0, 0, TAU); g.fill();
  const gr = g.createRadialGradient(x - s * 0.3, y - s * 0.3, 2, x, y, s);
  gr.addColorStop(0, '#f6cf8e'); gr.addColorStop(1, '#d99a55');
  g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, s, s * 0.62, 0, 0, TAU); g.fill();
  g.fillStyle = '#5a3420';
  for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(x + (r() - 0.5) * s * 1.2, y + (r() - 0.5) * s * 0.7, 2.2, 1.6, r() * 3, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.ellipse(x - s * 0.35, y - s * 0.25, s * 0.3, s * 0.12, -0.2, 0, TAU); g.fill();
}
function sprinkle(g, x, y, r) {
  const cols = ['#ff7fa8', '#ffd84d', '#6fc2ff', '#b08cff', '#5fd6a0', '#ffffff'];
  g.strokeStyle = cols[(r() * cols.length) | 0];
  g.lineWidth = 2.8;
  const a = r() * TAU;
  g.beginPath(); g.moveTo(x - Math.cos(a) * 3.5, y - Math.sin(a) * 3.5); g.lineTo(x + Math.cos(a) * 3.5, y + Math.sin(a) * 3.5); g.stroke();
}
function candyPebbles(g, x, y, r) {
  for (let k = 0; k < 3; k++) {
    const px = x + (r() - 0.5) * 26, py = y + (r() - 0.5) * 14, s = 4 + r() * 3;
    const c = ['#ffb3cc', '#c9e8ff', '#fff1a6', '#d6fff0'][(r() * 4) | 0];
    g.fillStyle = 'rgba(80,120,90,0.2)'; g.beginPath(); g.ellipse(px + 1, py + 2, s, s * 0.45, 0, 0, TAU); g.fill();
    g.fillStyle = c; g.beginPath(); g.ellipse(px, py, s, s * 0.7, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.arc(px - s * 0.35, py - s * 0.25, s * 0.25, 0, TAU); g.fill();
  }
}
function lilyPad(g, x, y, r) {
  const s = 9 + r() * 6;
  g.fillStyle = '#9fe0a8';
  g.beginPath(); g.moveTo(x, y); g.ellipse(x, y, s, s * 0.55, 0, 0.3, TAU - 0.3); g.closePath(); g.fill();
  g.fillStyle = '#ffb3cc'; g.beginPath(); g.arc(x - s * 0.2, y - s * 0.1, 3, 0, TAU); g.fill();
}
function shell(g, x, y, r) {
  g.fillStyle = r() < 0.5 ? '#ffc8d8' : '#fff';
  g.beginPath(); g.moveTo(x - 6, y + 2); g.quadraticCurveTo(x, y - 9, x + 6, y + 2); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(220,130,150,0.55)'; g.lineWidth = 0.8;
  for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(x, y + 1); g.lineTo(x + k * 2.4, y - 4); g.stroke(); }
}

// ── props ────────────────────────────────────────────────────
const propCache = new Map();
const CANOPY = [['#ffd0e4', '#ffa6c9', '#ff86b4'], ['#d6e6ff', '#a9c6ff', '#8eaaf5'], ['#ecdcff', '#cdb0ff', '#b190f5'], ['#fff4c4', '#ffe08a', '#f5c45a']];

// Fluffy canopy: shadow puffs, body puffs, then highlight puffs, all inside one outline.
function canopy(g, cx, cy, R, cols, seed) {
  const rr = rng(seed);
  const blobs = [];
  for (let i = 0; i < 11; i++) { const a = rr() * TAU, d = Math.sqrt(rr()) * R * 0.62; blobs.push([cx + Math.cos(a) * d * 1.15, cy + Math.sin(a) * d * 0.8, R * (0.42 + rr() * 0.2)]); }
  blobs.push([cx, cy, R * 0.7]);
  g.fillStyle = cols[1];
  for (const [x, y, r] of blobs) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  atop(g, (g) => {
    g.fillStyle = cols[2];
    for (const [x, y, r] of blobs) { g.beginPath(); g.arc(x + r * 0.25, y + r * 0.38, r * 0.82, 0, TAU); g.fill(); }
    g.fillStyle = cols[1];
    for (const [x, y, r] of blobs) { g.beginPath(); g.arc(x - r * 0.08, y - r * 0.05, r * 0.78, 0, TAU); g.fill(); }
    g.fillStyle = cols[0];
    for (const [x, y, r] of blobs) { g.beginPath(); g.arc(x - r * 0.3, y - r * 0.32, r * 0.45, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 9; i++) { const [x, y, r] = blobs[(rr() * blobs.length) | 0]; g.beginPath(); g.arc(x - r * 0.4, y - r * 0.45, 1.6 + rr() * 2.6, 0, TAU); g.fill(); }
    for (let i = 0; i < 4; i++) { g.fillStyle = '#ffffff'; const [x, y] = blobs[(rr() * blobs.length) | 0]; star4(g, x, y - 4, 2.5 + rr() * 2); }
  });
}

function propSprite(kind, v) {
  const key = kind + v;
  if (propCache.has(key)) return propCache.get(key);
  let s;
  const cols = CANOPY[v];
  if (kind === 'tree') {
    // cotton-candy tree on a striped candy trunk
    s = makeSprite(170, 220, 85, 210, (g) => {
      const th = 76;
      const gr = g.createLinearGradient(-8, 0, 8, 0);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.6, '#f6ecf2'); gr.addColorStop(1, '#e2cfda');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(-8, 0); g.quadraticCurveTo(-6, -th * 0.6, -4.5, -th); g.lineTo(4.5, -th); g.quadraticCurveTo(6, -th * 0.6, 8, 0); g.closePath(); g.fill();
      atop(g, (g) => { g.strokeStyle = '#ff8fb4'; g.lineWidth = 4.5; for (let y = -th - 6; y < 6; y += 13) { g.beginPath(); g.moveTo(-12, y + 7); g.lineTo(12, y - 3); g.stroke(); } });
      canopy(g, 0, -th - 46, 56, cols, v * 7 + 1);
    }, { outline: 1.3, outlineColor: rgba(shade(cols[2], -0.4), 0.55) });
  } else if (kind === 'tree2') {
    // an ice-cream tree: waffle-cone trunk, scoop canopy with drips
    s = makeSprite(150, 200, 75, 190, (g) => {
      g.fillStyle = '#e8b46a';
      g.beginPath(); g.moveTo(-22, -70); g.lineTo(22, -70); g.quadraticCurveTo(6, -20, 0, 0); g.quadraticCurveTo(-6, -20, -22, -70); g.fill();
      atop(g, (g) => {
        g.strokeStyle = 'rgba(170,110,50,0.6)'; g.lineWidth = 1.8;
        for (let i = -5; i < 5; i++) { g.beginPath(); g.moveTo(i * 9, -72); g.lineTo(i * 9 + 30, 0); g.stroke(); g.beginPath(); g.moveTo(i * 9, -72); g.lineTo(i * 9 - 30, 0); g.stroke(); }
        const gr = g.createLinearGradient(-22, 0, 22, 0); gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(120,60,20,0.3)');
        g.fillStyle = gr; g.fillRect(-30, -80, 60, 84);
      });
      canopy(g, 0, -112, 46, cols, v * 13 + 5);
      g.fillStyle = cols[1];
      for (const [x, l] of [[-24, 18], [8, 26], [26, 14]]) { g.beginPath(); g.roundRect(x - 4, -84, 8, l, 4); g.fill(); }
    }, { outline: 1.3, outlineColor: rgba(shade(cols[2], -0.4), 0.55) });
  } else if (kind === 'rock') {
    // stacked wafer cookies with cream between the layers
    s = makeSprite(110, 100, 55, 92, (g) => {
      const layers = [[-40, 40, 0, 16], [-36, 36, -24, 14], [-32, 30, -46, 14]];
      for (const [x0, x1, y, h] of layers) {
        g.fillStyle = '#efb969'; g.beginPath(); g.roundRect(x0, y - h, x1 - x0, h, 4); g.fill();
        g.fillStyle = '#fff8ee'; g.beginPath(); g.roundRect(x0 + 2, y - h - 5, x1 - x0 - 4, 6, 3); g.fill();
      }
      atop(g, (g) => {
        g.strokeStyle = 'rgba(180,110,40,0.55)'; g.lineWidth = 1.4;
        for (let i = -8; i < 9; i++) { g.beginPath(); g.moveTo(i * 8, -70); g.lineTo(i * 8 + 70, 0); g.stroke(); g.beginPath(); g.moveTo(i * 8, -70); g.lineTo(i * 8 - 70, 0); g.stroke(); }
        const gr = g.createLinearGradient(-40, 0, 40, 0); gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(140,70,20,0.3)');
        g.fillStyle = gr; g.fillRect(-50, -80, 100, 90);
        const cols2 = ['#ff7fa8', '#ffd84d', '#6fc2ff', '#b08cff'];
        for (let i = 0; i < 8; i++) { g.strokeStyle = cols2[i % 4]; g.lineWidth = 2.6; const x = -26 + i * 7; g.beginPath(); g.moveTo(x, -66); g.lineTo(x + 3, -64); g.stroke(); }
      });
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(-8, -70, 18, 5, 0, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(14, -71, 10, 4, 0, 0, TAU); g.fill();
    }, { outline: 1.3, outlineColor: 'rgba(150,90,40,0.55)' });
  } else if (kind === 'gum') {
    // a cluster of three sugared gumdrops
    const c = ['#ff8fb4', '#8fd8ff', '#b8f08a', '#ffd166'][v];
    const c2 = ['#ffd166', '#ff8fb4', '#c9a6ff', '#8fd8ff'][v];
    s = makeSprite(90, 70, 45, 60, (g) => {
      const drop = (x, y, w, col) => {
        g.fillStyle = col;
        g.beginPath(); g.moveTo(x - w, y); g.bezierCurveTo(x - w * 1.1, y - w * 1.5, x + w * 1.1, y - w * 1.5, x + w, y); g.quadraticCurveTo(x, y + 3, x - w, y); g.fill();
      };
      drop(-14, -4, 16, c2); drop(16, -2, 14, c); drop(0, 2, 20, c);
      atop(g, (g) => {
        const gr = g.createLinearGradient(-30, 0, 30, 0); gr.addColorStop(0, 'rgba(255,255,255,0.45)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(80,40,80,0.25)');
        g.fillStyle = gr; g.fillRect(-40, -40, 80, 46);
        const r2 = rng(v + 3);
        for (let i = 0; i < 50; i++) { g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect((r2() - 0.5) * 70, -r2() * 36, 1.6, 1.6); }
        g.fillStyle = 'rgba(255,255,255,0.75)';
        for (const [x, y] of [[-6, -20], [-20, -18], [12, -16]]) { g.beginPath(); g.ellipse(x, y, 5, 2.6, -0.6, 0, TAU); g.fill(); }
      });
    }, { outline: 1.2, outlineColor: rgba(shade(c, -0.5), 0.55) });
  } else if (kind === 'lolli') {
    const c = ['#ff7fa8', '#7fc8ff', '#b08cff', '#ffb347'][v];
    s = makeSprite(70, 140, 35, 132, (g) => {
      g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(-3, -86, 6, 86, 3); g.fill();
      g.fillStyle = c; g.beginPath(); g.arc(0, -104, 24, 0, TAU); g.fill();
      atop(g, (g) => {
        g.strokeStyle = '#ffffff'; g.lineWidth = 5;
        g.beginPath(); for (let i = 0; i < 50; i++) { const t = i / 50, r = t * 22; g.lineTo(Math.cos(t * 13) * r, -104 + Math.sin(t * 13) * r); } g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.ellipse(-9, -114, 7, 3.5, -0.6, 0, TAU); g.fill();
      });
      g.fillStyle = '#ff9ec2'; g.beginPath(); g.moveTo(-1, -84); g.quadraticCurveTo(-14, -90, -12, -78); g.quadraticCurveTo(-6, -80, -1, -84); g.fill();
      g.beginPath(); g.moveTo(1, -84); g.quadraticCurveTo(14, -90, 12, -78); g.quadraticCurveTo(6, -80, 1, -84); g.fill();
    }, { outline: 1.1, outlineColor: rgba(shade(c, -0.5), 0.5) });
  } else if (kind === 'shroom') {
    // macaron mushrooms in a little group
    const c = ['#ffb3cf', '#b8e4ff', '#d6c2ff', '#b8f0c8'][v];
    s = makeSprite(80, 60, 40, 52, (g) => {
      const m = (x, y, w) => {
        g.fillStyle = '#fff4e6'; g.beginPath(); g.roundRect(x - w * 0.22, y - w * 0.7, w * 0.44, w * 0.7, w * 0.15); g.fill();
        g.fillStyle = c; g.beginPath(); g.ellipse(x, y - w * 0.75, w * 0.62, w * 0.36, 0, Math.PI, 0); g.closePath(); g.fill();
        g.fillStyle = shade(c, -0.12); g.fillRect(x - w * 0.6, y - w * 0.78, w * 1.2, 3);
      };
      m(-14, 0, 26); m(14, 2, 34); m(-2, 6, 18);
      atop(g, (g) => {
        g.fillStyle = 'rgba(255,255,255,0.8)';
        for (const [x, y] of [[-20, -26], [8, -36], [-6, -14]]) { g.beginPath(); g.arc(x, y, 2.4, 0, TAU); g.fill(); g.beginPath(); g.arc(x + 7, y + 3, 1.6, 0, TAU); g.fill(); }
      });
    }, { outline: 1.1, outlineColor: rgba(shade(c, -0.5), 0.5) });
  } else {
    s = makeSprite(40, 110, 20, 104, (g) => {
      g.fillStyle = '#ffffff';
      g.beginPath(); g.roundRect(-3.5, -86, 7, 86, 3); g.fill();
      g.beginPath(); g.arc(-10, -86, 10, Math.PI, 0); g.lineTo(3.5, -86); g.arc(-10, -86, 3.5, 0, Math.PI, true); g.fill();
      atop(g, (g) => { g.strokeStyle = '#ff5a7a'; g.lineWidth = 3.5; for (let y = -100; y < 4; y += 10) { g.beginPath(); g.moveTo(-24, y + 8); g.lineTo(10, y - 4); g.stroke(); } });
      g.fillStyle = '#fff6c2';
      g.beginPath(); g.arc(-20, -78, 7, 0, TAU); g.fill();
    }, { outline: 1.1, outlineColor: 'rgba(200,70,100,0.5)' });
  }
  propCache.set(key, s);
  return s;
}

export function drawProp(g, p, t) {
  g.save();
  g.translate(p.x, p.y);
  // soft contact shadow, a touch bluer than the grass
  const sw = p.kind === 'tree' || p.kind === 'tree2' ? 1.7 : 1.3;
  g.fillStyle = 'rgba(60,120,120,0.16)';
  g.beginPath(); g.ellipse(6, 2, p.r * sw * 1.2, p.r * 0.5, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(60,110,110,0.14)';
  g.beginPath(); g.ellipse(2, 0, p.r * sw * 0.8, p.r * 0.32, 0, 0, TAU); g.fill();
  if (p.kind === 'tree' || p.kind === 'tree2' || p.kind === 'lolli') { const s = Math.sin(t * 1.3 + p.ph) * 0.018; g.transform(1, 0, s, 1, 0, 0); }
  drawSprite(g, p.sprite);
  if (p.kind === 'lamp') {
    const gr = g.createRadialGradient(-20, -78, 2, -20, -78, 44);
    gr.addColorStop(0, 'rgba(255,240,180,0.5)'); gr.addColorStop(1, 'rgba(255,240,180,0)');
    g.fillStyle = gr; g.fillRect(-64, -122, 88, 88);
  }
  g.restore();
}
