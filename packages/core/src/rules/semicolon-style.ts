import { tokenMatcher } from 'chevrotain';
import { semicolonToken } from '../lexer.js';
import { tokenRange } from '../token.js';
import type { Finding, Rule } from '../types.js';
import { horizontalEndAfter, runEndingAt, whitespaceStartBefore } from './utils/whitespace.js';

export const semicolonStyle: Rule<undefined, 'semicolon-style'> = {
  id: 'semicolon-style',
  defaultSeverity: 'warning',
  defaultOptions: undefined,
  // eslint-disable-next-line no-restricted-syntax -- the gap before the terminator travels into the fix byte for byte, comments and all
  check: ({ source, tokens, whitespaces }) => {
    const out: Finding[] = [];

    for (let index = 1; index < tokens.length; index++) {
      const token = tokens[index];

      if (!tokenMatcher(token, semicolonToken)) {
        continue;
      }

      const prev = tokens[index - 1];

      /* A `;` after a `;` ends an empty statement, and there is no line of it to join. */
      if (tokenMatcher(prev, semicolonToken)) {
        continue;
      }

      const gapStart = (prev.endOffset ?? prev.startOffset) + 1;

      /*
       * A body the lexer keeps whole runs right up to its `;`, line breaks
       * included, so the gap is empty and the break is the body's own text.
       */
      if (gapStart === token.startOffset || (prev.endLine ?? prev.startLine) === token.startLine) {
        continue;
      }

      const gap = source.slice(gapStart, token.startOffset);
      const after = (token.endOffset ?? token.startOffset) + 1;
      const next = tokens[index + 1];

      /*
       * With a token following on the terminator's line, the gap moves behind
       * the `;` whole and keeps separating the two; the blanks after the `;`
       * go with it. Otherwise the break after the `;` already ends the line, and
       * only what the gap holds besides trailing whitespace is kept.
       */
      const followedOnLine = next !== undefined && next.startLine === token.startLine;

      out.push({
        range: tokenRange(token),
        message: "Expected ';' at the end of the statement's last line.",
        fix: followedOnLine
          ? {
              range: {
                start: gapStart,
                end:
                  runEndingAt(whitespaces, token.startOffset) === undefined
                    ? after
                    : horizontalEndAfter(whitespaces, after),
              },
              replacement: `;${gap}`,
            }
          : {
              range: { start: gapStart, end: after },
              replacement: `;${source.slice(gapStart, whitespaceStartBefore(whitespaces, token.startOffset))}`,
            },
      });
    }

    return out;
  },
};
