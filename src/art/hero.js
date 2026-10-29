// The chibi lumberjack, drawn live each frame from rectangles so every limb, the scarf and the
// axe can move independently. Coordinates are art pixels; (x, y) is the point between the feet.
import { PAL } from './palette.js';

const C = {
  ink: '#10181a', skin: '#f2c8a0', skinShade: '#d89c7a', cheek: '#e88a7a', eye: '#14181e', eyeHi: '#ffffff',
  hair: '#5a3a26', hairHi: '#7a5236', cap: '#2f6a4a', capHi: '#4f8a5a', capDark: '#1e4a36', leaf: '#8ad06a',
  shirt: '#e6dcc0', vest: '#3a5a4a', vestHi: '#4f7660', belt: '#3a2618', buckle: '#e8c05a',
  pants: '#5a4634', pantsHi: '#6e5640', boot: '#2a1e18', scarf: '#c0583a', scarfHi: '#e07a4a',
};

function R(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }

// Rasterises the axe along angle th (0 = straight up, +90° = forward) from the hand pivot.
export function drawAxe(g, hx, hy, th, axe, scale = 1) {
  const dx = Math.sin(th), dy = -Math.cos(th);
  const len = Math.round(12 * scale);
  // shaft: light wood with a dark underside so it reads on dark foliage; grip wrap in the axe's accent
  for (let i = -2; i <= len; i++) {
    const px = Math.round(hx + dx * i), py = Math.round(hy + dy * i);
    g.fillStyle = PAL.ink; g.fillRect(px + (Math.abs(dy) > 0.7 ? 1 : 0), py + (Math.abs(dy) > 0.7 ? 0 : 1), 1, 1);
    g.fillStyle = i < 2 ? axe.accent : '#c09060';
    g.fillRect(px, py, 1, 1);
  }
  g.fillStyle = PAL.ink;
  g.fillRect(Math.round(hx - dx * 3), Math.round(hy - dy * 3), 1, 1);
  // Blade: a wedge on the forward side of the shaft near its end.
  const fx = Math.cos(th), fy = Math.sin(th); // forward normal of the shaft
  const bx = hx + dx * (len - 2), by = hy + dy * (len - 2);
  const bw = 5 * scale, bh = 3.2 * scale;
  for (let v = -bh - 1; v <= bh + 1; v += 0.5) {
    for (let u = 0; u <= bw + 0.5; u += 0.5) {
      const half = bh * (0.55 + 0.45 * (u / bw)) + (u > bw - 1 ? 0.6 : 0);
      if (Math.abs(v) > half) continue;
      const px = Math.round(bx + fx * u + dx * v), py = Math.round(by + fy * u + dy * v);
      const edge = u > bw - 1.2;
      const rim = Math.abs(v) > half - 0.7;
      g.fillStyle = edge ? '#f4fbff' : rim ? PAL.ink : (v > 0 ? axe.blade : shade(axe.blade));
      g.fillRect(px, py, 1, 1);
    }
  }
}

const shadeCache = new Map();
function shade(hex) {
  let s = shadeCache.get(hex);
  if (!s) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.round(v * 0.72).toString(16).padStart(2, '0');
    s = '#' + f(n >> 16) + f((n >> 8) & 255) + f(n & 255);
    shadeCache.set(hex, s);
  }
  return s;
}

// pose: { bob, legL, legR, armL, armR, lean, squash, axe, axeAngle, axeOnBack, blink, scarf, look }
export function drawHero(g, x, y, facing, pose, axe) {
  g.save();
  g.translate(Math.round(x), Math.round(y));
  if (facing < 0) g.scale(-1, 1);
  const sq = pose.squash || 0;               // +: squashed, -: stretched
  const bob = Math.round(pose.bob || 0);
  const lean = Math.round(pose.lean || 0);
  const bodyY = -12 + bob + Math.round(sq);
  // legs
  const leg = (lx, lift, hi) => {
    R(g, lx, -5 - lift + Math.round(sq * 0.3), 3, 4 , hi ? C.pantsHi : C.pants);
    R(g, lx - (hi ? 0 : 0), -2 - lift, 4, 2, C.boot);
  };
  leg(-4, Math.round(pose.legL || 0), false);
  leg(1, Math.round(pose.legR || 0), true);
  // back axe (stowed)
  if (pose.axeOnBack) drawAxe(g, -5 + lean, bodyY + 6, -0.5, axe, 0.85);
  // back arm
  const armY = bodyY + 3;
  R(g, -5 + lean, armY + Math.round(pose.armL || 0), 2, 5, C.vest);
  R(g, -5 + lean, armY + 4 + Math.round(pose.armL || 0), 2, 2, C.skinShade);
  // body
  R(g, -4 + lean, bodyY + 1, 8, 8, C.shirt);
  R(g, -4 + lean, bodyY + 1, 3, 7, C.vest); R(g, 2 + lean, bodyY + 1, 2, 7, C.vest);
  R(g, -4 + lean, bodyY + 1, 1, 7, C.vestHi);
  R(g, -4 + lean, bodyY + 7, 8, 1, C.belt); R(g, 0 + lean, bodyY + 7, 2, 1, C.buckle);
  R(g, -5 + lean, bodyY + 1, 1, 8, C.ink); R(g, 4 + lean, bodyY + 1, 1, 8, C.ink);
  // scarf, its tail trails behind with motion
  const sc = pose.scarf || 0;
  R(g, -4 + lean, bodyY, 8, 2, C.scarf); R(g, -3 + lean, bodyY, 5, 1, C.scarfHi);
  R(g, -6 + lean - Math.round(sc), bodyY + 1 + Math.round(Math.abs(sc) * 0.3), 3, 2, C.scarf);
  R(g, -8 + lean - Math.round(sc * 1.6), bodyY + 2 + Math.round(Math.abs(sc) * 0.4), 2, 1, C.scarfHi);
  // head (big, chibi)
  const hx = -7 + lean + Math.round(pose.look || 0), hy = bodyY - 12;
  R(g, hx + 1, hy, 12, 13, C.ink);
  R(g, hx, hy + 1, 14, 11, C.ink);
  R(g, hx + 1, hy + 1, 12, 11, C.skin);
  R(g, hx + 1, hy + 9, 12, 2, C.skinShade);
  // hair and cap
  R(g, hx + 1, hy + 1, 12, 4, C.hair);
  R(g, hx + 1, hy + 5, 2, 4, C.hair); R(g, hx + 11, hy + 5, 2, 3, C.hair);
  R(g, hx + 9, hy + 5, 2, 1, C.hairHi);
  R(g, hx + 1, hy - 1, 12, 4, C.cap); R(g, hx + 2, hy - 2, 10, 1, C.cap);
  R(g, hx + 3, hy - 1, 5, 1, C.capHi);
  R(g, hx + 1, hy + 2, 12, 1, C.capDark);
  R(g, hx + 0, hy + 1, 1, 2, C.ink); R(g, hx + 13, hy + 1, 1, 2, C.ink);
  R(g, hx + 2, hy - 3, 10, 1, C.ink);
  R(g, hx + 9, hy - 4, 2, 2, C.leaf); R(g, hx + 11, hy - 5, 1, 1, C.leaf);
  // face: eyes look forward
  if (pose.blink) { R(g, hx + 7, hy + 7, 2, 1, C.eye); R(g, hx + 11, hy + 7, 2, 1, C.eye); }
  else {
    R(g, hx + 7, hy + 6, 2, 3, C.eye); R(g, hx + 11, hy + 6, 2, 3, C.eye);
    R(g, hx + 7, hy + 6, 1, 1, C.eyeHi); R(g, hx + 11, hy + 6, 1, 1, C.eyeHi);
  }
  R(g, hx + 6, hy + 9, 2, 1, C.cheek); R(g, hx + 12, hy + 9, 1, 1, C.cheek);
  if (pose.mouth) R(g, hx + 9, hy + 10, 2, 1, C.ink);
  // axe in hands, then front arm over it
  const ax = 2 + lean, ay = bodyY + 2;
  let handX = ax + 2, handY = ay + 5 + Math.round(pose.armR || 0);
  if (!pose.axeOnBack) {
    const th = pose.axeAngle ?? 0.7;
    handX = Math.round(ax + 1 + Math.sin(th) * 5);
    handY = Math.round(ay + 2 - Math.cos(th) * 5);
    drawAxe(g, handX, handY, th, axe);
  }
  // front arm from shoulder to hand
  const sx = ax, sy = ay;
  const steps = Math.max(Math.abs(handX - sx), Math.abs(handY - sy), 1);
  g.fillStyle = C.vest;
  for (let i = 0; i <= steps; i++) g.fillRect(Math.round(sx + ((handX - sx) * i) / steps), Math.round(sy + ((handY - sy) * i) / steps), 2, 2);
  R(g, handX, handY, 2, 2, C.skin);
  g.restore();
}
