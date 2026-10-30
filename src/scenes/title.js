// Title screen: a sky full of drifting ice creams behind the logo.
import { IceCreamRig } from '../render/icecream.js';
import { h } from '../ui/ui.js';
import { MOLDS } from '../../shared/molds.js';
import { FLAVORS } from '../../shared/flavors.js';
import { FACES } from '../../shared/faces.js';
import { rand, pick, TAU } from '../core/math.js';
import { sfx, music } from '../core/audio.js';

export class TitleScene {
  constructor(app) { this.app = app; this.t = 0; this.floaters = []; }
  enter() {
    for (let i = 0; i < 14; i++) this.floaters.push(this.makeFloater(true));
    this.app.ui.set('logo', h(`<div class="logo"><div class="k">글래시온 왕국</div><div class="t">녹지 마,<br>아이스크림!</div></div>`));
    this.menu();
    music('menu');
  }
  makeFloater(any) {
    const m = pick(MOLDS);
    const fl = [];
    for (let k = 0; k < Math.min(3, m.layers); k++) fl.push(pick(FLAVORS).id);
    return { rig: new IceCreamRig({ mold: m.id, flavors: fl, face: pick(FACES).id }), x: rand(innerWidth), y: any ? rand(innerHeight) : innerHeight + 120, s: rand(0.55, 1.1), sp: rand(18, 40), rot: rand(-0.3, 0.3), ph: rand(TAU) };
  }
  menu() {
    const el = this.app.ui.set('menu', h(`<div class="title-wrap"><div class="row">
      <button class="btn" data-a="play" style="font-size:22px;padding:14px 34px">광장으로!</button>
    </div></div>`));
    el.querySelector('[data-a=play]').onclick = () => { sfx.click(); this.app.goHome(); };
  }
  update(dt) {
    this.t += dt;
    for (const f of this.floaters) {
      f.y -= f.sp * dt;
      f.rig.update(dt, { vx: Math.sin(this.t + f.ph) * 30 });
      if (f.y < -160) Object.assign(f, this.makeFloater(false));
    }
  }
  draw(g) {
    const W = innerWidth, H = innerHeight;
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#ffc6dc'); gr.addColorStop(0.55, '#ffe3ec'); gr.addColorStop(1, '#d9f3ff');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 5; i++) {
      const x = ((this.t * 12 + i * 300) % (W + 400)) - 200, y = 80 + i * 110;
      for (const [dx, dy, r] of [[0, 0, 40], [40, -14, 50], [90, 0, 38], [45, 14, 36]]) { g.beginPath(); g.arc(x + dx, y + dy, r, 0, TAU); g.fill(); }
    }
    for (const f of this.floaters) {
      g.save(); g.translate(f.x + Math.sin(this.t * 0.8 + f.ph) * 20, f.y); g.rotate(f.rot + Math.sin(this.t + f.ph) * 0.1);
      f.rig.draw(g, 0, 0, f.s, { shadow: false });
      g.restore();
    }
  }
}
