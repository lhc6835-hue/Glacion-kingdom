// Keyboard, mouse wheel and touch input, reduced to a small set of game actions.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered this frame
    this.wheel = 0;
    this.touch = { active: false, x: 0, y: 0, id: null, ox: 0, oy: 0 };
    this.enabled = true;
    addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k);
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    // Touch: left half is a floating joystick, right half taps are "jump", long press "interact".
    canvas.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth * 0.5 && this.touch.id === null) {
          this.touch = { active: true, id: t.identifier, ox: t.clientX, oy: t.clientY, x: 0, y: 0 };
        } else { this.pressed.add(' '); this.keys.add(' '); this._tapT = performance.now(); }
      }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) if (t.identifier === this.touch.id) {
        this.touch.x = Math.max(-1, Math.min(1, (t.clientX - this.touch.ox) / 50));
        this.touch.y = Math.max(-1, Math.min(1, (t.clientY - this.touch.oy) / 50));
      }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchend', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.touch.id) this.touch = { active: false, id: null, x: 0, y: 0, ox: 0, oy: 0 };
        else { this.keys.delete(' '); if (performance.now() - (this._tapT || 0) < 200) this.pressed.add('e'); }
      }
    });
  }

  down(...ks) { return this.enabled && ks.some((k) => this.keys.has(k)); }
  hit(...ks) { return this.enabled && ks.some((k) => this.pressed.has(k)); }

  // Movement vector in world terms: x east, z south.
  move() {
    if (!this.enabled) return { x: 0, z: 0 };
    let x = 0, z = 0;
    if (this.down('a', 'arrowleft')) x -= 1;
    if (this.down('d', 'arrowright')) x += 1;
    if (this.down('w', 'arrowup')) z -= 1;
    if (this.down('s', 'arrowdown')) z += 1;
    if (this.touch.active) { x = this.touch.x; z = this.touch.y; }
    const l = Math.hypot(x, z);
    return l > 1 ? { x: x / l, z: z / l } : { x, z };
  }

  endFrame() { this.pressed.clear(); this.wheel = 0; }
}
