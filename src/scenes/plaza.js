// 광장: the side-view hub. Far behind lie ice-cream mountains and the castle of Glacion; on the
// square itself stand the mold gallery, both gacha machines, today's board, the fountain, the
// face shop and the play zone. Other players walk around here too (see net/plazaNet.js).
import { SideActor, SideWorld, SideCam, drawPrompt, SIDE_SCALE } from './side.js';
import { TAU, rng, rgba, shade, mix, clamp, rand, pick } from '../core/math.js';
import { sfx, music } from '../core/audio.js';
import { sideHud, gachaMachine, faceShop } from '../ui/menus.js';
import { board, fountainWish, playZone, chatBar } from '../ui/plazaMenus.js';
import { ShopScene } from './shop.js';
import { FLAVORS } from '../../shared/flavors.js';
import { MOLDS } from '../../shared/molds.js';
import { FACES } from '../../shared/faces.js';
import { makeSprite, atop, drawSprite } from '../render/sprite.js';

const X1 = 3900;
const SPOTS = [
  { id: 'gallery', x: 260, label: '틀 갤러리 들어가기' },
  { id: 'gflavor', x: 760, label: '맛 뽑기' },
  { id: 'gweapon', x: 1060, label: '무기 뽑기' },
  { id: 'board', x: 1500, label: '오늘의 게시판 보기' },
  { id: 'fountain', x: 2050, label: '분수대에 동전 던지기' },
  { id: 'faces', x: 2650, label: '표정 가게' },
  { id: 'bench', x: 3080, label: '벤치에 앉기' },
  { id: 'play', x: 3520, label: '플레이 존 입장' },
];
const NPC_NAMES = ['딸기콘', '말랑젤라또', '꽁꽁이', '바닐라짱', '민초단장', '슈가슈가', '쫀득이'];
const NPC_LINES = ['오늘 맛 투표 했어?', '플레이 존 같이 갈 사람~', '틀 갤러리 5층 가봤어? 반짝반짝해!', '분수대에 소원 빌었어!', '터키 아이스크림 콘 갖고 싶다…', '보스 태양 너무 뜨거워 ㅠㅠ', '방금 갤럭시 맛 뽑았어!!'];

export class PlazaScene {
  constructor(app, { x } = {}) {
    this.app = app;
    this.layout = 'side';
    this.t = 0;
    this.cam = new SideCam();
    this.world = new SideWorld(0, X1, [
      { x0: 1940, x1: 2160, y: -62 }, // fountain rim
      { x0: 3010, x1: 3150, y: -46 }, // bench
    ]);
    this.startX = x ?? 2050 - 260 + rand(-160, 160);
    this.others = new Map();
    this.npcs = [];
    this.splash = [];
  }

  enter() {
    const app = this.app;
    const p = app.profile.data;
    this.me = new SideActor({ ...p.loadout }, { name: p.name, local: true, level: p.level, x: this.startX });
    this.cam.x = this.me.x; this.cam.y = -60;
    sideHud(app, '<button class="icon-btn" data-chat title="채팅">💬</button>');
    app.ui.get('hud').querySelector('[data-chat]').onclick = () => chatBar(app, (txt) => this.say(txt));
    this.onKey = (e) => {
      if ((e.code === 'KeyT' || e.code === 'Enter') && !app.ui.has('modal') && !app.ui.has('chat') && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        chatBar(app, (txt) => this.say(txt));
      }
    };
    addEventListener('keydown', this.onKey);
    music('menu');
    if (app.net && app.net.online) app.net.joinPlaza(this);
    else this.spawnNpcs();
  }
  exit() {
    removeEventListener('keydown', this.onKey);
    if (this.app.net) this.app.net.leavePlaza();
  }

  onLoadout() {
    const lo = this.app.profile.data.loadout;
    this.me.rig.setLook({ ...lo });
    this.me.rig.happy();
    if (this.app.net) this.app.net.sendLook(lo);
  }

  say(txt) {
    this.me.say(txt);
    if (this.app.net && this.app.net.online) this.app.net.sendChat(txt);
  }

  spawnNpcs() {
    const r = rng(Date.now() & 0xffff);
    for (let i = 0; i < 6; i++) {
      const m = pick(MOLDS.slice(0, 18));
      const fl = [];
      for (let k = 0; k < m.layers; k++) { let f; do f = pick(FLAVORS).id; while (fl.includes(f)); fl.push(f); }
      const a = new SideActor({ mold: m.id, flavors: fl, weapon: 'spoon', face: pick(FACES.slice(0, 12)).id }, { name: NPC_NAMES[i], x: 300 + r() * (X1 - 600), level: 1 + Math.floor(r() * 30) });
      a.ai = { t: rand(1, 4), dir: 0, talk: rand(6, 16) };
      this.npcs.push(a);
    }
  }

  // network callbacks
  addOther(id, info) {
    const a = new SideActor(info.look, { name: info.name, x: info.x ?? 1800, level: info.level });
    a.tx = a.x; a.ty = 0;
    this.others.set(id, a);
  }
  removeOther(id) { this.others.delete(id); }

  update(dt) {
    this.t += dt;
    const app = this.app, input = app.input;
    const modal = app.ui.has('modal') || app.ui.has('chat');
    input.enabled = !modal;
    const mv = input.moveVec();
    if (this.sitting && (Math.abs(mv.x) > 0.2 || input.pressed('jump'))) this.sitting = false;
    if (!this.sitting) this.me.physics(dt, this.world, mv.x, input.pressed('jump') || input.pressed('jumpUp'), input.isDown('jump') || input.isDown('up'));
    this.me.update(dt);
    this.cam.update(dt, this.me.x, -60, this.world);

    for (const a of this.npcs) this.updateNpc(a, dt);
    for (const a of this.others.values()) {
      // smooth remote motion toward the last reported position
      const dx = a.tx - a.x;
      a.vx = clamp(dx * 8, -340, 340);
      a.x += a.vx * dt;
      a.y += (a.ty - a.y) * Math.min(1, dt * 12);
      a.onGround = a.ty >= -1;
      if (Math.abs(dx) > 2) a.facing = Math.sign(dx);
      a.update(dt);
    }
    if (app.net && app.net.online) app.net.tickPlaza(dt, this.me);

    this.near = null;
    let bd = 100;
    for (const s of SPOTS) { const d = Math.abs(s.x - this.me.x); if (d < bd) { bd = d; this.near = s; } }
    if (this.near && !modal && (input.pressed('interact') || input.pressed('tap'))) this.use(this.near);
    // fountain droplets
    for (const d of this.splash) { d.t += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 900 * dt; }
    this.splash = this.splash.filter((d) => d.y < -40 && d.t < 3);
    if (Math.random() < dt * 30) this.splash.push({ x: 2050 + rand(-8, 8), y: -230, vx: rand(-150, 150), vy: rand(-180, -60), t: 0 });
    input.enabled = true;
  }

  updateNpc(a, dt) {
    const ai = a.ai;
    ai.t -= dt; ai.talk -= dt;
    if (ai.t <= 0) { ai.t = rand(1.5, 5); ai.dir = Math.random() < 0.35 ? 0 : Math.random() < 0.5 ? -0.5 : 0.5; ai.jump = Math.random() < 0.15; }
    if (ai.talk <= 0) { ai.talk = rand(10, 24); a.say(pick(NPC_LINES)); }
    a.physics(dt, this.world, ai.dir, ai.jump, ai.jump);
    ai.jump = false;
    if (a.x < 120 || a.x > X1 - 120) ai.dir = -Math.sign(a.x - X1 / 2) * 0.5;
    a.update(dt);
  }

  use(s) {
    const app = this.app;
    sfx.open();
    switch (s.id) {
      case 'gallery': app.go(new ShopScene(app)); break;
      case 'gflavor': gachaMachine(app, 'flavor'); break;
      case 'gweapon': gachaMachine(app, 'weapon'); break;
      case 'board': board(app); break;
      case 'fountain': fountainWish(app, (fortune) => { this.me.say(fortune); for (let i = 0; i < 20; i++) this.splash.push({ x: 2050 + rand(-60, 60), y: -80, vx: rand(-200, 200), vy: rand(-500, -200), t: 0 }); }); break;
      case 'faces': faceShop(app); break;
      case 'bench': this.me.x = 3080; this.me.y = -46; this.me.vy = 0; this.sitting = true; this.me.rig.happy(3); this.me.say('후~ 시원하다'); break;
      case 'play': playZone(app); break;
    }
  }

  // ── drawing ───────────────────────────────────────────────
  draw(g) {
    const W = innerWidth, H = innerHeight;
    const tod = timeOfDay();
    this.drawSky(g, W, H, tod);
    g.save();
    this.cam.apply(g);
    const v = this.cam.view();
    this.drawParallax(g, v, tod);
    this.drawGround(g, v);
    this.drawFacilities(g, tod);
    const actors = [...this.npcs, ...this.others.values(), this.me];
    for (const a of actors) if (a.x > v.x0 - 100 && a.x < v.x1 + 100) a.draw(g, SIDE_SCALE);
    this.drawFountainFront(g);
    if (this.near && !this.app.ui.has('modal')) drawPrompt(g, this.near.x, this.near.id === 'gallery' ? -430 : -300, this.near.label, this.t, this.app.input.isTouch);
    this.drawForeground(g, v);
    g.restore();
    if (tod.night > 0) { g.fillStyle = `rgba(40,30,90,${0.22 * tod.night})`; g.fillRect(0, 0, W, H); }
  }

  drawSky(g, W, H, tod) {
    const gr = g.createLinearGradient(0, 0, 0, H * 0.8);
    gr.addColorStop(0, mix(mix('#6fc6ff', '#ff9ec8', tod.dusk), '#2a2f78', tod.night));
    gr.addColorStop(0.55, mix(mix('#b8e4ff', '#ffc9c0', tod.dusk), '#5a4aa0', tod.night));
    gr.addColorStop(1, mix(mix('#fff4fa', '#ffe8d6', tod.dusk), '#9a7ac8', tod.night));
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    if (tod.night > 0.1) {
      const r = rng(5);
      for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(255,255,255,${tod.night * (0.3 + r() * 0.7) * (0.6 + 0.4 * Math.sin(this.t * 2 + i))})`; g.beginPath(); g.arc(r() * W, r() * H * 0.55, r() * 1.6 + 0.3, 0, TAU); g.fill(); }
    }
    // sun with slowly turning rays
    const sx = W * 0.78 - this.cam.x * 0.02, sy = H * (0.18 + tod.dusk * 0.12);
    if (tod.night < 0.5) {
      g.save(); g.translate(sx, sy); g.rotate(this.t * 0.04);
      g.fillStyle = 'rgba(255,250,215,0.18)';
      for (let i = 0; i < 12; i++) { g.rotate(TAU / 12); g.beginPath(); g.moveTo(0, 0); g.lineTo(-40, -Math.max(W, H)); g.lineTo(40, -Math.max(W, H)); g.closePath(); g.fill(); }
      g.restore();
    }
    const glow = g.createRadialGradient(sx, sy, 10, sx, sy, 200);
    glow.addColorStop(0, tod.night > 0.5 ? 'rgba(255,250,230,0.6)' : 'rgba(255,248,210,0.9)'); glow.addColorStop(1, 'rgba(255,245,200,0)');
    g.fillStyle = glow; g.fillRect(sx - 200, sy - 200, 400, 400);
    g.fillStyle = tod.night > 0.5 ? '#fff8e6' : '#fffbe0';
    g.beginPath(); g.arc(sx, sy, 46, 0, TAU); g.fill();
    if (tod.night > 0.5) { g.fillStyle = mix('#6fc6ff', '#2a2f78', tod.night); g.beginPath(); g.arc(sx + 18, sy - 10, 42, 0, TAU); g.fill(); }
    // layered clouds drifting at their own speeds
    for (let i = 0; i < 8; i++) {
      const c = cloudSprite(i % 5);
      const sp = 5 + (i % 4) * 3;
      const cx = (((i * 470 + this.t * sp - this.cam.x * (0.02 + (i % 3) * 0.015)) % (W + c.width + 200)) + W + c.width + 200) % (W + c.width + 200) - c.width - 100;
      const cy = 30 + ((i * 83) % Math.max(60, H * 0.38));
      const s = 0.7 + (i % 3) * 0.2;
      g.globalAlpha = 0.95 - tod.night * 0.5;
      g.drawImage(c, cx, cy, c.width * s, c.height * s);
    }
    g.globalAlpha = 1;
  }

  drawParallax(g, v, tod) {
    const layers = parallaxLayers();
    for (const L of layers) {
      // a layer at depth p moves p times as fast as the world; draw it so it tiles horizontally
      const camX = this.cam.x;
      const off = camX * (1 - L.p);
      const startX = v.x0 - ((v.x0 - off) % L.w + L.w) % L.w - L.w;
      for (let x = startX; x < v.x1 + L.w; x += L.w) {
        g.drawImage(L.c, x, L.y, L.w, L.h);
      }
      if (L.castle) {
        const cx = 1700 + off;
        drawSprite(g, castleSprite(), cx + 200, L.y + L.h - 40);
        if (tod.night > 0.3) {
          g.fillStyle = `rgba(255,230,150,${tod.night * 0.8})`;
          for (const [wx, wy] of [[-60, -150], [-20, -210], [30, -160], [80, -120], [130, -190]]) { g.beginPath(); g.arc(cx + 200 + wx, L.y + L.h - 40 + wy, 3, 0, TAU); g.fill(); }
        }
      }
    }
  }

  drawGround(g, v) {
    const tile = groundTile();
    for (let x = Math.floor(v.x0 / tile.w) * tile.w; x < v.x1; x += tile.w) g.drawImage(tile.c, x, -16, tile.w, tile.h);
    // bunting strung between lamp posts across the square
    const r = ['#ff9cbc', '#ffe066', '#8fd3ff', '#b69cff', '#7ee0b0'];
    for (let x0 = 400; x0 < X1 - 300; x0 += 600) {
      const x1 = x0 + 600;
      g.strokeStyle = 'rgba(150,110,130,0.6)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x0, -470); g.quadraticCurveTo((x0 + x1) / 2, -400, x1, -470); g.stroke();
      for (let i = 1; i < 12; i++) {
        const t = i / 12, x = x0 + (x1 - x0) * t;
        const yy = (1 - t) * (1 - t) * -470 + 2 * (1 - t) * t * -400 + t * t * -470;
        const sw = Math.sin(this.t * 2 + i) * 0.15;
        g.save(); g.translate(x, yy); g.rotate(sw);
        g.fillStyle = r[i % 5]; g.beginPath(); g.moveTo(-9, 0); g.lineTo(9, 0); g.lineTo(0, 20); g.fill();
        g.restore();
      }
      lamp(g, x0, this.t);
    }
    lamp(g, X1 - 300, this.t);
  }

  drawFacilities(g) {
    const t = this.t;
    // 틀 갤러리 building
    drawSprite(g, gallerySprite(), 260, 0);
    // gacha machines
    drawGachaMachine(g, 760, '#ff8fb4', '#ffd6e4', '맛 뽑기', t);
    drawGachaMachine(g, 1060, '#7fbfff', '#d6ecff', '무기 뽑기', t + 1);
    // board
    drawSprite(g, boardSprite(), 1500, 0);
    // fountain (back part)
    this.drawFountain(g);
    // face shop
    drawSprite(g, faceShopSprite(), 2650, 0);
    // bench
    drawSprite(g, benchSprite(), 3080, 0);
    // play zone portal
    this.drawPortal(g, 3520);
  }

  drawFountain(g) {
    const x = 2050;
    drawSprite(g, fountainSprite(), x, 0);
    // water arcs
    g.strokeStyle = 'rgba(190,235,255,0.9)'; g.lineWidth = 6; g.lineCap = 'round';
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(x, -228);
      g.quadraticCurveTo(x + s * 70, -300 - Math.sin(this.t * 3) * 6, x + s * 110, -130); g.stroke();
    }
    g.fillStyle = 'rgba(210,240,255,0.9)';
    for (const d of this.splash) { g.beginPath(); g.arc(d.x, d.y, 3.2, 0, TAU); g.fill(); }
    // top jet
    g.fillStyle = 'rgba(220,245,255,0.95)';
    g.beginPath(); g.ellipse(x, -238 - Math.sin(this.t * 6) * 4, 7, 14, 0, 0, TAU); g.fill();
  }
  drawFountainFront(g) {
    const x = 2050;
    g.fillStyle = 'rgba(160,220,255,0.55)';
    g.beginPath(); g.ellipse(x, -70, 108, 14, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2;
    for (let i = 0; i < 3; i++) { const k = (this.t * 0.6 + i / 3) % 1; g.globalAlpha = 1 - k; g.beginPath(); g.ellipse(x + (i - 1) * 40, -70, 10 + k * 30, 3 + k * 5, 0, 0, TAU); g.stroke(); }
    g.globalAlpha = 1;
  }

  drawPortal(g, x) {
    drawSprite(g, portalSprite(), x, 0);
    const cy = -170;
    g.save();
    g.beginPath(); g.ellipse(x, cy, 78, 112, 0, 0, TAU); g.clip();
    const gr = g.createRadialGradient(x, cy, 4, x, cy, 120);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.3, '#ffd6f0'); gr.addColorStop(0.7, '#b8a6ff'); gr.addColorStop(1, '#7fd8ff');
    g.fillStyle = gr; g.fillRect(x - 90, cy - 120, 180, 240);
    g.strokeStyle = 'rgba(255,255,255,0.65)'; g.lineWidth = 5;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      for (let k = 0; k < 40; k++) { const a = k * 0.22 + this.t * 2 + i * 1.26, r = k * 2.6; g.lineTo(x + Math.cos(a) * r, cy + Math.sin(a) * r * 1.4); }
      g.stroke();
    }
    g.restore();
    for (let i = 0; i < 6; i++) {
      const a = this.t * 1.5 + i * 1.05;
      g.fillStyle = ['#fff1a6', '#ffd6f0', '#c9f4ff'][i % 3];
      g.beginPath(); g.arc(x + Math.cos(a) * 100, cy + Math.sin(a) * 130, 4, 0, TAU); g.fill();
    }
  }

  drawForeground(g, v) {
    // rounded hedges with flowers along the front of the square, plus drifting petals
    const r = rng(77);
    for (let i = 0; i < 46; i++) {
      const x = r() * X1, y = 70 + r() * 26, R = 26 + r() * 18;
      const pal = TREE_COLS[[4, 4, 0, 4, 2][i % 5]];
      if (x < v.x0 - 80 || x > v.x1 + 80) continue;
      const blobs = [[0, 0, 1], [-0.8, 0.25, 0.75], [0.8, 0.25, 0.7], [-0.35, -0.35, 0.7], [0.4, -0.3, 0.65]];
      g.fillStyle = pal[2];
      for (const [bx, by, br] of blobs) { g.beginPath(); g.arc(x + bx * R + 4, y + by * R + 6, br * R * 0.7, 0, TAU); g.fill(); }
      g.fillStyle = pal[1];
      for (const [bx, by, br] of blobs) { g.beginPath(); g.arc(x + bx * R, y + by * R, br * R * 0.66, 0, TAU); g.fill(); }
      g.fillStyle = pal[0];
      for (const [bx, by, br] of blobs) { g.beginPath(); g.arc(x + bx * R - br * R * 0.2, y + by * R - br * R * 0.22, br * R * 0.34, 0, TAU); g.fill(); }
      for (let k = 0; k < 4; k++) {
        const fx = x + (r() - 0.5) * R * 1.6, fy = y - R * 0.3 + (r() - 0.5) * R * 0.6;
        g.fillStyle = ['#ff7aa2', '#ffffff', '#ffd35a', '#b69cff'][(i + k) % 4];
        for (let p = 0; p < 5; p++) { const a = (p / 5) * TAU; g.beginPath(); g.arc(fx + Math.cos(a) * 3, fy + Math.sin(a) * 3, 2.6, 0, TAU); g.fill(); }
        g.fillStyle = '#fff3a0'; g.beginPath(); g.arc(fx, fy, 1.8, 0, TAU); g.fill();
      }
    }
    for (let i = 0; i < 18; i++) {
      const ph = this.t * (0.05 + (i % 5) * 0.01) + i * 0.37;
      const x = v.x0 + ((ph * 1700 + i * 211) % (v.x1 - v.x0 + 200)) - 100;
      const y = v.y0 + ((i * 97) % (v.y1 - v.y0)) + Math.sin(this.t * 1.5 + i) * 24;
      g.save(); g.translate(x, y); g.rotate(this.t * 2 + i);
      g.fillStyle = ['rgba(255,170,200,0.75)', 'rgba(255,255,255,0.8)', 'rgba(255,230,150,0.75)'][i % 3];
      g.beginPath(); g.ellipse(0, 0, 5, 2.6, 0, 0, TAU); g.fill();
      g.restore();
    }
  }
}

function timeOfDay() {
  const d = new Date();
  const h = d.getHours() + d.getMinutes() / 60;
  const night = h < 5 ? 1 : h < 7 ? 1 - (h - 5) / 2 : h < 18 ? 0 : h < 20 ? (h - 18) / 2 : 1;
  const dusk = h > 16 && h < 20 ? 1 - Math.abs(h - 18) / 2 : h > 5 && h < 8 ? 0.5 - Math.abs(h - 6.5) / 3 : 0;
  return { night: clamp(night, 0, 1), dusk: clamp(dusk, 0, 1) };
}

// ── baked backdrop pieces ───────────────────────────────────────
let PL = null;
function parallaxLayers() {
  if (PL) return PL;
  PL = [
    { p: 0.12, w: 2600, h: 520, y: -760, c: bakeMountains(2600, 520, 3, ['#ffc9dc', '#c4f0e2', '#dcd0ff', '#ffe3bf'], 0.75, 0.7) },
    { p: 0.22, w: 2400, h: 420, y: -560, c: bakeMountains(2400, 420, 9, ['#ffaecb', '#9fe8cc', '#c6b2ff', '#ffd39e'], 1, 0.4), castle: true },
    { p: 0.45, w: 2200, h: 300, y: -330, c: bakeHills(2200, 300) },
    { p: 0.7, w: 1700, h: 221, y: -226, c: bakeTown(2000, 260) },
  ];
  return PL;
}

function bakeMountains(w, h, seed, cols, scale, haze) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const r = rng(seed);
  const n = Math.round(w / 330);
  const peaks = [];
  for (let i = -1; i <= n; i++) peaks.push({ x: (i / n) * w + r() * 90, pw: 250 + r() * 210, ph: h * (0.5 + r() * 0.42) * scale, col: cols[(i + 10) % cols.length], d: r() });
  peaks.sort((a, b) => a.ph - b.ph); // short ones behind tall ones
  for (const P of peaks) {
    for (const ox of [0, -w, w]) {
      const px = P.x + ox, pw = P.pw, ph = P.ph, col = P.col;
      const shape = () => {
        g.beginPath(); g.moveTo(px - pw, h);
        g.bezierCurveTo(px - pw * 0.5, h - ph * 0.45, px - pw * 0.3, h - ph, px, h - ph);
        g.bezierCurveTo(px + pw * 0.3, h - ph, px + pw * 0.5, h - ph * 0.45, px + pw, h);
        g.closePath();
      };
      g.save();
      shape();
      // body: lighter at the top, with a sunlit left face and a cool shadowed right face
      const vg = g.createLinearGradient(0, h - ph, 0, h);
      vg.addColorStop(0, shade(col, 0.25)); vg.addColorStop(1, col);
      g.fillStyle = vg; g.fill();
      g.clip();
      const hg = g.createLinearGradient(px - pw * 0.6, 0, px + pw * 0.6, 0);
      hg.addColorStop(0, 'rgba(255,255,255,0.3)'); hg.addColorStop(0.45, 'rgba(255,255,255,0.05)'); hg.addColorStop(0.55, rgba(shade(col, -0.25), 0.18)); hg.addColorStop(1, rgba(shade(col, -0.35), 0.35));
      g.fillStyle = hg; g.fillRect(px - pw, h - ph, pw * 2, ph);
      // soft ridge lines running down the slopes
      g.strokeStyle = rgba(shade(col, -0.2), 0.18); g.lineWidth = 6;
      for (let k = 0; k < 3; k++) { const sx = px + (k - 1) * pw * 0.18; g.beginPath(); g.moveTo(sx, h - ph * (0.85 - k * 0.05)); g.quadraticCurveTo(sx + (k - 1) * pw * 0.25, h - ph * 0.45, sx + (k - 1) * pw * 0.5, h); g.stroke(); }
      // whipped-cream snow cap with drips and a glossy edge
      const capY = h - ph + ph * (0.24 + P.d * 0.08);
      const cap = () => {
        g.beginPath();
        g.moveTo(px - pw, capY - ph);
        g.lineTo(px + pw, capY - ph);
        g.lineTo(px + pw, capY);
        for (let k = 0; k <= 9; k++) {
          const xx = px + pw - (2 * pw * k) / 9, dd = k % 2 ? 12 + ((k * 37 + seed) % 7) * 4 : 3;
          g.quadraticCurveTo(xx + pw / 9, capY + dd, xx, capY);
        }
        g.closePath();
      };
      cap(); g.fillStyle = '#ffffff'; g.fill();
      g.save(); cap(); g.clip();
      const cg = g.createLinearGradient(px - pw * 0.4, 0, px + pw * 0.4, 0);
      cg.addColorStop(0, 'rgba(255,255,255,0)'); cg.addColorStop(1, 'rgba(200,190,240,0.35)');
      g.fillStyle = cg; g.fillRect(px - pw, capY - ph, pw * 2, ph + 40);
      g.restore();
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(px - pw * 0.12, h - ph + 6); g.quadraticCurveTo(px - pw * 0.25, h - ph + ph * 0.08, px - pw * 0.32, capY - 6); g.stroke();
      g.restore();
    }
  }
  // atmospheric haze toward the bottom, tinted like the sky
  const hz = g.createLinearGradient(0, 0, 0, h);
  hz.addColorStop(0, 'rgba(230,245,255,0)'); hz.addColorStop(1, `rgba(240,246,255,${haze})`);
  g.fillStyle = hz; g.fillRect(0, 0, w, h);
  return c;
}

function puffTree(g, x, y, R, cols, rr) {
  g.fillStyle = '#f6ecf2'; g.beginPath(); g.roundRect(x - R * 0.12, y - R * 1.1, R * 0.24, R * 1.1, 2); g.fill();
  g.strokeStyle = '#ff9cbc'; g.lineWidth = R * 0.1;
  for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x - R * 0.12, y - R * (0.3 + k * 0.3)); g.lineTo(x + R * 0.12, y - R * (0.42 + k * 0.3)); g.stroke(); }
  const cy = y - R * 1.5;
  const blobs = [[0, 0, 1], [-0.6, 0.25, 0.7], [0.6, 0.25, 0.72], [-0.3, -0.45, 0.68], [0.32, -0.4, 0.62]];
  g.fillStyle = cols[2];
  for (const [bx, by, br] of blobs) { g.beginPath(); g.arc(x + bx * R + R * 0.12, cy + by * R + R * 0.15, br * R * 0.78, 0, TAU); g.fill(); }
  g.fillStyle = cols[1];
  for (const [bx, by, br] of blobs) { g.beginPath(); g.arc(x + bx * R, cy + by * R, br * R * 0.74, 0, TAU); g.fill(); }
  g.fillStyle = cols[0];
  for (const [bx, by, br] of blobs) { g.beginPath(); g.arc(x + bx * R - br * R * 0.22, cy + by * R - br * R * 0.25, br * R * 0.4, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(255,255,255,0.8)';
  g.beginPath(); g.arc(x - R * 0.35, cy - R * 0.4, R * 0.1, 0, TAU); g.fill();
  void rr;
}

const TREE_COLS = [['#ffd6e8', '#ffb0cf', '#ff92ba'], ['#dde9ff', '#b3cbff', '#94aef5'], ['#efe0ff', '#d2b6ff', '#b897f5'], ['#fff6c8', '#ffe28e', '#f3c65c'], ['#dcffe9', '#a8f0c8', '#7fdcab']];

function bakeHills(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const r = rng(21);
  const layers = [['#c6f2d4', '#a9e8c4', 0.42, 56, 3], ['#b2ecc6', '#93e0b4', 0.58, 44, 5]];
  layers.forEach(([top, bottom, base, amp, freq], li) => {
    const yAt = (x) => h * base + Math.sin((x / w) * TAU * freq) * amp * 0.6 + Math.sin((x / w) * TAU * (freq * 2 + 1)) * amp * 0.25;
    const gr = g.createLinearGradient(0, h * base - amp, 0, h);
    gr.addColorStop(0, top); gr.addColorStop(1, bottom);
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 16) g.lineTo(x, yAt(x));
    g.lineTo(w, h); g.fill();
    // sunlit rim along the hill tops
    g.strokeStyle = 'rgba(255,255,240,0.55)'; g.lineWidth = 3;
    g.beginPath(); for (let x = 0; x <= w; x += 16) g.lineTo(x, yAt(x) + 2); g.stroke();
    // stripes of flower fields
    for (let k = 0; k < 6; k++) {
      const fx = r() * w, fw = 120 + r() * 160;
      g.fillStyle = ['rgba(255,190,215,0.45)', 'rgba(255,240,170,0.45)', 'rgba(210,190,255,0.45)'][k % 3];
      g.beginPath(); g.ellipse(fx, yAt(fx) + 24 + li * 10, fw, 8, 0, 0, TAU); g.fill();
    }
    // little groves and cottages
    for (let i = 0; i < 16; i++) {
      const x = r() * w, y = yAt(x) + 8 + r() * 20;
      if (r() < 0.25) {
        const wall = ['#fff4f8', '#fffbe8', '#f2f7ff'][(r() * 3) | 0], roof = ['#ff9cbc', '#8fc8ff', '#ffb36b', '#b69cff'][(r() * 4) | 0];
        g.fillStyle = wall; g.fillRect(x - 12, y - 18, 24, 18);
        g.fillStyle = roof; g.beginPath(); g.moveTo(x - 16, y - 17); g.lineTo(x, y - 32); g.lineTo(x + 16, y - 17); g.fill();
        g.fillStyle = 'rgba(150,200,240,0.9)'; g.fillRect(x - 6, y - 12, 5, 6);
      } else puffTree(g, x, y, 10 + r() * 7, TREE_COLS[(r() * 5) | 0], r);
    }
  });
  return c;
}

function bakeTown(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const r = rng(44);
  let x = 0;
  const WALLS = ['#fff0f5', '#fff6e0', '#eef7ff', '#f4eeff', '#ecfff5'];
  const ROOFS = ['#ff9cbc', '#ffb36b', '#8fc8ff', '#b69cff', '#7ee0b0'];
  while (x < w - 60) {
    const bw = 120 + r() * 90, bh = 130 + r() * 100;
    const wall = WALLS[(r() * 5) | 0], roof = ROOFS[(r() * 5) | 0];
    const y = h - bh;
    // wall with soft vertical shading
    const wg = g.createLinearGradient(x, 0, x + bw, 0);
    wg.addColorStop(0, shade(wall, 0.4)); wg.addColorStop(0.7, wall); wg.addColorStop(1, shade(wall, -0.08));
    g.fillStyle = wg; g.fillRect(x, y, bw, bh);
    g.fillStyle = shade(wall, -0.1); g.fillRect(x, h - 18, bw, 18);
    // roof: a scalloped-tile gable or a dome with a cream trim
    if (r() < 0.55) {
      g.fillStyle = roof; g.beginPath(); g.moveTo(x - 10, y + 4); g.lineTo(x + bw / 2, y - 56); g.lineTo(x + bw + 10, y + 4); g.closePath(); g.fill();
      g.save(); g.clip();
      g.fillStyle = shade(roof, -0.12);
      for (let ry = y - 56; ry < y + 6; ry += 10) for (let rx = x - 10 + ((ry / 10) % 2) * 8; rx < x + bw + 10; rx += 16) { g.beginPath(); g.arc(rx, ry + 9, 7, 0, Math.PI); g.fill(); }
      const rg = g.createLinearGradient(x, 0, x + bw, 0); rg.addColorStop(0, 'rgba(255,255,255,0.3)'); rg.addColorStop(1, 'rgba(0,0,0,0.08)');
      g.fillStyle = rg; g.fillRect(x - 10, y - 60, bw + 20, 66);
      g.restore();
      if (r() < 0.6) { g.fillStyle = shade(wall, -0.2); g.fillRect(x + bw * 0.7, y - 46, 12, 26); g.fillStyle = roof; g.fillRect(x + bw * 0.7 - 2, y - 50, 16, 6); }
    } else {
      g.fillStyle = roof; g.beginPath(); g.arc(x + bw / 2, y + 4, bw / 2 + 6, Math.PI, 0); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(x + bw * 0.32, y - bw * 0.22, bw * 0.12, bw * 0.06, -0.5, 0, TAU); g.fill();
      g.fillStyle = '#ffffff'; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(x + bw / 2 - bw * 0.5 + k * bw * 0.2, y + 4, 9, 0, Math.PI); g.fill(); }
      g.fillStyle = ['#ff7aa2', '#ffd35a'][(r() * 2) | 0]; g.beginPath(); g.arc(x + bw / 2, y - bw / 2 - 4, 7, 0, TAU); g.fill();
    }
    // windows: frames, sills, shutters and flower boxes
    for (let wy = y + 26; wy < h - 64; wy += 50) for (let wx = x + 16; wx < x + bw - 34; wx += 40) {
      g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(wx - 3, wy - 3, 28, 34, [14, 14, 3, 3]); g.fill();
      const glass = g.createLinearGradient(0, wy, 0, wy + 28); glass.addColorStop(0, '#cfeaff'); glass.addColorStop(1, '#9fcff0');
      g.fillStyle = glass; g.beginPath(); g.roundRect(wx, wy, 22, 28, [11, 11, 2, 2]); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(wx + 4, wy + 6, 3, 14);
      g.fillStyle = '#ffffff'; g.fillRect(wx + 10, wy, 2, 28);
      g.fillStyle = shade(roof, 0.1); g.beginPath(); g.roundRect(wx - 4, wy + 28, 30, 7, 3); g.fill();
      for (let f = 0; f < 4; f++) { g.fillStyle = ['#ff7aa2', '#ffd35a', '#ffffff', '#b69cff'][(f + wx) % 4]; g.beginPath(); g.arc(wx + f * 7, wy + 27, 3, 0, TAU); g.fill(); }
    }
    // door with a little striped awning
    const dx = x + bw / 2 - 16;
    g.fillStyle = shade(roof, -0.15); g.beginPath(); g.roundRect(dx, h - 50, 32, 50, [16, 16, 0, 0]); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.roundRect(dx + 4, h - 46, 24, 20, [12, 12, 0, 0]); g.fill();
    for (let k = 0; k < 4; k++) { g.fillStyle = k % 2 ? '#ffffff' : roof; g.beginPath(); g.moveTo(dx - 8 + k * 12, h - 60); g.lineTo(dx + 4 + k * 12, h - 60); g.lineTo(dx + 4 + k * 12, h - 52); g.arc(dx - 2 + k * 12, h - 52, 6, 0, Math.PI); g.fill(); }
    x += bw + 10 + r() * 26;
  }
  const hz = g.createLinearGradient(0, 0, 0, h);
  hz.addColorStop(0, 'rgba(235,245,255,0.3)'); hz.addColorStop(1, 'rgba(255,246,250,0.4)');
  g.fillStyle = hz; g.fillRect(0, 0, w, h);
  return c;
}

let GT = null;
function groundTile() {
  if (GT) return GT;
  const w = 480, h = 150;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#f6dfe9'); gr.addColorStop(1, '#ecc9d8');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const r = rng(3);
  // cobblestones: each stone shaded, lit on top, with a soft shadow below
  for (let row = 0; row < 6; row++) {
    const y = 18 + row * 22, off = (row % 2) * 30;
    for (let x = -60 + off; x < w; x += 60) {
      const sw = 52 + r() * 4, sh = 17;
      const base = ['#fff6fa', '#ffeaf2', '#fde4ee', '#fff0e8'][(r() * 4) | 0];
      g.fillStyle = 'rgba(190,130,160,0.35)'; g.beginPath(); g.roundRect(x + 4, y + 5, sw, sh, 7); g.fill();
      const sg = g.createLinearGradient(0, y + 3, 0, y + 3 + sh);
      sg.addColorStop(0, '#ffffff'); sg.addColorStop(0.35, base); sg.addColorStop(1, shade(base, -0.06));
      g.fillStyle = sg; g.beginPath(); g.roundRect(x + 3, y + 3, sw, sh, 7); g.fill();
    }
  }
  // fade the stones into shadow toward the bottom of the screen
  const sh = g.createLinearGradient(0, 40, 0, h);
  sh.addColorStop(0, 'rgba(240,200,220,0)'); sh.addColorStop(1, 'rgba(230,180,205,0.45)');
  g.fillStyle = sh; g.fillRect(0, 0, w, h);
  // cream curb at the back edge
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, 14);
  g.fillStyle = 'rgba(230,190,210,0.6)'; g.fillRect(0, 14, w, 3);
  g.fillStyle = '#ffffff';
  for (let x = 0; x < w; x += 30) { g.beginPath(); g.arc(x + 15, 14, 15, 0, Math.PI); g.fill(); }
  GT = { c, w, h };
  return GT;
}

function lamp(g, x, t) {
  // candy-stripe post with a round glowing globe
  const post = g.createLinearGradient(x - 6, 0, x + 6, 0);
  post.addColorStop(0, '#ffffff'); post.addColorStop(1, '#eadbe4');
  g.fillStyle = post; g.beginPath(); g.roundRect(x - 6, -470, 12, 470, 5); g.fill();
  g.save(); g.beginPath(); g.roundRect(x - 6, -470, 12, 470, 5); g.clip();
  g.strokeStyle = '#ff9cbc'; g.lineWidth = 4;
  for (let y = -480; y < 10; y += 18) { g.beginPath(); g.moveTo(x - 8, y + 8); g.lineTo(x + 8, y); g.stroke(); }
  g.restore();
  g.fillStyle = '#ff9cbc'; g.beginPath(); g.roundRect(x - 13, -32, 26, 32, 7); g.fill();
  g.fillStyle = '#ffd35a'; g.beginPath(); g.roundRect(x - 10, -478, 20, 8, 3); g.fill();
  const gl = g.createRadialGradient(x, -494, 4, x, -494, 70 + Math.sin(t * 2) * 5);
  gl.addColorStop(0, 'rgba(255,245,190,0.6)'); gl.addColorStop(1, 'rgba(255,245,190,0)');
  g.fillStyle = gl; g.fillRect(x - 80, -574, 160, 160);
  const bg = g.createRadialGradient(x - 5, -500, 2, x, -494, 18);
  bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, '#fff0a0');
  g.fillStyle = bg; g.beginPath(); g.arc(x, -494, 17, 0, TAU); g.fill();
  g.fillStyle = '#ff9cbc'; g.beginPath(); g.ellipse(x, -511, 12, 5, 0, Math.PI, 0); g.fill();
}

// Cloud sprites with soft three-tone shading, baked once per variant.
const CLOUDS = [];
function cloudSprite(i) {
  if (CLOUDS[i]) return CLOUDS[i];
  const r = rng(i * 17 + 3);
  const w = 260 + r() * 140, h = 120;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const blobs = [];
  for (let k = 0; k < 7; k++) blobs.push([w * (0.18 + k * 0.11) + r() * 10, h * 0.62 - Math.sin((k / 6) * Math.PI) * h * 0.25 + r() * 6, 26 + Math.sin((k / 6) * Math.PI) * 22 + r() * 8]);
  g.fillStyle = '#e9e2ff';
  for (const [x, y, rr] of blobs) { g.beginPath(); g.arc(x, y + 6, rr, 0, TAU); g.fill(); }
  g.fillStyle = '#ffffff';
  for (const [x, y, rr] of blobs) { g.beginPath(); g.arc(x - 3, y - 2, rr * 0.92, 0, TAU); g.fill(); }
  g.globalCompositeOperation = 'source-atop';
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.75, 'rgba(255,215,235,0.35)'); gr.addColorStop(1, 'rgba(210,200,255,0.6)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  CLOUDS[i] = c;
  return c;
}

function drawGachaMachine(g, x, c, light, label, t) {
  g.save();
  g.translate(x, 0);
  g.fillStyle = 'rgba(80,40,60,0.18)'; g.beginPath(); g.ellipse(0, 4, 90, 14, 0, 0, TAU); g.fill();
  // base
  g.fillStyle = c; g.strokeStyle = rgba(shade(c, -0.5), 0.7); g.lineWidth = 3;
  g.beginPath(); g.roundRect(-70, -150, 140, 150, [22, 22, 10, 10]); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(-60, -140, 16, 130);
  g.fillStyle = rgba(shade(c, -0.5), 0.6); g.beginPath(); g.roundRect(-26, -70, 52, 40, 10); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(40, -110, 16, 0, TAU); g.fill(); g.stroke();
  g.save(); g.translate(40, -110); g.rotate(t * 0.8); g.fillStyle = c; g.fillRect(-12, -3, 24, 6); g.restore();
  // globe
  g.fillStyle = 'rgba(230,246,255,0.75)';
  g.beginPath(); g.arc(0, -238, 92, 0, TAU); g.fill();
  const cols = ['#ff8fb4', '#ffe066', '#8fd3ff', '#b69cff', '#7ee0b0', '#ffb36b'];
  const r = rng(x);
  for (let i = 0; i < 16; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * 70, cx = Math.cos(a) * d, cy = -222 + Math.abs(Math.sin(a)) * d * 0.7 + Math.sin(t * 2 + i) * 2;
    g.fillStyle = cols[i % 6]; g.beginPath(); g.arc(cx, cy, 16, Math.PI, 0); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx, cy, 16, 0, Math.PI); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.1)'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, 16, 0, TAU); g.stroke();
  }
  g.strokeStyle = '#ffffff'; g.lineWidth = 8; g.beginPath(); g.arc(0, -238, 92, 0, TAU); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(-40, -280, 22, 12, -0.6, 0, TAU); g.fill();
  // cap + sign
  g.fillStyle = c; g.beginPath(); g.ellipse(0, -332, 40, 16, 0, 0, TAU); g.fill();
  g.fillStyle = light; g.beginPath(); g.roundRect(-58, -392, 116, 40, 20); g.fill();
  g.strokeStyle = c; g.lineWidth = 3; g.stroke();
  g.fillStyle = '#4a2c3a'; g.font = '22px Jua'; g.textAlign = 'center'; g.fillText(label, 0, -364);
  g.restore();
}

// Facility sprites, baked once.
const S = {};
function once(key, fn) { return S[key] || (S[key] = fn()); }
const OUT = { outline: 1.4, outlineColor: 'rgba(120,70,100,0.55)' };

function gallerySprite() {
  return once('gallery', () => makeSprite(360, 560, 180, 540, (g) => {
    // pastel tower with a waffle-cone spire
    g.fillStyle = '#fff4f8';
    g.fillRect(-150, -380, 300, 380);
    g.fillStyle = '#ffe0ea'; g.fillRect(-150, -380, 300, 26);
    g.fillStyle = '#e2a95d';
    g.beginPath(); g.moveTo(-110, -380); g.lineTo(0, -530); g.lineTo(110, -380); g.closePath(); g.fill();
    atop(g, (g) => {
      g.strokeStyle = '#b5793a'; g.lineWidth = 3;
      for (let i = -10; i < 10; i++) { g.beginPath(); g.moveTo(i * 22, -540); g.lineTo(i * 22 + 160, -380); g.stroke(); g.beginPath(); g.moveTo(i * 22, -540); g.lineTo(i * 22 - 160, -380); g.stroke(); }
      for (let fl = 0; fl < 5; fl++) {
        const y = -350 + fl * 66;
        for (let k = 0; k < 4; k++) { g.fillStyle = ['#c9e8ff', '#ffd6e4', '#fff1b8', '#d6fff0', '#e6d6ff'][fl]; g.beginPath(); g.roundRect(-130 + k * 66, y, 46, 44, [23, 23, 4, 4]); g.fill(); }
      }
      g.fillStyle = 'rgba(0,0,0,0.05)'; g.fillRect(90, -380, 60, 380);
    });
    g.fillStyle = '#ffb3cc'; g.beginPath(); g.ellipse(0, -545, 26, 22, 0, 0, TAU); g.fill();
    g.fillStyle = '#ff7aa2'; g.beginPath(); g.arc(4, -566, 7, 0, TAU); g.fill();
    g.fillStyle = '#ff9cbc'; g.beginPath(); g.roundRect(-46, -112, 92, 112, [46, 46, 0, 0]); g.fill();
    g.fillStyle = '#ffd6e4'; g.beginPath(); g.roundRect(-34, -100, 68, 100, [34, 34, 0, 0]); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(-96, -170, 192, 44, 22); g.fill();
    g.fillStyle = '#4a2c3a'; g.font = '28px Jua'; g.textAlign = 'center'; g.fillText('틀 갤러리', 0, -138);
  }, OUT));
}

function boardSprite() {
  return once('board', () => makeSprite(300, 340, 150, 330, (g) => {
    g.fillStyle = '#c98a4c';
    g.fillRect(-110, -60, 14, 60); g.fillRect(96, -60, 14, 60);
    g.beginPath(); g.roundRect(-130, -300, 260, 250, 18); g.fill();
    g.fillStyle = '#fff6e8'; g.beginPath(); g.roundRect(-114, -284, 228, 218, 12); g.fill();
    const notes = [['#ffd6e4', -100, -270, -0.05], ['#d6ecff', 4, -262, 0.06], ['#fff1b8', -92, -170, 0.04], ['#d6fff0', 10, -165, -0.05]];
    for (const [c, x, y, a] of notes) {
      g.save(); g.translate(x + 45, y + 40); g.rotate(a);
      g.fillStyle = c; g.fillRect(-45, -40, 90, 80);
      g.fillStyle = 'rgba(74,44,58,0.35)'; for (let k = 0; k < 4; k++) g.fillRect(-34, -24 + k * 14, 60 - (k % 2) * 18, 4);
      g.fillStyle = '#ff7aa2'; g.beginPath(); g.arc(0, -36, 4, 0, TAU); g.fill();
      g.restore();
    }
    g.fillStyle = '#ff9cbc'; g.beginPath(); g.roundRect(-90, -326, 180, 40, 20); g.fill();
    g.fillStyle = '#fff'; g.font = '22px Jua'; g.textAlign = 'center'; g.fillText('오늘의 게시판', 0, -298);
  }, OUT));
}

function fountainSprite() {
  return once('fountain', () => makeSprite(280, 300, 140, 290, (g) => {
    g.fillStyle = '#f4eef8';
    g.beginPath(); g.ellipse(0, -30, 120, 30, 0, 0, TAU); g.fill();
    g.fillRect(-120, -62, 240, 32);
    g.beginPath(); g.ellipse(0, -62, 120, 22, 0, 0, TAU); g.fill();
    atop(g, (g) => {
      g.fillStyle = '#e3d8ee'; g.fillRect(-130, -46, 260, 20);
      for (let i = -5; i <= 5; i++) { g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(i * 22 - 8, -58, 16, 28, 6); g.fill(); }
    });
    g.fillStyle = '#9fdcff'; g.beginPath(); g.ellipse(0, -64, 106, 16, 0, 0, TAU); g.fill();
    // stem with a scoop-shaped bowl and a cherry on top
    g.fillStyle = '#f4eef8'; g.beginPath(); g.roundRect(-14, -190, 28, 130, 10); g.fill();
    g.fillStyle = '#ffd6e4'; g.beginPath(); g.ellipse(0, -190, 60, 14, 0, 0, TAU); g.fill();
    g.fillStyle = '#ffb7c9'; g.beginPath(); g.arc(0, -200, 26, Math.PI, 0); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0, -224, 10, 0, TAU); g.fill();
  }, OUT));
}

function faceShopSprite() {
  return once('faceshop', () => makeSprite(320, 380, 160, 370, (g) => {
    g.fillStyle = '#fff8ee'; g.beginPath(); g.roundRect(-130, -260, 260, 260, [8, 8, 0, 0]); g.fill();
    // striped awning
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#b69cff'; g.beginPath(); g.moveTo(-150 + i * 37.5, -290); g.lineTo(-150 + (i + 1) * 37.5, -290); g.lineTo(-150 + (i + 1) * 37.5, -236); g.arc(-150 + (i + 0.5) * 37.5, -236, 18.75, 0, Math.PI); g.closePath(); g.fill(); }
    // mirror
    g.fillStyle = '#ffd35a'; g.beginPath(); g.ellipse(0, -150, 62, 76, 0, 0, TAU); g.fill();
    g.fillStyle = '#dff4ff'; g.beginPath(); g.ellipse(0, -150, 50, 64, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.ellipse(-20, -176, 10, 22, 0.4, 0, TAU); g.fill();
    // the shop's mascot face in the mirror: dot eyes + hook smile
    g.fillStyle = '#2b1c1e'; g.beginPath(); g.arc(-6, -156, 3.6, 0, TAU); g.arc(8, -156, 3.6, 0, TAU); g.fill();
    g.strokeStyle = '#2b1c1e'; g.lineWidth = 3.6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-13, -142); g.bezierCurveTo(-12, -131, 10, -130, 12, -141); g.quadraticCurveTo(13, -145, 12, -147); g.stroke();
    g.fillStyle = '#c9b8ff'; g.fillRect(-130, -60, 260, 60);
    g.fillStyle = '#fff'; g.beginPath(); g.roundRect(-80, -336, 160, 40, 20); g.fill();
    g.fillStyle = '#4a2c3a'; g.font = '22px Jua'; g.textAlign = 'center'; g.fillText('표정 가게', 0, -308);
  }, OUT));
}

function benchSprite() {
  return once('bench', () => makeSprite(200, 120, 100, 110, (g) => {
    g.fillStyle = '#ffffff';
    g.fillRect(-66, -46, 8, 46); g.fillRect(58, -46, 8, 46);
    g.fillStyle = '#ff9cbc'; g.beginPath(); g.roundRect(-80, -54, 160, 12, 6); g.fill();
    g.fillStyle = '#ffb7c9'; for (let i = 0; i < 3; i++) { g.beginPath(); g.roundRect(-80, -100 + i * 15, 160, 10, 5); g.fill(); }
  }, OUT));
}

function portalSprite() {
  return once('portal', () => makeSprite(300, 360, 150, 350, (g) => {
    g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(0, -170, 108, 142, 0, 0, TAU); g.fill();
    g.fillStyle = '#ffe1ec'; g.beginPath(); g.ellipse(0, -170, 96, 130, 0, 0, TAU); g.fill();
    g.fillStyle = '#e2a95d'; g.beginPath(); g.roundRect(-120, -26, 240, 26, 10); g.fill();
    atop(g, (g) => { g.strokeStyle = '#b5793a'; g.lineWidth = 2; for (let i = -12; i < 12; i++) { g.beginPath(); g.moveTo(i * 12, -26); g.lineTo(i * 12 + 26, 0); g.stroke(); } });
    g.fillStyle = '#ff7aa2'; g.beginPath(); g.roundRect(-84, -334, 168, 42, 21); g.fill();
    g.fillStyle = '#fff'; g.font = '24px Jua'; g.textAlign = 'center'; g.fillText('플레이 존', 0, -305);
  }, OUT));
}

function castleSprite() {
  return once('castle', () => makeSprite(460, 360, 230, 350, (g) => {
    const wall = '#fff2f7';
    g.fillStyle = wall;
    g.fillRect(-170, -150, 340, 150);
    for (const [x, w, hgt] of [[-160, 60, 220], [-50, 100, 280], [100, 60, 230], [170, 40, 160], [-200, 40, 150]]) {
      g.fillStyle = wall; g.fillRect(x - w / 2, -hgt, w, hgt);
      // waffle-cone roofs pointing up, topped with a little scoop
      g.fillStyle = '#e8b46a';
      g.beginPath(); g.moveTo(x - w / 2 - 6, -hgt); g.lineTo(x, -hgt - w * 1.3); g.lineTo(x + w / 2 + 6, -hgt); g.closePath(); g.fill();
      g.fillStyle = ['#ffb7c9', '#c9f0e0', '#dccbff'][Math.abs(Math.round(x)) % 3];
      g.beginPath(); g.arc(x, -hgt - w * 1.3, w * 0.22, 0, TAU); g.fill();
    }
    atop(g, (g) => {
      g.fillStyle = 'rgba(190,150,200,0.25)'; g.fillRect(-230, -360, 460, 360);
      g.fillStyle = 'rgba(160,120,180,0.5)';
      for (const [x, y] of [[-60, -150], [-20, -210], [30, -160], [80, -120], [130, -190], [-150, -110]]) { g.beginPath(); g.roundRect(x - 6, y - 10, 12, 20, [6, 6, 0, 0]); g.fill(); }
    });
  }, { outline: 1, outlineColor: 'rgba(160,110,150,0.35)' }));
}
