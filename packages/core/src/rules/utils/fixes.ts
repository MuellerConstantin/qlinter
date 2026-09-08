import type { IToken } from 'chevrotain';
import { isLineBreak, runEndingAt } from './whitespace.js';

const endOf = (token: IToken): number => (token.endOffset ?? token.startOffset) + 1;

/*
 * Where a fix that re-spaces the gap between `prev` and `t` may start: at the
 * front of the horizontal whitespace run that ends at `t`, never further back
 * than the end of `prev`.
 *
 * The gap holds more than whitespace often enough — a comment, and in a script
 * the lexer could not read whole, a character it skipped. Taking only the run
 * the lexer reports as ending at `t` keeps the rule out of that question
 * entirely: whatever else is there survives. Where the gap holds nothing but
 * such content, the two offsets meet and the fix becomes an insertion, which is
 * the harmless end of the trade.
 */
export function fixStartOffset(whitespaces: IToken[], prev: IToken, t: IToken): number {
  const prevEnd = endOf(prev);
  let start = t.startOffset;

  for (;;) {
    const run = runEndingAt(whitespaces, start);

    if (run === undefined || isLineBreak(run) || run.startOffset < prevEnd) {
      return start;
    }

    start = run.startOffset;
  }
}
