import * as THREE from 'three';
import { atmo } from '../gfx/Atmosphere.js';

// Time of day drives the sun, moon, sky palette, fog and every light in the world.
// One in-game day lasts DAY_SECONDS real seconds.
export const DAY_SECONDS = 24 * 60;

// Palette keyed by sun elevation (sunDir.y). Colours are sRGB hex.
const KEYS = [
  { e: -0.35, zen: 0x040919, hor: 0x162142, fog: 0x141d35, sun: 0x000000, sunI: 0.0, hemi: 0.16, hemiSky: 0x3a4f8a, hemiGnd: 0x0e1418 },
  { e: -0.12, zen: 0x101c40, hor: 0x4a4670, fog: 0x3a3a58, sun: 0x000000, sunI: 0.0, hemi: 0.22, hemiSky: 0x5a5f9a, hemiGnd: 0x1a1d22 },
  { e: -0.02, zen: 0x2b437f, hor: 0xe58a62, fog: 0xa77f78, sun: 0xff7a3a, sunI: 0.6, hemi: 0.38, hemiSky: 0x8a86b0, hemiGnd: 0x3a3028 },
  { e: 0.06, zen: 0x3b64ad, hor: 0xf3b98a, fog: 0xd2b49c, sun: 0xffa45e, sunI: 1.9, hemi: 0.55, hemiSky: 0xa9b7d6, hemiGnd: 0x4f4a36 },
  { e: 0.2, zen: 0x3f74c6, hor: 0xe2dccb, fog: 0xc6d0d6, sun: 0xffd9a8, sunI: 2.7, hemi: 0.75, hemiSky: 0xb7cbe6, hemiGnd: 0x5c5f3e },
  { e: 0.45, zen: 0x3b7bd6, hor: 0xc4daef, fog: 0xb5cbe0, sun: 0xfff1de, sunI: 3.1, hemi: 0.85, hemiSky: 0xbcd3f0, hemiGnd: 0x5d6640 },
  { e: 1.0, zen: 0x3576d8, hor: 0xbcd6f0, fog: 0xaec6de, sun: 0xffffff, sunI: 3.3, hemi: 0.9, hemiSky: 0xc0d6f2, hemiGnd: 0x5d6640 },
];
const _a = new THREE.Color(), _b = new THREE.Color();

function samplePalette(e, field, out) {
  let i = 0;
  while (i < KEYS.length - 2 && e > KEYS[i + 1].e) i++;
  const k0 = KEYS[i], k1 = KEYS[i + 1];
  const t = THREE.MathUtils.clamp((e - k0.e) / (k1.e - k0.e), 0, 1);
  if (!out) return k0[field] + (k1[field] - k0[field]) * t; // scalar field
  _a.setHex(k0[field]); _b.setHex(k1[field]);
  return out.copy(_a).lerp(_b, t);
}

export class DayNight {
  constructor(scene, renderer) {
    this.time = 15.6; // hours: a warm mid-afternoon for the first view of the kingdom
    this.speed = 1;   // multiplier
    this.sunDir = new THREE.Vector3();
    this.moonDir = new THREE.Vector3();

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -110; sc.right = 110; sc.top = 110; sc.bottom = -110; sc.near = 1; sc.far = 900;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xbcd3f0, 0x5d6640, 0.8);
    scene.add(this.hemi);

    this.night = 0;
    this._c = new THREE.Color();
  }

  get hours() { return this.time; }

  // 0..1 progress through the day, used by NPC schedules and save files.
  setTime(h) { this.time = ((h % 24) + 24) % 24; }

  update(dt, focus) {
    this.time = (this.time + (dt * this.speed * 24) / DAY_SECONDS) % 24;
    const phi = ((this.time - 6) / 12) * Math.PI; // 6h east, 12h south, 18h west
    this.sunDir.set(Math.cos(phi), Math.sin(phi) * 0.86, Math.sin(phi) * 0.42 + 0.12).normalize();
    this.moonDir.set(-Math.cos(phi + 0.4), -Math.sin(phi + 0.4) * 0.8 + 0.15, -Math.sin(phi) * 0.3 - 0.3).normalize();

    const e = this.sunDir.y;
    atmo.uSunDir.value.copy(this.sunDir);
    samplePalette(e, 'zen', atmo.uZenith.value);
    samplePalette(e, 'hor', atmo.uHorizon.value);
    samplePalette(e, 'fog', atmo.uFogColor.value);
    samplePalette(e, 'sun', atmo.uSunColor.value);
    this.night = THREE.MathUtils.smoothstep(-e, -0.02, 0.22);
    atmo.uNight.value = this.night;

    // The key light is the sun by day and the moon by night.
    const sunI = samplePalette(e, 'sunI');
    const moonI = 0.42 * this.night;
    const useMoon = sunI < 0.25;
    const dir = useMoon ? this.moonDir : this.sunDir;
    if (useMoon) this.sun.color.setRGB(0.62, 0.72, 1.0); else this.sun.color.copy(atmo.uSunColor.value);
    this.sun.intensity = useMoon ? moonI : sunI;
    this.sun.position.copy(focus).addScaledVector(dir, 400);
    this.sun.target.position.copy(focus);
    // Snap the shadow camera to texels to stop shadow shimmering while walking.
    const texel = 220 / this.sun.shadow.mapSize.x;
    this.sun.target.position.x = Math.round(this.sun.target.position.x / texel) * texel;
    this.sun.target.position.z = Math.round(this.sun.target.position.z / texel) * texel;
    this.sun.position.x = this.sun.target.position.x + dir.x * 400;
    this.sun.position.z = this.sun.target.position.z + dir.z * 400;

    this.hemi.intensity = samplePalette(e, 'hemi');
    samplePalette(e, 'hemiSky', this.hemi.color);
    samplePalette(e, 'hemiGnd', this.hemi.groundColor);
  }

  label() {
    const h = Math.floor(this.time), m = Math.floor((this.time - h) * 60);
    const period = this.time < 5 ? '깊은 밤' : this.time < 7.5 ? '새벽' : this.time < 11 ? '아침'
      : this.time < 14 ? '한낮' : this.time < 17.5 ? '오후' : this.time < 19.5 ? '해질녘' : this.time < 22 ? '저녁' : '밤';
    return `${period} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
