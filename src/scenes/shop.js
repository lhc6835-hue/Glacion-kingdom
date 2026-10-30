// 틀 갤러리: a five-floor mold boutique. Each floor shows a row of mold silhouettes on pedestals;
// walk up to one and interact to see it in full and buy it. A glass elevator links the floors.
import { SideActor, SideWorld, SideCam, drawPrompt, SIDE_SCALE } from './side.js';
import { MOLDS } from '../../shared/molds.js';
import { grade } from '../../shared/grades.js';
import { moldPreviewRig } from '../render/icons.js';
import { TAU, rgba, shade, mix, rng } from '../core/math.js';
import { sfx, music } from '../core/audio.js';
import { sideHud, moldCard, floorPicker } from '../ui/menus.js';

export const FLOORS = [
  { name: '1층', grades: ['chip', 'soft'], wall: '#ffe9f1', sky: ['#bfe6ff', '#fff1f6'], title: '첫 콘의 설렘' },
  { name: '2층', grades: ['scoop', 'sprinkle'], wall: '#e9f3ff', sky: ['#9fd4ff', '#e6f6ff'], title: '알록달록 스쿱 홀' },
  { name: '3층', grades: ['gelato', 'sundae'], wall: '#fff2e0', sky: ['#ffb6a0', '#ffe2c4'], title: '노을빛 젤라또 살롱' },
  { name: '4층', grades: ['glacier', 'aurora'], wall: '#e4fbff', sky: ['#1f2f6a', '#3fb8b0'], title: '오로라 빙하관' },
  { name: '5층', grades: ['galaxy', 'og'], wall: '#f1e9ff', sky: ['#0d0b2a', '#3a2a7a'], title: '은하 펜트하우스' },
];
const GAP = 250, X0 = 330;

const silCache = new Map();
function silhouette(id) {
  // dark silhouette of the mold with milk scoops, baked once
  let c = silCache.get(id);
  if (c) return c;
  const rig = moldPreviewRig(id, ['milk']);
  const h = -rig.topY() + 20;
  c = document.createElement('canvas');
  const S = 2;
  c.width = 160 * S; c.height = Math.ceil((h + 20) * S);
  const g = c.getContext('2d');
  g.scale(S, S);
  rig.draw(g, 80, h + 4, 1, { shadow: false });
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#3a2a4a';
  g.fillRect(0, 0, c.width, c.height);
  c.oy = h + 4; c.S = S;
  silCache.set(id, c);
  return c;
}

export class ShopScene {
  constructor(app, floor = 0) {
    this.app = app;
    this.layout = 'side';
    this.floor = floor;
    this.t = 0;
    this.cam = new SideCam();
    this.rigs = new Map();
  }

  enter() {
    this.buildFloor(this.floor, true);
    sideHud(this.app);
    music('menu');
  }

  buildFloor(f, fromDoor) {
    this.floor = f;
    const F = FLOORS[f];
    this.molds = MOLDS.filter((m) => F.grades.includes(m.grade));
    const width = X0 + this.molds.length * GAP + 280;
    this.world = new SideWorld(0, width);
    this.elevX = width - 150;
    const lo = this.app.profile.loadout();
    const look = { ...lo };
    if (!this.me) this.me = new SideActor(look, { name: this.app.profile.data.name, local: true, level: this.app.profile.data.level });
    this.me.x = fromDoor ? 120 : this.elevX;
    this.me.y = 0; this.me.vx = 0; this.me.vy = 0;
    this.cam.x = this.me.x; this.cam.y = -60;
    this.spots = [];
    if (f === 0) this.spots.push({ x: 90, label: '광장으로 나가기', act: () => this.app.goHome({ from: 'gallery' }) });
    this.molds.forEach((m, i) => {
      const x = X0 + i * GAP;
      this.spots.push({ x, mold: m, label: this.app.profile.data.molds[m.id] ? `${m.name} 보기` : '실루엣 살펴보기', act: () => moldCard(this.app, m.id, () => this.refreshLabels()) });
    });
    this.spots.push({ x: this.elevX, label: '엘리베이터 타기', act: () => floorPicker(this.app, this.floor, (n) => this.ride(n)) });
    // sample flavors for pedestal displays: the player's own scoops
    this.sample = lo.flavors.length ? lo.flavors : ['milk'];
  }

  refreshLabels() {
    for (const s of this.spots) if (s.mold) s.label = this.app.profile.data.molds[s.mold.id] ? `${s.mold.name} 보기` : '실루엣 살펴보기';
    this.me.rig.setLook({ ...this.app.profile.loadout() });
  }

  ride(n) {
    if (n === this.floor) return;
    sfx.open();
    this.fade = { t: 0, to: n };
  }

  rigFor(m) {
    let r = this.rigs.get(m.id);
    if (!r) { r = moldPreviewRig(m.id, this.sample); this.rigs.set(m.id, r); }
    return r;
  }

  update(dt) {
    this.t += dt;
    const input = this.app.input;
    const modal = this.app.ui.has('modal');
    input.enabled = !modal;
    const mv = input.moveVec();
    this.me.physics(dt, this.world, mv.x, input.pressed('jump') || input.pressed('jumpUp'), input.isDown('jump') || input.isDown('up'));
    this.me.update(dt);
    this.cam.update(dt, this.me.x, -60, this.world);
    for (const m of this.molds) this.rigFor(m).update(dt, {});

    this.near = null;
    let bd = 90;
    for (const s of this.spots) { const d = Math.abs(s.x - this.me.x); if (d < bd) { bd = d; this.near = s; } }
    if (this.near && !modal && (input.pressed('interact') || input.pressed('tap'))) { sfx.open(); this.near.act(); }
    if (input.pressed('esc') && !modal) this.app.goHome({ from: 'gallery' });

    if (this.fade) {
      this.fade.t += dt;
      if (this.fade.t > 0.35 && this.fade.to != null) { this.buildFloor(this.fade.to, false); this.fade.to = null; this.fade.t = 0.35; }
      if (this.fade.t > 0.7) this.fade = null;
    }
    input.enabled = true;
  }

  draw(g) {
    const W = innerWidth, H = innerHeight;
    const F = FLOORS[this.floor];
    g.fillStyle = F.wall; g.fillRect(0, 0, W, H);
    g.save();
    this.cam.apply(g);
    const v = this.cam.view();
    this.drawRoom(g, v, F);
    for (const m of this.molds) this.drawPedestal(g, m);
    this.drawElevator(g);
    if (this.floor === 0) this.drawDoor(g);
    this.me.draw(g, SIDE_SCALE);
    if (this.near && !this.app.ui.has('modal')) drawPrompt(g, this.near.x, -250 - (this.near.mold ? 40 : 0), this.near.label, this.t, this.app.input.isTouch);
    g.restore();
    // floor sign
    g.save();
    g.textAlign = 'center';
    g.font = '24px Jua'; g.fillStyle = '#4a2c3a';
    const gs = F.grades.map((id) => grade(id).name).join(' · ');
    g.fillText(`${F.name} — ${F.title}`, W / 2, H - 46);
    g.font = '15px Jua'; g.fillStyle = 'rgba(74,44,58,0.7)';
    g.fillText(`${gs} 등급 전시`, W / 2, H - 22);
    g.restore();
    if (this.fade) {
      const k = this.fade.t < 0.35 ? this.fade.t / 0.35 : 1 - (this.fade.t - 0.35) / 0.35;
      g.fillStyle = `rgba(255,240,246,${k})`; g.fillRect(0, 0, W, H);
    }
  }

  drawRoom(g, v, F) {
    const x0 = this.world.x0, x1 = this.world.x1;
    const top = -560;
    // wallpaper with soft vertical stripes and a scalloped trim
    g.fillStyle = F.wall; g.fillRect(v.x0 - 10, top - 400, v.x1 - v.x0 + 20, 400 + 560);
    g.fillStyle = rgba(shade(F.wall, -0.06), 1);
    for (let x = Math.floor(v.x0 / 60) * 60; x < v.x1; x += 60) g.fillRect(x, top, 26, 560);
    // windows to the outside, each showing a sky that gets higher (and stranger) floor by floor
    for (let x = x0 + 200; x < x1 - 100; x += 500) this.drawWindow(g, x, -470, F);
    // crown moulding
    g.fillStyle = shade(F.wall, -0.18); g.fillRect(v.x0 - 10, top - 20, v.x1 - v.x0 + 20, 26);
    g.fillStyle = '#ffffff';
    for (let x = Math.floor(v.x0 / 40) * 40; x < v.x1; x += 40) { g.beginPath(); g.arc(x + 20, top + 6, 20, 0, Math.PI); g.fill(); }
    // floor: glossy checker tiles with a reflection band
    const fc = [shade(F.wall, -0.04), '#ffffff'];
    for (let x = Math.floor(v.x0 / 80) * 80; x < v.x1; x += 80) {
      for (let r = 0; r < 4; r++) { g.fillStyle = fc[((x / 80) + r) & 1]; g.fillRect(x, r * 45, 80, 45); }
    }
    const gr = g.createLinearGradient(0, 0, 0, 180);
    gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(v.x0, 0, v.x1 - v.x0, 180);
    g.fillStyle = shade(F.wall, -0.25); g.fillRect(v.x0 - 10, -10, v.x1 - v.x0 + 20, 12);
    // side walls beyond the ends
    g.fillStyle = shade(F.wall, -0.3);
    g.fillRect(x0 - 600, top - 400, 600, 1400); g.fillRect(x1, top - 400, 600, 1400);
  }

  drawWindow(g, x, y, F) {
    const w = 300, h = 300;
    const frame = () => { g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + 100); g.arc(x + w / 2, y + 100, w / 2, Math.PI, 0); g.lineTo(x + w, y + h); g.closePath(); };
    g.save();
    frame();
    g.save(); g.clip();
    const gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, F.sky[0]); gr.addColorStop(1, F.sky[1]);
    g.fillStyle = gr; g.fillRect(x, y - 60, w, h + 60);
    const r = rng(this.floor * 31 + Math.round(x));
    if (this.floor >= 3) for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.6})`; g.beginPath(); g.arc(x + r() * w, y - 40 + r() * h * 0.8, r() * 1.8 + 0.4, 0, TAU); g.fill(); }
    if (this.floor === 3) {
      for (let k = 0; k < 3; k++) {
        g.strokeStyle = ['rgba(120,255,200,0.45)', 'rgba(140,200,255,0.4)', 'rgba(210,160,255,0.35)'][k]; g.lineWidth = 26;
        g.beginPath(); g.moveTo(x - 20, y + 60 + k * 30); g.bezierCurveTo(x + 80, y + Math.sin(this.t + k) * 30, x + 200, y + 120 + k * 10, x + w + 20, y + 40 + k * 25); g.stroke();
      }
    }
    if (this.floor === 4) {
      g.fillStyle = '#ffd35a'; g.beginPath(); g.arc(x + w * 0.7, y + 90, 26, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,200,240,0.6)'; g.beginPath(); g.ellipse(x + w * 0.3, y + 160, 70, 18, -0.2, 0, TAU); g.fill();
    }
    // distant scenery: hills near the ground floors, cloud tops higher up
    const hy = y + h - 40 + this.floor * 34;
    if (this.floor <= 2) {
      g.fillStyle = mix('#b8ecc8', F.sky[1], 0.3);
      g.beginPath(); g.moveTo(x - 10, y + h);
      for (let i = 0; i <= 6; i++) g.quadraticCurveTo(x + i * 50 + 25, hy - 40 - r() * 30, x + i * 50 + 50, hy);
      g.lineTo(x + w + 10, y + h); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 3; i++) { const cx = x + ((this.t * 8 + i * 120 + r() * 50) % (w + 80)) - 40, cy = y + 60 + i * 40; g.beginPath(); g.arc(cx, cy, 18, 0, TAU); g.arc(cx + 22, cy - 6, 22, 0, TAU); g.arc(cx + 44, cy, 16, 0, TAU); g.fill(); }
    } else {
      g.fillStyle = this.floor === 2 ? 'rgba(255,230,230,0.95)' : 'rgba(255,255,255,0.25)';
      for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(x + i * 75, y + h - 20, 45, 0, TAU); g.fill(); }
    }
    g.restore();
    frame();
    g.strokeStyle = '#ffffff'; g.lineWidth = 12; g.stroke();
    g.strokeStyle = 'rgba(160,110,140,0.4)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x + w / 2, y - 50); g.lineTo(x + w / 2, y + h); g.moveTo(x, y + 150); g.lineTo(x + w, y + 150); g.stroke();
    g.restore();
  }

  drawPedestal(g, m) {
    const i = this.molds.indexOf(m);
    const x = X0 + i * GAP;
    const gd = grade(m.grade);
    const owned = this.app.profile.data.molds[m.id];
    const near = this.near && this.near.mold === m;
    // spotlight
    const sp = g.createLinearGradient(0, -560, 0, 0);
    sp.addColorStop(0, rgba(gd.glow, near ? 0.7 : 0.4)); sp.addColorStop(1, rgba(gd.glow, 0));
    g.fillStyle = sp;
    g.beginPath(); g.moveTo(x - 30, -560); g.lineTo(x + 30, -560); g.lineTo(x + 110, -40); g.lineTo(x - 110, -40); g.fill();
    // pedestal: a rounded cylinder with a grade-coloured band
    g.fillStyle = 'rgba(80,40,70,0.15)'; g.beginPath(); g.ellipse(x, 2, 84, 14, 0, 0, TAU); g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.roundRect(x - 70, -96, 140, 96, [10, 10, 4, 4]); g.fill();
    g.fillStyle = gd.color; g.fillRect(x - 70, -78, 140, 12);
    g.fillStyle = 'rgba(0,0,0,0.05)'; g.fillRect(x + 30, -96, 40, 96);
    g.fillStyle = shade('#ffffff', -0.06); g.beginPath(); g.ellipse(x, -96, 70, 12, 0, 0, TAU); g.fill();
    // name plate
    g.fillStyle = '#4a2c3a'; g.font = '15px Jua'; g.textAlign = 'center';
    g.fillText(owned ? m.name : '???', x, -40);
    g.font = '13px Jua'; g.fillStyle = gd.color;
    g.fillText(`${gd.name} · ${m.layers}층`, x, -20);
    // display
    const bob = Math.sin(this.t * 2 + i) * 4;
    if (owned) {
      const rig = this.rigFor(m);
      const s = Math.min(1, 210 / -rig.topY());
      rig.draw(g, x, -100 + bob, s, { shadow: false });
      g.fillStyle = '#ff7aa2'; g.beginPath(); g.roundRect(x + 30, -120, 46, 20, 10); g.fill();
      g.fillStyle = '#fff'; g.font = '12px Jua'; g.fillText('보유', x + 53, -105);
    } else {
      const c = silhouette(m.id);
      const s = Math.min(1, 210 / c.oy);
      g.save();
      g.translate(x, -100 + bob);
      g.scale(s, s);
      if (near) { g.shadowColor = gd.color; g.shadowBlur = 24; }
      g.globalAlpha = 0.92;
      g.drawImage(c, -80, -c.oy, c.width / c.S, c.height / c.S);
      g.restore();
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.font = '28px Jua';
      g.fillText('?', x, -100 + bob - c.oy * s * 0.5);
      // price tag
      g.fillStyle = '#fff3b0'; g.strokeStyle = '#e0a83a'; g.lineWidth = 2;
      const pt = `🍬 ${m.price.toLocaleString()}`;
      g.font = '13px Jua';
      const tw = g.measureText(pt).width + 16;
      g.beginPath(); g.roundRect(x - tw / 2, -138 - c.oy * s, tw, 22, 11); g.fill(); g.stroke();
      g.fillStyle = '#6a3d00'; g.fillText(pt, x, -122 - c.oy * s);
    }
  }

  drawElevator(g) {
    const x = this.elevX;
    g.fillStyle = '#e8eef8'; g.strokeStyle = '#b0bcd0'; g.lineWidth = 4;
    g.beginPath(); g.roundRect(x - 80, -300, 160, 300, [80, 80, 0, 0]); g.fill(); g.stroke();
    g.fillStyle = 'rgba(190,230,255,0.6)';
    g.beginPath(); g.roundRect(x - 64, -284, 62, 284, [62, 0, 0, 0]); g.fill();
    g.beginPath(); g.roundRect(x + 2, -284, 62, 284, [0, 62, 0, 0]); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(x - 50, -250, 8, 200); g.fillRect(x + 14, -250, 8, 200);
    g.fillStyle = '#4a2c3a'; g.beginPath(); g.roundRect(x - 34, -350, 68, 32, 10); g.fill();
    g.fillStyle = '#ffd35a'; g.font = '18px Jua'; g.textAlign = 'center';
    g.fillText(`${this.floor + 1}F ▲▼`, x, -328);
  }

  drawDoor(g) {
    const x = 90;
    g.fillStyle = '#ffb3cc'; g.beginPath(); g.roundRect(x - 55, -230, 110, 230, [55, 55, 0, 0]); g.fill();
    g.fillStyle = '#ffd6e4'; g.beginPath(); g.roundRect(x - 42, -216, 84, 216, [42, 42, 0, 0]); g.fill();
    g.fillStyle = '#ff7aa2'; g.beginPath(); g.arc(x + 26, -100, 6, 0, TAU); g.fill();
    g.fillStyle = '#4a2c3a'; g.font = '15px Jua'; g.textAlign = 'center'; g.fillText('광장', x, -244);
  }
}
