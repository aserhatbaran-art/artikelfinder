#!/usr/bin/env node
// Erzeugt die PNG-App-Icons (192/512 px) ohne externe Abhängigkeiten.
// Motiv wie public/icon.svg: drei Balken in den Artikel-Farben (der/die/das) auf dunklem Grund.
// Vollflächig, Motiv innerhalb der 80-%-Schutzzone → als "maskable" nutzbar.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const BG = [0x17, 0x18, 0x1a];
const BARS = [
  [0x5b, 0x8d, 0xff], // der
  [0xff, 0x6b, 0x5e], // die
  [0x4c, 0xc2, 0x7a], // das
];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size) {
  // Geometrie in Einheiten von 100: Balken x 24–76, Höhe 12, Abstand 8, vertikal zentriert, runde Enden
  const s = size / 100;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // Filter: none
    for (let x = 0; x < size; x++) {
      let col = BG;
      // 4x Supersampling für glatte Kanten
      let hits = [0, 0, 0];
      for (let sy = 0; sy < 2; sy++)
        for (let sx = 0; sx < 2; sx++) {
          const px = (x + 0.25 + sx * 0.5) / s;
          const py = (y + 0.25 + sy * 0.5) / s;
          BARS.forEach((_, i) => {
            const top = 28 + i * 16;
            const cy = top + 6;
            const r = 6;
            const inside =
              py >= top && py <= top + 12 && px >= 24 && px <= 76 &&
              (px >= 30 && px <= 70 || Math.hypot(px - (px < 50 ? 30 : 70), py - cy) <= r);
            if (inside) hits[i]++;
          });
        }
      const i = hits.findIndex((h) => h > 0);
      if (i >= 0) {
        const a = hits[i] / 4;
        col = BG.map((c, k) => Math.round(c * (1 - a) + BARS[i][k] * a));
      }
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = col[0];
      raw[o + 1] = col[1];
      raw[o + 2] = col[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // Bittiefe
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  writeFileSync(resolve(OUT, `icon-${size}.png`), png(size));
  console.log(`icon-${size}.png geschrieben`);
}
