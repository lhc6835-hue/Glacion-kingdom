// The wave survival scene. Owns the world, the actors, the wave director, the camera and the
// in-canvas HUD. Built so a host can simulate enemies for up to four players (see net/coop.js).
import { ArenaWorld, HALF, shoreDist, drawProp } from '../render/arenaWorld.js';
import { Player } from './player.js';
import { Enemy, NET } from './enemy.js';
import { FX } from './fx.js';
import { drawProjectile } from './weapons.js';
import { ENEMIES, BOSS_ORDER } from '../data/enemies.js';
import { TOPPINGS, TOPPING } from '../data/toppings.js';
import { TAU, clamp, rand, pick, damp, rgba } from '../core/math.js';
import { sfx, music } from '../core/audio.js';
import { scoopSprite } from '../render/scoopArt.js';
import { drawSprite } from '../render/sprite.js';
import { FLAVOR } from '../../shared/flavors.js';

const COST = { heatdrop: 1, ember: 0.5, haze: 1.5, sunling: 2, slime: 2.5, whirl: 2.5, flare: 2, magma: 6 };
const CELL = 96;

export class Arena {
  constructor(app, { loadout, levels, name = '나', coop = null, seed = 7 }) {
    this.app = app;
    this.world = new ArenaWorld(coop && coop.room.seed ? (coop.room.seed % 1000) + 1 : seed);
    this.fx = new FX();
    this.players = [];
    this.me = new Player({ loadout, levels, name, local: true, id: coop ? coop.myId : undefined });
    this.players.push(this.me);
    this.enemies = [];
    this.projs = [];
    this.eprojs = [];
    this.areas = [];
    this.pickups = [];
    this.grid = new Map();
    this.cam = { x: 0, y: 0, zoom: 1 };
    this.shakeAmt = 0;
    this.stopT = 0;
    this.t = 0;
    this.wave = 0;
    this.state = 'intro';
    this.stateT = 0;
    this.coins = 0;
    this.kills = 0;
    this.bossKills = 0;
    this.paused = false;
    this.coop = coop;
    this.authority = !coop || coop.isHost;
    this.over = false;
    this.banner = null;
    this.boss = null;
    this.myPicked = false;
    NET.cc = null;
    if (coop) {
      coop.attach(this);
      if (!this.authority) NET.cc = (e, kind, a, b) => coop.send({ k: 'cc', id: e.id, kind, a, b });
    }
    music('battle');
  }

  // ── queries ───────────────────────────────────────────────
  rebuildGrid() {
    this.grid.clear();
    for (const e of this.enemies) {
      const k = ((e.x / CELL) | 0) + ',' + ((e.y / CELL) | 0);
      let c = this.grid.get(k);
      if (!c) this.grid.set(k, (c = []));
      c.push(e);
    }
  }
  queryCircle(x, y, r, fn) {
    const x0 = Math.floor((x - r - 70) / CELL), x1 = Math.floor((x + r + 70) / CELL);
    const y0 = Math.floor((y - r - 70) / CELL), y1 = Math.floor((y + r + 70) / CELL);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const c = this.grid.get(cx + ',' + cy);
      if (!c) continue;
      for (const e of c) {
        if (e.dead) continue;
        const dx = e.x - x, dy = e.y - y, rr = r + e.r;
        if (dx * dx + dy * dy <= rr * rr) fn(e);
      }
    }
  }
  querySegment(x1, y1, x2, y2, w, fn) {
    const minx = Math.min(x1, x2), maxx = Math.max(x1, x2), miny = Math.min(y1, y2), maxy = Math.max(y1, y2);
    const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1;
    for (const e of this.enemies) {
      if (e.dead || e.x < minx - 80 || e.x > maxx + 80 || e.y < miny - 80 || e.y > maxy + 80) continue;
      const t = clamp(((e.x - x1) * dx + (e.y - y1) * dy) / L2, 0, 1);
      const px = x1 + dx * t, py = y1 + dy * t;
      if ((e.x - px) ** 2 + (e.y - py) ** 2 <= (w + e.r) ** 2) fn(e);
    }
  }
  nearestEnemy(x, y, maxD = 1e9, skip) {
    let best = null, bd = maxD * maxD;
    for (const e of this.enemies) {
      if (e.dead || (skip && skip.has(e))) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  densestPoint(x, y, maxD) {
    let best = null, bn = 0;
    for (const e of this.enemies) {
      if (e.dead || (e.x - x) ** 2 + (e.y - y) ** 2 > maxD * maxD) continue;
      let n = 0;
      this.queryCircle(e.x, e.y, 120, () => n++);
      if (n > bn) { bn = n; best = e; }
    }
    return best;
  }
  targetFor(e) {
    let best = null, bd = Infinity;
    for (const p of this.players) {
      if (!p.alive) continue;
      const d = (p.x - e.x) ** 2 + (p.y - e.y) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  walkable(x, y, r) {
    return shoreDist(x, y) > r + 18;
  }
  keepInside(e) {
    if (shoreDist(e.x, e.y) < e.r + 10) {
      const d = Math.hypot(e.x, e.y) || 1;
      e.x -= (e.x / d) * 6; e.y -= (e.y / d) * 6;
    }
  }
  pushOutOfProps(a) {
    for (const p of this.world.props) {
      const dx = a.x - p.x, dy = (a.y - p.y) * 1.6, rr = p.r + a.r * 0.8;
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr) {
        const d = Math.sqrt(d2) || 1;
        a.x = p.x + (dx / d) * rr;
        a.y = p.y + (dy / d) * rr / 1.6;
      }
    }
  }
  aimPoint(p, minD = 60, maxD = 400) {
    if (p.local && this.mouseWorld && !this.app.input.isTouch) {
      const dx = this.mouseWorld.x - p.x, dy = this.mouseWorld.y - (p.y - 20), d = Math.hypot(dx, dy) || 1;
      const k = clamp(d, minD, maxD) / d;
      return { x: p.x + dx * k, y: p.y + dy * k };
    }
    const tgt = this.nearestEnemy(p.x, p.y, maxD);
    if (tgt && Math.abs(Math.atan2(tgt.y - p.y, tgt.x - p.x) - p.aim) < 0.6) return { x: tgt.x, y: tgt.y };
    const d = (minD + maxD) * 0.55;
    return { x: p.x + Math.cos(p.aim) * d, y: p.y + Math.sin(p.aim) * d };
  }

  // ── spawning ──────────────────────────────────────────────
  spawnEnemy(type, x, y, opts = {}) {
    if (!this.authority) return null;
    if (this.enemies.length > 170 && !ENEMIES[type].boss) return null;
    const n = Math.max(1, this.wave);
    const pc = this.players.length;
    const hpMul = (1 + (n - 1) * 0.22 + Math.pow(Math.max(0, n - 12), 1.6) * 0.04) * (1 + 0.55 * (pc - 1));
    const dmgMul = 1 + (n - 1) * 0.07;
    const e = new Enemy(type, x, y, { hpMul, dmgMul, ...opts });
    this.keepInside(e);
    this.enemies.push(e);
    return e;
  }
  spawnRing(type, opts) {
    const alive = this.players.filter((p) => p.alive);
    const c = alive.length ? pick(alive) : this.me;
    for (let tries = 0; tries < 12; tries++) {
      const a = rand(TAU), d = rand(560, 760);
      const x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d * 0.8;
      if (shoreDist(x, y) > 60) return this.spawnEnemy(type, x, y, opts);
    }
    return null;
  }

  startWave() {
    this.wave++;
    const n = this.wave;
    const boss = n % 5 === 0;
    const pc = this.players.length;
    this.dir = {
      budget: (10 + n * 5 + Math.pow(n, 1.4)) * (boss ? 0.45 : 1) * (1 + 0.6 * (pc - 1)),
      spent: 0, t: 0, every: Math.max(0.35, 1.5 - n * 0.05), done: false,
      pool: Object.keys(COST).filter((k) => ENEMIES[k].from <= n),
    };
    this.state = 'fight';
    this.stateT = 0;
    if (boss) {
      const type = BOSS_ORDER[(n / 5 - 1) % BOSS_ORDER.length];
      const b = this.spawnRing(type);
      if (b) {
        const loops = Math.floor((n / 5 - 1) / BOSS_ORDER.length);
        b.maxHp = b.hp = b.hp * (1 + loops * 0.8);
        this.boss = b;
      }
      this.banner = { text: `보스 등장! ${ENEMIES[type].name}`, sub: `웨이브 ${n}`, t: 0, boss: true };
      sfx.boss();
    } else {
      this.banner = { text: `웨이브 ${n}`, sub: waveSub(n), t: 0 };
      sfx.wave();
    }
    for (const p of this.players) p.onWaveStart(this);
    if (this.coop) this.coop.onWaveStart(n);
  }

  direct(dt) {
    const D = this.dir;
    if (!D || D.done) return;
    D.t += dt;
    if (D.t < D.every) return;
    D.t = 0;
    const group = Math.min(6, 1 + Math.floor(this.wave / 3));
    for (let i = 0; i < group && D.spent < D.budget; i++) {
      const type = weighted(D.pool);
      const elite = this.wave >= 4 && Math.random() < 0.05 + this.wave * 0.002;
      if (this.spawnRing(type, { elite })) D.spent += COST[type] * (elite ? 3 : 1);
      else break;
    }
    if (D.spent >= D.budget) D.done = true;
  }

  // ── combat ────────────────────────────────────────────────
  addProj(owner, p) { p.owner = owner; p.t = 0; p.hit = p.hit || new Set(); p.z = p.z || 0; this.projs.push(p); return p; }
  addEnemyProj(p) { p.t = 0; this.eprojs.push(p); if (this.coop && this.authority) this.coop.emitEnemyProj(p); }
  warn(x, y, r, life) { this.fx.decal({ k: 'warn', x, y, r, life }); if (this.coop && this.authority) this.coop.emitWarn(x, y, r, life); }
  addArea(a) { a.t = 0; a.tickT = 0; this.areas.push(a); }
  shake(a) { this.shakeAmt = Math.min(18, this.shakeAmt + a); }
  hitstop(t) { this.stopT = Math.max(this.stopT, t); }
  floatText(x, y, txt, c, big) { this.fx.text(x, y, txt, c, big); }

  // Main damage entry: crits, bonuses, knockback, on-hit traits, kill handling.
  hit(p, e, base, o = {}) {
    if (e.dead || !p) return 0;
    if (!p.local) return 0; // remote players' weapons only animate here; their client sends the damage
    const st = p.stats;
    let dmg = base;
    const crit = o.crit === true || (o.crit !== false && !o.proc && Math.random() < st.crit);
    if (crit) dmg *= st.critDmg;
    if (e.disabled) for (const q of p.proc('frozenBonus')) dmg *= 1 + q.dmg * q.s;
    if (p.layers.length === 1) for (const q of p.proc('lastStand')) dmg *= 1 + q.dmg * q.s;
    if (p.killStack) dmg *= 1 + p.killStack;
    if (o.falloff) dmg *= o.falloff;
    dmg *= rand(0.92, 1.08);
    e.hp -= dmg;
    if (!this.authority) this.coop.sendHit(e, dmg, o);
    e.flash = 1;
    e.sq.kick(-3.5);
    p.dmgDone += dmg;
    if (o.knock) e.knock(o.kx ?? e.x - p.x, o.ky ?? e.y - p.y, o.knock * st.knock);
    if (o.stun) e.stun(o.stun);
    if (o.slow) e.applySlow(o.slow.amt, o.slow.dur);
    if (st.lifesteal) p.heal(dmg * st.lifesteal);
    if (!o.quiet || crit || Math.random() < 0.35) this.fx.num(e.x, e.y - e.size, dmg, crit);
    if (!o.quiet) { this.fx.burst(e.x, e.y - e.r * 0.4, crit ? 6 : 3, { c: ['#ffffff', '#fff0a6'], sp: 180, r: 2.5, life: 0.25 }); sfx.hit(); }
    if (crit) sfx.crit();

    if (!o.proc) {
      for (const q of p.procs) {
        switch (q.k) {
          case 'hitFreeze': if (Math.random() < q.chance * q.s) { e.freeze(q.dur); sfx.freeze(); } break;
          case 'hitStun': if (Math.random() < q.chance * q.s) e.stun(q.dur); break;
          case 'hitSlow': if (Math.random() < q.chance * q.s) e.applySlow(q.slow, q.dur); break;
          case 'hitChain': if (Math.random() < q.chance * q.s) this.chain(p, e, q.n, dmg * q.dmg, q.color); break;
          case 'critShards': if (crit) this.shards(p, e.x, e.y, q.n, dmg * q.dmg, q.color); break;
          case 'critSlow': if (crit) e.applySlow(q.slow, q.dur); break;
        }
      }
    }
    if (e.hp <= 0 && this.authority) this.kill(p, e);
    return dmg;
  }

  chain(p, e, n, dmg, color) {
    let cur = e;
    const seen = new Set([e]);
    for (let i = 0; i < n; i++) {
      const nx = this.nearestEnemy(cur.x, cur.y, 200, seen);
      if (!nx) break;
      seen.add(nx);
      this.fx.line(cur.x, cur.y - cur.r * 0.4, nx.x, nx.y - nx.r * 0.4, color, { jag: true, w: 4, life: 0.2 });
      this.hit(p, nx, dmg, { proc: true, quiet: true });
      cur = nx;
    }
    sfx.zap();
  }
  shards(p, x, y, n, dmg, color) {
    for (let i = 0; i < n; i++) {
      const a = rand(TAU);
      this.addProj(p, { x, y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, r: 6, dmg, life: 0.5, pierce: 1, kind: 'shard', color, rot: a, proc: true });
    }
  }
  explode(p, x, y, r, dmg, o = {}) {
    this.fx.ring(x, y, r, o.ring || o.color || '#ffffff', { life: 0.35, w: 10, fill: rgba(o.color || '#ffffff', 0.25) });
    if (!o.small) {
      this.fx.burst(x, y, 14, { c: [o.color || '#fff', '#ffffff'], sp: 300, r: 5, life: 0.45 });
      this.fx.puff(x, y, { r: r * 0.4, c: rgba(o.color || '#ffffff', 0.4) });
      this.shake(3);
      sfx.boom();
    } else sfx.pop();
    this.queryCircle(x, y, r, (e) => this.hit(p, e, dmg, { proc: o.proc, kx: e.x - x, ky: e.y - y, knock: o.knock || 200, stun: o.stun, quiet: o.small }));
  }
  enemyExplode(src, x, y, r, dmg, o = {}) {
    if (this.coop && this.authority && !o.remote) this.coop.emitExplode(x, y, r, dmg);
    this.fx.ring(x, y, r, '#ff7a4a', { life: 0.4, w: 12, fill: 'rgba(255,120,70,0.3)' });
    this.fx.burst(x, y, 18, { c: ['#ff7a4a', '#ffd25a', '#5a1f33'], sp: 340, r: 5, life: 0.5 });
    this.fx.decal({ k: 'scorch', x, y, r: r * 0.8, life: 5 });
    this.shake(6);
    sfx.boom();
    for (const p of this.players) if (p.local && p.alive && Math.hypot(p.x - x, p.y - y) < r + p.r) p.hurt(this, dmg, src);
    if (!o.noKill) src.dead = true;
  }

  kill(p, e, net = null) {
    if (e.dead) return;
    e.dead = true;
    this.kills++;
    p.kills++;
    const own = p.local;
    sfx.kill();
    const c = { heatdrop: '#ffb347', ember: '#ff6a3d', haze: '#ffc6e2', sunling: '#ffd84a', slime: '#ff6f8a', magma: '#c85a3a', whirl: '#ffcf9e', flare: '#7a2a40' }[e.art] || '#ffffff';
    this.fx.burst(e.x, e.y - e.r * 0.4, 10, { c: [c, '#ffffff'], sp: 260, r: 4, life: 0.5 });
    for (let i = 0; i < 3; i++) this.fx.puff(e.x + rand(-10, 10), e.y - e.r * 0.4, { c: 'rgba(255,255,255,0.55)', r: e.r * 0.6, vz: 40 });
    this.fx.splat(e.x, e.y, c, e.r * 0.9, 3);
    // coins
    let v = net ? net.coin : e.d.coin * (1 + this.wave * 0.04) * (e.elite ? 4 : 1);
    if (own) for (const q of p.proc('killCoin')) if (Math.random() < q.chance * q.s) v *= 2;
    this.dropCoins(e.x, e.y, v);
    const refill = net ? net.refill : (e.elite && Math.random() < 0.3) || e.d.boss;
    if (refill) this.pickups.push({ k: 'scoop', x: e.x, y: e.y, z: 0, vz: 260, t: 0 });
    if (e.d.split && this.authority) for (let i = 0; i < 2; i++) this.spawnEnemy(e.d.split, e.x + rand(-14, 14), e.y + rand(-14, 14));
    if (e.d.boss) {
      this.bossKills++;
      this.boss = null;
      this.shake(16); this.hitstop(0.2);
      this.floatText(e.x, e.y - 100, '보스 처치!', '#ffd35a', true);
      for (let i = 0; i < 40; i++) this.fx.dot(e.x, e.y - 40, { k: 'star', c: ['#ffe27a', '#ffffff', '#ffb3d1'][i % 3], sp: rand(100, 520), r: rand(4, 9), life: rand(0.6, 1.2) });
    }
    if (this.coop && this.authority) this.coop.onKill(e, p);
    if (!own) return;
    // on-kill traits
    p.combo++; p.comboT = 1.6;
    for (const q of p.procs) {
      switch (q.k) {
        case 'killShards': if (Math.random() < q.chance * q.s) this.shards(p, e.x, e.y, q.n, 14 * q.dmg * p.stats.dmg, q.color); break;
        case 'killBoom': if (Math.random() < q.chance * q.s) this.explode(p, e.x, e.y, q.r, 14 * q.dmg * q.s * p.stats.dmg, { color: q.color, proc: true, small: q.chance >= 1 }); break;
        case 'killHeal': if (Math.random() < (q.chance ?? 1)) p.heal(q.heal * q.s); break;
        case 'killStack': p.killStack = Math.min(q.max * q.s, (p.killStack || 0) + q.per * q.s); break;
        case 'killMeteor': if (Math.random() < q.chance * q.s) { const tx = e.x + rand(-60, 60), ty = e.y + rand(-60, 60); this.fx.decal({ k: 'warn', x: tx, y: ty, r: q.r, life: 0.45 }); this.addProj(p, { x: tx - 120, y: ty, z: 300, vx: 120 / 0.45, vy: 0, vz: -300 / 0.45, grav: 0, r: 0, life: 0.45, pierce: 999, noHit: true, kind: 'raindrop', color: '#fff1a6', dmg: 14 * q.dmg * p.stats.dmg, proc: true, onExpire: (A, pr) => A.explode(p, pr.x, pr.y, q.r, pr.dmg, { color: '#ffe27a', proc: true }) }); } break;
        case 'shatter': if (e.frozen) { this.shards(p, e.x, e.y, 6, 14 * q.dmg * p.stats.dmg, '#bfeaff'); this.fx.ring(e.x, e.y, q.r, '#dff6ff', { life: 0.3 }); } break;
        case 'comboHaste': p.stats.atk = p.stats.atk - (p.comboBonus || 0); p.comboBonus = Math.min(q.max * q.s, p.combo * q.per * q.s); p.stats.atk += p.comboBonus; break;
      }
    }
  }

  dropCoins(x, y, v) {
    let left = v;
    while (left > 0.01) {
      const val = left >= 5 ? 5 : left >= 1 ? 1 : left;
      left -= val;
      const a = rand(TAU), s = rand(40, 140);
      this.pickups.push({ k: 'coin', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, z: 10, vz: rand(160, 260), v: val, t: 0, big: val >= 5 });
      if (this.pickups.length > 400) break;
    }
  }

  onPlayerDown(p) {
    if (p.local) {
      this.floatText(p.x, p.y - 60, '다 녹아버렸어…', '#ffb3c7', true);
      if (!this.coop || this.players.every((q) => !q.alive)) this.endRun();
      else this.app.ui.toast('다 녹았어요! 동료가 웨이브를 끝내면 다시 얼려줘요.');
    }
    if (this.coop) this.coop.onDown(p);
  }

  endRun() {
    if (this.over) return;
    this.over = true;
    this.state = 'over';
    this.stateT = 0;
    music(null);
  }

  result() {
    const waves = Math.max(0, this.state === 'over' ? this.wave - 1 : this.wave);
    return {
      wave: this.wave, cleared: waves, kills: this.me.kills, bossKills: this.bossKills,
      coins: Math.round(this.coins), xp: Math.round(waves * 22 + this.me.kills * 1.2 + this.bossKills * 60),
    };
  }

  // ── update ────────────────────────────────────────────────
  update(dt) {
    if (this.paused) return;
    if (this.stopT > 0) { this.stopT -= dt; dt *= 0.08; }
    this.t += dt;
    this.stateT += dt;
    const input = this.app.input;

    this.updateCamera(dt);
    const ctl = this.readControls(input);
    for (const p of this.players) {
      if (p.local) p.update(dt, this, ctl);
      else if (this.coop) this.coop.updateRemote(p, dt, this);
    }
    if (this.coop) this.coop.tick(dt, this);

    this.rebuildGrid();
    for (const e of this.enemies) e.update(dt, this);
    if (this.authority) this.separate();
    this.enemies = this.enemies.filter((e) => !e.dead);

    this.updateProjs(dt);
    this.updateAreas(dt);
    this.updatePickups(dt);
    this.fx.update(dt);
    if (this.banner) { this.banner.t += dt; if (this.banner.t > 2.4) this.banner = null; }

    this.updateWaves(dt);
  }

  readControls(input) {
    const me = this.me;
    const mv = input.moveVec();
    let aim = me.aim, fire = false;
    const W = innerWidth, H = innerHeight, z = this.cam.zoom;
    this.mouseWorld = { x: (input.mouse.x - W / 2) / z + this.cam.x, y: (input.mouse.y - H / 2) / z + this.cam.y };
    if (input.isTouch) {
      const s = input.aimStick();
      if (s && !s.idle) { aim = Math.atan2(s.y, s.x); fire = true; }
      else {
        const e = this.nearestEnemy(me.x, me.y, 420);
        if (e) aim = Math.atan2(e.y - me.y, e.x - me.x);
        else if (Math.hypot(mv.x, mv.y) > 0.2) aim = Math.atan2(mv.y, mv.x);
      }
    } else {
      aim = Math.atan2(this.mouseWorld.y - (me.y - 20), this.mouseWorld.x - me.x);
      fire = input.firing();
    }
    const busy = (this.state === 'pick' && !this.myPicked && !this.coop) || this.state === 'over' || !this.me.alive;
    if (this.coop) this.coop.setFire(fire && !busy);
    return { move: busy ? { x: 0, y: 0 } : mv, aim, fire: fire && !busy, firePressed: input.pressed('fire') && !busy, dash: input.pressed('dash') && !busy };
  }

  separate() {
    for (const e of this.enemies) {
      this.queryCircle(e.x, e.y, e.r, (o) => {
        if (o === e || o.id < e.id) return;
        const dx = o.x - e.x, dy = o.y - e.y, d = Math.hypot(dx, dy) || 0.01, rr = e.r + o.r;
        if (d < rr) {
          const push = (rr - d) * 0.5;
          const we = e.d.boss ? 0.1 : e.d.heavy ? 0.3 : 1, wo = o.d.boss ? 0.1 : o.d.heavy ? 0.3 : 1;
          const s = we + wo;
          e.x -= (dx / d) * push * (we / s) * 2; e.y -= (dy / d) * push * (we / s) * 2;
          o.x += (dx / d) * push * (wo / s) * 2; o.y += (dy / d) * push * (wo / s) * 2;
        }
      });
    }
  }

  updateProjs(dt) {
    for (const p of this.projs) {
      p.t += dt;
      if (p.drag) { const d = Math.exp(-p.drag * dt); p.vx *= d; p.vy *= d; }
      if (p.boom) {
        const b = p.boom;
        b.t += dt;
        if (b.t > b.out) {
          if (b.leg === 0) { b.leg = 1; p.hit.clear(); }
          const o = b.owner, dx = o.x - p.x, dy = o.y - 30 - p.y, d = Math.hypot(dx, dy) || 1;
          const sp = Math.min(900, 300 + (b.t - b.out) * 1400);
          p.vx += ((dx / d) * sp - p.vx) * Math.min(1, dt * 8);
          p.vy += ((dy / d) * sp - p.vy) * Math.min(1, dt * 8);
          if (d < 26) p.t = p.life;
        } else { const k = Math.exp(-2.2 * dt); p.vx *= k; p.vy *= k; }
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.grav !== undefined || p.vz) { p.z += (p.vz || 0) * dt; if (p.grav) p.vz -= p.grav * dt; }
      if (p.vr) p.rot += p.vr * dt;
      if (p.sq) p.sq.update(dt);
      if (p.trail && Math.random() < 0.5) this.fx.dot(p.x, p.y, { c: '#fff1a6', r: 3, sp: 10, life: 0.25 });

      if (!p.noHit) {
        this.queryCircle(p.x, p.y + 10, p.r, (e) => {
          if (p.t >= p.life || p.hit.has(e)) return;
          if (p.rehit) { const last = p.hitAt && p.hitAt.get(e); if (last != null && p.t - last < p.rehit) return; (p.hitAt || (p.hitAt = new Map())).set(e, p.t); }
          else p.hit.add(e);
          let falloff;
          if (p.falloff) falloff = clamp(1.25 - p.t / p.life, 0.4, 1.2);
          this.hit(p.owner, e, p.dmg, { kx: p.vx, ky: p.vy, knock: p.knock || 90, proc: p.proc, slow: p.slow, falloff, quiet: p.kind === 'cream' });
          if (p.kind === 'jelly' && p.bounces > 0) {
            p.bounces--;
            p.sq && p.sq.kick(-6);
            const nx = this.nearestEnemy(p.x, p.y, 260, p.hit);
            const sp = Math.hypot(p.vx, p.vy);
            if (nx) { const a = Math.atan2(nx.y - p.y, nx.x - p.x); p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; }
            else { p.vx *= -1; p.vy *= -1; }
            if (p.hit.size > 6) p.hit.clear();
            p.t = Math.min(p.t, p.life - 0.8);
            sfx.pop();
          } else if (!p.rehit && p.pierce-- <= 0) p.t = p.life;
          if (p.kind === 'bigscoop') p.t = p.life;
        });
      }
      if (p.kind === 'jelly' && !this.walkable(p.x, p.y, 0)) { p.vx *= -1; p.vy *= -1; p.sq && p.sq.kick(-6); }
      if (p.t >= p.life) { p.dead = true; if (p.onExpire) p.onExpire(this, p); }
    }
    this.projs = this.projs.filter((p) => !p.dead);

    for (const p of this.eprojs) {
      p.t += dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      for (const pl of this.players) {
        if (!pl.local || !pl.alive) continue;
        if ((pl.x - p.x) ** 2 + (pl.y - 28 - p.y) ** 2 < (p.r + pl.r) ** 2) { if (pl.hurt(this, p.dmg)) p.t = p.life; }
      }
      if (p.t >= p.life || !this.walkable(p.x, p.y, -200)) p.dead = true;
    }
    this.eprojs = this.eprojs.filter((p) => !p.dead);
  }

  updateAreas(dt) {
    for (const a of this.areas) {
      a.t += dt;
      a.tickT -= dt;
      if (a.k === 'hole') {
        this.queryCircle(a.x, a.y, a.r, (e) => {
          const dx = a.x - e.x, dy = a.y - e.y, d = Math.hypot(dx, dy) || 1;
          const f = e.d.boss ? 0.15 : e.d.heavy ? 0.4 : 1;
          e.x += (dx / d) * a.pull * f * dt * Math.min(1, d / 40);
          e.y += (dy / d) * a.pull * f * dt * Math.min(1, d / 40);
        });
        if (Math.random() < 0.5) { const ang = rand(TAU); this.fx.dot(a.x + Math.cos(ang) * a.r, a.y + Math.sin(ang) * a.r * 0.6, { c: '#c9a6ff', r: 3, sp: 0, life: 0.3 }); }
      } else if (a.k === 'ice') {
        this.queryCircle(a.x, a.y, a.r, (e) => e.applySlow(a.slow, 0.3));
      }
      if (a.tickT <= 0 && a.dmg) {
        a.tickT = a.tick;
        this.queryCircle(a.x, a.y, a.r, (e) => this.hit(a.owner, e, a.dmg, { proc: true, quiet: true }));
      }
      if (a.t >= a.life) {
        a.dead = true;
        if (a.k === 'hole' && a.end) this.explode(a.owner, a.x, a.y, a.r * 0.8, a.end, { color: '#b48cff', proc: true, knock: 300 });
      }
    }
    this.areas = this.areas.filter((a) => !a.dead);
  }

  updatePickups(dt) {
    const collectAll = this.state === 'clear' || this.state === 'pick' || this.state === 'countdown';
    for (const k of this.pickups) {
      k.t += dt;
      if (k.vz || k.z > 0) {
        k.z += k.vz * dt; k.vz -= 900 * dt;
        if (k.z <= 0) { k.z = 0; k.vz = Math.abs(k.vz) > 120 ? -k.vz * 0.35 : 0; }
      }
      if (k.vx) { k.x += k.vx * dt; k.y += k.vy * dt; const d = Math.exp(-4 * dt); k.vx *= d; k.vy *= d; }
      let best = null, bd = Infinity;
      for (const p of this.players) {
        if (!p.alive || (this.coop && !p.local)) continue;
        const d = Math.hypot(p.x - k.x, p.y - k.y);
        if (d < bd) { bd = d; best = p; }
      }
      if (!best) continue;
      const range = 90 * best.stats.pickup;
      if ((bd < range || collectAll || k.mag) && k.t > 0.35) {
        k.mag = true;
        const sp = 300 + k.t * 500;
        k.x += ((best.x - k.x) / bd) * sp * dt;
        k.y += ((best.y - 20 - k.y) / bd) * sp * dt;
        if (bd < 24) {
          k.dead = true;
          if (k.k === 'coin') {
            if (best.local) { this.coins += k.v * best.stats.coin; sfx.coin(); }
          } else if (k.k === 'scoop') {
            if (best.local) {
              const ok = best.restoreLayer();
              this.floatText(best.x, best.y - 90, ok ? '한 층 리필!' : '체력 가득!', '#ffe3ec', true);
              sfx.levelup();
            }
          }
          this.fx.burst(k.x, k.y - 10, 4, { c: '#fff1a6', sp: 80, r: 2, life: 0.25 });
        }
      }
    }
    this.pickups = this.pickups.filter((k) => !k.dead);
  }

  updateWaves(dt) {
    if (!this.authority) {
      if (this.state === 'clear' && this.stateT > 1.4 && this.pickups.every((k) => k.k !== 'coin')) this.beginPick();
      return;
    }
    switch (this.state) {
      case 'intro':
        if (this.stateT > 1.2) this.startWave();
        break;
      case 'fight':
        this.direct(dt);
        if (this.dir.done && this.enemies.length === 0 && this.stateT > 2) {
          this.state = 'clear';
          this.stateT = 0;
          this.banner = { text: '웨이브 클리어!', sub: '코인을 모으는 중…', t: 0, good: true };
          sfx.levelup();
          for (const p of this.players) if (p.local && !p.alive) this.reviveDowned(p);
          if (this.coop) this.coop.onWaveClear(this.wave);
        }
        break;
      case 'clear':
        if (this.stateT > 1.4 && this.pickups.every((k) => k.k !== 'coin')) this.beginPick();
        break;
      case 'countdown':
        if (this.stateT > 2.2) this.startWave();
        break;
    }
  }

  reviveDowned(p) {
    p.down = false;
    p.restoreLayer();
    p.iT = 2;
    this.floatText(p.x, p.y - 80, '다시 꽁꽁!', '#bfeaff', true);
  }

  beginPick() {
    this.state = 'pick';
    this.stateT = 0;
    const me = this.me;
    const opts = rollToppings(me, 3);
    this.app.ui.toppingPick(opts, me, (id) => {
      this.applyTopping(me, id);
      this.myPicked = true;
      if (this.coop) { this.coop.onPicked(id); if (this.state === 'pick') this.state = this.authority ? 'waitAll' : 'waitHost'; }
      else { this.state = 'countdown'; this.stateT = 0; }
    });
  }
  applyTopping(p, id) {
    const tp = TOPPING[id];
    if (!tp) return;
    if (tp.onTake === 'restoreLayer') p.restoreLayer();
    else p.toppings.push(id);
    p.recompute();
    if (tp.onTake === 'healAll') for (const l of p.layers) l.hp = p.maxHp;
    p.rig.happy();
    this.floatText(p.x, p.y - 90, `${tp.icon} ${tp.name}`, '#fff6c2', true);
  }

  updateCamera(dt) {
    const W = innerWidth, H = innerHeight;
    this.cam.zoom = clamp(Math.max(W, H * 1.25) / 1150, 0.6, 1.5);
    const me = this.me;
    const look = this.app.input.isTouch ? 40 : 70;
    const tx = me.x + Math.cos(me.aim) * look, ty = me.y - 30 + Math.sin(me.aim) * look * 0.7;
    const f = damp(6, dt);
    this.cam.x += (tx - this.cam.x) * f;
    this.cam.y += (ty - this.cam.y) * f;
    this.shakeAmt *= Math.exp(-10 * dt);
  }

  // ── draw ──────────────────────────────────────────────────
  draw(g) {
    const W = innerWidth, H = innerHeight, z = this.cam.zoom;
    const sx = (Math.random() - 0.5) * this.shakeAmt, sy = (Math.random() - 0.5) * this.shakeAmt;
    g.save();
    g.translate(W / 2 + sx, H / 2 + sy);
    g.scale(z, z);
    g.translate(-this.cam.x, -this.cam.y);
    const x0 = this.cam.x - W / 2 / z - 40, x1 = this.cam.x + W / 2 / z + 40, y0 = this.cam.y - H / 2 / z - 40, y1 = this.cam.y + H / 2 / z + 160;
    this.world.drawGround(g, x0, y0, x1, y1, this.t);
    this.fx.drawGround(g);
    for (const a of this.areas) drawArea(g, a, this.t);

    // dash cooldown ring under me
    const me = this.me;
    if (me.alive && me.dashCd > 0) {
      const k = 1 - me.dashCd / (1.25 * me.stats.dashCd);
      g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 3;
      g.beginPath(); g.ellipse(me.x, me.y, 22, 8, 0, -Math.PI / 2, -Math.PI / 2 + k * TAU); g.stroke();
    }

    // pickups on the ground layer
    for (const k of this.pickups) drawPickup(g, k, this.t);

    // y-sorted actors
    const list = [];
    for (const p of this.world.props) if (p.x > x0 - 100 && p.x < x1 + 100 && p.y > y0 - 40 && p.y < y1 + 200) list.push({ y: p.y, d: () => drawProp(g, p, this.t) });
    for (const e of this.enemies) if (e.x > x0 - 80 && e.x < x1 + 80 && e.y > y0 - 80 && e.y < y1 + 80) list.push({ y: e.y, d: () => e.draw(g, this) });
    for (const p of this.players) list.push({ y: p.y, d: () => { p.draw(g, this.t); if (!p.local || this.coop) nameTag(g, p); } });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) it.d();

    for (const p of this.projs) drawProjectile(g, p);
    for (const p of this.eprojs) drawProjectile(g, p);
    this.fx.drawAir(g);
    this.fx.drawNums(g);
    g.restore();

    this.drawTint(g, W, H);
    this.drawHud(g, W, H);
  }

  drawTint(g, W, H) {
    const n = this.wave;
    const cyc = ((Math.max(1, n) - 1) % 8);
    const tints = [null, null, 'rgba(255,230,140,0.07)', 'rgba(255,200,120,0.1)', 'rgba(255,150,130,0.14)', 'rgba(255,120,160,0.17)', 'rgba(70,60,140,0.26)', 'rgba(60,50,130,0.3)'];
    let c = tints[cyc];
    if (n % 5 === 0 && this.state === 'fight') c = 'rgba(255,90,60,0.12)';
    if (c) { g.fillStyle = c; g.fillRect(0, 0, W, H); }
    // soft vignette
    const gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
    gr.addColorStop(0, 'rgba(80,30,60,0)'); gr.addColorStop(1, 'rgba(80,30,60,0.22)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }

  drawHud(g, W, H) {
    const me = this.me;
    g.save();
    const safeTop = 14;
    // scoop lives, top left
    const n = me.loadout.flavors.length;
    for (let i = 0; i < n; i++) {
      const alive = i < me.layers.length;
      const x = 34 + i * 46, y = safeTop + 30;
      g.globalAlpha = alive ? 1 : 0.25;
      g.save(); g.translate(x, y); g.scale(0.62, 0.62); drawSprite(g, scoopSprite(me.loadout.flavors[i])); g.restore();
      g.globalAlpha = 1;
      if (alive) {
        const l = me.layers[i];
        const k = clamp(l.hp / me.maxHp, 0, 1);
        g.fillStyle = 'rgba(60,30,40,0.45)'; g.beginPath(); g.roundRect(x - 17, y + 22, 34, 6, 3); g.fill();
        g.fillStyle = i === me.layers.length - 1 ? '#ff7aa2' : '#ffc2d4'; g.beginPath(); g.roundRect(x - 17, y + 22, 34 * k, 6, 3); g.fill();
      }
    }
    if (me.shields > 0) { g.font = '16px Jua'; g.fillStyle = '#ffd6f6'; g.fillText('🛡️×' + me.shields, 20, safeTop + 74); }

    // wave + enemies, top centre
    g.textAlign = 'center';
    g.font = '22px Jua, sans-serif';
    g.lineWidth = 5; g.strokeStyle = 'rgba(70,30,50,0.55)';
    const label = this.wave ? `웨이브 ${this.wave}` : '준비';
    g.strokeText(label, W / 2, safeTop + 22); g.fillStyle = '#ffffff'; g.fillText(label, W / 2, safeTop + 22);
    if (this.state === 'fight') {
      const left = this.enemies.length + (this.authority ? (this.dir && !this.dir.done ? Math.ceil((this.dir.budget - this.dir.spent) / 1.4) : 0) : this.queued || 0);
      g.font = '15px Jua'; g.fillStyle = 'rgba(255,255,255,0.9)';
      g.strokeText(`남은 적 ${left}`, W / 2, safeTop + 44); g.fillText(`남은 적 ${left}`, W / 2, safeTop + 44);
    }
    // coins, top right (leave room for the pause button)
    g.textAlign = 'right';
    g.font = '20px Jua';
    const ct = `🍬 ${Math.floor(this.coins).toLocaleString()}`;
    g.strokeText(ct, W - 70, safeTop + 24); g.fillStyle = '#fff3b0'; g.fillText(ct, W - 70, safeTop + 24);

    // boss bar
    if (this.boss && !this.boss.dead) {
      const b = this.boss, bw = Math.min(520, W - 60), bx = (W - bw) / 2, by = safeTop + 58;
      g.fillStyle = 'rgba(60,20,30,0.55)'; g.beginPath(); g.roundRect(bx, by, bw, 14, 7); g.fill();
      const gr = g.createLinearGradient(bx, 0, bx + bw, 0); gr.addColorStop(0, '#ffd35a'); gr.addColorStop(1, '#ff6a4a');
      g.fillStyle = gr; g.beginPath(); g.roundRect(bx, by, bw * clamp(b.hp / b.maxHp, 0, 1), 14, 7); g.fill();
      g.textAlign = 'center'; g.font = '14px Jua'; g.fillStyle = '#fff';
      g.fillText(b.d.name, W / 2, by + 30);
    }

    // off-screen enemy arrows near the end of a wave
    if (this.state === 'fight' && this.dir && this.dir.done && this.enemies.length <= 10) {
      const z = this.cam.zoom;
      for (const e of this.enemies) {
        const sx = (e.x - this.cam.x) * z + W / 2, sy = (e.y - this.cam.y) * z + H / 2;
        if (sx > 0 && sx < W && sy > 0 && sy < H) continue;
        const a = Math.atan2(sy - H / 2, sx - W / 2);
        const ex = clamp(sx, 30, W - 30), ey = clamp(sy, 80, H - 30);
        g.save(); g.translate(ex, ey); g.rotate(a);
        g.fillStyle = 'rgba(255,120,110,0.9)';
        g.beginPath(); g.moveTo(12, 0); g.lineTo(-8, -9); g.lineTo(-4, 0); g.lineTo(-8, 9); g.closePath(); g.fill();
        g.restore();
      }
    }

    // banner
    if (this.banner) {
      const b = this.banner;
      const inK = clamp(b.t / 0.35, 0, 1), outK = clamp((b.t - 1.9) / 0.5, 0, 1);
      const s = (0.6 + 0.4 * easeOutBackLocal(inK)) * (1 - outK * 0.3);
      g.globalAlpha = 1 - outK;
      g.textAlign = 'center';
      g.save(); g.translate(W / 2, H * 0.32); g.scale(s, s);
      g.font = '46px Jua, sans-serif';
      g.lineWidth = 9; g.strokeStyle = b.boss ? 'rgba(120,20,30,0.8)' : 'rgba(90,40,70,0.7)';
      g.strokeText(b.text, 0, 0);
      g.fillStyle = b.boss ? '#ffd35a' : b.good ? '#c9ffe4' : '#ffffff';
      g.fillText(b.text, 0, 0);
      if (b.sub) { g.font = '20px Jua'; g.lineWidth = 5; g.strokeText(b.sub, 0, 34); g.fillStyle = '#fff'; g.fillText(b.sub, 0, 34); }
      g.restore();
      g.globalAlpha = 1;
    }
    if (this.state === 'countdown') {
      const c = Math.ceil(2.2 - this.stateT);
      g.textAlign = 'center'; g.font = '40px Jua';
      g.lineWidth = 8; g.strokeStyle = 'rgba(90,40,70,0.7)';
      g.strokeText(`다음 웨이브까지 ${c}`, W / 2, H * 0.3); g.fillStyle = '#fff'; g.fillText(`다음 웨이브까지 ${c}`, W / 2, H * 0.3);
    }
    g.restore();
  }
}

function easeOutBackLocal(t) { const s = 1.7; return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); }

function weighted(pool) {
  let sum = 0;
  for (const k of pool) sum += ENEMIES[k].w;
  let r = Math.random() * sum;
  for (const k of pool) { r -= ENEMIES[k].w; if (r <= 0) return k; }
  return pool[0];
}

function waveSub(n) {
  if (n === 1) return '열기방울이 몰려와요! 녹지 마세요!';
  const intro = Object.entries(ENEMIES).find(([, d]) => d.from === n);
  if (intro) return `새로운 적: ${intro[1].name}`;
  return ['햇살이 뜨거워져요', '조금 더 버텨요!', '달콤하게 버티기', '아직 안 녹았어!'][n % 4];
}

export function rollToppings(p, n) {
  const counts = {};
  for (const t of p.toppings) counts[t] = (counts[t] || 0) + 1;
  const pool = TOPPINGS.filter((t) => (counts[t.id] || 0) < t.max).map((t) => ({ t, w: t.id === 'refill' ? (p.layers.length < p.loadout.flavors.length ? 14 : 0) : t.w }));
  const out = [];
  for (let i = 0; i < n; i++) {
    const tot = pool.reduce((s, x) => s + x.w, 0);
    if (tot <= 0) break;
    let r = Math.random() * tot;
    const idx = pool.findIndex((x) => (r -= x.w) <= 0);
    out.push(pool[idx].t.id);
    pool.splice(idx, 1);
  }
  return out;
}

function drawPickup(g, k, t) {
  const y = k.y - k.z;
  if (k.k === 'coin') {
    g.fillStyle = 'rgba(80,40,60,0.18)'; g.beginPath(); g.ellipse(k.x, k.y, 6, 2.5, 0, 0, TAU); g.fill();
    const s = k.big ? 1.5 : 1, bob = k.z === 0 ? Math.sin(t * 5 + k.x) * 2 : 0;
    g.save(); g.translate(k.x, y - 8 * s + bob); g.scale(s, s); g.rotate(Math.sin(t * 3 + k.y) * 0.3);
    // a little star-shaped sugar candy
    g.fillStyle = k.big ? '#ffd35a' : '#fff0a6';
    g.strokeStyle = '#d99a2a'; g.lineWidth = 1.4;
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU - Math.PI / 2, r = i % 2 ? 3 : 6.5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(-1.5, -2, 1.3, 0, TAU); g.fill();
    g.restore();
  } else {
    const bob = Math.sin(t * 4) * 4;
    g.fillStyle = 'rgba(80,40,60,0.2)'; g.beginPath(); g.ellipse(k.x, k.y, 14, 5, 0, 0, TAU); g.fill();
    g.save(); g.translate(k.x, y - 26 + bob); g.scale(0.7, 0.7);
    const gr = g.createRadialGradient(0, 0, 4, 0, 0, 44); gr.addColorStop(0, 'rgba(255,240,250,0.8)'); gr.addColorStop(1, 'rgba(255,240,250,0)');
    g.fillStyle = gr; g.fillRect(-44, -44, 88, 88);
    drawSprite(g, scoopSprite('strawberry'));
    g.restore();
  }
}

function drawArea(g, a, t) {
  if (a.k === 'hole') {
    const k = clamp(a.t / 0.2, 0, 1) * (1 - clamp((a.t - a.life + 0.2) / 0.2, 0, 1));
    const r = a.r * 0.45 * k;
    const gr = g.createRadialGradient(a.x, a.y - 20, 0, a.x, a.y - 20, a.r * k);
    gr.addColorStop(0, 'rgba(20,10,40,0.95)'); gr.addColorStop(0.35, 'rgba(90,50,170,0.6)'); gr.addColorStop(1, 'rgba(180,140,255,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(a.x, a.y - 20, a.r * k, a.r * 0.7 * k, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(220,200,255,0.7)'; g.lineWidth = 2;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(a.x, a.y - 20, r * (0.6 + i * 0.4), r * 0.4 * (0.6 + i * 0.4), t * (2 + i), 0, 4); g.stroke(); }
  }
}

function nameTag(g, p) {
  g.save();
  g.font = '13px Jua, sans-serif';
  g.textAlign = 'center';
  const y = p.y + p.rig.topY() * p.scaleK - 10;
  const w = g.measureText(p.name).width + 14;
  g.fillStyle = p.local ? 'rgba(255,122,162,0.85)' : 'rgba(90,60,120,0.7)';
  g.beginPath(); g.roundRect(p.x - w / 2, y - 16, w, 18, 9); g.fill();
  g.fillStyle = '#fff'; g.fillText(p.name, p.x, y - 3);
  g.restore();
}

