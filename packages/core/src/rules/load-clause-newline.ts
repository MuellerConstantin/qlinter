import type { IToken } from 'chevrotain';
import type { Rule, Finding, RuleContext } from '../types.js';
import { tokenRange } from '../token.js';
import { fixStartOffset } from './utils/fixes.js';
import { detectLineEnding } from './utils/lines.js';
import { findLoadIndex, isClauseStarter, splitStatements } from './utils/statements.js';
import { isCloseParen, isOpenParen } from './utils/tokens.js';

function checkStatement(tokens: IToken[], source: string, newline: string): Finding[] {
  const loadIdx = findLoadIndex(tokens);

  if (loadIdx === -1) {
    return [];
  }

  const out: Finding[] = [];
  let depth = 0;
  let prev = tokens[loadIdx];

  for (let i = loadIdx + 1; i < tokens.length; i++) {
    const t = tokens[i];

    if (isOpenParen(t)) {
      depth++;
    } else if (isCloseParen(t)) {
      depth--;
    }

    if (depth === 0 && isClauseStarter(t)) {
      const prevLine = prev.startLine ?? 1;
      const tLine = t.startLine ?? 1;

      if (prevLine === tLine) {
        out.push({
          range: tokenRange(t),
          message: `LOAD clause '${t.image}' should start on its own line.`,
          fix: {
            range: { start: fixStartOffset(prev, t, source), end: t.startOffset },
            replacement: newline,
          },
        });
      }
    }

    prev = t;
  }

  return out;
}

export const loadClauseNewline: Rule<undefined, 'load-clause-newline'> = {
  id: 'load-clause-newline',
  defaultSeverity: 'warning',
  defaultOptions: undefined,
  check: ({ source, tokens }: RuleContext) => {
    const newline = detectLineEnding(source);
    const stmts = splitStatements(tokens);
    const out: Finding[] = [];

    for (const stmt of stmts) {
      out.push(...checkStatement(stmt, source, newline));
    }

    return out;
  },
};
