import { builtinFunctionToken, FUNCTIONS } from '../lexer.js';
import type { Rule, Finding } from '../types.js';
import { tokenRange, tokenFix } from '../token.js';
import { CASE_OPTIONS_SCHEMA, type CaseStyle, type CaseRuleOptions } from './types.js';

const canonicalFunctionByLower = new Map(FUNCTIONS.map((name) => [name.toLowerCase(), name]));

function applyCaseStyle(canonical: string, style: CaseStyle): string {
  switch (style) {
    case 'pascal':
      return canonical;
    case 'lower':
      return canonical.toLowerCase();
    case 'upper':
      return canonical.toUpperCase();
  }
}

export const builtinFunctionCase: Rule<CaseRuleOptions, 'builtin-function-case'> = {
  id: 'builtin-function-case',
  defaultSeverity: 'warning',
  defaultOptions: { style: 'pascal' },
  options: CASE_OPTIONS_SCHEMA,
  check: ({ tokens }, { style }) => {
    const out: Finding[] = [];

    for (const token of tokens) {
      if (token.tokenType !== builtinFunctionToken) {
        continue;
      }

      const canonical = canonicalFunctionByLower.get(token.image.toLowerCase());

      if (!canonical) {
        continue;
      }

      const expected = applyCaseStyle(canonical, style);

      if (token.image !== expected) {
        out.push({
          range: tokenRange(token),
          message: `Built-in function '${token.image}' should be written as '${expected}'.`,
          fix: tokenFix(token, expected),
        });
      }
    }

    return out;
  },
};
