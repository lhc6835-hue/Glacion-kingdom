import * as THREE from 'three';
import { CELL, N, HALF } from './Layout.js';
import { LEVEL_STEP, F_ROAD, F_CITY } from './WorldData.js';
import { look, glslCommon } from '../gfx/Look.js';

// Ground: flat painted terrain with sharp cliff walls between levels.
// Near chunks are built per cell (so cliffs are exact); far chunks use a coarse shared grid.

export const CHUNK_CELLS = 64;
const CHUNKS = N / CHUNK_CELLS;
const NEAR_DIST = 520;

export class Ground {
  constructor(scene, world) {
    this.world = world;
    this.group = new THREE.Group();
    this.group.name = 'ground';
    scene.add(this.group);

    const tex = new THREE.DataTexture(world.mat, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    this.matTex = tex;
    this.material = createGroundMaterial(tex);

    this.chunks = [];
    for (let cj = 0; cj < CHUNKS; cj++) for (let ci = 0; ci < CHUNKS; ci++) {
      const mesh = new THREE.Mesh(undefined, this.material);
      mesh.matrixAutoUpdate = false;
      this.chunks.push({
        ci, cj, mesh, lod: -1, geos: [],
        cx: -HALF + (ci + 0.5) * CHUNK_CELLS * CELL, cz: -HALF + (cj + 0.5) * CHUNK_CELLS * CELL,
      });
    }
  }

  lodFor(c, x, z) {
    const half = CHUNK_CELLS * CELL / 2;
    const d = Math.hypot(Math.max(Math.abs(x - c.cx) - half, 0), Math.max(Math.abs(z - c.cz) - half, 0));
    return d < NEAR_DIST ? 0 : 1;
  }

  buildAll(x, z) { for (const c of this.chunks) this.setLod(c, this.lodFor(c, x, z)); }

  update(x, z, budgetMs = 6) {
    const t0 = performance.now();
    for (const c of this.chunks) {
      const want = this.lodFor(c, x, z);
      if (want === c.lod) continue;
      if (!c.geos[want] && performance.now() - t0 > budgetMs) continue;
      this.setLod(c, want);
    }
  }

  setLod(c, lod) {
    if (!c.geos[lod]) c.geos[lod] = lod === 0 ? buildDetailed(this.world, c.ci, c.cj) : buildCoarse(this.world, c.ci, c.cj, 4);
    c.mesh.geometry = c.geos[lod];
    if (c.lod === -1) this.group.add(c.mesh);
    c.lod = lod;
  }
}

// Corner height of cell (i,j) at corner (ci,cj) ∈ {0,1}²: averaged with neighbours on the same level.
function cornerHeight(H, i, j, a, b) {
  const hc = H[j * N + i];
  let s = 0, c = 0;
  for (let dj = -1; dj <= 0; dj++) for (let di = -1; di <= 0; di++) {
    const ii = Math.min(N - 1, Math.max(0, i + a + di)), jj = Math.min(N - 1, Math.max(0, j + b + dj));
    const h = H[jj * N + ii];
    if (Math.abs(h - hc) <= LEVEL_STEP) { s += h; c++; }
  }
  return s / c;
}

function buildDetailed(world, ci, cj) {
  const H = world.height, F = world.flags;
  const pos = [], wall = [], idx = [];
  const vmap = new Map();
  const vert = (gi, gj, y, top, bot, kind) => {
    // Share vertices between cells when they land at the same height (smooth ground).
    const key = gj * (N + 1) + gi;
    if (kind < 0) {
      let list = vmap.get(key);
      if (list) for (const e of list) if (Math.abs(e.y - y) < 1e-3) return e.v;
      const v = pos.length / 3;
      pos.push(-HALF + gi * CELL, y, -HALF + gj * CELL);
      wall.push(y, y, -1);
      if (!list) vmap.set(key, (list = []));
      list.push({ y, v });
      return v;
    }
    const v = pos.length / 3;
    pos.push(-HALF + gi * CELL, y, -HALF + gj * CELL);
    wall.push(top, bot, kind);
    return v;
  };
  const i0 = ci * CHUNK_CELLS, j0 = cj * CHUNK_CELLS;
  for (let j = j0; j < j0 + CHUNK_CELLS; j++) for (let i = i0; i < i0 + CHUNK_CELLS; i++) {
    const h00 = cornerHeight(H, i, j, 0, 0), h10 = cornerHeight(H, i, j, 1, 0);
    const h01 = cornerHeight(H, i, j, 0, 1), h11 = cornerHeight(H, i, j, 1, 1);
    const a = vert(i, j, h00, 0, 0, -1), b = vert(i + 1, j, h10, 0, 0, -1);
    const c = vert(i, j + 1, h01, 0, 0, -1), d = vert(i + 1, j + 1, h11, 0, 0, -1);
    idx.push(a, c, b, b, c, d);

    // Walls toward lower neighbours.
    const hc = H[j * N + i];
    const sides = [
      [0, 1, [i, j + 1], [i + 1, j + 1], [h01, h11]],  // south edge
      [0, -1, [i + 1, j], [i, j], [h10, h00]],         // north edge
      [1, 0, [i + 1, j + 1], [i + 1, j], [h11, h10]],  // east edge
      [-1, 0, [i, j], [i, j + 1], [h00, h01]],         // west edge
    ];
    for (const [di, dj, p0, p1, [ta, tb]] of sides) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
      const hn = H[nj * N + ni];
      if (hc - hn <= LEVEL_STEP) continue;
      // Bottom follows the neighbour's corner heights so walls meet the lower ground exactly.
      const ba = cornerHeightAt(H, ni, nj, p0[0], p0[1]);
      const bb = cornerHeightAt(H, ni, nj, p1[0], p1[1]);
      const kind = (F[j * N + i] & (F_ROAD | F_CITY)) ? 1 : 0;
      const top = Math.max(ta, tb), bot = Math.min(ba, bb);
      const v0 = vert(p0[0], p0[1], ta, top, bot, kind);
      const v1 = vert(p1[0], p1[1], tb, top, bot, kind);
      const v2 = vert(p0[0], p0[1], ba - 0.05, top, bot, kind);
      const v3 = vert(p1[0], p1[1], bb - 0.05, top, bot, kind);
      idx.push(v0, v2, v1, v1, v2, v3);
    }
  }
  return finish(pos, wall, idx);
}

// Corner height at grid point (gi,gj) as seen from cell (i,j).
function cornerHeightAt(H, i, j, gi, gj) {
  return cornerHeight(H, i, j, gi - i, gj - j);
}

function buildCoarse(world, ci, cj, step) {
  const H = world.height;
  const n = CHUNK_CELLS / step;
  const pos = [], wall = [], idx = [];
  const i0 = ci * CHUNK_CELLS, j0 = cj * CHUNK_CELLS;
  for (let b = 0; b <= n; b++) for (let a = 0; a <= n; a++) {
    const gi = Math.min(N - 1, i0 + a * step), gj = Math.min(N - 1, j0 + b * step);
    // Max of the surrounding cells keeps plateau silhouettes from shrinking at distance.
    let h = -Infinity;
    for (let dj = -1; dj <= 0; dj++) for (let di = -1; di <= 0; di++) {
      const ii = Math.min(N - 1, Math.max(0, gi + di)), jj = Math.min(N - 1, Math.max(0, gj + dj));
      h = Math.max(h, H[jj * N + ii]);
    }
    pos.push(-HALF + (i0 + a * step) * CELL, h, -HALF + (j0 + b * step) * CELL);
    wall.push(h, h, -1);
  }
  for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) {
    const p = b * (n + 1) + a;
    idx.push(p, p + n + 1, p + 1, p + 1, p + n + 1, p + n + 2);
  }
  return finish(pos, wall, idx);
}

function finish(pos, wall, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aWall', new THREE.Float32BufferAttribute(wall, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

function createGroundMaterial(matTex) {
  return new THREE.ShaderMaterial({
    uniforms: { ...look, uMat: { value: matTex }, uHalf: { value: HALF } },
    vertexShader: /* glsl */`
      attribute vec3 aWall;
      varying vec3 vP;
      varying vec3 vN;
      varying vec3 vWall;
      void main(){
        vP = position; vN = normal; vWall = aWall;
        gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      ${glslCommon}
      uniform sampler2D uMat;
      uniform float uHalf;
      varying vec3 vP;
      varying vec3 vN;
      varying vec3 vWall;

      vec3 voro(vec2 p){
        vec2 n = floor(p), f = fract(p);
        float d1 = 8.0, d2 = 8.0; float id = 0.0; vec2 rel = vec2(0.0);
        for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
          vec2 g = vec2(float(i), float(j));
          vec2 o = hash22(n + g) * 0.8 + 0.1;
          vec2 r = g + o - f;
          float d = dot(r, r);
          if (d < d1) { d2 = d1; d1 = d; id = hash12(n + g); rel = r; } else if (d < d2) { d2 = d; }
        }
        return vec3(sqrt(d2) - sqrt(d1), id, rel.x + rel.y);
      }

      vec3 groundTop(vec3 P, vec3 N){
        vec2 q = P.xz;
        vec2 warp = vec2(snoise(q * 0.09), snoise(q * 0.09 + 31.0)) * 1.6;
        vec4 m = texture2D(uMat, (q + warp + uHalf) / (2.0 * uHalf));
        float g1 = fbm(q * 0.0055), g2 = snoise(q * 0.035);
        // Painterly grass: soft colour fields with elongated brush strokes.
        float stroke = snoise(vec2(q.x * 0.55 + q.y * 0.18, q.y * 2.1));
        float stroke2 = snoise(vec2(q.x * 1.7 - q.y * 0.4, q.y * 5.5 + 3.0));
        vec3 gLight = srgb(vec3(0.66, 0.78, 0.33));
        vec3 gMid = srgb(vec3(0.40, 0.63, 0.27));
        vec3 gDeep = srgb(vec3(0.20, 0.44, 0.25));
        vec3 gTeal = srgb(vec3(0.26, 0.52, 0.40));
        vec3 grass = mix(gMid, gLight, smoothstep(-0.25, 0.7, g1 + stroke * 0.18));
        grass = mix(grass, gDeep, smoothstep(0.15, 0.9, g2 - stroke * 0.25) * 0.6);
        grass = mix(grass, gTeal, smoothstep(0.35, 1.0, -g1) * 0.5);
        grass *= 0.92 + 0.1 * stroke2;
        // Forest floor: cool, darker, with moss and fallen leaves.
        float forest = smoothstep(0.35, 0.95, m.a);
        vec3 floorCol = mix(srgb(vec3(0.18, 0.34, 0.22)), srgb(vec3(0.30, 0.38, 0.20)), smoothstep(-0.3, 0.5, stroke));
        floorCol = mix(floorCol, srgb(vec3(0.45, 0.35, 0.20)), smoothstep(0.55, 0.9, stroke2) * 0.35);
        vec3 col = mix(grass, floorCol, forest * 0.75);

        // Meadow flowers.
        vec2 fc = floor(q / 0.8);
        float fh = hash12(fc);
        float meadow = (1.0 - forest) * smoothstep(-0.1, 0.5, snoise(q * 0.012 + 7.0)) * (1.0 - m.r) * (1.0 - m.g);
        if (fh > 1.0 - 0.22 * meadow) {
          vec2 fo = hash22(fc + 3.1) * 0.6 + 0.2;
          float fd = length(fract(q / 0.8) - fo);
          float pick = hash12(fc + 9.7);
          vec3 fcol = pick < 0.3 ? vec3(1.0, 0.97, 0.9) : pick < 0.5 ? vec3(1.0, 0.85, 0.3) : pick < 0.7 ? vec3(0.98, 0.55, 0.7) : pick < 0.85 ? vec3(0.7, 0.55, 0.95) : vec3(0.95, 0.35, 0.3);
          col = mix(col, srgb(fcol), smoothstep(0.16, 0.08, fd));
        }

        // Dirt path with pebbles and worn edges.
        float path = smoothstep(0.2, 0.75, m.r + snoise(q * 0.7) * 0.12);
        vec3 v = voro(q * 2.2);
        vec3 earth = mix(srgb(vec3(0.72, 0.60, 0.42)), srgb(vec3(0.60, 0.48, 0.33)), smoothstep(-0.4, 0.6, snoise(q * 0.25)));
        earth = mix(earth, srgb(vec3(0.80, 0.74, 0.62)), smoothstep(0.08, 0.02, v.x) * step(0.75, v.y) * 0.6);
        col = mix(col, earth, path);

        // Cobbles inside the city and on causeways.
        float pave = smoothstep(0.25, 0.6, m.g);
        vec3 cb = voro(q * 2.3 + vec2(0.0, q.x * 0.04));
        vec3 stone = mix(srgb(vec3(0.76, 0.71, 0.62)), srgb(vec3(0.66, 0.62, 0.56)), cb.y);
        stone *= 0.9 + 0.18 * smoothstep(0.0, 0.5, -cb.z); // painted highlight on the upper-left of each stone
        vec3 cobble = mix(srgb(vec3(0.50, 0.46, 0.40)), stone, smoothstep(0.02, 0.1, cb.x));
        // Large slabs in the squares, worn paths of lighter stone.
        cobble *= 0.94 + 0.1 * smoothstep(-0.3, 0.6, snoise(q * 0.06));
        // City gardens where paving is light.
        float garden = smoothstep(0.62, 0.3, m.g) * (1.0 - m.r);
        col = mix(col, mix(cobble, grass, garden), pave);

        // Shore: sand, pebbles and wet dark band.
        float shore = smoothstep(0.15, 0.8, m.b + snoise(q * 0.5) * 0.15);
        vec3 sand = mix(srgb(vec3(0.86, 0.79, 0.62)), srgb(vec3(0.70, 0.66, 0.56)), smoothstep(0.06, 0.01, v.x) * 0.8);
        col = mix(col, sand, shore * (1.0 - pave));
        col = mix(col, col * 0.72, smoothstep(0.85, 1.0, m.b));

        // Slopes read as earthy banks.
        float slope = 1.0 - N.y;
        col = mix(col, srgb(vec3(0.52, 0.47, 0.34)), smoothstep(0.25, 0.6, slope) * 0.6);
        // Gentle light modelling: west-facing slopes catch the light.
        col *= 1.0 + N.x * -0.35 + (N.z) * 0.08;

        // Drifting cloud shadows.
        float cs = smoothstep(0.1, 0.55, fbm(q * 0.0025 + vec2(uTime * 0.004, uTime * 0.0015)));
        col *= mix(1.0, 0.8, cs * (1.0 - uNight));
        col *= 1.0 - uWet * 0.22;
        col = mix(col, srgb(vec3(0.93, 0.95, 0.99)), uSnow * smoothstep(-0.4, 0.2, g2) * (1.0 - path * 0.5));
        return col;
      }

      vec3 wallCol(vec3 P, vec3 N, vec3 W){
        vec2 t = normalize(vec2(-N.z, N.x));
        float u = dot(P.xz, t);
        float top = W.x, bot = W.y;
        float fromTop = top - P.y;
        vec3 col;
        if (W.z > 0.5) {
          // Masonry: dressed stone courses.
          vec2 b = vec2(u / 1.4, P.y / 0.7);
          b.x += step(1.0, mod(floor(b.y), 2.0)) * 0.5;
          vec2 f = fract(b);
          float id = hash12(floor(b));
          float mortar = smoothstep(0.0, 0.05, f.x) * smoothstep(1.0, 0.95, f.x) * smoothstep(0.0, 0.08, f.y) * smoothstep(1.0, 0.92, f.y);
          vec3 st = mix(srgb(vec3(0.78, 0.73, 0.64)), srgb(vec3(0.64, 0.60, 0.55)), id);
          st *= 0.92 + 0.12 * (1.0 - f.y);
          col = mix(srgb(vec3(0.40, 0.37, 0.33)), st, mortar);
        } else {
          // Natural cliff: big painterly rock masses with strata and cracks.
          // Natural cliff: tall weathered rock masses (stretched vertically), ledges, water stains.
          vec2 rq = vec2(u * 0.075, P.y * 0.045 + snoise(vec2(u * 0.03, P.y * 0.02)) * 0.5);
          vec3 v = voro(rq);
          float strata = snoise(vec2(u * 0.015, P.y * 0.35)) * 0.5 + 0.5;
          float fine = snoise(vec2(u * 0.6, P.y * 0.25));
          vec3 rockA = srgb(vec3(0.74, 0.67, 0.56));
          vec3 rockB = srgb(vec3(0.54, 0.53, 0.55));
          col = mix(rockA, rockB, v.y * 0.5 + strata * 0.35);
          col *= 0.86 + 0.26 * smoothstep(0.25, -0.35, v.z);        // each mass lit on its upper left
          col = mix(col * 0.62, col, smoothstep(0.0, 0.035, v.x));    // soft clefts between masses
          col *= 0.94 + 0.08 * fine;
          // Vertical rain streaks and pale mineral runs.
          float streak = smoothstep(0.6, 0.95, snoise(vec2(u * 0.9, P.y * 0.02 + 3.0)));
          col = mix(col, col * 0.78, streak * 0.5);
          col = mix(col, srgb(vec3(0.86, 0.80, 0.68)), smoothstep(0.62, 0.92, snoise(vec2(u * 0.05, P.y * 0.08))) * 0.25);
          // Grassy ledges every few metres.
          float ledge = smoothstep(0.88, 0.97, sin(P.y * 0.55 + snoise(vec2(u * 0.04, 0.0)) * 2.0)) * smoothstep(0.2, 0.7, snoise(vec2(u * 0.12, P.y * 0.1)));
          col = mix(col, srgb(vec3(0.36, 0.56, 0.28)), ledge * 0.8);
        }
        // Moss and hanging ivy from the top edge.
        float ivyLen = 1.2 + 3.5 * smoothstep(-0.2, 0.9, snoise(vec2(u * 0.35, 1.0))) * (0.5 + 0.5 * snoise(vec2(u * 2.2, 7.0)));
        float ivy = smoothstep(ivyLen, ivyLen * 0.4, fromTop) * (W.z > 0.5 ? 0.45 : 1.0);
        vec3 ivyCol = mix(srgb(vec3(0.22, 0.45, 0.22)), srgb(vec3(0.48, 0.66, 0.28)), smoothstep(-0.2, 0.7, snoise(vec2(u * 1.3, P.y * 1.3))));
        col = mix(col, ivyCol, ivy);
        // Ferns and damp at the foot.
        col = mix(col, srgb(vec3(0.24, 0.38, 0.24)), smoothstep(1.4, 0.0, P.y - bot) * 0.6 * (W.z > 0.5 ? 0.3 : 1.0));
        // Light: west faces bright, east faces in cool shadow, south faces in between.
        float lit = clamp(dot(normalize(vec3(N.x, 0.0, N.z)), normalize(vec3(-0.85, 0.0, 0.45))) * 0.5 + 0.5, 0.0, 1.0);
        col *= mix(uShadow * 0.85, vec3(1.08), lit);
        col *= 1.0 - uWet * 0.25;
        return col;
      }

      void main(){
        vec3 N = normalize(vN);
        vec3 col = (vWall.z >= -0.5 && N.y < 0.5) ? wallCol(vP, N, vWall) : groundTop(vP, N);
        col *= uLight;
        col = haze(col, length(vP - cameraPosition));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
