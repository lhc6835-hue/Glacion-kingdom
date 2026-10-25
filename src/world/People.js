import { Atlas } from '../gfx/Atlas.js';
import { SpriteLayer, ShadowLayer } from '../gfx/Sprites.js';
import { paintCharacter, LOOKS, randomLook, PPM_CHAR } from '../art/characters.js';
import { rng } from '../art/paint.js';
import { NAMES, LINES } from '../data/townsfolk.js';
import { FACILITIES } from '../data/facilities.js';

// Character sprites for the player and the townsfolk, plus simple daily routines:
// guards hold their posts, keepers stay by their doors during opening hours,
// residents stroll the streets by day and go home at night.

export class People {
  constructor(scene, renderer, world, collision, town) {
    this.world = world;
    this.collision = collision;
    this.town = town;
    const atlas = new Atlas(2048, 2);
    this.looks = {};
    const addLook = (key, desc) => {
      const frames = paintCharacter(desc);
      this.looks[key] = frames.map((row) => row.map((img) => atlas.add(img)));
    };
    for (const [k, d] of Object.entries(LOOKS)) addLook(k, d);
    const r = rng(404);
    for (let i = 0; i < 18; i++) addLook('town' + i, randomLook(r));
    const [tex] = atlas.textures(renderer);
    this.layer = new SpriteLayer(tex, 400, { dynamic: true, renderOrder: 6 });
    this.shadows = new ShadowLayer(400);
    scene.add(this.shadows.mesh, this.layer.mesh);

    this.npcs = [];
    this.spawnTownsfolk(r);
  }

  spawnTownsfolk(r) {
    const used = new Set();
    const pickLines = (pool, n) => {
      const out = [];
      for (let k = 0; k < 40 && out.length < n; k++) {
        const i = Math.floor(r() * pool.length);
        if (used.has(pool[i]) && k < 30) continue;
        used.add(pool[i]); out.push(pool[i]);
      }
      return out;
    };
    let nameI = 0;
    for (const s of this.town.npcSpots) {
      const role = s.role;
      const look = s.look || (role === 'guard' ? 'guard' : role === 'merchant' ? 'merchant' : 'town' + Math.floor(r() * 18));
      const fac = s.facility ? FACILITIES.find((f) => f.id === s.facility) : null;
      const npc = {
        name: s.name || NAMES[nameI++ % NAMES.length], look, role, facility: fac,
        home: { x: s.x, z: s.z, y: s.y }, x: s.x, z: s.z, y: s.y ?? this.world.groundHeight(s.x, s.z),
        facing: 0, frame: 0, anim: r() * 4, target: null, wait: r() * 4, speed: 1.6 + r() * 0.8,
        lines: fac ? fac.lines : role === 'guard' ? LINES.guard : role === 'merchant' ? LINES.merchant : pickLines(LINES.any, 2),
        talkIndex: 0, visible: true,
      };
      this.npcs.push(npc);
    }
    // Strollers on the streets and the plaza.
    for (let k = 0; k < 46; k++) {
      const st = r.pick(this.town.streets);
      const x = 120 + r() * 360;
      if (this.world.groundHeight(x, st.z) < 50) continue;
      this.npcs.push({
        name: NAMES[nameI++ % NAMES.length], look: 'town' + Math.floor(r() * 18), role: 'stroller',
        home: { x, z: st.z }, x, z: st.z, y: this.world.groundHeight(x, st.z), street: st.z,
        facing: 0, frame: 0, anim: r() * 4, target: null, wait: r() * 3, speed: 1.4 + r() * 1.0,
        lines: pickLines(LINES.any, 2), talkIndex: 0, visible: true,
      });
    }
    // Standing NPCs live in the static collision grid; walkers are pushed against the player directly.
    for (const n of this.npcs) {
      n.walker = n.role === 'stroller' || n.role === 'resident';
      n.solid = n.walker ? { x: n.x, z: n.z, r: 0.45, disabled: false } : this.collision.circle(n.x, n.z, 0.45, { kind: 'npc', npc: n });
    }
  }

  isAwake(n, hour) {
    if (n.role === 'guard') return true;
    if (n.facility) {
      const [o, c] = n.facility.hours;
      return o < c ? hour >= o && hour < c : hour >= o || hour < c;
    }
    if (n.role === 'merchant') return hour >= 7 && hour < 19;
    return hour >= 6.5 && hour < 21.5 + (n.name.length % 3) * 0.3;
  }

  update(dt, hour, player) {
    for (const n of this.npcs) {
      n.visible = this.isAwake(n, hour);
      n.solid.disabled = !n.visible;
      if (!n.visible) continue;
      const dp = Math.hypot(player.pos.x - n.x, player.pos.z - n.z);
      if (n.talking || (dp < 2.2 && n.role !== 'stroller')) {
        // Turn to face the player when they come close.
        n.frame = 0;
        n.facing = Math.abs(player.pos.x - n.x) > Math.abs(player.pos.z - n.z) ? (player.pos.x < n.x ? 2 : 3) : (player.pos.z < n.z ? 1 : 0);
        continue;
      }
      if (n.role === 'stroller' || n.role === 'resident') this.wander(n, dt);
      else { n.frame = 0; n.anim += dt; if (n.role === 'guard') n.facing = 0; }
    }
  }

  wander(n, dt) {
    if (!n.target) {
      n.wait -= dt;
      n.frame = 0;
      if (n.wait > 0) return;
      const range = n.role === 'stroller' ? 40 : 6;
      const tx = n.home.x + (Math.random() - 0.5) * range * 2;
      const tz = n.role === 'stroller' ? n.street + (Math.random() - 0.5) * 3 : n.home.z + (Math.random() - 0.5) * 4;
      if (Math.abs(this.world.groundHeight(tx, tz) - n.y) > 0.8) { n.wait = 1; return; }
      n.target = { x: tx, z: tz };
    }
    const dx = n.target.x - n.x, dz = n.target.z - n.z, d = Math.hypot(dx, dz);
    if (d < 0.3) { n.target = null; n.wait = 1 + Math.random() * 5; return; }
    const sx = (dx / d) * n.speed * dt, sz = (dz / d) * n.speed * dt;
    const moved = this.collision.resolve(n.x + sx, n.z + sz, 0.4, n.y, {});
    if (Math.hypot(moved.x - n.x, moved.z - n.z) < Math.hypot(sx, sz) * 0.3) { n.target = null; n.wait = 0.5 + Math.random(); return; }
    n.x = moved.x; n.z = moved.z;
    n.y = this.world.groundHeight(n.x, n.z);
    n.solid.x = n.x; n.solid.z = n.z;
    n.facing = Math.abs(dx) > Math.abs(dz) ? (dx < 0 ? 2 : 3) : (dz < 0 ? 1 : 0);
    n.anim += dt * n.speed * 1.8;
    n.frame = 1 + (Math.floor(n.anim) % 4);
  }

  // Keep the player from walking through strolling townsfolk.
  pushOut(pos) {
    for (const n of this.npcs) {
      if (!n.walker || !n.visible) continue;
      const dx = pos.x - n.x, dz = pos.z - n.z, d = Math.hypot(dx, dz);
      if (d < 0.85 && d > 1e-4) { pos.x = n.x + (dx / d) * 0.85; pos.z = n.z + (dz / d) * 0.85; }
    }
  }

  nearestNPC(x, z, r = 2.6) {
    let best = null, bd = r;
    for (const n of this.npcs) {
      if (!n.visible) continue;
      const d = Math.hypot(n.x - x, n.z - z);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  draw(player) {
    const L = this.layer, S = this.shadows;
    L.count = 0; S.count = 0;
    const put = (lookKey, facing, frame, x, y, z, scale = 1) => {
      const rows = this.looks[lookKey];
      const row = facing === 3 ? rows[2] : rows[facing];
      L.add(row[frame], x, y, z, PPM_CHAR, { flip: facing === 3 ? -1 : 1, scale });
    };
    put('hero', player.facing, player.frame, player.pos.x, player.pos.y - 0.02, player.pos.z);
    const g = player.groundAt(player.pos.x, player.pos.z, player.pos.y + 0.3);
    const lift = Math.max(0, player.pos.y - g);
    S.add(player.pos.x + 0.1, player.swimming ? player.pos.y + 0.4 : g, player.pos.z + 0.1, 1.1 / (1 + lift * 0.08), 0.55 / (1 + lift * 0.08), 0.4 / (1 + lift * 0.15));
    for (const n of this.npcs) {
      if (!n.visible) continue;
      put(n.look, n.facing, n.frame, n.x, n.y - 0.02, n.z);
      S.add(n.x + 0.1, n.y, n.z + 0.1, 1.1, 0.55, 0.35);
    }
    L.commit(); S.commit();
  }
}
