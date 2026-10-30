// The walkable valley floor for the whole region, baked once: far bank and creek above the
// surface line, then grass lip, soil, roots and stones below it.
import { PixBuf } from '../gfx/PixBuf.js';
import { hash2, fbm1 } from '../core/Rng.js';
import { PAL } from './palette.js';
import { WORLD, REGION, groundY, CREEK } from '../game/World.js';
import { warmify } from './background.js';

export const GROUND_TOP = 150; // world y of the strip's first row

export function buildGround() {
  const W = WORLD.width, H = 150;
  const b = new PixBuf(W, H);
  const G = PAL.grass, D = PAL.dirt, S = PAL.stone;
  const inCreek = (x) => CREEK.some(([a, c]) => x >= a && x <= c);
  for (let x = 0; x < W; x++) {
    const s = groundY(x) - GROUND_TOP;
    // far bank: mossy slope behind the creek, rising into the near-trunk layer
    const bankTop = s - 22 - Math.round(fbm1(x / 30, 4, 3) * 8);
    const creek = inCreek(x);
    for (let y = Math.max(0, bankTop); y < s; y++) {
      const d = y - bankTop;
      let c;
      if (creek && y > s - 11) {
        // water band with depth shading
        const wd = y - (s - 11);
        c = wd < 1 ? PAL.water[4] : wd < 3 ? PAL.water[3] : wd < 7 ? PAL.water[2] : PAL.water[1];
      } else if (creek && y > s - 13) c = S[2]; // wet stones at the far edge
      else {
        c = d < 1 ? G[3] : d < 3 ? G[2] : hash2(x, y, 7) < 0.3 ? G[1] : '#18382a';
        if (d > 6 && hash2(x >> 1, y >> 1, 9) < 0.05) c = S[3];
      }
      b.set(x, y, c);
    }
    // surface lip and soil
    for (let y = s; y < H; y++) {
      const d = y - s;
      let c;
      if (d < 1) c = G[4];
      else if (d < 3) c = hash2(x, y, 1) < 0.2 ? G[5] : G[3];
      else if (d < 5) c = hash2(x, y, 2) < 0.5 ? G[2] : G[1];
      else if (d < 7) c = hash2(x, y, 3) < 0.5 ? G[1] : D[3];
      else {
        const k = d < 16 ? 3 : d < 30 ? 2 : d < 50 ? 1 : 0;
        c = D[k];
        if (hash2(x, y, 5) < 0.012) c = S[k]; // pebbles
        if (hash2(x, y >> 2, 6) < 0.015) c = D[Math.min(4, k + 1)];
      }
      b.set(x, y, c);
    }
    // grass blades poking up from the lip
    if (hash2(x, 0, 11) < 0.55) {
      const h = 1 + Math.floor(hash2(x, 1, 12) * 3);
      for (let k = 1; k <= h; k++) b.set(x, s - k, k === h ? G[5] : G[4]);
    }
    // tiny cool-toned flowers
    if (hash2(x, 3, 13) < (REGION.look.flowers ?? 0.025)) {
      const h = hash2(x, 4, 14);
      const col = REGION.look.warm ? (h < 0.4 ? '#ffe070' : h < 0.7 ? '#fff4e0' : '#f8a0b0') : h < 0.5 ? '#bfe0f0' : '#f0f0e0';
      b.set(x, s - 3, col); b.set(x, s - 2, G[3]);
    }
  }
  // roots and buried stones
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(hash2(i, 0, 21) * W), y = groundY(x) - GROUND_TOP + 10 + Math.floor(hash2(i, 1, 21) * 26);
    const r = 1 + Math.floor(hash2(i, 2, 21) * 2.5);
    const deep = y - (groundY(x) - GROUND_TOP) > 20;
    for (let yy = -r; yy <= r; yy++) for (let xx = -r - 2; xx <= r + 2; xx++) {
      if ((xx * xx) / ((r + 2) * (r + 2)) + (yy * yy) / (r * r) > 1) continue;
      b.set(x + xx, y + yy, deep ? (yy < 0 ? S[1] : S[0]) : yy < -r / 2 ? S[3] : yy < 0 ? S[2] : S[1]);
    }
  }
  // root runs near the surface
  for (let i = 0; i < 70; i++) {
    let x = Math.floor(hash2(i, 5, 22) * W), y = groundY(x) - GROUND_TOP + 6 + Math.floor(hash2(i, 6, 22) * 6);
    const len = 8 + Math.floor(hash2(i, 7, 22) * 18), dir = hash2(i, 8, 22) < 0.5 ? -1 : 1;
    for (let k = 0; k < len; k++) {
      b.set(x, y, PAL.bark[2]); b.set(x, y + 1, PAL.bark[1]);
      x += dir; if (hash2(i, k, 23) < 0.3) y += 1;
    }
  }
  const out = { c: b.toCanvas(), top: GROUND_TOP };
  if (REGION.look.warm) warmify(out, 0.75);
  return out;
}

// Grass tufts drawn live in front of the player so they sway and part as you walk.
export function buildTufts() {
  const tufts = [];
  for (let x = 72; x < WORLD.width - 70; x += 3) {
    if (hash2(x, 9, 31) < 0.45) continue;
    tufts.push({ x, h: 2 + Math.floor(hash2(x, 8, 32) * 5), lean: 0, phase: hash2(x, 7, 33) * 6.28, tone: hash2(x, 6, 34) < 0.3 ? 5 : 4 });
  }
  return tufts;
}
