// The battlefield: 「녹지 않는 들판」, a wide pastel meadow on an island in a sea of strawberry milk.
// Ground is generated per chunk into offscreen canvases (lazily, with a small LRU), while tall
// props (cotton-candy trees, wafer rocks, gumdrops, candy lamps) are y-sorted with the actors.
import { rng, TAU, mix, rgba, shade, clamp } from '../core/math.js';
import { makeSprite, atop, drawSprite } from './sprite.js';

export const HALF = 1200; // island half-size: playable area is [-HALF, HALF]^2
const CH = 512;

// value noise
function hash2(x, y, s) { let h = x * 374761393 + y * 668265263 + s * 982451653; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, s = 1) { let t = 0, a = 0.5, f = 1; for (let i = 0; i < 4; i++) { t += vnoise(x * f, y * f, s + i) * a; f *= 2; a *= 0.5; } return t; }

// Island edge: a rounded square with a wobbly shoreline.
export function shoreDist(x, y) {
  const k = 6;
  const d = Math.pow(Math.pow(Math.abs(x), k) + Math.pow(Math.abs(y), k), 1 / k);
  const wob = (fbm(x / 300, y / 300, 77) - 0.5) * 90;
  return HALF + 60 + wob - d; // > 0 on land
}

const GRASS = ['#c9f0d0', '#d8f5cf', '#bfe9d6'];
const MEADOW_DEEP = '#a9e2c2';

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
    const kinds = ['tree', 'tree', 'tree', 'rock', 'gum', 'gum', 'lamp', 'tree2'];
    const tries = 260;
    for (let i = 0; i < tries && this.props.length < 70; i++) {
      const x = (r() * 2 - 1) * (HALF - 80), y = (r() * 2 - 1) * (HALF - 80);
      if (Math.hypot(x, y) < 260) continue; // keep the spawn clearing open
      if (shoreDist(x, y) < 120) continue;
      if (this.props.some((p) => Math.hypot(p.x - x, p.y - y) < 190)) continue;
      const kind = kinds[(r() * kinds.length) | 0];
      const v = (r() * 4) | 0;
      this.props.push({ x, y, kind, v, r: PROP_R[kind], sprite: propSprite(kind, v) });
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

  // Draws the ground for the visible rect (world coords).
  drawGround(g, x0, y0, x1, y1, t) {
    // milk sea under everything
    g.fillStyle = '#ffd3e0';
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
    const cx0 = Math.floor(x0 / CH), cy0 = Math.floor(y0 / CH), cx1 = Math.floor(x1 / CH), cy1 = Math.floor(y1 / CH);
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      if (Math.abs(cx * CH + CH / 2) > HALF + 900 || Math.abs(cy * CH + CH / 2) > HALF + 900) continue;
      g.drawImage(this.chunk(cx, cy), cx * CH, cy * CH, CH + 0.5, CH + 0.5);
    }
    // animated sea sparkle + foam along the shore
    g.save();
    g.strokeStyle = 'rgba(255,255,255,0.5)';
    g.lineWidth = 3;
    const step = 140;
    for (let y = Math.floor(y0 / step) * step; y < y1; y += step) {
      for (let x = Math.floor(x0 / step) * step; x < x1; x += step) {
        const h = hash2(x / step, y / step, 5);
        if (shoreDist(x, y) > -40) continue;
        const ph = t * 0.8 + h * 6;
        const a = 0.5 + Math.sin(ph) * 0.5;
        g.globalAlpha = a * 0.7;
        const ox = x + h * 80, oy = y + hash2(y, x, 9) * 80;
        g.beginPath(); g.moveTo(ox - 16, oy); g.quadraticCurveTo(ox - 8, oy - 5, ox, oy); g.quadraticCurveTo(ox + 8, oy + 5, ox + 16, oy); g.stroke();
      }
    }
    g.restore();
  }
}

const PROP_R = { tree: 30, tree2: 26, rock: 34, gum: 22, lamp: 10 };

function paintChunk(g, wx, wy, seed) {
  const img = g.createImageData(CH / 4, CH / 4);
  // low-res base colour field, upscaled smoothly: meadow tones, beach, sea
  const d = img.data;
  for (let j = 0; j < CH / 4; j++) for (let i = 0; i < CH / 4; i++) {
    const x = wx + i * 4, y = wy + j * 4;
    const sd = shoreDist(x, y);
    const n = fbm(x / 420, y / 420, seed);
    const n2 = fbm(x / 120, y / 120, seed + 9);
    let c;
    if (sd < -26) {
      const deep = clamp(-sd / 300, 0, 1);
      c = mix('#ffd3e0', '#ffc2d4', deep * 0.8 + n2 * 0.2);
    } else if (sd < 14) {
      c = mix('#fff3e0', '#ffe9cf', n2);
    } else if (sd < 40) {
      c = mix('#fff3e0', GRASS[0], (sd - 14) / 26);
    } else {
      c = mix(GRASS[0], n > 0.55 ? GRASS[1] : GRASS[2], clamp(Math.abs(n - 0.5) * 3, 0, 1));
      c = mix(c, MEADOW_DEEP, clamp((n2 - 0.6) * 2.2, 0, 0.55));
      // frosting paths: soft cream ribbons winding across the meadow
      const p = Math.abs(fbm(x / 700, y / 700, seed + 31) - 0.5);
      if (p < 0.03) c = mix(c, '#fff8ec', clamp((0.03 - p) / 0.012, 0, 1) * 0.85);
    }
    const n3 = parseInt(c.slice(1), 16), k = (j * (CH / 4) + i) * 4;
    d[k] = (n3 >> 16) & 255; d[k + 1] = (n3 >> 8) & 255; d[k + 2] = n3 & 255; d[k + 3] = 255;
  }
  const small = document.createElement('canvas');
  small.width = small.height = CH / 4;
  small.getContext('2d').putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(small, 0, 0, CH, CH);

  const r = rng(((wx * 73856093) ^ (wy * 19349663) ^ seed) >>> 0);
  g.lineCap = 'round';
  // decorations
  for (let i = 0; i < 150; i++) {
    const lx = r() * CH, ly = r() * CH, x = wx + lx, y = wy + ly;
    const sd = shoreDist(x, y);
    const roll = r();
    if (sd < -30) continue;
    if (sd < 30) {
      if (roll < 0.06) shell(g, lx, ly, r);
      continue;
    }
    if (roll < 0.5) tuft(g, lx, ly, r);
    else if (roll < 0.64) flower(g, lx, ly, r);
    else if (roll < 0.7) sprinkle(g, lx, ly, r);
    else if (roll < 0.715) pebble(g, lx, ly, r);
  }
  // shoreline foam: sample the edge and draw soft white blobs
  for (let i = 0; i < 400; i++) {
    const lx = r() * CH, ly = r() * CH;
    const sd = shoreDist(wx + lx, wy + ly);
    if (sd > -30 && sd < -8) {
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.beginPath(); g.ellipse(lx, ly, 6 + r() * 8, 3 + r() * 3, 0, 0, TAU); g.fill();
    }
  }
}

function tuft(g, x, y, r) {
  const c = r() < 0.5 ? '#9fdcb4' : '#b4e8c2';
  g.strokeStyle = c;
  g.lineWidth = 2.2;
  const h = 6 + r() * 6;
  for (let k = -1; k <= 1; k++) {
    g.beginPath(); g.moveTo(x + k * 2.5, y); g.quadraticCurveTo(x + k * 3, y - h * 0.6, x + k * 5.5, y - h * (k === 0 ? 1.1 : 0.8)); g.stroke();
  }
}
function flower(g, x, y, r) {
  const cols = ['#ffb3cc', '#fff0a6', '#c9b8ff', '#ffffff', '#a8dcff'];
  const c = cols[(r() * cols.length) | 0];
  const s = 2.6 + r() * 2;
  g.fillStyle = c;
  for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; g.beginPath(); g.arc(x + Math.cos(a) * s, y + Math.sin(a) * s, s * 0.75, 0, TAU); g.fill(); }
  g.fillStyle = '#ffd25a'; g.beginPath(); g.arc(x, y, s * 0.55, 0, TAU); g.fill();
}
function sprinkle(g, x, y, r) {
  const cols = ['#ff8fb4', '#ffe066', '#8fd3ff', '#b69cff', '#7ee0b0'];
  g.strokeStyle = cols[(r() * cols.length) | 0];
  g.lineWidth = 2.6;
  const a = r() * TAU;
  g.beginPath(); g.moveTo(x - Math.cos(a) * 3.5, y - Math.sin(a) * 3.5); g.lineTo(x + Math.cos(a) * 3.5, y + Math.sin(a) * 3.5); g.stroke();
}
function pebble(g, x, y, r) {
  g.fillStyle = 'rgba(120,80,60,0.25)';
  g.beginPath(); g.ellipse(x, y + 2, 7, 3, 0, 0, TAU); g.fill();
  g.fillStyle = r() < 0.5 ? '#8a5a3c' : '#a06c48';
  g.beginPath(); g.ellipse(x, y, 6, 4, r(), 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.arc(x - 2, y - 1.5, 1.5, 0, TAU); g.fill();
}
function shell(g, x, y, r) {
  g.fillStyle = r() < 0.5 ? '#ffc8d8' : '#fff';
  g.beginPath(); g.moveTo(x - 6, y + 2); g.quadraticCurveTo(x, y - 9, x + 6, y + 2); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(200,120,140,0.5)'; g.lineWidth = 0.8;
  for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(x, y + 1); g.lineTo(x + k * 2.4, y - 4); g.stroke(); }
}

// ── props ────────────────────────────────────────────────────
const propCache = new Map();
function propSprite(kind, v) {
  const key = kind + v;
  if (propCache.has(key)) return propCache.get(key);
  let s;
  const canopy = [['#ffc2dc', '#ff9cc4'], ['#c9dcff', '#9fbcff'], ['#e6d1ff', '#c6a8ff'], ['#fff1b8', '#ffd97a']][v];
  if (kind === 'tree' || kind === 'tree2') {
    const tall = kind === 'tree';
    s = makeSprite(150, 200, 75, 190, (g) => {
      const trunkH = tall ? 70 : 46;
      g.fillStyle = '#f3e3cf';
      g.beginPath(); g.moveTo(-7, 0); g.quadraticCurveTo(-5, -trunkH * 0.6, -4, -trunkH); g.lineTo(4, -trunkH); g.quadraticCurveTo(5, -trunkH * 0.6, 7, 0); g.closePath(); g.fill();
      atop(g, (g) => { g.strokeStyle = '#ff9cb8'; g.lineWidth = 4; for (let y = -trunkH; y < 0; y += 12) { g.beginPath(); g.moveTo(-10, y + 6); g.lineTo(10, y - 2); g.stroke(); } });
      const cy = -trunkH - (tall ? 42 : 32), R = tall ? 50 : 40;
      g.fillStyle = canopy[0];
      const blobs = [[0, 0, 1], [-0.55, 0.2, 0.7], [0.55, 0.22, 0.72], [-0.25, -0.45, 0.66], [0.3, -0.4, 0.62], [0, 0.4, 0.7]];
      for (const [bx, by, br] of blobs) { g.beginPath(); g.arc(bx * R, cy + by * R, br * R * 0.78, 0, TAU); g.fill(); }
      atop(g, (g) => {
        const gr = g.createRadialGradient(-R * 0.35, cy - R * 0.45, 4, 0, cy, R * 1.3);
        gr.addColorStop(0, 'rgba(255,255,255,0.75)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, rgba(canopy[1], 0.9));
        g.fillStyle = gr; g.fillRect(-R * 2, cy - R * 2, R * 4, R * 4);
        const r2 = rng(v * 7 + (tall ? 1 : 2));
        for (let i = 0; i < 10; i++) { g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.arc((r2() - 0.5) * R * 1.4, cy + (r2() - 0.5) * R * 1.2, 2 + r2() * 3, 0, TAU); g.fill(); }
      });
    }, { outline: 1.4, outlineColor: rgba(shade(canopy[1], -0.5), 0.6) });
  } else if (kind === 'rock') {
    s = makeSprite(100, 80, 50, 70, (g) => {
      g.fillStyle = '#e8b46a';
      g.beginPath(); g.roundRect(-38, -56, 76, 54, 12); g.fill();
      atop(g, (g) => {
        g.strokeStyle = '#c78a45'; g.lineWidth = 2;
        for (let i = -5; i < 6; i++) { g.beginPath(); g.moveTo(i * 12, -60); g.lineTo(i * 12 + 40, 0); g.stroke(); g.beginPath(); g.moveTo(i * 12, -60); g.lineTo(i * 12 - 40, 0); g.stroke(); }
        g.fillStyle = '#f7d79a'; g.fillRect(-40, -58, 80, 9);
        g.fillStyle = 'rgba(120,60,20,0.25)'; g.fillRect(-40, -18, 80, 20);
        g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(-8, -58, 26, 7, 0, 0, TAU); g.fill();
      });
    }, { outline: 1.3, outlineColor: 'rgba(110,60,20,0.6)' });
  } else if (kind === 'gum') {
    const c = ['#ff8fb4', '#8fd8ff', '#b8f08a', '#ffd166'][v];
    s = makeSprite(70, 60, 35, 52, (g) => {
      g.fillStyle = c;
      g.beginPath(); g.moveTo(-24, -2); g.bezierCurveTo(-28, -40, 28, -40, 24, -2); g.quadraticCurveTo(0, 4, -24, -2); g.fill();
      atop(g, (g) => {
        const r2 = rng(v + 3);
        for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect((r2() - 0.5) * 44, -r2() * 34, 1.6, 1.6); }
        const gr = g.createLinearGradient(-24, 0, 24, 0);
        gr.addColorStop(0, 'rgba(255,255,255,0.4)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, rgba(shade(c, -0.5), 0.35));
        g.fillStyle = gr; g.fillRect(-30, -40, 60, 44);
        g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(-9, -24, 6, 3, -0.6, 0, TAU); g.fill();
      });
    }, { outline: 1.3, outlineColor: rgba(shade(c, -0.6), 0.6) });
  } else {
    s = makeSprite(40, 110, 20, 104, (g) => {
      g.fillStyle = '#ffffff';
      g.beginPath(); g.roundRect(-3.5, -86, 7, 86, 3); g.fill();
      g.beginPath(); g.arc(-10, -86, 10, Math.PI, 0); g.lineTo(3.5, -86); g.arc(-10, -86, 3.5, 0, Math.PI, true); g.fill();
      atop(g, (g) => { g.strokeStyle = '#ff5a7a'; g.lineWidth = 3.5; for (let y = -100; y < 4; y += 10) { g.beginPath(); g.moveTo(-24, y + 8); g.lineTo(10, y - 4); g.stroke(); } });
      g.fillStyle = '#fff6c2';
      g.beginPath(); g.arc(-20, -78, 7, 0, TAU); g.fill();
    }, { outline: 1.1, outlineColor: 'rgba(140,40,60,0.6)' });
  }
  propCache.set(key, s);
  return s;
}

export function drawProp(g, p, t) {
  g.save();
  g.translate(p.x, p.y);
  g.fillStyle = 'rgba(60,90,80,0.18)';
  g.beginPath(); g.ellipse(0, 0, p.r * 1.5, p.r * 0.55, 0, 0, TAU); g.fill();
  if (p.kind === 'tree' || p.kind === 'tree2') { const sw = Math.sin(t * 1.3 + p.x * 0.01) * 0.015; g.transform(1, 0, sw, 1, 0, 0); }
  drawSprite(g, p.sprite);
  if (p.kind === 'lamp') {
    const gr = g.createRadialGradient(-20, -78, 2, -20, -78, 40);
    gr.addColorStop(0, 'rgba(255,240,180,0.45)'); gr.addColorStop(1, 'rgba(255,240,180,0)');
    g.fillStyle = gr; g.fillRect(-60, -118, 80, 80);
  }
  g.restore();
}
