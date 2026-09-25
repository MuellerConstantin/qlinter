import { tokenMatcher, type IToken } from 'chevrotain';
import { LINE_BREAK, remKeywordToken, remTextToken, semicolonToken, statementTerminatorToken } from '../lexer.js';
import type { LineSpan } from '../lines.js';
import { tokenRange } from '../token.js';
import type { Finding, Rule } from '../types.js';
import { statementStartLines } from './utils/statements.js';
import { closesLine, isLineBreak, opensLine, runEndingAt } from './utils/whitespace.js';

/*
 * Whether Qlik expands `$(…)` inside a remark, and inside a line comment, is not
 * in the reference; turning one into the other could change which of them runs.
 */
const DOLLAR_EXPANSION = /\$\(/;

/* A directive the runner reads off a line comment, which the remark it was is not. */
const DIRECTIVE = /^\s*qlinter-/;

const endOf = (token: IToken): number => (token.endOffset ?? token.startOffset) + 1;

interface Layout {
  whitespaces: IToken[];
  lines: LineSpan[];
  lineEnding: string;
}

/*
 * Rem is a statement, so only a Rem where a statement begins is one. Anywhere
 * else the word is a name — a field called `Rem` in a Load — and rewriting what
 * follows it into a comment would take the rest of that statement with it.
 */
function startsStatement(tokens: IToken[], index: number, starts: ReadonlySet<number>, layout: Layout): boolean {
  const previous = tokens[index - 1];

  if (
    previous === undefined ||
    tokenMatcher(previous, semicolonToken) ||
    tokenMatcher(previous, statementTerminatorToken)
  ) {
    return true;
  }

  const keyword = tokens[index];

  return opensLine(layout.whitespaces, layout.lines, keyword) && starts.has(keyword.startLine ?? 1);
}

/**
 * The remark as line comments, one per line of it, or undefined where it cannot
 * be written as one without changing what the script does.
 *
 * Only a remark that has its lines to itself is rewritten. One sharing its line
 * with a statement before it waits until that statement stands on its own line,
 * so there is a single way to the result whatever order the rules run in.
 */
function asLineComments(keyword: IToken, text: string, end: IToken, layout: Layout): string | undefined {
  const { whitespaces, lines, lineEnding } = layout;

  if (
    DOLLAR_EXPANSION.test(text) ||
    DIRECTIVE.test(text) ||
    !opensLine(whitespaces, lines, keyword) ||
    !closesLine(whitespaces, lines, end)
  ) {
    return undefined;
  }

  const before = runEndingAt(whitespaces, keyword.startOffset);
  const indent = before === undefined || isLineBreak(before) ? '' : before.image;

  return text
    .split(LINE_BREAK)
    .map((row, index) => `${index === 0 ? '' : indent}//${row}`)
    .join(lineEnding);
}

export const noRem: Rule<undefined, 'no-rem'> = {
  id: 'no-rem',
  defaultSeverity: 'warning',
  defaultOptions: undefined,
  check: ({ tokens, whitespaces, lines, lineEnding }) => {
    const out: Finding[] = [];
    const layout: Layout = { whitespaces, lines, lineEnding };
    const starts = statementStartLines(tokens);

    for (let index = 0; index < tokens.length; index++) {
      const keyword = tokens[index];

      if (!tokenMatcher(keyword, remKeywordToken) || !startsStatement(tokens, index, starts, layout)) {
        continue;
      }

      const body = tokens[index + 1];
      const hasText = body !== undefined && tokenMatcher(body, remTextToken);
      const end = hasText ? tokens[index + 2] : body;
      const finding: Finding = { range: tokenRange(keyword), message: "Use a '//' comment instead of 'Rem'." };
      const replacement =
        end === undefined ? undefined : asLineComments(keyword, hasText ? body.image : '', end, layout);

      out.push(
        replacement === undefined || end === undefined
          ? finding
          : { ...finding, fix: { range: { start: keyword.startOffset, end: endOf(end) }, replacement } },
      );
    }

    return out;
  },
};
