import { tokenMatcher, type IToken } from 'chevrotain';
import { backtickIdentifierToken, quotedIdentifierToken } from '../lexer.js';
import { tokenFix, tokenRange } from '../token.js';
import type { Finding, Rule } from '../types.js';
import { collectStatementSpans, findAtTopLevel, findLoadIndex } from './utils/statements.js';
import { isKeyword } from './utils/tokens.js';

/*
 * The name a delimited identifier stands for. Inside double quotes a doubled
 * quote counts as one; the reference documents no such escape for an accent, so
 * that form is taken literally.
 */
function nameOf(token: IToken): string {
  const inner = token.image.slice(1, -1);

  return tokenMatcher(token, quotedIdentifierToken) ? inner.replace(/""/g, '"') : inner;
}

/*
 * A Qlik Load, and never a passthrough Select. The text of a Select reaches the
 * database untouched, where the delimiter for a name is that database's own:
 * `"..."` is the ANSI form every engine accepts, while `[...]` is SQL Server's
 * alone and a syntax error elsewhere.
 */
function isQlikLoad(tokens: IToken[]): boolean {
  return findLoadIndex(tokens) !== -1 && findAtTopLevel(tokens, (token) => isKeyword(token, 'select')) === -1;
}

export const loadIdentifierBrackets: Rule<undefined, 'load-identifier-brackets'> = {
  id: 'load-identifier-brackets',
  defaultSeverity: 'warning',
  defaultOptions: undefined,
  check: ({ tokens }) => {
    const out: Finding[] = [];

    /*
     * Only inside a Qlik Load. A double-quoted name is a field reference there,
     * but in an expression elsewhere it is a variable reference, and brackets
     * can only ever mean the field.
     */
    for (const statement of collectStatementSpans(tokens).filter((s) => isQlikLoad(s.tokens))) {
      for (const token of statement.tokens) {
        if (!tokenMatcher(token, quotedIdentifierToken) && !tokenMatcher(token, backtickIdentifierToken)) {
          continue;
        }

        const name = nameOf(token);

        /* A bracket runs to the first `]` and an empty one names nothing: neither name has a bracket form. */
        if (name.length === 0 || name.includes(']')) {
          continue;
        }

        out.push({
          range: tokenRange(token),
          message: `The identifier ${token.image} should be enclosed in brackets: '[${name}]'.`,
          fix: tokenFix(token, `[${name}]`),
        });
      }
    }

    return out;
  },
};
