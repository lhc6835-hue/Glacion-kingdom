// Plaza menus: today's board (flavor vote, ranking, news), the wishing fountain, the play zone
// room browser and the chat bar.
import { h, esc } from './ui.js';
import { iconCanvas } from '../render/icons.js';
import { FLAVOR } from '../../shared/flavors.js';
import { dailyCandidates, dayKey } from '../../shared/economy.js';
import { sfx } from '../core/audio.js';
import { ArenaScene } from '../scenes/arenaScene.js';
import { animCanvas } from './menus.js';
import { drawGate } from '../render/attractions.js';

const TIPS = [
  '맨 위 스쿱이 가장 먼저 녹아요. 제일 강한 맛을 맨 위에 올려보세요!',
  '구르는 동안에는 공격을 받지 않아요. 우클릭이나 스페이스로 굴러요.',
  '5웨이브마다 보스가 나와요. 보스를 잡으면 리필 스쿱을 떨어뜨려요.',
  '같은 맛이나 무기를 또 뽑으면 레벨이 올라 효과가 세져요 (최대 10레벨).',
  '바닐라는 다른 층 맛 효과를 키워주는 원조 맛이에요.',
  '터키 아이스크림 콘은 공격의 절반을 피해요. 4층 오로라관에 있어요!',
];

export async function board(app) {
  const day = dayKey();
  const cands = dailyCandidates(day);
  const card = app.ui.modal('modal', `
    <h2>오늘의 게시판</h2>
    <div class="sub">${day} · 매일 새로운 소식!</div>
    <div class="tabs"><button data-t="vote" class="on">맛 투표</button><button data-t="rank">오늘의 랭킹</button><button data-t="news">소식</button></div>
    <div class="pane"></div>`);
  card.classList.add('wide');
  const pane = card.querySelector('.pane');
  const show = async (t) => {
    card.querySelectorAll('[data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
    if (t === 'vote') {
      const tally = app.net && app.net.online ? await app.net.getVotes().catch(() => null) : null;
      const mine = app.profile.data.votes[day];
      const total = tally ? Object.values(tally).reduce((a, b) => a + b, 0) : 0;
      pane.innerHTML = `<div class="sub">오늘 가장 먹고 싶은 맛은? 투표하면 🍬 80을 드려요!</div><div class="votes"></div><div class="err"></div>`;
      const box = pane.querySelector('.votes');
      for (const id of cands) {
        const f = FLAVOR[id];
        const n = tally ? tally[id] || 0 : null;
        const pct = total ? Math.round((n / total) * 100) : 0;
        const el = h(`<div class="vote ${mine === id ? 'mine' : ''}"><div class="ic"></div><div class="vn">${esc(f.name)}</div><div class="vd">${esc(f.desc)}</div>
          ${tally ? `<div class="bar"><i style="width:${pct}%"></i></div><div class="vc">${n}표 · ${pct}%</div>` : ''}
          <button class="btn small ${mine ? 'ghost' : ''}" ${mine ? 'disabled' : ''}>${mine === id ? '내가 고른 맛' : '투표하기'}</button></div>`);
        el.querySelector('.ic').appendChild(iconCanvas('flavor', id, 70));
        el.querySelector('button').onclick = async () => {
          const r = await app.profile.act('vote', id, day);
          if (!r.ok) { pane.querySelector('.err').textContent = r.error; return; }
          sfx.coin();
          app.ui.toast(`투표 완료! 🍬 ${r.reward}`);
          show('vote');
        };
        box.appendChild(el);
      }
      if (!tally) pane.insertAdjacentHTML('beforeend', '<div class="note" style="text-align:center">로그인하면 다른 사람들의 투표 결과도 볼 수 있어요.</div>');
    } else if (t === 'rank') {
      const list = app.net && app.net.online ? await app.net.getRanking().catch(() => null) : null;
      if (!list) { pane.innerHTML = `<div class="sub">로그인하면 오늘 가장 오래 버틴 아이스크림들을 볼 수 있어요.<br>내 최고 기록: 웨이브 ${app.profile.data.stats.bestWave}</div>`; return; }
      pane.innerHTML = `<ol class="rank">${list.map((r, i) => `<li><b>${i + 1}</b><span>${esc(r.name)}</span><em>Lv.${r.level}</em><i>웨이브 ${r.wave}</i></li>`).join('') || '<div class="sub">아직 오늘의 기록이 없어요. 1등을 노려봐요!</div>'}</ol>`;
    } else {
      const tip = TIPS[Math.floor(Date.now() / 86400000) % TIPS.length];
      pane.innerHTML = `<div class="news"><div class="trait">💡 오늘의 팁<br>${esc(tip)}</div>
        <div class="trait">🍨 틀 갤러리 소식<br>5층 은하 펜트하우스에 전설의 「기본 아이스크림 콘」이 전시 중이에요. 원조 등급(OG)!</div>
        <div class="trait">🎰 뽑기 소식<br>바닐라와 초코는 OG 등급이라 정말정말 드물게 나와요. 행운을 빌어요!</div></div>`;
    }
  };
  card.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => show(b.dataset.t)));
  show('vote');
}

export function fountainWish(app, done) {
  const card = app.ui.modal('modal', `<h2>소원의 분수</h2>
    <div class="sub">🍬 20을 던지고 소원을 빌어요. 가끔 분수가 행운을 돌려준대요!</div>
    <div class="err"></div>
    <div class="row"><button class="btn ghost" data-a="x">그만두기</button><button class="btn sky" data-a="go">동전 던지기 🍬20</button></div>`);
  card.querySelector('[data-a=x]').onclick = () => app.ui.remove('modal');
  card.querySelector('[data-a=go]').onclick = async () => {
    const r = await app.profile.act('wish');
    if (!r.ok) { card.querySelector('.err').textContent = r.error; return; }
    app.ui.remove('modal');
    sfx.coin();
    if (r.reward) { setTimeout(() => sfx.levelup(), 300); app.ui.toast(r.reward >= 1000 ? `대박! 분수가 🍬 ${r.reward}을 돌려줬어요!` : `분수가 🍬 ${r.reward}을 돌려줬어요!`); }
    done(r.fortune);
  };
}

export function playZone(app) {
  const online = app.net && app.net.online;
  const card = app.ui.modal('modal', `
    <div class="pz-hero"><canvas class="pz-gate"></canvas><div class="pz-titles"><div class="g-kicker">PLAY ZONE</div><h2>플레이 존</h2><div class="sub">방을 만들고 친구들과 함께 버텨요!</div></div></div>
    <div class="tabs pz-tabs"><button data-t="make" class="on">✨ 방 만들기</button><button data-t="list">🍨 방 목록</button></div>
    <div class="pane"></div>
    <button class="g-close" data-a="x" aria-label="닫기">✕</button>`);
  card.classList.add('pz-card');
  animCanvas(card.querySelector('.pz-gate'), 170, 170, (g, t) => { g.translate(85, 160); g.scale(0.36, 0.36); drawGate(g, t); });
  card.querySelector('[data-a=x]').onclick = () => app.ui.remove('modal');
  const pane = card.querySelector('.pane');
  const lo = app.profile.data.loadout;
  const make = () => {
    let max = 1;
    pane.innerHTML = `
      <label class="pz-label">방 이름</label>
      <input class="field" maxlength="20" value="${esc(app.profile.data.name)}의 방">
      <label class="pz-label">함께할 인원</label>
      <div class="pz-seats">${[1, 2, 3, 4].map((n) => `<button data-n="${n}" class="${n === 1 ? 'on' : ''}"><span class="cones"></span><b>${n}명</b><small>${['혼자서 집중', '둘이서 오붓하게', '셋이서 든든하게', '넷이서 와글와글'][n - 1]}</small></button>`).join('')}</div>
      <button class="pz-switch"><i></i><span>비공개 방 (코드로만 입장)</span></button>
      <div class="err"></div>
      <button class="pz-go" data-a="go"><span>방 만들고 출발!</span></button>
      ${online ? '' : '<div class="note" style="text-align:center">혼자 하기는 바로 할 수 있어요. 여럿이 하려면 로그인해 주세요.</div>'}`;
    pane.querySelectorAll('[data-n]').forEach((b) => {
      const box = b.querySelector('.cones');
      for (let i = 0; i < +b.dataset.n; i++) box.appendChild(iconCanvas('flavor', lo.flavors[i % lo.flavors.length] || 'milk', 26));
      b.onclick = () => { sfx.click(); max = +b.dataset.n; pane.querySelectorAll('[data-n]').forEach((x) => x.classList.toggle('on', x === b)); };
    });
    let priv = false;
    const sw = pane.querySelector('.pz-switch');
    sw.onclick = () => { priv = !priv; sw.classList.toggle('on', priv); sfx.click(); };
    pane.querySelector('[data-a=go]').onclick = async () => {
      sfx.click();
      if (max === 1) { app.ui.remove('modal'); app.go(new ArenaScene(app)); return; }
      if (!online) { pane.querySelector('.err').textContent = '여럿이 하려면 로그인이 필요해요'; return; }
      const name = pane.querySelector('.field').value.trim() || '아이스크림 방';
      try { await app.net.createRoom({ name, max, priv }); } catch (e) { pane.querySelector('.err').textContent = e.message; }
    };
  };
  const list = async () => {
    if (!online) { pane.innerHTML = '<div class="pz-empty"><b>🔒</b>방 목록은 로그인하면 볼 수 있어요.</div>'; return; }
    pane.innerHTML = '<div class="pz-empty"><b class="spin">🍦</b>불러오는 중…</div>';
    const rooms = await app.net.listRooms().catch(() => []);
    pane.innerHTML = `<div class="rooms">${rooms.map((r) => `<div class="pz-room">
        <div class="pz-room-info"><b>${esc(r.name)}</b><span class="chip ${r.started ? 'busy' : 'wait'}">${r.started ? '진행 중' : '대기 중'}</span></div>
        <div class="pz-slots">${Array.from({ length: r.max }, (_, i) => `<i class="${i < r.count ? 'on' : ''}"></i>`).join('')}<span>${r.count}/${r.max}</span></div>
        <button class="btn small" data-id="${esc(r.id)}" ${r.count >= r.max || r.started ? 'disabled' : ''}>입장</button>
      </div>`).join('') || '<div class="pz-empty"><b>🌙</b>열린 방이 없어요. 직접 만들어 봐요!</div>'}</div>
      <div class="pz-code"><input class="field code" placeholder="방 코드 6자리" maxlength="6"><button class="btn small sky" data-a="code">코드로 입장</button><button class="btn small ghost" data-a="re">↻</button></div><div class="err"></div>`;
    pane.querySelectorAll('[data-id]').forEach((b) => (b.onclick = () => app.net.joinRoom(b.dataset.id).catch((e) => (pane.querySelector('.err').textContent = e.message))));
    pane.querySelector('[data-a=re]').onclick = list;
    pane.querySelector('[data-a=code]').onclick = () => { const c = pane.querySelector('.code').value.trim().toUpperCase(); if (c) app.net.joinRoom(c).catch((e) => (pane.querySelector('.err').textContent = e.message)); };
  };
  card.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { sfx.click(); card.querySelectorAll('[data-t]').forEach((x) => x.classList.toggle('on', x === b)); b.dataset.t === 'make' ? make() : list(); }));
  make();
}

const EMOTES = ['안녕! 👋', '같이 하자!', 'ㅋㅋㅋ', '고마워 🍨', '녹는다…', '최고! ✨'];
export function chatBar(app, send) {
  if (app.ui.has('chat')) return;
  const el = app.ui.set('chat', h(`<div class="chatbar"><div class="emotes">${EMOTES.map((e) => `<button>${esc(e)}</button>`).join('')}</div>
    <form><input maxlength="60" placeholder="말하기 (Enter)"><button class="btn small">보내기</button></form></div>`));
  const inp = el.querySelector('input');
  setTimeout(() => inp.focus(), 30);
  const close = () => app.ui.remove('chat');
  el.querySelector('form').onsubmit = (e) => { e.preventDefault(); const v = inp.value.trim(); if (v) send(v); close(); };
  el.querySelectorAll('.emotes button').forEach((b) => (b.onclick = () => { send(b.textContent); close(); }));
  inp.onkeydown = (e) => { if (e.key === 'Escape') close(); e.stopPropagation(); };
  inp.onblur = () => setTimeout(() => { if (document.activeElement !== inp && !el.matches(':hover')) close(); }, 150);
}
