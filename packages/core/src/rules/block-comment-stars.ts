import { blockCommentToken } from '../lexer.js';
import type { Rule, Finding } from '../types.js';
import { tokenRange } from '../token.js';
import { detectLineEnding } from './utils/lines.js';

const ONLY_WHITESPACE = /^[ \t]*$/;
const LEADING_WS = /^[ \t]*/;
const TRAILING_WS = /[ \t]+$/;
const CR_AT_END = /\r$/;

/*
 * Reformat a multi-line block comment into the canonical JSDoc-like shape:
 *
 *   /*
 *    * body
 *    *\/
 *
 * The `*` column is one position right of the opening `/`, so middle and
 * closing lines share the same `<indent> ` prefix. The function is
 * idempotent — re-running it on its own output is a no-op.
 */
function normalizeBlockComment(text: string, indent: string): string {
  const middlePrefix = `${indent} `;
  const eol = detectLineEnding(text);

  const inner = text.slice(2, -2);
  const rawLines = inner.split('\n').map((line) => line.replace(CR_AT_END, ''));
  const bodies: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i];

    if (i === 0) {
      line = line.replace(LEADING_WS, '');
    } else {
      line = line.replace(LEADING_WS, '');

      if (line.startsWith('*')) {
        line = line.slice(1);
      }

      if (line.startsWith(' ') || line.startsWith('\t')) {
        line = line.slice(1);
      }
    }

    if (i === rawLines.length - 1) {
      line = line.replace(TRAILING_WS, '');
    }

    bodies.push(line);
  }

  while (bodies.length > 0 && bodies[0] === '') {
    bodies.shift();
  }

  while (bodies.length > 0 && bodies[bodies.length - 1] === '') {
    bodies.pop();
  }

  if (bodies.length === 0) {
    return `/*${eol}${middlePrefix}*/`;
  }

  const middleLines = bodies.map((body) => (body === '' ? `${middlePrefix}*` : `${middlePrefix}* ${body}`));

  return `/*${eol}${middleLines.join(eol)}${eol}${middlePrefix}*/`;
}

export const blockCommentStars: Rule<undefined, 'block-comment-stars'> = {
  id: 'block-comment-stars',
  defaultSeverity: 'warning',
  defaultOptions: undefined,
  check: ({ source, comments }) => {
    const out: Finding[] = [];

    for (const token of comments) {
      if (token.tokenType !== blockCommentToken) {
        continue;
      }

      const startLine = token.startLine ?? 1;
      const endLine = token.endLine ?? startLine;

      if (startLine === endLine) {
        continue;
      }

      const startOffset = token.startOffset;
      const endOffset = (token.endOffset ?? startOffset) + 1;

      let lineStart = startOffset;

      while (lineStart > 0 && source[lineStart - 1] !== '\n') {
        lineStart--;
      }

      const beforeOpen = source.slice(lineStart, startOffset);

      if (!ONLY_WHITESPACE.test(beforeOpen)) {
        continue;
      }

      const text = source.slice(startOffset, endOffset);
      const normalized = normalizeBlockComment(text, beforeOpen);

      if (text === normalized) {
        continue;
      }

      out.push({
        range: tokenRange(token),
        message: "Multi-line block comment lines should start with aligned ' *'.",
        fix: {
          range: { start: startOffset, end: endOffset },
          replacement: normalized,
        },
      });
    }

    return out;
  },
};
