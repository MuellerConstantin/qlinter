import type { IToken } from 'chevrotain';
import type { Rule, Finding, RuleContext } from '../types.js';
import {
  firstTokenByLine,
  hasExpectedIndent,
  indentAnchor,
  makeIndentFinding,
  INDENT_OPTIONS_SCHEMA,
  type IndentStyle,
} from './utils/indent.js';
import { groupByLine } from './utils/lines.js';
import { collectLoadAnchors } from './utils/load-anchors.js';
import { statementStartLines } from './utils/statements.js';
import { isCloseParen, isOpenParen } from './utils/tokens.js';

export interface ContinuationIndentOptions {
  size: number;
  style: IndentStyle;
}

export const continuationIndent: Rule<ContinuationIndentOptions, 'continuation-indent'> = {
  id: 'continuation-indent',
  defaultSeverity: 'warning',
  defaultOptions: { size: 4, style: 'space' },
  options: INDENT_OPTIONS_SCHEMA,
  check: ({ source, tokens, firstOnLine, comments }: RuleContext, { size, style }): Finding[] => {
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
    const starts = statementStartLines(tokens);
    let depth = 0;
    let anchorIndent = 0;

    for (const { line, tokens: lineTokens } of groupByLine(tokens)) {
      const isStatementStart = starts.has(line);
      const first = lineTokens[0];

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
      } else {
        const anchor = indentAnchor(source, first, comments);
        const level = isCloseParen(first) ? depth - 1 : Math.max(depth, 1);
        const expectedWidth = anchorIndent + Math.max(0, level) * step;

        if (anchor && !hasExpectedIndent(source, anchor, expectedWidth, indentChar)) {
          out.push(makeIndentFinding(anchor, expectedWidth, indentChar, unitLabel));
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
