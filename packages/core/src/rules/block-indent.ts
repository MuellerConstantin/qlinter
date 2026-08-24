import { tokenMatcher, type IToken } from 'chevrotain';
import { blockCloseToken, blockOpenToken, keywordToken } from '../lexer.js';
import type { Rule, Finding } from '../types.js';
import { hasExpectedIndent, makeIndentFinding, INDENT_OPTIONS_SCHEMA, type IndentStyle } from './utils/indent.js';
import { groupByLine } from './utils/lines.js';
import { previousLineClosesStatement } from './utils/statements.js';

export interface BlockIndentOptions {
  size: number;
  style: IndentStyle;
}

type LineKind = 'open' | 'close' | 'mid-flat' | 'mid-case' | 'regular';

/*
 * Which words open and close a block comes from the lexer's token categories.
 * The `else`/`case` distinctions below stay on the image: they are not about
 * what the word is but about how this rule treats the line it starts — a
 * mid-block continuation that dedents without closing anything.
 */
function classify(lineTokens: IToken[]): LineKind {
  const first = lineTokens[0];

  if (!tokenMatcher(first, keywordToken)) {
    return 'regular';
  }

  if (tokenMatcher(first, blockCloseToken)) {
    return 'close';
  }

  const lower = first.image.toLowerCase();

  if (lower === 'else' || lower === 'elseif') {
    return 'mid-flat';
  }

  if (lower === 'case' || lower === 'default') {
    return 'mid-case';
  }

  if (tokenMatcher(first, blockOpenToken)) {
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

    for (const { tokens: lineTokens } of lines) {
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

      if (!hasExpectedIndent(source, first, expectedWidth, indentChar)) {
        out.push(makeIndentFinding(first, expectedWidth, indentChar, unitLabel));
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
