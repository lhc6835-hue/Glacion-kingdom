// DOM overlay helpers: modal cards, toasts and the in-run screens (topping pick, results, pause).
import { TOPPING } from '../data/toppings.js';
import { sfx } from '../core/audio.js';

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export class UI {
  constructor(root) {
    this.root = root;
    this.layers = new Map();
  }

  // Named layers so scenes can replace their own HUD without touching modals.
  set(name, el) {
    this.remove(name);
    if (!el) return null;
    el.dataset.layer = name;
    this.root.appendChild(el);
    this.layers.set(name, el);
    return el;
  }
  get(name) { return this.layers.get(name); }
  remove(name) {
    const el = this.layers.get(name);
    if (el) el.remove();
    this.layers.delete(name);
  }
  clear(keep = []) { for (const k of [...this.layers.keys()]) if (!keep.includes(k)) this.remove(k); }
  has(name) { return this.layers.has(name); }

  modal(name, inner, { onClose, closable = true } = {}) {
    const el = h(`<div class="overlay"><div class="card">${inner}</div></div>`);
    if (closable) el.addEventListener('pointerdown', (e) => { if (e.target === el) { this.remove(name); onClose && onClose(); } });
    this.set(name, el);
    return el.querySelector('.card');
  }

  toast(msg, ms = 2200) {
    const el = h(`<div class="toast">${esc(msg)}</div>`);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  toppingPick(ids, player, done) {
    const counts = {};
    for (const t of player.toppings) counts[t] = (counts[t] || 0) + 1;
    const card = this.modal('pick', `
      <h2>토핑을 골라요!</h2>
      <div class="sub">이번 판 동안 계속 유지돼요</div>
      <div class="picks">${ids.map((id) => {
        const t = TOPPING[id];
        return `<div class="pick" data-id="${id}"><span class="ic">${t.icon}</span><div class="nm">${esc(t.name)}</div><div class="ds">${esc(t.desc)}</div>${counts[id] ? `<div class="cnt">보유 ${counts[id]}</div>` : ''}</div>`;
      }).join('')}</div>`, { closable: false });
    sfx.open();
    card.querySelectorAll('.pick').forEach((el) => el.addEventListener('click', () => {
      sfx.click();
      this.remove('pick');
      done(el.dataset.id);
    }));
  }

  results(r, { onPlaza, onRetry, levelInfo }) {
    const card = this.modal('results', `
      <h2>다 녹아버렸어요…</h2>
      <div class="sub">그래도 정말 달콤하게 버텼어요!</div>
      <div class="stats">
        <div class="stat"><b>${r.wave}</b><span>도달한 웨이브</span></div>
        <div class="stat"><b>${r.kills}</b><span>처치한 적</span></div>
        <div class="stat"><b>🍬 ${r.coins.toLocaleString()}</b><span>획득 코인</span></div>
        <div class="stat"><b>+${r.xp}</b><span>경험치</span></div>
      </div>
      ${levelInfo || ''}
      <div class="row">
        <button class="btn ghost" data-a="plaza">광장으로</button>
        <button class="btn" data-a="retry">한 번 더!</button>
      </div>`, { closable: false });
    card.querySelector('[data-a=plaza]').onclick = () => { sfx.click(); this.remove('results'); onPlaza(); };
    card.querySelector('[data-a=retry]').onclick = () => { sfx.click(); this.remove('results'); onRetry(); };
  }

  pause({ onResume, onQuit }) {
    const card = this.modal('pause', `
      <h2>잠깐 쉬어요</h2>
      <div class="sub">아이스크림이 녹지 않게 얼려뒀어요</div>
      <div class="row"><button class="btn ghost" data-a="quit">포기하고 나가기</button><button class="btn" data-a="go">계속하기</button></div>`, { onClose: onResume });
    card.querySelector('[data-a=go]').onclick = () => { this.remove('pause'); onResume(); };
    card.querySelector('[data-a=quit]').onclick = () => { this.remove('pause'); onQuit(); };
  }
}
