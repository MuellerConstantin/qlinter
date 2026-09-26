/**
 * The drawing surface the pet's states are built on: a 32×32 grid of palette
 * keys, a handful of whole-grid moves, and a PNG encoder.
 *
 * Frames are drawn as text on purpose. A diff of a state's module shows exactly
 * which pixels changed, and the base figure in `base.txt` can be read — and
 * edited — without an image editor.
 */

import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { deflateSync } from 'node:zlib';

export const SIZE = 32;

/** `.` and space are both transparent; `.` in stored art, space in stamps laid over it. */
export const PALETTE = {
  // body, from the logo green outwards
  O: '#0b3d22',
  D: '#007a3c',
  G: '#009c4d',
  L: '#3fc47a',
  H: '#a6ecc1',
  B: '#f1f8e4',
  b: '#cfe6b8',
  // face
  W: '#ffffff',
  K: '#1b1f24',
  P: '#ff8fa3',
  R: '#e8566e',
  p: '#e2a3ae',
  // props, the greys taken from the logo
  S: '#c9cbcf',
  g: '#54565b',
  h: '#7d8086',
  e: '#3a3c40',
  Y: '#ffd23f',
  y: '#fff3b0',
  c: '#9fd8ff',
  C: '#d8f0ff',
  q: '#3b8fd6',
  a: '#f0cf9a',
  A: '#c99d62',
  // pale body, one step away from the logo green
  1: '#1c9c5c',
  2: '#52c589',
  3: '#157a48',
  4: '#b0ecca',
  // ghost
  5: '#5fae86',
  6: '#bfe8d2',
  7: '#dcf5e8',
  8: '#f0fff7',
};

const BASE = readFileSync(new URL('base.txt', import.meta.url), 'utf8')
  .trim()
  .split(/\r?\n/);

/** A fresh copy of the base figure. */
export function base() {
  return BASE.map((row) => [...row]);
}

export function blank() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill('.'));
}

/** Stamps `text` into row `y` from column `x`; spaces leave the pixel below, off-canvas parts are dropped. */
export function put(grid, y, x, text) {
  if (y < 0 || y >= SIZE) {
    return;
  }

  [...text].forEach((key, i) => {
    if (key !== ' ' && x + i >= 0 && x + i < SIZE) {
      grid[y][x + i] = key;
    }
  });
}

/** Replaces every pixel whose key is in `mapping`. */
export function recolor(grid, mapping) {
  for (const row of grid) {
    row.forEach((key, x) => {
      if (mapping[key]) {
        row[x] = mapping[key];
      }
    });
  }
}

/** Empties eyes, cheeks and mouth back to plain body colour. */
export function clearFace(grid) {
  for (let y = 12; y <= 19; y++) {
    put(grid, y, 9, 'GGGGG');
    put(grid, y, 18, 'GGGGG');
  }

  for (let y = 17; y <= 19; y++) {
    put(grid, y, 13, 'GGGGGG');
  }

  put(grid, 16, 8, 'GG');
  put(grid, 17, 8, 'GG');
  put(grid, 16, 22, 'GG');
  put(grid, 17, 22, 'GG');
}

// Row 11 is a plain stretch of head, so dropping or doubling it changes the height without touching the face.
const ELASTIC_ROW = 11;

/** One pixel shorter, feet kept on the ground. */
export function squash(grid) {
  return [blank()[0], ...grid.slice(0, ELASTIC_ROW), ...grid.slice(ELASTIC_ROW + 1)];
}

/** One pixel taller, feet kept on the ground. */
export function stretch(grid) {
  return [...grid.slice(1, ELASTIC_ROW + 1), [...grid[ELASTIC_ROW]], ...grid.slice(ELASTIC_ROW + 1)];
}

/** Moves the whole grid up by `rows`. */
export function lift(grid, rows) {
  return [...grid.slice(rows), ...blank().slice(0, rows)];
}

/** A ground shadow `width` pixels wide under the feet; wider reads as closer to the ground. */
export function shadow(grid, width) {
  put(grid, 28, Math.floor(SIZE / 2 - width / 2), 'S'.repeat(width));
  return grid;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;

  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }

  return c >>> 0;
});

function crc32(bytes) {
  let c = 0xffffffff;

  for (const byte of bytes) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }

  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function rgb(key) {
  const hex = PALETTE[key];

  if (!hex) {
    throw new Error(`Unknown palette key '${key}'`);
  }

  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

/**
 * Encodes `grids` side by side as one RGBA PNG, each pixel blown up to a
 * `scale`×`scale` block. `background` fills transparent pixels when given.
 */
export function encodePng(grids, scale = 1, background = null) {
  const width = SIZE * scale * grids.length;
  const height = SIZE * scale;
  const stride = width * 4 + 1;
  const pixels = Buffer.alloc(stride * height);

  const set = (x, y, [r, g, b, a]) => {
    const offset = y * stride + 1 + x * 4;
    pixels[offset] = r;
    pixels[offset + 1] = g;
    pixels[offset + 2] = b;
    pixels[offset + 3] = a;
  };

  if (background) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        set(x, y, background);
      }
    }
  }

  grids.forEach((grid, frame) => {
    grid.forEach((row, y) => {
      row.forEach((key, x) => {
        if (key === '.' || key === ' ') {
          return;
        }

        const color = [...rgb(key), 255];

        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            set((frame * SIZE + x) * scale + dx, y * scale + dy, color);
          }
        }
      });
    });
  });

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
