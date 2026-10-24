import * as THREE from 'three';
import { atmo, noiseGLSL } from '../gfx/Atmosphere.js';

// Painterly sky dome: a gradient driven by the time-of-day palette, a soft sun with a wide
// Mie glow, a moon, and a twinkling star field that fades in after dusk.
export class Sky {
  constructor(scene) {
    this.uniforms = {
      ...atmo,
      uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
      uGround: { value: new THREE.Color(0.32, 0.36, 0.34) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main(){
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww; // always at the far plane
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uSunDir, uSunColor, uHorizon, uZenith, uMoonDir, uGround, uFogColor;
        uniform float uNight, uTime;
        varying vec3 vDir;
        ${noiseGLSL}
        void main(){
          vec3 d = normalize(vDir);
          float y = d.y;
          float up = clamp(y, 0.0, 1.0);
          vec3 col = mix(uHorizon, uZenith, pow(up, 0.55));
          // A brighter band just above the horizon, as in hazy summer skies.
          col = mix(col, uHorizon * 1.08, exp(-up * 18.0) * 0.6);
          // Below the horizon: blend into the far haze (hidden by terrain almost everywhere).
          col = mix(col, uFogColor * 0.9, smoothstep(0.0, -0.15, y));

          float sd = max(dot(d, uSunDir), 0.0);
          float sunVis = smoothstep(-0.12, 0.05, uSunDir.y);
          col += uSunColor * (pow(sd, 6.0) * 0.22 + pow(sd, 64.0) * 0.5) * sunVis;
          col += uSunColor * smoothstep(0.99955, 0.99975, sd) * 6.0 * sunVis;

          // Night: stars and moon.
          if (uNight > 0.01) {
            float star = 0.0;
            vec2 uv = vec2(atan(d.z, d.x) * 180.0, asin(clamp(y,-1.0,1.0)) * 180.0);
            vec2 g = floor(uv);
            vec2 f = fract(uv) - 0.5;
            float h = hash12(g);
            if (h > 0.985) {
              float tw = 0.6 + 0.4 * sin(uTime * (2.0 + h * 6.0) + h * 40.0);
              star = smoothstep(0.22, 0.0, length(f)) * tw * (h - 0.985) * 66.0;
            }
            // A faint milky band.
            float band = exp(-pow(dot(d, normalize(vec3(0.3, 0.5, -0.8))), 2.0) * 9.0);
            col += vec3(0.55, 0.6, 0.9) * band * 0.05 * (0.6 + 0.4 * fbm2(uv * 0.02)) * uNight;
            col += vec3(0.9, 0.93, 1.0) * star * uNight * smoothstep(0.0, 0.15, y);
            float md = max(dot(d, uMoonDir), 0.0);
            col += vec3(0.85, 0.9, 1.0) * smoothstep(0.99935, 0.9996, md) * 1.8 * uNight;
            col += vec3(0.35, 0.45, 0.7) * pow(md, 30.0) * 0.25 * uNight;
          }
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), mat);
    this.mesh.scale.setScalar(9000);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
    scene.add(this.mesh);
  }

  update(camera) {
    this.mesh.position.copy(camera.position);
  }
}
