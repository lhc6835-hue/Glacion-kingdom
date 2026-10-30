// Scoop sprites: one per flavor, baked once. A dome with a scalloped, drippy lip, the flavor's
// inclusions, soft shading and a glossy highlight, all inside one silhouette with one outline.
import { makeSprite, atop } from './sprite.js';
import { shade, rgba, rng, TAU } from '../core/math.js';
import { FLAVOR } from '../../shared/flavors.js';

export const R = 24; // scoop radius in design units
const cache = new Map();

export function scoopSprite(flavorId) {
  let s = cache.get(flavorId);
  if (!s) { s = bakeScoop(FLAVOR[flavorId] || FLAVOR.milk); cache.set(flavorId, s); }
  return s;
}

function hash(str) { let h = 2166136261; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }

export function scoopSilhouette(g, rnd) {
  const rimY = R * 0.4;
  g.beginPath();
  g.moveTo(-R * 1.03, rimY);
  g.bezierCurveTo(-R * 1.14, -R * 0.38, -R * 0.64, -R * 1.04, 0, -R * 1.0);
  g.bezierCurveTo(R * 0.64, -R * 1.04, R * 1.14, -R * 0.38, R * 1.03, rimY);
  const n = 5, span = R * 2.06;
  const dripAt = (rnd() * n) | 0;
  for (let i = 0; i < n; i++) {
    const x0 = R * 1.03 - span * (i / n), x1 = R * 1.03 - span * ((i + 1) / n);
    const mx = (x0 + x1) / 2;
    const depth = R * (0.17 + rnd() * 0.07);
    if (i === dripAt) {
      // a single drip hanging off this bump
      const dl = R * (0.42 + rnd() * 0.25), dw = (x0 - x1) * 0.26;
      g.quadraticCurveTo(x0 - (x0 - x1) * 0.15, rimY + depth * 1.3, mx + dw, rimY + depth * 1.1);
      g.bezierCurveTo(mx + dw, rimY + dl, mx + dw * 1.3, rimY + dl + dw * 1.9, mx, rimY + dl + dw * 1.9);
      g.bezierCurveTo(mx - dw * 1.3, rimY + dl + dw * 1.9, mx - dw, rimY + dl, mx - dw, rimY + depth * 1.1);
      g.quadraticCurveTo(x1 + (x0 - x1) * 0.15, rimY + depth * 1.3, x1, rimY);
    } else {
      g.quadraticCurveTo(mx, rimY + depth * 2, x1, rimY);
    }
  }
  g.closePath();
}

function bakeScoop(f) {
  const rnd = rng(hash(f.id));
  const c = f.c;
  const dark = shade(c, -0.42);
  return makeSprite(R * 2.6, R * 2.8, R * 1.3, R * 1.25, (g) => {
    g.fillStyle = c;
    scoopSilhouette(g, rnd);
    g.fill();
    atop(g, (g) => {
      paintPattern(g, f, rnd);
      // body shading: cool light from the upper left, warm shadow lower right
      let gr = g.createRadialGradient(-R * 0.4, -R * 0.55, R * 0.1, -R * 0.1, -R * 0.1, R * 1.5);
      gr.addColorStop(0, 'rgba(255,255,255,0.55)');
      gr.addColorStop(0.45, 'rgba(255,255,255,0.05)');
      gr.addColorStop(1, rgba(dark, 0.42));
      g.fillStyle = gr;
      g.fillRect(-R * 2, -R * 2, R * 4, R * 4);
      // the lip under the dome sits in shade
      gr = g.createLinearGradient(0, R * 0.15, 0, R * 0.8);
      gr.addColorStop(0, rgba(dark, 0));
      gr.addColorStop(0.35, rgba(dark, 0.32));
      gr.addColorStop(1, rgba(dark, 0.12));
      g.fillStyle = gr;
      g.fillRect(-R * 2, R * 0.18, R * 4, R * 2);
      // a lighter crease where the dome meets the lip
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = R * 0.07;
      g.beginPath();
      g.moveTo(-R * 0.9, R * 0.3);
      g.quadraticCurveTo(0, R * 0.48, R * 0.9, R * 0.3);
      g.stroke();
      // glossy highlight
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.beginPath();
      g.ellipse(-R * 0.45, -R * 0.55, R * 0.22, R * 0.12, -0.6, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.beginPath();
      g.arc(-R * 0.15, -R * 0.78, R * 0.06, 0, TAU);
      g.fill();
    });
  }, { outline: 1.15, outlineColor: rgba(shade(c, -0.6), 0.75) });
}

function scatter(rnd, n, fn) {
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU, d = Math.sqrt(rnd());
    fn(Math.cos(a) * d * R * 1.05, Math.sin(a) * d * R * 0.95 - R * 0.1, i);
  }
}

function paintPattern(g, f, rnd) {
  const pc = f.pc || ['#000'];
  const col = (i) => pc[i % pc.length];
  switch (f.p) {
    case 'seeds':
      scatter(rnd, 16, (x, y, i) => { g.fillStyle = col(i); g.beginPath(); g.ellipse(x, y, 1.1, 1.8, rnd() * 3, 0, TAU); g.fill(); });
      break;
    case 'chips':
      scatter(rnd, 13, (x, y, i) => {
        g.fillStyle = col(i);
        g.beginPath();
        const s = 2 + rnd() * 2;
        g.moveTo(x - s, y); g.lineTo(x + rnd() * s, y - s); g.lineTo(x + s, y + rnd() * s * 0.6); g.lineTo(x - s * 0.2, y + s * 0.8);
        g.closePath(); g.fill();
      });
      break;
    case 'chunks':
      scatter(rnd, 9, (x, y, i) => {
        g.fillStyle = col(i);
        g.beginPath(); g.ellipse(x, y, 3 + rnd() * 2.6, 2.4 + rnd() * 2, rnd() * 3, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.beginPath(); g.arc(x - 1, y - 1, 1, 0, TAU); g.fill();
      });
      break;
    case 'dots':
      scatter(rnd, 14, (x, y, i) => { g.fillStyle = col(i); g.beginPath(); g.arc(x, y, 1.5 + rnd() * 1.4, 0, TAU); g.fill(); });
      break;
    case 'dust':
      scatter(rnd, 60, (x, y, i) => { g.fillStyle = rgba(col(i), 0.55); g.fillRect(x, y, 0.9, 0.9); });
      break;
    case 'bean':
      scatter(rnd, 30, (x, y, i) => { g.fillStyle = rgba(col(i), 0.8); g.beginPath(); g.ellipse(x, y, 0.5, 0.9, rnd() * 3, 0, TAU); g.fill(); });
      break;
    case 'swirl':
      for (let i = 0; i < 3; i++) {
        g.strokeStyle = rgba(col(i), 0.85);
        g.lineWidth = R * (0.12 + rnd() * 0.06);
        g.beginPath();
        const y0 = -R * 0.6 + i * R * 0.42;
        g.moveTo(-R * 1.1, y0 + rnd() * 6);
        g.bezierCurveTo(-R * 0.4, y0 - R * 0.5, R * 0.2, y0 + R * 0.5, R * 1.1, y0 - rnd() * 6);
        g.stroke();
      }
      break;
    case 'stripes':
      for (let i = 0; i < 9; i++) {
        g.fillStyle = col(i);
        g.beginPath();
        const x = -R * 1.6 + i * R * 0.42;
        g.moveTo(x, -R * 1.2); g.lineTo(x + R * 0.24, -R * 1.2); g.lineTo(x + R * 0.94, R * 1.2); g.lineTo(x + R * 0.7, R * 1.2);
        g.closePath(); g.fill();
      }
      break;
    case 'fizz':
      scatter(rnd, 12, (x, y, i) => { g.strokeStyle = rgba(col(i), 0.8); g.lineWidth = 0.8; g.beginPath(); g.arc(x, y, 1 + rnd() * 2, 0, TAU); g.stroke(); });
      break;
    case 'crystals':
      scatter(rnd, 14, (x, y, i) => {
        g.fillStyle = rgba(col(i), 0.9);
        g.beginPath(); g.moveTo(x, y - 1.8); g.lineTo(x + 1.2, y); g.lineTo(x, y + 1.8); g.lineTo(x - 1.2, y); g.closePath(); g.fill();
      });
      break;
    case 'petals':
      scatter(rnd, 9, (x, y, i) => {
        g.fillStyle = col(i);
        g.save(); g.translate(x, y); g.rotate(rnd() * TAU);
        g.beginPath(); g.moveTo(0, -3); g.quadraticCurveTo(2.6, -1, 0, 3); g.quadraticCurveTo(-2.6, -1, 0, -3); g.fill();
        g.restore();
      });
      break;
    case 'glitter':
      scatter(rnd, 16, (x, y, i) => star(g, x, y, 1.2 + rnd() * 1.4, rgba(col(i), 0.95)));
      break;
    case 'snow':
      scatter(rnd, 8, (x, y, i) => {
        g.strokeStyle = col(i); g.lineWidth = 0.8;
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * Math.PI;
          g.beginPath(); g.moveTo(x - Math.cos(a) * 2.6, y - Math.sin(a) * 2.6); g.lineTo(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6); g.stroke();
        }
      });
      break;
    case 'boba':
      scatter(rnd, 7, (x, y, i) => {
        g.fillStyle = col(i);
        g.beginPath(); g.arc(x, y, 3.2, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.45)';
        g.beginPath(); g.arc(x - 1, y - 1.1, 1, 0, TAU); g.fill();
      });
      break;
    case 'honeycomb':
      scatter(rnd, 6, (x, y, i) => {
        g.fillStyle = col(i);
        g.beginPath();
        for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; g.lineTo(x + Math.cos(a) * 3.6, y + Math.sin(a) * 3.6); }
        g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.arc(x - 1, y - 1, 1.2, 0, TAU); g.fill();
      });
      break;
    case 'aurora':
      for (let i = 0; i < 3; i++) {
        const gr = g.createLinearGradient(-R, 0, R, 0);
        gr.addColorStop(0, rgba(col(i), 0));
        gr.addColorStop(0.5, rgba(col(i), 0.75));
        gr.addColorStop(1, rgba(col(i), 0));
        g.fillStyle = gr;
        g.beginPath();
        const y = -R * 0.8 + i * R * 0.5;
        g.moveTo(-R * 1.2, y); g.bezierCurveTo(-R * 0.3, y - R * 0.4, R * 0.3, y + R * 0.4, R * 1.2, y - R * 0.1);
        g.lineTo(R * 1.2, y + R * 0.25); g.bezierCurveTo(R * 0.3, y + R * 0.65, -R * 0.3, y + R * 0.05, -R * 1.2, y + R * 0.35);
        g.fill();
      }
      break;
    case 'stars':
      scatter(rnd, 4, (x, y, i) => {
        const gr = g.createRadialGradient(x, y, 0, x, y, R * 0.6);
        gr.addColorStop(0, rgba(i % 2 ? '#ff7ad9' : '#5ab8ff', 0.5)); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(x - R, y - R, R * 2, R * 2);
      });
      scatter(rnd, 22, (x, y, i) => { g.fillStyle = col(i); g.beginPath(); g.arc(x, y, 0.4 + rnd() * 0.8, 0, TAU); g.fill(); });
      star(g, -R * 0.2, -R * 0.2, 3, '#ffffff');
      star(g, R * 0.5, R * 0.05, 2, '#ffe9fb');
      break;
    case 'nebula':
      scatter(rnd, 6, (x, y, i) => {
        const gr = g.createRadialGradient(x, y, 0, x, y, R * 0.7);
        gr.addColorStop(0, rgba(col(i), 0.7)); gr.addColorStop(1, rgba(col(i), 0));
        g.fillStyle = gr; g.fillRect(x - R, y - R, R * 2, R * 2);
      });
      scatter(rnd, 16, (x, y) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 0.5 + rnd() * 0.6, 0, TAU); g.fill(); });
      break;
    default:
  }
}

export function star(g, x, y, s, color) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x, y - s);
  g.quadraticCurveTo(x, y, x + s, y);
  g.quadraticCurveTo(x, y, x, y + s);
  g.quadraticCurveTo(x, y, x - s, y);
  g.quadraticCurveTo(x, y, x, y - s);
  g.fill();
}
