import { canvas, rgb, mix, shade, rng, blob, wobble, dabs } from './paint.js';

// Procedural painted trees and plants. Every call with a different seed yields a different
// silhouette; species differ in structure, not just colour.

export const PALETTES = {
  oak:      { dark: [0.10, 0.27, 0.22], mid: [0.25, 0.50, 0.26], light: [0.52, 0.73, 0.30], hi: [0.82, 0.92, 0.48], trunk: [0.36, 0.25, 0.18] },
  spring:   { dark: [0.20, 0.40, 0.20], mid: [0.45, 0.68, 0.28], light: [0.70, 0.85, 0.38], hi: [0.92, 0.97, 0.60], trunk: [0.42, 0.31, 0.22] },
  deep:     { dark: [0.06, 0.19, 0.20], mid: [0.13, 0.35, 0.30], light: [0.27, 0.52, 0.36], hi: [0.50, 0.70, 0.44], trunk: [0.26, 0.19, 0.15] },
  blossom:  { dark: [0.60, 0.28, 0.45], mid: [0.92, 0.54, 0.70], light: [1.00, 0.77, 0.85], hi: [1.00, 0.94, 0.96], trunk: [0.36, 0.24, 0.22] },
  magenta:  { dark: [0.42, 0.10, 0.36], mid: [0.72, 0.22, 0.58], light: [0.90, 0.45, 0.75], hi: [1.00, 0.72, 0.90], trunk: [0.30, 0.20, 0.20] },
  autumn:   { dark: [0.48, 0.12, 0.10], mid: [0.86, 0.33, 0.14], light: [0.98, 0.58, 0.20], hi: [1.00, 0.84, 0.42], trunk: [0.32, 0.22, 0.17] },
  gold:     { dark: [0.45, 0.33, 0.10], mid: [0.80, 0.62, 0.18], light: [0.96, 0.82, 0.34], hi: [1.00, 0.95, 0.62], trunk: [0.36, 0.27, 0.19] },
  pine:     { dark: [0.05, 0.18, 0.17], mid: [0.12, 0.32, 0.26], light: [0.25, 0.47, 0.32], hi: [0.45, 0.64, 0.40], trunk: [0.30, 0.21, 0.16] },
};

// Broadleaf: a trunk with forks and a canopy built from overlapping leaf clumps,
// shaded in four tones so each clump reads as lit from the upper left.
export function paintBroadleaf(seed, { ppm = 20, height = 9, width = 7, palette = PALETTES.oak, trunkFrac = 0.42, shape = 'round' } = {}) {
  const r = rng(seed);
  const W = width * ppm, H = height * ppm;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  const P = palette;
  const cx = W / 2;

  // Trunk and branches.
  const trunkTop = H * (1 - trunkFrac);
  const tw = Math.max(3, width * ppm * r.range(0.07, 0.1));
  const lean = r.range(-0.08, 0.08) * W;
  drawTrunk(ctx, r, cx, H, cx + lean, trunkTop, tw, P.trunk);
  const forks = r.int(2, 4);
  for (let i = 0; i < forks; i++) {
    const a = -Math.PI / 2 + r.range(-0.9, 0.9);
    const len = H * r.range(0.12, 0.22);
    const sx = cx + lean * 0.8, sy = trunkTop + r.range(0, H * 0.08);
    drawTrunk(ctx, r, sx, sy, sx + Math.cos(a) * len, sy + Math.sin(a) * len, tw * 0.45, P.trunk);
  }

  // Canopy clumps.
  const can = canvas(W, H);
  const cc = can.getContext('2d');
  const ccx = cx + lean * 0.7;
  const ccy = shape === 'tall' ? H * 0.40 : H * 0.36;
  const rx = W * 0.45, ry = (shape === 'tall' ? H * 0.38 : H * 0.33);
  const clumps = [];
  const n = shape === 'wide' ? r.int(16, 22) : r.int(12, 18);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.78;
    let x = ccx + Math.cos(a) * rx * d, y = ccy + Math.sin(a) * ry * d;
    const rr = Math.min(W, H) * r.range(0.13, 0.22);
    // Keep clumps inside the sprite.
    x = Math.min(W - rr, Math.max(rr, x)); y = Math.min(H * 0.8, Math.max(rr, y));
    clumps.push({ x, y, r: rr });
  }
  clumps.sort((a, b) => b.y - a.y); // paint from the bottom up so upper clumps overlap lower ones

  for (const k of clumps) wobble(cc, k.x, k.y, k.r, r, { points: 16, jitter: 0.18, color: rgb(P.dark) });
  // Leafy fringe on the silhouette.
  for (const k of clumps) {
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2;
      const x = k.x + Math.cos(a) * k.r * r.range(0.85, 1.08), y = k.y + Math.sin(a) * k.r * r.range(0.85, 1.08);
      blob(cc, x, y, ppm * r.range(0.12, 0.22), ppm * r.range(0.08, 0.14), rgb(P.dark), a);
    }
  }
  cc.globalCompositeOperation = 'source-atop';
  // Each clump: mid tone shifted toward the light, then light, then highlight dabs.
  for (const k of clumps) {
    const ox = -k.r * 0.18, oy = -k.r * 0.2;
    wobble(cc, k.x + ox, k.y + oy, k.r * 0.86, r, { points: 14, jitter: 0.2, color: rgb(mix(P.dark, P.mid, 0.85)) });
  }
  for (const k of clumps) {
    const lightness = 1 - (k.y - (ccy - ry)) / (ry * 2); // upper clumps are lighter
    const lx = k.x - k.r * 0.32, ly = k.y - k.r * 0.36;
    wobble(cc, lx, ly, k.r * 0.55, r, { points: 12, jitter: 0.25, color: rgb(mix(P.mid, P.light, 0.5 + lightness * 0.5)) });
    dabs(cc, r, 22, (rr) => [lx + (rr() - 0.5) * k.r * 1.1, ly + (rr() - 0.5) * k.r * 0.9],
      (p, rr) => rgb(rr() < 0.5 ? P.light : P.hi, 0.85), { size: [ppm * 0.06, ppm * 0.14], stretch: 1.7 });
  }
  // Shadowed pockets and a few deep holes between clumps.
  dabs(cc, r, 14, (rr) => {
    const k = clumps[Math.floor(rr() * clumps.length)];
    return [k.x + k.r * rr.range(0.1, 0.7), k.y + k.r * rr.range(0.2, 0.8)];
  }, () => rgb(shade(P.dark, 0.85), 0.35), { size: [ppm * 0.06, ppm * 0.12] });
  cc.globalCompositeOperation = 'source-over';
  ctx.drawImage(can, 0, 0);
  return c;
}

function drawTrunk(ctx, r, x0, y0, x1, y1, w, color) {
  const mx = (x0 + x1) / 2 + r.range(-0.15, 0.15) * Math.abs(y1 - y0), my = (y0 + y1) / 2;
  const g = ctx.createLinearGradient(x0 - w, 0, x0 + w, 0);
  g.addColorStop(0, `rgb(${color.map((v) => Math.min(255, v * 255 * 1.35) | 0).join(',')})`);
  g.addColorStop(0.55, rgb(color));
  g.addColorStop(1, rgb(shade(color, 0.55)));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x0 - w * 0.75, y0);
  ctx.quadraticCurveTo(mx - w * 0.4, my, x1 - w * 0.18, y1);
  ctx.lineTo(x1 + w * 0.18, y1);
  ctx.quadraticCurveTo(mx + w * 0.4, my, x0 + w * 0.75, y0);
  ctx.closePath();
  ctx.fill();
  // Root flare.
  if (y0 > y1) {
    blob(ctx, x0, y0 - w * 0.15, w * 1.1, w * 0.3, rgb(shade(color, 0.8)));
  }
}

// Conifer: stacked drooping tiers, each lit on its left side.
export function paintConifer(seed, { ppm = 20, height = 12, width = 5, palette = PALETTES.pine } = {}) {
  const r = rng(seed);
  const W = width * ppm, H = height * ppm;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  const P = palette, cx = W / 2;
  ctx.fillStyle = rgb(P.trunk);
  ctx.fillRect(cx - ppm * 0.18, H * 0.78, ppm * 0.36, H * 0.22);
  const tiers = r.int(6, 9);
  for (let t = 0; t < tiers; t++) {
    const f = t / (tiers - 1);              // 0 bottom .. 1 top
    const y = H * (0.86 - f * 0.78);
    const half = W * 0.5 * (1 - f * 0.82) * r.range(0.9, 1.05);
    const tip = y - H * 0.16;
    const tierPath = () => {
      // Tip, then a ragged drooping hem from right to left.
      ctx.beginPath();
      ctx.moveTo(cx + r.range(-1, 1), tip);
      const steps = 9;
      for (let s = 0; s <= steps; s++) {
        const u = 1 - (s / steps) * 2; // 1 → -1
        const x = cx + half * u;
        const droop = (1 - Math.abs(u)) * ppm * 0.35;
        ctx.lineTo(x, y + droop + (s % 2 ? -ppm * 0.3 : ppm * 0.12));
      }
      ctx.closePath();
    };
    tierPath(); ctx.fillStyle = rgb(P.dark); ctx.fill();
    ctx.save(); tierPath(); ctx.clip();
    // lit left half
    ctx.fillStyle = rgb(mix(P.mid, P.light, f * 0.5));
    ctx.beginPath(); ctx.moveTo(cx, tip); ctx.lineTo(cx - half * 1.1, y + 4); ctx.lineTo(cx + half * 0.1, y + 2); ctx.closePath(); ctx.fill();
    dabs(ctx, r, 18, (rr) => [cx - rr() * half * 0.9, y - rr() * H * 0.12], () => rgb(P.light, 0.8), { size: [ppm * 0.06, ppm * 0.12], angle: 0.5 });
    ctx.restore();
  }
  return c;
}

// Slim columnar tree (cypress/poplar) — strong vertical accents in the composition.
export function paintColumn(seed, { ppm = 20, height = 13, width = 3, palette = PALETTES.deep } = {}) {
  const r = rng(seed);
  const W = width * ppm, H = height * ppm;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  const P = palette, cx = W / 2;
  ctx.fillStyle = rgb(P.trunk);
  ctx.fillRect(cx - ppm * 0.15, H * 0.86, ppm * 0.3, H * 0.14);
  const can = canvas(W, H), cc = can.getContext('2d');
  for (let i = 0; i < 14; i++) {
    const f = i / 13;
    const y = H * (0.86 - f * 0.78);
    const w = W * 0.46 * Math.sin(Math.PI * (0.15 + f * 0.85)) + ppm * 0.2;
    wobble(cc, cx + r.range(-0.05, 0.05) * W, y, w, r, { points: 12, jitter: 0.2, squash: 1.3, color: rgb(P.dark) });
  }
  cc.globalCompositeOperation = 'source-atop';
  cc.fillStyle = rgb(P.mid);
  cc.beginPath(); cc.ellipse(cx - W * 0.12, H * 0.45, W * 0.36, H * 0.42, 0, 0, Math.PI * 2); cc.fill();
  dabs(cc, r, 70, (rr) => [cx - rr() * W * 0.4, H * (0.1 + rr() * 0.75)], (p, rr) => rgb(rr() < 0.6 ? P.light : P.hi, 0.8), { size: [ppm * 0.07, ppm * 0.14], angle: -1.2 });
  ctx.drawImage(can, 0, 0);
  return c;
}

export function paintBush(seed, { ppm = 20, width = 2.6, height = 1.8, palette = PALETTES.oak, flowers = null } = {}) {
  const r = rng(seed);
  const W = width * ppm, H = height * ppm;
  const c = canvas(W, H), ctx = c.getContext('2d');
  const P = palette;
  const clumps = [];
  for (let i = 0; i < r.int(5, 8); i++) {
    const rr = H * r.range(0.25, 0.4);
    clumps.push({ x: r.range(rr, W - rr), y: H - rr * r.range(0.7, 1.4), r: rr });
  }
  clumps.sort((a, b) => b.y - a.y);
  for (const k of clumps) wobble(ctx, k.x, k.y, k.r, r, { points: 14, jitter: 0.2, color: rgb(P.dark) });
  ctx.globalCompositeOperation = 'source-atop';
  for (const k of clumps) wobble(ctx, k.x - k.r * 0.2, k.y - k.r * 0.25, k.r * 0.8, r, { color: rgb(P.mid) });
  for (const k of clumps) wobble(ctx, k.x - k.r * 0.35, k.y - k.r * 0.4, k.r * 0.45, r, { color: rgb(P.light) });
  dabs(ctx, r, 30, (rr) => [rr() * W, rr() * H * 0.8], () => rgb(P.hi, 0.7), { size: [ppm * 0.05, ppm * 0.1] });
  if (flowers) {
    dabs(ctx, r, 26, (rr) => [rr() * W, rr() * H * 0.85], (p, rr) => rgb(rr() < 0.7 ? flowers : [1, 1, 0.95]), { size: [ppm * 0.07, ppm * 0.1], stretch: 1 });
  }
  ctx.globalCompositeOperation = 'source-over';
  return c;
}

export function paintGrassTuft(seed, { ppm = 20, width = 1.2, height = 0.8, color = [0.42, 0.66, 0.28], flower = null } = {}) {
  const r = rng(seed);
  const W = width * ppm, H = height * ppm;
  const c = canvas(W, H), ctx = c.getContext('2d');
  const blades = r.int(9, 16);
  for (let i = 0; i < blades; i++) {
    const x = W * r.range(0.15, 0.85), h = H * r.range(0.45, 1);
    const bend = r.range(-0.3, 0.3) * W;
    const k = r.range(0.7, 1.25);
    ctx.strokeStyle = rgb(shade(color, k));
    ctx.lineWidth = Math.max(1.2, ppm * 0.06);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, H); ctx.quadraticCurveTo(x + bend * 0.3, H - h * 0.6, x + bend, H - h); ctx.stroke();
  }
  if (flower) {
    for (let i = 0; i < r.int(2, 4); i++) blob(ctx, W * r.range(0.2, 0.8), H * r.range(0.1, 0.35), ppm * 0.09, ppm * 0.09, rgb(flower));
  }
  return c;
}

export function paintReeds(seed, { ppm = 20, width = 1.6, height = 2.2 } = {}) {
  const r = rng(seed);
  const W = width * ppm, H = height * ppm;
  const c = canvas(W, H), ctx = c.getContext('2d');
  for (let i = 0; i < r.int(8, 13); i++) {
    const x = W * r.range(0.1, 0.9), h = H * r.range(0.5, 1), bend = r.range(-0.2, 0.2) * W;
    ctx.strokeStyle = rgb(mix([0.35, 0.5, 0.25], [0.62, 0.66, 0.35], r()));
    ctx.lineWidth = Math.max(1.2, ppm * 0.05);
    ctx.beginPath(); ctx.moveTo(x, H); ctx.quadraticCurveTo(x, H - h * 0.5, x + bend, H - h); ctx.stroke();
    if (r.chance(0.4)) blob(ctx, x + bend, H - h + ppm * 0.2, ppm * 0.06, ppm * 0.22, rgb([0.45, 0.3, 0.18]));
  }
  return c;
}

export function paintRock(seed, { ppm = 20, width = 2, height = 1.4, mossy = true } = {}) {
  const r = rng(seed);
  const W = width * ppm, H = height * ppm;
  const c = canvas(W, H), ctx = c.getContext('2d');
  const base = mix([0.55, 0.53, 0.52], [0.66, 0.6, 0.52], r());
  wobble(ctx, W / 2, H * 0.6, W * 0.46, r, { points: 9, jitter: 0.12, squash: (H * 0.85) / W, color: rgb(shade(base, 0.62)) });
  ctx.globalCompositeOperation = 'source-atop';
  wobble(ctx, W * 0.42, H * 0.5, W * 0.36, r, { points: 8, jitter: 0.15, squash: (H * 0.7) / W, color: rgb(base) });
  wobble(ctx, W * 0.34, H * 0.38, W * 0.18, r, { points: 7, jitter: 0.2, squash: 0.7, color: rgb(shade(base, 1.2)) });
  if (mossy) dabs(ctx, r, 30, (rr) => [rr() * W, H * rr() * 0.35], () => rgb(mix([0.3, 0.5, 0.22], [0.5, 0.68, 0.3], r()), 0.9), { size: [ppm * 0.08, ppm * 0.16] });
  ctx.globalCompositeOperation = 'source-over';
  return c;
}
