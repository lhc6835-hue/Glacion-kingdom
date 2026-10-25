// Static collision: circles (trunks, posts, characters) and oriented boxes (buildings, walls)
// stored in a uniform grid. The world's cliffs and water are handled by WorldData directly.

const CELL = 8;

export class Collision {
  constructor() {
    this.grid = new Map();
    this.solids = [];
  }

  key(i, j) { return i * 92821 + j; }

  insert(s) {
    this.solids.push(s);
    const x0 = Math.floor((s.minX) / CELL), x1 = Math.floor((s.maxX) / CELL);
    const z0 = Math.floor((s.minZ) / CELL), z1 = Math.floor((s.maxZ) / CELL);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
      const k = this.key(i, j);
      let a = this.grid.get(k);
      if (!a) this.grid.set(k, (a = []));
      a.push(s);
    }
    return s;
  }

  circle(x, z, r, data) {
    return this.insert({ type: 'c', x, z, r, minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r, data });
  }

  // Axis-aligned box from (x0,z0) to (x1,z1), optionally with a floor height range [y0,y1].
  box(x0, z0, x1, z1, data, y0 = -Infinity, y1 = Infinity) {
    return this.insert({ type: 'b', x0, z0, x1, z1, y0, y1, minX: x0, maxX: x1, minZ: z0, maxZ: z1, data });
  }

  // Push a circle of radius r at (x,z) out of every solid. Returns corrected position.
  resolve(x, z, r, y = 0, out = { x: 0, z: 0, hit: null }) {
    out.x = x; out.z = z; out.hit = null;
    for (let pass = 0; pass < 2; pass++) {
      const i0 = Math.floor((out.x - r) / CELL), i1 = Math.floor((out.x + r) / CELL);
      const j0 = Math.floor((out.z - r) / CELL), j1 = Math.floor((out.z + r) / CELL);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const a = this.grid.get(this.key(i, j));
        if (!a) continue;
        for (const s of a) {
          if (s.disabled) continue;
          if (s.type === 'c') {
            const dx = out.x - s.x, dz = out.z - s.z;
            const d = Math.hypot(dx, dz), m = r + s.r;
            if (d < m && d > 1e-6) { out.x = s.x + (dx / d) * m; out.z = s.z + (dz / d) * m; out.hit = s; }
          } else {
            if (y < s.y0 - 0.5 || y > s.y1) continue;
            const cx = Math.max(s.x0, Math.min(out.x, s.x1)), cz = Math.max(s.z0, Math.min(out.z, s.z1));
            const dx = out.x - cx, dz = out.z - cz;
            const d = Math.hypot(dx, dz);
            if (d < r) {
              if (d > 1e-6) { out.x = cx + (dx / d) * r; out.z = cz + (dz / d) * r; } else {
                // Inside the box: push out along the shallowest axis.
                const l = out.x - s.x0, rr = s.x1 - out.x, t = out.z - s.z0, b = s.z1 - out.z;
                const m = Math.min(l, rr, t, b);
                if (m === l) out.x = s.x0 - r; else if (m === rr) out.x = s.x1 + r; else if (m === t) out.z = s.z0 - r; else out.z = s.z1 + r;
              }
              out.hit = s;
            }
          }
        }
      }
    }
    return out;
  }

  query(x, z, radius, fn) {
    const i0 = Math.floor((x - radius) / CELL), i1 = Math.floor((x + radius) / CELL);
    const j0 = Math.floor((z - radius) / CELL), j1 = Math.floor((z + radius) / CELL);
    const seen = new Set();
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const a = this.grid.get(this.key(i, j));
      if (!a) continue;
      for (const s of a) if (!seen.has(s)) { seen.add(s); fn(s); }
    }
  }
}
