import { commaToken } from '../lexer.js';
import type { Rule, Finding, RuleContext } from '../types.js';
import { tokenRange } from '../token.js';

/** Offset of the first character after the run of spaces and tabs at `from`. */
function skipBlanks(source: string, from: number): number {
  let cursor = from;

  while (cursor < source.length && (source[cursor] === ' ' || source[cursor] === '\t')) {
    cursor++;
  }

  return cursor;
}

export const commaStyle: Rule<undefined, 'comma-style'> = {
  id: 'comma-style',
  defaultSeverity: 'warning',
  defaultOptions: undefined,
  check: ({ source, tokens, firstOnLine }: RuleContext): Finding[] => {
    const firstOnLineSet = new Set(firstOnLine);
    const out: Finding[] = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (token.tokenType !== commaToken || !firstOnLineSet.has(token)) {
        continue;
      }

      const prev = tokens[i - 1];

      /* A comma opening the file has nothing to attach to. */
      if (prev === undefined) {
        continue;
      }

      /*
       * `firstOnLine` keys off `startLine`, so a comma trailing a multi-line
       * token — `[Foo\nBar], X` — counts as first on its line even though it
       * visually follows `Bar]`. It already trails its operand; leave it.
       */
      if ((prev.endLine ?? prev.startLine) === token.startLine) {
        continue;
      }

      const gapStart = (prev.endOffset ?? prev.startOffset) + 1;
      const gap = source.slice(gapStart, token.startOffset);
      const after = (token.endOffset ?? token.startOffset) + 1;
      const next = tokens[i + 1];

      /*
       * Where the next operand goes decides what the fix has to carry.
       *
       * With the operand on the comma's line, the comma is the only thing that
       * has to move: the author's break and indent come along unchanged, and
       * take over separating the comma from the operand. The blanks that used
       * to do that job go with the comma — left behind they would push the
       * operand one column out. They stay only when the gap ends on a block
       * comment and so cannot separate anything itself.
       *
       * With the operand on its own line, that break already separates the two
       * operands and carrying the gap as well would leave a blank line behind.
       * Trimming it keeps any comment the gap holds while dropping the
       * whitespace that trailed it.
       */
      const operandFollowsOnLine = next !== undefined && (next.startLine ?? 1) === (token.startLine ?? 1);

      out.push({
        range: tokenRange(token),
        message: "Expected ',' at the end of the previous line.",
        fix: operandFollowsOnLine
          ? {
              range: { start: gapStart, end: /\s$/.test(gap) ? skipBlanks(source, after) : after },
              replacement: `,${gap}`,
            }
          : { range: { start: gapStart, end: after }, replacement: `,${gap.trimEnd()}` },
      });
    }

    return out;
  },
};
