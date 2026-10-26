import { mkdir, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
// Original four-point sparkle, rasterized without external image dependencies.
function crc32(data) {
  let crc = 0xffffffff;
  for (const b of data) {
    crc ^= b;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const label = Buffer.from(type),
    size = Buffer.alloc(4),
    crc = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([label, data])));
  return Buffer.concat([size, label, data, crc]);
}
function icon(size) {
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let sy = 0; sy < 4; sy++)
        for (let sx = 0; sx < 4; sx++) {
          const u = (x + (sx + 0.5) / 4) / size,
            v = (y + (sy + 0.5) / 4) / size;
          const rounded =
            Math.hypot(
              Math.max(Math.abs(u - 0.5) - 0.28, 0),
              Math.max(Math.abs(v - 0.5) - 0.28, 0),
            ) <= 0.19;
          if (!rounded) continue;
          const sparkle = (cx, cy, radius) =>
            Math.sqrt(Math.abs(u - cx) / radius) + Math.sqrt(Math.abs(v - cy) / radius) <= 1;
          const white = sparkle(0.46, 0.52, 0.32) || sparkle(0.76, 0.25, 0.105);
          r += white ? 255 : 100 + 25 * u;
          g += white ? 255 : 62 + 86 * v;
          b += white ? 255 : 212 + 25 * u;
          a += 255;
        }
      const pos = y * (size * 4 + 1) + 1 + x * 4;
      rows[pos] = a ? (r * 255) / a : 0;
      rows[pos + 1] = a ? (g * 255) / a : 0;
      rows[pos + 2] = a ? (b * 255) / a : 0;
      rows[pos + 3] = a / 16;
    }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
export async function generateIcons(folder) {
  await mkdir(folder, { recursive: true });
  for (const size of [16, 32, 48, 128]) await writeFile(`${folder}/icon${size}.png`, icon(size));
}
