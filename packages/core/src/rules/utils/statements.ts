import { tokenMatcher, type IToken } from 'chevrotain';
import {
  blockCloseToken,
  clauseStarterToken,
  colonToken,
  semicolonToken,
  statementTerminatorToken,
} from '../../lexer.js';
import { isCloseParen, isKeyword, isOpenParen } from './tokens.js';

/** True when the token is a clause keyword that closes the LOAD field list. */
export function isClauseStarter(token: IToken): boolean {
  return tokenMatcher(token, clauseStarterToken);
}

/*
 * Block-control keywords that, when they start a line, are assumed to keep their
 * entire header on that single line — `Sub greet`, `For i = 1 to 10`,
 * `Switch x`, `Case 'A'`, `ElseIf x Then`.
 *
 * This is the one piece of the statement-start question the lexer does not own,
 * and deliberately so: it is not a statement about what these words *are* — that
 * lives in `lexer.ts` as token categories — but an assumption about how their
 * headers are written. Multi-line headers for these constructs are not
 * supported. Matched by image because `Case` and `ElseIf` carry no structural
 * category; they open no block.
 */
const SINGLE_LINE_HEADER = new Set(['sub', 'for', 'switch', 'case', 'elseif']);

/*
 * Whether the line made of `prevTokens` ends its statement, so the line after
 * it starts a new one.
 */
export function previousLineClosesStatement(prevTokens: IToken[]): boolean {
  const first = prevTokens[0];
  const last = prevTokens[prevTokens.length - 1];

  /* `;` ends any statement, `:` ends a table label, and the terminator keywords end theirs. */
  if (
    tokenMatcher(last, semicolonToken) ||
    tokenMatcher(last, colonToken) ||
    tokenMatcher(last, statementTerminatorToken)
  ) {
    return true;
  }

  if (tokenMatcher(first, blockCloseToken)) {
    return true;
  }

  return SINGLE_LINE_HEADER.has(first.image.toLowerCase());
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

    if (depth === 0 && tokenMatcher(t, semicolonToken)) {
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

    if (tokenMatcher(t, semicolonToken)) {
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
