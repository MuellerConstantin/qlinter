import type { IToken } from 'chevrotain';
import { keywordToken, semicolonToken } from '../../lexer.js';
import { isCloseParen, isKeyword, isOpenParen, isWildcard } from './tokens.js';

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

/*
 * `Load * From X` and `Load * Inline [...]` use `*` as a wildcard
 * placeholder for the field list. It is not a field that benefits from
 * its own line, so leave it on the LOAD header line. As soon as a real
 * field shows up (`Load *, Field1, ...`) the wildcard is treated like any
 * other field and must take its own line.
 */
export function isLoneWildcard(tokens: IToken[], start: number, end: number): boolean {
  let depth = 0;
  let topLevelCount = 0;
  let wildcardSeen = false;

  for (let i = start; i < end; i++) {
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

    topLevelCount++;

    if (isWildcard(t)) {
      wildcardSeen = true;
    }
  }

  return wildcardSeen && topLevelCount === 1;
}
