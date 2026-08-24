import { tokenMatcher } from 'chevrotain';
import { identifierToken, keywordToken } from '../lexer.js';
import type { Rule, Finding } from '../types.js';
import { tokenRange } from '../token.js';

const SEGMENT = /[A-Za-z_][A-Za-z0-9_]*/;
const PATTERN = new RegExp(`^${SEGMENT.source}(?:\\.${SEGMENT.source})*$`);

export const variableCharset: Rule<undefined, 'variable-charset'> = {
  id: 'variable-charset',
  defaultSeverity: 'warning',
  defaultOptions: undefined,
  check: ({ tokens }) => {
    const out: Finding[] = [];

    for (let index = 0; index < tokens.length - 1; index++) {
      const token = tokens[index];

      if (!tokenMatcher(token, keywordToken)) {
        continue;
      }

      const image = token.image.toLowerCase();

      if (image !== 'set' && image !== 'let') {
        continue;
      }

      const next = tokens[index + 1];

      if (next.tokenType !== identifierToken) {
        continue;
      }

      if (PATTERN.test(next.image)) {
        continue;
      }

      out.push({
        range: tokenRange(next),
        message:
          `Variable '${next.image}' must consist of letters, digits and underscores. ` +
          `Use dots only to separate segments (e.g. 'vL.MyVar'); ` +
          `each segment must start with a letter or underscore.`,
      });
    }

    return out;
  },
};
