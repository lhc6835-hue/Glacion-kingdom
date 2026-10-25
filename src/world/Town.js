import * as A from '../art/architecture.js';
import { rng } from '../art/paint.js';
import { CITY_WALL, CITY_H, CASTLE, GORGE_BRIDGE } from './Layout.js';
import { F_WATER, F_ROAD, cityR } from './WorldData.js';
import { FACILITIES } from '../data/facilities.js';

// The Royal City and its surroundings, assembled from painted pieces:
// curtain wall and gates, rows of south-facing houses along east-west streets, the plaza,
// the facilities, Castle Valcrest on its rock, the Gorge Bridge and the Greyspire ruins.

// Streets run east-west; each entry is the street line, houses stand on its north side.
const ROW_Z = [44, 26, 8, -10, -28, -46, -62, -128, -146, -164, -182, -200, -216];
const PLAZA = { x: 300, z: -94, rx: 52, rz: 28 };

export class Town {
  constructor(world, collision) {
    this.world = world;
    this.collision = collision;
    this.items = [];        // { paint result, x, z, y?, opts }
    this.interactables = [];
    this.walkables = [];
    this.npcSpots = [];     // where townsfolk like to be
    this.streets = ROW_Z.map((z) => ({ z: z + 1 }));
    this.plaza = PLAZA;
  }

  // Paint every piece and record where it goes. Call before the atlas is uploaded.
  paint(atlas, natureLib) {
    this.atlas = atlas;
    this.lib = natureLib;
    this.glowReg = atlas.add(A.paintGlow());
    this.buildWalls();
    this.buildCastle();
    this.buildPlaza();
    this.buildFacilitiesAndHouses();
    this.buildBridgeAndRuins();
  }

  put(res, x, z, o = {}) {
    const reg = this.atlas.add(res.img);
    const y = o.y ?? this.world.groundHeight(x, z);
    this.items.push({ reg, res, x, y, z, o });
    return { reg, x, y, z };
  }

  // Lay everything into the sprite layers once textures exist.
  place(sprites, glow, shadows) {
    for (const it of this.items) {
      const { reg, res, x, y, z, o } = it;
      const scale = o.scale ?? 1;
      sprites.add(reg, x, y - 0.05, z, res.ppm, { flip: o.flip ?? 1, scale, wscale: o.wscale ?? 1, bright: o.bright ?? 1, sway: o.sway ?? 0 });
      if (o.shadow !== false && res.footprint) shadows.add(x + 0.6, y, z - res.footprint.d * 0.45, res.footprint.w * 1.1, res.footprint.d * 1.1, 0.25);
      // Night windows: some homes stay dark.
      const lit = o.lit ?? 0.75;
      res.windows?.forEach(([wx, wy, ww, wh], k) => {
        if (((k * 7919 + Math.floor(x * 13)) % 100) / 100 > lit) return;
        const sx = x + ((wx + ww / 2) - res.img.width / 2) / res.ppm * scale * (o.flip ?? 1);
        const sy = y + (res.img.height - (wy + wh / 2)) / res.ppm * scale;
        const size = Math.max(ww, wh) / res.ppm * scale * 2.4;
        glow.add(this.glowReg, sx, sy - size * 0.5, z + 0.08, 64 / size, { emissive: 0.6 + ((k * 31) % 40) / 100 });
      });
    }
  }

  // --- curtain wall -----------------------------------------------------------------

  buildWalls() {
    const W = CITY_WALL;
    const r = rng(5);
    const wallTex = [0, 1, 2].map((k) => A.paintWall(300 + k, { ppm: 14, length: 4.2, height: 10 }));
    const gates = [
      { a: Math.PI / 2, kind: 'front', name: '남문' },
      { a: Math.PI - 0.17, kind: 'side', name: '절벽문' },
      { a: -0.35, kind: 'side', name: '동문' },
    ];
    const perim = Math.PI * (3 * (W.rx + W.rz) - Math.sqrt((3 * W.rx + W.rz) * (W.rx + 3 * W.rz)));
    const steps = Math.round(perim / 3.4);
    let sinceTower = 0;
    for (let s = 0; s < steps; s++) {
      const a = (s / steps) * Math.PI * 2;
      const x = W.x + Math.cos(a) * W.rx, z = W.z + Math.sin(a) * W.rz;
      const nearGate = gates.some((g) => angDist(a, g.a) * ((W.rx + W.rz) / 2) < (g.kind === 'front' ? 11 : 6));
      const h = this.world.groundHeight(x, z);
      if (h > CITY_H + 6 || h < CITY_H - 4) continue; // the castle rock and the cliffs defend themselves
      sinceTower += 3.4;
      if (nearGate) continue;
      const tx = -Math.sin(a) * W.rx, tz = Math.cos(a) * W.rz;
      const tl = Math.hypot(tx, tz);
      const ax = Math.abs(tx / tl);
      // Wall tiles: full width when the wall runs east-west, stacked narrow tiles when it recedes.
      const res = wallTex[s % 3];
      this.put(res, x, z, { wscale: Math.max(0.35, ax * 0.95 + 0.1), shadow: false, bright: 0.92 + ax * 0.1 });
      this.collision.circle(x, z, 1.9, { kind: 'wall' });
      if (sinceTower > 64) {
        sinceTower = 0;
        const t = A.paintTower(320 + s, { ppm: 14, radius: 3.6, height: 15, windows: 1, roof: r.pick([A.ROOFS.red, A.ROOFS.scarlet, A.ROOFS.rust]), spire: r.chance(0.6), banner: [0.22, 0.32, 0.62] });
        this.put(t, x, z + 0.8);
        this.collision.circle(x, z, 3.8, { kind: 'tower' });
      }
    }
    for (const g of gates) {
      const x = W.x + Math.cos(g.a) * W.rx, z = W.z + Math.sin(g.a) * W.rz;
      if (g.kind === 'front') {
        const gh = A.paintGatehouse(400, { ppm: 14, width: 22, height: 14 });
        this.put(gh, x, z + 0.5, { shadow: false });
        this.collision.box(x - 11, z - 2.5, x - 3.2, z + 2.5, { kind: 'gate' });
        this.collision.box(x + 3.2, z - 2.5, x + 11, z + 2.5, { kind: 'gate' });
        this.npcSpots.push({ x: x - 4.5, z: z + 4, role: 'guard', name: '남문 경비병' }, { x: x + 4.5, z: z + 4, role: 'guard', name: '남문 경비병' });
      } else {
        // Gates in north-south running walls: a tower either side of the passage.
        const tx = -Math.sin(g.a) * W.rx, tz = Math.cos(g.a) * W.rz, tl = Math.hypot(tx, tz);
        for (const sgn of [-1, 1]) {
          const px = x + (tx / tl) * 6 * sgn, pz = z + (tz / tl) * 6 * sgn;
          const t = A.paintTower(410 + Math.round(g.a * 10) + sgn, { ppm: 14, radius: 3.4, height: 16, windows: 1, banner: [0.22, 0.32, 0.62] });
          this.put(t, px, pz + 0.5);
          this.collision.circle(px, pz, 3.6, { kind: 'tower' });
        }
        this.npcSpots.push({ x: x + 4, z: z + 1, role: 'guard', name: `${g.name} 경비병` });
      }
    }
  }

  // --- castle -------------------------------------------------------------------------

  buildCastle() {
    const R = A.ROOFS;
    const top = 84;
    // The castle is drawn larger than life, as in a storybook: it has to command the skyline
    // from the far side of the lake.
    const CS = 1.7;
    const T = (seed, x, z, o) => {
      const t = A.paintTower(seed, { ppm: 14, ...o });
      const s = o.y === undefined ? CS : 1.3;
      this.put(t, x, z, { y: o.y ?? top, scale: s });
      this.collision.circle(x, z - o.radius * 0.3 * s, o.radius * 0.9 * s, { kind: 'castle' });
    };
    const H = (seed, x, z, o) => {
      const h = A.paintHall(seed, { ppm: 14, ...o });
      this.put(h, x, z, { y: o.y ?? top, lit: 0.85, scale: CS });
      const hw = (o.width * CS) / 2;
      this.collision.box(x - hw, z - (o.depth || 14), x + hw, z, { kind: 'castle' }, (o.y ?? top) - 2, (o.y ?? top) + 60);
    };
    // Back to front so the silhouette builds up: tall slender spires behind, halls in front.
    T(501, 398, -352, { radius: 4.6, height: 54, roof: R.red, windows: 6, banner: [0.22, 0.32, 0.62] });
    T(502, 452, -340, { radius: 2.4, height: 46, roof: R.scarlet, windows: 5 });
    T(503, 345, -338, { radius: 3.0, height: 40, roof: R.red, windows: 4, banner: [0.85, 0.75, 0.3] });
    T(504, 425, -356, { radius: 2.0, height: 50, roof: R.rust, windows: 5 });
    H(505, 404, -318, { width: 26, height: 26, roof: R.red, roofH: 14, depth: 20 });
    T(506, 372, -312, { radius: 3.4, height: 36, roof: R.scarlet, windows: 4 });
    T(507, 440, -308, { radius: 3.0, height: 34, roof: R.red, windows: 4 });
    T(508, 300, -300, { radius: 5.2, height: 26, roof: R.rust, windows: 3 });
    T(509, 474, -292, { radius: 4.0, height: 28, roof: R.red, windows: 3 });
    H(510, 340, -282, { width: 30, height: 17, roof: R.rust, roofH: 9, depth: 16 });
    T(511, 286, -270, { radius: 3.4, height: 22, roof: R.scarlet, windows: 2 });
    H(512, 446, -272, { width: 20, height: 14, roof: R.scarlet, roofH: 8, depth: 12 });
    // Front curtain on the rock rim with the castle gate.
    const gh = A.paintGatehouse(513, { ppm: 14, width: 18, height: 12, archW: 5, archH: 6.5 });
    this.put(gh, CASTLE.x, -240, { y: top, shadow: false, scale: 1.4 });
    this.collision.box(CASTLE.x - 12.6, -243, CASTLE.x - 3.9, -238, { kind: 'castle' }, top - 2, top + 20);
    this.collision.box(CASTLE.x + 3.9, -243, CASTLE.x + 12.6, -238, { kind: 'castle' }, top - 2, top + 20);
    const wall = A.paintWall(514, { ppm: 14, length: 12, height: 8, stone: A.STONE.pale });
    for (const x of [312, 328, 344, 360, 404, 420, 436, 452, 468]) {
      const z = rimZ(this.world, x, -300, top) + 3;
      this.put(wall, x, z, { y: top, shadow: false, scale: 1.35 });
      this.collision.box(x - 8, z - 1.2, x + 8, z + 1.2, { kind: 'castle' }, top - 2, top + 12);
    }
    T(515, 300, rimZ(this.world, 300, -300, top) + 4, { radius: 3.6, height: 20, roof: R.red, windows: 2, banner: [0.22, 0.32, 0.62] });
    T(516, 468, rimZ(this.world, 468, -300, top) + 4, { radius: 3.6, height: 22, roof: R.scarlet, windows: 2, banner: [0.22, 0.32, 0.62] });
    // Towers at the foot of the rock, so the castle cascades down into the city.
    T(517, 296, -214, { radius: 4.2, height: 24, roof: R.red, windows: 3, y: CITY_H });
    T(518, 500, -222, { radius: 3.6, height: 30, roof: R.scarlet, windows: 3, y: CITY_H });
    this.interactables.push({ x: CASTLE.x, z: -243, r: 3, y: top, kind: 'castle-gate', label: '왕성 정문', text: '근위 까마귀가 길을 막는다. 「알현은 길드의 추천장을 가진 자만 가능하다.」' });
    this.npcSpots.push({ x: CASTLE.x - 4, z: -244, y: top, role: 'guard', name: '근위대' }, { x: CASTLE.x + 4, z: -244, y: top, role: 'guard', name: '근위대' });
  }

  // --- plaza --------------------------------------------------------------------------

  buildPlaza() {
    const P = PLAZA;
    const f = A.paintFountain(600, { ppm: 16 });
    this.put(f, P.x, P.z, { shadow: false });
    this.collision.circle(P.x, P.z - 1, 5.4, { kind: 'fountain' });
    this.interactables.push({ x: P.x, z: P.z + 3, r: 4, kind: 'fountain', label: '왕관 광장 분수', text: '물줄기 사이로 날아오르는 새 석상. 받침돌에 「바람은 돌아온다」라고 새겨져 있다.' });
    const qb = A.paintQuestBoard(601, { ppm: 24 });
    this.put(qb, P.x + 26, P.z - 14);
    this.collision.box(P.x + 23.6, P.z - 15, P.x + 28.4, P.z - 14, { kind: 'board' });
    this.interactables.push({ x: P.x + 26, z: P.z - 12.5, r: 3, kind: 'questboard', label: '의뢰 게시판' });
    const goods = ['fruit', 'bread', 'flowers', 'fish', 'cloth', 'fruit'];
    const colors = [[0.82, 0.30, 0.25], [0.30, 0.50, 0.72], [0.40, 0.62, 0.36], [0.88, 0.68, 0.28], [0.60, 0.38, 0.62], [0.82, 0.30, 0.25]];
    for (let k = 0; k < 6; k++) {
      const a = Math.PI * (0.12 + k * 0.155) + Math.PI;
      const x = P.x + Math.cos(a) * (P.rx - 4), z = P.z - Math.sin(a) * (P.rz - 3) * -1;
      const st = A.paintStall(610 + k, { ppm: 20, color: colors[k], goods: goods[k] });
      this.put(st, x, z + 2);
      this.collision.box(x - 2.2, z, x + 2.2, z + 2, { kind: 'stall' });
      this.npcSpots.push({ x, z: z + 3.2, role: 'merchant', name: `${['과일', '빵', '꽃', '생선', '옷감', '열매'][k]} 노점상` });
    }
    // Flower beds and blossom trees ringing the square.
    this.plazaPlants = [];
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2 + 0.11;
      if (Math.abs(Math.sin(a)) > 0.92 && Math.cos(a) > -0.2 && Math.sin(a) > 0) continue; // keep the south entry open
      const x = P.x + Math.cos(a) * (P.rx - 9), z = P.z + Math.sin(a) * (P.rz - 7);
      this.plazaPlants.push({ x, z, kind: k % 3 === 0 ? 'blossom' : 'flowerbush' });
    }
    for (const [dx, dz] of [[-16, 6], [16, 6], [-24, -2], [24, -2], [-10, 12], [10, 12]]) this.plazaPlants.push({ x: P.x + dx, z: P.z + dz, kind: 'flowerbush' });
    const lamp = A.paintLamp(620);
    const bench = A.paintBench(621);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.2;
      const x = P.x + Math.cos(a) * (P.rx + 2), z = P.z + Math.sin(a) * (P.rz + 2);
      this.put(lamp, x, z, { lit: 1 });
      this.collision.circle(x, z, 0.3, { kind: 'lamp' });
      if (k % 2) {
        this.put(bench, x + 2.5, z + 0.5);
        this.interactables.push({ x: x + 2.5, z: z + 1.5, r: 1.6, kind: 'bench', label: '벤치에 앉기' });
      }
    }
  }

  // --- streets of houses --------------------------------------------------------------

  buildFacilitiesAndHouses() {
    const world = this.world;
    const r = rng(77);
    const reserved = [];
    const ok = (x0, x1, zFront, depth) => {
      for (const [px, pz] of [[x0, zFront], [x1, zFront], [x0, zFront - depth], [x1, zFront - depth], [(x0 + x1) / 2, zFront - depth / 2]]) {
        if (cityR(px, pz) > 0.9) return false;
        const f = world.flagAt(px, pz);
        if (f & (F_WATER | F_ROAD)) return false;
        const h = world.groundHeight(px, pz);
        if (Math.abs(h - CITY_H) > 1.2) return false;
        if (((px - PLAZA.x) / (PLAZA.rx + 6)) ** 2 + ((pz - PLAZA.z) / (PLAZA.rz + 6)) ** 2 < 1) return false;
      }
      // Canal banks and the main avenue stay open.
      for (let t = 0; t <= 1; t += 0.25) {
        const px = x0 + (x1 - x0) * t;
        if (world.flagAt(px, zFront + 2) & F_WATER) return false;
      }
      if (x1 > 293 && x0 < 307) return false;
      for (const q of reserved) if (x0 < q.x1 + 1 && x1 > q.x0 - 1 && zFront - depth < q.z1 && zFront > q.z0) return false;
      return true;
    };
    const district = (x, z) => (z < -110 ? 'noble' : x < 200 ? 'artisan' : x > 410 ? 'east' : 'market');

    // Facilities first, at chosen spots.
    const spots = {
      guild: [PLAZA.x + 2, -127], inn: [246, -61], smithy: [176, 9], potion: [262, 45], magic: [372, -27], junk: [430, 9],
      food: [250, -9], store: [345, 45], library: [246, -145], temple: [420, -181], bank: [214, -27], auction: [372, -127],
      stable: [420, 45], barracks: [236, 45], tailor: [348, -9], bakery: [400, -9],
    };
    for (const fac of FACILITIES) {
      const sp = spots[fac.id];
      if (!sp) continue;
      let [x, zf] = sp;
      let res, width, depth;
      if (fac.kind === 'hall') {
        width = fac.id === 'guild' ? 26 : 22; depth = 14;
        res = A.paintHall(700 + fac.id.length * 13, { ppm: 14, width, height: fac.id === 'guild' ? 14 : 12, roofH: 8, roof: fac.id === 'temple' ? A.ROOFS.teal : A.ROOFS.red, stone: A.STONE.pale });
        res.footprint = { w: width, d: depth };
      } else {
        width = fac.id === 'inn' ? 14 : 10; depth = 9;
        res = A.paintHouse(700 + fac.id.length * 17 + fac.icon.length, {
          ppm: 16, width, floors: fac.id === 'inn' ? 3 : 2, style: fac.kind === 'stone' ? 'stone' : r.pick(['timber', 'plaster', 'timber']),
          roof: r.pick([A.ROOFS.red, A.ROOFS.orange, A.ROOFS.rust, A.ROOFS.scarlet]), sign: fac.icon,
          awning: ['food', 'store', 'bakery', 'potion'].includes(fac.id) ? r.pick([[0.75, 0.25, 0.25], [0.25, 0.45, 0.65], [0.3, 0.55, 0.35]]) : null, depth,
        });
      }
      const zFront = zf - 3;
      this.put(res, x, zFront, { lit: 0.95 });
      reserved.push({ x0: x - width / 2, x1: x + width / 2, z0: zFront - depth, z1: zFront });
      this.collision.box(x - width / 2, zFront - depth, x + width / 2, zFront - 0.3, { kind: 'building', id: fac.id });
      this.interactables.push({ x, z: zFront + 1.2, r: 2.4, kind: 'facility', id: fac.id, label: fac.name });
      this.npcSpots.push({ x: x + 2.5, z: zFront + 2.2, role: 'keeper', facility: fac.id, name: fac.keeper.name, look: fac.keeper.look });
      if (fac.id === 'temple') {
        const t = A.paintTower(790, { ppm: 14, radius: 3.2, height: 30, roof: A.ROOFS.teal, windows: 3 });
        this.put(t, x + width / 2 + 2, zFront - 4);
      }
    }
    // Training yard by the east wall.
    const dummy = A.paintDummy(800);
    for (let k = 0; k < 4; k++) {
      const x = 470 + k * 4.5, z = -64 + (k % 2) * 3;
      this.put(dummy, x, z);
      this.collision.circle(x, z, 0.5, { kind: 'dummy' });
    }
    this.interactables.push({ x: 476, z: -58, r: 6, kind: 'training', label: '훈련장' });

    // Ordinary houses fill the rest of every street.
    let seed = 1000;
    for (const z of ROW_Z) {
      const zFront = z - 3 + Math.sin(z) * 0.6;
      let x = CITY_WALL.x - CITY_WALL.rx;
      while (x < CITY_WALL.x + CITY_WALL.rx) {
        const d = district(x, zFront);
        const width = d === 'noble' ? r.range(10, 15) : r.range(7, 11.5);
        const depth = d === 'noble' ? 10 : r.range(7, 9);
        if (ok(x, x + width, zFront, depth)) {
          const style = d === 'noble' ? 'stone' : d === 'artisan' ? r.pick(['stone', 'timber']) : r.pick(['timber', 'timber', 'plaster']);
          const roof = d === 'noble' ? r.pick([A.ROOFS.slate, A.ROOFS.teal, A.ROOFS.red, A.ROOFS.plum])
            : d === 'artisan' ? r.pick([A.ROOFS.rust, A.ROOFS.orange, A.ROOFS.red]) : r.pick([A.ROOFS.red, A.ROOFS.scarlet, A.ROOFS.orange, A.ROOFS.rust]);
          const floors = d === 'noble' ? r.int(2, 3) : r.int(1, 3);
          const res = A.paintHouse(seed++, { ppm: 16, width, floors, style, roof, depth });
          const cx = x + width / 2;
          this.put(res, cx, zFront);
          this.collision.box(x, zFront - depth, x + width, zFront - 0.3, { kind: 'house' });
          reserved.push({ x0: x, x1: x + width, z0: zFront - depth, z1: zFront });
          if (r.chance(0.35)) this.npcSpots.push({ x: cx + r.range(-3, 3), z: zFront + 2.5, role: 'resident' });
          x += width + r.range(0.4, 2.2);
        } else x += 3;
      }
      this.streets.push({ z: zFront + 3 });
    }
    // Garden trees and flower beds in small gaps.
    this.gardens = [];
    for (let k = 0; k < 140; k++) {
      const x = CITY_WALL.x + (r() - 0.5) * CITY_WALL.rx * 1.8, z = CITY_WALL.z + (r() - 0.5) * CITY_WALL.rz * 1.8;
      if (!ok(x - 1.5, x + 1.5, z, 2)) continue;
      this.gardens.push({ x, z, kind: r.chance(0.4) ? r.pick(['blossom', 'spring', 'column']) : r.pick(['flowerbush', 'bush']) });
      reserved.push({ x0: x - 2, x1: x + 2, z0: z - 2, z1: z });
    }
  }

  // --- bridge and ruins ---------------------------------------------------------------

  buildBridgeAndRuins() {
    const B = GORGE_BRIDGE;
    const span = 14;
    const floor = 14;
    const drop = B.deck - floor + 1;
    const res = A.paintBridgeSpan(900, { ppm: 14, span, drop, deckH: 2.2 });
    for (let x = B.x0 + span / 2; x < B.x1; x += span) {
      this.put(res, x, B.z + B.width / 2, { y: B.deck - drop - 2.2, shadow: false });
    }
    this.walkables.push({ x0: B.x0 - 8, x1: B.x1 + 8, z0: B.z - B.width / 2, z1: B.z + B.width / 2, y: B.deck });
    this.collision.box(B.x0, B.z - B.width / 2 - 0.6, B.x1, B.z - B.width / 2, { kind: 'rail' }, B.deck - 1, B.deck + 3);
    this.collision.box(B.x0, B.z + B.width / 2, B.x1, B.z + B.width / 2 + 0.6, { kind: 'rail' }, B.deck - 1, B.deck + 3);
    const lamp = A.paintLamp(901);
    for (let x = B.x0 + 7; x < B.x1; x += 28) this.put(lamp, x, B.z + B.width / 2 - 0.3, { y: B.deck, lit: 1, shadow: false });

    // Greyspire Hold: the last bastion of old Ostmere, now roofless and overgrown.
    const ruinStone = [0.66, 0.64, 0.62];
    const ruin = (seed, x, z, radius, height) => {
      const t = A.paintTower(seed, { ppm: 14, radius, height, stone: ruinStone, ruined: true });
      this.put(t, x, z);
      this.collision.circle(x, z, radius * 0.9, { kind: 'ruin' });
    };
    ruin(950, -206, -100, 4.5, 16);
    ruin(951, -206, -128, 4.0, 22);
    ruin(952, -236, -160, 6.0, 30);
    ruin(953, -270, -120, 3.4, 12);
    ruin(954, -250, -196, 3.0, 18);
    const wall = A.paintWall(955, { ppm: 14, length: 10, height: 6, stone: ruinStone });
    for (const [x, z] of [[-222, -140], [-252, -176], [-262, -140]]) { this.put(wall, x, z); this.collision.box(x - 5, z - 1, x + 5, z + 1, { kind: 'ruin' }); }
    this.interactables.push({ x: -236, z: -152, r: 5, kind: 'lore', label: '무너진 비석', text: '이끼 아래 글씨가 희미하다. 「오스트미어의 마지막 날개가 여기 접히다. 노래가 끊기지 않기를.」' });
  }
}

function angDist(a, b) {
  let d = Math.abs(a - b) % (Math.PI * 2);
  return d > Math.PI ? Math.PI * 2 - d : d;
}

// The southernmost z (toward the camera) of a mesa top at column x.
function rimZ(world, x, zStart, top) {
  let z = zStart;
  while (z < zStart + 200 && world.groundHeight(x, z + 1) > top - 1) z += 1;
  return z - 2;
}
