// A player ice cream in the arena. Scoop layers are lives: damage melts the top scoop's HP and
// when it runs out the scoop falls off (with its flavor trait). No scoops left = melted down.
import { IceCreamRig } from '../render/icecream.js';
import { computeStats } from './stats.js';
import { makeWeapon } from './weapons.js';
import { WEAPON } from '../../shared/weapons.js';
import { FLAVOR } from '../../shared/flavors.js';
import { clamp, damp, easeInOutCubic, TAU } from '../core/math.js';
import { sfx } from '../core/audio.js';

export const CHAR_SCALE = 0.86;
let nextId = 1;

export class Player {
  constructor({ loadout, levels = {}, name = '나', local = true, id }) {
    this.id = id || 'p' + nextId++;
    this.name = name;
    this.local = local;
    this.loadout = { ...loadout, flavors: [...loadout.flavors] };
    this.levels = levels;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.aim = 0;
    this.toppings = [];
    this.layers = this.loadout.flavors.map((f) => ({ f, hp: null }));
    this.rig = new IceCreamRig({ mold: loadout.mold, flavors: loadout.flavors, face: loadout.face });
    this.weapon = null;
    this.dash = null;
    this.dashCd = 0;
    this.iT = 1.2;
    this.shields = 0;
    this.rechargeT = 0;
    this.reviveUsed = false;
    this.combo = 0; this.comboT = 0;
    this.killStack = 0;
    this.hasteT = 0;
    this.stormCd = 0;
    this.procT = {};
    this.down = false;
    this.kills = 0;
    this.dmgDone = 0;
    this.recompute(true);
  }

  get alive() { return !this.down && this.layers.length > 0; }
  get top() { return this.layers[this.layers.length - 1]; }
  get scaleK() { return CHAR_SCALE * this.stats.size; }
  get r() { return 17 * this.stats.size; }

  recompute(fill = false) {
    const res = computeStats({ mold: this.loadout.mold, layers: this.layers.map((l) => l.f), weapon: this.loadout.weapon, toppings: this.toppings, levels: this.levels });
    const oldMax = this.stats ? this.stats.hp : res.stats.hp;
    this.stats = res.stats;
    this.procs = res.procs;
    this.maxHp = this.stats.hp;
    for (const l of this.layers) {
      if (fill || l.hp == null) l.hp = this.maxHp;
      else l.hp = clamp(l.hp + (this.maxHp - oldMax), 1, this.maxHp);
    }
    if (!this.weapon || this.weapon.def.id !== this.loadout.weapon) {
      this.weapon = makeWeapon(WEAPON[this.loadout.weapon] || WEAPON.spoon, this);
    }
    this.hasProc = (k) => this.procs.some((p) => p.k === k);
  }

  proc(k) { return this.procs.filter((p) => p.k === k); }

  lunge(dx, dy, imp) { this.vx += dx * imp; this.vy += dy * imp; }

  update(dt, A, ctl) {
    const st = this.stats;
    this.rig.update(dt, { vx: this.vx, vy: this.vy, lookX: Math.cos(this.aim) * 0.9, lookY: Math.sin(this.aim) * 0.6, speed: 230 * st.spd });
    if (!this.alive) { this.vx *= 0.9; this.vy *= 0.9; return; }

    this.iT = Math.max(0, this.iT - dt);
    this.dashCd -= dt;
    this.comboT -= dt; if (this.comboT <= 0) this.combo = 0;
    this.hasteT -= dt;
    this.stormCd -= dt;

    if (ctl.aim != null) this.aim = ctl.aim;
    let speed = 230 * st.spd * (this.hasteT > 0 ? 1 + this.hasteBonus : 1);

    if (this.dash) {
      const d = this.dash;
      d.t += dt;
      const k = clamp(d.t / d.dur, 0, 1);
      const prevE = d.e || 0;
      d.e = easeInOutCubic(k);
      const step = (d.e - prevE) * d.dist;
      this.move(A, d.dx * step, d.dy * step);
      this.vx = d.dx * 120; this.vy = d.dy * 120;
      if (Math.random() < 0.7) A.fx.puff(this.x + (Math.random() - 0.5) * 16, this.y, { c: 'rgba(255,255,255,0.7)', r: 7, sp: 20, life: 0.4 });
      for (const p of this.proc('dashHit')) {
        A.queryCircle(this.x, this.y, this.r + 14, (e) => { if (!d.hit.has(e)) { d.hit.add(e); A.hit(this, e, 14 * p.dmg * st.dmg, { kx: d.dx, ky: d.dy, knock: 300, proc: true }); } });
      }
      if (k >= 1) this.endDash(A);
    } else {
      const mv = ctl.move;
      const tx = mv.x * speed, ty = mv.y * speed;
      const f = damp(14, dt);
      this.vx += (tx - this.vx) * f;
      this.vy += (ty - this.vy) * f;
      this.move(A, this.vx * dt, this.vy * dt);
      if (ctl.dash && this.dashCd <= 0) this.startDash(A, mv);
    }

    // regen on the top scoop
    if (st.regen > 0 && this.top) this.top.hp = Math.min(this.maxHp, this.top.hp + st.regen * dt);

    if (this.weapon) this.weapon.update(dt, A, !!ctl.fire && !this.dash, !!ctl.firePressed && !this.dash);
    this.tickProcs(dt, A);
  }

  move(A, dx, dy) {
    const nx = this.x + dx, ny = this.y + dy;
    if (A.walkable(nx, this.y, this.r)) this.x = nx; else this.vx *= -0.2;
    if (A.walkable(this.x, ny, this.r)) this.y = ny; else this.vy *= -0.2;
    A.pushOutOfProps(this);
  }

  startDash(A, mv) {
    let dx = mv.x, dy = mv.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.1) { dx = Math.cos(this.aim); dy = Math.sin(this.aim); } else { dx /= d; dy /= d; }
    this.dash = { t: 0, dur: 0.24, dx, dy, dist: 150 * this.stats.dashDist, hit: new Set() };
    this.dashCd = 1.25 * this.stats.dashCd;
    this.iT = Math.max(this.iT, 0.3);
    this.rig.squash.kick(4);
    sfx.dash();
  }
  endDash(A) {
    this.dash = null;
    this.rig.land(1.2);
    for (const p of this.proc('dashBoom')) A.explode(this, this.x, this.y, p.r, 14 * p.dmg * this.stats.dmg, { color: p.color, knock: 300, proc: true });
    const hs = this.proc('dashHaste');
    if (hs.length) { this.hasteT = Math.max(...hs.map((p) => p.dur)); this.hasteBonus = Math.max(...hs.map((p) => p.spd * p.s)); }
  }

  // Rotation used to draw the roll: one full spin over the dash.
  rollAngle() {
    if (!this.dash) return 0;
    return (this.dash.e || 0) * TAU * Math.sign(this.dash.dx || 1);
  }

  tickProcs(dt, A) {
    const T = this.procT;
    for (const p of this.procs) {
      switch (p.k) {
        case 'chillAura':
          A.queryCircle(this.x, this.y, p.r, (e) => e.applySlow(p.slow * p.s, 0.25));
          break;
        case 'pulse': case 'freezeNova': case 'turret': case 'blackhole': case 'rechargeShield': {
          const key = p.k + (p.every || 0);
          T[key] = (T[key] || 0) + dt;
          if (T[key] < p.every) break;
          T[key] = 0;
          if (p.k === 'pulse') {
            A.fx.ring(this.x, this.y, p.r, p.color, { life: 0.5, w: 8, fill: 'rgba(200,170,255,0.12)' });
            A.queryCircle(this.x, this.y, p.r, (e) => { A.hit(this, e, 10 * p.dmg * p.s * this.stats.dmg, { proc: true, quiet: true }); e.applySlow(p.slow, p.dur); });
          } else if (p.k === 'freezeNova') {
            A.fx.ring(this.x, this.y, p.r, '#dff6ff', { life: 0.5, w: 10, fill: 'rgba(190,235,255,0.25)' });
            A.queryCircle(this.x, this.y, p.r, (e) => { A.hit(this, e, 10 * p.dmg * p.s * this.stats.dmg, { proc: true, quiet: true }); e.freeze(p.dur * p.s); });
            sfx.freeze();
          } else if (p.k === 'turret') {
            const e = A.nearestEnemy(this.x, this.y, 480);
            if (e) {
              const a = Math.atan2(e.y - this.y, e.x - this.x);
              A.addProj(this, { x: this.x, y: this.y - 40, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, r: 7, dmg: 10 * p.dmg * p.s * this.stats.dmg, life: 1.2, pierce: 0, kind: 'turret', color: p.color, proc: true });
            }
          } else if (p.k === 'blackhole') {
            const c = A.densestPoint(this.x, this.y, 420);
            if (c) A.addArea({ k: 'hole', x: c.x, y: c.y, r: p.r, life: p.dur, pull: 420, tick: 0.25, dmg: 10 * p.dmg * p.s * this.stats.dmg, owner: this, proc: true, end: 20 * p.s * this.stats.dmg });
          } else if (p.k === 'rechargeShield') {
            if (this.shields < 1) { this.shields = 1; A.fx.ring(this.x, this.y - 30, 40, '#ffd6f6', { life: 0.4 }); }
          }
          break;
        }
      }
    }
  }

  onWaveStart(A) {
    for (const p of this.proc('waveShield')) this.shields = Math.max(this.shields, p.n);
    if (this.shields) A.fx.ring(this.x, this.y - 30, 44, '#ffd6f6', { life: 0.4 });
  }

  // Returns true if damage was taken.
  hurt(A, amount) {
    if (!this.alive || this.iT > 0 || this.dash) return false;
    const st = this.stats;
    if (Math.random() < st.dodge) {
      A.fx.num(this.x, this.y - 60, 0, false, '#bfefff');
      A.floatText(this.x, this.y - 70, '회피!', '#bfefff');
      this.iT = 0.25;
      this.rig.punch((Math.random() - 0.5) * 2, 0, 1);
      return false;
    }
    if (this.shields > 0) {
      this.shields--;
      this.iT = 0.5;
      A.fx.ring(this.x, this.y - 30, 50, '#ffe6f6', { life: 0.35, w: 8 });
      A.floatText(this.x, this.y - 70, '막음!', '#ffd6f6');
      return false;
    }
    for (const p of this.proc('block')) if (Math.random() < p.chance * p.s) { A.floatText(this.x, this.y - 70, '끈적 방어!', '#ffd28a'); this.iT = 0.3; return false; }

    let dmg = amount * (1 - st.armor);
    this.iT = 0.7 * st.iframe;
    this.rig.hurt();
    A.shake(6);
    sfx.hurt();
    A.fx.burst(this.x, this.y - 30, 8, { c: this.top ? this.top.f && flavorColor(this.top.f) : '#fff', sp: 200, r: 4, vz: 150, grav: 600, life: 0.5 });
    const top = this.top;
    top.hp -= dmg;
    // on-hurt traits
    for (const p of this.proc('hurtSticky')) {
      A.queryCircle(this.x, this.y, p.r, (e) => e.applySlow(p.slow, p.dur));
      if (p.heal) this.heal(p.heal * p.s);
    }
    for (const p of this.proc('thorns')) {
      A.fx.burst(this.x, this.y - 20, 12, { c: '#ffffff', sp: 320, r: 3, life: 0.4 });
      A.queryCircle(this.x, this.y, p.r, (e) => A.hit(this, e, 12 * p.dmg * p.s * st.dmg, { proc: true, kx: e.x - this.x, ky: e.y - this.y, knock: 260 }));
    }
    if (this.stormCd <= 0) for (const p of this.proc('hurtStorm')) {
      this.stormCd = p.cd;
      A.fx.ring(this.x, this.y, p.r, p.color, { life: 0.5, w: 12, fill: 'rgba(255,180,210,0.15)' });
      for (let i = 0; i < 20; i++) A.fx.dot(this.x, this.y - 20, { k: 'star', c: '#ffc8dc', sp: 380, r: 5, life: 0.6 });
      A.queryCircle(this.x, this.y, p.r, (e) => A.hit(this, e, 12 * p.dmg * p.s * st.dmg, { proc: true, kx: e.x - this.x, ky: e.y - this.y, knock: 420 }));
    }
    if (top.hp <= 0) this.loseLayer(A);
    return true;
  }

  loseLayer(A) {
    const f = this.rig.popLayer();
    this.layers.pop();
    A.fx.dropScoop(this.x, this.y, 50, f, Math.random() < 0.5 ? -1 : 1);
    sfx.melt();
    A.shake(10);
    A.hitstop(0.08);
    if (this.layers.length === 0) {
      if (this.hasProc('revive') && !this.reviveUsed) {
        this.reviveUsed = true;
        for (const fl of this.loadout.flavors) { this.layers.push({ f: fl, hp: null }); this.rig.pushLayer(fl); }
        this.recompute();
        this.iT = 2.5;
        A.floatText(this.x, this.y - 90, '원조의 부활!', '#ffd35a');
        A.fx.ring(this.x, this.y - 30, 160, '#ffd35a', { life: 0.8, w: 12, fill: 'rgba(255,220,120,0.2)' });
        sfx.levelup();
        return;
      }
      this.down = true;
      A.onPlayerDown(this);
      return;
    }
    this.recompute();
    this.iT = 1.3 * this.stats.iframe;
    A.floatText(this.x, this.y - 80, '한 층 녹았다!', '#ffb3c7');
  }

  restoreLayer() {
    const missing = this.loadout.flavors[this.layers.length];
    if (!missing) { if (this.top) this.top.hp = this.maxHp; return false; }
    this.layers.push({ f: missing, hp: null });
    this.rig.pushLayer(missing);
    this.recompute();
    return true;
  }

  heal(n) {
    if (!this.top) return;
    this.top.hp = Math.min(this.maxHp, this.top.hp + n);
  }

  draw(g, t) {
    const roll = this.rollAngle();
    const blink = this.iT > 0 && !this.dash && Math.floor(t * 20) % 2 === 0 && this.alive;
    const w = this.weapon;
    const behind = w && w.behind();
    if (w && behind && this.alive) w.draw(g);
    g.save();
    if (roll) {
      g.translate(this.x, this.y - 30 * this.scaleK);
      g.rotate(roll);
      g.translate(-this.x, -(this.y - 30 * this.scaleK));
    }
    this.rig.draw(g, this.x, this.y, this.scaleK, { alpha: this.down ? 0.5 : blink ? 0.55 : 1, shadow: !roll });
    g.restore();
    if (this.shields > 0) {
      g.strokeStyle = 'rgba(255,214,246,0.8)'; g.lineWidth = 3;
      g.beginPath(); g.arc(this.x, this.y - 32, 40 + Math.sin(t * 5) * 2, 0, TAU); g.stroke();
    }
    if (w && !behind && this.alive) w.draw(g);
  }
}

function flavorColor(f) { return (FLAVOR[f] || FLAVOR.milk).c; }
