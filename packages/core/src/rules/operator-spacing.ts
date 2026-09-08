import type { IToken } from 'chevrotain';
import { equalsToken, punctuationToken } from '../lexer.js';
import type { Rule, Finding } from '../types.js';
import { tokenRange } from '../token.js';
import { closesLine, gapRuns, isLineBreak, opensLine } from './utils/whitespace.js';

/*
 * Operators whose spacing this rule enforces. Only the unambiguously *binary*
 * operators are covered: assignment / equality (`=`), the relational operators
 * (`<`, `>`, `<=`, `>=`, `<>`), and string concatenation (`&`).
 *
 * Arithmetic operators (`+`, `-`, `*`, `/`) are intentionally out of scope:
 * `+`/`-` are ambiguously unary (`= -1`), and `*` doubles as the `Load *`
 * wildcard. A mechanical space around any of them could change what the script
 * means, so they are left alone.
 */

const isPunct = (token: IToken | undefined, image: string): boolean =>
  token !== undefined && token.tokenType === punctuationToken && token.image === image;

const isEquals = (token: IToken | undefined): boolean => token !== undefined && token.tokenType === equalsToken;

const endOf = (token: IToken): number => (token.endOffset ?? token.startOffset) + 1;

const adjacent = (left: IToken, right: IToken): boolean => endOf(left) === right.startOffset;

/*
 * Tokens and comments in one stream, by position. An operator is separated from
 * whatever stands next to it, and a comment counts as something.
 */
function contentInOrder(tokens: IToken[], comments: IToken[]): IToken[] {
  return [...tokens, ...comments].sort((a, b) => a.startOffset - b.startOffset);
}

/** The gap between two neighbours when it stays on one line, empty included. */
function sameLineGap(whitespaces: IToken[], prev: IToken, next: IToken): IToken[] | undefined {
  const runs = gapRuns(whitespaces, prev, next);

  return runs !== undefined && !runs.some(isLineBreak) ? runs : undefined;
}

/** The fix that normalises a gap to one space, or undefined when it already is one. */
function normalise(runs: IToken[], from: number, to: number): NonNullable<Finding['fix']> | undefined {
  const gap = runs.map((run) => run.image).join('');

  return gap === ' ' ? undefined : { range: { start: from, end: to }, replacement: ' ' };
}

const message = (runs: IToken[], label: string, side: 'before' | 'after'): string =>
  runs.length === 0 ? `Expected a space ${side} '${label}'.` : `Expected exactly one space ${side} '${label}'.`;

/**
 * Enforce exactly one space on both sides of a binary operator. A side that
 * sits against a line boundary (leading indentation, or an operator that ends
 * its line for a wrapped expression) is left untouched — that layout is owned
 * by the indent rules and is a deliberate multi-line style.
 */
export const operatorSpacing: Rule<undefined, 'operator-spacing'> = {
  id: 'operator-spacing',
  defaultSeverity: 'warning',
  defaultOptions: undefined,
  check: ({ tokens, comments, whitespaces, lines }) => {
    const out: Finding[] = [];
    const content = contentInOrder(tokens, comments);

    for (let i = 0; i < content.length; i++) {
      const token = content[i];
      const prev = content[i - 1];
      const next = content[i + 1];

      let last = token;
      let label: string;

      if (isEquals(token)) {
        // Second char of `<=` / `>=` — handled with the `<` / `>` that opens it.
        if ((isPunct(prev, '<') || isPunct(prev, '>')) && adjacent(prev, token)) {
          continue;
        }

        /*
         * Leading eval marker in `$(= …)`: an `=` right after `(` is not a
         * binary operator. Skip it so the dollar expansion stays intact.
         */
        if (prev !== undefined && isPunct(prev, '(') && sameLineGap(whitespaces, prev, token) !== undefined) {
          continue;
        }

        label = '=';
      } else if (isPunct(token, '<')) {
        if (next !== undefined && (isEquals(next) || isPunct(next, '>')) && adjacent(token, next)) {
          last = next;
          label = `<${next.image}`;
          i++;
        } else {
          label = '<';
        }
      } else if (isPunct(token, '>')) {
        // Second char of `<>` — handled with the `<` that opens it.
        if (isPunct(prev, '<') && adjacent(prev, token)) {
          continue;
        }

        if (next !== undefined && isEquals(next) && adjacent(token, next)) {
          last = next;
          label = '>=';
          i++;
        } else {
          label = '>';
        }
      } else if (isPunct(token, '&')) {
        label = '&';
      } else {
        continue;
      }

      /* Start of line — that is indentation, not operator spacing. */
      if (prev !== undefined && !opensLine(whitespaces, lines, token)) {
        const runs = sameLineGap(whitespaces, prev, token);

        if (runs !== undefined) {
          const fix = normalise(runs, endOf(prev), token.startOffset);

          if (fix !== undefined) {
            out.push({ range: tokenRange(token), message: message(runs, label, 'before'), fix });
          }
        }
      }

      /* End of line — a wrapped expression, left to the indent rules. */
      const after = content[i + 1];

      if (after !== undefined && !closesLine(whitespaces, lines, last)) {
        const runs = sameLineGap(whitespaces, last, after);

        if (runs !== undefined) {
          const fix = normalise(runs, endOf(last), after.startOffset);

          if (fix !== undefined) {
            out.push({ range: tokenRange(token), message: message(runs, label, 'after'), fix });
          }
        }
      }
    }

    return out;
  },
};
