// Room waiting area: who is in, the room code to share, and the host's start button.
import { esc } from './ui.js';
import { IceCreamRig } from '../render/icecream.js';
import { livePreview } from './menus.js';
import { sfx } from '../core/audio.js';

export function lobby(app, room, start) {
  const card = app.ui.modal('modal', `
    <h2>${esc(room.info.name)}</h2>
    <div class="sub">방 코드 <b class="code">${room.code}</b> · 최대 ${room.info.max}명</div>
    <div class="lobby"></div>
    <div class="sub wait"></div>
    <div class="row"><button class="btn ghost" data-a="leave">나가기</button><button class="btn" data-a="start">시작하기!</button></div>`, { closable: false });
  card.classList.add('wide');
  const box = card.querySelector('.lobby');
  const render = () => {
    box.innerHTML = '';
    for (let i = 0; i < room.info.max; i++) {
      const p = [...room.players.values()][i];
      const el = document.createElement('div');
      el.className = 'seat' + (p ? '' : ' empty');
      if (p) {
        const c = document.createElement('canvas');
        el.appendChild(c);
        livePreview(c, new IceCreamRig(p.look), { size: 120 });
        el.insertAdjacentHTML('beforeend', `<div class="nm">${p.id === room.host ? '👑 ' : ''}${esc(p.name)}${p.id === room.you ? ' (나)' : ''}</div><div class="note">Lv.${p.level}</div>`);
      } else el.innerHTML = '<div class="nm">빈 자리</div><div class="note">친구를 기다리는 중…</div>';
      box.appendChild(el);
    }
    const isHost = room.host === room.you;
    card.querySelector('[data-a=start]').style.display = isHost ? '' : 'none';
    card.querySelector('.wait').textContent = isHost ? '모두 모이면 시작해 주세요. 혼자서도 시작할 수 있어요!' : '방장이 시작하기를 기다리고 있어요…';
  };
  render();
  const handler = (m) => {
    if (m.t === 'join') { room.players.set(m.p.id, m.p); sfx.pop(); render(); }
    else if (m.t === 'leave') { room.players.delete(m.id); room.host = m.host; render(); }
    else if (m.t === 'start') { room.started = true; room.seed = m.seed; room.handlers.delete(handler); app.ui.remove('modal'); start(); }
    else if (m.t === 'closed' && !room.started) { room.handlers.delete(handler); app.ui.remove('modal'); app.ui.toast('방과 연결이 끊어졌어요'); }
  };
  room.handlers.add(handler);
  const ping = setInterval(() => { if (!card.isConnected || room.started) clearInterval(ping); else room.send({ t: 'ping' }); }, 15000);
  card.querySelector('[data-a=leave]').onclick = () => { room.handlers.delete(handler); room.leave(); app.ui.remove('modal'); };
  card.querySelector('[data-a=start]').onclick = () => { sfx.click(); room.send({ t: 'start' }); };
}
