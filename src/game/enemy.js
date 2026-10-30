// Enemy actors and their behaviours. Every enemy wobbles on a squash spring, flashes white when
// hit, gets knocked back, and can be slowed, frozen or stunned by flavor traits.
import { ENEMIES } from '../data/enemies.js';
import { Spring } from '../core/spring.js';
import { TAU, clamp, rand } from '../core/math.js';
import { drawEnemyFrame, glowOf } from '../render/enemyArt.js';
import { sfx } from '../core/audio.js';

let nextId = 1;
// set by the arena on co-op guests so crowd-control from local traits reaches the host
export const NET = { cc: null };

export class Enemy {
  constructor(type, x, y, { hpMul = 1, dmgMul = 1, elite = false } = {}) {
    const d = ENEMIES[type];
    this.id = nextId++;
    this.type = type;
    this.d = d;
    this.art = d.art || type;
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.kx = 0; this.ky = 0; // knockback velocity
    this.elite = elite;
    const em = elite ? 1.45 : 1;
    this.r = d.r * em;
    this.size = Math.round(d.size * em);
    this.maxHp = this.hp = d.hp * hpMul * (elite ? 4 : 1);
    this.dmg = d.dmg * dmgMul * (elite ? 1.3 : 1);
    this.spd = d.spd * rand(0.9, 1.1);
    this.t = rand(1);
    this.sq = new Spring(1, 260, 9);
    this.flash = 0;
    this.slowT = 0; this.slowAmt = 0;
    this.freezeT = 0; this.stunT = 0;
    this.st = { t: rand(0, 1.5), phase: 0 }; // ai state
    this.spawnT = 0.35;
    this.dead = false;
    this.alpha = 1;
  }

  get frozen() { return this.freezeT > 0; }
  get disabled() { return this.freezeT > 0 || this.stunT > 0; }

  applySlow(amt, dur, net) { if (amt >= this.slowAmt || this.slowT <= 0) { this.slowAmt = amt; } this.slowT = Math.max(this.slowT, dur); if (NET.cc && !net && dur > 0.4) NET.cc(this, 'slow', amt, dur); }
  freeze(dur, net) { if (this.d.boss) dur *= 0.3; this.freezeT = Math.max(this.freezeT, dur); if (NET.cc && !net) NET.cc(this, 'freeze', dur); }
  stun(dur, net) { if (this.d.boss) dur *= 0.3; this.stunT = Math.max(this.stunT, dur); if (NET.cc && !net) NET.cc(this, 'stun', dur); }
  knock(dx, dy, f) {
    const d = Math.hypot(dx, dy) || 1;
    const res = this.d.boss ? 0.08 : this.d.heavy ? 0.35 : 1;
    this.kx += (dx / d) * f * res;
    this.ky += (dy / d) * f * res;
  }

  update(dt, A) {
    this.t += dt * (this.disabled ? 0 : 1);
    this.flash = Math.max(0, this.flash - dt * 8);
    this.sq.update(dt);
    this.slowT -= dt; if (this.slowT <= 0) this.slowAmt = 0;
    this.freezeT -= dt; this.stunT -= dt;
    if (this.spawnT > 0) { this.spawnT -= dt; }

    const kd = Math.exp(-9 * dt);
    this.kx *= kd; this.ky *= kd;
    let mx = 0, my = 0;
    if (this.net) {
      // co-op guest: glide toward the host's position for this enemy
      const f = Math.min(1, dt * 10);
      const dx = (this.net.x - this.x) * f, dy = (this.net.y - this.y) * f;
      this.x += dx; this.y += dy;
      this.vx = dx / Math.max(dt, 1e-3);
      this.kx = this.ky = 0;
    } else if (!this.disabled && this.spawnT <= 0) {
      const tgt = A.targetFor(this);
      const sp = this.spd * (1 - this.slowAmt);
      const r = AI[this.d.ai](this, A, tgt, dt, sp);
      if (r) { mx = r[0]; my = r[1]; }
    }
    if (!this.net) {
      this.vx = mx; this.vy = my;
      this.x += (mx + this.kx) * dt;
      this.y += (my + this.ky) * dt;
      A.keepInside(this);
    }

    // contact damage
    if (!this.disabled && this.spawnT <= 0 && this.d.ai !== 'bomber') {
      for (const p of A.players) {
        if (!p.alive || !p.local) continue;
        const dx = p.x - this.x, dy = (p.y - 10) - this.y;
        if (dx * dx + dy * dy < (this.r + p.r) ** 2) { if (p.hurt(A, this.dmg, this)) this.sq.kick(4); }
      }
    }
  }

  draw(g, A) {
    const bob = this.d.ai === 'drift' || this.d.boss === true && this.type === 'hazequeen' ? Math.sin(this.t * 3) * 6 : 0;
    const hop = this.st.hopZ || 0;
    const sp = this.spawnT > 0 ? 1 - this.spawnT / 0.35 : 1;
    g.save();
    g.translate(this.x, this.y);
    // ground shadow
    g.fillStyle = 'rgba(80,40,60,0.2)';
    g.beginPath(); g.ellipse(0, this.r * 0.55, this.r * 1.05, this.r * 0.38, 0, 0, TAU); g.fill();
    if (this.elite) {
      g.strokeStyle = `rgba(255,214,90,${0.5 + Math.sin(this.t * 6) * 0.3})`;
      g.lineWidth = 3;
      g.beginPath(); g.ellipse(0, this.r * 0.55, this.r * 1.25, this.r * 0.48, 0, 0, TAU); g.stroke();
    }
    g.translate(0, -this.r * 0.35 - hop + bob);
    const s = clamp(this.sq.value, 0.6, 1.5);
    const face = this.vx < -5 ? -1 : 1;
    g.scale((1 / Math.sqrt(s)) * sp * face, s * sp);
    g.globalAlpha = this.alpha;
    if (this.d.glow || this.type === 'ember' || this.type === 'sunling' || this.d.boss) {
      const gr = g.createRadialGradient(0, 0, this.size * 0.4, 0, 0, this.size * 1.9);
      gr.addColorStop(0, `${hexA(glowOf(this.art), 0.35)}`); gr.addColorStop(1, `${hexA(glowOf(this.art), 0)}`);
      g.fillStyle = gr; g.fillRect(-this.size * 2, -this.size * 2, this.size * 4, this.size * 4);
    }
    drawEnemyFrame(g, this.art, this.size, this.t * (this.d.boss ? 0.6 : 1.1), this.flash);
    g.globalAlpha = 1;
    if (this.frozen) {
      g.fillStyle = 'rgba(190,235,255,0.55)';
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2;
      g.beginPath(); g.roundRect(-this.size * 1.15, -this.size * 1.15, this.size * 2.3, this.size * 2.3, this.size * 0.5); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(-this.size * 0.8, -this.size * 0.9, this.size * 0.3, this.size * 0.9);
    } else if (this.stunT > 0) {
      g.fillStyle = '#6d4027';
      for (let i = 0; i < 3; i++) { const a = this.t * 0 + performance.now() / 200 + i * 2.1; g.beginPath(); g.arc(Math.cos(a) * this.size * 0.8, -this.size * 1.2 + Math.sin(a) * 4, 3, 0, TAU); g.fill(); }
    }
    g.restore();
    // telegraphs
    if (this.st.tele) {
      const T = this.st.tele;
      g.strokeStyle = `rgba(255,90,70,${0.4 + Math.sin(performance.now() / 50) * 0.2})`;
      g.lineWidth = this.r * 1.2;
      g.lineCap = 'round';
      g.beginPath(); g.moveTo(this.x, this.y); g.lineTo(this.x + Math.cos(T.a) * T.len, this.y + Math.sin(T.a) * T.len); g.stroke();
    }
    // health bar for elites and wounded enemies
    if ((this.elite || this.hp < this.maxHp) && !this.d.boss) {
      const w = Math.max(26, this.r * 2);
      const y = this.y - this.r * 0.35 - this.size * 1.35 - hop;
      g.fillStyle = 'rgba(60,30,40,0.5)'; g.beginPath(); g.roundRect(this.x - w / 2, y, w, 5, 2.5); g.fill();
      g.fillStyle = this.elite ? '#ffd35a' : '#ff7a8a'; g.beginPath(); g.roundRect(this.x - w / 2, y, w * clamp(this.hp / this.maxHp, 0, 1), 5, 2.5); g.fill();
    }
    void A;
  }
}

function hexA(h, a) { const n = parseInt(h.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }

function toward(e, tgt, sp) {
  if (!tgt) return [0, 0];
  const dx = tgt.x - e.x, dy = tgt.y - 10 - e.y, d = Math.hypot(dx, dy) || 1;
  return [(dx / d) * sp, (dy / d) * sp, d, Math.atan2(dy, dx)];
}

const AI = {
  chase(e, A, tgt, dt, sp) { return toward(e, tgt, sp); },
  tank(e, A, tgt, dt, sp) { return toward(e, tgt, sp); },
  swarm(e, A, tgt, dt, sp) {
    const [vx, vy, d] = toward(e, tgt, sp);
    const w = Math.sin(e.t * 5 + e.id) * (d > 80 ? 0.7 : 0.2);
    return [vx - vy * w, vy + vx * w];
  },
  drift(e, A, tgt, dt, sp) {
    const s = e.st;
    s.t += dt;
    // fades into a shimmer and glides faster for a moment every few seconds
    const cyc = s.t % 4.5;
    const fast = cyc > 3.4;
    e.alpha = fast ? 0.35 : 0.92;
    const [vx, vy] = toward(e, tgt, sp * (fast ? 2.4 : 1));
    const w = Math.sin(e.t * 2.2 + e.id) * 0.6;
    return [vx - vy * w, vy + vx * w];
  },
  shooter(e, A, tgt, dt, sp) {
    const s = e.st;
    const [vx, vy, d, a] = toward(e, tgt, sp);
    s.t += dt;
    if (s.t > 2.3) {
      s.t = 0;
      e.sq.kick(-5);
      const n = e.elite ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const aa = a + (i - (n - 1) / 2) * 0.25;
        A.addEnemyProj({ x: e.x, y: e.y - e.size * 0.4, vx: Math.cos(aa) * 230, vy: Math.sin(aa) * 230, r: 8, dmg: e.dmg * 1.1, life: 3.5, kind: 'orb' });
      }
    }
    if (d < 220) return [-vx * 0.8, -vy * 0.8];
    if (d < 300) return [-vy * 0.4, vx * 0.4];
    return [vx, vy];
  },
  hopper(e, A, tgt, dt, sp) {
    const s = e.st;
    s.t += dt;
    const period = 1.1;
    const ph = s.t % period;
    if (ph < 0.5) {
      const k = ph / 0.5;
      s.hopZ = Math.sin(k * Math.PI) * e.r * 1.6;
      if (!s.going) { s.going = true; e.sq.kick(5); s.dir = toward(e, tgt, 1); }
      return [s.dir[0] * sp * 2.6, s.dir[1] * sp * 2.6];
    }
    if (s.going) { s.going = false; s.hopZ = 0; e.sq.kick(-6); }
    return [0, 0];
  },
  dasher(e, A, tgt, dt, sp) {
    const s = e.st;
    const [vx, vy, d, a] = toward(e, tgt, sp);
    if (s.mode === 'tele') {
      s.t += dt;
      s.tele.a = a; s.tele.len = 260;
      if (s.t > 0.65) { s.mode = 'dash'; s.t = 0; s.a = a; s.tele = null; e.sq.kick(6); }
      return [0, 0];
    }
    if (s.mode === 'dash') {
      s.t += dt;
      if (s.t > 0.42) { s.mode = null; s.t = 0; s.cd = 1.5; }
      return [Math.cos(s.a) * 620, Math.sin(s.a) * 620];
    }
    s.cd = (s.cd || 0) - dt;
    if (d < 260 && s.cd <= 0) { s.mode = 'tele'; s.t = 0; s.tele = { a, len: 260 }; }
    return [vx, vy];
  },
  bomber(e, A, tgt, dt, sp) {
    const s = e.st;
    const [vx, vy, d] = toward(e, tgt, sp);
    if (s.fuse != null) {
      s.fuse -= dt;
      e.sq.target = 1 + Math.sin(e.t * 40) * 0.15;
      if (s.fuse <= 0) {
        e.dead = true;
        A.enemyExplode(e, e.x, e.y, 95, e.dmg);
      }
      return [vx * 0.2, vy * 0.2];
    }
    if (d < 70) { s.fuse = 0.7; A.warn(e.x, e.y, 95, 0.7); }
    return [vx, vy];
  },

  // ── bosses ──
  sunboss(e, A, tgt, dt, sp) {
    const s = e.st;
    s.t += dt;
    const [vx, vy, d, a] = toward(e, tgt, sp);
    s.pat = s.pat || 0;
    if (s.t > 2.8) {
      s.t = 0;
      e.sq.kick(-6);
      const pat = s.pat++ % 3;
      if (pat === 0) { // ring of heat orbs
        const n = 18;
        for (let i = 0; i < n; i++) { const aa = (i / n) * TAU; A.addEnemyProj({ x: e.x, y: e.y, vx: Math.cos(aa) * 200, vy: Math.sin(aa) * 200, r: 10, dmg: e.dmg * 0.6, life: 5, kind: 'orb' }); }
        sfx.boom();
      } else if (pat === 1) { // spiral
        s.spiral = 1.6;
      } else { // summon embers
        for (let i = 0; i < 6; i++) A.spawnEnemy('ember', e.x + rand(-80, 80), e.y + rand(-80, 80));
      }
    }
    if (s.spiral > 0) {
      s.spiral -= dt;
      s.sa = (s.sa || 0) + dt * 7;
      s.st2 = (s.st2 || 0) + dt;
      if (s.st2 > 0.07) { s.st2 = 0; for (const k of [0, Math.PI]) A.addEnemyProj({ x: e.x, y: e.y, vx: Math.cos(s.sa + k) * 240, vy: Math.sin(s.sa + k) * 240, r: 9, dmg: e.dmg * 0.5, life: 4, kind: 'orb' }); }
      return [0, 0];
    }
    void a;
    return d > 200 ? [vx, vy] : [vx * 0.3, vy * 0.3];
  },
  slimeking(e, A, tgt, dt, sp) {
    const s = e.st;
    s.t += dt;
    if (s.jump) {
      const J = s.jump;
      J.t += dt;
      const k = clamp(J.t / J.dur, 0, 1);
      s.hopZ = Math.sin(k * Math.PI) * 220;
      e.x = J.x0 + (J.x1 - J.x0) * k; e.y = J.y0 + (J.y1 - J.y0) * k;
      if (k >= 1) {
        s.jump = null; s.hopZ = 0; e.sq.kick(-9);
        A.enemyExplode(e, e.x, e.y, 170, e.dmg * 1.2, { noKill: true });
        for (let i = 0; i < 3; i++) A.spawnEnemy('minislime', e.x + rand(-60, 60), e.y + rand(-60, 60));
      }
      return [0, 0];
    }
    const [vx, vy] = toward(e, tgt, sp);
    if (s.t > 3.2 && tgt) {
      s.t = 0;
      s.jump = { t: 0, dur: 1.1, x0: e.x, y0: e.y, x1: tgt.x, y1: tgt.y };
      A.warn(tgt.x, tgt.y, 170, 1.1);
      e.sq.kick(6);
    }
    return [vx, vy];
  },
  hazequeen(e, A, tgt, dt, sp) {
    const s = e.st;
    s.t += dt;
    const [vx, vy, d, a] = toward(e, tgt, sp);
    e.alpha = s.fade ? 0.3 : 0.95;
    if (s.t > 3 && tgt) {
      s.t = 0;
      s.n = (s.n || 0) + 1;
      if (s.n % 2) { // vanish and reappear near the target
        A.fx.burst(e.x, e.y, 20, { c: '#e8b6ff', sp: 200, r: 6, life: 0.6 });
        const aa = rand(TAU);
        e.x = tgt.x + Math.cos(aa) * 280; e.y = tgt.y + Math.sin(aa) * 280;
        A.keepInside(e);
        e.sq.kick(8);
        for (let i = 0; i < 4; i++) A.spawnEnemy('haze', e.x + rand(-90, 90), e.y + rand(-90, 90));
      } else { // fan of haze bolts
        for (let i = -3; i <= 3; i++) A.addEnemyProj({ x: e.x, y: e.y, vx: Math.cos(a + i * 0.16) * 260, vy: Math.sin(a + i * 0.16) * 260, r: 10, dmg: e.dmg * 0.6, life: 4, kind: 'orb' });
      }
    }
    const w = Math.sin(e.t * 1.6) * 0.8;
    return d > 180 ? [vx - vy * w, vy + vx * w] : [-vy * 0.8, vx * 0.8];
  },
};
