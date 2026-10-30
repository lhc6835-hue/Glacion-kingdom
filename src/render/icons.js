// Item previews for menus: scoops, molds, faces and weapons drawn into small canvases.
// Weapons reuse their real in-game draw code on a stand-in owner, so menus match the battle.
import { scoopSprite } from './scoopArt.js';
import { drawSprite } from './sprite.js';
import { IceCreamRig } from './icecream.js';
import { makeWeapon } from '../game/weapons.js';
import { WEAPON } from '../../shared/weapons.js';
import { MOLD } from '../../shared/molds.js';
import { drawFace } from './face.js';

const cache = new Map();

export function iconCanvas(kind, id, size = 96) {
  const key = kind + ':' + id + ':' + size;
  const dpr = Math.min(2, devicePixelRatio || 1);
  let src = cache.get(key);
  if (!src) {
    src = document.createElement('canvas');
    src.width = src.height = Math.round(size * dpr);
    const g = src.getContext('2d');
    g.scale(dpr, dpr);
    g.imageSmoothingQuality = 'high';
    DRAW[kind](g, id, size);
    cache.set(key, src);
  }
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  c.style.width = c.style.height = size + 'px';
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}

export function moldPreviewRig(moldId, flavors, face = 'smile') {
  const n = MOLD[moldId].layers;
  const fl = [];
  for (let i = 0; i < n; i++) fl.push(flavors[i % flavors.length]);
  return new IceCreamRig({ mold: moldId, flavors: fl, face });
}

const DRAW = {
  flavor(g, id, s) {
    g.translate(s / 2, s * 0.56);
    const k = s / 70;
    g.scale(k, k);
    drawSprite(g, scoopSprite(id));
  },
  mold(g, id, s) {
    const rig = moldPreviewRig(id, ['milk']);
    const h = -rig.topY();
    const k = Math.min((s * 0.86) / h, s / 80);
    rig.draw(g, s / 2, s * 0.95, k, { shadow: false });
  },
  face(g, id, s) {
    g.translate(s / 2, s * 0.56);
    const k = s / 56;
    g.scale(k, k);
    drawSprite(g, scoopSprite('milk'));
    drawFace(g, id, 0, -3, 24, {});
  },
  weapon(g, id, s) {
    const def = WEAPON[id] || WEAPON.spoon;
    const owner = {
      x: 0, y: 0, aim: -0.55, scaleK: 1,
      stats: { area: 1, proj: 0, pierce: 0, dmg: 1, atk: 1, weaponMul: 1 },
      rig: { look: { flavors: ['strawberry'] }, punch() {}, squash: { kick() {}, target: 1 } },
      lunge() {}, layers: [],
    };
    const fakeA = { queryCircle() {}, querySegment() {}, aimPoint: () => ({ x: 70, y: -40 }), fx: { dot() {}, ring() {}, burst() {}, puff() {}, decal() {} }, addProj() {}, addArea() {}, nearestEnemy: () => null, explode() {}, shake() {}, hitstop() {} };
    const w = makeWeapon(def, owner);
    w.ang.snap(-0.55);
    for (let i = 0; i < 40; i++) w.update(1 / 60, fakeA, false, false);
    if (w.cx !== undefined) { w.cx = 30; w.cy = 40; }
    g.translate(s * 0.3, s * 0.68);
    const k = s / (def.kind === 'cloud' ? 190 : def.kind === 'whip' || def.kind === 'thrust' ? 150 : 110);
    g.scale(k, k);
    g.translate(0, 30);
    w.draw(g);
  },
};
