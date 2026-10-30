// Enemy art. Every enemy is ONE smooth silhouette traced from a polar radius function and
// smoothed through midpoints, so nothing ever looks like shapes glued together. Details are
// painted inside the silhouette (source-atop) and the whole thing gets one soft outline.
// Each type is baked into a short loop of frames plus white copies for hit flashes.
import { makeSprite, atop, whiteOf, drawSprite } from './sprite.js';
import { TAU, rgba, rng } from '../core/math.js';

const FRAMES = 8;
const cache = new Map();

export function enemyFrames(type, size) {
  const key = type + ':' + size;
  let f = cache.get(key);
  if (!f) {
    const art = ART[type];
    f = [];
    for (let i = 0; i < FRAMES; i++) {
      const s = bake(art, size, i / FRAMES);
      f.push({ s, w: whiteOf(s) });
    }
    cache.set(key, f);
  }
  return f;
}

export function drawEnemyFrame(g, type, size, t, flash) {
  const frames = enemyFrames(type, size);
  const fr = frames[Math.floor(((t % 1) + 1) * FRAMES) % FRAMES];
  drawSprite(g, fr.s);
  if (flash > 0) {
    const a = g.globalAlpha;
    g.globalAlpha = a * Math.min(1, flash);
    drawSprite(g, fr.w);
    g.globalAlpha = a;
  }
}

function bake(art, r, t) {
  const ext = r * (art.ext || 2.2);
  return makeSprite(ext * 2, ext * 2, ext, ext * (art.oy || 1), (g) => art.draw(g, r, t), { outline: art.outline ?? 1.1, outlineColor: art.oc });
}

// Smooth closed curve through polar samples.
function polar(g, n, fn) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU - Math.PI / 2;
    const r = fn(a, i);
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  g.beginPath();
  const m0 = mid(pts[n - 1], pts[0]);
  g.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const p = pts[i], m = mid(p, pts[(i + 1) % n]);
    g.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  g.closePath();
}
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

function eyes(g, r, { y = -0.05, gap = 0.2, size = 0.09, angry = false, color = '#3a1414' } = {}) {
  g.fillStyle = color;
  for (const s of [-1, 1]) {
    g.beginPath(); g.ellipse(s * r * gap, r * y, r * size, r * size * 1.15, 0, 0, TAU); g.fill();
  }
  if (angry) {
    g.strokeStyle = color; g.lineWidth = r * 0.07; g.lineCap = 'round';
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(s * r * (gap + 0.14), r * (y - 0.2)); g.lineTo(s * r * (gap - 0.06), r * (y - 0.13)); g.stroke();
    }
  }
}
function gloss(g, x, y, w, h, a = 0.6) {
  g.fillStyle = `rgba(255,255,255,${a})`;
  g.beginPath(); g.ellipse(x, y, w, h, -0.5, 0, TAU); g.fill();
}
function radial(g, r, stops, cx = -0.25, cy = -0.3) {
  const gr = g.createRadialGradient(r * cx, r * cy, r * 0.05, 0, 0, r * 1.5);
  stops.forEach(([o, c]) => gr.addColorStop(o, c));
  g.fillStyle = gr;
  g.fillRect(-r * 3, -r * 3, r * 6, r * 6);
}

const ART = {
  // 열기방울 — a bouncy drop of heat with a swaying tip
  heatdrop: {
    oc: 'rgba(150,40,20,0.7)',
    draw(g, r, t) {
      const sway = Math.sin(t * TAU) * 0.35;
      g.fillStyle = '#ff9a3c';
      polar(g, 40, (a) => {
        const up = Math.max(0, -Math.sin(a));
        const tipA = -Math.PI / 2 + sway * 0.4;
        const near = Math.max(0, Math.cos(a - tipA));
        return r * (1 + Math.pow(near, 12) * 0.85 * up + 0.04 * Math.sin(a * 3 + t * TAU));
      });
      g.fill();
      atop(g, (g) => {
        radial(g, r, [[0, '#fff6b0'], [0.35, '#ffc04a'], [0.75, '#ff7a3a'], [1, '#e8452f']], -0.1, 0.1);
        eyes(g, r, { y: 0.05, gap: 0.24, size: 0.11, angry: true });
        g.strokeStyle = '#3a1414'; g.lineWidth = r * 0.07;
        g.beginPath(); g.moveTo(-r * 0.12, r * 0.33); g.quadraticCurveTo(0, r * 0.26, r * 0.12, r * 0.33); g.stroke();
        gloss(g, -r * 0.45, -r * 0.35, r * 0.18, r * 0.1);
      });
    },
  },
  // 불씨 — a tiny flickering flame
  ember: {
    oc: 'rgba(160,30,20,0.6)', ext: 2.6, oy: 1.3,
    draw(g, r, t) {
      g.fillStyle = '#ff5a36';
      polar(g, 44, (a, i) => {
        const up = Math.max(0, -Math.sin(a));
        const flick = Math.sin(a * 3 + t * TAU * 2) * 0.5 + 0.5;
        return r * (1 + Math.pow(up, 5) * (0.9 + flick * 0.7) + Math.sin(i * 1.7 + t * TAU) * 0.03);
      });
      g.fill();
      atop(g, (g) => {
        radial(g, r, [[0, '#fff7c2'], [0.3, '#ffd25a'], [0.7, '#ff7a2e'], [1, '#e02b2b']], 0, 0.3);
        eyes(g, r, { y: 0.15, gap: 0.26, size: 0.13 });
      });
    },
  },
  // 아지랑이 — a wavering heat-haze ghost
  haze: {
    oc: 'rgba(170,80,140,0.45)',
    draw(g, r, t) {
      g.fillStyle = '#ffc6e2';
      polar(g, 56, (a) => {
        const down = Math.max(0, Math.sin(a));
        return r * (1 + Math.pow(down, 1.5) * 0.5 + Math.sin(a * 9 - t * TAU) * 0.16 * Math.pow(down, 2) + Math.sin(a * 2 + t * TAU) * 0.03);
      });
      g.fill();
      atop(g, (g) => {
        radial(g, r, [[0, 'rgba(255,255,255,0.9)'], [0.5, 'rgba(255,190,225,0.6)'], [1, 'rgba(230,120,190,0.9)']]);
        g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = r * 0.08;
        for (let k = 0; k < 2; k++) {
          g.beginPath(); const y = r * (0.25 + k * 0.3);
          g.moveTo(-r, y); g.bezierCurveTo(-r * 0.3, y - r * 0.2 + Math.sin(t * TAU) * r * 0.1, r * 0.3, y + r * 0.2, r, y); g.stroke();
        }
        eyes(g, r, { y: -0.15, gap: 0.22, size: 0.1, color: '#6a2a52' });
        g.fillStyle = '#6a2a52'; g.beginPath(); g.ellipse(0, r * 0.12, r * 0.08, r * 0.11, 0, 0, TAU); g.fill();
      });
    },
  },
  // 햇살 정령 — a little sun with soft rounded rays
  sunling: {
    oc: 'rgba(170,90,10,0.7)',
    draw(g, r, t) {
      g.fillStyle = '#ffc93a';
      polar(g, 64, (a) => r * (1 + 0.17 * Math.cos(8 * a + t * TAU / 4)));
      g.fill();
      atop(g, (g) => {
        radial(g, r, [[0, '#fffbe0'], [0.45, '#ffd84a'], [1, '#ff9a1f']]);
        g.fillStyle = 'rgba(255,120,90,0.4)';
        g.beginPath(); g.ellipse(-r * 0.45, r * 0.18, r * 0.16, r * 0.09, 0, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(r * 0.45, r * 0.18, r * 0.16, r * 0.09, 0, 0, TAU); g.fill();
        eyes(g, r, { y: -0.05, gap: 0.2, size: 0.09, color: '#5a2a0a' });
        g.strokeStyle = '#5a2a0a'; g.lineWidth = r * 0.06;
        g.beginPath(); g.arc(0, r * 0.12, r * 0.12, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
        gloss(g, -r * 0.4, -r * 0.45, r * 0.16, r * 0.09, 0.7);
      });
    },
  },
  // 녹은 슬라임 — a wobbly puddle of molten sugar
  slime: {
    oc: 'rgba(140,20,50,0.7)', oy: 1.15,
    draw(g, r, t) {
      g.fillStyle = '#ff5f7a';
      const ph = t * TAU;
      polar(g, 48, (a) => {
        const sx = 1.18 + Math.sin(ph) * 0.06, sy = 0.82 - Math.sin(ph) * 0.06;
        const c = Math.cos(a), s = Math.sin(a);
        const base = r / Math.sqrt((c / sx) ** 2 + (s / sy) ** 2);
        return base * (1 + 0.05 * Math.sin(a * 5 + ph) + (s > 0 ? 0.06 * s : 0));
      });
      g.fill();
      atop(g, (g) => {
        radial(g, r, [[0, '#ffd0d8'], [0.4, '#ff7f95'], [1, '#d6264f']]);
        eyes(g, r, { y: -0.12, gap: 0.24, size: 0.1, color: '#4a0f1f' });
        g.strokeStyle = '#4a0f1f'; g.lineWidth = r * 0.06;
        g.beginPath(); g.moveTo(-r * 0.1, r * 0.12); g.lineTo(r * 0.1, r * 0.12); g.stroke();
        gloss(g, -r * 0.5, -r * 0.38, r * 0.25, r * 0.1, 0.75);
        gloss(g, -r * 0.15, -r * 0.55, r * 0.06, r * 0.05, 0.7);
      });
    },
  },
  // 용암 덩어리 — a slow, heavy lump with glowing cracks
  magma: {
    oc: 'rgba(40,10,10,0.75)',
    draw(g, r, t) {
      const rnd = rng(42);
      const bumps = Array.from({ length: 7 }, () => rnd() * TAU);
      g.fillStyle = '#6b2a2a';
      polar(g, 48, (a) => r * (1 + bumps.reduce((s, b, i) => s + Math.sin(a * (i + 2) + b) * 0.025, 0) + Math.sin(a * 2 + t * TAU) * 0.02));
      g.fill();
      atop(g, (g) => {
        radial(g, r, [[0, '#a8483a'], [0.6, '#6b2a2a'], [1, '#3a1414']]);
        const glow = 0.6 + Math.sin(t * TAU) * 0.3;
        g.strokeStyle = `rgba(255,150,60,${glow})`; g.lineWidth = r * 0.09;
        const r2 = rng(9);
        for (let k = 0; k < 5; k++) {
          let x = (r2() - 0.5) * r * 1.4, y = (r2() - 0.2) * r * 1.2;
          g.beginPath(); g.moveTo(x, y);
          for (let j = 0; j < 3; j++) { x += (r2() - 0.5) * r * 0.5; y += (r2() - 0.5) * r * 0.5; g.lineTo(x, y); }
          g.stroke();
        }
        g.fillStyle = '#ffcf5a';
        for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * r * 0.26, -r * 0.18, r * 0.1, r * 0.07, 0, 0, TAU); g.fill(); }
        gloss(g, -r * 0.45, -r * 0.5, r * 0.18, r * 0.08, 0.25);
      });
    },
  },
  // 열풍 — a spinning gust of hot wind
  whirl: {
    oc: 'rgba(170,80,40,0.5)', ext: 2.4, oy: 1.2,
    draw(g, r, t) {
      g.fillStyle = '#ffcf9e';
      polar(g, 56, (a) => {
        const s = Math.sin(a);
        const w = s < 0 ? 1.2 : 1 - s * 0.78;
        return r * w * (1 + Math.sin(a * 6 + t * TAU * 2) * 0.05) * (s < 0 ? 1 + (-s) * 0.15 : 1);
      });
      g.fill();
      atop(g, (g) => {
        radial(g, r, [[0, 'rgba(255,250,235,0.95)'], [0.6, 'rgba(255,190,130,0.85)'], [1, 'rgba(240,120,70,0.9)']], 0, -0.4);
        g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = r * 0.1;
        for (let k = 0; k < 4; k++) {
          const y = -r * 0.7 + k * r * 0.45, w = r * (1.1 - k * 0.22), off = Math.sin(t * TAU + k) * r * 0.2;
          g.beginPath(); g.ellipse(off, y, w, r * 0.16, 0, 0.2, Math.PI * 1.3); g.stroke();
        }
        eyes(g, r, { y: -0.3, gap: 0.2, size: 0.09, angry: true, color: '#5a2010' });
      });
    },
  },
  // 흑점 폭탄 — a sunspot that rushes in and bursts
  flare: {
    oc: 'rgba(30,5,15,0.7)',
    draw(g, r, t) {
      g.fillStyle = '#4a1a2e';
      polar(g, 48, (a) => r * (1 + 0.05 * Math.sin(a * 5 + t * TAU * 2)));
      g.fill();
      atop(g, (g) => {
        const pulse = 0.5 + Math.sin(t * TAU) * 0.5;
        const gr = g.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.05);
        gr.addColorStop(0, '#2a0d1c'); gr.addColorStop(0.65, '#5a1f33'); gr.addColorStop(1, `rgba(255,${120 + pulse * 80},60,1)`);
        g.fillStyle = gr; g.fillRect(-r * 2, -r * 2, r * 4, r * 4);
        eyes(g, r, { y: -0.05, gap: 0.24, size: 0.12, color: '#ffb84a', angry: true });
        gloss(g, -r * 0.42, -r * 0.45, r * 0.16, r * 0.08, 0.35);
      });
    },
  },
  // ── bosses ──
  sunboss: {
    oc: 'rgba(160,70,0,0.8)', outline: 1.6,
    draw(g, r, t) {
      g.fillStyle = '#ffb92e';
      polar(g, 96, (a) => r * (1 + 0.13 * Math.cos(12 * a + t * TAU) + 0.04 * Math.cos(5 * a - t * TAU)));
      g.fill();
      atop(g, (g) => {
        radial(g, r, [[0, '#fffde6'], [0.4, '#ffd94a'], [0.8, '#ff9a1f'], [1, '#ff6a1f']]);
        g.fillStyle = 'rgba(255,110,80,0.45)';
        for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * r * 0.42, r * 0.15, r * 0.15, r * 0.08, 0, 0, TAU); g.fill(); }
        eyes(g, r, { y: -0.1, gap: 0.18, size: 0.07, angry: true, color: '#5a2a0a' });
        g.strokeStyle = '#5a2a0a'; g.lineWidth = r * 0.045;
        g.beginPath(); g.moveTo(-r * 0.14, r * 0.2); g.quadraticCurveTo(0, r * 0.1, r * 0.14, r * 0.2); g.stroke();
        gloss(g, -r * 0.4, -r * 0.45, r * 0.15, r * 0.07, 0.7);
      });
    },
  },
  slimeking: {
    oc: 'rgba(110,10,40,0.8)', outline: 1.6, oy: 1.2,
    draw(g, r, t) {
      const ph = t * TAU;
      g.fillStyle = '#ff4f6e';
      polar(g, 72, (a) => {
        const sx = 1.2 + Math.sin(ph) * 0.05, sy = 0.85 - Math.sin(ph) * 0.05;
        const c = Math.cos(a), s = Math.sin(a);
        let base = r / Math.sqrt((c / sx) ** 2 + (s / sy) ** 2);
        return base * (1 + 0.03 * Math.sin(a * 6 + ph));
      });
      g.fill();
      atop(g, (g) => {
        radial(g, r, [[0, '#ffd3dc'], [0.4, '#ff6f8a'], [1, '#c41a45']]);
        g.strokeStyle = 'rgba(255,230,120,0.55)'; g.lineWidth = r * 0.05;
        g.beginPath(); g.ellipse(0, r * 0.05, r * 1.05, r * 0.66, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
        eyes(g, r, { y: -0.1, gap: 0.22, size: 0.08, angry: true, color: '#4a0f1f' });
        gloss(g, -r * 0.55, -r * 0.3, r * 0.22, r * 0.08, 0.7);
      });
    },
  },
  hazequeen: {
    oc: 'rgba(150,60,130,0.6)', outline: 1.5,
    draw(g, r, t) {
      g.fillStyle = '#e8b6ff';
      polar(g, 80, (a) => {
        const down = Math.max(0, Math.sin(a)), up = Math.max(0, -Math.sin(a));
        return r * (1 + down * 0.3 + Math.sin(a * 9 - t * TAU) * 0.08 * down + Math.pow(up, 8) * 0.25 * (0.5 + 0.5 * Math.cos(a * 6)));
      });
      g.fill();
      atop(g, (g) => {
        radial(g, r, [[0, 'rgba(255,255,255,0.95)'], [0.5, 'rgba(240,190,255,0.8)'], [1, 'rgba(190,110,230,0.95)']]);
        g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = r * 0.06;
        for (let k = 0; k < 3; k++) {
          const y = r * (0.1 + k * 0.28);
          g.beginPath(); g.moveTo(-r, y); g.bezierCurveTo(-r * 0.3, y - r * 0.2 + Math.sin(t * TAU + k) * r * 0.1, r * 0.3, y + r * 0.2, r, y); g.stroke();
        }
        eyes(g, r, { y: -0.2, gap: 0.18, size: 0.07, color: '#5a2a6a' });
        g.fillStyle = '#5a2a6a'; g.beginPath(); g.ellipse(0, r * 0.05, r * 0.05, r * 0.07, 0, 0, TAU); g.fill();
      });
    },
  },
};

export const ENEMY_ART_TYPES = Object.keys(ART);
export function glowOf(type) {
  return { heatdrop: '#ffb347', ember: '#ff6a3d', haze: '#ffc6e2', sunling: '#ffd84a', slime: '#ff6f8a', magma: '#ff7a3a', whirl: '#ffcf9e', flare: '#ff8a4a', sunboss: '#ffcf4a', slimeking: '#ff6f8a', hazequeen: '#e8b6ff' }[type] || '#ffffff';
}
export const glowRgba = (type, a) => rgba(glowOf(type), a);
