// HTML interface: HUD, prompts, toasts and the station panels. Panels render from state and
// re-render when state changes; buttons carry data-act attributes handled in one place.
import { ITEMS } from '../data/items.js';
import { AXES, AXE_BY_ID, effectText } from '../data/axes.js';
import { GRADES } from '../data/grades.js';
import { CLASSES, CLASS_BY_ID } from '../data/classes.js';
import { TREES } from '../data/trees.js';
import { SAWMILL_LEVELS, RECIPES } from '../data/processing.js';
import { GACHA, STARS } from '../data/balance.js';
import { gradeWeights } from '../game/Gacha.js';
import { canAfford, count, costLabel } from '../game/GameState.js';
import { axeDamage } from '../game/AxeStats.js';
import { itemIcon, axeIcon } from '../art/icons.js';
import { LORE } from '../game/World.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => Math.floor(n).toLocaleString('ko-KR');
const ico = (src, cls = '') => `<img class="ico ${cls}" src="${src}" alt="">`;
const secs = (s) => (s >= 60 ? `${Math.floor(s / 60)}분 ${Math.round(s % 60)}초` : `${s.toFixed(s < 10 ? 1 : 0)}초`);

function costHtml(state, cost) {
  return Object.entries(cost).map(([id, n]) => {
    const ok = count(state, id) >= n;
    return `<span class="cost ${ok ? '' : 'short'}">${ico(itemIcon(id))}${fmt(n)}<small>${esc(costLabel(id))}</small></span>`;
  }).join(' ');
}

function gradeTag(g) { const gr = GRADES[g]; return `<span class="grade" style="--gc:${gr.color}">${gr.ko}</span>`; }

export class UI {
  constructor(root, game) {
    this.root = root;
    this.g = game;
    this.panel = null;
    this.tab = {};
    root.innerHTML = `
      <div id="boot" class="boot"><div class="boot-title">AXENFALL</div><div class="boot-sub">그늘진 계곡의 벌목꾼</div><div class="boot-hint">클릭하거나 아무 키나 눌러 시작</div><div class="boot-note">소리가 함께 재생됩니다 · 헤드폰 권장</div></div>
      <button id="skip" class="skip hidden">건너뛰기 ▶</button>
      <div id="hud" class="hidden">
        <div class="res" id="res"></div>
        <div class="objective" id="objective"></div>
        <div class="topright"><div class="region" id="region"></div>
          <div class="btns"><button data-act="open" data-arg="bag">가방 <kbd>I</kbd></button><button data-act="open" data-arg="codex">도감 <kbd>C</kbd></button><button data-act="open" data-arg="settings">설정 <kbd>Esc</kbd></button></div>
        </div>
        <div class="target hidden" id="target"></div>
        <div class="equip" id="equip"></div>
        <div class="prompt hidden" id="prompt"></div>
        <div class="toasts" id="toasts"></div>
      </div>
      <div id="panelWrap" class="panel-wrap hidden"><div class="panel" id="panel"></div></div>`;
    this.$ = (id) => root.querySelector('#' + id);
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      this.act(b.dataset.act, b.dataset.arg, b.dataset.n);
    });
    root.addEventListener('input', (e) => {
      const el = e.target;
      if (!el.dataset.set) return;
      const s = this.g.state.settings;
      s[el.dataset.set] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? parseFloat(el.value) : isNaN(+el.value) ? el.value : +el.value;
      this.g.applySettings();
    });
    this.$('panelWrap').addEventListener('pointerdown', (e) => { if (e.target.id === 'panelWrap') this.close(); });
    this.$('skip').addEventListener('click', () => this.g.skipCinematic());
    this.lastHud = '';
    this.refreshT = 0;
  }

  showBoot(v) { this.$('boot').classList.toggle('hidden', !v); }
  showSkip(v) { this.$('skip').classList.toggle('hidden', !v); }
  showHud(v) { this.$('hud').classList.toggle('hidden', !v); }

  toast(html, kind = '') {
    const t = document.createElement('div');
    t.className = 'toast ' + kind;
    t.innerHTML = html;
    const box = this.$('toasts');
    box.prepend(t);
    while (box.children.length > 6) box.lastChild.remove();
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
  }

  // ── per-frame HUD ──
  update(dt) {
    // the HUD only needs ~12 refreshes a second
    this.hudT = (this.hudT || 0) - dt;
    if (this.hudT > 0) return;
    dt = 0.08 - this.hudT; this.hudT = 0.08;
    const g = this.g, s = g.state;
    const res = `${ico(itemIcon('gold'))}<b>${fmt(s.gold)}</b>${ico(itemIcon('essence'))}<b>${fmt(s.essence)}</b>${ico(itemIcon('shards'))}<b>${fmt(s.shards)}</b>`;
    if (res !== this.lastRes) { this.$('res').innerHTML = res; this.lastRes = res; }
    const region = `상록 계곡 <span>· ${g.day.cur.phase} ${g.day.label()}</span>`;
    if (region !== this.lastRegion) { this.$('region').innerHTML = region; this.lastRegion = region; }
    const axe = AXE_BY_ID[s.equipped], cls = CLASS_BY_ID[s.classes.active];
    const cd = g.combat.cooldownLeft(g.now);
    const eq = `<div class="eq-axe">${ico(axeIcon(axe.id), 'big')}<div><div class="eq-name" style="color:${GRADES[axe.grade].color}">${esc(axe.ko)} ${'★'.repeat(s.axes[axe.id].stars)}</div><div class="eq-sub">${GRADES[axe.grade].ko} · 공격력 ${axeDamage(axe.id, s.axes[axe.id].stars).toFixed(1)}</div></div></div>
      <div class="eq-cls"><span style="color:${cls.color}">${esc(cls.ko)}</span><button class="skill ${cd > 0 ? 'cd' : ''}" data-act="skill"><kbd>Q</kbd> ${esc(cls.active.ko)}${cd > 0 ? ` <i>${Math.ceil(cd)}</i>` : ''}</button></div>`;
    if (eq !== this.lastEq) { this.$('equip').innerHTML = eq; this.lastEq = eq; }
    const obj = g.objective();
    if (obj !== this.lastObj) { this.$('objective').innerHTML = obj ? `<span>목표</span> ${obj}` : ''; this.$('objective').classList.toggle('hidden', !obj); this.lastObj = obj; }
    // target info
    const tr = g.combat.target;
    const tEl = this.$('target');
    if (tr) {
      const d = TREES[tr.species];
      const st = [];
      if (tr.burn) st.push('<i class="st burn">화상</i>');
      if (tr.frost && tr.frost.until > g.now) st.push('<i class="st frost">빙결</i>');
      if (tr.poison.length) st.push(`<i class="st poison">독 ×${tr.poison.length}</i>`);
      const html = `<b>${esc(d.ko)}</b> <small>${esc(d.en)}</small> <span class="hp">${fmt(tr.hp)} / ${fmt(tr.maxHp)}</span> <span class="def">방어 ${g.trees.def(tr, g.now)}</span> ${st.join('')}`;
      if (html !== this.lastTarget) { tEl.innerHTML = html; this.lastTarget = html; }
      tEl.classList.remove('hidden');
    } else tEl.classList.add('hidden');
    // prompt
    const p = g.promptText();
    const pEl = this.$('prompt');
    if (p !== this.lastPrompt) { pEl.innerHTML = p || ''; pEl.classList.toggle('hidden', !p); this.lastPrompt = p; }
    // live refresh for panels with timers
    this.refreshT -= dt;
    if (this.panel && this.refreshT <= 0) {
      this.refreshT = 0.25;
      if (this.panel === 'sawmill') this.refreshJobs();
    }
  }

  // ── panels ──
  open(name) {
    if (this.panel === name) return;
    this.panel = name;
    this.$('panelWrap').classList.remove('hidden');
    this.g.input.enabled = false;
    this.g.audio.play('open');
    if (name === 'guild') this.g.flags.sawGuild = true;
    this.render();
  }

  close() {
    if (!this.panel) return;
    this.panel = null;
    this.$('panelWrap').classList.add('hidden');
    this.g.input.enabled = true;
    this.g.input.keys.clear();
    this.g.audio.play('close');
    this.g.save();
  }

  render() {
    if (!this.panel) return;
    const el = this.$('panel');
    const keep = el.querySelector('.body')?.scrollTop || 0;
    el.innerHTML = this['p_' + this.panel]();
    el.dataset.panel = this.panel;
    const body = el.querySelector('.body');
    if (body) body.scrollTop = keep;
  }

  head(title, sub, tabs) {
    const cur = this.tab[this.panel] || tabs?.[0]?.[0];
    const tb = tabs ? `<div class="tabs">${tabs.map(([id, label]) => `<button class="${id === cur ? 'on' : ''}" data-act="tab" data-arg="${id}">${label}</button>`).join('')}</div>` : '';
    return `<div class="head"><div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div><button class="x" data-act="close">✕</button></div>${tb}`;
  }

  curTab(def) { return this.tab[this.panel] || def; }

  p_trader() {
    const s = this.g.state, eco = this.g.economy;
    const tab = this.curTab('sell');
    let body = '';
    if (tab === 'sell') {
      const ids = Object.keys(s.inv).sort((a, b) => (ITEMS[a].stage - ITEMS[b].stage) || ITEMS[a].value - ITEMS[b].value);
      const woodTotal = ids.filter((id) => ITEMS[id].kind !== 'mat').reduce((a, id) => a + eco.sellPrice(id) * s.inv[id], 0);
      body = ids.length ? `<div class="row total"><span>목재와 가공품 전부</span><b>${ico(itemIcon('gold'))}${fmt(woodTotal)}</b><button class="primary" data-act="sellAll" ${woodTotal ? '' : 'disabled'}>모두 팔기</button></div>` +
        ids.map((id) => {
          const it = ITEMS[id];
          return `<div class="row">${ico(itemIcon(id), 'big')}<div class="grow"><b>${esc(it.ko)}</b> <small>×${fmt(s.inv[id])}</small>${it.kind === 'mat' ? '<div class="note">가공·클래스 해금 재료</div>' : ''}</div><span class="price">${ico(itemIcon('gold'))}${fmt(eco.sellPrice(id))}</span><button data-act="sell" data-arg="${id}" data-n="1">1개</button><button data-act="sell" data-arg="${id}" data-n="all">전부</button></div>`;
        }).join('') : '<div class="empty">팔 물건이 없습니다. 나무를 베어 목재를 모아 오세요.</div>';
    } else {
      body = AXES.filter((a) => a.price).map((a) => {
        const owned = !!s.axes[a.id];
        return `<div class="row">${ico(axeIcon(a.id), 'big')}<div class="grow"><b style="color:${GRADES[a.grade].color}">${esc(a.ko)}</b> ${gradeTag(a.grade)}<div class="note">${esc(a.desc)}</div><div class="fx">공격력 ${axeDamage(a.id).toFixed(1)}${a.effects.map((e) => ' · ' + esc(effectText(e))).join('')}</div></div>
          ${owned ? '<span class="owned">보유 중</span>' : `<span class="price">${ico(itemIcon('gold'))}${fmt(a.price)}</span><button class="primary" data-act="buyAxe" data-arg="${a.id}" ${s.gold >= a.price ? '' : 'disabled'}>구매</button>`}</div>`;
      }).join('') + '<div class="empty">더 강한 도끼는 도끼 제단에서만 얻을 수 있습니다.</div>';
    }
    return this.head('떠돌이 상인 미르', '"계곡 목재는 결이 고와서 값을 잘 쳐주지."', [['sell', '판매'], ['axes', '도끼 구매']]) + `<div class="body">${body}</div>`;
  }

  p_altar() {
    const s = this.g.state, gs = s.gacha;
    const w = gradeWeights(gs);
    const total = w.reduce((a, b) => a + b, 0);
    const rates = GRADES.map((gr, i) => `<tr><td>${gradeTag(i)}</td><td>${((w[i] / total) * 100).toFixed(w[i] / total < 0.001 ? 2 : 1)}%</td><td>${AXES.filter((a) => a.grade === i).length}종</td></tr>`).join('');
    const res = this.lastPull ? `<div class="pulls">${this.lastPull.map((r, i) => {
      const a = AXE_BY_ID[r.id], gr = GRADES[r.grade];
      return `<div class="card g${Math.min(r.grade, 9)}" style="--gc:${gr.color};--d:${i * 0.12}s">${ico(axeIcon(r.id), 'big')}<b>${esc(a.ko)}</b><small>${gr.ko}</small>${r.dup ? `<em>중복 · 파편 +${r.shards}</em>` : '<em class="new">NEW</em>'}</div>`;
    }).join('')}</div>` : '<div class="altar-art">제단의 룬이 조용히 빛나고 있다.</div>';
    const hist = gs.history.slice(0, 12).map((h) => `<span style="color:${GRADES[h.grade].color}">${esc(AXE_BY_ID[h.id].ko)}</span>`).join(' · ');
    return this.head('도끼 제단', '숲의 정령이 도끼를 내려준다. 확률은 아래 표 그대로 적용된다.') + `<div class="body altar">
      ${res}
      <div class="pull-btns">
        <button class="primary big" data-act="pull" data-arg="1" ${s.gold >= GACHA.single.gold ? '' : 'disabled'}>1회 기도 ${ico(itemIcon('gold'))}${fmt(GACHA.single.gold)}</button>
        <button class="primary big" data-act="pull" data-arg="10" ${s.gold >= GACHA.ten.gold ? '' : 'disabled'}>10회 기도 ${ico(itemIcon('gold'))}${fmt(GACHA.ten.gold)} <small>10% 할인</small></button>
      </div>
      <div class="pity"><div>희귀 이상 보장까지 <b>${GACHA.rarePity - gs.sinceRare}</b>회</div><div>서사 이상 보장까지 <b>${GACHA.epicHard - gs.sinceEpic}</b>회 ${gs.sinceEpic + 1 > GACHA.epicSoftStart ? '<em>확률 상승 중</em>' : `<small>(${GACHA.epicSoftStart}회부터 확률 상승)</small>`}</div><div>누적 기도 <b>${fmt(gs.pulls)}</b>회</div></div>
      <div class="cols"><table class="rates"><tr><th>등급</th><th>현재 확률</th><th>도끼</th></tr>${rates}</table>
      <div class="hist"><h3>최근 획득</h3>${hist || '<span class="empty">아직 없음</span>'}<p class="note">중복 도끼는 등급에 따라 도끼 파편으로 바뀝니다. 파편으로 도끼를 최대 ${STARS.max}성까지 강화할 수 있습니다.</p></div></div>
    </div>`;
  }

  p_guild() {
    const s = this.g.state, eco = this.g.economy;
    const cards = CLASSES.map((c) => {
      const owned = s.classes.owned.includes(c.id), active = s.classes.active === c.id;
      const reqs = eco.classRequirements(c.id).map((r) => `<li class="${r.ok ? 'ok' : ''}">${r.ok ? '✔' : '✖'} ${esc(r.ko)} <small>(${r.stat ? fmt(r.have) + '/' + r.n : r.have + '/' + r.sawmill})</small></li>`).join('');
      const cost = Object.keys(c.cost).length ? costHtml(s, c.cost) : '<span class="cost">기본 클래스</span>';
      return `<div class="cls ${active ? 'active' : ''}" style="--cc:${c.color}"><div class="cls-head"><b>${esc(c.ko)}</b> <small>${esc(c.en)}</small></div>
        <p class="style">${esc(c.style)}</p>
        <ul class="pass">${c.passives.map((p) => `<li>${esc(p)}</li>`).join('')}<li class="act"><kbd>Q</kbd> ${esc(c.active.ko)} — ${esc(c.active.desc)} <small>(재사용 ${c.active.cd}초)</small></li></ul>
        ${owned ? '' : `<div class="req"><div>${cost}</div><ul>${reqs}</ul></div>`}
        <div class="cls-btn">${active ? '<span class="owned">사용 중</span>' : owned ? `<button data-act="setClass" data-arg="${c.id}">이 클래스로 전환</button>` : `<button class="primary" data-act="buyClass" data-arg="${c.id}" ${eco.canBuyClass(c.id) ? '' : 'disabled'}>구매하고 전환</button>`}</div></div>`;
    }).join('');
    return this.head('벌목꾼 길드 게시판', '클래스는 직접 구매합니다. 활성 클래스 하나만 적용되며, 보유한 클래스끼리는 언제든 바꿀 수 있습니다.') + `<div class="body classes">${cards}</div>`;
  }

  p_sawmill() {
    const s = this.g.state, pr = this.g.processing;
    if (pr.level === 0) {
      const L = SAWMILL_LEVELS[1];
      return this.head('물레방아 제재소', '오래전 멈춘 제재소. 물레방아는 아직 쓸 만하다.') + `<div class="body"><div class="repair"><p>${esc(L.desc)}</p><p class="note">수리하면 원목 2개를 판재 1개로 켭니다. 판재는 원목 두 개보다 비싸게 팔립니다. 가공은 시간이 걸리지만, 그동안 벌목을 계속할 수 있고 게임을 꺼 둔 동안에도 최대 8시간까지 진행됩니다.</p>
        <div class="row total"><span>수리 비용</span><div>${costHtml(s, L.cost)}</div><button class="primary big" data-act="upgradeMill" ${canAfford(s, L.cost) ? '' : 'disabled'}>제재소 수리</button></div></div></div>`;
    }
    const L = pr.info;
    const slots = pr.slots();
    let jobs = '';
    for (let i = 0; i < slots; i++) {
      const j = s.sawmill.jobs.find((q) => q.slot === i);
      jobs += j ? `<div class="slot busy" data-slot="${i}">${ico(itemIcon(j.out), 'big')}<div class="grow"><b>${esc(ITEMS[j.out].ko)}</b> <small class="jn">${j.done}/${j.total}</small><div class="bar"><i style="width:0%"></i></div><small class="jl"></small></div><button data-act="cancel" data-arg="${i}">취소</button></div>`
        : `<div class="slot free">빈 슬롯 ${i + 1}</div>`;
    }
    const free = pr.freeSlot() >= 0;
    const opts = pr.options().map((o) => {
      const max = pr.maxBatch(o);
      const ins = Object.entries(o.inputs).map(([id, n]) => `${ico(itemIcon(id))}${n}<small>(${fmt(count(s, id))})</small>`).join(' + ');
      const prof = pr.profit(o);
      return { o, max, html: `<div class="row recipe ${max ? '' : 'dim'}"><div class="grow"><div class="flow">${ins} → ${ico(itemIcon(o.out), 'big')}<b>${esc(ITEMS[o.out].ko)}</b></div><small>${esc(o.recipe.ko)} · 개당 ${secs(pr.jobTime(o))} · 판매가 ${fmt(this.g.economy.sellPrice(o.out))} · 순이익 <span class="${prof > 0 ? 'up' : 'down'}">${prof > 0 ? '+' : ''}${fmt(prof)}</span></small></div>
        ${[1, 5].map((n) => `<button data-act="job" data-arg="${o.key}" data-n="${n}" ${free && max >= n ? '' : 'disabled'}>${n}개</button>`).join('')}<button class="primary" data-act="job" data-arg="${o.key}" data-n="max" ${free && max >= 1 ? '' : 'disabled'}>최대 ${max || ''}</button></div>` };
    });
    opts.sort((a, b) => (b.max > 0) - (a.max > 0));
    const nextCost = pr.upgradeCost();
    const next = SAWMILL_LEVELS[pr.level + 1];
    const unlocks = next ? RECIPES.filter((r) => r.level === next.level).map((r) => r.ko).join(', ') : '';
    const up = next ? `<div class="upgrade"><h3>다음 단계: ${next.level}단계 ${esc(next.ko)}</h3><p>${esc(next.desc)}</p><p class="note">슬롯 ${L.slots} → ${next.slots} · 속도 ×${L.speed} → ×${next.speed} · 추가 생산 확률 ${Math.round((L.quality - 1) * 100)}% → ${Math.round((next.quality - 1) * 100)}%${unlocks ? ` · 새 공정: ${esc(unlocks)}` : ''}</p>
      <div class="row total"><div class="grow">${costHtml(s, nextCost)}</div><button class="primary" data-act="upgradeMill" ${canAfford(s, nextCost) ? '' : 'disabled'}>업그레이드</button></div></div>`
      : '<div class="upgrade"><h3>최고 단계</h3><p class="note">6단계 이후의 제재소는 다음 지역과 함께 열립니다.</p></div>';
    return this.head(`물레방아 제재소 · ${pr.level}단계 ${esc(L.ko)}`, `생산 슬롯 ${slots}개 · 가공 속도 ×${pr.speed().toFixed(2)}`) + `<div class="body"><div class="slots">${jobs}</div><h3>공정</h3>${opts.map((x) => x.html).join('')}${up}</div>`;
  }

  refreshJobs() {
    const pr = this.g.processing;
    const el = this.$('panel');
    let changed = false;
    for (const j of this.g.state.sawmill.jobs) {
      const row = el.querySelector(`.slot[data-slot="${j.slot}"]`);
      if (!row) { changed = true; continue; }
      const p = pr.jobProgress(j);
      row.querySelector('.bar i').style.width = `${(p.cur * 100).toFixed(1)}%`;
      row.querySelector('.jn').textContent = `${p.done}/${p.total}`;
      row.querySelector('.jl').textContent = `남은 시간 ${secs(p.left)}`;
    }
    if (changed || el.querySelectorAll('.slot.busy').length !== this.g.state.sawmill.jobs.length) this.render();
  }

  p_bag() {
    const s = this.g.state, eco = this.g.economy;
    const tab = this.curTab('axes');
    let body;
    if (tab === 'axes') {
      const owned = AXES.filter((a) => s.axes[a.id]).sort((a, b) => b.grade - a.grade);
      body = owned.map((a) => {
        const o = s.axes[a.id];
        const c = eco.starCost(a.id);
        const eq = s.equipped === a.id;
        return `<div class="row axe ${eq ? 'eq' : ''}">${ico(axeIcon(a.id), 'big')}<div class="grow"><b style="color:${GRADES[a.grade].color}">${esc(a.ko)}</b> ${gradeTag(a.grade)} <span class="stars">${'★'.repeat(o.stars)}${'☆'.repeat(STARS.max - o.stars)}</span>
          <div class="fx">공격력 ${axeDamage(a.id, o.stars).toFixed(1)}${a.effects.map((e) => ' · ' + esc(effectText(e))).join('') || ' · 특수 능력 없음'}</div><div class="note">${esc(a.desc)}</div></div>
          ${c ? `<button data-act="star" data-arg="${a.id}" ${canAfford(s, c) ? '' : 'disabled'}>강화 ${ico(itemIcon('shards'))}${c.shards}</button>` : '<span class="owned">최대</span>'}
          ${eq ? '<span class="owned">장착 중</span>' : `<button class="primary" data-act="equip" data-arg="${a.id}">장착</button>`}</div>`;
      }).join('');
    } else {
      const ids = Object.keys(s.inv);
      body = ids.length ? ids.map((id) => `<div class="row">${ico(itemIcon(id), 'big')}<div class="grow"><b>${esc(ITEMS[id].ko)}</b> <small>×${fmt(s.inv[id])}</small>${ITEMS[id].desc ? `<div class="note">${esc(ITEMS[id].desc)}</div>` : ''}</div><span class="price">개당 ${ico(itemIcon('gold'))}${fmt(eco.sellPrice(id))}</span></div>`).join('') : '<div class="empty">가방이 비어 있습니다.</div>';
    }
    return this.head('가방', `도끼 ${Object.keys(s.axes).length}개 보유`, [['axes', '도끼'], ['items', '재료']]) + `<div class="body">${body}</div>`;
  }

  p_codex() {
    const s = this.g.state;
    const tab = this.curTab('axes');
    let body;
    const found = AXES.filter((a) => s.codex.axes[a.id]).length;
    if (tab === 'axes') {
      body = GRADES.map((gr, gi) => `<div class="codex-grade"><h3>${gradeTag(gi)} <small>${gr.en}</small></h3><div class="grid">${AXES.filter((a) => a.grade === gi).map((a) => {
        const k = s.codex.axes[a.id];
        return `<div class="cell ${k ? '' : 'unk'}" title="${k ? esc(a.desc) : '미발견'}">${ico(axeIcon(a.id, !k), 'big')}<small>${k ? esc(a.ko) : '???'}</small></div>`;
      }).join('')}</div></div>`).join('');
    } else if (tab === 'trees') {
      body = Object.entries(TREES).map(([id, t]) => {
        const k = s.codex.trees[id];
        return `<div class="row"><div class="grow"><b>${k ? esc(t.ko) : '???'}</b> <small>${k ? esc(t.en) : ''}</small><div class="note">${k ? esc(t.lore) : '아직 쓰러뜨린 적 없는 나무.'}</div>${k ? `<div class="fx">HP ${t.hp} · 방어 ${t.def} · 목재 ${t.logs} · 재생 ${t.respawn}초 · 쓰러뜨림 ${fmt(s.stats.felled[id] || 0)}회</div>` : ''}</div></div>`;
      }).join('');
    } else {
      const lines = [];
      for (const [k, arr] of Object.entries(LORE)) if (s.codex.lore[k]) lines.push(...arr.map((l) => `<p>${esc(l)}</p>`));
      body = `<div class="lore">${lines.join('') || '<div class="empty">계곡 곳곳을 살펴보면 기록이 모입니다.</div>'}</div>
        <div class="stats"><h3>기록</h3><p>총 타격 ${fmt(s.stats.hits)} · 크리티컬 ${fmt(s.stats.crits)} · 빗나감 ${fmt(s.stats.misses)} · 최고 콤보 ${s.stats.bestCombo}</p><p>번 골드 ${fmt(s.stats.goldEarned)} · 플레이 시간 ${secs(s.stats.playTime)}</p></div>`;
    }
    return this.head('도감', `도끼 ${found} / ${AXES.length}`, [['axes', '도끼'], ['trees', '나무'], ['lore', '세계 기록']]) + `<div class="body">${body}</div>`;
  }

  p_settings() {
    const s = this.g.state.settings;
    const range = (k, label, min = 0, max = 1, step = 0.05) => `<label class="set"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${s[k]}" data-set="${k}"></label>`;
    const select = (k, label, opts) => `<label class="set"><span>${label}</span><select data-set="${k}">${opts.map(([v, l]) => `<option value="${v}" ${String(s[k]) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
    return this.head('설정', `FPS ${Math.round(this.g.engine.fps)} · 화면 배율 ×${this.g.engine.scale}`) + `<div class="body settings">
      <h3>소리</h3>${range('master', '마스터')}${range('music', '음악')}${range('sfx', '효과음')}${range('ambience', '환경음')}
      <h3>화면</h3>${range('shake', '화면 흔들림', 0, 1.5)}${range('particles', '파티클 양', 0.2, 1.5)}
      ${select('effects', '그래픽 품질', [['high', '높음 (빛줄기 분할, 안개, 먼지)'], ['medium', '보통'], ['low', '낮음 (핵심 광원만)']])}
      ${select('timeFlow', '시간 흐름', [[1, '보통 (하루 24분)'], [0.5, '느리게'], [0, '멈춤']])}
      <label class="set"><span>번쩍임 줄이기</span><input type="checkbox" data-set="reduceFlash" ${s.reduceFlash ? 'checked' : ''}></label>
      ${range('uiScale', 'UI 크기', 0.8, 1.4, 0.05)}
      <h3>조작</h3><p class="note">A/D·방향키 이동 · Shift 달리기 · Space 점프 · 클릭 또는 J 공격 · Q 클래스 기술 · E 상호작용 · I 가방 · C 도감 · Esc 닫기/설정</p>
      <h3>저장</h3><div class="row"><button data-act="saveNow">지금 저장</button><span class="note grow">진행 상황은 20초마다, 그리고 창을 닫을 때 자동 저장됩니다.</span><button class="danger" data-act="wipe">${this.wipeArmed ? '한 번 더 누르면 모두 지웁니다' : '데이터 초기화'}</button></div>
    </div>`;
  }

  // ── actions ──
  act(a, arg, n) {
    const g = this.g, s = g.state;
    const ok = (v, failMsg) => { g.audio.play(v ? 'click' : 'error'); if (!v && failMsg) this.toast(failMsg, 'bad'); return v; };
    switch (a) {
      case 'close': this.close(); return;
      case 'open': if (this.panel) this.close(); this.open(arg); return;
      case 'tab': this.tab[this.panel] = arg; g.audio.play('click'); break;
      case 'skill': g.useSkill(); return;
      case 'sell': {
        const gold = g.economy.sell(arg, n === 'all' ? s.inv[arg] : 1);
        if (gold) g.audio.play('coin');
        break;
      }
      case 'sellAll': { const gold = g.economy.sellAllWood(); if (gold) { g.audio.play('coin'); this.toast(`${ico(itemIcon('gold'))} +${fmt(gold)} 골드`, 'gold'); } break; }
      case 'buyAxe': if (ok(g.economy.buyAxe(arg), '골드가 부족합니다')) { g.audio.play('buy'); this.toast(`새 도끼: <b>${esc(AXE_BY_ID[arg].ko)}</b> — 가방에서 장착하세요`); } break;
      case 'pull': {
        const r = g.gacha.pull(+arg);
        if (!ok(!!r, '골드가 부족합니다')) break;
        this.lastPull = r;
        const best = Math.max(...r.map((x) => x.grade));
        g.audio.play('gacha', { grade: best });
        if (best >= 5) { g.player.surpriseT = 1; g.player.cheerT = 1.2; }
        break;
      }
      case 'buyClass': if (ok(g.economy.buyClass(arg))) { g.combat.refreshMods(); g.audio.play('levelup'); g.player.cheerT = 1.4; this.toast(`클래스 <b>${esc(CLASS_BY_ID[arg].ko)}</b> 획득!`, 'big'); } break;
      case 'setClass': if (ok(g.economy.setClass(arg))) g.combat.refreshMods(); break;
      case 'upgradeMill': if (ok(g.processing.upgrade(), '비용이 부족합니다')) { g.audio.play('levelup'); this.toast(`제재소 <b>${g.processing.level}단계 ${esc(g.processing.info.ko)}</b>`, 'big'); } break;
      case 'job': {
        const o = g.processing.option(arg);
        const k = n === 'max' ? g.processing.maxBatch(o) : +n;
        if (ok(g.processing.start(arg, k), '재료나 빈 슬롯이 없습니다')) g.audio.play('mill');
        break;
      }
      case 'cancel': ok(g.processing.cancel(+arg)); break;
      case 'equip': if (ok(g.economy.equip(arg))) g.combat.refreshMods(); break;
      case 'star': if (ok(g.economy.upgradeAxe(arg), '도끼 파편이 부족합니다')) { g.combat.refreshMods(); g.audio.play('buy'); } break;
      case 'saveNow': this.toast(g.save() ? '저장했습니다' : '저장하지 못했습니다 (브라우저 저장소를 쓸 수 없음)', g.lastSaveOk ? '' : 'bad'); break;
      case 'wipe':
        // two-step confirmation inside the page (browser dialogs are not always available)
        if (this.wipeArmed) { g.wipe(); return; }
        this.wipeArmed = true;
        setTimeout(() => { this.wipeArmed = false; if (this.panel === 'settings') this.render(); }, 4000);
        break;
      default: break;
    }
    this.render();
  }
}
