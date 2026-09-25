import { tokenMatcher, type IToken } from 'chevrotain';
import { lineCommentToken } from '../lexer.js';
import type { LineSpan } from '../lines.js';
import { tokenRange } from '../token.js';
import type { Finding, Rule } from '../types.js';
import { classifyBlockLine, closesBody } from './utils/blocks.js';
import { isSlashLedLineComment } from './utils/comments.js';
import { isLineBreak, opensLine, runStartingAt } from './utils/whitespace.js';

/** The whitespace a line opens with, empty when it opens with anything else. */
function indentOf(whitespaces: IToken[], lines: LineSpan[], line: number): string {
  const span = lines[line - 1];
  const run = span === undefined ? undefined : runStartingAt(whitespaces, span.start);

  return run === undefined || isLineBreak(run) ? '' : run.image;
}

/*
 * The comment lines of a script — lines a comment opens and no code starts on.
 * Every other line belongs to a rule that indents code; these belong to nobody
 * else, and a comment left where it was written drifts away from the code it
 * describes.
 */
export const commentIndent: Rule<undefined, 'comment-indent'> = {
  id: 'comment-indent',
  defaultSeverity: 'warning',
  defaultOptions: undefined,
  check: ({ tokens, comments, whitespaces, lines }) => {
    const out: Finding[] = [];
    const codeLines = new Set(tokens.map((token) => token.startLine ?? 1));
    let after = 0;

    for (const comment of comments) {
      const line = comment.startLine ?? 1;

      while (after < tokens.length && tokens[after].startOffset < comment.startOffset) {
        after++;
      }

      if (codeLines.has(line) || !opensLine(whitespaces, lines, comment)) {
        continue;
      }

      /* A section marker is kept exactly as written, its column included. */
      if (tokenMatcher(comment, lineCommentToken) && isSlashLedLineComment(comment.image)) {
        continue;
      }

      const next = tokens[after];
      const previous = tokens[after - 1];

      /* Code that does not open its line gives no column to take. */
      if (next !== undefined && !opensLine(whitespaces, lines, next)) {
        continue;
      }

      /* Below the last line of code there is nothing left to introduce, so the comment closes what is above. */
      const anchor = next ?? previous;

      if (anchor === undefined) {
        continue;
      }

      const actual = indentOf(whitespaces, lines, line);
      const expected = indentOf(whitespaces, lines, anchor.startLine ?? 1);

      if (actual === expected) {
        continue;
      }

      /* Above the line that ends a body, the comment may still belong to that body. */
      if (
        next !== undefined &&
        previous !== undefined &&
        closesBody(classifyBlockLine([next])) &&
        actual === indentOf(whitespaces, lines, previous.startLine ?? 1)
      ) {
        continue;
      }

      const start = lines[line - 1].start;

      out.push({
        range: tokenRange(comment),
        message: 'Indent a comment like the code it introduces.',
        fix: { range: { start, end: comment.startOffset }, replacement: expected },
      });
    }

    return out;
  },
};
