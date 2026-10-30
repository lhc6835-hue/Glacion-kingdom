// Tiny procedural sound kit. Everything is synthesised; no audio files.
let ctx = null, master = null, musicGain = null, muted = false;
const last = {};

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.18;
    musicGain.connect(master);
  } catch { ctx = null; }
}
export function resumeAudio() { initAudio(); if (ctx && ctx.state === 'suspended') ctx.resume(); }
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; }
export const isMuted = () => muted;

function tone({ f = 440, f2, type = 'sine', dur = 0.12, vol = 0.3, attack = 0.005, at = 0, dest }) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise({ dur = 0.15, vol = 0.2, freq = 1200, q = 1, type = 'bandpass', at = 0, f2 }) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + at;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ctx.createBufferSource();
  s.buffer = buf;
  const fl = ctx.createBiquadFilter();
  fl.type = type; fl.frequency.setValueAtTime(freq, t); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(master);
  s.start(t);
}

// Rate-limit so a hundred simultaneous hits do not become a wall of noise.
function gate(name, gap) {
  const now = performance.now();
  if (last[name] && now - last[name] < gap) return false;
  last[name] = now;
  return true;
}

const v = (a) => a * (0.9 + Math.random() * 0.2);
export const sfx = {
  swing() { if (gate('swing', 40)) noise({ dur: 0.14, vol: 0.18, freq: 900, f2: 2600, q: 0.8 }); },
  heavy() { noise({ dur: 0.35, vol: 0.4, freq: 300, f2: 80, q: 0.7, type: 'lowpass' }); tone({ f: 120, f2: 40, type: 'sine', dur: 0.35, vol: 0.5 }); },
  shoot() { if (gate('shoot', 45)) tone({ f: v(880), f2: 420, type: 'triangle', dur: 0.07, vol: 0.12 }); },
  pop() { if (gate('pop', 30)) tone({ f: v(520), f2: 1100, type: 'sine', dur: 0.08, vol: 0.18 }); },
  hit() { if (gate('hit', 35)) { tone({ f: v(300), f2: 120, type: 'square', dur: 0.06, vol: 0.06 }); noise({ dur: 0.06, vol: 0.12, freq: 2200 }); } },
  crit() { if (gate('crit', 60)) tone({ f: v(1300), f2: 1900, type: 'triangle', dur: 0.1, vol: 0.14 }); },
  kill() { if (gate('kill', 40)) { noise({ dur: 0.22, vol: 0.16, freq: 1800, f2: 400, q: 0.6 }); tone({ f: v(660), f2: 990, dur: 0.09, vol: 0.08 }); } },
  boom() { if (gate('boom', 70)) { noise({ dur: 0.45, vol: 0.38, freq: 700, f2: 90, q: 0.5, type: 'lowpass' }); tone({ f: 90, f2: 35, dur: 0.4, vol: 0.4 }); } },
  coin() { if (gate('coin', 50)) { tone({ f: 1320, dur: 0.06, vol: 0.09, type: 'square' }); tone({ f: 1760, dur: 0.12, vol: 0.08, type: 'square', at: 0.05 }); } },
  hurt() { tone({ f: 420, f2: 160, type: 'sawtooth', dur: 0.2, vol: 0.14 }); noise({ dur: 0.2, vol: 0.18, freq: 600 }); },
  melt() { tone({ f: 600, f2: 90, type: 'sine', dur: 0.6, vol: 0.3 }); noise({ dur: 0.5, vol: 0.2, freq: 400, f2: 120, type: 'lowpass' }); },
  dash() { noise({ dur: 0.2, vol: 0.15, freq: 500, f2: 1800, q: 1.2 }); },
  freeze() { if (gate('freeze', 90)) { tone({ f: 1800, f2: 2600, type: 'sine', dur: 0.18, vol: 0.08 }); noise({ dur: 0.18, vol: 0.06, freq: 6000, type: 'highpass' }); } },
  zap() { if (gate('zap', 70)) noise({ dur: 0.12, vol: 0.12, freq: 4000, f2: 1200, q: 3 }); },
  wave() { [523, 659, 784, 1046].forEach((f, i) => tone({ f, dur: 0.22, vol: 0.12, type: 'triangle', at: i * 0.08 })); },
  boss() { [196, 185, 174, 165].forEach((f, i) => tone({ f, dur: 0.4, vol: 0.2, type: 'sawtooth', at: i * 0.18 })); },
  levelup() { [523, 659, 784, 988, 1175].forEach((f, i) => tone({ f, dur: 0.3, vol: 0.12, type: 'triangle', at: i * 0.07 })); },
  click() { tone({ f: 740, dur: 0.05, vol: 0.08, type: 'triangle' }); },
  open() { tone({ f: 500, f2: 900, dur: 0.12, vol: 0.1, type: 'sine' }); },
  jump() { tone({ f: 380, f2: 760, dur: 0.12, vol: 0.12, type: 'sine' }); },
  land() { if (gate('land', 80)) tone({ f: 200, f2: 90, dur: 0.08, vol: 0.12, type: 'sine' }); },
  gacha(grade) {
    const base = 440 + grade * 70;
    [0, 4, 7, 12].forEach((s, i) => tone({ f: base * Math.pow(2, s / 12), dur: 0.35, vol: 0.12, type: 'triangle', at: i * 0.09 }));
    if (grade >= 6) [0, 7, 12, 19].forEach((s, i) => tone({ f: base * 2 * Math.pow(2, s / 12), dur: 0.5, vol: 0.08, type: 'sine', at: 0.4 + i * 0.1 }));
  },
};

// A gentle looping arpeggio for menus/plaza and a busier one for battle.
let musicTimer = null, musicMode = null;
export function music(mode) {
  if (!ctx || musicMode === mode) return;
  musicMode = mode;
  clearInterval(musicTimer);
  if (!mode) return;
  const prog = mode === 'battle'
    ? [[220, 261.6, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [196, 246.9, 329.6]]
    : [[261.6, 329.6, 392], [220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7]];
  const step = mode === 'battle' ? 0.16 : 0.26;
  let i = 0;
  musicTimer = setInterval(() => {
    if (muted || !ctx) return;
    const chord = prog[Math.floor(i / 8) % prog.length];
    const n = chord[i % 3] * (i % 8 >= 4 ? 2 : 1);
    tone({ f: n, dur: step * 1.8, vol: 0.5, type: 'triangle', dest: musicGain });
    if (i % 8 === 0) tone({ f: chord[0] / 2, dur: step * 7, vol: 0.6, type: 'sine', dest: musicGain });
    if (mode === 'battle' && i % 2 === 0) noise({ dur: 0.04, vol: 0.02, freq: 8000, type: 'highpass' });
    i++;
  }, step * 1000);
}
