import { tokenMatcher, type IToken } from 'chevrotain';
import {
  blockCloseToken,
  clauseStarterToken,
  colonToken,
  semicolonToken,
  statementTerminatorToken,
} from '../../lexer.js';
import { groupByLine } from './lines.js';
import { isCloseParen, isKeyword, isOpenParen } from './tokens.js';

/** True when the token is a clause keyword that closes the LOAD field list. */
export function isClauseStarter(token: IToken): boolean {
  return tokenMatcher(token, clauseStarterToken);
}

/*
 * Keywords assumed to keep their whole header on the line that starts it;
 * multi-line headers for these constructs are not supported. An assumption about
 * how they are written rather than about what the words are, which is why it is
 * not a lexer category. Matched by image because `Case` and `ElseIf` have none:
 * they open no block.
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

/*
 * Index of the first token `match` accepts outside every parenthesis, or -1.
 * The depth walk is what makes a scan "top level", and several rules need it
 * against different tokens, so it is written once here.
 */
export function findAtTopLevel(tokens: IToken[], match: (token: IToken) => boolean): number {
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

    if (depth === 0 && match(t)) {
      return i;
    }
  }

  return -1;
}

/** Index of the statement's `Load` keyword at parenthesis depth zero, or -1. */
export function findLoadIndex(tokens: IToken[]): number {
  return findAtTopLevel(tokens, (token) => isKeyword(token, 'load'));
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

/** One statement, from the line that opens it through the line that closes it. */
export interface StatementSpan {
  first: IToken;
  line: number;
  lastLine: number;
  tokens: IToken[];
}

function endsLabel(lineTokens: IToken[]): boolean {
  return tokenMatcher(lineTokens[lineTokens.length - 1], colonToken);
}

/*
 * Statements as the vertical-spacing rules need to see them: a label and the
 * Load underneath it are one unit, so the statement starts at the label. The
 * top-level split cuts at semicolons instead and would keep neither a label nor
 * a block header apart from its body, which is exactly what those rules ask
 * about.
 */
export function collectStatementSpans(tokens: IToken[]): StatementSpan[] {
  const out: StatementSpan[] = [];
  let previous: IToken[] | undefined;

  for (const { line, tokens: lineTokens } of groupByLine(tokens)) {
    const continues = previous !== undefined && (!previousLineClosesStatement(previous) || endsLabel(previous));

    if (continues) {
      const current = out[out.length - 1];

      current.tokens.push(...lineTokens);
      current.lastLine = line;
    } else {
      out.push({ first: lineTokens[0], line, lastLine: line, tokens: [...lineTokens] });
    }

    previous = lineTokens;
  }

  return out;
}

/*
 * Whether the statement opens a data section: it carries a label, or a
 * top-level `Load` or `Select`.
 *
 * One rule asks for a blank line above such a statement and another for one
 * below what precedes it. Were they to disagree about which statements these
 * are, the same gap would be filled twice or not at all.
 */
export function opensTable(tokens: IToken[]): boolean {
  const second = tokens[1];

  if (second !== undefined && tokenMatcher(second, colonToken)) {
    return true;
  }

  return findLoadIndex(tokens) !== -1 || findAtTopLevel(tokens, (token) => isKeyword(token, 'select')) !== -1;
}
