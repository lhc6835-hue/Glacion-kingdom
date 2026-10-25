import * as THREE from 'three';
import { canvas } from '../art/paint.js';

// Shelf-packed texture atlas. Painted canvases are copied into large pages; each page
// becomes one texture, so thousands of sprites render in a handful of draw calls.
export class Atlas {
  constructor(size = 4096, pad = 3) {
    this.size = size;
    this.pad = pad;
    this.pages = [];
    this.newPage();
  }

  newPage() {
    const c = canvas(this.size, this.size);
    const page = { canvas: c, ctx: c.getContext('2d'), x: 0, y: 0, rowH: 0, texture: null, index: this.pages.length };
    this.pages.push(page);
    this.page = page;
    return page;
  }

  // Returns a region { page, uv: [u0, v0, u1, v1], w, h } in pixels.
  add(img) {
    const w = img.width, h = img.height, p = this.pad;
    if (w + p * 2 > this.size || h + p * 2 > this.size) throw new Error(`sprite too large for atlas: ${w}x${h}`);
    let pg = this.page;
    if (pg.x + w + p * 2 > this.size) { pg.x = 0; pg.y += pg.rowH; pg.rowH = 0; }
    if (pg.y + h + p * 2 > this.size) pg = this.newPage();
    const x = pg.x + p, y = pg.y + p;
    pg.ctx.drawImage(img, x, y);
    pg.x += w + p * 2;
    pg.rowH = Math.max(pg.rowH, h + p * 2);
    const S = this.size;
    // CanvasTexture uses flipY, so v grows upward from the bottom of the page.
    return { page: pg.index, uv: [x / S, 1 - (y + h) / S, (x + w) / S, 1 - y / S], w, h };
  }

  textures(renderer) {
    for (const pg of this.pages) {
      if (pg.texture) { pg.texture.needsUpdate = true; continue; }
      const t = new THREE.CanvasTexture(pg.canvas);
      t.colorSpace = THREE.SRGBColorSpace;
      t.premultiplyAlpha = true; // correct filtering at sprite edges (no dark halos)
      t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      pg.texture = t;
    }
    return this.pages.map((p) => p.texture);
  }
}
