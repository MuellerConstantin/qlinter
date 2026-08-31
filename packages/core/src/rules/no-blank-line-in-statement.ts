import type { IToken } from 'chevrotain';
import type { Finding, Rule } from '../types.js';
import { deleteLineRange, isBlankLine, splitLines } from './utils/lines.js';
import { collectStatementSpans } from './utils/statements.js';

/*
 * Lines held inside a token that spans several of them — inline data, a block
 * comment, a string literal running over a line break. The lexer keeps those
 * whole on purpose, so what looks like a blank line there is content the script
 * carries rather than spacing an author chose.
 */
function insideMultilineToken(tokens: IToken[], comments: IToken[]): Set<number> {
  const out = new Set<number>();

  for (const token of [...tokens, ...comments]) {
    const first = token.startLine ?? 1;
    const last = token.endLine ?? first;

    for (let line = first + 1; line <= last; line++) {
      out.add(line);
    }
  }

  return out;
}

export const noBlankLineInStatement: Rule<undefined, 'no-blank-line-in-statement'> = {
  id: 'no-blank-line-in-statement',
  defaultSeverity: 'warning',
  defaultOptions: undefined,
  check: ({ source, tokens, comments }) => {
    const out: Finding[] = [];
    const spans = splitLines(source);
    const carried = insideMultilineToken(tokens, comments);

    for (const statement of collectStatementSpans(tokens)) {
      let runStart = -1;

      /* Runs the closing line as well, so a run ending against it still gets flushed. */
      for (let line = statement.line + 1; line <= statement.lastLine; line++) {
        const blank = line < statement.lastLine && !carried.has(line) && isBlankLine(source, spans[line - 1]);

        if (blank) {
          if (runStart === -1) {
            runStart = line;
          }

          continue;
        }

        if (runStart === -1) {
          continue;
        }

        out.push({
          range: { start: { line: runStart, column: 1 }, end: { line, column: 1 } },
          message: 'A statement should not be broken up by a blank line.',
          fix: deleteLineRange(spans, runStart, line - 1),
        });

        runStart = -1;
      }
    }

    return out;
  },
};
