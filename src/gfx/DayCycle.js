// Time of day. Keyframes hold the sky, haze, light and grading colours; values in between blend.
import { rgb } from './PixBuf.js';
import { DAY } from '../data/balance.js';

// h: hour. top/mid/hor: sky gradient. haze: atmospheric tint for far layers. grade: multiply tint
// over the whole scene (cool shade). key: colour of sun/moon shafts. rays: shaft strength.
const KEYS = [
  { h: 0, top: '#060c18', mid: '#0e1a2c', hor: '#1a2a3a', haze: '#18283a', grade: '#5a6e9a', key: '#a8c8ff', rays: 0.35, fog: 0.35, night: 1, phase: '밤' },
  { h: 4.5, top: '#0a1424', mid: '#1a2a40', hor: '#2e4458', haze: '#23384a', grade: '#6a7ea0', key: '#a8c8ff', rays: 0.25, fog: 0.5, night: 0.9, phase: '밤' },
  { h: 6, top: '#2a4a66', mid: '#6a90a0', hor: '#e8c8a0', haze: '#7a9aa0', grade: '#a8b8c0', key: '#ffd0a0', rays: 0.9, fog: 0.75, night: 0.3, phase: '새벽' },
  { h: 8, top: '#3a6a84', mid: '#7aaab0', hor: '#d8e8c8', haze: '#86aaa8', grade: '#bccec8', key: '#ffe6b0', rays: 1, fog: 0.5, night: 0, phase: '오전' },
  { h: 12, top: '#3a7090', mid: '#80b4b8', hor: '#d0ecdc', haze: '#90b4b0', grade: '#c8d8d0', key: '#fff2c8', rays: 0.8, fog: 0.25, night: 0, phase: '정오' },
  { h: 15.5, top: '#3a6888', mid: '#82aeb0', hor: '#e8e0b8', haze: '#92aeaa', grade: '#c6d0c4', key: '#ffe0a0', rays: 0.95, fog: 0.3, night: 0, phase: '오후' },
  { h: 18, top: '#3a4a78', mid: '#b07a8a', hor: '#f0a868', haze: '#9a8a90', grade: '#c0a8a8', key: '#ffb070', rays: 1.1, fog: 0.45, night: 0.15, phase: '노을' },
  { h: 19.5, top: '#1a2248', mid: '#4a3a62', hor: '#a85a5a', haze: '#4a4a62', grade: '#8a7a9a', key: '#ff9a6a', rays: 0.5, fog: 0.5, night: 0.6, phase: '해질녘' },
  { h: 21, top: '#080e1c', mid: '#121e32', hor: '#22303e', haze: '#1c2c3c', grade: '#5e709a', key: '#a8c8ff', rays: 0.35, fog: 0.4, night: 1, phase: '밤' },
  { h: 24, top: '#060c18', mid: '#0e1a2c', hor: '#1a2a3a', haze: '#18283a', grade: '#5a6e9a', key: '#a8c8ff', rays: 0.35, fog: 0.35, night: 1, phase: '밤' },
];

const COLORS = ['top', 'mid', 'hor', 'haze', 'grade', 'key'];
const NUMS = ['rays', 'fog', 'night'];

function lerpHex(a, b, t) {
  const A = rgb(a), B = rgb(b);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
}

export class DayCycle {
  constructor(hour = DAY.startHour) {
    this.hour = hour;
    this.flow = 1;
    this.cur = {};
    this.sample();
  }

  update(dt) {
    this.hour = (this.hour + (dt * this.flow * 24) / (DAY.minutesPerDay * 60)) % 24;
    this.sample();
  }

  set(h) { this.hour = ((h % 24) + 24) % 24; this.sample(); }

  sample() {
    const h = this.hour;
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = (h - a.h) / (b.h - a.h);
    for (const k of COLORS) this.cur[k] = lerpHex(a[k], b[k], t);
    for (const k of NUMS) this.cur[k] = a[k] + (b[k] - a[k]) * t;
    this.cur.phase = t < 0.5 ? a.phase : b.phase;
    // Sun arc 6h→18h left to right; moon on the opposite arc.
    const day = (h - 6) / 12;
    this.cur.isDay = h >= 6 && h < 19;
    const arc = this.cur.isDay ? day : ((h - 18 + 24) % 24) / 12; // moon: 18h → 6h
    this.cur.sunX = arc;
    this.cur.sunH = Math.sin(Math.max(0, Math.min(1, arc)) * Math.PI);
    // Shaft slant: from the upper left in the morning to the upper right in the evening.
    this.cur.slant = (arc - 0.5) * 1.1;
  }

  get isDay() { return this.cur.isDay; }
  label() {
    const hh = Math.floor(this.hour), mm = Math.floor((this.hour - hh) * 60);
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }
}
