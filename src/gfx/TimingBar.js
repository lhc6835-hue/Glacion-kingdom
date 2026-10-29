// Draws the timing bar on the pixel UI canvas. Zones differ by colour AND by pattern/markers:
// crit = solid blue with diamonds, great = green with notches, good = yellow, weak = dotted.
import { drawText, textWidth } from './Font.js';
import { JUDGE } from '../data/balance.js';

const WORD = { crit: 'CRITICAL!', great: 'GREAT', good: 'GOOD', weak: 'WEAK', miss: 'MISS' };

export class TimingBar {
  constructor() { this.show = 0; this.pop = null; this.trail = [0, 0, 0, 0]; }

  judged(j) { this.pop = { j, t: 0 }; }

  // anchor: screen position above the hero's head for the judgment word.
  draw(g, combat, W, H, dt, now, anchor) {
    const active = !!combat.target;
    this.show += ((active ? 1 : 0) - this.show) * Math.min(1, dt * 14);
    if (this.pop) { this.pop.t += dt; if (this.pop.t > 0.8) this.pop = null; }
    if (this.show < 0.02 && !this.pop) return;
    const BW = Math.min(180, Math.floor(W * 0.5)), BH = 9;
    const x0 = Math.round(W / 2 - BW / 2);
    const y0 = Math.round(H - 24 + (1 - this.show) * 30);
    const z = combat.zones;
    const zx = (h) => Math.round(BW * (0.5 - h)), zw = (h) => Math.round(BW * h * 2);
    // frame
    g.fillStyle = '#0a1214'; g.fillRect(x0 - 3, y0 - 3, BW + 6, BH + 6);
    g.fillStyle = '#3a5650'; g.fillRect(x0 - 2, y0 - 2, BW + 4, 1); g.fillRect(x0 - 2, y0 + BH + 1, BW + 4, 1);
    g.fillRect(x0 - 2, y0 - 2, 1, BH + 4); g.fillRect(x0 + BW + 1, y0 - 2, 1, BH + 4);
    g.fillStyle = '#16211f'; g.fillRect(x0, y0, BW, BH);
    // weak: dotted brown
    g.fillStyle = '#5a4e36';
    for (let i = zx(z.weak); i < zx(z.weak) + zw(z.weak); i++) if (i % 2 === 0) g.fillRect(x0 + i, y0 + 3, 1, 3);
    // good: yellow
    g.fillStyle = '#c8a832'; g.fillRect(x0 + zx(z.good), y0 + 1, zw(z.good), BH - 2);
    g.fillStyle = '#e8cc52'; g.fillRect(x0 + zx(z.good), y0 + 1, zw(z.good), 1);
    // great: green with notches on its edges
    g.fillStyle = '#3ea85a'; g.fillRect(x0 + zx(z.great), y0, zw(z.great), BH);
    g.fillStyle = '#6fe08a'; g.fillRect(x0 + zx(z.great), y0, zw(z.great), 1);
    g.fillStyle = '#1a4a2a'; g.fillRect(x0 + zx(z.great), y0 + 2, 1, BH - 4); g.fillRect(x0 + zx(z.great) + zw(z.great) - 1, y0 + 2, 1, BH - 4);
    // crit: bright blue, taller, diamonds above and below
    const cx = x0 + zx(z.crit), cw = Math.max(2, zw(z.crit));
    g.fillStyle = '#2f78d8'; g.fillRect(cx, y0 - 1, cw, BH + 2);
    g.fillStyle = '#8fd0ff'; g.fillRect(cx, y0 - 1, cw, 1); g.fillRect(cx, y0 + BH, cw, 1);
    const mid = Math.round(cx + cw / 2);
    g.fillStyle = '#bfe6ff';
    g.fillRect(mid - 1, y0 - 4, 2, 1); g.fillRect(mid - 2, y0 - 3, 4, 1);
    g.fillRect(mid - 2, y0 + BH + 2, 4, 1); g.fillRect(mid - 1, y0 + BH + 3, 2, 1);
    // ghost of the last judgment
    if (combat.lastJudge && now - combat.lastJudge.at < 0.6) {
      const gx = x0 + Math.round(combat.lastJudge.pos * BW);
      g.globalAlpha = 1 - (now - combat.lastJudge.at) / 0.6;
      g.fillStyle = JUDGE[combat.lastJudge.j].color;
      g.fillRect(gx - 1, y0 - 3, 3, BH + 6);
      g.globalAlpha = 1;
    }
    // marker with a short afterimage
    if (active) {
      const mx = x0 + Math.round(combat.markerPos * BW);
      this.trail.pop(); this.trail.unshift(mx);
      g.fillStyle = '#ffffff';
      for (let i = 1; i < this.trail.length; i++) { g.globalAlpha = 0.25 / i; g.fillRect(this.trail[i] - 1, y0, 2, BH); }
      g.globalAlpha = 1;
      g.fillStyle = '#0a1214'; g.fillRect(mx - 2, y0 - 3, 5, BH + 6);
      g.fillStyle = '#ffffff'; g.fillRect(mx - 1, y0 - 2, 3, BH + 4);
      g.fillRect(mx - 2, y0 - 4, 5, 1); g.fillRect(mx - 2, y0 + BH + 3, 5, 1);
    }
    // combo counter
    if (combat.combo >= 2 && active) {
      const s = `x${combat.combo}`;
      drawText(g, s, x0 + BW + 8, y0 + 1, combat.combo >= 8 ? '#8fd0ff' : '#e8f0e0');
    }
    // judgment word pops above the hero's head, clear of the tree and the hero
    if (this.pop && anchor) {
      const p = this.pop, j = p.j;
      const scale = j === 'crit' && p.t < 0.14 ? 2 : 1; // crits punch in large, then settle
      const rise = Math.round(Math.min(1, p.t * 8) * 6);
      if (!(p.t > 0.6 && Math.floor(p.t * 30) % 2)) {
        const w = textWidth(WORD[j], scale);
        drawText(g, WORD[j], Math.round(Math.max(2, Math.min(W - w - 2, anchor.x - w / 2))), anchor.y - 7 * scale - rise, JUDGE[j].color, scale);
      }
    }
  }
}
