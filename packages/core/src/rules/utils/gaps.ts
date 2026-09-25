import { tokenMatcher, type IToken } from 'chevrotain';
import { colonToken, commaToken, equalsToken, punctuationToken, semicolonToken } from '../../lexer.js';

/*
 * Who owns the gap between two neighbours.
 *
 * Every horizontal gap has exactly one owner. A punctuation mark owns the gaps
 * on both of its sides, so a rule governing the space between plain tokens has
 * to step over punctuation rather than measure up to it — two owners rewriting
 * one gap either contradict each other or lose a fix to the other's range.
 *
 * The arithmetic characters are owned by nobody, deliberately: a mechanical
 * space around one of them could change what the script loads. They lex as
 * punctuation, so the split below already leaves them alone; widening it to
 * treat them as words would undo that decision.
 *
 * Where the split falls is decided here once, so the rules on either side of it
 * cannot drift apart.
 */

/** A token that stands on its own: a keyword, a name in any of its delimited forms, a literal. */
export function isWord(token: IToken): boolean {
  return !(
    tokenMatcher(token, punctuationToken) ||
    tokenMatcher(token, commaToken) ||
    tokenMatcher(token, equalsToken) ||
    tokenMatcher(token, semicolonToken) ||
    tokenMatcher(token, colonToken)
  );
}

/*
 * A line break outranks a space.
 *
 * The rules that place a token on a line of its own and the rules that space a
 * gap can both reach for the same gap — one to break it, one to narrow it. That
 * is settled without either knowing of the other, because every spacing rule
 * only ever reads a gap that stays on one line: once the break is in, the gap is
 * no longer theirs, and a space put in first is still a gap on one line that the
 * break then replaces. Either way round, the break is what remains.
 *
 * A spacing rule therefore does not step aside for a token that is about to move
 * to a line of its own. Whether one moves depends on which rules a config turns
 * on, and a rule that asked would stop spacing that gap for everyone who keeps
 * the token on its line.
 */

/*
 * The gap before a `;` belongs to the `;`.
 *
 * Two marks side by side would each own the gap between them, and the rule for
 * the one on the left asks for a space the rule for the terminator removes — so
 * `Let x =;` never settled. The terminator decides: whatever a statement ends
 * on, nothing stands between it and its `;`, and the rule for the mark before it
 * steps aside.
 */
export function ownsGapBefore(token: IToken | undefined): boolean {
  return token !== undefined && tokenMatcher(token, semicolonToken);
}

/*
 * Tokens and comments in one stream, by position.
 *
 * What stands beside a gap is not only the next token: a comment counts as
 * something, and `Load A,/* why *\/ B` is as unseparated as `Load A,B`. Reading
 * the token stream alone steps over the comment and measures the gap to the
 * token behind it instead.
 */
export function contentInOrder(tokens: IToken[], comments: IToken[]): IToken[] {
  return [...tokens, ...comments].sort((a, b) => a.startOffset - b.startOffset);
}
