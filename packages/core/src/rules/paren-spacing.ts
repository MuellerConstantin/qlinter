import type { IToken } from 'chevrotain';
import { builtinFunctionToken, punctuationToken } from '../lexer.js';
import type { Rule, Finding } from '../types.js';
import { tokenRange } from '../token.js';
import { horizontalGap } from './utils/whitespace.js';

/*
 * Only built-in function calls are considered; keywords and grouping parens are
 * left alone.
 *
 * A gap is closed only when it is pure spaces or tabs. One spanning a line break
 * or containing a comment is left untouched: rewriting it would mean taking over
 * indentation and comment placement, which this rule does not own.
 */

const isParen = (token: IToken | undefined, image: string): boolean =>
  token !== undefined && token.tokenType === punctuationToken && token.image === image;

export const parenSpacing: Rule<undefined, 'paren-spacing'> = {
  id: 'paren-spacing',
  defaultSeverity: 'warning',
  defaultOptions: undefined,
  check: ({ tokens, whitespaces }) => {
    const out: Finding[] = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const prev = tokens[i - 1];
      const next = tokens[i + 1];

      if (isParen(token, '(')) {
        // No space between a built-in function name and its opening paren.
        if (prev !== undefined && prev.tokenType === builtinFunctionToken) {
          const runs = horizontalGap(whitespaces, prev, token);
          if (runs !== undefined) {
            out.push({
              range: tokenRange(token),
              message: "Unexpected space before '('.",
              fix: { range: { start: runs[0].startOffset, end: token.startOffset }, replacement: '' },
            });
          }
        }

        // No padding immediately inside the opening paren.
        if (next !== undefined) {
          const runs = horizontalGap(whitespaces, token, next);
          if (runs !== undefined) {
            out.push({
              range: tokenRange(token),
              message: "Unexpected space after '('.",
              fix: { range: { start: runs[0].startOffset, end: next.startOffset }, replacement: '' },
            });
          }
        }

        continue;
      }

      if (isParen(token, ')')) {
        // No padding immediately inside the closing paren. An empty `( )` is
        // already covered by the opening-paren check, so skip it here.
        if (prev !== undefined && !isParen(prev, '(')) {
          const runs = horizontalGap(whitespaces, prev, token);
          if (runs !== undefined) {
            out.push({
              range: tokenRange(token),
              message: "Unexpected space before ')'.",
              fix: { range: { start: runs[0].startOffset, end: token.startOffset }, replacement: '' },
            });
          }
        }
      }
    }

    return out;
  },
};
