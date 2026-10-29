// Full-screen altar reveal. Timeline: charge (rune circle spins up, light gathers in the colour of
// the best grade) → burst (flash, shockwave, light pillar) → cards dealt face down and flipped one by
// one (high grades glimmer first and shake the stage) → spotlight on the best axe → summary.
// A tap or Space skips ahead one stage.
import { AXE_BY_ID, effectText } from '../data/axes.js';
import { GRADES } from '../data/grades.js';
import { axeIcon } from '../art/icons.js';
import { GACHA } from '../data/balance.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const tierOf = (g) => (g >= 9 ? 3 : g >= 5 ? 2 : g >= 3 ? 1 : 0);
const CHARGE = 1.05;

function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

export class GachaFX {
  constructor(root, ui) {
    this.ui = ui;
    this.open = false;
    const el = (this.el = document.createElement('div'));
    el.className = 'gfx hidden';
    el.innerHTML = `<canvas></canvas>
      <div class="gfx-stage"><div class="gfx-cards"></div><div class="gfx-spot hidden"></div></div>
      <div class="gfx-bar hidden"><button class="big" data-g="again"></button><button class="primary big" data-g="ok">확인</button></div>
      <div class="gfx-tip">화면을 누르면 넘어가요</div>`;
    root.appendChild(el);
    this.cv = el.querySelector('canvas');
    this.cx = this.cv.getContext('2d');
    this.cards = el.querySelector('.gfx-cards');
    this.spot = el.querySelector('.gfx-spot');
    this.bar = el.querySelector('.gfx-bar');
    this.stage = el.querySelector('.gfx-stage');
    el.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('[data-g]');
      if (b) { e.stopPropagation(); if (b.dataset.g === 'ok') this.close(); else this.again(); return; }
      this.skip();
    });
    addEventListener('resize', () => this.size());
    this.sparks = [];
    this.raf = 0;
  }

  size() {
    const d = Math.min(2, devicePixelRatio || 1);
    this.cv.width = innerWidth * d; this.cv.height = innerHeight * d;
    this.cv.style.width = innerWidth + 'px'; this.cv.style.height = innerHeight + 'px';
    this.dpr = d;
  }

  play(results, times) {
    this.results = results;
    this.times = times;
    this.best = results.reduce((b, r) => (r.grade > b.grade ? r : b), results[0]);
    this.tier = tierOf(this.best.grade);
    this.color = GRADES[this.best.grade].color;
    this.t = 0; this.stageN = 'charge'; this.flipped = 0; this.nextFlip = 0;
    this.sparks.length = 0;
    this.open = true;
    this.el.classList.remove('hidden', 'shake', 'done', 'spotting');
    this.el.style.setProperty('--gc', this.color);
    this.el.dataset.tier = this.tier;
    this.spot.classList.add('hidden');
    this.bar.classList.add('hidden');
    this.cards.innerHTML = '';
    this.cards.dataset.n = results.length;
    this.size();
    this.ui.g.audio.play('gachaCharge', { tier: this.tier });
    cancelAnimationFrame(this.raf);
    let last = performance.now();
    const loop = (now) => {
      if (!this.open) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  // ── stages ──
  update(dt) {
    this.t += dt;
    if (this.stageN === 'charge') {
      // motes stream inward toward the centre
      for (let i = 0; i < 4 + this.tier * 2; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.max(innerWidth, innerHeight) * (0.45 + Math.random() * 0.2);
        this.sparks.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, vx: -Math.cos(a) * r * 1.4, vy: -Math.sin(a) * r * 1.4, life: 0.7, max: 0.7, size: 1 + Math.random() * 2, col: Math.random() < 0.6 ? this.color : '#ffffff', in: true });
      }
      if (this.t >= CHARGE) this.burst();
    } else if (this.stageN === 'cards') {
      this.nextFlip -= dt;
      if (this.nextFlip <= 0 && this.flipped < this.results.length) this.flipNext();
      else if (this.flipped >= this.results.length && this.nextFlip <= -0.35) this.afterCards();
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i];
      p.life -= dt;
      if (p.life <= 0 || (p.in && Math.hypot(p.x, p.y) < 12)) { this.sparks.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (!p.in) { p.vx *= 1 - 2.2 * dt; p.vy = p.vy * (1 - 2.2 * dt) + (p.grav || 0) * dt; }
    }
    if (this.stageN !== 'charge' && Math.random() < dt * (6 + this.tier * 6)) {
      // ambient embers rising after the burst
      this.sparks.push({ x: (Math.random() - 0.5) * innerWidth, y: innerHeight * 0.55, vx: (Math.random() - 0.5) * 20, vy: -40 - Math.random() * 70, life: 3, max: 3, size: 1 + Math.random() * 2, col: Math.random() < 0.5 ? this.color : '#fff3c0', grav: -6 });
    }
  }

  burst() {
    this.stageN = 'cards';
    this.burstT = this.t;
    this.ui.g.audio.play('gachaBurst', { tier: this.tier });
    const n = 60 + this.tier * 50;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 200 + Math.random() * (500 + this.tier * 250);
      this.sparks.push({ x: 0, y: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.8 + Math.random() * 0.8, max: 1.6, size: 1 + Math.random() * 3, col: Math.random() < 0.5 ? this.color : '#ffffff', grav: 120 });
    }
    if (this.tier >= 2) this.shake();
    this.deal();
    this.nextFlip = 0.55;
  }

  deal() {
    this.cards.innerHTML = this.results.map((r, i) => {
      const a = AXE_BY_ID[r.id], gr = GRADES[r.grade];
      return `<div class="gcard t${tierOf(r.grade)}" style="--gc:${gr.color};--i:${i}">
        <div class="gc-in">
          <div class="gc-back"><i></i></div>
          <div class="gc-front">
            <span class="gc-grade">${gr.ko}</span>
            <img src="${axeIcon(r.id)}" alt="">
            <b>${esc(a.ko)}</b>
            ${r.dup ? `<em>중복 · 파편 +${r.shards}</em>` : '<em class="new">NEW</em>'}
          </div>
        </div></div>`;
    }).join('');
  }

  flipNext() {
    const i = this.flipped;
    const r = this.results[i];
    const card = this.cards.children[i];
    const tier = tierOf(r.grade);
    if (tier >= 2 && !card.classList.contains('tease')) {
      // a glimmer leaks through the back before a high grade turns over
      card.classList.add('tease');
      this.nextFlip = 0.6;
      this.ui.g.audio.play('gachaCharge', { tier: 0 });
      return;
    }
    card.classList.add('flip');
    this.flipped++;
    this.ui.g.audio.play(tier >= 1 ? 'flipHi' : 'flip', { grade: r.grade, i });
    if (tier >= 2) {
      this.shake();
      const b = card.getBoundingClientRect();
      const cx = b.left + b.width / 2 - innerWidth / 2, cy = b.top + b.height / 2 - innerHeight / 2;
      for (let k = 0; k < 40; k++) {
        const a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 260;
        this.sparks.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.9, max: 0.9, size: 1 + Math.random() * 2.5, col: Math.random() < 0.6 ? GRADES[r.grade].color : '#ffffff', grav: 160 });
      }
    }
    this.nextFlip = tier >= 2 ? 0.5 : this.results.length > 1 ? 0.16 : 0.3;
  }

  afterCards() {
    if (this.stageN !== 'cards') return;
    const showSpot = this.results.length === 1 || this.best.grade >= 5;
    if (showSpot) this.spotlight(); else this.finish();
  }

  spotlight() {
    this.stageN = 'spot';
    const r = this.best, a = AXE_BY_ID[r.id], gr = GRADES[r.grade];
    this.spot.innerHTML = `<div class="sp-rays"></div>
      <div class="sp-card"><img src="${axeIcon(r.id)}" alt=""></div>
      <div class="sp-text"><span class="sp-grade">${gr.ko} · ${gr.en}</span><h2>${esc(a.ko)}</h2><small>${esc(a.en)}</small>
        <p>${esc(a.desc)}</p>
        <ul>${a.effects.map((e) => `<li>${esc(effectText(e))}</li>`).join('') || '<li>특수 능력 없음</li>'}</ul>
        ${r.dup ? `<em>이미 가진 도끼 · 도끼 파편 +${r.shards}</em>` : '<em class="new">새 도끼! 가방에서 장착하세요</em>'}</div>`;
    this.spot.classList.remove('hidden');
    this.el.classList.add('spotting');
    this.ui.g.audio.play('spot');
    if (this.tier >= 2) this.shake();
  }

  finish() {
    this.stageN = 'done';
    this.spot.classList.add('hidden');
    this.el.classList.remove('spotting');
    this.el.classList.add('done');
    const g = this.ui.g, cost = (this.times === 10 ? GACHA.ten : GACHA.single).gold;
    const again = this.bar.querySelector('[data-g="again"]');
    again.textContent = `다시 ${this.times}회 기도 (${cost.toLocaleString('ko-KR')} 골드)`;
    again.disabled = g.state.gold < cost;
    this.bar.classList.remove('hidden');
  }

  skip() {
    if (this.stageN === 'charge') { this.t = CHARGE; this.burst(); return; }
    if (this.stageN === 'cards') {
      for (const c of this.cards.children) c.classList.add('flip');
      this.flipped = this.results.length;
      this.nextFlip = -1;
      this.afterCards();
      return;
    }
    if (this.stageN === 'spot') this.finish();
  }

  again() { this.close(false); this.ui.act('pull', String(this.times)); }

  close(render = true) {
    this.open = false;
    cancelAnimationFrame(this.raf);
    this.el.classList.add('hidden');
    if (render) this.ui.render();
  }

  shake() { this.el.classList.remove('shake'); void this.el.offsetWidth; this.el.classList.add('shake'); }

  // ── canvas: rune circle, light, shockwave, pillar, sparks ──
  draw() {
    const g = this.cx, d = this.dpr, W = this.cv.width, H = this.cv.height;
    const cx = W / 2, cy = H / 2, t = this.t, col = this.color, tier = this.tier;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, W, H);
    // darkness with a coloured heart
    const charge = Math.min(1, t / CHARGE);
    g.fillStyle = 'rgba(3,8,10,0.92)';
    g.fillRect(0, 0, W, H);
    const bg = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.6);
    bg.addColorStop(0, hexA(col, 0.22 + charge * 0.2));
    bg.addColorStop(0.5, hexA(col, 0.04));
    bg.addColorStop(1, 'rgba(0,0,0,0.3)');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    // light pillar after the burst
    const since = this.burstT != null ? t - this.burstT : -1;
    if (since >= 0) {
      const a = Math.max(0, 1 - since / (1.2 + tier * 0.6)) * (0.5 + tier * 0.2) + (tier >= 2 ? 0.12 : 0.04);
      const pw = (90 + tier * 70) * d * (1 + Math.max(0, 0.3 - since));
      const pg = g.createLinearGradient(cx - pw, 0, cx + pw, 0);
      pg.addColorStop(0, hexA(col, 0)); pg.addColorStop(0.5, hexA(col, a)); pg.addColorStop(1, hexA(col, 0));
      g.fillStyle = pg; g.fillRect(cx - pw, 0, pw * 2, H);
      const core = g.createLinearGradient(cx - pw * 0.25, 0, cx + pw * 0.25, 0);
      core.addColorStop(0, 'rgba(255,255,255,0)'); core.addColorStop(0.5, `rgba(255,255,255,${a * 0.7})`); core.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = core; g.fillRect(cx - pw * 0.25, 0, pw * 0.5, H);
      // rays for the top tiers
      if (tier >= 2) {
        g.save(); g.translate(cx, cy); g.rotate(t * 0.25);
        for (let i = 0; i < 12; i++) {
          g.rotate(Math.PI / 6);
          const rg = g.createLinearGradient(0, 0, Math.max(W, H) * 0.6, 0);
          rg.addColorStop(0, hexA(tier === 3 ? GRADES[(i + Math.floor(t * 4)) % 15].color : col, 0.16));
          rg.addColorStop(1, hexA(col, 0));
          g.fillStyle = rg;
          g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.max(W, H) * 0.6, -40 * d); g.lineTo(Math.max(W, H) * 0.6, 40 * d); g.closePath(); g.fill();
        }
        g.restore();
      }
      // shockwave rings
      for (let k = 0; k < 2 + tier; k++) {
        const s = since - k * 0.12;
        if (s < 0 || s > 0.9) continue;
        g.strokeStyle = hexA(k % 2 ? '#ffffff' : col, (1 - s / 0.9) * 0.8);
        g.lineWidth = (10 - s * 9) * d;
        g.beginPath(); g.arc(cx, cy, s * Math.max(W, H) * 0.9, 0, Math.PI * 2); g.stroke();
      }
    }
    // rune circle: three rings of ticks and glyph dots, spinning faster while charging
    const R = Math.min(W, H) * (0.18 + charge * 0.1);
    const spin = t * (0.6 + charge * 3.4);
    const ringA = since < 0 ? 0.35 + charge * 0.6 : Math.max(0.12, 0.8 - since * 0.8);
    g.save(); g.translate(cx, cy);
    g.strokeStyle = hexA(col, ringA); g.lineWidth = 2 * d;
    g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(0, 0, R * 0.78, 0, Math.PI * 2); g.stroke();
    g.rotate(spin);
    for (let i = 0; i < 36; i++) { g.rotate(Math.PI / 18); g.fillStyle = hexA(i % 3 ? col : '#ffffff', ringA); g.fillRect(R * 0.8, -1 * d, (i % 3 ? 6 : 12) * d, 2 * d); }
    g.rotate(-spin * 2.3);
    for (let i = 0; i < 6; i++) {
      g.rotate(Math.PI / 3);
      g.fillStyle = hexA('#ffffff', ringA);
      g.fillRect(R * 0.62 - 3 * d, -3 * d, 6 * d, 6 * d);
      g.strokeStyle = hexA(col, ringA * 0.8);
      g.beginPath(); g.moveTo(R * 0.62, 0); g.lineTo(Math.cos(Math.PI / 3) * R * 0.62, Math.sin(Math.PI / 3) * R * 0.62); g.stroke();
    }
    g.restore();
    // gathering core glow
    const glowR = (40 + charge * 80 + (since >= 0 ? Math.max(0, 0.4 - since) * 400 : 0)) * d;
    const cg = g.createRadialGradient(cx, cy, 0, cx, cy, glowR);
    cg.addColorStop(0, `rgba(255,255,255,${since >= 0 ? Math.max(0.15, 1 - since) : 0.4 + charge * 0.5})`);
    cg.addColorStop(0.3, hexA(col, 0.6));
    cg.addColorStop(1, hexA(col, 0));
    g.fillStyle = cg; g.fillRect(cx - glowR, cy - glowR, glowR * 2, glowR * 2);
    // sparks
    for (const p of this.sparks) {
      const a = Math.min(1, p.life / p.max * 1.4);
      const s = p.size * d;
      g.fillStyle = hexA(p.col, a);
      g.fillRect(cx + p.x * d - s / 2, cy + p.y * d - s / 2, s, s);
      g.fillStyle = hexA(p.col, a * 0.25);
      g.fillRect(cx + p.x * d - s * 1.5, cy + p.y * d - s * 1.5, s * 3, s * 3);
    }
    // white flash on the burst
    if (since >= 0 && since < 0.35 && !this.ui.g.state.settings.reduceFlash) {
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = `rgba(255,255,255,${(1 - since / 0.35) * (0.55 + tier * 0.12)})`;
      g.fillRect(0, 0, W, H);
    }
  }
}
