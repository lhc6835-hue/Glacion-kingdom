// Small life in the valley: ground birds that flee, butterflies by day, fireflies at night.
import { groundY, WORLD } from '../game/World.js';

export class Ambient {
  constructor() {
    this.birds = [];
    for (let i = 0; i < 7; i++) this.birds.push({ x: 200 + i * 310 + Math.random() * 80, y: 0, vx: 0, vy: 0, state: 'peck', t: Math.random() * 3, face: Math.random() < 0.5 ? 1 : -1, home: 0 });
    for (const b of this.birds) { b.home = b.x; b.y = groundY(b.x); }
    this.flies = [];
    for (let i = 0; i < 26; i++) this.flies.push({ x: 100 + Math.random() * (WORLD.width - 200), y: 0, p: Math.random() * 6.28, s: 0.5 + Math.random() });
    this.butterflies = [];
    for (let i = 0; i < 6; i++) this.butterflies.push({ x: 300 + i * 330, y: 0, p: Math.random() * 6.28, col: i % 2 ? '#8ac8f0' : '#e8f0f8' });
    this.night = 0;
    this.flock = null;
  }

  update(dt, t, player, day, events) {
    this.night = day.cur.night;
    for (const b of this.birds) {
      const gy = groundY(b.x);
      if (b.state === 'peck' || b.state === 'hop') {
        b.y = gy;
        b.t -= dt;
        if (b.t <= 0) {
          if (Math.random() < 0.5) { b.state = 'hop'; b.vy = -40; b.vx = (Math.random() - 0.5) * 30; b.face = Math.sign(b.vx) || b.face; b.t = 0.35; }
          else { b.state = 'peck'; b.t = 1 + Math.random() * 3; }
        }
        if (b.state === 'hop') { b.x += b.vx * dt; b.vy += 300 * dt; b.y = Math.min(gy, gy - 4 + b.vy * 0.02); }
        if (Math.abs(player.x - b.x) < 34 && Math.abs(player.vx) > 10) {
          b.state = 'fly'; b.face = b.x > player.x ? 1 : -1; b.vx = b.face * (60 + Math.random() * 40); b.vy = -60 - Math.random() * 30; b.t = 6;
          events.emit('birdFlee', { x: b.x });
        }
      } else if (b.state === 'fly') {
        b.x += b.vx * dt; b.y += b.vy * dt; b.vy += Math.sin(t * 9 + b.home) * 40 * dt - 6 * dt;
        b.t -= dt;
        if (b.t <= 0 || b.y < -260) { b.state = 'return'; b.x = b.home + (Math.random() - 0.5) * 60; b.y = groundY(b.x) - 160; }
      } else if (b.state === 'return') {
        const gyy = groundY(b.x);
        b.y += 50 * dt;
        if (Math.abs(player.x - b.x) < 60) b.x += Math.sign(b.x - player.x) * 40 * dt;
        if (b.y >= gyy) { b.y = gyy; b.state = 'peck'; b.t = 2; }
      }
    }
    for (const f of this.flies) {
      f.p += dt * f.s;
      f.x += Math.sin(f.p * 0.7) * 8 * dt;
      f.y = groundY(f.x) - 14 - Math.sin(f.p) * 10 - (f.s * 12);
    }
    for (const bf of this.butterflies) {
      bf.p += dt;
      bf.x += Math.sin(bf.p * 0.4) * 14 * dt;
      bf.y = groundY(bf.x) - 12 - Math.abs(Math.sin(bf.p * 1.3)) * 14;
    }
    // occasional flock crossing the sky
    if (!this.flock && Math.random() < dt * 0.03) this.flock = { x: -40, y: 30 + Math.random() * 40, t: 0 };
    if (this.flock) { this.flock.x += dt * 34; this.flock.t += dt; if (this.flock.x > 1400) this.flock = null; }
  }

  drawBack(g, camX, camY, t) {
    if (this.flock) {
      g.fillStyle = '#20343a';
      for (let i = 0; i < 6; i++) {
        const x = Math.round(this.flock.x + i * 9 - (i % 2) * 4), y = Math.round(this.flock.y + (i % 3) * 5);
        const flap = Math.sin(t * 10 + i) > 0 ? -1 : 0;
        g.fillRect(x, y, 1, 1); g.fillRect(x - 1, y + flap, 1, 1); g.fillRect(x + 1, y + flap, 1, 1);
      }
    }
  }

  drawFront(g, camX, camY, t, d) {
    for (const b of this.birds) {
      const x = Math.round(b.x - camX), y = Math.round(b.y - camY);
      if (x < -10 || x > g.canvas.width + 10) continue;
      g.fillStyle = '#3a3028'; g.fillRect(x - 2, y - 3, 4, 3);
      g.fillStyle = '#c86a3a'; g.fillRect(x + (b.face > 0 ? 1 : -2), y - 2, 2, 1); // robin breast
      g.fillStyle = '#2a2420'; g.fillRect(x + (b.face > 0 ? 2 : -3), y - 4, 2, 2);
      g.fillStyle = '#e8c05a'; g.fillRect(x + (b.face > 0 ? 4 : -4), y - 3, 1, 1);
      if (b.state === 'fly' || b.state === 'return') {
        const up = Math.sin(t * 22) > 0;
        g.fillStyle = '#3a3028'; g.fillRect(x - 3, y - (up ? 6 : 2), 3, 1); g.fillRect(x + 1, y - (up ? 6 : 2), 3, 1);
      } else if (b.state === 'peck' && Math.sin(t * 6 + b.home) > 0.7) {
        g.fillStyle = '#2a2420'; g.fillRect(x + (b.face > 0 ? 2 : -3), y - 2, 2, 2);
      }
    }
    if (d.night < 0.5) for (const bf of this.butterflies) {
      const x = Math.round(bf.x - camX), y = Math.round(bf.y - camY);
      const open = Math.sin(t * 14 + bf.p) > 0;
      g.fillStyle = bf.col;
      if (open) { g.fillRect(x - 2, y - 1, 2, 2); g.fillRect(x + 1, y - 1, 2, 2); } else g.fillRect(x - 1, y - 2, 3, 2);
      g.fillStyle = '#1a1a1a'; g.fillRect(x, y - 1, 1, 2);
    }
    if (this.night > 0.4) {
      for (const f of this.flies) {
        if (Math.sin(f.p * 2.3) < -0.2) continue;
        g.fillStyle = '#e8ff9a';
        g.fillRect(Math.round(f.x - camX), Math.round(f.y - camY), 1, 1);
      }
    }
  }

  drawGlow(lg, camX, camY, G) {
    if (this.night <= 0.4) return;
    const a = (this.night - 0.4) / 0.6;
    for (const f of this.flies) {
      const k = Math.sin(f.p * 2.3);
      if (k < -0.2) continue;
      lg.globalAlpha = a * (0.4 + 0.4 * k);
      lg.drawImage(G.green, (f.x - camX) * 2 - 12, (f.y - camY) * 2 - 12, 24, 24);
    }
    lg.globalAlpha = 1;
  }
}
