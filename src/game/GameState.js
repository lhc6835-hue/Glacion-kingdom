// Persistent player state and the low-level wallet/inventory operations every system uses.
// DOM-free so it runs in Node tests.
import { ITEMS } from '../data/items.js';
import { DAY } from '../data/balance.js';

export const SAVE_VERSION = 1;
const CURRENCIES = ['gold', 'essence', 'shards'];

export function defaultSettings() {
  return {
    master: 0.8, music: 0.55, sfx: 0.8, ambience: 0.7,
    shake: 1, particles: 1, effects: 'high', // high | medium | low
    timeFlow: 1, // 1 normal, 0.5 slow, 0 frozen
    reduceFlash: false, uiScale: 1,
  };
}

export function createState() {
  return {
    version: SAVE_VERSION,
    gold: 0, essence: 0, shards: 0,
    inv: {},
    axes: { worn_hatchet: { stars: 0, count: 1 } },
    equipped: 'worn_hatchet',
    classes: { owned: ['lumberjack'], active: 'lumberjack' },
    sawmill: { level: 0, jobs: [], clock: 0 },
    gacha: { pulls: 0, sinceRare: 0, sinceEpic: 0, history: [] },
    stats: { hits: 0, crits: 0, misses: 0, bestCombo: 0, felled: {}, goldEarned: 0, playTime: 0 },
    codex: { axes: { worn_hatchet: true }, trees: {}, items: {}, lore: {} },
    settings: defaultSettings(),
    region: 'evergreen',
    unlocks: {},
    hour: DAY.startHour,
    tutorial: 0,
    savedAt: 0,
  };
}

// Brings older or partial saves up to the current shape. Unknown keys are kept.
export function migrate(raw) {
  const base = createState();
  if (!raw || typeof raw !== 'object') return base;
  const s = { ...base, ...raw };
  for (const k of ['sawmill', 'gacha', 'stats', 'codex', 'classes']) s[k] = { ...base[k], ...(raw[k] || {}) };
  s.settings = { ...defaultSettings(), ...(raw.settings || {}) };
  s.inv = { ...(raw.inv || {}) };
  s.axes = { ...base.axes, ...(raw.axes || {}) };
  if (!s.axes[s.equipped]) s.equipped = 'worn_hatchet';
  if (!s.classes.owned.includes('lumberjack')) s.classes.owned = ['lumberjack', ...s.classes.owned];
  if (!s.classes.owned.includes(s.classes.active)) s.classes.active = 'lumberjack';
  s.unlocks = { ...(raw.unlocks || {}) };
  if (typeof s.region !== 'string') s.region = 'evergreen';
  for (const c of CURRENCIES) s[c] = Math.max(0, Math.floor(Number(s[c]) || 0));
  s.version = SAVE_VERSION;
  return s;
}

export function count(state, id) {
  if (CURRENCIES.includes(id)) return state[id];
  return state.inv[id] || 0;
}

export function add(state, id, n = 1) {
  if (n <= 0) return;
  if (CURRENCIES.includes(id)) { state[id] += n; if (id === 'gold') state.stats.goldEarned += n; return; }
  if (!ITEMS[id]) throw new Error('unknown item ' + id);
  state.inv[id] = (state.inv[id] || 0) + n;
  state.codex.items[id] = true;
}

export function remove(state, id, n = 1) {
  if (count(state, id) < n) return false;
  if (CURRENCIES.includes(id)) state[id] -= n;
  else { state.inv[id] -= n; if (state.inv[id] <= 0) delete state.inv[id]; }
  return true;
}

export function canAfford(state, cost) {
  for (const [id, n] of Object.entries(cost || {})) if (count(state, id) < n) return false;
  return true;
}

export function pay(state, cost) {
  if (!canAfford(state, cost)) return false;
  for (const [id, n] of Object.entries(cost || {})) remove(state, id, n);
  return true;
}

export function costLabel(id) {
  if (id === 'gold') return '골드';
  if (id === 'essence') return '정수';
  if (id === 'shards') return '도끼 파편';
  return ITEMS[id]?.ko || id;
}
