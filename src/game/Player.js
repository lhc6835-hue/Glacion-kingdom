// Player movement and animation. Every visible motion runs on springs (squash, body tilt, axe
// angle, scarf) so moves anticipate, overshoot and settle instead of snapping between poses.
import { WORLD, groundY } from './World.js';
import { SWING } from '../data/balance.js';

const WALK = 56, RUN = 96, ACCEL = 640, DECEL = 820, JUMP_V = 165, GRAV = 560, JUMP_CUT = 0.5;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeIn3 = (t) => t * t * t;
const easeOutBack = (t, k = 1.9) => 1 + (k + 1) * Math.pow(t - 1, 3) + k * Math.pow(t - 1, 2);

// Damped spring step: value chases target; stiffness k, damping c (lower c = bouncier).
function spring(o, key, vel, target, k, c, dt) {
  o[vel] += ((target - o[key]) * k - o[vel] * c) * dt;
  o[key] += o[vel] * dt;
}

export const REST_ANGLE = 0.6;

export class Player {
  constructor(x) {
    this.x = x; this.y = groundY(x);
    this.vx = 0; this.vy = 0;
    this.facing = 1;
    this.onGround = true;
    this.walkPhase = 0;
    this.gatherT = 0; this.cheerT = 0; this.surpriseT = 0;
    this.blinkT = 2;
    this.stepAcc = 0;
    this.jumpBuf = 0;
    this.anchor = null; // standing spot while chopping
    this.pose = {};
    this.locked = false; // UI control
    // springs
    this.faceS = 1;
    this.scarf = 1.2; this.scarfV = 0;
    this.sq = 0; this.sqV = 0;        // + stretch, − squash
    this.rot = 0; this.rotV = 0;      // body tilt (radians, toward facing)
    this.axe = REST_ANGLE; this.axeV = 0;
    this.lastLanded = false;
    this.events = null;
  }

  kick(sq, rot = 0) { this.sqV += sq * 18; this.rotV += rot * 18; }

  update(dt, input, combat, events) {
    this.events = events;
    const engaged = !!combat.target;
    let dir = 0;
    if (!this.locked) {
      if (input.down('a', 'ArrowLeft')) dir -= 1;
      if (input.down('d', 'ArrowRight')) dir += 1;
    }
    if (engaged && dir !== 0) combat.disengage();
    const run = input.down('Shift') || input.touchRun;
    const target = dir * (run ? RUN : WALK);
    if (combat.target && this.anchor !== null) {
      // glide to the chopping spot and face the trunk
      this.vx = 0;
      this.x += (this.anchor - this.x) * Math.min(1, dt * 14);
      this.setFacing(combat.target.x > this.x ? 1 : -1);
    } else {
      // quick to start, a little slide when stopping
      const rate = (dir && Math.sign(target) === Math.sign(this.vx || target) ? ACCEL : DECEL) * (this.onGround ? 1 : 0.55) * dt;
      this.vx = Math.abs(target - this.vx) < rate ? target : this.vx + Math.sign(target - this.vx) * rate;
      if (dir) this.setFacing(dir);
    }
    this.x = clamp(this.x + this.vx * dt, WORLD.minX, WORLD.maxX);

    // jump with a short input buffer; letting go early cuts the jump (variable height)
    if (!this.locked && !engaged && input.hit(' ')) this.jumpBuf = 0.12;
    this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    if (this.jumpBuf > 0 && this.onGround) {
      this.jumpBuf = 0;
      this.vy = -JUMP_V; this.onGround = false;
      this.kick(0.45);
      events.emit('jump', {});
    }
    if (!this.onGround && this.vy < 0 && !input.down(' ')) this.vy *= Math.pow(JUMP_CUT, dt * 12);
    const gy = groundY(this.x);
    if (!this.onGround) {
      this.vy += GRAV * dt;
      this.y += this.vy * dt;
      if (this.y >= gy) {
        const impact = this.vy;
        this.y = gy; this.onGround = true; this.vy = 0;
        this.kick(-clamp(impact / 160, 0.25, 0.9) * 0.42);
        events.emit('land', { impact });
      }
    } else this.y = gy;

    const speed = Math.abs(this.vx);
    if (this.onGround && speed > 4) {
      this.walkPhase += dt * speed * 0.2;
      this.stepAcc += dt * speed;
      if (this.stepAcc > (run ? 26 : 20)) { this.stepAcc = 0; events.emit('step', { run, x: this.x - this.facing * 4, y: this.y }); this.kick(-0.06); }
    } else this.walkPhase += (Math.round(this.walkPhase / 2.2) * 2.2 - this.walkPhase) * Math.min(1, dt * 10);
    for (const k of ['gatherT', 'cheerT', 'surpriseT']) this[k] = Math.max(0, this[k] - dt);
    this.blinkT -= dt;
    if (this.blinkT < -0.12) this.blinkT = 2 + Math.random() * 3;

    this.faceS += (this.facing - this.faceS) * Math.min(1, dt * 18);
    const sTgt = 1.25 + (0.12 - 1.25) * Math.min(1, speed / RUN) + (this.onGround ? 0 : this.vy < 0 ? 0.5 : -0.45);
    spring(this, 'scarf', 'scarfV', sTgt, 90, 7, dt);
    this.animate(dt, combat, speed);
  }

  setFacing(f) {
    if (f !== this.facing) { this.facing = f; this.kick(-0.12); }
  }

  // Springs toward the pose of the moment; the swing drives the axe directly on the way down.
  animate(dt, combat, speed) {
    const t = performance.now() / 1000;
    const moving = this.onGround && speed > 8;
    const s = combat.swing;
    // squash target: stretch while rising, a little squash on the way down
    let sqT = this.onGround ? 0 : clamp(-this.vy / 650, -0.12, 0.2);
    let rotT = this.onGround ? clamp(this.vx * this.facing / RUN, -1, 1) * 0.1 : clamp(this.vy / 900, -0.08, 0.12);
    let axeT = REST_ANGLE + (moving ? Math.sin(this.walkPhase * 1.43) * 0.16 : Math.sin(t * 3.2) * 0.05) + (this.onGround ? 0 : -0.4);
    let drive = null, smear = 0, mouth = this.surpriseT > 0;
    if (this.gatherT > 0) sqT = -0.18;
    if (s && s !== this.curSwing) { this.curSwing = s; this.windFrom = this.axe; this.lastLanded = false; }
    if (!s) this.curSwing = null;
    if (s) {
      const w = SWING.windup, k = SWING.strike, f = SWING.follow;
      const miss = s.j === 'miss', crit = s.j === 'crit';
      const endA = miss ? 2.35 : 1.78;
      if (s.t < w) {
        // anticipation: pull back past the top, rise on the toes
        const u = s.t / w;
        drive = lerp(this.windFrom ?? REST_ANGLE, -1.2, easeOutBack(u, 1.4));
        rotT = -0.16; sqT = 0.16;
      } else if (s.t < w + k) {
        const u = (s.t - w) / k;
        drive = lerp(-1.2, endA, easeIn3(u));
        smear = u; rotT = lerp(-0.16, 0.2, u); sqT = lerp(0.16, -0.05, u);
      } else {
        axeT = s.t < w + k + f ? endA : REST_ANGLE;
        rotT = s.t < w + k + f ? 0.14 : 0;
        if (s.t < w + k + f) mouth = crit;
      }
      if (s.landed && !this.lastLanded) {
        // impact: the body squashes into the blow and the axe's momentum carries it on
        this.lastLanded = true;
        this.kick(crit ? -0.42 : miss ? 0.05 : -0.26, miss ? 0.5 : 0.25);
        this.axeV = miss ? 22 : crit ? 14 : 9;
      }
    }
    if (this.cheerT > 0) { axeT = -0.15; sqT = Math.abs(Math.sin(this.cheerT * 9)) * 0.22; mouth = true; }

    spring(this, 'sq', 'sqV', sqT, 300, 15, dt);       // jelly: under-damped, overshoots once
    this.sq = clamp(this.sq, -0.3, 0.32);
    spring(this, 'rot', 'rotV', rotT, 220, 16, dt);
    if (drive !== null) { this.axeV = (drive - this.axe) / Math.max(dt, 1e-3); this.axe = drive; }
    else spring(this, 'axe', 'axeV', axeT, 380, 17, dt);

    const p = this.pose;
    p.blink = this.blinkT < 0;
    p.onGround = this.onGround;
    p.moving = moving;
    p.walkFrame = ((Math.floor(this.walkPhase / 1.1) % 4) + 4) % 4;
    p.bob = moving ? -Math.abs(Math.sin(this.walkPhase * 1.43)) * 1.1 : 0;
    p.sway = moving ? Math.sin(this.walkPhase * 1.43) * 0.035 : 0;
    p.breathe = this.onGround && !moving && !s ? Math.sin(t * 3.2) * 0.025 : 0;
    p.tail = !moving && Math.floor(t * 2.5) % 2 === 1;
    p.faceS = this.faceS;
    p.scarfA = this.scarf;
    p.axeOnBack = false;
    p.axeAngle = this.axe;
    p.sq = this.sq;
    p.rot = this.rot;
    p.smear = smear;
    p.mouth = mouth;
  }
}
