import type { IToken } from 'chevrotain';
import type { Finding, OptionsSchemaOf } from '../../types.js';
import { isLineBreak, runEndingAt, runsSpanning } from './whitespace.js';

/**
 * Indent characters the indent rules choose between. The array is the source;
 * {@link IndentStyle} is derived from it so the values survive into the bundle
 * for config validation and options UIs to read.
 */
export const INDENT_STYLES = ['space', 'tab'] as const;

export type IndentStyle = (typeof INDENT_STYLES)[number];

/**
 * Shared option schema for the indent rules. The upper bound on `size` is a
 * sanity limit, not a style statement — anything past it is a typo, and an
 * options UI needs a range to render a bounded control.
 */
export const INDENT_OPTIONS_SCHEMA = {
  size: { type: 'number', min: 1, max: 8 },
  style: { type: 'enum', values: INDENT_STYLES },
} as const satisfies OptionsSchemaOf<{ size: number; style: IndentStyle }>;

/** Indexes the first token of every line by line number. */
export function firstTokenByLine(firstOnLine: IToken[]): Map<number, IToken> {
  const out = new Map<number, IToken>();

  for (const t of firstOnLine) {
    out.set(t.startLine ?? 1, t);
  }

  return out;
}

/*
 * True when the run of whitespace opening the token's line is exactly
 * `expectedWidth` copies of `indentChar`. Compares the characters the lexer
 * reported, not just their count, so a run of the wrong whitespace (tabs where
 * spaces are expected, or a mix) that happens to land on the right column is
 * still rejected.
 */
export function hasExpectedIndent(
  whitespaces: IToken[],
  token: IToken,
  expectedWidth: number,
  indentChar: string,
): boolean {
  const run = runEndingAt(whitespaces, token.startOffset);
  const indent = run === undefined || isLineBreak(run) ? '' : run.image;

  return indent === indentChar.repeat(expectedWidth);
}

/*
 * The token a line's indentation may be rewritten against: the comment opening
 * the line when one does, otherwise the line's first code token. Anchoring on
 * the comment keeps it inside the line the fix rewrites — the leading run is
 * replaced wholesale, so a comment left out of the anchor is a comment deleted.
 *
 * Undefined when the characters ahead of the anchor are not whitespace. They
 * then belong to a token that opened on an earlier line — inline data, a
 * multi-line string, a block comment — where there is no indentation to speak
 * of and rewriting the run would corrupt the token carrying it.
 *
 * Undefined too when the line break ahead of the line is not a run of its own
 * but the end of the token before it. A Set value, a SQL command or a Trace
 * message runs up to its `;` and takes every line break on the way, so a `;`
 * opening its own line sits right against that token: indentation written there
 * is read back as part of the value, not as space before the `;`.
 */
export function indentAnchor(whitespaces: IToken[], first: IToken, comments: readonly IToken[]): IToken | undefined {
  let anchor = first;

  for (const comment of comments) {
    if (comment.startOffset >= first.startOffset) {
      break;
    }

    if ((comment.startLine ?? 1) === (first.startLine ?? 1) && comment.startOffset < anchor.startOffset) {
      anchor = comment;
    }
  }

  const lineStart = anchor.startOffset - ((anchor.startColumn ?? 1) - 1);
  const breakAhead = runEndingAt(whitespaces, lineStart);

  if (lineStart > 0 && (breakAhead === undefined || !isLineBreak(breakAhead))) {
    return undefined;
  }

  return runsSpanning(whitespaces, lineStart, anchor.startOffset) !== undefined ? anchor : undefined;
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
