// Particles, rings, damage numbers and ground splats. Pooled in plain arrays; cheap to draw.
import { TAU, rand, easeOutBack, rgba, clamp } from '../core/math.js';
import { scoopSprite } from '../render/scoopArt.js';
import { drawSprite } from '../render/sprite.js';
import { FLAVOR } from '../../shared/flavors.js';

export class FX {
  constructor() {
    this.parts = [];
    this.ground = [];
    this.nums = [];
    this.max = 900;
  }

  dot(x, y, o = {}) {
    if (this.parts.length > this.max) return;
    const a = o.a ?? rand(TAU), sp = o.sp ?? rand(40, 220);
    this.parts.push({
      k: o.k || 'dot', x, y, z: o.z ?? 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: o.vz ?? 0,
      life: o.life ?? rand(0.3, 0.7), t: 0, r: o.r ?? rand(2, 5), c: o.c || '#fff', drag: o.drag ?? 4, grav: o.grav ?? 0,
      shrink: o.shrink ?? true, glow: o.glow, rot: rand(TAU), vr: rand(-8, 8),
    });
  }
  burst(x, y, n, o = {}) { for (let i = 0; i < n; i++) this.dot(x, y, { ...o, c: Array.isArray(o.c) ? o.c[i % o.c.length] : o.c }); }
  ring(x, y, r, c, o = {}) { this.parts.push({ k: 'ring', x, y, r0: o.r0 ?? r * 0.2, r, c, life: o.life ?? 0.35, t: 0, w: o.w ?? 6, fill: o.fill }); }
  puff(x, y, o = {}) { this.dot(x, y, { k: 'puff', r: o.r ?? rand(8, 16), c: o.c || 'rgba(255,255,255,0.6)', sp: o.sp ?? rand(10, 50), life: o.life ?? rand(0.5, 0.9), drag: 2, vz: o.vz ?? 0, a: o.a }); }
  line(x1, y1, x2, y2, c, o = {}) { this.parts.push({ k: 'line', x: x1, y: y1, x2, y2, c, life: o.life ?? 0.18, t: 0, w: o.w ?? 4, jag: o.jag }); }

  num(x, y, v, crit, color) {
    if (this.nums.length > 80) this.nums.shift();
    this.nums.push({ x: x + rand(-6, 6), y, v: Math.round(v), crit, c: color || (crit ? '#ffd23a' : '#ffffff'), t: 0, life: crit ? 0.9 : 0.65, vx: rand(-30, 30) });
  }

  text(x, y, txt, color = '#ffffff', big = false) {
    this.nums.push({ x, y, v: txt, txt: true, crit: big, c: color, t: 0, life: 1.1, vx: 0 });
  }

  splat(x, y, c, r = 24, life = 6) {
    if (this.ground.length > 120) this.ground.shift();
    const blobs = [];
    for (let i = 0; i < 6; i++) blobs.push([rand(-r * 0.7, r * 0.7), rand(-r * 0.35, r * 0.35), rand(r * 0.3, r * 0.6)]);
    this.ground.push({ k: 'splat', x, y, c, r, blobs, t: 0, life });
  }
  decal(o) { this.ground.push({ t: 0, ...o }); }

  // A scoop that melted off: flies off in an arc, spins, lands with a splat.
  dropScoop(x, y, z, flavor, dir = 1) {
    this.parts.push({ k: 'scoop', flavor, x, y, z, vx: dir * rand(90, 160), vy: rand(-30, 30), vz: rand(260, 340), rot: 0, vr: dir * rand(5, 9), t: 0, life: 3 });
  }

  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.t += dt;
      if (p.t >= p.life) { this.parts.splice(i, 1); continue; }
      if (p.k === 'scoop') {
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= 900 * dt; p.rot += p.vr * dt;
        if (p.z <= 0) {
          const c = (FLAVOR[p.flavor] || FLAVOR.milk).c;
          this.splat(p.x, p.y, c, 30, 8);
          this.burst(p.x, p.y, 14, { c, sp: 160, r: 4, vz: 200, grav: 700, life: 0.6 });
          this.parts.splice(i, 1);
        }
        continue;
      }
      if (p.k === 'ring' || p.k === 'line') continue;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy *= d;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.grav) { p.vz -= p.grav * dt; p.z = Math.max(0, p.z + p.vz * dt); if (p.z === 0) p.vz *= -0.3; }
      else if (p.vz) p.z += p.vz * dt;
      p.rot += p.vr * dt;
    }
    for (let i = this.ground.length - 1; i >= 0; i--) {
      const s = this.ground[i];
      s.t += dt;
      if (s.t >= s.life) this.ground.splice(i, 1);
    }
    for (let i = this.nums.length - 1; i >= 0; i--) {
      const n = this.nums[i];
      n.t += dt;
      n.x += n.vx * dt;
      if (n.t >= n.life) this.nums.splice(i, 1);
    }
  }

  drawGround(g) {
    for (const s of this.ground) {
      const a = clamp((s.life - s.t) / 1.2, 0, 1) * clamp(s.t * 8, 0, 1);
      if (s.k === 'splat') {
        g.fillStyle = rgba(s.c, 0.75 * a);
        for (const [bx, by, br] of s.blobs) { g.beginPath(); g.ellipse(s.x + bx, s.y + by, br, br * 0.55, 0, 0, TAU); g.fill(); }
        g.fillStyle = `rgba(255,255,255,${0.35 * a})`;
        g.beginPath(); g.ellipse(s.x - s.r * 0.2, s.y - s.r * 0.12, s.r * 0.25, s.r * 0.08, 0, 0, TAU); g.fill();
      } else if (s.k === 'ice') {
        const k = clamp(s.t * 6, 0, 1);
        g.fillStyle = `rgba(200,240,255,${0.45 * a})`;
        g.strokeStyle = `rgba(255,255,255,${0.7 * a})`;
        g.lineWidth = 2;
        g.beginPath(); g.ellipse(s.x, s.y, s.r * k, s.r * 0.6 * k, 0, 0, TAU); g.fill(); g.stroke();
      } else if (s.k === 'scorch') {
        g.fillStyle = `rgba(120,40,30,${0.25 * a})`;
        g.beginPath(); g.ellipse(s.x, s.y, s.r, s.r * 0.6, 0, 0, TAU); g.fill();
      } else if (s.k === 'warn') {
        const k = clamp(s.t / s.life, 0, 1);
        g.strokeStyle = `rgba(255,90,70,${0.8})`;
        g.fillStyle = `rgba(255,90,70,${0.12 + k * 0.2})`;
        g.lineWidth = 3;
        g.beginPath(); g.ellipse(s.x, s.y, s.r, s.r * 0.62, 0, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = 'rgba(255,90,70,0.3)';
        g.beginPath(); g.ellipse(s.x, s.y, s.r * k, s.r * 0.62 * k, 0, 0, TAU); g.fill();
      }
    }
  }

  drawAir(g) {
    for (const p of this.parts) {
      const k = p.t / p.life;
      if (p.k === 'ring') {
        const r = p.r0 + (p.r - p.r0) * (1 - Math.pow(1 - k, 3));
        g.globalAlpha = 1 - k;
        if (p.fill) { g.fillStyle = p.fill; g.beginPath(); g.ellipse(p.x, p.y, r, r * 0.62, 0, 0, TAU); g.fill(); }
        g.strokeStyle = p.c; g.lineWidth = p.w * (1 - k * 0.7);
        g.beginPath(); g.ellipse(p.x, p.y, r, r * 0.62, 0, 0, TAU); g.stroke();
        g.globalAlpha = 1;
      } else if (p.k === 'line') {
        g.globalAlpha = 1 - k;
        g.strokeStyle = p.c; g.lineWidth = p.w * (1 - k);
        g.beginPath(); g.moveTo(p.x, p.y);
        if (p.jag) {
          const n = 5;
          for (let i = 1; i < n; i++) {
            const t = i / n;
            g.lineTo(p.x + (p.x2 - p.x) * t + rand(-9, 9), p.y + (p.y2 - p.y) * t + rand(-9, 9));
          }
        }
        g.lineTo(p.x2, p.y2); g.stroke();
        g.globalAlpha = 1;
      } else if (p.k === 'scoop') {
        g.save();
        g.translate(p.x, p.y - p.z);
        g.rotate(p.rot);
        g.scale(0.55, 0.55);
        drawSprite(g, scoopSprite(p.flavor));
        g.restore();
      } else if (p.k === 'puff') {
        g.globalAlpha = (1 - k) * 0.8;
        g.fillStyle = p.c;
        g.beginPath(); g.arc(p.x, p.y - p.z, p.r * (0.6 + k * 0.8), 0, TAU); g.fill();
        g.globalAlpha = 1;
      } else if (p.k === 'star') {
        const s = p.r * (p.shrink ? 1 - k : 1);
        g.save(); g.translate(p.x, p.y - p.z); g.rotate(p.rot);
        g.fillStyle = p.c;
        g.beginPath();
        g.moveTo(0, -s); g.quadraticCurveTo(0, 0, s, 0); g.quadraticCurveTo(0, 0, 0, s); g.quadraticCurveTo(0, 0, -s, 0); g.quadraticCurveTo(0, 0, 0, -s);
        g.fill(); g.restore();
      } else {
        const r = p.r * (p.shrink ? 1 - k * 0.8 : 1);
        g.fillStyle = p.c;
        g.beginPath(); g.arc(p.x, p.y - p.z, r, 0, TAU); g.fill();
      }
    }
  }

  drawNums(g) {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const n of this.nums) {
      const k = n.t / n.life;
      const pop = easeOutBack(clamp(n.t * 6, 0, 1), 3);
      const s = (n.crit && !n.txt ? 1.45 : 1) * pop * (1 - Math.max(0, k - 0.7) * 2);
      const y = n.y - 18 - n.t * 46 + Math.pow(n.t, 2) * 30;
      g.save();
      g.translate(n.x, y);
      g.scale(s, s);
      g.font = '20px Jua, sans-serif';
      g.lineWidth = 4;
      g.strokeStyle = 'rgba(70,30,50,0.85)';
      if (n.txt) g.font = (n.crit ? '24px' : '17px') + ' Jua, sans-serif';
      const txt = n.txt ? n.v : n.crit ? n.v + '!' : String(n.v);
      g.strokeText(txt, 0, 0);
      g.fillStyle = n.c;
      g.fillText(txt, 0, 0);
      g.restore();
    }
  }
}
