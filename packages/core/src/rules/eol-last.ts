import type { Position, Rule, Finding } from '../types.js';
import { detectLineEnding } from './utils/lines.js';

/*
 * A file should end with exactly one line terminator: enough so the last line
 * is a complete line (POSIX text-file convention, cleaner diffs — the last
 * content line never shows up as changed just because a newline was appended
 * after it), but no trailing blank lines padding the end of the file.
 *
 * This owns only the very end of the file. Trailing spaces on the last line are
 * left to trailing-whitespace, and blank-line runs in the middle of the script
 * to no-multiple-empty-lines; the format loop converges the three together.
 */

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
  check: ({ source }) => {
    const out: Finding[] = [];
    const len = source.length;

    if (len === 0) {
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

    const lineEnding = detectLineEnding(source);

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
