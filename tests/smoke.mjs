// Smoke test: serves the built game (dist/) and checks that the title, plaza, shop and a short
// arena run all work offline without page errors. Usage: npm run build && npm test
import { createRequire } from 'node:module';
import { serve } from '../tools/serve.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const server = await serve(new URL('../dist', import.meta.url).pathname);
const base = `http://127.0.0.1:${server.address().port}/index.html?offline`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 680 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };

try {
  await page.goto(base);
  await page.waitForSelector('.auth', { timeout: 15000 });
  check('title shows sign-in', true);
  await page.click('[data-a=guest]');
  await page.waitForFunction(() => window.__app.scene && 'others' in window.__app.scene);
  check('guest reaches the plaza', true);
  const npcs = await page.evaluate(() => window.__app.scene.npcs.length);
  check('plaza has townsfolk', npcs > 0, `${npcs}`);

  const gacha = await page.evaluate(async () => { window.__app.profile.data.coins = 10000; const r = await window.__app.profile.act('gacha', 'flavor', 10); return r.ok && r.results.length; });
  check('ten-pull gacha', gacha === 10);
  const best = await page.evaluate(() => window.__app.profile.act('setLoadout', { mold: 'papercup', flavors: ['milk'], weapon: 'spoon', face: 'smile' }).then((r) => r.ok));
  check('loadout saves', best);

  await page.evaluate(() => window.__app.scene.use({ id: 'gallery' }));
  await page.waitForTimeout(500);
  const floor = await page.evaluate(() => window.__app.scene.molds && window.__app.scene.molds.length);
  check('mold gallery floor 1 has molds', floor > 0, `${floor}`);

  await page.goto(base + '&play&w=chipgun');
  await page.waitForFunction(() => window.__arena && window.__arena.enemies.length > 0, null, { timeout: 15000 });
  // put a few heat drops right in front of the hero and fire at them
  await page.evaluate(() => { const A = window.__arena; for (let i = 0; i < 4; i++) A.spawnEnemy('heatdrop', A.me.x + 160, A.me.y - 20 + i * 12); });
  await page.mouse.move(900, 320);
  await page.mouse.down();
  await page.waitForTimeout(4000);
  const st = await page.evaluate(() => ({ wave: window.__arena.wave, kills: window.__arena.kills }));
  check('arena runs and enemies die', st.wave >= 1 && st.kills > 0, JSON.stringify(st));
  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (e) {
  check('unexpected exception', false, e.message);
} finally {
  await browser.close();
  server.close();
}
const failed = results.filter((r) => !r).length;
console.log(failed ? `${failed} failed` : `all ${results.length} passed`);
process.exit(failed ? 1 : 0);
