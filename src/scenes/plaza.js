// 광장: the hub, seen from above like the battlefield. A round cobblestone square with the ice
// cream fountain at its heart; the mold gallery, both gacha machines, today's board, the face
// shop and the play zone stand around it. Other players walk around here too (net/net.js).
import { IceCreamRig } from '../render/icecream.js';
import { drawBubble, drawPrompt } from './side.js';
import { TAU, rng, clamp, damp, rand, pick } from '../core/math.js';
import { sfx, music } from '../core/audio.js';
import { sideHud, gachaMachine, faceShop } from '../ui/menus.js';
import { board, fountainWish, playZone, chatBar } from '../ui/plazaMenus.js';
import { ShopScene } from './shop.js';
import { FLAVORS } from '../../shared/flavors.js';
import { MOLDS } from '../../shared/molds.js';
import { FACES } from '../../shared/faces.js';
import { drawSprite } from '../render/sprite.js';
import { propSprite, drawProp, PROP_R } from '../render/arenaWorld.js';
import {
  PlazaGround, PLAZA_R, WORLD_R, PATHS, FOUNTAIN, drawFountain, lampSprite, drawLampGlow,
  gallerySprite, boardSprite, faceShopSprite, benchSprite,
} from '../render/plazaArt.js';
import { drawMachine, drawGate } from '../render/attractions.js';

const SCALE = 0.9; // ice creams on the plaza
const FS = 0.78;   // facility sprites
const FAC = [
  { id: 'gallery', x: 0, y: -880, h: 540, block: [130, 46], spot: [0, -820], label: '틀 갤러리 들어가기' },
  { id: 'gflavor', x: -300, y: -390, h: 520, block: [84, 22], spot: [-300, -345], label: '맛 뽑기' },
  { id: 'gweapon', x: 300, y: -390, h: 520, block: [84, 22], spot: [300, -345], label: '무기 뽑기' },
  { id: 'board', x: -800, y: 10, h: 330, block: [110, 26], spot: [-800, 60], label: '오늘의 게시판 보기' },
  { id: 'faces', x: 800, y: 10, h: 370, block: [120, 30], spot: [800, 60], label: '표정 가게' },
  { id: 'play', x: 0, y: 850, h: 560, block: [160, 22], spot: [0, 770], label: '플레이 존 입장' },
  { id: 'bench', x: -320, y: 300, h: 120, block: [70, 16], spot: [-320, 322], label: '벤치에 앉기' },
  { id: 'bench', x: 320, y: 300, h: 120, block: [70, 16], spot: [320, 322], label: '벤치에 앉기' },
];
const NPC_NAMES = ['딸기콘', '말랑젤라또', '꽁꽁이', '바닐라짱', '민초단장', '슈가슈가', '쫀득이'];
const NPC_LINES = ['오늘 맛 투표 했어?', '플레이 존 같이 갈 사람~', '틀 갤러리 5층 가봤어? 반짝반짝해!', '분수대에 소원 빌었어!', '터키 아이스크림 콘 갖고 싶다…', '보스 태양 너무 뜨거워 ㅠㅠ', '방금 갤럭시 맛 뽑았어!!'];
const SPAWN = { gallery: [0, -760], play: [0, 700] };

// An ice cream walking around the plaza (the player, townsfolk or another player).
class Walker {
  constructor(look, { name = '', x = 0, y = 0, local = false, level = 1 } = {}) {
    this.rig = new IceCreamRig(look);
    this.name = name; this.level = level; this.local = local;
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.tx = x; this.ty = y;
    this.facing = 1;
    this.bubble = null;
  }
  say(text) { this.bubble = { text, t: 0 }; }
  update(dt) {
    if (Math.abs(this.vx) > 8) this.facing = Math.sign(this.vx);
    this.rig.update(dt, { vx: this.vx, vy: this.vy, lookX: this.facing * 0.7, lookY: this.vy > 20 ? 0.4 : this.vy < -20 ? -0.3 : 0.1, speed: 260 });
    if (this.bubble) { this.bubble.t += dt; if (this.bubble.t > 4.5) this.bubble = null; }
  }
  draw(g) {
    this.rig.draw(g, this.x, this.y, SCALE);
    const top = this.y + this.rig.topY() * SCALE;
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

export class PlazaScene {
  constructor(app, { from } = {}) {
    this.app = app;
    this.layout = 'plaza';
    this.t = 0;
    this.cam = { x: 0, y: 0, zoom: 1 };
    this.ground = new PlazaGround();
    const sp = SPAWN[from] || [rand(-140, 140), 230 + rand(0, 60)];
    this.start = { x: sp[0], y: sp[1] };
    this.others = new Map();
    this.npcs = [];
    this.splash = [];
    this.props = makeProps();
  }

  enter() {
    const app = this.app;
    const p = app.profile.data;
    this.me = new Walker({ ...p.loadout }, { name: p.name, local: true, level: p.level, x: this.start.x, y: this.start.y });
    this.cam.x = this.me.x; this.cam.y = this.me.y - 40;
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
    for (let i = 0; i < 7; i++) {
      const m = pick(MOLDS.slice(0, 18));
      const fl = [];
      for (let k = 0; k < m.layers; k++) { let f; do f = pick(FLAVORS).id; while (fl.includes(f)); fl.push(f); }
      const a = rand(TAU), d = rand(240, 500);
      const w = new Walker({ mold: m.id, flavors: fl, weapon: 'spoon', face: pick(FACES.slice(0, 12)).id }, { name: NPC_NAMES[i], x: Math.cos(a) * d, y: Math.sin(a) * d, level: 1 + ((Math.random() * 30) | 0) });
      w.ai = { t: rand(0.5, 3), goal: null, talk: rand(5, 16) };
      this.npcs.push(w);
    }
  }

  // network callbacks
  addOther(id, info) {
    const w = new Walker(info.look, { name: info.name, x: info.x ?? 0, y: info.y ?? 250, level: info.level });
    this.others.set(id, w);
  }
  removeOther(id) { this.others.delete(id); }

  // ── movement & collision ──
  blocked(x, y, r = 16) {
    if (Math.hypot(x, y) > WORLD_R - r) return true;
    if ((x / (FOUNTAIN.rx + r)) ** 2 + ((y - 14) / (FOUNTAIN.ry + r * 0.7)) ** 2 < 1) return true;
    for (const f of FAC) if (((x - f.x) / (f.block[0] + r)) ** 2 + ((y - f.y + 6) / (f.block[1] + r * 0.6)) ** 2 < 1) return true;
    for (const p of this.props) if (Math.hypot(x - p.x, (y - p.y) * 1.6) < p.r + r * 0.8) return true;
    return false;
  }
  move(a, dx, dy) {
    if (!this.blocked(a.x + dx, a.y, 16)) a.x += dx; else a.vx *= 0.3;
    if (!this.blocked(a.x, a.y + dy, 16)) a.y += dy; else a.vy *= 0.3;
  }

  update(dt) {
    this.t += dt;
    const app = this.app, input = app.input;
    const modal = app.ui.has('modal') || app.ui.has('chat');
    input.enabled = !modal;
    const mv = input.moveVec();
    const me = this.me;
    if (this.sitting && Math.hypot(mv.x, mv.y) > 0.2) this.sitting = false;
    if (!this.sitting) {
      const f = damp(12, dt);
      me.vx += (mv.x * 260 - me.vx) * f;
      me.vy += (mv.y * 260 - me.vy) * f;
      this.move(me, me.vx * dt, me.vy * dt);
    } else { me.vx = me.vy = 0; }
    me.update(dt);

    const W = innerWidth, H = innerHeight;
    this.cam.zoom = clamp(Math.max(W, H * 1.25) / 1150, 0.6, 1.5);
    const cf = damp(5, dt);
    this.cam.x += (me.x - this.cam.x) * cf;
    this.cam.y += (me.y - 60 - this.cam.y) * cf;

    for (const n of this.npcs) this.updateNpc(n, dt);
    for (const o of this.others.values()) {
      const dx = o.tx - o.x, dy = o.ty - o.y;
      o.vx = clamp(dx * 8, -320, 320); o.vy = clamp(dy * 8, -320, 320);
      o.x += o.vx * dt; o.y += o.vy * dt;
      o.update(dt);
    }
    if (app.net && app.net.online) app.net.tickPlaza(dt, me);

    // the nearest thing to interact with
    this.near = null;
    let bd = 1;
    for (const f of FAC) {
      const d = Math.hypot(me.x - f.spot[0], me.y - f.spot[1]) / 110;
      if (d < bd) { bd = d; this.near = f; }
    }
    const fd = Math.sqrt((me.x / (FOUNTAIN.rx + 70)) ** 2 + ((me.y - 14) / (FOUNTAIN.ry + 60)) ** 2);
    if (fd < 1 && fd < bd + 0.2) this.near = { id: 'fountain', label: '분수대에 동전 던지기', x: 0, y: 0, h: 320 };
    if (this.near && !modal && (input.pressed('interact') || input.pressed('tap'))) this.use(this.near);

    for (const d of this.splash) { d.t += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 900 * dt; }
    this.splash = this.splash.filter((d) => d.t < d.life);
    input.enabled = true;
  }

  updateNpc(n, dt) {
    const ai = n.ai;
    ai.t -= dt; ai.talk -= dt;
    if (ai.t <= 0) {
      ai.t = rand(2, 6);
      if (Math.random() < 0.65) { const a = rand(TAU), d = rand(220, 520); ai.goal = { x: Math.cos(a) * d, y: Math.sin(a) * d }; }
      else ai.goal = null;
    }
    if (ai.talk <= 0) { ai.talk = rand(10, 24); n.say(pick(NPC_LINES)); }
    let tx = 0, ty = 0;
    if (ai.goal) {
      const dx = ai.goal.x - n.x, dy = ai.goal.y - n.y, d = Math.hypot(dx, dy);
      if (d < 20) ai.goal = null;
      else { tx = (dx / d) * 120; ty = (dy / d) * 120; }
    }
    const f = damp(6, dt);
    n.vx += (tx - n.vx) * f; n.vy += (ty - n.vy) * f;
    const ox = n.x, oy = n.y;
    this.move(n, n.vx * dt, n.vy * dt);
    if (ai.goal && Math.hypot(n.x - ox, n.y - oy) < 0.2 * dt * 120) ai.goal = null; // bumped into something
    n.update(dt);
  }

  use(s) {
    const app = this.app;
    sfx.open();
    switch (s.id) {
      case 'gallery': app.go(new ShopScene(app)); break;
      case 'gflavor': gachaMachine(app, 'flavor'); break;
      case 'gweapon': gachaMachine(app, 'weapon'); break;
      case 'board': board(app); break;
      case 'fountain': fountainWish(app, (fortune) => {
        this.me.say(fortune);
        for (let i = 0; i < 26; i++) this.splash.push({ x: rand(-90, 90), y: rand(-30, 30), vx: rand(-160, 160), vy: rand(-520, -240), t: 0, life: rand(0.6, 1) });
      }); break;
      case 'faces': faceShop(app); break;
      case 'bench': this.me.x = s.x; this.me.y = s.y + 4; this.sitting = true; this.me.rig.happy(3); this.me.say('후~ 시원하다'); break;
      case 'play': playZone(app); break;
    }
  }

  // ── drawing ──
  draw(g) {
    const W = innerWidth, H = innerHeight, z = this.cam.zoom;
    g.save();
    g.translate(W / 2, H / 2);
    g.scale(z, z);
    g.translate(-this.cam.x, -this.cam.y);
    const x0 = this.cam.x - W / 2 / z - 60, x1 = this.cam.x + W / 2 / z + 60, y0 = this.cam.y - H / 2 / z - 60, y1 = this.cam.y + H / 2 / z + 400;
    this.ground.draw(g, x0, y0, x1, y1);

    const list = [];
    const vis = (x, y, m = 300) => x > x0 - m && x < x1 + m && y > y0 - 60 && y < y1 + m;
    for (const p of this.props) if (vis(p.x, p.y)) list.push({ y: p.y, d: () => drawProp(g, p, this.t) });
    for (const L of LAMPS) if (vis(L.x, L.y)) list.push({ y: L.y, d: () => { g.save(); g.translate(L.x, L.y); g.scale(0.72, 0.72); drawSprite(g, lampSprite()); drawLampGlow(g, 0, 0, this.t); g.restore(); } });
    for (const f of FAC) if (vis(f.x, f.y, 400)) list.push({ y: f.y, d: () => this.drawFacility(g, f) });
    list.push({ y: 0, d: () => { g.save(); drawFountain(g, this.t, this.splash); g.restore(); } });
    for (const a of [...this.npcs, ...this.others.values(), this.me]) if (vis(a.x, a.y, 100)) list.push({ y: a.y, d: () => a.draw(g) });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) it.d();

    if (this.near && !this.app.ui.has('modal')) {
      const n = this.near;
      drawPrompt(g, n.spot ? n.spot[0] : 0, (n.y ?? 0) - n.h * (n.id === 'fountain' ? 1 : FS) - 20, n.label, this.t, this.app.input.isTouch);
    }
    this.drawPetals(g, x0, x1, y0, y1);
    g.restore();

    // soft sunlight and a light rosy edge, as on the battlefield
    g.save();
    g.globalCompositeOperation = 'lighter';
    const sun = g.createRadialGradient(W * 0.12, -H * 0.1, 0, W * 0.12, -H * 0.1, Math.max(W, H) * 0.9);
    sun.addColorStop(0, 'rgba(255,250,220,0.12)'); sun.addColorStop(1, 'rgba(255,250,220,0)');
    g.fillStyle = sun; g.fillRect(0, 0, W, H);
    g.restore();
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.5, W / 2, H / 2, Math.max(W, H) * 0.8);
    vg.addColorStop(0, 'rgba(255,210,230,0)'); vg.addColorStop(1, 'rgba(255,190,220,0.18)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }

  drawFacility(g, f) {
    g.save();
    g.translate(f.x, f.y);
    g.fillStyle = 'rgba(80,120,120,0.16)';
    g.beginPath(); g.ellipse(8, 4, f.block[0] * 1.15, f.block[1] * 1.3, 0, 0, TAU); g.fill();
    g.scale(FS, FS);
    switch (f.id) {
      case 'gallery': drawSprite(g, gallerySprite()); break;
      case 'gflavor': drawMachine(g, 'flavor', this.t); break;
      case 'gweapon': drawMachine(g, 'weapon', this.t + 0.5); break;
      case 'board': drawSprite(g, boardSprite()); break;
      case 'faces': drawSprite(g, faceShopSprite()); break;
      case 'bench': drawSprite(g, benchSprite()); break;
      case 'play': g.scale(1.25, 1.25); drawGate(g, this.t); break;
    }
    g.restore();
  }

  drawPetals(g, x0, x1, y0, y1) {
    for (let i = 0; i < 22; i++) {
      const ph = this.t * (0.05 + (i % 5) * 0.01) + i * 0.37;
      const x = x0 + ((ph * 1700 + i * 211) % (x1 - x0 + 200)) - 100;
      const y = y0 + ((i * 97 + this.t * 20) % (y1 - y0)) + Math.sin(this.t * 1.5 + i) * 24;
      g.save(); g.translate(x, y); g.rotate(this.t * 2 + i);
      g.fillStyle = ['rgba(255,170,200,0.75)', 'rgba(255,255,255,0.8)', 'rgba(255,230,150,0.75)'][i % 3];
      g.beginPath(); g.ellipse(0, 0, 5, 2.6, 0, 0, TAU); g.fill();
      g.restore();
    }
  }
}

// lamps around the square, between the paths
const LAMPS = [];
for (let i = 0; i < 8; i++) {
  const a = Math.PI / 4 + Math.floor(i / 2) * (Math.PI / 2) + (i % 2 ? 0.32 : -0.32);
  LAMPS.push({ x: Math.cos(a) * (PLAZA_R + 70), y: Math.sin(a) * (PLAZA_R + 70) });
}

function makeProps() {
  const r = rng(4242);
  const out = [];
  const kinds = ['tree', 'tree', 'tree', 'tree2', 'gum', 'gum', 'lolli', 'shroom', 'shroom', 'rock'];
  const clear = (x, y) => {
    if (Math.hypot(x, y) < PLAZA_R + 120) return false;
    for (const [a, len] of PATHS) {
      const dx = Math.cos(a), dy = Math.sin(a);
      const t = clamp(x * dx + y * dy, PLAZA_R - 40, PLAZA_R + len + 60);
      if (Math.hypot(x - dx * t, y - dy * t) < 130) return false;
    }
    for (const f of FAC) if (Math.hypot(x - f.x, (y - f.y) * 1.4) < 240) return false;
    return !out.some((p) => Math.hypot(p.x - x, p.y - y) < 120);
  };
  // scattered groves on the meadow
  for (let i = 0; i < 400 && out.length < 46; i++) {
    const a = r() * TAU, d = PLAZA_R + 140 + r() * (WORLD_R - PLAZA_R - 160);
    const x = Math.cos(a) * d, y = Math.sin(a) * d;
    if (!clear(x, y)) continue;
    const kind = kinds[(r() * kinds.length) | 0], v = (r() * 4) | 0;
    out.push({ x, y, kind, v, r: PROP_R[kind], sprite: propSprite(kind, v), ph: r() * TAU });
  }
  // a ring of trees and gumdrops marking the edge of the meadow
  const n = 44;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + r() * 0.05, d = WORLD_R + 30 + r() * 40;
    const kind = i % 3 === 0 ? 'gum' : 'tree', v = (r() * 4) | 0;
    out.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, kind, v, r: PROP_R[kind], sprite: propSprite(kind, v), ph: r() * TAU });
  }
  return out;
}
