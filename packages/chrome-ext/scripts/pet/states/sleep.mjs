import { base, clearFace, put, shadow, squash } from '../canvas.mjs';

/** `bubble` is the snot bubble's size: 0 none, 1 small, 2 blown up. */
function face(grid, bubble) {
  clearFace(grid);
  put(grid, 16, 8, 'PP');
  put(grid, 17, 8, 'PP');
  put(grid, 16, 22, 'PP');
  put(grid, 17, 22, 'PP');

  for (const x of [10, 19]) {
    put(grid, 14, x, 'K K');
    put(grid, 15, x, ' K ');
  }

  put(grid, 18, 15, 'OO');

  if (bubble === 1) {
    put(grid, 17, 17, 'cc');
    put(grid, 18, 17, 'cc');
  }

  if (bubble === 2) {
    put(grid, 16, 17, ' cc ');
    put(grid, 17, 17, 'cWCc');
    put(grid, 18, 17, 'cCCc');
    put(grid, 19, 17, ' cc ');
  }
}

// small to large, rising away from the head
const ZS = [
  { x: 26, y: 12, rows: ['qqq', '  q', ' q ', 'q  ', 'qqq'] },
  { x: 28, y: 6, rows: ['qqqq', '  q ', ' q  ', 'qqqq'] },
  { x: 25, y: 0, rows: ['qqqqq', '   q ', '  q  ', ' q   ', 'qqqqq'] },
];

function frame(ms, exhaling, bubble, zs) {
  let grid = base();
  face(grid, bubble);

  if (exhaling) {
    grid = squash(grid);
  }

  for (const i of zs) {
    const { x, y, rows } = ZS[i];
    rows.forEach((row, k) => put(grid, y + k, x, row));
  }

  return { grid: shadow(grid, exhaling ? 15 : 14), ms };
}

/** Breathing slowly, a snot bubble swelling while Zs drift off. */
export function frames() {
  return [
    frame(550, false, 1, [0]),
    frame(550, false, 2, [0, 1]),
    frame(550, true, 2, [0, 1, 2]),
    frame(550, true, 1, [1, 2]),
    frame(550, false, 0, [2]),
    frame(550, false, 0, []),
  ];
}
