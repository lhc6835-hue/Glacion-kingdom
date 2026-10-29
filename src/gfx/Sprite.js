// Character sprites from letter grids: every letter is a material, the builder adds a dark outline
// and shades each pixel by which of its edges face the light (upper left), giving a 5-step ramp.
import { makeCanvas } from './PixBuf.js';

export const OUTLINE = '#16141e';

// Materials shared by every sprite. Upper case = brightest tone of the same material.
const MAT = {
  c: '#ffd6b8', // skin
  h: '#6a4630', // hair (chestnut)
  r: '#d8503e', // scarf
  t: '#2f8a84', // shirt (teal)
  n: '#8a5a32', // leather / wood
  k: '#33283c', // boots
  y: '#e8b04a', // brass
  v: '#dc9e3c', // knit cap (mustard, reads against the green forest)
  j: '#a86a32', // cap cuff
  f: '#8ad06a', // leaf
  s: '#b9c0d0', // steel
};
const FLAT = { o: OUTLINE, e: '#2a2050', E: '#ffffff', l: '#ff8a9a', m: '#a03048' };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function hsl(hex) {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = (mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  }
  return [h, s * 100, l * 100];
}
function hex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return '#' + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

// Shadows lean toward violet, lights toward warm yellow, like hand-picked pixel ramps.
const ramps = {};
export function ramp(base) {
  if (ramps[base]) return ramps[base];
  const [h, s, l] = hsl(base), tw = (t, a) => (((t - h + 540) % 360) - 180) * a;
  const mk = (t, a, dl, ds) => hex((h + tw(t, a) + 360) % 360, clamp(s + ds, 0, 100), clamp(l + dl, 5, 97));
  return (ramps[base] = [mk(260, 0.14, -30, 6), mk(260, 0.08, -15, 2), base, mk(55, 0.07, 11, -4), mk(55, 0.12, 24, -10)]);
}

function material(ch, a, ov) {
  if (ch === '.' || ch == null) return null;
  const lo = ch.toLowerCase();
  if (ov[lo] && lo !== 'a') return { base: ov[lo], tone: ch !== lo ? 4 : null };
  if (FLAT[ch]) return { flat: FLAT[ch], solid: ch === 'o' };
  if (ch >= '1' && ch <= '4') return { base: a, tone: +ch };
  if (ch === 'a') return { base: a };
  if (ch === 'A') return { base: a, tone: 4 };
  if (MAT[lo]) return { base: MAT[lo], tone: ch !== lo ? 4 : null };
  return null;
}

// rows: equal-length strings. a: colour of the 'a' material. ov: per-sprite material overrides.
export function buildSprite(rows, a = '#c9c4b8', ov = {}) {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const grid = rows.map((r) => r.padEnd(w, '.'));
  const c = makeCanvas(w + 2, h + 2), x = c.getContext('2d'), img = x.createImageData(w + 2, h + 2);
  const M = grid.map((row) => [...row].map((ch) => material(ch, a, ov)));
  const at = (X, Y) => (X < 0 || Y < 0 || X >= w || Y >= h ? null : M[Y][X]);
  // flat details (eyes, cheeks) count as the same surface so they do not break the skin shading
  const same = (m, X, Y) => { const n = at(X, Y); if (!n) return false; if (n.flat && !n.solid) return true; return n.base === m.base; };
  const put = (X, Y, col) => { const [r, g, b] = rgb(col), i = (Y * (w + 2) + X) * 4; img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255; };
  for (let Y = -1; Y <= h; Y++) for (let X = -1; X <= w; X++) {
    const m = at(X, Y);
    if (!m) { if (at(X - 1, Y) || at(X + 1, Y) || at(X, Y - 1) || at(X, Y + 1)) put(X + 1, Y + 1, OUTLINE); continue; }
    if (m.flat) { put(X + 1, Y + 1, m.flat); continue; }
    let tone = m.tone;
    if (tone == null) {
      const tl = !same(m, X - 1, Y) || !same(m, X, Y - 1), br = !same(m, X + 1, Y) || !same(m, X, Y + 1);
      tone = tl && !br ? 3 : br && !tl ? 1 : 2;
      if (!tl && !br && !same(m, X + 1, Y + 1)) tone = 1;
      if (br && !same(m, X + 1, Y) && !same(m, X, Y + 1)) tone = 1;
    }
    put(X + 1, Y + 1, ramp(m.base)[tone]);
  }
  x.putImageData(img, 0, 0);
  return c;
}
