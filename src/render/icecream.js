// The hero: a mold with a stack of scoops and a face. IceCreamRig owns all the springy motion —
// each scoop rides on the one below with its own lag, so the stack sways and squishes like jelly.
import { Spring } from '../core/spring.js';
import { TAU, clamp } from '../core/math.js';
import { scoopSprite, R, star } from './scoopArt.js';
import { moldArt, overflowArt } from './moldArt.js';
import { drawSprite, whiteOf } from './sprite.js';
import { drawFace, drawCrown } from './face.js';
import { FLAVOR } from '../../shared/flavors.js';
import { GRADE_INDEX } from '../../shared/grades.js';

export const STACK = R * 1.16; // vertical distance between scoop centres
const whites = new Map();
const white = (key, s) => { let w = whites.get(key); if (!w) { w = whiteOf(s); whites.set(key, w); } return w; };

const layerSprings = (i) => ({
  x: new Spring(0, 240 - i * 26, 8.5 - i * 0.6),
  s: new Spring(1, 300 - i * 30, 10),
  y: new Spring(0, 190 - i * 22, 7.5 - i * 0.6),
  r: new Spring(0, 150 - i * 15, 6.5 - i * 0.5),
});

export class IceCreamRig {
  constructor(look) {
    this.setLook(look);
    this.squash = new Spring(1, 320, 13);
    this.lean = new Spring(0, 90, 9);
    this.lookX = new Spring(0, 120, 14);
    this.lookY = new Spring(0, 120, 14);
    this.phase = 0;
    this.bob = 0;
    this.blink = 0;
    this.blinkT = 2 + Math.random() * 3;
    this.flash = 0;
    this.mood = 0;
    this.moodT = 0;
    this.t = Math.random() * 10;
    this.pvx = 0; this.pvy = 0;
    this.air = 0; // extra lift for jumps (side view), in design units
    this.steps = []; // delayed per-scoop kicks from footsteps
    this.stepSide = 1;
  }

  // One footstep: the bottom scoop reacts first and the kick ripples up the stack, so the
  // scoops hop up one after another, tip side to side and squish as they land.
  step(vx, amt) {
    this.stepSide = -this.stepSide;
    this.layers.forEach((_, i) => this.steps.push({ t: i * 0.04, i, amt, side: this.stepSide, vx }));
  }

  setLook(look) {
    this.look = { ...look, flavors: [...look.flavors] };
    const n = this.look.flavors.length;
    if (!this.layers || this.layers.length !== n) {
      this.layers = Array.from({ length: n }, (_, i) => layerSprings(i));
    }
  }

  // Drop the top scoop (it melted). Returns its flavor id.
  popLayer() {
    const f = this.look.flavors.pop();
    this.layers.pop();
    this.squash.kick(-4);
    for (const l of this.layers) l.x.kick((Math.random() - 0.5) * 60);
    return f;
  }
  pushLayer(flavor) {
    this.look.flavors.push(flavor);
    const i = this.layers.length;
    const l = layerSprings(i);
    l.s.snap(0.2); l.s.target = 1;
    this.layers.push(l);
    this.squash.kick(3);
  }

  hurt() { this.flash = 1; this.squash.kick(-5); this.mood = 1; this.moodT = 0.45; for (const l of this.layers) l.x.kick((Math.random() - 0.5) * 120); }
  happy(d = 1.2) { this.mood = 2; this.moodT = d; }
  punch(dx, dy, amt = 1) {
    // recoil from attacking: squash along the stack and fling the scoops opposite to the swing
    this.squash.kick(-2.2 * amt);
    this.layers.forEach((l, i) => l.x.kick(-dx * 55 * amt * (1 + i * 0.35)));
  }
  land(v = 1) { this.squash.kick(-3.5 * v); this.layers.forEach((l, i) => l.s.kick(-2 * v * (1 + i * 0.2))); }

  update(dt, { vx = 0, vy = 0, lookX = 0, lookY = 0, speed = 230, walk = true } = {}) {
    this.t += dt;
    const ax = (vx - this.pvx) / Math.max(dt, 1e-3);
    this.pvx = vx; this.pvy = vy;
    const sp = Math.hypot(vx, vy);
    const moving = sp > 20;

    // hop-walk: little bounces whose landing squashes the stack
    if (moving && walk) {
      const prev = Math.sin(this.phase);
      this.phase += dt * (9 + (sp / speed) * 5);
      const now = Math.sin(this.phase);
      if (prev > 0 !== now > 0) { this.squash.kick(-2.2); this.step(vx, clamp(sp / speed, 0.5, 1.2)); }
      this.bob = Math.abs(now) * 5.5 * clamp(sp / speed, 0.4, 1);
    } else {
      this.bob += (0 - this.bob) * Math.min(1, dt * 14);
      this.phase = 0;
    }
    if (this.look.mold === 'cloud') this.bob = 6 + Math.sin(this.t * 2.2) * 3;

    this.lean.target = clamp(vx / speed, -1, 1) * 0.07;
    this.lean.update(dt);
    for (const st of this.steps) {
      st.t -= dt;
      if (st.t > 0) continue;
      const l = this.layers[st.i];
      if (!l) continue;
      const k = st.amt * (1 + st.i * 0.45);
      l.y.vel -= 80 * k;                         // hop up
      l.s.kick(-1.1 * k);                        // squish on the way
      l.r.vel += st.side * 2 * k;                // tip toward the stepping side
      l.x.kick(-st.vx * 0.04 * (1 + st.i * 0.3)); // lag behind the motion
    }
    this.steps = this.steps.filter((st) => st.t > 0);
    const kick = clamp(ax, -4000, 4000) * 0.0042;
    this.layers.forEach((l, i) => {
      l.x.vel -= kick * (1 + i * 0.55) * dt * 60;
      l.x.update(dt);
      l.x.value = clamp(l.x.value, -14, 14);
      // idle: a slow breathing squish, each scoop a little out of phase
      l.s.target = moving ? 1 : 1 + Math.sin(this.t * 2.4 - i * 0.7) * 0.025;
      l.s.update(dt);
      l.y.update(dt);
      l.y.value = clamp(l.y.value, -14, 8);
      l.r.update(dt);
      l.r.value = clamp(l.r.value, -2.5, 2.5);
    });
    this.squash.update(dt);

    this.lookX.target = lookX; this.lookY.target = lookY;
    this.lookX.update(dt); this.lookY.update(dt);

    this.blinkT -= dt;
    if (this.blinkT < 0) { this.blink = 1; this.blinkT = 2.5 + Math.random() * 3.5; }
    this.blink = Math.max(0, this.blink - dt * 7);
    this.flash = Math.max(0, this.flash - dt * 5);
    if (this.moodT > 0) { this.moodT -= dt; if (this.moodT <= 0) this.mood = 0; }
  }

  // Draws with the ground contact point at (x, y). scale converts design units to world units.
  draw(g, x, y, scale = 1, { shadow = true, alpha = 1 } = {}) {
    const m = moldArt(this.look.mold);
    const sq = clamp(this.squash.value, 0.55, 1.5);
    g.save();
    g.globalAlpha = alpha;
    g.translate(x, y);
    g.scale(scale, scale);
    if (shadow) {
      const lift = this.bob + this.air;
      g.fillStyle = `rgba(140,80,130,${0.2 * clamp(1 - lift / 120, 0.3, 1)})`;
      g.beginPath();
      g.ellipse(0, 0, 26 * (1 - lift / 300), 8 * (1 - lift / 300), 0, 0, TAU);
      g.fill();
    }
    g.translate(0, -this.bob - this.air);
    g.rotate(this.lean.value);
    g.scale(1 / Math.sqrt(sq), sq);

    drawSprite(g, m.back);
    if (this.flash > 0) this.flashSprite(g, 'mb' + this.look.mold, m.back);

    let ox = 0, oy = 0;
    const n = this.look.flavors.length;
    const tops = [];
    for (let i = 0; i < n; i++) {
      const l = this.layers[i];
      ox += l.x.value;
      oy += l.y.value;
      const cy = m.seat - i * STACK + oy;
      const s = scoopSprite(this.look.flavors[i]);
      g.save();
      g.translate(ox, cy);
      g.rotate(l.x.value * 0.012 + l.r.value * 0.035);
      const ls = clamp(l.s.value, 0.3, 1.6);
      g.scale(1 / Math.sqrt(ls), ls);
      drawSprite(g, s);
      if (this.flash > 0) this.flashSprite(g, 's' + this.look.flavors[i], s);
      g.restore();
      tops.push([ox, cy]);
    }
    if (m.front) {
      drawSprite(g, m.front);
      if (this.flash > 0) this.flashSprite(g, 'mf' + this.look.mold, m.front);
    }
    if (m.rim && n > 0) {
      // cream from the bottom scoop spilling over the rim, riding the scoop's sway
      const f = FLAVOR[this.look.flavors[0]] || FLAVOR.milk;
      g.save();
      g.translate(this.layers[0].x.value * 0.35, 0);
      drawSprite(g, overflowArt(this.look.mold, f));
      g.restore();
    }

    if (n > 0) {
      const [tx, ty] = tops[n - 1];
      drawFace(g, this.look.face, tx, ty - R * 0.12, R, { lookX: this.lookX.value, lookY: this.lookY.value, blink: this.blink, mood: this.mood, t: this.t });
      if (this.look.face === 'crown') drawCrown(g, tx + 2, ty - R * 0.9, R * 1.1);
      // shimmer on the fanciest flavors
      for (let i = 0; i < n; i++) {
        const gi = GRADE_INDEX[(FLAVOR[this.look.flavors[i]] || {}).grade];
        if (gi >= 7) {
          const [cx, cy] = tops[i];
          for (let k = 0; k < 2; k++) {
            const p = (this.t * 0.7 + k * 0.5 + i * 0.3) % 1;
            const a = (k * 2.4 + i * 1.3 + Math.floor(this.t * 0.7 + k * 0.5)) * 2.1;
            const s = Math.sin(p * Math.PI) * (gi === 9 ? 3.4 : 2.6);
            star(g, cx + Math.cos(a) * R * 0.8, cy + Math.sin(a) * R * 0.55 - R * 0.2, s, gi === 9 ? '#fff2b0' : '#ffffff');
          }
        }
      }
    } else {
      drawFace(g, this.look.face, 0, m.seat + R * 0.1, R * 0.8, { mood: 1, t: this.t });
    }
    g.restore();
  }

  flashSprite(g, key, s) {
    const w = white(key, s);
    const a = g.globalAlpha;
    g.globalAlpha = a * this.flash * 0.85;
    drawSprite(g, w);
    g.globalAlpha = a;
  }

  // Height of the top of the stack above the ground, in design units (for name tags, bubbles).
  topY() {
    const m = moldArt(this.look.mold);
    return m.seat - (this.look.flavors.length - 1) * STACK - R - this.bob - this.air;
  }
}
