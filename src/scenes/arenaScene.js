// Scene wrapper around the arena: pause button, end-of-run rewards and the results card.
import { Arena } from '../game/arena.js';
import { h } from '../ui/ui.js';
import { xpNeed } from '../../shared/economy.js';
import { sfx, music } from '../core/audio.js';

export class ArenaScene {
  constructor(app, { loadout, wave = 0, coop = null } = {}) {
    this.app = app;
    this.layout = 'arena';
    this.opts = { loadout: loadout || app.profile.loadout(), wave, coop };
  }

  enter() {
    const app = this.app;
    this.arena = new Arena(app, { loadout: this.opts.loadout, levels: app.profile.levels(), name: app.profile.data.name, coop: this.opts.coop });
    if (this.opts.wave > 1) { this.arena.wave = this.opts.wave - 1; }
    window.__arena = this.arena;
    this.done = false;
    const btn = app.ui.set('pausebtn', h('<button class="icon-btn" style="top:12px;right:12px" aria-label="일시정지">⏸</button>'));
    btn.onclick = () => this.pause();
    this.onKey = (e) => { if (e.code === 'Escape' && !this.done) this.pause(); };
    addEventListener('keydown', this.onKey);
  }
  exit() {
    removeEventListener('keydown', this.onKey);
    if (this.opts.coop) this.opts.coop.leave();
    music(null);
  }

  pause() {
    if (this.app.ui.has('pause') || this.app.ui.has('pick') || this.done) return;
    if (!this.opts.coop) this.arena.paused = true;
    this.app.ui.pause({
      onResume: () => { this.arena.paused = false; },
      onQuit: () => { this.arena.paused = false; this.arena.endRun(); },
    });
  }

  update(dt) {
    this.arena.update(dt);
    if (this.arena.over && !this.done && this.arena.stateT > 1.6) this.finish();
  }

  async finish() {
    this.done = true;
    const app = this.app;
    const r = this.arena.result();
    const before = app.profile.data.level;
    const res = await app.profile.act('applyRun', r);
    const p = app.profile.data;
    let levelInfo = `<div class="sub">레벨 ${p.level} · 다음 레벨까지 ${xpNeed(p.level) - p.xp} XP</div>`;
    if (res.ups && res.ups.length) {
      sfx.levelup();
      levelInfo = `<div class="sub" style="color:#ff6f99;font-size:20px">레벨 업! ${before} → ${p.level} · 보너스 🍬 ${res.ups.reduce((s, u) => s + u.reward, 0).toLocaleString()}</div>` + levelInfo;
    }
    app.ui.results(r, {
      levelInfo,
      onPlaza: () => app.goHome(),
      onRetry: () => app.go(new ArenaScene(app, { loadout: app.profile.loadout() })),
    });
  }

  draw(g) { this.arena.draw(g); }
}
