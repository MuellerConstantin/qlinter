import type { Rule, Finding } from '../types.js';

export interface NoMultipleEmptyLinesOptions {
  max: number;
}

interface LineSpan {
  start: number;
  end: number;
  terminator: string;
}

function splitLines(source: string): LineSpan[] {
  const lines: LineSpan[] = [];
  const re = /\r?\n/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(source)) !== null) {
    lines.push({ start: cursor, end: match.index, terminator: match[0] });
    cursor = match.index + match[0].length;
  }

  if (cursor < source.length) {
    lines.push({ start: cursor, end: source.length, terminator: '' });
  }

  return lines;
}

export const noMultipleEmptyLines: Rule<NoMultipleEmptyLinesOptions, 'no-multiple-empty-lines'> = {
  id: 'no-multiple-empty-lines',
  defaultSeverity: 'warning',
  defaultOptions: { max: 1 },
  options: { max: { type: 'number', min: 0, max: 10 } },
  check: ({ source }, { max }) => {
    const out: Finding[] = [];
    const lines = splitLines(source);

    let runStart = -1;

    for (let i = 0; i <= lines.length; i++) {
      const blank = i < lines.length && source.slice(lines[i].start, lines[i].end).trim() === '';

      if (blank && runStart === -1) {
        runStart = i;
        continue;
      }

      if (blank) {
        continue;
      }

      if (runStart === -1) {
        continue;
      }

      const runLength = i - runStart;

      if (runLength > max) {
        const firstExcess = lines[runStart + max];
        const lastExcess = lines[i - 1];

        out.push({
          range: {
            start: { line: runStart + max + 1, column: 1 },
            end: { line: i, column: 1 },
          },
          message: `Too many consecutive empty lines (max ${max}, got ${runLength}).`,
          fix: {
            range: { start: firstExcess.start, end: lastExcess.end + lastExcess.terminator.length },
            replacement: '',
          },
        });
      }

      runStart = -1;
    }

    return out;
  },
};
