import type { Finding, Rule } from '../types.js';
import { deleteLineRange, isBlankLine, splitLines, tokenInteriorLines } from './utils/lines.js';
import { collectStatementSpans } from './utils/statements.js';

export const noBlankLineInStatement: Rule<undefined, 'no-blank-line-in-statement'> = {
  id: 'no-blank-line-in-statement',
  defaultSeverity: 'warning',
  defaultOptions: undefined,
  check: ({ source, tokens, comments }) => {
    const out: Finding[] = [];
    const spans = splitLines(source);
    const carried = tokenInteriorLines(tokens, comments);

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
