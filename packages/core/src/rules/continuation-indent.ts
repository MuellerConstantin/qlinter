import type { IToken } from 'chevrotain';
import type { Rule, Finding, RuleContext } from '../types.js';
import { groupByLine, previousLineClosesStatement, type IndentStyle } from './block-indent.js';
import { collectLoadAnchors, firstTokenByLine, hasExpectedIndent, makeIndentFinding } from './load-indent.js';
import { isCloseParen, isOpenParen } from './shared.js';

export type { IndentStyle } from './block-indent.js';

export interface ContinuationIndentOptions {
  size: number;
  style: IndentStyle;
}

/*
 * Owns the indentation of *continuation* lines — the lines left over once
 * `block-indent` has taken every statement start and `load-indent` every
 * header, field and clause line of a `Load`. Those are the lines inside a
 * wrapped expression: a broken `&`-chain, a multi-line `Where` condition, the
 * arguments of a call spread over several lines.
 *
 * A torn-apart `Load` header is explicitly *not* one of them. `Left Join(X)`
 * on one line and its `Load` on the next is a statement head split in two, not
 * a wrapped expression; hanging the `Load` one level in would put it at the
 * same column as the fields it introduces and flatten the very hierarchy
 * `load-indent` exists to draw. Those lines are anchors, owned by `load-indent`
 * at `base`.
 *
 * The expected indent hangs off the nearest preceding *anchor* — the statement
 * start or field/clause line the continuation belongs to — plus one level per
 * open parenthesis, so nesting is reflected instead of flattened:
 *
 *   Let vX = If(Status = 'A',      <- anchor, base 0
 *       If(Region = 'North',       <- depth 1
 *           1,                     <- depth 2
 *           2),
 *       0);
 *
 * A continuation that is not inside parentheses at all still gets one level,
 * which is what makes a broken `Where` condition or `&`-chain hang:
 *
 *   Where Quantity > 0             <- anchor (load-indent)
 *       And Status = 'open';       <- depth 0, still one level in
 *
 * A line that *starts* with a closing parenthesis is dedented by one level, so
 * the closer lands back under its anchor. This is also what keeps the rule in
 * agreement with `multiline-call`, which emits exactly that shape when it
 * breaks an over-long call apart.
 *
 * The anchor's *actual* indent is used, not its expected one — the same choice
 * `load-indent` makes for its `base`. When the anchor is itself misindented,
 * its owning rule fixes it and the autofix loop re-derives the continuations on
 * the next pass.
 *
 * Scope note: the check keys off the first *code* token of each line, so lines
 * carrying no token of their own — the interior of a block comment, a
 * multi-line string, or an `Inline [...]` data block (all single tokens) — are
 * never inspected, matching `block-indent` and `load-indent`.
 */
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
