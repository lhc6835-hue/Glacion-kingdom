// Dev page: paints a sample sheet of every procedural artist for visual review.
import * as T from '../art/trees.js';
import * as S from '../art/sky.js';
import * as A from '../art/architecture.js';
import * as C from '../art/characters.js';
import { rng } from '../art/paint.js';

const c = document.getElementById('c');
const ctx = c.getContext('2d');
const g = ctx.createLinearGradient(0, 0, 0, 720);
g.addColorStop(0, '#8fc3ee'); g.addColorStop(0.6, '#cfe6f5'); g.addColorStop(0.61, '#7fae4a'); g.addColorStop(1, '#5d8f3a');
ctx.fillStyle = g; ctx.fillRect(0, 0, 1280, 720);
const sheets = (window.SHEETS || {});
const which = new URLSearchParams(location.search).get('sheet') || 'trees';
const items = [];
if (which === 'trees') {
  const P = T.PALETTES;
  items.push(T.paintBroadleaf(1, { palette: P.oak }), T.paintBroadleaf(2, { palette: P.blossom, shape: 'wide', width: 8 }),
    T.paintBroadleaf(3, { palette: P.autumn }), T.paintBroadleaf(4, { palette: P.spring, shape: 'tall', height: 11, width: 6 }),
    T.paintConifer(5), T.paintColumn(6), T.paintBroadleaf(7, { palette: P.magenta, height: 7, width: 6 }),
    T.paintBroadleaf(8, { palette: P.deep, height: 12, width: 9 }), T.paintBroadleaf(9, { palette: P.gold }));
  const small = [T.paintBush(10), T.paintBush(11, { flowers: [1, 0.6, 0.75] }), T.paintGrassTuft(12, { flower: [1, 0.9, 0.3] }), T.paintReeds(13), T.paintRock(14), T.paintRock(15, { width: 3, height: 2 })];
  let x = 10;
  for (const it of items) { ctx.drawImage(it, x, 440 - it.height); x += it.width + 6; }
  x = 10;
  for (const it of small) { ctx.drawImage(it, x, 700 - it.height); x += it.width + 20; }
}
if (which === 'sky') {
  const a = S.paintRange(12, { peaks: 8, jag: 0.6, snow: 0.55 });
  ctx.drawImage(a, 0, 0, 1280, 375);
  const b = S.paintRange(14, { w: 1600, h: 800, peaks: 4, jag: 0.7, snow: 0.38, base: [0.68, 0.72, 0.84], shadow: [0.46, 0.52, 0.72] });
  ctx.drawImage(b, 0, 360, 640, 320);
  ctx.drawImage(S.paintCloud(41), 660, 380, 600, 270);
}
if (which === 'arch') {
  let x = 5;
  const put = (o, y = 715) => { ctx.drawImage(o.img, x, y - o.img.height); x += o.img.width + 6; };
  put(A.paintHouse(1, { width: 9, floors: 2 }));
  put(A.paintHouse(2, { width: 7, floors: 3, style: 'stone', roof: A.ROOFS.orange, sign: 'anvil' }));
  put(A.paintHouse(3, { width: 10, floors: 2, roof: A.ROOFS.rust, awning: [0.75, 0.25, 0.25], sign: 'potion' }));
  put(A.paintTower(4, { radius: 4, height: 24, banner: [0.2, 0.3, 0.6] }));
  put(A.paintTower(5, { radius: 2.5, height: 30, roof: A.ROOFS.scarlet }));
  put(A.paintHall(6, { width: 22, height: 14 }));
  x = 5;
  put(A.paintWall(7), 300); put(A.paintGatehouse(8), 300); put(A.paintBridgeSpan(9, { drop: 14 }), 300);
}
if (which === 'chars') {
  const names = Object.keys(C.LOOKS);
  names.forEach((n, i) => {
    const fr = C.paintCharacter(C.LOOKS[n]);
    const x0 = 8 + (i % 4) * 318, y0 = 4 + Math.floor(i / 4) * 178;
    [fr[0][0], fr[0][2], fr[1][0], fr[2][0], fr[2][3], fr[0][5]].forEach((img, k) => ctx.drawImage(img, x0 + k * 52, y0, img.width * 0.95, img.height * 0.95));
    const rl = C.paintCharacter(C.randomLook(rng(i + 3)));
    [rl[0][0], rl[2][1], rl[1][0]].forEach((img, k) => ctx.drawImage(img, x0 + k * 52, y0 + 78, img.width * 1.2, img.height * 1.2));
  });
}
window.__done = true;
