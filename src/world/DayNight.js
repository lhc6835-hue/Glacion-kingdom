import * as THREE from 'three';
import { look } from '../gfx/Look.js';
import { skyUniforms } from './SkyView.js';

// Time of day for a painted world: instead of relighting geometry, the whole palette shifts —
// colour temperature, brightness, sky gradient and haze — and lamps and windows glow at night.
export const DAY_SECONDS = 24 * 60; // one in-game day = 24 real minutes

const KEYS = [
  // hour, light (multiplier), zenith, horizon, haze, sun colour, night, glow
  [0.0, [0.30, 0.36, 0.60], 0x050a1e, 0x1b2850, 0x1c2648, 0x000000, 1.0, 1.0],
  [4.6, [0.32, 0.38, 0.62], 0x081230, 0x26325c, 0x24305a, 0x000000, 1.0, 1.0],
  [5.6, [0.78, 0.66, 0.72], 0x34508f, 0xf0a888, 0xc8a0a0, 0xffa070, 0.4, 0.6],
  [6.8, [1.00, 0.90, 0.82], 0x4a7cc8, 0xf6d6b8, 0xdcd2cc, 0xffd0a0, 0.0, 0.0],
  [9.0, [1.00, 0.99, 0.96], 0x3b7fd8, 0xc8def2, 0xbfd6ec, 0xfff2d8, 0.0, 0.0],
  [13.0, [1.03, 1.02, 0.98], 0x3a7ddb, 0xc6ddf2, 0xbcd4ec, 0xffffff, 0.0, 0.0],
  [16.0, [1.05, 0.99, 0.90], 0x3f79cf, 0xdfe2e0, 0xd2d8de, 0xffe4b8, 0.0, 0.0],
  [18.0, [1.08, 0.86, 0.70], 0x4867ad, 0xf4b68a, 0xe2b898, 0xffb070, 0.0, 0.25],
  [19.0, [0.82, 0.60, 0.66], 0x2d3f7d, 0xe0806a, 0xa47a86, 0xff7040, 0.35, 0.7],
  [20.2, [0.40, 0.42, 0.66], 0x0e1838, 0x3a3a6a, 0x30345c, 0x000000, 0.9, 1.0],
  [24.0, [0.30, 0.36, 0.60], 0x050a1e, 0x1b2850, 0x1c2648, 0x000000, 1.0, 1.0],
];
const _a = new THREE.Color(), _b = new THREE.Color();

// The painter's key light: hour, colour, strength.
const KEY = [
  [0.0, 0x8ea6ee, 0.32], [4.8, 0x8ea6ee, 0.32], [5.8, 0xffb4a0, 0.7], [7.0, 0xffd79a, 0.9],
  [12.0, 0xfff0c8, 0.8], [16.0, 0xffd38a, 1.0], [18.2, 0xff9e58, 1.05], [19.3, 0xf08a8a, 0.7],
  [20.4, 0x8ea6ee, 0.35], [24.0, 0x8ea6ee, 0.32],
];

export class DayNight {
  constructor() {
    this.time = 15.3;
    this.speed = 1;
  }

  setTime(h) { this.time = ((h % 24) + 24) % 24; }

  update(dt) {
    this.time = (this.time + (dt * this.speed * 24) / DAY_SECONDS) % 24;
    const h = this.time;
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1][0] <= h) i++;
    const k0 = KEYS[i], k1 = KEYS[i + 1];
    const t = (h - k0[0]) / (k1[0] - k0[0]);
    const s = t * t * (3 - 2 * t);
    const L = k0[1].map((v, j) => v + (k1[1][j] - v) * s);
    look.uLight.value.setRGB(L[0], L[1], L[2]);
    const col = (idx, out) => { _a.setHex(k0[idx]); _b.setHex(k1[idx]); return out.copy(_a).lerp(_b, s); };
    col(2, skyUniforms.uZenith.value);
    col(3, skyUniforms.uHorizon.value);
    col(4, look.uHaze.value);
    col(5, skyUniforms.uSunCol.value);
    look.uNight.value = k0[6] + (k1[6] - k0[6]) * s;
    look.uGlow.value = k0[7] + (k1[7] - k0[7]) * s;
    look.uShadow.value.setRGB(0.55, 0.62, 0.8).lerp(new THREE.Color(0.35, 0.4, 0.7), look.uNight.value);

    let ki = 0;
    while (ki < KEY.length - 2 && KEY[ki + 1][0] <= h) ki++;
    const q0 = KEY[ki], q1 = KEY[ki + 1];
    const kt = (h - q0[0]) / (q1[0] - q0[0]), ks = kt * kt * (3 - 2 * kt);
    _a.setHex(q0[1]); _b.setHex(q1[1]);
    look.uKey.value.copy(_a).lerp(_b, ks);
    look.uKeyStrength.value = q0[2] + (q1[2] - q0[2]) * ks;

    // Sun: rises in the east (right), passes behind the viewer at noon (south), sets in the west (left).
    const phi = ((h - 6) / 12) * Math.PI;
    skyUniforms.uSunPos.value.set(Math.cos(phi), Math.sin(phi) * 0.9, Math.sin(phi) * 0.6 - 0.25).normalize();
    skyUniforms.uMoonPos.value.set(-Math.cos(phi) * 0.8, 0.35 + Math.max(0, -Math.sin(phi)) * 0.4, -0.7).normalize();
  }

  label() {
    const h = Math.floor(this.time), m = Math.floor((this.time - h) * 60);
    const p = this.time < 5 ? '깊은 밤' : this.time < 7 ? '새벽' : this.time < 11 ? '아침' : this.time < 14 ? '한낮'
      : this.time < 17.5 ? '오후' : this.time < 19.5 ? '해질녘' : this.time < 22 ? '저녁' : '밤';
    return `${p} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
