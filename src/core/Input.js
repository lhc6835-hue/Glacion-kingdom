// Keyboard and mouse state. Presses are queued so a click is never lost between frames.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.clicks = 0;
    this.enabled = true;
    addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k);
      if ([' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.key)) e.preventDefault();
    });
    addEventListener('keyup', (e) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; this.keys.delete(k); });
    addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('pointerdown', (e) => { if (e.button === 0) this.clicks++; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  down(...ks) { return this.enabled && ks.some((k) => this.keys.has(k)); }
  hit(...ks) { return this.enabled && ks.some((k) => this.pressed.has(k)); }
  takeClick() { if (this.clicks > 0 && this.enabled) { this.clicks--; return true; } return false; }
  endFrame() { this.pressed.clear(); if (!this.enabled) this.clicks = 0; }
}
