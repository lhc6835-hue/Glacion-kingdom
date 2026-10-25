import { canvas, rgb, mix, shade, rng, blob, dabs, vgrad, hex } from './paint.js';

// Painted architecture: houses, shops, round towers with conical roofs, curtain walls,
// gatehouses and arched bridges. Drawn in the classic 2D-RPG convention: front elevation
// with the roof seen slightly from above. Light from the upper left.
// Every painter returns { img, windows: [[x,y,w,h]...] } so night lighting can be added.

export const ROOFS = {
  red: [0.78, 0.22, 0.16], scarlet: [0.86, 0.30, 0.20], rust: [0.62, 0.24, 0.17],
  orange: [0.88, 0.46, 0.22], plum: [0.48, 0.20, 0.24], slate: [0.32, 0.38, 0.50], teal: [0.22, 0.46, 0.48],
};
export const STONE = { pale: [0.86, 0.82, 0.74], warm: [0.80, 0.72, 0.60], grey: [0.70, 0.70, 0.70], cool: [0.66, 0.68, 0.72] };
const TIMBER = [0.36, 0.24, 0.17];
const PLASTER = [[0.96, 0.92, 0.82], [0.95, 0.88, 0.74], [0.93, 0.90, 0.86], [0.90, 0.84, 0.70], [0.98, 0.94, 0.88]];
const SHUTTER = [[0.30, 0.48, 0.62], [0.55, 0.30, 0.25], [0.30, 0.52, 0.36], [0.70, 0.56, 0.28], [0.42, 0.34, 0.55]];

// Stone courses with per-block tone variation and a lit upper-left edge.
function stoneWall(ctx, r, x, y, w, h, base, ppm, { block = 0.9, course = 0.5 } = {}) {
  ctx.fillStyle = rgb(shade(base, 0.62));
  ctx.fillRect(x, y, w, h);
  const ch = course * ppm, bw = block * ppm;
  for (let row = 0, yy = y + h - ch; yy > y - ch; row++, yy -= ch) {
    let xx = x - (row % 2 ? bw * 0.5 : 0) - r() * bw * 0.3;
    while (xx < x + w) {
      const bwr = bw * r.range(0.7, 1.3);
      const k = r.range(0.86, 1.08);
      const c = shade(base, k);
      ctx.fillStyle = rgb(c);
      const x0 = Math.max(x, xx + 1), x1 = Math.min(x + w, xx + bwr - 1);
      const y0 = Math.max(y, yy + 1), y1 = Math.min(y + h, yy + ch - 1);
      if (x1 > x0 && y1 > y0) {
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        ctx.fillStyle = rgb(shade(c, 1.12), 0.8);
        ctx.fillRect(x0, y0, x1 - x0, Math.max(1, ch * 0.18));
      }
      xx += bwr;
    }
  }
}

// Horizontal light falloff: lit on the left, shaded on the right.
function sideShade(ctx, x, y, w, h, strength = 0.35) {
  ctx.fillStyle = vgrad(ctx, x, 0, x + w, 0, [[0, 'rgba(255,240,210,0.10)'], [0.45, 'rgba(0,0,0,0)'], [1, `rgba(20,30,60,${strength})`]]);
  ctx.fillRect(x, y, w, h);
}

// Cylindrical shading for round towers.
function cylinderShade(ctx, x, y, w, h) {
  ctx.fillStyle = vgrad(ctx, x, 0, x + w, 0, [
    [0, 'rgba(30,40,70,0.25)'], [0.18, 'rgba(255,240,200,0.14)'], [0.35, 'rgba(255,240,200,0.06)'],
    [0.7, 'rgba(20,30,60,0.22)'], [0.92, 'rgba(20,30,60,0.42)'], [1, 'rgba(60,70,100,0.30)'],
  ]);
  ctx.fillRect(x, y, w, h);
}

function windowGlass(ctx, x, y, w, h, arch, wins) {
  ctx.fillStyle = rgb([0.22, 0.30, 0.42]);
  ctx.beginPath();
  if (arch) { ctx.moveTo(x, y + h); ctx.lineTo(x, y + w / 2); ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); ctx.lineTo(x + w, y + h); }
  else ctx.rect(x, y, w, h);
  ctx.closePath(); ctx.fill();
  // sky reflection
  ctx.fillStyle = 'rgba(190,220,255,0.35)';
  ctx.fillRect(x + w * 0.12, y + h * 0.2, w * 0.25, h * 0.6);
  wins.push([x, y, w, h]);
}

function tiledRoof(ctx, r, pts, color, ppm, { rows = 10, scallop = true } = {}) {
  // pts: polygon of the roof plane; tiles are painted in rows from top to bottom.
  ctx.save();
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
  ctx.clip();
  const ys = pts.map((p) => p[1]), xs = pts.map((p) => p[0]);
  const y0 = Math.min(...ys), y1 = Math.max(...ys), x0 = Math.min(...xs), x1 = Math.max(...xs);
  ctx.fillStyle = rgb(shade(color, 0.55)); ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  const rh = (y1 - y0) / rows;
  const tw = Math.max(4, ppm * 0.55);
  for (let i = 0; i < rows + 1; i++) {
    const yy = y0 + i * rh;
    const rowTone = 0.85 + (i / rows) * 0.2;
    for (let xx = x0 - (i % 2) * tw * 0.5; xx < x1 + tw; xx += tw) {
      const k = rowTone * r.range(0.9, 1.1) * (1.08 - 0.25 * ((xx - x0) / (x1 - x0)));
      ctx.fillStyle = rgb(shade(color, k));
      ctx.beginPath();
      if (scallop) { ctx.moveTo(xx, yy); ctx.lineTo(xx, yy + rh * 0.7); ctx.quadraticCurveTo(xx + tw / 2, yy + rh * 1.25, xx + tw, yy + rh * 0.7); ctx.lineTo(xx + tw, yy); }
      else ctx.rect(xx + 0.5, yy, tw - 1, rh - 1);
      ctx.fill();
    }
  }
  // moss and weathering
  dabs(ctx, r, Math.floor((x1 - x0) * (y1 - y0) / 900), (rr) => [x0 + rr() * (x1 - x0), y0 + rr() * (y1 - y0)],
    (p, rr) => (rr() < 0.5 ? rgb([0.35, 0.48, 0.25], 0.35) : rgb(shade(color, 1.25), 0.25)), { size: [1.5, 3.5] });
  ctx.restore();
}

// --- houses ---------------------------------------------------------------------------

export function paintHouse(seed, { ppm = 16, width = 9, floors = 2, roof = ROOFS.red, style = 'timber', depth = 7, sign = null, awning = null, frontGable = null } = {}) {
  const r = rng(seed);
  const floorH = 3.1;
  const wallH = floors * floorH + 0.6;
  const roofH = depth * 0.62 + (frontGable ?? r.chance(0.4) ? 1.2 : 0);
  const chimney = r.chance(0.7);
  const W = (width + 1.2) * ppm, Hpx = (wallH + roofH + (chimney ? 1.6 : 0.4)) * ppm;
  const c = canvas(W, Hpx), ctx = c.getContext('2d');
  const wins = [];
  const x0 = 0.6 * ppm, wpx = width * ppm, base = Hpx, wallTop = base - wallH * ppm;
  const plaster = r.pick(PLASTER), shutter = r.pick(SHUTTER);
  const stone = r.pick([STONE.pale, STONE.warm, STONE.grey]);

  // Walls.
  if (style === 'stone') stoneWall(ctx, r, x0, wallTop, wpx, wallH * ppm, stone, ppm);
  else {
    stoneWall(ctx, r, x0, base - 1.1 * ppm, wpx, 1.1 * ppm, stone, ppm, { block: 0.7, course: 0.35 });
    ctx.fillStyle = rgb(plaster);
    ctx.fillRect(x0, wallTop, wpx, (wallH - 1.1) * ppm);
    dabs(ctx, r, 60, (rr) => [x0 + rr() * wpx, wallTop + rr() * (wallH - 1.1) * ppm], () => rgb(shade(plaster, 0.93), 0.5), { size: [2, 5] });
    if (style === 'timber') {
      ctx.fillStyle = rgb(TIMBER);
      const bw = Math.max(2, ppm * 0.22);
      for (let f = 0; f < floors; f++) ctx.fillRect(x0, base - 1.1 * ppm - f * floorH * ppm - bw, wpx, bw);
      ctx.fillRect(x0, wallTop, wpx, bw);
      const posts = Math.max(2, Math.round(width / 2.4));
      for (let p = 0; p <= posts; p++) ctx.fillRect(x0 + (p / posts) * (wpx - bw), wallTop, bw, (wallH - 1.1) * ppm);
      // Diagonal braces on the upper floor.
      ctx.strokeStyle = rgb(TIMBER); ctx.lineWidth = bw * 0.8;
      for (let p = 0; p < posts; p += 2) {
        const xa = x0 + (p / posts) * (wpx - bw), xb = x0 + ((p + 1) / posts) * (wpx - bw);
        const ya = wallTop + bw, yb = wallTop + floorH * ppm;
        ctx.beginPath(); ctx.moveTo(xa, yb); ctx.lineTo(xb, ya); ctx.stroke();
      }
    }
  }

  // Windows per floor.
  const cols = Math.max(2, Math.round(width / 2.6));
  const doorCol = Math.floor(cols / 2) - (cols % 2 ? 0 : r.int(0, 1));
  for (let f = 0; f < floors; f++) {
    for (let k = 0; k < cols; k++) {
      if (f === 0 && k === doorCol) continue;
      const ww = ppm * 0.95, wh = ppm * 1.3;
      const wx = x0 + ((k + 0.5) / cols) * wpx - ww / 2;
      const wy = base - (f * floorH + 1.9) * ppm - (f === 0 ? 0 : 0.2 * ppm);
      ctx.fillStyle = rgb(shade(stone, 0.9)); ctx.fillRect(wx - 2, wy - 2, ww + 4, wh + 5);
      windowGlass(ctx, wx, wy, ww, wh, style === 'stone' && r.chance(0.5), wins);
      ctx.fillStyle = rgb(TIMBER); ctx.fillRect(wx + ww / 2 - 1, wy, 2, wh); ctx.fillRect(wx, wy + wh * 0.45, ww, 2);
      if (style !== 'stone' || r.chance(0.5)) {
        ctx.fillStyle = rgb(shutter); ctx.fillRect(wx - ww * 0.42, wy, ww * 0.38, wh); ctx.fillRect(wx + ww * 1.04, wy, ww * 0.38, wh);
      }
      if (r.chance(0.5)) { // flower box
        ctx.fillStyle = rgb([0.45, 0.30, 0.2]); ctx.fillRect(wx - 2, wy + wh, ww + 4, ppm * 0.25);
        dabs(ctx, r, 10, (rr) => [wx + rr() * ww, wy + wh - rr() * ppm * 0.15], (p, rr) => rgb(rr() < 0.4 ? [0.3, 0.55, 0.25] : r.pick([[1, 0.45, 0.5], [1, 0.85, 0.3], [0.95, 0.95, 1]])), { size: [1.5, 2.5], stretch: 1 });
      }
    }
  }
  // Door.
  const dw = ppm * 1.3, dh = ppm * 2.2;
  const dx = x0 + ((doorCol + 0.5) / cols) * wpx - dw / 2, dy = base - dh;
  ctx.fillStyle = rgb(shade(stone, 0.75)); ctx.fillRect(dx - 3, dy - 3, dw + 6, dh + 3);
  ctx.fillStyle = rgb(r.pick([[0.42, 0.26, 0.17], [0.30, 0.38, 0.48], [0.45, 0.22, 0.2]]));
  ctx.beginPath(); ctx.moveTo(dx, base); ctx.lineTo(dx, dy + dw / 2); ctx.arc(dx + dw / 2, dy + dw / 2, dw / 2, Math.PI, 0); ctx.lineTo(dx + dw, base); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(dx + dw / 2 - 1, dy + dw * 0.4, 2, dh - dw * 0.4);
  blob(ctx, dx + dw * 0.78, dy + dh * 0.6, 1.5, 1.5, rgb([0.85, 0.7, 0.3]));

  if (awning) {
    const ay = base - 2.6 * ppm;
    for (let k = 0; k < 8; k++) {
      ctx.fillStyle = rgb(k % 2 ? awning : [0.96, 0.94, 0.88]);
      ctx.beginPath();
      const ax = x0 + (k / 8) * wpx;
      ctx.moveTo(ax, ay); ctx.lineTo(ax + wpx / 8, ay); ctx.lineTo(ax + wpx / 8, ay + ppm * 0.9); ctx.quadraticCurveTo(ax + wpx / 16, ay + ppm * 1.25, ax, ay + ppm * 0.9);
      ctx.fill();
    }
  }
  sideShade(ctx, x0, wallTop, wpx, wallH * ppm, 0.3);
  // Shadow under the eaves.
  ctx.fillStyle = vgrad(ctx, 0, wallTop, 0, wallTop + ppm * 0.9, [[0, 'rgba(20,20,40,0.45)'], [1, 'rgba(20,20,40,0)']]);
  ctx.fillRect(x0, wallTop, wpx, ppm * 0.9);

  // Roof (front slope seen from above), eaves overhang.
  const ov = 0.55 * ppm;
  const ridgeY = wallTop - roofH * ppm;
  const inset = r.range(0.06, 0.16) * wpx;
  const pts = [[x0 - ov, wallTop + ov * 0.4], [x0 + wpx + ov, wallTop + ov * 0.4], [x0 + wpx - inset, ridgeY], [x0 + inset, ridgeY]];
  if (chimney) {
    const cx = x0 + wpx * r.range(0.6, 0.8);
    stoneWall(ctx, r, cx, ridgeY - 1.2 * ppm, ppm * 0.9, roofH * ppm * 0.8, shade(stone, 0.9), ppm, { block: 0.45, course: 0.3 });
    ctx.fillStyle = rgb(shade(stone, 0.6)); ctx.fillRect(cx - 2, ridgeY - 1.3 * ppm, ppm * 0.9 + 4, 3);
  }
  tiledRoof(ctx, r, pts, mix(roof, shade(roof, r.range(0.85, 1.1)), 0.5), ppm, { rows: Math.round(roofH * 2.2) });
  // Ridge cap and side gables (darker), giving the roof volume.
  ctx.fillStyle = rgb(shade(roof, 0.5));
  ctx.fillRect(x0 + inset, ridgeY - 2, wpx - inset * 2, 3);
  ctx.fillStyle = 'rgba(30,20,40,0.28)';
  ctx.beginPath(); ctx.moveTo(x0 + wpx - inset, ridgeY); ctx.lineTo(x0 + wpx + ov, wallTop + ov * 0.4); ctx.lineTo(x0 + wpx + ov * 0.2, wallTop + ov * 0.4); ctx.lineTo(x0 + wpx - inset - ppm * 0.6, ridgeY); ctx.fill();
  ctx.fillStyle = 'rgba(255,230,190,0.18)';
  ctx.beginPath(); ctx.moveTo(x0 + inset, ridgeY); ctx.lineTo(x0 - ov, wallTop + ov * 0.4); ctx.lineTo(x0 - ov * 0.2 + ppm * 0.8, wallTop + ov * 0.4); ctx.lineTo(x0 + inset + ppm * 0.6, ridgeY); ctx.fill();

  if (frontGable ?? r.chance(0.45)) {
    // A dormer / cross gable facing the street.
    const gw = Math.min(wpx * 0.42, ppm * 4), gx = x0 + wpx * r.range(0.3, 0.7) - gw / 2;
    const gy = wallTop + ppm * 0.2, gh = ppm * 2.4;
    ctx.fillStyle = rgb(style === 'stone' ? stone : plaster);
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + gw / 2, gy - gh); ctx.lineTo(gx + gw, gy); ctx.closePath(); ctx.fill();
    windowGlass(ctx, gx + gw / 2 - ppm * 0.4, gy - gh * 0.62, ppm * 0.8, ppm * 1.0, true, wins);
    ctx.strokeStyle = rgb(shade(roof, 0.8)); ctx.lineWidth = ppm * 0.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(gx - ppm * 0.3, gy + ppm * 0.2); ctx.lineTo(gx + gw / 2, gy - gh - ppm * 0.2); ctx.lineTo(gx + gw + ppm * 0.3, gy + ppm * 0.2); ctx.stroke();
  }

  if (sign) paintSign(ctx, x0 + wpx * 0.08, base - 3.1 * ppm, ppm, sign);
  return { img: c, windows: wins, ppm, footprint: { w: width, d: depth } };
}

// Hanging shop signs: an icon on a painted board, readable from a distance.
function paintSign(ctx, x, y, ppm, icon) {
  ctx.strokeStyle = rgb([0.25, 0.2, 0.15]); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + ppm * 1.6, y); ctx.stroke();
  const bx = x + ppm * 0.4, by = y + ppm * 0.2, bw = ppm * 1.4, bh = ppm * 1.1;
  ctx.fillStyle = rgb([0.55, 0.38, 0.22]); ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = rgb([0.85, 0.7, 0.35]); ctx.lineWidth = 1.5; ctx.strokeRect(bx + 1.5, by + 1.5, bw - 3, bh - 3);
  const cx = bx + bw / 2, cy = by + bh / 2, s = ppm * 0.35;
  ctx.fillStyle = rgb([0.95, 0.88, 0.7]);
  ctx.strokeStyle = rgb([0.95, 0.88, 0.7]);
  ctx.lineWidth = 2;
  if (icon === 'anvil') { ctx.fillRect(cx - s, cy - s * 0.3, s * 2, s * 0.6); ctx.fillRect(cx - s * 0.4, cy, s * 0.8, s * 0.8); }
  else if (icon === 'potion') { blob(ctx, cx, cy + s * 0.3, s * 0.7, s * 0.7, rgb([0.5, 0.9, 0.6])); ctx.fillRect(cx - s * 0.2, cy - s, s * 0.4, s * 0.7); }
  else if (icon === 'tankard') { ctx.fillRect(cx - s * 0.6, cy - s * 0.7, s * 1.1, s * 1.5); ctx.beginPath(); ctx.arc(cx + s * 0.6, cy, s * 0.4, -1.2, 1.2); ctx.stroke(); }
  else if (icon === 'star') { for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5; ctx.lineTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s); } ctx.closePath(); ctx.fill(); }
  else if (icon === 'bag') { blob(ctx, cx, cy + s * 0.2, s * 0.8, s * 0.7, rgb([0.95, 0.88, 0.7])); ctx.fillRect(cx - s * 0.3, cy - s * 0.8, s * 0.6, s * 0.4); }
  else if (icon === 'book') { ctx.fillRect(cx - s, cy - s * 0.6, s * 0.9, s * 1.2); ctx.fillRect(cx + s * 0.1, cy - s * 0.6, s * 0.9, s * 1.2); }
  else if (icon === 'sword') { ctx.fillRect(cx - 1.5, cy - s, 3, s * 1.6); ctx.fillRect(cx - s * 0.5, cy + s * 0.3, s, 2.5); }
  else if (icon === 'gear') { ctx.beginPath(); ctx.arc(cx, cy, s * 0.7, 0, Math.PI * 2); ctx.stroke(); ctx.fillRect(cx - 2, cy - s, 4, s * 2); ctx.fillRect(cx - s, cy - 2, s * 2, 4); }
  else if (icon === 'bread') { blob(ctx, cx, cy, s * 0.9, s * 0.55, rgb([0.9, 0.7, 0.4])); }
}

// --- castle pieces --------------------------------------------------------------------

export function paintTower(seed, { ppm = 14, radius = 4, height = 22, roof = ROOFS.red, roofH = null, stone = STONE.pale, windows = 3, spire = true, banner = null, corbels = true, ruined = false } = {}) {
  const r = rng(seed);
  const rh = roofH ?? radius * r.range(2.0, 2.8);
  const W = radius * 2 * ppm * 1.25, bodyW = radius * 2 * ppm;
  const H = (height + rh + (spire ? 3 : 0.5)) * ppm;
  const c = canvas(W, H), ctx = c.getContext('2d');
  const wins = [];
  const bx = (W - bodyW) / 2, base = H, top = base - height * ppm;
  stoneWall(ctx, r, bx, top, bodyW, height * ppm, stone, ppm, { block: 1.0, course: 0.55 });
  // Windows: arched slits climbing the tower.
  for (let k = 0; k < windows; k++) {
    const wy = top + (height * ppm) * ((k + 0.6) / (windows + 0.4));
    const ww = ppm * r.range(0.7, 1.0), wh = ppm * r.range(1.3, 1.9);
    const wx = bx + bodyW * r.range(0.3, 0.55) - ww / 2;
    ctx.fillStyle = rgb(shade(stone, 0.8)); ctx.fillRect(wx - 2, wy - 2, ww + 4, wh + 3);
    windowGlass(ctx, wx, wy, ww, wh, true, wins);
  }
  // Ivy climbing from the base.
  dabs(ctx, r, Math.floor(height * 5), (rr) => {
    const y = base - rr() ** 1.6 * height * ppm * 0.7;
    return [bx + rr() * bodyW * 0.6, y];
  }, (p, rr) => rgb(mix([0.2, 0.42, 0.22], [0.45, 0.66, 0.3], rr()), 0.9), { size: [ppm * 0.12, ppm * 0.25] });
  cylinderShade(ctx, bx, top, bodyW, height * ppm);
  if (ruined) {
    // Broken crown: bite a jagged notch out of the top and let ivy take over.
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.moveTo(bx - 2, top - 2);
    for (let k = 0; k <= 8; k++) ctx.lineTo(bx + (k / 8) * bodyW, top + r.range(0.5, 5) * ppm * (k % 2 ? 1 : 0.4) * (0.4 + Math.sin((k / 8) * Math.PI)));
    ctx.lineTo(bx + bodyW + 2, top - 2); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(40,50,40,0.18)'; ctx.fillRect(0, 0, W, H);
    dabs(ctx, r, Math.floor(height * 8), (rr) => [bx + rr() * bodyW, top + rr() ** 1.5 * height * ppm], (p, rr) => rgb(mix([0.2, 0.42, 0.22], [0.45, 0.66, 0.3], rr()), 0.9), { size: [ppm * 0.12, ppm * 0.28] });
    ctx.globalCompositeOperation = 'source-over';
    return { img: c, windows: [], ppm };
  }
  // Corbelled parapet ring.
  if (corbels) {
    const ry = top - ppm * 0.2;
    stoneWall(ctx, r, bx - ppm * 0.35, ry - ppm * 0.9, bodyW + ppm * 0.7, ppm * 1.1, shade(stone, 1.03), ppm, { block: 0.6, course: 0.35 });
    for (let k = 0; k < 9; k++) { ctx.fillStyle = rgb(shade(stone, 0.55)); ctx.fillRect(bx + (k / 8.5) * bodyW, ry + ppm * 0.15, ppm * 0.3, ppm * 0.35); }
    cylinderShade(ctx, bx - ppm * 0.35, ry - ppm * 0.9, bodyW + ppm * 0.7, ppm * 1.1);
  }
  // Conical roof with curved tile courses.
  const rw = bodyW * 1.18, rx0 = (W - rw) / 2, ryBase = top - ppm * 0.6, apex = ryBase - rh * ppm;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(rx0, ryBase); ctx.quadraticCurveTo(rx0 + rw * 0.18, ryBase - rh * ppm * 0.45, W / 2, apex);
  ctx.quadraticCurveTo(rx0 + rw * 0.82, ryBase - rh * ppm * 0.45, rx0 + rw, ryBase);
  ctx.quadraticCurveTo(W / 2, ryBase + ppm * 0.9, rx0, ryBase);
  ctx.closePath(); ctx.clip();
  ctx.fillStyle = rgb(roof); ctx.fillRect(0, apex, W, ryBase - apex + ppm);
  const rowsN = Math.round(rh * 2.4);
  for (let i = 0; i < rowsN; i++) {
    const t = i / rowsN;
    const yy = apex + t * (ryBase - apex);
    const halfW = rw / 2 * Math.pow(t, 0.8);
    ctx.strokeStyle = rgb(shade(roof, 0.7), 0.7); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(W / 2, yy, halfW, ppm * 0.35 * t + 0.5, 0, 0, Math.PI); ctx.stroke();
  }
  for (let k = -5; k <= 5; k++) {
    ctx.strokeStyle = rgb(shade(roof, 0.82), 0.5);
    ctx.beginPath(); ctx.moveTo(W / 2, apex); ctx.quadraticCurveTo(W / 2 + k * rw * 0.06, ryBase - rh * ppm * 0.3, W / 2 + k * rw * 0.1, ryBase + ppm * 0.5); ctx.stroke();
  }
  ctx.fillStyle = vgrad(ctx, rx0, 0, rx0 + rw, 0, [[0, 'rgba(255,235,200,0.0)'], [0.25, 'rgba(255,235,200,0.32)'], [0.55, 'rgba(0,0,0,0)'], [1, 'rgba(30,10,30,0.45)']]);
  ctx.fillRect(0, apex, W, ryBase - apex + ppm);
  ctx.restore();
  if (spire) {
    ctx.strokeStyle = rgb([0.35, 0.3, 0.28]); ctx.lineWidth = Math.max(1.5, ppm * 0.12);
    ctx.beginPath(); ctx.moveTo(W / 2, apex); ctx.lineTo(W / 2, apex - 2.6 * ppm); ctx.stroke();
    blob(ctx, W / 2, apex - 0.6 * ppm, ppm * 0.18, ppm * 0.18, rgb([0.9, 0.75, 0.35]));
    if (banner) {
      ctx.fillStyle = rgb(banner);
      ctx.beginPath(); ctx.moveTo(W / 2, apex - 2.6 * ppm); ctx.quadraticCurveTo(W / 2 + ppm * 1.2, apex - 2.5 * ppm, W / 2 + ppm * 2, apex - 2.1 * ppm);
      ctx.lineTo(W / 2 + ppm * 1.1, apex - 1.9 * ppm); ctx.lineTo(W / 2, apex - 1.8 * ppm); ctx.fill();
    }
  }
  return { img: c, windows: wins, ppm };
}

// Square keep / hall block with a steep hipped roof and rows of tall windows.
export function paintHall(seed, { ppm = 14, width = 24, height = 16, roof = ROOFS.red, stone = STONE.pale, roofH = 9, buttress = true } = {}) {
  const r = rng(seed);
  const W = (width + 1.5) * ppm, H = (height + roofH + 1) * ppm;
  const c = canvas(W, H), ctx = c.getContext('2d');
  const wins = [];
  const x0 = 0.75 * ppm, wpx = width * ppm, base = H, top = base - height * ppm;
  stoneWall(ctx, r, x0, top, wpx, height * ppm, stone, ppm);
  const cols = Math.max(3, Math.round(width / 3.4));
  const rows = Math.max(1, Math.round(height / 5.5));
  for (let rr = 0; rr < rows; rr++) for (let k = 0; k < cols; k++) {
    const ww = ppm * 1.2, wh = ppm * (rr === rows - 1 ? 2.8 : 2.2);
    const wx = x0 + ((k + 0.5) / cols) * wpx - ww / 2;
    const wy = top + ppm * 1.6 + rr * (height * ppm - ppm * 2) / rows;
    ctx.fillStyle = rgb(shade(stone, 0.82)); ctx.fillRect(wx - 3, wy - 3, ww + 6, wh + 5);
    windowGlass(ctx, wx, wy, ww, wh, true, wins);
  }
  if (buttress) for (let k = 0; k <= cols; k++) {
    const bxp = x0 + (k / cols) * wpx - ppm * 0.4;
    stoneWall(ctx, r, bxp, top + ppm * 2, ppm * 0.8, height * ppm - ppm * 2, shade(stone, 1.05), ppm, { block: 0.8, course: 0.5 });
    ctx.fillStyle = 'rgba(20,30,60,0.25)'; ctx.fillRect(bxp + ppm * 0.55, top + ppm * 2, ppm * 0.25, height * ppm - ppm * 2);
  }
  sideShade(ctx, x0, top, wpx, height * ppm, 0.28);
  const ridgeY = top - roofH * ppm;
  const inset = wpx * 0.2;
  tiledRoof(ctx, r, [[x0 - ppm * 0.6, top + ppm * 0.3], [x0 + wpx + ppm * 0.6, top + ppm * 0.3], [x0 + wpx - inset, ridgeY], [x0 + inset, ridgeY]], roof, ppm, { rows: Math.round(roofH * 2) });
  ctx.fillStyle = 'rgba(30,20,40,0.3)';
  ctx.beginPath(); ctx.moveTo(x0 + wpx - inset, ridgeY); ctx.lineTo(x0 + wpx + ppm * 0.6, top + ppm * 0.3); ctx.lineTo(x0 + wpx - ppm * 1.5, top + ppm * 0.3); ctx.closePath(); ctx.fill();
  // Dormers along the roof.
  for (let k = 0; k < Math.floor(cols / 2); k++) {
    const dx = x0 + ((k * 2 + 1.5) / cols) * wpx, dy = top - roofH * ppm * 0.35;
    ctx.fillStyle = rgb(stone); ctx.fillRect(dx - ppm * 0.7, dy - ppm * 0.6, ppm * 1.4, ppm * 1.4);
    windowGlass(ctx, dx - ppm * 0.4, dy - ppm * 0.4, ppm * 0.8, ppm * 1.0, true, wins);
    ctx.fillStyle = rgb(shade(roof, 0.85));
    ctx.beginPath(); ctx.moveTo(dx - ppm * 1.0, dy - ppm * 0.5); ctx.lineTo(dx, dy - ppm * 1.7); ctx.lineTo(dx + ppm * 1.0, dy - ppm * 0.5); ctx.fill();
  }
  return { img: c, windows: wins, ppm };
}

// Curtain wall segment with crenellations and a visible wall-walk.
export function paintWall(seed, { ppm = 14, length = 12, height = 9, stone = STONE.warm } = {}) {
  const r = rng(seed);
  const W = length * ppm, H = (height + 1.6) * ppm;
  const c = canvas(W, H), ctx = c.getContext('2d');
  const top = H - height * ppm;
  stoneWall(ctx, r, 0, top, W, height * ppm, stone, ppm, { block: 1.1, course: 0.6 });
  // Walk-way seen from above.
  ctx.fillStyle = rgb(shade(stone, 0.8)); ctx.fillRect(0, top - ppm * 0.9, W, ppm * 0.9);
  // Merlons.
  const mw = ppm * 1.1;
  for (let x = 0; x < W; x += mw * 2) {
    stoneWall(ctx, r, x, top - ppm * 1.6, mw, ppm * 1.0, shade(stone, 1.04), ppm, { block: 0.5, course: 0.5 });
  }
  dabs(ctx, r, Math.floor(length * 4), (rr) => [rr() * W, H - rr() ** 2 * height * ppm * 0.6], (p, rr) => rgb(mix([0.22, 0.42, 0.22], [0.42, 0.62, 0.3], rr()), 0.85), { size: [ppm * 0.12, ppm * 0.25] });
  // Arrow slits.
  for (let x = ppm * 2; x < W - ppm; x += ppm * 4) { ctx.fillStyle = rgb([0.15, 0.17, 0.22]); ctx.fillRect(x, top + ppm * 2, ppm * 0.25, ppm * 1.3); }
  ctx.fillStyle = vgrad(ctx, 0, top, 0, H, [[0, 'rgba(255,240,210,0.08)'], [1, 'rgba(20,30,60,0.25)']]);
  ctx.fillRect(0, top, W, height * ppm);
  return { img: c, windows: [], ppm };
}

// Gatehouse: two drum towers flanking an open arch (the arch is transparent so the
// city shows through and the player walks underneath).
export function paintGatehouse(seed, { ppm = 14, width = 20, height = 13, archW = 6, archH = 7.5, roof = ROOFS.red, stone = STONE.warm } = {}) {
  const r = rng(seed);
  const tr = 3.4;
  const W = width * ppm, H = (height + tr * 2.6 + 3) * ppm;
  const c = canvas(W, H), ctx = c.getContext('2d');
  const wins = [];
  const base = H, top = base - (height - 2) * ppm;
  stoneWall(ctx, r, tr * ppm, top, W - tr * 2 * ppm, (height - 2) * ppm, stone, ppm, { block: 1.0, course: 0.55 });
  for (let x = tr * ppm; x < W - tr * ppm; x += ppm * 2.2) stoneWall(ctx, r, x, top - ppm * 1.4, ppm * 1.1, ppm * 1.4, stone, ppm, { block: 0.5, course: 0.5 });
  // Arch voussoirs, then cut the opening.
  const ax = W / 2 - (archW * ppm) / 2, aw = archW * ppm, ah = archH * ppm;
  ctx.fillStyle = rgb(shade(stone, 1.1));
  ctx.beginPath(); ctx.moveTo(ax - ppm * 0.6, base); ctx.lineTo(ax - ppm * 0.6, base - ah + aw / 2); ctx.arc(W / 2, base - ah + aw / 2, aw / 2 + ppm * 0.6, Math.PI, 0); ctx.lineTo(ax + aw + ppm * 0.6, base); ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath(); ctx.moveTo(ax, base); ctx.lineTo(ax, base - ah + aw / 2); ctx.arc(W / 2, base - ah + aw / 2, aw / 2, Math.PI, 0); ctx.lineTo(ax + aw, base); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  // Portcullis teeth at the top of the opening.
  ctx.fillStyle = rgb([0.25, 0.22, 0.2]);
  for (let x = ax + ppm * 0.5; x < ax + aw - ppm * 0.3; x += ppm * 0.8) ctx.fillRect(x, base - ah + ppm * 0.3, ppm * 0.18, ppm * 0.9);
  // Banners either side of the arch.
  for (const bxp of [ax - ppm * 2.2, ax + aw + ppm * 1.0]) {
    ctx.fillStyle = rgb([0.22, 0.32, 0.62]);
    ctx.beginPath(); ctx.moveTo(bxp, top + ppm); ctx.lineTo(bxp + ppm * 1.2, top + ppm); ctx.lineTo(bxp + ppm * 1.2, top + ppm * 5); ctx.lineTo(bxp + ppm * 0.6, top + ppm * 4.3); ctx.lineTo(bxp, top + ppm * 5); ctx.fill();
    blob(ctx, bxp + ppm * 0.6, top + ppm * 2.4, ppm * 0.35, ppm * 0.35, rgb([0.95, 0.85, 0.4]));
  }
  sideShade(ctx, tr * ppm, top, W - tr * 2 * ppm, (height - 2) * ppm, 0.25);
  // Flanking towers.
  for (const side of [0, 1]) {
    const t = paintTower(seed + 11 + side, { ppm, radius: tr, height: height + 2, roof, stone, windows: 2, banner: [0.22, 0.32, 0.62] });
    wins.push(...t.windows.map(([x, y, w, h]) => [x + (side ? W - t.img.width : 0), y + (H - t.img.height), w, h]));
    ctx.drawImage(t.img, side ? W - t.img.width : 0, H - t.img.height);
  }
  return { img: c, windows: wins, ppm };
}

// One span of an arched stone bridge, from deck level down to `drop` metres below.
export function paintBridgeSpan(seed, { ppm = 14, span = 14, drop = 44, deckH = 2.2, stone = STONE.pale } = {}) {
  const r = rng(seed);
  const W = span * ppm, H = (drop + deckH + 1.2) * ppm;
  const c = canvas(W, H), ctx = c.getContext('2d');
  const deckTop = 1.2 * ppm;
  stoneWall(ctx, r, 0, deckTop, W, H - deckTop, stone, ppm, { block: 1.1, course: 0.6 });
  // Parapet with balusters.
  ctx.fillStyle = rgb(shade(stone, 1.08)); ctx.fillRect(0, 0, W, ppm * 0.45);
  for (let x = ppm * 0.3; x < W; x += ppm * 0.9) { ctx.fillStyle = rgb(shade(stone, 0.95)); ctx.fillRect(x, ppm * 0.4, ppm * 0.35, ppm * 0.8); }
  // Pier columns at both ends; cut the arch opening.
  const archTop = deckTop + deckH * ppm + ppm * 1.2;
  const pierW = ppm * 2.2;
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  const aw = W - pierW * 2, acx = W / 2;
  ctx.moveTo(pierW, H); ctx.lineTo(pierW, archTop + aw / 2); ctx.arc(acx, archTop + aw / 2, aw / 2, Math.PI, 0); ctx.lineTo(W - pierW, H);
  ctx.fill();
  // Second, smaller arch row below for tall bridges.
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = rgb(shade(stone, 1.15)); ctx.lineWidth = ppm * 0.5;
  ctx.beginPath(); ctx.arc(acx, archTop + aw / 2, aw / 2 + ppm * 0.25, Math.PI, 0); ctx.stroke();
  ctx.fillStyle = vgrad(ctx, 0, 0, 0, H, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(20,30,60,0.35)']]);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillRect(0, 0, W, H);
  dabs(ctx, r, 40, (rr) => [rr() < 0.5 ? rr() * pierW : W - rr() * pierW, H - rr() ** 2 * H * 0.5], (p, rr) => rgb(mix([0.22, 0.42, 0.22], [0.42, 0.62, 0.3], rr())), { size: [ppm * 0.15, ppm * 0.3] });
  ctx.globalCompositeOperation = 'source-over';
  return { img: c, windows: [], ppm };
}

// --- props -------------------------------------------------------------------------------

export function paintFountain(seed, { ppm = 16 } = {}) {
  const r = rng(seed);
  const W = 12 * ppm, H = 7 * ppm;
  const c = canvas(W, H), ctx = c.getContext('2d');
  const stone = STONE.pale;
  // Basin: an ellipse seen from above with a stone rim.
  ctx.fillStyle = rgb(shade(stone, 0.7)); ctx.beginPath(); ctx.ellipse(W / 2, H - 1.6 * ppm, W * 0.47, 1.5 * ppm, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = rgb([0.36, 0.70, 0.78]); ctx.beginPath(); ctx.ellipse(W / 2, H - 1.75 * ppm, W * 0.42, 1.15 * ppm, 0, 0, Math.PI * 2); ctx.fill();
  dabs(ctx, r, 40, (rr) => [W / 2 + (rr() - 0.5) * W * 0.8, H - 1.75 * ppm + (rr() - 0.5) * ppm * 1.6], () => 'rgba(255,255,255,0.5)', { size: [1.5, 3], stretch: 3, angle: 0 });
  stoneWall(ctx, r, W * 0.03, H - 1.6 * ppm, W * 0.94, 1.6 * ppm, stone, ppm, { block: 0.8, course: 0.5 });
  // Column and upper bowl with a statue of a bird taking flight.
  stoneWall(ctx, r, W / 2 - 0.5 * ppm, H - 5 * ppm, ppm, 3.4 * ppm, stone, ppm, { block: 0.5, course: 0.4 });
  ctx.fillStyle = rgb(stone); ctx.beginPath(); ctx.ellipse(W / 2, H - 4.8 * ppm, 2.2 * ppm, 0.55 * ppm, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = rgb(shade(stone, 1.1));
  ctx.beginPath(); ctx.ellipse(W / 2, H - 5.6 * ppm, 0.7 * ppm, 0.8 * ppm, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(W / 2 - 0.4 * ppm, H - 5.9 * ppm); ctx.quadraticCurveTo(W / 2 - 2.2 * ppm, H - 7 * ppm, W / 2 - 2.6 * ppm, H - 6 * ppm); ctx.lineTo(W / 2 - 0.5 * ppm, H - 5.5 * ppm); ctx.fill();
  ctx.beginPath(); ctx.moveTo(W / 2 + 0.4 * ppm, H - 5.9 * ppm); ctx.quadraticCurveTo(W / 2 + 2.2 * ppm, H - 7 * ppm, W / 2 + 2.6 * ppm, H - 6 * ppm); ctx.lineTo(W / 2 + 0.5 * ppm, H - 5.5 * ppm); ctx.fill();
  // Falling water sheets.
  ctx.fillStyle = 'rgba(200,235,250,0.75)';
  for (const dx of [-1.9, 1.9]) { ctx.beginPath(); ctx.moveTo(W / 2 + dx * ppm * 0.95, H - 4.8 * ppm); ctx.quadraticCurveTo(W / 2 + dx * ppm * 1.6, H - 4 * ppm, W / 2 + dx * ppm * 1.8, H - 2 * ppm); ctx.lineTo(W / 2 + dx * ppm * 1.55, H - 2 * ppm); ctx.quadraticCurveTo(W / 2 + dx * ppm * 1.3, H - 4 * ppm, W / 2 + dx * ppm * 0.8, H - 4.8 * ppm); ctx.fill(); }
  sideShade(ctx, 0, H - 7 * ppm, W, 7 * ppm, 0.2);
  return { img: c, windows: [], ppm };
}

export function paintQuestBoard(seed, { ppm = 24 } = {}) {
  const r = rng(seed);
  const W = 4.6 * ppm, H = 3.6 * ppm;
  const c = canvas(W, H), ctx = c.getContext('2d');
  const wood = [0.52, 0.36, 0.22];
  ctx.fillStyle = rgb(shade(wood, 0.7)); ctx.fillRect(0.25 * ppm, 0.6 * ppm, 0.3 * ppm, H); ctx.fillRect(W - 0.55 * ppm, 0.6 * ppm, 0.3 * ppm, H);
  ctx.fillStyle = rgb(wood); ctx.fillRect(0.1 * ppm, 0.8 * ppm, W - 0.2 * ppm, 2.0 * ppm);
  for (let y = 0.8 * ppm; y < 2.8 * ppm; y += 0.4 * ppm) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(0.1 * ppm, y, W - 0.2 * ppm, 1); }
  // Little roof.
  ctx.fillStyle = rgb(ROOFS.rust);
  ctx.beginPath(); ctx.moveTo(-0.1 * ppm + 4, 0.85 * ppm); ctx.lineTo(W / 2, 0); ctx.lineTo(W + 0.1 * ppm - 4, 0.85 * ppm); ctx.closePath(); ctx.fill();
  // Notices: weathered paper, some curled.
  for (let i = 0; i < 9; i++) {
    const pw = r.range(0.55, 0.85) * ppm, ph = r.range(0.5, 0.75) * ppm;
    const px = r.range(0.25, W / ppm - 1.1) * ppm, py = r.range(0.95, 2.1) * ppm;
    ctx.save(); ctx.translate(px + pw / 2, py + ph / 2); ctx.rotate(r.range(-0.15, 0.15));
    ctx.fillStyle = rgb(mix([0.96, 0.92, 0.80], [0.86, 0.76, 0.56], r()));
    ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.moveTo(pw / 2, ph / 2); ctx.lineTo(pw / 2 - 5, ph / 2); ctx.lineTo(pw / 2, ph / 2 - 5); ctx.fill();
    for (let l = 0; l < 3; l++) { ctx.fillStyle = 'rgba(60,40,30,0.45)'; ctx.fillRect(-pw / 2 + 3, -ph / 2 + 4 + l * 4, pw * r.range(0.4, 0.8), 1.2); }
    ctx.fillStyle = rgb([0.75, 0.2, 0.2]); ctx.beginPath(); ctx.arc(0, -ph / 2 + 2, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  return { img: c, windows: [], ppm };
}

export function paintStall(seed, { ppm = 20, color = [0.80, 0.30, 0.25], goods = 'fruit' } = {}) {
  const r = rng(seed);
  const W = 4.4 * ppm, H = 3.4 * ppm;
  const c = canvas(W, H), ctx = c.getContext('2d');
  const wood = [0.55, 0.38, 0.24];
  ctx.fillStyle = rgb(shade(wood, 0.7)); ctx.fillRect(0.3 * ppm, 0.9 * ppm, 0.18 * ppm, H); ctx.fillRect(W - 0.48 * ppm, 0.9 * ppm, 0.18 * ppm, H);
  ctx.fillStyle = rgb(wood); ctx.fillRect(0.1 * ppm, H - 1.3 * ppm, W - 0.2 * ppm, 1.3 * ppm);
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(0.1 * ppm, H - 0.5 * ppm, W - 0.2 * ppm, 0.5 * ppm);
  const palettes = { fruit: [[0.9, 0.3, 0.25], [0.95, 0.7, 0.2], [0.5, 0.75, 0.3], [0.7, 0.3, 0.6]], bread: [[0.85, 0.62, 0.35], [0.75, 0.5, 0.28]], flowers: [[1, 0.6, 0.75], [1, 0.95, 0.9], [0.8, 0.6, 1], [1, 0.85, 0.3]], fish: [[0.7, 0.78, 0.85], [0.55, 0.65, 0.75]], cloth: [[0.3, 0.5, 0.7], [0.8, 0.3, 0.3], [0.9, 0.8, 0.4]] };
  const pal = palettes[goods] || palettes.fruit;
  for (let i = 0; i < 40; i++) blob(ctx, r.range(0.4, W / ppm - 0.4) * ppm, H - 1.35 * ppm - r.range(0, 0.35) * ppm, ppm * 0.16, ppm * 0.13, rgb(r.pick(pal)));
  for (let k = 0; k < 6; k++) {
    ctx.fillStyle = rgb(k % 2 ? color : [0.97, 0.95, 0.9]);
    const ax = (k / 6) * W;
    ctx.beginPath(); ctx.moveTo(ax, 0.3 * ppm); ctx.lineTo(ax + W / 6, 0.3 * ppm); ctx.lineTo(ax + W / 6, 1.0 * ppm); ctx.quadraticCurveTo(ax + W / 12, 1.3 * ppm, ax, 1.0 * ppm); ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(0, 0.3 * ppm, W, 0.15 * ppm);
  return { img: c, windows: [], ppm };
}

export function paintLamp(seed, { ppm = 24 } = {}) {
  const W = 1 * ppm, H = 3.6 * ppm;
  const c = canvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = rgb([0.22, 0.22, 0.26]);
  ctx.fillRect(W / 2 - 1.5, 0.7 * ppm, 3, H);
  ctx.fillRect(W / 2 - 5, H - 4, 10, 4);
  ctx.fillStyle = rgb([0.98, 0.85, 0.55]); ctx.fillRect(W / 2 - 0.25 * ppm, 0.2 * ppm, 0.5 * ppm, 0.6 * ppm);
  ctx.strokeStyle = rgb([0.22, 0.22, 0.26]); ctx.lineWidth = 2; ctx.strokeRect(W / 2 - 0.25 * ppm, 0.2 * ppm, 0.5 * ppm, 0.6 * ppm);
  ctx.beginPath(); ctx.moveTo(W / 2 - 0.35 * ppm, 0.22 * ppm); ctx.lineTo(W / 2, 0); ctx.lineTo(W / 2 + 0.35 * ppm, 0.22 * ppm); ctx.fill();
  return { img: c, windows: [[W / 2 - 0.25 * ppm, 0.2 * ppm, 0.5 * ppm, 0.6 * ppm]], ppm };
}

export function paintBench(seed, { ppm = 24 } = {}) {
  const W = 2.2 * ppm, H = 1.1 * ppm;
  const c = canvas(W, H), ctx = c.getContext('2d');
  const wood = [0.58, 0.40, 0.26];
  ctx.fillStyle = rgb(shade(wood, 0.6)); ctx.fillRect(3, H * 0.5, 3, H * 0.5); ctx.fillRect(W - 6, H * 0.5, 3, H * 0.5);
  ctx.fillStyle = rgb(wood); ctx.fillRect(0, H * 0.45, W, H * 0.16); ctx.fillRect(0, H * 0.05, W, H * 0.14); ctx.fillRect(0, H * 0.25, W, H * 0.12);
  return { img: c, windows: [], ppm };
}

export function paintDummy(seed, { ppm = 24 } = {}) {
  const W = 1.4 * ppm, H = 2.2 * ppm;
  const c = canvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = rgb([0.45, 0.32, 0.2]); ctx.fillRect(W / 2 - 2, 0.6 * ppm, 4, H);
  ctx.fillRect(2, 0.85 * ppm, W - 4, 3);
  blob(ctx, W / 2, 1.2 * ppm, 0.35 * ppm, 0.5 * ppm, rgb([0.85, 0.72, 0.45]));
  blob(ctx, W / 2, 0.45 * ppm, 0.28 * ppm, 0.28 * ppm, rgb([0.85, 0.72, 0.45]));
  ctx.strokeStyle = rgb([0.75, 0.2, 0.2]); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(W / 2, 1.2 * ppm, 0.18 * ppm, 0, Math.PI * 2); ctx.stroke();
  return { img: c, windows: [], ppm };
}

export function paintCrates(seed, { ppm = 24 } = {}) {
  const r = rng(seed);
  const W = 2.4 * ppm, H = 1.6 * ppm;
  const c = canvas(W, H), ctx = c.getContext('2d');
  const wood = [0.60, 0.44, 0.28];
  const box = (x, y, s) => { ctx.fillStyle = rgb(shade(wood, r.range(0.85, 1.05))); ctx.fillRect(x, y, s, s); ctx.strokeStyle = rgb(shade(wood, 0.6)); ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, s - 2, s - 2); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s, y + s); ctx.stroke(); };
  box(0, H - 0.9 * ppm, 0.9 * ppm); box(0.95 * ppm, H - 0.8 * ppm, 0.8 * ppm); box(0.3 * ppm, H - 1.6 * ppm, 0.7 * ppm);
  ctx.fillStyle = rgb([0.5, 0.34, 0.22]); ctx.beginPath(); ctx.ellipse(W - 0.35 * ppm, H - 0.5 * ppm, 0.32 * ppm, 0.5 * ppm, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = rgb([0.3, 0.3, 0.32]); ctx.fillRect(W - 0.67 * ppm, H - 0.75 * ppm, 0.64 * ppm, 2); ctx.fillRect(W - 0.67 * ppm, H - 0.3 * ppm, 0.64 * ppm, 2);
  return { img: c, windows: [], ppm };
}

// Soft rectangle of warm light used for lit windows and lanterns at night.
export function paintGlow() {
  const c = canvas(64, 64), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,214,140,1)'); g.addColorStop(0.35, 'rgba(255,180,90,0.55)'); g.addColorStop(1, 'rgba(255,150,60,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return c;
}

export { hex };
