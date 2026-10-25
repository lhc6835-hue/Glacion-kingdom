import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { look } from './Look.js';

// The painter's light. Whatever the hour, a key light pours in from the upper left as in the
// reference painting: crepuscular rays leaking through gaps in trees and towers, a soft glow
// around bright things, a warm wash from the light's corner and cool blue in the shadows.
const LightShader = {
  uniforms: {
    tDiffuse: { value: null },
    uKey: look.uKey,
    uKeyStrength: look.uKeyStrength,
    uNight: look.uNight,
    uTime: look.uTime,
    uSource: { value: new THREE.Vector2(-0.08, 1.12) }, // just off the top-left corner
    uAspect: { value: 16 / 9 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform vec3 uKey;
    uniform float uKeyStrength, uNight, uTime, uAspect;
    uniform vec2 uSource;
    varying vec2 vUv;
    float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      vec2 toSrc = uSource - vUv;
      vec2 aspectV = vec2(toSrc.x * uAspect, toSrc.y);
      float dist = length(aspectV);

      // Crepuscular rays: march toward the light, gathering only bright sky and cloud,
      // so trees, cliffs and towers cut the light into shafts.
      const int STEPS = 28;
      vec2 stepV = toSrc / float(STEPS) * 0.92;
      vec2 p = vUv + stepV * hash(vUv * 917.0 + uTime); // jitter hides banding
      float decay = 1.0, acc = 0.0;
      for (int i = 0; i < STEPS; i++) {
        p += stepV;
        vec3 s = texture2D(tDiffuse, clamp(p, 0.001, 0.999)).rgb;
        float b = smoothstep(0.62, 0.95, lum(s)) * step(0.35, p.y); // sky lives in the upper part
        acc += b * decay;
        decay *= 0.955;
      }
      acc /= float(STEPS);
      // Painted beams: slow, soft streaks fanning out from the light.
      float ang = atan(aspectV.y, aspectV.x);
      float beams = 0.55 + 0.45 * sin(ang * 38.0 + sin(ang * 13.0 + uTime * 0.05) * 2.0 + uTime * 0.03);
      beams *= 0.6 + 0.4 * sin(ang * 91.0 - uTime * 0.04);
      float fall = exp(-dist * 1.15);
      vec3 rays = uKey * (acc * 1.7 * (0.55 + 0.45 * beams) + beams * fall * 0.10) * uKeyStrength;
      col = 1.0 - (1.0 - col) * (1.0 - clamp(rays, 0.0, 1.0)); // screen blend

      // Warm wash spreading from the light's corner; cooler toward the far corner.
      float wash = exp(-dist * 1.6) * uKeyStrength;
      col *= mix(vec3(1.0), uKey * 1.12, wash * 0.45);
      col = mix(col, col * vec3(0.90, 0.95, 1.08), smoothstep(0.6, 1.5, dist) * 0.35);

      // Split toning: golden highlights, blue-violet shadows.
      float L = lum(col);
      col = mix(col, col * vec3(0.86, 0.92, 1.12), (1.0 - smoothstep(0.0, 0.45, L)) * 0.35);
      col = mix(col, col * mix(vec3(1.0), uKey, 0.35) * 1.04, smoothstep(0.5, 1.0, L) * 0.4 * (1.0 - uNight * 0.5));
      // Gentle storybook vignette.
      vec2 vq = vUv - 0.5;
      col *= 1.0 - dot(vq * vec2(0.9, 1.1), vq * vec2(0.9, 1.1)) * 0.38;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export class Post {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    const size = renderer.getSize(new THREE.Vector2());
    const pr = renderer.getPixelRatio();
    const rt = new THREE.WebGLRenderTarget(size.x * pr, size.y * pr, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.32, 0.55, 0.82);
    this.composer.addPass(this.bloom);
    this.light = new ShaderPass(LightShader);
    this.composer.addPass(this.light);
    this.composer.addPass(new OutputPass());
    this.resize(size.x, size.y);
  }

  resize(w, h) {
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.light.uniforms.uAspect.value = w / h;
  }

  render() {
    // Stronger bloom at night so windows, lamps and fireflies glow.
    this.bloom.strength = 0.28 + look.uNight.value * 0.5;
    this.bloom.threshold = 0.82 - look.uNight.value * 0.35;
    this.composer.render();
  }
}
