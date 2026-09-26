import { tokenMatcher, type IToken } from 'chevrotain';
import { semicolonToken, sqlEndToken, traceEndToken } from '../lexer.js';
import { tokenRange } from '../token.js';
import type { Finding, Fix, Rule } from '../types.js';
import { deleteLineRange } from './utils/lines.js';
import type { LineSpan } from '../lines.js';
import { closesLine, opensLine, whitespaceStartBefore } from './utils/whitespace.js';

/*
 * Whether Qlik reads a `;` quoted inside a SQL command or a Trace message as its
 * end is unmeasured, while the lexer ends both at the first one. Every `;` in the
 * run after such an end may still be text of that body, so it is reported and
 * not removed.
 */
function endsUnmeasuredBody(token: IToken): boolean {
  return tokenMatcher(token, sqlEndToken) || tokenMatcher(token, traceEndToken);
}

function removal(whitespaces: IToken[], lines: LineSpan[], token: IToken): Fix {
  const opens = opensLine(whitespaces, lines, token);

  if (opens && closesLine(whitespaces, lines, token)) {
    const line = token.startLine ?? 1;

    return deleteLineRange(lines, line, line);
  }

  /* Behind code, the blanks separating the `;` from it go too; opening a line, its indent stays for what follows. */
  const start = opens ? token.startOffset : whitespaceStartBefore(whitespaces, token.startOffset);

  return { range: { start, end: token.startOffset + 1 }, replacement: '' };
}

export const noEmptyStatement: Rule<undefined, 'no-empty-statement'> = {
  id: 'no-empty-statement',
  defaultSeverity: 'warning',
  defaultOptions: undefined,
  check: ({ tokens, whitespaces, lines }) => {
    const out: Finding[] = [];
    let unmeasured = false;

    for (let index = 0; index < tokens.length; index++) {
      const token = tokens[index];
      const prev = tokens[index - 1];

      if (!tokenMatcher(token, semicolonToken)) {
        unmeasured = false;
        continue;
      }

      if (prev === undefined || tokenMatcher(prev, semicolonToken)) {
        out.push({
          range: tokenRange(token),
          message: "Unnecessary ';' ending an empty statement.",
          ...(unmeasured ? {} : { fix: removal(whitespaces, lines, token) }),
        });
      }

      unmeasured ||= endsUnmeasuredBody(token);
    }

    return out;
  },
};
