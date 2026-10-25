import { canvas, rgb, shade, mix, rng } from './paint.js';

// The Featherfolk of Glacion: round little birds painted as one soft body (no stitched parts).
// Facings: 0 = toward camera (south), 1 = away (north), 2 = side (west; east is mirrored).
// Frames: 0 idle, 1-4 hop cycle, 5 glide (wings spread).

export const PPM_CHAR = 48;
const W = 64, H = 72;

// Plumage species. Colours are sRGB 0..1.
export const SPECIES = {
  longtail: { name: '오목눈이', body: [0.93, 0.90, 0.88], back: [0.32, 0.27, 0.28], belly: [0.98, 0.96, 0.94], blush: [0.90, 0.66, 0.62], cap: null, cheek: null, tail: 1.5, size: 1.0 },
  tit:      { name: '박새', body: [0.56, 0.66, 0.44], back: [0.42, 0.52, 0.36], belly: [0.96, 0.86, 0.42], cap: [0.12, 0.12, 0.14], cheek: [0.98, 0.98, 0.96], stripe: [0.12, 0.12, 0.14], tail: 0.9, size: 1.0 },
  robin:    { name: '울새', body: [0.62, 0.50, 0.38], back: [0.50, 0.40, 0.30], belly: [0.95, 0.90, 0.84], breast: [0.92, 0.48, 0.24], cap: null, tail: 0.8, size: 1.05 },
  sparrow:  { name: '참새', body: [0.66, 0.50, 0.36], back: [0.52, 0.38, 0.26], belly: [0.90, 0.86, 0.78], cap: [0.52, 0.30, 0.20], cheek: [0.96, 0.94, 0.90], cheekDot: [0.15, 0.13, 0.13], tail: 0.85, size: 0.95 },
  bluebird: { name: '파랑새', body: [0.36, 0.58, 0.86], back: [0.26, 0.44, 0.74], belly: [0.94, 0.80, 0.62], cap: null, tail: 1.0, size: 1.0 },
  crow:     { name: '까마귀', body: [0.20, 0.22, 0.28], back: [0.14, 0.15, 0.20], belly: [0.30, 0.32, 0.40], cap: null, tail: 1.1, size: 1.25, beak: [0.18, 0.18, 0.2], sheen: true },
  owl:      { name: '올빼미', body: [0.70, 0.58, 0.44], back: [0.56, 0.44, 0.32], belly: [0.92, 0.86, 0.74], cap: null, tail: 0.6, size: 1.2, owl: true },
  finch:    { name: '방울새', body: [0.90, 0.76, 0.30], back: [0.62, 0.58, 0.30], belly: [0.98, 0.92, 0.60], cap: null, tail: 0.9, size: 0.9 },
  dove:     { name: '비둘기', body: [0.82, 0.82, 0.86], back: [0.66, 0.66, 0.72], belly: [0.90, 0.84, 0.86], cap: null, tail: 1.0, size: 1.1, neck: [0.55, 0.72, 0.68] },
  kingfisher: { name: '물총새', body: [0.20, 0.58, 0.72], back: [0.16, 0.48, 0.66], belly: [0.94, 0.56, 0.26], cap: [0.16, 0.42, 0.62], cheek: [0.96, 0.94, 0.90], tail: 0.6, size: 0.95, beakLong: true },
};

function softEllipse(ctx, x, y, rx, ry, inner, outer, lx = -0.35, ly = -0.4) {
  const g = ctx.createRadialGradient(x + rx * lx, y + ry * ly, Math.min(rx, ry) * 0.1, x, y, Math.max(rx, ry) * 1.05);
  g.addColorStop(0, rgb(inner));
  g.addColorStop(1, rgb(outer));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}

// Fine feather texture: short soft strokes following the body curvature.
function feathers(ctx, rand, cx, cy, rx, ry, col, n = 60, alpha = 0.22) {
  ctx.save();
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.clip();
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand());
    const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
    ctx.strokeStyle = rgb(col, alpha * (0.5 + rand() * 0.5));
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, 2.5 + rand() * 2, 0.2 + a * 0.1, 2.6 + a * 0.1); ctx.stroke();
  }
  ctx.restore();
}

export function paintCharacter(d) {
  const frames = [];
  for (let facing = 0; facing < 3; facing++) {
    const row = [];
    for (let f = 0; f < 6; f++) row.push(paintFrame(d, facing, f));
    frames.push(row);
  }
  return frames;
}

function paintFrame(d, facing, frame) {
  const sp = SPECIES[d.species] || SPECIES.sparrow;
  const rand = rng((d.seed || 1) * 31 + facing * 7);
  const c = canvas(W, H), ctx = c.getContext('2d');
  const hop = frame >= 1 && frame <= 4 ? Math.sin(((frame - 1) / 4) * Math.PI * 2) : 0;
  const lift = frame >= 1 && frame <= 4 ? Math.max(0, Math.sin(((frame - 1) / 4) * Math.PI * 2)) * 4 : 0;
  const glide = frame === 5;
  // Squash and stretch: stretched in the air, squashed on landing.
  const stretch = frame === 0 ? 1 : frame === 3 ? 0.94 : 1.03;
  const s = (sp.size || 1) * (d.scale || 1);
  const rx = 17 * s / Math.sqrt(stretch), ry = 19 * s * stretch;
  const cx = W / 2, cy = H - 8 - ry - lift;
  const side = facing === 2, back = facing === 1;

  // Legs: thin, warm grey, alternating in the hop.
  ctx.strokeStyle = rgb([0.50, 0.40, 0.36]); ctx.lineWidth = 2; ctx.lineCap = 'round';
  const footY = H - 4 - (glide ? 6 : 0);
  const legs = side ? [cx - 1 + hop * 3, cx + 3 - hop * 3] : [cx - 6, cx + 6];
  for (const [k, lx] of legs.entries()) {
    const up = !side && frame > 0 && !glide ? (k === 0 ? Math.max(0, hop) : Math.max(0, -hop)) * 3 : 0;
    ctx.beginPath(); ctx.moveTo(lx, cy + ry * 0.75); ctx.lineTo(lx, footY - up); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(lx - 3, footY - up); ctx.lineTo(lx + 3, footY - up); ctx.stroke();
  }

  // Tail.
  const tl = 16 * (sp.tail || 1) * s;
  ctx.fillStyle = rgb(shade(sp.back, 0.9));
  if (side) {
    ctx.beginPath(); ctx.moveTo(cx + rx * 0.6, cy + ry * 0.2);
    ctx.quadraticCurveTo(cx + rx + tl * 0.6, cy + ry * 0.1 - tl * 0.25, cx + rx + tl, cy - tl * 0.35);
    ctx.lineTo(cx + rx + tl - 3, cy - tl * 0.2); ctx.quadraticCurveTo(cx + rx + tl * 0.4, cy + ry * 0.45, cx + rx * 0.3, cy + ry * 0.55);
    ctx.fill();
  } else if (back) {
    ctx.beginPath(); ctx.ellipse(cx, cy + ry * 0.75, 6 * s, tl * 0.55, 0, 0, Math.PI * 2); ctx.fill();
  }

  // Wings for gliding sit behind the body.
  if (glide) {
    for (const dir of [-1, 1]) {
      ctx.fillStyle = rgb(sp.back);
      ctx.beginPath();
      ctx.moveTo(cx + dir * rx * 0.4, cy - ry * 0.3);
      ctx.quadraticCurveTo(cx + dir * (rx + 18), cy - ry * 0.9, cx + dir * (rx + 26), cy - ry * 0.2);
      for (let i = 0; i < 5; i++) ctx.lineTo(cx + dir * (rx + 24 - i * 6), cy + ry * (0.05 + (i % 2) * 0.12));
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.ellipse(cx + dir * (rx + 8), cy - ry * 0.45, 9, 3, dir * -0.3, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Body: one soft oval, back colour wrapping over the top, belly showing in front.
  const top = back ? sp.back : sp.body;
  softEllipse(ctx, cx, cy, rx, ry, mix(top, [1, 1, 0.95], 0.25), shade(top, 0.72));
  if (!back) {
    // Belly / breast.
    const bx = side ? cx - rx * 0.25 : cx, bw = side ? rx * 0.62 : rx * 0.72;
    ctx.save(); ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.clip();
    softEllipse(ctx, bx, cy + ry * 0.32, bw, ry * 0.72, mix(sp.belly, [1, 1, 1], 0.3), shade(sp.belly, 0.86));
    if (sp.breast) softEllipse(ctx, bx, cy + ry * 0.05, bw * 0.9, ry * 0.42, mix(sp.breast, [1, 0.9, 0.7], 0.25), shade(sp.breast, 0.85));
    if (sp.neck) { ctx.fillStyle = rgb(sp.neck, 0.55); ctx.beginPath(); ctx.ellipse(bx, cy - ry * 0.25, bw * 0.8, ry * 0.14, 0, 0, Math.PI * 2); ctx.fill(); }
    if (sp.stripe && !side) { ctx.fillStyle = rgb(sp.stripe); ctx.beginPath(); ctx.ellipse(cx, cy + ry * 0.25, 3.2, ry * 0.6, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  // Cap and cheeks.
  ctx.save(); ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.clip();
  if (sp.cap) { ctx.fillStyle = rgb(sp.cap); ctx.beginPath(); ctx.ellipse(cx + (side ? -2 : 0), cy - ry * 0.95, rx * 1.05, ry * 0.5, 0, 0, Math.PI * 2); ctx.fill(); }
  if (back) {
    ctx.fillStyle = rgb(shade(sp.back, 1.05));
    ctx.beginPath(); ctx.ellipse(cx, cy + ry * 0.05, rx * 0.95, ry * 0.9, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (sp.cheek && !back) {
    const cxs = side ? [cx - rx * 0.35] : [cx - rx * 0.52, cx + rx * 0.52];
    for (const x of cxs) { ctx.fillStyle = rgb(sp.cheek); ctx.beginPath(); ctx.ellipse(x, cy - ry * 0.32, rx * 0.36, ry * 0.22, 0, 0, Math.PI * 2); ctx.fill(); }
    if (sp.cheekDot) for (const x of cxs) { ctx.fillStyle = rgb(sp.cheekDot); ctx.beginPath(); ctx.arc(x + (side ? 0 : 0), cy - ry * 0.28, 2.4, 0, Math.PI * 2); ctx.fill(); }
  }
  if (sp.owl && !back) {
    // Facial disc.
    for (const x of side ? [cx - rx * 0.3] : [cx - rx * 0.36, cx + rx * 0.36]) softEllipse(ctx, x, cy - ry * 0.3, rx * 0.42, ry * 0.34, [0.98, 0.94, 0.86], [0.84, 0.74, 0.60]);
  }
  feathers(ctx, rand, cx, cy, rx, ry, shade(top, 0.55), 70, 0.18);
  ctx.restore();

  // Folded wing on the visible side(s).
  if (!glide) {
    const wings = side ? [[cx + rx * 0.15, 1]] : back ? [[cx - rx * 0.62, -1], [cx + rx * 0.62, 1]] : [[cx - rx * 0.86, -1], [cx + rx * 0.86, 1]];
    for (const [wx, dir] of wings) {
      const flap = frame >= 1 && frame <= 4 ? Math.max(0, hop) * 0.3 : 0;
      ctx.save(); ctx.translate(wx, cy + ry * 0.05); ctx.rotate(dir * (0.12 + flap));
      const ww = side ? rx * 0.75 : rx * 0.32, wh = ry * 0.62;
      softEllipse(ctx, 0, 0, ww, wh, shade(sp.back, 1.15), shade(sp.back, 0.75), -0.4, -0.5);
      ctx.strokeStyle = rgb(shade(sp.back, 0.6), 0.55); ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, wh * 0.2 + i * 4, ww * 0.85, 0.3, Math.PI - 0.3); ctx.stroke(); }
      ctx.restore();
    }
  }

  // Face.
  if (!back) {
    const eyeY = cy - ry * 0.3;
    const eyes = side ? [cx - rx * 0.48] : [cx - rx * 0.34, cx + rx * 0.34];
    for (const ex of eyes) {
      const er = sp.owl ? 4.2 : 3.2;
      ctx.fillStyle = sp.owl ? 'rgb(250,200,60)' : rgb([0.08, 0.07, 0.09]);
      ctx.beginPath(); ctx.ellipse(ex, eyeY, er, er * 1.15, 0, 0, Math.PI * 2); ctx.fill();
      if (sp.owl) { ctx.fillStyle = rgb([0.08, 0.07, 0.09]); ctx.beginPath(); ctx.arc(ex, eyeY, 2.4, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath(); ctx.arc(ex - 1.1, eyeY - 1.3, 1.25, 0, Math.PI * 2); ctx.fill();
    }
    // Blush.
    if (!sp.owl) for (const ex of eyes) { ctx.fillStyle = rgb(sp.blush || [0.95, 0.6, 0.6], 0.35); ctx.beginPath(); ctx.ellipse(ex + (side ? -1 : 0), eyeY + 6, 3.5, 2, 0, 0, Math.PI * 2); ctx.fill(); }
    // Beak.
    const beak = sp.beak || [0.92, 0.70, 0.32];
    ctx.fillStyle = rgb(beak);
    if (side) {
      const bl = sp.beakLong ? 12 : 6;
      ctx.beginPath(); ctx.moveTo(cx - rx * 0.86, eyeY + 1); ctx.lineTo(cx - rx * 0.86 - bl, eyeY + 3.5); ctx.lineTo(cx - rx * 0.82, eyeY + 6); ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath(); ctx.moveTo(cx - 3.2, eyeY + 3); ctx.lineTo(cx + 3.2, eyeY + 3); ctx.lineTo(cx, eyeY + (sp.beakLong ? 10 : 7.5)); ctx.closePath(); ctx.fill();
    }
  }

  // Accessories: drawn last, sitting naturally on the round head.
  const headY = cy - ry * 0.78;
  if (d.hat === 'helm') {
    softEllipse(ctx, cx, headY + 1, rx * 0.8, 7, [0.86, 0.88, 0.92], [0.52, 0.55, 0.62]);
    ctx.fillStyle = rgb([0.45, 0.48, 0.55]); ctx.fillRect(cx - rx * 0.8, headY + 4, rx * 1.6, 2.5);
    if (d.plume) { ctx.fillStyle = rgb(d.plume); ctx.beginPath(); ctx.ellipse(cx + 3, headY - 8, 3, 7, 0.4, 0, Math.PI * 2); ctx.fill(); }
  } else if (d.hat === 'wizard') {
    ctx.fillStyle = rgb(d.hatColor || [0.32, 0.24, 0.52]);
    ctx.beginPath(); ctx.ellipse(cx, headY + 3, rx * 0.95, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - rx * 0.6, headY + 2); ctx.quadraticCurveTo(cx - 2, headY - 14, cx + 9, headY - 22); ctx.quadraticCurveTo(cx + 2, headY - 8, cx + rx * 0.6, headY + 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,225,120,0.95)'; ctx.beginPath(); ctx.arc(cx + 1, headY - 6, 1.8, 0, Math.PI * 2); ctx.fill();
  } else if (d.hat === 'beret') {
    softEllipse(ctx, cx - 3, headY + 1, rx * 0.75, 5.5, mix(d.hatColor || [0.7, 0.2, 0.2], [1, 1, 1], 0.2), shade(d.hatColor || [0.7, 0.2, 0.2], 0.7));
  } else if (d.hat === 'straw') {
    softEllipse(ctx, cx, headY + 3, rx * 1.15, 4, [0.95, 0.84, 0.55], [0.75, 0.62, 0.35]);
    softEllipse(ctx, cx, headY - 1, rx * 0.55, 5, [0.95, 0.84, 0.55], [0.75, 0.62, 0.35]);
    ctx.fillStyle = rgb(d.hatColor || [0.75, 0.3, 0.3]); ctx.fillRect(cx - rx * 0.55, headY + 1, rx * 1.1, 2);
  } else if (d.hat === 'crown') {
    ctx.fillStyle = rgb([0.96, 0.80, 0.30]);
    ctx.beginPath(); ctx.moveTo(cx - 8, headY + 3);
    for (let i = 0; i <= 4; i++) ctx.lineTo(cx - 8 + i * 4, headY - (i % 2 ? 2 : 7));
    ctx.lineTo(cx + 8, headY + 3); ctx.fill();
  } else if (d.hat === 'hood') {
    ctx.fillStyle = rgb(d.hatColor || [0.9, 0.88, 0.82]);
    ctx.beginPath(); ctx.ellipse(cx, headY + 4, rx * 0.9, 9, 0, Math.PI, Math.PI * 2); ctx.fill();
  }
  if (d.scarf && !back) {
    ctx.fillStyle = rgb(d.scarf);
    ctx.beginPath(); ctx.ellipse(cx + (side ? -2 : 0), cy - ry * 0.02, rx * (side ? 0.8 : 0.85), 3.6, 0, 0, Math.PI * 2); ctx.fill();
    if (!side) { ctx.beginPath(); ctx.moveTo(cx + 4, cy); ctx.lineTo(cx + 9, cy + 9); ctx.lineTo(cx + 3, cy + 8); ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(cx + rx * 0.5, cy - 1); ctx.quadraticCurveTo(cx + rx + 6, cy - 2 - hop * 2, cx + rx + 10, cy + 2 - hop * 3); ctx.lineTo(cx + rx * 0.6, cy + 3); ctx.fill(); }
  }
  if (d.apron && !back) {
    ctx.fillStyle = rgb(d.apron, 0.95);
    ctx.beginPath(); ctx.ellipse(cx + (side ? -rx * 0.3 : 0), cy + ry * 0.38, rx * 0.5, ry * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (d.satchel) {
    ctx.fillStyle = rgb([0.55, 0.38, 0.22]);
    ctx.beginPath(); ctx.ellipse(cx + (back ? -rx * 0.5 : rx * 0.62), cy + ry * 0.35, 5, 6, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (d.weapon === 'sword' && !glide) {
    ctx.fillStyle = rgb([0.84, 0.87, 0.92]);
    ctx.save(); ctx.translate(cx + (side ? rx * 0.4 : rx * 0.75), cy + ry * 0.1); ctx.rotate(side ? 0.9 : 0.35);
    ctx.fillRect(-1, -2, 2.5, 17); ctx.fillStyle = rgb([0.55, 0.36, 0.22]); ctx.fillRect(-3, -3, 6.5, 2.5);
    ctx.restore();
  } else if (d.weapon === 'spear') {
    ctx.fillStyle = rgb([0.5, 0.35, 0.2]); ctx.fillRect(cx + rx + 1, 4, 2.2, H - 10);
    ctx.fillStyle = rgb([0.85, 0.87, 0.92]); ctx.beginPath(); ctx.moveTo(cx + rx + 2, 0); ctx.lineTo(cx + rx + 5.5, 8); ctx.lineTo(cx + rx - 1.5, 8); ctx.fill();
  } else if (d.weapon === 'staff') {
    ctx.fillStyle = rgb([0.45, 0.32, 0.2]); ctx.fillRect(cx + rx + 1, 10, 2.4, H - 14);
    ctx.fillStyle = 'rgba(140,220,255,0.95)'; ctx.beginPath(); ctx.arc(cx + rx + 2.2, 9, 3.6, 0, Math.PI * 2); ctx.fill();
  }
  return c;
}

// Featherfolk roles.
export const LOOKS = {
  hero: { species: 'bluebird', scarf: [0.90, 0.30, 0.25], satchel: true, weapon: 'sword', seed: 1 },
  guard: { species: 'crow', hat: 'helm', plume: [0.85, 0.2, 0.2], weapon: 'spear', seed: 2 },
  smith: { species: 'robin', apron: [0.36, 0.26, 0.20], seed: 3 },
  alchemist: { species: 'tit', hat: 'hood', hatColor: [0.40, 0.58, 0.44], seed: 4 },
  mage: { species: 'owl', hat: 'wizard', weapon: 'staff', seed: 5 },
  merchant: { species: 'sparrow', hat: 'beret', hatColor: [0.62, 0.22, 0.20], satchel: true, seed: 6 },
  innkeeper: { species: 'dove', apron: [0.96, 0.94, 0.88], scarf: [0.95, 0.75, 0.35], seed: 7 },
  noble: { species: 'longtail', scarf: [0.55, 0.20, 0.35], seed: 8 },
  scholar: { species: 'owl', scarf: [0.30, 0.36, 0.56], seed: 9 },
  priest: { species: 'dove', hat: 'hood', hatColor: [0.96, 0.94, 0.90], seed: 10 },
  farmer: { species: 'sparrow', hat: 'straw', seed: 11 },
  fisher: { species: 'kingfisher', hat: 'straw', hatColor: [0.3, 0.5, 0.7], seed: 12 },
  child: { species: 'finch', scale: 0.8, seed: 13 },
  adventurer: { species: 'tit', scarf: [0.36, 0.52, 0.32], satchel: true, weapon: 'sword', seed: 14 },
  king: { species: 'longtail', hat: 'crown', scarf: [0.55, 0.15, 0.25], scale: 1.1, seed: 15 },
};

const TOWNS_SPECIES = ['longtail', 'tit', 'robin', 'sparrow', 'sparrow', 'bluebird', 'finch', 'dove', 'kingfisher'];
export function randomLook(rand) {
  const scarves = [[0.85, 0.32, 0.28], [0.30, 0.48, 0.70], [0.42, 0.62, 0.38], [0.90, 0.75, 0.35], [0.58, 0.42, 0.66], [0.95, 0.92, 0.85]];
  return {
    species: rand.pick(TOWNS_SPECIES), seed: Math.floor(rand() * 1000),
    scarf: rand.chance(0.45) ? rand.pick(scarves) : null,
    hat: rand.pick([null, null, null, 'beret', 'straw', 'hood']), hatColor: rand.pick(scarves),
    apron: rand.chance(0.12) ? [0.94, 0.92, 0.86] : null, satchel: rand.chance(0.2),
    scale: 0.92 + rand() * 0.16,
  };
}
