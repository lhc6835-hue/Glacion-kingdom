// Client side of the server: accounts, economy actions, plaza presence and room joining.
import { lobby } from '../ui/lobby.js';
import { Coop } from './coop.js';
import { ArenaScene } from '../scenes/arenaScene.js';

export const WORKER_URL = 'https://glacion-icecream.celesta.workers.dev';
const TOKEN_KEY = 'glacion-ice-token';

export class Net {
  constructor(app) {
    this.app = app;
    const sameOrigin = location.hostname.endsWith('.workers.dev');
    this.base = sameOrigin ? '' : WORKER_URL;
    this.wsBase = sameOrigin ? location.origin.replace(/^http/, 'ws') : WORKER_URL.replace(/^http/, 'ws');
    try { this.token = localStorage.getItem(TOKEN_KEY); } catch { this.token = null; }
    this.online = false;
    this.plaza = null;
  }

  async req(path, body, method) {
    const r = await fetch(this.base + path, {
      method: method || (body ? 'POST' : 'GET'),
      headers: { 'content-type': 'application/json', ...(this.token ? { authorization: 'Bearer ' + this.token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    let j;
    try { j = await r.json(); } catch { j = { ok: false, error: '서버 응답이 이상해요' }; }
    if (r.status === 401 && this.online && path !== '/api/login') this.expire();
    return j;
  }

  setToken(t) {
    this.token = t;
    try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ }
  }

  // Resume a saved session. Resolves true when signed in.
  async restore() {
    if (!this.token) return false;
    try {
      const r = await this.req('/api/me');
      if (!r.ok) { this.setToken(null); return false; }
      this.begin(r.profile);
      return true;
    } catch { return false; }
  }
  async login(id, pw) {
    const r = await this.req('/api/login', { id, pw });
    if (r.ok) { this.setToken(r.token); this.begin(r.profile); }
    return r;
  }
  async signup(id, pw, name) {
    const r = await this.req('/api/signup', { id, pw, name });
    if (r.ok) { this.setToken(r.token); this.begin(r.profile); }
    return r;
  }
  begin(profile) {
    this.online = true;
    this.app.profile.useServer(this, profile);
  }
  async logout() {
    try { await this.req('/api/logout', {}); } catch { /* offline */ }
    this.expire();
  }
  expire() {
    this.setToken(null);
    this.online = false;
    this.leavePlaza();
    this.app.profile.signOut();
  }

  async act(name, args) {
    try { return await this.req('/api/act', { name, args }); } catch { return { ok: false, error: '서버에 연결할 수 없어요' }; }
  }
  async getVotes() { const r = await this.req('/api/votes'); return r.ok ? r.tally : null; }
  async getRanking() { const r = await this.req('/api/ranking'); return r.ok ? r.list : null; }
  async listRooms() { const r = await this.req('/api/rooms'); return r.ok ? r.rooms : []; }

  // ── plaza ──
  joinPlaza(scene) {
    this.leavePlaza();
    const ws = new WebSocket(`${this.wsBase}/ws/plaza?token=${encodeURIComponent(this.token)}`);
    const P = { ws, scene, ids: new Map(), last: { x: 0, y: 0, f: 0 }, t: 0, open: false };
    this.plaza = P;
    ws.onopen = () => { P.open = true; this.sendLook(this.app.profile.data.loadout); };
    ws.onmessage = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (this.plaza !== P) return;
      if (m.t === 'welcome') for (const p of m.players) scene.addOther(p.id, p);
      else if (m.t === 'join') scene.addOther(m.p.id, m.p);
      else if (m.t === 'leave') scene.removeOther(m.id);
      else if (m.t === 'pos') { const a = scene.others.get(m.id); if (a) { a.tx = m.x; a.ty = m.y; } }
      else if (m.t === 'chat') { const a = scene.others.get(m.id); if (a) a.say(m.text); }
      else if (m.t === 'look') { const a = scene.others.get(m.id); if (a) { a.rig.setLook(m.look); a.level = m.level; } }
    };
    ws.onclose = () => {
      if (this.plaza !== P) return;
      this.plaza = null;
      for (const id of [...scene.others.keys()]) scene.removeOther(id);
      // reconnect after a short pause while still on the plaza
      setTimeout(() => { if (this.online && this.app.scene === scene && !this.plaza) this.joinPlaza(scene); }, 3000);
    };
  }
  leavePlaza() {
    const P = this.plaza;
    this.plaza = null;
    if (P) try { P.ws.close(); } catch { /* already closed */ }
  }
  tickPlaza(dt, me) {
    const P = this.plaza;
    if (!P || !P.open) return;
    P.t += dt;
    P.ping = (P.ping || 0) + dt;
    if (P.ping > 15) { P.ping = 0; P.ws.send('{"t":"ping"}'); }
    if (P.t < 0.1) return;
    P.t = 0;
    const x = Math.round(me.x), y = Math.round(me.y), f = me.facing;
    if (x === P.last.x && y === P.last.y && f === P.last.f) return;
    P.last = { x, y, f };
    P.ws.send(JSON.stringify({ t: 'pos', x, y, f }));
  }
  sendChat(text) { const P = this.plaza; if (P && P.open) P.ws.send(JSON.stringify({ t: 'chat', text })); }
  sendLook(look) {
    const P = this.plaza;
    if (P && P.open) P.ws.send(JSON.stringify({ t: 'look', look, name: this.app.profile.data.name, level: this.app.profile.data.level }));
  }

  // ── rooms ──
  async createRoom({ name, max, priv }) {
    const r = await this.req('/api/rooms', { name, max, priv });
    if (!r.ok) throw new Error(r.error);
    return this.joinRoom(r.id);
  }
  // Joins a room, retrying once: a freshly created room object can refuse the very first socket.
  async joinRoom(code) {
    try { return await this.joinRoomOnce(code); } catch (e) {
      if (e.retry) { await new Promise((r) => setTimeout(r, 700)); return this.joinRoomOnce(code); }
      throw e;
    }
  }
  joinRoomOnce(code) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${this.wsBase}/ws/room/${code}?token=${encodeURIComponent(this.token)}`);
      const room = { ws, code, you: null, host: null, players: new Map(), handlers: new Set(), started: false };
      let settled = false;
      ws.onmessage = (ev) => {
        let m;
        try { m = JSON.parse(ev.data); } catch { return; }
        if (m.t === 'reject') { if (!settled) { settled = true; reject(new Error(m.why)); } return; }
        if (m.t === 'welcome') {
          room.you = m.you; room.host = m.host; room.info = m.room;
          for (const p of m.players) room.players.set(p.id, p);
          settled = true;
          resolve(room);
          this.app.ui.remove('modal');
          lobby(this.app, room, () => this.startRoom(room));
        }
        for (const h of room.handlers) h(m);
      };
      ws.onerror = () => { if (!settled) { settled = true; const e = new Error('방에 들어갈 수 없어요'); e.retry = true; reject(e); } };
      ws.onclose = () => { for (const h of room.handlers) h({ t: 'closed' }); if (!settled) { settled = true; reject(new Error('없는 방이거나 이미 시작했어요')); } };
      room.send = (o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };
      room.leave = () => { try { ws.close(); } catch { /* closed */ } };
    });
  }
  startRoom(room) {
    const coop = new Coop(this.app, room);
    this.app.go(new ArenaScene(this.app, { coop }));
  }
}
