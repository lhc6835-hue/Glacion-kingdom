// Pre-rendered soft light sprites for the light canvas (built once, tinted by drawing colour layers).
import { makeCanvas } from './PixBuf.js';

export function radial(size, color, inner = 0) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, size * inner / 2, size / 2, size / 2, size / 2);
  gr.addColorStop(0, color);
  gr.addColorStop(0.35, color.replace(/[\d.]+\)$/, (m) => `${parseFloat(m) * 0.45})`));
  gr.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return c;
}

// Irregular leaf-shaped dapple of light: several overlapping soft ovals.
export function dapple(seed) {
  const S = 96;
  const c = makeCanvas(S, S / 2);
  const g = c.getContext('2d');
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 7; i++) {
    const x = S * (0.2 + rnd() * 0.6), y = S / 4 + (rnd() - 0.5) * S * 0.16, r = S * (0.07 + rnd() * 0.12);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(x, y, r, r * 0.45, 0, 0, Math.PI * 2); g.fill();
  }
  return c;
}

export function buildGlows() {
  return {
    white: radial(64, 'rgba(255,255,255,1)'),
    warm: radial(128, 'rgba(255,190,110,0.9)'),
    cyan: radial(64, 'rgba(140,255,220,0.9)'),
    green: radial(96, 'rgba(150,255,140,0.85)'),
    blue: radial(96, 'rgba(120,190,255,0.9)'),
    gold: radial(128, 'rgba(255,220,120,0.95)'),
    moon: radial(128, 'rgba(190,215,255,0.8)'),
    fog: radial(128, 'rgba(200,225,220,0.6)'),
    dapples: [1, 7, 19, 33].map(dapple),
  };
}
