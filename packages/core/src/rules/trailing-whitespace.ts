import type { Rule, Finding } from '../types.js';
import { isLineBreak, runStartingAt } from './utils/whitespace.js';

export const trailingWhitespace: Rule<undefined, 'trailing-whitespace'> = {
  id: 'trailing-whitespace',
  defaultSeverity: 'warning',
  defaultOptions: undefined,
  check: ({ source, whitespaces }) => {
    const out: Finding[] = [];

    for (const run of whitespaces) {
      if (isLineBreak(run)) {
        continue;
      }

      const end = (run.endOffset ?? run.startOffset) + 1;
      const following = runStartingAt(whitespaces, end);

      /*
       * A horizontal run is trailing when a line break follows it, or when the
       * file ends there. Anything else after it is content, which makes the run
       * a gap between two things rather than the tail of a line.
       *
       * Whitespace inside a construct the lexer keeps whole is never reported as
       * a run, so a line ending inside inline data or a block comment cannot
       * reach this loop at all.
       */
      if (end !== source.length && (following === undefined || !isLineBreak(following))) {
        continue;
      }

      const line = run.startLine ?? 1;
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
