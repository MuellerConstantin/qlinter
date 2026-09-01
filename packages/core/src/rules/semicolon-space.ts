import { tokenMatcher, type IToken } from 'chevrotain';
import { semicolonToken } from '../lexer.js';
import { tokenRange } from '../token.js';
import type { Finding, Rule } from '../types.js';

const endOf = (token: IToken): number => (token.endOffset ?? token.startOffset) + 1;

/*
 * The gap is read between the two tokens rather than backwards through the
 * source, so characters a token owns can never be consumed: the body of a Trace
 * runs up to its terminator, and the spaces before that `;` are message text.
 *
 * A gap carrying a line break or a comment is left alone — where the terminator
 * sits, and what stands before it, are not this rule's to decide.
 */
function closableGap(source: string, prev: IToken, token: IToken): string | undefined {
  const gap = source.slice(endOf(prev), token.startOffset);

  return /^[ \t]+$/.test(gap) ? gap : undefined;
}

export const semicolonSpace: Rule<undefined, 'semicolon-space'> = {
  id: 'semicolon-space',
  defaultSeverity: 'warning',
  defaultOptions: undefined,
  check: ({ source, tokens }) => {
    const out: Finding[] = [];

    for (let index = 1; index < tokens.length; index++) {
      const token = tokens[index];

      if (!tokenMatcher(token, semicolonToken)) {
        continue;
      }

      const prev = tokens[index - 1];

      if (closableGap(source, prev, token) === undefined) {
        continue;
      }

      out.push({
        range: tokenRange(token),
        message: "Unexpected space before ';'.",
        fix: { range: { start: endOf(prev), end: token.startOffset }, replacement: '' },
      });
    }

    return out;
  },
};
