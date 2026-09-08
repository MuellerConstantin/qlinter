import { tokenMatcher, type IToken } from 'chevrotain';
import { colonToken, commaToken, equalsToken, punctuationToken, semicolonToken } from '../lexer.js';
import { tokenRange } from '../token.js';
import type { Finding, Rule } from '../types.js';
import { horizontalGap } from './utils/whitespace.js';

/*
 * A word is anything that is not punctuation: a keyword, a name in any of its
 * delimited forms, a literal. The gaps around punctuation each have an owner
 * already, and the arithmetic characters are deliberately left to nobody —
 * taking them over here would undo that decision.
 */
function isWord(token: IToken): boolean {
  return !(
    tokenMatcher(token, punctuationToken) ||
    tokenMatcher(token, commaToken) ||
    tokenMatcher(token, equalsToken) ||
    tokenMatcher(token, semicolonToken) ||
    tokenMatcher(token, colonToken)
  );
}

export const wordSpacing: Rule<undefined, 'word-spacing'> = {
  id: 'word-spacing',
  defaultSeverity: 'warning',
  defaultOptions: undefined,
  check: ({ tokens, whitespaces }) => {
    const out: Finding[] = [];

    for (let index = 1; index < tokens.length; index++) {
      const token = tokens[index];
      const prev = tokens[index - 1];

      if (!isWord(prev) || !isWord(token)) {
        continue;
      }

      /*
       * The gap must be whitespace the lexer itself reported, and nothing else.
       * An empty one is left empty, which keeps the rule from inventing a
       * separation where the author wrote none; one carrying a line break or
       * anything the walk cannot cross belongs to somebody else.
       */
      const runs = horizontalGap(whitespaces, prev, token);

      if (runs === undefined) {
        continue;
      }

      if (runs.length === 1 && runs[0].image === ' ') {
        continue;
      }

      out.push({
        range: tokenRange(token),
        message: 'Expected exactly one space between words.',
        fix: { range: { start: runs[0].startOffset, end: token.startOffset }, replacement: ' ' },
      });
    }

    return out;
  },
};
