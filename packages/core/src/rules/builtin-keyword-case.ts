import { tokenMatcher } from 'chevrotain';
import { keywordToken, traceKeywordToken, KEYWORDS } from '../lexer.js';
import type { Rule, Finding } from '../types.js';
import { tokenRange, tokenFix } from '../token.js';
import { CASE_OPTIONS_SCHEMA, type CaseStyle, type CaseRuleOptions } from './types.js';

const canonicalKeywordByLower = new Map(KEYWORDS.map((name) => [name.toLowerCase(), name]));

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

export const builtinKeywordCase: Rule<CaseRuleOptions, 'builtin-keyword-case'> = {
  id: 'builtin-keyword-case',
  defaultSeverity: 'warning',
  defaultOptions: { style: 'pascal' },
  options: CASE_OPTIONS_SCHEMA,
  check: ({ tokens }, { style }) => {
    const out: Finding[] = [];

    for (const token of tokens) {
      if (!tokenMatcher(token, keywordToken) && token.tokenType !== traceKeywordToken) {
        continue;
      }

      const canonical = canonicalKeywordByLower.get(token.image.toLowerCase());

      if (!canonical) {
        continue;
      }

      const expected = applyCaseStyle(canonical, style);

      if (token.image !== expected) {
        out.push({
          range: tokenRange(token),
          message: `Keyword '${token.image}' should be written as '${expected}'.`,
          fix: tokenFix(token, expected),
        });
      }
    }

    return out;
  },
};
