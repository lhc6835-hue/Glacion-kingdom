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
import { GachaFX } from './GachaFX.js';

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

// Small line icons for the HUD and panel headers (inline SVG, drawn in currentColor).
const SVG = {
  bag: '<path d="M8 8V6a4 4 0 0 1 8 0v2"/><path d="M4.5 8h15l-1.3 12.2a1 1 0 0 1-1 .8H6.8a1 1 0 0 1-1-.8z"/><path d="M9 12h6"/>',
  book: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/><path d="M7 8h2M15 8h2"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
  moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19l8-8"/>',
  shield: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/>',
  tent: '<path d="M3 20L12 4l9 16z"/><path d="M12 4v16M9 20l3-6 3 6"/>',
  altar: '<path d="M4 20h16M6 20V9M18 20V9M3 9h18M8 5h8l1 4H7z"/><path d="M12 12l1.5 2.5L12 17l-1.5-2.5z"/>',
  guild: '<path d="M4 4h16v12H4z"/><path d="M7 8h4M7 11h6M14 8h3v3h-3zM8 16v4M16 16v4"/>',
  mill: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16M6.3 6.3l11.4 11.4M17.7 6.3L6.3 17.7"/><circle cx="12" cy="12" r="2"/>',
};
const icon = (k, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SVG[k]}</svg>`;
const PANEL_META = {
  trader: ['tent', 'Wandering Merchant'], altar: ['altar', 'Altar of Axes'], guild: ['guild', "Woodcutters' Guild"],
  sawmill: ['mill', 'Waterwheel Mill'], bag: ['bag', 'Satchel'], codex: ['book', 'Field Codex'], settings: ['gear', 'Settings'],
};

function gradeTag(g) { const gr = GRADES[g]; return `<span class="grade" style="--gc:${gr.color}">${gr.ko}</span>`; }

export class UI {
  constructor(root, game) {
    this.root = root;
    this.g = game;
    this.panel = null;
    this.tab = {};
    root.innerHTML = `
      <div id="boot" class="boot">
        <div class="embers">${Array.from({ length: 22 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${(i * 0.53) % 6}s;--s:${6 + (i % 5) * 1.6}s;--c:${i % 3 ? '#ffd88a' : '#9ff0d0'}"></i>`).join('')}</div>
        <div class="boot-inner">
          <div class="boot-kicker"><span></span>The Timber Chronicle<span></span></div>
          <svg class="boot-emblem" viewBox="0 0 120 64" aria-hidden="true">
            <defs><linearGradient id="emb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4c8"/><stop offset=".55" stop-color="#e6b456"/><stop offset="1" stop-color="#9a6424"/></linearGradient></defs>
            <g fill="url(#emb)" stroke="#2a1a0a" stroke-width="1.4" stroke-linejoin="round">
              <path d="M30 58 L84 10 L88 14 L34 62 Z"/><path d="M90 58 L36 10 L32 14 L86 62 Z"/>
              <path d="M78 4 C92 2 100 12 98 24 C92 18 86 16 80 18 Z"/><path d="M42 4 C28 2 20 12 22 24 C28 18 34 16 40 18 Z"/>
            </g>
            <path d="M60 26 C52 34 52 44 60 52 C68 44 68 34 60 26 Z" fill="#8ad06a" stroke="#1e3a24" stroke-width="1.4"/>
            <path d="M60 30 V50" stroke="#2f6a3a" stroke-width="1.2"/>
          </svg>
          <h1 class="boot-title" data-text="AXENFALL" aria-label="Axenfall">${[...'AXENFALL'].map((ch, i) => `<span style="--i:${i}">${ch}</span>`).join('')}</h1>
          <div class="boot-rule"><i></i></div>
          <div class="boot-sub">그늘진 계곡의 벌목꾼</div>
          <div class="boot-hint">화면을 누르거나 아무 키나 눌러 시작</div>
          <div class="boot-note">소리가 함께 재생돼요 · v0.1</div>
        </div>
      </div>
      <div class="deck" aria-hidden="true"></div>
      <div id="hud" class="hidden">
        <div class="res" id="res"></div>
        <div class="objective" id="objective"></div>
        <div class="topright"><div class="region" id="region"></div>
          <div class="btns">
            <button class="ibtn" data-act="open" data-arg="bag" aria-label="가방">${icon('bag')}<span>가방</span><kbd>I</kbd></button>
            <button class="ibtn" data-act="open" data-arg="codex" aria-label="도감">${icon('book')}<span>도감</span><kbd>C</kbd></button>
            <button class="ibtn" data-act="open" data-arg="settings" aria-label="설정">${icon('gear')}<span>설정</span><kbd>Esc</kbd></button>
          </div>
        </div>
        <div class="target hidden" id="target"></div>
        <div class="equip" id="equip"></div>
        <div class="prompt hidden" id="prompt"></div>
        <div class="toasts" id="toasts"></div>
      </div>
      <div id="touch" class="touch hidden">
        <div class="pad-l"><button class="tb dir" data-key="a" aria-label="왼쪽">◀</button><button class="tb dir" data-key="d" aria-label="오른쪽">▶</button></div>
        <div class="pad-r">
          <button class="tb small" data-key="q" aria-label="클래스 기술">기술</button>
          <button class="tb small" data-key="e" aria-label="상호작용">E</button>
          <button class="tb jump" data-key=" " aria-label="점프">점프</button>
          <button class="tb chop" data-chop aria-label="도끼질">도끼</button>
        </div>
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
    this.lastHud = '';
    this.refreshT = 0;
    this.setupTouch();
    this.fx = new GachaFX(root, this);
  }

  // On-screen controls for phones and tablets. They appear on coarse pointers or on first touch.
  setupTouch() {
    const t = this.$('touch'), inp = this.g.input;
    const show = () => { document.body.classList.add('touch-mode'); inp.touchRun = true; if (this.g.mode === 'play') t.classList.remove('hidden'); };
    if (matchMedia('(pointer: coarse)').matches) show();
    addEventListener('touchstart', show, { once: true, passive: true });
    for (const b of t.querySelectorAll('[data-key]')) {
      const k = b.dataset.key;
      const up = (e) => { e.preventDefault(); inp.virtual(k, false); b.classList.remove('on'); };
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture?.(e.pointerId); inp.virtual(k, true); b.classList.add('on'); });
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    }
    const chop = t.querySelector('[data-chop]');
    chop.addEventListener('pointerdown', (e) => { e.preventDefault(); inp.clicks++; chop.classList.add('on'); setTimeout(() => chop.classList.remove('on'), 90); });
  }

  showTouch(v) { this.$('touch').classList.toggle('hidden', !v || !document.body.classList.contains('touch-mode')); }

  showBoot(v) { this.$('boot').classList.toggle('hidden', !v); }
  // title letters lift away and the veil fades, then play begins
  hideBoot(done) {
    const b = this.$('boot');
    b.classList.add('out');
    setTimeout(done, 380);
    setTimeout(() => b.classList.add('hidden'), 950);
  }
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
    const res = `<span class="cur gold" title="골드">${ico(itemIcon('gold'))}<b>${fmt(s.gold)}</b></span><span class="cur ess" title="정수">${ico(itemIcon('essence'))}<b>${fmt(s.essence)}</b></span><span class="cur shard" title="도끼 파편">${ico(itemIcon('shards'))}<b>${fmt(s.shards)}</b></span>`;
    if (res !== this.lastRes) { this.$('res').innerHTML = res; this.lastRes = res; }
    const region = `${icon(g.day.isDay ? 'sun' : 'moon', g.day.isDay ? 'sun' : 'moon')}<div><b>상록 계곡</b><span>${g.day.cur.phase} · ${g.day.label()}</span></div>`;
    if (region !== this.lastRegion) { this.$('region').innerHTML = region; this.lastRegion = region; }
    const axe = AXE_BY_ID[s.equipped], cls = CLASS_BY_ID[s.classes.active];
    const cd = g.combat.cooldownLeft(g.now);
    const gc = GRADES[axe.grade].color, cdK = cd > 0 ? cd / cls.active.cd : 0;
    const eq = `<div class="eq-slot" style="--gc:${gc}">${ico(axeIcon(axe.id))}</div>
      <div class="eq-info"><div class="eq-name" style="color:${gc}">${esc(axe.ko)}${s.axes[axe.id].stars ? ` <i class="stars">${'★'.repeat(s.axes[axe.id].stars)}</i>` : ''}</div>
        <div class="eq-sub"><span class="grade" style="--gc:${gc}">${GRADES[axe.grade].ko}</span> 공격력 ${axeDamage(axe.id, s.axes[axe.id].stars).toFixed(1)}</div>
        <div class="eq-cls" style="--cc:${cls.color}">${esc(cls.ko)}</div></div>
      <button class="skill ${cd > 0 ? 'cd' : 'ready'}" data-act="skill" style="--cd:${cdK.toFixed(3)};--cc:${cls.color}" title="${esc(cls.active.ko)} — ${esc(cls.active.desc)}"><span>${cd > 0 ? Math.ceil(cd) : 'Q'}</span><small>${esc(cls.active.ko)}</small></button>`;
    if (eq !== this.lastEq) { this.$('equip').innerHTML = eq; this.lastEq = eq; }
    const obj = g.objective();
    if (obj !== this.lastObj) { this.$('objective').innerHTML = obj ? `<span class="obj-tag">${icon('leaf')}목표</span><span class="obj-text">${obj}</span>` : ''; this.$('objective').classList.toggle('hidden', !obj); this.lastObj = obj; }
    // target info
    const tr = g.combat.target;
    const tEl = this.$('target');
    if (tr) {
      const d = TREES[tr.species];
      const st = [];
      if (tr.burn) st.push('<i class="st burn">화상</i>');
      if (tr.frost && tr.frost.until > g.now) st.push('<i class="st frost">빙결</i>');
      if (tr.poison.length) st.push(`<i class="st poison">독 ×${tr.poison.length}</i>`);
      const k = tr.hp / tr.maxHp;
      const html = `<div class="t-row"><b>${esc(d.ko)}</b><small>${esc(d.en)}</small><span class="def">${icon('shield')}${g.trees.def(tr, g.now)}</span>${st.join('')}</div>
        <div class="t-hp"><i style="width:${(k * 100).toFixed(1)}%"></i><span>${fmt(tr.hp)} / ${fmt(tr.maxHp)}</span></div>`;
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
    this.showTouch(false);
    this.g.input.enabled = false;
    this.g.audio.play('open');
    if (name === 'guild') this.g.flags.sawGuild = true;
    this.render();
  }

  close() {
    if (!this.panel) return;
    this.panel = null;
    this.$('panelWrap').classList.add('hidden');
    this.showTouch(true);
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
    const [ic, en] = PANEL_META[this.panel] || ['leaf', ''];
    return `<div class="head"><div class="head-emblem">${icon(ic)}</div><div class="head-text"><small>${en}</small><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div><button class="x" data-act="close" aria-label="닫기">✕</button></div>${tb}`;
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
    const tab = this.tab.altarSub || 'rates';
    // the showcase axe: the highest grade you own, or a sealed silhouette of a Legendary
    const ownedBest = AXES.filter((a) => s.axes[a.id]).sort((a, b) => b.grade - a.grade)[0];
    const show = ownedBest && ownedBest.grade >= 3 ? ownedBest : AXES.find((a) => a.grade === 9);
    const sealed = !s.axes[show.id];
    const rareLeft = GACHA.rarePity - gs.sinceRare, epicLeft = GACHA.epicHard - gs.sinceEpic;
    const soft = gs.sinceEpic + 1 > GACHA.epicSoftStart;
    const pct = (v) => { const p = (v / total) * 100; return p >= 1 ? p.toFixed(1) : p >= 0.1 ? p.toFixed(2) : p.toFixed(3); };
    let tabBody;
    if (tab === 'rates') {
      const max = Math.log10(Math.max(...w) + 1);
      tabBody = `<div class="rate-list">${GRADES.map((gr, i) => `<div class="rate" style="--gc:${gr.color}"><span class="grade" style="--gc:${gr.color}">${gr.ko}</span><div class="rate-bar"><i style="width:${Math.max(2, (Math.log10(w[i] + 1) / max) * 100).toFixed(1)}%"></i></div><b>${pct(w[i])}%</b><small>${AXES.filter((a) => a.grade === i).length}종</small></div>`).join('')}</div>
        <p class="note">막대는 로그 비율이에요. 표시된 확률은 지금 보장 상태가 반영된 실제 값입니다.</p>`;
    } else if (tab === 'history') {
      tabBody = gs.history.length ? `<div class="hist-grid">${gs.history.slice(0, 30).map((h) => `<div class="hcell" style="--gc:${GRADES[h.grade].color}" title="${esc(AXE_BY_ID[h.id].ko)}">${ico(axeIcon(h.id))}<small>${esc(AXE_BY_ID[h.id].ko)}</small></div>`).join('')}</div>` : '<div class="empty">아직 기도한 적이 없어요.</div>';
    } else {
      tabBody = GRADES.map((gr, gi) => `<div class="pool-row"><span class="grade" style="--gc:${gr.color}">${gr.ko}</span>${AXES.filter((a) => a.grade === gi).map((a) => `<span class="pool-axe ${s.axes[a.id] ? 'have' : ''}" title="${s.codex.axes[a.id] ? esc(a.ko) : '???'}">${ico(axeIcon(a.id, !s.codex.axes[a.id]))}</span>`).join('')}</div>`).join('');
    }
    return this.head('도끼 제단', '숲의 정령이 도끼를 내려 줘요. 확률은 아래 그대로 적용돼요.') + `<div class="body altar2">
      <div class="shrine">
        <div class="shrine-stage" style="--gc:${GRADES[show.grade].color}">
          <i class="rune r1"></i><i class="rune r2"></i><i class="rune r3"></i>
          <div class="shrine-beam"></div>
          <img class="shrine-axe ${sealed ? 'sealed' : ''}" src="${axeIcon(show.id, sealed)}" alt="">
          <div class="shrine-cap">${sealed ? `<small>제단 깊은 곳에 잠든</small><b>${GRADES[show.grade].ko} 등급의 도끼</b>` : `<small>내 최고 등급</small><b style="color:${GRADES[show.grade].color}">${esc(show.ko)}</b>`}</div>
        </div>
        <div class="shrine-side">
          <div class="pity-box">
            <div class="pity-row"><span>희귀 이상 확정까지</span><b>${rareLeft}회</b></div>
            <div class="pity-bar rare"><i style="width:${(gs.sinceRare / GACHA.rarePity) * 100}%"></i></div>
            <div class="pity-row"><span>서사 이상 확정까지</span><b>${epicLeft}회</b>${soft ? '<em>확률 상승 중</em>' : ''}</div>
            <div class="pity-bar epic"><i style="width:${(gs.sinceEpic / GACHA.epicHard) * 100}%"></i><u style="left:${(GACHA.epicSoftStart / GACHA.epicHard) * 100}%"></u></div>
            <p class="note">${GACHA.epicSoftStart}회부터 서사 이상 확률이 오르고, ${GACHA.epicHard}회째에 반드시 나와요 · 누적 ${fmt(gs.pulls)}회</p>
          </div>
          <div class="pull2">
            <button class="pull-one" data-act="pull" data-arg="1" ${s.gold >= GACHA.single.gold ? '' : 'disabled'}><span>1회 기도</span><b>${ico(itemIcon('gold'))}${fmt(GACHA.single.gold)}</b></button>
            <button class="pull-ten" data-act="pull" data-arg="10" ${s.gold >= GACHA.ten.gold ? '' : 'disabled'}><i class="ribbon">10% 할인</i><span>10회 기도</span><b>${ico(itemIcon('gold'))}${fmt(GACHA.ten.gold)}</b><small>희귀 이상 1개 이상 확정</small></button>
          </div>
          <p class="note">가진 골드 ${ico(itemIcon('gold'))}${fmt(s.gold)} · 중복 도끼는 도끼 파편이 되어 최대 ${STARS.max}성까지 강화할 수 있어요.</p>
        </div>
      </div>
      <div class="tabs sub">${[['rates', '등급별 확률'], ['history', '최근 획득'], ['pool', '등급별 도끼']].map(([id, l]) => `<button class="${id === tab ? 'on' : ''}" data-act="altarTab" data-arg="${id}">${l}</button>`).join('')}</div>
      <div class="altar-tab">${tabBody}</div>
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
      case 'altarTab': this.tab.altarSub = arg; g.audio.play('click'); break;
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
        if (best >= 5) { g.player.surpriseT = 1; g.player.cheerT = 1.2; }
        this.render();
        this.fx.play(r, +arg);
        return;
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
