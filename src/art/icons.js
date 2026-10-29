// 16×16 pixel icons for the HTML UI, rendered once to data URLs and shown with pixelated scaling.
import { makeCanvas } from '../gfx/PixBuf.js';
import { drawAxe } from './hero.js';
import { ITEMS } from '../data/items.js';
import { AXE_BY_ID } from '../data/axes.js';
import { GRADES } from '../data/grades.js';
import { PAL } from './palette.js';

const cache = new Map();

function icon(key, size, paint) {
  let u = cache.get(key);
  if (!u) {
    const c = makeCanvas(size, size);
    paint(c.getContext('2d'));
    u = c.toDataURL();
    cache.set(key, u);
  }
  return u;
}

const R = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

export function itemIcon(id) {
  return icon('i:' + id, 16, (g) => {
    if (id === 'gold') { R(g, 4, 4, 8, 8, '#a8781a'); R(g, 5, 3, 6, 10, '#a8781a'); R(g, 3, 5, 10, 6, '#a8781a'); R(g, 5, 5, 6, 6, PAL.gold); R(g, 6, 4, 4, 1, '#fff0a0'); R(g, 7, 6, 2, 4, '#c89a2a'); return; }
    if (id === 'essence') { R(g, 7, 2, 2, 12, '#3aa888'); R(g, 5, 4, 6, 8, '#3aa888'); R(g, 4, 6, 8, 4, '#3aa888'); R(g, 6, 5, 4, 6, '#8af0d0'); R(g, 7, 4, 1, 3, '#e8fff8'); return; }
    if (id === 'shards') { R(g, 3, 8, 4, 5, '#7a8aa0'); R(g, 7, 4, 4, 9, '#9aaac0'); R(g, 11, 7, 3, 5, '#7a8aa0'); R(g, 8, 5, 1, 4, '#e8f0ff'); return; }
    const it = ITEMS[id];
    if (!it) return;
    const c = it.color, d = it.dark;
    if (it.kind === 'mat') {
      if (id === 'amber_sap') { R(g, 6, 3, 4, 2, d); R(g, 4, 5, 8, 7, d); R(g, 5, 5, 6, 6, c); R(g, 6, 12, 4, 1, d); R(g, 6, 6, 2, 2, '#fff0c0'); }
      else { R(g, 3, 4, 10, 9, d); R(g, 4, 3, 8, 11, d); R(g, 5, 5, 6, 7, c); R(g, 7, 7, 2, 3, '#e8ffe8'); }
      return;
    }
    switch (it.stage) {
      case 0: // log: round end grain
        R(g, 1, 5, 12, 7, d); R(g, 1, 5, 12, 1, c); R(g, 11, 4, 4, 9, d); R(g, 12, 5, 3, 7, c); R(g, 13, 7, 1, 3, d);
        break;
      case 1: // plank
        R(g, 1, 6, 14, 4, d); R(g, 1, 6, 14, 3, c); R(g, 4, 7, 5, 1, d);
        R(g, 2, 10, 13, 3, d); R(g, 2, 10, 13, 2, c);
        break;
      case 2: // dried board: stacked, lighter
        for (let i = 0; i < 3; i++) { R(g, 2, 3 + i * 4, 12, 3, d); R(g, 2, 3 + i * 4, 12, 2, c); }
        R(g, 1, 2, 1, 12, PAL.wood[1]); R(g, 14, 2, 1, 12, PAL.wood[1]);
        break;
      case 3: // refined: glossy beam with a sheen
        R(g, 2, 4, 12, 8, d); R(g, 2, 4, 12, 6, c); R(g, 3, 5, 10, 1, '#ffffff'); R(g, 2, 11, 12, 1, PAL.ink);
        break;
      default: // crafted
        R(g, 2, 2, 12, 12, d); R(g, 3, 3, 10, 10, c); R(g, 5, 5, 6, 6, d); R(g, 6, 6, 4, 4, id === 'amber_panel' ? '#ffb040' : '#bff8ff');
    }
  });
}

export function axeIcon(id, locked = false) {
  return icon('a:' + id + (locked ? ':l' : ''), 13, (g) => {
    const a = AXE_BY_ID[id];
    const gr = GRADES[a.grade];
    const look = locked ? { blade: '#2a3a3a', accent: '#1a2626' } : { blade: a.blade, accent: '#a87a4a' };
    drawAxe(g, 3, 12, 0.38, look);
    if (!locked && a.grade >= 5) {
      // grade sparkles around the head
      g.fillStyle = gr.color;
      for (const [x, y] of [[11, 0], [12, 1], [10, 1], [11, 2], [1, 2]]) g.fillRect(x, y, 1, 1);
      if (a.grade >= 9) { g.fillStyle = '#ffffff'; g.fillRect(11, 1, 1, 1); g.fillRect(4, 0, 1, 1); }
    }
  });
}
