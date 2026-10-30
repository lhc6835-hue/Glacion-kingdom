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
// len < 1 foreshortens the shaft (the axe pointing at the camera mid-swing); flip mirrors the
// blade to the other side of the shaft so it always hangs below a horizontal swing.
export function drawAxe(g, hx, hy, th, axe, scale = 1, alpha = 1, len = 1, flip = false) {
  const s = axeSprite(axe);
  g.save();
  g.translate(hx, hy);
  g.rotate(th);
  if (scale !== 1 || len !== 1 || flip) g.scale(scale * (flip ? -1 : 1), scale * len);
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
  g.translate(x + (pose.lunge || 0) * dir, y + 1);
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
  // hand: anchored at the shoulder; the player drives its path (back for the wind-up, around the
  // front for the side chop). Older poses without a hand fall back to the belt position.
  const ang = pose.axeAngle ?? 0.6;
  const sx = -sw / 2 + 9, sy = top + 13;
  const hx = sx + (pose.hand ? pose.hand.x : 5.5), hy = sy + (pose.hand ? pose.hand.y : 1.5);
  const len = pose.axeLen ?? 1, depth = pose.axeDepth ?? 1, bflip = !!pose.bladeFlip;
  const swoosh = () => {
    // crescent of the side swing, sweeping around the front of the body
    const w = pose.swoosh;
    if (!w || w.a <= 0.02) return;
    const end = Math.PI - Math.PI * w.p;
    g.save();
    g.lineCap = 'round';
    for (const [lw, col, al] of [[5, w.col, 0.35], [2.6, w.col, 0.75], [1.1, '#ffffff', 0.95]]) {
      g.strokeStyle = col; g.globalAlpha = w.a * al; g.lineWidth = lw;
      g.beginPath(); g.ellipse(sx + 1, sy - 1, 14, 4.5, -0.06, Math.PI, Math.min(Math.PI, end), true); g.stroke();
    }
    g.restore();
  };
  const tool = () => {
    if (pose.axeOnBack) { drawAxe(g, -4, top + 15, -2.5, axe, 0.9); return; }
    if (pose.smear > 0.15) for (let i = 1; i <= 2; i++) drawAxe(g, hx - i * 2.2, hy, ang, axe, depth, 0.28 - i * 0.1, len, bflip);
    drawAxe(g, hx, hy, ang, axe, depth, 1, len, bflip);
  };
  // behind the body while cocked back or swinging around the far side
  const behind = pose.axeOnBack || pose.axeBehind || (!pose.hand && ang < -0.35);
  if (behind) tool();
  g.drawImage(spr, -sw / 2, top);
  swoosh();
  if (!behind) tool();
  g.restore();
}
