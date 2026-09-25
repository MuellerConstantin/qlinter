import type { IToken } from 'chevrotain';
import type { Rule, Finding, RuleContext } from '../types.js';
import { tokenRange } from '../token.js';
import { fixStartOffset } from './utils/fixes.js';
import { loadLineOpeners } from './utils/load-anchors.js';
import { splitStatements } from './utils/statements.js';

function makeFinding(prev: IToken, t: IToken, whitespaces: IToken[], lineEnding: string): Finding {
  return {
    range: tokenRange(t),
    message: 'Each LOAD field should start on its own line.',
    fix: {
      range: { start: fixStartOffset(whitespaces, prev, t), end: t.startOffset },
      replacement: lineEnding,
    },
  };
}

function checkStatement(tokens: IToken[], whitespaces: IToken[], lineEnding: string): Finding[] {
  const out: Finding[] = [];

  for (const field of loadLineOpeners(tokens)?.fields ?? []) {
    const prev = tokens[tokens.indexOf(field) - 1];

    if (prev !== undefined && (prev.startLine ?? 1) === (field.startLine ?? 1)) {
      out.push(makeFinding(prev, field, whitespaces, lineEnding));
    }
  }

  return out;
}

export const loadFieldPerLine: Rule<undefined, 'load-field-per-line'> = {
  id: 'load-field-per-line',
  defaultSeverity: 'warning',
  defaultOptions: undefined,
  check: ({ tokens, whitespaces, lineEnding }: RuleContext) => {
    const stmts = splitStatements(tokens);
    const out: Finding[] = [];

    for (const stmt of stmts) {
      out.push(...checkStatement(stmt, whitespaces, lineEnding));
    }

    return out;
  },
};
