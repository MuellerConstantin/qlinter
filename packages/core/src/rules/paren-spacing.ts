import { tokenMatcher, type IToken } from 'chevrotain';
import {
  builtinFunctionToken,
  colonToken,
  commaToken,
  equalsToken,
  punctuationToken,
  semicolonToken,
} from '../lexer.js';
import type { Rule, Finding } from '../types.js';
import { tokenRange } from '../token.js';
import { horizontalGap } from './utils/whitespace.js';

/*
 * Only built-in function calls are considered; keywords and grouping parens are
 * left alone.
 *
 * A gap is rewritten only when it is pure spaces or tabs. One spanning a line
 * break or containing a comment is left untouched: rewriting it would mean
 * taking over indentation and comment placement, which this rule does not own.
 *
 * An empty gap stays empty, on every side. A dollar-sign expansion is spliced in
 * as text, so the `)` closing one can sit in the middle of a name and a space
 * put there would split it.
 *
 * @see {@link https://help.qlik.com/en-US/sense/May2026/Subsystems/Hub/Content/Sense_Hub/Scripting/Variables/dollar-sign-expansion-using-variable.htm | Dollar-sign expansion using a variable}
 */

const isParen = (token: IToken | undefined, image: string): boolean =>
  token !== undefined && token.tokenType === punctuationToken && token.image === image;

/*
 * A token that stands on its own: a keyword, a name, a literal. The punctuation
 * marks are excluded because the gap on their far side already has an owner.
 */
const isWord = (token: IToken): boolean =>
  !(
    tokenMatcher(token, punctuationToken) ||
    tokenMatcher(token, commaToken) ||
    tokenMatcher(token, equalsToken) ||
    tokenMatcher(token, semicolonToken) ||
    tokenMatcher(token, colonToken)
  );

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

        // One space between the closing paren and the word after it.
        if (next !== undefined && isWord(next)) {
          const runs = horizontalGap(whitespaces, token, next);
          if (runs !== undefined && !(runs.length === 1 && runs[0].image === ' ')) {
            out.push({
              range: tokenRange(token),
              message: "Expected exactly one space after ')'.",
              fix: { range: { start: runs[0].startOffset, end: next.startOffset }, replacement: ' ' },
            });
          }
        }
      }
    }

    return out;
  },
};
