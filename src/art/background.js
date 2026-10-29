// Parallax strips for the shaded valley. Each strip tiles seamlessly over STRIP_W pixels.
import { PixBuf } from '../gfx/PixBuf.js';
import { mulberry32, hash2, fbm1 } from '../core/Rng.js';
import { silhouetteTree } from './trees.js';

export const STRIP_W = 1024;

// Distant pale peaks beyond the valley walls.
function peaks() {
  const H = 110, b = new PixBuf(STRIP_W, H);
  for (let x = 0; x < STRIP_W; x++) {
    const top = Math.round(20 + fbm1(x / 90, 11, 4, STRIP_W / 90) * 70);
    for (let y = top; y < H; y++) {
      const snow = y - top < 4 + hash2(x, 0, 3) * 3 && top < 50;
      const lit = fbm1(x / 14 + y / 30, 4, 2) > 0.55;
      b.set(x, y, snow ? '#c8dcd8' : lit ? '#8fb0b0' : '#7a9ea2');
    }
  }
  return { c: b.toCanvas(), H, f: 0.05 };
}

// Valley walls: layered cliffs with ledges of trees and two waterfalls.
function cliffs() {
  const H = 170, b = new PixBuf(STRIP_W, H);
  const falls = [220, 690];
  const base = ['#3d6466', '#4a7472', '#5a8480', '#6c948c'];
  for (let x = 0; x < STRIP_W; x++) {
    const top = Math.round(14 + fbm1(x / 70, 21, 5, STRIP_W / 70) * 90);
    for (let y = top; y < H; y++) {
      const strata = Math.floor((y + fbm1(x / 40, 5, 2, STRIP_W / 40) * 10) / 9);
      let k = (strata % 3 === 0 ? 1 : 2) + (hash2(Math.floor(x / 3), strata, 2) > 0.7 ? 1 : 0);
      if (y - top < 2) k = 3;
      if (hash2(x, Math.floor(y / 4), 8) < 0.05) k = 0; // cracks
      b.set(x, y, base[Math.min(3, k)]);
    }
    // moss and ledge trees along the rim
    if (hash2(x, 1, 6) < 0.5) b.set(x, top, '#5f8a6a');
  }
  const rnd = mulberry32(31);
  for (let i = 0; i < 60; i++) {
    const x = Math.floor(rnd() * STRIP_W);
    const top = Math.round(14 + fbm1(x / 70, 21, 5, STRIP_W / 70) * 90);
    silhouetteTree(b, x, top + 2, 10 + rnd() * 14, rnd() < 0.7 ? 'pine' : 'round', ['#3a6460', '#4f7a70'], i);
  }
  for (const fx of falls) {
    const top = Math.round(14 + fbm1(fx / 70, 21, 5, STRIP_W / 70) * 90);
    for (let y = top + 2; y < H; y++) for (let i = -2; i <= 2; i++) b.set(fx + i, y, Math.abs(i) === 2 ? '#a8cfc8' : '#d6efe8');
  }
  return { c: b.toCanvas(), H, f: 0.12, falls };
}

function forestStrip(H, count, minH, maxH, cols, seed, f, opts = {}) {
  const b = new PixBuf(STRIP_W, H);
  const rnd = mulberry32(seed);
  // undergrowth band
  for (let x = 0; x < STRIP_W; x++) {
    const t = Math.round(H - (opts.band || 14) - fbm1(x / 25, seed, 3, STRIP_W / 25) * 10);
    for (let y = t; y < H; y++) b.set(x, y, y - t < 1 && hash2(x, y, seed) < 0.5 ? cols[1] : cols[0]);
  }
  for (let i = 0; i < count; i++) {
    const x = Math.floor((i / count) * STRIP_W + rnd() * (STRIP_W / count));
    const h = minH + rnd() * (maxH - minH);
    // draw twice near the seam so the strip tiles
    for (const off of [0, -STRIP_W, STRIP_W]) if (x + off > -60 && x + off < STRIP_W + 60) silhouetteTree(b, x + off, H - 4, h, rnd() < (opts.pine ?? 0.6) ? 'pine' : 'round', cols, seed * 100 + i);
  }
  return { c: b.toCanvas(), H, f };
}

// Tall dark trunks close behind the play area; crowns run off the top of the screen.
function nearTrunks() {
  const H = 340, b = new PixBuf(STRIP_W, H);
  const rnd = mulberry32(77);
  const n = 8;
  for (let i = 0; i < n; i++) {
    const x0 = Math.floor((i / n) * STRIP_W + rnd() * 50);
    const w = 5 + Math.floor(rnd() * 13);
    for (const off of [0, -STRIP_W, STRIP_W]) {
      const x = x0 + off;
      if (x < -30 || x > STRIP_W + 30) continue;
      for (let y = 0; y < H; y++) {
        const flare = y > H - 10 ? (y - (H - 10)) * 0.8 : 0;
        for (let k = -Math.round(w / 2 + flare); k <= Math.round(w / 2 + flare); k++) {
          const u = (k + w / 2) / w;
          const col = u < 0.25 ? '#2e3e36' : u < 0.7 ? '#1f2e2a' : '#162320';
          b.set(x + k, y, hash2(x + k, y >> 2, 5) < 0.1 ? '#14201c' : col);
        }
        if (hash2(x, y, 3) < 0.04) b.set(x - Math.round(w / 2), y, '#3a6a4a'); // moss flecks
      }
      // a few bare side branches
      for (let k = 0; k < 2; k++) {
        const by = Math.floor(90 + rnd() * 90), dir = rnd() < 0.5 ? -1 : 1, len = 14 + rnd() * 20;
        for (let j = 0; j < len; j++) { b.set(x + dir * (w / 2 + j), by - Math.floor(j * 0.5), '#1f2e2a'); b.set(x + dir * (w / 2 + j), by - Math.floor(j * 0.5) + 1, '#162320'); }
      }
    }
  }
  return { c: b.toCanvas(), H, f: 0.6 };
}

// Canopy ceiling hung from the top of the screen. The gaps are where light shafts fall through.
function canopy() {
  const H = 80, b = new PixBuf(STRIP_W, H);
  const gaps = [70, 190, 330, 470, 600, 760, 880, 975];
  const gapAt = (x) => {
    let d = 1;
    for (const g of gaps) { const dd = Math.min(Math.abs(x - g), STRIP_W - Math.abs(x - g)) / 16; d = Math.min(d, dd); }
    return d; // 0 at a gap centre, 1 away from gaps
  };
  for (let x = 0; x < STRIP_W; x++) {
    const open = gapAt(x);
    const depth = Math.round((10 + fbm1(x / 14, 51, 4, STRIP_W / 14) * 34) * (0.25 + 0.75 * Math.min(1, open)));
    for (let y = 0; y < depth; y++) {
      const edge = depth - y;
      let c = '#0e221c';
      if (edge < 3) c = hash2(x, y, 3) < 0.55 ? '#1d3e30' : '#14302a';
      if (edge < 2 && hash2(x, y, 4) < 0.3) c = open < 0.8 ? '#4a7a48' : '#2a5040'; // rim light near gaps
      if (y < depth - 3 && hash2(x >> 1, y >> 1, 5) < 0.06) c = '#183428';
      b.set(x, y, c);
    }
    // dangling leaf clumps below the edge
    if (hash2(x, 9, 6) < 0.07) for (let k = 0; k < 2 + hash2(x, 8, 6) * 7; k++) { b.set(x, depth + k, '#14302a'); if (k % 2) b.set(x + 1, depth + k, '#1d3e30'); }
  }
  return { c: b.toCanvas(), H, f: 0.6, gaps };
}

// Ferns along the bottom and leaves hanging from the top, nearest to the camera.
function foreground() {
  const Hb = 46, Ht = 60;
  const bot = new PixBuf(STRIP_W, Hb), top = new PixBuf(STRIP_W, Ht);
  const rnd = mulberry32(5);
  for (let i = 0; i < 9; i++) {
    const x = Math.floor(rnd() * STRIP_W);
    const fronds = 5 + Math.floor(rnd() * 4);
    for (let f = 0; f < fronds; f++) {
      const ang = -Math.PI / 2 + (f / (fronds - 1) - 0.5) * 2.4;
      const len = 22 + rnd() * 20;
      for (let j = 0; j < len; j++) {
        const t = j / len;
        const px = x + Math.cos(ang) * j, py = Hb - 1 + Math.sin(ang) * j + t * t * 14;
        for (const off of [0, -STRIP_W, STRIP_W]) {
          bot.set(Math.round(px + off), Math.round(py), '#0e1e1a');
          const leaf = Math.round((1 - t) * 4);
          for (let l = 1; l <= leaf; l++) if (j % 2 === 0) {
            bot.set(Math.round(px + off - Math.sin(ang) * l), Math.round(py + Math.cos(ang) * l * 0.5 + l * 0.5), l === 1 ? '#13281f' : '#0e1e1a');
            bot.set(Math.round(px + off + Math.sin(ang) * l), Math.round(py - Math.cos(ang) * l * 0.5 + l * 0.5), '#0e1e1a');
          }
        }
      }
    }
  }
  for (let i = 0; i < 12; i++) {
    const x = Math.floor(rnd() * STRIP_W), len = 12 + rnd() * (Ht - 14);
    for (let y = 0; y < len; y++) {
      const sx = Math.round(x + Math.sin(y / 7 + i) * 1.5);
      for (const off of [0, -STRIP_W, STRIP_W]) {
        top.set(sx + off, y, '#0c1a16');
        if (y % 4 === 0) { top.set(sx + off - 1, y + 1, '#12261e'); top.set(sx + off + 1, y + 2, '#0c1a16'); top.set(sx + off + 2, y + 2, '#12261e'); }
      }
    }
  }
  for (let x = 0; x < STRIP_W; x++) {
    const d = Math.round(fbm1(x / 30, 12, 3, STRIP_W / 30) * 14 - 4);
    for (let y = 0; y < d; y++) top.set(x, y, '#0a1612');
  }
  return { bot: { c: bot.toCanvas(), H: Hb, f: 1.15 }, top: { c: top.toCanvas(), H: Ht, f: 1.15 } };
}

export function cloudSprite(seed) {
  const rnd = mulberry32(seed);
  const W = 50 + Math.floor(rnd() * 50), H = 18 + Math.floor(rnd() * 8);
  const b = new PixBuf(W, H);
  const puffs = 4 + Math.floor(rnd() * 3);
  const cs = [];
  for (let i = 0; i < puffs; i++) cs.push({ x: W * (0.15 + 0.7 * (i / (puffs - 1))) + (rnd() - 0.5) * 6, y: H * 0.6 - rnd() * H * 0.3, r: H * (0.3 + rnd() * 0.25) });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let inside = false, top = 1;
    for (const c of cs) { const d = Math.hypot(x - c.x, (y - c.y) * 1.3); if (d < c.r) { inside = true; top = Math.min(top, (y - (c.y - c.r)) / (c.r * 2)); } }
    if (!inside || y > H - 2) continue;
    b.set(x, y, top < 0.25 ? '#f4f8ec' : y > H * 0.7 ? '#a8c4c0' : '#d8e6e0');
  }
  return b.toCanvas();
}

export function buildStrips() {
  return {
    peaks: peaks(),
    cliffs: cliffs(),
    far: forestStrip(90, 70, 24, 44, ['#3a6664', '#4a7672'], 3, 0.2, { band: 10 }),
    mid: forestStrip(150, 34, 60, 120, ['#1e3e3a', '#2c5248'], 9, 0.35, { band: 18, pine: 0.5 }),
    near: nearTrunks(),
    canopy: canopy(),
    fg: foreground(),
    clouds: [1, 2, 3, 4, 5].map((s) => cloudSprite(s)),
  };
}

