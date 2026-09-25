import { tokenMatcher, type IToken } from 'chevrotain';
import { blockCommentToken, lineCommentToken } from '../lexer.js';
import type { Rule, Finding } from '../types.js';
import { tokenRange } from '../token.js';
import { blockCommentBodies, blockCommentFrom, isBannerBlockComment, isSlashLedLineComment } from './utils/comments.js';
import { closesLine, isLineBreak, opensLine, runEndingAt } from './utils/whitespace.js';

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

/* A block's bodies without the blank lines at its edges, which pad that block and nothing it joins. */
function paddingTrimmed(image: string): string[] {
  const bodies = blockCommentBodies(image);
  let start = 0;
  let end = bodies.length;

  while (start < end && bodies[start] === '') {
    start++;
  }

  while (end > start && bodies[end - 1] === '') {
    end--;
  }

  return bodies.slice(start, end);
}

export const multilineCommentBlock: Rule<undefined, 'multiline-comment-block'> = {
  id: 'multiline-comment-block',
  defaultSeverity: 'warning',
  defaultOptions: undefined,
  check: ({ comments, whitespaces, lines, lineEnding }) => {
    const out: Finding[] = [];
    let run: IToken[] = [];

    /*
     * A comment that has its lines to itself. One sharing a line with code
     * annotates that line, not the ones around it. A block comment beside a run
     * of line comments is the same comment written in two syntaxes, and joins it;
     * a banner of asterisks is a divider and does not.
     */
    const member = (token: IToken): boolean => {
      if (!opensLine(whitespaces, lines, token)) {
        return false;
      }

      if (tokenMatcher(token, lineCommentToken)) {
        return foldable(token.image.slice(2).trim());
      }

      return (
        tokenMatcher(token, blockCommentToken) &&
        closesLine(whitespaces, lines, token) &&
        !isBannerBlockComment(token.image)
      );
    };

    const flush = () => {
      const group = run;
      run = [];

      /* Blocks alone are already what this rule asks for; only a line comment among them makes a run. */
      if (group.length < 2 || !group.some((token) => tokenMatcher(token, lineCommentToken))) {
        return;
      }

      /*
       * A slash-led line is the exception to stepping aside: a banner's rails
       * and the text between them are one unit, and a section marker must stay
       * a line comment of its own, so a run holding one is left whole.
       */
      if (group.some((token) => tokenMatcher(token, lineCommentToken) && isSlashLedLineComment(token.image))) {
        return;
      }

      const bodies = group.flatMap((token) =>
        tokenMatcher(token, lineCommentToken) ? [token.image.slice(2).trim()] : paddingTrimmed(token.image),
      );
      const first = group[0];
      const last = group[group.length - 1];

      const before = runEndingAt(whitespaces, first.startOffset);
      const indent = before === undefined || isLineBreak(before) ? '' : before.image;

      out.push({
        range: { start: tokenRange(first).start, end: tokenRange(last).end },
        message: 'Consecutive comment lines should be a single block comment.',
        fix: {
          range: { start: first.startOffset, end: (last.endOffset ?? last.startOffset) + 1 },
          replacement: blockCommentFrom(bodies, indent, lineEnding),
        },
      });
    };

    for (const token of comments) {
      const previous = run[run.length - 1];

      if (!member(token)) {
        flush();
        continue;
      }

      if (previous !== undefined && (token.startLine ?? 1) !== (previous.endLine ?? previous.startLine ?? 1) + 1) {
        flush();
      }

      run.push(token);
    }

    flush();

    return out;
  },
};
