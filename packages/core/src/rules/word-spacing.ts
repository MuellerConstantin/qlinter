import { tokenMatcher, type IToken } from 'chevrotain';
import { colonToken, commaToken, equalsToken, punctuationToken, semicolonToken } from '../lexer.js';
import { tokenRange } from '../token.js';
import type { Finding, Rule } from '../types.js';

const endOf = (token: IToken): number => (token.endOffset ?? token.startOffset) + 1;

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
  check: ({ source, tokens }) => {
    const out: Finding[] = [];

    for (let index = 1; index < tokens.length; index++) {
      const token = tokens[index];
      const prev = tokens[index - 1];

      if (!isWord(prev) || !isWord(token)) {
        continue;
      }

      /*
       * Read between the two tokens, so characters a token owns stay untouched.
       * The gap has to be whitespace already: an empty one is left empty, which
       * keeps the rule from inventing a separation where the author wrote none,
       * and one carrying a line break or a comment belongs to somebody else.
       */
      const gap = source.slice(endOf(prev), token.startOffset);

      if (gap === ' ' || !/^[ \t]+$/.test(gap)) {
        continue;
      }

      out.push({
        range: tokenRange(token),
        message: 'Expected exactly one space between words.',
        fix: { range: { start: endOf(prev), end: token.startOffset }, replacement: ' ' },
      });
    }

    return out;
  },
};
