import { tokenMatcher } from 'chevrotain';
import { semicolonToken } from '../lexer.js';
import { tokenRange } from '../token.js';
import type { Finding, Rule } from '../types.js';
import { horizontalGap } from './utils/whitespace.js';

export const semicolonSpace: Rule<undefined, 'semicolon-space'> = {
  id: 'semicolon-space',
  defaultSeverity: 'warning',
  defaultOptions: undefined,
  check: ({ tokens, whitespaces }) => {
    const out: Finding[] = [];

    for (let index = 1; index < tokens.length; index++) {
      const token = tokens[index];

      if (!tokenMatcher(token, semicolonToken)) {
        continue;
      }

      const prev = tokens[index - 1];

      /*
       * Only the runs the lexer reports between the two tokens are claimed, so
       * characters a token owns can never be consumed: the body of a Trace runs
       * up to its terminator, and the spaces before that `;` are message text.
       *
       * A gap carrying a line break, or anything the walk cannot cross, is left
       * alone — where the terminator sits, and what stands before it, are not
       * this rule's to decide.
       */
      const runs = horizontalGap(whitespaces, prev, token);

      if (runs === undefined) {
        continue;
      }

      out.push({
        range: tokenRange(token),
        message: "Unexpected space before ';'.",
        fix: { range: { start: runs[0].startOffset, end: token.startOffset }, replacement: '' },
      });
    }

    return out;
  },
};
