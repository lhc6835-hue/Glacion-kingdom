import { Atlas } from '../gfx/Atlas.js';
import { SpriteLayer } from '../gfx/Sprites.js';
import { canvas, rgb, blob, rng } from '../art/paint.js';
import { LAKE, GORGE_BRIDGE } from './Layout.js';
import { F_WATER } from './WorldData.js';
import { hash2 } from './noise.js';

// Small collectible things lying in the world for gathering quests. They shimmer so the
// eye catches them, and stay collected across saves.

function paintItem(kind) {
  const c = canvas(48, 48), ctx = c.getContext('2d');
  const halo = ctx.createRadialGradient(24, 30, 2, 24, 30, 22);
  if (kind === 'moonmoss') {
    halo.addColorStop(0, 'rgba(170,255,230,0.55)'); halo.addColorStop(1, 'rgba(170,255,230,0)');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, 48, 48);
    const r = rng(3);
    for (let i = 0; i < 18; i++) blob(ctx, 24 + r.range(-11, 11), 36 + r.range(-6, 5), r.range(2, 4), r.range(1.5, 3), rgb([0.45 + r() * 0.3, 0.85, 0.72]));
    for (let i = 0; i < 6; i++) blob(ctx, 24 + r.range(-9, 9), 33 + r.range(-6, 3), 1.2, 1.2, 'rgb(240,255,250)');
  } else if (kind === 'letter') {
    halo.addColorStop(0, 'rgba(255,240,190,0.5)'); halo.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, 48, 48);
    ctx.save(); ctx.translate(24, 34); ctx.rotate(-0.2);
    ctx.fillStyle = rgb([0.96, 0.92, 0.80]); ctx.fillRect(-11, -7, 22, 14);
    ctx.strokeStyle = 'rgba(90,70,50,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-11, -7); ctx.lineTo(0, 1); ctx.lineTo(11, -7); ctx.stroke();
    blob(ctx, 0, 1, 3, 3, rgb([0.75, 0.15, 0.15]));
    ctx.restore();
  } else {
    halo.addColorStop(0, 'rgba(200,220,255,0.6)'); halo.addColorStop(1, 'rgba(200,220,255,0)');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, 48, 48);
    const g = ctx.createLinearGradient(14, 24, 34, 44);
    g.addColorStop(0, 'rgb(255,190,220)'); g.addColorStop(0.5, 'rgb(190,230,255)'); g.addColorStop(1, 'rgb(220,255,200)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(24, 22); ctx.lineTo(33, 34); ctx.lineTo(26, 42); ctx.lineTo(15, 37); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.moveTo(24, 24); ctx.lineTo(27, 30); ctx.lineTo(22, 30); ctx.fill();
  }
  return c;
}

export class Pickups {
  constructor(scene, renderer, world, state) {
    this.world = world;
    this.state = state;
    const atlas = new Atlas(256, 2);
    const reg = { moonmoss: atlas.add(paintItem('moonmoss')), letter: atlas.add(paintItem('letter')), shard: atlas.add(paintItem('shard')) };
    const [tex] = atlas.textures(renderer);
    this.layer = new SpriteLayer(tex, 64, { cutout: false, renderOrder: 7 });
    scene.add(this.layer.mesh);
    this.items = [];
    const add = (kind, x, z, y) => {
      const uid = `${kind}@${Math.round(x)},${Math.round(z)}`;
      const yy = y ?? world.groundHeight(x, z);
      const i = this.layer.add(reg[kind], x, yy, z, 48 / 0.9, { emissive: 0.7 });
      this.items.push({ uid, kind, x, z, y: yy, i });
    };
    // Moon-moss along the lake shore.
    let found = 0;
    for (let k = 0; k < 400 && found < 9; k++) {
      const a = hash2(k, 1, 91) * Math.PI * 2;
      const x = LAKE.x + Math.cos(a) * LAKE.rx * 1.02, z = LAKE.z + Math.sin(a) * LAKE.rz * 1.02;
      if (world.flagAt(x, z) & F_WATER) continue;
      const h = world.groundHeight(x, z);
      if (h < 0.2 || h > 3) continue;
      if (this.items.some((it) => Math.hypot(it.x - x, it.z - z) < 40)) continue;
      add('moonmoss', x, z); found++;
    }
    add('letter', -96, GORGE_BRIDGE.z + 1.5, GORGE_BRIDGE.deck);
    for (const [x, z] of [[-224, -118], [-246, -168], [-262, -132], [-214, -184]]) add('shard', x, z);
    for (const it of this.items) if (state.collected[it.uid]) this.layer.hide(it.i);
    this.layer.commit();
  }

  nearest(x, z, y, r = 1.8) {
    for (const it of this.items) {
      if (this.state.collected[it.uid]) continue;
      if (Math.hypot(it.x - x, it.z - z) < r && Math.abs(it.y - y) < 3) return it;
    }
    return null;
  }

  collect(it) {
    this.state.collected[it.uid] = true;
    this.layer.hide(it.i);
    this.layer.commit();
  }
}
