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
 * The line whose indent the field/clause list hangs off. Usually the line the
 * `Load` keyword sits on, but when the `Load` is a continuation of a prefixed
 * statement — `Left Join(...) IntervalMatch(...)`, a `Hierarchy (...)`, or a
 * `NoConcatenate` broken onto its own line — the base is set by the line that
 * opens the statement, not the continuation line the `Load` happens to land on.
 * That continuation line is a header line in its own right — `load-indent` pins
 * it to `base` too — so trusting its column would let a misindented `Load` drag
 * the whole field list sideways with it. Walk up while each line above is still
 * part of the same statement.
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
 * The header lines of a `Load` — every line the statement spends on its own
 * head before the field list starts: a prefix chain broken off its `Load`
 * (`Left Join(X)` / `NoConcatenate`), the `Load` keyword itself, a `Distinct`
 * pushed onto its own line. They belong at `base`, the same column as the line
 * that opens the statement, so the field list one step deeper still reads as
 * subordinate to them.
 *
 * The opening line is excluded — `block-indent` owns it as a statement start,
 * and claiming it here would report it twice.
 *
 * Only lines that begin at parenthesis depth zero count. A prefix whose
 * argument list is wrapped —
 *
 *   Hierarchy(NodeId, ParentId,
 *       NodeName)
 *   Load
 *
 * — is a genuine continuation of an expression and stays with
 * `continuation-indent`; only the `Load` line is header.
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
 *
 * `load-indent` enforces these positions; `continuation-indent` needs the exact
 * complement, since every line that is neither a statement start nor one of
 * these anchors is a continuation line. Both rules must agree on the split, so
 * it is derived here once — otherwise a line falls to both at different expected
 * widths and their fixes rewrite each other.
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
