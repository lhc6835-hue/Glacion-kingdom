import { PLACES, HALF } from '../world/Layout.js';
import { xpFor } from '../core/GameState.js';
import { LORE } from '../data/quests.js';
import { itemName } from '../core/Quests.js';

// DOM interface. Fantasy dressing (parchment, gilt edges) over a clean information layout.
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const STARS = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

export class UI {
  constructor(root) {
    this.root = root;
    this.panel = null;
    this.onClose = null;
    root.innerHTML = `
      <div id="loading" class="screen"><div class="load-box">
        <div class="logo">글래시온 왕국</div><div class="sub">Kingdom of Glacion</div>
        <div class="bar"><i></i></div><div class="load-msg">세계를 그리는 중…</div></div></div>
      <div id="title" class="screen hidden"><div class="title-box">
        <div class="logo big">글래시온 왕국</div>
        <div class="sub">깃털족의 노래 · Kingdom of Glacion</div>
        <div class="menu">
          <button data-act="new">새로운 모험</button>
          <button data-act="continue">이어하기</button>
          <button data-act="help">조작법</button>
        </div>
        <div class="foot">빙하의 노래가 흐르는 땅, 그 첫 페이지</div></div></div>
      <div id="hud" class="hidden">
        <div class="hud-tl"><div class="place-name"></div><div class="clock"></div></div>
        <div class="hud-tr"><div class="coins"></div><div class="level"><span></span><div class="xpbar"><i></i></div></div></div>
        <div class="compass"><div class="strip"></div><div class="needle">북</div></div>
        <div class="tracker hidden"></div>
        <div class="stamina hidden"><i></i></div>
        <div class="prompt hidden"></div>
        <div class="hint">WASD 이동 · Shift 달리기 · Space 점프/활공 · E 상호작용 · Q 의뢰 · M 지도 · 휠 확대/축소</div>
      </div>
      <div id="toasts"></div>
      <div id="banner" class="hidden"><div class="b1"></div><div class="b2"></div></div>
      <div id="dialog" class="hidden"><div class="dname"></div><div class="dtext"></div><div class="dchoices"></div><div class="dnext">E / 클릭 ▸</div></div>
      <div id="panel" class="hidden"></div>`;
    this.$ = (s) => root.querySelector(s);
    this.toastsEl = this.$('#toasts');
    this.$('#dialog').addEventListener('click', (e) => { if (!e.target.closest('button')) this.dialogNext?.(); });
  }

  // --- loading & title -------------------------------------------------------------
  progress(p, msg) {
    this.$('#loading .bar i').style.width = `${Math.round(p * 100)}%`;
    if (msg) this.$('#loading .load-msg').textContent = msg;
  }
  hideLoading() { this.$('#loading').classList.add('fade'); setTimeout(() => this.$('#loading').classList.add('hidden'), 900); }
  showTitle(hasSave, onAct) {
    const t = this.$('#title');
    t.classList.remove('hidden');
    t.querySelector('[data-act=continue]').disabled = !hasSave;
    t.onclick = (e) => { const b = e.target.closest('button'); if (b && !b.disabled) onAct(b.dataset.act); };
  }
  hideTitle() { this.$('#title').classList.add('fade'); setTimeout(() => this.$('#title').classList.add('hidden'), 800); this.$('#hud').classList.remove('hidden'); }

  // --- HUD ---------------------------------------------------------------------------
  hud({ place, clock, state, player, tracked, compass }) {
    this.$('.place-name').textContent = place || '';
    this.$('.clock').textContent = clock;
    this.$('.coins').textContent = `${state.player.coins} 깃전`;
    this.$('.level span').textContent = `Lv.${state.player.level}`;
    this.$('.xpbar i').style.width = `${Math.min(100, (state.player.xp / xpFor(state.player.level)) * 100)}%`;
    const st = this.$('.stamina');
    st.classList.toggle('hidden', player.stamina > 0.995 && !player.gliding);
    st.querySelector('i').style.width = `${player.stamina * 100}%`;
    const tr = this.$('.tracker');
    if (tracked) { tr.classList.remove('hidden'); tr.innerHTML = `<b>${esc(tracked.title)}</b><span>${esc(tracked.label)}</span>${tracked.dist ? `<em>${tracked.dist}</em>` : ''}`; }
    else tr.classList.add('hidden');
    // Compass: bearings from straight ahead (north). The camera never turns, so this is fixed.
    const strip = this.$('.compass .strip');
    strip.innerHTML = compass.map((m) => `<div class="mk ${m.cls}" style="left:${50 + m.bearing / 1.8}%" title="${esc(m.name)}">${m.icon}<span>${esc(m.name)}</span></div>`).join('');
  }

  prompt(text) {
    const p = this.$('.prompt');
    if (!text) { p.classList.add('hidden'); return; }
    p.classList.remove('hidden');
    p.innerHTML = `<kbd>E</kbd> ${esc(text)}`;
  }

  toast(text, kind = 'info') {
    const t = el('div', `toast ${kind}`, esc(text));
    this.toastsEl.appendChild(t);
    setTimeout(() => t.classList.add('out'), 3600);
    setTimeout(() => t.remove(), 4300);
  }

  banner(title, sub) {
    const b = this.$('#banner');
    b.querySelector('.b1').textContent = title;
    b.querySelector('.b2').textContent = sub || '';
    b.classList.remove('hidden', 'out');
    clearTimeout(this._bt);
    this._bt = setTimeout(() => b.classList.add('out'), 3200);
  }

  // --- dialog ------------------------------------------------------------------------
  get busy() { return !this.$('#dialog').classList.contains('hidden') || !this.$('#panel').classList.contains('hidden'); }

  dialog(name, pages, choices = null, onDone = null) {
    const d = this.$('#dialog');
    let i = 0;
    const show = () => {
      d.querySelector('.dname').textContent = name;
      d.querySelector('.dtext').textContent = pages[i];
      const last = i === pages.length - 1;
      const ch = d.querySelector('.dchoices');
      ch.innerHTML = '';
      if (last && choices) {
        for (const c of choices) {
          const b = el('button', '', esc(c.label));
          b.onclick = () => { this.closeDialog(); c.fn?.(); };
          ch.appendChild(b);
        }
      }
      d.querySelector('.dnext').classList.toggle('hidden', last && !!choices);
    };
    this.dialogNext = () => {
      if (i < pages.length - 1) { i++; show(); return; }
      if (choices) return;
      this.closeDialog(); onDone?.();
    };
    d.classList.remove('hidden');
    show();
  }
  closeDialog() { this.$('#dialog').classList.add('hidden'); this.dialogNext = null; }

  // --- panels ------------------------------------------------------------------------
  openPanel(html, onClose) {
    const p = this.$('#panel');
    p.innerHTML = `<div class="sheet">${html}<button class="close" title="닫기 (Esc)">✕</button></div>`;
    p.classList.remove('hidden');
    p.querySelector('.close').onclick = () => this.closePanel();
    this.onClose = onClose;
    return p;
  }
  closePanel() {
    if (this.$('#panel').classList.contains('hidden')) return;
    this.$('#panel').classList.add('hidden');
    const f = this.onClose; this.onClose = null; f?.();
  }

  questBoard(quests, playerLevel, actions) {
    const filt = { type: '전체', sort: 'difficulty', q: '' };
    const p = this.openPanel(`
      <h2 class="board-title">모험가 의뢰 게시판</h2>
      <div class="board-tools">
        <input class="search" placeholder="의뢰 검색…" />
        <select class="type"><option>전체</option><option>탐험</option><option>수집</option><option>조사</option><option>배달</option></select>
        <select class="sort"><option value="difficulty">난이도순</option><option value="reward">보상순</option><option value="status">진행 상태순</option></select>
      </div>
      <div class="board"><div class="notes"></div><div class="detail"><p class="muted">왼쪽에서 의뢰서를 고르세요. 순서에 상관없이 원하는 의뢰를 받을 수 있습니다.</p></div></div>`);
    const notes = p.querySelector('.notes'), detail = p.querySelector('.detail');
    let sel = null;
    const render = () => {
      let list = quests.all.filter((q) => (filt.type === '전체' || q.type === filt.type) && (!filt.q || (q.title + q.desc + q.giver + q.region).includes(filt.q)));
      const order = { ready: 0, active: 1, available: 2, done: 3 };
      list = list.slice().sort((a, b) => filt.sort === 'reward' ? (b.reward.coins - a.reward.coins)
        : filt.sort === 'status' ? order[quests.status(a.id)] - order[quests.status(b.id)] : a.difficulty - b.difficulty);
      notes.innerHTML = list.map((q, k) => {
        const s = quests.status(q.id);
        const tag = { available: '', active: '<i class="tag act">진행 중</i>', ready: '<i class="tag rdy">보고 가능</i>', done: '<i class="tag done">완료</i>' }[s];
        return `<div class="note ${s} ${sel === q.id ? 'sel' : ''}" data-id="${q.id}" style="--rot:${((k * 37) % 7 - 3) * 0.6}deg">
          <div class="nt">${esc(q.title)}</div><div class="nm">${q.type} · <span class="stars">${STARS(q.difficulty)}</span></div>${tag}</div>`;
      }).join('') || '<p class="muted">조건에 맞는 의뢰가 없습니다.</p>';
      if (sel) showDetail(quests.get(sel));
    };
    const showDetail = (q) => {
      const s = quests.status(q.id);
      const st = quests.state.quests[q.id];
      const warn = q.rec > playerLevel + 1 ? `<div class="warn">권장 레벨보다 낮습니다 (권장 Lv.${q.rec})</div>` : '';
      detail.innerHTML = `
        <h3>${esc(q.title)}</h3>
        <div class="meta"><span>${q.type}</span><span class="stars">${STARS(q.difficulty)}</span><span>권장 Lv.${q.rec}</span><span>📍 ${esc(q.region)}</span></div>
        <p>${esc(q.desc)}</p>
        <div class="row"><b>의뢰인</b> ${esc(q.giver)}</div>
        <div class="row"><b>위험</b> ${esc(q.risk)}</div>
        <div class="row"><b>보상</b> ${q.reward.coins}깃전 · 경험치 ${q.reward.xp}${q.reward.item ? ' · ' + esc(q.reward.item) : ''}${q.reward.lore ? ' · 기록' : ''}</div>
        <div class="objs">${q.objectives.map((o, i) => `<div class="obj ${st && st.progress[i] >= (o.count || 1) ? 'ok' : ''}">◇ ${esc(o.text)}${o.count ? ` (${st ? st.progress[i] : 0}/${o.count})` : ''}</div>`).join('')}
          ${q.turnIn ? `<div class="obj ${s === 'done' ? 'ok' : ''}">◇ ${esc(q.turnIn)}에게 보고</div>` : ''}</div>
        ${warn}
        <div class="btns">
          ${s === 'available' ? '<button data-a="accept">의뢰 받기</button>' : ''}
          ${s === 'active' || s === 'ready' ? `<button data-a="track">${quests.state.tracked === q.id ? '추적 해제' : '추적하기'}</button><button data-a="abandon" class="ghost">포기</button>` : ''}
        </div>`;
      detail.querySelectorAll('button[data-a]').forEach((b) => b.onclick = () => { actions[b.dataset.a](q.id); render(); });
    };
    notes.onclick = (e) => { const n = e.target.closest('.note'); if (!n) return; sel = n.dataset.id; render(); };
    p.querySelector('.search').oninput = (e) => { filt.q = e.target.value.trim(); render(); };
    p.querySelector('.type').onchange = (e) => { filt.type = e.target.value; render(); };
    p.querySelector('.sort').onchange = (e) => { filt.sort = e.target.value; render(); };
    render();
  }

  journal(quests, state) {
    const active = quests.all.filter((q) => ['active', 'ready'].includes(quests.status(q.id)));
    const inv = Object.entries(state.inventory).filter(([, n]) => n > 0);
    const lore = Object.keys(state.lore);
    const p = this.openPanel(`
      <h2>모험 일지</h2>
      <div class="cols">
        <div><h3>진행 중인 의뢰</h3>${active.map((q) => `<div class="jq ${state.tracked === q.id ? 'trk' : ''}" data-id="${q.id}"><b>${esc(q.title)}</b><span>${quests.status(q.id) === 'ready' ? esc(q.turnIn) + '에게 보고' : esc(q.region)}</span></div>`).join('') || '<p class="muted">길드 게시판에서 의뢰를 받아 보세요.</p>'}
          <h3>소지품</h3>${inv.map(([k, n]) => `<div class="inv">${esc(itemName(k))} × ${n}</div>`).join('') || '<p class="muted">비어 있음</p>'}</div>
        <div><h3>발견한 장소</h3>${PLACES.filter((pl) => state.discovered[pl.id]).map((pl) => `<div class="inv">${esc(pl.name)} <small>${esc(pl.sub)}</small></div>`).join('') || '<p class="muted">아직 없음</p>'}
          <h3>기록</h3>${lore.map((k) => `<details><summary>${esc(LORE[k].title)}</summary><p>${esc(LORE[k].text)}</p></details>`).join('') || '<p class="muted">아직 없음</p>'}</div>
      </div>`);
    p.querySelectorAll('.jq').forEach((d) => d.onclick = () => { quests.track(d.dataset.id); this.closePanel(); });
  }

  facility(fac, open, actions) {
    const svc = {
      rest: ['쉬어 가기 (아침까지)', 'rest'], quests: ['의뢰 게시판 보기', 'board'], lore: ['서가 둘러보기', 'lore'], bless: ['축복 받기', 'bless'], save: ['기록하기 (저장)', 'save'],
    };
    const items = fac.services.map((s) => {
      if (svc[s]) return `<button data-a="${svc[s][1]}">${svc[s][0]}</button>`;
      return `<button class="ghost" disabled title="다음 개발 단계에서 열립니다">${{ 'shop:smith': '무기·장비 구매', 'shop:potion': '물약 구매', 'shop:magic': '마법 도구 구매', 'shop:junk': '잡동사니 거래', 'shop:food': '음식 주문', 'shop:general': '모험 물품 구매', 'shop:tailor': '옷 구매', repair: '수리', upgrade: '강화', brew: '조합', identify: '감정', appraise: '감정', rumors: '소문 듣기', cook: '요리', rank: '등급 심사', bank: '보관', auction: '경매 참여', mount: '탈것 빌리기', bounty: '현상 수배', dye: '염색' }[s] || s} <small>준비 중</small></button>`;
    }).join('');
    const p = this.openPanel(`
      <h2>${esc(fac.name)}</h2>
      <p class="fdesc">${esc(fac.desc)}</p>
      <div class="row"><b>운영</b> ${fac.hours[0]}시 – ${fac.hours[1] % 24}시 ${open ? '<span class="open">영업 중</span>' : '<span class="closed">영업 종료</span>'}</div>
      <div class="row"><b>주인</b> ${esc(fac.keeper.name)}</div>
      <div class="svc">${open ? items : '<p class="muted">문이 닫혀 있다. 영업 시간에 다시 오자.</p>'}</div>`);
    p.querySelectorAll('button[data-a]').forEach((b) => b.onclick = () => actions[b.dataset.a]?.());
  }

  map(mapCanvas, player, state, tracked) {
    const p = this.openPanel(`<h2>글래시온 지도</h2><div class="mapwrap"></div><p class="muted">발견한 장소만 이름이 표시됩니다.</p>`);
    const wrap = p.querySelector('.mapwrap');
    const c = document.createElement('canvas');
    c.width = mapCanvas.width; c.height = mapCanvas.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(mapCanvas, 0, 0);
    const S = c.width / (HALF * 2);
    const px = (x) => (x + HALF) * S, pz = (z) => (z + HALF) * S;
    ctx.font = '600 13px "Gowun Batang", serif';
    ctx.textAlign = 'center';
    for (const pl of PLACES) {
      if (!state.discovered[pl.id]) continue;
      ctx.fillStyle = 'rgba(60,35,20,0.9)';
      ctx.beginPath(); ctx.arc(px(pl.x), pz(pl.z), 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,248,230,0.9)'; ctx.fillText(pl.name, px(pl.x) + 1, pz(pl.z) - 7);
      ctx.fillStyle = 'rgba(50,30,20,1)'; ctx.fillText(pl.name, px(pl.x), pz(pl.z) - 8);
    }
    if (tracked?.x !== undefined) { ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(px(tracked.x), pz(tracked.z), 9, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = '#1f5fbf'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px(player.pos.x), pz(player.pos.z), 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    wrap.appendChild(c);
  }

  help() {
    this.openPanel(`<h2>조작법</h2>
      <div class="keys">
        <div><kbd>W A S D</kbd> / 방향키 — 이동</div><div><kbd>Shift</kbd> — 달리기</div>
        <div><kbd>Space</kbd> — 깡총 점프 · 공중에서 꾹 누르면 활공</div><div><kbd>E</kbd> — 대화 · 살펴보기 · 줍기</div>
        <div><kbd>Q</kbd> — 모험 일지 · 의뢰 추적</div><div><kbd>M</kbd> — 지도</div>
        <div><kbd>마우스 휠</kbd> — 확대 / 축소</div><div><kbd>T</kbd> — 시간 빠르게 흐르게 하기</div>
        <div><kbd>Esc</kbd> — 창 닫기</div><div>모바일: 화면 왼쪽 드래그 이동, 오른쪽 탭 점프/상호작용</div>
      </div>
      <p class="muted">높은 곳에서 뛰어내려 Space를 누르고 있으면 날개를 펴고 멀리 활공할 수 있어요. 활공은 기력을 소모하고, 땅에 내려오면 다시 찹니다.</p>`);
  }
}
