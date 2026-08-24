import type { Rule, Finding, RuleContext } from '../types.js';
import {
  firstTokenByLine,
  hasExpectedIndent,
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
