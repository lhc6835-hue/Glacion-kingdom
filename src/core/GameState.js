import { QUESTS } from '../data/quests.js';

// Everything that persists: the player's progress, quests, discoveries and settings.
// Saved to localStorage (wrapped in try/catch: private windows may refuse storage).

const KEY = 'glacion-save-v1';

export class GameState {
  constructor() { this.reset(); }

  reset() {
    this.player = { x: null, z: null, y: null, level: 1, xp: 0, coins: 20, hp: 100, maxHp: 100 };
    this.time = 15.3;
    this.inventory = {};
    this.quests = {};       // id -> { state: 'active'|'ready'|'done', progress: [n...] }
    this.tracked = null;
    this.discovered = {};
    this.lore = {};
    this.collected = {};    // pickup uid -> true
    this.settings = { music: 0.6, sfx: 0.8, quality: 'high' };
    this.playSeconds = 0;
  }

  static hasSave() {
    try { return !!localStorage.getItem(KEY); } catch { return false; }
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        v: 1, player: this.player, time: this.time, inventory: this.inventory, quests: this.quests, tracked: this.tracked,
        discovered: this.discovered, lore: this.lore, collected: this.collected, settings: this.settings, playSeconds: this.playSeconds,
      }));
      return true;
    } catch { return false; }
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (d.v !== 1) return false;
      Object.assign(this.player, d.player);
      this.time = d.time ?? this.time;
      this.inventory = d.inventory || {};
      // Drop quests that no longer exist in the data.
      this.quests = Object.fromEntries(Object.entries(d.quests || {}).filter(([id]) => QUESTS.some((q) => q.id === id)));
      this.tracked = this.quests[d.tracked] ? d.tracked : null;
      this.discovered = d.discovered || {};
      this.lore = d.lore || {};
      this.collected = d.collected || {};
      Object.assign(this.settings, d.settings || {});
      this.playSeconds = d.playSeconds || 0;
      return true;
    } catch { return false; }
  }

  addItem(name, n = 1) { this.inventory[name] = (this.inventory[name] || 0) + n; }

  // Returns the number of levels gained.
  addXp(n) {
    this.player.xp += n;
    let gained = 0;
    while (this.player.xp >= xpFor(this.player.level)) {
      this.player.xp -= xpFor(this.player.level);
      this.player.level++; gained++;
      this.player.maxHp += 12; this.player.hp = this.player.maxHp;
    }
    return gained;
  }
}

export const xpFor = (lv) => 80 + (lv - 1) * 60;
