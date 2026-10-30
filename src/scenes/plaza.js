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
    this.startX = x ?? 2050 - 260;
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
    const gr = g.createLinearGradient(0, 0, 0, H * 0.75);
    gr.addColorStop(0, mix(mix('#8fd0ff', '#ff9ec0', tod.dusk), '#1d1f5a', tod.night));
    gr.addColorStop(0.6, mix(mix('#d6efff', '#ffd2b8', tod.dusk), '#4a3a8a', tod.night));
    gr.addColorStop(1, mix(mix('#fff3f8', '#ffe8d0', tod.dusk), '#8a6ab8', tod.night));
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    if (tod.night > 0.1) {
      const r = rng(5);
      for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,255,255,${tod.night * (0.3 + r() * 0.7) * (0.6 + 0.4 * Math.sin(this.t * 2 + i))})`; g.beginPath(); g.arc(r() * W, r() * H * 0.55, r() * 1.6 + 0.3, 0, TAU); g.fill(); }
    }
    // sun or moon, drifting slowly with the camera
    const sx = W * 0.78 - this.cam.x * 0.02, sy = H * (0.2 + tod.dusk * 0.12);
    const glow = g.createRadialGradient(sx, sy, 10, sx, sy, 160);
    glow.addColorStop(0, tod.night > 0.5 ? 'rgba(255,250,230,0.6)' : 'rgba(255,245,200,0.8)'); glow.addColorStop(1, 'rgba(255,245,200,0)');
    g.fillStyle = glow; g.fillRect(sx - 160, sy - 160, 320, 320);
    g.fillStyle = tod.night > 0.5 ? '#fff8e6' : '#fff6c2';
    g.beginPath(); g.arc(sx, sy, 44, 0, TAU); g.fill();
    if (tod.night > 0.5) { g.fillStyle = mix('#8fd0ff', '#1d1f5a', tod.night); g.beginPath(); g.arc(sx + 18, sy - 10, 40, 0, TAU); g.fill(); }
    // clouds
    for (let i = 0; i < 7; i++) {
      const cx = ((i * 420 + this.t * (6 + i)) % (W + 600)) - 300 - this.cam.x * 0.03 % 400, cy = 60 + (i * 71) % (H * 0.35);
      g.fillStyle = `rgba(255,255,255,${0.75 - tod.night * 0.45})`;
      for (const [dx, dy, r] of [[0, 0, 34], [36, -14, 44], [80, 0, 32], [40, 12, 30]]) { g.beginPath(); g.arc(cx + dx, cy + dy, r * (0.8 + (i % 3) * 0.15), 0, TAU); g.fill(); }
    }
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
    const r = rng(77);
    for (let i = 0; i < 60; i++) {
      const x = r() * X1, y = 46 + r() * 30;
      if (x < v.x0 - 60 || x > v.x1 + 60) continue;
      const c = ['#a8e6c2', '#bff0d0', '#ffd6e4'][i % 3];
      g.fillStyle = c;
      g.beginPath(); g.arc(x, y, 22 + r() * 16, Math.PI, 0); g.fill();
      if (i % 3 === 0) { g.fillStyle = ['#ff9cbc', '#fff0a6', '#c9b8ff'][i % 3 === 0 ? (i / 3) % 3 | 0 : 0]; g.beginPath(); g.arc(x + 6, y - 14, 4, 0, TAU); g.fill(); }
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
    { p: 0.12, w: 2600, h: 520, y: -760, c: bakeMountains(2600, 520, 3, ['#ffc2d6', '#c9f0e0', '#dccbff', '#ffe0b8'], 0.75) },
    { p: 0.22, w: 2400, h: 420, y: -560, c: bakeMountains(2400, 420, 9, ['#ffb0cb', '#a8e8cf', '#c8b4ff'], 1), castle: true },
    { p: 0.45, w: 2200, h: 300, y: -330, c: bakeHills(2200, 300) },
    { p: 0.75, w: 2000, h: 260, y: -270, c: bakeTown(2000, 260) },
  ];
  return PL;
}

function bakeMountains(w, h, seed, cols, scale) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const r = rng(seed);
  const n = Math.round(w / 340);
  for (let i = -1; i <= n; i++) {
    const x = (i / n) * w + r() * 80, pw = 260 + r() * 200, ph = h * (0.55 + r() * 0.4) * scale;
    const col = cols[(i + 10) % cols.length];
    // a soft rounded peak (like a scoop), drawn at x and wrapped at both edges so the strip tiles
    for (const ox of [0, -w, w]) {
      const px = x + ox;
      g.fillStyle = col;
      g.beginPath(); g.moveTo(px - pw, h);
      g.bezierCurveTo(px - pw * 0.45, h - ph * 0.4, px - pw * 0.25, h - ph, px, h - ph);
      g.bezierCurveTo(px + pw * 0.25, h - ph, px + pw * 0.45, h - ph * 0.4, px + pw, h);
      g.fill();
      // whipped cream cap with drips
      g.save();
      g.clip();
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.beginPath();
      const capY = h - ph + ph * 0.28;
      g.moveTo(px - pw, capY - 200);
      g.lineTo(px + pw, capY - 200);
      g.lineTo(px + pw, capY);
      for (let k = 0; k <= 8; k++) {
        const xx = px + pw - (2 * pw * k) / 8, d = k % 2 ? 14 + r() * 26 : 4;
        g.quadraticCurveTo(xx + pw / 8, capY + d, xx, capY);
      }
      g.fill();
      const gr = g.createLinearGradient(px - pw, 0, px + pw, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0.25)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, rgba(shade(col, -0.4), 0.25));
      g.fillStyle = gr; g.fillRect(px - pw, h - ph, pw * 2, ph);
      g.restore();
    }
  }
  // atmospheric haze toward the bottom
  const hz = g.createLinearGradient(0, 0, 0, h);
  hz.addColorStop(0, 'rgba(255,255,255,0)'); hz.addColorStop(1, `rgba(255,245,250,${0.55 - scale * 0.2})`);
  g.fillStyle = hz; g.fillRect(0, 0, w, h);
  return c;
}

function bakeHills(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const r = rng(21);
  for (const [col, base, amp] of [['#bdebd0', 0.45, 60], ['#a6e3c2', 0.6, 50]]) {
    g.fillStyle = col;
    g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 20) g.lineTo(x, h * base + Math.sin((x / w) * TAU * 3) * amp * 0.6 + Math.sin((x / w) * TAU * 7) * amp * 0.25);
    g.lineTo(w, h); g.fill();
  }
  for (let i = 0; i < 26; i++) {
    const x = r() * w, y = h * 0.62 + r() * h * 0.2;
    const col = ['#ffc2dc', '#c9dcff', '#e6d1ff', '#fff1b8'][i % 4];
    g.fillStyle = '#f3e3cf'; g.fillRect(x - 2, y - 16, 4, 16);
    g.fillStyle = col;
    for (const [dx, dy, rr] of [[0, -26, 13], [-9, -20, 9], [9, -20, 9]]) { g.beginPath(); g.arc(x + dx, y + dy, rr, 0, TAU); g.fill(); }
  }
  return c;
}

function bakeTown(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const r = rng(44);
  let x = 0;
  while (x < w - 60) {
    const bw = 110 + r() * 90, bh = 120 + r() * 110;
    const col = ['#ffe3ec', '#fff2d6', '#e3f4ff', '#efe6ff', '#e6fff2'][(r() * 5) | 0];
    const roof = ['#ff9cbc', '#ffb36b', '#8fc8ff', '#b69cff', '#7ee0b0'][(r() * 5) | 0];
    const y = h - bh;
    g.fillStyle = col; g.fillRect(x, y, bw, bh);
    g.fillStyle = roof;
    if (r() < 0.5) { g.beginPath(); g.moveTo(x - 8, y + 4); g.lineTo(x + bw / 2, y - 50); g.lineTo(x + bw + 8, y + 4); g.fill(); }
    else { g.beginPath(); g.arc(x + bw / 2, y + 4, bw / 2 + 6, Math.PI, 0); g.fill(); g.fillStyle = '#ffffff'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + bw / 2 - bw * 0.4 + k * bw * 0.2, y + 4, 8, 0, Math.PI); g.fill(); } }
    g.fillStyle = 'rgba(170,210,240,0.9)';
    for (let wy = y + 30; wy < h - 50; wy += 46) for (let wx = x + 18; wx < x + bw - 30; wx += 36) { g.beginPath(); g.roundRect(wx, wy, 20, 26, [10, 10, 2, 2]); g.fill(); }
    g.fillStyle = shade(col, -0.25); g.beginPath(); g.roundRect(x + bw / 2 - 14, h - 44, 28, 44, [14, 14, 0, 0]); g.fill();
    x += bw + 14 + r() * 30;
  }
  const hz = g.createLinearGradient(0, 0, 0, h);
  hz.addColorStop(0, 'rgba(255,248,252,0.25)'); hz.addColorStop(1, 'rgba(255,248,252,0.45)');
  g.fillStyle = hz; g.fillRect(0, 0, w, h);
  return c;
}

let GT = null;
function groundTile() {
  if (GT) return GT;
  const w = 480, h = 140;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#ffeaf1'); gr.addColorStop(1, '#f6d8e4');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = '#e8bfd0'; g.fillRect(0, 12, w, 4);
  const r = rng(3);
  for (let row = 0; row < 5; row++) {
    const y = 20 + row * 24, off = (row % 2) * 30;
    for (let x = -60 + off; x < w; x += 60) {
      g.fillStyle = ['#fff3f7', '#ffe4ee', '#fbe0ea'][(r() * 3) | 0];
      g.beginPath(); g.roundRect(x + 3, y + 3, 54, 18, 6); g.fill();
    }
  }
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, 14);
  g.fillStyle = 'rgba(255,255,255,0.7)';
  for (let x = 0; x < w; x += 30) { g.beginPath(); g.arc(x + 15, 14, 15, 0, Math.PI); g.fill(); }
  GT = { c, w, h };
  return GT;
}

function lamp(g, x, t) {
  g.fillStyle = '#ffffff'; g.strokeStyle = 'rgba(150,100,130,0.6)'; g.lineWidth = 2;
  g.beginPath(); g.roundRect(x - 5, -470, 10, 470, 4); g.fill(); g.stroke();
  g.fillStyle = '#ff9cbc'; g.beginPath(); g.roundRect(x - 12, -30, 24, 30, 6); g.fill();
  g.fillStyle = '#fff6c2'; g.beginPath(); g.arc(x, -486, 16, 0, TAU); g.fill(); g.stroke();
  const gl = g.createRadialGradient(x, -486, 4, x, -486, 60 + Math.sin(t * 2) * 4);
  gl.addColorStop(0, 'rgba(255,240,170,0.5)'); gl.addColorStop(1, 'rgba(255,240,170,0)');
  g.fillStyle = gl; g.fillRect(x - 70, -556, 140, 140);
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
