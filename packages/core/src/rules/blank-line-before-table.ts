import { tokenMatcher, type IToken } from 'chevrotain';
import { blockCloseToken, colonToken, semicolonToken, sourceClauseToken } from '../lexer.js';
import { tokenRange } from '../token.js';
import type { Finding, Rule } from '../types.js';
import { detectLineEnding, isBlankLine, splitLines } from './utils/lines.js';
import { collectStatementSpans, findAtTopLevel, findLoadIndex, type StatementSpan } from './utils/statements.js';
import { isKeyword } from './utils/tokens.js';

/** Lines carrying a comment and no code, so a comment run above a table can be walked. */
function commentOnlyLines(comments: IToken[], tokens: IToken[]): Set<number> {
  const code = new Set(tokens.map((token) => token.startLine ?? 1));
  const out = new Set<number>();

  for (const comment of comments) {
    const first = comment.startLine ?? 1;
    const last = comment.endLine ?? first;

    for (let line = first; line <= last; line++) {
      if (!code.has(line)) {
        out.add(line);
      }
    }
  }

  return out;
}

/** The table name when the statement opens with `<name>:`, else undefined. */
function labelOf(statement: StatementSpan): string | undefined {
  const second = statement.tokens[1];

  return second !== undefined && tokenMatcher(second, colonToken) ? statement.first.image : undefined;
}

function producesTable(statement: StatementSpan): boolean {
  return (
    findLoadIndex(statement.tokens) !== -1 ||
    findAtTopLevel(statement.tokens, (token) => isKeyword(token, 'select')) !== -1
  );
}

/* A Load naming no source reads from the statement below it, which is therefore no table of its own. */
function isPrecedingLoad(statement: StatementSpan): boolean {
  return (
    findLoadIndex(statement.tokens) !== -1 &&
    findAtTopLevel(statement.tokens, (token) => tokenMatcher(token, sourceClauseToken)) === -1
  );
}

/*
 * Whether the statement is a header a body hangs off — `Sub f`, `If x Then`,
 * `Case 1`, `Else`. Those end without a semicolon; block closers do too, and are
 * excluded by their opening keyword.
 */
function opensBlock(statement: StatementSpan): boolean {
  const last = statement.tokens[statement.tokens.length - 1];

  return !tokenMatcher(last, semicolonToken) && !tokenMatcher(statement.first, blockCloseToken);
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

      if (label === undefined && !producesTable(statement)) {
        continue;
      }

      if (label === undefined && previous !== undefined && isPrecedingLoad(previous)) {
        continue;
      }

      /* A comment introducing the table belongs to it, so the gap goes above the comment. */
      let top = statement.line;

      while (top > 1 && commented.has(top - 1)) {
        top--;
      }

      const above = spans[top - 2];
      const start = spans[top - 1];

      if (above === undefined || start === undefined || isBlankLine(source, above)) {
        continue;
      }

      if (previous !== undefined && opensBlock(previous)) {
        continue;
      }

      out.push({
        range: tokenRange(statement.first),
        message:
          label === undefined
            ? 'A table should be preceded by a blank line.'
            : `Table '${label}' should be preceded by a blank line.`,
        fix: { range: { start: start.start, end: start.start }, replacement: detectLineEnding(source) },
      });
    }

    return out;
  },
};
