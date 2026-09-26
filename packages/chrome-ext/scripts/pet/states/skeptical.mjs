import { base, clearFace, put, shadow } from '../canvas.mjs';

/** One eye narrowed under a lowered brow, the other wide under a raised one; `look` shifts both eyes sideways. */
function face(grid, look) {
  clearFace(grid);
  put(grid, 16, 8, 'PP');
  put(grid, 17, 8, 'PP');
  put(grid, 16, 22, 'PP');
  put(grid, 17, 22, 'PP');

  put(grid, 11, 10, 'OOO');
  put(grid, 13, 10 + look, 'OOO');
  put(grid, 14, 10 + look, 'WKK');
  put(grid, 15, 10 + look, 'KKK');

  put(grid, 9, 20, 'OO');
  put(grid, 10, 19, 'O');
  put(grid, 12, 19 + look, 'KKK');
  put(grid, 13, 19 + look, 'WKK');
  put(grid, 14, 19 + look, 'KKK');
  put(grid, 15, 19 + look, 'KKK');

  put(grid, 18, 14, 'OOO');
  put(grid, 17, 17, 'O');
}

function questionMark(grid, y) {
  put(grid, y, 26, 'KKK');
  put(grid, y + 1, 26, '  K');
  put(grid, y + 2, 26, ' K ');
  put(grid, y + 4, 26, ' K ');
}

function frame(ms, look, questionAt = null) {
  const grid = base();
  face(grid, look);

  if (questionAt !== null) {
    questionMark(grid, questionAt);
  }

  return { grid: shadow(grid, 14), ms };
}

/** Eyes the script left and right, then a question mark pops up. */
export function frames() {
  return [frame(800, 0), frame(450, -1), frame(450, 1), frame(110, 0, 4), frame(900, 0, 3), frame(500, 0)];
}
