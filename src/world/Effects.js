import { Atlas } from '../gfx/Atlas.js';
import { SpriteLayer } from '../gfx/Sprites.js';
import { canvas } from '../art/paint.js';
import { hash2 } from './noise.js';
import { LAKE } from './Layout.js';

// Living-world particles: mist rolling off the foot of every waterfall (with a rainbow in
// the afternoon sun), fireflies over the lake shore at night, and petals drifting around the
// player when they walk among blossom trees.

function puff() {
  const c = canvas(64, 64), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
  g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.45, 'rgba(246,251,255,0.55)'); g.addColorStop(1, 'rgba(240,248,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return c;
}
function spark() {
  const c = canvas(24, 24), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(12, 12, 0, 12, 12, 12);
  g.addColorStop(0, 'rgba(255,255,220,1)'); g.addColorStop(0.3, 'rgba(210,255,150,0.6)'); g.addColorStop(1, 'rgba(160,255,120,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 24, 24);
  return c;
}
function petal() {
  const c = canvas(12, 10), ctx = c.getContext('2d');
  ctx.fillStyle = 'rgb(255,200,215)';
  ctx.beginPath(); ctx.ellipse(6, 5, 5, 3, 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,240,245,0.9)'; ctx.beginPath(); ctx.ellipse(5, 4, 2, 1.2, 0.4, 0, Math.PI * 2); ctx.fill();
  return c;
}
function rainbow() {
  const c = canvas(512, 260), ctx = c.getContext('2d');
  const bands = ['255,80,80', '255,170,60', '255,240,90', '110,220,110', '90,160,255', '150,110,230'];
  ctx.lineWidth = 9;
  bands.forEach((b, i) => { ctx.strokeStyle = `rgba(${b},0.32)`; ctx.beginPath(); ctx.arc(256, 256, 240 - i * 9, Math.PI, 0); ctx.stroke(); });
  ctx.globalCompositeOperation = 'destination-in';
  const g = ctx.createLinearGradient(0, 0, 512, 0);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.3, 'rgba(0,0,0,1)'); g.addColorStop(0.7, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 260);
  return c;
}

export class Effects {
  constructor(scene, renderer, world, splashes) {
    const atlas = new Atlas(1024, 2);
    this.reg = { puff: atlas.add(puff()), spark: atlas.add(spark()), petal: atlas.add(petal()), rainbow: atlas.add(rainbow()) };
    const [tex] = atlas.textures(renderer);
    this.mist = new SpriteLayer(tex, 700, { cutout: false, dynamic: true, renderOrder: 4 });
    this.glow = new SpriteLayer(tex, 300, { cutout: false, additive: true, dynamic: true, renderOrder: 9 });
    scene.add(this.mist.mesh, this.glow.mesh);
    this.world = world;

    // Merge falls into a few big emitters.
    this.emitters = [];
    for (const s of splashes) {
      if (s.drop < 6) continue;
      const near = this.emitters.find((e) => Math.hypot(e.x - s.x, e.z - s.z) < 14);
      if (near) { near.n += s.n; near.drop = Math.max(near.drop, s.drop); near.x = (near.x + s.x) / 2; continue; }
      this.emitters.push({ ...s });
    }
    this.puffs = [];
    for (const e of this.emitters) {
      const count = Math.min(26, 6 + e.n * 2);
      for (let k = 0; k < count; k++) this.puffs.push({ e, t: hash2(k, e.x | 0, 7) * 4, life: 3 + hash2(k, e.z | 0, 8) * 3, ox: (hash2(k, 3, e.x | 0) - 0.5) * 2 });
    }
    // The biggest fall gets a rainbow.
    this.rainbowAt = this.emitters.slice().sort((a, b) => b.drop * b.n - a.drop * a.n)[0] || null;
    this.flies = [];
    for (let k = 0; k < 140; k++) {
      const a = hash2(k, 1, 77) * Math.PI * 2, r = 1.02 + hash2(k, 2, 77) * 0.25;
      this.flies.push({ x: LAKE.x + Math.cos(a) * LAKE.rx * r, z: LAKE.z + Math.sin(a) * LAKE.rz * r, ph: hash2(k, 3, 77) * 6.28 });
    }
    for (const f of this.flies) f.y = world.groundHeight(f.x, f.z) + 0.6;
    this.petals = Array.from({ length: 40 }, (_, k) => ({ x: 0, y: -999, z: 0, vx: 0, vy: 0, ph: k }));
  }

  update(dt, t, player, night, sunny) {
    const M = this.mist, G = this.glow;
    M.count = 0; G.count = 0;
    for (const p of this.puffs) {
      p.t += dt;
      if (p.t > p.life) p.t -= p.life;
      const k = p.t / p.life;
      const { e } = p;
      const spread = 2 + e.drop * 0.12;
      const x = e.x + p.ox * spread * (0.6 + k), z = e.z + 1 + k * 3;
      const y = e.y + k * (2.5 + e.drop * 0.18);
      const size = (3 + e.drop * 0.15) * (0.6 + k * 1.2);
      const a = Math.sin(k * Math.PI);
      if (Math.abs(x - player.pos.x) > 900) continue;
      M.add(this.reg.puff, x, y - size * 0.5, z, 64 / size, { bright: Math.min(1, a * 1.1 + 0.15), emissive: 0.85 });
    }
    if (this.rainbowAt && sunny > 0.5) {
      const e = this.rainbowAt;
      M.add(this.reg.rainbow, e.x + 6, e.y - 2, e.z + 6, 512 / 46, { bright: (sunny - 0.5) * 2, emissive: 1 });
    }
    if (night > 0.3) {
      for (const f of this.flies) {
        if (Math.abs(f.x - player.pos.x) > 300 || Math.abs(f.z - player.pos.z) > 300) continue;
        const blink = Math.max(0, Math.sin(t * 2.2 + f.ph * 3));
        G.add(this.reg.spark, f.x + Math.sin(t * 0.5 + f.ph) * 2, f.y + Math.sin(t * 0.8 + f.ph) * 0.6, f.z + Math.cos(t * 0.4 + f.ph) * 2, 24 / 0.45, { emissive: blink * night * 1.4 });
      }
    }
    // Petals: respawn around the player when blossom trees are near.
    for (const p of this.petals) {
      p.y += p.vy * dt; p.x += p.vx * dt + Math.sin(t * 2 + p.ph) * dt * 0.4;
      if (p.y < this.world.groundHeight(p.x, p.z) || Math.abs(p.x - player.pos.x) > 18) {
        if (Math.random() < 0.5) {
          p.x = player.pos.x + (Math.random() - 0.5) * 30; p.z = player.pos.z + (Math.random() - 0.7) * 16;
          p.y = this.world.groundHeight(p.x, p.z) + 4 + Math.random() * 6; p.vy = -0.6 - Math.random() * 0.4; p.vx = 0.4 + Math.random() * 0.4;
        } else p.y = -999;
      }
      if (p.y > -900 && this.blossomNear) M.add(this.reg.petal, p.x, p.y, p.z, 12 / 0.22, { flip: Math.sin(t * 3 + p.ph) > 0 ? 1 : -1, emissive: 0.3 });
    }
    M.commit(); G.commit();
  }
}
