// Wires every system together and runs the frame: input → simulation → VFX/audio → render → UI.
import { Engine } from '../core/Engine.js';
import { Input } from '../core/Input.js';
import { Events } from '../core/Events.js';
import { Audio } from '../audio/Audio.js';
import { SaveManager } from './SaveManager.js';
import { TreeField } from './Trees.js';
import { Combat } from './Combat.js';
import { Economy } from './Economy.js';
import { Gacha } from './Gacha.js';
import { Processing } from './Processing.js';
import { Player } from './Player.js';
import { WORLD, STATIONS, TREE_SPOTS, groundY } from './World.js';
import { Renderer } from '../gfx/Renderer.js';
import { Particles } from '../gfx/Particles.js';
import { Ambient } from '../gfx/Ambient.js';
import { DayCycle } from '../gfx/DayCycle.js';
import { TimingBar } from '../gfx/TimingBar.js';
import { UI } from '../ui/UI.js';
import { JUDGE } from '../data/balance.js';
import { SAWMILL_LEVELS } from '../data/processing.js';
import { TREES } from '../data/trees.js';
import { ITEMS } from '../data/items.js';
import { itemIcon } from '../art/icons.js';
import { PAL } from '../art/palette.js';

const REACH = 26;

function safeStorage() {
  try { const k = '__axf'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return localStorage; }
  catch { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; }
}

export class Game {
  constructor(canvas, uiRoot, opts = {}) {
    this.opts = opts;
    this.engine = new Engine(canvas);
    this.input = new Input(canvas);
    this.events = new Events();
    this.audio = new Audio();
    this.saves = new SaveManager(safeStorage());
    const loaded = this.saves.load();
    this.state = loaded.state;
    this.loadSource = loaded.source;
    this.rng = Math.random;
    this.now = 0;
    this.day = new DayCycle(opts.hour ?? this.state.hour);
    this.trees = new TreeField(this.events, this.rng);
    TREE_SPOTS.forEach(([sp, x], i) => this.trees.spawn(sp, x, { seed: 1000 + i * 77 }));
    this.combat = new Combat({ state: this.state, trees: this.trees, events: this.events, rng: this.rng, isDay: () => this.day.isDay });
    this.economy = new Economy(this.state, this.events);
    this.gacha = new Gacha(this.state, this.economy, this.events, this.rng);
    this.processing = new Processing(this.state, this.events, this.rng);
    this.player = new Player(WORLD.spawnX);
    this.renderer = new Renderer(this.engine);
    this.particles = new Particles();
    this.ambient = new Ambient();
    this.timingBar = new TimingBar();
    this.cam = { x: 0, y: 0, shakeX: 0, shakeY: 0 };
    this.camY0 = 0;
    this.trauma = 0;
    this.hitstop = 0;
    this.rayBoost = 1;
    this.elderGlow = 0;
    this.flags = {};
    this.autosaveT = 20;
    this.lastSaveOk = true;
    this.ui = new UI(uiRoot, this);
    this.engine.onResize = () => { this.layoutCam(); this.applyUiScale(); };
    this.layoutCam();
    this.cam.x = this.player.x - this.engine.W / 2;
    this.cam.y = this.camY0;
    this.applySettings();
    this.wireEvents();
    this.offline = this.processing.applyOffline(this.state.savedAt, Date.now());
    this.mode = 'boot';
    addEventListener('beforeunload', () => this.save());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.save(); });
  }

  layoutCam() { this.camY0 = groundY(WORLD.spawnX) + 46 - this.engine.H; }

  stationX(id) { return STATIONS.find((s) => s.id === id).x; }

  applySettings() {
    const s = this.state.settings;
    this.audio.setVolumes(s);
    this.particles.density = s.particles;
    this.renderer.quality = s.effects;
    this.day.flow = s.timeFlow;
    this.applyUiScale();
  }

  applyUiScale() {
    const base = Math.max(0.75, Math.min(1.25, innerHeight / 820));
    document.documentElement.style.setProperty('--ui', String(base * (this.state.settings.uiScale || 1)));
  }

  start() {
    const begin = () => {
      if (this.mode !== 'boot') return;
      removeEventListener('keydown', begin); removeEventListener('pointerdown', begin);
      this.audio.init();
      this.audio.play('title');
      this.input.clicks = 0;
      this.ui.hideBoot(() => this.enterPlay());
    };
    if (this.opts.autoplay) { this.ui.showBoot(false); this.enterPlay(); }
    else { addEventListener('keydown', begin); addEventListener('pointerdown', begin); }
    // iOS only unlocks audio on a touch end, so resume there too
    addEventListener('touchend', () => this.audio.ctx?.resume?.(), { passive: true });
    this.engine.start((dt) => this.frame(dt));
  }

  enterPlay() {
    if (this.mode === 'play') return;
    this.mode = 'play';
    this.ui.showHud(true);
    this.ui.showTouch(true);
    this.player.locked = false;
    if (this.loadSource !== 'new') this.ui.toast(this.loadSource === 'backup' ? '저장 파일이 손상되어 백업에서 불러왔습니다' : '진행 상황을 불러왔습니다');
    if (this.offline > 60 && this.state.sawmill.level > 0) this.ui.toast(`자리를 비운 ${Math.round(this.offline / 60)}분 동안 제재소가 일했습니다`);
  }

  save() {
    this.state.hour = this.day.hour;
    this.lastSaveOk = this.saves.save(this.state);
    return this.lastSaveOk;
  }

  wipe() {
    this.saves.wipe();
    this.save = () => true; // do not re-save the old state while reloading
    location.reload();
  }

  objective() {
    const s = this.state;
    const owned = Object.keys(s.axes).length;
    const touch = this.isTouch();
    const chop = touch ? '<b>도끼</b> 버튼을 눌러' : '<kbd>클릭</kbd>해';
    if (!s.stats.hits) return `나무 앞에 서서 ${chop} 벌목을 시작하세요. 마커가 <b class="c-crit">파란 구간</b>에 올 때 다시 ${touch ? '누르세요' : '클릭!'}`;
    if (!Object.keys(s.stats.felled).length) return '나무의 HP를 0으로 만들면 쓰러집니다. 파란 구간은 <b class="c-crit">크리티컬 ×3</b>';
    if (!s.stats.goldEarned) return `왼쪽 야영지의 <b>상인 미르</b>에게 목재를 파세요 ${touch ? '(<b>E</b> 버튼)' : '<kbd>E</kbd>'}`;
    if (owned < 2) return '골드로 상인에게서 도끼를 사거나 <b>도끼 제단</b>에서 기도하세요';
    if (!s.sawmill.level) return `<b>물레방아 제재소</b>를 수리하면 원목을 비싼 판재로 가공할 수 있습니다 (${SAWMILL_LEVELS[1].cost.gold} 골드)`;
    if (s.classes.owned.length < 2 && !this.flags.sawGuild) return '<b>길드 게시판</b>에서 클래스 목표를 확인하세요';
    if (s.classes.owned.length < 2) return '첫 클래스 구매를 목표로 하세요 — 정밀 감시자는 크리티컬 30회가 필요합니다';
    if (!s.stats.felled.mossheart) return '계곡 동쪽 끝의 <b>이끼심장 소나무</b>(방어 10)에 도전하세요';
    return '';
  }

  isTouch() { return document.body.classList.contains('touch-mode'); }

  nearStation() {
    const px = this.player.x;
    let best = null, bd = 1e9;
    for (const s of STATIONS) { const d = Math.abs(s.x - px); if (d < s.range && d < bd) { bd = d; best = s; } }
    return best;
  }

  nearTree() {
    const px = this.player.x, f = this.player.facing;
    let best = null, bd = 1e9;
    for (const t of this.trees.list) {
      if (t.state !== 'alive') continue;
      const d = Math.abs(t.x - px);
      const score = d + (Math.sign(t.x - px) === f ? 0 : 8);
      if (d < REACH && score < bd) { bd = score; best = t; }
    }
    return best;
  }

  promptText() {
    if (this.mode !== 'play' || this.ui.panel) return '';
    if (this.combat.target) return '';
    const st = this.nearStation();
    const touch = this.isTouch();
    if (st) return `${touch ? '<b>E</b>' : '<kbd>E</kbd>'} ${st.ko} — ${st.verb}`;
    const t = this.nearTree();
    if (t) return touch ? `<b>도끼</b> ${TREES[t.species].ko} 벌목 시작` : `<kbd>클릭</kbd>/<kbd>J</kbd> ${TREES[t.species].ko} 벌목 시작`;
    return '';
  }

  useSkill() {
    if (this.combat.useActive(this.now, this.processing)) { this.audio.play('chime'); this.ui.render(); }
    else this.audio.play('error');
  }

  // ── VFX and audio for game events ──
  wireEvents() {
    const ev = this.events, P = this.particles, R = this.renderer, A = this.audio;
    const panOf = (x) => Math.max(-1, Math.min(1, (x - (this.cam.x + this.engine.W / 2)) / (this.engine.W / 2)));
    ev.on('swing', () => A.play('whoosh'));
    ev.on('hit', (h) => {
      const t = h.tree, art = R.art(t);
      const dir = this.player.facing;
      const ix = t.x - dir * 3, iy = groundY(t.x) - 9;
      const pan = panOf(t.x);
      const J = JUDGE[h.j];
      const shake = this.state.settings.shake;
      if (h.j === 'miss') {
        A.play('miss', { pan });
        P.burst(4, ix - dir * 6, groundY(t.x) - 1, ['#6a5a48', '#8a7a62'], 20, 1.2, -Math.PI / 2, 0.4, { grav: 60, drag: 2 });
        return;
      }
      this.hitstop = Math.max(this.hitstop, J.hitstop);
      this.trauma = Math.min(1, this.trauma + J.shake * 0.12 * shake);
      const crit = h.j === 'crit';
      A.play(crit ? 'crit' : 'chop', { j: h.j, pan });
      const bark = TREES[t.species].art.kind === 'birch' ? PAL.birchBark : TREES[t.species].art.kind === 'silver' ? PAL.silverBark : PAL.bark;
      const floor = groundY(t.x) + 1;
      P.burst(crit ? 16 : h.j === 'great' ? 10 : 6, ix, iy, [bark[3], bark[4], bark[2]], crit ? 110 : 70, 1.4, dir > 0 ? Math.PI + 0.3 : -0.3, 0.7, { grav: 260, drag: 1, floor, size: 1 });
      P.burst(crit ? 8 : 3, ix, iy, ['#d8b884', '#c4a070'], 90, 1.0, -Math.PI / 2 - dir * 0.6, 0.6, { grav: 300, floor, size: 2, kind: 2 });
      if (h.j !== 'weak') {
        const top = groundY(t.x) - art.ay + art.H * 0.25;
        P.burst(crit ? 10 : 4, t.x, top, [art.logColor, '#3a6e4a', '#5a8a5a'], 26, 2.8, Math.PI / 2, 2.2, { grav: 18, drag: 0.8, kind: 1, size: 2, spin: Math.random() * 6 });
      }
      R.flash(ix, iy, crit ? 70 : h.j === 'great' ? 34 : 20, crit ? (h.void ? 'blue' : 'white') : 'white', crit ? 0.16 : 0.1);
      R.trail(this.player.x + dir * 3, this.player.y - 9, dir > 0 ? -2.2 : -0.9, dir > 0 ? 0.5 : -3.6, crit ? '#8fd0ff' : h.j === 'great' ? '#a8f0b8' : '#fff0c8');
      if (crit) {
        P.burst(10, ix, iy, ['#ffffff', '#bfe6ff', '#5fb8ff'], 140, 6.28, 0, 0.3, { drag: 4, glow: 0.8, size: 1 });
        P.number(t.x, iy - 12, String(h.damage), '#8fd0ff', 2);
      } else P.number(t.x + (Math.random() - 0.5) * 8, iy - 8, String(h.damage), h.j === 'great' ? '#a8f0b8' : h.j === 'good' ? '#f2e08a' : '#d8ccb8', 1);
      for (const s of h.statuses) {
        if (s.kind === 'burn') { A.play('burn', { pan }); P.burst(8, ix, iy, ['#ff7a2a', '#ffc04a', '#ff4a1a'], 40, 1.2, -Math.PI / 2, 0.8, { glow: 0.6, drag: 1.5, grav: -30 }); }
        if (s.kind === 'frost') { A.play('frost', { pan }); P.burst(8, ix, iy, ['#c8f4ff', '#ffffff', '#7ad0f0'], 60, 6.28, 0, 0.6, { grav: 120, floor, glow: 0.4 }); }
        if (s.kind === 'poison') { A.play('poison', { pan }); P.burst(5, ix, iy, ['#9fd46a', '#c8f08a', '#6a9a3a'], 16, 1.5, -Math.PI / 2, 1, { grav: -15, drag: 1, kind: 2, size: 2 }); }
      }
      if (h.void) { A.play('void', { pan }); P.burst(14, ix, iy, ['#7a5ab0', '#c8a8ff', '#2a1a4a'], 50, 6.28, 0, 0.6, { drag: 3, glow: 0.7 }); }
      if (h.shatter) P.burst(12, ix, iy, ['#ffffff', '#c8f4ff'], 120, 6.28, 0, 0.4, { grav: 200, floor });
      if (h.heavy) this.trauma = Math.min(1, this.trauma + 0.25 * shake);
      this.timingBar.lastDamage = h.damage;
    });
    ev.on('dot', ({ tree, amount, kind }) => {
      const y = groundY(tree.x) - 18;
      P.number(tree.x + (Math.random() - 0.5) * 10, y, String(amount), kind === 'burn' ? '#ff9a4a' : '#9fd46a', 1);
      if (kind === 'burn') P.burst(3, tree.x, y, ['#ff7a2a', '#ffc04a'], 20, 1, -Math.PI / 2, 0.7, { glow: 0.6, grav: -40 });
    });
    ev.on('chain', ({ tree, amount }) => {
      A.play('zap', { pan: panOf(tree.x) });
      const top = groundY(tree.x) - 70;
      for (let i = 0; i < 14; i++) P.spawn(tree.x + (Math.random() - 0.5) * 6 + Math.sin(i * 1.7) * 3, top + i * 4.6, 0, 0, 0.12 + Math.random() * 0.06, i % 3 ? '#fff6a0' : '#ffffff', { glow: 0.9, size: 1 });
      R.flash(tree.x, groundY(tree.x) - 30, 50, 'gold', 0.12);
      P.number(tree.x + 10, groundY(tree.x) - 30, String(amount), '#fff08a', 1);
      this.trauma = Math.min(1, this.trauma + 0.1 * this.state.settings.shake);
    });
    ev.on('fell', ({ tree, rewards }) => {
      tree.fallDir = this.player.x < tree.x ? 1 : -1;
      A.play('creak', { pan: panOf(tree.x) });
      this.pendingFalls.push({ tree, at: this.now + this.trees.fallTime(tree), rewards });
      const rare = TREES[tree.species].rarity >= 3;
      const parts = rewards.map((r) => `${ico(r.id)} ${r.id === 'gold' || r.id === 'essence' ? '' : ITEMS[r.id].ko + ' '}+${r.n}`).join('  ');
      this.ui.toast(`<b>${TREES[tree.species].ko}</b> 쓰러뜨림 — ${parts}`, rare ? 'big' : '');
      if (rare) { A.play('rare'); this.player.cheerT = 1.4; }
    });
    ev.on('rareSpawn', ({ tree }) => { this.ui.toast(`계곡 어딘가에 <b>${TREES[tree.species].ko}</b>가 자라났다!`, 'big'); A.play('chime'); });
    ev.on('produced', ({ id, n }) => this.ui.toast(`${ico(id)} ${ITEMS[id].ko} +${n} <small>제재소</small>`));
    ev.on('step', ({ run, x, y }) => { A.play('step', { run }); if (run) P.burst(2, x, y - 1, ['#8a7a62', '#6a5a48'], 14, 1.2, -Math.PI / 2 - this.player.facing * 0.6, 0.35, { grav: -10, drag: 3, kind: 2, size: 2 }); });
    ev.on('jump', () => A.play('jump'));
    ev.on('land', () => { A.play('land'); P.burst(7, this.player.x, this.player.y, ['#6a5a48', '#4f6a48'], 18, 1, -Math.PI / 2, 0.35, { grav: 80 }); });
    ev.on('birdFlee', ({ x }) => A.play('whoosh', { pan: panOf(x) }));
    ev.on('active', ({ id }) => {
      const p = this.player;
      const col = { heavy_chop: ['#ffd88a', '#ffffff'], focus: ['#8fd0ff', '#ffffff'], ignite: ['#ff7a2a', '#ffc04a'], overclock: ['#e8d070', '#ffffff'] }[id];
      P.burst(18, p.x, p.y - 10, col, 60, 6.28, 0, 0.6, { drag: 3, glow: 0.8 });
      R.flash(p.x, p.y - 10, 50, id === 'ignite' ? 'warm' : 'cyan', 0.3);
    });
    this.pendingFalls = [];
    const ico = (id) => `<img class="ico" src="${itemIcon(id)}" alt="">`;
  }

  // ── frame ──
  frame(dt) {
    const e = this.engine;
    const worldDt = this.hitstop > 0 ? dt * 0.08 : dt;
    this.hitstop = Math.max(0, this.hitstop - dt);
    this.now += worldDt;
    this.day.update(dt);
    this.audio.setNight(this.day.cur.night);
    if (this.mode === 'play') this.playInput();
    if (this.mode !== 'boot') this.state.stats.playTime += dt;
    this.player.update(worldDt, this.input, this.combat, this.events);
    this.combat.update(dt, this.now, worldDt);
    this.trees.update(worldDt, this.now, (t) => this.combat.onFell(t, this.now));
    this.processing.tick(dt);
    for (let i = this.pendingFalls.length - 1; i >= 0; i--) {
      const f = this.pendingFalls[i];
      if (this.now < f.at) continue;
      this.pendingFalls.splice(i, 1);
      const t = f.tree, art = this.renderer.art(t);
      const lx = t.x + t.fallDir * art.H * 0.55;
      const size = Math.min(2, art.H / 80);
      this.audio.play('fell', { size, pan: 0 });
      this.trauma = Math.min(1, this.trauma + 0.35 * size * this.state.settings.shake);
      this.particles.burst(26 * size, lx, groundY(lx) - 2, ['#7a6a52', '#5a4a3a', '#9a8a6a'], 60, 1.6, -Math.PI / 2, 0.9, { grav: 40, drag: 2, size: 2, kind: 2 });
      this.particles.burst(24 * size, lx, groundY(lx) - 16, [art.logColor, '#3a6e4a', '#5a8a5a', '#2a5040'], 50, 3, -Math.PI / 2, 2.5, { grav: 20, drag: 0.8, kind: 1, size: 2 });
      // rewards fly to the player as glints
      for (let k = 0; k < 6; k++) this.particles.spawn(lx + (Math.random() - 0.5) * 20, groundY(lx) - 6, (this.player.x - lx) * 1.6, -40 - Math.random() * 30, 0.6, '#ffe8a0', { glow: 0.8, grav: 120 });
      this.player.gatherT = 0.3;
      this.audio.play('pickup');
    }
    this.particles.update(worldDt);
    this.ambient.update(worldDt, this.now, this.player, this.day, this.events);
    this.followCam(dt);
    // screen shake from trauma (squared for a snappier falloff)
    this.trauma = Math.max(0, this.trauma - dt * 2.2);
    const sh = this.trauma * this.trauma * 6;
    this.cam.shakeX = (Math.random() * 2 - 1) * sh;
    this.cam.shakeY = (Math.random() * 2 - 1) * sh * 0.6;
    // autosave
    this.autosaveT -= dt;
    if (this.autosaveT <= 0 && this.mode === 'play') { this.autosaveT = 20; this.save(); }
    this.render(dt);
    this.ui.update(dt);
    this.input.endFrame();
  }

  playInput() {
    const inp = this.input;
    // panel keys work even while a panel has disabled game input
    const raw = (k) => inp.pressed.has(k);
    if (this.ui.panel) {
      if (raw('Escape') || (raw('i') && this.ui.panel === 'bag') || (raw('c') && this.ui.panel === 'codex')) this.ui.close();
      return;
    }
    if (raw('Escape')) { this.ui.open('settings'); return; }
    if (inp.hit('i', 'Tab')) { this.ui.open('bag'); return; }
    if (inp.hit('c')) { this.ui.open('codex'); return; }
    if (inp.hit('q')) this.useSkill();
    if (inp.hit('e')) {
      const st = this.nearStation();
      if (st) {
        this.combat.disengage();
        if (st.id === 'elder' || st.id === 'gate') {
          this.state.codex.lore[st.id] = true;
          this.ui.toast(`<b>${st.ko}</b> — 도감의 세계 기록에 남았습니다`);
          this.audio.play('chime');
          if (st.id === 'elder') { this.elderPulse = 1.5; }
        } else this.ui.open(st.id);
      }
    }
    const click = inp.takeClick() || inp.hit('j');
    if (click) {
      if (this.combat.target) {
        const take = this.combat.attack(this.now);
        if (take) this.timingBar.judged(take.j);
      } else {
        const t = this.nearTree();
        if (t) {
          this.combat.refreshMods();
          this.combat.engage(t);
          const side = this.player.x <= t.x ? -1 : 1;
          this.player.anchor = t.x + side * 13;
        }
      }
    }
    if (!this.combat.target) this.player.anchor = null;
  }

  followCam(dt) {
    const e = this.engine;
    const p = this.player;
    const look = this.combat.target ? (this.combat.target.x - p.x) * 0.4 : p.facing * 18;
    let tx = p.x + look - e.W / 2;
    tx = Math.max(0, Math.min(WORLD.width - e.W, tx));
    const dx = tx - this.cam.x;
    this.cam.x += dx * Math.min(1, dt * 3.2);
    this.cam.y += (this.camY0 - this.cam.y) * Math.min(1, dt * 2.5);
    if (this.elderPulse > 0) { this.elderPulse -= dt; this.elderGlow = Math.max(0, Math.sin(Math.min(1, this.elderPulse / 1.5) * Math.PI)); }
  }

  render(dt) {
    const e = this.engine;
    e.ug.clearRect(0, 0, e.W, e.H);
    const f = {
      time: e.time, dt, now: this.now, cam: this.cam, camY0: this.camY0, day: this.day,
      player: this.player, combat: this.combat, trees: this.trees, particles: this.particles, ambient: this.ambient,
      equipped: this.state.equipped, sawmillLevel: this.state.sawmill.level, millBusy: this.state.sawmill.jobs.length > 0,
      rayBoost: this.rayBoost, elderGlow: this.elderGlow, reduceFlash: this.state.settings.reduceFlash,
    };
    this.renderer.draw(f);
    const camX = Math.round(this.cam.x + this.cam.shakeX), camY = Math.round(this.cam.y + this.cam.shakeY);
    this.particles.drawNumbers(e.ug, camX, camY);
    if (this.mode === 'play') this.timingBar.draw(e.ug, this.combat, e.W, e.H, dt, this.now, { x: this.player.x - camX, y: this.player.y - camY - 26 });
    const q = this.state.settings.effects;
    e.present(q === 'low' ? 0.7 : 1, (dg, s) => this.renderer.drawActor(dg, s, f));
  }
}

