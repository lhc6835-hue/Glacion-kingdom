// Two browsers sign up, meet on the plaza, share a room and fight together.
// usage: node tests/coop.mjs <baseUrl> <outPrefix>
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [base = 'http://localhost:5173/', out = 'coop'] = process.argv.slice(2);
const b = await chromium.launch();
const errs = [];
const mk = async (tag) => {
  const ctx = await b.newContext({ viewport: { width: 1000, height: 620 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(tag + ': ' + e.message + '\n' + e.stack));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(tag + ' console: ' + m.text()); });
  await p.goto(base);
  await p.waitForSelector('.auth');
  await p.click('[data-m=signup]');
  const id = tag + Math.floor(Math.random() * 1e6);
  await p.fill('[name=id]', id); await p.fill('[name=pw]', 'pass1234'); await p.fill('[name=name]', tag === 'host' ? '방장콘' : '손님콘');
  await p.click('form button');
  await p.waitForFunction(() => window.__app.scene && 'others' in window.__app.scene, null, { timeout: 15000 });
  return p;
};
const A = await mk('host');
const B = await mk('guest');
await A.waitForTimeout(2000);
const seen = await A.evaluate(() => window.__app.scene.others.size);
console.log('host sees others on plaza:', seen);
await B.evaluate(() => window.__app.scene.say('안녕하세요!'));
await A.waitForTimeout(800);
await A.screenshot({ path: out + '_plaza.png' });
// host makes a 2-player room
await A.evaluate(() => window.__app.net.createRoom({ name: '테스트 방', max: 2, priv: false }));
await A.waitForSelector('.lobby');
const code = await A.evaluate(() => document.querySelector('.code').textContent);
console.log('room', code);
const list = await B.evaluate(() => window.__app.net.listRooms());
console.log('guest sees rooms:', list.map((r) => r.id + ':' + r.count).join(','));
try { await B.evaluate((c) => window.__app.net.joinRoom(c).then(() => 1), code); } catch (e) { console.log('JOIN FAIL', e.message.split('\n')[0]); console.log(errs.join('\n')); process.exit(1); }
await B.waitForSelector('.lobby');
await A.waitForTimeout(800);
await A.screenshot({ path: out + '_lobby.png' });
await A.click('.overlay [data-a=start]');
await A.waitForFunction(() => window.__arena && window.__arena.coop, null, { timeout: 10000 });
await B.waitForFunction(() => window.__arena && window.__arena.coop, null, { timeout: 10000 });
for (const p of [A, B]) { await p.mouse.move(700, 250); await p.mouse.down(); }
for (let i = 0; i < 16; i++) {
  for (const p of [A, B]) { await p.keyboard.down(['KeyD', 'KeyS', 'KeyA', 'KeyW'][i % 4]); }
  await A.waitForTimeout(450);
  for (const p of [A, B]) { await p.keyboard.up(['KeyD', 'KeyS', 'KeyA', 'KeyW'][i % 4]); const pk = await p.$('.pick'); if (pk) await pk.click(); }
  await A.waitForTimeout(450);
}
await A.screenshot({ path: out + '_host.png' });
await B.screenshot({ path: out + '_guest.png' });
const st = async (p) => p.evaluate(() => { const a = window.__arena; return { host: a.coop.isHost, wave: a.wave, state: a.state, enemies: a.enemies.length, players: a.players.length, myKills: a.me.kills, kills: a.kills, coins: Math.round(a.coins) }; });
console.log('host', JSON.stringify(await st(A)));
console.log('guest', JSON.stringify(await st(B)));
console.log(errs.slice(0, 6).join('\n---\n') || 'no errors');
await b.close();
