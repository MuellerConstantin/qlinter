import { tokenMatcher } from 'chevrotain';
import { colonToken, sourceClauseToken } from '../lexer.js';
import { tokenRange } from '../token.js';
import type { Finding, Rule } from '../types.js';
import { classifyBlockLine, opensBody } from './utils/blocks.js';
import {
  commentOnlyLines,
  detectLineEnding,
  insertLineBefore,
  introductionStart,
  precededByBlankLine,
  splitLines,
} from './utils/lines.js';
import {
  collectStatementSpans,
  findAtTopLevel,
  findLoadIndex,
  opensTable,
  type StatementSpan,
} from './utils/statements.js';

/** The table name when the statement opens with `<name>:`, else undefined. */
function labelOf(statement: StatementSpan): string | undefined {
  const second = statement.tokens[1];

  return second !== undefined && tokenMatcher(second, colonToken) ? statement.first.image : undefined;
}

/* A Load naming no source reads from the statement below it, which is therefore no table of its own. */
function isPrecedingLoad(statement: StatementSpan): boolean {
  return (
    findLoadIndex(statement.tokens) !== -1 &&
    findAtTopLevel(statement.tokens, (token) => tokenMatcher(token, sourceClauseToken)) === -1
  );
}

export const blankLineBeforeTable: Rule<undefined, 'blank-line-before-table'> = {
  id: 'blank-line-before-table',
  defaultSeverity: 'warning',
  defaultOptions: undefined,
  check: ({ source, tokens, comments }) => {
    const out: Finding[] = [];
    const spans = splitLines(source);
    const commented = commentOnlyLines(comments, tokens);
    const statements = collectStatementSpans(tokens);

    for (let index = 0; index < statements.length; index++) {
      const statement = statements[index];
      const previous = statements[index - 1];
      const label = labelOf(statement);

      if (label === undefined && !opensTable(statement.tokens)) {
        continue;
      }

      if (label === undefined && previous !== undefined && isPrecedingLoad(previous)) {
        continue;
      }

      const top = introductionStart(commented, statement.line);

      if (precededByBlankLine(source, spans, top)) {
        continue;
      }

      /* The first statement of a block needs no gap between itself and the header it belongs to. */
      if (previous !== undefined && opensBody(classifyBlockLine(previous.tokens))) {
        continue;
      }

      out.push({
        range: tokenRange(statement.first),
        message:
          label === undefined
            ? 'A table should be preceded by a blank line.'
            : `Table '${label}' should be preceded by a blank line.`,
        fix: insertLineBefore(spans, top, detectLineEnding(source)),
      });
    }

    return out;
  },
};
