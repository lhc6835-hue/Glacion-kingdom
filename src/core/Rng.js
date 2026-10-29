// Small deterministic PRNG (mulberry32) and hashing helpers for procedural art and reproducible tests.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x, y, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// 1D value noise in [0,1], periodic over `period` when given.
export function noise1(x, seed = 0, period = 0) {
  const i = Math.floor(x), f = x - i;
  const a = period ? ((i % period) + period) % period : i;
  const b = period ? (((i + 1) % period) + period) % period : i + 1;
  const u = f * f * (3 - 2 * f);
  return hash2(a, 0, seed) * (1 - u) + hash2(b, 0, seed) * u;
}

export function fbm1(x, seed = 0, oct = 4, period = 0) {
  let s = 0, amp = 0.5, norm = 0;
  for (let o = 0; o < oct; o++) {
    s += noise1(x, seed + o * 17, period) * amp;
    norm += amp; amp *= 0.5; x *= 2; if (period) period *= 2;
  }
  return s / norm;
}
