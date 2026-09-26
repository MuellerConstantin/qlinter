/**
 * Renders the pet's states into the sprite sheets the popup plays.
 *
 * Each state becomes `dist/images/pet/<state>.png` — its frames side by side,
 * 32×32 each, transparent — and `pet.json` records every frame's duration. The
 * sheets are build output like the bundle next to them: the text in `base.txt`
 * and `states/` is the only source, so nothing drawn from it is committed.
 *
 * `--preview <dir>` also writes each state as an enlarged GIF for looking at.
 * That needs ffmpeg on the PATH; the sheets do not.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SIZE, encodePng } from './canvas.mjs';
import * as content from './states/content.mjs';
import * as drip from './states/drip.mjs';
import * as grave from './states/grave.mjs';
import * as happy from './states/happy.mjs';
import * as sick from './states/sick.mjs';
import * as skeptical from './states/skeptical.mjs';
import * as sleep from './states/sleep.mjs';

const STATES = { sleep, happy, content, skeptical, sick, drip, grave };
const PREVIEW_SCALE = 10;
const PREVIEW_BACKGROUND = [255, 255, 255, 255];

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = join(packageRoot, 'dist', 'images', 'pet');

function writePreview(name, frames, previewDir) {
  const workDir = mkdtempSync(join(tmpdir(), `qlinter-pet-${name}-`));

  try {
    let list = '';

    frames.forEach(({ grid, ms }, i) => {
      writeFileSync(join(workDir, `${i}.png`), encodePng([grid], PREVIEW_SCALE, PREVIEW_BACKGROUND));
      list += `file '${i}.png'\nduration ${ms / 1000}\n`;
    });

    // the concat demuxer ignores the last entry's duration unless the file is repeated
    list += `file '${frames.length - 1}.png'\n`;
    writeFileSync(join(workDir, 'list.txt'), list);

    execFileSync('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-f',
      'concat',
      '-i',
      join(workDir, 'list.txt'),
      '-vf',
      'split[a][b];[a]palettegen[p];[b][p]paletteuse=dither=none',
      '-loop',
      '0',
      join(previewDir, `${name}.gif`),
    ]);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

function parsePreviewDir(args) {
  const i = args.indexOf('--preview');

  if (i === -1) {
    return null;
  }

  if (!args[i + 1]) {
    throw new Error('--preview needs a directory');
  }

  return resolve(args[i + 1]);
}

const previewDir = parsePreviewDir(process.argv.slice(2));
const manifest = { frameSize: SIZE, durations: {} };

mkdirSync(outDir, { recursive: true });

if (previewDir) {
  mkdirSync(previewDir, { recursive: true });
}

for (const [name, state] of Object.entries(STATES)) {
  const frames = state.frames();
  writeFileSync(join(outDir, `${name}.png`), encodePng(frames.map((frame) => frame.grid)));
  manifest.durations[name] = frames.map((frame) => frame.ms);

  if (previewDir) {
    writePreview(name, frames, previewDir);
  }

  console.log(`${name}: ${frames.length} frames`);
}

writeFileSync(join(outDir, 'pet.json'), JSON.stringify(manifest));
