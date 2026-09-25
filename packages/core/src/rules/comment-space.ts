import { blockCommentToken, lineCommentToken } from '../lexer.js';
import type { Rule, Finding } from '../types.js';
import { tokenRange } from '../token.js';
import { isSlashLedLineComment } from './utils/comments.js';

const BLOCK_BANNER = /^\*+$/;
const WHITESPACE_HEAD = /^\s/;
const WHITESPACE_TAIL = /\s$/;

export const commentSpace: Rule<undefined, 'comment-space'> = {
  id: 'comment-space',
  defaultSeverity: 'warning',
  defaultOptions: undefined,
  check: ({ comments }) => {
    const out: Finding[] = [];

    for (const token of comments) {
      if (token.tokenType === lineCommentToken) {
        const body = token.image.slice(2);

        if (body.length === 0 || WHITESPACE_HEAD.test(body) || isSlashLedLineComment(token.image)) {
          continue;
        }

        const insertAt = token.startOffset + 2;

        out.push({
          range: tokenRange(token),
          message: "Expected a space after '//'.",
          fix: { range: { start: insertAt, end: insertAt }, replacement: ' ' },
        });

        continue;
      }

      if (token.tokenType !== blockCommentToken) {
        continue;
      }

      const inner = token.image.slice(2, -2);

      if (inner.length === 0 || BLOCK_BANNER.test(inner)) {
        continue;
      }

      if (!WHITESPACE_HEAD.test(inner)) {
        const insertAt = token.startOffset + 2;

        out.push({
          range: tokenRange(token),
          message: "Expected a space after '/*'.",
          fix: { range: { start: insertAt, end: insertAt }, replacement: ' ' },
        });
      }

      if (!WHITESPACE_TAIL.test(inner)) {
        const endOffset = (token.endOffset ?? token.startOffset) + 1;
        const insertAt = endOffset - 2;

        out.push({
          range: tokenRange(token),
          message: "Expected a space before '*/'.",
          fix: { range: { start: insertAt, end: insertAt }, replacement: ' ' },
        });
      }
    }

    return out;
  },
};
