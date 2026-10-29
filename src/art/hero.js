// The chibi lumberjack: a 16-column letter-grid sprite (big head, tiny body) with an outline and
// auto shading, plus an axe sprite rotated in the hand and a spring-driven scarf tail.
// (x, y) is the point between the feet; coordinates are art pixels.
import { buildSprite, OUTLINE } from '../gfx/Sprite.js';

// Knit cap with a leaf sprig and a ribbed cuff; the face looks right.
const HEAD = [
  '.......ff.......',
  '.....vvfvvv.....',
  '...vvVVvvvvvv...',
  '..vVVvvvvvvvvv..',
  '..vVvvvvvvvvvv..',
  '.vvvvvvvvvvvvvv.',
  '.jJjJjJjJjJjJjJ.',
  '.hhhhhhhhhhhhhh.',
];
const FACE = {
  open: ['hhhhcccccccccch.', 'hhhhcccEecccEec.', '.hhhccceeccceec.'],
  blink: ['hhhhcccccccccch.', 'hhhhccccccccccc.', '.hhhccceeccceec.'],
};
const LOW = { calm: ['..hhccclccmclcc.', '....ccccccccc...'], shout: ['..hhccclcmmclcc.', '....cccccmccc...'] };
const BODY = ['.....rrrrrrr....', '....rrtttttttc..', '.....tnnynnt....'];
const LEGS = { stand: '.....kk..kk.....', a: '....kk....kk....', b: '......kkkk......', jump: '....kk...kk.....' };

const cache = new Map();
function heroSprite(face, legs, tail, mouth) {
  const key = face + legs + tail + mouth;
  let s = cache.get(key);
  if (!s) {
    const fc = FACE[face].slice();
    // idle hair sway: the back lock moves down a row
    if (tail) { fc[0] = '.' + fc[0].slice(1); fc[2] = 'h' + fc[2].slice(1); }
    s = buildSprite([...HEAD, ...fc, ...LOW[mouth], ...BODY, LEGS[legs]]);
    cache.set(key, s);
  }
  return s;
}

// Axe head on the forward side of the shaft; the hand grips row 8.5, column 5.5.
const AXE = [
  '....zaa....',
  '.....nAaa..',
  '.....naAAa.',
  '.....naaaAa',
  '.....naaaaa',
  '.....naaa1.',
  '.....n.....',
  '.....n.....',
  '.....n.....',
  '.....N.....',
];
const axeCache = new Map();
function axeSprite(axe) {
  const key = axe.blade + axe.accent;
  let s = axeCache.get(key);
  if (!s) { s = buildSprite(AXE, axe.blade, { n: '#b48450', z: axe.accent }); axeCache.set(key, s); }
  return s;
}

// Draws the axe with its grip at (hx, hy), rotated by th (0 = head up, + = forward).
export function drawAxe(g, hx, hy, th, axe, scale = 1, alpha = 1) {
  const s = axeSprite(axe);
  g.save();
  g.translate(hx, hy);
  g.rotate(th);
  if (scale !== 1) g.scale(scale, scale);
  g.globalAlpha *= alpha;
  g.drawImage(s, -6.5, -9);
  g.restore();
}

// pose: { walkFrame, moving, onGround, blink, tail, axeAngle, axeOnBack, sq, rot, bob, sway, breathe, scarfA, faceS, mouth, smear }
// Meant for a context scaled up to screen pixels: squash, tilt and position are fractional, so the
// art keeps its square pixels while the motion stays smooth.
export function drawHero(g, x, y, facing, pose, axe) {
  const legs = !pose.onGround ? 'jump' : pose.moving ? ['a', 'stand', 'b', 'stand'][pose.walkFrame] : 'stand';
  const spr = heroSprite(pose.blink ? 'blink' : 'open', legs, pose.tail ? 1 : 0, pose.mouth ? 'shout' : 'calm');
  const sw = spr.width, sh = spr.height;
  const sq = pose.sq || 0, br = pose.breathe || 0;
  const fs = pose.faceS ?? facing;
  const dir = Math.sign(fs || 1);
  const flip = Math.abs(fs) < 0.12 ? 0.12 * dir : fs; // paper-flip turn
  g.save();
  g.imageSmoothingEnabled = false;
  // contact shadow widens when squashed, shrinks in the air
  g.fillStyle = 'rgba(0,0,0,0.32)';
  const shw = 13 * (1 - sq * 0.8) * (pose.onGround ? 1 : 0.7);
  g.fillRect(x - shw / 2, y, shw, 1);
  g.translate(x, y + 1);
  g.rotate(((pose.rot || 0) + (pose.sway || 0)) * dir);
  g.scale((1 - sq * 0.6 - br * 0.6) * flip, 1 + sq + br);
  const top = -sh + (pose.bob || 0);
  // scarf tail: four pixels trailing from the neck, outlined
  const nx = -sw / 2 + 6, ny = top + 13.5;
  const sa = pose.scarfA ?? 1.2;
  for (const [col, ext] of [[OUTLINE, 1], ['#d8503e', 0]]) {
    g.fillStyle = col;
    for (let i = 1; i <= 4; i++) {
      const a = sa + i * 0.1;
      const px = nx - Math.cos(a) * i * 1.1, py = ny + Math.sin(a) * i * 1.1;
      g.fillRect(px - 0.5 - ext * 0.5, py - 0.5 - ext * 0.5, 1 + ext, 1 + ext);
    }
  }
  // hand: rests at the belt, rises over the head while winding up, drops forward on impact
  const ang = pose.axeAngle ?? 0.6;
  const up = Math.max(0, Math.min(1, (0.6 - ang) / 1.85));
  const fwd = Math.max(0, Math.min(1, (ang - 0.6) / 0.9));
  const hx = -sw / 2 + 14.5 - up * 5 + fwd * 2, hy = top + 14.5 - up * 11 + fwd * 1;
  const tool = () => {
    if (pose.axeOnBack) { drawAxe(g, -4, top + 15, -2.5, axe, 0.9); return; }
    if (pose.smear > 0.15) for (let i = 1; i <= 3; i++) drawAxe(g, hx, hy, ang - 0.36 * i * pose.smear, axe, 1, 0.3 - i * 0.08);
    drawAxe(g, hx, hy, ang, axe);
  };
  const behind = pose.axeOnBack || ang < -0.35;
  if (behind) tool();
  g.drawImage(spr, -sw / 2, top);
  if (!behind) tool();
  g.restore();
}
