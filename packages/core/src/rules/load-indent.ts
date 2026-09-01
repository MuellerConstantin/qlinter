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
import { collectLoadAnchors } from './utils/load-anchors.js';

export interface LoadIndentOptions {
  size: number;
  style: IndentStyle;
}

export const loadIndent: Rule<LoadIndentOptions, 'load-indent'> = {
  id: 'load-indent',
  defaultSeverity: 'warning',
  defaultOptions: { size: 4, style: 'space' },
  options: INDENT_OPTIONS_SCHEMA,
  check: ({ source, tokens, firstOnLine, comments }: RuleContext, { size, style }): Finding[] => {
    const indentChar = style === 'tab' ? '\t' : ' ';
    const step = style === 'tab' ? 1 : size;
    const unitLabel = style === 'tab' ? 'tab' : 'space';

    const firstOnLineSet = new Set(firstOnLine);
    const out: Finding[] = [];

    const check = (t: IToken, expectedWidth: number): void => {
      if (!firstOnLineSet.has(t)) {
        return;
      }

      const anchor = indentAnchor(source, t, comments);

      if (anchor && !hasExpectedIndent(source, anchor, expectedWidth, indentChar)) {
        out.push(makeIndentFinding(anchor, expectedWidth, indentChar, unitLabel));
      }
    };

    for (const { base, headerStarts, fieldStarts, clauseStarters } of collectLoadAnchors(
      tokens,
      firstTokenByLine(firstOnLine),
    )) {
      for (const t of headerStarts) {
        check(t, base);
      }

      for (const t of fieldStarts) {
        check(t, base + step);
      }

      for (const t of clauseStarters) {
        check(t, base);
      }
    }

    return out;
  },
};
