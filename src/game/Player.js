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
    this.stowed = false; // cinematic: axe still on the back
    this.faceS = 1; this.scarf = 1.2; this.scarfV = 0;
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
    // paper-flip turn and a scarf on a spring: hangs down at rest, streams back when running
    this.faceS += (this.facing - this.faceS) * Math.min(1, dt * 20);
    const sTgt = 1.25 + (0.12 - 1.25) * Math.min(1, speed / RUN) + (this.onGround ? 0 : this.vy < 0 ? 0.5 : -0.45);
    this.scarfV += ((sTgt - this.scarf) * 90 - this.scarfV * 7) * dt;
    this.scarf += this.scarfV * dt;
    this.computePose(combat, speed, run);
  }

  setFacing(f) {
    if (f !== this.facing) { this.facing = f; this.turnT = 0.08; }
  }

  computePose(combat, speed, run) {
    const p = this.pose;
    const t = performance.now() / 1000;
    p.blink = this.blinkT < 0;
    p.onGround = this.onGround;
    p.moving = this.onGround && speed > 8;
    p.walkFrame = Math.floor(this.walkPhase / 1.1) % 4;
    p.tail = !p.moving && Math.floor(t * 2.5) % 2 === 1;
    p.faceS = this.faceS;
    p.scarfA = this.scarf;
    p.axeOnBack = this.stowed;
    p.axeAngle = 0.6 + (p.moving ? Math.sin(this.walkPhase * 1.4) * 0.14 : Math.sin(t * 3.2) * 0.04) + (this.onGround ? 0 : -0.35);
    p.lean = this.onGround ? Math.max(-1, Math.min(1, this.vx / RUN)) * 1.2 : 0;
    p.squash = 0; p.mouth = false; p.smear = 0;
    if (!this.onGround) p.squash = this.vy < 0 ? -1.2 : 0.4;
    if (this.landT > 0) p.squash = 2.2 * (this.landT / 0.14);
    if (this.gatherT > 0) p.squash = 1.5;
    if (this.surpriseT > 0) p.mouth = true;
    const s = combat.swing;
    if (s) {
      const w = SWING.windup, k = SWING.strike, f = SWING.follow;
      const miss = s.j === 'miss', crit = s.j === 'crit';
      const endA = miss ? 2.3 : 1.75, over = miss ? 0.35 : 0.08;
      if (s.t < w) { const u = easeOut(s.t / w); p.axeAngle = lerp(0.6, -1.15, u); p.lean = -u; p.squash = -0.8 * u; }
      else if (s.t < w + k) { const u = easeIn((s.t - w) / k); p.axeAngle = lerp(-1.15, endA, u); p.lean = lerp(-1, 1.5, u); p.smear = u; }
      else if (s.t < w + k + f) {
        const u = easeOut((s.t - w - k) / f);
        p.axeAngle = lerp(endA, endA + over, u); p.lean = 1.5; p.squash = crit ? 1.6 : 0.9; p.mouth = crit;
      } else {
        const u = easeInOut(Math.min(1, (s.t - w - k - f) / (s.total - w - k - f)));
        p.axeAngle = lerp(endA + over, 0.6, u); p.lean = lerp(1.5, 0, u);
      }
    }
    if (this.forceAxe > 0) { p.axeOnBack = false; p.axeAngle = lerp(-2.4, 0.6, this.forceAxe); }
    if (this.cheerT > 0) { p.axeAngle = -0.1; p.axeOnBack = false; p.squash = -Math.abs(Math.sin(this.cheerT * 10)) * 1.5; p.mouth = true; }
  }
}
