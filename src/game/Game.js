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
import { WORLD, STATIONS, TREE_SPOTS, REGION, LORE, groundY, setRegion } from './World.js';
import { REGIONS } from '../data/regions.js';
import { pay, canAfford } from './GameState.js';
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
    // resume in the region the save was made in, if it is still open to the player
    const reg = this.state.region;
    setRegion(REGIONS[opts.region] ? opts.region : REGIONS[reg] && (reg === 'evergreen' || this.state.unlocks[reg]) ? reg : 'evergreen');
    this.state.region = REGION.id;
    this.trees = new TreeField(this.events, this.rng);
    this.plantTrees();
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
    this.zoom = { cur: 1, target: 1, focus: null, hold: 0 };
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
    this.audio.setMood(REGION.look.music);
    this.loreIdx = {};
    this.wireEvents();
    this.offline = this.processing.applyOffline(this.state.savedAt, Date.now());
    this.mode = 'boot';
    addEventListener('beforeunload', () => this.save());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.save(); });
  }

  plantTrees() {
    this.trees.list = [];
    TREE_SPOTS.forEach(([sp, x], i) => this.trees.spawn(sp, x, { seed: 1000 + REGION.order * 5000 + i * 77 }));
  }

  canUnlock(id) {
    const u = REGIONS[id]?.unlock;
    if (!u || this.state.unlocks[id]) return false;
    return u.requires.every((r) => (this.state.stats.felled[r.felled] || 0) >= r.n) && canAfford(this.state, u.cost);
  }

  unlockRegion(id) {
    if (!this.canUnlock(id)) return false;
    pay(this.state, REGIONS[id].unlock.cost);
    this.state.unlocks[id] = true;
    this.state.codex.lore.gate = true;
    this.audio.play('unlock');
    this.trauma = Math.min(1, this.trauma + 0.6 * this.state.settings.shake);
    const gx = STATIONS.find((s) => s.kind === 'gate')?.x ?? this.player.x;
    this.particles.burst(40, gx, groundY(gx) - 10, ['#7a6a52', '#5a4a3a', '#9a8a6a'], 90, 3, -Math.PI / 2, 1.2, { grav: 60, drag: 2, size: 2, kind: 2 });
    this.renderer.flash(gx, groundY(gx) - 40, 140, 'gold', 0.6);
    this.ui.toast('바위가 굴러 내려가고 <b>해비침 숲</b>으로 가는 길이 열렸다!', 'big');
    this.save();
    return true;
  }

  // Walk through to another region: fade out, swap the world, fade back in with a title card.
  travel(to) {
    if (this.traveling || !REGIONS[to]) return;
    this.traveling = true;
    const from = REGION.id;
    this.combat.disengage();
    this.player.locked = true;
    this.player.vx = 0;
    this.audio.play('travel');
    this.ui.veil(true);
    setTimeout(() => {
      setRegion(to);
      this.state.region = to;
      this.renderer.setRegion();
      this.plantTrees();
      this.ambient = new Ambient();
      for (const p of this.particles.pool) p.alive = false;
      this.player.x = REGION.entryX[from] ?? REGION.spawnX;
      this.player.y = groundY(this.player.x);
      this.player.facing = this.player.x < REGION.width / 2 ? 1 : -1;
      this.layoutCam();
      this.cam.x = Math.max(0, Math.min(WORLD.width - this.engine.W, this.player.x - this.engine.W / 2 + this.player.facing * 18));
      this.cam.y = this.camY0;
      this.audio.setMood(REGION.look.music);
      const first = !this.state.unlocks['seen_' + to];
      this.state.unlocks['seen_' + to] = true;
      this.state.codex.lore.gate = this.state.codex.lore.gate || to === 'sunveil';
      this.save();
      setTimeout(() => {
        this.ui.veil(false);
        this.ui.discover(REGION, first);
        this.audio.play(first ? 'discover' : 'chime');
        this.player.locked = false;
        this.traveling = false;
      }, 250);
    }, 650);
  }

  // Smoothly zooms the camera out until `height` art pixels above the ground and `width` across
  // fit on screen, centred on x. Moving, jumping or chopping zooms back in.
  frameLandmark(x, height, width = 0) {
    const e = this.engine;
    const z = Math.min(1, (e.H0 - 6) / (height + 46), width ? e.W0 / width : 1);
    this.zoom.target = z;
    this.zoom.focus = x;
    this.zoom.hold = 0.45;
    this.player.vx = 0;
  }

  updateZoom(dt) {
    const zm = this.zoom, e = this.engine, p = this.player;
    if (zm.focus !== null) {
      zm.hold -= dt;
      const moved = Math.abs(p.vx) > 4 || !p.onGround || this.combat.target || this.ui.panel || this.traveling;
      if (zm.hold <= 0 && moved) { zm.target = 1; zm.focus = null; }
    }
    if (Math.abs(zm.target - zm.cur) < 0.0005 && zm.cur === e.zoom) return;
    // ease toward the target; keep the view centre where it is while the view size changes
    const centre = this.cam.x + e.W / 2;
    zm.cur += (zm.target - zm.cur) * (1 - Math.exp(-dt * 3.4));
    if (Math.abs(zm.target - zm.cur) < 0.0005) zm.cur = zm.target;
    e.setZoom(zm.cur);
    this.layoutCam();
    this.cam.x = centre - e.W / 2;
    this.cam.y = this.camY0;
  }

  // Look at a landmark: records it in the codex and shows its next line of lore.
  inspect(st) {
    const lines = LORE[st.id];
    this.state.codex.lore[st.id] = true;
    this.audio.play('chime');
    if (st.kind === 'elder') { this.elderPulse = 1.5; const el = this.renderer.props.elder; this.frameLandmark(st.x, el.H + 70, el.W + 24); }
    if (!lines) return;
    const i = this.loreIdx[st.id] = ((this.loreIdx[st.id] ?? -1) + 1) % lines.length;
    this.ui.toast(`<b>${st.ko}</b> — ${lines[i]}`);
  }

  layoutCam() { this.camY0 = groundY(WORLD.spawnX) + 46 - this.engine.H; }

  stationX(id) { return STATIONS.find((s) => s.id === id || s.kind === id).x; }

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
    if (REGION.id === 'sunveil') {
      if (!s.stats.felled.oak) return '해비침 숲의 <b>참나무</b>를 베어 보세요. 계곡 나무보다 단단하지만 값이 훨씬 좋아요';
      if (!s.stats.felled.honeybark) return '숲 가운데 해시계 너머 <b>꿀껍질나무</b>에서 금빛 수지가 나옵니다';
      if (!s.stats.felled.sunheart) return '참나무가 다시 자랄 때 가끔 <b>태양심장 참나무</b>가 됩니다. 숲 동쪽 끝을 확인하세요';
      return '';
    }
    if (!s.unlocks.sunveil && (s.stats.felled.silverleaf || 0) >= 1 && s.stats.goldEarned > 800) {
      const need = REGIONS.sunveil.unlock;
      return `계곡 동쪽 끝 <b>무너진 바위 길</b>을 치우면 새 지역이 열립니다 — 은엽수 ${Math.min(3, s.stats.felled.silverleaf || 0)}/3 · ${need.cost.gold} 골드 · 정수 ${need.cost.essence}`;
    }
    if (s.unlocks.sunveil && !s.unlocks.seen_sunveil) return '바위 길이 열렸습니다. 동쪽 끝으로 가서 <b>해비침 숲</b>으로 들어가세요';
    if (!s.stats.felled.mossheart) return '계곡 동쪽 끝의 <b>이끼심장 소나무</b>(방어 10)에 도전하세요';
    return '';
  }

  leafColors(t) {
    const k = TREES[t.species].art.kind;
    const pal = { pine: PAL.pine, birch: PAL.birch, silver: PAL.silver, mossheart: PAL.moss, oak: PAL.oak, sunheart: PAL.sunheart, maple: PAL.maple, honey: PAL.honeyLeaf, dawn: PAL.dawn }[k] || PAL.leafDeep;
    return [pal[2], pal[3], pal[4]];
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
    if (st) {
      const verb = st.kind === 'gate' && this.state.unlocks[st.to] ? `${REGIONS[st.to].ko}으로 가기` : st.verb;
      return `${touch ? '<b>E</b>' : '<kbd>E</kbd>'} ${st.ko} — ${verb}`;
    }
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
      R.trail(this.player.x + dir * 2, this.player.y - 6, dir, crit ? '#8fd0ff' : h.j === 'great' ? '#a8f0b8' : '#fff0c8');
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
      const rare = TREES[tree.species].rarity >= 3;
      const parts = rewards.map((r) => `${ico(r.id)} ${r.id === 'gold' || r.id === 'essence' ? '' : ITEMS[r.id].ko + ' '}+${r.n}`).join('  ');
      this.ui.toast(`<b>${TREES[tree.species].ko}</b> 쓰러뜨림 — ${parts}`, rare ? 'big' : '');
      if (rare) { A.play('rare'); this.player.cheerT = 1.4; }
    });
    ev.on('rareSpawn', ({ tree }) => { this.ui.toast(`${WORLD.ko} 어딘가에 <b>${TREES[tree.species].ko}</b>가 자라났다!`, 'big'); A.play('chime'); });
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
    // felling and regrowth beats come from the tree simulation (Trees.stepFall)
    ev.on('treeLanded', ({ tree: t, impact, first }) => {
      const art = R.art(t);
      const lx = t.x + t.fallDir * art.H * 0.55;
      const size = Math.min(2, art.H / 80) * (first ? 1 : 0.35);
      A.play('fell', { size, pan: panOf(lx) });
      this.trauma = Math.min(1, this.trauma + 0.3 * size * this.state.settings.shake);
      const n = Math.round(22 * size);
      // dust rolls out along the length of the trunk, leaves jump from the crown
      for (let k = 0; k < 4; k++) {
        const x = t.x + t.fallDir * art.H * (0.25 + k * 0.22);
        P.burst(Math.ceil(n / 4), x, groundY(x) - 1, ['#7a6a52', '#5a4a3a', '#9a8a6a'], 50 + impact * 6, 1.4, -Math.PI / 2 - t.fallDir * 0.3, 0.9, { grav: 30, drag: 2.2, size: 2, kind: 2 });
      }
      if (first) {
        P.burst(Math.round(26 * size), lx, groundY(lx) - 12, [art.logColor, ...this.leafColors(t)], 55, 3, -Math.PI / 2, 2.6, { grav: 18, drag: 0.8, kind: 1, size: 2, spin: 4 });
        R.flash(lx, groundY(lx) - 6, 60 * size, 'warm', 0.12);
        // rewards fly to the player as glints
        for (let k = 0; k < 6; k++) P.spawn(lx + (Math.random() - 0.5) * 20, groundY(lx) - 6, (this.player.x - lx) * 1.6, -40 - Math.random() * 30, 0.6, '#ffe8a0', { glow: 0.8, grav: 120 });
        this.player.gatherT = 0.3;
        A.play('pickup');
      }
    });
    ev.on('treeDissolve', ({ tree: t }) => {
      const art = R.art(t);
      // the lying trunk breaks into drifting leaves and motes as it fades
      for (let k = 0; k < 6; k++) {
        const x = t.x + t.fallDir * art.H * (0.15 + k * 0.15);
        P.burst(3, x, groundY(x) - 4 - (k > 3 ? 6 : 0), this.leafColors(t), 14, 6.28, 0, 1.6, { grav: -6, drag: 1.2, kind: 1, size: 2, spin: 3 });
        P.spawn(x, groundY(x) - 4, 0, -10 - Math.random() * 8, 1.2, '#ffe8b0', { glow: 0.6, drag: 1 });
      }
    });
    ev.on('treeSprouted', ({ tree: t }) => {
      A.play('sprout', { pan: panOf(t.x) });
      P.burst(8, t.x, groundY(t.x), ['#8ad06a', '#d0f59a', '#5a8a5a'], 26, 1.6, -Math.PI / 2, 0.8, { grav: 50, drag: 2, size: 1, glow: 0.3 });
    });
    ev.on('treeSprung', ({ tree: t }) => {
      const art = R.art(t);
      const top = groundY(t.x) - art.ay + art.H * 0.3;
      P.burst(12, t.x, top, this.leafColors(t), 30, 6.28, 0, 1.4, { grav: 14, drag: 1, kind: 1, size: 2, spin: 3 });
      for (let k = 0; k < 8; k++) P.spawn(t.x + (Math.random() - 0.5) * art.W * 0.6, top + Math.random() * art.H * 0.4, 0, -6 - Math.random() * 6, 1.4, '#e8ffd0', { glow: 0.7, drag: 1 });
    });
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
    this.particles.update(worldDt);
    this.ambient.update(worldDt, this.now, this.player, this.day, this.events);
    this.updateZoom(dt);
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
    if (this.ui.fx.open) {
      if (raw('Escape')) this.ui.fx.stageN === 'done' ? this.ui.fx.close() : this.ui.fx.skip();
      else if (raw(' ') || raw('Enter')) this.ui.fx.stageN === 'done' ? this.ui.fx.close() : this.ui.fx.skip();
      return;
    }
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
      if (st && !this.traveling) {
        this.combat.disengage();
        if (st.kind === 'gate') {
          if (this.state.unlocks[st.to]) this.travel(st.to);
          else { this.inspect(st); this.ui.open('gate'); }
        } else if (st.kind === 'path' && st.to) this.travel(st.to);
        else if (st.kind === 'elder' || st.kind === 'path' || st.kind === 'sundial') this.inspect(st);
        else this.ui.open(st.kind);
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
    let tx = this.zoom.focus !== null ? this.zoom.focus - e.W / 2 : p.x + look - e.W / 2;
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
      rayBoost: this.rayBoost, elderGlow: this.elderGlow, gateOpen: !!this.state.unlocks.sunveil, reduceFlash: this.state.settings.reduceFlash,
    };
    this.renderer.draw(f);
    const camX = Math.round(this.cam.x + this.cam.shakeX), camY = Math.round(this.cam.y + this.cam.shakeY);
    this.particles.drawNumbers(e.ug, camX, camY);
    if (this.mode === 'play') this.timingBar.draw(e.ug, this.combat, e.W, e.H, dt, this.now, { x: this.player.x - camX, y: this.player.y - camY - 26 });
    const q = this.state.settings.effects;
    e.present(q === 'low' ? 0.7 : 1, (dg, s) => this.renderer.drawActor(dg, s, f));
  }
}

