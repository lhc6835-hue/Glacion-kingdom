// Faces: two small dot eyes set close together, and a simple hand-drawn mouth.
// Drawn live (not baked) so the face can look around, blink and react.
import { TAU } from '../core/math.js';
import { FACE } from '../../shared/faces.js';
import { star } from './scoopArt.js';

const INK = '#2b1c1e';

// (x, y) is the face centre; r the scoop radius; look in [-1, 1]; mood: 0 normal, 1 hurt, 2 happy
export function drawFace(g, faceId, x, y, r, { lookX = 0, lookY = 0, blink = 0, mood = 0, t = 0 } = {}) {
  const f = FACE[faceId] || FACE.smile;
  const u = (r / 24) * 1.22;
  g.save();
  g.translate(x + lookX * 5 * u, y + lookY * 3 * u);
  g.scale(u, u);
  g.lineCap = 'round';
  g.lineJoin = 'round';

  if (f.extra === 'blush' || mood === 2) {
    g.fillStyle = 'rgba(255,120,150,0.35)';
    g.beginPath(); g.ellipse(-10.5, 1, 3.6, 2.2, 0, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(10.5, 1, 3.6, 2.2, 0, 0, TAU); g.fill();
  }

  // eyes
  const ey = -4.6, ex = 3.6, er = 1.85;
  g.fillStyle = INK;
  const shake = mood === 1 ? Math.sin(t * 60) * 0.5 : 0;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(s * ex + shake, ey, er, er * Math.max(0.18, 1 - blink), 0, 0, TAU);
    g.fill();
  }

  g.strokeStyle = INK;
  g.fillStyle = INK;
  g.lineWidth = 1.9;
  const mouth = mood === 1 ? 'triangle' : f.mouth;
  g.save();
  g.translate(0, 1.4);
  drawMouth(g, mouth);
  g.restore();

  switch (f.extra) {
    case 'drool':
      g.fillStyle = '#8fd8ff';
      g.beginPath(); g.moveTo(5.5, 3.5); g.quadraticCurveTo(7.6, 7.4 + Math.sin(t * 3), 5.5, 8 + Math.sin(t * 3)); g.quadraticCurveTo(3.6, 7.2, 5.5, 3.5); g.fill();
      break;
    case 'sparkle':
      star(g, 8.5, -8.5, 2.4 + Math.sin(t * 5) * 0.6, '#ffffff');
      break;
    case 'sweat':
      g.fillStyle = '#9fdcff';
      g.beginPath(); g.moveTo(11, -12); g.quadraticCurveTo(14, -7, 11.5, -5.5); g.quadraticCurveTo(8.8, -6.5, 11, -12); g.fill();
      break;
    case 'stars':
      for (let i = 0; i < 3; i++) {
        const a = t * 1.5 + (i / 3) * TAU;
        star(g, Math.cos(a) * 15, -6 + Math.sin(a) * 5, 1.6, '#ffe27a');
      }
      break;
  }
  g.restore();
}

function drawMouth(g, m) {
  g.beginPath();
  switch (m) {
    case 'hook': // a U-shaped smile with a little upturn at the right end
      g.moveTo(-7, 0.2);
      g.bezierCurveTo(-6.6, 5.6, 5, 6.2, 6.4, 0.6);
      g.quadraticCurveTo(7, -1.6, 6.2, -2.6);
      g.stroke();
      break;
    case 'triangle':
      g.moveTo(-4.4, 0.6);
      g.lineTo(3.6, -0.6);
      g.lineTo(-0.6, 6.2);
      g.closePath();
      g.fill(); g.stroke();
      g.beginPath(); g.moveTo(3.6, -0.6); g.lineTo(4.4, -1.8); g.stroke();
      break;
    case 'curl': // little loop on the left flowing into a hump that curls down
      g.moveTo(-1.6, 1.2);
      g.bezierCurveTo(-3.4, -1.4, -7.6, 0, -6.8, 3.2);
      g.bezierCurveTo(-6.1, 5.8, -1.8, 5.4, -0.6, 2.4);
      g.bezierCurveTo(0.6, -0.6, 5.6, -0.8, 6.6, 2.2);
      g.quadraticCurveTo(7.2, 4.8, 4.8, 4.6);
      g.stroke();
      break;
    case 'flat':
      g.moveTo(-4.5, 2); g.lineTo(4.5, 2); g.stroke();
      break;
    case 'o':
      g.ellipse(0, 2.4, 2.4, 2.8, 0, 0, TAU); g.stroke();
      break;
    case 'cat':
      g.moveTo(-6, 0.8); g.quadraticCurveTo(-3, 5, 0, 1.2); g.quadraticCurveTo(3, 5, 6, 0.8); g.stroke();
      break;
    case 'frown':
      g.moveTo(-5, 4); g.quadraticCurveTo(0, -0.6, 5, 4); g.stroke();
      break;
    case 'd':
      g.moveTo(-5.6, 0.4); g.lineTo(5.6, 0.4); g.bezierCurveTo(5.4, 7.6, -5.4, 7.6, -5.6, 0.4); g.fill(); g.stroke();
      g.fillStyle = '#ff8fa8'; g.beginPath(); g.ellipse(0, 4.4, 2.6, 1.3, 0, 0, TAU); g.fill();
      break;
    case 'wave':
      g.moveTo(-6.5, 2); g.quadraticCurveTo(-4.8, -0.4, -3.2, 2); g.quadraticCurveTo(-1.6, 4.4, 0, 2); g.quadraticCurveTo(1.6, -0.4, 3.2, 2); g.quadraticCurveTo(4.8, 4.4, 6.5, 2); g.stroke();
      break;
    case 'smirk':
      g.moveTo(-5, 2.6); g.quadraticCurveTo(1, 4.6, 5.6, -0.4); g.stroke();
      break;
    case 'tongue':
      g.moveTo(-6, 0.6); g.quadraticCurveTo(0, 5, 6, 0.6); g.stroke();
      g.fillStyle = '#ff7f9f';
      g.beginPath(); g.moveTo(-0.6, 2.8); g.quadraticCurveTo(-0.4, 7.6, 2.4, 7.2); g.quadraticCurveTo(4.6, 6.6, 3.8, 2.4); g.fill();
      break;
    case 'kiss':
      g.moveTo(-1, -0.4); g.quadraticCurveTo(3, 0.4, 0.4, 2); g.quadraticCurveTo(3.4, 3.2, -0.6, 4.6); g.stroke();
      break;
    case 'tooth':
      g.moveTo(-6.4, 0.6); g.quadraticCurveTo(0, 5.4, 6.4, 0.6); g.stroke();
      g.fillStyle = '#ffffff'; g.strokeStyle = '#2b1c1e'; g.lineWidth = 1.1;
      g.beginPath(); g.rect(-1.8, 2.8, 3.4, 3); g.fill(); g.stroke();
      break;
    case 'big':
      g.ellipse(0, 3.2, 5.4, 4.6, 0, 0, TAU); g.fill();
      g.fillStyle = '#ff8fa8'; g.beginPath(); g.ellipse(0, 5.4, 3.2, 1.8, 0, 0, TAU); g.fill();
      break;
  }
}

// Little golden crown for the OG face, drawn above the top scoop.
export function drawCrown(g, x, y, r) {
  const u = r / 24;
  g.save();
  g.translate(x, y);
  g.scale(u, u);
  g.fillStyle = '#f6c544';
  g.strokeStyle = '#a8741c';
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(-9, 0); g.lineTo(-10, -9); g.lineTo(-4.5, -4); g.lineTo(0, -11); g.lineTo(4.5, -4); g.lineTo(10, -9); g.lineTo(9, 0); g.closePath();
  g.fill(); g.stroke();
  g.fillStyle = '#ff6f91'; g.beginPath(); g.arc(0, -3.6, 1.7, 0, TAU); g.fill();
  g.restore();
}
