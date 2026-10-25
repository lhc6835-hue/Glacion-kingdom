// Procedural sound: there are no audio files. Wind, water, birdsong, crickets and a small
// generative harp-and-pad score are synthesised live with the Web Audio API.

const SCALES = {
  field: { root: 62, steps: [0, 2, 4, 7, 9, 12, 14, 16], tempo: 0.52, pad: [0, 7, 16] },     // D major pentatonic
  town: { root: 67, steps: [0, 2, 4, 5, 7, 9, 11, 12], tempo: 0.42, pad: [0, 4, 7] },        // G major, livelier
  night: { root: 57, steps: [0, 3, 5, 7, 10, 12, 15], tempo: 0.8, pad: [0, 7, 15] },         // A minor pentatonic, slow
  high: { root: 64, steps: [0, 2, 7, 9, 12, 14, 19], tempo: 0.7, pad: [0, 7, 14] },           // open fifths on the heights
};
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Audio {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.mode = 'field';
    this.nextNote = 0;
    this.step = 0;
    this.phrase = [];
  }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(ctx.destination);
    this.music = ctx.createGain(); this.music.gain.value = this.settings.music * 0.5; this.music.connect(this.master);
    this.sfx = ctx.createGain(); this.sfx.gain.value = this.settings.sfx; this.sfx.connect(this.master);
    // Simple reverb from a decaying noise impulse.
    const ir = ctx.createBuffer(2, ctx.sampleRate * 2.4, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3); }
    this.verb = ctx.createConvolver(); this.verb.buffer = ir;
    const vg = ctx.createGain(); vg.gain.value = 0.35; this.verb.connect(vg); vg.connect(this.master);

    const noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const loopNoise = () => { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.start(); return s; };

    // Wind.
    this.windF = ctx.createBiquadFilter(); this.windF.type = 'lowpass'; this.windF.frequency.value = 500;
    this.windG = ctx.createGain(); this.windG.gain.value = 0.04;
    loopNoise().connect(this.windF); this.windF.connect(this.windG); this.windG.connect(this.sfx);
    // Water.
    this.waterF = ctx.createBiquadFilter(); this.waterF.type = 'bandpass'; this.waterF.frequency.value = 900; this.waterF.Q.value = 0.5;
    this.waterG = ctx.createGain(); this.waterG.gain.value = 0;
    loopNoise().connect(this.waterF); this.waterF.connect(this.waterG); this.waterG.connect(this.sfx);
    this.waterLow = ctx.createBiquadFilter(); this.waterLow.type = 'lowpass'; this.waterLow.frequency.value = 220;
    this.waterLowG = ctx.createGain(); this.waterLowG.gain.value = 0;
    loopNoise().connect(this.waterLow); this.waterLow.connect(this.waterLowG); this.waterLowG.connect(this.sfx);
    this.nextNote = ctx.currentTime + 1.0;
    this.nextBird = ctx.currentTime + 2;
    this.nextCricket = ctx.currentTime + 1;
  }

  setVolumes() {
    if (!this.ctx) return;
    this.music.gain.setTargetAtTime(this.settings.music * 0.5, this.ctx.currentTime, 0.3);
    this.sfx.gain.setTargetAtTime(this.settings.sfx, this.ctx.currentTime, 0.3);
  }

  // env: { water: 0..1 nearness to falling water, height, night, town, birds }
  update(env) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    this.windG.gain.setTargetAtTime(0.025 + Math.min(0.09, env.height * 0.0012) + env.gliding * 0.06, t, 0.5);
    this.windF.frequency.setTargetAtTime(380 + Math.sin(t * 0.21) * 160 + env.gliding * 500, t, 0.4);
    this.waterG.gain.setTargetAtTime(env.water * 0.22, t, 0.3);
    this.waterLowG.gain.setTargetAtTime(env.water * 0.35, t, 0.3);
    const mode = env.night ? 'night' : env.town ? 'town' : env.height > 45 ? 'high' : 'field';
    if (mode !== this.mode) { this.mode = mode; this.phrase = []; }

    // Generative score: a slowly evolving phrase on a harp, with a soft pad every few bars.
    const sc = SCALES[this.mode];
    while (this.nextNote < t + 0.2) {
      if (!this.phrase.length) this.phrase = makePhrase(sc);
      const n = this.phrase.shift();
      if (n !== null) this.pluck(mtof(sc.root + n), this.nextNote, 0.16);
      if (this.step % 16 === 0) this.pad(sc.pad.map((p) => mtof(sc.root - 12 + p)), this.nextNote, sc.tempo * 15);
      this.step++;
      this.nextNote += sc.tempo * (Math.random() < 0.12 ? 1.5 : 1);
    }
    if (!env.night && env.birds > 0.2 && t > this.nextBird) { this.chirp(t); this.nextBird = t + 0.8 + Math.random() * 4 / env.birds; }
    if (env.night && t > this.nextCricket) { this.cricket(t); this.nextCricket = t + 0.4 + Math.random() * 1.6; }
  }

  pluck(freq, when, vol) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = freq;
    o2.type = 'sine'; o2.frequency.value = freq * 2;
    const g2 = ctx.createGain(); g2.gain.value = 0.25;
    g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(vol, when + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, when + 2.2);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(this.music); g.connect(this.verb);
    o.start(when); o2.start(when); o.stop(when + 2.3); o2.stop(when + 2.3);
  }

  pad(freqs, when, dur) {
    const ctx = this.ctx;
    for (const f of freqs) {
      const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 12;
      lp.type = 'lowpass'; lp.frequency.value = 700;
      g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(0.018, when + dur * 0.35); g.gain.linearRampToValueAtTime(0, when + dur);
      o.connect(lp); lp.connect(g); g.connect(this.music); g.connect(this.verb);
      o.start(when); o.stop(when + dur + 0.1);
    }
  }

  chirp(t) {
    const ctx = this.ctx;
    const base = 2600 + Math.random() * 1800, n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain(), w = t + i * (0.07 + Math.random() * 0.05);
      o.type = 'sine';
      o.frequency.setValueAtTime(base, w); o.frequency.exponentialRampToValueAtTime(base * (0.7 + Math.random() * 0.7), w + 0.06);
      g.gain.setValueAtTime(0, w); g.gain.linearRampToValueAtTime(0.03, w + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, w + 0.08);
      o.connect(g); g.connect(this.sfx); g.connect(this.verb); o.start(w); o.stop(w + 0.1);
    }
  }

  cricket(t) {
    const ctx = this.ctx;
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain(), w = t + i * 0.05;
      o.frequency.value = 4400 + Math.random() * 300;
      g.gain.setValueAtTime(0, w); g.gain.linearRampToValueAtTime(0.008, w + 0.01); g.gain.linearRampToValueAtTime(0, w + 0.035);
      o.connect(g); g.connect(this.sfx); o.start(w); o.stop(w + 0.05);
    }
  }

  // Short UI / action sounds.
  play(name) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const tone = (f, d, v = 0.08, type = 'sine', at = 0) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0, t + at); g.gain.linearRampToValueAtTime(v, t + at + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + at + d);
      o.connect(g); g.connect(this.sfx); g.connect(this.verb); o.start(t + at); o.stop(t + at + d + 0.05);
    };
    if (name === 'jump') { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(380, t); o.frequency.exponentialRampToValueAtTime(760, t + 0.1); g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.14); o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + 0.16); }
    else if (name === 'pickup') { tone(988, 0.3, 0.07); tone(1319, 0.4, 0.06, 'sine', 0.08); }
    else if (name === 'talk') tone(660 + Math.random() * 80, 0.06, 0.04, 'triangle');
    else if (name === 'discover') [0, 4, 7, 12].forEach((s, i) => tone(mtof(72 + s), 1.2, 0.06, 'triangle', i * 0.12));
    else if (name === 'quest') { tone(784, 0.4, 0.06, 'triangle'); tone(1175, 0.6, 0.05, 'triangle', 0.12); }
    else if (name === 'open') tone(523, 0.15, 0.04, 'triangle');
  }
}

function makePhrase(sc) {
  // Stepwise motion with occasional leaps and rests; resolves toward the root.
  const out = [];
  let i = Math.floor(Math.random() * sc.steps.length);
  for (let k = 0; k < 8; k++) {
    if (Math.random() < 0.22) { out.push(null); continue; }
    i = Math.max(0, Math.min(sc.steps.length - 1, i + (Math.random() < 0.7 ? (Math.random() < 0.5 ? -1 : 1) : (Math.random() < 0.5 ? -2 : 2))));
    out.push(sc.steps[i]);
  }
  out.push(sc.steps[0], null, null, null);
  return out;
}
