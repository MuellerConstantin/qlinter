import type { IToken } from 'chevrotain';

/*
 * Find where to start the fix range so it consumes the whitespace between
 * `prev` and `t` but preserves any comment sitting in that gap.
 */
export function fixStartOffset(prev: IToken, t: IToken, comments: IToken[]): number {
  const prevEnd = (prev.endOffset ?? prev.startOffset) + 1;
  let start = prevEnd;

  for (const c of comments) {
    if (c.startOffset >= t.startOffset) {
      break;
    }

    const cEnd = (c.endOffset ?? c.startOffset) + 1;

    if (cEnd > prevEnd && cEnd > start) {
      start = cEnd;
    }
  }

  return start;
}
