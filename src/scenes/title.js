// Title screen: a sky full of drifting ice creams behind the logo, with sign-in / sign-up.
import { IceCreamRig } from '../render/icecream.js';
import { h, esc } from '../ui/ui.js';
import { MOLDS } from '../../shared/molds.js';
import { FLAVORS } from '../../shared/flavors.js';
import { FACES } from '../../shared/faces.js';
import { rand, pick, TAU } from '../core/math.js';
import { sfx, music } from '../core/audio.js';

export class TitleScene {
  constructor(app) { this.app = app; this.t = 0; this.floaters = []; }
  enter() {
    for (let i = 0; i < 14; i++) this.floaters.push(this.makeFloater(true));
    this.app.ui.set('logo', h(`<div class="logo"><div class="k">글래시온 왕국</div><div class="t">녹지 마,<br>아이스크림!</div></div>`));
    music('menu');
    if (this.app.profile.signedIn) this.welcome();
    else this.authForm('login');
  }
  makeFloater(any) {
    const m = pick(MOLDS);
    const fl = [];
    for (let k = 0; k < Math.min(3, m.layers); k++) fl.push(pick(FLAVORS).id);
    return { rig: new IceCreamRig({ mold: m.id, flavors: fl, face: pick(FACES).id }), x: rand(innerWidth), y: any ? rand(innerHeight) : innerHeight + 120, s: rand(0.55, 1.1), sp: rand(18, 40), rot: rand(-0.3, 0.3), ph: rand(TAU) };
  }

  welcome() {
    const p = this.app.profile.data;
    const el = this.app.ui.set('menu', h(`<div class="title-wrap"><div class="card auth">
      <div class="sub" style="margin:0 0 10px">어서 와요, <b>${esc(p.name)}</b> 님! (Lv.${p.level})</div>
      <div class="row"><button class="btn ghost" data-a="out">다른 계정</button><button class="btn" data-a="go" style="font-size:20px">광장으로!</button></div>
    </div></div>`));
    el.querySelector('[data-a=go]').onclick = () => { sfx.click(); this.app.goHome(); };
    el.querySelector('[data-a=out]').onclick = async () => { await this.app.net.logout(); this.authForm('login'); };
  }

  authForm(mode) {
    const el = this.app.ui.set('menu', h(`<div class="title-wrap"><div class="card auth">
      <div class="tabs"><button data-m="login">로그인</button><button data-m="signup">회원가입</button></div>
      <form>
        <input class="field" name="id" placeholder="아이디 (영어 소문자, 숫자)" autocomplete="username" maxlength="16">
        <input class="field" name="pw" type="password" placeholder="비밀번호 (4자 이상)" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}" maxlength="64">
        ${mode === 'signup' ? '<input class="field" name="name" placeholder="닉네임 (2~12자)" maxlength="12">' : ''}
        <div class="err"></div>
        <button class="btn" style="width:100%;font-size:19px">${mode === 'signup' ? '가입하고 시작하기' : '로그인'}</button>
      </form>
      <button class="btn ghost small" data-a="guest" style="width:100%;margin-top:10px">게스트로 둘러보기 (이 기기에만 저장)</button>
    </div></div>`));
    el.querySelectorAll('[data-m]').forEach((b) => { b.classList.toggle('on', b.dataset.m === mode); b.onclick = (e) => { e.preventDefault(); this.authForm(b.dataset.m); }; });
    const form = el.querySelector('form');
    const errEl = el.querySelector('.err');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const btn = form.querySelector('button');
      btn.disabled = true; errEl.textContent = '';
      try {
        const r = mode === 'signup' ? await this.app.net.signup(fd.get('id'), fd.get('pw'), fd.get('name')) : await this.app.net.login(fd.get('id'), fd.get('pw'));
        if (!r.ok) { errEl.textContent = r.error || '실패했어요'; btn.disabled = false; return; }
        sfx.levelup();
        this.app.goHome();
      } catch {
        errEl.textContent = '서버에 연결할 수 없어요. 게스트로 먼저 놀아볼까요?';
        btn.disabled = false;
      }
    };
    el.querySelector('[data-a=guest]').onclick = () => { sfx.click(); this.app.goHome(); };
  }

  update(dt) {
    this.t += dt;
    for (const f of this.floaters) {
      f.y -= f.sp * dt;
      f.rig.update(dt, { vx: Math.sin(this.t + f.ph) * 30 });
      if (f.y < -160) Object.assign(f, this.makeFloater(false));
    }
  }
  draw(g) {
    const W = innerWidth, H = innerHeight;
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#ffc6dc'); gr.addColorStop(0.55, '#ffe3ec'); gr.addColorStop(1, '#d9f3ff');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 5; i++) {
      const x = ((this.t * 12 + i * 300) % (W + 400)) - 200, y = 80 + i * 110;
      for (const [dx, dy, r] of [[0, 0, 40], [40, -14, 50], [90, 0, 38], [45, 14, 36]]) { g.beginPath(); g.arc(x + dx, y + dy, r, 0, TAU); g.fill(); }
    }
    for (const f of this.floaters) {
      g.save(); g.translate(f.x + Math.sin(this.t * 0.8 + f.ph) * 20, f.y); g.rotate(f.rot + Math.sin(this.t + f.ph) * 0.1);
      f.rig.draw(g, 0, 0, f.s, { shadow: false });
      g.restore();
    }
  }
}
