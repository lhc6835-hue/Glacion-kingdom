// Entry point: canvas, input, UI root and the scene switcher.
import { Input } from './core/input.js';
import { UI } from './ui/ui.js';
import { resumeAudio } from './core/audio.js';
import { ArenaScene } from './scenes/arenaScene.js';
import { TitleScene } from './scenes/title.js';
import { PlazaScene } from './scenes/plaza.js';
import { ShopScene } from './scenes/shop.js';
import { Profile } from './core/profile.js';

class App {
  constructor() {
    this.canvas = document.getElementById('game');
    this.g = this.canvas.getContext('2d');
    this.input = new Input(this.canvas);
    this.ui = new UI(document.getElementById('ui'));
    this.profile = new Profile();
    this.scene = null;
    this.last = performance.now();
    this.resize();
    addEventListener('resize', () => this.resize());
    const unlock = () => resumeAudio();
    addEventListener('pointerdown', unlock);
    addEventListener('keydown', unlock);
    requestAnimationFrame((t) => this.frame(t));
  }

  resize() {
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.canvas.width = Math.round(innerWidth * this.dpr);
    this.canvas.height = Math.round(innerHeight * this.dpr);
  }

  goHome(opts) { this.go(new PlazaScene(this, opts)); }

  go(scene) {
    if (this.scene && this.scene.exit) this.scene.exit();
    this.ui.clear();
    this.scene = scene;
    this.input.setLayout(scene.layout || 'none');
    if (scene.enter) scene.enter();
  }

  frame(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.imageSmoothingQuality = 'high';
    if (this.scene) {
      this.scene.update(dt);
      this.scene.draw(g);
    }
    this.input.drawTouch(g);
    this.input.endFrame();
    requestAnimationFrame((t) => this.frame(t));
  }
}

const app = new App();
window.__app = app;
const q = new URLSearchParams(location.search);
if (q.has('play')) app.go(new ArenaScene(app, debugLoadout(q, app.profile)));
else if (q.has('plaza')) app.goHome();
else if (q.has('shop')) app.go(new ShopScene(app, +q.get('shop') || 0));
else app.go(new TitleScene(app));

// ?play&w=bow&m=parfait&f=vanilla,mint,chocolate — try any combination while developing
function debugLoadout(q, profile) {
  const lo = { ...profile.loadout() };
  if (q.get('w')) lo.weapon = q.get('w');
  if (q.get('m')) lo.mold = q.get('m');
  if (q.get('f')) lo.flavors = q.get('f').split(',');
  if (q.get('face')) lo.face = q.get('face');
  return { loadout: lo, wave: +q.get('wave') || 0 };
}
