// Versioned save with a verified write and a backup of the last good save.
// storage: anything with getItem/setItem/removeItem (localStorage in the browser, a Map shim in tests).
import { migrate, createState } from './GameState.js';

const KEY = 'axenfall-save';
const BAK = 'axenfall-save-bak';
const TMP = 'axenfall-save-tmp';

export class SaveManager {
  constructor(storage) { this.storage = storage; this.lastError = null; }

  save(state, now = Date.now()) {
    try {
      state.savedAt = now;
      const json = JSON.stringify(state);
      this.storage.setItem(TMP, json);
      if (this.storage.getItem(TMP) !== json) throw new Error('verify failed');
      const prev = this.storage.getItem(KEY);
      if (prev) this.storage.setItem(BAK, prev);
      this.storage.setItem(KEY, json);
      this.storage.removeItem(TMP);
      this.lastError = null;
      return true;
    } catch (e) {
      this.lastError = e;
      return false;
    }
  }

  // Returns { state, source } where source is 'save', 'backup' or 'new'.
  load() {
    for (const [key, source] of [[KEY, 'save'], [BAK, 'backup']]) {
      try {
        const raw = this.storage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || typeof parsed.gold !== 'number') throw new Error('bad shape');
        return { state: migrate(parsed), source };
      } catch (e) { this.lastError = e; }
    }
    return { state: createState(), source: 'new' };
  }

  wipe() { for (const k of [KEY, BAK, TMP]) try { this.storage.removeItem(k); } catch { /* storage unavailable */ } }
}

export function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _map: m };
}
