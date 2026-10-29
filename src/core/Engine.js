// Canvas setup and the frame loop. The world is drawn at a low "art" resolution and upscaled by
// a whole-number factor so pixels stay square; soft light is drawn on its own 2× canvas.
import { makeCanvas } from '../gfx/PixBuf.js';

export const BASE_H = 270;

export class Engine {
  constructor(display) {
    this.display = display;
    this.dg = display.getContext('2d');
    this.pix = makeCanvas(480, BASE_H);   // world art
    this.pg = this.pix.getContext('2d');
    this.light = makeCanvas(960, BASE_H * 2); // soft light, 2 px per art pixel
    this.lg = this.light.getContext('2d');
    this.ui = makeCanvas(480, BASE_H);    // pixel UI drawn over the light
    this.ug = this.ui.getContext('2d');
    this.scale = 2;
    this.W = 480; this.H = BASE_H;
    this.time = 0;
    this.frame = 0;
    this.fps = 60;
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.max(320, innerWidth), ch = Math.max(200, innerHeight);
    const dw = Math.round(cw * dpr), dh = Math.round(ch * dpr);
    this.display.width = dw; this.display.height = dh;
    this.display.style.width = cw + 'px'; this.display.style.height = ch + 'px';
    this.scale = Math.max(1, Math.round(dh / BASE_H));
    this.W = Math.ceil(dw / this.scale);
    this.H = Math.ceil(dh / this.scale);
    for (const [c, k] of [[this.pix, 1], [this.light, 2], [this.ui, 1]]) { c.width = this.W * k; c.height = this.H * k; }
    for (const g of [this.pg, this.ug, this.dg]) g.imageSmoothingEnabled = false;
    this.cssScale = this.scale / dpr; // art pixels → CSS pixels
    this.onResize?.();
  }

  // Composites the three layers onto the display.
  present(lightAlpha = 1) {
    const g = this.dg, s = this.scale;
    g.globalCompositeOperation = 'source-over';
    g.imageSmoothingEnabled = false;
    g.drawImage(this.pix, 0, 0, this.W * s, this.H * s);
    if (lightAlpha > 0) {
      g.imageSmoothingEnabled = true;
      g.globalCompositeOperation = 'screen';
      g.globalAlpha = lightAlpha;
      g.drawImage(this.light, 0, 0, this.W * s, this.H * s);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.imageSmoothingEnabled = false;
    }
    g.drawImage(this.ui, 0, 0, this.W * s, this.H * s);
  }

  start(update) {
    let last = performance.now(), fpsT = 0, fpsN = 0;
    const loop = (t) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      fpsT += dt; fpsN++;
      if (fpsT > 0.5) { this.fps = fpsN / fpsT; fpsT = 0; fpsN = 0; }
      this.time += dt;
      this.frame++;
      update(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
