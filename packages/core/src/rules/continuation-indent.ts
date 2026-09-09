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

/*
 * The level a line sits at, given the level each open parenthesis grants its
 * contents — innermost last.
 *
 * A line hangs off the line that left the innermost parenthesis open, not off
 * the count of parentheses: `If(Match(` opens two but is still one line, and
 * indenting its contents twice would leave them past a column nothing else
 * reaches. One that opens with a closing parenthesis returns to the level of
 * the line that opened it.
 *
 * With nothing open, a continuation still gets a level, which is what makes a
 * broken condition hang below its anchor.
 */
function lineLevel(openParens: number[], first: IToken): number {
  const innermost = openParens[openParens.length - 1];

  if (isCloseParen(first)) {
    return innermost === undefined ? 0 : innermost - 1;
  }

  return innermost ?? 1;
}

export const continuationIndent: Rule<ContinuationIndentOptions, 'continuation-indent'> = {
  id: 'continuation-indent',
  defaultSeverity: 'warning',
  defaultOptions: { size: 4, style: 'space' },
  options: INDENT_OPTIONS_SCHEMA,
  check: ({ tokens, firstOnLine, comments, whitespaces }: RuleContext, { size, style }): Finding[] => {
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
    let openParens: number[] = [];
    let anchorIndent = 0;

    for (const { line, tokens: lineTokens } of groupByLine(tokens)) {
      const isStatementStart = starts.has(line);
      const first = lineTokens[0];

      /*
       * Every anchor sits outside its statement's parentheses, so a stack built
       * from the statement start describes the nesting the anchor sees too.
       * Clearing here keeps an unbalanced statement from leaking its drift into
       * the rest of the file.
       */
      if (isStatementStart) {
        openParens = [];
      }

      const isAnchor = isStatementStart || anchored.has(first);
      const level = isAnchor ? 0 : Math.max(0, lineLevel(openParens, first));

      if (isAnchor) {
        anchorIndent = (first.startColumn ?? 1) - 1;
      } else {
        const anchor = indentAnchor(whitespaces, first, comments);
        const expectedWidth = anchorIndent + level * step;

        if (anchor && !hasExpectedIndent(whitespaces, anchor, expectedWidth, indentChar)) {
          out.push(makeIndentFinding(anchor, expectedWidth, indentChar, unitLabel));
        }
      }

      /*
       * Every parenthesis opened on this line grants its contents the same
       * level, one past the line itself.
       */
      for (const token of lineTokens) {
        if (isOpenParen(token)) {
          openParens.push(level + 1);
        } else if (isCloseParen(token)) {
          openParens.pop();
        }
      }
    }

    return out;
  },
};
