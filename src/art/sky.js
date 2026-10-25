import { canvas, rgb, mix, rng, blob } from './paint.js';

// Painted skies: cumulus clouds and distant mountain ranges for the horizon panorama.

export function paintCloud(seed, { w = 900, h = 420 } = {}) {
  const r = rng(seed);
  const c = canvas(w, h), ctx = c.getContext('2d');
  const puffs = [];
  const n = r.int(14, 22);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    // Billowing tower in the middle, flatter on the sides; flat-ish base.
    const x = w * (0.12 + t * 0.76) + r.range(-0.05, 0.05) * w;
    const tall = Math.sin(Math.PI * t) ** 0.8;
    const rad = h * r.range(0.14, 0.24) * (0.6 + tall * 0.7);
    const y = h * 0.78 - rad * 0.6 - tall * h * r.range(0.15, 0.38);
    puffs.push({ x, y, r: rad });
  }
  for (let i = 0; i < 6; i++) puffs.push({ x: w * r.range(0.25, 0.75), y: h * r.range(0.3, 0.55), r: h * r.range(0.18, 0.26) });
  ctx.filter = 'blur(2px)';
  // Shadow base (cool lavender), then lit body (warm white), then bright rims on the upper left.
  for (const p of puffs) blob(ctx, p.x, p.y + p.r * 0.12, p.r * 1.02, p.r, 'rgb(176,184,214)');
  ctx.globalCompositeOperation = 'source-atop';
  for (const p of puffs) blob(ctx, p.x - p.r * 0.14, p.y - p.r * 0.16, p.r * 0.88, p.r * 0.84, 'rgb(236,238,246)');
  for (const p of puffs) blob(ctx, p.x - p.r * 0.3, p.y - p.r * 0.34, p.r * 0.5, p.r * 0.45, 'rgb(255,252,240)');
  // Flat shaded underside.
  ctx.filter = 'blur(6px)';
  ctx.fillStyle = 'rgba(150,160,200,0.55)';
  ctx.fillRect(0, h * 0.74, w, h * 0.3);
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  return c;
}

// A long mountain range. Peaks are lit on their left (sunward) faces; snow above `snow`.
export function paintRange(seed, { w = 2048, h = 600, peaks = 9, jag = 0.55, base = [0.55, 0.62, 0.74], shadow = [0.38, 0.44, 0.60], snow = 0.55, snowCol = [0.96, 0.97, 1.0] } = {}) {
  const r = rng(seed);
  const c = canvas(w, h), ctx = c.getContext('2d');
  // Ridge line by midpoint displacement between hand-shaped peaks.
  const N = 512;
  const ridge = new Float32Array(N + 1);
  // Pointed peaks with concave flanks (needle-like, as in the reference), combined by max.
  const pk = [];
  for (let i = 0; i < peaks; i++) {
    pk.push({ x: (i + 0.5) / peaks + r.range(-0.4, 0.4) / peaks, y: r.range(0.35, 1.0) * (i % 3 === 1 ? 1 : 0.72), w: r.range(0.6, 1.3) / peaks });
  }
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    let v = 0.12;
    for (const p of pk) {
      const d = Math.abs(t - p.x) / p.w;
      if (d < 1) v = Math.max(v, p.y * Math.pow(1 - d, 1.6));
    }
    ridge[i] = v;
  }
  // Fractal detail by midpoint displacement, added on top of the shaped ridge.
  const det = new Float32Array(N + 1);
  let amp = jag * 0.16;
  for (let step = N / 4; step >= 1; step /= 2, amp *= 0.66) {
    for (let i = step; i < N; i += step * 2) det[i] = (det[i - step] + det[i + step]) / 2 + r.range(-amp, amp);
  }
  for (let i = 0; i <= N; i++) ridge[i] += det[i];
  const yAt = (i) => h - Math.max(0.04, Math.min(1, ridge[Math.max(0, Math.min(N, i))])) * h * 0.95;
  // Fill strip by strip; the smoothed slope decides how much a face turns toward the light.
  for (let i = 0; i < N; i++) {
    const x0 = (i / N) * w, x1 = ((i + 1) / N) * w + 1;
    const y = yAt(i);
    const slope = (ridge[Math.min(N, i + 5)] - ridge[Math.max(0, i - 5)]) * 9 + (ridge[Math.min(N, i + 1)] - ridge[Math.max(0, i - 1)]) * 14;
    const lit = Math.min(1, Math.max(0, 0.5 - slope)); // rising to the right = faces left = lit
    const col = mix(shadow, base, lit);
    const g = ctx.createLinearGradient(0, y, 0, h);
    g.addColorStop(0, rgb(col));
    g.addColorStop(1, rgb(mix(col, [0.80, 0.86, 0.94], 0.65)));
    ctx.fillStyle = g;
    ctx.fillRect(x0, y, x1 - x0, h - y);
    const top = 1 - y / h;
    if (top > snow) {
      const depth = (top - snow) * h * (0.7 + 0.5 * det[i] / (jag * 0.3)) + 4;
      const sg = ctx.createLinearGradient(0, y, 0, y + depth);
      const sc = mix(snowCol, [0.70, 0.76, 0.92], (1 - lit) * 0.7);
      sg.addColorStop(0, rgb(sc)); sg.addColorStop(0.8, rgb(sc, 0.9)); sg.addColorStop(1, rgb(sc, 0));
      ctx.fillStyle = sg;
      ctx.fillRect(x0, y, x1 - x0, depth);
    }
  }
  // Soft vertical gullies.
  for (let i = 0; i < 60; i++) {
    const x = r() * w;
    const y = yAt(Math.floor((x / w) * N));
    ctx.strokeStyle = 'rgba(40,50,90,0.06)';
    ctx.lineWidth = r.range(2, 6);
    ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.quadraticCurveTo(x + r.range(-20, 20), y + (h - y) * 0.4, x + r.range(-30, 30), h); ctx.stroke();
  }
  return c;
}

// Tiny gull silhouette in two wing poses.
export function paintBird(pose) {
  const c = canvas(24, 12), ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgb(250,250,255)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  ctx.beginPath();
  if (pose === 0) { ctx.moveTo(2, 4); ctx.quadraticCurveTo(7, 2, 12, 7); ctx.quadraticCurveTo(17, 2, 22, 4); }
  else { ctx.moveTo(2, 9); ctx.quadraticCurveTo(7, 9, 12, 6); ctx.quadraticCurveTo(17, 9, 22, 9); }
  ctx.stroke();
  return c;
}
