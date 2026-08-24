import type { Rule, Finding } from '../types.js';

export interface MaxLineLengthOptions {
  max: number;
}

export const maxLineLength: Rule<MaxLineLengthOptions, 'max-line-length'> = {
  id: 'max-line-length',
  defaultSeverity: 'warning',
  defaultOptions: { max: 120 },
  options: { max: { type: 'number', min: 20, max: 1000 } },
  check: ({ source }, { max }) => {
    const out: Finding[] = [];
    const lines = source.split(/\r?\n/);

    for (let index = 0; index < lines.length; index++) {
      const length = lines[index].length;

      if (length <= max) {
        continue;
      }

      out.push({
        range: {
          start: { line: index + 1, column: max + 1 },
          end: { line: index + 1, column: length + 1 },
        },
        message: `Line exceeds the maximum length of ${max} characters (got ${length}).`,
      });
    }

    return out;
  },
};
