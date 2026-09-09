import { commaToken } from '../lexer.js';
import type { Rule, Finding } from '../types.js';
import { tokenRange } from '../token.js';
import { contentInOrder } from './utils/gaps.js';
import { closesLine, gapRuns, horizontalGap, opensLine } from './utils/whitespace.js';

export const commaSpace: Rule<undefined, 'comma-space'> = {
  id: 'comma-space',
  defaultSeverity: 'warning',
  defaultOptions: undefined,
  check: ({ tokens, comments, whitespaces, lines }) => {
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
      if (prev !== undefined && !opensLine(whitespaces, lines, token)) {
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
      if (next === undefined || closesLine(whitespaces, lines, token)) {
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
