import type { IToken } from 'chevrotain';
import { commaToken } from '../lexer.js';
import type { Rule, Finding, RuleContext } from '../types.js';
import { groupByLine, previousLineClosesStatement, type IndentStyle } from './block-indent.js';
import {
  findFieldListBoundaries,
  findLoadIndex,
  isClauseStarter,
  isLoneWildcard,
  splitStatements,
} from './utils/statements.js';
import { isCloseParen, isOpenParen } from './utils/tokens.js';

export type { IndentStyle } from './block-indent.js';

export interface LoadIndentOptions {
  size: number;
  style: IndentStyle;
}

function collectFieldStarts(tokens: IToken[], start: number, end: number): IToken[] {
  if (start >= end) {
    return [];
  }

  const out: IToken[] = [];

  if (!isLoneWildcard(tokens, start, end)) {
    out.push(tokens[start]);
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
 * That continuation line is a header line in its own right — this rule pins it
 * to `base` too — so trusting its column would let a misindented `Load` drag
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
 * True when the token's leading whitespace is exactly `expectedWidth` copies
 * of `indentChar`. Compares the actual characters, not just the column count,
 * so a run of the wrong whitespace (tabs where spaces are expected, or a
 * tab/space mix) that happens to match the expected width is still rejected.
 */
export function hasExpectedIndent(source: string, token: IToken, expectedWidth: number, indentChar: string): boolean {
  const actualWidth = (token.startColumn ?? 1) - 1;
  const lineStart = token.startOffset - actualWidth;

  return source.slice(lineStart, token.startOffset) === indentChar.repeat(expectedWidth);
}

export function makeIndentFinding(
  token: IToken,
  expectedWidth: number,
  indentChar: string,
  unitLabel: string,
): Finding {
  const actualColumn = token.startColumn ?? 1;
  const actualWidth = actualColumn - 1;
  const line = token.startLine ?? 1;
  const lineStart = token.startOffset - actualWidth;

  /*
   * When the line has no leading whitespace at all, `actualColumn` is 1 and
   * a [col 1, col 1) range would be zero-width — invisible to range-based
   * consumers like the CodeMirror highlighter. Fall back to a 1-character
   * range over the first token so the finding always has something to draw.
   */
  const endColumn = Math.max(actualColumn, 2);

  /*
   * When the width already matches, the offending line has the right number
   * of the wrong character (e.g. tabs under a space style); point at the
   * character rather than a width that is technically correct.
   */
  const message =
    actualWidth === expectedWidth
      ? `Expected indentation to use ${unitLabel}s.`
      : `Expected ${expectedWidth} ${unitLabel}${expectedWidth === 1 ? '' : 's'} of indentation but got ${actualWidth}.`;

  return {
    range: {
      start: { line, column: 1 },
      end: { line, column: endColumn },
    },
    message,
    fix: {
      range: { start: lineStart, end: token.startOffset },
      replacement: indentChar.repeat(expectedWidth),
    },
  };
}

/** The header/field/clause anchors of one `Load` statement, plus the indent they hang off. */
export interface LoadAnchors {
  base: number;
  headerStarts: IToken[];
  fieldStarts: IToken[];
  clauseStarters: IToken[];
}

/** Indexes the first token of every line by line number. */
export function firstTokenByLine(firstOnLine: IToken[]): Map<number, IToken> {
  const out = new Map<number, IToken>();

  for (const t of firstOnLine) {
    out.set(t.startLine ?? 1, t);
  }

  return out;
}

/*
 * The lines `load-indent` owns, one entry per `Load` statement. Shared with
 * `continuation-indent`, which needs the complement: every line that is neither
 * a statement start nor one of these anchors is a continuation line. Both rules
 * must agree on the split, so it is derived here once — otherwise a line falls
 * to both rules at different expected widths and their fixes fight each other.
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

export const loadIndent: Rule<LoadIndentOptions, 'load-indent'> = {
  id: 'load-indent',
  defaultSeverity: 'warning',
  defaultOptions: { size: 4, style: 'space' },
  check: ({ source, tokens, firstOnLine }: RuleContext, { size, style }): Finding[] => {
    const indentChar = style === 'tab' ? '\t' : ' ';
    const step = style === 'tab' ? 1 : size;
    const unitLabel = style === 'tab' ? 'tab' : 'space';

    const firstOnLineSet = new Set(firstOnLine);
    const out: Finding[] = [];

    for (const { base, headerStarts, fieldStarts, clauseStarters } of collectLoadAnchors(
      tokens,
      firstTokenByLine(firstOnLine),
    )) {
      for (const t of headerStarts) {
        if (!firstOnLineSet.has(t)) {
          continue;
        }

        if (!hasExpectedIndent(source, t, base, indentChar)) {
          out.push(makeIndentFinding(t, base, indentChar, unitLabel));
        }
      }

      for (const t of fieldStarts) {
        if (!firstOnLineSet.has(t)) {
          continue;
        }

        const expectedWidth = base + step;

        if (!hasExpectedIndent(source, t, expectedWidth, indentChar)) {
          out.push(makeIndentFinding(t, expectedWidth, indentChar, unitLabel));
        }
      }

      for (const t of clauseStarters) {
        if (!firstOnLineSet.has(t)) {
          continue;
        }

        if (!hasExpectedIndent(source, t, base, indentChar)) {
          out.push(makeIndentFinding(t, base, indentChar, unitLabel));
        }
      }
    }

    return out;
  },
};
