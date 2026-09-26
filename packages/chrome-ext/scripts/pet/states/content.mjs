import { base, put, shadow } from '../canvas.mjs';

function blink(grid) {
  for (const x of [10, 19]) {
    for (let y = 12; y <= 15; y++) {
      put(grid, y, x, 'GGG');
    }

    put(grid, 14, x, 'KKK');
  }
}

function tailUp(grid) {
  for (let y = 21; y <= 27; y++) {
    put(grid, y, 25, '.......');
  }

  // close the body outline where the resting tail joined it
  put(grid, 22, 24, 'O');
  put(grid, 23, 24, 'O');
  put(grid, 24, 23, 'O');

  put(grid, 15, 28, 'OO');
  put(grid, 16, 27, 'OLGO');
  put(grid, 17, 26, 'OLGDO');
  put(grid, 18, 26, 'OGDO');
  put(grid, 19, 25, 'DGDO');
  put(grid, 20, 25, 'DDO');
  put(grid, 21, 25, 'OO');
}

function frame(ms, ...changes) {
  const grid = base();
  changes.forEach((change) => change(grid));
  return { grid: shadow(grid, 14), ms };
}

/** At ease: wags its tail twice, waits, blinks. */
export function frames() {
  return [frame(700), frame(180, tailUp), frame(180), frame(180, tailUp), frame(900), frame(130, blink), frame(500)];
}
