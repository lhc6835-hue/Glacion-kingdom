import * as THREE from 'three';
import { look, glslCommon } from '../gfx/Look.js';
import { Atlas } from '../gfx/Atlas.js';
import { SpriteLayer } from '../gfx/Sprites.js';
import { paintCloud, paintRange, paintBird } from '../art/sky.js';
import { hash2 } from './noise.js';

// The horizon panorama: sky dome, painted mountain ranges far beyond the map edge,
// drifting cumulus clouds and flocks of white birds. All of it is placed in world space
// so it parallaxes naturally as the player walks.

export const skyUniforms = {
  uZenith: { value: new THREE.Color(0.24, 0.48, 0.86) },
  uHorizon: { value: new THREE.Color(0.80, 0.88, 0.96) },
  uSunPos: { value: new THREE.Vector3(-0.7, 0.3, -0.6) },
  uSunCol: { value: new THREE.Color(1, 0.92, 0.75) },
  uMoonPos: { value: new THREE.Vector3(0.6, 0.4, -0.6) },
};

export class SkyView {
  constructor(scene, renderer) {
    this.scene = scene;
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20), new THREE.ShaderMaterial({
      uniforms: { ...look, ...skyUniforms },
      side: THREE.BackSide, depthWrite: false, depthTest: false,
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`
        ${glslCommon}
        uniform vec3 uZenith, uHorizon, uSunPos, uSunCol, uMoonPos;
        varying vec3 vDir;
        void main(){
          vec3 d = normalize(vDir);
          float up = clamp(d.y, 0.0, 1.0);
          vec3 col = mix(uHorizon, uZenith, pow(up, 0.5));
          col = mix(col, uHorizon * 1.06, exp(-up * 14.0) * 0.5);
          vec3 s = normalize(uSunPos);
          float sd = max(dot(d, s), 0.0);
          col += uSunCol * (pow(sd, 5.0) * 0.28 + pow(sd, 40.0) * 0.35);
          col = mix(col, vec3(1.0, 0.98, 0.9) * 1.4, smoothstep(0.9993, 0.9996, sd) * step(0.0, s.y));
          if (uNight > 0.02) {
            vec2 uv = vec2(atan(d.z, d.x) * 160.0, asin(clamp(d.y, -1.0, 1.0)) * 160.0);
            float h = hash12(floor(uv));
            float star = step(0.986, h) * smoothstep(0.35, 0.0, length(fract(uv) - 0.5)) * (0.6 + 0.4 * sin(uTime * (1.5 + h * 5.0) + h * 50.0));
            col += vec3(0.9, 0.93, 1.0) * star * uNight * smoothstep(0.02, 0.2, d.y) * 1.3;
            float md = max(dot(d, normalize(uMoonPos)), 0.0);
            col += vec3(0.9, 0.93, 1.0) * smoothstep(0.9990, 0.9994, md) * uNight * 1.5;
            col += vec3(0.4, 0.5, 0.8) * pow(md, 24.0) * 0.3 * uNight;
          }
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    this.dome.scale.setScalar(5500);
    this.dome.renderOrder = -100;
    this.dome.frustumCulled = false;
    scene.add(this.dome);

    // Painted panorama atlas.
    const atlas = new Atlas(4096, 2);
    const ranges = [
      atlas.add(paintRange(11, { peaks: 11, jag: 0.5, snow: 0.72, base: [0.52, 0.62, 0.58], shadow: [0.36, 0.46, 0.48] })),
      atlas.add(paintRange(12, { peaks: 8, jag: 0.6, snow: 0.55, base: [0.48, 0.56, 0.70], shadow: [0.30, 0.36, 0.54] })),
      atlas.add(paintRange(13, { peaks: 6, jag: 0.65, snow: 0.45, base: [0.56, 0.62, 0.78], shadow: [0.36, 0.42, 0.62] })),
      atlas.add(paintRange(14, { w: 1600, h: 800, peaks: 4, jag: 0.7, snow: 0.38, base: [0.60, 0.66, 0.82], shadow: [0.38, 0.44, 0.66] })),
    ];
    const clouds = [];
    for (let i = 0; i < 6; i++) clouds.push(atlas.add(paintCloud(40 + i, { w: 900, h: 400 + (i % 3) * 40 })));
    const birds = [atlas.add(paintBird(0)), atlas.add(paintBird(1))];
    const [tex] = atlas.textures(renderer);
    this.birdsReg = birds;

    // Mountains: cutout sprites (opaque), far to near so haze layers correctly.
    this.mountains = new SpriteLayer(tex, 64, { renderOrder: -50 });
    const range = (reg, x, z, wMetres, y = -20) => this.mountains.add(reg, x, y, z, reg.w / wMetres);
    // North: three layered ranges plus the Frostcrown massif behind the castle.
    for (let x = -4200; x <= 4200; x += 2600) range(ranges[2], x, -3400, 3000, -60);
    range(ranges[3], 650, -2900, 2300, -60);
    for (let x = -3600; x <= 3600; x += 2300) range(ranges[1], x + 400, -2300, 2500, -40);
    for (let x = -3000; x <= 3000; x += 1500) range(ranges[0], x, -1450, 1700, -30);
    // East and west flanks.
    for (let z = -1100; z <= 900; z += 700) { range(ranges[1], -2300, z, 2200, -40); range(ranges[1], 2300, z, 2200, -40); }
    for (let z = -900; z <= 1100; z += 650) { range(ranges[0], -1450, z, 1500, -30); range(ranges[0], 1450, z, 1500, -30); }
    this.mountains.commit();
    scene.add(this.mountains.mesh);

    // Clouds: soft, transparent, drifting.
    this.clouds = new SpriteLayer(tex, 64, { cutout: false, renderOrder: -40, dynamic: true });
    this.cloudData = [];
    for (let i = 0; i < 26; i++) {
      const h = (k) => hash2(i, k, 21);
      this.cloudData.push({
        reg: clouds[i % clouds.length], x: -3000 + h(1) * 6000, z: -900 - h(2) * 2600, y: 220 + h(3) * 520,
        w: 320 + h(4) * 520, speed: 2 + h(5) * 4,
      });
    }
    for (const c of this.cloudData) this.clouds.add(c.reg, c.x, c.y, c.z, c.reg.w / c.w, { bright: 1 });
    this.clouds.commit();
    scene.add(this.clouds.mesh);

    // Birds: small flocks wheeling above the lake, the falls and the castle.
    this.birdLayer = new SpriteLayer(tex, 160, { cutout: false, renderOrder: 8, dynamic: true });
    this.birds = [];
    const centres = [[60, 90, 40], [380, 150, -280], [-100, 100, -110], [-300, 80, 250], [200, 130, -100]];
    for (const [cx, cy, cz] of centres) {
      for (let k = 0; k < 14; k++) {
        const h = (q) => hash2(cx + k * 7, cz + q, 3);
        this.birds.push({ cx, cy, cz, r: 20 + h(1) * 70, a: h(2) * 6.28, s: (0.15 + h(3) * 0.2) * (h(4) < 0.5 ? 1 : -1), y: h(5) * 30, ph: h(6) * 6 });
        this.birdLayer.add(birds[0], cx, cy, cz, 24 / 1.0);
      }
    }
    this.birdLayer.commit();
    scene.add(this.birdLayer.mesh);
  }

  update(dt, t, camera) {
    this.dome.position.copy(camera.position);
    for (let i = 0; i < this.cloudData.length; i++) {
      const c = this.cloudData[i];
      c.x += c.speed * dt;
      if (c.x > camera.position.x + 3200) c.x -= 6400;
      if (c.x < camera.position.x - 3200) c.x += 6400;
      this.clouds.pos.setXYZ(i, c.x, c.y, c.z);
    }
    this.clouds.pos.needsUpdate = true;
    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i];
      b.a += b.s * dt;
      const flap = Math.sin(t * 9 + b.ph) > 0 ? 0 : 1;
      const x = b.cx + Math.cos(b.a) * b.r, z = b.cz + Math.sin(b.a) * b.r * 0.5;
      const y = b.cy + b.y + Math.sin(t * 0.7 + b.ph) * 6;
      // Wingspan ~1 m drawn a little larger so the flocks read from afar.
      this.birdLayer.set(i, this.birdsReg[flap], x, y, z, 24 / 1.6, { flip: b.s > 0 ? 1 : -1, emissive: 0.6 });
    }
    this.birdLayer.commit();
  }
}
