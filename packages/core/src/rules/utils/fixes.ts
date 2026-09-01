import type { IToken } from 'chevrotain';

/*
 * Where a fix that re-spaces the gap between `prev` and `t` may start: at the
 * front of the whitespace run that ends at `t`, never further back than the end
 * of `prev`.
 *
 * The gap holds more than whitespace often enough — a comment, and in a script
 * the lexer could not read whole, a character it skipped. Walking the run
 * backwards rather than reasoning about what may sit in front of it keeps the
 * rule out of that question entirely: whatever is there survives, including a
 * kind of content the lexer does not route to a group yet. Where the gap holds
 * nothing but such content, the two offsets meet and the fix becomes an
 * insertion, which is the harmless end of the trade.
 */
export function fixStartOffset(prev: IToken, t: IToken, source: string): number {
  const prevEnd = (prev.endOffset ?? prev.startOffset) + 1;
  let start = t.startOffset;

  while (start > prevEnd && (source[start - 1] === ' ' || source[start - 1] === '\t')) {
    start--;
  }

  return start;
}
