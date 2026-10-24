import * as THREE from 'three';
import { atmo, fogParsFragment, noiseGLSL } from '../gfx/Atmosphere.js';
import { heightAt, riverPaths } from './Heightfield.js';
import { LAKE, LAKE_LEVEL } from './WorldLayout.js';
import { smoothPath } from './Polyline.js';

// Lake, rivers and waterfalls share one water shader. Depth is baked per vertex from the
// heightfield; flow direction and steepness come from the river ribbons, so a waterfall
// is simply a steep stretch of river that the shader renders as falling, foaming water.

const waterVertex = /* glsl */`
  attribute float aDepth;
  attribute float aFlow;
  attribute float aSteep;
  attribute float aFade;
  attribute vec2 aAcross;
  varying float vDepth, vFlow, vSteep, vFade;
  varying vec2 vAcross;
  varying vec3 vAtmoWorldPos;
  void main(){
    vDepth = aDepth; vFlow = aFlow; vSteep = aSteep; vFade = aFade; vAcross = aAcross;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vAtmoWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

const waterFragment = /* glsl */`
  uniform float uTime;
  uniform vec3 uZenith, uHorizon;
  uniform float uNight;
  uniform float uIsRiver;
  varying float vDepth, vFlow, vSteep, vFade;
  varying vec2 vAcross;
  ${fogParsFragment}
  ${noiseGLSL}
  vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }

  float waveH(vec2 p, float t){
    return snoise(p * 0.08 + vec2(t * 0.05, t * 0.03)) * 0.5
         + snoise(p * 0.23 - vec2(t * 0.09, -t * 0.06)) * 0.28
         + snoise(p * 0.71 + vec2(-t * 0.16, t * 0.12)) * 0.12;
  }

  void main(){
    vec3 P = vAtmoWorldPos;
    float t = uTime;
    vec2 q = P.xz;
    // Rivers: waves advect along the flow coordinate instead of drifting.
    if (uIsRiver > 0.5) q = vec2(vAcross.x * 6.0, vFlow - t * (2.0 + vSteep * 14.0));
    float e = 0.35;
    float h0 = waveH(q, t), hx = waveH(q + vec2(e, 0.0), t), hz = waveH(q + vec2(0.0, e), t);
    float camDist = length(cameraPosition - P);
    // Fade wave detail with distance so far water does not sparkle with aliasing.
    float amp = (0.55 + vSteep * 1.5) / (1.0 + camDist * 0.006);
    vec3 n = normalize(vec3((h0 - hx) * amp, e, (h0 - hz) * amp));
    vec3 V = normalize(cameraPosition - P);
    float NdV = max(dot(n, V), 0.0);
    float fres = 0.03 + 0.97 * pow(1.0 - NdV, 5.0);

    vec3 R = reflect(-V, n);
    R.y = abs(R.y);
    vec3 skyR = mix(uHorizon, uZenith, pow(clamp(R.y, 0.0, 1.0), 0.6));
    float sunSpec = pow(max(dot(R, uSunDir), 0.0), 420.0) * 9.0 + pow(max(dot(R, uSunDir), 0.0), 40.0) * 0.25;
    sunSpec *= smoothstep(-0.05, 0.08, uSunDir.y);

    float depth = max(vDepth, 0.0);
    vec3 shallow = lin(vec3(0.33, 0.72, 0.70));
    vec3 mid = lin(vec3(0.12, 0.47, 0.58));
    vec3 deep = lin(vec3(0.05, 0.20, 0.36));
    vec3 body = mix(shallow, mid, smoothstep(0.3, 4.0, depth));
    body = mix(body, deep, smoothstep(4.0, 18.0, depth));
    // Light reaching into the water: sun-lit body brightens, night water is deep blue-black.
    float lightAmt = clamp(uSunDir.y * 1.6 + 0.35, 0.08, 1.0);
    body *= mix(vec3(0.25, 0.32, 0.55), uSunColor * 0.9 + 0.25, lightAmt);
    // Caustic shimmer in the shallows.
    float caust = pow(abs(snoise(P.xz * 0.6 + t * 0.4) + snoise(P.xz * 1.1 - t * 0.3)) , 3.0);
    body += uSunColor * caust * 0.08 * (1.0 - smoothstep(0.2, 3.0, depth)) * lightAmt;

    vec3 col = mix(body, skyR, fres * 0.85);
    col += uSunColor * sunSpec;

    // Foam: shoreline lapping, river rapids, and the white body of waterfalls.
    float shoreFoam = (1.0 - smoothstep(0.0, 0.7, depth)) * smoothstep(0.1, 0.6, snoise(P.xz * 0.9 + t * 0.6) * 0.5 + 0.5 + 0.3 * sin(t * 1.3 + P.x * 0.2));
    float rapid = smoothstep(0.08, 0.5, vSteep) * (0.55 + 0.45 * snoise(vec2(vAcross.x * 5.0, vFlow * 0.25 - t * 6.0)));
    float fall = smoothstep(0.45, 0.9, vSteep);
    float streak = smoothstep(0.1, 0.9, snoise(vec2(vAcross.x * 14.0, vFlow * 0.06 - t * 2.6)) * 0.5 + 0.5);
    float edge = 1.0 - smoothstep(0.55, 1.0, abs(vAcross.x));
    float foam = clamp(shoreFoam * 0.8 + rapid * 0.7 + fall * (0.55 + 0.45 * streak), 0.0, 1.0);
    vec3 foamCol = mix(vec3(0.55, 0.62, 0.72), vec3(1.0), lightAmt) * (0.75 + 0.25 * uSunColor);
    col = mix(col, foamCol, foam);

    float alpha = mix(0.55, 0.96, smoothstep(0.0, 2.2, depth));
    alpha = max(alpha, foam);
    alpha *= vFade;
    if (uIsRiver > 0.5) alpha *= mix(1.0, edge, fall * 0.6 + 0.2);

    gl_FragColor = vec4(applyAtmosphere(col, P), alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

function makeMaterial(isRiver) {
  return new THREE.ShaderMaterial({
    uniforms: { ...atmo, uIsRiver: { value: isRiver ? 1 : 0 } },
    vertexShader: waterVertex,
    fragmentShader: waterFragment,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export class Water {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'water';
    scene.add(this.group);
    this.lake = this.buildLake();
    this.group.add(this.lake);
    this.falls = [];
    this.riverMat = makeMaterial(true);
    for (const r of riverPaths) this.group.add(this.buildRiver(r));
  }

  buildLake() {
    // A polar grid shaped like the lake so the vertices concentrate where the water is.
    const rings = 70, spokes = 160, maxR = 1.32;
    const pos = [], depth = [], flow = [], steep = [], fade = [], across = [];
    const idx = [];
    const c = Math.cos(-LAKE.rot), s = Math.sin(-LAKE.rot);
    for (let i = 0; i <= rings; i++) {
      const rr = (i / rings) ** 0.8 * maxR;
      for (let j = 0; j < spokes; j++) {
        const a = (j / spokes) * Math.PI * 2;
        let dx = Math.cos(a) * LAKE.rx * rr, dz = Math.sin(a) * LAKE.rz * rr;
        const x = LAKE.x + dx * c - dz * s, z = LAKE.z + dx * s + dz * c;
        pos.push(x, LAKE_LEVEL, z);
        depth.push(LAKE_LEVEL - heightAt(x, z));
        flow.push(0); steep.push(0); across.push(0, 0);
        fade.push(i === rings ? 0 : 1);
      }
    }
    for (let i = 0; i < rings; i++) for (let j = 0; j < spokes; j++) {
      const a = i * spokes + j, b = i * spokes + ((j + 1) % spokes);
      const cc = a + spokes, d = b + spokes;
      idx.push(a, cc, b, b, cc, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aDepth', new THREE.Float32BufferAttribute(depth, 1));
    geo.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 1));
    geo.setAttribute('aSteep', new THREE.Float32BufferAttribute(steep, 1));
    geo.setAttribute('aFade', new THREE.Float32BufferAttribute(fade, 1));
    geo.setAttribute('aAcross', new THREE.Float32BufferAttribute(across, 2));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, makeMaterial(false));
    mesh.renderOrder = 2;
    return mesh;
  }

  buildRiver(river) {
    const pts = smoothPath(river.points, 3);
    const across = 7;
    const pos = [], depth = [], flow = [], steep = [], fade = [], acr = [];
    const idx = [];
    let dist = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const prev = pts[Math.max(0, i - 1)], next = pts[Math.min(pts.length - 1, i + 1)];
      let tx = next.x - prev.x, tz = next.z - prev.z;
      const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      if (i > 0) dist += Math.hypot(p.x - prev.x, p.z - prev.z, (p.y - prev.y));
      const horiz = Math.hypot(next.x - prev.x, next.z - prev.z) || 1;
      const st = THREE.MathUtils.clamp(Math.abs(next.y - prev.y) / horiz, 0, 3) / 3;
      const steepness = Math.min(1, st * 3.0);
      // Fade the ribbon where it meets the lake so the two surfaces do not z-fight.
      const toEnd = (pts.length - 1 - i) * 3;
      const f = Math.min(1, toEnd / 18) * Math.min(1, i / 2 + 0.2);
      // Water bulges outward slightly on falls so it clears the rock behind it.
      const bulge = steepness > 0.5 ? 0.6 : 0;
      for (let k = 0; k < across; k++) {
        const u = (k / (across - 1)) * 2 - 1;
        const w = p.w * (1 + steepness * 0.15);
        const x = p.x - tz * u * w + tx * bulge, z = p.z + tx * u * w + tz * bulge;
        const y = p.y + 0.05 + (1 - u * u) * 0.08;
        pos.push(x, y, z);
        depth.push(Math.max(0.1, p.y - heightAt(x, z)) + steepness * 3);
        flow.push(dist); steep.push(steepness); fade.push(f); acr.push(u, 0);
      }
      if (steepness > 0.6 && (i % 4 === 0)) this.falls.push({ x: p.x, y: p.y, z: p.z, w: p.w, river: river.id });
    }
    for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < across - 1; k++) {
      const a = i * across + k, b = a + 1, c = a + across, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aDepth', new THREE.Float32BufferAttribute(depth, 1));
    geo.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 1));
    geo.setAttribute('aSteep', new THREE.Float32BufferAttribute(steep, 1));
    geo.setAttribute('aFade', new THREE.Float32BufferAttribute(fade, 1));
    geo.setAttribute('aAcross', new THREE.Float32BufferAttribute(acr, 2));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, this.riverMat);
    mesh.renderOrder = 3;
    mesh.name = 'river-' + river.id;
    return mesh;
  }
}
