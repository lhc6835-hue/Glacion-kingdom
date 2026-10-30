// Account economy, shared by the browser (guest/offline play) and the server (signed-in play) so
// both sides apply exactly the same rules: purchases, gacha rolls, run rewards and level-ups.
import { GRADES, GRADE_INDEX, MAX_LEVEL } from './grades.js';
import { MOLDS, MOLD } from './molds.js';
import { FLAVORS, FLAVOR } from './flavors.js';
import { WEAPONS, WEAPON } from './weapons.js';
import { FACES, FACE } from './faces.js';

export const START_COINS = 1500;
export const GACHA = {
  flavor: { one: 300, ten: 2700, pool: FLAVORS, name: '맛 뽑기' },
  weapon: { one: 500, ten: 4500, pool: WEAPONS, name: '무기 뽑기' },
};
// one guaranteed 스프링클-or-better result in every ten-pull, and a 젤라또+ pity after 60 pulls
const TEN_FLOOR = GRADE_INDEX.sprinkle;
const PITY = 60;

export function newProfile(name = '아이스크림') {
  return {
    v: 1,
    name,
    level: 1,
    xp: 0,
    coins: START_COINS,
    molds: { papercup: 1 },
    flavors: { milk: 1, strawberry: 1 },
    weapons: { spoon: 1 },
    faces: { smile: 1 },
    loadout: { mold: 'papercup', flavors: ['milk'], weapon: 'spoon', face: 'smile' },
    pity: { flavor: 0, weapon: 0 },
    stats: { bestWave: 0, runs: 0, kills: 0, bossKills: 0 },
    votes: {},
    created: Date.now(),
  };
}

export const xpNeed = (lv) => Math.round(120 + (lv - 1) * 70 + Math.pow(lv - 1, 2) * 9);
export const levelReward = (lv) => 250 + lv * 60;

// Every handler returns { ok, error?, ...detail } and mutates the profile in place on success.
export function buyMold(p, id) {
  const m = MOLD[id];
  if (!m) return { ok: false, error: '없는 틀이에요' };
  if (p.molds[id]) return { ok: false, error: '이미 가지고 있어요' };
  if (p.coins < m.price) return { ok: false, error: '코인이 부족해요' };
  p.coins -= m.price;
  p.molds[id] = 1;
  return { ok: true };
}

export function buyFace(p, id) {
  const f = FACE[id];
  if (!f) return { ok: false, error: '없는 표정이에요' };
  if (p.faces[id]) return { ok: false, error: '이미 가지고 있어요' };
  if (p.coins < f.price) return { ok: false, error: '코인이 부족해요' };
  p.coins -= f.price;
  p.faces[id] = 1;
  return { ok: true };
}

function rollGrade(rand, floor = 0) {
  const avail = GRADES.slice(floor);
  const sum = avail.reduce((s, g) => s + g.rate, 0);
  let r = rand() * sum;
  for (let i = 0; i < avail.length; i++) { r -= avail[i].rate; if (r <= 0) return floor + i; }
  return floor;
}

export function gacha(p, kind, count, rand = Math.random) {
  const G = GACHA[kind];
  if (!G || (count !== 1 && count !== 10)) return { ok: false, error: '잘못된 뽑기예요' };
  const cost = count === 10 ? G.ten : G.one;
  if (p.coins < cost) return { ok: false, error: '코인이 부족해요' };
  p.coins -= cost;
  const bag = kind === 'flavor' ? p.flavors : p.weapons;
  const results = [];
  let gotFloor = false;
  for (let i = 0; i < count; i++) {
    p.pity[kind] = (p.pity[kind] || 0) + 1;
    let floor = 0;
    if (p.pity[kind] >= PITY) floor = GRADE_INDEX.gelato;
    if (count === 10 && i === 9 && !gotFloor) floor = Math.max(floor, TEN_FLOOR);
    let gi = rollGrade(rand, floor);
    // a grade with no items falls back to the nearest lower grade that has some
    let items = G.pool.filter((x) => GRADE_INDEX[x.grade] === gi);
    while (!items.length && gi > 0) { gi--; items = G.pool.filter((x) => GRADE_INDEX[x.grade] === gi); }
    if (gi >= TEN_FLOOR) gotFloor = true;
    if (gi >= GRADE_INDEX.gelato) p.pity[kind] = 0;
    const it = items[Math.floor(rand() * items.length)];
    const isNew = !bag[it.id];
    const before = bag[it.id] || 0;
    bag[it.id] = Math.min(MAX_LEVEL, before + 1);
    // duplicates past max level are refunded as coins
    let refund = 0;
    if (before >= MAX_LEVEL) { refund = Math.round(cost / count * 0.5); p.coins += refund; }
    results.push({ id: it.id, grade: it.grade, isNew, level: bag[it.id], refund });
  }
  return { ok: true, results };
}

export function setLoadout(p, lo) {
  const m = MOLD[lo.mold];
  if (!m || !p.molds[lo.mold]) return { ok: false, error: '가지고 있지 않은 틀이에요' };
  if (!WEAPON[lo.weapon] || !p.weapons[lo.weapon]) return { ok: false, error: '가지고 있지 않은 무기예요' };
  if (!FACE[lo.face] || !p.faces[lo.face]) return { ok: false, error: '가지고 있지 않은 표정이에요' };
  const fl = (lo.flavors || []).slice(0, m.layers);
  if (fl.length !== m.layers) return { ok: false, error: `맛을 ${m.layers}개 골라야 해요` };
  if (new Set(fl).size !== fl.length) return { ok: false, error: '같은 맛은 한 번만 쌓을 수 있어요' };
  if (fl.some((f) => !FLAVOR[f] || !p.flavors[f])) return { ok: false, error: '가지고 있지 않은 맛이 있어요' };
  p.loadout = { mold: lo.mold, flavors: fl, weapon: lo.weapon, face: lo.face };
  return { ok: true };
}

// Fills a loadout's scoop slots for a mold, keeping current flavors first.
export function fitFlavors(p, moldId, current) {
  const n = MOLD[moldId].layers;
  const owned = Object.keys(p.flavors).sort((a, b) => GRADE_INDEX[FLAVOR[b].grade] - GRADE_INDEX[FLAVOR[a].grade]);
  const out = [];
  for (const f of current) if (out.length < n && p.flavors[f] && !out.includes(f)) out.push(f);
  for (const f of owned) if (out.length < n && !out.includes(f)) out.push(f);
  return out;
}

// Applies a finished run. Values are clamped so a tampered client cannot grant itself millions.
export function applyRun(p, r) {
  const wave = Math.max(0, Math.min(500, r.wave | 0));
  const coins = Math.max(0, Math.min(2000 + wave * 900, r.coins | 0));
  const xp = Math.max(0, Math.min(200 + wave * 160, r.xp | 0));
  p.coins += coins;
  p.xp += xp;
  p.stats.runs++;
  p.stats.kills += Math.max(0, Math.min(100000, r.kills | 0));
  p.stats.bossKills += Math.max(0, Math.min(100, r.bossKills | 0));
  p.stats.bestWave = Math.max(p.stats.bestWave, wave);
  const ups = [];
  while (p.xp >= xpNeed(p.level)) {
    p.xp -= xpNeed(p.level);
    p.level++;
    const reward = levelReward(p.level);
    p.coins += reward;
    ups.push({ level: p.level, reward });
  }
  return { ok: true, coins, xp, ups };
}

export function sanitizeProfile(p) {
  const d = newProfile((p && p.name) || undefined);
  if (!p || typeof p !== 'object') return d;
  const out = { ...d, ...p };
  for (const k of ['molds', 'flavors', 'weapons', 'faces', 'pity', 'stats', 'votes']) out[k] = { ...d[k], ...(p[k] || {}) };
  for (const [bag, table] of [['molds', MOLD], ['flavors', FLAVOR], ['weapons', WEAPON], ['faces', FACE]]) {
    for (const k of Object.keys(out[bag])) if (!table[k]) delete out[bag][k];
  }
  if (!setLoadout(out, out.loadout || {}).ok) out.loadout = d.loadout;
  return out;
}

// 오늘의 게시판: three candidate flavors per day, chosen from the date so every client agrees.
export function dayKey(d = new Date()) { return d.toISOString().slice(0, 10); }
export function dailyCandidates(day = dayKey()) {
  let h = 0;
  for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pool = FLAVORS.filter((f) => GRADE_INDEX[f.grade] < GRADE_INDEX.og);
  const out = [];
  while (out.length < 3) { h = (h * 1103515245 + 12345) >>> 0; const f = pool[h % pool.length]; if (!out.includes(f.id)) out.push(f.id); }
  return out;
}
export function vote(p, flavor, day = dayKey()) {
  if (!dailyCandidates(day).includes(flavor)) return { ok: false, error: '오늘의 후보가 아니에요' };
  if (p.votes[day]) return { ok: false, error: '오늘은 이미 투표했어요' };
  p.votes = { [day]: flavor };
  p.coins += 80;
  return { ok: true, reward: 80 };
}

// 분수대 소원: toss 20 coins, get a fortune and sometimes a little luck back.
const FORTUNES = [
  '오늘은 왠지 체리 폭탄이 잘 터질 것 같아요.', '맨 위 스쿱이 오늘따라 단단해 보여요.', '바닐라 향기가 행운을 불러와요.',
  '열기방울은 생각보다 겁이 많대요.', '구르기는 사랑이에요. 아끼지 마세요.', '오늘 뽑기 운: 말랑말랑', '누군가 당신의 표정을 칭찬하고 있어요.',
  '민트초코는 언제나 옳아요.', '아이스크림은 녹아도 마음은 녹지 않아요.', '보스 앞에서는 크게 숨을 들이쉬어요. 차갑게!',
];
export function wish(p, rand = Math.random) {
  if (p.coins < 20) return { ok: false, error: '코인이 부족해요' };
  p.coins -= 20;
  const r = rand();
  const reward = r < 0.02 ? 1000 : r < 0.12 ? 120 : r < 0.4 ? 30 : 0;
  p.coins += reward;
  return { ok: true, reward, fortune: FORTUNES[Math.floor(rand() * FORTUNES.length)] };
}

export const ACTIONS = { buyMold, buyFace, gacha, setLoadout, applyRun, vote, wish };

export const CATALOG = { MOLDS, FLAVORS, WEAPONS, FACES, GRADES };
