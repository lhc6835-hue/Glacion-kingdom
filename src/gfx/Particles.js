// Pooled particles and floating damage numbers. Nothing is allocated after start-up.
import { drawText, textWidth } from './Font.js';

const MAX = 900;

export class Particles {
  constructor() {
    this.pool = [];
    for (let i = 0; i < MAX; i++) this.pool.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, color: '#fff', size: 1, grav: 0, drag: 0, kind: 0, spin: 0, glow: 0, floor: 1e9 });
    this.cursor = 0;
    this.density = 1;
    this.nums = [];
    for (let i = 0; i < 40; i++) this.nums.push({ alive: false, x: 0, y: 0, vy: 0, life: 0, text: '', color: '#fff', scale: 1 });
  }

  spawn(x, y, vx, vy, life, color, opt) {
    let p = null;
    for (let i = 0; i < MAX; i++) {
      const q = this.pool[(this.cursor + i) % MAX];
      if (!q.alive) { p = q; this.cursor = (this.cursor + i + 1) % MAX; break; }
    }
    if (!p) { p = this.pool[this.cursor]; this.cursor = (this.cursor + 1) % MAX; }
    p.alive = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life; p.color = color;
    p.size = opt?.size ?? 1; p.grav = opt?.grav ?? 0; p.drag = opt?.drag ?? 0; p.kind = opt?.kind ?? 0;
    p.spin = opt?.spin ?? 0; p.glow = opt?.glow ?? 0; p.floor = opt?.floor ?? 1e9;
    return p;
  }

  // Emits n particles (scaled by the particle setting) in a cone.
  burst(n, x, y, colors, speed, spread, angle, life, opt) {
    const count = Math.max(1, Math.round(n * this.density));
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const v = speed * (0.4 + Math.random() * 0.8);
      this.spawn(x + (Math.random() - 0.5) * 3, y + (Math.random() - 0.5) * 3, Math.cos(a) * v, Math.sin(a) * v, life * (0.6 + Math.random() * 0.7), colors[(Math.random() * colors.length) | 0], opt);
    }
  }

  number(x, y, text, color, scale = 1) {
    const n = this.nums.find((q) => !q.alive) || this.nums[0];
    n.alive = true; n.x = x; n.y = y; n.vy = -34 - scale * 8; n.life = 0.9 + scale * 0.15; n.max = n.life; n.text = text; n.color = color; n.scale = scale;
  }

  update(dt) {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; continue; }
      p.vy += p.grav * dt;
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
      if (p.kind === 1) p.vx += Math.sin(p.life * 7 + p.spin) * 30 * dt; // leaf flutter
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.y > p.floor) { p.y = p.floor; p.vy *= -0.25; p.vx *= 0.6; }
    }
    for (const n of this.nums) {
      if (!n.alive) continue;
      n.life -= dt;
      if (n.life <= 0) { n.alive = false; continue; }
      n.y += n.vy * dt; n.vy *= Math.max(0, 1 - 3.5 * dt);
    }
  }

  draw(g, camX, camY) {
    for (const p of this.pool) {
      if (!p.alive) continue;
      const x = Math.round(p.x - camX), y = Math.round(p.y - camY);
      g.fillStyle = p.color;
      if (p.kind === 1 && p.size > 1) { g.fillRect(x, y, 2, 1); g.fillRect(x + (Math.sin(p.life * 9 + p.spin) > 0 ? 1 : 0), y + 1, 1, 1); }
      else if (p.kind === 2) { const s = p.life / p.max > 0.5 ? p.size : Math.max(1, p.size - 1); g.fillRect(x, y, s, s); }
      else g.fillRect(x, y, p.size, p.size);
    }
  }

  // Soft glow for glowing particles, on the 2× light canvas.
  drawGlow(lg, camX, camY, sprite) {
    for (const p of this.pool) {
      if (!p.alive || !p.glow) continue;
      const a = Math.min(1, p.life / p.max * 1.5) * p.glow;
      lg.globalAlpha = a;
      const s = 10 + p.size * 4;
      lg.drawImage(sprite, (p.x - camX) * 2 - s, (p.y - camY) * 2 - s, s * 2, s * 2);
    }
    lg.globalAlpha = 1;
  }

  drawNumbers(g, camX, camY) {
    for (const n of this.nums) {
      if (!n.alive) continue;
      const fade = n.life / n.max;
      if (fade < 0.25 && Math.floor(n.life * 30) % 2) continue; // blink out
      const w = textWidth(n.text, n.scale);
      const pop = n.max - n.life < 0.08 ? 1 : 0;
      drawText(g, n.text, n.x - camX - w / 2, n.y - camY - pop, n.color, n.scale);
    }
  }
}
