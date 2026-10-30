// Shared side-view engine for the plaza and the mold gallery: a walking, jumping ice cream,
// one-way platforms, interactable spots with prompts, chat bubbles and a smooth camera.
import { IceCreamRig } from '../render/icecream.js';
import { clamp, damp, TAU } from '../core/math.js';
import { sfx } from '../core/audio.js';

export const SIDE_SCALE = 1.05;
const GRAV = 2300, JUMP = 820, WALK = 300;

export class SideActor {
  constructor(look, { name = '', x = 0, y = 0, local = false, level = 1 } = {}) {
    this.rig = new IceCreamRig(look);
    this.name = name;
    this.level = level;
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.onGround = true;
    this.facing = 1;
    this.local = local;
    this.coyote = 0;
    this.bubble = null;
    this.tx = x; this.ty = y; // network targets
  }
  say(text) { this.bubble = { text, t: 0 }; }

  physics(dt, world, move, jumpPressed, jumpHeld) {
    const f = damp(this.onGround ? 14 : 5, dt);
    this.vx += (move * WALK - this.vx) * f;
    if (Math.abs(move) > 0.1) this.facing = Math.sign(move);
    this.coyote -= dt;
    if (this.onGround) this.coyote = 0.1;
    if (jumpPressed && this.coyote > 0) {
      this.vy = -JUMP;
      this.onGround = false;
      this.coyote = 0;
      this.rig.squash.kick(5);
      sfx.jump();
    }
    // shorter hop when the button is let go early
    this.vy += GRAV * dt * (this.vy < 0 && !jumpHeld ? 1.9 : 1);
    const prevY = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.x = clamp(this.x, world.x0 + 30, world.x1 - 30);
    const wasGround = this.onGround;
    this.onGround = false;
    const ground = world.groundAt(this.x, prevY, this.y);
    if (this.vy >= 0 && ground != null) {
      this.y = ground;
      if (!wasGround && this.vy > 300) { this.rig.land(clamp(this.vy / 900, 0.5, 1.6)); sfx.land(); }
      this.vy = 0;
      this.onGround = true;
    }
  }

  update(dt) {
    this.rig.update(dt, { vx: this.vx, vy: 0, lookX: this.facing * 0.7, lookY: 0.1, speed: WALK, walk: this.onGround });
    this.rig.air = 0;
    if (this.bubble) { this.bubble.t += dt; if (this.bubble.t > 4.5) this.bubble = null; }
  }

  draw(g, s = SIDE_SCALE) {
    this.rig.draw(g, this.x, this.y, s, { shadow: this.onGround });
    if (!this.onGround) {
      g.fillStyle = 'rgba(70,40,60,0.15)';
      g.beginPath(); g.ellipse(this.x, this.groundY ?? this.y, 22, 6, 0, 0, TAU); g.fill();
    }
    const top = this.y + this.rig.topY() * s;
    if (this.name) {
      g.save();
      g.font = '14px Jua, sans-serif';
      g.textAlign = 'center';
      const label = `Lv.${this.level} ${this.name}`;
      const w = g.measureText(label).width + 16;
      g.fillStyle = this.local ? 'rgba(255,122,162,0.9)' : 'rgba(110,80,140,0.75)';
      g.beginPath(); g.roundRect(this.x - w / 2, top - 30, w, 20, 10); g.fill();
      g.fillStyle = '#fff'; g.fillText(label, this.x, top - 15);
      g.restore();
    }
    if (this.bubble) drawBubble(g, this.x, top - 38, this.bubble.text, this.bubble.t);
  }
}

export function drawBubble(g, x, y, text, t) {
  const pop = clamp(t * 6, 0, 1), fade = clamp((4.5 - t) * 2, 0, 1);
  g.save();
  g.globalAlpha = fade;
  g.font = '16px Jua, sans-serif';
  const lines = wrap(g, text, 220);
  const w = Math.max(...lines.map((l) => g.measureText(l).width)) + 24, hgt = lines.length * 20 + 14;
  g.translate(x, y);
  g.scale(0.6 + 0.4 * pop + Math.sin(pop * Math.PI) * 0.1, 0.6 + 0.4 * pop);
  g.fillStyle = '#ffffff';
  g.strokeStyle = 'rgba(200,140,170,0.8)';
  g.lineWidth = 2;
  g.beginPath(); g.roundRect(-w / 2, -hgt - 8, w, hgt, 14); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(-7, -9); g.lineTo(0, 0); g.lineTo(7, -9); g.closePath(); g.fill();
  g.fillStyle = '#4a2c3a'; g.textAlign = 'center';
  lines.forEach((l, i) => g.fillText(l, 0, -hgt + 12 + i * 20));
  g.restore();
}
function wrap(g, text, max) {
  const out = [];
  let cur = '';
  for (const ch of text) {
    if (g.measureText(cur + ch).width > max) { out.push(cur); cur = ''; }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out.slice(0, 4);
}

// A walkable side world: flat floor at y = 0 plus optional one-way platforms.
export class SideWorld {
  constructor(x0, x1, platforms = []) { this.x0 = x0; this.x1 = x1; this.platforms = platforms; }
  groundAt(x, prevY, y) {
    let best = null;
    for (const p of this.platforms) {
      if (x < p.x0 || x > p.x1) continue;
      if (prevY <= p.y + 1 && y >= p.y) best = best == null ? p.y : Math.min(best, p.y);
    }
    if (best != null) return best;
    return y >= 0 ? 0 : null;
  }
}

// Camera for side scenes: horizontal follow, fixed vertical framing on the floor line.
export class SideCam {
  constructor() { this.x = 0; this.y = 0; this.zoom = 1; }
  update(dt, tx, ty, world) {
    const W = innerWidth, H = innerHeight;
    this.zoom = clamp(H / 700, 0.6, 1.6) * (W < 600 ? 0.9 : 1);
    const halfW = W / 2 / this.zoom;
    const cx = clamp(tx, world.x0 + halfW, world.x1 - halfW);
    const f = damp(5, dt);
    this.x += ((world.x1 - world.x0 < halfW * 2 ? (world.x0 + world.x1) / 2 : cx) - this.x) * f;
    this.y += (ty - this.y) * f;
  }
  apply(g) {
    const W = innerWidth, H = innerHeight;
    g.translate(W / 2, H * 0.72);
    g.scale(this.zoom, this.zoom);
    g.translate(-this.x, -this.y);
  }
  // visible world rect
  view() {
    const W = innerWidth, H = innerHeight, z = this.zoom;
    return { x0: this.x - W / 2 / z, x1: this.x + W / 2 / z, y0: this.y - H * 0.72 / z, y1: this.y + H * 0.28 / z };
  }
}

// Interaction prompt drawn above a spot.
export function drawPrompt(g, x, y, text, t, touch) {
  g.save();
  const bob = Math.sin(t * 5) * 3;
  g.translate(x, y + bob);
  g.font = '15px Jua, sans-serif';
  const label = (touch ? '' : 'E  ') + text;
  const w = g.measureText(label).width + 22;
  g.fillStyle = 'rgba(74,44,58,0.85)';
  g.beginPath(); g.roundRect(-w / 2, -26, w, 26, 13); g.fill();
  g.fillStyle = '#fff'; g.textAlign = 'center';
  g.fillText(label, 0, -8);
  if (!touch) {
    g.fillStyle = '#ff9cbc';
    g.beginPath(); g.roundRect(-w / 2 + 6, -21, 16, 16, 5); g.fill();
    g.fillStyle = '#fff'; g.fillText('E', -w / 2 + 14, -8);
    g.fillStyle = 'rgba(74,44,58,0.85)';
  }
  g.restore();
}
