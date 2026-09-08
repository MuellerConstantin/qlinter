import { tokenMatcher, type IToken } from 'chevrotain';
import { newlineToken } from '../../lexer.js';
import type { LineSpan } from '../../lines.js';

const endOf = (token: IToken): number => (token.endOffset ?? token.startOffset) + 1;

const startIndexes = new WeakMap<IToken[], Map<number, IToken>>();
const endIndexes = new WeakMap<IToken[], Map<number, IToken>>();

/*
 * The whitespace runs of one lexing pass, keyed by the offset they start and end
 * at. Cached against the array itself: a lint pass hands every rule the same
 * array, and each would otherwise build the same two maps again.
 */
function indexed(whitespaces: IToken[], by: 'start' | 'end'): Map<number, IToken> {
  const cache = by === 'start' ? startIndexes : endIndexes;
  let index = cache.get(whitespaces);

  if (index === undefined) {
    index = new Map(whitespaces.map((run) => [by === 'start' ? run.startOffset : endOf(run), run]));
    cache.set(whitespaces, index);
  }

  return index;
}

/** True when the run is a line break rather than horizontal whitespace. */
export function isLineBreak(run: IToken): boolean {
  return tokenMatcher(run, newlineToken);
}

/*
 * The whitespace runs filling `[start, end)`, or undefined when anything else
 * sits in it. An empty range is filled by no runs at all, which is not nothing:
 * it means the range holds no content either.
 *
 * Walking the lexer's own whitespace tokens rather than re-reading the source
 * leaves the question of what counts as whitespace where it is defined. A range
 * the walk cannot cross holds something the lexer routed elsewhere — a comment,
 * a construct it keeps whole, or a character it could not read — and is nobody's
 * to overwrite.
 */
export function runsSpanning(whitespaces: IToken[], start: number, end: number): IToken[] | undefined {
  const byStart = indexed(whitespaces, 'start');
  const out: IToken[] = [];
  let at = start;

  while (at < end) {
    const run = byStart.get(at);

    if (run === undefined) {
      return undefined;
    }

    out.push(run);
    at = endOf(run);
  }

  return at === end ? out : undefined;
}

/** The whitespace run ending exactly at `offset`, if the lexer reported one. */
export function runEndingAt(whitespaces: IToken[], offset: number): IToken | undefined {
  return indexed(whitespaces, 'end').get(offset);
}

/** The whitespace run starting exactly at `offset`, if the lexer reported one. */
export function runStartingAt(whitespaces: IToken[], offset: number): IToken | undefined {
  return indexed(whitespaces, 'start').get(offset);
}

/** The whitespace runs filling the gap between `prev` and `next`, or undefined when anything else does. */
export function gapRuns(whitespaces: IToken[], prev: IToken, next: IToken): IToken[] | undefined {
  return runsSpanning(whitespaces, endOf(prev), next.startOffset);
}

/*
 * The gap between `prev` and `next` when it is whitespace within one line, and
 * holds at least one character.
 *
 * This is the gap a spacing rule may rewrite. An empty gap is not one: closing
 * or widening it is a decision about whether two tokens belong together, which
 * the rule asking has to make for itself. A gap carrying a line break is not one
 * either — where a line ends belongs to the layout rules, not to spacing.
 */
export function horizontalGap(whitespaces: IToken[], prev: IToken, next: IToken): IToken[] | undefined {
  const runs = gapRuns(whitespaces, prev, next);

  return runs !== undefined && runs.length > 0 && !runs.some(isLineBreak) ? runs : undefined;
}

/*
 * Whether a token has anything but whitespace beside it on its own line.
 *
 * Both edges come from the line the token sits on, so neither has to reason
 * about where the file ends: the last line's span stops where the text does, and
 * a token closing it reaches that edge like any other.
 */
export function opensLine(whitespaces: IToken[], lines: LineSpan[], token: IToken): boolean {
  const span = lines[(token.startLine ?? 1) - 1];

  return span !== undefined && runsSpanning(whitespaces, span.start, token.startOffset) !== undefined;
}

export function closesLine(whitespaces: IToken[], lines: LineSpan[], token: IToken): boolean {
  const span = lines[(token.endLine ?? token.startLine ?? 1) - 1];

  return span !== undefined && runsSpanning(whitespaces, endOf(token), span.end) !== undefined;
}

/** Where the whitespace ending at `offset` begins, line breaks included; `offset` itself when none does. */
export function whitespaceStartBefore(whitespaces: IToken[], offset: number): number {
  let at = offset;

  for (;;) {
    const run = runEndingAt(whitespaces, at);

    if (run === undefined) {
      return at;
    }

    at = run.startOffset;
  }
}

/** Where the horizontal whitespace beginning at `offset` ends; `offset` itself when none does. */
export function horizontalEndAfter(whitespaces: IToken[], offset: number): number {
  let at = offset;

  for (;;) {
    const run = runStartingAt(whitespaces, at);

    if (run === undefined || isLineBreak(run)) {
      return at;
    }

    at = endOf(run);
  }
}
