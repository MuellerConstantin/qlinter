import type { IToken } from 'chevrotain';
import type { Rule, Finding, RuleContext } from '../types.js';
import { tokenRange } from '../token.js';
import { fixStartOffset } from './utils/fixes.js';
import { loadLineOpeners } from './utils/load-anchors.js';
import { splitStatements } from './utils/statements.js';

function checkStatement(tokens: IToken[], whitespaces: IToken[], lineEnding: string): Finding[] {
  const out: Finding[] = [];

  for (const clause of loadLineOpeners(tokens)?.clauses ?? []) {
    const prev = tokens[tokens.indexOf(clause) - 1];

    if (prev !== undefined && (prev.startLine ?? 1) === (clause.startLine ?? 1)) {
      out.push({
        range: tokenRange(clause),
        message: `LOAD clause '${clause.image}' should start on its own line.`,
        fix: {
          range: { start: fixStartOffset(whitespaces, prev, clause), end: clause.startOffset },
          replacement: lineEnding,
        },
      });
    }
  }

  return out;
}

export const loadClauseNewline: Rule<undefined, 'load-clause-newline'> = {
  id: 'load-clause-newline',
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
