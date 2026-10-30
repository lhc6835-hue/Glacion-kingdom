// Mold sprites. Each mold bakes a `back` sprite (drawn before the scoops) and optionally a `front`
// sprite (drawn after, for cups and bowls the scoop sinks into). `seat` is the first scoop's centre.
import { makeSprite, atop } from './sprite.js';
import { shade, rgba, TAU, rng } from '../core/math.js';
import { R } from './scoopArt.js';

const OUT = 1.15;
const cache = new Map();

export function moldArt(id) {
  let m = cache.get(id);
  if (!m) { m = (BUILDERS[id] || BUILDERS.papercup)(); cache.set(id, m); }
  return m;
}

const oc = (c) => rgba(shade(c, -0.62), 0.75);

// ── generic cone ────────────────────────────────────────────
function cone({ c, L = 62, W = 48, pat = 'grid', rim = true, dip, salt, gold }) {
  const back = makeSprite(W + 10, L + 12, W / 2 + 5, L + 8, (g) => {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(-W / 2, -L);
    g.lineTo(W / 2, -L);
    g.quadraticCurveTo(W * 0.3, -L * 0.45, W * 0.07, -L * 0.05);
    g.quadraticCurveTo(0, L * 0.03, -W * 0.07, -L * 0.05);
    g.quadraticCurveTo(-W * 0.3, -L * 0.45, -W / 2, -L);
    g.fill();
    atop(g, (g) => {
      const line = shade(c, -0.32);
      g.strokeStyle = line;
      g.lineWidth = 1.5;
      if (pat === 'grid') {
        for (let i = -8; i < 8; i++) {
          g.beginPath(); g.moveTo(i * 9, -L); g.lineTo(i * 9 + L * 0.7, 0); g.stroke();
          g.beginPath(); g.moveTo(i * 9, -L); g.lineTo(i * 9 - L * 0.7, 0); g.stroke();
        }
      } else if (pat === 'ridge') {
        for (let y = -L + 8; y < 0; y += 7) { g.beginPath(); g.moveTo(-W, y); g.quadraticCurveTo(0, y + 3, W, y); g.stroke(); }
      } else if (pat === 'twist') {
        g.lineWidth = 4.5; g.strokeStyle = shade(c, -0.22);
        for (let i = -6; i < 6; i++) { g.beginPath(); g.moveTo(i * 12, -L); g.bezierCurveTo(i * 12 + 10, -L * 0.6, i * 12 + 18, -L * 0.3, i * 12 + 24, 0); g.stroke(); }
        g.strokeStyle = rgba(shade(c, 0.4), 0.5); g.lineWidth = 1.4;
        for (let i = -6; i < 6; i++) { g.beginPath(); g.moveTo(i * 12 - 2, -L); g.bezierCurveTo(i * 12 + 8, -L * 0.6, i * 12 + 16, -L * 0.3, i * 12 + 22, 0); g.stroke(); }
      } else if (pat === 'fold') {
        g.strokeStyle = rgba(shade(c, -0.25), 0.8); g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(-W * 0.42, -L * 0.9); g.quadraticCurveTo(-W * 0.05, -L * 0.5, W * 0.05, -L * 0.08); g.stroke();
        g.beginPath(); g.moveTo(W * 0.1, -L); g.quadraticCurveTo(W * 0.25, -L * 0.6, W * 0.06, -L * 0.15); g.stroke();
        const r2 = rng(7);
        for (let i = 0; i < 14; i++) { g.fillStyle = rgba(shade(c, -0.4), 0.5); g.beginPath(); g.arc((r2() - 0.5) * W * 0.8, -r2() * L * 0.9, 1 + r2() * 1.6, 0, TAU); g.fill(); }
      }
      if (dip) {
        g.fillStyle = dip;
        g.beginPath();
        g.moveTo(-W, -L - 2);
        g.lineTo(W, -L - 2);
        g.lineTo(W, -L * 0.62);
        const n = 6;
        for (let i = 0; i < n; i++) {
          const x0 = W / 2 - (W / n) * i, x1 = W / 2 - (W / n) * (i + 1);
          const d = i % 2 ? 6 : 12;
          g.quadraticCurveTo((x0 + x1) / 2, -L * 0.62 + d, x1, -L * 0.62);
        }
        g.lineTo(-W, -L * 0.62); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.28)';
        g.beginPath(); g.ellipse(-W * 0.2, -L * 0.85, W * 0.16, 2.5, -0.1, 0, TAU); g.fill();
      }
      if (salt) {
        const r2 = rng(3);
        for (let i = 0; i < 18; i++) { g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect((r2() - 0.5) * W, -r2() * L, 1.8, 1.8); }
      }
      // round shading across the cone
      const gr = g.createLinearGradient(-W / 2, 0, W / 2, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0.32)');
      gr.addColorStop(0.45, 'rgba(255,255,255,0)');
      gr.addColorStop(1, rgba(shade(c, -0.5), 0.45));
      g.fillStyle = gr;
      g.fillRect(-W, -L - 4, W * 2, L + 8);
      if (rim) {
        g.fillStyle = gold ? '#f6cf7a' : shade(c, 0.12);
        g.fillRect(-W, -L - 2, W * 2, 8);
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.fillRect(-W, -L - 2, W * 2, 2);
      }
      if (gold) {
        g.strokeStyle = 'rgba(255,240,190,0.9)'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(-W * 0.3, -L * 0.7); g.lineTo(-W * 0.22, -L * 0.6); g.stroke();
      }
    });
  }, { outline: OUT, outlineColor: oc(c) });
  return { back, seat: -L - R * 0.28, height: L };
}

// ── cup / tub ──────────────────────────────────────────────
function cup({ c, h = 30, tw = 50, bw = 36, stripes, ridge, handle, spoon, lip }) {
  const lipC = lip || shade(c, -0.08);
  const back = makeSprite(tw + 40, h + 30, tw / 2 + 20, h + 26, (g) => {
    if (spoon) {
      g.fillStyle = '#ff9ec2';
      g.save(); g.translate(tw * 0.18, -h - 8); g.rotate(0.45);
      g.fillRect(-2.2, -26, 4.4, 26);
      g.beginPath(); g.ellipse(0, -30, 6, 8, 0, 0, TAU); g.fill();
      g.restore();
    }
    g.fillStyle = shade(c, -0.45);
    g.beginPath(); g.ellipse(0, -h, tw / 2, 6, 0, 0, TAU); g.fill();
  }, { outline: OUT, outlineColor: oc(c) });
  const front = makeSprite(tw + 30, h + 14, tw / 2 + 15, h + 8, (g) => {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(-tw / 2, -h);
    g.quadraticCurveTo(0, -h + 6, tw / 2, -h);
    g.lineTo(bw / 2, -3);
    g.quadraticCurveTo(bw / 2, 0, bw / 2 - 4, 0);
    g.lineTo(-bw / 2 + 4, 0);
    g.quadraticCurveTo(-bw / 2, 0, -bw / 2, -3);
    g.closePath();
    g.fill();
    if (handle) {
      g.strokeStyle = c; g.lineWidth = 4.5;
      g.beginPath(); g.ellipse(tw / 2 + 2, -h * 0.55, 6, 7.5, 0, -1.4, 1.4); g.stroke();
    }
    atop(g, (g) => {
      if (stripes) {
        for (let i = -3; i <= 3; i++) {
          g.fillStyle = stripes[Math.abs(i) % stripes.length];
          g.beginPath();
          const t0 = i / 7, t1 = (i + 0.5) / 7;
          g.moveTo(t0 * tw, -h - 2); g.lineTo(t1 * tw, -h - 2); g.lineTo(t1 * bw, 2); g.lineTo(t0 * bw, 2);
          g.fill();
        }
      }
      if (ridge) {
        g.strokeStyle = shade(c, -0.25); g.lineWidth = 1.6;
        for (let i = -4; i <= 4; i++) { g.beginPath(); g.moveTo((i / 9) * tw, -h); g.lineTo((i / 9) * bw, 0); g.stroke(); }
      }
      const gr = g.createLinearGradient(-tw / 2, 0, tw / 2, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0.35)');
      gr.addColorStop(0.4, 'rgba(255,255,255,0)');
      gr.addColorStop(1, rgba(shade(c, -0.5), 0.4));
      g.fillStyle = gr; g.fillRect(-tw, -h - 10, tw * 2, h + 20);
    });
    // lip of the cup in front of the scoop
    g.fillStyle = lipC;
    g.beginPath(); g.ellipse(0, -h, tw / 2 + 1.5, 3.6, 0, 0, Math.PI); g.lineTo(-tw / 2 - 1.5, -h - 1); g.ellipse(0, -h - 1, tw / 2 + 1.5, 2.4, 0, Math.PI, 0, true); g.fill();
  }, { outline: OUT, outlineColor: oc(c) });
  return { back, front, seat: -h - R * 0.05, height: h };
}

// ── bowl / glass (optionally on a stem, optionally transparent) ─────────
function bowl({ c, h = 24, w = 60, stem, glass, pat, rimC, ice, tall }) {
  const sh = stem ? stem.h : 0;
  const total = h + sh;
  const back = makeSprite(w + 20, total + 26, w / 2 + 10, total + 20, (g) => {
    if (ice) {
      g.fillStyle = '#f4fbff';
      g.beginPath(); g.ellipse(0, -total - 2, w * 0.46, 9, 0, 0, TAU); g.fill();
    }
    g.fillStyle = glass ? 'rgba(210,240,255,0.55)' : shade(c, -0.4);
    g.beginPath(); g.ellipse(0, -total, w / 2, 5.5, 0, 0, TAU); g.fill();
  }, { outline: OUT, outlineColor: glass ? 'rgba(90,140,170,0.6)' : oc(c) });
  const front = makeSprite(w + 20, total + 12, w / 2 + 10, total + 6, (g) => {
    g.fillStyle = glass ? 'rgba(220,245,255,0.42)' : c;
    g.beginPath();
    g.moveTo(-w / 2, -total);
    if (tall) {
      g.lineTo(-w * 0.42, -sh - h * 0.25);
      g.quadraticCurveTo(-w * 0.3, -sh, 0, -sh);
      g.quadraticCurveTo(w * 0.3, -sh, w * 0.42, -sh - h * 0.25);
      g.lineTo(w / 2, -total);
    } else {
      g.bezierCurveTo(-w / 2, -sh - h * 0.2, -w * 0.25, -sh, 0, -sh);
      g.bezierCurveTo(w * 0.25, -sh, w / 2, -sh - h * 0.2, w / 2, -total);
    }
    g.quadraticCurveTo(0, -total + 6, -w / 2, -total);
    g.fill();
    if (stem) {
      g.fillStyle = glass ? 'rgba(220,245,255,0.6)' : c;
      g.fillRect(-stem.w / 2, -sh - 1, stem.w, sh - 2);
      g.beginPath(); g.ellipse(0, -2.5, stem.base || 15, 3.6, 0, 0, TAU); g.fill();
    }
    atop(g, (g) => {
      if (pat === 'grid') {
        g.strokeStyle = shade(c, -0.3); g.lineWidth = 1.4;
        for (let i = -8; i < 8; i++) {
          g.beginPath(); g.moveTo(i * 9, -total); g.lineTo(i * 9 + h, -sh); g.stroke();
          g.beginPath(); g.moveTo(i * 9, -total); g.lineTo(i * 9 - h, -sh); g.stroke();
        }
      }
      if (glass) {
        g.fillStyle = 'rgba(255,255,255,0.75)';
        g.beginPath(); g.ellipse(-w * 0.3, -sh - h * 0.55, 2.4, h * 0.28, 0.25, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.4)';
        g.beginPath(); g.ellipse(w * 0.28, -sh - h * 0.4, 1.5, h * 0.18, -0.25, 0, TAU); g.fill();
        if (stem) { g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(-stem.w / 2 + 0.6, -sh, 1.2, sh - 3); }
      } else {
        const gr = g.createLinearGradient(-w / 2, 0, w / 2, 0);
        gr.addColorStop(0, 'rgba(255,255,255,0.35)');
        gr.addColorStop(0.45, 'rgba(255,255,255,0)');
        gr.addColorStop(1, rgba(shade(c, -0.5), 0.4));
        g.fillStyle = gr; g.fillRect(-w, -total - 6, w * 2, total + 12);
      }
    });
    g.fillStyle = rimC || (glass ? 'rgba(255,255,255,0.8)' : shade(c, 0.15));
    g.beginPath(); g.ellipse(0, -total, w / 2 + 1, 3, 0, 0, Math.PI); g.lineTo(-w / 2 - 1, -total - 0.6); g.ellipse(0, -total - 0.6, w / 2 + 1, 2, 0, Math.PI, 0, true); g.fill();
  }, { outline: OUT, outlineColor: glass ? 'rgba(90,140,170,0.6)' : oc(c) });
  return { back, front, seat: -total - R * 0.12, height: total, glass };
}

// ── special shapes ──────────────────────────────────────────
function stick() {
  const c = '#e9c79a';
  const back = makeSprite(20, 46, 10, 42, (g) => {
    g.fillStyle = c;
    g.beginPath(); g.roundRect(-4.5, -38, 9, 38, 4.5); g.fill();
    atop(g, (g) => {
      g.strokeStyle = rgba('#b88a55', 0.6); g.lineWidth = 0.8;
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-2 + i * 1.4, -36); g.quadraticCurveTo(-1 + i * 1.4, -18, -2.4 + i * 1.4, -1); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(-4, -38, 2, 38);
    });
  }, { outline: OUT, outlineColor: oc(c) });
  return { back, seat: -38 - R * 0.55, height: 38 };
}

function fish() {
  const c = '#e0a55a';
  const back = makeSprite(70, 82, 35, 76, (g) => {
    g.fillStyle = c;
    g.beginPath();
    // tail fan at the bottom, body widening up to an open mouth
    g.moveTo(-12, -6); g.quadraticCurveTo(-18, 2, -8, 1); g.quadraticCurveTo(0, -4, 8, 1); g.quadraticCurveTo(18, 2, 12, -6);
    g.quadraticCurveTo(6, -12, 8, -18);
    g.bezierCurveTo(28, -30, 30, -56, 24, -66);
    g.lineTo(-24, -66);
    g.bezierCurveTo(-30, -56, -28, -30, -8, -18);
    g.quadraticCurveTo(-6, -12, -12, -6);
    g.fill();
    atop(g, (g) => {
      g.strokeStyle = shade(c, -0.3); g.lineWidth = 1.3;
      for (let row = 0; row < 3; row++) for (let i = -2; i <= 2; i++) {
        g.beginPath(); g.arc(i * 8 + (row % 2) * 4, -26 - row * 9, 4.5, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke();
      }
      g.fillStyle = '#3a2418'; g.beginPath(); g.arc(-12, -56, 2.6, 0, TAU); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(-12.8, -56.8, 0.8, 0, TAU); g.fill();
      g.strokeStyle = shade(c, -0.35); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(6, -14); g.quadraticCurveTo(16, -12, 18, -22); g.stroke();
      const gr = g.createLinearGradient(-30, 0, 30, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0.3)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, rgba(shade(c, -0.5), 0.4));
      g.fillStyle = gr; g.fillRect(-40, -80, 80, 90);
      g.fillStyle = '#7a3b2a'; g.fillRect(-30, -68, 60, 5);
    });
  }, { outline: OUT, outlineColor: oc(c) });
  return { back, seat: -66 - R * 0.25, height: 66 };
}

function macaron() {
  const c = '#ffb3cf';
  const back = makeSprite(76, 44, 38, 40, (g) => {
    g.fillStyle = c;
    g.beginPath(); g.ellipse(0, -10, 32, 10, 0, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(0, -18, 30, 5, 0, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(0, -28, 30, 9, 0, 0, TAU); g.fill();
    atop(g, (g) => {
      g.fillStyle = '#fff4ea'; g.fillRect(-40, -22, 80, 7);
      g.fillStyle = shade(c, -0.18);
      for (let i = -6; i <= 6; i++) { g.beginPath(); g.arc(i * 5, -15 + (i % 2), 2.2, 0, TAU); g.fill(); g.beginPath(); g.arc(i * 5, -24 + (i % 2), 2, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,0.45)';
      g.beginPath(); g.ellipse(-10, -31, 12, 3, -0.1, 0, TAU); g.fill();
      g.fillStyle = rgba(shade(c, -0.5), 0.3); g.fillRect(-40, -8, 80, 10);
    });
  }, { outline: OUT, outlineColor: oc(c) });
  return { back, seat: -34 - R * 0.35, height: 34 };
}

function mochi() {
  const c = '#fbf6f0';
  const back = makeSprite(76, 40, 38, 36, (g) => {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(-32, -4);
    g.bezierCurveTo(-38, -20, -24, -32, 0, -32);
    g.bezierCurveTo(24, -32, 38, -20, 32, -4);
    g.quadraticCurveTo(0, 4, -32, -4);
    g.fill();
    atop(g, (g) => {
      const r2 = rng(11);
      for (let i = 0; i < 50; i++) { g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect((r2() - 0.5) * 60, -r2() * 30, 1, 1); }
      const gr = g.createRadialGradient(-10, -26, 2, 0, -14, 40);
      gr.addColorStop(0, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(200,170,160,0.45)');
      g.fillStyle = gr; g.fillRect(-40, -40, 80, 44);
      g.fillStyle = 'rgba(255,170,190,0.4)'; g.beginPath(); g.ellipse(18, -10, 6, 3, 0, 0, TAU); g.fill();
    });
  }, { outline: OUT, outlineColor: 'rgba(150,110,110,0.55)' });
  return { back, seat: -28 - R * 0.45, height: 28 };
}

function cloud() {
  const back = makeSprite(90, 46, 45, 40, (g) => {
    g.fillStyle = '#f6fbff';
    for (const [x, y, r] of [[-26, -12, 12], [-12, -20, 15], [6, -22, 16], [24, -14, 13], [0, -10, 16], [-34, -6, 8], [34, -7, 8]]) {
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    atop(g, (g) => {
      const gr = g.createLinearGradient(0, -38, 0, 4);
      gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(160,190,235,0.6)');
      g.fillStyle = gr; g.fillRect(-50, -40, 100, 46);
    });
  }, { outline: OUT, outlineColor: 'rgba(110,140,190,0.5)' });
  return { back, seat: -26 - R * 0.55, height: 26, floaty: true };
}

function cake() {
  const c = '#fff1e4';
  const back = makeSprite(80, 56, 40, 50, (g) => {
    g.fillStyle = c;
    g.beginPath(); g.ellipse(0, -40, 32, 8, 0, 0, TAU); g.fill();
    g.fillRect(-32, -40, 64, 37);
    g.beginPath(); g.ellipse(0, -3, 32, 8, 0, 0, Math.PI); g.fill();
    atop(g, (g) => {
      g.fillStyle = '#ff9ab8'; g.fillRect(-40, -26, 80, 7);
      g.fillStyle = '#8a5a3c'; g.fillRect(-40, -13, 80, 4);
      g.fillStyle = '#ffd1df';
      g.beginPath(); g.moveTo(-34, -40);
      for (let i = 0; i <= 8; i++) { const x = -32 + i * 8; g.quadraticCurveTo(x - 4, -32 - (i % 2) * 5, x, -38); }
      g.lineTo(34, -48); g.lineTo(-34, -48); g.fill();
      const gr = g.createLinearGradient(-32, 0, 32, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(160,110,100,0.35)');
      g.fillStyle = gr; g.fillRect(-40, -50, 80, 56);
      for (let i = 0; i < 6; i++) { g.fillStyle = ['#ff7aa2', '#7ad1ff', '#ffe27a'][i % 3]; g.fillRect(-26 + i * 10, -36 + (i % 2) * 2, 2.5, 4); }
    });
  }, { outline: OUT, outlineColor: oc('#e8b9a8') });
  return { back, seat: -44 - R * 0.25, height: 44 };
}

function pouch() {
  const c = '#cdd6e6';
  const back = makeSprite(64, 62, 32, 58, (g) => {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(-24, -50);
    for (let i = 0; i <= 8; i++) g.lineTo(-24 + i * 6, -50 - (i % 2 ? 4 : 0));
    g.lineTo(22, -4); g.quadraticCurveTo(0, 2, -22, -4); g.closePath();
    g.fill();
    atop(g, (g) => {
      const gr = g.createLinearGradient(-26, 0, 26, 0);
      gr.addColorStop(0, '#f4f8ff'); gr.addColorStop(0.3, '#aab6cc'); gr.addColorStop(0.55, '#eef3ff'); gr.addColorStop(1, '#8592ab');
      g.fillStyle = gr; g.fillRect(-30, -60, 60, 64);
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 0.8;
      for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-20 + i * 7, -44); g.lineTo(-16 + i * 7, -30); g.lineTo(-21 + i * 7, -14); g.stroke(); }
      g.fillStyle = '#1e2a5c'; g.beginPath(); g.roundRect(-14, -36, 28, 18, 4); g.fill();
      g.fillStyle = '#ffe27a';
      g.beginPath(); for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU - Math.PI / 2, r = k % 2 ? 2.6 : 6; g.lineTo(Math.cos(a) * r, -27 + Math.sin(a) * r); } g.fill();
    });
  }, { outline: OUT, outlineColor: 'rgba(60,70,100,0.6)' });
  return { back, seat: -50 - R * 0.2, height: 50 };
}

function boat() {
  const back = makeSprite(100, 40, 50, 34, (g) => {
    g.fillStyle = '#ffe27a';
    g.beginPath(); g.moveTo(-46, -22); g.quadraticCurveTo(-40, -2, 0, -6); g.quadraticCurveTo(40, -2, 46, -22); g.quadraticCurveTo(30, -12, 0, -14); g.quadraticCurveTo(-30, -12, -46, -22); g.fill();
    g.fillStyle = '#e9f6ff';
    g.beginPath(); g.moveTo(-36, -16); g.quadraticCurveTo(-30, 2, 0, 2); g.quadraticCurveTo(30, 2, 36, -16); g.quadraticCurveTo(0, -8, -36, -16); g.fill();
    atop(g, (g) => {
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(-14, -4, 12, 2, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(200,160,60,0.6)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(-44, -20); g.quadraticCurveTo(-30, -9, -10, -12); g.stroke();
      g.beginPath(); g.moveTo(44, -20); g.quadraticCurveTo(30, -9, 10, -12); g.stroke();
      g.fillStyle = '#d33b5c'; g.beginPath(); g.arc(30, -24, 4, 0, TAU); g.fill();
    });
  }, { outline: OUT, outlineColor: 'rgba(120,110,80,0.6)' });
  return { back, seat: -12 - R * 0.55, height: 14 };
}

const BUILDERS = {
  papercup: () => cup({ c: '#ffffff', h: 30, tw: 50, bw: 34, stripes: ['#ffffff', '#ffa8c5'] }),
  stick,
  cakecone: () => cup({ c: '#f0c486', h: 34, tw: 50, bw: 42, ridge: true, lip: '#f8d9a6' }),
  sugarcone: () => cone({ c: '#c98a4c', L: 60, W: 46 }),
  minicup: () => cup({ c: '#bfe3ff', h: 22, tw: 46, bw: 34, stripes: ['#bfe3ff', '#ffffff'] }),
  wafflebowl: () => bowl({ c: '#e3ac62', h: 26, w: 62, pat: 'grid' }),
  glass: () => bowl({ c: '#ffffff', h: 26, w: 58, glass: true, stem: { h: 20, w: 5, base: 15 } }),
  fishbread: fish,
  waffle: () => cone({ c: '#e2a95d', L: 68, W: 48 }),
  pretzel: () => cone({ c: '#a8622a', L: 62, W: 48, pat: 'twist', salt: true }),
  macaron,
  dipcone: () => cone({ c: '#e2a95d', L: 64, W: 48, dip: '#5a321e' }),
  gelatocup: () => cup({ c: '#fff6e8', h: 32, tw: 52, bw: 38, stripes: ['#fff6e8', '#86d1b0'], spoon: true }),
  mochi,
  crepe: () => cone({ c: '#f6dba2', L: 64, W: 52, pat: 'fold', rim: false }),
  croffle: () => cone({ c: '#d68f3c', L: 54, W: 52, pat: 'grid' }),
  boat,
  parfait: () => bowl({ c: '#ffffff', h: 54, w: 50, glass: true, tall: true, stem: { h: 14, w: 5, base: 14 } }),
  bingsu: () => bowl({ c: '#dff3ff', h: 22, w: 66, rimC: '#9fd6ff', ice: true }),
  affogato: () => cup({ c: '#ffffff', h: 26, tw: 52, bw: 40, handle: true, lip: '#6b3f26' }),
  cake,
  turkish: () => cone({ c: '#c4884c', L: 86, W: 40, pat: 'ridge' }),
  cloud,
  space: pouch,
  chalice: () => bowl({ c: '#ffffff', h: 30, w: 56, glass: true, stem: { h: 28, w: 6, base: 17 }, rimC: '#c9f4ff' }),
  classic: () => cone({ c: '#e8b469', L: 66, W: 50, gold: true }),
};
