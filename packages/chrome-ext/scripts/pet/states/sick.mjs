import { base, clearFace, put, shadow, squash, stretch } from '../canvas.mjs';

function scarf(grid) {
  // ribbed every third column and a pixel wider than the body, so it reads as knitted and wrapped around
  put(grid, 20, 5, 'ehhghhghhghhghhghhghe');
  put(grid, 21, 5, 'egggegggegggegggeggge');
  put(grid, 22, 6, 'eeeeeeeeeeeeeeeeeeee');
  put(grid, 22, 9, 'hge');
  put(grid, 23, 9, 'hge');
  put(grid, 24, 9, 'gge');
  put(grid, 25, 9, 'h h');
}

function feverishCheeks(grid) {
  put(grid, 16, 8, 'RR');
  put(grid, 17, 8, 'RR');
  put(grid, 16, 22, 'RR');
  put(grid, 17, 22, 'RR');
}

function droopyFace(grid) {
  for (const x of [10, 19]) {
    put(grid, 13, x, 'OOO');
    put(grid, 14, x, 'WKK');
    put(grid, 15, x, 'KKK');
  }

  put(grid, 18, 14, 'O  O');
  put(grid, 17, 15, 'OO');
}

function scrunchedEyes(grid) {
  put(grid, 13, 10, 'K');
  put(grid, 14, 11, 'K');
  put(grid, 15, 10, 'K');
  put(grid, 13, 21, 'K');
  put(grid, 14, 20, 'K');
  put(grid, 15, 21, 'K');
}

function inhalingMouth(grid) {
  put(grid, 17, 15, 'OO');
  put(grid, 18, 15, 'OO');
}

function sneezingMouth(grid) {
  put(grid, 17, 13, 'GOOOOG');
  put(grid, 18, 13, 'OKKKKO');
  put(grid, 19, 13, 'OKRRKO');
}

function sweat(grid) {
  put(grid, 8, 24, 'c');
  put(grid, 9, 23, 'ccc');
  put(grid, 10, 23, 'ccc');
}

function spray(grid, far) {
  const drops = far
    ? [
        [1, 13],
        [2, 17],
        [0, 20],
        [29, 12],
        [30, 16],
        [28, 19],
      ]
    : [
        [4, 15],
        [3, 18],
        [27, 14],
        [28, 17],
      ];

  for (const [x, y] of drops) {
    put(grid, y, x, 'c');
  }
}

function sick(...changes) {
  const grid = base();
  clearFace(grid);
  feverishCheeks(grid);
  scarf(grid);
  changes.forEach((change) => change(grid));
  return grid;
}

/** Wrapped in a scarf: winds up, sneezes, sags. */
export function frames() {
  const sneeze = squash(sick(scrunchedEyes, sneezingMouth));
  spray(sneeze, false);
  const after = sick(scrunchedEyes);
  put(after, 18, 14, 'OOOO');
  spray(after, true);

  return [
    { grid: shadow(sick(droopyFace, sweat), 14), ms: 900 },
    { grid: shadow(stretch(sick(scrunchedEyes, inhalingMouth)), 13), ms: 260 },
    { grid: shadow(stretch(stretch(sick(scrunchedEyes, inhalingMouth))), 12), ms: 220 },
    { grid: shadow(sneeze, 16), ms: 200 },
    { grid: shadow(after, 14), ms: 200 },
    { grid: shadow(sick(droopyFace), 14), ms: 700 },
  ];
}
