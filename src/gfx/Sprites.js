import * as THREE from 'three';
import { look, glslCommon } from './Look.js';

// Instanced billboards. Every sprite is a vertical plane facing the (always north-looking)
// camera, anchored at its base. Static layers are built once; dynamic layers rewrite their
// instance buffers every frame (characters, birds, effects).

export const playerUniform = { value: new THREE.Vector3(0, -999, 0) };

const quad = (() => {
  const g = new THREE.PlaneGeometry(1, 1);
  g.translate(0, 0.5, 0);
  return g;
})();

function spriteMaterial(texture, { additive = false, cutout = true } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...look, uMap: { value: texture }, uPlayer: playerUniform },
    transparent: !cutout,
    depthWrite: cutout,
    alphaTest: cutout ? 0.5 : 0,
    alphaToCoverage: cutout,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: /* glsl */`
      attribute vec3 iPos;
      attribute vec2 iSize;
      attribute vec4 iUV;
      attribute vec4 iParam; // x sway, y emissive, z flip(±1), w brightness
      uniform float uTime, uWind;
      varying vec2 vUv;
      varying vec3 vP;
      varying vec2 vParam;
      void main(){
        vec3 wp = iPos + vec3(position.x * iSize.x * iParam.z, position.y * iSize.y, 0.0);
        float s = iParam.x * position.y * position.y;
        float ph = iPos.x * 0.37 + iPos.z * 0.21;
        wp.x += (sin(uTime * 1.6 + ph) * 0.6 + sin(uTime * 0.7 + ph * 0.5) * 0.4 + 0.3) * s * uWind;
        vUv = mix(iUV.xy, iUV.zw, uv);
        vP = wp;
        vParam = iParam.yw;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: /* glsl */`
      ${glslCommon}
      uniform sampler2D uMap;
      uniform vec3 uPlayer;
      varying vec2 vUv;
      varying vec3 vP;
      varying vec2 vParam;
      void main(){
        vec4 t = texture2D(uMap, vUv);
        ${cutout ? `// Anything standing between the camera and the player turns to a soft dither.
        vec2 pd = vec2(vP.x - uPlayer.x, (vP.y - uPlayer.y - 0.7) * 0.7);
        if (vP.z > uPlayer.z + 0.15 && length(pd) < 2.4 && vP.z < uPlayer.z + 30.0) {
          vec2 g = mod(floor(gl_FragCoord.xy), 2.0);
          if (g.x == g.y) discard;
        }` : ''}
        ${cutout ? 'if (t.a < 0.5) discard;' : 'if (t.a < 0.003) discard;'}
        vec3 col = t.rgb / max(t.a, 1e-3);
        ${cutout || additive ? 'col *= vParam.y;' : ''}
        ${additive ? 'col *= uGlow * vParam.x;' : 'col = col * mix(uLight, vec3(1.0), vParam.x);'}
        col = haze(col, length(vP - cameraPosition));
        gl_FragColor = vec4(col, ${cutout ? '1.0' : additive ? 't.a' : 't.a * vParam.y'});
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

export class SpriteLayer {
  constructor(texture, capacity, opts = {}) {
    this.capacity = capacity;
    this.count = 0;
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.getAttribute('position'));
    geo.setAttribute('uv', quad.getAttribute('uv'));
    this.pos = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.size = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2);
    this.uv = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    this.param = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    for (const a of [this.pos, this.size, this.uv, this.param]) a.setUsage(opts.dynamic ? THREE.DynamicDrawUsage : THREE.StaticDrawUsage);
    geo.setAttribute('iPos', this.pos);
    geo.setAttribute('iSize', this.size);
    geo.setAttribute('iUV', this.uv);
    geo.setAttribute('iParam', this.param);
    geo.instanceCount = 0;
    this.geometry = geo;
    this.mesh = new THREE.Mesh(geo, spriteMaterial(texture, opts));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = opts.renderOrder ?? 5;
  }

  // region: atlas region; ppm: pixels per metre of the painted sprite.
  add(region, x, y, z, ppm, o = {}) {
    if (this.count >= this.capacity) return -1;
    const i = this.count++;
    this.set(i, region, x, y, z, ppm, o);
    return i;
  }

  set(i, region, x, y, z, ppm, { sway = 0, emissive = 0, flip = 1, bright = 1, scale = 1, wscale = 1 } = {}) {
    this.pos.setXYZ(i, x, y, z);
    this.size.setXY(i, (region.w / ppm) * scale * wscale, (region.h / ppm) * scale);
    this.uv.setXYZW(i, region.uv[0], region.uv[1], region.uv[2], region.uv[3]);
    this.param.setXYZW(i, sway, emissive, flip, bright);
  }

  hide(i) { this.size.setXY(i, 0, 0); }

  commit() {
    this.geometry.instanceCount = this.count;
    for (const a of [this.pos, this.size, this.uv, this.param]) a.needsUpdate = true;
  }
}

// Soft ground shadows / decals: flat ellipses lying on the ground.
export class ShadowLayer {
  constructor(capacity) {
    this.capacity = capacity; this.count = 0;
    const g = new THREE.PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = g.index;
    geo.setAttribute('position', g.getAttribute('position'));
    geo.setAttribute('uv', g.getAttribute('uv'));
    this.data = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4); // x y z, alpha
    this.dim = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2);  // width, depth
    this.data.setUsage(THREE.DynamicDrawUsage); this.dim.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iData', this.data);
    geo.setAttribute('iDim', this.dim);
    this.geometry = geo;
    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: { ...look },
      transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      vertexShader: /* glsl */`
        attribute vec4 iData; attribute vec2 iDim;
        varying vec2 vUv; varying float vA;
        void main(){
          vUv = uv; vA = iData.w;
          vec3 wp = iData.xyz + vec3(position.x * iDim.x, 0.06, position.z * iDim.y);
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform float uNight;
        varying vec2 vUv; varying float vA;
        void main(){
          float d = length(vUv - 0.5) * 2.0;
          float a = smoothstep(1.0, 0.25, d) * vA * (1.0 - uNight * 0.6);
          gl_FragColor = vec4(0.08, 0.12, 0.2, a);
        }`,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
  }

  add(x, y, z, w, d, a = 0.3) {
    if (this.count >= this.capacity) return -1;
    const i = this.count++;
    this.set(i, x, y, z, w, d, a);
    return i;
  }

  set(i, x, y, z, w, d, a) { this.data.setXYZW(i, x, y, z, a); this.dim.setXY(i, w, d); }

  commit() { this.geometry.instanceCount = this.count; this.data.needsUpdate = true; this.dim.needsUpdate = true; }
}

// Routes sprites to one SpriteLayer per atlas page.
export class PagedSprites {
  constructor(scene, textures, capacity, opts = {}) {
    this.layers = textures.map((t) => {
      const l = new SpriteLayer(t, capacity, opts);
      scene.add(l.mesh);
      return l;
    });
  }

  add(region, x, y, z, ppm, o) {
    const l = this.layers[region.page];
    return { layer: l, i: l.add(region, x, y, z, ppm, o) };
  }

  commit() { for (const l of this.layers) l.commit(); }
}
