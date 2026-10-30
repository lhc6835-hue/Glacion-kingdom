// The title logo, lettered by hand on a canvas: "MELTDOWN" in chunky letters, each one a
// different flavor, standing on a waffle-cone extrusion with a cocoa outline. Drips slide off
// the bottoms of the letters and now and then a drop falls. The O is a smiling scoop.
import { rng, shade, rgba, TAU } from '../core/math.js';
import { scoopSprite } from './scoopArt.js';
import { drawSprite } from './sprite.js';
import { drawFace } from './face.js';

const W = 1000, H = 440;
const FONT = '"Titan One", "Jua", sans-serif';
const INK = '#4a2433';
const LETTERS = [
  { ch: 'M', c: '#ff8fb4', rot: -0.06 },
  { ch: 'E', c: '#9ff0cf', rot: 0.04 },
  { ch: 'L', c: '#fff0c4', rot: -0.03 },
  { ch: 'T', c: '#a9c4ff', rot: 0.05 },
  { ch: 'D', c: '#8a5232', rot: -0.04 },
  { ch: 'O', scoop: 'strawberry' },
  { ch: 'W', c: '#ffc04d', rot: 0.05 },
  { ch: 'N', c: '#c9a6f2', rot: -0.05 },
];
const SIZE = 168, BASE = 245;

export async function makeLogo(canvas) {
  try { await document.fonts.load(`${SIZE}px "Titan One"`); } catch { /* fall back to Jua */ }
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const g = canvas.getContext('2d');
  const r = rng(20261030);

  // lay the letters out once
  const meas = document.createElement('canvas').getContext('2d');
  meas.font = `${SIZE}px ${FONT}`;
  const gap = -6;
  const items = LETTERS.map((L) => ({ ...L, w: L.scoop ? SIZE * 0.92 : meas.measureText(L.ch).width }));
  const total = items.reduce((s, it) => s + it.w + gap, -gap);
  let x = (W - total) / 2;
  for (const it of items) { it.x = x + it.w / 2; x += it.w + gap; }

  const base = document.createElement('canvas');
  base.width = W * dpr; base.height = H * dpr;
  const b = base.getContext('2d');
  b.scale(dpr, dpr);
  b.lineJoin = 'round';
  b.font = `${SIZE}px ${FONT}`;
  b.textAlign = 'center';
  b.textBaseline = 'alphabetic';

  const drips = [];
  const letterCanvas = (it) => {
    // each letter on its own layer so details can be painted inside its silhouette only
    const c = document.createElement('canvas');
    c.width = W * dpr; c.height = H * dpr;
    const l = c.getContext('2d');
    l.scale(dpr, dpr);
    l.font = b.font; l.textAlign = 'center';
    l.translate(it.x, BASE); l.rotate(it.rot);
    l.fillStyle = it.c;
    l.fillText(it.ch, 0, 0);
    l.globalCompositeOperation = 'source-atop';
    // soft vertical shading: light top, deeper bottom
    const gr = l.createLinearGradient(0, -SIZE * 0.75, 0, 10);
    gr.addColorStop(0, rgba(shade(it.c, 0.55), 0.9));
    gr.addColorStop(0.45, rgba(it.c, 0));
    gr.addColorStop(1, rgba(shade(it.c, -0.35), 0.55));
    l.fillStyle = gr; l.fillRect(-SIZE, -SIZE, SIZE * 2, SIZE * 1.2);
    // glossy streak across the upper third
    l.fillStyle = 'rgba(255,255,255,0.55)';
    l.beginPath(); l.ellipse(-it.w * 0.12, -SIZE * 0.52, it.w * 0.34, SIZE * 0.07, -0.25, 0, TAU); l.fill();
    // sprinkles baked into the cream
    const cols = ['#ff5f8f', '#ffe066', '#5ab8ff', '#7ee0b0', '#ffffff', '#b69cff'];
    for (let i = 0; i < 9; i++) {
      const sx = (r() - 0.5) * it.w * 0.9, sy = -SIZE * (0.1 + r() * 0.55), a = r() * Math.PI;
      l.strokeStyle = it.ch === 'L' || it.ch === 'E' ? cols[i % 4] : cols[i % cols.length];
      l.lineWidth = 6; l.lineCap = 'round';
      l.beginPath(); l.moveTo(sx - Math.cos(a) * 6, sy - Math.sin(a) * 6); l.lineTo(sx + Math.cos(a) * 6, sy + Math.sin(a) * 6); l.stroke();
    }
    l.globalCompositeOperation = 'source-over';
    // find solid columns along the letter's bottom edge for drips
    const img = l.getImageData(0, 0, c.width, c.height).data;
    const yRow = Math.round((BASE - 6) * dpr);
    const cand = [];
    for (let px = Math.round((it.x - it.w / 2) * dpr); px < (it.x + it.w / 2) * dpr; px += 2) {
      if (img[(yRow * c.width + px) * 4 + 3] > 200 && img[(yRow * c.width + px + 10 * dpr) * 4 + 3] > 200 && img[(yRow * c.width + px - 10 * dpr) * 4 + 3] > 200) cand.push(px / dpr);
    }
    const n = it.ch === 'L' || it.ch === 'D' ? 2 : 1;
    for (let k = 0; k < n && cand.length; k++) {
      const dx = cand[Math.floor(r() * cand.length)];
      if (drips.some((d) => Math.abs(d.x - dx) < 26)) continue;
      drips.push({ x: dx, y: BASE - 8 + Math.sin(it.rot) * (dx - it.x), c: it.c, w: 11 + r() * 7, len: 22 + r() * 40, ph: r() * TAU, sp: 0.5 + r() * 0.6, drop: null, wait: 1 + r() * 5 });
    }
    return c;
  };

  // pass 1: waffle-cone extrusion, stamped downward and a little to the right
  for (const it of items) {
    if (it.scoop) continue;
    b.save(); b.translate(it.x, BASE); b.rotate(it.rot);
    for (let k = 16; k > 0; k--) {
      b.strokeStyle = k > 12 ? INK : k % 4 === 0 ? '#b06a3b' : '#d08a4c';
      b.lineWidth = 18;
      b.strokeText(it.ch, k * 0.6, k);
      b.fillStyle = b.strokeStyle;
      b.fillText(it.ch, k * 0.6, k);
    }
    b.restore();
  }
  // pass 2: cocoa outline
  for (const it of items) {
    if (it.scoop) continue;
    b.save(); b.translate(it.x, BASE); b.rotate(it.rot);
    b.strokeStyle = INK; b.lineWidth = 18;
    b.strokeText(it.ch, 0, 0);
    b.restore();
  }
  // pass 3: the flavored letters
  for (const it of items) if (!it.scoop) b.drawImage(letterCanvas(it), 0, 0, W, H);

  const scoop = items.find((it) => it.scoop);
  let t = 0, last = performance.now();
  const frame = (now) => {
    if (!canvas.isConnected) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.drawImage(base, 0, 0, W, H);
    // drips run down over the waffle edge, growing out of the letter's own cream
    for (const d of drips) drawDrip(g, d, t, dt);
    // the O: a bobbing scoop with the game's dot-eyed face
    const bob = Math.sin(t * 2.2) * 6, sq = 1 + Math.sin(t * 4.4) * 0.03;
    g.save();
    g.translate(scoop.x, BASE - SIZE * 0.42 + bob);
    const k = SIZE / 58;
    g.scale(k / sq, k * sq);
    g.rotate(Math.sin(t * 1.3) * 0.06);
    drawSprite(g, scoopSprite(scoop.scoop));
    drawFace(g, 'smile', 0, -3, 24, { lookX: Math.sin(t * 0.8) * 0.8, blink: (t % 3.2) < 0.12 ? 1 : 0, t });
    g.restore();
    // sparkles twinkling over the letters
    for (let i = 0; i < 5; i++) {
      const p = (t * 0.45 + i * 0.37) % 1;
      const cycle = Math.floor(t * 0.45 + i * 0.37);
      const rr = rng(i * 977 + cycle * 31);
      const sx = 120 + rr() * 760, sy = 60 + rr() * 150;
      star(g, sx, sy, Math.sin(p * Math.PI) * 13, '#ffffff');
    }
    // subtitle
    g.save();
    g.font = `34px ${FONT}`;
    g.textAlign = 'center';
    g.letterSpacing = '9px';
    const sub = 'LAST SCOOP STANDING';
    g.lineJoin = 'round';
    g.strokeStyle = INK; g.lineWidth = 10;
    g.strokeText(sub, W / 2 + 4, 348 + 4);
    g.strokeStyle = '#ff6f99'; g.lineWidth = 10;
    g.strokeText(sub, W / 2, 348);
    g.fillStyle = '#ffffff';
    g.fillText(sub, W / 2, 348);
    const sw = g.measureText(sub).width / 2 + 34;
    for (const s of [-1, 1]) {
      star(g, W / 2 + s * sw, 336, 10 + Math.sin(t * 3 + s) * 2, '#fff1a6');
      g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(W / 2 + s * (sw + 20), 337); g.lineTo(W / 2 + s * (sw + 70), 337); g.stroke();
    }
    g.restore();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function drawDrip(g, d, t, dt) {
  const len = d.len * (0.75 + 0.25 * Math.sin(t * d.sp + d.ph));
  const top = d.y + 14;
  const pathD = (extra, y0) => {
    g.beginPath();
    g.moveTo(d.x - d.w / 2 - extra - 4, y0);
    g.quadraticCurveTo(d.x - d.w / 2 - extra, y0 + 2, d.x - d.w / 2 - extra, y0 + 8);
    g.lineTo(d.x - d.w / 2 - extra, top + len);
    g.arc(d.x, top + len, d.w / 2 + extra, Math.PI, 0, true);
    g.lineTo(d.x + d.w / 2 + extra, y0 + 8);
    g.quadraticCurveTo(d.x + d.w / 2 + extra, y0 + 2, d.x + d.w / 2 + extra + 4, y0);
    g.closePath();
  };
  pathD(5, d.y + 10); g.fillStyle = INK; g.fill();
  pathD(0, d.y); g.fillStyle = d.c; g.fill();
  const lenFull = len + 14;
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.beginPath(); g.ellipse(d.x - d.w * 0.18, d.y + lenFull * 0.6, d.w * 0.12, lenFull * 0.22, 0, 0, TAU); g.fill();
  // every few seconds a drop swells off the tip and falls
  d.wait -= dt;
  if (!d.drop && d.wait <= 0) d.drop = { y: top + len + d.w * 0.4, v: 0, a: 1 };
  if (d.drop) {
    const p = d.drop;
    p.v += 900 * dt; p.y += p.v * dt; p.a -= dt * 1.2;
    if (p.a <= 0 || p.y > 440) { d.drop = null; d.wait = 2 + Math.random() * 5; }
    else {
      g.globalAlpha = Math.max(0, p.a);
      g.fillStyle = INK; g.beginPath(); g.arc(d.x, p.y, d.w * 0.42 + 4, 0, TAU); g.fill();
      g.fillStyle = d.c; g.beginPath(); g.arc(d.x, p.y, d.w * 0.42, 0, TAU); g.fill();
      g.globalAlpha = 1;
    }
  }
}

function star(g, x, y, s, color) {
  if (s <= 0.2) return;
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x, y - s);
  g.quadraticCurveTo(x, y, x + s, y);
  g.quadraticCurveTo(x, y, x, y + s);
  g.quadraticCurveTo(x, y, x - s, y);
  g.quadraticCurveTo(x, y, x, y - s);
  g.fill();
}
