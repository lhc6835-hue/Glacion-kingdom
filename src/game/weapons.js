// Weapon behaviours. Every weapon kind has its own attack pattern and its own animation, built
// on springs and eased curves so swings snap out fast and settle with a soft overshoot.
import { Spring } from '../core/spring.js';
import { TAU, clamp, easeOutCubic, easeOutBack, rand, wrapAngle, rgba, lerp } from '../core/math.js';
import { sfx } from '../core/audio.js';
import { scoopSprite } from '../render/scoopArt.js';
import { drawSprite } from '../render/sprite.js';

export function makeWeapon(def, owner) {
  const C = KINDS[def.kind] || Swing;
  return new C(def, owner);
}

class Base {
  constructor(def, owner) {
    this.def = def;
    this.p = owner;
    this.cd = 0;
    this.aim = 0;
    this.ang = new Spring(0, 260, 20); // displayed angle (springy follow)
    this.kick = new Spring(0, 420, 18); // recoil along the aim axis
    this.lift = new Spring(0, 200, 14);
    this.t = 0;
  }
  get st() { return this.p.stats; }
  dmg(mul = 1) { return this.def.dmg * this.st.dmg * this.st.weaponMul * mul; }
  cooldown(mul = 1) { return (this.def.cd * mul) / this.st.atk; }
  pivot() { return { x: this.p.x, y: this.p.y - 30 * this.p.scaleK }; }
  hand(dist = 24) {
    const pv = this.pivot();
    const a = this.ang.value;
    return { x: pv.x + Math.cos(a) * (dist + this.kick.value), y: pv.y + Math.sin(a) * (dist + this.kick.value) * 0.85 - this.lift.value };
  }
  update(dt, A, held, pressed) {
    this.t += dt;
    this.cd -= dt;
    this.aim = this.p.aim;
    this.ang.target = this.ang.value + wrapAngle(this.aim - this.ang.value);
    this.ang.update(dt);
    this.kick.update(dt);
    this.lift.update(dt);
    this.tick(dt, A, held, pressed);
  }
  tick() {}
  // weapons draw behind the body when pointing up (away from the camera)
  behind() { return Math.sin(this.ang.value) < -0.25; }
  draw() {}
  fan(n, spread) { const out = []; for (let i = 0; i < n; i++) out.push(n === 1 ? 0 : (i / (n - 1) - 0.5) * spread); return out; }
}

// ── 1. swing: three-hit combo with a smeared arc ──────────────────────
class Swing extends Base {
  constructor(def, owner) {
    super(def, owner);
    this.combo = 0;
    this.comboT = 0;
    this.sw = null; // active swing
    this.rest = new Spring(0.9, 160, 13); // resting angle offset
    this.gold = def.kind === 'goldswing';
  }
  tick(dt, A, held) {
    this.comboT -= dt;
    if (this.comboT < 0) this.combo = 0;
    if (held && this.cd <= 0 && !this.sw) this.start(A);
    const s = this.sw;
    if (s) {
      s.t += dt;
      const k = clamp(s.t / s.dur, 0, 1);
      const e = easeOutCubic(k);
      const prev = s.cur;
      s.cur = s.from + (s.to - s.from) * e;
      if (k < 1) this.sweep(A, prev, s.cur, s);
      if (s.t > s.dur + 0.06) { this.sw = null; this.rest.snap(s.to - this.aim); this.rest.target = 0.9 * Math.sign(s.to - s.from || 1) * -1; }
    } else this.rest.update(dt);
  }
  start(A) {
    const big = this.combo === 2;
    const arc = this.def.arc * this.st.area * (big ? 1.25 : 1);
    const dir = this.combo % 2 === 0 ? 1 : -1;
    const base = this.aim;
    this.sw = { from: base - (arc / 2) * dir, to: base + (arc / 2) * dir, cur: base - (arc / 2) * dir, t: 0, dur: big ? 0.2 : 0.15, hit: new Set(), big, range: this.def.range * this.st.area * (big ? 1.2 : 1) };
    this.cd = this.cooldown(big ? 1.5 : 1);
    this.comboT = 0.9;
    this.combo = (this.combo + 1) % 3;
    this.p.lunge(Math.cos(base), Math.sin(base), big ? 260 : 120);
    this.p.rig.punch(Math.cos(base) * dir, 0, big ? 1.4 : 0.8);
    sfx.swing();
    if (this.gold || big) {
      // crescent wave that keeps flying
      const n = 1 + (this.gold ? this.st.proj : 0);
      for (const off of this.fan(n, 0.35)) {
        const a = base + off;
        A.addProj(this.p, { x: this.p.x + Math.cos(a) * 30, y: this.p.y - 20 + Math.sin(a) * 30, vx: Math.cos(a) * 640, vy: Math.sin(a) * 640, r: this.gold ? 34 : 22, dmg: this.dmg(this.gold ? 0.8 : 0.5), life: this.gold ? 0.5 : 0.28, pierce: 99, kind: 'crescent', color: this.gold ? '#ffd35a' : '#ffffff', rot: a, drag: 2 });
      }
    }
  }
  sweep(A, a0, a1, s) {
    const pv = { x: this.p.x, y: this.p.y - 16 };
    const lo = Math.min(a0, a1) - 0.15, hi = Math.max(a0, a1) + 0.15;
    A.queryCircle(pv.x, pv.y, s.range + 30, (e) => {
      if (s.hit.has(e)) return;
      const d = Math.hypot(e.x - pv.x, e.y - pv.y) - e.r;
      if (d > s.range) return;
      let a = Math.atan2(e.y - pv.y, e.x - pv.x);
      a = lo + ((((a - lo) % TAU) + TAU) % TAU);
      if (a > hi && d > 26) return;
      s.hit.add(e);
      A.hit(this.p, e, this.dmg(s.big ? 1.6 : 1), { kx: Math.cos(a), ky: Math.sin(a), knock: s.big ? 380 : 220 });
    });
  }
  draw(g) {
    const pv = this.pivot();
    const s = this.sw;
    const a = s ? s.cur : this.aim + this.rest.value;
    const reach = this.def.range * this.st.area * (s && s.big ? 1.2 : 1);
    if (s) {
      // smear: a crescent band from the start angle to the current angle, fading at the tail
      const k = clamp(s.t / s.dur, 0, 1);
      const fade = 1 - clamp((s.t - s.dur) / 0.06, 0, 1);
      const span = s.cur - s.from;
      const tail = s.from + span * Math.max(0, k - 0.75) * 2;
      g.save();
      g.translate(pv.x, pv.y);
      g.scale(1, 0.85);
      const steps = 14;
      for (let i = 0; i < steps; i++) {
        const t0 = i / steps, t1 = (i + 1) / steps;
        const b0 = tail + (s.cur - tail) * t0, b1 = tail + (s.cur - tail) * t1;
        g.fillStyle = this.gold ? `rgba(255,214,90,${0.55 * t1 * fade})` : `rgba(255,255,255,${0.6 * t1 * fade})`;
        g.beginPath();
        g.arc(0, 0, reach, b0, b1, span < 0);
        g.arc(0, 0, reach * (0.45 + 0.25 * t1), b1, b0, span >= 0);
        g.fill();
      }
      g.restore();
    }
    g.save();
    g.translate(pv.x, pv.y);
    g.rotate(a);
    const L = reach * 0.78, sc = this.gold ? 1.35 : 1;
    // spoon: handle + bowl, one rounded silhouette
    g.fillStyle = this.gold ? '#f2c14e' : '#e7c08c';
    g.strokeStyle = this.gold ? '#a8741c' : '#a5703e';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(8, -3 * sc);
    g.lineTo(L - 16 * sc, -2.6 * sc);
    g.bezierCurveTo(L - 12 * sc, -12 * sc, L + 10 * sc, -12 * sc, L + 10 * sc, 0);
    g.bezierCurveTo(L + 10 * sc, 12 * sc, L - 12 * sc, 12 * sc, L - 16 * sc, 2.6 * sc);
    g.lineTo(8, 3 * sc);
    g.quadraticCurveTo(4, 0, 8, -3 * sc);
    g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath(); g.ellipse(L - 1 * sc, -3 * sc, 5 * sc, 2.4 * sc, 0, 0, TAU); g.fill();
    if (this.gold) { g.fillStyle = '#fff6dc'; g.beginPath(); g.arc(L - 2, 1, 6, 0, TAU); g.fill(); }
    g.restore();
  }
}

// ── 2. rapid: chocolate-chip blaster ─────────────────────────────────
class Rapid extends Base {
  tick(dt, A, held) {
    if (held && this.cd <= 0) {
      this.cd = this.cooldown();
      const n = 1 + this.st.proj;
      for (const off of this.fan(n, 0.22)) {
        const a = this.aim + off + rand(-this.def.spread, this.def.spread);
        const h = this.hand(30);
        A.addProj(this.p, { x: h.x, y: h.y, vx: Math.cos(a) * this.def.speed, vy: Math.sin(a) * this.def.speed, r: 7, dmg: this.dmg(), life: 0.7, pierce: this.st.pierce, kind: 'chip', color: '#4a2c1c', rot: a });
      }
      this.kick.kick(-260);
      this.p.rig.punch(Math.cos(this.aim) * 0.3, 0, 0.25);
      A.fx.dot(this.hand(38).x, this.hand(38).y, { c: '#fff4c2', r: 5, sp: 30, life: 0.08 });
      sfx.shoot();
    }
  }
  draw(g) { drawGun(g, this.hand(18), this.ang.value, '#8a5a3c', '#ffcfe0', 1); }
}

function drawGun(g, h, a, body, accent, size = 1, barrel = 1) {
  g.save();
  g.translate(h.x, h.y);
  g.rotate(a);
  if (Math.cos(a) < 0) g.scale(1, -1);
  g.scale(size, size);
  g.fillStyle = body;
  g.strokeStyle = 'rgba(60,30,30,0.7)';
  g.lineWidth = 1.8;
  g.beginPath(); g.roundRect(-8, -7, 26 + 6 * barrel, 13, 6); g.fill(); g.stroke();
  g.fillStyle = accent;
  g.beginPath(); g.roundRect(-4, 2, 9, 11, 4); g.fill(); g.stroke();
  g.beginPath(); g.roundRect(16 + 6 * barrel, -5, 8, 9, 3); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.beginPath(); g.roundRect(-4, -5, 18, 3, 1.5); g.fill();
  g.restore();
}

// ── 3. shotgun: sprinkle spread ───────────────────────────────────────
const SPRINKLE_COLS = ['#ff8fb4', '#ffe066', '#8fd3ff', '#b69cff', '#7ee0b0', '#ffffff'];
class Shotgun extends Base {
  tick(dt, A, held) {
    if (held && this.cd <= 0) {
      this.cd = this.cooldown();
      const n = this.def.pellets + this.st.proj * 2;
      const h = this.hand(32);
      for (let i = 0; i < n; i++) {
        const a = this.aim + (i / (n - 1) - 0.5) * this.def.spread + rand(-0.05, 0.05);
        const sp = this.def.speed * rand(0.85, 1.1);
        A.addProj(this.p, { x: h.x, y: h.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 7, dmg: this.dmg(), life: 0.42, pierce: this.st.pierce, kind: 'sprinkle', color: SPRINKLE_COLS[i % SPRINKLE_COLS.length], rot: a, drag: 2.2, falloff: true, knock: 160 });
      }
      this.kick.kick(-700);
      this.lift.kick(260);
      this.p.lunge(-Math.cos(this.aim), -Math.sin(this.aim), 140);
      this.p.rig.punch(-Math.cos(this.aim), 0, 1);
      A.shake(4);
      for (let i = 0; i < 8; i++) A.fx.dot(h.x, h.y, { a: this.aim + rand(-0.6, 0.6), sp: rand(120, 300), c: SPRINKLE_COLS[i % 6], r: 2.5, life: 0.25 });
      sfx.shoot(); sfx.pop();
    }
  }
  draw(g) { drawGun(g, this.hand(18), this.ang.value - this.lift.value * 0.01, '#ff9cc4', '#fff3b0', 1.15, 0.6); }
}

// ── 4. boomerang cone ─────────────────────────────────────────────────
class Boomerang extends Base {
  constructor(def, owner) { super(def, owner); this.out = 0; }
  tick(dt, A, held) {
    if (held && this.cd <= 0 && this.out === 0) {
      const n = 1 + this.st.proj;
      this.cd = this.cooldown();
      for (const off of this.fan(n, 0.5)) {
        const a = this.aim + off, h = this.hand(26);
        this.out++;
        A.addProj(this.p, {
          x: h.x, y: h.y, vx: Math.cos(a) * 720, vy: Math.sin(a) * 720, r: 18 * this.st.area, dmg: this.dmg(), life: 3, pierce: 999, kind: 'boomer', rot: 0, vr: 22,
          boom: { t: 0, out: this.def.range / 720, owner: this.p, leg: 0 },
          onExpire: () => { this.out = Math.max(0, this.out - 1); },
        });
      }
      this.p.rig.punch(Math.cos(this.aim), 0, 0.8);
      sfx.swing();
    }
  }
  draw(g) {
    if (this.out > 0) return;
    const h = this.hand(22);
    g.save(); g.translate(h.x, h.y); g.rotate(this.ang.value + Math.PI / 2 + Math.sin(this.t * 4) * 0.1);
    drawConeShape(g, 0.6);
    g.restore();
  }
}
export function drawConeShape(g, s = 1) {
  g.save(); g.scale(s, s);
  g.fillStyle = '#e2a95d'; g.strokeStyle = '#8a5a2c'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(-16, -18); g.lineTo(16, -18); g.quadraticCurveTo(6, 4, 0, 22); g.quadraticCurveTo(-6, 4, -16, -18); g.fill(); g.stroke();
  g.strokeStyle = 'rgba(140,80,30,0.6)'; g.lineWidth = 1.2;
  for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 7, -18); g.lineTo(i * 7 + 10, 6); g.stroke(); }
  g.fillStyle = '#ffb7c9'; g.beginPath(); g.arc(0, -20, 13, Math.PI, 0); g.fill();
  g.restore();
}

// ── 5. thrust: popsicle lance ─────────────────────────────────────────
class Thrust extends Base {
  constructor(def, owner) { super(def, owner); this.th = null; this.ext = new Spring(0, 300, 16); }
  tick(dt, A, held) {
    if (held && this.cd <= 0 && !this.th) {
      this.th = { t: 0, hit: new Set(), a: this.aim };
      this.cd = this.cooldown();
      this.ext.kick(-180);
    }
    const th = this.th;
    if (th) {
      th.t += dt;
      if (th.t > 0.07 && !th.fired) {
        th.fired = true;
        this.ext.vel += 2600;
        this.p.lunge(Math.cos(th.a), Math.sin(th.a), 330);
        this.p.rig.punch(Math.cos(th.a), 0, 1.2);
        sfx.swing();
      }
      if (th.fired && th.t < 0.26) {
        const range = this.def.range * this.st.area;
        const pv = this.pivot();
        const x2 = pv.x + Math.cos(th.a) * (24 + range), y2 = pv.y + Math.sin(th.a) * (24 + range);
        A.querySegment(pv.x, pv.y, x2, y2, 20, (e) => {
          if (th.hit.has(e)) return;
          th.hit.add(e);
          A.hit(this.p, e, this.dmg(), { kx: Math.cos(th.a), ky: Math.sin(th.a), knock: 300 });
        });
      }
      if (th.t > 0.32) this.th = null;
    }
    this.ext.target = 0;
    this.ext.update(dt);
  }
  draw(g) {
    const pv = this.pivot();
    const a = this.th ? this.th.a : this.ang.value;
    const range = this.def.range * this.st.area;
    const L = 26 + clamp(this.ext.value / 2600, -0.2, 1) * range * 0.75;
    g.save(); g.translate(pv.x, pv.y); g.rotate(a);
    g.fillStyle = '#f0d3a6'; g.strokeStyle = '#a5703e'; g.lineWidth = 1.8;
    g.beginPath(); g.roundRect(0, -3, L + 8, 6, 3); g.fill(); g.stroke();
    // the popsicle bar: pastel two-tone with a bitten corner
    g.fillStyle = '#ff9ec4';
    g.beginPath(); g.roundRect(L, -11, 46, 22, 10); g.fill();
    g.fillStyle = '#a8e6ff';
    g.beginPath(); g.roundRect(L + 22, -11, 24, 22, [0, 10, 10, 0]); g.fill();
    g.strokeStyle = 'rgba(150,50,90,0.6)'; g.lineWidth = 1.8;
    g.beginPath(); g.roundRect(L, -11, 46, 22, 10); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.roundRect(L + 5, -8, 30, 4, 2); g.fill();
    if (this.th && this.th.fired && this.th.t < 0.2) {
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.beginPath(); g.moveTo(L + 46, -14); g.lineTo(L + 46 + 50, 0); g.lineTo(L + 46, 14); g.fill();
    }
    g.restore();
  }
}

// ── 6. bouncer: jelly blaster ─────────────────────────────────────────
const JELLY = ['#ff7aa8', '#ffcf4a', '#7ee0b0', '#8fb8ff', '#c89cff'];
class Bouncer extends Base {
  tick(dt, A, held) {
    if (held && this.cd <= 0) {
      this.cd = this.cooldown();
      const n = 1 + this.st.proj;
      for (const off of this.fan(n, 0.3)) {
        const a = this.aim + off, h = this.hand(30);
        A.addProj(this.p, { x: h.x, y: h.y, vx: Math.cos(a) * this.def.speed, vy: Math.sin(a) * this.def.speed, r: 11 * this.st.area, dmg: this.dmg(), life: 2.2, pierce: 0, kind: 'jelly', color: JELLY[(Math.random() * JELLY.length) | 0], bounces: this.def.bounces + this.st.pierce, sq: new Spring(1, 300, 9) });
      }
      this.kick.kick(-380);
      this.p.rig.punch(Math.cos(this.aim) * 0.5, 0, 0.5);
      sfx.pop();
    }
  }
  draw(g) { drawGun(g, this.hand(18), this.ang.value, '#8fd8ff', '#ff9cc4', 1.1, 0.3); }
}

// ── 7. lob: cherry bomb ───────────────────────────────────────────────
class Lob extends Base {
  tick(dt, A, held) {
    if (held && this.cd <= 0) {
      this.cd = this.cooldown();
      const tgt = A.aimPoint(this.p, 80, 420);
      const n = 1 + this.st.proj;
      for (let i = 0; i < n; i++) {
        const tx = tgt.x + (i ? rand(-60, 60) : 0), ty = tgt.y + (i ? rand(-60, 60) : 0);
        const h = this.hand(20);
        const T = 0.55;
        A.addProj(this.p, {
          x: h.x, y: h.y + 20, z: 20, vx: (tx - h.x) / T, vy: (ty - h.y - 20) / T, vz: 380, grav: 380 * 2 / T + 40 / T, r: 0, dmg: this.dmg(), life: T, pierce: 999, kind: 'cherry', noHit: true, rot: 0, vr: 9,
          onExpire: (A, p) => A.explode(this.p, p.x, p.y, this.def.radius * this.st.area, p.dmg, { color: '#ff4d6d', knock: 360 }),
        });
        A.fx.decal({ k: 'warn', x: tx, y: ty, r: this.def.radius * this.st.area, life: T });
      }
      this.lift.kick(500);
      this.p.rig.punch(Math.cos(this.aim) * 0.7, 0, 0.7);
      sfx.swing();
    }
  }
  draw(g) {
    if (this.cd > this.cooldown() * 0.6) return;
    const h = this.hand(22);
    drawCherry(g, h.x, h.y, 0.9, Math.sin(this.t * 3) * 0.2);
  }
}
export function drawCherry(g, x, y, s = 1, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  g.strokeStyle = '#5a8a3a'; g.lineWidth = 2.4;
  g.beginPath(); g.moveTo(0, -8); g.quadraticCurveTo(3, -18, 9, -22); g.stroke();
  g.fillStyle = '#7ec850'; g.beginPath(); g.ellipse(12, -21, 6, 3, -0.4, 0, TAU); g.fill();
  g.fillStyle = '#e8304f'; g.strokeStyle = '#8a1a2c'; g.lineWidth = 1.6;
  g.beginPath(); g.arc(0, 0, 10, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(-3.5, -3.5, 3.4, 2, -0.6, 0, TAU); g.fill();
  g.restore();
}

// ── 8. whip: syrup lash ───────────────────────────────────────────────
class Whip extends Base {
  constructor(def, owner) {
    super(def, owner);
    this.N = 16;
    this.pts = Array.from({ length: this.N }, () => ({ x: owner.x, y: owner.y, px: owner.x, py: owner.y }));
    this.lash = null;
  }
  tick(dt, A, held) {
    if (held && this.cd <= 0 && !this.lash) {
      this.lash = { t: 0, a: this.aim, hit: new Set(), dir: Math.random() < 0.5 ? 1 : -1 };
      this.cd = this.cooldown();
      sfx.swing();
    }
    const pv = this.pivot();
    const range = this.def.range * this.st.area;
    const L = this.lash;
    // target shape: when lashing, a travelling wave sweeps the whip from behind to the aim line
    for (let i = 0; i < this.N; i++) {
      const u = i / (this.N - 1);
      let a, d;
      if (L) {
        const lt = clamp((L.t - u * 0.09) / 0.2, 0, 1);
        const e = easeOutBack(lt, 1.4);
        a = L.a + L.dir * (1 - e) * 2.4;
        d = u * range * (0.25 + 0.75 * clamp(lt * 1.4, 0, 1));
      } else {
        a = this.ang.value + Math.PI * 0.55 + Math.sin(this.t * 2.5 + u * 3) * 0.15;
        d = u * 46;
      }
      const tx = pv.x + Math.cos(a) * d, ty = pv.y + Math.sin(a) * d * 0.85 + (L ? 0 : u * u * 14);
      const p = this.pts[i];
      p.x += (tx - p.x) * Math.min(1, dt * (L ? 40 : 16));
      p.y += (ty - p.y) * Math.min(1, dt * (L ? 40 : 16));
    }
    if (L) {
      L.t += dt;
      if (L.t > 0.08 && L.t < 0.34) {
        for (let i = 4; i < this.N; i += 2) {
          const p = this.pts[i];
          const tip = i >= this.N - 3;
          A.queryCircle(p.x, p.y + 14, 16 * this.st.area, (e) => {
            if (L.hit.has(e)) return;
            L.hit.add(e);
            A.hit(this.p, e, this.dmg(tip ? 1.25 : 0.8), { kx: Math.cos(L.a), ky: Math.sin(L.a), knock: 200, crit: tip ? true : undefined });
            if (tip) { A.fx.ring(p.x, p.y + 14, 30, '#ffe1a6', { life: 0.2, w: 4 }); sfx.crit(); }
          });
        }
      }
      if (L.t > 0.2 && !L.cracked) { L.cracked = true; const tp = this.pts[this.N - 1]; A.fx.burst(tp.x, tp.y, 6, { c: ['#e9a24a', '#ffe1a6'], sp: 160, r: 3, life: 0.3 }); this.p.rig.punch(Math.cos(L.a), 0, 0.8); }
      if (L.t > 0.42) this.lash = null;
    }
  }
  draw(g) {
    g.save();
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < this.N; i++) {
        const a = this.pts[i - 1], b = this.pts[i];
        const u = i / this.N;
        g.strokeStyle = pass ? '#f0b45a' : 'rgba(120,60,20,0.65)';
        g.lineWidth = (pass ? 7 : 10) * (1 - u * 0.7);
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      }
    }
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(this.pts[1].x, this.pts[1].y - 1.5);
    for (let i = 2; i < this.N - 3; i++) g.lineTo(this.pts[i].x, this.pts[i].y - 1.5);
    g.stroke();
    const t = this.pts[this.N - 1];
    g.fillStyle = '#e9a24a'; g.beginPath(); g.arc(t.x, t.y, 4.5, 0, TAU); g.fill();
    const h = this.pts[0];
    g.fillStyle = '#8a5a3c'; g.beginPath(); g.arc(h.x, h.y, 6, 0, TAU); g.fill();
    g.restore();
  }
}

// ── 9. spray: whipped cream ───────────────────────────────────────────
class Spray extends Base {
  tick(dt, A, held) {
    this.on = held;
    if (held && this.cd <= 0) {
      this.cd = this.cooldown();
      const h = this.hand(34);
      const n = 1 + Math.ceil(this.st.proj / 2);
      for (let i = 0; i < n; i++) {
        const a = this.aim + rand(-0.32, 0.32);
        const sp = rand(380, 460);
        A.addProj(this.p, { x: h.x, y: h.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 10, grow: 30 * this.st.area, dmg: this.dmg(), life: (this.def.range / 420) * this.st.area, pierce: 999, kind: 'cream', drag: 2.6, slow: { amt: 0.4, dur: 0.8 }, knock: 60, rehit: 0.25 });
      }
      this.kick.kick(-50);
      if (Math.random() < 0.3) sfx.pop();
    }
  }
  draw(g) {
    const h = this.hand(14);
    g.save(); g.translate(h.x, h.y); g.rotate(this.ang.value); if (Math.cos(this.ang.value) < 0) g.scale(1, -1);
    g.fillStyle = '#e6eef8'; g.strokeStyle = 'rgba(80,90,120,0.7)'; g.lineWidth = 1.8;
    g.beginPath(); g.roundRect(-12, -9, 30, 18, 8); g.fill(); g.stroke();
    g.fillStyle = '#ff9cc4'; g.beginPath(); g.roundRect(-6, -9, 8, 18, 2); g.fill();
    g.fillStyle = '#ffffff'; g.strokeStyle = 'rgba(80,90,120,0.7)';
    g.beginPath(); g.moveTo(18, -5); g.lineTo(32, -3); g.lineTo(32, 3); g.lineTo(18, 5); g.closePath(); g.fill(); g.stroke();
    if (this.on) { g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(35, 0, 4 + Math.sin(this.t * 40) * 1.5, 0, TAU); g.fill(); }
    g.restore();
  }
}

// ── 10. hammer: lollipop slam ─────────────────────────────────────────
class Hammer extends Base {
  constructor(def, owner) { super(def, owner); this.sl = null; this.swingA = new Spring(0, 200, 16); }
  tick(dt, A, held) {
    if (held && this.cd <= 0 && !this.sl) {
      this.sl = { t: 0, a: this.aim };
      this.cd = this.cooldown();
      this.p.rig.squash.kick(3);
    }
    const s = this.sl;
    const wind = 0.3 / Math.sqrt(this.st.atk);
    if (s) {
      s.t += dt;
      if (s.t < wind) { this.swingA.target = -2.2; this.p.rig.squash.target = 1.12; }
      else if (!s.done) {
        s.done = true;
        this.swingA.vel += 70;
        this.swingA.target = 0.25;
        this.p.rig.squash.target = 1;
        this.p.rig.squash.kick(-6);
        const pv = this.pivot();
        const x = pv.x + Math.cos(s.a) * 70, y = this.p.y + Math.sin(s.a) * 60;
        const R = this.def.radius * this.st.area;
        A.explode(this.p, x, y, R, this.dmg(), { color: '#ffb3d1', knock: 420, stun: 0.7, ring: '#ffffff', noScorch: true });
        A.fx.burst(x, y, 18, { c: ['#ff8fb4', '#ffffff', '#ffe066'], sp: 340, r: 4, vz: 260, grav: 900, life: 0.7 });
        A.shake(10); A.hitstop(0.07); sfx.heavy();
      }
      if (s.t > wind + 0.35) { this.sl = null; this.swingA.target = 0; }
    }
    this.swingA.update(dt);
  }
  draw(g) {
    const pv = this.pivot();
    const a = (this.sl ? this.sl.a : this.ang.value);
    const side = Math.cos(a) >= 0 ? 1 : -1;
    g.save(); g.translate(pv.x, pv.y);
    g.rotate(a + this.swingA.value * side);
    const L = 58;
    g.fillStyle = '#ffffff'; g.strokeStyle = 'rgba(120,80,90,0.7)'; g.lineWidth = 1.6;
    g.beginPath(); g.roundRect(4, -3, L, 6, 3); g.fill(); g.stroke();
    g.save(); g.translate(L + 18, 0); g.rotate(this.t * 0.8);
    g.fillStyle = '#ff7aa8'; g.beginPath(); g.arc(0, 0, 22, 0, TAU); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 5;
    g.beginPath(); for (let i = 0; i < 40; i++) { const t = i / 40, r = t * 19; g.lineTo(Math.cos(t * 12) * r, Math.sin(t * 12) * r); } g.stroke();
    g.strokeStyle = 'rgba(140,30,70,0.7)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 22, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.ellipse(-8, -9, 6, 3, -0.6, 0, TAU); g.fill();
    g.restore();
    g.restore();
  }
}

// ── 11. beam: soda laser ──────────────────────────────────────────────
class Beam extends Base {
  constructor(def, owner) { super(def, owner); this.charge = 0; this.tickT = 0; this.len = 0; }
  tick(dt, A, held) {
    if (held) this.charge = Math.min(1, this.charge + dt / 0.35);
    else this.charge = Math.max(0, this.charge - dt * 4);
    this.firing = held && this.charge >= 1;
    const range = this.def.range * this.st.area;
    this.len += ((this.firing ? range : 0) - this.len) * Math.min(1, dt * (this.firing ? 22 : 12));
    if (held && this.charge < 1 && Math.random() < 0.6) {
      const h = this.hand(40);
      A.fx.dot(h.x + rand(-30, 30), h.y + rand(-30, 30), { c: 'rgba(200,245,255,0.9)', r: rand(2, 4), sp: 0, life: 0.2 });
    }
    this.tickT -= dt;
    if (this.firing && this.tickT <= 0) {
      this.tickT = this.cooldown();
      const h = this.hand(36);
      const n = 1 + this.st.proj;
      for (const off of this.fan(n, 0.16)) {
        const a = this.aim + off;
        A.querySegment(h.x, h.y, h.x + Math.cos(a) * this.len, h.y + Math.sin(a) * this.len, 18 * this.st.area, (e) => {
          A.hit(this.p, e, this.dmg(), { kx: Math.cos(a), ky: Math.sin(a), knock: 40, quiet: true });
        });
      }
      this.kick.kick(-30);
      sfx.zap();
    }
  }
  draw(g) {
    const h = this.hand(16);
    drawGun(g, h, this.ang.value, '#7fd8ff', '#c4f3ff', 1.15, 1);
    if (this.len > 4) {
      const m = this.hand(40);
      const n = 1 + this.st.proj;
      for (const off of this.fan(n, 0.16)) {
        const a = this.aim + off;
        const w = 12 + Math.sin(this.t * 50) * 3;
        g.save(); g.translate(m.x, m.y); g.rotate(a);
        g.fillStyle = 'rgba(140,230,255,0.45)'; g.beginPath(); g.roundRect(0, -w, this.len, w * 2, w); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.roundRect(0, -w * 0.35, this.len, w * 0.7, w * 0.35); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.8)';
        for (let i = 0; i < 8; i++) { const x = ((this.t * 600 + i * 83) % this.len); g.beginPath(); g.arc(x, Math.sin(i * 9 + this.t * 20) * w * 0.8, 2 + (i % 3), 0, TAU); g.fill(); }
        g.restore();
      }
    }
    if (this.charge > 0 && this.charge < 1) {
      const m = this.hand(40);
      g.fillStyle = `rgba(200,245,255,${this.charge * 0.8})`;
      g.beginPath(); g.arc(m.x, m.y, 4 + this.charge * 8, 0, TAU); g.fill();
    }
  }
}

// ── 12. bow: candy cane ───────────────────────────────────────────────
class Bow extends Base {
  constructor(def, owner) { super(def, owner); this.draw01 = 0; this.wasHeld = false; this.str = new Spring(0, 500, 14); }
  tick(dt, A, held) {
    if (held && this.cd <= 0) this.draw01 = Math.min(1, this.draw01 + (dt * this.st.atk) / 0.65);
    if (!held && this.wasHeld && this.draw01 > 0.05) this.release(A);
    if (!held) this.draw01 = Math.max(0, this.draw01 - dt * 5);
    this.wasHeld = held;
    this.str.target = this.draw01;
    this.str.update(dt);
  }
  release(A) {
    const c = this.draw01, full = c >= 1;
    const n = (full ? 3 : 1) + this.st.proj;
    const h = this.hand(26);
    for (const off of this.fan(n, full ? 0.22 : 0.12)) {
      const a = this.aim + off;
      const sp = this.def.speed * (0.55 + c * 0.45);
      A.addProj(this.p, { x: h.x, y: h.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 8, dmg: this.dmg(0.35 + c * 0.65), life: 0.9, pierce: (full ? 3 : 0) + this.st.pierce, kind: 'arrow', rot: a, knock: 120 + c * 160, trail: full });
    }
    this.draw01 = 0;
    this.cd = this.cooldown();
    this.str.vel = -30;
    this.p.rig.punch(-Math.cos(this.aim) * 0.5, 0, 0.6);
    sfx.shoot(); if (full) sfx.crit();
  }
  draw(g) {
    const h = this.hand(20);
    const pull = clamp(this.str.value, -0.3, 1);
    g.save(); g.translate(h.x, h.y); g.rotate(this.ang.value);
    // bow limbs: candy-cane stripes along a curve
    g.lineCap = 'round';
    const bend = 10 + pull * 6;
    const path = () => { g.beginPath(); g.moveTo(-6, -30); g.quadraticCurveTo(bend + 6, 0, -6, 30); };
    g.strokeStyle = 'rgba(140,30,50,0.7)'; g.lineWidth = 9; path(); g.stroke();
    g.strokeStyle = '#ffffff'; g.lineWidth = 6; path(); g.stroke();
    g.strokeStyle = '#ff4d6d'; g.lineWidth = 6; g.setLineDash([5, 6]); path(); g.stroke(); g.setLineDash([]);
    const sx = -6 - pull * 22;
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(-6, -30); g.lineTo(sx, 0); g.lineTo(-6, 30); g.stroke();
    if (this.cd <= 0) {
      g.strokeStyle = '#f0d3a6'; g.lineWidth = 3; g.beginPath(); g.moveTo(sx, 0); g.lineTo(sx + 44, 0); g.stroke();
      g.fillStyle = '#ff9ec4'; g.beginPath(); g.moveTo(sx + 50, 0); g.lineTo(sx + 40, -6); g.lineTo(sx + 40, 6); g.fill();
      if (pull >= 0.99) { g.fillStyle = `rgba(255,240,150,${0.5 + Math.sin(this.t * 20) * 0.3})`; g.beginPath(); g.arc(sx + 46, 0, 9, 0, TAU); g.fill(); }
    }
    g.restore();
  }
}

// ── 13. cloud: cotton candy rain ──────────────────────────────────────
class Cloud extends Base {
  constructor(def, owner) { super(def, owner); this.cx = owner.x; this.cy = owner.y; this.sz = new Spring(0.7, 120, 10); }
  tick(dt, A, held) {
    const tgt = A.aimPoint(this.p, 60, 320);
    this.cx += (tgt.x - this.cx) * Math.min(1, dt * 5);
    this.cy += (tgt.y - this.cy) * Math.min(1, dt * 5);
    this.sz.target = held ? 1.1 : 0.75;
    this.sz.update(dt);
    this.on = held;
    if (held && this.cd <= 0) {
      this.cd = this.cooldown();
      const R = this.def.radius * this.st.area;
      const n = 1 + Math.ceil(this.st.proj / 2);
      for (let i = 0; i < n; i++) {
        const a = rand(TAU), d = Math.sqrt(Math.random()) * R;
        const x = this.cx + Math.cos(a) * d, y = this.cy + Math.sin(a) * d * 0.7;
        A.addProj(this.p, { x, y, z: 120, vx: 0, vy: 0, vz: -520, grav: 400, r: 0, dmg: this.dmg(), life: 0.24, pierce: 999, kind: 'raindrop', noHit: true, color: JELLY[i % 5],
          onExpire: (A, p) => A.explode(this.p, p.x, p.y, 34 * this.st.area, p.dmg, { color: p.color, knock: 40, small: true }) });
      }
    }
  }
  draw(g) {
    const s = this.sz.value;
    const bob = Math.sin(this.t * 2.4) * 5;
    g.save(); g.translate(this.cx, this.cy - 120 + bob);
    g.fillStyle = 'rgba(120,80,140,0.12)';
    g.restore();
    g.fillStyle = 'rgba(160,110,170,0.16)';
    g.beginPath(); g.ellipse(this.cx, this.cy, this.def.radius * this.st.area, this.def.radius * this.st.area * 0.6, 0, 0, TAU); g.fill();
    g.save(); g.translate(this.cx, this.cy - 120 + bob); g.scale(s, s);
    for (const [x, y, r, c] of [[-34, 6, 22, '#c9dcff'], [30, 8, 22, '#ffc2dc'], [-12, -8, 28, '#ffd6ea'], [14, -10, 26, '#d6e4ff'], [0, 10, 24, '#ffe0ef']]) {
      g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,0.65)'; g.beginPath(); g.ellipse(-14, -18, 14, 6, -0.3, 0, TAU); g.fill();
    if (this.on) { g.fillStyle = '#5a3a4a'; g.beginPath(); g.arc(-6, 2, 2, 0, TAU); g.arc(6, 2, 2, 0, TAU); g.fill(); }
    g.restore();
    // the wand in hand
    const h = this.hand(20);
    g.save(); g.translate(h.x, h.y); g.rotate(this.ang.value - 0.6);
    g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 0); g.lineTo(30, 0); g.stroke();
    g.fillStyle = '#ffc2dc'; g.beginPath(); g.arc(36, 0, 9, 0, TAU); g.fill();
    g.fillStyle = '#c9dcff'; g.beginPath(); g.arc(41, -4, 6, 0, TAU); g.fill();
    g.restore();
  }
}

// ── 14. scoop launcher ────────────────────────────────────────────────
class ScoopLauncher extends Base {
  tick(dt, A, held) {
    if (held && this.cd <= 0) {
      this.cd = this.cooldown();
      const n = 1 + this.st.proj;
      for (const off of this.fan(n, 0.3)) {
        const a = this.aim + off, h = this.hand(34);
        const fl = this.p.rig.look.flavors.length ? this.p.rig.look.flavors[this.p.rig.look.flavors.length - 1] : 'vanilla';
        A.addProj(this.p, {
          x: h.x, y: h.y, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, r: 16, dmg: this.dmg(), life: 0.75, pierce: 0, kind: 'bigscoop', flavor: fl, rot: 0, vr: 6,
          onExpire: (A, p) => {
            const R = this.def.radius * this.st.area;
            A.explode(this.p, p.x, p.y, R, p.dmg, { color: '#bfeaff', knock: 260, noScorch: true });
            A.addArea({ k: 'ice', x: p.x, y: p.y, r: R * 1.1, life: 3, slow: 0.6, tick: 0.5, dmg: p.dmg * 0.15, owner: this.p });
            A.fx.decal({ k: 'ice', x: p.x, y: p.y, r: R * 1.1, life: 3 });
            sfx.freeze();
          },
        });
      }
      this.kick.kick(-600);
      this.p.rig.punch(-Math.cos(this.aim), 0, 1);
      A.shake(3);
      sfx.pop();
    }
  }
  draw(g) {
    const h = this.hand(14);
    g.save(); g.translate(h.x, h.y); g.rotate(this.ang.value); if (Math.cos(this.ang.value) < 0) g.scale(1, -1);
    g.fillStyle = '#c9d3e0'; g.strokeStyle = 'rgba(60,70,90,0.7)'; g.lineWidth = 1.8;
    g.beginPath(); g.roundRect(-10, -5, 26, 10, 5); g.fill(); g.stroke();
    g.fillStyle = '#e8eef6'; g.beginPath(); g.arc(28, 0, 13, -Math.PI / 2 - 1.2, Math.PI / 2 + 1.2); g.closePath(); g.fill(); g.stroke();
    if (this.cd < this.cooldown() * 0.5) {
      const fl = this.p.rig.look.flavors.length ? this.p.rig.look.flavors[this.p.rig.look.flavors.length - 1] : 'vanilla';
      g.save(); g.translate(30, 0); g.scale(0.4, 0.4); drawSprite(g, scoopSprite(fl)); g.restore();
    }
    g.restore();
  }
}

// ── 15. ribbon: aurora ────────────────────────────────────────────────
class Ribbon extends Base {
  constructor(def, owner) { super(def, owner); this.trails = [[], []]; this.rot = 0; this.hitT = new Map(); }
  tick(dt, A, held) {
    this.rot += dt * 3.2;
    const R = 70 * this.st.area;
    for (let k = 0; k < 2; k++) {
      const a = this.rot + k * Math.PI;
      const x = this.p.x + Math.cos(a) * R, y = this.p.y - 20 + Math.sin(a) * R * 0.62;
      const tr = this.trails[k];
      tr.unshift({ x, y });
      if (tr.length > 14) tr.pop();
      A.queryCircle(x, y + 10, 18, (e) => {
        const t = this.hitT.get(e) || 0;
        if (this.t - t < 0.45) return;
        this.hitT.set(e, this.t);
        A.hit(this.p, e, this.dmg(0.35), { kx: Math.cos(a + 1.57), ky: Math.sin(a + 1.57), knock: 120, quiet: true });
      });
    }
    if (this.hitT.size > 300) this.hitT.clear();
    if (held && this.cd <= 0) {
      this.cd = this.cooldown();
      const n = 1 + this.st.proj;
      for (const off of this.fan(n, 0.4)) {
        const a = this.aim + off;
        A.addProj(this.p, { x: this.p.x, y: this.p.y - 22, vx: Math.cos(a) * 620, vy: Math.sin(a) * 620, r: 30 * this.st.area, dmg: this.dmg(), life: this.def.range / 620, pierce: 999, kind: 'crescent', color: '#8affd0', rot: a, aurora: true });
      }
      this.p.rig.punch(Math.cos(this.aim), 0, 0.8);
      sfx.swing();
    }
  }
  draw(g) {
    const cols = ['#7affc8', '#8fc8ff', '#d8a6ff'];
    this.trails.forEach((tr) => {
      for (let i = 1; i < tr.length; i++) {
        g.strokeStyle = rgba(cols[i % 3], 0.85 * (1 - i / tr.length));
        g.lineWidth = 10 * (1 - i / tr.length) + 2;
        g.lineCap = 'round';
        g.beginPath(); g.moveTo(tr[i - 1].x, tr[i - 1].y); g.lineTo(tr[i].x, tr[i].y); g.stroke();
      }
    });
  }
}

// ── 16. orbitals: galaxy macarons + black hole ───────────────────────
const MAC = ['#ffb3cf', '#b8e4ff', '#d6c2ff', '#fff0a6', '#b8f0c8'];
class Orbitals extends Base {
  constructor(def, owner) { super(def, owner); this.rot = 0; this.hitT = new Map(); this.pos = []; }
  tick(dt, A, held, pressed) {
    this.rot += dt * 2.4;
    const n = 3 + this.st.proj;
    const R = 76 * this.st.area;
    this.pos = [];
    for (let i = 0; i < n; i++) {
      const a = this.rot + (i / n) * TAU;
      const x = this.p.x + Math.cos(a) * R, y = this.p.y - 20 + Math.sin(a) * R * 0.62 + Math.sin(this.t * 3 + i) * 4;
      this.pos.push({ x, y, c: MAC[i % MAC.length], a });
      A.queryCircle(x, y + 12, 18, (e) => {
        const key = e.id * 10 + i;
        const t = this.hitT.get(key) || 0;
        if (this.t - t < 0.5) return;
        this.hitT.set(key, this.t);
        A.hit(this.p, e, this.dmg(0.45), { kx: Math.cos(a), ky: Math.sin(a), knock: 180, quiet: true });
      });
    }
    if (this.hitT.size > 500) this.hitT.clear();
    if ((held || pressed) && this.cd <= 0) {
      this.cd = this.cooldown();
      const tgt = A.aimPoint(this.p, 60, 380);
      A.addArea({ k: 'hole', x: tgt.x, y: tgt.y, r: this.def.radius * this.st.area, life: 1.8, pull: 520, tick: 0.2, dmg: this.dmg(0.35), owner: this.p, end: this.dmg(1.5) });
      sfx.boom();
    }
  }
  draw(g) {
    for (const p of this.pos) {
      g.save(); g.translate(p.x, p.y);
      g.fillStyle = 'rgba(60,40,80,0.15)'; g.beginPath(); g.ellipse(0, 24, 9, 3, 0, 0, TAU); g.fill();
      g.fillStyle = p.c; g.strokeStyle = 'rgba(80,50,90,0.6)'; g.lineWidth = 1.4;
      g.beginPath(); g.ellipse(0, -4, 11, 6, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#fff8f0'; g.fillRect(-10, -1, 20, 3);
      g.fillStyle = p.c; g.beginPath(); g.ellipse(0, 5, 11, 6, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.ellipse(-4, -6, 4, 1.6, 0, 0, TAU); g.fill();
      g.restore();
    }
  }
}

const KINDS = {
  swing: Swing, goldswing: Swing, rapid: Rapid, shotgun: Shotgun, boomerang: Boomerang, thrust: Thrust, bouncer: Bouncer,
  lob: Lob, whip: Whip, spray: Spray, hammer: Hammer, beam: Beam, bow: Bow, cloud: Cloud, scooplauncher: ScoopLauncher,
  ribbon: Ribbon, orbitals: Orbitals,
};

// ── projectile drawing (used by the arena) ────────────────────────────
export function drawProjectile(g, p) {
  switch (p.kind) {
    case 'chip':
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
      g.fillStyle = p.color; g.beginPath(); g.moveTo(9, 0); g.quadraticCurveTo(0, -7, -6, -4); g.quadraticCurveTo(-8, 0, -6, 4); g.quadraticCurveTo(0, 7, 9, 0); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.arc(-1, -2, 1.6, 0, TAU); g.fill();
      g.restore(); break;
    case 'sprinkle':
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
      g.strokeStyle = p.color; g.lineWidth = 6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-7, 0); g.lineTo(7, 0); g.stroke();
      g.restore(); break;
    case 'boomer':
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot); drawConeShape(g, 0.85); g.restore();
      break;
    case 'jelly': {
      const sp = Math.hypot(p.vx, p.vy) || 1;
      const s = p.sq ? p.sq.value : 1;
      g.save(); g.translate(p.x, p.y); g.rotate(Math.atan2(p.vy, p.vx));
      g.scale(1 / s, s);
      g.fillStyle = rgba(p.color, 0.85); g.strokeStyle = rgba(p.color, 1); g.lineWidth = 2;
      g.beginPath(); g.arc(0, 0, p.r, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(-p.r * 0.3, -p.r * 0.35, p.r * 0.35, p.r * 0.2, 0, 0, TAU); g.fill();
      g.restore(); void sp; break;
    }
    case 'cherry':
      g.fillStyle = 'rgba(70,30,40,0.2)'; g.beginPath(); g.ellipse(p.x, p.y, 10, 4, 0, 0, TAU); g.fill();
      drawCherry(g, p.x, p.y - p.z, 1, p.rot);
      break;
    case 'cream': {
      const k = p.t / p.life;
      const r = p.r + (p.grow || 0) * k;
      g.fillStyle = `rgba(255,255,255,${0.85 * (1 - k * 0.6)})`;
      g.beginPath(); g.arc(p.x, p.y, r, 0, TAU); g.fill();
      g.fillStyle = `rgba(255,220,235,${0.5 * (1 - k)})`;
      g.beginPath(); g.arc(p.x + r * 0.3, p.y + r * 0.2, r * 0.5, 0, TAU); g.fill();
      break;
    }
    case 'arrow':
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
      if (p.trail) { g.strokeStyle = 'rgba(255,240,160,0.6)'; g.lineWidth = 6; g.beginPath(); g.moveTo(-40, 0); g.lineTo(0, 0); g.stroke(); }
      g.strokeStyle = '#f0d3a6'; g.lineWidth = 3; g.beginPath(); g.moveTo(-18, 0); g.lineTo(10, 0); g.stroke();
      g.fillStyle = '#ff9ec4'; g.beginPath(); g.moveTo(16, 0); g.lineTo(6, -6); g.lineTo(6, 6); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(-18, 0); g.lineTo(-24, -5); g.lineTo(-14, 0); g.lineTo(-24, 5); g.fill();
      g.restore(); break;
    case 'raindrop':
      g.fillStyle = 'rgba(70,30,60,0.15)'; g.beginPath(); g.ellipse(p.x, p.y, 6, 2.5, 0, 0, TAU); g.fill();
      g.fillStyle = p.color; g.beginPath(); g.arc(p.x, p.y - p.z, 5, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(p.x - 1.5, p.y - p.z - 1.5, 1.5, 0, TAU); g.fill();
      break;
    case 'bigscoop':
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(0.6, 0.6); drawSprite(g, scoopSprite(p.flavor)); g.restore();
      break;
    case 'crescent': {
      const k = p.t / p.life;
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(1, 1);
      g.globalAlpha = 1 - k * 0.7;
      if (p.aurora) {
        const gr = g.createLinearGradient(0, -p.r, 0, p.r);
        gr.addColorStop(0, '#7affc8'); gr.addColorStop(0.5, '#8fc8ff'); gr.addColorStop(1, '#d8a6ff');
        g.fillStyle = gr;
      } else g.fillStyle = p.color;
      g.beginPath();
      g.arc(-p.r * 0.5, 0, p.r, -1.25, 1.25);
      g.arc(-p.r * 0.95, 0, p.r * 0.92, 1.1, -1.1, true);
      g.fill();
      g.globalAlpha = 1;
      g.restore(); break;
    }
    case 'orb': {
      const pulse = 1 + Math.sin(p.t * 20) * 0.12;
      g.fillStyle = 'rgba(255,150,60,0.35)'; g.beginPath(); g.arc(p.x, p.y, p.r * 1.8 * pulse, 0, TAU); g.fill();
      g.fillStyle = '#ff8a3a'; g.beginPath(); g.arc(p.x, p.y, p.r * pulse, 0, TAU); g.fill();
      g.fillStyle = '#fff0a0'; g.beginPath(); g.arc(p.x, p.y, p.r * 0.5, 0, TAU); g.fill();
      break;
    }
    case 'shard':
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
      g.fillStyle = p.color || '#bfeaff'; g.beginPath(); g.moveTo(8, 0); g.lineTo(-4, -4); g.lineTo(-4, 4); g.fill();
      g.restore(); break;
    case 'turret':
      g.fillStyle = rgba(p.color || '#b48cff', 0.4); g.beginPath(); g.arc(p.x, p.y, p.r * 1.7, 0, TAU); g.fill();
      g.fillStyle = p.color || '#b48cff'; g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(p.x - 2, p.y - 2, p.r * 0.35, 0, TAU); g.fill();
      break;
    default:
      g.fillStyle = p.color || '#fff'; g.beginPath(); g.arc(p.x, p.y, p.r || 5, 0, TAU); g.fill();
  }
}

