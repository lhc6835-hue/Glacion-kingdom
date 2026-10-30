import { IceCreamRig } from '../render/icecream.js';
import { MOLDS } from '../../shared/molds.js';
import { FLAVORS } from '../../shared/flavors.js';
import { FACES } from '../../shared/faces.js';
import { drawEnemyFrame, ENEMY_ART_TYPES } from '../render/enemyArt.js';
const c = document.getElementById('c');
const W = 1600, H = 1200;
c.width = W; c.height = H;
const g = c.getContext('2d');
const mode = new URLSearchParams(location.search).get('m') || 'molds';
const rigs = [];
if (mode === 'molds') {
  MOLDS.forEach((m, i) => {
    const fl = [];
    for (let k = 0; k < m.layers; k++) fl.push(FLAVORS[(i * 3 + k * 7) % FLAVORS.length].id);
    rigs.push({ rig: new IceCreamRig({ mold: m.id, flavors: fl, face: FACES[i % FACES.length].id }), x: 90 + (i % 9) * 172, y: 330 + Math.floor(i / 9) * 390, label: m.name });
  });
} else if (mode === 'flavors') {
  FLAVORS.forEach((f, i) => rigs.push({ rig: new IceCreamRig({ mold: 'papercup', flavors: [f.id], face: 'smile' }), x: 60 + (i % 14) * 110, y: 170 + Math.floor(i / 14) * 260, label: f.name }));
} else if (mode === 'cups') {
  [['papercup', ['strawberry']], ['minicup', ['mintchoco']], ['gelatocup', ['vanilla', 'chocolate', 'mango']], ['wafflebowl', ['cookie', 'ube']], ['bingsu', ['redbean', 'milk', 'mango']], ['affogato', ['vanilla', 'coffee']], ['waffle', ['strawberry', 'vanilla', 'chocolate']], ['glass', ['pistachio', 'cherry']]].forEach(([m, f], i) => rigs.push({ rig: new IceCreamRig({ mold: m, flavors: f, face: 'smile' }), x: 200 + (i % 4) * 400, y: 520 + Math.floor(i / 4) * 560, label: m, s: 2.6 }));
} else if (mode === 'enemies') {
  ENEMY_ART_TYPES.forEach((t, i) => { const big = t.endsWith('boss') || t.endsWith('king') || t.endsWith('queen'); rigs.push({ enemy: t, size: big ? 70 : t === 'ember' ? 14 : t === 'magma' ? 34 : 22, x: 120 + (i % 6) * 250, y: 200 + Math.floor(i / 6) * 400, label: t }); });
} else {
  FACES.forEach((f, i) => rigs.push({ rig: new IceCreamRig({ mold: 'waffle', flavors: ['vanilla', 'strawberry'], face: f.id }), x: 110 + (i % 7) * 210, y: 330 + Math.floor(i / 7) * 360, label: f.name, s: 1.6 }));
}
function frame() {
  g.fillStyle = '#d9f2e4'; g.fillRect(0, 0, W, H);
  for (const r of rigs) {
    if (r.enemy) { g.save(); g.translate(r.x, r.y); drawEnemyFrame(g, r.enemy, r.size, performance.now() / 900, 0); g.restore(); g.fillStyle = '#3a2a30'; g.font = '18px Jua'; g.textAlign = 'center'; g.fillText(r.label, r.x, r.y + r.size * 2); continue; }
    r.rig.update(1 / 60, {});
    r.rig.draw(g, r.x, r.y, r.s || 1.2);
    g.fillStyle = '#3a2a30'; g.font = '18px Jua'; g.textAlign = 'center'; g.fillText(r.label, r.x, r.y + 28);
  }
  requestAnimationFrame(frame);
}
frame();
