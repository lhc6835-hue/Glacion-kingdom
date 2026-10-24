// Dev tool: renders a shaded top-down map of the heightfield to PNG for layout checks.
// usage: node tools/heightmap.mjs out.png [size] [extent]
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { heightAt, waterSurfaceAt, roadMaskAt } from '../src/world/Heightfield.js';

const out = process.argv[2] || 'heightmap.png';
const N = +(process.argv[3] || 512);
const EXT = +(process.argv[4] || 3000);
const px = Buffer.alloc(N * N * 3);
const t0 = Date.now();
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const x = -EXT + (i + 0.5) / N * 2 * EXT, z = -EXT + (j + 0.5) / N * 2 * EXT;
  const h = heightAt(x, z), e = 2 * EXT / N;
  const hx = heightAt(x + e, z), hz = heightAt(x, z + e);
  const shade = Math.max(0.25, Math.min(1.3, 0.85 + ((h - hx) * 0.7 + (h - hz) * 0.5) / e * 0.9));
  let c;
  const w = waterSurfaceAt(x, z);
  if (w > h) c = [40, 110 + Math.min(60, (w - h) * 3), 170];
  else if (roadMaskAt(x, z) > 0.5) c = [190, 160, 110];
  else if (h > 520) c = [235, 238, 245];
  else if (h > 260) c = [120, 115, 110];
  else c = [70 + h * 0.3, 120 + h * 0.2, 60];
  const o = (j * N + i) * 3;
  for (let k = 0; k < 3; k++) px[o + k] = Math.max(0, Math.min(255, c[k] * shade));
}
console.log('sampled', N * N * 3, 'heights in', Date.now() - t0, 'ms');
const raw = Buffer.alloc((N * 3 + 1) * N);
for (let j = 0; j < N; j++) { raw[j * (N * 3 + 1)] = 0; px.copy(raw, j * (N * 3 + 1) + 1, j * N * 3, (j + 1) * N * 3); }
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
};
function crc32(b) { let c, crc = 0xffffffff; for (let n = 0; n < b.length; n++) { c = (crc ^ b[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return crc ^ 0xffffffff; }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 2;
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
