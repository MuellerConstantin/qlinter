import { base, lift, put, shadow, squash, stretch } from '../canvas.mjs';

function closedEyes(grid) {
  for (const x of [10, 19]) {
    for (let y = 12; y <= 15; y++) {
      put(grid, y, x, 'GGG');
    }

    put(grid, 13, x, ' K ');
    put(grid, 14, x, 'K K');
  }
}

function openMouth(grid) {
  put(grid, 17, 13, 'GOOOOG');
  put(grid, 18, 13, 'OKKKKO');
  put(grid, 19, 13, 'OKRRKO');
  put(grid, 20, 14, 'OOOO');
}

function sparkle(grid, x, y, big = false) {
  if (big) {
    put(grid, y - 2, x, 'y');
    put(grid, y - 1, x, 'Y');
    put(grid, y, x - 2, 'yYWYy');
    put(grid, y + 1, x, 'Y');
    put(grid, y + 2, x, 'y');
    return;
  }

  put(grid, y - 1, x, 'Y');
  put(grid, y, x - 1, 'YyY');
  put(grid, y + 1, x, 'Y');
}

function cheering() {
  const grid = base();
  closedEyes(grid);
  openMouth(grid);
  return grid;
}

function crouching() {
  const grid = base();
  closedEyes(grid);
  return squash(grid);
}

/** Jumps for joy: crouch, take off, hang at the top among sparkles, land. */
export function frames() {
  const rising = lift(stretch(cheering()), 2);
  const top = lift(cheering(), 4);
  sparkle(top, 3, 9);
  sparkle(top, 28, 7);
  const peak = lift(cheering(), 4);
  sparkle(peak, 3, 9, true);
  sparkle(peak, 28, 7, true);
  sparkle(peak, 27, 14);
  const falling = lift(stretch(cheering()), 2);
  sparkle(falling, 27, 14, true);
  sparkle(falling, 3, 9);
  const landing = crouching();
  sparkle(landing, 27, 14);

  return [
    { grid: shadow(base(), 14), ms: 500 },
    { grid: shadow(crouching(), 16), ms: 120 },
    { grid: shadow(rising, 10), ms: 90 },
    { grid: shadow(top, 6), ms: 110 },
    { grid: shadow(peak, 6), ms: 160 },
    { grid: shadow(falling, 10), ms: 90 },
    { grid: shadow(landing, 16), ms: 140 },
  ];
}
