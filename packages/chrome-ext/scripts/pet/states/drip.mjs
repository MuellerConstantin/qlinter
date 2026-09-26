import { base, clearFace, put, recolor, shadow } from '../canvas.mjs';

const PALE = { G: '1', L: '2', D: '3', H: '4' };

function face(grid, dozing) {
  clearFace(grid);
  recolor(grid, PALE);

  for (const x of [10, 19]) {
    if (dozing) {
      put(grid, 14, x, 'OOO');
      continue;
    }

    put(grid, 14, x, 'OOO');
    put(grid, 15, x, ' K ');
    put(grid, 16, x, '333');
  }

  put(grid, 17, 8, 'pp');
  put(grid, 17, 22, 'pp');
  put(grid, 18, 14, 'O');
  put(grid, 17, 15, 'O');
  put(grid, 18, 16, 'O');
  put(grid, 17, 17, 'O');

  // crossed plaster on the forehead
  put(grid, 8, 17, 'A  A');
  put(grid, 9, 18, 'aa');
  put(grid, 10, 18, 'aa');
  put(grid, 11, 17, 'A  A');
}

/** The IV stand; `drop` is the drop's row in the chamber (0–2), `pulse` walks the tube (0–3). */
function stand(grid, drop, pulse) {
  put(grid, 3, 1, 'eeeee');

  for (let y = 4; y <= 26; y++) {
    put(grid, y, 3, 'g');
  }

  put(grid, 27, 1, 'eeeee');

  put(grid, 5, 1, 'eeeee');

  for (let y = 6; y <= 10; y++) {
    put(grid, y, 1, y < 8 ? 'eCCCe' : 'eccce');
  }

  put(grid, 6, 2, 'W');
  put(grid, 11, 1, ' eee ');

  put(grid, 12, 2, 'eCe');
  put(grid, 13, 2, 'eCe');
  put(grid, 14, 2, 'ece');
  put(grid, 12 + drop, 3, 'q');

  for (let y = 15; y <= 18; y++) {
    put(grid, y, 4, 'c');
  }

  put(grid, 19, 4, 'cc');
  put(grid, 19, 6, 'aa');
  put(grid, 20, 6, 'aa');

  if (pulse === 3) {
    put(grid, 19, 5, 'q');
  } else {
    put(grid, 16 + pulse, 4, 'q');
  }
}

function frame(ms, drop, pulse, dozing = false) {
  const grid = base();
  face(grid, dozing);
  stand(grid, drop, pulse);
  return { grid: shadow(grid, 14), ms };
}

/** Pale and plastered, hooked to a drip that keeps running while it nods off. */
export function frames() {
  return [
    frame(320, 0, 0),
    frame(260, 1, 1),
    frame(260, 2, 2),
    frame(320, 0, 3),
    frame(260, 1, 0),
    frame(260, 2, 1),
    frame(450, 0, 2, true),
    frame(450, 1, 3, true),
  ];
}
