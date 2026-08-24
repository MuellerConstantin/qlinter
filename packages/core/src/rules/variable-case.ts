import { identifierToken, keywordToken } from '../lexer.js';
import type { Rule, Finding } from '../types.js';
import { tokenRange } from '../token.js';

/**
 * Naming styles for script variables. The array is the source; the union type is
 * derived from it, so a new style is added in exactly one place and reaches the
 * config validation and any options UI unbidden.
 */
export const VARIABLE_CASE_STYLES = ['camel', 'pascal', 'snake', 'upperSnake'] as const;

export type VariableCaseStyle = (typeof VARIABLE_CASE_STYLES)[number];

export interface VariableCaseOptions {
  style: VariableCaseStyle;
}

const PATTERNS: Record<VariableCaseStyle, RegExp> = {
  camel: /^\p{Ll}[\p{L}0-9]*$/u,
  pascal: /^\p{Lu}[\p{L}0-9]*$/u,
  snake: /^\p{Ll}[\p{Ll}0-9]*(?:_[\p{Ll}0-9]+)*$/u,
  upperSnake: /^\p{Lu}[\p{Lu}0-9]*(?:_[\p{Lu}0-9]+)*$/u,
};

const LABELS: Record<VariableCaseStyle, string> = {
  camel: 'camelCase',
  pascal: 'PascalCase',
  snake: 'snake_case',
  upperSnake: 'UPPER_SNAKE_CASE',
};

export const variableCase: Rule<VariableCaseOptions, 'variable-case'> = {
  id: 'variable-case',
  defaultSeverity: 'warning',
  defaultOptions: { style: 'camel' },
  options: { style: { type: 'enum', values: VARIABLE_CASE_STYLES } },
  check: ({ tokens }, { style }) => {
    const out: Finding[] = [];
    const pattern = PATTERNS[style];

    for (let index = 0; index < tokens.length - 1; index++) {
      const token = tokens[index];

      if (token.tokenType !== keywordToken) {
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

      if (pattern.test(next.image)) {
        continue;
      }

      out.push({
        range: tokenRange(next),
        message: `Variable '${next.image}' should be written in ${LABELS[style]}.`,
      });
    }

    return out;
  },
};
