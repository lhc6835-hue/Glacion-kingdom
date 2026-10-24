// Polyline with a uniform-grid index for fast "nearest point on path" queries.
// Used for rivers (surface height, width) and roads (graded height, width).

export class IndexedPolyline {
  constructor(points, { cell = 64, pad = 40 } = {}) {
    this.points = points;
    this.cell = cell;
    this.grid = new Map();
    this.segs = [];
    let acc = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      this.segs.push({ a, b, len, start: acc, i });
      acc += len;
    }
    this.length = acc;
    // Register each segment in every cell its padded bounding box touches.
    for (const s of this.segs) {
      const w = Math.max(s.a.w || 0, s.b.w || 0) + pad;
      const x0 = Math.floor((Math.min(s.a.x, s.b.x) - w) / cell);
      const x1 = Math.floor((Math.max(s.a.x, s.b.x) + w) / cell);
      const z0 = Math.floor((Math.min(s.a.z, s.b.z) - w) / cell);
      const z1 = Math.floor((Math.max(s.a.z, s.b.z) + w) / cell);
      for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) {
        const k = gx * 73856093 ^ gz * 19349663;
        let arr = this.grid.get(k);
        if (!arr) { arr = []; this.grid.set(k, arr); }
        arr.push(s);
      }
    }
  }

  // Returns the nearest point record or null when no segment is near.
  // out: { d, s (distance along path), t (0..1 within segment), seg, x, z }
  nearest(x, z, out) {
    const k = Math.floor(x / this.cell) * 73856093 ^ Math.floor(z / this.cell) * 19349663;
    const arr = this.grid.get(k);
    if (!arr) return null;
    let best = Infinity;
    for (let i = 0; i < arr.length; i++) {
      const s = arr[i];
      const dx = s.b.x - s.a.x, dz = s.b.z - s.a.z;
      const l2 = dx * dx + dz * dz || 1;
      let t = ((x - s.a.x) * dx + (z - s.a.z) * dz) / l2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = s.a.x + dx * t, pz = s.a.z + dz * t;
      const d = Math.hypot(x - px, z - pz);
      if (d < best) {
        best = d;
        out.d = d; out.t = t; out.seg = s; out.x = px; out.z = pz; out.s = s.start + s.len * t;
      }
    }
    return best < Infinity ? out : null;
  }

  // Point and tangent at distance s along the path.
  sample(s) {
    for (const seg of this.segs) {
      if (s <= seg.start + seg.len || seg === this.segs[this.segs.length - 1]) {
        const t = Math.min(1, Math.max(0, (s - seg.start) / (seg.len || 1)));
        const { a, b } = seg;
        const tx = (b.x - a.x) / (seg.len || 1), tz = (b.z - a.z) / (seg.len || 1);
        return {
          x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t,
          y: a.y !== undefined ? a.y + (b.y - a.y) * t : 0,
          w: a.w !== undefined ? a.w + (b.w - a.w) * t : 0,
          tx, tz, seg,
        };
      }
    }
    return null;
  }
}

// Catmull-Rom resample so hand-placed control points become smooth curves.
export function smoothPath(points, step = 6) {
  const out = [];
  const n = points.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(n - 1, i + 2)];
    const len = Math.hypot(p2.x - p1.x, p2.z - p1.z);
    const steps = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const o = { x: cr(p0.x, p1.x, p2.x, p3.x, t), z: cr(p0.z, p1.z, p2.z, p3.z, t) };
      // Heights and widths are interpolated linearly: catmull-rom would overshoot at waterfalls.
      if (p1.y !== undefined) o.y = p1.y + (p2.y - p1.y) * t;
      if (p1.w !== undefined) o.w = p1.w + (p2.w - p1.w) * t;
      out.push(o);
    }
  }
  out.push({ ...points[n - 1] });
  return out;
}

function cr(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}
