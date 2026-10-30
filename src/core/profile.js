// The player's account data. Guests keep it in localStorage; signed-in players keep it on the
// server, where every action is applied by the same shared/economy.js rules (see net/api.js).
import * as eco from '../../shared/economy.js';

const KEY = 'glacion-ice-guest';

export class Profile {
  constructor() {
    this.api = null; // set when signed in
    this.listeners = new Set();
    this.data = this.loadGuest();
  }

  loadGuest() {
    try { return eco.sanitizeProfile(JSON.parse(localStorage.getItem(KEY))); } catch { return eco.newProfile('게스트'); }
  }
  saveGuest() {
    if (this.api) return;
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* storage unavailable */ }
  }

  get signedIn() { return !!this.api; }
  loadout() { return this.data.loadout; }
  levels() {
    const lv = { ...this.data.flavors };
    for (const [k, v] of Object.entries(this.data.weapons)) lv['w:' + k] = v;
    return lv;
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  changed() { this.saveGuest(); for (const fn of this.listeners) fn(this.data); }

  // Runs an economy action locally (guest) or on the server (signed in).
  async act(name, ...args) {
    if (this.api) {
      const res = await this.api.act(name, args);
      if (res.profile) this.data = eco.sanitizeProfile(res.profile);
      this.changed();
      return res;
    }
    const fn = eco.ACTIONS[name];
    const res = fn(this.data, ...args);
    if (res.ok) this.changed();
    return res;
  }

  useServer(api, profile) {
    this.api = api;
    this.data = eco.sanitizeProfile(profile);
    this.changed();
  }
  signOut() {
    this.api = null;
    this.data = this.loadGuest();
    this.changed();
  }
}
