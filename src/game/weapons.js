// Weapon behaviours. Every attack is a small timeline — anticipation (a quick cock-back),
// the strike on a sharp ease-out with overshoot, follow-through, and an eased recovery —
// plus springs for recoil and squash, afterimage ghosts and impact feedback.
import { Spring } from '../core/spring.js';
import { TAU, clamp, easeOutCubic, easeOutBack, easeInOutCubic, rand, wrapAngle, rgba, lerp } from '../core/math.js';
import { sfx } from '../core/audio.js';
import { scoopSprite } from '../render/scoopArt.js';
import { drawSprite } from '../render/sprite.js';

const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const easeInExpo = (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10));
const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
const easeInBack = (t, s = 1.7) => (s + 1) * t * t * t - s * t * t;

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
    this.ang = new Spring(0, 300, 17); // displayed angle: follows the aim with a little lag
    this.kick = new Spring(0, 520, 15); // recoil along the barrel
    this.tilt = new Spring(0, 380, 13); // recoil rotation (muzzle flips up)
    this.pump = new Spring(1, 520, 11); // squash/stretch of the weapon itself
    this.lift = new Spring(0, 220, 14);
    this.flashT = 0;
    this.t = 0;
    this.ghosts = [];
  }
  get st() { return this.p.stats; }
  dmg(mul = 1) { return this.def.dmg * this.st.dmg * this.st.weaponMul * mul; }
  cooldown(mul = 1) { return (this.def.cd * mul) / this.st.atk; }
  side() { return Math.cos(this.ang.value) >= 0 ? 1 : -1; }
  pivot() { return { x: this.p.x, y: this.p.y - 30 * this.p.scaleK }; }
  hand(dist = 24) {
    const pv = this.pivot();
    const a = this.ang.value;
    const d = dist + this.kick.value;
    return { x: pv.x + Math.cos(a) * d, y: pv.y + Math.sin(a) * d * 0.85 - this.lift.value + Math.sin(this.t * 3.1) * 1.2 };
  }
  update(dt, A, held, pressed) {
    this.t += dt;
    this.cd -= dt;
    this.flashT -= dt;
    this.aim = this.p.aim;
    this.ang.target = this.ang.value + wrapAngle(this.aim - this.ang.value);
    this.ang.update(dt);
    this.kick.update(dt);
    this.tilt.update(dt);
    this.pump.update(dt);
    this.lift.update(dt);
    for (const gh of this.ghosts) gh.life -= dt;
    this.ghosts = this.ghosts.filter((gh) => gh.life > 0);
    this.tick(dt, A, held, pressed);
  }
  tick() {}
  behind() { return Math.sin(this.ang.value) < -0.25; }
  draw() {}
  fan(n, spread) { const out = []; for (let i = 0; i < n; i++) out.push(n === 1 ? 0 : (i / (n - 1) - 0.5) * spread); return out; }
  ghost(o, life = 0.12) { this.ghosts.push({ ...o, life, max: life }); if (this.ghosts.length > 10) this.ghosts.shift(); }
  // recoil: shove back, flip the muzzle up, squash the body of the gun
  recoil(back, flip, squash = 0.25) {
    this.kick.vel -= back;
    this.tilt.vel -= flip * this.side();
    this.pump.vel -= squash * 30;
    this.flashT = 0.06;
  }
  impact(A, e, strength = 1) {
    A.hitstop(0.025 * strength);
    A.shake(1.5 * strength);
    for (let i = 0; i < 3 + strength * 2; i++) A.fx.dot(e.x, e.y - e.r * 0.5, { k: 'star', c: i % 2 ? '#ffffff' : '#fff1a6', sp: rand(160, 320), r: rand(4, 7), life: 0.28 });
  }
}

// ── 1. swing: three-hit combo — cock back, whip through with overshoot, settle ─────
class Swing extends Base {
  constructor(def, owner) {
    super(def, owner);
    this.combo = 0;
    this.comboT = 0;
    this.sw = null;
    this.rest = new Spring(0.9, 150, 11);
    this.gold = def.kind === 'goldswing';
    this.cur = 0;
  }
  tick(dt, A, held) {
    this.comboT -= dt;
    if (this.comboT < 0) this.combo = 0;
    if (held && this.cd <= 0 && !this.sw) this.start(A);
    const s = this.sw;
    if (!s) {
      this.rest.update(dt);
      this.cur = this.ang.value + this.rest.value + Math.sin(this.t * 2.2) * 0.06;
      return;
    }
    s.t += dt;
    const prev = this.cur;
    const tw = s.t - s.wind;
    if (s.t < s.wind) {
      // anticipation: cock the spoon back past the start of the arc
      this.cur = lerp(s.a0, s.from - s.dir * 0.35, easeOutCubic(s.t / s.wind));
    } else if (tw < s.dur) {
      const k = tw / s.dur;
      this.cur = lerp(s.from - s.dir * 0.35, s.to, easeOutBack(k, 1.5));
      s.k = k;
      if (!s.fired) {
        s.fired = true;
        this.p.lunge(Math.cos(s.base), Math.sin(s.base), s.big ? 300 : 140);
        this.p.rig.punch(Math.cos(s.base) * s.dir, 0, s.big ? 1.5 : 0.9);
        this.p.rig.lean.kick(s.dir * (s.big ? 5 : 3));
        sfx.swing();
        if (this.gold || s.big) this.wave(A, s);
      }
      this.sweep(A, prev, this.cur, s);
      this.ghost({ a: this.cur, st: 1 + Math.sin(k * Math.PI) * 0.22 }, 0.1);
    } else {
      const k = clamp((tw - s.dur) / s.settle, 0, 1);
      const restA = s.base + s.dir * 0.95;
      this.cur = lerp(s.to, restA, easeInOutCubic(k));
      if (k >= 1) { this.sw = null; this.rest.snap(restA - this.ang.value); this.rest.target = 0.9 * s.dir; }
    }
  }
  start() {
    const big = this.combo === 2;
    const arc = this.def.arc * this.st.area * (big ? 1.3 : 1);
    const dir = this.combo % 2 === 0 ? 1 : -1;
    const base = this.aim;
    this.sw = {
      a0: this.cur, base, dir, from: base - (arc / 2) * dir, to: base + (arc / 2) * dir, t: 0, k: 0,
      wind: big ? 0.11 : 0.06, dur: big ? 0.17 : 0.13, settle: 0.2, hit: new Set(), big,
      range: this.def.range * this.st.area * (big ? 1.2 : 1), first: true,
    };
    this.cd = this.cooldown(big ? 1.5 : 1);
    this.comboT = 1;
    this.combo = (this.combo + 1) % 3;
  }
  wave(A, s) {
    const n = 1 + (this.gold ? this.st.proj : 0);
    for (const off of this.fan(n, 0.35)) {
      const a = s.base + off;
      A.addProj(this.p, { x: this.p.x + Math.cos(a) * 30, y: this.p.y - 20 + Math.sin(a) * 30, vx: Math.cos(a) * 700, vy: Math.sin(a) * 700, r: this.gold ? 34 : 24, dmg: this.dmg(this.gold ? 0.8 : 0.5), life: this.gold ? 0.5 : 0.3, pierce: 99, kind: 'crescent', color: this.gold ? '#ffd35a' : '#ffffff', rot: a, drag: 2.5 });
    }
    if (s.big) A.fx.ring(this.p.x, this.p.y - 10, s.range, this.gold ? '#ffe28a' : '#ffffff', { life: 0.3, w: 6 });
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
      A.hit(this.p, e, this.dmg(s.big ? 1.6 : 1), { kx: Math.cos(a), ky: Math.sin(a), knock: s.big ? 400 : 230 });
      if (s.first) { s.first = false; this.impact(A, e, s.big ? 2.2 : 1); }
    });
  }
  draw(g) {
    const pv = this.pivot();
    const s = this.sw;
    const reach = this.def.range * this.st.area * (s && s.big ? 1.2 : 1);
    if (s && s.fired) {
      // smear: a crescent from where the swing began to the spoon, brightest at the head
      const tw = s.t - s.wind;
      const fade = 1 - clamp((tw - s.dur) / 0.12, 0, 1);
      const tail = lerp(s.from, this.cur, clamp(s.k * 1.3 - 0.35, 0, 0.92));
      const span = this.cur - tail;
      if (fade > 0 && Math.abs(span) > 0.02) {
        g.save();
        g.translate(pv.x, pv.y);
        g.scale(1, 0.85);
        const steps = 18;
        const col = this.gold ? [255, 214, 90] : [255, 255, 255];
        for (let i = 0; i < steps; i++) {
          const t0 = i / steps, t1 = (i + 1) / steps;
          const b0 = tail + span * t0, b1 = tail + span * t1;
          g.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${0.7 * Math.pow(t1, 1.6) * fade})`;
          g.beginPath();
          g.arc(0, 0, reach * 1.02, b0, b1, span < 0);
          g.arc(0, 0, reach * (0.35 + 0.35 * t1), b1, b0, span >= 0);
          g.fill();
        }
        g.strokeStyle = this.gold ? `rgba(255,240,180,${0.9 * fade})` : `rgba(255,255,255,${0.9 * fade})`;
        g.lineWidth = 3;
        g.beginPath(); g.arc(0, 0, reach * 1.02, tail + span * 0.4, this.cur, span < 0); g.stroke();
        g.restore();
      }
    }
    for (const gh of this.ghosts) this.drawSpoon(g, pv, gh.a, reach, gh.st, (gh.life / gh.max) * 0.35);
    const stretch = s && s.fired && s.k < 1 ? 1 + Math.sin(s.k * Math.PI) * 0.22 : 1;
    this.drawSpoon(g, pv, this.cur, reach, stretch, 1);
  }
  drawSpoon(g, pv, a, reach, stretch, alpha) {
    g.save();
    g.globalAlpha = alpha;
    g.translate(pv.x, pv.y);
    g.rotate(a);
    g.scale(stretch, 1 / Math.sqrt(stretch));
    const L = reach * 0.78, sc = this.gold ? 1.35 : 1;
    const body = this.gold ? '#f6c544' : '#efc894', edge = this.gold ? '#b8862a' : '#b07a48';
    const gr = g.createLinearGradient(0, -10 * sc, 0, 10 * sc);
    gr.addColorStop(0, this.gold ? '#fff1b0' : '#fbe2bd'); gr.addColorStop(0.5, body); gr.addColorStop(1, edge);
    g.fillStyle = gr;
    g.strokeStyle = rgba(edge, 0.9);
    g.lineWidth = 1.8;
    g.beginPath();
    g.moveTo(6, -2.6 * sc);
    g.bezierCurveTo(L * 0.4, -3.4 * sc, L * 0.7, -2.2 * sc, L - 16 * sc, -3 * sc);
    g.bezierCurveTo(L - 12 * sc, -13 * sc, L + 11 * sc, -13 * sc, L + 11 * sc, 0);
    g.bezierCurveTo(L + 11 * sc, 13 * sc, L - 12 * sc, 13 * sc, L - 16 * sc, 3 * sc);
    g.bezierCurveTo(L * 0.7, 2.2 * sc, L * 0.4, 3.4 * sc, 6, 2.6 * sc);
    g.quadraticCurveTo(2, 0, 6, -2.6 * sc);
    g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.beginPath(); g.ellipse(L - 1 * sc, -4 * sc, 5.5 * sc, 2.4 * sc, -0.2, 0, TAU); g.fill();
    if (this.gold) { g.fillStyle = '#fff6dc'; g.beginPath(); g.arc(L - 1, 2, 6.5, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(L - 3, 0, 2, 0, TAU); g.fill(); }
    g.restore();
  }
}

// ── shared blaster art ────────────────────────────────────────
// A cute ice-cream blaster: rounded body, scoop tank on top, waffle barrel, grip.
function drawBlaster(w, g, h, { body, tank, barrel = 1, size = 1, nozzle = '#fff4e8' }) {
  const a = w.ang.value + w.tilt.value;
  g.save();
  g.translate(h.x, h.y);
  g.rotate(a);
  if (Math.cos(w.ang.value) < 0) g.scale(1, -1);
  const ps = clamp(w.pump.value, 0.6, 1.5);
  g.scale(size * ps, size / Math.sqrt(ps));
  const len = 22 + 10 * barrel;
  // grip
  g.fillStyle = shade2(body, -0.15);
  g.beginPath(); g.roundRect(-6, 1, 9, 13, 4); g.fill();
  // barrel
  g.fillStyle = '#e2a95d';
  g.beginPath(); g.roundRect(8, -4.5, len, 9, 4); g.fill();
  g.strokeStyle = 'rgba(150,90,40,0.6)'; g.lineWidth = 1;
  for (let x = 12; x < 8 + len; x += 5) { g.beginPath(); g.moveTo(x, -4.5); g.lineTo(x + 3, 4.5); g.stroke(); }
  g.fillStyle = nozzle;
  g.beginPath(); g.roundRect(4 + len, -6.5, 8, 13, 4); g.fill();
  // body
  const gr = g.createLinearGradient(0, -10, 0, 9);
  gr.addColorStop(0, shade2(body, 0.45)); gr.addColorStop(0.5, body); gr.addColorStop(1, shade2(body, -0.25));
  g.fillStyle = gr;
  g.beginPath(); g.roundRect(-12, -8.5, 26, 15, 7.5); g.fill();
  g.strokeStyle = rgba(shade2(body, -0.45), 0.7); g.lineWidth = 1.4; g.stroke();
  // scoop tank
  g.fillStyle = tank;
  g.beginPath(); g.arc(-1, -9, 7, Math.PI, 0); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.beginPath(); g.ellipse(-3, -11.5, 2.4, 1.3, -0.3, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.beginPath(); g.roundRect(-8, -6, 16, 3, 1.5); g.fill();
  // muzzle flash: a quick star with a soft core
  if (w.flashT > 0) {
    const k = 1 - w.flashT / 0.06;
    const r = (10 + 10 * easeOutCubic(k)) * (1 - k * 0.3);
    g.translate(12 + len, 0);
    g.globalAlpha = 1 - k;
    g.fillStyle = '#fff6c2';
    g.beginPath();
    for (let i = 0; i < 10; i++) { const aa = (i / 10) * TAU, rr = i % 2 ? r * 0.4 : r; g.lineTo(Math.cos(aa) * rr * 1.3, Math.sin(aa) * rr); }
    g.closePath(); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0, 0, r * 0.35, 0, TAU); g.fill();
  }
  g.restore();
}
function shade2(h, amt) {
  const n = parseInt(h.slice(1), 16);
  let r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) { r += (255 - r) * amt; gg += (255 - gg) * amt; b += (255 - b) * amt; }
  else { r *= 1 + amt; gg *= 1 + amt; b *= 1 + amt; }
  return '#' + [r, gg, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
}
function muzzle(w, dist) { const h = w.hand(dist); return h; }
function crumbs(A, x, y, a, c) {
  // little bits flicked out of the side of the blaster
  for (let i = 0; i < 2; i++) A.fx.dot(x, y, { a: a + Math.PI / 2 * (i ? 1 : -1) + rand(-0.4, 0.4), sp: rand(60, 140), c, r: 2, vz: 120, grav: 700, life: 0.4 });
}

// ── 2. rapid: chocolate-chip blaster ─────────────────────────────────
class Rapid extends Base {
  tick(dt, A, held) {
    if (held && this.cd <= 0) {
      this.cd = this.cooldown();
      const n = 1 + this.st.proj;
      const h = muzzle(this, 40);
      for (const off of this.fan(n, 0.22)) {
        const a = this.aim + off + rand(-this.def.spread, this.def.spread);
        A.addProj(this.p, { x: h.x, y: h.y, vx: Math.cos(a) * this.def.speed, vy: Math.sin(a) * this.def.speed, r: 7, dmg: this.dmg(), life: 0.7, pierce: this.st.pierce, kind: 'chip', color: '#4a2c1c', rot: a, streak: true });
      }
      this.recoil(220, 3, 0.12);
      this.p.rig.punch(Math.cos(this.aim) * 0.25, 0, 0.2);
      if (Math.random() < 0.5) crumbs(A, h.x, h.y, this.aim, '#6b4027');
      sfx.shoot();
    }
  }
  draw(g) { drawBlaster(this, g, this.hand(16), { body: '#ffb3cc', tank: '#7a4a2c', barrel: 1 }); }
}

// ── 3. shotgun: sprinkle spread with a pump action ─────────────────────
const SPRINKLE_COLS = ['#ff8fb4', '#ffe066', '#8fd3ff', '#b69cff', '#7ee0b0', '#ffffff'];
class Shotgun extends Base {
  constructor(def, owner) { super(def, owner); this.pumpT = 9; }
  tick(dt, A, held) {
    this.pumpT += dt;
    if (held && this.cd <= 0) {
      this.cd = this.cooldown();
      const n = this.def.pellets + this.st.proj * 2;
      const h = muzzle(this, 40);
      for (let i = 0; i < n; i++) {
        const a = this.aim + (i / (n - 1) - 0.5) * this.def.spread + rand(-0.05, 0.05);
        const sp = this.def.speed * rand(0.85, 1.12);
        A.addProj(this.p, { x: h.x, y: h.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 7, dmg: this.dmg(), life: 0.42, pierce: this.st.pierce, kind: 'sprinkle', color: SPRINKLE_COLS[i % SPRINKLE_COLS.length], rot: a, drag: 2.2, falloff: true, knock: 170, streak: true });
      }
      this.recoil(820, 16, 0.45);
      this.lift.vel += 160;
      this.p.lunge(-Math.cos(this.aim), -Math.sin(this.aim), 160);
      this.p.rig.punch(-Math.cos(this.aim), 0, 1.1);
      A.shake(5);
      for (let i = 0; i < 10; i++) A.fx.dot(h.x, h.y, { a: this.aim + rand(-0.7, 0.7), sp: rand(140, 340), c: SPRINKLE_COLS[i % 6], r: 2.6, life: 0.25 });
      A.fx.puff(h.x, h.y, { c: 'rgba(255,255,255,0.7)', r: 12, sp: 40, a: this.aim });
      this.pumpT = 0;
      sfx.shoot(); sfx.pop();
    }
  }
  draw(g) {
    // pump: the fore-end slides back and returns a beat after the shot
    const k = clamp((this.pumpT - 0.12) / 0.26, 0, 1);
    const slide = Math.sin(k * Math.PI) * 7;
    const h = this.hand(16);
    drawBlaster(this, g, h, { body: '#9fd8ff', tank: '#ff8fb4', barrel: 0.7, size: 1.15 });
    g.save(); g.translate(h.x, h.y); g.rotate(this.ang.value + this.tilt.value); if (Math.cos(this.ang.value) < 0) g.scale(1, -1); g.scale(1.15, 1.15);
    g.fillStyle = '#ffe066'; g.strokeStyle = 'rgba(160,120,30,0.7)'; g.lineWidth = 1.2;
    g.beginPath(); g.roundRect(14 - slide, 3.5, 12, 6, 3); g.fill(); g.stroke();
    g.restore();
  }
}

// ── 4. boomerang cone: wind back, fling, catch with a squish ───────────
class Boomerang extends Base {
  constructor(def, owner) { super(def, owner); this.out = 0; this.throwT = 9; this.armed = false; }
  tick(dt, A, held) {
    this.throwT += dt;
    if (held && this.cd <= 0 && this.out === 0 && !this.armed) { this.armed = true; this.throwT = 0; }
    if (this.armed && this.throwT >= 0.08) {
      this.armed = false;
      const n = 1 + this.st.proj;
      this.cd = this.cooldown();
      for (const off of this.fan(n, 0.5)) {
        const a = this.aim + off, h = this.hand(26);
        this.out++;
        A.addProj(this.p, {
          x: h.x, y: h.y, vx: Math.cos(a) * 760, vy: Math.sin(a) * 760, r: 18 * this.st.area, dmg: this.dmg(), life: 3, pierce: 999, kind: 'boomer', rot: 0, vr: 24, trailPts: [],
          boom: { t: 0, out: this.def.range / 760, owner: this.p, leg: 0 },
          onExpire: () => { this.out = Math.max(0, this.out - 1); if (this.out === 0) { this.pump.vel -= 40; this.p.rig.punch(0, 0, 0.5); sfx.pop(); } },
        });
      }
      this.p.rig.punch(Math.cos(this.aim), 0, 0.9);
      this.p.rig.lean.kick(this.side() * 3);
      sfx.swing();
    }
  }
  draw(g) {
    if (this.out > 0) return;
    // wind-up: the cone swings back behind the shoulder, then whips forward
    const wind = this.armed ? easeOutCubic(this.throwT / 0.08) : 0;
    const follow = !this.armed && this.throwT < 0.25 ? 1 - easeOutBack(this.throwT / 0.25) : 0;
    const off = -wind * 1.4 * this.side() + follow * 0.6 * this.side();
    const pv = this.pivot();
    const a = this.ang.value + off;
    const ps = clamp(this.pump.value, 0.6, 1.5);
    g.save();
    g.translate(pv.x + Math.cos(a) * 24, pv.y + Math.sin(a) * 20 + Math.sin(this.t * 3) * 1.5);
    g.rotate(a + Math.PI / 2 + Math.sin(this.t * 4) * 0.08);
    g.scale(0.62 * ps, 0.62 / Math.sqrt(ps));
    drawConeShape(g, 1);
    g.restore();
  }
}
export function drawConeShape(g, s = 1) {
  g.save(); g.scale(s, s);
  const gr = g.createLinearGradient(-16, 0, 16, 0);
  gr.addColorStop(0, '#f4c27e'); gr.addColorStop(0.5, '#e2a95d'); gr.addColorStop(1, '#c98a4c');
  g.fillStyle = gr; g.strokeStyle = '#9a6430'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(-16, -18); g.lineTo(16, -18); g.quadraticCurveTo(6, 4, 0, 22); g.quadraticCurveTo(-6, 4, -16, -18); g.fill(); g.stroke();
  g.strokeStyle = 'rgba(150,90,40,0.55)'; g.lineWidth = 1.2;
  for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 7, -18); g.lineTo(i * 7 + 10, 6); g.stroke(); g.beginPath(); g.moveTo(i * 7, -18); g.lineTo(i * 7 - 10, 6); g.stroke(); }
  g.fillStyle = '#ffb7c9'; g.beginPath(); g.arc(0, -20, 13, Math.PI, 0); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.ellipse(-5, -26, 4, 2, -0.3, 0, TAU); g.fill();
  g.restore();
}

// ── 5. thrust: popsicle lance — pull back, snap out, hold, ease home ─────
class Thrust extends Base {
  constructor(def, owner) { super(def, owner); this.th = null; this.ext = 0; }
  tick(dt, A, held) {
    if (held && this.cd <= 0 && !this.th) {
      this.th = { t: 0, hit: new Set(), a: this.aim, first: true };
      this.cd = this.cooldown();
      this.p.rig.squash.kick(2.5);
    }
    const th = this.th;
    const range = this.def.range * this.st.area;
    if (!th) { this.ext += (0 - this.ext) * Math.min(1, dt * 12); return; }
    th.t += dt;
    const W = 0.09, S = 0.08, Hd = 0.06, Rt = 0.2;
    const t = th.t;
    if (t < W) this.ext = -26 * easeOutCubic(t / W);
    else if (t < W + S) {
      const k = (t - W) / S;
      this.ext = lerp(-26, range, easeOutExpo(k));
      if (!th.fired) {
        th.fired = true;
        this.p.lunge(Math.cos(th.a), Math.sin(th.a), 360);
        this.p.rig.punch(Math.cos(th.a), 0, 1.3);
        this.p.rig.squash.kick(-4);
        sfx.swing();
      }
      this.ghost({ ext: this.ext }, 0.1);
    } else if (t < W + S + Hd) this.ext = range + Math.sin((t - W - S) / Hd * Math.PI) * 6;
    else this.ext = lerp(range, 0, easeInOutCubic(clamp((t - W - S - Hd) / Rt, 0, 1)));
    if (th.fired && t < W + S + Hd) {
      const pv = this.pivot();
      const x2 = pv.x + Math.cos(th.a) * (40 + this.ext), y2 = pv.y + Math.sin(th.a) * (40 + this.ext);
      A.querySegment(pv.x, pv.y, x2, y2, 20, (e) => {
        if (th.hit.has(e)) return;
        th.hit.add(e);
        A.hit(this.p, e, this.dmg(), { kx: Math.cos(th.a), ky: Math.sin(th.a), knock: 320 });
        if (th.first) { th.first = false; this.impact(A, e, 1.4); A.fx.ring(e.x, e.y - e.r * 0.4, 34, '#ffffff', { life: 0.2, w: 5 }); }
      });
    }
    if (t > W + S + Hd + Rt) this.th = null;
  }
  draw(g) {
    const a = this.th ? this.th.a : this.ang.value;
    for (const gh of this.ghosts) this.drawBar(g, a, gh.ext, (gh.life / gh.max) * 0.3, 1);
    const stretch = this.th && this.th.fired && this.th.t < 0.26 ? 1.12 : 1;
    this.drawBar(g, a, this.ext, 1, stretch);
  }
  drawBar(g, a, ext, alpha, stretch) {
    const pv = this.pivot();
    const L = 26 + Math.max(-26, ext) * 0.75;
    g.save(); g.globalAlpha = alpha; g.translate(pv.x, pv.y + Math.sin(this.t * 3) * 1.2); g.rotate(a);
    g.scale(stretch, 1 / Math.sqrt(stretch));
    g.fillStyle = '#f3dab2'; g.strokeStyle = '#b07a48'; g.lineWidth = 1.6;
    g.beginPath(); g.roundRect(0, -3, L + 8, 6, 3); g.fill(); g.stroke();
    const gr = g.createLinearGradient(0, -11, 0, 11);
    gr.addColorStop(0, '#ffd0e2'); gr.addColorStop(0.5, '#ff9ec4'); gr.addColorStop(1, '#f07aa6');
    g.fillStyle = gr; g.beginPath(); g.roundRect(L, -11, 48, 22, 10); g.fill();
    const g2 = g.createLinearGradient(0, -11, 0, 11);
    g2.addColorStop(0, '#d8f4ff'); g2.addColorStop(0.5, '#a8e6ff'); g2.addColorStop(1, '#7cc8f0');
    g.fillStyle = g2; g.beginPath(); g.roundRect(L + 24, -11, 24, 22, [0, 10, 10, 0]); g.fill();
    g.strokeStyle = 'rgba(190,80,130,0.55)'; g.lineWidth = 1.6;
    g.beginPath(); g.roundRect(L, -11, 48, 22, 10); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.roundRect(L + 5, -8, 32, 4, 2); g.fill();
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
      const h = muzzle(this, 38);
      for (const off of this.fan(n, 0.3)) {
        const a = this.aim + off;
        A.addProj(this.p, { x: h.x, y: h.y, vx: Math.cos(a) * this.def.speed, vy: Math.sin(a) * this.def.speed, r: 11 * this.st.area, dmg: this.dmg(), life: 2.2, pierce: 0, kind: 'jelly', color: JELLY[(Math.random() * JELLY.length) | 0], bounces: this.def.bounces + this.st.pierce, sq: Object.assign(new Spring(0.6, 300, 8), { target: 1 }) });
      }
      this.recoil(360, 7, 0.5);
      this.p.rig.punch(Math.cos(this.aim) * 0.5, 0, 0.5);
      sfx.pop();
    }
  }
  draw(g) { drawBlaster(this, g, this.hand(16), { body: '#b8f0c8', tank: '#ff7aa8', barrel: 0.4, size: 1.1, nozzle: '#ffcf4a' }); }
}

// ── 7. lob: cherry bomb — arm back, overhand toss, follow-through ──────
class Lob extends Base {
  constructor(def, owner) { super(def, owner); this.throwT = 9; this.armed = false; }
  tick(dt, A, held) {
    this.throwT += dt;
    if (held && this.cd <= 0 && !this.armed) { this.armed = true; this.throwT = 0; }
    if (this.armed && this.throwT >= 0.1) {
      this.armed = false;
      this.throwT = 0;
      this.cd = this.cooldown();
      const tgt = A.aimPoint(this.p, 80, 420);
      const n = 1 + this.st.proj;
      for (let i = 0; i < n; i++) {
        const tx = tgt.x + (i ? rand(-60, 60) : 0), ty = tgt.y + (i ? rand(-60, 60) : 0);
        const h = this.hand(20);
        const T = 0.55;
        A.addProj(this.p, {
          x: h.x, y: h.y + 20, z: 20, vx: (tx - h.x) / T, vy: (ty - h.y - 20) / T, vz: 380, grav: 380 * 2 / T + 40 / T, r: 0, dmg: this.dmg(), life: T, pierce: 999, kind: 'cherry', noHit: true, rot: 0, vr: 11, trailPts: [],
          onExpire: (A, p) => A.explode(this.p, p.x, p.y, this.def.radius * this.st.area, p.dmg, { color: '#ff4d6d', knock: 380 }),
        });
        A.fx.decal({ k: 'warn', x: tx, y: ty, r: this.def.radius * this.st.area, life: T, mine: true });
      }
      this.p.rig.punch(Math.cos(this.aim) * 0.8, 0, 0.8);
      this.p.rig.lean.kick(this.side() * 3);
      sfx.swing();
    }
  }
  draw(g) {
    const pv = this.pivot();
    let off = 0, lift = 0, show = this.cd <= this.cooldown() * 0.55 || this.armed;
    if (this.armed) { const k = easeOutCubic(this.throwT / 0.1); off = -1.6 * k; lift = 18 * k; }
    else if (this.throwT < 0.3) { const k = this.throwT / 0.3; off = 0.5 * (1 - easeOutBack(k, 2)); show = false; }
    if (!show) return;
    const a = this.ang.value + off * this.side();
    const pop = clamp(this.cd <= this.cooldown() * 0.55 ? 1 : 0, 0, 1);
    drawCherry(g, pv.x + Math.cos(a) * 22, pv.y + Math.sin(a) * 18 - lift + Math.sin(this.t * 3) * 1.5, 0.9 * pop, Math.sin(this.t * 3) * 0.2);
  }
}
export function drawCherry(g, x, y, s = 1, rot = 0) {
  if (s <= 0) return;
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  g.strokeStyle = '#5a8a3a'; g.lineWidth = 2.4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, -8); g.quadraticCurveTo(3, -18, 9, -22); g.stroke();
  g.fillStyle = '#7ec850'; g.beginPath(); g.ellipse(12, -21, 6, 3, -0.4, 0, TAU); g.fill();
  const gr = g.createRadialGradient(-3, -4, 1, 0, 0, 11);
  gr.addColorStop(0, '#ff8aa0'); gr.addColorStop(0.5, '#ec3a5a'); gr.addColorStop(1, '#b51f3c');
  g.fillStyle = gr; g.strokeStyle = '#9a1a32'; g.lineWidth = 1.5;
  g.beginPath(); g.arc(0, 0, 10, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.ellipse(-3.5, -4, 3.4, 2, -0.6, 0, TAU); g.fill();
  g.restore();
}

// ── 8. whip: syrup lash — a travelling wave with follow-through ───────
class Whip extends Base {
  constructor(def, owner) {
    super(def, owner);
    this.N = 18;
    this.pts = Array.from({ length: this.N }, () => ({ x: owner.x, y: owner.y }));
    this.lash = null;
    this.tip = [];
  }
  tick(dt, A, held) {
    if (held && this.cd <= 0 && !this.lash) {
      this.lash = { t: 0, a: this.aim, hit: new Set(), dir: Math.random() < 0.5 ? 1 : -1 };
      this.cd = this.cooldown();
    }
    const pv = this.pivot();
    const range = this.def.range * this.st.area;
    const L = this.lash;
    const PREP = 0.07;
    for (let i = 0; i < this.N; i++) {
      const u = i / (this.N - 1);
      let a, d;
      if (L && L.t < PREP) {
        // anticipation: the whip is drawn back over the shoulder
        const k = easeOutCubic(L.t / PREP);
        a = L.a + Math.PI * 0.9 * L.dir * k + Math.sin(u * 3) * 0.3;
        d = u * lerp(46, 70, k);
      } else if (L) {
        const lt = clamp((L.t - PREP - u * 0.1) / 0.18, 0, 1);
        const e = easeOutBack(lt, 1.8);
        a = L.a + L.dir * (1 - e) * 2.8 * (1 - u * 0.2);
        d = u * range * (0.25 + 0.75 * easeOutQuart(clamp(lt * 1.3, 0, 1)));
      } else {
        a = this.ang.value + Math.PI * 0.55 + Math.sin(this.t * 2.5 + u * 3) * 0.18;
        d = u * 46;
      }
      const tx = pv.x + Math.cos(a) * d, ty = pv.y + Math.sin(a) * d * 0.85 + (L ? 0 : u * u * 16);
      const p = this.pts[i];
      const f = Math.min(1, dt * (L ? 34 : 14) * (1 - u * 0.35));
      p.x += (tx - p.x) * f;
      p.y += (ty - p.y) * f;
    }
    const tp = this.pts[this.N - 1];
    this.tip.unshift({ x: tp.x, y: tp.y });
    if (this.tip.length > 10) this.tip.pop();
    if (L) {
      if (L.t >= PREP && !L.swung) { L.swung = true; sfx.swing(); this.p.rig.lean.kick(-L.dir * 3); }
      L.t += dt;
      if (L.t > PREP + 0.06 && L.t < PREP + 0.32) {
        for (let i = 4; i < this.N; i += 2) {
          const p = this.pts[i];
          const tip = i >= this.N - 3;
          A.queryCircle(p.x, p.y + 14, 16 * this.st.area, (e) => {
            if (L.hit.has(e)) return;
            L.hit.add(e);
            A.hit(this.p, e, this.dmg(tip ? 1.25 : 0.8), { kx: Math.cos(L.a), ky: Math.sin(L.a), knock: 220, crit: tip ? true : undefined });
            if (tip) { A.fx.ring(p.x, p.y + 14, 34, '#ffe1a6', { life: 0.22, w: 5 }); this.impact(A, e, 1.2); sfx.crit(); }
          });
        }
      }
      if (L.t > PREP + 0.17 && !L.cracked) { L.cracked = true; A.fx.burst(tp.x, tp.y, 8, { c: ['#f0b45a', '#ffe1a6', '#ffffff'], sp: 220, r: 3, life: 0.3 }); this.p.rig.punch(Math.cos(L.a), 0, 0.9); }
      if (L.t > PREP + 0.42) this.lash = null;
    }
  }
  draw(g) {
    g.save();
    g.lineCap = 'round'; g.lineJoin = 'round';
    // motion trail from the tip
    if (this.lash) for (let i = 1; i < this.tip.length; i++) {
      g.strokeStyle = `rgba(255,236,190,${0.5 * (1 - i / this.tip.length)})`;
      g.lineWidth = 6 * (1 - i / this.tip.length);
      g.beginPath(); g.moveTo(this.tip[i - 1].x, this.tip[i - 1].y); g.lineTo(this.tip[i].x, this.tip[i].y); g.stroke();
    }
    const smooth = (w, col) => {
      g.strokeStyle = col; g.lineWidth = w;
      g.beginPath(); g.moveTo(this.pts[0].x, this.pts[0].y);
      for (let i = 1; i < this.N - 1; i++) { const a = this.pts[i], b = this.pts[i + 1]; g.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2); }
      g.lineTo(this.pts[this.N - 1].x, this.pts[this.N - 1].y);
      g.stroke();
    };
    // taper by drawing three passes of decreasing length
    for (const [w, col] of [[11, 'rgba(150,80,30,0.55)'], [8, '#f0b45a'], [3, 'rgba(255,240,200,0.85)']]) smooth(w, col);
    const t = this.pts[this.N - 1];
    g.fillStyle = '#e9a24a'; g.beginPath(); g.arc(t.x, t.y, 5, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(t.x - 1.5, t.y - 1.5, 1.6, 0, TAU); g.fill();
    const h = this.pts[0];
    g.fillStyle = '#9a6a4a'; g.beginPath(); g.roundRect(h.x - 5, h.y - 5, 10, 10, 4); g.fill();
    g.restore();
  }
}

// ── 9. spray: whipped cream ───────────────────────────────────────────
class Spray extends Base {
  tick(dt, A, held) {
    this.on = held;
    this.pump.target = held ? 0.9 + Math.sin(this.t * 40) * 0.04 : 1;
    if (held && this.cd <= 0) {
      this.cd = this.cooldown();
      const h = muzzle(this, 40);
      const n = 1 + Math.ceil(this.st.proj / 2);
      for (let i = 0; i < n; i++) {
        const a = this.aim + rand(-0.32, 0.32) + Math.sin(this.t * 9) * 0.1;
        const sp = rand(380, 470);
        A.addProj(this.p, { x: h.x, y: h.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 10, grow: 30 * this.st.area, dmg: this.dmg(), life: (this.def.range / 420) * this.st.area, pierce: 999, kind: 'cream', drag: 2.6, slow: { amt: 0.4, dur: 0.8 }, knock: 60, rehit: 0.25 });
      }
      this.kick.vel -= 40;
      this.tilt.vel -= this.side() * 0.6;
      if (Math.random() < 0.3) sfx.pop();
    }
  }
  draw(g) {
    const h = this.hand(14);
    const ps = clamp(this.pump.value, 0.7, 1.3);
    g.save(); g.translate(h.x, h.y); g.rotate(this.ang.value + this.tilt.value); if (Math.cos(this.ang.value) < 0) g.scale(1, -1);
    g.scale(1 / ps, ps);
    const gr = g.createLinearGradient(0, -9, 0, 9);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#e6eef8'); gr.addColorStop(1, '#b8c6dc');
    g.fillStyle = gr; g.strokeStyle = 'rgba(100,110,140,0.6)'; g.lineWidth = 1.6;
    g.beginPath(); g.roundRect(-12, -9, 30, 18, 8); g.fill(); g.stroke();
    g.fillStyle = '#ff9cc4'; g.beginPath(); g.roundRect(-5, -9, 8, 18, 2); g.fill();
    g.fillStyle = '#ffffff'; g.strokeStyle = 'rgba(100,110,140,0.6)';
    g.beginPath(); g.moveTo(18, -5); g.lineTo(33, -3.5); g.quadraticCurveTo(35, 0, 33, 3.5); g.lineTo(18, 5); g.closePath(); g.fill(); g.stroke();
    if (this.on) { g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.arc(37, 0, 5 + Math.sin(this.t * 40) * 1.6, 0, TAU); g.fill(); }
    g.restore();
  }
}

// ── 10. hammer: lollipop slam — big lift, a held beat, a crushing drop ──
class Hammer extends Base {
  constructor(def, owner) { super(def, owner); this.sl = null; this.rot = 0.35; this.head = new Spring(1, 360, 9); }
  tick(dt, A, held) {
    if (held && this.cd <= 0 && !this.sl) { this.sl = { t: 0, a: this.aim }; this.cd = this.cooldown(); }
    this.head.update(dt);
    const s = this.sl;
    const sp = Math.sqrt(this.st.atk);
    const W = 0.3 / sp, HOLD = 0.06 / sp, DROP = 0.075, REC = 0.3;
    if (!s) { this.rot += (0.35 - this.rot) * Math.min(1, dt * 10); return; }
    s.t += dt;
    const t = s.t;
    if (t < W) {
      this.rot = lerp(0.35, -2.5, easeOutBack(t / W, 1.3));
      this.p.rig.squash.target = 1.14;
    } else if (t < W + HOLD) {
      this.rot = -2.5 + Math.sin(t * 90) * 0.04; // a trembling hold at the top
    } else if (t < W + HOLD + DROP) {
      this.rot = lerp(-2.5, 0.5, easeInExpo((t - W - HOLD) / DROP));
    } else {
      if (!s.done) {
        s.done = true;
        this.p.rig.squash.target = 1;
        this.p.rig.squash.kick(-7);
        this.head.vel -= 9;
        this.p.lunge(Math.cos(s.a), Math.sin(s.a), 120);
        const pv = this.pivot();
        const x = pv.x + Math.cos(s.a) * 78, y = this.p.y + Math.sin(s.a) * 66;
        const R = this.def.radius * this.st.area;
        A.explode(this.p, x, y, R, this.dmg(), { color: '#ffb3d1', knock: 440, stun: 0.7, ring: '#ffffff', noScorch: true });
        A.fx.ring(x, y, R * 1.3, '#ffe3ef', { life: 0.5, w: 4 });
        A.fx.burst(x, y, 22, { c: ['#ff8fb4', '#ffffff', '#ffe066'], sp: 380, r: 4.5, vz: 300, grav: 900, life: 0.8 });
        for (let i = 0; i < 8; i++) A.fx.puff(x + rand(-R * 0.6, R * 0.6), y + rand(-R * 0.3, R * 0.3), { c: 'rgba(255,255,255,0.7)', r: rand(12, 22), sp: 60 });
        A.shake(12); A.hitstop(0.08); sfx.heavy();
      }
      const k = clamp((t - W - HOLD - DROP) / REC, 0, 1);
      this.rot = lerp(0.5, 0.35, easeInOutCubic(k)) + Math.sin(k * Math.PI) * -0.25;
      if (k >= 1) this.sl = null;
    }
  }
  draw(g) {
    const pv = this.pivot();
    const a = (this.sl ? this.sl.a : this.ang.value);
    const side = Math.cos(a) >= 0 ? 1 : -1;
    g.save(); g.translate(pv.x, pv.y + Math.sin(this.t * 3) * 1.2);
    g.rotate(a + this.rot * side);
    const L = 60;
    g.fillStyle = '#ffffff'; g.strokeStyle = 'rgba(160,110,130,0.6)'; g.lineWidth = 1.6;
    g.beginPath(); g.roundRect(4, -3.2, L, 6.4, 3.2); g.fill(); g.stroke();
    g.strokeStyle = '#ff9cc4'; g.lineWidth = 2;
    for (let x = 10; x < L; x += 9) { g.beginPath(); g.moveTo(x, -3); g.lineTo(x + 4, 3); g.stroke(); }
    const hs = clamp(this.head.value, 0.55, 1.5);
    g.save(); g.translate(L + 20, 0); g.scale(1 / hs, hs); g.rotate(this.t * 0.8);
    const gr = g.createRadialGradient(-6, -7, 2, 0, 0, 24);
    gr.addColorStop(0, '#ffc2da'); gr.addColorStop(1, '#ff6f9e');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 23, 0, TAU); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 5.5; g.lineCap = 'round';
    g.beginPath(); for (let i = 0; i < 44; i++) { const t = i / 44, r = t * 20; g.lineTo(Math.cos(t * 12.5) * r, Math.sin(t * 12.5) * r); } g.stroke();
    g.strokeStyle = 'rgba(200,60,110,0.6)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 23, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.65)'; g.beginPath(); g.ellipse(-8, -10, 7, 3.4, -0.6, 0, TAU); g.fill();
    g.restore();
    g.restore();
  }
}

// ── 11. beam: soda laser — trembling charge, flaring beam, quick fade ──
class Beam extends Base {
  constructor(def, owner) { super(def, owner); this.charge = 0; this.tickT = 0; this.len = 0; this.width = 0; }
  tick(dt, A, held) {
    if (held) this.charge = Math.min(1, this.charge + dt / 0.35);
    else this.charge = Math.max(0, this.charge - dt * 4);
    this.firing = held && this.charge >= 1;
    const range = this.def.range * this.st.area;
    this.len += ((this.firing ? range : 0) - this.len) * Math.min(1, dt * (this.firing ? 24 : 14));
    this.width += ((this.firing ? 1 : 0) - this.width) * Math.min(1, dt * (this.firing ? 16 : 20));
    if (held && this.charge < 1) {
      // gathering bubbles and a growing shake
      const h = this.hand(42);
      if (Math.random() < 0.7) { const a = rand(TAU), d = rand(20, 40); A.fx.dot(h.x + Math.cos(a) * d, h.y + Math.sin(a) * d, { a: a + Math.PI, sp: d * 5, c: 'rgba(200,245,255,0.95)', r: rand(2, 4), life: 0.18, drag: 0 }); }
      this.tilt.target = Math.sin(this.t * 70) * 0.05 * this.charge;
    } else this.tilt.target = 0;
    this.tickT -= dt;
    if (this.firing && this.tickT <= 0) {
      this.tickT = this.cooldown();
      const h = this.hand(40);
      const n = 1 + this.st.proj;
      for (const off of this.fan(n, 0.16)) {
        const a = this.aim + off;
        A.querySegment(h.x, h.y, h.x + Math.cos(a) * this.len, h.y + Math.sin(a) * this.len, 18 * this.st.area, (e) => {
          A.hit(this.p, e, this.dmg(), { kx: Math.cos(a), ky: Math.sin(a), knock: 40, quiet: true });
        });
      }
      this.kick.vel -= 60;
      sfx.zap();
    }
  }
  draw(g) {
    const h = this.hand(16);
    drawBlaster(this, g, h, { body: '#a8e6ff', tank: '#d8f6ff', barrel: 1.1, size: 1.15, nozzle: '#c9f4ff' });
    if (this.len > 4 && this.width > 0.02) {
      const m = this.hand(42);
      const n = 1 + this.st.proj;
      for (const off of this.fan(n, 0.16)) {
        const a = this.aim + off;
        const w = (12 + Math.sin(this.t * 50) * 3) * easeOutBack(clamp(this.width, 0, 1), 2);
        g.save(); g.translate(m.x, m.y); g.rotate(a);
        g.fillStyle = 'rgba(140,230,255,0.4)'; g.beginPath(); g.roundRect(0, -w * 1.3, this.len, w * 2.6, w * 1.3); g.fill();
        g.fillStyle = 'rgba(190,245,255,0.75)'; g.beginPath(); g.roundRect(0, -w * 0.75, this.len, w * 1.5, w * 0.75); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.98)'; g.beginPath(); g.roundRect(0, -w * 0.3, this.len, w * 0.6, w * 0.3); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.85)';
        for (let i = 0; i < 10; i++) { const x = ((this.t * 700 + i * 71) % this.len); g.beginPath(); g.arc(x, Math.sin(i * 9 + this.t * 20) * w * 0.9, 1.8 + (i % 3), 0, TAU); g.fill(); }
        g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(0, 0, w * 1.1, 0, TAU); g.fill();
        g.restore();
      }
    }
    if (this.charge > 0 && this.charge < 1) {
      const m = this.hand(42);
      g.fillStyle = `rgba(200,245,255,${this.charge * 0.85})`;
      g.beginPath(); g.arc(m.x, m.y, 3 + easeOutCubic(this.charge) * 10, 0, TAU); g.fill();
    }
  }
}

// ── 12. bow: candy cane — eased draw, snapping release, ringing string ──
class Bow extends Base {
  constructor(def, owner) { super(def, owner); this.draw01 = 0; this.wasHeld = false; this.str = new Spring(0, 620, 7); }
  tick(dt, A, held) {
    if (held && this.cd <= 0) this.draw01 = Math.min(1, this.draw01 + (dt * this.st.atk) / 0.65);
    if (!held && this.wasHeld && this.draw01 > 0.05) this.release(A);
    if (!held) this.draw01 = Math.max(0, this.draw01 - dt * 5);
    this.wasHeld = held;
    this.str.target = easeOutCubic(this.draw01);
    this.str.update(dt);
    if (this.draw01 >= 1 && Math.random() < 0.3) { const h = this.hand(40); A.fx.dot(h.x, h.y, { c: '#fff1a6', r: 2.5, sp: 40, life: 0.3, k: 'star' }); }
  }
  release(A) {
    const c = this.draw01, full = c >= 1;
    const n = (full ? 3 : 1) + this.st.proj;
    const h = this.hand(26);
    for (const off of this.fan(n, full ? 0.22 : 0.12)) {
      const a = this.aim + off;
      const sp = this.def.speed * (0.55 + c * 0.45);
      A.addProj(this.p, { x: h.x, y: h.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 8, dmg: this.dmg(0.35 + c * 0.65), life: 0.9, pierce: (full ? 3 : 0) + this.st.pierce, kind: 'arrow', rot: a, knock: 120 + c * 160, trail: full, streak: true });
    }
    this.draw01 = 0;
    this.cd = this.cooldown();
    this.str.vel = -32; // the string snaps forward and rings
    this.recoil(160 * c, 4 * c, 0.2);
    this.flashT = 0;
    this.p.rig.punch(-Math.cos(this.aim) * 0.5, 0, 0.6);
    sfx.shoot(); if (full) { sfx.crit(); A.shake(3); }
  }
  draw(g) {
    const h = this.hand(20);
    const pull = clamp(this.str.value, -0.5, 1);
    g.save(); g.translate(h.x, h.y); g.rotate(this.ang.value + this.tilt.value);
    g.lineCap = 'round';
    const bend = 10 + Math.max(0, pull) * 9;
    const tipY = 30 - Math.max(0, pull) * 3;
    const path = () => { g.beginPath(); g.moveTo(-6, -tipY); g.quadraticCurveTo(bend + 6, 0, -6, tipY); };
    g.strokeStyle = 'rgba(170,40,70,0.55)'; g.lineWidth = 9.5; path(); g.stroke();
    g.strokeStyle = '#ffffff'; g.lineWidth = 6.5; path(); g.stroke();
    g.strokeStyle = '#ff4d6d'; g.lineWidth = 6.5; g.setLineDash([5, 6]); path(); g.stroke(); g.setLineDash([]);
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.5; path(); g.stroke();
    const sx = -6 - pull * 24;
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(-6, -tipY); g.lineTo(sx, 0); g.lineTo(-6, tipY); g.stroke();
    if (this.cd <= 0) {
      g.strokeStyle = '#f3dab2'; g.lineWidth = 3; g.beginPath(); g.moveTo(sx, 0); g.lineTo(sx + 46, 0); g.stroke();
      g.fillStyle = '#ff9ec4'; g.beginPath(); g.moveTo(sx + 52, 0); g.lineTo(sx + 41, -6); g.lineTo(sx + 41, 6); g.fill();
      if (pull >= 0.98) { g.fillStyle = `rgba(255,240,150,${0.5 + Math.sin(this.t * 20) * 0.3})`; g.beginPath(); g.arc(sx + 47, 0, 10, 0, TAU); g.fill(); }
    }
    g.restore();
  }
}

// ── 13. cloud: cotton candy rain ──────────────────────────────────────
class Cloud extends Base {
  constructor(def, owner) {
    super(def, owner);
    this.cx = new Spring(owner.x, 60, 9); this.cy = new Spring(owner.y, 60, 9);
    this.sz = new Spring(0.7, 160, 9);
  }
  tick(dt, A, held) {
    const tgt = A.aimPoint(this.p, 60, 320);
    this.cx.target = tgt.x; this.cy.target = tgt.y;
    this.cx.update(dt); this.cy.update(dt);
    this.sz.target = held ? 1.1 : 0.78;
    this.sz.update(dt);
    this.on = held;
    if (held && this.cd <= 0) {
      this.cd = this.cooldown();
      this.sz.vel -= 2.5; // the cloud squeezes out each drop
      const R = this.def.radius * this.st.area;
      const n = 1 + Math.ceil(this.st.proj / 2);
      for (let i = 0; i < n; i++) {
        const a = rand(TAU), d = Math.sqrt(Math.random()) * R;
        const x = this.cx.value + Math.cos(a) * d, y = this.cy.value + Math.sin(a) * d * 0.7;
        A.addProj(this.p, { x, y, z: 120, vx: 0, vy: 0, vz: -520, grav: 400, r: 0, dmg: this.dmg(), life: 0.24, pierce: 999, kind: 'raindrop', noHit: true, color: JELLY[i % 5],
          onExpire: (A, p) => A.explode(this.p, p.x, p.y, 34 * this.st.area, p.dmg, { color: p.color, knock: 40, small: true }) });
      }
    }
  }
  draw(g) {
    const x = this.cx.value, y = this.cy.value;
    const s = this.sz.value;
    const bob = Math.sin(this.t * 2.4) * 5;
    const R = this.def.radius * this.st.area;
    g.fillStyle = 'rgba(180,120,190,0.16)';
    g.beginPath(); g.ellipse(x, y, R, R * 0.6, 0, 0, TAU); g.fill();
    g.save(); g.translate(x, y - 120 + bob); g.scale(s * (1 + (1 - s) * 0.2), s);
    for (const [cx, cy, r, c] of [[-34, 8, 22, '#c9dcff'], [30, 10, 22, '#ffc2dc'], [-12, -8, 28, '#ffd6ea'], [14, -10, 26, '#d6e4ff'], [0, 12, 24, '#ffe0ef']]) {
      g.fillStyle = c; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(-14, -18, 15, 6, -0.3, 0, TAU); g.fill();
    g.fillStyle = '#5a3a4a';
    if (this.on) { g.beginPath(); g.arc(-6, 2, 2, 0, TAU); g.arc(6, 2, 2, 0, TAU); g.fill(); }
    else { g.fillRect(-8, 2, 4, 1.5); g.fillRect(4, 2, 4, 1.5); }
    g.restore();
    const h = this.hand(20);
    g.save(); g.translate(h.x, h.y); g.rotate(this.ang.value - 0.6 + Math.sin(this.t * 4) * 0.12);
    g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.lineTo(30, 0); g.stroke();
    g.fillStyle = '#ffc2dc'; g.beginPath(); g.arc(36, 0, 9, 0, TAU); g.fill();
    g.fillStyle = '#c9dcff'; g.beginPath(); g.arc(41, -4, 6, 0, TAU); g.fill();
    g.restore();
  }
}

// ── 14. scoop launcher ────────────────────────────────────────────────
class ScoopLauncher extends Base {
  tick(dt, A, held) {
    // the scoop bulges in the chamber as the next shot gets ready
    const ready = clamp(1 - this.cd / this.cooldown(), 0, 1);
    this.pump.target = 1 + (ready >= 1 ? Math.sin(this.t * 8) * 0.03 : 0);
    if (held && this.cd <= 0) {
      this.cd = this.cooldown();
      const n = 1 + this.st.proj;
      for (const off of this.fan(n, 0.3)) {
        const a = this.aim + off, h = this.hand(40);
        const fl = this.p.rig.look.flavors.length ? this.p.rig.look.flavors[this.p.rig.look.flavors.length - 1] : 'vanilla';
        A.addProj(this.p, {
          x: h.x, y: h.y, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, r: 16, dmg: this.dmg(), life: 0.75, pierce: 0, kind: 'bigscoop', flavor: fl, rot: 0, vr: 6, sq: Object.assign(new Spring(0.5, 260, 8), { target: 1 }),
          onExpire: (A, p) => {
            const R = this.def.radius * this.st.area;
            A.explode(this.p, p.x, p.y, R, p.dmg, { color: '#bfeaff', knock: 260, noScorch: true });
            A.addArea({ k: 'ice', x: p.x, y: p.y, r: R * 1.1, life: 3, slow: 0.6, tick: 0.5, dmg: p.dmg * 0.15, owner: this.p });
            A.fx.decal({ k: 'ice', x: p.x, y: p.y, r: R * 1.1, life: 3 });
            sfx.freeze();
          },
        });
      }
      this.recoil(640, 12, 0.6);
      this.p.rig.punch(-Math.cos(this.aim), 0, 1);
      A.shake(3);
      sfx.pop();
    }
  }
  draw(g) {
    const h = this.hand(14);
    const ps = clamp(this.pump.value, 0.6, 1.4);
    g.save(); g.translate(h.x, h.y); g.rotate(this.ang.value + this.tilt.value); if (Math.cos(this.ang.value) < 0) g.scale(1, -1);
    g.scale(ps, 1 / Math.sqrt(ps));
    const gr = g.createLinearGradient(0, -6, 0, 6);
    gr.addColorStop(0, '#eef3fa'); gr.addColorStop(1, '#a9b6c8');
    g.fillStyle = gr; g.strokeStyle = 'rgba(70,80,100,0.6)'; g.lineWidth = 1.6;
    g.beginPath(); g.roundRect(-10, -5, 26, 10, 5); g.fill(); g.stroke();
    g.fillStyle = '#f6f9ff'; g.beginPath(); g.arc(28, 0, 13, -Math.PI / 2 - 1.2, Math.PI / 2 + 1.2); g.closePath(); g.fill(); g.stroke();
    if (this.cd < this.cooldown() * 0.5) {
      const fl = this.p.rig.look.flavors.length ? this.p.rig.look.flavors[this.p.rig.look.flavors.length - 1] : 'vanilla';
      const k = easeOutBack(clamp((this.cooldown() * 0.5 - this.cd) / 0.15, 0, 1), 2.5);
      g.save(); g.translate(30, 0); g.scale(0.4 * k, 0.4 * k); drawSprite(g, scoopSprite(fl)); g.restore();
    }
    g.restore();
  }
}

// ── 15. ribbon: aurora ────────────────────────────────────────────────
class Ribbon extends Base {
  constructor(def, owner) { super(def, owner); this.trails = [[], []]; this.rot = 0; this.hitT = new Map(); this.rad = new Spring(70, 120, 8); this.spin = 3.2; }
  tick(dt, A, held) {
    this.spin += (3.2 - this.spin) * Math.min(1, dt * 3);
    this.rot += dt * this.spin;
    this.rad.target = 70 * this.st.area * (1 + Math.sin(this.t * 1.8) * 0.06);
    this.rad.update(dt);
    const R = this.rad.value;
    for (let k = 0; k < 2; k++) {
      const a = this.rot + k * Math.PI;
      const x = this.p.x + Math.cos(a) * R, y = this.p.y - 20 + Math.sin(a) * R * 0.62 + Math.sin(this.t * 4 + k) * 6;
      const tr = this.trails[k];
      tr.unshift({ x, y });
      if (tr.length > 20) tr.pop();
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
      this.rad.vel += 600; // the ribbons flare out with the slash
      this.spin = 9;
      const n = 1 + this.st.proj;
      for (const off of this.fan(n, 0.4)) {
        const a = this.aim + off;
        A.addProj(this.p, { x: this.p.x, y: this.p.y - 22, vx: Math.cos(a) * 640, vy: Math.sin(a) * 640, r: 30 * this.st.area, dmg: this.dmg(), life: this.def.range / 640, pierce: 999, kind: 'crescent', color: '#8affd0', rot: a, aurora: true });
      }
      this.p.rig.punch(Math.cos(this.aim), 0, 0.8);
      this.p.rig.lean.kick(this.side() * 3);
      sfx.swing();
    }
  }
  draw(g) {
    const cols = ['#7affc8', '#8fc8ff', '#d8a6ff'];
    g.lineCap = 'round'; g.lineJoin = 'round';
    this.trails.forEach((tr, k) => {
      for (let i = 1; i < tr.length; i++) {
        const u = i / tr.length;
        g.strokeStyle = rgba(cols[(i + k) % 3], 0.85 * (1 - u));
        g.lineWidth = 12 * (1 - u) + 1.5;
        g.beginPath(); g.moveTo(tr[i - 1].x, tr[i - 1].y); g.lineTo(tr[i].x, tr[i].y); g.stroke();
      }
      if (tr[0]) { g.fillStyle = '#ffffff'; g.beginPath(); g.arc(tr[0].x, tr[0].y, 4, 0, TAU); g.fill(); }
    });
  }
}

// ── 16. orbitals: galaxy macarons + black hole ───────────────────────
const MAC = ['#ffb3cf', '#b8e4ff', '#d6c2ff', '#fff0a6', '#b8f0c8'];
class Orbitals extends Base {
  constructor(def, owner) { super(def, owner); this.rot = 0; this.hitT = new Map(); this.pos = []; this.rad = new Spring(76, 140, 8); }
  tick(dt, A, held, pressed) {
    this.rot += dt * 2.4;
    this.rad.target = 76 * this.st.area;
    this.rad.update(dt);
    const n = 3 + this.st.proj;
    const R = this.rad.value;
    this.pos = [];
    for (let i = 0; i < n; i++) {
      const a = this.rot + (i / n) * TAU;
      const x = this.p.x + Math.cos(a) * R, y = this.p.y - 20 + Math.sin(a) * R * 0.62 + Math.sin(this.t * 3 + i) * 5;
      this.pos.push({ x, y, c: MAC[i % MAC.length], a, spin: Math.sin(this.t * 2 + i) * 0.3 });
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
      this.rad.vel -= 500; // pull the macarons in, then they spring back out
      const tgt = A.aimPoint(this.p, 60, 380);
      A.addArea({ k: 'hole', x: tgt.x, y: tgt.y, r: this.def.radius * this.st.area, life: 1.8, pull: 520, tick: 0.2, dmg: this.dmg(0.35), owner: this.p, end: this.dmg(1.5) });
      sfx.boom();
    }
  }
  draw(g) {
    for (const p of this.pos) {
      g.save(); g.translate(p.x, p.y); g.rotate(p.spin);
      g.fillStyle = 'rgba(120,70,130,0.15)'; g.beginPath(); g.ellipse(0, 24, 9, 3, 0, 0, TAU); g.fill();
      g.fillStyle = p.c; g.strokeStyle = 'rgba(120,70,120,0.5)'; g.lineWidth = 1.3;
      g.beginPath(); g.ellipse(0, -4, 11, 6, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#fff8f0'; g.fillRect(-10, -1, 20, 3);
      g.fillStyle = p.c; g.beginPath(); g.ellipse(0, 5, 11, 6, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.65)'; g.beginPath(); g.ellipse(-4, -6, 4, 1.6, 0, 0, TAU); g.fill();
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
  // speed streak behind fast shots
  if (p.streak) {
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > 200) {
      const L = Math.min(46, sp * 0.045);
      const gr = g.createLinearGradient(p.x, p.y, p.x - (p.vx / sp) * L, p.y - (p.vy / sp) * L);
      gr.addColorStop(0, rgba(p.color && p.color[0] === '#' ? p.color : '#ffffff', 0.55)); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.strokeStyle = gr; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - (p.vx / sp) * L, p.y - (p.vy / sp) * L); g.stroke();
    }
  }
  // afterimages for spinning throwables
  if (p.trailPts) {
    p.trailPts.unshift({ x: p.x, y: p.y - (p.z || 0), r: p.rot });
    if (p.trailPts.length > 6) p.trailPts.pop();
    for (let i = p.trailPts.length - 1; i > 0; i--) {
      const q = p.trailPts[i];
      g.globalAlpha = 0.28 * (1 - i / p.trailPts.length);
      if (p.kind === 'boomer') { g.save(); g.translate(q.x, q.y); g.rotate(q.r); drawConeShape(g, 0.85); g.restore(); }
      else if (p.kind === 'cherry') drawCherry(g, q.x, q.y, 1, q.r);
    }
    g.globalAlpha = 1;
  }
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
      const s = p.sq ? p.sq.value : 1;
      g.save(); g.translate(p.x, p.y); g.rotate(Math.atan2(p.vy, p.vx));
      g.scale(1 / s, s);
      g.fillStyle = rgba(p.color, 0.85); g.strokeStyle = rgba(p.color, 1); g.lineWidth = 2;
      g.beginPath(); g.arc(0, 0, p.r, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(-p.r * 0.3, -p.r * 0.35, p.r * 0.35, p.r * 0.2, 0, 0, TAU); g.fill();
      g.restore(); break;
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
    case 'bigscoop': {
      const q = p.sq ? clamp(p.sq.value, 0.5, 1.5) : 1;
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(0.6 / q, 0.6 * q); drawSprite(g, scoopSprite(p.flavor)); g.restore();
      break;
    }
    case 'crescent': {
      const k = p.t / p.life;
      const grow = 0.55 + 0.45 * easeOutBack(clamp(k * 4, 0, 1), 2);
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(grow, grow * (1 + k * 0.15));
      g.globalAlpha = 1 - k * k * 0.8;
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

