import type { Position, Rule, Finding } from '../types.js';

/*
 * A carriage return standing on its own, outside a CRLF pair.
 *
 * Qlik's reference never says what ends a line: the page on commenting says a
 * `//` comment runs to the end of "the same row" without defining a row, and the
 * syntax overview says only that a statement ends with a semicolon. So whether
 * such a file is terminated at all is not something this project can answer, and
 * a file carrying one is left exactly as it is — appending a terminator would
 * mix two conventions inside it on a guess.
 *
 * @see https://help.qlik.com/en-US/sense/2.0/Subsystems/Hub/Content/LoadData/comment-in-script.htm
 */
function hasLoneCarriageReturn(source: string): boolean {
  for (let k = 0; k < source.length; k++) {
    if (source[k] === '\r' && source[k + 1] !== '\n') {
      return true;
    }
  }

  return false;
}

function positionAt(source: string, offset: number): Position {
  let line = 1;
  let lineStart = 0;

  for (let k = 0; k < offset; k++) {
    if (source[k] === '\n') {
      line++;
      lineStart = k + 1;
    }
  }

  return { line, column: offset - lineStart + 1 };
}

export const eolLast: Rule<undefined, 'eol-last'> = {
  id: 'eol-last',
  defaultSeverity: 'warning',
  defaultOptions: undefined,
  // eslint-disable-next-line no-restricted-syntax -- the file's tail is terminators, which the token stream does not carry
  check: ({ source, lineEnding }) => {
    const out: Finding[] = [];
    const len = source.length;

    if (len === 0 || hasLoneCarriageReturn(source)) {
      return out;
    }

    let contentEnd = len;
    while (contentEnd > 0 && (source[contentEnd - 1] === '\n' || source[contentEnd - 1] === '\r')) {
      contentEnd--;
    }

    // Nothing but newlines (or an empty file) — no content to terminate.
    if (contentEnd === 0) {
      return out;
    }

    const trailing = source.slice(contentEnd);

    if (trailing === '\n' || trailing === '\r\n' || trailing === '\r') {
      return out;
    }

    if (trailing.length === 0) {
      const pos = positionAt(source, len);

      out.push({
        range: { start: pos, end: { line: pos.line, column: pos.column + 1 } },
        message: 'File must end with a newline.',
        fix: { range: { start: len, end: len }, replacement: lineEnding },
      });

      return out;
    }

    const firstTerminatorLength = source[contentEnd] === '\r' && source[contentEnd + 1] === '\n' ? 2 : 1;
    const excessStart = contentEnd + firstTerminatorLength;

    out.push({
      range: { start: positionAt(source, excessStart), end: positionAt(source, len) },
      message: 'File must end with a single newline.',
      fix: { range: { start: contentEnd, end: len }, replacement: lineEnding },
    });

    return out;
  },
};
