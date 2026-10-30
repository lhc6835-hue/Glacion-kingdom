// The plaza's two showpieces: the gacha machines and the play-zone gate. Both are drawn live
// (they animate: chasing marquee bulbs, a turning knob, a swirling portal) and are reused,
// larger, inside the gacha and play-zone menus.
import { TAU, rng, shade, rgba, clamp } from '../core/math.js';

export const MACHINE = {
  flavor: { body: '#ff8fb4', deep: '#f0628f', light: '#ffe0eb', glass: '#fff4f8', sign: '맛 뽑기', sub: 'FLAVOR', topper: 'cherry', caps: ['#ff7aa2', '#ffd35a', '#8fe0c0', '#b69cff', '#ffb36b', '#7fc4ff'] },
  weapon: { body: '#7fc4ff', deep: '#4f9ee8', light: '#e0f1ff', glass: '#f2fbff', sign: '무기 뽑기', sub: 'WEAPON', topper: 'star', caps: ['#7fc4ff', '#ffd35a', '#ff8fb4', '#8fe0c0', '#c9a6ff', '#ff9a5a'] },
};

const GOLD = '#ffcf4a', GOLD_D = '#d99a1a';

function capsule(g, x, y, r, top, rot = 0) {
  // a two-tone capsule ball: coloured top, white bottom, seam, soft shading and a highlight
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  const sh = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05);
  sh.addColorStop(0, shade(top, 0.45)); sh.addColorStop(0.6, top); sh.addColorStop(1, shade(top, -0.25));
  g.fillStyle = sh;
  g.beginPath(); g.arc(0, 0, r, Math.PI, 0); g.closePath(); g.fill();
  const wb = g.createRadialGradient(-r * 0.3, r * 0.1, r * 0.1, 0, 0, r * 1.05);
  wb.addColorStop(0, '#ffffff'); wb.addColorStop(1, '#dcdfe8');
  g.fillStyle = wb;
  g.beginPath(); g.arc(0, 0, r, 0, Math.PI); g.closePath(); g.fill();
  g.fillStyle = rgba(shade(top, -0.35), 0.5);
  g.fillRect(-r, -r * 0.07, r * 2, r * 0.14);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.beginPath(); g.ellipse(-r * 0.38, -r * 0.48, r * 0.28, r * 0.15, -0.6, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(80,60,90,0.25)'; g.lineWidth = Math.max(1, r * 0.08);
  g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
  g.restore();
}

function starPath(g, x, y, R, r, n = 5, rot = -Math.PI / 2) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = rot + (i / (n * 2)) * TAU, rr = i % 2 ? r : R; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath();
}

// st: { shake: 0..1, knob: radians, drop: null | 0..1 (capsule rolling out of the chute), dropColor }
export function drawMachine(g, kind, t, st = {}) {
  const T = MACHINE[kind];
  const shake = st.shake || 0;
  const sx = Math.sin(t * 55) * 4 * shake, sr = Math.sin(t * 47) * 0.025 * shake;
  g.save();
  // pedestal
  g.fillStyle = 'rgba(90,60,110,0.18)';
  g.beginPath(); g.ellipse(6, 6, 118, 22, 0, 0, TAU); g.fill();
  g.fillStyle = shade(T.deep, -0.1);
  g.beginPath(); g.ellipse(0, -6, 108, 20, 0, 0, TAU); g.fill();
  g.fillRect(-108, -22, 216, 16);
  const pt = g.createLinearGradient(-108, 0, 108, 0);
  pt.addColorStop(0, shade(T.body, 0.25)); pt.addColorStop(1, T.deep);
  g.fillStyle = pt; g.beginPath(); g.ellipse(0, -22, 108, 20, 0, 0, TAU); g.fill();
  g.strokeStyle = GOLD; g.lineWidth = 3; g.beginPath(); g.ellipse(0, -22, 96, 16, 0, 0, TAU); g.stroke();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + t * 0.4; g.fillStyle = i % 2 ? '#ffffff' : GOLD; starPath(g, Math.cos(a) * 96, -22 + Math.sin(a) * 16, 4, 1.8); g.fill(); }

  g.translate(sx, 0);
  g.rotate(sr);

  // body: rounded, slightly flared, glossy
  const bodyPath = () => {
    g.beginPath();
    g.moveTo(-62, -176);
    g.bezierCurveTo(-70, -120, -84, -70, -82, -38);
    g.quadraticCurveTo(-82, -28, -70, -28);
    g.lineTo(70, -28);
    g.quadraticCurveTo(82, -28, 82, -38);
    g.bezierCurveTo(84, -70, 70, -120, 62, -176);
    g.closePath();
  };
  const bg = g.createLinearGradient(-84, 0, 84, 0);
  bg.addColorStop(0, shade(T.body, 0.35)); bg.addColorStop(0.35, T.body); bg.addColorStop(1, T.deep);
  g.fillStyle = bg; bodyPath(); g.fill();
  g.save(); bodyPath(); g.clip();
  // pattern: sprinkles for flavors, little lightning bolts for weapons
  const r = rng(kind === 'flavor' ? 3 : 7);
  for (let i = 0; i < 26; i++) {
    const x = -80 + r() * 160, y = -175 + r() * 145;
    if (Math.abs(x) < 46 && y > -150 && y < -44) continue;
    if (kind === 'flavor') {
      g.strokeStyle = ['#ffffff', '#ffe066', '#9ff0d0', '#c9b8ff'][i % 4]; g.lineWidth = 3.4; g.lineCap = 'round';
      const a = r() * TAU; g.beginPath(); g.moveTo(x - Math.cos(a) * 4, y - Math.sin(a) * 4); g.lineTo(x + Math.cos(a) * 4, y + Math.sin(a) * 4); g.stroke();
    } else {
      g.fillStyle = i % 2 ? 'rgba(255,255,255,0.8)' : 'rgba(255,225,110,0.9)';
      g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x - 3, y + 1); g.lineTo(x + 1, y + 1); g.lineTo(x - 1, y + 7); g.lineTo(x + 4, y - 1); g.lineTo(x, y - 1); g.closePath(); g.fill();
    }
  }
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.beginPath(); g.roundRect(-70, -170, 14, 130, 7); g.fill();
  g.restore();
  g.strokeStyle = rgba(shade(T.deep, -0.4), 0.55); g.lineWidth = 2.5; bodyPath(); g.stroke();

  // front panel: coin slot, knob, chute
  const pg = g.createLinearGradient(0, -150, 0, -44);
  pg.addColorStop(0, '#ffffff'); pg.addColorStop(1, T.light);
  g.fillStyle = pg; g.beginPath(); g.roundRect(-46, -152, 92, 110, 18); g.fill();
  g.strokeStyle = GOLD; g.lineWidth = 3; g.stroke();
  // coin slot
  g.fillStyle = GOLD; g.beginPath(); g.roundRect(18, -142, 20, 26, 6); g.fill();
  g.fillStyle = '#5a3a20'; g.beginPath(); g.roundRect(26, -138, 4, 18, 2); g.fill();
  // knob
  const kx = -12, ky = -118, kr = 22;
  g.fillStyle = 'rgba(80,60,90,0.2)'; g.beginPath(); g.arc(kx + 2, ky + 3, kr, 0, TAU); g.fill();
  const kg = g.createRadialGradient(kx - 6, ky - 8, 2, kx, ky, kr);
  kg.addColorStop(0, '#ffffff'); kg.addColorStop(1, '#e6e0ea');
  g.fillStyle = kg; g.beginPath(); g.arc(kx, ky, kr, 0, TAU); g.fill();
  g.strokeStyle = GOLD; g.lineWidth = 3; g.stroke();
  g.save(); g.translate(kx, ky); g.rotate((st.knob || 0) + Math.sin(t * 1.3) * 0.05);
  g.fillStyle = T.body; g.beginPath(); g.roundRect(-kr * 0.8, -5, kr * 1.6, 10, 5); g.fill();
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(kr * 0.62, 0, 3, 0, TAU); g.fill();
  g.restore();
  // chute
  g.fillStyle = shade(T.deep, -0.35); g.beginPath(); g.roundRect(-30, -84, 60, 36, [16, 16, 8, 8]); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.roundRect(-26, -80, 52, 8, 4); g.fill();
  const drop = st.drop;
  if (drop == null) capsule(g, 8, -60, 12, T.caps[2], 0.4);

  // collar
  const cg = g.createLinearGradient(-66, 0, 66, 0);
  cg.addColorStop(0, '#fff1b0'); cg.addColorStop(0.5, GOLD); cg.addColorStop(1, GOLD_D);
  g.fillStyle = cg; g.beginPath(); g.roundRect(-68, -188, 136, 18, 9); g.fill();

  // globe: glass back, capsule heap, glass front with reflections
  const GX = 0, GY = -286, GR = 104;
  const glass = g.createRadialGradient(GX - 30, GY - 40, 10, GX, GY, GR);
  glass.addColorStop(0, '#ffffff'); glass.addColorStop(0.7, T.glass); glass.addColorStop(1, rgba(T.light, 0.95));
  g.fillStyle = glass; g.beginPath(); g.arc(GX, GY, GR, 0, TAU); g.fill();
  g.save(); g.beginPath(); g.arc(GX, GY, GR - 4, 0, TAU); g.clip();
  const cr = rng(kind === 'flavor' ? 11 : 13);
  const heap = [];
  for (let row = 0; row < 5; row++) {
    const n = 6 - (row % 2), y = GY + GR - 22 - row * 28;
    for (let i = 0; i < n; i++) {
      const x = GX - (n - 1) * 17 + i * 34 + (cr() - 0.5) * 8;
      if (Math.hypot(x - GX, y - GY) > GR - 14) continue;
      heap.push([x, y + (cr() - 0.5) * 6, 17 + cr() * 3, T.caps[(i + row * 2) % T.caps.length], (cr() - 0.5) * 1.4]);
    }
  }
  for (const [x, y, rr, c, rot] of heap) {
    const jig = Math.sin(t * 2 + x * 0.1) * 1.2 + Math.sin(t * 50 + x) * 3 * shake;
    capsule(g, x, y + jig, rr, c, rot + Math.sin(t * 40 + y) * 0.3 * shake);
  }
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 9;
  g.beginPath(); g.arc(GX, GY, GR, 0, TAU); g.stroke();
  g.strokeStyle = rgba(T.deep, 0.4); g.lineWidth = 2;
  g.beginPath(); g.arc(GX, GY, GR + 4.5, 0, TAU); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 10; g.lineCap = 'round';
  g.beginPath(); g.arc(GX, GY, GR - 20, Math.PI * 1.08, Math.PI * 1.42); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(GX - 48, GY - 66, 6, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(GX + 46, GY + 40, 10, 26, -0.5, 0, TAU); g.fill();

  // lid with a gold band and a topper
  const lg = g.createLinearGradient(-60, 0, 60, 0);
  lg.addColorStop(0, shade(T.body, 0.3)); lg.addColorStop(1, T.deep);
  g.fillStyle = lg;
  g.beginPath(); g.moveTo(-58, GY - GR + 22); g.bezierCurveTo(-58, GY - GR - 30, 58, GY - GR - 30, 58, GY - GR + 22); g.closePath(); g.fill();
  g.fillStyle = cg; g.beginPath(); g.roundRect(-62, GY - GR + 14, 124, 12, 6); g.fill();
  const ty = GY - GR - 26;
  if (T.topper === 'cherry') {
    const ch = g.createRadialGradient(-5, ty - 6, 2, 0, ty, 17);
    ch.addColorStop(0, '#ff9aaf'); ch.addColorStop(0.6, '#ec3a5a'); ch.addColorStop(1, '#b51f3c');
    g.fillStyle = ch; g.beginPath(); g.arc(0, ty, 16, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.ellipse(-5, ty - 6, 5, 3, -0.5, 0, TAU); g.fill();
    g.strokeStyle = '#5a8a3a'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(2, ty - 14); g.quadraticCurveTo(6, ty - 30, 16, ty - 34); g.stroke();
    g.fillStyle = '#7ec850'; g.beginPath(); g.ellipse(20, ty - 33, 8, 4, -0.4, 0, TAU); g.fill();
  } else {
    g.save(); g.translate(0, ty); g.rotate(Math.sin(t * 1.5) * 0.15);
    const sg = g.createRadialGradient(-4, -4, 1, 0, 0, 20);
    sg.addColorStop(0, '#fff8d0'); sg.addColorStop(1, GOLD);
    g.fillStyle = sg; starPath(g, 0, 0, 20, 9); g.fill();
    g.strokeStyle = GOLD_D; g.lineWidth = 2; g.stroke();
    g.restore();
  }
  g.restore();

  // marquee sign above, with chasing bulbs
  drawSign(g, 0, GY - GR - 78, T, t);

  // a capsule rolling out (menus only)
  if (drop != null) {
    const k = clamp(drop, 0, 1);
    const fall = k < 0.45 ? k / 0.45 : 1;
    const y = -64 + fall * fall * 66;
    const bounce = k > 0.45 ? Math.abs(Math.sin((k - 0.45) * 14)) * (1 - k) * 28 : 0;
    capsule(g, sx + (k > 0.45 ? (k - 0.45) * 90 : 0), y - bounce, 15, st.dropColor || T.caps[0], k * 9);
  }
}

function drawSign(g, x, y, T, t) {
  const w = 196, h = 56;
  g.save();
  g.translate(x, y);
  g.fillStyle = 'rgba(90,60,110,0.2)'; g.beginPath(); g.roundRect(-w / 2 + 4, -h / 2 + 6, w, h, 28); g.fill();
  const sg = g.createLinearGradient(0, -h / 2, 0, h / 2);
  sg.addColorStop(0, '#ffffff'); sg.addColorStop(1, T.light);
  g.fillStyle = sg; g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, 28); g.fill();
  g.strokeStyle = T.body; g.lineWidth = 5; g.stroke();
  // bulbs around the edge light up in a chasing pattern
  const n = 22;
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const per = 2 * (w - h) + Math.PI * h;
    let d = u * per, bx, by;
    const half = (w - h) / 2;
    if (d < w - h) { bx = -half + d; by = -h / 2; }
    else if ((d -= w - h) < Math.PI * h / 2) { const a = -Math.PI / 2 + d / (h / 2); bx = half + Math.cos(a) * h / 2; by = Math.sin(a) * h / 2; }
    else if ((d -= Math.PI * h / 2) < w - h) { bx = half - d; by = h / 2; }
    else { d -= w - h; const a = Math.PI / 2 + d / (h / 2); bx = -half + Math.cos(a) * h / 2; by = Math.sin(a) * h / 2; }
    const on = (Math.floor(t * 8) + i) % 3 === 0;
    if (on) { g.fillStyle = 'rgba(255,240,150,0.55)'; g.beginPath(); g.arc(bx, by, 7, 0, TAU); g.fill(); }
    g.fillStyle = on ? '#fff6b0' : '#ffd6e4';
    g.beginPath(); g.arc(bx, by, 3.6, 0, TAU); g.fill();
  }
  g.textAlign = 'center';
  g.fillStyle = T.deep; g.font = '25px Jua, sans-serif';
  g.fillText(T.sign, 0, 6);
  g.font = '11px "Titan One", Jua, sans-serif'; g.fillStyle = rgba(T.deep, 0.75);
  g.fillText(T.sub, 0, 21);
  g.restore();
}

// ── play-zone gate ───────────────────────────────────────────
const PILLAR = [['#ffb3c9', '#ff8fb0'], ['#b4f3dc', '#8fe0c4'], ['#fff1c4', '#f2d58a'], ['#d6c2ff', '#b69cff']];

function scoopBall(g, x, y, r, c, d) {
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.1);
  gr.addColorStop(0, shade(c, 0.45)); gr.addColorStop(0.65, c); gr.addColorStop(1, d);
  g.fillStyle = gr;
  g.beginPath(); g.arc(x, y - r * 0.15, r, Math.PI, 0);
  for (let k = 0; k <= 5; k++) { const xx = x + r - (2 * r * k) / 5; g.quadraticCurveTo(xx + r / 5, y + r * 0.55, xx, y + r * 0.3); }
  g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(x - r * 0.4, y - r * 0.55, r * 0.26, r * 0.13, -0.6, 0, TAU); g.fill();
}

function pillar(g, x, t, seed) {
  // waffle base, candy column, scoops stacked on top
  g.fillStyle = 'rgba(90,60,110,0.18)'; g.beginPath(); g.ellipse(x + 4, 4, 34, 9, 0, 0, TAU); g.fill();
  const wb = g.createLinearGradient(x - 30, 0, x + 30, 0);
  wb.addColorStop(0, '#f6c97e'); wb.addColorStop(1, '#d59448');
  g.fillStyle = wb; g.beginPath(); g.moveTo(x - 30, 0); g.lineTo(x - 22, -46); g.lineTo(x + 22, -46); g.lineTo(x + 30, 0); g.closePath(); g.fill();
  g.save(); g.clip();
  g.strokeStyle = 'rgba(150,90,40,0.5)'; g.lineWidth = 1.6;
  for (let i = -6; i < 7; i++) { g.beginPath(); g.moveTo(x + i * 9, -50); g.lineTo(x + i * 9 + 40, 4); g.stroke(); g.beginPath(); g.moveTo(x + i * 9, -50); g.lineTo(x + i * 9 - 40, 4); g.stroke(); }
  g.restore();
  const cg = g.createLinearGradient(x - 14, 0, x + 14, 0);
  cg.addColorStop(0, '#ffffff'); cg.addColorStop(1, '#ead8e2');
  g.fillStyle = cg; g.beginPath(); g.roundRect(x - 14, -230, 28, 186, 10); g.fill();
  g.save(); g.beginPath(); g.roundRect(x - 14, -230, 28, 186, 10); g.clip();
  g.strokeStyle = '#ff8fb4'; g.lineWidth = 9;
  for (let y = -250; y < -30; y += 26) { g.beginPath(); g.moveTo(x - 20, y + 14); g.lineTo(x + 20, y); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x - 9, -228, 4, 182);
  g.restore();
  for (let k = 0; k < 3; k++) {
    const [c, d] = PILLAR[(seed + k) % PILLAR.length];
    const bob = Math.sin(t * 2.2 + seed + k * 0.9) * 1.5;
    scoopBall(g, x, -246 - k * 30 + bob, 26 - k * 3, c, d);
  }
}

export function drawGate(g, t) {
  g.save();
  // dais with a turning ring of glowing runes
  g.fillStyle = 'rgba(90,60,110,0.18)'; g.beginPath(); g.ellipse(6, 8, 172, 34, 0, 0, TAU); g.fill();
  g.fillStyle = '#e6dcff'; g.beginPath(); g.ellipse(0, -2, 166, 32, 0, 0, TAU); g.fill();
  g.fillRect(-166, -14, 332, 12);
  const dg = g.createLinearGradient(-160, 0, 160, 0);
  dg.addColorStop(0, '#ffffff'); dg.addColorStop(1, '#efe6ff');
  g.fillStyle = dg; g.beginPath(); g.ellipse(0, -14, 166, 32, 0, 0, TAU); g.fill();
  g.fillStyle = '#ffd6e8'; g.beginPath(); g.ellipse(0, -16, 128, 24, 0, 0, TAU); g.fill();
  g.save();
  g.translate(0, -16); g.scale(1, 24 / 128);
  g.strokeStyle = `rgba(190,140,255,${0.6 + Math.sin(t * 3) * 0.25})`; g.lineWidth = 10;
  g.setLineDash([26, 14]); g.lineDashOffset = -t * 60;
  g.beginPath(); g.arc(0, 0, 112, 0, TAU); g.stroke();
  g.setLineDash([]);
  g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 4;
  g.beginPath(); g.arc(0, 0, 96, 0, TAU); g.stroke();
  g.restore();

  // the portal itself: a soft vortex inside the arch
  // fills the whole arch: straight sides up to the arch centre, then the arch's own curve
  const PW = 106, PY = -266, PH = 140, VC = -200;
  const portal = () => { g.beginPath(); g.moveTo(-PW, -24); g.lineTo(-PW, PY); g.arc(0, PY, PW, Math.PI, 0); g.lineTo(PW, -24); g.ellipse(0, -24, PW, 16, 0, 0, Math.PI); g.closePath(); };
  g.save();
  portal(); g.clip();
  const vg = g.createRadialGradient(0, VC, 4, 0, VC, 190);
  vg.addColorStop(0, '#ffffff'); vg.addColorStop(0.18, '#ffe3f4'); vg.addColorStop(0.5, '#c9b2ff'); vg.addColorStop(0.8, '#8fd8ff'); vg.addColorStop(1, '#7ff0d0');
  g.fillStyle = vg; g.fillRect(-PW - 10, PY - PW - 10, PW * 2 + 20, PH * 2 + 120);
  for (let arm = 0; arm < 6; arm++) {
    g.strokeStyle = ['rgba(255,255,255,0.6)', 'rgba(255,190,230,0.55)', 'rgba(170,240,255,0.55)'][arm % 3];
    g.lineWidth = 7 - (arm % 3) * 2;
    g.beginPath();
    for (let k = 0; k < 50; k++) { const a = k * 0.2 + t * 1.8 + arm * (TAU / 6), r = k * 3.3; g.lineTo(Math.cos(a) * r, VC + Math.sin(a) * r * 1.25); }
    g.stroke();
  }
  // stars drifting into the centre
  for (let i = 0; i < 16; i++) {
    const k = (t * 0.35 + i / 16) % 1;
    const a = i * 2.4 + t * 0.6;
    const r = (1 - k) * 140;
    const s = 2 + (1 - k) * 4;
    g.fillStyle = `rgba(255,255,255,${Math.sin(k * Math.PI)})`;
    starPath(g, Math.cos(a) * r, VC + Math.sin(a) * r * 1.25, s, s * 0.4, 4); g.fill();
  }
  const pulse = 0.5 + Math.sin(t * 2.5) * 0.5;
  const glow = g.createRadialGradient(0, VC, 0, 0, VC, 70);
  glow.addColorStop(0, `rgba(255,255,255,${0.7 + pulse * 0.3})`); glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow; g.fillRect(-90, VC - 80, 180, 160);
  g.restore();

  // pillars and the whipped-cream arch with drips, sprinkles and bulbs
  pillar(g, -122, t, 0);
  pillar(g, 122, t, 2);
  const AY = -330; // arch centre is AY + 64 = PY
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(200,140,180,0.45)'; g.lineWidth = 42;
  g.beginPath(); g.arc(0, AY + 64 + 4, 122, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
  g.strokeStyle = '#ffffff'; g.lineWidth = 38;
  g.beginPath(); g.arc(0, AY + 64, 122, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
  // drips under the arch
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 11; i++) {
    const a = Math.PI * 1.1 + (i / 10) * Math.PI * 0.8;
    const x = Math.cos(a) * 122 * 0.9, y = AY + 64 + Math.sin(a) * 122 * 0.9;
    const len = 8 + ((i * 7) % 5) * 4 + Math.sin(t * 1.5 + i) * 2;
    g.beginPath(); g.roundRect(x - 5, y, 10, len, 5); g.fill();
  }
  const sr = rng(5);
  for (let i = 0; i < 26; i++) {
    const a = Math.PI * 1.07 + sr() * Math.PI * 0.86, rr = 122 + (sr() - 0.5) * 26;
    const x = Math.cos(a) * rr, y = AY + 64 + Math.sin(a) * rr, ra = sr() * TAU;
    g.strokeStyle = ['#ff7aa2', '#ffd35a', '#7fc4ff', '#8fe0c0', '#b69cff'][i % 5]; g.lineWidth = 3.4;
    g.beginPath(); g.moveTo(x - Math.cos(ra) * 4, y - Math.sin(ra) * 4); g.lineTo(x + Math.cos(ra) * 4, y + Math.sin(ra) * 4); g.stroke();
  }
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * 1.1 + (i / 8) * Math.PI * 0.8;
    const x = Math.cos(a) * 140, y = AY + 64 + Math.sin(a) * 140;
    const on = (Math.floor(t * 6) + i) % 2 === 0;
    if (on) { g.fillStyle = 'rgba(255,240,150,0.5)'; g.beginPath(); g.arc(x, y, 8, 0, TAU); g.fill(); }
    g.fillStyle = on ? '#fff6b0' : '#ffe0ec'; g.beginPath(); g.arc(x, y, 4, 0, TAU); g.fill();
  }
  // badge with a star and a ribbon banner
  const by = AY - 62 + Math.sin(t * 2) * 3;
  const bg = g.createRadialGradient(-10, by - 10, 4, 0, by, 40);
  bg.addColorStop(0, '#fff6c8'); bg.addColorStop(1, GOLD);
  g.fillStyle = GOLD_D; g.beginPath(); g.arc(0, by + 3, 38, 0, TAU); g.fill();
  g.fillStyle = bg; g.beginPath(); g.arc(0, by, 38, 0, TAU); g.fill();
  g.fillStyle = '#ff7aa2'; starPath(g, 0, by, 22, 10); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(-12, by - 16, 9, 4, -0.5, 0, TAU); g.fill();
  const ry = AY - 8;
  for (const s of [-1, 1]) {
    g.fillStyle = '#e0507f';
    g.beginPath(); g.moveTo(s * 92, ry - 4); g.lineTo(s * 126, ry - 8); g.lineTo(s * 114, ry + 10); g.lineTo(s * 128, ry + 26); g.lineTo(s * 92, ry + 22); g.closePath(); g.fill();
  }
  const rg = g.createLinearGradient(0, ry - 16, 0, ry + 18);
  rg.addColorStop(0, '#ff9cbc'); rg.addColorStop(1, '#ff6f99');
  g.fillStyle = rg;
  g.beginPath(); g.moveTo(-100, ry - 14); g.quadraticCurveTo(0, ry - 28, 100, ry - 14); g.lineTo(100, ry + 16); g.quadraticCurveTo(0, ry + 2, -100, ry + 16); g.closePath(); g.fill();
  g.fillStyle = '#ffffff'; g.font = '20px "Titan One", Jua, sans-serif'; g.textAlign = 'center';
  g.fillText('PLAY ZONE', 0, ry + 8);
  // sparkles circling the gate
  for (let i = 0; i < 8; i++) {
    const a = t * 0.9 + i * (TAU / 8);
    const x = Math.cos(a) * 190, y = -190 + Math.sin(a) * 160;
    const s = 4 + Math.sin(t * 4 + i) * 2;
    g.fillStyle = ['#fff1a6', '#ffd6f0', '#c9f4ff'][i % 3];
    starPath(g, x, y, s, s * 0.4, 4); g.fill();
  }
  g.restore();
}
