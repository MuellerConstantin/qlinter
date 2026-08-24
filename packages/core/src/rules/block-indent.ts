import type { IToken } from 'chevrotain';
import { keywordToken } from '../lexer.js';
import type { Rule, Finding, OptionsSchemaOf } from '../types.js';

/**
 * Indent characters shared by the three indent rules. The array is the source;
 * {@link IndentStyle} is derived from it so the values survive into the bundle.
 */
export const INDENT_STYLES = ['space', 'tab'] as const;

export type IndentStyle = (typeof INDENT_STYLES)[number];

export interface BlockIndentOptions {
  size: number;
  style: IndentStyle;
}

/**
 * Shared option schema for the three indent rules. The upper bound on `size` is
 * a sanity limit, not a style statement — anything past it is a typo, and an
 * options UI needs a range to render a bounded control.
 */
export const INDENT_OPTIONS_SCHEMA = {
  size: { type: 'number', min: 1, max: 8 },
  style: { type: 'enum', values: INDENT_STYLES },
} as const satisfies OptionsSchemaOf<BlockIndentOptions>;

/*
 * Tokens whose presence on the previous line forces the next line to be
 * treated as a fresh statement. `;` is the universal terminator; `:` ends
 * a table label (`MyTable:`); the keywords below implicitly terminate a
 * block-control statement when they appear as its final token (`If x Then`,
 * a dangling `Do`, `Else`, ...).
 */
const TERMINATOR_LAST = new Set([
  ';',
  ':',
  'then',
  'do',
  'else',
  'default',
  'end',
  'endsub',
  'endif',
  'endswitch',
  'next',
  'loop',
]);

/*
 * Block-control keywords that, when they start a line, are assumed to keep
 * their entire header on that single line. Used as a tiebreaker for the
 * statement-start heuristic — `Sub greet`, `For i = 1 to 10`, `Switch x`,
 * `Case 'A'`, `ElseIf x Then` all terminate at end-of-line in practice.
 * Multi-line headers for these constructs are not supported.
 */
const OPENER_FIRST = new Set(['sub', 'for', 'switch', 'case', 'elseif']);

const BLOCK_OPEN = new Set(['sub', 'if', 'for', 'do', 'switch']);
const BLOCK_CLOSE = new Set(['end', 'endsub', 'endif', 'endswitch', 'next', 'loop']);

type LineKind = 'open' | 'close' | 'mid-flat' | 'mid-case' | 'regular';

export function groupByLine(tokens: IToken[]): { line: number; tokens: IToken[] }[] {
  const out: { line: number; tokens: IToken[] }[] = [];
  let currentLine = -1;

  for (const token of tokens) {
    const line = token.startLine ?? 1;

    if (line !== currentLine) {
      out.push({ line, tokens: [token] });
      currentLine = line;
    } else {
      out[out.length - 1].tokens.push(token);
    }
  }

  return out;
}

export function previousLineClosesStatement(prevTokens: IToken[]): boolean {
  const first = prevTokens[0];
  const last = prevTokens[prevTokens.length - 1];

  if (TERMINATOR_LAST.has(last.image.toLowerCase())) {
    return true;
  }

  const firstLower = first.image.toLowerCase();

  if (OPENER_FIRST.has(firstLower)) {
    return true;
  }

  if (BLOCK_CLOSE.has(firstLower)) {
    return true;
  }

  return false;
}

function classify(lineTokens: IToken[]): LineKind {
  const first = lineTokens[0];

  if (first.tokenType !== keywordToken) {
    return 'regular';
  }

  const lower = first.image.toLowerCase();

  if (BLOCK_CLOSE.has(lower)) {
    return 'close';
  }

  if (lower === 'else' || lower === 'elseif') {
    return 'mid-flat';
  }

  if (lower === 'case' || lower === 'default') {
    return 'mid-case';
  }

  if (BLOCK_OPEN.has(lower)) {
    return 'open';
  }

  return 'regular';
}

function isSwitchClose(lineTokens: IToken[]): boolean {
  const first = lineTokens[0].image.toLowerCase();

  if (first === 'endswitch') {
    return true;
  }

  if (first === 'end' && lineTokens[1]?.image.toLowerCase() === 'switch') {
    return true;
  }

  return false;
}

export const blockIndent: Rule<BlockIndentOptions, 'block-indent'> = {
  id: 'block-indent',
  defaultSeverity: 'warning',
  defaultOptions: { size: 4, style: 'space' },
  options: INDENT_OPTIONS_SCHEMA,
  check: ({ source, tokens }, { size, style }) => {
    const out: Finding[] = [];
    const lines = groupByLine(tokens);

    if (lines.length === 0) {
      return out;
    }

    const indentChar = style === 'tab' ? '\t' : ' ';
    const step = style === 'tab' ? 1 : size;
    const unitLabel = style === 'tab' ? 'tab' : 'space';

    /*
     * Stack of open block contexts. `'block'` covers Sub/If/For/Do/Switch;
     * `'case'` represents an implicit sub-context opened by `Case`/`Default`
     * and closed by the next `Case`/`Default` or by `End Switch`.
     */
    const stack: ('block' | 'case')[] = [];
    let prevTokens: IToken[] | undefined;

    for (const { line, tokens: lineTokens } of lines) {
      const isStart = prevTokens === undefined || previousLineClosesStatement(prevTokens);
      prevTokens = lineTokens;

      if (!isStart) {
        continue;
      }

      const first = lineTokens[0];
      const kind = classify(lineTokens);

      let expectedDepth: number;

      switch (kind) {
        case 'close':
          if (isSwitchClose(lineTokens) && stack[stack.length - 1] === 'case') {
            stack.pop();
          }
          expectedDepth = Math.max(0, stack.length - 1);
          break;
        case 'mid-flat':
          expectedDepth = Math.max(0, stack.length - 1);
          break;
        case 'mid-case':
          if (stack[stack.length - 1] === 'case') {
            stack.pop();
          }
          expectedDepth = stack.length;
          break;
        case 'open':
        case 'regular':
          expectedDepth = stack.length;
          break;
      }

      const expectedWidth = expectedDepth * step;
      const actualColumn = first.startColumn ?? 1;
      const actualWidth = actualColumn - 1;
      const lineStart = first.startOffset - actualWidth;
      const actualIndent = source.slice(lineStart, first.startOffset);
      const expectedIndent = indentChar.repeat(expectedWidth);

      /*
       * Compare the actual leading whitespace against the expected indent
       * string, not just its column count: a run whose length matches but
       * whose character does not — four tabs where four spaces are expected,
       * or a tab/space mix — is still wrong for the configured `style`. A
       * width-only check would wave it through.
       */
      if (actualIndent !== expectedIndent) {
        /*
         * Guarantee a non-empty range so range-based consumers (CodeMirror
         * marker, editor decorations) have something to draw even when the
         * line has no leading whitespace at all.
         */
        const endColumn = Math.max(actualColumn, 2);
        const message =
          actualWidth === expectedWidth
            ? `Expected indentation to use ${unitLabel}s.`
            : `Expected ${expectedWidth} ${unitLabel}${expectedWidth === 1 ? '' : 's'} of indentation but got ${actualWidth}.`;

        out.push({
          range: {
            start: { line, column: 1 },
            end: { line, column: endColumn },
          },
          message,
          fix: {
            range: { start: lineStart, end: first.startOffset },
            replacement: expectedIndent,
          },
        });
      }

      switch (kind) {
        case 'open':
          stack.push('block');
          break;
        case 'close':
          stack.pop();
          break;
        case 'mid-case':
          stack.push('case');
          break;
      }
    }

    return out;
  },
};
