import type { IToken } from 'chevrotain';
import { keywordToken, semicolonToken } from '../../lexer.js';
import { isCloseParen, isKeyword, isOpenParen } from './tokens.js';

/*
 * Keywords that close a LOAD field list and open the clause list. Each one must
 * appear as the first non-whitespace token of its line.
 *
 * Anything else (Distinct, NoConcatenate, Concatenate, Add, Replace, Mapping,
 * Buffer, First, Join/Keep prefixes, `as`, ...) is intentionally absent — those
 * are modifiers of the LOAD itself, not clauses, and their line placement is
 * governed by a different (future) rule.
 *
 * `Group` and `Order` are listed as the clause start; the trailing `By` is not
 * a separate clause and stays on the same line as its head.
 */
export const CLAUSE_STARTERS = new Set([
  'from',
  'from_field',
  'resident',
  'inline',
  'autogenerate',
  'extension',
  'where',
  'while',
  'group',
  'order',
]);

/** True when the token is a clause keyword that closes the LOAD field list. */
export function isClauseStarter(token: IToken): boolean {
  return token.tokenType === keywordToken && CLAUSE_STARTERS.has(token.image.toLowerCase());
}

/*
 * Tokens whose presence as a line's last token forces the next line to be
 * treated as a fresh statement. `;` is the universal terminator; `:` ends a
 * table label (`MyTable:`); the keywords below implicitly terminate a
 * block-control statement when they appear as its final token (`If x Then`,
 * a dangling `Do`, `Else`, ...).
 */
const TERMINATOR_LAST = new Set([
  ';',
  ':',
  'then',
  'do',
  'else',
  'default',
  'end',
  'endsub',
  'endif',
  'endswitch',
  'next',
  'loop',
]);

/*
 * Block-control keywords that, when they start a line, are assumed to keep
 * their entire header on that single line. Used as a tiebreaker for the
 * statement-start heuristic — `Sub greet`, `For i = 1 to 10`, `Switch x`,
 * `Case 'A'`, `ElseIf x Then` all terminate at end-of-line in practice.
 * Multi-line headers for these constructs are not supported.
 */
const OPENER_FIRST = new Set(['sub', 'for', 'switch', 'case', 'elseif']);

/** Keywords that open a block construct. */
export const BLOCK_OPEN = new Set(['sub', 'if', 'for', 'do', 'switch']);

/** Keywords that close a block construct. */
export const BLOCK_CLOSE = new Set(['end', 'endsub', 'endif', 'endswitch', 'next', 'loop']);

/*
 * Whether the line made of `prevTokens` ends its statement, so the line after
 * it starts a new one.
 *
 * Every indent rule needs the same answer to "is this line a statement start?":
 * `block-indent` to claim the line, `load-indent` to find the line a LOAD hangs
 * off, `continuation-indent` to know which lines are left over. Deriving it once
 * is what keeps them from claiming the same line at different widths and
 * fighting over its fix.
 */
export function previousLineClosesStatement(prevTokens: IToken[]): boolean {
  const first = prevTokens[0];
  const last = prevTokens[prevTokens.length - 1];

  if (TERMINATOR_LAST.has(last.image.toLowerCase())) {
    return true;
  }

  const firstLower = first.image.toLowerCase();

  if (OPENER_FIRST.has(firstLower)) {
    return true;
  }

  if (BLOCK_CLOSE.has(firstLower)) {
    return true;
  }

  return false;
}

/*
 * Split the token stream into statements at top-level semicolons.
 * Parenthesised content keeps a `;` from terminating the statement; in
 * practice no Qlik construct puts `;` inside parens, but the depth check
 * keeps the splitter robust.
 */
export function splitStatements(tokens: IToken[]): IToken[][] {
  const stmts: IToken[][] = [];
  let current: IToken[] = [];
  let depth = 0;

  for (const t of tokens) {
    if (isOpenParen(t)) {
      depth++;
    } else if (isCloseParen(t)) {
      depth--;
    }

    current.push(t);

    if (depth === 0 && t.tokenType === semicolonToken) {
      stmts.push(current);
      current = [];
    }
  }

  if (current.length > 0) {
    stmts.push(current);
  }

  return stmts;
}

/** Index of the statement's `Load` keyword at parenthesis depth zero, or -1. */
export function findLoadIndex(tokens: IToken[]): number {
  let depth = 0;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    if (isOpenParen(t)) {
      depth++;
      continue;
    }

    if (isCloseParen(t)) {
      depth--;
      continue;
    }

    if (depth === 0 && isKeyword(t, 'load')) {
      return i;
    }
  }

  return -1;
}

/*
 * The field list runs from the first token after `Load [Distinct]` up to
 * the first top-level clause keyword (From/Resident/...) or the closing
 * semicolon, whichever comes first.
 */
export function findFieldListBoundaries(tokens: IToken[], loadIdx: number): { start: number; end: number } {
  let start = loadIdx + 1;

  while (start < tokens.length && isKeyword(tokens[start], 'distinct')) {
    start++;
  }

  let depth = 0;
  let end = tokens.length;

  for (let i = start; i < tokens.length; i++) {
    const t = tokens[i];

    if (isOpenParen(t)) {
      depth++;
      continue;
    }

    if (isCloseParen(t)) {
      depth--;
      continue;
    }

    if (depth !== 0) {
      continue;
    }

    if (t.tokenType === semicolonToken) {
      end = i;
      break;
    }

    if (isClauseStarter(t)) {
      end = i;
      break;
    }
  }

  return { start, end };
}
