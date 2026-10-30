// Mossroot, the ancient elder tree of Evergreen Hollow, drawn whole: flared root buttresses,
// a twisting trunk that splits into three great limbs, and a broad crown that sways in pieces.
// Sized to sit fully on screen from roots to crown in both landscape and portrait views.
import { PixBuf } from '../gfx/PixBuf.js';
import { mulberry32, hash2 } from '../core/Rng.js';
import { PAL } from './palette.js';
import { paintCanopy } from './trees.js';

const W = 250, H = 192, CX = 125, BASE = H - 2;
const BARK = ['#120e0c', '#231a15', '#36291f', '#4c3a2b', '#66503b', '#866c50'];
const LEAF = ['#0b1f1a', '#13352b', '#1f4f39', '#336c45', '#5a9454', '#a2cc72'];

export function elderTree() {
  const rnd = mulberry32(925);
  const trunk = new PixBuf(W, H);

  // bark shade for a point inside a limb: u is 0 at the lit (left) edge, 1 at the shaded edge
  const barkAt = (x, y, u, twist) => {
    let k = u < 0.14 ? 4 : u < 0.42 ? 3 : u < 0.76 ? 2 : 1;
    const groove = Math.sin((x * 0.9 + y * twist) / 2.6 + Math.sin(y / 19) * 2);
    if (groove > 0.8) k = Math.max(0, k - 2);
    else if (groove < -0.92 && k < 5) k++;
    if (hash2(x >> 1, y >> 1, 41) < 0.05) k = Math.max(0, k - 1);
    let col = BARK[k];
    // moss on the shaded flank and on upward-facing bark
    if (u > 0.6 && hash2(x >> 1, y >> 1, 43) < 0.22) col = PAL.moss[k > 2 ? 3 : 2];
    else if (hash2(x >> 2, y >> 1, 44) < 0.04) col = PAL.moss[2];
    return col;
  };

  // main trunk: wide flared base narrowing up to the fork, with a slow twist
  const FORK = 92;
  for (let y = FORK; y <= BASE; y++) {
    const t = (y - FORK) / (BASE - FORK);
    let half = 15 + t * 7 + Math.pow(t, 6) * 34;
    const sway = Math.sin(t * 2.6) * 3;
    const x0 = Math.round(CX + sway - half), x1 = Math.round(CX + sway + half);
    for (let x = x0; x <= x1; x++) trunk.set(x, y, barkAt(x, y, (x - x0) / Math.max(1, x1 - x0), 0.5));
  }
  // a limb is a run of shaded discs whose radius tapers along a gentle curve
  const limb = (x0, y0, x1, y1, r0, r1, bend) => {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const bx = x0 + (x1 - x0) * t + Math.sin(t * Math.PI) * bend;
      const by = y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * Math.abs(bend) * 0.3;
      const r = r0 + (r1 - r0) * t;
      for (let dy = -Math.ceil(r); dy <= r; dy++) for (let dx = -Math.ceil(r); dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const x = Math.round(bx + dx), y = Math.round(by + dy);
        trunk.set(x, y, barkAt(x, y, (dx + r) / (2 * r) * 0.85 + (dy + r) / (2 * r) * 0.15, 0.3));
      }
    }
  };
  limb(CX - 6, FORK + 6, CX - 70, 52, 11, 4, -8);
  limb(CX + 6, FORK + 4, CX + 72, 46, 11, 4, 8);
  limb(CX + 1, FORK + 2, CX + 6, 30, 12, 5, 4);
  limb(CX - 40, 70, CX - 92, 64, 4, 2, 0);
  limb(CX + 44, 64, CX + 100, 60, 4, 2, 0);
  limb(CX + 4, 50, CX - 24, 28, 4, 2, 0);
  // root buttresses arching into the soil on both sides
  for (const dir of [-1, 1]) for (let k = 0; k < 3; k++) {
    const len = 26 + k * 16, x0 = CX + dir * (30 + k * 4), r0 = 6 - k * 1.5;
    for (let i = 0; i <= len; i++) {
      const t = i / len;
      const bx = x0 + dir * i, by = BASE - 10 + k * 2 + Math.pow(t, 0.7) * (10 - k * 2) - Math.sin(t * Math.PI) * (5 - k);
      const r = Math.max(1, r0 * (1 - t * 0.75));
      for (let dy = -Math.ceil(r); dy <= r; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (Math.abs(dy) > r) continue;
        const x = Math.round(bx + dx), y = Math.round(by + dy);
        if (y > BASE) continue;
        trunk.set(x, y, barkAt(x, y, (dy + r) / (2 * r), 0.2));
      }
    }
  }
  // hollow between the roots, with a faint glow at the back
  for (let y = BASE - 30; y <= BASE; y++) {
    const half = y < BASE - 24 ? Math.sqrt(Math.max(0, 36 - (BASE - 24 - y) ** 2 * 1.2)) : 8;
    for (let x = -half; x <= half; x++) trunk.set(CX + 2 + x, y, y > BASE - 6 && Math.abs(x) < 4 ? '#14302a' : '#0a1210');
  }
  for (let y = BASE - 31; y <= BASE; y++) { trunk.set(CX + 2 - 9, y, BARK[5]); trunk.set(CX + 2 + 9, y, BARK[0]); }
  // glowing rune channels spiralling up the trunk
  const runes = [];
  for (const [x, y] of [[-12, 162], [9, 140], [-5, 118], [12, 104], [-16, 180], [0, 84], [-34, 72], [40, 62]]) {
    for (let i = 0; i < 8; i++) trunk.set(CX + x + Math.round(Math.sin(i / 1.8) * 2), y + i, i % 3 ? PAL.glow : '#e0fff0');
    runes.push({ x, y: y + 4 - BASE });
  }
  trunk.outline(PAL.ink);

  // crown: three swaying masses (left, right, top) and a still core behind them
  const clusters = [];
  let id = 0;
  const blob = (x, y, r, piece, jag = 0.26) => clusters.push({ kind: 'blob', x, y, r, piece, jag, id: id++ });
  blob(CX, 46, 34, 0); blob(CX - 30, 54, 26, 0); blob(CX + 32, 50, 26, 0);
  for (const [x, y, r] of [[46, 58, 28], [24, 72, 18], [70, 38, 24], [60, 80, 16], [92, 70, 18]]) blob(x + (rnd() - 0.5) * 4, y, r, 1);
  for (const [x, y, r] of [[200, 52, 30], [228, 68, 18], [176, 32, 24], [192, 80, 16], [158, 70, 18]]) blob(x + (rnd() - 0.5) * 4, y, r, 2);
  for (const [x, y, r] of [[CX, 28, 25], [CX - 28, 32, 20], [CX + 26, 27, 21]]) blob(x, y, r, 3);
  const crown = paintCanopy(W, H, clusters, LEAF, 925).map((c, i) => ({ c, amp: [0, 0.6, 0.8, 0.5][i], phase: i * 1.7 }));

  // hanging moss and vines from the crown's underside, plus floating spores (front layer)
  const front = new PixBuf(W, H);
  for (let i = 0; i < 26; i++) {
    const x = Math.round(30 + rnd() * (W - 60));
    const top = 74 + Math.round(rnd() * 22) - (Math.abs(x - CX) < 40 ? 6 : 0);
    const len = 6 + Math.round(rnd() * 22);
    for (let j = 0; j < len; j++) {
      const xx = x + Math.round(Math.sin(j / 4 + i) * 0.8);
      front.set(xx, top + j, j > len - 3 ? PAL.moss[4] : PAL.moss[j % 5 ? 2 : 3]);
    }
    if (i % 5 === 0) front.set(x, top + len, PAL.glow);
  }
  const spores = [];
  for (let i = 0; i < 18; i++) spores.push({ x: Math.round(20 + rnd() * (W - 40)) - CX, y: Math.round(10 + rnd() * 80) - BASE, p: rnd() * 6.28 });

  return { c: trunk.toCanvas(), crown, front: front.toCanvas(), spores, ax: CX, ay: BASE, runes, hollow: { x: 2, y: -16 }, W, H };
}
