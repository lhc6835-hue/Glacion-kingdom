import { QUESTS, LORE } from '../data/quests.js';
import { PLACES } from '../world/Layout.js';

// Quest bookkeeping driven by world events: 'visit', 'talk', 'inspect', 'collect'.
export class Quests {
  constructor(state, ui) {
    this.state = state;
    this.ui = ui;
  }

  get all() { return QUESTS; }
  get(id) { return QUESTS.find((q) => q.id === id); }
  status(id) { return this.state.quests[id]?.state || 'available'; }

  accept(id) {
    const q = this.get(id);
    if (!q || this.state.quests[id]) return;
    this.state.quests[id] = { state: 'active', progress: q.objectives.map(() => 0) };
    if (!this.state.tracked) this.state.tracked = id;
    this.ui.toast(`의뢰 수락: ${q.title}`, 'quest');
    // Objectives that are already satisfied (e.g. places visited before) count at once.
    q.objectives.forEach((o, i) => {
      if (o.type === 'visit' && this.state.discovered[o.target]) this.advance(q, i, 1);
      if (o.type === 'collect') this.advance(q, i, Math.min(o.count, this.state.inventory[itemName(o.target)] || 0), true);
    });
    this.state.save();
  }

  abandon(id) {
    if (this.state.quests[id]?.state === 'done') return;
    delete this.state.quests[id];
    if (this.state.tracked === id) this.state.tracked = null;
    this.state.save();
  }

  track(id) { this.state.tracked = this.state.tracked === id ? null : id; this.state.save(); }

  // Report something that happened in the world.
  event(type, target) {
    for (const q of QUESTS) {
      const st = this.state.quests[q.id];
      if (!st || st.state !== 'active') continue;
      q.objectives.forEach((o, i) => {
        if (o.type === type && o.target === target) this.advance(q, i, 1);
      });
    }
  }

  advance(q, i, n, absolute = false) {
    const st = this.state.quests[q.id];
    const o = q.objectives[i];
    const need = o.count || 1;
    const before = st.progress[i];
    st.progress[i] = Math.min(need, absolute ? Math.max(before, n) : before + n);
    if (st.progress[i] !== before) {
      if (need > 1) this.ui.toast(`${o.text} (${st.progress[i]}/${need})`, 'quest');
      else this.ui.toast(`목표 달성: ${o.text}`, 'quest');
    }
    if (q.objectives.every((oo, k) => st.progress[k] >= (oo.count || 1))) {
      if (q.turnIn) { if (st.state !== 'ready') { st.state = 'ready'; this.ui.toast(`「${q.title}」 — ${q.turnIn}에게 보고하자`, 'quest'); } }
      else this.complete(q);
    }
    this.state.save();
  }

  // Called when talking to an NPC: hands in any finished quest they gave.
  turnInTo(npcName) {
    const done = [];
    for (const q of QUESTS) {
      const st = this.state.quests[q.id];
      if (st?.state === 'ready' && q.turnIn === npcName) { this.complete(q); done.push(q); }
    }
    return done;
  }

  complete(q) {
    const st = this.state.quests[q.id];
    st.state = 'done';
    const r = q.reward || {};
    this.state.player.coins += r.coins || 0;
    const lv = this.state.addXp(r.xp || 0);
    if (r.item) this.state.addItem(r.item);
    for (const o of q.objectives) if (o.type === 'collect') this.state.inventory[itemName(o.target)] = Math.max(0, (this.state.inventory[itemName(o.target)] || 0) - o.count);
    if (r.lore) { this.state.lore[r.lore] = true; this.ui.toast(`기록 획득: ${LORE[r.lore].title}`, 'lore'); }
    if (this.state.tracked === q.id) this.state.tracked = null;
    this.ui.toast(`의뢰 완료: ${q.title}  +${r.coins || 0}깃전  +${r.xp || 0}경험치${r.item ? '  + ' + r.item : ''}`, 'reward');
    if (lv) this.ui.toast(`레벨 업! Lv.${this.state.player.level}`, 'reward');
    this.state.save();
  }

  // World position of the tracked quest's next objective, if it has one.
  trackedTarget(world) {
    const id = this.state.tracked;
    if (!id) return null;
    const q = this.get(id), st = this.state.quests[id];
    if (!q || !st) return null;
    if (st.state === 'ready') return { label: q.turnIn, npc: q.turnIn };
    const i = q.objectives.findIndex((o, k) => st.progress[k] < (o.count || 1));
    const o = q.objectives[i];
    if (!o) return null;
    if (o.type === 'visit') { const p = PLACES.find((pp) => pp.id === o.target); return p ? { x: p.x, z: p.z, label: o.text } : null; }
    return { label: o.text, hint: o.target };
  }
}

export const ITEM_NAMES = { moonmoss: '달맞이이끼', letter: '봉인된 편지', shard: '오스트미어 유리 파편' };
export const itemName = (id) => ITEM_NAMES[id] || id;
