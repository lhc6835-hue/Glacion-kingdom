import * as THREE from 'three';
import { HALF } from '../world/Layout.js';

// The player: a young bluebird of the Featherfolk. Walks, runs, hops, glides off heights
// and paddles across water. Cliffs block walking but never trap you: you can always glide down.

const WALK = 4.4, RUN = 7.6, SWIM = 2.6, GLIDE = 9.5;
const GRAVITY = 24, JUMP = 7.2, GLIDE_FALL = 2.4;
const STEP_UP = 0.85; // highest ledge you can hop onto while walking
const RADIUS = 0.42;

export class Player {
  constructor(world, collision, walkables) {
    this.world = world;
    this.collision = collision;
    this.walkables = walkables;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.facing = 0; // 0 south, 1 north, 2 west, 3 east
    this.onGround = true;
    this.gliding = false;
    this.swimming = false;
    this.anim = 0;
    this.frame = 0;
    this.stamina = 1;
    this.airTime = 0;
    this._o = { x: 0, z: 0, hit: null };
  }

  spawn(x, z) {
    this.pos.set(x, this.groundAt(x, z, 999), z);
    this.vel.set(0, 0, 0);
  }

  // Ground under (x,z) that is reachable from height y: terrain or a bridge deck below y.
  groundAt(x, z, y) {
    let g = this.world.groundHeight(x, z);
    for (const w of this.walkables) {
      if (x >= w.x0 && x <= w.x1 && z >= w.z0 && z <= w.z1 && y >= w.y - 1.2) g = Math.max(g, w.y);
    }
    return g;
  }

  update(dt, input) {
    const mv = input.move();
    const moving = Math.hypot(mv.x, mv.z) > 0.15;
    const run = input.down('shift');
    const water = this.world.waterAt(this.pos.x, this.pos.z);
    const ground = this.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.5);
    this.swimming = !Number.isNaN(water) && water - ground > 0.55 && this.pos.y <= water - 0.3;

    let speed = this.swimming ? SWIM : this.gliding ? GLIDE : run ? RUN : WALK;
    const accel = this.onGround || this.swimming ? 14 : 4;
    const tx = mv.x * speed, tz = mv.z * speed;
    this.vel.x += (tx - this.vel.x) * Math.min(1, dt * accel);
    this.vel.z += (tz - this.vel.z) * Math.min(1, dt * accel);

    // Jump / glide.
    if (input.hit(' ')) {
      if (this.onGround || this.swimming) { this.vel.y = this.swimming ? JUMP * 0.7 : JUMP; this.onGround = false; this.swimming = false; }
    }
    const holdGlide = input.down(' ') && !this.onGround && this.vel.y < 0 && this.stamina > 0.02;
    this.gliding = holdGlide;
    if (this.gliding) this.stamina = Math.max(0, this.stamina - dt * 0.07);
    else if (this.onGround) this.stamina = Math.min(1, this.stamina + dt * 0.35);

    // Horizontal move with collision, axis by axis so we slide along cliffs.
    const nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt;
    const tryMove = (x, z) => {
      const g = this.groundAt(x, z, this.pos.y + 0.5);
      if (g > this.pos.y + STEP_UP) return false; // wall of a cliff in the way
      return true;
    };
    if (tryMove(nx, this.pos.z)) this.pos.x = nx; else this.vel.x = 0;
    if (tryMove(this.pos.x, nz)) this.pos.z = nz; else this.vel.z = 0;
    const o = this.collision.resolve(this.pos.x, this.pos.z, RADIUS, this.pos.y, this._o);
    if (tryMove(o.x, o.z)) { this.pos.x = o.x; this.pos.z = o.z; }
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -HALF + 30, HALF - 30);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -HALF + 30, HALF - 30);

    // Vertical.
    const g = this.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.5);
    const w = this.world.waterAt(this.pos.x, this.pos.z);
    const floatY = !Number.isNaN(w) && w - g > 0.55 ? w - 0.45 : -Infinity;
    if (this.onGround && !this.swimming) {
      if (g < this.pos.y - 0.9) { this.onGround = false; this.vel.y = 0; } // walked off a ledge
      else this.pos.y += (g - this.pos.y) * Math.min(1, dt * 20);
    }
    if (!this.onGround) {
      this.airTime += dt;
      this.vel.y -= GRAVITY * dt;
      if (this.gliding) this.vel.y = Math.max(this.vel.y, -GLIDE_FALL);
      this.pos.y += this.vel.y * dt;
      if (this.pos.y <= floatY && floatY > g) { this.pos.y = floatY; this.vel.y = 0; this.onGround = false; this.swimming = true; this.airTime = 0; }
      else if (this.pos.y <= g) { this.pos.y = g; this.vel.y = 0; this.onGround = true; this.airTime = 0; }
    }
    if (this.swimming) {
      this.pos.y += (floatY + Math.sin(performance.now() * 0.004) * 0.05 - this.pos.y) * Math.min(1, dt * 8);
      this.onGround = false;
      if (floatY === -Infinity) { this.swimming = false; this.onGround = true; }
    }

    // Facing and animation frame.
    if (moving) {
      if (Math.abs(mv.x) > Math.abs(mv.z) * 0.8) this.facing = mv.x < 0 ? 2 : 3;
      else this.facing = mv.z < 0 ? 1 : 0;
    }
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (this.gliding) this.frame = 5;
    else if (!this.onGround && !this.swimming) this.frame = 2;
    else if (hs > 0.5) { this.anim += dt * hs * 1.6; this.frame = 1 + (Math.floor(this.anim) % 4); }
    else this.frame = 0;
  }
}
