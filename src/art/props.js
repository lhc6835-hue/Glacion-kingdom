// Buildings and set pieces of the valley camp. Each returns { c, ax, ay } with the anchor at the
// point that touches the ground, plus any light/emitter points the renderer needs.
import { makeCanvas } from '../gfx/PixBuf.js';
import { mulberry32, hash2 } from '../core/Rng.js';
import { PAL } from './palette.js';

function painter(w, h) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const r = (x, y, ww, hh, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(ww), Math.round(hh)); };
  const p = (x, y, col) => r(x, y, 1, 1, col);
  return { c, g, r, p };
}

const W = PAL.wood, ST = PAL.stone, CL = PAL.cloth;

function planks(r, x, y, w, h, vertical, seed) {
  if (vertical) for (let i = 0; i < w; i += 4) { r(x + i, y, 4, h, hash2(i, 0, seed) < 0.5 ? W[3] : W[2]); r(x + i, y, 1, h, W[1]); }
  else for (let j = 0; j < h; j += 3) { r(x, y + j, w, 3, hash2(0, j, seed) < 0.5 ? W[3] : W[2]); r(x, y + j + 2, w, 1, W[1]); }
}

export function tent() {
  const w = 74, h = 48;
  const { c, r, p } = painter(w, h);
  // canvas A-frame with stripes
  for (let y = 0; y < 38; y++) {
    const half = 4 + y * 0.9;
    for (let x = -half; x <= half; x++) {
      const stripe = Math.floor((x + 40) / 6) % 2 === 0;
      const shade = x > half * 0.3;
      p(37 + x, 6 + y, stripe ? (shade ? CL[2] : CL[3]) : shade ? PAL.teal[2] : PAL.teal[3]);
    }
    p(37 - half - 1, 6 + y, PAL.ink); p(37 + half + 1, 6 + y, PAL.ink);
  }
  r(30, 22, 14, 22, '#1a1210'); // dark entrance
  r(29, 22, 2, 22, CL[1]); r(43, 22, 2, 22, CL[1]);
  r(36, 0, 2, 8, W[2]); r(35, 0, 4, 1, W[4]); // pole tip
  // crates and a sack
  planks(r, 2, 32, 16, 12, true, 3); r(2, 32, 16, 1, W[5]); r(2, 43, 16, 1, W[0]);
  planks(r, 56, 36, 14, 8, true, 4); r(56, 36, 14, 1, W[5]);
  r(60, 30, 8, 6, '#b8a07a'); r(61, 29, 6, 1, '#d4bc94'); r(60, 35, 8, 1, '#7a6448');
  // hanging coin sign
  r(48, 10, 1, 8, W[1]); r(46, 18, 12, 8, W[3]); r(47, 19, 10, 6, W[4]);
  r(50, 20, 4, 4, PAL.gold); r(51, 21, 2, 2, '#fff0a0');
  r(0, h - 3, w, 3, '#1a2e22');
  return { c, ax: 37, ay: h - 2, lamp: { x: 58 - 37, y: 6 - h } };
}

export function trader(frame) {
  const { c, r, p } = painter(18, 26);
  const bob = frame ? 1 : 0;
  r(3, 10 + bob, 12, 15 - bob, '#3a4a5a'); r(3, 10 + bob, 3, 15 - bob, '#4a5e70'); // cloak
  r(2, 24, 14, 2, '#24303a');
  r(4, 2 + bob, 10, 10, '#3a4a5a'); r(5, 1 + bob, 8, 1, '#3a4a5a'); // hood
  r(6, 5 + bob, 7, 6, '#e8c0a0'); r(6, 10 + bob, 7, 1, '#c89a80');
  r(8, 7 + bob, 1, 2, PAL.ink); r(11, 7 + bob, 1, 2, PAL.ink);
  r(6, 11 + bob, 7, 3, '#d8d8c8'); // beard
  r(12, 14 + bob, 4, 2, '#e8c0a0'); // hand
  r(14, 6, 1, 19, W[3]); r(13, 5, 3, 2, '#8ad0c0'); // staff with a pale crystal
  p(14, 4, '#d8fff0');
  return c;
}

export function altar() {
  const w = 54, h = 62;
  const { c, r, p } = painter(w, h);
  const rnd = mulberry32(8);
  const block = (x, y, ww, hh) => {
    r(x, y, ww, hh, ST[3]); r(x, y, ww, 1, ST[5]); r(x, y, 1, hh, ST[4]); r(x + ww - 1, y, 1, hh, ST[1]); r(x, y + hh - 1, ww, 1, ST[1]);
    for (let i = 0; i < ww * hh * 0.06; i++) p(x + 1 + rnd() * (ww - 2), y + 1 + rnd() * (hh - 2), ST[2]);
  };
  block(4, 18, 9, 40); block(41, 18, 9, 40); // pillars
  block(0, 10, 54, 9); // lintel
  block(14, 44, 26, 14); // pedestal
  block(10, 56, 34, 5);
  // carved runes that glow (positions returned for the light layer)
  const runes = [];
  for (const [x, y] of [[7, 26], [7, 36], [44, 28], [44, 40], [20, 49], [31, 49]]) { r(x, y, 3, 1, PAL.teal[4]); r(x + 1, y - 1, 1, 3, PAL.teal[4]); runes.push({ x: x + 1 - 27, y: y - (h - 2) }); }
  // moss and vines
  for (let x = 0; x < w; x++) if (hash2(x, 0, 4) < 0.6) r(x, 9 + (hash2(x, 1, 4) < 0.3 ? 1 : 0), 1, 2, PAL.moss[2 + (hash2(x, 2, 4) < 0.4 ? 1 : 0)]);
  for (let y = 12; y < 40; y++) if (hash2(0, y, 5) < 0.7) p(4 + Math.round(Math.sin(y / 3)), y, PAL.moss[3]);
  for (let y = 12; y < 32; y++) if (hash2(1, y, 5) < 0.7) p(49 + Math.round(Math.sin(y / 4)), y, PAL.moss[2]);
  return { c, ax: 27, ay: h - 2, runes, focus: { x: 0, y: 30 - (h - 2) } };
}

export function guildBoard() {
  const w = 40, h = 46;
  const { c, r } = painter(w, h);
  r(5, 14, 3, 32, W[2]); r(32, 14, 3, 32, W[2]); r(5, 14, 1, 32, W[4]); r(32, 14, 1, 32, W[4]);
  // little roof
  for (let i = 0; i < 6; i++) r(1 + i, 8 + i * 0 + (5 - i), 38 - i * 2, 1, i === 5 ? W[1] : W[3]);
  r(0, 13, 40, 2, W[1]); r(2, 6, 36, 2, W[4]);
  planks(r, 6, 16, 28, 20, false, 9);
  // notices: class emblems in their colours
  const notes = [['#e6dcc0', '#c9a36a'], ['#e6dcc0', '#5fb0f0'], ['#e0d4b8', '#f07a3a'], ['#e6dcc0', '#d8c070']];
  notes.forEach(([paper, ink], i) => {
    const x = 8 + (i % 2) * 13, y = 18 + Math.floor(i / 2) * 9;
    r(x, y, 11, 8, paper); r(x, y + 7, 11, 1, '#a89a7a'); r(x + 4, y + 2, 3, 3, ink); r(x + 1, y, 1, 1, '#c8302a');
  });
  r(4, 44, 32, 2, '#1a2e22');
  return { c, ax: 20, ay: h - 2 };
}

// Sawmill shed; the water wheel is drawn live. broken: ruined look before the first repair.
export function sawmill(broken) {
  const w = 120, h = 78;
  const { c, r, p } = painter(w, h);
  // stone footing
  for (let x = 20; x < 118; x += 6) { r(x, 66, 6, 10, hash2(x, 0, 2) < 0.5 ? ST[3] : ST[2]); r(x, 66, 6, 1, ST[5]); r(x, 66, 1, 10, ST[1]); }
  // walls
  planks(r, 24, 30, 90, 36, true, 12);
  r(24, 30, 90, 2, W[1]);
  r(48, 40, 40, 26, '#14100c'); // open front
  r(46, 38, 44, 2, W[4]); r(46, 38, 2, 28, W[4]); r(88, 38, 2, 28, W[4]);
  // saw table inside
  r(52, 56, 32, 4, W[4]); r(52, 60, 3, 6, W[2]); r(81, 60, 3, 6, W[2]);
  // roof
  for (let i = 0; i < 22; i++) {
    const y = 8 + i, x0 = 68 - 22 - i * 2.2, x1 = 70 + 22 + i * 2.2;
    for (let x = x0; x < x1; x++) {
      if (broken && hash2(Math.floor(x / 5), Math.floor(y / 3), 3) < 0.22) continue;
      p(x, y, Math.floor(y / 3) % 2 ? '#5a3a2a' : '#6e4632');
    }
    p(x0 - 1, y, PAL.ink); p(x1, y, PAL.ink);
  }
  r(14, 29, 108, 2, '#3a2418');
  // chimney
  r(92, 0, 8, 14, ST[3]); r(92, 0, 8, 1, ST[5]); r(92, 0, 1, 14, ST[4]);
  // axle housing toward the wheel on the left
  r(14, 44, 12, 6, W[2]); r(14, 44, 12, 1, W[4]);
  if (broken) {
    // missing planks, a fallen beam and moss
    for (const x of [30, 38, 96, 104]) r(x, 34 + (x % 3) * 4, 4, 10, '#14100c');
    for (let i = 0; i < 30; i++) r(26 + i * 2.8, 62 - i * 0.5, 3, 2, W[2]);
    for (let x = 24; x < 114; x++) if (hash2(x, 3, 7) < 0.4) p(x, 31 + Math.floor(hash2(x, 4, 7) * 3), PAL.moss[3]);
    // repair notice
    r(98, 50, 14, 10, '#e6dcc0'); r(98, 59, 14, 1, '#a89a7a'); r(101, 53, 8, 1, '#5a3a2a'); r(101, 56, 6, 1, '#5a3a2a');
  }
  return { c, ax: 68, ay: h - 2, wheel: { x: 6 - 68, y: 47 - (h - 2), r: 22 }, chimney: { x: 96 - 68, y: 0 - (h - 2) } };
}

export function drawWheel(g, cx, cy, R, angle, broken) {
  cx = Math.round(cx); cy = Math.round(cy);
  // rim
  for (let a = 0; a < 96; a++) {
    const t = (a / 96) * Math.PI * 2;
    if (broken && a > 60 && a < 74) continue;
    for (let k = 0; k < 3; k++) {
      g.fillStyle = k === 0 ? W[4] : k === 1 ? W[2] : W[1];
      g.fillRect(Math.round(cx + Math.cos(t) * (R - k)), Math.round(cy + Math.sin(t) * (R - k)), 1, 1);
    }
  }
  // spokes and paddles
  for (let s = 0; s < 8; s++) {
    const t = angle + (s / 8) * Math.PI * 2;
    const dx = Math.cos(t), dy = Math.sin(t);
    g.fillStyle = W[2];
    for (let i = 3; i < R - 1; i++) g.fillRect(Math.round(cx + dx * i), Math.round(cy + dy * i), 1, 1);
    g.fillStyle = W[3];
    for (let k = -3; k <= 3; k++) g.fillRect(Math.round(cx + dx * (R + 1) - dy * k), Math.round(cy + dy * (R + 1) + dx * k), 2, 1);
  }
  g.fillStyle = PAL.stone[4]; g.fillRect(cx - 2, cy - 2, 5, 5);
  g.fillStyle = PAL.stone[2]; g.fillRect(cx - 1, cy - 1, 3, 3);
}

// The ancient Elder Mossroot behind the clearing. Its crown runs off the top of the screen.
export function elderTree() {
  const w = 170, h = 250;
  const { c, r, p } = painter(w, h);
  const cx = 85;
  const runes = [];
  for (let y = 0; y < h; y++) {
    const t = y / h;
    let half = 22 + Math.pow(t, 3) * 30;
    if (y > h - 24) half += (y - (h - 24)) * 2.2;
    for (let x = -half; x <= half; x++) {
      const u = (x + half) / (2 * half);
      let k = u < 0.18 ? 4 : u < 0.45 ? 3 : u < 0.78 ? 2 : 1;
      const groove = Math.sin((x + Math.sin(y / 17) * 6) / 3.2);
      if (groove > 0.82) k = Math.max(0, k - 2);
      else if (groove < -0.9) k = Math.min(5, k + 1);
      if (Math.abs(x) > half - 1) k = 0;
      let col = PAL.bark[k];
      if (hash2(Math.round(x / 2), Math.round(y / 2), 3) < 0.12 + (u > 0.6 ? 0.2 : 0)) col = PAL.moss[1 + (k > 2 ? 2 : 1)];
      p(cx + x, y, col);
    }
  }
  // root arches
  for (const dir of [-1, 1]) for (let k = 0; k < 3; k++) {
    const len = 30 + k * 14;
    for (let i = 0; i < len; i++) {
      const x = cx + dir * (40 + i), y = h - 4 - Math.round(Math.sin((i / len) * Math.PI) * (8 + k * 3)) + k * 0;
      r(x, y, 1, 5 - k, PAL.bark[2]); p(x, y, PAL.bark[4]); p(x, y + 4 - k, PAL.bark[0]);
    }
  }
  // glowing rune channels on the trunk
  for (const [x, y] of [[-8, 150], [6, 120], [-4, 92], [10, 178], [-14, 200], [2, 60]]) {
    for (let i = 0; i < 9; i++) p(cx + x + Math.round(Math.sin(i / 2) * 2), y + i, PAL.glow);
    runes.push({ x: x, y: y + 4 - (h - 2) });
  }
  // a hollow between the roots
  r(cx - 9, h - 30, 18, 26, '#0c1412'); r(cx - 7, h - 32, 14, 2, '#0c1412');
  return { c, ax: cx, ay: h - 2, runes, hollow: { x: 0, y: -16 } };
}

export function gate() {
  const w = 110, h = 110;
  const { c, r, p } = painter(w, h);
  const rnd = mulberry32(14);
  // cliff wall
  for (let y = 0; y < h; y++) for (let x = 40; x < w; x++) {
    const k = hash2(x >> 2, y >> 3, 2) < 0.5 ? 2 : 3;
    p(x, y, hash2(x, y, 4) < 0.04 ? ST[0] : ST[k]);
  }
  // arch opening with warm light behind
  for (let y = 30; y < h; y++) for (let x = 56; x < 92; x++) {
    const dx = (x - 74) / 18, dy = (y - 52) / 22;
    if (y < 52 && dx * dx + dy * dy > 1) continue;
    p(x, y, y < 60 ? '#e8d8a0' : '#b8a878');
  }
  // tumbled boulders filling the arch
  for (let i = 0; i < 26; i++) {
    const bx = 50 + rnd() * 50, by = 50 + rnd() * 56, br = 4 + rnd() * 9;
    for (let y = -br; y <= br; y++) for (let x = -br; x <= br; x++) {
      if (x * x + y * y > br * br) continue;
      p(bx + x, by + y, x + y < -br * 0.6 ? ST[5] : x + y < 0 ? ST[4] : x + y < br * 0.7 ? ST[3] : ST[1]);
    }
  }
  for (let x = 40; x < w; x++) if (hash2(x, 0, 6) < 0.7) r(x, 0, 1, 2 + Math.floor(hash2(x, 1, 6) * 4), PAL.moss[2]);
  for (let i = 0; i < 6; i++) { const vx = 44 + i * 11; for (let y = 0; y < 18 + i * 5; y++) p(vx + Math.round(Math.sin(y / 3 + i)), y, PAL.moss[3]); }
  // signpost
  r(14, 70, 3, 38, W[2]); r(4, 72, 30, 9, W[3]); r(5, 73, 28, 7, W[4]); r(30, 72, 6, 4, W[3]);
  r(8, 75, 20, 1, '#3a2418'); r(8, 77, 14, 1, '#3a2418');
  return { c, ax: 74, ay: h - 2, glow: { x: 0, y: -50 } };
}

export function lantern() {
  const { c, r } = painter(12, 40);
  r(5, 6, 2, 34, W[1]); r(5, 6, 1, 34, W[3]);
  r(2, 4, 8, 2, W[2]); r(6, 4, 1, 3, W[1]);
  r(1, 8, 6, 8, '#2a2a2a'); r(2, 9, 4, 6, '#f2c060'); r(3, 10, 2, 3, '#fff0b0');
  r(1, 7, 6, 1, '#3a3a3a'); r(1, 16, 6, 1, '#3a3a3a');
  return { c, ax: 6, ay: 39, light: { x: -2, y: -27 } };
}

export function rock(seed) {
  const rnd = mulberry32(seed);
  const w = 10 + Math.floor(rnd() * 16), h = 6 + Math.floor(rnd() * 8);
  const { c, p } = painter(w + 2, h + 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x - w / 2) / (w / 2), dy = (y - h) / h;
    if (dx * dx + dy * dy > 1) continue;
    const lit = dx + dy * 1.4;
    let col = lit < -1 ? ST[5] : lit < -0.5 ? ST[4] : lit < 0.2 ? ST[3] : ST[2];
    if (dy < -0.75 && hash2(x, y, seed) < 0.7) col = PAL.moss[3];
    p(x + 1, y + 1, col);
  }
  return { c, ax: Math.floor(w / 2) + 1, ay: h };
}

export function mushroom(seed) {
  const { c, r } = painter(7, 8);
  const cap = seed % 2 ? '#c8d8e8' : '#d87a5a';
  r(3, 4, 1, 4, '#e8e0d0'); r(1, 2, 5, 2, cap); r(2, 1, 3, 1, cap); r(2, 2, 1, 1, '#ffffff');
  return { c, ax: 3, ay: 7 };
}

export function logPile() {
  const { c, r } = painter(26, 14);
  for (const [x, y] of [[0, 8], [8, 8], [16, 8], [4, 3], [12, 3]]) {
    r(x + 1, y, 8, 6, W[3]); r(x + 1, y, 8, 1, W[4]); r(x + 1, y + 5, 8, 1, W[1]);
    r(x, y + 1, 1, 4, W[1]); r(x + 1, y + 2, 2, 2, '#d4b07a');
  }
  return { c, ax: 13, ay: 13 };
}
