// All sound is synthesised with Web Audio (no audio files). Buses: music, sfx, ambience → master.
export class Audio {
  constructor() {
    this.ctx = null;
    this.voices = 0;
    this.vol = { master: 0.8, music: 0.55, sfx: 0.8, ambience: 0.7 };
    this.night = 0;
    this.musicOn = true;
  }

  // Must be called from a user gesture.
  init() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4;
    this.master.connect(comp).connect(c.destination);
    this.music = c.createGain(); this.music.connect(this.master);
    this.sfx = c.createGain(); this.sfx.connect(this.master);
    this.amb = c.createGain(); this.amb.connect(this.master);
    // a short stereo room for space
    this.verb = c.createConvolver();
    this.verb.buffer = this.impulse(2.2);
    this.verbGain = c.createGain(); this.verbGain.gain.value = 0.28;
    this.verb.connect(this.verbGain).connect(this.master);
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.apply();
    this.startAmbience();
    this.startMusic();
  }

  impulse(sec) {
    const c = this.ctx, n = Math.floor(c.sampleRate * sec);
    const b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); }
    return b;
  }

  setVolumes(s) { this.vol = { master: s.master, music: s.music, sfx: s.sfx, ambience: s.ambience }; this.apply(); }
  apply() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.master, t, 0.05);
    this.music.gain.setTargetAtTime(this.vol.music * 0.5, t, 0.05);
    this.sfx.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    this.amb.gain.setTargetAtTime(this.vol.ambience * 0.6, t, 0.05);
  }

  // ── primitives ──
  env(node, t, a, peak, dec, end = 0.0001) {
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(peak, t + a);
    node.gain.exponentialRampToValueAtTime(end, t + a + dec);
  }

  tone(type, f0, f1, dur, vol, { bus = this.sfx, t = 0, attack = 0.004, pan = 0, verb = 0 } = {}) {
    if (!this.ctx || this.voices > 28) return;
    const c = this.ctx, now = c.currentTime + t;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, now);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), now + dur);
    this.env(g, now, attack, vol, dur);
    let out = g;
    if (pan) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
    o.connect(g); out.connect(bus);
    if (verb) { const v = c.createGain(); v.gain.value = verb; out.connect(v).connect(this.verb); }
    this.voices++;
    o.onended = () => this.voices--;
    o.start(now); o.stop(now + attack + dur + 0.05);
  }

  hiss(dur, vol, { type = 'bandpass', f0 = 1000, f1 = f0, q = 1, bus = this.sfx, t = 0, attack = 0.003, pan = 0, verb = 0 } = {}) {
    if (!this.ctx || this.voices > 28) return;
    const c = this.ctx, now = c.currentTime + t;
    const s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const fl = c.createBiquadFilter(); fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f0, now); fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), now + attack + dur);
    const g = c.createGain(); this.env(g, now, attack, vol, dur);
    let out = g;
    if (pan) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
    s.connect(fl).connect(g); out.connect(bus);
    if (verb) { const v = c.createGain(); v.gain.value = verb; out.connect(v).connect(this.verb); }
    this.voices++;
    s.onended = () => this.voices--;
    s.start(now, Math.random()); s.stop(now + attack + dur + 0.05);
  }

  // ── game sounds ──
  play(name, o = {}) {
    if (!this.ctx) return;
    const pan = o.pan || 0;
    switch (name) {
      case 'whoosh': this.hiss(0.16, 0.18, { f0: 600, f1: 2400, q: 1.2, attack: 0.04, pan }); break;
      case 'chop': {
        const k = { great: 1.15, good: 1, weak: 0.7 }[o.j] || 1;
        this.tone('sine', 130 * k, 52, 0.18, 0.5, { pan });                    // body thump
        this.tone('triangle', 330 * k, 180, 0.09, 0.25, { pan });              // wood knock
        this.hiss(0.08, 0.35, { f0: 1600, f1: 700, q: 2, pan });              // splinters
        this.hiss(0.05, 0.2, { type: 'highpass', f0: 4000, pan, t: 0.01 });
        break;
      }
      case 'crit':
        this.tone('sine', 110, 38, 0.35, 0.75, { pan });
        this.tone('triangle', 420, 160, 0.12, 0.3, { pan });
        this.hiss(0.14, 0.45, { f0: 2400, f1: 600, q: 1.5, pan });
        this.tone('sine', 1760, 1760, 0.4, 0.12, { pan, verb: 0.5, t: 0.01 });
        this.tone('sine', 2637, 2637, 0.3, 0.08, { pan, verb: 0.5, t: 0.03 });
        break;
      case 'miss': this.hiss(0.2, 0.12, { f0: 900, f1: 300, q: 0.8, attack: 0.03, pan }); break;
      case 'burn': for (let i = 0; i < 4; i++) this.hiss(0.03, 0.12, { type: 'highpass', f0: 2500 + Math.random() * 2000, t: i * 0.05 + Math.random() * 0.03, pan }); this.hiss(0.3, 0.08, { type: 'lowpass', f0: 600, pan }); break;
      case 'frost': this.hiss(0.18, 0.15, { type: 'highpass', f0: 6000, f1: 3000, pan }); this.tone('sine', 2800, 3600, 0.15, 0.06, { pan, verb: 0.6 }); this.tone('sine', 3900, 4400, 0.12, 0.05, { t: 0.05, pan, verb: 0.6 }); break;
      case 'zap': this.tone('square', 1400, 90, 0.12, 0.12, { pan }); this.hiss(0.1, 0.25, { f0: 3000, f1: 800, q: 3, pan }); this.tone('sine', 70, 40, 0.2, 0.3, { pan }); break;
      case 'poison': this.tone('sine', 300, 520, 0.08, 0.08, { pan }); this.tone('sine', 380, 640, 0.07, 0.06, { t: 0.07, pan }); break;
      case 'void': this.tone('sawtooth', 220, 55, 0.4, 0.15, { pan, verb: 0.4 }); this.tone('sine', 55, 30, 0.5, 0.4, { pan }); break;
      case 'creak': this.tone('sawtooth', 90, 70, 0.6, 0.07, { attack: 0.2, pan }); this.hiss(0.5, 0.06, { f0: 400, q: 6, attack: 0.2, pan }); break;
      case 'fell': {
        const big = o.size || 1;
        this.tone('sine', 70, 28, 0.6 * big, 0.8, { pan });
        this.hiss(0.5 * big, 0.4, { type: 'lowpass', f0: 900, f1: 120, pan });
        this.hiss(0.9, 0.18, { f0: 3000, f1: 1500, q: 0.5, attack: 0.05, t: 0.05, pan }); // leaves
        break;
      }
      case 'coin': this.tone('square', 1318, 1318, 0.06, 0.06); this.tone('square', 1760, 1760, 0.12, 0.06, { t: 0.06 }); break;
      case 'pickup': this.tone('triangle', 660, 990, 0.08, 0.12); break;
      case 'click': this.tone('triangle', 900, 700, 0.04, 0.1); break;
      case 'open': this.tone('triangle', 440, 660, 0.08, 0.1); this.hiss(0.08, 0.05, { f0: 2000 }); break;
      case 'close': this.tone('triangle', 660, 440, 0.07, 0.08); break;
      case 'buy': [523, 659, 784].forEach((f, i) => this.tone('triangle', f, f, 0.18, 0.12, { t: i * 0.07, verb: 0.3 })); break;
      case 'error': this.tone('square', 180, 140, 0.15, 0.08); break;
      case 'step': this.hiss(0.04, o.run ? 0.08 : 0.05, { type: 'lowpass', f0: 500, f1: 200, pan }); break;
      case 'jump': this.hiss(0.06, 0.05, { f0: 800, f1: 1600 }); break;
      case 'land': this.hiss(0.08, 0.1, { type: 'lowpass', f0: 400, f1: 120 }); break;
      case 'levelup': [392, 523, 659, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, 0.3, 0.13, { t: i * 0.08, verb: 0.5 })); break;
      case 'rare': [880, 1108, 1318, 1760].forEach((f, i) => this.tone('sine', f, f, 0.5, 0.1, { t: i * 0.09, verb: 0.7 })); break;
      // altar reveal: charge → burst → card flips → spotlight. tier 0..3 scales the drama
      case 'gachaCharge': {
        const tier = o.tier || 0;
        this.hiss(0.9, 0.12 + tier * 0.03, { f0: 200, f1: 2800 + tier * 1200, attack: 0.8, q: 2 });
        this.tone('sine', 55, 82 + tier * 10, 1.0, 0.25 + tier * 0.05, { attack: 0.7 });
        for (let i = 0; i < 6 + tier * 2; i++) this.tone('sine', 880 + i * 110, 880 + i * 110, 0.12, 0.025, { t: 0.1 + i * 0.09, verb: 0.6 });
        break;
      }
      case 'gachaBurst': {
        const tier = o.tier || 0;
        this.tone('sine', 90, 30, 0.9, 0.7, {});
        this.hiss(0.6, 0.35, { type: 'lowpass', f0: 3000, f1: 200 });
        const chords = [[523, 659, 784], [587, 740, 880, 1175], [523, 659, 831, 1047, 1319], [587, 740, 880, 1175, 1480, 1760]];
        chords[tier].forEach((f, i) => { this.tone('triangle', f, f, 1.4, 0.09, { t: 0.02 + i * 0.05, verb: 0.8 }); this.tone('sine', f * 2, f * 2, 1.1, 0.03, { t: 0.08 + i * 0.05, verb: 0.9 }); });
        if (tier >= 2) this.tone('sine', 1568, 1568, 2, 0.06, { t: 0.4, verb: 1 });
        break;
      }
      case 'flip': this.hiss(0.07, 0.12, { f0: 1800, f1: 4000, q: 1.5 }); this.tone('triangle', 1200 + (o.i || 0) * 60, 1500, 0.06, 0.05); break;
      case 'flipHi': {
        const g = o.grade || 0;
        this.tone('sine', 70, 40, 0.6, 0.45, {});
        [784, 988, 1175, 1568].slice(0, 2 + Math.min(2, Math.floor(g / 4))).forEach((f, i) => this.tone('triangle', f, f, 0.9, 0.08, { t: i * 0.06, verb: 0.8 }));
        this.hiss(0.5, 0.1, { type: 'highpass', f0: 5000, attack: 0.02, verb: 0.6 });
        break;
      }
      case 'spot': [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this.tone('triangle', f, f, 0.6 + i * 0.1, 0.1, { t: i * 0.09, verb: 0.8 })); this.tone('sine', 65, 65, 1.6, 0.3, { attack: 0.1 }); break;
      case 'title': this.tone('sine', 98, 98, 2.2, 0.3, { attack: 0.3, verb: 0.6 }); [392, 587, 784].forEach((f, i) => this.tone('triangle', f, f, 1.6, 0.08, { t: 0.1 + i * 0.12, verb: 0.8 })); break;
      case 'swell': this.hiss(1.2, 0.1, { f0: 200, f1: 2500, attack: 1 }); this.tone('sine', 196, 196, 1.4, 0.12, { attack: 0.8, verb: 0.8 }); this.tone('sine', 293, 293, 1.4, 0.08, { attack: 0.9, verb: 0.8 }); break;
      case 'chime': this.tone('sine', 1318, 1318, 0.8, 0.06, { verb: 0.9 }); this.tone('sine', 1975, 1975, 0.6, 0.04, { t: 0.08, verb: 0.9 }); break;
      case 'sprout': this.tone('sine', 520, 1040, 0.18, 0.06, { pan, verb: 0.5 }); this.hiss(0.12, 0.05, { f0: 2500, f1: 4000, q: 2, pan }); break;
      case 'travel': this.hiss(1.1, 0.12, { f0: 300, f1: 1800, attack: 0.5 }); this.tone('sine', 110, 82, 1.2, 0.18, { attack: 0.3, verb: 0.6 }); break;
      case 'discover':
        this.tone('sine', 98, 98, 2.4, 0.25, { attack: 0.2, verb: 0.7 });
        [587, 740, 880, 1175, 1480].forEach((f, i) => this.tone('triangle', f, f, 1.5, 0.08, { t: 0.15 + i * 0.13, verb: 0.9 }));
        break;
      case 'unlock':
        this.tone('sine', 60, 35, 1.2, 0.7, {}); this.hiss(1.0, 0.35, { type: 'lowpass', f0: 1200, f1: 100 });
        [392, 494, 587, 784].forEach((f, i) => this.tone('triangle', f, f, 1.2, 0.09, { t: 0.5 + i * 0.1, verb: 0.8 }));
        break;
      case 'mill': this.hiss(0.25, 0.08, { f0: 2500, f1: 3200, q: 8, pan }); break;
      default: break;
    }
  }

  // ── ambience: wind and creek beds, birdsong and crickets on random timers ──
  startAmbience() {
    const c = this.ctx;
    const bed = (type, f, q, vol, lfo) => {
      const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
      const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = c.createGain(); g.gain.value = vol;
      const l = c.createOscillator(); l.frequency.value = lfo; const lg = c.createGain(); lg.gain.value = f * 0.35;
      l.connect(lg).connect(fl.frequency); l.start();
      s.connect(fl).connect(g).connect(this.amb); s.start();
      return g;
    };
    this.windBed = bed('lowpass', 520, 0.7, 0.16, 0.07);
    this.creekBed = bed('bandpass', 2200, 0.6, this.mood === 'sunveil' ? 0.015 : 0.05, 0.4);
    const birds = () => {
      if (this.night < 0.5) this.birdCall();
      setTimeout(birds, 2500 + Math.random() * 6000);
    };
    setTimeout(birds, 1500);
    const night = () => {
      if (this.night > 0.5) {
        const pan = Math.random() * 2 - 1;
        for (let i = 0; i < 6; i++) this.tone('sine', 4200, 4200, 0.03, 0.025, { bus: this.amb, t: i * 0.06, pan });
        if (Math.random() < 0.15) { this.tone('sine', 380, 340, 0.4, 0.08, { bus: this.amb, attack: 0.08, verb: 0.6, pan }); this.tone('sine', 360, 320, 0.5, 0.07, { bus: this.amb, t: 0.6, attack: 0.08, verb: 0.6, pan }); }
      }
      setTimeout(night, 900 + Math.random() * 1600);
    };
    setTimeout(night, 1000);
  }

  birdCall() {
    const pan = Math.random() * 1.6 - 0.8;
    const base = 2200 + Math.random() * 1600;
    const n = 2 + Math.floor(Math.random() * 4);
    const vol = 0.03 + Math.random() * 0.04;
    for (let i = 0; i < n; i++) this.tone('sine', base * (1 + Math.random() * 0.2), base * (0.7 + Math.random() * 0.6), 0.06 + Math.random() * 0.06, vol, { bus: this.amb, t: i * (0.09 + Math.random() * 0.05), pan, verb: 0.4 });
  }

  setNight(n) { this.night = n; }

  // Region mood: the valley plays cool D dorian; Sunveil plays warm G lydian, a little quicker.
  setMood(m) {
    this.mood = m;
    if (this.creekBed && this.ctx) this.creekBed.gain.setTargetAtTime(m === 'sunveil' ? 0.015 : 0.05, this.ctx.currentTime, 1);
  }

  // ── generative music: cool modal pads (D dorian) with a sparse plucked melody ──
  startMusic() {
    const c = this.ctx;
    const MOODS = {
      valley: {
        chords: [[146.8, 220, 261.6, 329.6], [130.8, 196, 246.9, 329.6], [116.5, 174.6, 220, 293.7], [130.8, 196, 261.6, 293.7]],
        scale: [293.7, 329.6, 349.2, 392, 440, 493.9, 523.3, 587.3, 659.3], beat: 60 / 68, rest: 0.45,
      },
      sunveil: {
        chords: [[196, 246.9, 293.7, 370], [220, 277.2, 329.6, 440], [164.8, 246.9, 293.7, 392], [146.8, 220, 277.2, 370]],
        scale: [392, 440, 493.9, 554.4, 587.3, 659.3, 740, 784, 880], beat: 60 / 76, rest: 0.35,
      },
    };
    let bar = 0;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    lp.connect(this.music);
    const pv = c.createGain(); pv.gain.value = 0.5; lp.connect(pv).connect(this.verb);
    let next = c.currentTime + 0.5;
    const schedule = () => {
      while (next < c.currentTime + 2) {
        const { chords, scale, beat, rest } = MOODS[this.mood] || MOODS.valley;
        const ch = chords[bar % chords.length];
        for (const f of ch) {
          const o = c.createOscillator(), g = c.createGain();
          o.type = 'triangle'; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 8;
          g.gain.setValueAtTime(0.0001, next);
          g.gain.linearRampToValueAtTime(0.028, next + beat * 1.5);
          g.gain.linearRampToValueAtTime(0.0001, next + beat * 4.2);
          o.connect(g).connect(lp); o.start(next); o.stop(next + beat * 4.4);
        }
        // melody: a few notes per bar, rests are common
        for (let b = 0; b < 4; b++) {
          if (Math.random() < rest) continue;
          const f = scale[Math.floor(Math.random() * scale.length)];
          const t = next + b * beat + (Math.random() < 0.3 ? beat / 2 : 0);
          const o = c.createOscillator(), g = c.createGain();
          o.type = 'sine'; o.frequency.value = f * (this.night > 0.5 ? 0.5 : 1);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t + beat * 1.6);
          o.connect(g).connect(lp); o.start(t); o.stop(t + beat * 1.7);
        }
        next += beat * 4;
        bar++;
      }
      setTimeout(schedule, 500);
    };
    schedule();
  }
}
