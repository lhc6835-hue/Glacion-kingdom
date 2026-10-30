// Damped springs drive almost every motion in the game: the jiggle of stacked scoops, squash and
// stretch, weapon follow-through, UI pops. Semi-implicit Euler, stable for the dt we clamp to.
export class Spring {
  constructor(value = 0, stiffness = 180, damping = 12) {
    this.value = value;
    this.target = value;
    this.vel = 0;
    this.k = stiffness;
    this.d = damping;
  }
  update(dt) {
    const a = (this.target - this.value) * this.k - this.vel * this.d;
    this.vel += a * dt;
    this.value += this.vel * dt;
    return this.value;
  }
  kick(v) { this.vel += v; }
  snap(v) { this.value = this.target = v; this.vel = 0; }
}

// Squash & stretch pair that preserves area: sy = 1 / sx.
export class Squash {
  constructor(k = 260, d = 10) { this.s = new Spring(1, k, d); }
  update(dt) { this.s.update(dt); }
  kick(v) { this.s.kick(v); }
  get sx() { return 1 / Math.max(0.4, this.s.value); }
  get sy() { return Math.max(0.4, this.s.value); }
}
