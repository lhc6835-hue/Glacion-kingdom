import * as THREE from 'three';
import { terrainSample } from './Heightfield.js';
import { WORLD_HALF } from './WorldLayout.js';
import { createTerrainMaterial } from '../gfx/TerrainMaterial.js';

// Chunked terrain with distance-based LOD. Each chunk caches its geometry per LOD level,
// and chunk borders get skirts so LOD seams never open holes in the ground.

export const CHUNK = 250;
const LODS = [
  { dist: 420, seg: 80 },
  { dist: 950, seg: 40 },
  { dist: 1900, seg: 20 },
  { dist: Infinity, seg: 10 },
];

export class Terrain {
  constructor(scene) {
    this.scene = scene;
    this.material = createTerrainMaterial();
    this.group = new THREE.Group();
    this.group.name = 'terrain';
    scene.add(this.group);
    this.n = Math.round((WORLD_HALF * 2) / CHUNK);
    this.chunks = [];
    for (let j = 0; j < this.n; j++) for (let i = 0; i < this.n; i++) {
      const x0 = -WORLD_HALF + i * CHUNK, z0 = -WORLD_HALF + j * CHUNK;
      const mesh = new THREE.Mesh(undefined, this.material);
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      mesh.matrixAutoUpdate = false;
      mesh.frustumCulled = true;
      this.chunks.push({ i, j, x0, z0, cx: x0 + CHUNK / 2, cz: z0 + CHUNK / 2, lod: -1, geos: [], mesh, want: -1 });
    }
    this._queue = [];
  }

  lodFor(chunk, px, pz) {
    const dx = Math.max(Math.abs(px - chunk.cx) - CHUNK / 2, 0);
    const dz = Math.max(Math.abs(pz - chunk.cz) - CHUNK / 2, 0);
    const d = Math.hypot(dx, dz);
    for (let l = 0; l < LODS.length; l++) if (d < LODS[l].dist) return l;
    return LODS.length - 1;
  }

  // Build everything needed to see from (px,pz) right now. Called during loading.
  buildAll(px, pz, onProgress) {
    let k = 0;
    for (const c of this.chunks) {
      this.setLod(c, this.lodFor(c, px, pz));
      if (onProgress && (++k & 15) === 0) onProgress(k / this.chunks.length);
    }
  }

  // Incremental LOD update: rebuilds at most a small time budget per frame.
  update(px, pz, budgetMs = 4) {
    const t0 = performance.now();
    for (const c of this.chunks) c.want = this.lodFor(c, px, pz);
    // Highest-detail requests first.
    const pending = this.chunks.filter((c) => c.want !== c.lod).sort((a, b) => a.want - b.want);
    for (const c of pending) {
      if (performance.now() - t0 > budgetMs && c.geos[c.want] === undefined) break;
      this.setLod(c, c.want);
    }
  }

  setLod(c, lod) {
    if (!c.geos[lod]) c.geos[lod] = buildChunkGeometry(c.x0, c.z0, CHUNK, LODS[lod].seg);
    c.mesh.geometry = c.geos[lod];
    if (c.lod === -1) this.group.add(c.mesh);
    c.lod = lod;
    // Free detail we are unlikely to need soon.
    for (let l = 0; l < c.geos.length; l++) {
      if (c.geos[l] && Math.abs(l - lod) > 1) { c.geos[l].dispose(); c.geos[l] = undefined; }
    }
  }
}

export function buildChunkGeometry(x0, z0, size, seg) {
  const step = size / seg;
  const g = seg + 3; // one-vertex border on each side for normals
  const H = new Float32Array(g * g);
  const R = new Float32Array(g * g);
  const s = { h: 0, road: 0 };
  for (let j = 0; j < g; j++) for (let i = 0; i < g; i++) {
    terrainSample(x0 + (i - 1) * step, z0 + (j - 1) * step, s);
    H[j * g + i] = s.h; R[j * g + i] = s.road;
  }
  const vn = seg + 1;
  const skirtN = seg * 8;
  const count = vn * vn + skirtN;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const road = new Float32Array(count);
  let v = 0;
  const put = (i, j, dy) => {
    const k = (j + 1) * g + (i + 1);
    pos[v * 3] = x0 + i * step;
    pos[v * 3 + 1] = H[k] + dy;
    pos[v * 3 + 2] = z0 + j * step;
    const nx = H[k - 1] - H[k + 1], nz = H[k - g] - H[k + g], ny = 2 * step;
    const l = Math.hypot(nx, ny, nz);
    nor[v * 3] = nx / l; nor[v * 3 + 1] = ny / l; nor[v * 3 + 2] = nz / l;
    road[v] = R[k];
    return v++;
  };
  for (let j = 0; j < vn; j++) for (let i = 0; i < vn; i++) put(i, j, 0);
  const idx = [];
  for (let j = 0; j < seg; j++) for (let i = 0; i < seg; i++) {
    const a = j * vn + i, b = a + 1, c = a + vn, d = c + 1;
    // Alternate the diagonal to avoid directional artifacts.
    if ((i + j) & 1) idx.push(a, c, b, b, c, d); else idx.push(a, c, d, a, d, b);
  }
  // Skirts: a curtain hanging below every edge.
  const drop = -Math.max(6, step * 1.5);
  const edge = (list) => {
    for (let e = 0; e < list.length - 1; e++) {
      const [ia, ja] = list[e], [ib, jb] = list[e + 1];
      const ta = ja * vn + ia, tb = jb * vn + ib;
      const sa = put(ia, ja, drop), sb = put(ib, jb, drop);
      idx.push(ta, sa, tb, tb, sa, sb);
    }
  };
  const top = [], bottom = [], left = [], right = [];
  for (let i = 0; i <= seg; i++) { top.push([i, 0]); bottom.push([seg - i, seg]); }
  for (let j = 0; j <= seg; j++) { right.push([seg, j]); left.push([0, seg - j]); }
  // Skirt vertices are allocated on the fly; trim the arrays afterwards.
  const tmp = { pos, nor, road };
  edge(top); edge(right); edge(bottom); edge(left);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(tmp.pos.subarray(0, v * 3), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(tmp.nor.subarray(0, v * 3), 3));
  geo.setAttribute('aRoad', new THREE.BufferAttribute(tmp.road.subarray(0, v), 1));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}
