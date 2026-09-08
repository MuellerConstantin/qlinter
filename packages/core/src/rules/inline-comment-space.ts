import { blockCommentToken, lineCommentToken } from '../lexer.js';
import type { Rule, Finding } from '../types.js';
import { tokenRange } from '../token.js';
import { opensLine, runEndingAt } from './utils/whitespace.js';

export const inlineCommentSpace: Rule<undefined, 'inline-comment-space'> = {
  id: 'inline-comment-space',
  defaultSeverity: 'warning',
  defaultOptions: undefined,
  check: ({ comments, whitespaces }) => {
    const out: Finding[] = [];

    for (const token of comments) {
      if (token.tokenType !== lineCommentToken && token.tokenType !== blockCommentToken) {
        continue;
      }

      /* A comment opening its line trails nothing, so there is no gap to size. */
      if (opensLine(whitespaces, token)) {
        continue;
      }

      /*
       * At most one run can end here: the lexer matches a stretch of spaces and
       * tabs as a single token, so two of them never meet.
       */
      const run = runEndingAt(whitespaces, token.startOffset);
      const gap = run === undefined ? '' : run.image;

      if (gap === ' ') {
        continue;
      }

      const marker = token.tokenType === lineCommentToken ? '//' : '/*';

      out.push({
        range: tokenRange(token),
        message:
          gap.length === 0 ? `Expected a space before '${marker}'.` : `Expected exactly one space before '${marker}'.`,
        fix: {
          range: { start: run === undefined ? token.startOffset : run.startOffset, end: token.startOffset },
          replacement: ' ',
        },
      });
    }

    return out;
  },
};
