import { SIZE, base, blank, clearFace, put, recolor } from '../canvas.mjs';

const GHOSTLY = { O: '5', D: '6', G: '7', L: '8', H: 'W', B: '7', b: '7' };

function ghost() {
  const grid = base();

  // drop feet and tail, then fray the hem
  for (let y = 21; y < SIZE; y++) {
    put(grid, y, y > 21 ? 0 : 26, '.'.repeat(SIZE));
  }

  put(grid, 22, 6, 'O' + 'G'.repeat(18) + 'O');
  put(grid, 23, 6, 'OGGGGGGGGGGGGGGGGGGO');
  put(grid, 24, 6, 'OGGGOOGGGOOGGGOOGGGO');
  put(grid, 25, 6, ' OOO  OOO  OOO  OOO ');

  clearFace(grid);

  for (const x of [10, 19]) {
    put(grid, 13, x, 'K K');
    put(grid, 14, x, ' K ');
    put(grid, 15, x, 'K K');
  }

  put(grid, 17, 14, 'OOOO');
  put(grid, 18, 16, 'R');
  put(grid, 19, 16, 'R');
  put(grid, 17, 8, 'pp');
  put(grid, 17, 22, 'pp');

  recolor(grid, GHOSTLY);
  return grid;
}

const GLYPHS = {
  R: ['ee ', 'e e', 'ee ', 'e e', 'e e'],
  I: ['e', 'e', 'e', 'e', 'e'],
  P: ['ee ', 'e e', 'ee ', 'e  ', 'e  '],
};

function tombstone(grid) {
  put(grid, 18, 11, 'eeeeeeeeee');
  put(grid, 19, 9, 'eS' + 'h'.repeat(11) + 'e');

  for (let y = 20; y <= 25; y++) {
    put(grid, y, 8, 'eS' + 'h'.repeat(13) + 'e');
  }

  GLYPHS.R.forEach((row, i) => put(grid, 20 + i, 11, row));
  GLYPHS.I.forEach((row, i) => put(grid, 20 + i, 15, row));
  GLYPHS.P.forEach((row, i) => put(grid, 20 + i, 17, row));

  put(grid, 25, 5, ' D D' + ' '.repeat(14) + 'D D');
  put(grid, 26, 4, 'ODGLGDGGLGGDGGLGDGLDGDO');
  put(grid, 27, 4, 'O'.repeat(23));

  put(grid, 23, 25, 'P');
  put(grid, 24, 24, 'PYP');
  put(grid, 25, 25, 'D');
  put(grid, 24, 5, 'c');
  put(grid, 25, 5, 'D');
}

/** The ghost floats `rise` pixels up, behind the stone that hides its hem. */
function frame(ms, rise) {
  const grid = blank();

  ghost().forEach((row, y) => put(grid, y - rise, 0, row.join('').replaceAll('.', ' ')));

  put(grid, 3 - rise, 12, 'yYYYYYYy');
  tombstone(grid);
  return { grid, ms };
}

/** A haloed ghost bobbing above its own tombstone. */
export function frames() {
  return [frame(300, 1), frame(260, 2), frame(300, 3), frame(260, 2)];
}
