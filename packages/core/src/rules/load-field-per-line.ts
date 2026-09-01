import type { IToken } from 'chevrotain';
import { commaToken } from '../lexer.js';
import type { Rule, Finding, RuleContext } from '../types.js';
import { tokenRange } from '../token.js';
import { fixStartOffset } from './utils/fixes.js';
import { detectLineEnding } from './utils/lines.js';
import { findFieldListBoundaries, findLoadIndex, splitStatements } from './utils/statements.js';
import { isCloseParen, isOpenParen } from './utils/tokens.js';

function makeFinding(prev: IToken, t: IToken, source: string, newline: string): Finding {
  return {
    range: tokenRange(t),
    message: 'Each LOAD field should start on its own line.',
    fix: {
      range: { start: fixStartOffset(prev, t, source), end: t.startOffset },
      replacement: newline,
    },
  };
}

function checkStatement(tokens: IToken[], source: string, newline: string): Finding[] {
  const loadIdx = findLoadIndex(tokens);

  if (loadIdx === -1) {
    return [];
  }

  const { start, end } = findFieldListBoundaries(tokens, loadIdx);

  if (start >= end) {
    return [];
  }

  const out: Finding[] = [];
  const header = tokens[start - 1];
  const firstField = tokens[start];

  if ((header.startLine ?? 1) === (firstField.startLine ?? 1)) {
    out.push(makeFinding(header, firstField, source, newline));
  }

  let depth = 0;

  for (let i = start; i < end; i++) {
    const t = tokens[i];

    if (isOpenParen(t)) {
      depth++;
      continue;
    }

    if (isCloseParen(t)) {
      depth--;
      continue;
    }

    if (depth !== 0 || t.tokenType !== commaToken) {
      continue;
    }

    const next = tokens[i + 1];

    if (!next || i + 1 >= end) {
      continue;
    }

    if ((next.startLine ?? 1) === (t.startLine ?? 1)) {
      out.push(makeFinding(t, next, source, newline));
    }
  }

  return out;
}

export const loadFieldPerLine: Rule<undefined, 'load-field-per-line'> = {
  id: 'load-field-per-line',
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
