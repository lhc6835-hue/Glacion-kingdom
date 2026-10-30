// Offscreen sprite helper. Art is authored in "design units" and baked at PX pixels per unit.
// Drawing a silhouette first and then painting details with 'source-atop' keeps every
// character a single clean shape; outline() then wraps that whole silhouette in one soft line.
export const PX = 2.5;

export function makeSprite(w, h, ox, oy, draw, opts = {}) {
  const pad = opts.outline ? Math.ceil(opts.outline * PX) + 2 : 2;
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * PX) + pad * 2;
  c.height = Math.ceil(h * PX) + pad * 2;
  const g = c.getContext('2d');
  g.translate(pad + ox * PX, pad + oy * PX);
  g.scale(PX, PX);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  draw(g);
  let out = c;
  if (opts.outline) out = outline(c, opts.outlineColor || 'rgba(60,30,40,0.55)', opts.outline * PX);
  return { canvas: out, ox: (pad + ox * PX) / PX, oy: (pad + oy * PX) / PX, w: out.width / PX, h: out.height / PX };
}

export function drawSprite(ctx, s, x = 0, y = 0) {
  ctx.drawImage(s.canvas, x - s.ox, y - s.oy, s.w, s.h);
}

// Silhouette outline: stamp a tinted copy of the sprite in a ring of offsets, then the sprite.
export function outline(src, color, w) {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const g = c.getContext('2d');
  const tint = document.createElement('canvas');
  tint.width = src.width; tint.height = src.height;
  const t = tint.getContext('2d');
  t.drawImage(src, 0, 0);
  t.globalCompositeOperation = 'source-in';
  t.fillStyle = color;
  t.fillRect(0, 0, tint.width, tint.height);
  const n = 16;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    g.drawImage(tint, Math.cos(a) * w, Math.sin(a) * w);
  }
  g.drawImage(src, 0, 0);
  return c;
}

// White silhouette of a sprite canvas, used for hit flashes.
export function whiteOf(s) {
  const c = document.createElement('canvas');
  c.width = s.canvas.width; c.height = s.canvas.height;
  const g = c.getContext('2d');
  g.drawImage(s.canvas, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, c.width, c.height);
  return { ...s, canvas: c };
}

// Atop painting helper: run fn with compositing restricted to already-painted pixels.
export function atop(g, fn) {
  g.save();
  g.globalCompositeOperation = 'source-atop';
  fn(g);
  g.restore();
}
