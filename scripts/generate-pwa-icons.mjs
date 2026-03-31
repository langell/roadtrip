#!/usr/bin/env node
/**
 * Generates solid-color 192x192 and 512x512 PNG icons for the PWA manifest.
 * Uses only Node.js built-ins (zlib, fs) — no npm dependencies.
 * Brand color: #1B4332 (RoadTrip dark green)
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// CRC32 table (used by PNG chunk integrity checks)
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBytes, data]);
  const crcVal = crc32(crcInput);
  const out = Buffer.alloc(4 + 4 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  typeBytes.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crcVal, 8 + data.length);
  return out;
}

function createSolidPNG(width, height, r, g, b) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  // compression, filter, interlace all 0

  // Raw scanlines: filter byte (0 = None) + RGB pixels
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 3);
    raw[row] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const p = row + 1 + x * 3;
      raw[p] = r;
      raw[p + 1] = g;
      raw[p + 2] = b;
    }
  }

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', deflateSync(raw)),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = join(__dirname, '../apps/web/public/icons');
mkdirSync(outDir, { recursive: true });

// RoadTrip brand color: #1B4332
const [r, g, b] = [0x1b, 0x43, 0x32];

writeFileSync(join(outDir, 'icon-192x192.png'), createSolidPNG(192, 192, r, g, b));
console.log('✓ icon-192x192.png');

writeFileSync(join(outDir, 'icon-512x512.png'), createSolidPNG(512, 512, r, g, b));
console.log('✓ icon-512x512.png');

// Screenshots for richer PWA install UI
// Spec: mobile = 390x844 (portrait), desktop = 1280x800 (wide)
// These are placeholder solid-color images — replace with real app screenshots.
const screenshotsDir = join(__dirname, '../apps/web/public/screenshots');
mkdirSync(screenshotsDir, { recursive: true });

writeFileSync(join(screenshotsDir, 'mobile.png'), createSolidPNG(390, 844, r, g, b));
console.log('✓ screenshots/mobile.png (390x844 placeholder)');

writeFileSync(join(screenshotsDir, 'desktop.png'), createSolidPNG(1280, 800, r, g, b));
console.log('✓ screenshots/desktop.png (1280x800 placeholder)');

console.log('PWA assets written to apps/web/public/');
