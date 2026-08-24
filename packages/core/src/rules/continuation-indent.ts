import type { IToken } from 'chevrotain';
import type { Rule, Finding, RuleContext } from '../types.js';
import {
  firstTokenByLine,
  hasExpectedIndent,
  makeIndentFinding,
  INDENT_OPTIONS_SCHEMA,
  type IndentStyle,
} from './utils/indent.js';
import { groupByLine } from './utils/lines.js';
import { collectLoadAnchors } from './utils/load-anchors.js';
import { previousLineClosesStatement } from './utils/statements.js';
import { isCloseParen, isOpenParen } from './utils/tokens.js';

export interface ContinuationIndentOptions {
  size: number;
  style: IndentStyle;
}

/*
 * False when the first token of a line is preceded by anything other than
 * whitespace — which happens when a token that started on an earlier line ends
 * on this one (`Inline [...]`, a multi-line string, a block comment). There is
 * no indentation to speak of on such a line: the leading characters belong to
 * the previous token, and rewriting them would corrupt it.
 */
function isIndentable(source: string, first: IToken): boolean {
  const lineStart = first.startOffset - ((first.startColumn ?? 1) - 1);

  return /^[ \t]*$/.test(source.slice(lineStart, first.startOffset));
}

export const continuationIndent: Rule<ContinuationIndentOptions, 'continuation-indent'> = {
  id: 'continuation-indent',
  defaultSeverity: 'warning',
  defaultOptions: { size: 4, style: 'space' },
  options: INDENT_OPTIONS_SCHEMA,
  check: ({ source, tokens, firstOnLine }: RuleContext, { size, style }): Finding[] => {
    const indentChar = style === 'tab' ? '\t' : ' ';
    const step = style === 'tab' ? 1 : size;
    const unitLabel = style === 'tab' ? 'tab' : 'space';

    const anchored = new Set<IToken>();

    for (const { headerStarts, fieldStarts, clauseStarters } of collectLoadAnchors(
      tokens,
      firstTokenByLine(firstOnLine),
    )) {
      for (const t of headerStarts) {
        anchored.add(t);
      }

      for (const t of fieldStarts) {
        anchored.add(t);
      }

      for (const t of clauseStarters) {
        anchored.add(t);
      }
    }

    const out: Finding[] = [];
    let depth = 0;
    let anchorIndent = 0;
    let prevTokens: IToken[] | undefined;

    for (const { tokens: lineTokens } of groupByLine(tokens)) {
      const isStatementStart = prevTokens === undefined || previousLineClosesStatement(prevTokens);
      const first = lineTokens[0];
      prevTokens = lineTokens;

      /*
       * Every anchor sits at parenthesis depth 0 within its statement, so a
       * depth counted from the statement start is also the depth relative to
       * the anchor. Resetting here keeps an unbalanced statement from leaking
       * its drift into the rest of the file.
       */
      if (isStatementStart) {
        depth = 0;
      }

      if (isStatementStart || anchored.has(first)) {
        anchorIndent = (first.startColumn ?? 1) - 1;
      } else if (isIndentable(source, first)) {
        const level = isCloseParen(first) ? depth - 1 : Math.max(depth, 1);
        const expectedWidth = anchorIndent + Math.max(0, level) * step;

        if (!hasExpectedIndent(source, first, expectedWidth, indentChar)) {
          out.push(makeIndentFinding(first, expectedWidth, indentChar, unitLabel));
        }
      }

      for (const token of lineTokens) {
        if (isOpenParen(token)) {
          depth++;
        } else if (isCloseParen(token)) {
          depth--;
        }
      }
    }

    return out;
  },
};
