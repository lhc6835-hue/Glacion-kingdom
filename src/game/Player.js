// Player movement and animation state. Logical position is continuous; the renderer rounds it.
import { WORLD, groundY } from './World.js';
import { SWING } from '../data/balance.js';

const WALK = 52, RUN = 92, ACCEL = 520, JUMP_V = 150, GRAV = 520;

const easeOut = (t) => 1 - (1 - t) * (1 - t);
const easeIn = (t) => t * t * t;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
const lerp = (a, b, t) => a + (b - a) * t;

export class Player {
  constructor(x) {
    this.x = x; this.y = groundY(x);
    this.vx = 0; this.vy = 0;
    this.facing = 1;
    this.onGround = true;
    this.walkPhase = 0;
    this.turnT = 0; this.landT = 0; this.gatherT = 0; this.cheerT = 0; this.surpriseT = 0;
    this.blinkT = 2;
    this.stepAcc = 0;
    this.anchor = null; // standing spot while chopping
    this.pose = {};
    this.locked = false; // cinematic / UI control
    this.forceAxe = 0;   // cinematic: drawing the axe (0..1)
  }

  update(dt, input, combat, events) {
    const engaged = !!combat.target;
    let dir = 0;
    if (!this.locked) {
      if (input.down('a', 'ArrowLeft')) dir -= 1;
      if (input.down('d', 'ArrowRight')) dir += 1;
    }
    if (engaged && dir !== 0) combat.disengage();
    const run = input.down('Shift');
    const target = dir * (run ? RUN : WALK);
    const a = ACCEL * (this.onGround ? 1 : 0.5) * dt;
    if (combat.target && this.anchor !== null) {
      // glide to the chopping spot and face the trunk
      this.vx = 0;
      this.x += (this.anchor - this.x) * Math.min(1, dt * 14);
      this.setFacing(combat.target.x > this.x ? 1 : -1);
    } else {
      this.vx = Math.abs(target - this.vx) < a ? target : this.vx + Math.sign(target - this.vx) * a;
      if (dir) this.setFacing(dir);
    }
    this.x = Math.max(WORLD.minX, Math.min(WORLD.maxX, this.x + this.vx * dt));
    if (!this.locked && !engaged && input.hit(' ') && this.onGround) { this.vy = -JUMP_V; this.onGround = false; events.emit('jump', {}); }
    const gy = groundY(this.x);
    if (!this.onGround) {
      this.vy += GRAV * dt;
      this.y += this.vy * dt;
      if (this.y >= gy) { this.y = gy; this.onGround = true; this.landT = 0.14; this.vy = 0; events.emit('land', {}); }
    } else this.y = gy;

    const speed = Math.abs(this.vx);
    if (this.onGround && speed > 4) {
      this.walkPhase += dt * speed * 0.2;
      this.stepAcc += dt * speed;
      if (this.stepAcc > (run ? 26 : 20)) { this.stepAcc = 0; events.emit('step', { run }); }
    } else this.walkPhase = 0;
    for (const k of ['turnT', 'landT', 'gatherT', 'cheerT', 'surpriseT']) this[k] = Math.max(0, this[k] - dt);
    this.blinkT -= dt;
    if (this.blinkT < -0.12) this.blinkT = 2 + Math.random() * 3;
    this.computePose(combat, speed, run);
  }

  setFacing(f) {
    if (f !== this.facing) { this.facing = f; this.turnT = 0.08; }
  }

  computePose(combat, speed, run) {
    const p = this.pose;
    const t = performance.now() / 1000;
    p.blink = this.blinkT < 0;
    p.axeOnBack = !combat.target && !combat.swing && this.cheerT <= 0;
    p.bob = 0; p.legL = 0; p.legR = 0; p.armL = 0; p.armR = 0; p.lean = 0; p.squash = 0; p.look = 0; p.mouth = false;
    p.scarf = Math.max(-3, Math.min(3, this.vx / 30)) * this.facing + Math.sin(t * 3) * 0.4;
    if (!this.onGround) {
      p.squash = this.vy < 0 ? -1 : 0;
      p.legL = 2; p.legR = 1; p.armL = -2;
    } else if (speed > 4) {
      const s = Math.sin(this.walkPhase);
      const amp = run ? 3 : 2;
      p.legL = Math.max(0, s) * amp; p.legR = Math.max(0, -s) * amp;
      p.bob = -Math.abs(Math.cos(this.walkPhase)) * (run ? 1.5 : 1) + 0.5;
      p.armL = s * 1.5;
      p.lean = run ? 1 : 0;
    } else {
      p.bob = Math.sin(t * 2.2) > 0.6 ? 1 : 0; // slow breathing
    }
    if (this.turnT > 0) p.squash = 1;
    if (this.landT > 0) p.squash = 2 * (this.landT / 0.14);
    if (this.gatherT > 0) { p.squash = 2; p.lean = 1; }
    if (this.surpriseT > 0) { p.bob = -2; p.mouth = true; }
    if (combat.target || combat.swing) {
      p.axeAngle = 0.7;
      p.legL = 0; p.legR = 0;
      const s = combat.swing;
      if (s) {
        const w = SWING.windup, k = SWING.strike, f = SWING.follow;
        const miss = s.j === 'miss', crit = s.j === 'crit';
        const endA = miss ? 2.25 : 1.45;
        if (s.t < w) { const u = easeOut(s.t / w); p.axeAngle = lerp(0.7, -1.25, u); p.lean = -1; p.squash = -1 * u; }
        else if (s.t < w + k) { const u = easeIn((s.t - w) / k); p.axeAngle = lerp(-1.25, endA, u); p.lean = lerp(-1, 2, u); }
        else if (s.t < w + k + f) {
          const u = easeOut((s.t - w - k) / f); p.axeAngle = lerp(endA, endA + (miss ? 0.35 : 0.12), u);
          p.lean = 2; p.squash = crit ? 2 : 1; p.legR = miss ? 1 : 0; p.mouth = crit;
        } else {
          const u = easeInOut(Math.min(1, (s.t - w - k - f) / (s.total - w - k - f)));
          p.axeAngle = lerp(endA + (miss ? 0.35 : 0.12), 0.7, u); p.lean = lerp(2, 0, u);
        }
      } else p.bob = Math.sin(t * 3) > 0.3 ? 1 : 0;
    }
    if (this.forceAxe > 0) { p.axeOnBack = false; p.axeAngle = lerp(-2.6, 0.7, this.forceAxe); p.lean = this.forceAxe < 0.5 ? -1 : 0; }
    if (this.cheerT > 0) { p.axeAngle = -0.15; p.axeOnBack = false; p.bob = -Math.round(Math.abs(Math.sin(this.cheerT * 10)) * 3); p.mouth = true; }
  }
}
