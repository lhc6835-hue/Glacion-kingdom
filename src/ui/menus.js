// Menus for the side scenes: the profile HUD, mold cards, the wardrobe (내 아이스크림),
// gacha machines, the face shop and the elevator.
import { h, esc } from './ui.js';
import { iconCanvas, moldPreviewRig } from '../render/icons.js';
import { IceCreamRig } from '../render/icecream.js';
import { MOLD, MOLDS } from '../../shared/molds.js';
import { FLAVOR, FLAVORS } from '../../shared/flavors.js';
import { WEAPON, WEAPONS } from '../../shared/weapons.js';
import { FACE, FACES } from '../../shared/faces.js';
import { GRADES, GRADE_INDEX, grade, LAYER_STRENGTH, LEVEL_BONUS, MAX_LEVEL } from '../../shared/grades.js';
import { GACHA, xpNeed, fitFlavors } from '../../shared/economy.js';
import { sfx, setMuted, isMuted } from '../core/audio.js';

const badge = (gid) => { const g = grade(gid); return `<span class="badge g-${gid}" style="--gc:${g.color};--gg:${g.glow}">${g.name}</span>`; };

// Animated ice cream inside a canvas; stops when the canvas leaves the page.
export function livePreview(canvas, rig, { size = 200, scale } = {}) {
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = canvas.height = size * dpr;
  canvas.style.width = canvas.style.height = size + 'px';
  const g = canvas.getContext('2d');
  let last = performance.now(), t = 0;
  const loop = (now) => {
    if (!canvas.isConnected) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    rig.update(dt, { vx: Math.sin(t * 1.3) * 60, lookX: Math.sin(t * 0.9) * 0.8 });
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size, size);
    const top = -rig.topY();
    const s = scale || Math.min(1.6, (size * 0.8) / top);
    rig.draw(g, size / 2, size * 0.92, s);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return { rig };
}

// ── HUD ─────────────────────────────────────────────────────
export function sideHud(app, extra = '') {
  const el = app.ui.set('hud', h(`<div class="passthru">
    <div class="chip" data-a="me">
      <div class="lv">Lv.<b></b></div>
      <div class="nm"></div>
      <div class="xp"><i></i></div>
    </div>
    <div class="coins">🍬 <b></b></div>
    <div class="hud-btns">
      ${extra}
      <button class="icon-btn" data-a="ward" title="내 아이스크림">🍦</button>
      <button class="icon-btn" data-a="snd" title="소리">🔊</button>
    </div>
  </div>`));
  const render = (p) => {
    el.querySelector('.lv b').textContent = p.level;
    el.querySelector('.nm').textContent = p.name;
    el.querySelector('.xp i').style.width = Math.min(100, (p.xp / xpNeed(p.level)) * 100) + '%';
    el.querySelector('.coins b').textContent = Math.floor(p.coins).toLocaleString();
    el.querySelector('[data-a=snd]').textContent = isMuted() ? '🔇' : '🔊';
  };
  render(app.profile.data);
  const off = app.profile.onChange(render);
  const obs = new MutationObserver(() => { if (!el.isConnected) { off(); obs.disconnect(); } });
  obs.observe(app.ui.root, { childList: true });
  el.querySelector('[data-a=ward]').onclick = () => { sfx.open(); wardrobe(app); };
  el.querySelector('[data-a=snd]').onclick = () => { setMuted(!isMuted()); render(app.profile.data); };
  el.querySelector('[data-a=me]').onclick = () => { sfx.open(); profileCard(app); };
  return el;
}

export function profileCard(app) {
  const p = app.profile.data;
  const card = app.ui.modal('modal', `
    <h2>${esc(p.name)}</h2>
    <div class="sub">${app.profile.signedIn ? '로그인 중' : '게스트로 놀고 있어요 (기록은 이 기기에만 저장돼요)'}</div>
    <div class="stats">
      <div class="stat"><b>Lv.${p.level}</b><span>${p.xp} / ${xpNeed(p.level)} XP</span></div>
      <div class="stat"><b>${p.stats.bestWave}</b><span>최고 웨이브</span></div>
      <div class="stat"><b>${p.stats.kills.toLocaleString()}</b><span>총 처치</span></div>
      <div class="stat"><b>${Object.keys(p.flavors).length}/${FLAVORS.length}</b><span>모은 맛</span></div>
      <div class="stat"><b>${Object.keys(p.molds).length}/${MOLDS.length}</b><span>모은 틀</span></div>
      <div class="stat"><b>${Object.keys(p.weapons).length}/${WEAPONS.length}</b><span>모은 무기</span></div>
    </div>
    <div class="sub">레벨이 오를 때마다 보너스 코인을 받아요. 다음 레벨 보상: 🍬 ${(250 + (p.level + 1) * 60).toLocaleString()}</div>
    <div class="row">${app.profile.signedIn ? '<button class="btn ghost" data-a="out">로그아웃</button>' : ''}<button class="btn" data-a="ok">닫기</button></div>`);
  card.querySelector('[data-a=ok]').onclick = () => app.ui.remove('modal');
  const out = card.querySelector('[data-a=out]');
  if (out) out.onclick = () => { app.ui.remove('modal'); app.signOut(); };
}

// ── molds ───────────────────────────────────────────────────
export function moldCard(app, id, onChange) {
  const m = MOLD[id];
  const p = app.profile.data;
  const owned = !!p.molds[id];
  const equipped = p.loadout.mold === id;
  const g = grade(m.grade);
  const card = app.ui.modal('modal', `
    <div class="item-head">
      <canvas class="preview"></canvas>
      <div class="info">
        ${badge(m.grade)}
        <h2 style="text-align:left">${esc(m.name)}</h2>
        <div class="kv"><span>층 수</span><b>${'🍨'.repeat(m.layers)} ${m.layers}층</b></div>
        <div class="trait">${esc(m.desc)}</div>
        <div class="note">층마다 다른 맛을 올릴 수 있고, 맞을 때마다 맨 위 층부터 녹아요.</div>
      </div>
    </div>
    <div class="row">
      <button class="btn ghost" data-a="x">닫기</button>
      ${owned ? (equipped ? '<button class="btn mint" disabled>장착 중</button>' : '<button class="btn mint" data-a="eq">이 틀로 바꾸기</button>')
        : `<button class="btn gold" data-a="buy" ${p.coins < m.price ? 'disabled' : ''}>🍬 ${m.price.toLocaleString()} 구매</button>`}
    </div>
    <div class="err"></div>`);
  const rig = moldPreviewRig(id, owned ? fitFlavors(p, id, p.loadout.flavors) : ['milk'], p.loadout.face);
  livePreview(card.querySelector('.preview'), rig, { size: 200 });
  if (!owned) card.querySelector('.preview').classList.add('locked');
  card.style.setProperty('--gc', g.color);
  card.querySelector('[data-a=x]').onclick = () => app.ui.remove('modal');
  const buy = card.querySelector('[data-a=buy]');
  if (buy) buy.onclick = async () => {
    const r = await app.profile.act('buyMold', id);
    if (!r.ok) { card.querySelector('.err').textContent = r.error; return; }
    sfx.gacha(GRADE_INDEX[m.grade]);
    app.ui.toast(`${m.name}을(를) 손에 넣었어요!`);
    moldCard(app, id, onChange);
    onChange && onChange();
  };
  const eq = card.querySelector('[data-a=eq]');
  if (eq) eq.onclick = async () => {
    const lo = { ...p.loadout, mold: id, flavors: fitFlavors(p, id, p.loadout.flavors) };
    const r = await app.profile.act('setLoadout', lo);
    if (!r.ok) { card.querySelector('.err').textContent = r.error; return; }
    sfx.click();
    app.ui.remove('modal');
    onChange && onChange();
  };
}

export function floorPicker(app, cur, go) {
  const FL = ['1층 · 얼음조각/소프트', '2층 · 스쿱/스프링클', '3층 · 젤라또/선데', '4층 · 빙하/오로라', '5층 · 갤럭시/OG'];
  const card = app.ui.modal('modal', `<h2>엘리베이터</h2><div class="sub">어느 층으로 갈까요?</div>
    <div class="floors">${FL.map((f, i) => `<button class="btn ${i === cur ? 'ghost' : 'sky'}" data-f="${i}">${i === cur ? '📍 ' : ''}${f}</button>`).reverse().join('')}</div>`);
  card.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => { app.ui.remove('modal'); go(+b.dataset.f); }));
}

// ── wardrobe ────────────────────────────────────────────────
export function wardrobe(app, tab = 'flavor') {
  const p = app.profile.data;
  const lo = { ...p.loadout, flavors: [...p.loadout.flavors] };
  let slot = lo.flavors.length - 1;
  const card = app.ui.modal('modal', `
    <h2>내 아이스크림</h2>
    <div class="ward">
      <div class="ward-left">
        <canvas class="preview"></canvas>
        <div class="slots"></div>
      </div>
      <div class="ward-right">
        <div class="tabs">
          <button data-t="flavor">맛</button><button data-t="mold">틀</button><button data-t="weapon">무기</button><button data-t="face">표정</button>
        </div>
        <div class="list"></div>
        <div class="detail"></div>
      </div>
    </div>
    <div class="err"></div>
    <div class="row"><button class="btn ghost" data-a="x">취소</button><button class="btn" data-a="save">이대로 저장!</button></div>`);
  card.classList.add('wide');
  const rig = new IceCreamRig({ ...lo });
  livePreview(card.querySelector('.preview'), rig, { size: 190 });

  const refreshRig = () => rig.setLook({ ...lo });
  const slotsEl = card.querySelector('.slots');
  const renderSlots = () => {
    const n = MOLD[lo.mold].layers;
    slotsEl.innerHTML = '';
    for (let i = n - 1; i >= 0; i--) {
      const f = FLAVOR[lo.flavors[i]];
      const strength = LAYER_STRENGTH[n - 1 - i];
      const b = h(`<button class="slot ${i === slot ? 'on' : ''}"><span class="sl">${n - i}층 ${i === n - 1 ? '(맨 위)' : ''}</span><span class="sn">${f ? esc(f.name) : '비어 있음'}</span><span class="ss">${MOLD[lo.mold].id === 'classic' ? '100%' : Math.round(strength * 100) + '%'}</span></button>`);
      if (f) b.prepend(iconCanvas('flavor', f.id, 34));
      b.onclick = () => { slot = i; setTab('flavor'); renderSlots(); };
      slotsEl.appendChild(b);
    }
  };

  const listEl = card.querySelector('.list'), detailEl = card.querySelector('.detail');
  const items = {
    flavor: () => FLAVORS.filter((f) => p.flavors[f.id]),
    mold: () => MOLDS.filter((m) => p.molds[m.id]),
    weapon: () => WEAPONS.filter((w) => p.weapons[w.id]),
    face: () => FACES.filter((f) => p.faces[f.id]),
  };
  const isOn = (t, id) => (t === 'flavor' ? lo.flavors[slot] === id : t === 'mold' ? lo.mold === id : t === 'weapon' ? lo.weapon === id : lo.face === id);
  const describe = (t, it) => {
    const lvl = t === 'flavor' ? p.flavors[it.id] : t === 'weapon' ? p.weapons[it.id] : 0;
    const lv = lvl ? `<div class="note">Lv.${lvl}/${MAX_LEVEL} · 효과 +${Math.round((lvl - 1) * LEVEL_BONUS * 100)}% (같은 걸 또 뽑으면 레벨 업)</div>` : '';
    const desc = t === 'mold' ? `${it.layers}층 · ${it.desc}` : t === 'weapon' ? `${it.desc}<br><small>피해 ${it.dmg} · ${(1 / it.cd).toFixed(1)}회/초</small>` : t === 'face' ? '귀여운 표정' : it.desc;
    return `${badge(it.grade)} <b>${esc(it.name)}</b><div class="trait">${desc}</div>${lv}`;
  };
  let curTab = tab;
  const setTab = (t) => {
    curTab = t;
    card.querySelectorAll('[data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
    const list = items[t]().sort((a, b) => GRADE_INDEX[b.grade] - GRADE_INDEX[a.grade]);
    listEl.innerHTML = '';
    for (const it of list) {
      const g = grade(it.grade);
      const used = t === 'flavor' && lo.flavors.includes(it.id) && lo.flavors[slot] !== it.id;
      const b = h(`<button class="it ${isOn(t, it.id) ? 'on' : ''} ${used ? 'used' : ''}" style="--gc:${g.color}"><span>${esc(it.name)}</span></button>`);
      b.prepend(iconCanvas(t, it.id, 52));
      b.onclick = () => {
        sfx.click();
        if (t === 'flavor') {
          const other = lo.flavors.indexOf(it.id);
          if (other >= 0 && other !== slot) lo.flavors[other] = lo.flavors[slot];
          lo.flavors[slot] = it.id;
          renderSlots();
        } else if (t === 'mold') {
          lo.mold = it.id;
          lo.flavors = fitFlavors(p, it.id, lo.flavors);
          slot = lo.flavors.length - 1;
          renderSlots();
        } else if (t === 'weapon') lo.weapon = it.id;
        else lo.face = it.id;
        refreshRig();
        setTab(t);
        detailEl.innerHTML = describe(t, it);
      };
      b.onpointerenter = () => { detailEl.innerHTML = describe(t, it); };
      listEl.appendChild(b);
    }
    const cur = list.find((it) => isOn(t, it.id));
    detailEl.innerHTML = cur ? describe(t, cur) : '<div class="note">아래층일수록 맛 효과가 약해져요 (100 · 75 · 60 · 50 · 42%)</div>';
  };
  card.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => setTab(b.dataset.t)));
  renderSlots();
  setTab(curTab);
  card.querySelector('[data-a=x]').onclick = () => app.ui.remove('modal');
  card.querySelector('[data-a=save]').onclick = async () => {
    const r = await app.profile.act('setLoadout', lo);
    if (!r.ok) { card.querySelector('.err').textContent = r.error; return; }
    sfx.levelup();
    app.ui.remove('modal');
    app.ui.toast('새 아이스크림 완성!');
    if (app.scene && app.scene.onLoadout) app.scene.onLoadout();
  };
}

// ── gacha ───────────────────────────────────────────────────
export function gachaMachine(app, kind) {
  const G = GACHA[kind];
  const p = app.profile.data;
  const rates = GRADES.map((g) => `<span style="color:${g.color}">${g.name} ${g.rate}%</span>`).join(' · ');
  const pool = G.pool;
  const owned = pool.filter((x) => (kind === 'flavor' ? p.flavors : p.weapons)[x.id]).length;
  const card = app.ui.modal('modal', `
    <h2>${G.name}</h2>
    <div class="sub">${kind === 'flavor' ? '맛' : '무기'} ${owned}/${pool.length} 수집 · 10연속 뽑기는 스프링클 등급 이상 1개 보장</div>
    <div class="machine ${kind}"><div class="globe"><div class="caps"></div></div><div class="base"><div class="slot-o"></div></div></div>
    <div class="rates">${rates}</div>
    <div class="row">
      <button class="btn ghost" data-a="x">닫기</button>
      <button class="btn sky" data-n="1">1번 🍬 ${G.one.toLocaleString()}</button>
      <button class="btn gold" data-n="10">10번 🍬 ${G.ten.toLocaleString()}</button>
    </div>
    <div class="err"></div>`);
  const caps = card.querySelector('.caps');
  for (let i = 0; i < 16; i++) {
    const c = h(`<i style="left:${8 + Math.random() * 76}%;top:${30 + Math.random() * 55}%;--c:${GRADES[(Math.random() * 6) | 0].color};animation-delay:${-Math.random() * 2}s"></i>`);
    caps.appendChild(c);
  }
  card.querySelector('[data-a=x]').onclick = () => app.ui.remove('modal');
  card.querySelectorAll('[data-n]').forEach((b) => (b.onclick = async () => {
    const n = +b.dataset.n;
    card.querySelectorAll('button').forEach((x) => (x.disabled = true));
    card.querySelector('.machine').classList.add('spin');
    sfx.open();
    const r = await app.profile.act('gacha', kind, n);
    if (!r.ok) {
      card.querySelector('.machine').classList.remove('spin');
      card.querySelector('.err').textContent = r.error;
      card.querySelectorAll('button').forEach((x) => (x.disabled = false));
      return;
    }
    setTimeout(() => gachaReveal(app, kind, r.results), 900);
  }));
}

function gachaReveal(app, kind, results) {
  const best = Math.max(...results.map((r) => GRADE_INDEX[r.grade]));
  const table = kind === 'flavor' ? FLAVOR : WEAPON;
  const card = app.ui.modal('modal', `
    <h2>${results.length > 1 ? '10연속 결과!' : '두근두근…'}</h2>
    <div class="reveal ${results.length > 1 ? 'many' : 'one'}"></div>
    <div class="row" style="margin-top:14px"><button class="btn ghost" data-a="x">닫기</button><button class="btn" data-a="again">한 번 더</button><button class="btn mint" data-a="ward">바로 장착하기</button></div>`, { closable: false });
  card.classList.add('wide');
  const box = card.querySelector('.reveal');
  results.forEach((r, i) => {
    const it = table[r.id];
    const g = grade(r.grade);
    const el = h(`<div class="cap g-${r.grade}" style="--gc:${g.color};--gg:${g.glow};animation-delay:${i * 0.12}s">
      <div class="burst"></div>
      <div class="ic"></div>
      <div class="gn">${g.name}</div>
      <div class="nm">${esc(it.name)}</div>
      <div class="tag">${r.isNew ? 'NEW!' : r.refund ? `+🍬${r.refund}` : `Lv.${r.level}`}</div>
      ${results.length === 1 ? `<div class="ds">${esc(it.desc)}</div>` : ''}
    </div>`);
    el.querySelector('.ic').appendChild(iconCanvas(kind, r.id, results.length > 1 ? 64 : 120));
    box.appendChild(el);
  });
  setTimeout(() => sfx.gacha(best), 150);
  card.querySelector('[data-a=x]').onclick = () => app.ui.remove('modal');
  card.querySelector('[data-a=again]').onclick = () => gachaMachine(app, kind);
  card.querySelector('[data-a=ward]').onclick = () => wardrobe(app, kind);
}

// ── face shop ───────────────────────────────────────────────
export function faceShop(app) {
  const card = app.ui.modal('modal', `
    <h2>표정 가게</h2>
    <div class="sub">눈은 언제나 동글동글 점 두 개! 입 모양으로 기분을 바꿔봐요</div>
    <div class="faces"></div>
    <div class="err"></div>
    <div class="row"><button class="btn ghost" data-a="x">닫기</button></div>`);
  card.classList.add('wide');
  const box = card.querySelector('.faces');
  const render = () => {
    const p = app.profile.data;
    box.innerHTML = '';
    for (const f of FACES) {
      const g = grade(f.grade);
      const own = !!p.faces[f.id], on = p.loadout.face === f.id;
      const el = h(`<div class="face-it" style="--gc:${g.color}">
        <div class="ic"></div><div class="nm">${esc(f.name)}</div>${badge(f.grade)}
        <button class="btn small ${own ? (on ? 'ghost' : 'mint') : 'gold'}" ${on || (!own && p.coins < f.price) ? 'disabled' : ''}>${own ? (on ? '쓰는 중' : '쓰기') : '🍬 ' + f.price.toLocaleString()}</button>
      </div>`);
      el.querySelector('.ic').appendChild(iconCanvas('face', f.id, 72));
      el.querySelector('button').onclick = async () => {
        const r = own ? await app.profile.act('setLoadout', { ...app.profile.data.loadout, face: f.id }) : await app.profile.act('buyFace', f.id);
        if (!r.ok) { card.querySelector('.err').textContent = r.error; return; }
        if (!own) { sfx.gacha(GRADE_INDEX[f.grade]); app.ui.toast(`표정 「${f.name}」을(를) 샀어요!`); await app.profile.act('setLoadout', { ...app.profile.data.loadout, face: f.id }); }
        else sfx.click();
        if (app.scene && app.scene.onLoadout) app.scene.onLoadout();
        render();
      };
      box.appendChild(el);
    }
  };
  render();
  card.querySelector('[data-a=x]').onclick = () => app.ui.remove('modal');
}
