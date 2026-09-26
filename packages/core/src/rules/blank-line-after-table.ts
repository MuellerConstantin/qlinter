import { tokenMatcher } from 'chevrotain';
import { colonToken } from '../lexer.js';
import { tokenRange } from '../token.js';
import type { Finding, Rule } from '../types.js';
import { classifyBlockLine, closesBody } from './utils/blocks.js';
import { commentOnlyLines, insertLineBefore, introductionStart, precededByBlankLine } from './utils/lines.js';
import { collectStatementSpans, isPrecedingLoad, opensTable, type StatementSpan } from './utils/statements.js';

/** The table name when the statement opens with `<name>:`, else undefined. */
function labelOf(statement: StatementSpan): string | undefined {
  const second = statement.tokens[1];

  return second !== undefined && tokenMatcher(second, colonToken) ? statement.first.image : undefined;
}

export const blankLineAfterTable: Rule<undefined, 'blank-line-after-table'> = {
  id: 'blank-line-after-table',
  defaultSeverity: 'warning',
  defaultOptions: undefined,
  check: ({ tokens, comments, whitespaces, lines: spans, lineEnding }) => {
    const out: Finding[] = [];
    const commented = commentOnlyLines(comments, tokens);
    const statements = collectStatementSpans(tokens);

    for (let index = 0; index < statements.length; index++) {
      const statement = statements[index];
      const next = statements[index + 1];

      if (next === undefined || !opensTable(statement.tokens) || isPrecedingLoad(statement.tokens)) {
        continue;
      }

      const kind = classifyBlockLine(next.tokens);

      /*
       * The end of a body is that body's edge, and what opens a section of its
       * own asks for the gap above itself; claiming either here fills it twice.
       */
      if (closesBody(kind) || kind === 'open' || opensTable(next.tokens)) {
        continue;
      }

      const top = introductionStart(commented, next.line);

      if (precededByBlankLine(whitespaces, spans, top)) {
        continue;
      }

      const label = labelOf(statement);

      out.push({
        range: tokenRange(statement.first),
        message:
          label === undefined
            ? 'A table should be followed by a blank line.'
            : `Table '${label}' should be followed by a blank line.`,
        fix: insertLineBefore(spans, top, lineEnding),
      });
    }

    return out;
  },
};
