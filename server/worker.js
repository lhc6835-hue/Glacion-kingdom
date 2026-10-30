// Glacion ice cream server (Cloudflare Worker + Durable Objects).
//  - serves the game page at /
//  - /api/*  accounts (id + password), economy actions, today's vote tally, ranking, rooms
//  - /ws/plaza       shared plaza presence and chat (one Plaza object)
//  - /ws/room/CODE   co-op rooms of 1–4 players (one Room object per code)
// All account data lives in one SQLite-backed Store object. Economy rules are the same
// shared/economy.js the client uses for guests, so both sides agree on every result.
import { ACTIONS, newProfile, sanitizeProfile, dayKey, dailyCandidates } from '../shared/economy.js';
import PAGE from './page.html';

const JSON_H = { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, authorization', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: JSON_H });
const err = (msg, status = 400) => json({ ok: false, error: msg }, status);
const store = (env) => env.STORE.get(env.STORE.idFromName('main'));

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;
    if (req.method === 'OPTIONS') return new Response(null, { headers: JSON_H });
    if (path === '/' || path === '/index.html') return new Response(PAGE, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' } });
    if (path === '/ws/plaza') return env.PLAZA.get(env.PLAZA.idFromName('plaza')).fetch(req);
    const m = path.match(/^\/ws\/room\/([A-Z0-9]{6})$/);
    if (m) return env.ROOM.get(env.ROOM.idFromName(m[1])).fetch(req);
    if (path.startsWith('/api/internal/')) return new Response('not found', { status: 404 });
    if (path.startsWith('/api/')) return store(env).fetch(req);
    return new Response('not found', { status: 404 });
  },
};

// ── helpers ───────────────────────────────────────────────────
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function hashPw(pw, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100000 }, key, 256);
  return hex(bits);
}
const randHex = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const roomCode = () => [...crypto.getRandomValues(new Uint8Array(6))].map((b) => ROOM_CHARS[b % ROOM_CHARS.length]).join('');
const cleanName = (s) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12);
function safeEq(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }

// ── Store: accounts, sessions, votes, ranking, room registry ─────────
export class Store {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, salt TEXT, hash TEXT, profile TEXT, created INTEGER);
      CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, uid TEXT, exp INTEGER);
      CREATE TABLE IF NOT EXISTS votes (day TEXT, uid TEXT, flavor TEXT, PRIMARY KEY (day, uid));
      CREATE TABLE IF NOT EXISTS ranking (day TEXT, uid TEXT, name TEXT, level INTEGER, wave INTEGER, PRIMARY KEY (day, uid));
      CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, name TEXT, max INTEGER, priv INTEGER, count INTEGER, started INTEGER, host TEXT, updated INTEGER);
    `);
  }

  one(q, ...a) { const r = this.sql.exec(q, ...a).toArray(); return r[0] || null; }

  auth(req) {
    const h = req.headers.get('authorization') || '';
    const url = new URL(req.url);
    const token = h.startsWith('Bearer ') ? h.slice(7) : url.searchParams.get('token') || '';
    if (!token) return null;
    const s = this.one('SELECT uid, exp FROM sessions WHERE token = ?', token);
    if (!s || s.exp < Date.now()) return null;
    const u = this.one('SELECT id, profile FROM users WHERE id = ?', s.uid);
    if (!u) return null;
    return { uid: u.id, profile: sanitizeProfile(JSON.parse(u.profile)) };
  }
  save(uid, profile) { this.sql.exec('UPDATE users SET profile = ? WHERE id = ?', JSON.stringify(profile), uid); }
  session(uid) {
    const token = randHex(24);
    this.sql.exec('INSERT INTO sessions VALUES (?, ?, ?)', token, uid, Date.now() + 1000 * 60 * 60 * 24 * 30);
    return token;
  }

  async fetch(req) {
    const url = new URL(req.url);
    const p = url.pathname;
    let body = {};
    if (req.method === 'POST') { try { body = await req.json(); } catch { body = {}; } }
    try {
      switch (p) {
        case '/api/signup': return await this.signup(body);
        case '/api/login': return await this.login(body);
        case '/api/me': { const a = this.auth(req); return a ? json({ ok: true, profile: a.profile, uid: a.uid }) : err('로그인이 필요해요', 401); }
        case '/api/logout': { const h = req.headers.get('authorization') || ''; this.sql.exec('DELETE FROM sessions WHERE token = ?', h.slice(7)); return json({ ok: true }); }
        case '/api/act': return this.act(req, body);
        case '/api/votes': return json({ ok: true, day: dayKey(), tally: this.tally() });
        case '/api/ranking': return json({ ok: true, list: this.sql.exec('SELECT name, level, wave FROM ranking WHERE day = ? ORDER BY wave DESC, level DESC LIMIT 20', dayKey()).toArray() });
        case '/api/rooms':
          if (req.method === 'POST') return this.createRoom(req, body);
          this.pruneRooms();
          return json({ ok: true, rooms: this.sql.exec('SELECT code AS id, name, max, count, started FROM rooms WHERE priv = 0 AND count > 0 AND updated > ? ORDER BY updated DESC LIMIT 30', Date.now() - 1800000).toArray() });
        // internal calls from Plaza/Room objects
        case '/api/internal/who': { const a = this.auth(req); return a ? json({ ok: true, uid: a.uid, name: a.profile.name, level: a.profile.level, look: a.profile.loadout, levels: levelsOf(a.profile) }) : err('no', 401); }
        case '/api/internal/room': {
          if (req.method === 'POST') { this.sql.exec('UPDATE rooms SET count = ?, started = ?, host = ?, updated = ? WHERE code = ?', body.count | 0, body.started ? 1 : 0, body.host || '', Date.now(), body.code); return json({ ok: true }); }
          const r = this.one('SELECT * FROM rooms WHERE code = ?', url.searchParams.get('code'));
          return r ? json({ ok: true, room: r }) : err('없는 방이에요', 404);
        }
      }
    } catch (e) { return err('서버 오류: ' + e.message, 500); }
    return err('not found', 404);
  }

  async signup({ id, pw, name }) {
    id = String(id || '').trim().toLowerCase();
    if (!/^[a-z0-9_]{3,16}$/.test(id)) return err('아이디는 영어 소문자, 숫자, _ 로 3~16자예요');
    if (typeof pw !== 'string' || pw.length < 4 || pw.length > 64) return err('비밀번호는 4자 이상이에요');
    const nm = cleanName(name);
    if (nm.length < 2) return err('닉네임은 2~12자예요');
    if (this.one('SELECT id FROM users WHERE id = ?', id)) return err('이미 있는 아이디예요');
    const salt = randHex(16);
    const profile = newProfile(nm);
    this.sql.exec('INSERT INTO users VALUES (?, ?, ?, ?, ?)', id, salt, await hashPw(pw, salt), JSON.stringify(profile), Date.now());
    return json({ ok: true, token: this.session(id), profile, uid: id });
  }

  async login({ id, pw }) {
    id = String(id || '').trim().toLowerCase();
    const u = this.one('SELECT * FROM users WHERE id = ?', id);
    if (!u || typeof pw !== 'string') return err('아이디나 비밀번호가 맞지 않아요', 401);
    if (!safeEq(await hashPw(pw, u.salt), u.hash)) return err('아이디나 비밀번호가 맞지 않아요', 401);
    this.sql.exec('DELETE FROM sessions WHERE exp < ?', Date.now());
    return json({ ok: true, token: this.session(id), profile: sanitizeProfile(JSON.parse(u.profile)), uid: id });
  }

  act(req, { name, args }) {
    const a = this.auth(req);
    if (!a) return err('로그인이 필요해요', 401);
    const fn = ACTIONS[name];
    if (!fn || !Array.isArray(args)) return err('알 수 없는 동작이에요');
    const prof = a.profile;
    // the vote day is always the server's day
    if (name === 'vote') args = [args[0], dayKey()];
    const res = fn(prof, ...args);
    if (res.ok) {
      this.save(a.uid, prof);
      if (name === 'vote') this.sql.exec('INSERT OR REPLACE INTO votes VALUES (?, ?, ?)', dayKey(), a.uid, args[0]);
      if (name === 'applyRun') {
        const w = Math.max(0, Math.min(500, args[0].wave | 0));
        const cur = this.one('SELECT wave FROM ranking WHERE day = ? AND uid = ?', dayKey(), a.uid);
        if (!cur || cur.wave < w) this.sql.exec('INSERT OR REPLACE INTO ranking VALUES (?, ?, ?, ?, ?)', dayKey(), a.uid, prof.name, prof.level, w);
      }
    }
    return json({ ...res, profile: prof });
  }

  tally() {
    const out = {};
    for (const f of dailyCandidates()) out[f] = 0;
    for (const r of this.sql.exec('SELECT flavor, COUNT(*) AS n FROM votes WHERE day = ? GROUP BY flavor', dayKey()).toArray()) out[r.flavor] = r.n;
    return out;
  }

  createRoom(req, body) {
    const a = this.auth(req);
    if (!a) return err('로그인이 필요해요', 401);
    const max = Math.max(1, Math.min(4, body.max | 0));
    const name = String(body.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20) || '아이스크림 방';
    this.pruneRooms();
    let code;
    do code = roomCode(); while (this.one('SELECT code FROM rooms WHERE code = ?', code));
    this.sql.exec('INSERT INTO rooms VALUES (?, ?, ?, ?, 0, 0, ?, ?)', code, name, max, body.priv ? 1 : 0, a.uid, Date.now());
    return json({ ok: true, id: code });
  }
  pruneRooms() {
    this.sql.exec('DELETE FROM rooms WHERE (count = 0 AND updated < ?) OR updated < ?', Date.now() - 120000, Date.now() - 6 * 3600000);
  }
}

function levelsOf(p) {
  const lv = { ...p.flavors };
  for (const [k, v] of Object.entries(p.weapons)) lv['w:' + k] = v;
  return lv;
}

async function who(env, req) {
  const url = new URL(req.url);
  const r = await store(env).fetch(new Request('https://x/api/internal/who?token=' + encodeURIComponent(url.searchParams.get('token') || '')));
  if (!r.ok) return null;
  return r.json();
}

// ── Plaza: everyone walking around the square ─────────────────────
export class Plaza {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; this.peers = new Map(); this.seq = 0; }

  async fetch(req) {
    if (req.headers.get('upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
    const me = await who(this.env, req);
    if (!me) return new Response('unauthorized', { status: 401 });
    const pair = new WebSocketPair();
    const ws = pair[1];
    ws.accept();
    // one connection per account: a new tab replaces the old one
    for (const [id, p] of this.peers) if (p.uid === me.uid) { try { p.ws.close(4000, 'replaced'); } catch { /* already closed */ } this.drop(id); }
    const id = 'u' + ++this.seq;
    const peer = { id, uid: me.uid, ws, name: me.name, level: me.level, look: me.look, x: Math.round(Math.random() * 280 - 140), y: 260, f: 1, chatT: 0, seen: Date.now() };
    this.prune();
    this.peers.set(id, peer);
    ws.send(JSON.stringify({ t: 'welcome', you: id, players: [...this.peers.values()].filter((p) => p.id !== id).map(info) }));
    this.broadcast({ t: 'join', p: info(peer) }, id);
    ws.addEventListener('message', (ev) => this.onMsg(peer, ev.data));
    ws.addEventListener('close', () => this.drop(id));
    ws.addEventListener('error', () => this.drop(id));
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  // connections that vanished without a close frame go quiet; drop them after a minute
  prune() {
    const cut = Date.now() - 60000;
    for (const [id, p] of this.peers) if (p.seen < cut) { try { p.ws.close(4003, 'idle'); } catch { /* closed */ } this.drop(id); }
  }

  onMsg(peer, raw) {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    peer.seen = Date.now();
    if (m.t === 'ping') return;
    if (m.t === 'pos') {
      peer.x = +m.x || 0; peer.y = +m.y || 0; peer.f = m.f > 0 ? 1 : -1;
      this.broadcast({ t: 'pos', id: peer.id, x: Math.round(peer.x), y: Math.round(peer.y), f: peer.f }, peer.id);
    } else if (m.t === 'chat') {
      const now = Date.now();
      if (now - peer.chatT < 700) return;
      peer.chatT = now;
      const text = String(m.text || '').replace(/[\u0000-\u001f]/g, '').slice(0, 60);
      if (text) this.broadcast({ t: 'chat', id: peer.id, text }, peer.id);
    } else if (m.t === 'look' && m.look && typeof m.look === 'object') {
      peer.look = { mold: String(m.look.mold), flavors: (m.look.flavors || []).slice(0, 5).map(String), weapon: String(m.look.weapon), face: String(m.look.face) };
      if (m.name) peer.name = cleanName(m.name) || peer.name;
      if (m.level) peer.level = Math.max(1, Math.min(999, m.level | 0));
      this.broadcast({ t: 'look', id: peer.id, look: peer.look, level: peer.level }, peer.id);
    }
  }

  drop(id) {
    if (!this.peers.has(id)) return;
    this.peers.delete(id);
    this.broadcast({ t: 'leave', id });
  }
  broadcast(m, except) {
    const s = JSON.stringify(m);
    for (const p of this.peers.values()) if (p.id !== except) { try { p.ws.send(s); } catch { /* closed */ } }
  }
}
const info = (p) => ({ id: p.id, name: p.name, level: p.level, look: p.look, x: p.x, y: p.y, f: p.f });

// ── Room: a co-op lobby + relay. The host's game simulates the enemies. ─────
export class Room {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; this.peers = new Map(); this.seq = 0; this.meta = null; this.started = false; this.host = null; }

  async fetch(req) {
    if (req.headers.get('upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
    const url = new URL(req.url);
    const code = url.pathname.split('/').pop();
    if (!this.meta) {
      const r = await store(this.env).fetch(new Request('https://x/api/internal/room?code=' + code));
      if (!r.ok) return new Response('no room', { status: 404 });
      this.meta = (await r.json()).room;
    }
    const me = await who(this.env, req);
    if (!me) return new Response('unauthorized', { status: 401 });
    const pair = new WebSocketPair();
    const ws = pair[1];
    ws.accept();
    const reject = (why) => { ws.send(JSON.stringify({ t: 'reject', why })); ws.close(4001, why); return new Response(null, { status: 101, webSocket: pair[0] }); };
    if (this.started) return reject('이미 시작한 방이에요');
    if (this.peers.size >= this.meta.max) return reject('방이 꽉 찼어요');
    for (const p of this.peers.values()) if (p.uid === me.uid) return reject('이미 이 방에 있어요');
    const cut = Date.now() - 60000;
    for (const [pid, p] of this.peers) if (p.seen < cut) { try { p.ws.close(4003, 'idle'); } catch { /* closed */ } this.drop(pid); }
    if (this.started && !this.peers.size) this.started = false;
    const id = 'r' + ++this.seq;
    const peer = { id, uid: me.uid, ws, name: me.name, level: me.level, look: me.look, levels: me.levels, seen: Date.now() };
    this.peers.set(id, peer);
    if (!this.host) this.host = id;
    ws.send(JSON.stringify({ t: 'welcome', you: id, host: this.host, room: { code, name: this.meta.name, max: this.meta.max }, players: [...this.peers.values()].map(rinfo) }));
    this.broadcast({ t: 'join', p: rinfo(peer) }, id);
    ws.addEventListener('message', (ev) => this.onMsg(peer, ev.data));
    ws.addEventListener('close', () => this.drop(id));
    ws.addEventListener('error', () => this.drop(id));
    this.report();
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  onMsg(peer, raw) {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    peer.seen = Date.now();
    if (m.t === 'ping') return;
    if (m.t === 'start' && peer.id === this.host && !this.started) {
      this.started = true;
      this.broadcast({ t: 'start', seed: (Math.random() * 1e9) | 0 });
      this.report();
    } else if (m.t === 'relay') {
      const s = JSON.stringify({ t: 'msg', from: peer.id, d: m.d });
      if (m.to) { const p = this.peers.get(m.to); if (p) try { p.ws.send(s); } catch { /* closed */ } }
      else for (const p of this.peers.values()) if (p.id !== peer.id) { try { p.ws.send(s); } catch { /* closed */ } }
    } else if (m.t === 'kick' && peer.id === this.host && this.peers.has(m.id) && !this.started) {
      const p = this.peers.get(m.id);
      try { p.ws.send(JSON.stringify({ t: 'reject', why: '방장이 내보냈어요' })); p.ws.close(4002, 'kicked'); } catch { /* closed */ }
      this.drop(m.id);
    }
  }

  drop(id) {
    if (!this.peers.has(id)) return;
    this.peers.delete(id);
    if (this.host === id) {
      this.host = this.peers.size ? this.peers.keys().next().value : null;
    }
    this.broadcast({ t: 'leave', id, host: this.host });
    this.report();
    if (!this.peers.size) { this.started = false; this.meta = null; }
  }
  broadcast(m, except) {
    const s = JSON.stringify(m);
    for (const p of this.peers.values()) if (p.id !== except) { try { p.ws.send(s); } catch { /* closed */ } }
  }
  report() {
    if (!this.meta) return;
    const host = this.host ? this.peers.get(this.host) : null;
    this.ctx.waitUntil(store(this.env).fetch(new Request('https://x/api/internal/room', { method: 'POST', body: JSON.stringify({ code: this.meta.code, count: this.peers.size, started: this.started, host: host ? host.uid : '' }) })).catch(() => {}));
  }
}
const rinfo = (p) => ({ id: p.id, name: p.name, level: p.level, look: p.look, levels: p.levels });
