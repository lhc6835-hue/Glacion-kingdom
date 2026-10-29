// Trader: selling goods, buying axes, star upgrades, buying and switching classes.
import { ITEMS } from '../data/items.js';
import { AXE_BY_ID } from '../data/axes.js';
import { GRADES } from '../data/grades.js';
import { CLASS_BY_ID } from '../data/classes.js';
import { STARS } from '../data/balance.js';
import { add, remove, pay, canAfford, count } from './GameState.js';

export class Economy {
  constructor(state, events) { this.state = state; this.events = events; }

  sellPrice(id) {
    const it = ITEMS[id];
    let v = it.value;
    const cls = CLASS_BY_ID[this.state.classes.active].mods;
    if (cls.processedSell && it.stage >= 1) v *= 1 + cls.processedSell;
    return Math.round(v);
  }

  sell(id, n = 1) {
    n = Math.min(n, count(this.state, id));
    if (n <= 0) return 0;
    const g = this.sellPrice(id) * n;
    remove(this.state, id, n);
    add(this.state, 'gold', g);
    this.events.emit('sold', { id, n, gold: g });
    return g;
  }

  sellAllWood() {
    let g = 0;
    for (const id of Object.keys(this.state.inv)) if (ITEMS[id].kind !== 'mat') g += this.sell(id, this.state.inv[id]);
    return g;
  }

  buyAxe(id) {
    const a = AXE_BY_ID[id];
    if (!a.price || this.state.axes[id]) return false;
    if (!pay(this.state, { gold: a.price })) return false;
    this.grantAxe(id);
    return true;
  }

  // Adds an axe; a duplicate turns into shards instead. Returns { dup, shards }.
  grantAxe(id) {
    const a = AXE_BY_ID[id];
    const owned = this.state.axes[id];
    this.state.codex.axes[id] = true;
    if (owned) {
      owned.count++;
      const shards = GRADES[a.grade].shard;
      add(this.state, 'shards', shards);
      return { dup: true, shards };
    }
    this.state.axes[id] = { stars: 0, count: 1 };
    this.events.emit('axeGained', { id });
    return { dup: false, shards: 0 };
  }

  starCost(id) {
    const o = this.state.axes[id];
    if (!o || o.stars >= STARS.max) return null;
    return { shards: STARS.cost(o.stars, AXE_BY_ID[id].grade) };
  }

  upgradeAxe(id) {
    const c = this.starCost(id);
    if (!c || !pay(this.state, c)) return false;
    this.state.axes[id].stars++;
    this.events.emit('axeUpgraded', { id });
    return true;
  }

  equip(id) {
    if (!this.state.axes[id]) return false;
    this.state.equipped = id;
    this.events.emit('equip', { id });
    return true;
  }

  classRequirements(id) {
    const c = CLASS_BY_ID[id];
    return c.requires.map((r) => {
      let ok = false, have = 0;
      if (r.stat) { have = this.state.stats[r.stat] || 0; ok = have >= r.n; }
      if (r.sawmill) { have = this.state.sawmill.level; ok = have >= r.sawmill; }
      return { ...r, ok, have };
    });
  }

  canBuyClass(id) {
    if (this.state.classes.owned.includes(id)) return false;
    return this.classRequirements(id).every((r) => r.ok) && canAfford(this.state, CLASS_BY_ID[id].cost);
  }

  buyClass(id) {
    if (!this.canBuyClass(id)) return false;
    pay(this.state, CLASS_BY_ID[id].cost);
    this.state.classes.owned.push(id);
    this.state.classes.active = id;
    this.events.emit('classGained', { id });
    return true;
  }

  setClass(id) {
    if (!this.state.classes.owned.includes(id)) return false;
    this.state.classes.active = id;
    this.events.emit('classChanged', { id });
    return true;
  }
}
