import type { IToken } from 'chevrotain';
import { commaToken } from '../../lexer.js';
import { groupByLine } from './lines.js';
import {
  findFieldListBoundaries,
  findLoadIndex,
  isClauseStarter,
  previousLineClosesStatement,
  splitStatements,
} from './statements.js';
import { isCloseParen, isOpenParen } from './tokens.js';

/** The header/field/clause anchors of one `Load` statement, plus the indent they hang off. */
export interface LoadAnchors {
  base: number;
  headerStarts: IToken[];
  fieldStarts: IToken[];
  clauseStarters: IToken[];
}

function collectFieldStarts(tokens: IToken[], start: number, end: number): IToken[] {
  if (start >= end) {
    return [];
  }

  const out: IToken[] = [tokens[start]];

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

    if (next && i + 1 < end) {
      out.push(next);
    }
  }

  return out;
}

function collectClauseStarters(tokens: IToken[], fieldsEnd: number): IToken[] {
  const out: IToken[] = [];
  let depth = 0;

  for (let i = fieldsEnd; i < tokens.length; i++) {
    const t = tokens[i];

    if (isOpenParen(t)) {
      depth++;
      continue;
    }

    if (isCloseParen(t)) {
      depth--;
      continue;
    }

    if (depth !== 0) {
      continue;
    }

    if (isClauseStarter(t)) {
      out.push(t);
    }
  }

  return out;
}

/*
 * The line the field/clause list hangs off: the line that opens the statement,
 * not necessarily the one the `Load` sits on. A `Load` continuing a prefixed
 * statement is itself pinned to that base, so trusting its own column would let
 * a misindented `Load` drag the field list sideways with it.
 */
function findStatementStartLine(tokens: IToken[], loadLine: number): number {
  const lines = groupByLine(tokens);
  let idx = lines.findIndex((line) => line.line === loadLine);

  if (idx === -1) {
    return loadLine;
  }

  while (idx > 0 && !previousLineClosesStatement(lines[idx - 1].tokens)) {
    idx--;
  }

  return lines[idx].line;
}

/*
 * The lines a `Load` spends on its own head before the field list starts. They
 * belong at `base`, so the field list one step deeper reads as subordinate.
 *
 * The opening line is excluded: it is a statement start and claimed as one
 * elsewhere. Only lines beginning at parenthesis depth zero count — a wrapped
 * prefix argument list continues an expression rather than heading the `Load`.
 */
function collectHeaderStarts(tokens: IToken[], fieldsStart: number, headerLine: number): IToken[] {
  const out: IToken[] = [];
  const end = Math.min(fieldsStart, tokens.length);
  let currentLine = tokens[0]?.startLine ?? 1;
  let depth = 0;

  for (let i = 0; i < end; i++) {
    const t = tokens[i];
    const line = t.startLine ?? 1;

    if (line !== currentLine) {
      currentLine = line;

      if (depth === 0 && line > headerLine) {
        out.push(t);
      }
    }

    if (isOpenParen(t)) {
      depth++;
    } else if (isCloseParen(t)) {
      depth--;
    }
  }

  return out;
}

/*
 * The lines a `Load` statement claims for indentation, one entry per statement.
 * The indent rules split these lines between them and must agree on the split,
 * so it is derived here once rather than in each of them.
 */
export function collectLoadAnchors(tokens: IToken[], firstByLine: Map<number, IToken>): LoadAnchors[] {
  const out: LoadAnchors[] = [];

  for (const stmt of splitStatements(tokens)) {
    const loadIdx = findLoadIndex(stmt);

    if (loadIdx === -1) {
      continue;
    }

    const loadLine = stmt[loadIdx].startLine ?? 1;
    const headerLine = findStatementStartLine(stmt, loadLine);
    const headerFirst = firstByLine.get(headerLine);
    const base = headerFirst ? (headerFirst.startColumn ?? 1) - 1 : 0;

    const { start, end } = findFieldListBoundaries(stmt, loadIdx);

    out.push({
      base,
      headerStarts: collectHeaderStarts(stmt, start, headerLine),
      fieldStarts: collectFieldStarts(stmt, start, end),
      clauseStarters: collectClauseStarters(stmt, end),
    });
  }

  return out;
}
