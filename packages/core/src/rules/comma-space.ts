import type { IToken } from 'chevrotain';
import { commaToken } from '../lexer.js';
import type { Rule, Finding } from '../types.js';
import { tokenRange } from '../token.js';
import { closesLine, gapRuns, horizontalGap, opensLine } from './utils/whitespace.js';

/*
 * Tokens and comments in one stream, by position.
 *
 * A comma is separated from whatever stands next to it, and a comment counts:
 * `Load A,/* why *\/ B` is as unseparated as `Load A,B`. Reading only the token
 * stream would step over the comment and measure the gap to `B` instead.
 */
function contentInOrder(tokens: IToken[], comments: IToken[]): IToken[] {
  return [...tokens, ...comments].sort((a, b) => a.startOffset - b.startOffset);
}

export const commaSpace: Rule<undefined, 'comma-space'> = {
  id: 'comma-space',
  defaultSeverity: 'warning',
  defaultOptions: undefined,
  check: ({ source, tokens, comments, whitespaces }) => {
    const out: Finding[] = [];
    const content = contentInOrder(tokens, comments);

    for (let index = 0; index < content.length; index++) {
      const token = content[index];

      if (token.tokenType !== commaToken) {
        continue;
      }

      const prev = content[index - 1];
      const next = content[index + 1];

      /*
       * A comma opening its line is left alone: where a comma sits is not this
       * rule's concern, and what stands before it there is indentation.
       */
      if (prev !== undefined && !opensLine(whitespaces, token)) {
        const runs = horizontalGap(whitespaces, prev, token);

        if (runs !== undefined) {
          out.push({
            range: tokenRange(token),
            message: "Unexpected space before ','.",
            fix: { range: { start: runs[0].startOffset, end: token.startOffset }, replacement: '' },
          });
        }
      }

      /* A comma closing its line has nothing after it to be separated from. */
      if (next === undefined || closesLine(whitespaces, token, source.length)) {
        continue;
      }

      const runs = gapRuns(whitespaces, token, next);

      if (runs === undefined) {
        continue;
      }

      const gap = runs.map((run) => run.image).join('');

      if (gap === ' ') {
        continue;
      }

      out.push({
        range: tokenRange(token),
        message: gap.length === 0 ? "Expected a space after ','." : "Expected exactly one space after ','.",
        fix: {
          range: { start: (token.endOffset ?? token.startOffset) + 1, end: next.startOffset },
          replacement: ' ',
        },
      });
    }

    return out;
  },
};
