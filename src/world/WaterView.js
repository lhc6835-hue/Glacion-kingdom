import * as THREE from 'three';
import { CELL, N, HALF } from './Layout.js';
import { F_WATER } from './WorldData.js';
import { look, glslCommon } from '../gfx/Look.js';
import { CHUNK_CELLS } from './Ground.js';

// Painted water: lake and rivers as flat sheets per chunk, waterfalls as vertical curtains
// generated wherever a river runs off a cliff.

export class WaterView {
  constructor(scene, world) {
    this.world = world;
    this.group = new THREE.Group();
    this.group.name = 'water';
    scene.add(this.group);
    this.surfaceMat = createSurfaceMaterial();
    this.fallMat = createFallMaterial();
    const chunks = N / CHUNK_CELLS;
    for (let cj = 0; cj < chunks; cj++) for (let ci = 0; ci < chunks; ci++) {
      const g = buildSurface(world, ci, cj);
      if (!g) continue;
      const m = new THREE.Mesh(g, this.surfaceMat);
      m.renderOrder = 1;
      m.matrixAutoUpdate = false;
      this.group.add(m);
    }
    const fg = buildFalls(world);
    if (fg) {
      const m = new THREE.Mesh(fg, this.fallMat);
      m.renderOrder = 2;
      m.matrixAutoUpdate = false;
      this.group.add(m);
    }
    // Where falls land: positions for mist and splash effects.
    this.splashes = groupSplashes(world);
  }
}

function riverFlow(world, x, z) {
  let best = null, bd = Infinity;
  const o = {};
  for (const r of world.rivers) {
    const n = r.path.nearest(x, z, o);
    if (n && n.d < bd) {
      bd = n.d;
      const s = n.seg;
      const l = s.len || 1;
      best = [(s.b.x - s.a.x) / l, (s.b.z - s.a.z) / l, r.canal ? 0.6 : 1.0];
    }
  }
  return bd < 30 ? best : null;
}

function buildSurface(world, ci, cj) {
  const { water, height, flags } = world;
  const pos = [], depth = [], flow = [], idx = [];
  const vmap = new Map();
  const i0 = ci * CHUNK_CELLS, j0 = cj * CHUNK_CELLS;
  const vert = (gi, gj, y, d, f) => {
    const key = gj * (N + 1) + gi;
    let list = vmap.get(key);
    if (list) for (const e of list) if (Math.abs(e.y - y) < 0.05) { depth[e.v] = Math.max(depth[e.v], d); return e.v; }
    const v = pos.length / 3;
    pos.push(-HALF + gi * CELL, y, -HALF + gj * CELL);
    depth.push(d); flow.push(f[0], f[1], f[2]);
    if (!list) vmap.set(key, (list = []));
    list.push({ y, v });
    return v;
  };
  for (let j = j0; j < j0 + CHUNK_CELLS; j++) for (let i = i0; i < i0 + CHUNK_CELLS; i++) {
    const k = j * N + i;
    if (!(flags[k] & F_WATER)) continue;
    const y = water[k];
    const d = y - height[k];
    const x = -HALF + (i + 0.5) * CELL, z = -HALF + (j + 0.5) * CELL;
    const f = Math.abs(y) > 0.01 ? (riverFlow(world, x, z) || [0, 0, 0]) : [0, 0, 0];
    // Shore vertices get zero depth so foam hugs the banks.
    const dd = (di, dj) => {
      let m = d;
      for (const [a, b] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
        const kk = (j + dj + b) * N + (i + di + a);
        if (kk < 0 || kk >= N * N || !(flags[kk] & F_WATER)) m = 0;
      }
      return m;
    };
    const a = vert(i, j, y, dd(0, 0), f), b = vert(i + 1, j, y, dd(1, 0), f);
    const c = vert(i, j + 1, y, dd(0, 1), f), e = vert(i + 1, j + 1, y, dd(1, 1), f);
    idx.push(a, c, b, b, c, e);
  }
  if (!idx.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aDepth', new THREE.Float32BufferAttribute(depth, 1));
  g.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

function buildFalls(world) {
  const pos = [], uv = [], idx = [];
  for (const f of world.falls) {
    const { i, j, di, dj, top, drop } = f;
    // Edge between cell (i,j) and its lower neighbour, pushed slightly outward.
    const cx = -HALF + (i + 0.5 + di * 0.5) * CELL + di * 0.35;
    const cz = -HALF + (j + 0.5 + dj * 0.5) * CELL + dj * 0.35;
    const tx = -dj, tz = di; // along the edge
    const hw = CELL * 0.5 + 0.05;
    const bottom = top - drop - 0.2;
    const v = pos.length / 3;
    const u0 = (i * 13.1 + j * 7.7) % 50;
    // Top lip curls outward a little; the curtain then falls straight.
    const lip = 0.6;
    for (const [s, yy, out, vv] of [[-1, top + 0.05, 0, 0], [1, top + 0.05, 0, 0], [-1, top - 0.6, lip, 0.6 / drop], [1, top - 0.6, lip, 0.6 / drop], [-1, bottom, lip * 1.4, 1], [1, bottom, lip * 1.4, 1]]) {
      pos.push(cx + tx * hw * s + di * out, yy, cz + tz * hw * s + dj * out);
      uv.push(u0 + (s + 1) * 0.5, vv * drop);
    }
    idx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3, v + 2, v + 4, v + 3, v + 3, v + 4, v + 5);
  }
  if (!idx.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

function groupSplashes(world) {
  const out = [];
  for (const f of world.falls) {
    const x = -HALF + (f.i + 0.5 + f.dj * 0 + f.di * 1.2) * CELL;
    const z = -HALF + (f.j + 0.5 + f.dj * 1.2) * CELL;
    const y = f.top - f.drop;
    const near = out.find((s) => Math.hypot(s.x - x, s.z - z) < 7 && Math.abs(s.y - y) < 3);
    if (near) { near.n++; near.drop = Math.max(near.drop, f.drop); continue; }
    out.push({ x, y, z, n: 1, drop: f.drop });
  }
  return out;
}

function createSurfaceMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...look },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */`
      attribute float aDepth;
      attribute vec3 aFlow;
      varying float vDepth;
      varying vec3 vFlow;
      varying vec3 vP;
      void main(){
        vDepth = aDepth; vFlow = aFlow; vP = position;
        gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      ${glslCommon}
      varying float vDepth;
      varying vec3 vFlow;
      varying vec3 vP;
      void main(){
        vec2 q = vP.xz;
        float t = uTime;
        float isRiver = step(0.01, length(vFlow.xy));
        // River coordinates: along/across the flow, scrolling downstream.
        vec2 fl = isRiver > 0.5 ? normalize(vFlow.xy) : vec2(0.0, 1.0);
        vec2 rq = vec2(dot(q, vec2(-fl.y, fl.x)), dot(q, fl));
        float speed = 1.4 * vFlow.z;
        float d = max(vDepth, 0.0);

        vec3 shallow = srgb(vec3(0.46, 0.84, 0.82));
        vec3 mid = srgb(vec3(0.20, 0.62, 0.76));
        vec3 deep = srgb(vec3(0.10, 0.36, 0.62));
        vec3 col = mix(shallow, mid, smoothstep(0.2, 2.2, d));
        col = mix(col, deep, smoothstep(2.0, 6.0, d));

        // Sky reflected toward the horizon.
        vec3 V = normalize(cameraPosition - vP);
        float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 4.0);
        col = mix(col, uHaze * 1.05, fres * 0.32);

        // Painted ripple strokes.
        vec2 rp = isRiver > 0.5 ? vec2(rq.x * 0.5, (rq.y - t * speed) * 0.9) : vec2(q.x * 0.12 + t * 0.03, q.y * 0.9 + sin(q.x * 0.05 + t * 0.4) * 0.6);
        float r1 = snoise(rp);
        float r2 = snoise(rp * vec2(2.3, 1.7) + 11.0 + t * 0.15);
        col = mix(col, col * 1.22 + 0.05, smoothstep(0.55, 0.8, r1) * 0.7);
        col = mix(col, col * 0.82, smoothstep(0.5, 0.85, r2) * 0.5);
        // Sparkles where the sun catches the ripples.
        vec2 sq = q * vec2(0.9, 2.2) + vec2(0.0, t * 0.2);
        vec2 sc = floor(sq);
        float sh = hash12(sc);
        float tw = 0.5 + 0.5 * sin(t * 3.0 + sh * 30.0);
        // Round glints, not cell-shaped patches.
        float dot = smoothstep(0.32, 0.0, length((fract(sq) - 0.5) * vec2(1.0, 0.45)));
        float spark = step(0.985, sh) * dot * tw * smoothstep(0.3, 0.8, r1 * 0.5 + 0.5) * (1.0 - uNight * 0.7);
        col += vec3(1.0, 0.97, 0.85) * spark * 0.9 * uLight;

        // Shore foam.
        float foam = smoothstep(0.55, 0.0, d) * smoothstep(0.2, 0.7, snoise(q * 0.8 + t * 0.4) * 0.5 + 0.5 + sin(t * 1.2 + d * 9.0) * 0.25);
        // White water in fast river stretches.
        foam = max(foam, isRiver * vFlow.z * smoothstep(0.6, 0.95, snoise(vec2(rq.x * 1.2, rq.y * 0.4 - t * speed * 1.3))) * 0.6);
        col = mix(col, vec3(0.95, 0.98, 1.0), foam * 0.85);

        col *= uLight;
        col = haze(col, length(vP - cameraPosition));
        float alpha = mix(0.62, 0.94, smoothstep(0.0, 1.5, d));
        gl_FragColor = vec4(col, max(alpha, foam));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

function createFallMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...look },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vP;
      void main(){
        vUv = uv; vP = position;
        gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      ${glslCommon}
      varying vec2 vUv;
      varying vec3 vP;
      void main(){
        float t = uTime;
        float u = vUv.x, v = vUv.y; // v = metres fallen from the lip
        // Long vertical streaks falling faster as they drop.
        float fallV = v * 0.18 - t * (0.9 + v * 0.02);
        float s1 = snoise(vec2(u * 3.2, fallV));
        float s2 = snoise(vec2(u * 7.5 + 4.0, fallV * 1.7 - t * 0.4));
        vec3 blue = srgb(vec3(0.55, 0.82, 0.92));
        vec3 white = vec3(0.97, 0.99, 1.0);
        vec3 col = mix(blue, white, smoothstep(-0.2, 0.6, s1) * 0.8 + 0.15);
        col = mix(col, srgb(vec3(0.35, 0.62, 0.78)), smoothstep(0.5, 0.9, s2) * 0.35);
        // The glassy lip at the top.
        col = mix(srgb(vec3(0.40, 0.75, 0.82)), col, smoothstep(0.0, 1.2, v));
        float alpha = 0.72 + 0.25 * smoothstep(-0.3, 0.6, s1);
        alpha *= smoothstep(0.0, 0.15, v + 0.1);
        col *= uLight;
        col = haze(col, length(vP - cameraPosition));
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
