import { blockCommentToken } from '../lexer.js';
import type { Rule, Finding } from '../types.js';
import { tokenRange } from '../token.js';
import { blockCommentBodies, blockCommentFrom } from './utils/comments.js';
import { isLineBreak, opensLine, runEndingAt } from './utils/whitespace.js';
import { detectLineEnding } from '../lines.js';

export const blockCommentStars: Rule<undefined, 'block-comment-stars'> = {
  id: 'block-comment-stars',
  defaultSeverity: 'warning',
  defaultOptions: undefined,
  check: ({ comments, whitespaces, lines }) => {
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

      /* A comment sharing its line with code has no rail to align. */
      if (!opensLine(whitespaces, lines, token)) {
        continue;
      }

      const indent = runEndingAt(whitespaces, startOffset);
      const beforeOpen = indent === undefined || isLineBreak(indent) ? '' : indent.image;

      const text = token.image;
      const normalized = blockCommentFrom(blockCommentBodies(text), beforeOpen, detectLineEnding(text));

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
