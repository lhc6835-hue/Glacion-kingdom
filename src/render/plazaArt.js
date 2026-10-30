// Top-down plaza art: the round cobblestone square on a flower meadow, cookie-tile paths to each
// facility, flower beds, and the three-tier ice cream fountain at the centre.
import { rng, TAU, mix, rgba, shade, clamp } from '../core/math.js';
import { makeSprite, atop, drawSprite } from './sprite.js';
import { fbm, grassClump, flower, clover, sprinkle, candyPebbles, FLOWERS, star4 } from './arenaWorld.js';

export const PLAZA_R = 560;  // radius of the cobblestone square
export const WORLD_R = 1080; // walkable meadow around it
const CH = 512;
// paths from the square's edge out to each facility: [angle, length]
export const PATHS = [[-Math.PI / 2, 300], [Math.PI / 2, 260], [Math.PI, 220], [0, 220]];
const RING_COLS = [['#fdeee2', '#f7e2d2'], ['#ffd2e2', '#ffc3d8'], ['#fdeee2', '#f7e2d2'], ['#dcd2ff', '#cfc2ff'], ['#fdeee2', '#f7e2d2'], ['#c9f0dd', '#b8e9d1']];

function pathDist(x, y) {
  let best = 1e9;
  for (const [a, len] of PATHS) {
    const dx = Math.cos(a), dy = Math.sin(a);
    const t = clamp(x * dx + y * dy, PLAZA_R - 40, PLAZA_R + len);
    const px = dx * t, py = dy * t;
    best = Math.min(best, Math.hypot(x - px, y - py));
  }
  return best;
}

// cobblestones laid in concentric rings, generated once and sorted into chunks
let STONES = null;
function stones() {
  if (STONES) return STONES;
  STONES = [];
  const r = rng(91);
  let ring = 0;
  for (let rad = 250; rad < PLAZA_R - 8; rad += 27, ring++) {
    const n = Math.round((TAU * rad) / 36);
    const off = r() * TAU;
    const cols = RING_COLS[ring % RING_COLS.length];
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * TAU;
      STONES.push({ x: Math.cos(a) * rad, y: Math.sin(a) * rad, a, w: (TAU * rad) / n - 3, h: 23, c: cols[(r() * 2) | 0] });
    }
  }
  // a rosette of petal tiles around the fountain
  return STONES;
}

export class PlazaGround {
  constructor() { this.chunks = new Map(); this.order = []; }
  chunk(cx, cy) {
    const key = cx + ',' + cy;
    let c = this.chunks.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = CH;
    paint(c.getContext('2d'), cx * CH, cy * CH);
    this.chunks.set(key, c);
    this.order.push(key);
    if (this.order.length > 20) this.chunks.delete(this.order.shift());
    return c;
  }
  draw(g, x0, y0, x1, y1) {
    g.fillStyle = '#b5eea6';
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
    for (let cy = Math.floor(y0 / CH); cy <= Math.floor(y1 / CH); cy++) for (let cx = Math.floor(x0 / CH); cx <= Math.floor(x1 / CH); cx++) {
      if (Math.abs(cx * CH) > 1800 || Math.abs(cy * CH) > 1800) continue;
      g.drawImage(this.chunk(cx, cy), cx * CH, cy * CH, CH + 0.5, CH + 0.5);
    }
  }
}

function paint(g, wx, wy) {
  // colour field: meadow, paths, square
  const Q = CH / 4;
  const img = g.createImageData(Q, Q);
  const d = img.data;
  for (let j = 0; j < Q; j++) for (let i = 0; i < Q; i++) {
    const x = wx + i * 4, y = wy + j * 4;
    const rr = Math.hypot(x, y);
    const n = fbm(x / 420, y / 420, 5), n2 = fbm(x / 120, y / 120, 14);
    let c = mix('#b5eea6', n > 0.5 ? '#d4f7b4' : '#a3e8bf', clamp(Math.abs(n - 0.5) * 3.2, 0, 1));
    c = mix(c, '#8edcb0', clamp((n2 - 0.62) * 2.4, 0, 0.45));
    if (rr > WORLD_R + 40) c = mix(c, '#9ad9b0', clamp((rr - WORLD_R - 40) / 200, 0, 0.6));
    const pd = pathDist(x, y);
    if (pd < 70) c = mix(c, '#fff0dc', clamp((70 - pd) / 14, 0, 1));
    if (rr < PLAZA_R + 26) c = mix(c, '#ecd3df', clamp((PLAZA_R + 26 - rr) / 10, 0, 1));
    if (rr < 238) c = mix('#ffe7ef', '#ffd6e5', clamp(rr / 238, 0, 1));
    const v = parseInt(c.slice(1), 16), k = (j * Q + i) * 4;
    d[k] = (v >> 16) & 255; d[k + 1] = (v >> 8) & 255; d[k + 2] = v & 255; d[k + 3] = 255;
  }
  const small = document.createElement('canvas');
  small.width = small.height = Q;
  small.getContext('2d').putImageData(img, 0, 0);
  g.imageSmoothingQuality = 'high';
  g.drawImage(small, 0, 0, CH, CH);
  g.save();
  g.translate(-wx, -wy);
  g.lineCap = 'round';
  const r = rng(((wx * 7349) ^ (wy * 1931)) >>> 0);
  const inView = (x, y, m = 60) => x > wx - m && x < wx + CH + m && y > wy - m && y < wy + CH + m;

  // meadow texture and clustered flowers outside the square and paths
  for (let i = 0; i < 700; i++) {
    const x = wx + r() * CH, y = wy + r() * CH;
    if (Math.hypot(x, y) < PLAZA_R + 40 || pathDist(x, y) < 76) continue;
    g.fillStyle = r() < 0.55 ? 'rgba(240,255,215,0.28)' : 'rgba(110,200,150,0.16)';
    g.beginPath(); g.ellipse(x, y, 6 + r() * 10, 2.5 + r() * 3, -0.3, 0, TAU); g.fill();
  }
  for (let i = 0; i < 60; i++) {
    const x = wx + r() * CH, y = wy + r() * CH;
    if (Math.hypot(x, y) < PLAZA_R + 60 || pathDist(x, y) < 90) continue;
    const roll = r();
    if (roll < 0.45) for (let k = 0; k < 6; k++) grassClump(g, x + (r() - 0.5) * 50, y + (r() - 0.5) * 30, r);
    else if (roll < 0.75) { const col = FLOWERS[(r() * FLOWERS.length) | 0]; for (let k = 0; k < 7; k++) flower(g, x + (r() - 0.5) * 50, y + (r() - 0.5) * 30, col, r); }
    else if (roll < 0.85) for (let k = 0; k < 4; k++) clover(g, x + (r() - 0.5) * 30, y + (r() - 0.5) * 18, r);
    else if (roll < 0.93) for (let k = 0; k < 5; k++) sprinkle(g, x + (r() - 0.5) * 40, y + (r() - 0.5) * 24, r);
    else candyPebbles(g, x, y, r);
  }

  // cookie-tile paths with crumbly edges
  for (const [a, len] of PATHS) {
    const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
    for (let t = PLAZA_R + 10; t < PLAZA_R + len; t += 44) for (let s = -1; s <= 1; s++) {
      const x = dx * t + nx * s * 40 + (s === 0 ? 0 : dx * 22), y = dy * t + ny * s * 40 + (s === 0 ? 0 : dy * 22);
      if (!inView(x, y)) continue;
      tile(g, x, y, Math.atan2(dy, dx), 38, 34, s === 0 ? '#f6d39a' : '#f2c98a', r);
    }
  }

  // the square: curb, stones, rosette
  if (inView(0, 0, PLAZA_R + 80)) {
    for (const st of stones()) {
      if (!inView(st.x, st.y)) continue;
      if (st.petal) petalTile(g, st);
      else stone(g, st);
    }
    // a mosaic band circling the fountain: rose ring with gold dots
    g.strokeStyle = '#ffb3cc'; g.lineWidth = 18;
    g.beginPath(); g.arc(0, 0, 230, 0, TAU); g.stroke();
    g.strokeStyle = '#ffffff'; g.lineWidth = 3;
    g.beginPath(); g.arc(0, 0, 220, 0, TAU); g.stroke();
    g.beginPath(); g.arc(0, 0, 240, 0, TAU); g.stroke();
    g.fillStyle = '#ffd35a';
    for (let i = 0; i < 48; i++) { const a = (i / 48) * TAU; g.beginPath(); g.arc(Math.cos(a) * 230, Math.sin(a) * 230, 3.4, 0, TAU); g.fill(); }
    // cream curb with a scalloped edge
    g.strokeStyle = 'rgba(200,150,175,0.35)'; g.lineWidth = 14;
    g.beginPath(); g.arc(0, 6, PLAZA_R, 0, TAU); g.stroke();
    g.strokeStyle = '#ffffff'; g.lineWidth = 12;
    g.beginPath(); g.arc(0, 0, PLAZA_R, 0, TAU); g.stroke();
    g.fillStyle = '#ffffff';
    const n = 90;
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU; const x = Math.cos(a) * (PLAZA_R + 6), y = Math.sin(a) * (PLAZA_R + 6); if (inView(x, y)) { g.beginPath(); g.arc(x, y, 9, 0, TAU); g.fill(); } }
    // flower beds hugging the curb between the paths
    for (let i = 0; i < 4; i++) {
      const mid = -Math.PI / 4 + (i * Math.PI) / 2;
      for (let k = -5; k <= 5; k++) {
        const a = mid + k * 0.055;
        const x = Math.cos(a) * (PLAZA_R + 42), y = Math.sin(a) * (PLAZA_R + 42);
        if (!inView(x, y)) continue;
        g.fillStyle = 'rgba(120,80,60,0.25)'; g.beginPath(); g.ellipse(x, y + 2, 22, 13, a, 0, TAU); g.fill();
        g.fillStyle = '#9fdcae'; g.beginPath(); g.ellipse(x, y, 20, 12, a, 0, TAU); g.fill();
        const col = FLOWERS[(i + Math.abs(k)) % FLOWERS.length];
        for (let f = 0; f < 3; f++) flower(g, x + (r() - 0.5) * 22, y + (r() - 0.5) * 12, col, r);
      }
    }
  }
  g.restore();
}

function stone(g, st) {
  g.save();
  g.translate(st.x, st.y);
  g.rotate(st.a + Math.PI / 2);
  g.fillStyle = 'rgba(200,150,175,0.35)';
  g.beginPath(); g.roundRect(-st.w / 2 + 1, -st.h / 2 + 3, st.w, st.h, 7); g.fill();
  const gr = g.createLinearGradient(0, -st.h / 2, 0, st.h / 2);
  gr.addColorStop(0, shade(st.c, 0.45)); gr.addColorStop(0.3, st.c); gr.addColorStop(1, shade(st.c, -0.07));
  g.fillStyle = gr;
  g.beginPath(); g.roundRect(-st.w / 2, -st.h / 2, st.w, st.h, 7); g.fill();
  g.restore();
}
function petalTile(g, st) {
  g.save();
  g.translate(st.x, st.y);
  g.rotate(st.a);
  g.fillStyle = 'rgba(200,150,175,0.3)';
  g.beginPath(); g.ellipse(2, 4, st.w / 2, st.h / 2, 0, 0, TAU); g.fill();
  const gr = g.createLinearGradient(-st.w / 2, 0, st.w / 2, 0);
  gr.addColorStop(0, shade(st.c, -0.04)); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(1, st.c);
  g.fillStyle = gr;
  g.beginPath(); g.ellipse(0, 0, st.w / 2, st.h / 2, 0, 0, TAU); g.fill();
  g.restore();
}
function tile(g, x, y, a, w, h, c, r) {
  g.save(); g.translate(x, y); g.rotate(a + (r() - 0.5) * 0.08);
  g.fillStyle = 'rgba(160,110,70,0.25)'; g.beginPath(); g.roundRect(-w / 2 + 2, -h / 2 + 3, w, h, 8); g.fill();
  const gr = g.createLinearGradient(0, -h / 2, 0, h / 2);
  gr.addColorStop(0, shade(c, 0.3)); gr.addColorStop(1, c);
  g.fillStyle = gr; g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, 8); g.fill();
  g.fillStyle = '#7a4a2c';
  for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse((r() - 0.5) * w * 0.6, (r() - 0.5) * h * 0.6, 2.4, 1.7, r() * 3, 0, TAU); g.fill(); }
  g.restore();
}

// ── the fountain ─────────────────────────────────────────────
// Front-facing three-quarter view: a scalloped marble basin of water, and in the middle a
// stack of three scoop-shaped bowls (strawberry, mint, vanilla) on candy-stripe columns, each
// spilling a curtain of water, topped with a cherry and a sparkling jet.
export const FOUNTAIN = { rx: 182, ry: 108 };
const BX = 176, BY = 104, WALL = 30;
const TIERS = [
  { y: -78, r: 96, c: '#ff9fbd', d: '#f27aa0' },
  { y: -164, r: 66, c: '#94ecc8', d: '#62d4a8' },
  { y: -232, r: 42, c: '#ffeaa8', d: '#f2c96a' },
];

let BASIN = null;
function basinSprites() {
  if (BASIN) return BASIN;
  const scallop = (g, rx, ry, n, bump) => {
    g.beginPath();
    for (let i = 0; i <= n * 8; i++) {
      const a = (i / (n * 8)) * TAU;
      const k = 1 + bump * Math.pow(Math.abs(Math.cos((a * n) / 2)), 0.6);
      g.lineTo(Math.cos(a) * rx * k, Math.sin(a) * ry * k);
    }
    g.closePath();
  };
  const back = makeSprite(BX * 2 + 60, BY * 2 + WALL + 60, BX + 30, BY + 30, (g) => {
    // outer wall (visible on the front) then the scalloped marble rim
    g.fillStyle = '#f3c6d8';
    g.save(); g.translate(0, WALL); scallop(g, BX, BY, 20, 0.06); g.fill(); g.restore();
    g.fillRect(-BX * 1.03, 0, BX * 2.06, WALL);
    atop(g, (g) => {
      const gr = g.createLinearGradient(-BX, 0, BX, 0);
      gr.addColorStop(0, '#ffe3ee'); gr.addColorStop(0.35, '#fff4f8'); gr.addColorStop(1, '#e8a9c3');
      g.fillStyle = gr; g.fillRect(-BX * 1.2, 0, BX * 2.4, BY + WALL + 20);
      // vertical panels on the wall
      g.strokeStyle = 'rgba(210,140,170,0.45)'; g.lineWidth = 2;
      for (let i = -9; i <= 9; i++) { const x = (i / 9) * BX * 0.98; const y = Math.sqrt(Math.max(0, 1 - (x / BX) ** 2)) * BY; g.beginPath(); g.moveTo(x, y + 6); g.lineTo(x, y + WALL - 2); g.stroke(); }
      g.fillStyle = '#ffd35a';
      g.fillRect(-BX * 1.1, 4, BX * 2.2, 3);
    });
    const rim = g.createLinearGradient(0, -BY, 0, BY);
    rim.addColorStop(0, '#fff8fb'); rim.addColorStop(1, '#ffdbe8');
    g.fillStyle = rim; scallop(g, BX, BY, 20, 0.06); g.fill();
    g.strokeStyle = '#ffcf5a'; g.lineWidth = 2.2;
    g.beginPath(); g.ellipse(0, 0, BX * 0.93, BY * 0.93, 0, 0, TAU); g.stroke();
    // inner lip
    g.fillStyle = '#f0b8cc'; g.beginPath(); g.ellipse(0, 2, BX * 0.86, BY * 0.84, 0, 0, TAU); g.fill();
  }, { outline: 1.4, outlineColor: 'rgba(200,110,150,0.5)' });
  // the front half of the rim drawn again over the statue's base and water edge
  const front = makeSprite(BX * 2 + 60, BY + WALL + 40, BX + 30, 10, (g) => {
    g.save();
    g.beginPath(); g.rect(-BX * 1.3, 0, BX * 2.6, BY * 1.4); g.clip();
    const rim = g.createLinearGradient(0, -BY, 0, BY);
    rim.addColorStop(0, '#fff8fb'); rim.addColorStop(1, '#ffdbe8');
    g.fillStyle = rim;
    scallop(g, BX, BY, 20, 0.06);
    g.ellipse(0, 2, BX * 0.86, BY * 0.84, 0, 0, TAU, true);
    g.fill('evenodd');
    g.strokeStyle = '#ffcf5a'; g.lineWidth = 2.2;
    g.beginPath(); g.ellipse(0, 0, BX * 0.93, BY * 0.93, 0, 0, Math.PI); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 6; i++) { const a = 0.3 + i * 0.45; g.beginPath(); g.ellipse(Math.cos(a) * BX * 0.95, Math.sin(a) * BY * 0.95, 6, 2, a + 1.57, 0, TAU); g.fill(); }
    g.restore();
  });
  BASIN = { back, front };
  return BASIN;
}

let BOWLS = null;
function bowlSprites() {
  if (BOWLS) return BOWLS;
  BOWLS = TIERS.map((T, i) => makeSprite(T.r * 2.6, T.r * 1.8, T.r * 1.3, T.r * 0.6, (g) => {
    const r = T.r;
    // scoop-shaped bowl: a dome underside with a drippy scalloped rim, viewed from slightly above
    g.fillStyle = T.c;
    g.beginPath();
    g.moveTo(-r, 0);
    g.bezierCurveTo(-r, r * 0.75, r, r * 0.75, r, 0);
    g.ellipse(0, 0, r, r * 0.32, 0, 0, Math.PI, true);
    g.fill();
    // drips hanging off the rim
    const rr = rng(i * 7 + 2);
    for (let k = 0; k < 6; k++) {
      const x = -r * 0.85 + (k / 5) * r * 1.7, y = Math.sqrt(Math.max(0, 1 - (x / r) ** 2)) * r * 0.32;
      const len = r * (0.18 + rr() * 0.3);
      g.beginPath(); g.roundRect(x - 4, y - 2, 8, len, 4); g.fill();
    }
    atop(g, (g) => {
      const gr = g.createLinearGradient(-r, 0, r, 0);
      gr.addColorStop(0, rgba(shade(T.c, 0.5), 0.8)); gr.addColorStop(0.4, rgba(T.c, 0)); gr.addColorStop(1, rgba(T.d, 0.9));
      g.fillStyle = gr; g.fillRect(-r * 1.3, -r, r * 2.6, r * 2);
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.beginPath(); g.ellipse(-r * 0.45, r * 0.3, r * 0.14, r * 0.07, -0.4, 0, TAU); g.fill();
    });
    // rim top and the water held in the bowl
    g.fillStyle = shade(T.c, 0.35);
    g.beginPath(); g.ellipse(0, 0, r, r * 0.32, 0, 0, TAU); g.fill();
    const wg = g.createRadialGradient(-r * 0.2, -r * 0.08, 2, 0, 0, r);
    wg.addColorStop(0, '#ecfdff'); wg.addColorStop(0.6, '#9fe8f8'); wg.addColorStop(1, '#5ccbe8');
    g.fillStyle = wg; g.beginPath(); g.ellipse(0, 0, r * 0.84, r * 0.25, 0, 0, TAU); g.fill();
  }, { outline: 1.2, outlineColor: rgba(shade(T.d, -0.4), 0.55) }));
  return BOWLS;
}

function column(g, y0, y1, w) {
  const gr = g.createLinearGradient(-w / 2, 0, w / 2, 0);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#e9d6e2');
  g.fillStyle = gr;
  g.beginPath(); g.roundRect(-w / 2, y1, w, y0 - y1, w / 2); g.fill();
  g.save(); g.beginPath(); g.roundRect(-w / 2, y1, w, y0 - y1, w / 2); g.clip();
  g.strokeStyle = '#ff9cbc'; g.lineWidth = w * 0.35;
  for (let y = y1 - 10; y < y0 + 10; y += w * 1.1) { g.beginPath(); g.moveTo(-w, y + w * 0.6); g.lineTo(w, y - w * 0.4); g.stroke(); }
  g.restore();
}

// Falling water from a tier rim: a translucent curtain with flowing streaks.
function curtain(g, T, below, t) {
  const r = T.r;
  const drop = below - T.y;
  g.save();
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const x0 = s * r * (0.96 - k * 0.14), spread = s * (20 + k * 8);
      const grd = g.createLinearGradient(0, T.y, 0, T.y + drop);
      grd.addColorStop(0, 'rgba(225,252,255,0.95)'); grd.addColorStop(1, 'rgba(140,225,255,0.55)');
      g.strokeStyle = grd;
      g.lineWidth = 9 - k * 2;
      g.beginPath(); g.moveTo(x0, T.y + 4); g.quadraticCurveTo(x0 + spread, T.y + drop * 0.25, x0 + spread * 1.4, T.y + drop); g.stroke();
      // bright streaks travelling down the stream
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2;
      g.setLineDash([6, 18]); g.lineDashOffset = -t * 120 - k * 9;
      g.beginPath(); g.moveTo(x0, T.y + 4); g.quadraticCurveTo(x0 + spread, T.y + drop * 0.25, x0 + spread * 1.4, T.y + drop); g.stroke();
      g.setLineDash([]);
    }
  }
  // the front sheet: a thin veil over the middle of the bowl
  const veil = g.createLinearGradient(0, T.y, 0, T.y + drop);
  veil.addColorStop(0, 'rgba(225,252,255,0.6)'); veil.addColorStop(1, 'rgba(190,240,255,0.25)');
  g.fillStyle = veil;
  g.beginPath(); g.moveTo(-r * 0.7, T.y + r * 0.25); g.lineTo(r * 0.7, T.y + r * 0.25); g.lineTo(r * 0.85, T.y + drop); g.lineTo(-r * 0.85, T.y + drop); g.closePath(); g.fill();
  g.restore();
}

export function drawFountain(g, t, splash = []) {
  const B = basinSprites();
  const bowls = bowlSprites();
  g.save();
  // ground shadow and the basin
  g.fillStyle = 'rgba(120,80,140,0.18)';
  g.beginPath(); g.ellipse(10, WALL + 14, BX * 1.1, BY * 0.95, 0, 0, TAU); g.fill();
  drawSprite(g, B.back);

  // water: gradient, caustic light lines, ripples where the streams land, petals and coins
  g.save();
  g.beginPath(); g.ellipse(0, 4, BX * 0.85, BY * 0.82, 0, 0, TAU); g.clip();
  const wg = g.createRadialGradient(-BX * 0.3, -BY * 0.3, 10, 0, 0, BX);
  wg.addColorStop(0, '#d9faff'); wg.addColorStop(0.6, '#8fe6f7'); wg.addColorStop(1, '#5fcbe6');
  g.fillStyle = wg; g.fillRect(-BX, -BY, BX * 2, BY * 2 + 10);
  const cr = rng(5);
  g.fillStyle = '#ffd35a';
  for (let i = 0; i < 14; i++) { g.beginPath(); g.ellipse((cr() - 0.5) * BX * 1.4, (cr() - 0.5) * BY * 1.2 + 10, 4, 2.4, cr() * 3, 0, TAU); g.fill(); }
  g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    const y = -BY * 0.7 + i * BY * 0.26;
    g.beginPath();
    for (let x = -BX; x <= BX; x += 12) g.lineTo(x, y + Math.sin(x * 0.05 + t * 1.6 + i * 1.7) * 4 + Math.sin(x * 0.11 - t * 2.3) * 2);
    g.stroke();
  }
  for (let i = 0; i < 6; i++) {
    const k = (t * 0.6 + i / 6) % 1;
    const a = (i / 6) * TAU + 0.4;
    const cx = Math.cos(a) * TIERS[0].r * 1.25, cy = Math.sin(a) * TIERS[0].r * 0.5 + 4;
    g.strokeStyle = `rgba(255,255,255,${0.8 * (1 - k)})`; g.lineWidth = 2.2;
    g.beginPath(); g.ellipse(cx, cy, 8 + k * 34, (8 + k * 34) * 0.45, 0, 0, TAU); g.stroke();
  }
  for (let i = 0; i < 5; i++) {
    const a = t * 0.15 + i * 1.3, rr = BX * (0.45 + (i % 3) * 0.12);
    const px = Math.cos(a) * rr, py = Math.sin(a) * rr * 0.55 + 6;
    g.save(); g.translate(px, py); g.rotate(a * 2);
    g.fillStyle = i % 2 ? '#ffc2d8' : '#ffffff';
    g.beginPath(); g.ellipse(0, 0, 6, 3.4, 0, 0, TAU); g.fill();
    g.restore();
  }
  g.restore();

  // statue: base, columns, bowls, curtains, cherry and jet
  g.fillStyle = '#d9caff';
  g.beginPath(); g.ellipse(0, -8, 52, 19, 0, 0, TAU); g.fill();
  g.fillRect(-52, -30, 104, 22);
  g.fillStyle = '#f3ecff'; g.beginPath(); g.ellipse(0, -30, 52, 19, 0, 0, TAU); g.fill();
  g.strokeStyle = '#ffd35a'; g.lineWidth = 2; g.beginPath(); g.ellipse(0, -30, 44, 15, 0, 0, TAU); g.stroke();
  column(g, -30, TIERS[0].y + 8, 22);
  drawSprite(g, bowls[0], 0, TIERS[0].y);
  curtain(g, TIERS[0], -2, t);
  column(g, TIERS[0].y - 4, TIERS[1].y + 6, 16);
  drawSprite(g, bowls[1], 0, TIERS[1].y);
  curtain(g, TIERS[1], TIERS[0].y - 2, t);
  column(g, TIERS[1].y - 4, TIERS[2].y + 4, 12);
  drawSprite(g, bowls[2], 0, TIERS[2].y);
  curtain(g, TIERS[2], TIERS[1].y - 2, t);
  // the cherry on top
  const cy = TIERS[2].y - 20 + Math.sin(t * 2) * 1.5;
  const cg = g.createRadialGradient(-4, cy - 5, 1, 0, cy, 14);
  cg.addColorStop(0, '#ff9aaf'); cg.addColorStop(0.6, '#ec3a5a'); cg.addColorStop(1, '#b51f3c');
  g.fillStyle = cg; g.beginPath(); g.arc(0, cy, 17, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.ellipse(-4, cy - 5, 4, 2.4, -0.5, 0, TAU); g.fill();
  g.strokeStyle = '#5a8a3a'; g.lineWidth = 2.4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(2, cy - 11); g.quadraticCurveTo(6, cy - 24, 14, cy - 28); g.stroke();
  g.fillStyle = '#7ec850'; g.beginPath(); g.ellipse(18, cy - 27, 7, 3.4, -0.4, 0, TAU); g.fill();
  // jet: a pulsing column with a crown of droplets
  const jh = 58 + Math.sin(t * 5) * 6;
  const jg = g.createLinearGradient(0, cy - 12 - jh, 0, cy - 12);
  jg.addColorStop(0, 'rgba(230,252,255,0.2)'); jg.addColorStop(1, 'rgba(210,248,255,0.9)');
  g.fillStyle = jg;
  g.beginPath(); g.moveTo(-4, cy - 12); g.quadraticCurveTo(-2, cy - 12 - jh * 0.6, 0, cy - 12 - jh); g.quadraticCurveTo(2, cy - 12 - jh * 0.6, 4, cy - 12); g.fill();
  for (let i = 0; i < 10; i++) {
    const k = (t * 1.2 + i / 10) % 1;
    const a = (i / 10) * TAU;
    const px = Math.cos(a) * 30 * k, py = cy - 12 - jh + k * k * 70 - Math.sin(k * Math.PI) * 14;
    g.fillStyle = `rgba(220,250,255,${1 - k})`;
    g.beginPath(); g.arc(px, py, 3 - k * 1.5, 0, TAU); g.fill();
  }
  // tossed-coin splashes
  g.fillStyle = 'rgba(220,250,255,0.95)';
  for (const d of splash) { g.beginPath(); g.arc(d.x, d.y, 3.2, 0, TAU); g.fill(); }
  drawSprite(g, B.front);
  // a faint rainbow in the spray and twinkles
  g.save();
  g.globalAlpha = 0.18 + Math.sin(t * 0.7) * 0.06;
  ['#ff8fb4', '#ffd35a', '#9ff0b0', '#8fd0ff', '#c9a6ff'].forEach((c, i) => {
    g.strokeStyle = c; g.lineWidth = 6;
    g.beginPath(); g.arc(0, -40, 150 - i * 6, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
  });
  g.restore();
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 6; i++) {
    const p = (t * 0.8 + i * 0.29) % 1;
    const rr2 = rng(i * 13 + Math.floor(t * 0.8 + i * 0.29));
    star4(g, (rr2() - 0.5) * BX * 1.6, (rr2() - 0.5) * BY * 1.2 - rr2() * 140, Math.sin(p * Math.PI) * 6);
  }
  g.restore();
}

// candy lamp post for the plaza ring
const lampCache = {};
export function lampSprite() {
  return lampCache.s || (lampCache.s = makeSprite(60, 230, 30, 222, (g) => {
    const post = g.createLinearGradient(-6, 0, 6, 0);
    post.addColorStop(0, '#ffffff'); post.addColorStop(1, '#eadbe4');
    g.fillStyle = post; g.beginPath(); g.roundRect(-5, -180, 10, 180, 4); g.fill();
    atop(g, (g) => { g.strokeStyle = '#ff9cbc'; g.lineWidth = 3.5; for (let y = -190; y < 10; y += 15) { g.beginPath(); g.moveTo(-8, y + 7); g.lineTo(8, y); g.stroke(); } });
    g.fillStyle = '#ff9cbc'; g.beginPath(); g.roundRect(-11, -24, 22, 24, 6); g.fill();
    g.fillStyle = '#ffd35a'; g.beginPath(); g.roundRect(-9, -188, 18, 8, 3); g.fill();
    const bg = g.createRadialGradient(-5, -206, 2, 0, -200, 18);
    bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, '#fff0a0');
    g.fillStyle = bg; g.beginPath(); g.arc(0, -200, 16, 0, TAU); g.fill();
    g.fillStyle = '#ff9cbc'; g.beginPath(); g.ellipse(0, -216, 12, 5, 0, Math.PI, 0); g.fill();
  }, { outline: 1.1, outlineColor: 'rgba(200,100,140,0.45)' }));
}
export function drawLampGlow(g, x, y, t) {
  const gl = g.createRadialGradient(x, y - 200, 4, x, y - 200, 60 + Math.sin(t * 2 + x) * 4);
  gl.addColorStop(0, 'rgba(255,245,190,0.55)'); gl.addColorStop(1, 'rgba(255,245,190,0)');
  g.fillStyle = gl; g.fillRect(x - 70, y - 270, 140, 140);
}

// ── facility sprites (front-facing, drawn in the y-sorted world) ──
export function drawGachaMachine(g, x, c, light, label, t) {
  g.save();
  g.translate(x, 0);
  g.fillStyle = 'rgba(80,40,60,0.18)'; g.beginPath(); g.ellipse(0, 4, 90, 14, 0, 0, TAU); g.fill();
  // base
  g.fillStyle = c; g.strokeStyle = rgba(shade(c, -0.5), 0.7); g.lineWidth = 3;
  g.beginPath(); g.roundRect(-70, -150, 140, 150, [22, 22, 10, 10]); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(-60, -140, 16, 130);
  g.fillStyle = rgba(shade(c, -0.5), 0.6); g.beginPath(); g.roundRect(-26, -70, 52, 40, 10); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(40, -110, 16, 0, TAU); g.fill(); g.stroke();
  g.save(); g.translate(40, -110); g.rotate(t * 0.8); g.fillStyle = c; g.fillRect(-12, -3, 24, 6); g.restore();
  // globe
  g.fillStyle = 'rgba(230,246,255,0.75)';
  g.beginPath(); g.arc(0, -238, 92, 0, TAU); g.fill();
  const cols = ['#ff8fb4', '#ffe066', '#8fd3ff', '#b69cff', '#7ee0b0', '#ffb36b'];
  const r = rng(x);
  for (let i = 0; i < 16; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * 70, cx = Math.cos(a) * d, cy = -222 + Math.abs(Math.sin(a)) * d * 0.7 + Math.sin(t * 2 + i) * 2;
    g.fillStyle = cols[i % 6]; g.beginPath(); g.arc(cx, cy, 16, Math.PI, 0); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx, cy, 16, 0, Math.PI); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.1)'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, 16, 0, TAU); g.stroke();
  }
  g.strokeStyle = '#ffffff'; g.lineWidth = 8; g.beginPath(); g.arc(0, -238, 92, 0, TAU); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(-40, -280, 22, 12, -0.6, 0, TAU); g.fill();
  // cap + sign
  g.fillStyle = c; g.beginPath(); g.ellipse(0, -332, 40, 16, 0, 0, TAU); g.fill();
  g.fillStyle = light; g.beginPath(); g.roundRect(-58, -392, 116, 40, 20); g.fill();
  g.strokeStyle = c; g.lineWidth = 3; g.stroke();
  g.fillStyle = '#4a2c3a'; g.font = '22px Jua'; g.textAlign = 'center'; g.fillText(label, 0, -364);
  g.restore();
}

// Facility sprites, baked once.
const S = {};
function once(key, fn) { return S[key] || (S[key] = fn()); }
const OUT = { outline: 1.4, outlineColor: 'rgba(120,70,100,0.55)' };

export function gallerySprite() {
  return once('gallery', () => makeSprite(360, 560, 180, 540, (g) => {
    // pastel tower with a waffle-cone spire
    g.fillStyle = '#fff4f8';
    g.fillRect(-150, -380, 300, 380);
    g.fillStyle = '#ffe0ea'; g.fillRect(-150, -380, 300, 26);
    g.fillStyle = '#e2a95d';
    g.beginPath(); g.moveTo(-110, -380); g.lineTo(0, -530); g.lineTo(110, -380); g.closePath(); g.fill();
    atop(g, (g) => {
      g.strokeStyle = '#b5793a'; g.lineWidth = 3;
      for (let i = -10; i < 10; i++) { g.beginPath(); g.moveTo(i * 22, -540); g.lineTo(i * 22 + 160, -380); g.stroke(); g.beginPath(); g.moveTo(i * 22, -540); g.lineTo(i * 22 - 160, -380); g.stroke(); }
      for (let fl = 0; fl < 5; fl++) {
        const y = -350 + fl * 66;
        for (let k = 0; k < 4; k++) { g.fillStyle = ['#c9e8ff', '#ffd6e4', '#fff1b8', '#d6fff0', '#e6d6ff'][fl]; g.beginPath(); g.roundRect(-130 + k * 66, y, 46, 44, [23, 23, 4, 4]); g.fill(); }
      }
      g.fillStyle = 'rgba(0,0,0,0.05)'; g.fillRect(90, -380, 60, 380);
    });
    g.fillStyle = '#ffb3cc'; g.beginPath(); g.ellipse(0, -545, 26, 22, 0, 0, TAU); g.fill();
    g.fillStyle = '#ff7aa2'; g.beginPath(); g.arc(4, -566, 7, 0, TAU); g.fill();
    g.fillStyle = '#ff9cbc'; g.beginPath(); g.roundRect(-46, -112, 92, 112, [46, 46, 0, 0]); g.fill();
    g.fillStyle = '#ffd6e4'; g.beginPath(); g.roundRect(-34, -100, 68, 100, [34, 34, 0, 0]); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(-96, -170, 192, 44, 22); g.fill();
    g.fillStyle = '#4a2c3a'; g.font = '28px Jua'; g.textAlign = 'center'; g.fillText('틀 갤러리', 0, -138);
  }, OUT));
}

export function boardSprite() {
  return once('board', () => makeSprite(300, 340, 150, 330, (g) => {
    g.fillStyle = '#c98a4c';
    g.fillRect(-110, -60, 14, 60); g.fillRect(96, -60, 14, 60);
    g.beginPath(); g.roundRect(-130, -300, 260, 250, 18); g.fill();
    g.fillStyle = '#fff6e8'; g.beginPath(); g.roundRect(-114, -284, 228, 218, 12); g.fill();
    const notes = [['#ffd6e4', -100, -270, -0.05], ['#d6ecff', 4, -262, 0.06], ['#fff1b8', -92, -170, 0.04], ['#d6fff0', 10, -165, -0.05]];
    for (const [c, x, y, a] of notes) {
      g.save(); g.translate(x + 45, y + 40); g.rotate(a);
      g.fillStyle = c; g.fillRect(-45, -40, 90, 80);
      g.fillStyle = 'rgba(74,44,58,0.35)'; for (let k = 0; k < 4; k++) g.fillRect(-34, -24 + k * 14, 60 - (k % 2) * 18, 4);
      g.fillStyle = '#ff7aa2'; g.beginPath(); g.arc(0, -36, 4, 0, TAU); g.fill();
      g.restore();
    }
    g.fillStyle = '#ff9cbc'; g.beginPath(); g.roundRect(-90, -326, 180, 40, 20); g.fill();
    g.fillStyle = '#fff'; g.font = '22px Jua'; g.textAlign = 'center'; g.fillText('오늘의 게시판', 0, -298);
  }, OUT));
}

export function faceShopSprite() {
  return once('faceshop', () => makeSprite(320, 380, 160, 370, (g) => {
    g.fillStyle = '#fff8ee'; g.beginPath(); g.roundRect(-130, -260, 260, 260, [8, 8, 0, 0]); g.fill();
    // striped awning
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#b69cff'; g.beginPath(); g.moveTo(-150 + i * 37.5, -290); g.lineTo(-150 + (i + 1) * 37.5, -290); g.lineTo(-150 + (i + 1) * 37.5, -236); g.arc(-150 + (i + 0.5) * 37.5, -236, 18.75, 0, Math.PI); g.closePath(); g.fill(); }
    // mirror
    g.fillStyle = '#ffd35a'; g.beginPath(); g.ellipse(0, -150, 62, 76, 0, 0, TAU); g.fill();
    g.fillStyle = '#dff4ff'; g.beginPath(); g.ellipse(0, -150, 50, 64, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.ellipse(-20, -176, 10, 22, 0.4, 0, TAU); g.fill();
    // the shop's mascot face in the mirror: dot eyes + hook smile
    g.fillStyle = '#2b1c1e'; g.beginPath(); g.arc(-6, -156, 3.6, 0, TAU); g.arc(8, -156, 3.6, 0, TAU); g.fill();
    g.strokeStyle = '#2b1c1e'; g.lineWidth = 3.6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-13, -142); g.bezierCurveTo(-12, -131, 10, -130, 12, -141); g.quadraticCurveTo(13, -145, 12, -147); g.stroke();
    g.fillStyle = '#c9b8ff'; g.fillRect(-130, -60, 260, 60);
    g.fillStyle = '#fff'; g.beginPath(); g.roundRect(-80, -336, 160, 40, 20); g.fill();
    g.fillStyle = '#4a2c3a'; g.font = '22px Jua'; g.textAlign = 'center'; g.fillText('표정 가게', 0, -308);
  }, OUT));
}

export function benchSprite() {
  return once('bench', () => makeSprite(200, 120, 100, 110, (g) => {
    g.fillStyle = '#ffffff';
    g.fillRect(-66, -46, 8, 46); g.fillRect(58, -46, 8, 46);
    g.fillStyle = '#ff9cbc'; g.beginPath(); g.roundRect(-80, -54, 160, 12, 6); g.fill();
    g.fillStyle = '#ffb7c9'; for (let i = 0; i < 3; i++) { g.beginPath(); g.roundRect(-80, -100 + i * 15, 160, 10, 5); g.fill(); }
  }, OUT));
}

export function portalSprite() {
  return once('portal', () => makeSprite(300, 360, 150, 350, (g) => {
    g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(0, -170, 108, 142, 0, 0, TAU); g.fill();
    g.fillStyle = '#ffe1ec'; g.beginPath(); g.ellipse(0, -170, 96, 130, 0, 0, TAU); g.fill();
    g.fillStyle = '#e2a95d'; g.beginPath(); g.roundRect(-120, -26, 240, 26, 10); g.fill();
    atop(g, (g) => { g.strokeStyle = '#b5793a'; g.lineWidth = 2; for (let i = -12; i < 12; i++) { g.beginPath(); g.moveTo(i * 12, -26); g.lineTo(i * 12 + 26, 0); g.stroke(); } });
    g.fillStyle = '#ff7aa2'; g.beginPath(); g.roundRect(-84, -334, 168, 42, 21); g.fill();
    g.fillStyle = '#fff'; g.font = '24px Jua'; g.textAlign = 'center'; g.fillText('플레이 존', 0, -305);
  }, OUT));
}

