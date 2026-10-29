// Minimal event bus so game systems can notify the UI, audio and VFX without knowing about them.
export class Events {
  constructor() { this.map = new Map(); }
  on(name, fn) {
    if (!this.map.has(name)) this.map.set(name, []);
    this.map.get(name).push(fn);
    return () => { const l = this.map.get(name); l.splice(l.indexOf(fn), 1); };
  }
  emit(name, data) {
    const l = this.map.get(name);
    if (l) for (let i = 0; i < l.length; i++) l[i](data);
  }
}
