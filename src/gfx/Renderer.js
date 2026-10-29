// Draws the valley: sky → parallax strips with haze between them → world → grade → light layer.
import { buildStrips, STRIP_W } from '../art/background.js';
import { buildGround, buildTufts } from '../art/ground.js';
import { buildTree } from '../art/trees.js';
import { drawHero, drawAxe } from '../art/hero.js';
import * as Props from '../art/props.js';
import { buildGlows } from './Glow.js';
import { makeCanvas } from './PixBuf.js';
import { PAL } from '../art/palette.js';
import { WORLD, groundY, STATIONS, CREEK } from '../game/World.js';
import { TREES } from '../data/trees.js';
import { AXE_BY_ID } from '../data/axes.js';
import { GRADES } from '../data/grades.js';
import { hash2 } from '../core/Rng.js';

const easeIn = (t) => t * t;
const STAR_N = 90;

export class Renderer {
  constructor(engine) {
    this.e = engine;
    this.strips = buildStrips();
    this.ground = buildGround();
    this.tufts = buildTufts();
    this.glows = buildGlows();
    this.treeArt = new Map();
    this.props = {
      tent: Props.tent(), traderFrames: [Props.trader(0), Props.trader(1)], altar: Props.altar(), board: Props.guildBoard(),
      millBroken: Props.sawmill(true), mill: Props.sawmill(false), elder: Props.elderTree(), gate: Props.gate(),
      lantern: Props.lantern(), logPile: Props.logPile(),
    };
    this.station = Object.fromEntries(STATIONS.map((s) => [s.id, s]));
    // set dressing: rocks and mushrooms scattered on the bank
    this.decor = [];
    for (let i = 0; i < 70; i++) {
      const x = 80 + hash2(i, 0, 91) * (WORLD.width - 160);
      if (STATIONS.some((s) => Math.abs(s.x - x) < 40)) continue;
      const isRock = hash2(i, 1, 91) < 0.55;
      this.decor.push({ x: Math.round(x), art: isRock ? Props.rock(i + 3) : Props.mushroom(i), back: hash2(i, 2, 91) < 0.6 });
    }
    this.lanterns = [128, 262, 520, 702, 1140, 1500, 1800, 2235];
    this.stars = [];
    for (let i = 0; i < STAR_N; i++) this.stars.push({ x: hash2(i, 0, 5), y: hash2(i, 1, 5) * 0.7, p: hash2(i, 2, 5) * 6.28, b: hash2(i, 3, 5) });
    this.motes = [];
    for (let i = 0; i < 80; i++) this.motes.push({ u: Math.random(), v: Math.random(), s: 0.3 + Math.random() * 0.7, p: Math.random() * 6.28 });
    this.flashes = [];
    this.trails = [];
    this.wind = 1;
    this.quality = 'high';
    this.lastCamX = 0;
    this.skyStrip = makeCanvas(1, 22);
  }

  art(tree) {
    const key = tree.species + ':' + tree.seed;
    let a = this.treeArt.get(key);
    if (!a) { a = buildTree(tree.species, tree.seed); this.treeArt.set(key, a); }
    return a;
  }

  flash(x, y, size, color, life = 0.12) { this.flashes.push({ x, y, size, color, t: 0, life }); }
  trail(x, y, from, to, color) { this.trails.push({ x, y, from, to, color, t: 0 }); }

  // Parallax strip draw, tiled horizontally. bottom: screen y of the strip's bottom at the default camera.
  strip(g, s, camX, camY0, camY, bottom, fx = s.f) {
    const ox = -((camX * fx) % STRIP_W + STRIP_W) % STRIP_W;
    const y = Math.round(bottom - s.H + (camY0 - camY) * fx);
    for (let x = Math.round(ox); x < this.e.W; x += STRIP_W) g.drawImage(s.c, x, y);
    return y;
  }

  haze(g, color, a) { if (a <= 0) return; g.globalAlpha = a; g.fillStyle = color; g.fillRect(0, 0, this.e.W, this.e.H); g.globalAlpha = 1; }

  draw(f) {
    const { e } = this;
    const g = e.pg, W = e.W, H = e.H, t = f.time;
    const cam = f.cam, d = f.day.cur;
    const camX = Math.round(cam.x + cam.shakeX), camY = Math.round(cam.y + cam.shakeY);
    const camY0 = f.camY0;
    const gs0 = H - 46;
    this.wind = 0.7 + 0.3 * Math.sin(t * 0.37) + 0.15 * Math.sin(t * 1.3);

    // ── sky ──
    const horizon = Math.round(gs0 - 70 + (camY0 - camY) * 0.03);
    this.sky(g, d, horizon, t, W);
    // ── distant layers, each followed by a haze pass so depth reads through colour ──
    this.strip(g, this.strips.peaks, camX, camY0, camY, gs0 - 66);
    this.haze(g, d.haze, 0.35);
    const cliffY = this.strip(g, this.strips.cliffs, camX, camY0, camY, gs0 - 36);
    this.waterfalls(g, camX, cliffY, t);
    this.haze(g, d.haze, 0.32);
    this.strip(g, this.strips.far, camX, camY0, camY, gs0 - 26);
    this.haze(g, d.haze, 0.3);
    this.strip(g, this.strips.mid, camX, camY0, camY, gs0 - 10);
    this.haze(g, d.haze, 0.16);
    this.strip(g, this.strips.near, camX, camY0, camY, gs0 - 6);
    this.haze(g, d.haze, 0.05);

    // ── world ──
    const vis = (x, m = 120) => x > camX - m && x < camX + W + m;
    g.drawImage(this.ground.c, -camX, this.ground.top - camY);
    this.creek(g, camX, camY, t);
    this.backProps(g, f, camX, camY, vis, t);
    for (const dct of this.decor) if (dct.back && vis(dct.x, 20)) g.drawImage(dct.art.c, dct.x - dct.art.ax - camX, groundY(dct.x) - dct.art.ay - camY + 1);
    for (const tr of f.trees.list) if (vis(tr.x)) this.tree(g, tr, camX, camY, t, f);
    f.ambient.drawBack(g, camX, camY, t);
    this.hero(g, f, camX, camY);
    f.particles.draw(g, camX, camY);
    this.frontTufts(g, f, camX, camY, t);
    for (const dct of this.decor) if (!dct.back && vis(dct.x, 20)) g.drawImage(dct.art.c, dct.x - dct.art.ax - camX, groundY(dct.x) - dct.art.ay - camY + 3);
    f.ambient.drawFront(g, camX, camY, t, d);
    this.motesDraw(g, f, camX, camY, t);
    // canopy ceiling and nearest foreground
    const canopyTop = this.strip(g, this.strips.canopy, camX, 0, 0, this.strips.canopy.H - 14 + Math.round((camY0 - camY) * 0.6));
    if (canopyTop > 0) { g.fillStyle = '#0e221c'; g.fillRect(0, 0, W, canopyTop); }
    const fgx = camX * 1.15;
    this.stripScreen(g, this.strips.fg.bot, fgx, H - this.strips.fg.bot.H + Math.round((camY0 - camY) * 1.15) + 6);
    this.stripScreen(g, this.strips.fg.top, fgx + 300, -6 + Math.round((camY0 - camY) * 1.15) - 26);
    if (f.cineLeaves) f.cineLeaves(g);

    // ── grade: cool shade over everything, deeper at night ──
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = d.grade;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
    this.light(f, camX, camY, horizon, t);
  }

  stripScreen(g, s, x, y) {
    const ox = -((x % STRIP_W) + STRIP_W) % STRIP_W;
    for (let xx = Math.round(ox); xx < this.e.W; xx += STRIP_W) g.drawImage(s.c, xx, Math.round(y));
  }

  sky(g, d, horizon, t, W) {
    // banded vertical gradient: rendered into a 1×N strip, then stretched with nearest-neighbour
    const top = Math.min(0, horizon - 200);
    const sg = this.skyStrip.getContext('2d');
    const grd = sg.createLinearGradient(0, 0, 0, 22);
    grd.addColorStop(0, d.top); grd.addColorStop(0.6, d.mid); grd.addColorStop(1, d.hor);
    sg.fillStyle = grd;
    sg.fillRect(0, 0, 1, 22);
    g.drawImage(this.skyStrip, 0, top, W, horizon - top);
    g.fillStyle = d.hor;
    g.fillRect(0, horizon, W, this.e.H - horizon);
    // stars
    if (d.night > 0.05) {
      for (const s of this.stars) {
        const tw = 0.5 + 0.5 * Math.sin(t * 2 + s.p);
        if (tw * s.b * d.night < 0.25) continue;
        g.fillStyle = s.b > 0.85 ? '#ffffff' : '#c8d8f0';
        g.fillRect(Math.round(s.x * W), Math.round(s.y * (horizon - 10)), 1, 1);
      }
    }
    // sun or moon disc (pixel circle)
    const sx = Math.round(W * (0.08 + d.sunX * 0.84)), sy = Math.round(horizon - 14 - d.sunH * (horizon - 40));
    const r = d.isDay ? 7 : 5;
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r) continue;
      g.fillStyle = d.isDay ? (x * x + y * y > (r - 1.5) * (r - 1.5) ? '#ffe8a8' : '#fff8e0') : (x + 2) * (x + 2) + (y - 1) * (y - 1) < 12 ? '#9aa8c0' : '#e8eef8';
      g.fillRect(sx + x, sy + y, 1, 1);
    }
    this.sunScreen = { x: sx, y: sy };
    // drifting clouds
    for (let i = 0; i < this.strips.clouds.length; i++) {
      const c = this.strips.clouds[i];
      const span = W + 200;
      const x = Math.round(((i * 337 + t * (1.2 + i * 0.35) - this.lastCamX * 0.05) % span + span) % span - 100);
      const y = Math.round(18 + i * 13 + (i % 2) * 8);
      g.globalAlpha = 0.85 - d.night * 0.55;
      g.drawImage(c, x, y);
    }
    g.globalAlpha = 1;
  }

  waterfalls(g, camX, cliffY, t) {
    const s = this.strips.cliffs;
    const ox = -((camX * s.f) % STRIP_W + STRIP_W) % STRIP_W;
    g.fillStyle = '#f4fffa';
    for (const fx of s.falls) for (let rep = Math.round(ox); rep < this.e.W; rep += STRIP_W) {
      const x = rep + fx;
      if (x < -4 || x > this.e.W + 4) continue;
      for (let k = 0; k < 10; k++) {
        const y = cliffY + 20 + ((t * 38 + k * 17 + (k % 3) * 5) % (s.H - 20));
        g.fillRect(x - 2 + (k % 4), Math.round(y), 1, 3);
      }
    }
  }

  creek(g, camX, camY, t) {
    for (const [a, b] of CREEK) {
      if (b < camX || a > camX + this.e.W) continue;
      for (let x = Math.max(a, camX); x < Math.min(b, camX + this.e.W); x += 1) {
        const h = hash2(x, Math.floor(t * 3 + x * 0.05), 7);
        if (h > 0.08) continue;
        const sy = groundY(x) - camY - 9 + Math.floor(hash2(x, 3, 3) * 6);
        g.fillStyle = h < 0.03 ? '#e8fff8' : '#9ad8d0';
        g.fillRect(x - camX, sy, 2 + (h < 0.02 ? 1 : 0), 1);
      }
    }
  }

  propAt(g, art, x, camX, camY, sink = 1) {
    g.drawImage(art.c, Math.round(x - art.ax - camX), Math.round(groundY(x) - art.ay - camY + sink));
  }

  backProps(g, f, camX, camY, vis, t) {
    const P = this.props, st = this.station;
    if (vis(st.elder.x, 120)) this.propAt(g, P.elder, st.elder.x, camX, camY, 3);
    if (vis(st.gate.x, 80)) this.propAt(g, P.gate, st.gate.x, camX, camY, 2);
    if (vis(st.sawmill.x, 100)) {
      const broken = f.sawmillLevel === 0;
      const m = broken ? P.millBroken : P.mill;
      this.propAt(g, m, st.sawmill.x, camX, camY, 2);
      const wx = st.sawmill.x + m.wheel.x - camX, wy = groundY(st.sawmill.x) + m.wheel.y - camY + 2;
      this.wheelAngle = (this.wheelAngle || 0) + (broken ? 0 : f.dt * (f.millBusy ? 1.6 : 0.5));
      Props.drawWheel(g, wx, wy, m.wheel.r, this.wheelAngle, broken);
    }
    if (vis(st.trader.x, 60)) {
      this.propAt(g, P.tent, st.trader.x, camX, camY, 2);
      const fr = P.traderFrames[Math.floor(t * 1.5) % 2];
      g.drawImage(fr, Math.round(st.trader.x + 26 - camX), Math.round(groundY(st.trader.x + 30) - 25 - camY));
      // campfire
      const fx = st.trader.x - 44, fy = groundY(fx) - camY;
      this.fire(g, fx - camX, fy, t);
      this.propAt(g, P.logPile, st.trader.x - 70, camX, camY, 1);
    }
    if (vis(st.altar.x, 40)) {
      this.propAt(g, P.altar, st.altar.x, camX, camY, 2);
      // the altar's floating axe glyph
      const ay = groundY(st.altar.x) + P.altar.focus.y - camY + Math.round(Math.sin(t * 2) * 2);
      drawAxe(g, st.altar.x - camX - 2, ay + 4, 0.55 + Math.sin(t * 0.8) * 0.15, { blade: '#bff8e8', accent: '#4a7a6a' }, 0.9);
    }
    if (vis(st.guild.x, 40)) this.propAt(g, P.board, st.guild.x, camX, camY, 2);
    for (const lx of this.lanterns) if (vis(lx, 10)) this.propAt(g, P.lantern, lx, camX, camY, 2);
  }

  fire(g, x, y, t) {
    x = Math.round(x); y = Math.round(y);
    g.fillStyle = PAL.wood[1]; g.fillRect(x - 5, y - 2, 10, 2);
    g.fillStyle = PAL.wood[3]; g.fillRect(x - 4, y - 3, 8, 1);
    g.fillStyle = PAL.stone[3]; for (const sx of [-7, -5, 4, 6]) g.fillRect(x + sx, y - 1, 2, 2);
    for (let i = 0; i < 9; i++) {
      const h = 3 + Math.floor(hash2(i, Math.floor(t * 12), 4) * 6);
      const fx = x - 4 + i;
      g.fillStyle = '#ff7a2a'; g.fillRect(fx, y - 3 - h, 1, h);
      g.fillStyle = '#ffd04a'; g.fillRect(fx, y - 3 - Math.floor(h * 0.6), 1, Math.floor(h * 0.6));
    }
    g.fillStyle = '#fff4c0'; g.fillRect(x - 1, y - 5, 2, 2);
  }

  tree(g, tr, camX, camY, t, f) {
    const by = groundY(tr.x) - camY + 2;
    const bx = Math.round(tr.x - camX);
    const a = this.art(tr);
    if (tr.state === 'stump' || (tr.state === 'growing' && tr.grow < 0.65)) {
      g.drawImage(a.stump.c, bx - Math.floor(a.stump.W / 2), by - a.stump.H + 1);
      if (tr.state === 'growing') this.sprout(g, bx + 6, by - 1, tr.grow / 0.65);
      return;
    }
    if (tr.state === 'falling') {
      const ft = f.trees.fallTime(tr);
      const el = f.now - tr.felledAt;
      const u = Math.min(1, el / ft);
      const ang = easeIn(u) * (Math.PI / 2 - 0.08) * tr.fallDir;
      const fade = el > ft ? Math.max(0, 1 - (el - ft) / 1.2) : 1;
      g.drawImage(a.stump.c, bx - Math.floor(a.stump.W / 2), by - a.stump.H + 1);
      if (fade <= 0) return;
      g.save();
      g.globalAlpha = fade;
      g.translate(bx, by - 3);
      g.rotate(ang);
      g.drawImage(a.trunk, -a.ax, -a.ay + 3);
      for (const p of a.pieces) g.drawImage(p.c, -a.ax, -a.ay + 3);
      g.restore();
      return;
    }
    const sink = tr.state === 'growing' ? Math.round((1 - (tr.grow - 0.65) / 0.35) * a.H * 0.5) : 0;
    const shake = tr.shake > 0 ? Math.round(Math.sin(t * 70) * tr.shake * 2) : 0;
    const x0 = bx - a.ax, y0 = by - a.ay + sink;
    if (sink) { g.save(); g.beginPath(); g.rect(x0 - 10, y0 - 10, a.W + 20, by - y0 + 10); g.clip(); }
    g.drawImage(a.trunk, x0 + (shake ? Math.sign(shake) : 0), y0);
    for (let i = 0; i < a.pieces.length; i++) {
      const p = a.pieces[i];
      const sway = Math.round(Math.sin(t * (0.9 + i * 0.17) + p.phase) * p.amp * this.wind);
      g.drawImage(p.c, x0 + sway + shake, y0);
    }
    if (sink) g.restore();
    // status overlays
    if (tr.frost && tr.frost.until > f.now) {
      g.fillStyle = '#c8f4ff';
      for (let i = 0; i < 12; i++) g.fillRect(bx - 4 + Math.floor(hash2(i, tr.uid, 1) * 9), by - 6 - Math.floor(hash2(i, tr.uid, 2) * 30), 1, 2);
    }
    if (a.sparkles.length && f.day.isDay) {
      g.fillStyle = '#ffffff';
      for (const s of a.sparkles) if (Math.sin(t * 2.4 + s.p) > 0.92) g.fillRect(x0 + s.x, y0 + s.y, 1, 1);
    }
    // HP bar above the engaged or recently hit tree
    if (tr === f.combat.target || f.now - tr.lastHitAt < 2.5) this.hpBar(this.e.ug, tr, bx, y0 + 8);
  }

  sprout(g, x, y, u) {
    const h = Math.max(1, Math.round(u * 12));
    g.fillStyle = PAL.grass[3];
    g.fillRect(x, y - h, 1, h);
    if (h > 3) { g.fillStyle = PAL.grass[4]; g.fillRect(x - 2, y - h + 1, 2, 1); g.fillRect(x + 1, y - h, 2, 1); }
    if (h > 7) { g.fillStyle = PAL.grass[5]; g.fillRect(x - 3, y - h + 4, 3, 1); g.fillRect(x + 1, y - h + 3, 3, 1); }
  }

  hpBar(ug, tr, cx, y) {
    const w = 34, x = Math.round(cx - w / 2);
    y = Math.max(4, Math.round(y));
    ug.fillStyle = PAL.ink; ug.fillRect(x - 1, y - 1, w + 2, 5);
    ug.fillStyle = '#2a1a16'; ug.fillRect(x, y, w, 3);
    const fw = Math.ceil((tr.hp / tr.maxHp) * w);
    ug.fillStyle = tr.burn ? '#ff8a3a' : tr.poison.length ? '#9fd46a' : '#e8604a'; ug.fillRect(x, y, fw, 3);
    ug.fillStyle = '#ffffff'; ug.globalAlpha = 0.35; ug.fillRect(x, y, fw, 1); ug.globalAlpha = 1;
    for (let i = 1; i < 4; i++) { ug.fillStyle = PAL.ink; ug.fillRect(x + Math.round((w * i) / 4), y, 1, 3); }
  }

  hero(g, f, camX, camY) {
    const p = f.player;
    const axe = AXE_BY_ID[f.equipped];
    drawHero(g, p.x - camX, p.y - camY, p.facing, p.pose, axe);
    if (p.surpriseT > 0) { g.fillStyle = '#fff4c0'; g.fillRect(Math.round(p.x - camX), Math.round(p.y - camY) - 28, 2, 5); g.fillRect(Math.round(p.x - camX), Math.round(p.y - camY) - 21, 2, 2); }
  }

  frontTufts(g, f, camX, camY, t) {
    const px = f.player.x;
    for (const tf of this.tufts) {
      if (tf.x < camX - 2 || tf.x > camX + this.e.W + 2) continue;
      const near = Math.abs(tf.x - px) < 7 ? Math.sign(tf.x - px || 1) * 2 : 0;
      tf.lean += (near - tf.lean) * Math.min(1, f.dt * 10);
      const sway = Math.sin(t * 2.2 + tf.phase) * 0.9 * this.wind + tf.lean;
      const x = tf.x - camX, y = groundY(tf.x) - camY + 4;
      for (let k = 0; k < tf.h; k++) {
        g.fillStyle = k === tf.h - 1 ? PAL.grass[tf.tone] : PAL.grass[3];
        g.fillRect(Math.round(x + (sway * k) / tf.h), y - k, 1, 1);
      }
    }
  }

  motesDraw(g, f, camX, camY, t) {
    const d = f.day.cur;
    if (d.rays < 0.3 || this.quality === 'low') return;
    const shafts = this.shafts || [];
    if (!shafts.length) return;
    g.fillStyle = d.isDay ? '#fff6d0' : '#d8e8ff';
    for (let i = 0; i < this.motes.length; i++) {
      const m = this.motes[i];
      const s = shafts[i % shafts.length];
      const v = (m.v + t * 0.015 * m.s) % 1;
      const y = s.y0 + v * (s.y1 - s.y0);
      const x = s.x0 + (s.x1 - s.x0) * v + (m.u - 0.5) * s.w * (0.6 + v) + Math.sin(t * m.s + m.p) * 3;
      if (Math.sin(t * 1.5 + m.p) > 0.2) g.fillRect(Math.round(x / 2), Math.round(y / 2), 1, 1);
    }
  }

  // ── soft light canvas (2× resolution, screen-blended) ──
  light(f, camX, camY, horizon, t) {
    const lg = this.e.lg, W = this.e.W * 2, H = this.e.H * 2, d = f.day.cur, G = this.glows;
    lg.setTransform(1, 0, 0, 1, 0, 0);
    lg.globalCompositeOperation = 'source-over';
    lg.clearRect(0, 0, W, H);
    lg.globalCompositeOperation = 'lighter';
    const q = this.quality;
    const night = d.night;
    // sun glow over the horizon
    if (this.sunScreen) { lg.globalAlpha = d.isDay ? 0.55 : 0.3; const s = d.isDay ? 170 : 110; lg.drawImage(d.isDay ? G.gold : G.moon, this.sunScreen.x * 2 - s, this.sunScreen.y * 2 - s, s * 2, s * 2); }
    // light shafts through the canopy gaps
    this.shafts = [];
    const canopy = this.strips.canopy;
    const ox = -((camX * canopy.f) % STRIP_W + STRIP_W) % STRIP_W;
    const gTop = (canopy.H - 14 + Math.round((f.camY0 - camY) * 0.6) - 50) * 2;
    const ground = (groundY(camX + this.e.W / 2) - camY) * 2;
    const slant = d.slant;
    const rayA = d.rays * (q === 'low' ? 0.5 : 1) * (f.rayBoost || 1);
    for (let rep = Math.round(ox) - STRIP_W; rep < this.e.W + STRIP_W; rep += STRIP_W) {
      for (let i = 0; i < canopy.gaps.length; i++) {
        const gx = (rep + canopy.gaps[i]) * 2;
        const len = ground - gTop;
        const x1 = gx + slant * len;
        if (Math.max(gx, x1) < -200 || Math.min(gx, x1) > W + 200) continue;
        const w0 = 14 + (i % 3) * 8, w1 = w0 * 2.6;
        this.shafts.push({ x0: gx, y0: gTop, x1, y1: ground, w: w0 });
        const flick = 0.75 + 0.25 * Math.sin(t * 0.6 + i * 1.7) * Math.sin(t * 0.23 + i);
        const segs = q === 'high' ? 3 : 1;
        for (let sgi = 0; sgi < segs; sgi++) {
          const off = (sgi - (segs - 1) / 2) * w0 * 0.55;
          const a = rayA * flick * (segs > 1 ? 0.5 + 0.5 * Math.sin(t * (0.9 + sgi * 0.4) + i * 3 + sgi) : 1) * 0.13;
          if (a <= 0.005) continue;
          const grd = lg.createLinearGradient(0, gTop, 0, ground);
          grd.addColorStop(0, 'rgba(0,0,0,0)');
          grd.addColorStop(0.12, d.key.replace('rgb', 'rgba').replace(')', `,${a})`));
          grd.addColorStop(0.7, d.key.replace('rgb', 'rgba').replace(')', `,${a * 0.6})`));
          grd.addColorStop(1, 'rgba(0,0,0,0)');
          lg.fillStyle = grd;
          const ww0 = w0 / segs * 1.4, ww1 = w1 / segs * 1.4;
          lg.beginPath();
          lg.moveTo(gx + off - ww0 / 2, gTop); lg.lineTo(gx + off + ww0 / 2, gTop);
          lg.lineTo(x1 + off * 2.6 + ww1 / 2, ground); lg.lineTo(x1 + off * 2.6 - ww1 / 2, ground);
          lg.closePath(); lg.fill();
        }
        // dappled light pooled on the ground where the shaft lands
        if (q !== 'low') {
          lg.globalAlpha = rayA * (0.45 + 0.15 * Math.sin(t * 0.8 + i)) * (night > 0.5 ? 0.5 : 1);
          const dp = G.dapples[i % G.dapples.length];
          lg.drawImage(dp, x1 - w1 * 1.3, ground - 16, w1 * 2.6, 34);
          lg.globalAlpha = 1;
        }
      }
    }
    // warm lamps and fires (stronger at night)
    const lampA = 0.25 + night * 0.75;
    const glowAt = (spr, x, y, s, a) => { lg.globalAlpha = a; lg.drawImage(spr, (x - camX) * 2 - s, (y - camY) * 2 - s, s * 2, s * 2); };
    for (const lx of this.lanterns) if (lx > camX - 60 && lx < camX + this.e.W + 60) glowAt(G.warm, lx - 2, groundY(lx) - 27, 46, lampA * 0.7);
    const st = this.station;
    glowAt(G.warm, st.trader.x - 44, groundY(st.trader.x - 44) - 6, 80 + Math.sin(t * 9) * 4, 0.45 + night * 0.5);
    // altar and elder runes pulse in cyan
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.6);
    for (const r of this.props.altar.runes) glowAt(G.cyan, st.altar.x + r.x, groundY(st.altar.x) + r.y, 14, 0.3 + pulse * 0.3);
    glowAt(G.cyan, st.altar.x, groundY(st.altar.x) + this.props.altar.focus.y + 4, 40, 0.25 + pulse * 0.2);
    const elderBoost = f.elderGlow || 0;
    for (const r of this.props.elder.runes) glowAt(G.cyan, st.elder.x + r.x, groundY(st.elder.x) + r.y, 18 + elderBoost * 20, (0.25 + pulse * 0.25) * (1 + elderBoost * 2));
    glowAt(G.green, st.elder.x, groundY(st.elder.x) - 16, 50 + elderBoost * 60, 0.15 + elderBoost * 0.5);
    glowAt(G.gold, st.gate.x, groundY(st.gate.x) - 50, 70, 0.35 + (1 - night) * 0.2);
    // mossheart cores, burning trees
    for (const tr of f.trees.list) {
      if (tr.state !== 'alive' || tr.x < camX - 60 || tr.x > camX + this.e.W + 60) continue;
      const a = this.art(tr);
      const top = groundY(tr.x) - a.ay;
      if (a.glow) glowAt(G.green, tr.x + a.glow.x - a.ax, top + a.glow.y, 30 + pulse * 10, 0.5);
      if (tr.burn) glowAt(G.warm, tr.x, groundY(tr.x) - 16, 36 + Math.sin(t * 13) * 5, 0.6);
    }
    // ground mist
    if (q !== 'low' && d.fog > 0.05) {
      for (let i = 0; i < 6; i++) {
        const fx = ((i * 260 - camX * 0.9 * 2 + t * (6 + i * 2)) % (W + 600) + W + 600) % (W + 600) - 300;
        lg.globalAlpha = d.fog * 0.16 * (0.6 + 0.4 * Math.sin(t * 0.2 + i));
        lg.drawImage(G.fog, fx, ground - 50 - (i % 3) * 14, 420, 80);
      }
    }
    // fireflies, glowing particles, hit flashes, slash trails
    f.ambient.drawGlow(lg, camX, camY, G);
    f.particles.drawGlow(lg, camX, camY, G.white);
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const fl = this.flashes[i];
      fl.t += f.dt;
      if (fl.t > fl.life) { this.flashes.splice(i, 1); continue; }
      const u = 1 - fl.t / fl.life;
      glowAt(G[fl.color] || G.white, fl.x, fl.y, fl.size * (0.7 + 0.3 * u), u * (f.reduceFlash ? 0.4 : 1));
    }
    lg.globalAlpha = 1;
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const tr = this.trails[i];
      tr.t += f.dt;
      if (tr.t > 0.14) { this.trails.splice(i, 1); continue; }
      const u = 1 - tr.t / 0.14;
      lg.strokeStyle = tr.color;
      lg.globalAlpha = u * 0.8;
      lg.lineWidth = 6 * u + 1;
      lg.beginPath();
      lg.arc((tr.x - camX) * 2, (tr.y - camY) * 2, 26, tr.from, tr.to, tr.to < tr.from);
      lg.stroke();
    }
    lg.globalAlpha = 1;
    lg.globalCompositeOperation = 'source-over';
    this.lastCamX = camX;
  }

  gradeColor(grade) { return GRADES[grade].color; }
  treeName(tr) { return TREES[tr.species].ko; }
}
