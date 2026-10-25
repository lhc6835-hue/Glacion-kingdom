import * as THREE from 'three';
import { Engine } from './core/Engine.js';
import { CameraRig } from './core/CameraRig.js';
import { Input } from './core/Input.js';
import { GameState } from './core/GameState.js';
import { Quests, itemName } from './core/Quests.js';
import { WorldData, F_CITY } from './world/WorldData.js';
import { Ground } from './world/Ground.js';
import { WaterView } from './world/WaterView.js';
import { Collision } from './world/Collision.js';
import { paintNatureLibrary, scatterNature, PPM } from './world/Decor.js';
import { Town } from './world/Town.js';
import { People } from './world/People.js';
import { Pickups } from './world/Pickups.js';
import { SkyView } from './world/SkyView.js';
import { DayNight } from './world/DayNight.js';
import { Atlas } from './gfx/Atlas.js';
import { PagedSprites, ShadowLayer, playerUniform } from './gfx/Sprites.js';
import { look } from './gfx/Look.js';
import { Player } from './player/Player.js';
import { UI } from './ui/UI.js';
import { Audio } from './audio/Audio.js';
import { START, PLACES, HALF } from './world/Layout.js';
import { FACILITIES } from './data/facilities.js';
import { LORE } from './data/quests.js';

const frame = () => new Promise((r) => requestAnimationFrame(() => r()));

class Game {
  async boot() {
    this.ui = new UI(document.getElementById('ui'));
    let engine;
    try { engine = this.engine = new Engine(document.getElementById('game')); }
    catch (e) {
      this.ui.progress(0, 'WebGL을 시작할 수 없습니다. 그래픽 가속이 켜진 최신 브라우저에서 다시 열어 주세요.');
      throw e;
    }
    const { scene, camera, renderer } = engine;
    this.state = new GameState();
    this.input = new Input(renderer.domElement);
    this.quests = new Quests(this.state, this.ui);

    this.ui.progress(0.02, '땅과 물길을 만드는 중…');
    await frame();
    const world = this.world = new WorldData();
    for (const p of world.generate()) { this.ui.progress(0.02 + p * 0.4); await frame(); }

    this.ui.progress(0.45, '절벽과 호수를 칠하는 중…'); await frame();
    this.ground = new Ground(scene, world);
    this.water = new WaterView(scene, world);
    this.collision = new Collision();

    this.ui.progress(0.55, '나무와 꽃을 그리는 중…'); await frame();
    const atlas = new Atlas(4096);
    this.natureLib = paintNatureLibrary(atlas);
    this.ui.progress(0.62, '왕도와 왕성을 짓는 중…'); await frame();
    this.town = new Town(world, this.collision);
    this.town.paint(atlas, this.natureLib);
    const textures = atlas.textures(renderer);
    this.sprites = new PagedSprites(scene, textures, 200000);
    this.glow = new PagedSprites(scene, textures, 6000, { cutout: false, additive: true, renderOrder: 9 });
    this.shadows = new ShadowLayer(120000);
    scene.add(this.shadows.mesh);

    this.ui.progress(0.72, '숲을 심는 중…'); await frame();
    scatterNature(world, this.natureLib, this.sprites, this.shadows, this.collision);
    this.town.place(this.sprites, this.glow, this.shadows);
    for (const g of this.town.gardens) {
      const reg = this.natureLib[g.kind][Math.floor((g.x * 7 + g.z * 3) % this.natureLib[g.kind].length + this.natureLib[g.kind].length) % this.natureLib[g.kind].length];
      const y = world.groundHeight(g.x, g.z);
      this.sprites.add(reg, g.x, y, g.z, PPM, { sway: 0.1, scale: g.kind === 'bush' || g.kind === 'flowerbush' ? 1 : 0.8 });
      if (!g.kind.includes('bush')) this.collision.circle(g.x, g.z, 0.5, { kind: 'tree' });
    }
    this.sprites.commit(); this.glow.commit(); this.shadows.commit();

    this.ui.progress(0.85, '하늘과 구름을 띄우는 중…'); await frame();
    this.sky = new SkyView(scene, renderer);
    this.dayNight = new DayNight();
    this.ui.progress(0.9, '깃털족을 깨우는 중…'); await frame();
    this.people = new People(scene, renderer, world, this.collision, this.town);
    this.pickups = new Pickups(scene, renderer, world, this.state);
    this.player = new Player(world, this.collision, this.town.walkables);
    this.rig = new CameraRig(camera);
    this.audio = new Audio(this.state.settings);

    this.player.spawn(START.x, START.z);
    this.player.facing = 1;
    this.rig.snap(this.player.pos);
    this.ground.buildAll(this.player.pos.x, this.player.pos.z);
    if (engine.params.has('t')) this.dayNight.setTime(+engine.params.get('t'));

    this.mode = 'title';
    this.saveTimer = 0;
    this.place = null;
    engine.add({ update: (dt, t) => this.update(dt, t) });
    engine.start();
    this.ui.progress(1, '준비 완료');
    await frame();
    this.ui.hideLoading();
    if (engine.params.has('play')) this.startGame(false);
    else this.ui.showTitle(GameState.hasSave(), (act) => {
      if (act === 'help') { this.ui.help(); return; }
      this.startGame(act === 'continue');
    });
    addEventListener('keydown', (e) => { if (e.key === 'Escape') this.ui.closePanel(); });
    window.__glacion = this;
  }

  startGame(cont) {
    if (cont && this.state.load()) {
      this.pickups.items.forEach((it) => { if (this.state.collected[it.uid]) this.pickups.layer.hide(it.i); });
      this.pickups.layer.commit();
      if (this.state.player.x !== null) { this.player.pos.set(this.state.player.x, this.state.player.y, this.state.player.z); this.player.onGround = false; }
      this.dayNight.setTime(this.state.time);
    } else {
      this.state.reset();
      this.dayNight.setTime(this.engine.params.has('t') ? +this.engine.params.get('t') : 15.3);
      this.player.spawn(START.x, START.z);
    }
    this.rig.snap(this.player.pos);
    this.audio.start();
    this.ui.hideTitle();
    this.mode = 'play';
    if (!cont) setTimeout(() => this.ui.banner('글래시온 왕국', '저 멀리 왕성이 보인다. 자유롭게 걸어가 보자'), 900);
  }

  update(dt, t) {
    const { input, player, ui } = this;
    look.uTime.value = t;
    this.dayNight.update(dt);
    this.state.time = this.dayNight.time;
    const playing = this.mode === 'play';
    const busy = ui.busy;

    if (playing) {
      input.enabled = true;
      if (!busy) {
        player.update(dt, input);
        this.people.pushOut(player.pos);
        if (input.hit(' ') && player.onGround === false && player.vel.y > 6) this.audio.play('jump');
      } else player.update(dt, { move: () => ({ x: 0, z: 0 }), down: () => false, hit: () => false });
      if (input.wheel) this.rig.zoom(input.wheel * 0.12);
      if (input.hit('=', '+')) this.rig.zoom(-0.15);
      if (input.hit('-')) this.rig.zoom(0.15);
      if (!busy) this.handleKeys();
      else if (input.hit('e') && ui.dialogNext) ui.dialogNext();
      this.people.update(dt, this.dayNight.time, player);
      this.checkPlaces();
      this.interactions(busy);
      this.state.playSeconds += dt;
      this.saveTimer += dt;
      if (this.saveTimer > 20) { this.saveTimer = 0; this.persist(); }
    } else {
      // Title: let the view breathe while the menu is up.
      this.people.update(dt, this.dayNight.time, player);
    }

    playerUniform.value.copy(player.pos);
    this.rig.update(dt, player.pos, playing ? player.vel : null);
    this.ground.update(this.rig.camera.position.x, this.rig.camera.position.z);
    this.sky.update(dt, t, this.engine.camera);
    this.people.draw(player);
    if (playing) this.updateHud();
    this.audio.update(this.soundEnv());
    input.endFrame();
  }

  handleKeys() {
    const { input, ui } = this;
    if (input.hit('q')) { this.audio.play('open'); ui.journal(this.quests, this.state); }
    if (input.hit('m')) { this.audio.play('open'); ui.map(this.mapCanvas(), this.player, this.state, this.quests.trackedTarget(this.world)); }
    if (input.hit('h', 'f1')) ui.help();
    if (input.hit('t')) { this.dayNight.speed = this.dayNight.speed > 1 ? 1 : 40; ui.toast(this.dayNight.speed > 1 ? '시간이 빠르게 흐릅니다 (T로 해제)' : '시간이 평소대로 흐릅니다'); }
  }

  persist() {
    const p = this.player.pos;
    Object.assign(this.state.player, { x: p.x, y: p.y, z: p.z });
    this.state.save();
  }

  checkPlaces() {
    const p = this.player.pos;
    let best = null;
    for (const pl of PLACES) {
      const d = Math.hypot(p.x - pl.x, p.z - pl.z);
      if (d < pl.r && (!best || pl.r < best.r)) best = pl;
      if (d < pl.r * 0.7 && !this.state.discovered[pl.id]) {
        this.state.discovered[pl.id] = true;
        this.ui.banner(pl.name, pl.sub);
        this.audio.play('discover');
        this.quests.event('visit', pl.id);
        this.persist();
      }
    }
    this.place = best;
  }

  interactions(busy) {
    const { player, ui, input } = this;
    if (busy) { ui.prompt(null); return; }
    const p = player.pos;
    let cand = null;
    const pk = this.pickups.nearest(p.x, p.z, p.y);
    if (pk) cand = { label: `${itemName(pk.kind)} 줍기`, fn: () => this.pickup(pk) };
    const npc = !cand && this.people.nearestNPC(p.x, p.z);
    if (npc) cand = { label: `${npc.name}와(과) 이야기하기`, fn: () => this.talk(npc) };
    if (!cand) {
      let bd = Infinity;
      for (const it of this.town.interactables) {
        const d = Math.hypot(it.x - p.x, it.z - p.z);
        if (d < it.r && d < bd && Math.abs((it.y ?? this.world.groundHeight(it.x, it.z)) - p.y) < 4) { bd = d; cand = { label: it.label, fn: () => this.use(it) }; }
      }
    }
    ui.prompt(cand?.label);
    if (cand && input.hit('e')) cand.fn();
  }

  pickup(it) {
    this.pickups.collect(it);
    this.state.addItem(it.kind);
    this.audio.play('pickup');
    this.ui.toast(`${itemName(it.kind)}을(를) 주웠다`);
    this.quests.event('collect', it.kind);
    this.persist();
  }

  talk(npc) {
    npc.talking = true;
    this.audio.play('talk');
    const done = this.quests.turnInTo(npc.name);
    const pages = [];
    if (done.length) for (const q of done) pages.push(`「${q.title}」 일, 정말 고마워! 약속한 보상이야.`);
    const hour = this.dayNight.time;
    const extra = hour < 9 ? ['좋은 아침이야!'] : hour > 19 ? ['오늘 하루도 수고했어.'] : [];
    pages.push(npc.lines[npc.talkIndex % npc.lines.length]);
    npc.talkIndex++;
    if (!done.length && extra.length && npc.role !== 'guard' && Math.random() < 0.4) pages.unshift(extra[0]);
    this.quests.event('talk', npc.name);
    const choices = [];
    if (npc.facility) choices.push({ label: `${npc.facility.name} 둘러보기`, fn: () => this.openFacility(npc.facility) });
    const offers = this.quests.all.filter((q) => q.giver === npc.name && this.quests.status(q.id) === 'available');
    if (offers.length) choices.push({ label: `부탁할 일 있어요? (${offers.length})`, fn: () => this.offer(npc, offers[0]) });
    if (choices.length) choices.push({ label: '그럼 이만', fn: () => {} });
    this.ui.dialog(npc.name, pages, choices.length ? choices : null, () => {});
    const release = () => { if (!this.ui.busy) npc.talking = false; else setTimeout(release, 300); };
    setTimeout(release, 300);
  }

  offer(npc, q) {
    this.ui.dialog(npc.name, [q.desc, `보상은 ${q.reward.coins}깃전이야. 해 줄 수 있겠어?`], [
      { label: '맡겨 주세요', fn: () => { this.quests.accept(q.id); this.audio.play('quest'); } },
      { label: '다음에요', fn: () => {} },
    ]);
  }

  openFacility(fac) {
    const h = this.dayNight.time;
    const [o, c] = fac.hours;
    const open = o < c ? h >= o && h < c : h >= o || h < c;
    this.audio.play('open');
    this.ui.facility(fac, open, {
      board: () => { this.ui.closePanel(); this.openBoard(); },
      rest: () => {
        this.ui.closePanel();
        const target = 7;
        this.dayNight.setTime(target);
        this.state.player.hp = this.state.player.maxHp;
        this.persist();
        this.ui.dialog(fac.keeper.name, ['푹 잤니? 창밖을 봐, 아침 안개가 호수 위에 내려앉았어.'], null);
      },
      lore: () => {
        this.ui.closePanel();
        const keys = Object.keys(LORE);
        const k = keys.find((kk) => !this.state.lore[kk]) || keys[0];
        this.ui.dialog(fac.keeper.name, ['이 책장에는 왕국의 오래된 이야기가 있지.', `「${LORE[k].title}」\n${LORE[k].text}`]);
      },
      bless: () => { this.ui.closePanel(); this.state.player.hp = this.state.player.maxHp; this.ui.toast('아우라의 축복으로 기운이 가득 찼다'); },
      save: () => { this.persist(); this.ui.toast('여정을 기록했습니다 (저장 완료)'); },
    });
  }

  openBoard() {
    this.audio.play('open');
    this.ui.questBoard(this.quests, this.state.player.level, {
      accept: (id) => { this.quests.accept(id); this.audio.play('quest'); },
      track: (id) => this.quests.track(id),
      abandon: (id) => this.quests.abandon(id),
    });
  }

  use(it) {
    if (it.kind === 'facility') { this.openFacility(FACILITIES.find((f) => f.id === it.id)); return; }
    if (it.kind === 'questboard') { this.openBoard(); return; }
    if (it.kind === 'bench') {
      this.dayNight.setTime(this.dayNight.time + 1);
      this.ui.dialog('벤치', ['잠시 앉아 분수 소리를 들었다. 한 시간이 흘렀다.']);
      return;
    }
    if (it.kind === 'training') { this.ui.dialog('훈련장', ['허수아비에 오래된 칼자국이 가득하다. (전투 훈련은 다음 개발 단계에서 열립니다)']); return; }
    this.quests.event('inspect', it.kind);
    if (it.text) this.ui.dialog(it.label, [it.text]);
  }

  updateHud() {
    const p = this.player.pos;
    const tq = this.state.tracked ? this.quests.get(this.state.tracked) : null;
    const tt = this.quests.trackedTarget(this.world);
    let target = tt;
    if (tt?.npc) {
      const n = this.people.npcs.find((nn) => nn.name === tt.npc);
      if (n) target = { ...tt, x: n.x, z: n.z, label: `${tt.npc}에게 보고하기` };
    }
    const compass = [];
    const bearing = (x, z) => Math.atan2(x - p.x, -(z - p.z)) * 180 / Math.PI;
    for (const pl of PLACES) {
      if (!this.state.discovered[pl.id] && pl.hidden) continue;
      const d = Math.hypot(pl.x - p.x, pl.z - p.z);
      if (d < pl.r * 0.5 || d > 1600) continue;
      const b = bearing(pl.x, pl.z);
      if (Math.abs(b) > 88) continue;
      compass.push({ bearing: b, icon: this.state.discovered[pl.id] ? '◆' : '◇', name: pl.name, cls: d < 300 ? 'near' : '' });
    }
    if (target?.x !== undefined) {
      const b = Math.max(-88, Math.min(88, bearing(target.x, target.z)));
      compass.push({ bearing: b, icon: '▼', name: `${Math.round(Math.hypot(target.x - p.x, target.z - p.z))}m`, cls: 'quest' });
    }
    this.ui.hud({
      place: this.place?.name || '', clock: this.dayNight.label(), state: this.state, player: this.player, compass,
      tracked: tq ? { title: tq.title, label: target?.label || '', dist: target?.x !== undefined ? `${Math.round(Math.hypot(target.x - p.x, target.z - p.z))}m` : '' } : null,
    });
  }

  soundEnv() {
    const p = this.player.pos;
    let water = 0;
    for (const s of this.water.splashes) {
      const d = Math.hypot(s.x - p.x, s.z - p.z, (s.y - p.y) * 0.5);
      water = Math.max(water, Math.min(1, s.drop / 30) * Math.max(0, 1 - d / 140));
    }
    return {
      water, height: p.y, gliding: this.player.gliding ? 1 : 0, night: look.uNight.value > 0.6,
      town: !!(this.world.flagAt(p.x, p.z) & F_CITY), birds: this.world.forestAt(p.x, p.z) + 0.3,
    };
  }

  // Parchment-style overview map painted from the world data (made once, on first open).
  mapCanvas() {
    if (this._map) return this._map;
    const S = 640, c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(S, S);
    const w = this.world;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const x = -HALF + (i + 0.5) * (HALF * 2 / S), z = -HALF + (j + 0.5) * (HALF * 2 / S);
      const h = w.cellHeight(x, z), wt = w.waterAt(x, z), f = w.flagAt(x, z), fo = w.forestAt(x, z);
      const hx = w.cellHeight(x + 4, z), hz = w.cellHeight(x, z + 4);
      const sh = Math.max(0.6, Math.min(1.25, 1 + (h - hx) * 0.04 + (h - hz) * 0.03));
      let col;
      if (!Number.isNaN(wt)) col = [120, 170, 190];
      else if (f & F_CITY) col = [214, 190, 150];
      else if (h > 66) col = [180, 170, 150];
      else col = [205 - fo * 60, 200 - fo * 30, 150 - fo * 50];
      const k = (j * S + i) * 4;
      img.data[k] = col[0] * sh; img.data[k + 1] = col[1] * sh; img.data[k + 2] = col[2] * sh; img.data[k + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    ctx.strokeStyle = 'rgba(120,80,40,0.5)'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, S - 6, S - 6);
    return (this._map = c);
  }
}

new Game().boot().catch((e) => { console.error(e); });
