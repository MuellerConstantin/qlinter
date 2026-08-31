import type { Finding, Rule } from '../types.js';
import { deleteLineRange, isBlankLine, splitLines } from './utils/lines.js';

/*
 * A script starts at its first line of content. This owns only the run of blank
 * lines above that line; a blank line anywhere below it is not its business.
 */
export const noLeadingBlankLines: Rule<undefined, 'no-leading-blank-lines'> = {
  id: 'no-leading-blank-lines',
  defaultSeverity: 'warning',
  defaultOptions: undefined,
  check: ({ source }) => {
    const out: Finding[] = [];
    const spans = splitLines(source);
    let first = 0;

    while (first < spans.length && isBlankLine(source, spans[first])) {
      first++;
    }

    /* No blank run, or nothing below one for it to lead into. */
    if (first === 0 || first === spans.length) {
      return out;
    }

    out.push({
      range: { start: { line: 1, column: 1 }, end: { line: first + 1, column: 1 } },
      message: 'File must not start with a blank line.',
      fix: deleteLineRange(spans, 1, first),
    });

    return out;
  },
};
