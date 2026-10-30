// Keyboard, mouse and touch. Touch shows virtual controls whose layout depends on the scene:
//  'arena' — move stick (left), aim stick that also fires (right), roll button
//  'side'  — move stick (left), jump and interact buttons (right)
import { len, clamp } from './math.js';

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  Space: 'dash', ShiftLeft: 'dash', ShiftRight: 'dash', KeyE: 'interact', Enter: 'interact', Escape: 'esc', KeyF: 'interact',
  KeyQ: 'emote', KeyT: 'chat', Tab: 'tab',
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.held = new Set();
    this.hits = new Set();
    this.mouse = { x: innerWidth / 2, y: innerHeight / 2, down: false, right: false, moved: false };
    this.isTouch = matchMedia('(pointer: coarse)').matches;
    this.layout = 'arena';
    this.enabled = true;
    this.sticks = { move: null, aim: null };
    this.buttons = [];
    this.btnHeld = new Set();

    addEventListener('keydown', (e) => {
      if (isTyping(e)) return;
      const a = KEYMAP[e.code];
      if (!a) return;
      if (a === 'tab' || a === 'dash' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!this.held.has(a)) this.hits.add(a);
      this.held.add(a);
      if (e.code === 'Space') { if (!this.held.has('jump')) this.hits.add('jump'); this.held.add('jump'); }
      if (a === 'up') { this.hits.add('jumpUp'); }
    });
    addEventListener('keyup', (e) => {
      const a = KEYMAP[e.code];
      if (!a) return;
      this.held.delete(a);
      if (e.code === 'Space') this.held.delete('jump');
    });
    addEventListener('blur', () => { this.held.clear(); this.mouse.down = false; });

    canvas.addEventListener('mousemove', (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.moved = true; });
    canvas.addEventListener('mousedown', (e) => {
      this.isTouch = false;
      if (e.button === 0) { this.mouse.down = true; this.hits.add('fire'); }
      if (e.button === 2) { this.mouse.right = true; this.hits.add('dash'); }
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.down = false; if (e.button === 2) this.mouse.right = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    const opt = { passive: false };
    canvas.addEventListener('touchstart', (e) => this.touchStart(e), opt);
    canvas.addEventListener('touchmove', (e) => this.touchMove(e), opt);
    canvas.addEventListener('touchend', (e) => this.touchEnd(e), opt);
    canvas.addEventListener('touchcancel', (e) => this.touchEnd(e), opt);
  }

  setLayout(layout) {
    this.layout = layout;
    this.sticks.move = this.sticks.aim = null;
    this.btnHeld.clear();
  }

  layoutButtons() {
    const w = innerWidth, h = innerHeight, s = Math.min(w, h);
    const r = clamp(s * 0.085, 30, 46);
    if (this.layout === 'arena') return [{ id: 'dash', label: '구르기', x: w - r * 1.4, y: h - r * 3.6, r: r * 0.9 }];
    if (this.layout === 'side') return [
      { id: 'jump', label: '점프', x: w - r * 1.5, y: h - r * 1.6, r },
      { id: 'interact', label: '대화', x: w - r * 3.7, y: h - r * 1.2, r: r * 0.85 },
    ];
    return [];
  }

  touchStart(e) {
    if (!this.enabled) return;
    e.preventDefault();
    this.isTouch = true;
    const btns = this.layoutButtons();
    for (const t of e.changedTouches) {
      const b = btns.find((b) => len(t.clientX - b.x, t.clientY - b.y) < b.r * 1.25);
      if (b) {
        this.btnHeld.add(b.id); this.hits.add(b.id);
        if (b.id === 'jump') this.held.add('jump');
        t.btn = b.id; this._btnTouch = this._btnTouch || {}; this._btnTouch[t.identifier] = b.id;
        continue;
      }
      const left = t.clientX < innerWidth * 0.5;
      const key = left ? 'move' : this.layout === 'arena' ? 'aim' : null;
      if (key && !this.sticks[key]) this.sticks[key] = { id: t.identifier, ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY };
      else if (!key) this.hits.add('tap');
    }
  }
  touchMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      for (const k of ['move', 'aim']) {
        const s = this.sticks[k];
        if (s && s.id === t.identifier) {
          s.x = t.clientX; s.y = t.clientY;
          // let the stick origin trail behind a far thumb so direction changes stay quick
          const max = 70, dx = s.x - s.ox, dy = s.y - s.oy, d = len(dx, dy);
          if (d > max) { s.ox = s.x - (dx / d) * max; s.oy = s.y - (dy / d) * max; }
        }
      }
    }
  }
  touchEnd(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const b = this._btnTouch && this._btnTouch[t.identifier];
      if (b) { this.btnHeld.delete(b); if (b === 'jump') this.held.delete('jump'); delete this._btnTouch[t.identifier]; }
      for (const k of ['move', 'aim']) if (this.sticks[k] && this.sticks[k].id === t.identifier) this.sticks[k] = null;
    }
  }

  isDown(a) { return this.enabled && (this.held.has(a) || this.btnHeld.has(a)); }
  pressed(a) { return this.enabled && this.hits.has(a); }
  consume(a) { this.hits.delete(a); }

  moveVec() {
    if (!this.enabled) return { x: 0, y: 0 };
    const s = this.sticks.move;
    if (s) {
      const dx = s.x - s.ox, dy = s.y - s.oy, d = len(dx, dy);
      if (d < 8) return { x: 0, y: 0 };
      const m = Math.min(1, d / 60);
      return { x: (dx / d) * m, y: (dy / d) * m };
    }
    let x = 0, y = 0;
    if (this.held.has('left')) x -= 1;
    if (this.held.has('right')) x += 1;
    if (this.held.has('up')) y -= 1;
    if (this.held.has('down')) y += 1;
    const d = len(x, y);
    return d ? { x: x / d, y: y / d } : { x: 0, y: 0 };
  }

  // Aim stick direction (touch) or null.
  aimStick() {
    const s = this.sticks.aim;
    if (!s) return null;
    const dx = s.x - s.ox, dy = s.y - s.oy, d = len(dx, dy);
    if (d < 14) return { x: 0, y: 0, idle: true };
    return { x: dx / d, y: dy / d };
  }

  firing() {
    if (!this.enabled) return false;
    if (this.sticks.aim) { const a = this.aimStick(); return a && !a.idle; }
    return this.mouse.down;
  }

  endFrame() { this.hits.clear(); }

  drawTouch(ctx) {
    if (!this.isTouch || !this.enabled) return;
    ctx.save();
    for (const k of ['move', 'aim']) {
      const s = this.sticks[k];
      if (!s) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.ox, s.oy, 62, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = k === 'aim' ? 'rgba(255,170,200,0.75)' : 'rgba(255,255,255,0.75)';
      ctx.beginPath(); ctx.arc(s.x, s.y, 26, 0, Math.PI * 2); ctx.fill();
    }
    if (!this.sticks.move) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath(); ctx.arc(110, innerHeight - 120, 56, 0, Math.PI * 2); ctx.fill();
    }
    ctx.font = '15px Jua, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const b of this.layoutButtons()) {
      const on = this.btnHeld.has(b.id);
      ctx.fillStyle = on ? 'rgba(255,190,215,0.85)' : 'rgba(255,255,255,0.32)';
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#5a3a4a';
      ctx.fillText(b.label, b.x, b.y + 1);
    }
    ctx.restore();
  }
}

function isTyping(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}
