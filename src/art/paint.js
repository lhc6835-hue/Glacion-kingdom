import { mulberry32 } from '../world/noise.js';

// Small painting toolkit shared by every procedural artist (trees, buildings, characters...).
// Convention: light comes from the upper left. Colours are [r,g,b] in 0..1 (sRGB).

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
}

export const rgb = (c, a = 1) => `rgba(${(c[0] * 255) | 0},${(c[1] * 255) | 0},${(c[2] * 255) | 0},${a})`;
export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const shade = (c, k) => [Math.min(1, c[0] * k), Math.min(1, c[1] * k), Math.min(1, c[2] * k)];
export const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

export function rng(seed) {
  const r = mulberry32(seed * 7919 + 17);
  const f = () => r();
  f.range = (a, b) => a + (b - a) * r();
  f.int = (a, b) => Math.floor(a + (b - a + 1) * r());
  f.pick = (arr) => arr[Math.floor(r() * arr.length)];
  f.chance = (p) => r() < p;
  return f;
}

export function blob(ctx, x, y, rx, ry, color, rot = 0) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.3, rx), Math.max(0.3, ry), rot, 0, Math.PI * 2);
  ctx.fill();
}

// An irregular, wobbly closed shape (used for leaf clumps, rocks, clouds).
export function wobble(ctx, x, y, r, rand, { points = 14, jitter = 0.22, color, squash = 1 } = {}) {
  ctx.beginPath();
  const pts = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const rr = r * (1 - jitter + rand() * jitter * 2);
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * squash]);
  }
  for (let i = 0; i < points; i++) {
    const p0 = pts[i], p1 = pts[(i + 1) % points];
    const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
    if (i === 0) ctx.moveTo(mx, my); else ctx.quadraticCurveTo(p0[0], p0[1], mx, my);
  }
  const p0 = pts[0], p1 = pts[1];
  ctx.quadraticCurveTo(p0[0], p0[1], (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2);
  ctx.closePath();
  if (color) { ctx.fillStyle = color; ctx.fill(); }
}

// Short painterly dabs scattered in an area: the main texture-making stroke.
export function dabs(ctx, rand, n, area, colorFn, { size = [1.5, 3.5], stretch = 1.6, angle = -0.6, angleJit = 0.6 } = {}) {
  for (let i = 0; i < n; i++) {
    const p = area(rand);
    if (!p) continue;
    const s = size[0] + rand() * (size[1] - size[0]);
    const c = colorFn(p, rand);
    if (!c) continue;
    blob(ctx, p[0], p[1], s * stretch, s, c, angle + (rand() - 0.5) * angleJit);
  }
}

// Simple linear gradient helper.
export function vgrad(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [t, c] of stops) g.addColorStop(t, c);
  return g;
}

// Soft drop shadow ellipse drawn under an object, inside its own sprite.
export function groundShadow(ctx, cx, cy, rx, ry, alpha = 0.28) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
  g.addColorStop(0, `rgba(20,30,40,${alpha})`);
  g.addColorStop(1, 'rgba(20,30,40,0)');
  ctx.save();
  ctx.scale(1, ry / rx);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy * (rx / ry), rx, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
