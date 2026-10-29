// Pixel buffer for generating sprites at load time. Writes raw RGBA, then becomes a canvas.
const cache = new Map();
export function rgb(hex) {
  let c = cache.get(hex);
  if (!c) {
    const h = hex.replace('#', '');
    c = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    cache.set(hex, c);
  }
  return c;
}

export function mix(a, b, t) {
  const A = rgb(a), B = rgb(b);
  const r = (i) => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, '0');
  return '#' + r(0) + r(1) + r(2);
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return c;
}

export class PixBuf {
  constructor(w, h) {
    this.w = Math.ceil(w); this.h = Math.ceil(h);
    this.d = new Uint8ClampedArray(this.w * this.h * 4);
  }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  set(x, y, hex, a = 255) {
    x |= 0; y |= 0;
    if (!this.inside(x, y)) return;
    const c = rgb(hex), i = (y * this.w + x) * 4;
    this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = a;
  }
  alpha(x, y) { return this.inside(x, y) ? this.d[(y * this.w + x) * 4 + 3] : 0; }
  rect(x, y, w, h, hex) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, hex); }
  // Dark outline around everything opaque (on transparent neighbours only).
  outline(hex, sides = 'all') {
    const add = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.alpha(x, y)) continue;
      const n = this.alpha(x - 1, y) || this.alpha(x + 1, y) || this.alpha(x, y + 1) || (sides === 'all' && this.alpha(x, y - 1));
      if (n) add.push(x, y);
    }
    for (let i = 0; i < add.length; i += 2) this.set(add[i], add[i + 1], hex);
  }
  // Recolours opaque edge pixels (inside the silhouette) instead of growing it.
  inkEdge(hex) {
    const ink = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (!this.alpha(x, y)) continue;
      if (!this.alpha(x - 1, y) || !this.alpha(x + 1, y) || !this.alpha(x, y + 1) || !this.alpha(x, y - 1)) ink.push(x, y);
    }
    for (let i = 0; i < ink.length; i += 2) this.set(ink[i], ink[i + 1], hex);
  }
  toCanvas() {
    const c = makeCanvas(this.w, this.h);
    const img = new ImageData(this.d, this.w, this.h);
    c.getContext('2d').putImageData(img, 0, 0);
    return c;
  }
}
