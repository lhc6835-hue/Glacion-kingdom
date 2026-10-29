// 4.5 s opening, played live in the real scene: crane down from the valley walls, through the
// branches into the clearing, the hero draws the axe, the Elder Mossroot wakes, then the title.
import { drawText, textWidth } from '../gfx/Font.js';
import { groundY } from './World.js';

export const CINE_LEN = 4.5;
const clamp = (v) => Math.max(0, Math.min(1, v));
const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };

export class Cinematic {
  constructor(game) {
    this.g = game;
    this.t = 0;
    this.done = false;
    this.cues = new Set();
    this.leaves = [];
    for (let i = 0; i < 7; i++) this.leaves.push({ y: 0.1 + Math.random() * 0.8, s: 10 + Math.random() * 14, d: Math.random() * 0.4, rot: Math.random() * 6 });
  }

  cue(name, at, fn) { if (this.t >= at && !this.cues.has(name)) { this.cues.add(name); fn(); } }

  update(dt) {
    const g = this.g, p = g.player, e = g.engine;
    this.t += dt;
    const t = this.t;
    const W = e.W;
    const px = p.x;
    // camera path: x pans right across the valley; y cranes down from the cliffs to the clearing
    const startX = px - W / 2 - 230, endX = px - W / 2 + 12;
    const kx = t < 3.8 ? smooth(t / 3.0) : 1;
    g.cam.x = startX + (endX - startX) * kx;
    const up = t < 1.6 ? 44 - 10 * smooth(t / 1.6) : t < 2.3 ? 34 * (1 - smooth((t - 1.6) / 0.7)) : t < 3.8 ? 0 : 22 * smooth((t - 3.8) / 0.7);
    g.cam.y = g.camY0 - up;
    // light: shafts swell while we pass through the branches
    g.rayBoost = 1 + 0.9 * Math.sin(clamp((t - 0.6) / 1.6) * Math.PI);
    g.elderGlow = t < 2.8 ? 0 : t < 3.8 ? smooth((t - 2.8) / 0.8) : 1 - smooth((t - 3.8) / 0.7) * 0.6;
    // hero: looks around, then draws the axe
    p.locked = true;
    p.stowed = t < 2.25;
    p.facing = t < 2.15 ? -1 : 1;
    if (t >= 2.25 && t < 2.85) { p.cheerT = 0; p.forceAxe = smooth((t - 2.25) / 0.45); }
    if (t >= 2.85) p.surpriseT = Math.max(p.surpriseT, t < 3.7 ? 0.1 : 0);
    this.cue('wind', 0.05, () => g.audio.play('swell'));
    this.cue('pollen', 0.9, () => { for (let i = 0; i < 26; i++) g.particles.spawn(g.cam.x + Math.random() * W, g.cam.y + 40 + Math.random() * 120, 4 + Math.random() * 6, -2 - Math.random() * 4, 3, '#f8f0c0', { glow: 0.5, drag: 0.1 }); });
    this.cue('flock', 1.0, () => { g.ambient.flock = { x: 40, y: 40, t: 0 }; });
    this.cue('draw', 2.3, () => g.audio.play('whoosh'));
    this.cue('glint', 2.72, () => { g.renderer.flash(p.x + 8, p.y - 18, 26, 'white', 0.25); g.audio.play('chime'); });
    this.cue('wake', 2.85, () => { g.audio.play('rare'); });
    if (t > 2.85 && t < 3.9 && Math.random() < dt * 40) {
      const ex = g.stationX('elder') + (Math.random() - 0.5) * 70;
      g.particles.spawn(ex, groundY(ex) - 2, (Math.random() - 0.5) * 6, -18 - Math.random() * 20, 2.2, '#9ff0d0', { glow: 0.9, drag: 0.3, kind: 2, size: 2 });
    }
    this.cue('title', 3.8, () => g.audio.play('title'));
    if (t >= CINE_LEN) this.finish();
  }

  finish() {
    if (this.done) return;
    this.done = true;
    const g = this.g;
    g.player.locked = false;
    g.player.forceAxe = 0;
    g.player.stowed = false;
    g.rayBoost = 1;
    g.elderGlow = 0;
    g.onCinematicEnd();
  }

  // Big leaves sweeping past the lens (0.8–1.8 s) and the fade from black.
  drawWorldOverlay(gx) {
    const t = this.t, W = this.g.engine.W, H = this.g.engine.H;
    if (t > 0.7 && t < 2.0) {
      for (const L of this.leaves) {
        const u = (t - 0.7 - L.d) / 0.9;
        if (u < 0 || u > 1) continue;
        const x = W * (1.2 - u * 1.5), y = H * L.y + Math.sin(u * 6 + L.rot) * 8;
        this.leaf(gx, x, y, L.s * 2.2, L.rot + u * 1.2);
      }
    }
  }

  // A large out-of-focus leaf close to the lens: pointed blade, two tones and a midrib.
  leaf(g, cx, cy, len, rot) {
    const ca = Math.cos(rot), sa = Math.sin(rot);
    const R = Math.ceil(len / 2) + 2;
    for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
      const u = (x * ca + y * sa) / len + 0.5, v = -x * sa + y * ca;
      if (u < 0 || u > 1) continue;
      const half = Math.sin(Math.PI * Math.pow(u, 0.8)) * len * 0.2;
      if (Math.abs(v) > half) continue;
      g.fillStyle = Math.abs(v) < 0.8 ? '#1f3f30' : v < 0 ? '#14302a' : '#0c1e18';
      g.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
    }
  }

  drawUI(ug) {
    const t = this.t, W = this.g.engine.W, H = this.g.engine.H;
    // fade in from black with a single point of light first
    if (t < 0.8) {
      ug.globalAlpha = 1 - smooth(t / 0.8);
      ug.fillStyle = '#000000'; ug.fillRect(0, 0, W, H);
      ug.globalAlpha = 1;
      if (t < 0.45) { ug.fillStyle = '#e8fff0'; ug.fillRect(Math.round(W / 2), Math.round(H * 0.42), 1, 1); }
    }
    if (t > 3.8) {
      const u = smooth((t - 3.8) / 0.35);
      const s = W > 360 ? 4 : 3;
      const word = 'AXENFALL';
      const w = textWidth(word, s);
      const x = Math.round(W / 2 - w / 2), y = Math.round(H * 0.3 - (1 - u) * 6);
      ug.globalAlpha = u;
      drawText(ug, word, x + s, y + s, '#06100e', s, null);
      drawText(ug, word, x, y, '#d8f4e4', s, '#0a1816');
      ug.save(); ug.beginPath(); ug.rect(x - 4, y, w + 8, 3 * s); ug.clip();
      drawText(ug, word, x, y, '#ffffff', s, null);
      ug.restore();
      ug.fillStyle = '#9ff0d0';
      ug.fillRect(x, y + 8 * s + 3, Math.round(w * u), 1);
      ug.globalAlpha = 1;
    }
  }
}
