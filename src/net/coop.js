// Co-op sync for a room of up to four. The host's game owns the enemies and the wave flow;
// every client owns its own ice cream and sends its damage to the host. Remote players are
// replayed from their state (position, aim, trigger), so their weapons animate everywhere.
import { Player } from '../game/player.js';
import { Enemy } from '../game/enemy.js';
import { ENEMIES } from '../data/enemies.js';
import { rand } from '../core/math.js';

const TYPES = Object.keys(ENEMIES);

export class Coop {
  constructor(app, room) {
    this.app = app;
    this.room = room;
    this.myId = room.you;
    this.inbox = [];
    this.picked = new Set();
    this.sendT = 0;
    this.snapT = 0;
    this.handler = (m) => this.inbox.push(m);
    room.handlers.add(this.handler);
  }
  get isHost() { return this.room.host === this.myId; }

  attach(A) {
    this.A = A;
    let i = 0;
    for (const p of this.room.players.values()) {
      if (p.id === this.myId) { A.me.x = (i - 1.5) * 70; continue; }
      const rp = new Player({ loadout: p.look, levels: p.levels || {}, name: p.name, local: false, id: p.id });
      rp.x = (i - 1.5) * 70; rp.tx = rp.x; rp.ty = 0;
      rp.net = { fire: false };
      A.players.push(rp);
      i++;
    }
  }

  send(d) { this.room.send({ t: 'relay', d }); }
  leave() { this.room.handlers.delete(this.handler); this.room.leave(); }

  // ── outbound events ──
  onWaveStart(n) { if (this.isHost) this.send({ k: 'w', w: n, s: 'fight', boss: this.A.boss ? this.A.boss.id : 0 }); this.picked.clear(); }
  onWaveClear(n) { if (this.isHost) this.send({ k: 'w', w: n, s: 'clear' }); }
  onPicked(id) { this.send({ k: 'tp', id }); this.picked.add(this.myId); }
  onDown() { this.send({ k: 'down' }); }
  onKill(e, p) {
    if (!this.isHost) return;
    this.send({ k: 'die', id: e.id, x: Math.round(e.x), y: Math.round(e.y), by: p ? p.id : '', c: e.d.coin * (1 + this.A.wave * 0.04) * (e.elite ? 4 : 1), r: (e.elite && Math.random() < 0.3) || e.d.boss ? 1 : 0, b: e.d.boss ? 1 : 0 });
  }
  sendHit(e, dmg, o) { this.send({ k: 'hit', id: e.id, dmg: Math.round(dmg * 10) / 10, kx: o.kx || 0, ky: o.ky || 0, kn: o.knock || 0, st: o.stun || 0, sl: o.slow ? [o.slow.amt, o.slow.dur] : 0 }); }
  emitEnemyProj(p) { this.send({ k: 'ep', x: Math.round(p.x), y: Math.round(p.y), vx: Math.round(p.vx), vy: Math.round(p.vy), r: p.r, d: Math.round(p.dmg), l: p.life }); }
  emitExplode(x, y, r, dmg) { this.send({ k: 'ex', x: Math.round(x), y: Math.round(y), r, d: Math.round(dmg) }); }
  emitWarn(x, y, r, life) { this.send({ k: 'wn', x: Math.round(x), y: Math.round(y), r, l: life }); }

  // ── per frame ──
  tick(dt, A) {
    for (const m of this.inbox.splice(0)) this.handle(m, A);
    const me = A.me;
    this.sendT -= dt;
    if (this.sendT <= 0) {
      this.sendT = 1 / 15;
      this.send({ k: 'p', x: Math.round(me.x), y: Math.round(me.y), vx: Math.round(me.vx), vy: Math.round(me.vy), a: Math.round(me.aim * 100) / 100, f: this.lastFire ? 1 : 0, n: me.layers.length, dn: me.down ? 1 : 0 });
    }
    if (this.isHost) {
      this.snapT -= dt;
      if (this.snapT <= 0) {
        this.snapT = 0.1;
        this.send({ k: 'e', q: A.dir && !A.dir.done ? Math.ceil((A.dir.budget - A.dir.spent) / 1.4) : 0, l: A.enemies.map((e) => [e.id, TYPES.indexOf(e.type), Math.round(e.x), Math.round(e.y), Math.ceil(e.hp), Math.ceil(e.maxHp), (e.elite ? 1 : 0) | (e.frozen ? 2 : 0) | (e.stunT > 0 ? 4 : 0) | (e.alpha < 0.6 ? 8 : 0), Math.round(e.st.hopZ || 0)]) });
      }
      // once everyone still here has picked a topping, count down to the next wave
      if (A.state === 'pick' || A.state === 'waitAll') {
        const ids = A.players.map((p) => p.id);
        if (A.myPicked && ids.every((id) => id === this.myId || this.picked.has(id))) { A.state = 'countdown'; A.stateT = 0; this.send({ k: 'w', w: A.wave, s: 'countdown' }); }
        else if (A.myPicked) { A.state = 'waitAll'; if (A.stateT > 25) { A.state = 'countdown'; A.stateT = 0; this.send({ k: 'w', w: A.wave, s: 'countdown' }); } }
      }
      if (A.state === 'fight' && A.players.every((p) => !p.alive) && !A.over) { this.send({ k: 'over' }); A.endRun(); }
    }
  }
  setFire(f) { this.lastFire = f; }

  handle(m, A) {
    if (m.t === 'leave') {
      const i = A.players.findIndex((p) => p.id === m.id);
      if (i > 0) { A.floatText(A.players[i].x, A.players[i].y - 80, `${A.players[i].name} 님이 나갔어요`, '#ffffff'); A.players.splice(i, 1); }
      const wasHost = this.isHost;
      this.room.host = m.host;
      if (!wasHost && this.isHost) this.becomeHost(A);
      return;
    }
    if (m.t === 'closed') { if (!A.over) { this.app.ui.toast('방과 연결이 끊어졌어요'); A.endRun(); } return; }
    if (m.t !== 'msg') return;
    const d = m.d, from = A.players.find((p) => p.id === m.from);
    switch (d.k) {
      case 'p':
        if (!from) return;
        from.tx = d.x; from.ty = d.y; from.vx = d.vx; from.vy = d.vy; from.aim = d.a; from.net.fire = !!d.f;
        from.netLayers = d.n; from.down = !!d.dn;
        break;
      case 'tp': if (from) { this.picked.add(from.id); A.applyTopping(from, d.id); } break;
      case 'down': if (from) A.floatText(from.x, from.y - 70, `${from.name} 님이 녹았어요!`, '#ffb3c7'); break;
      case 'hit': {
        if (!this.isHost) return;
        const e = A.enemies.find((x) => x.id === d.id);
        if (!e || e.dead) return;
        e.hp -= d.dmg; e.flash = 1; e.sq.kick(-3.5);
        if (d.kn) e.knock(d.kx, d.ky, d.kn);
        if (d.st) e.stun(d.st);
        if (d.sl) e.applySlow(d.sl[0], d.sl[1]);
        if (from) from.dmgDone += d.dmg;
        if (e.hp <= 0) A.kill(from || A.me, e);
        break;
      }
      case 'cc': {
        if (!this.isHost) return;
        const e = A.enemies.find((x) => x.id === d.id);
        if (!e) return;
        if (d.kind === 'freeze') e.freeze(d.a, true); else if (d.kind === 'stun') e.stun(d.a, true); else e.applySlow(d.a, d.b, true);
        break;
      }
      case 'e': if (!this.isHost) { this.applySnapshot(A, d.l); A.queued = d.q || 0; } break;
      case 'die': {
        if (this.isHost) return;
        const e = A.enemies.find((x) => x.id === d.id);
        const killer = d.by === this.myId ? A.me : A.players.find((p) => p.id === d.by);
        if (e) { e.x = d.x; e.y = d.y; A.kill(killer || A.me, e, { coin: d.c, refill: d.r }); }
        else A.dropCoins(d.x, d.y, d.c);
        break;
      }
      case 'ep': if (!this.isHost) A.eprojs.push({ x: d.x, y: d.y, vx: d.vx, vy: d.vy, r: d.r, dmg: d.d, life: d.l, t: 0, kind: 'orb' }); break;
      case 'ex': if (!this.isHost) A.enemyExplode({ dead: false }, d.x, d.y, d.r, d.d, { noKill: true, remote: true }); break;
      case 'wn': if (!this.isHost) A.fx.decal({ k: 'warn', x: d.x, y: d.y, r: d.r, life: d.l }); break;
      case 'w': if (!this.isHost) this.applyWave(A, d); break;
      case 'over': if (!A.over) A.endRun(); break;
    }
  }

  applySnapshot(A, list) {
    const seen = new Set();
    const byId = new Map(A.enemies.map((e) => [e.id, e]));
    for (const [id, ti, x, y, hp, maxHp, fl, hop] of list) {
      seen.add(id);
      let e = byId.get(id);
      if (!e) {
        const type = TYPES[ti];
        if (!type) continue;
        e = new Enemy(type, x, y, { elite: !!(fl & 1) });
        e.id = id;
        A.enemies.push(e);
        if (e.d.boss) A.boss = e;
      }
      e.net = { x, y };
      e.hp = Math.min(e.hp, hp);
      if (hp > e.hp + 1) e.hp = hp; // healed or corrected
      e.maxHp = maxHp;
      e.freezeT = fl & 2 ? Math.max(e.freezeT, 0.15) : 0;
      e.stunT = fl & 4 ? Math.max(e.stunT, 0.15) : 0;
      e.alpha = fl & 8 ? 0.35 : 0.95;
      e.st.hopZ = hop;
    }
    for (const e of A.enemies) if (!seen.has(e.id) && e.spawnT <= 0) e.dead = true;
  }

  applyWave(A, d) {
    if (d.s === 'fight' && d.w !== A.wave) {
      A.wave = d.w;
      A.state = 'fight'; A.stateT = 0;
      A.dir = { done: false, budget: 0, spent: 0 };
      const boss = d.w % 5 === 0;
      A.banner = { text: boss ? '보스 등장!' : `웨이브 ${d.w}`, sub: boss ? `웨이브 ${d.w}` : '함께 버텨요!', t: 0, boss };
      A.me.onWaveStart(A);
      this.picked.clear();
      A.myPicked = false;
    } else if (d.s === 'clear') {
      A.state = 'clear'; A.stateT = 0;
      A.banner = { text: '웨이브 클리어!', sub: '토핑을 골라요', t: 0, good: true };
      if (!A.me.alive) A.reviveDowned(A.me);
      for (const p of A.players) if (!p.local) p.down = false;
    } else if (d.s === 'countdown') {
      if (A.state === 'pick') { /* still choosing: the host moved on; the pick still applies */ }
      A.state = 'countdown'; A.stateT = 0;
    }
  }

  becomeHost(A) {
    A.authority = true;
    A.dir = { done: true, budget: 0, spent: 0, t: 0, every: 1, pool: [] };
    for (const e of A.enemies) { e.net = null; }
    this.app.ui.toast('방장이 나가서 내가 방장이 되었어요!');
  }

  updateRemote(p, dt, A) {
    p.iT = 0;
    p.x += ((p.tx ?? p.x) - p.x) * Math.min(1, dt * 12);
    p.y += ((p.ty ?? p.y) - p.y) * Math.min(1, dt * 12);
    // follow their scoop count with the same fall-off animation
    while (p.netLayers != null && p.layers.length > Math.max(0, p.netLayers)) {
      const f = p.rig.popLayer(); p.layers.pop();
      A.fx.dropScoop(p.x, p.y, 50, f, rand() < 0.5 ? -1 : 1);
    }
    while (p.netLayers != null && p.layers.length < p.netLayers && p.layers.length < p.loadout.flavors.length) {
      const f = p.loadout.flavors[p.layers.length];
      p.layers.push({ f, hp: null }); p.rig.pushLayer(f);
    }
    p.rig.update(dt, { vx: p.vx, vy: p.vy, lookX: Math.cos(p.aim) * 0.9, lookY: Math.sin(p.aim) * 0.6, speed: 230 * p.stats.spd });
    if (p.weapon && p.alive) p.weapon.update(dt, A, p.net.fire, false);
  }
}
