import { tokenMatcher, type IToken } from 'chevrotain';
import { lineCommentToken } from '../lexer.js';
import type { Rule, Finding } from '../types.js';
import { tokenRange } from '../token.js';
import { blockCommentFrom, isBannerLineComment } from './utils/comments.js';
import { isLineBreak, opensLine, runEndingAt } from './utils/whitespace.js';

/*
 * Either half of the block-comment delimiter, appearing in prose.
 *
 * Qlik documents that a section between the two markers is a comment and says
 * nothing about what a further opening marker inside one does, nor about where
 * such a comment then ends. Putting such a line inside a block would rest on an
 * answer the reference does not give.
 *
 * @see https://help.qlik.com/en-US/sense/2.0/Subsystems/Hub/Content/LoadData/comment-in-script.htm
 */
const BLOCK_MARKER = /\/\*|\*\//;

/*
 * A directive the runner reads off the raw line it sits on. Inside a block it
 * would still read as prose to a person and as nothing at all to the runner,
 * silently dropping the suppression it was written for.
 */
const DIRECTIVE = /^qlinter-/;

/*
 * Whether a comment line may go inside a block at all.
 *
 * A line that may not steps out of the run rather than poisoning it: what sits
 * above and below it is ordinary prose, and folding that prose changes nothing
 * about the line itself.
 */
function foldable(body: string): boolean {
  return !DIRECTIVE.test(body) && !BLOCK_MARKER.test(body);
}

export const multilineCommentBlock: Rule<undefined, 'multiline-comment-block'> = {
  id: 'multiline-comment-block',
  defaultSeverity: 'warning',
  defaultOptions: undefined,
  check: ({ comments, whitespaces, lines, lineEnding }) => {
    const out: Finding[] = [];
    let run: IToken[] = [];

    const flush = () => {
      const group = run;
      run = [];

      if (group.length < 2) {
        return;
      }

      /*
       * A banner is the exception to stepping aside: the rails and the text
       * between them are one unit, so a run holding one is left whole.
       */
      if (group.some((token) => isBannerLineComment(token.image))) {
        return;
      }

      const bodies = group.map((token) => token.image.slice(2).trim());
      const first = group[0];
      const last = group[group.length - 1];

      const before = runEndingAt(whitespaces, first.startOffset);
      const indent = before === undefined || isLineBreak(before) ? '' : before.image;

      out.push({
        range: { start: tokenRange(first).start, end: tokenRange(last).end },
        message: "Consecutive '//' comment lines should be a single block comment.",
        fix: {
          range: { start: first.startOffset, end: (last.endOffset ?? last.startOffset) + 1 },
          replacement: blockCommentFrom(bodies, indent, lineEnding),
        },
      });
    };

    for (const token of comments) {
      const previous = run[run.length - 1];
      /* A comment sharing its line with code annotates that line, not the ones around it. */
      const member =
        tokenMatcher(token, lineCommentToken) &&
        opensLine(whitespaces, lines, token) &&
        foldable(token.image.slice(2).trim());

      if (!member || (previous !== undefined && (token.startLine ?? 1) !== (previous.startLine ?? 1) + 1)) {
        flush();
      }

      if (member) {
        run.push(token);
      }
    }

    flush();

    return out;
  },
};
