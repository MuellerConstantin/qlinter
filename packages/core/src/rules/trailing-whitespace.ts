import type { Rule, Finding } from '../types.js';
import { isLineBreak } from './utils/whitespace.js';

export const trailingWhitespace: Rule<undefined, 'trailing-whitespace'> = {
  id: 'trailing-whitespace',
  defaultSeverity: 'warning',
  defaultOptions: undefined,
  check: ({ whitespaces, lines }) => {
    const out: Finding[] = [];

    for (const run of whitespaces) {
      if (isLineBreak(run)) {
        continue;
      }

      const end = (run.endOffset ?? run.startOffset) + 1;
      const line = run.startLine ?? 1;
      const span = lines[line - 1];

      /*
       * A horizontal run is trailing when it reaches the end of its line, which
       * the last line reaches at the end of the file like any other. Anything
       * after it is content, and the run is a gap between two things rather than
       * the tail of a line.
       *
       * Whitespace inside a construct the lexer keeps whole is never reported as
       * a run, so a line ending inside inline data or a block comment cannot
       * reach this loop at all.
       */
      if (span === undefined || end !== span.end) {
        continue;
      }

      const column = run.startColumn ?? 1;

      out.push({
        range: {
          start: { line, column },
          end: { line, column: column + run.image.length },
        },
        message: 'Trailing whitespace.',
        fix: { range: { start: run.startOffset, end }, replacement: '' },
      });
    }

    return out;
  },
};
