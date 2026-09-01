import { tokenMatcher, type IToken } from 'chevrotain';
import {
  blockCloseToken,
  clauseStarterToken,
  colonToken,
  equalsToken,
  identifierToken,
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
 * An assignment written without `Let`. Qlik accepts the form, but the statement
 * is then a control statement, and one "must be contained within a single
 * script row and may be terminated either with a semicolon or end-of-line".
 * Two consequences the rules have to agree on: the row's end terminates such a
 * statement even without a `;`, and no fix may push part of it onto a second
 * row, which would make the script unloadable.
 *
 * Only meaningful at the start of a statement: `A = 1` in a LOAD field list is
 * an expression, not an assignment. The quoted sentence stands in the September
 * 2020 reference; later revisions of the page dropped it, the behaviour intact.
 *
 * @see {@link https://help.qlik.com/en-US/sense/September2020/Subsystems/Hub/Content/Sense_Hub/Scripting/ScriptRegularStatements/Let.htm | Let}
 */
export function isKeywordLessAssignment(tokens: IToken[]): boolean {
  const [name, equals] = tokens;

  if (name === undefined || equals === undefined) {
    return false;
  }

  return tokenMatcher(name, identifierToken) && tokenMatcher(equals, equalsToken);
}

/*
 * Whether the line made of `lineTokens` ends its statement, so the line after
 * it starts a new one. `startsStatement` says whether this line opened the
 * statement it belongs to — a row-bound assignment can only be read off the
 * line that starts one.
 */
function closesStatement(lineTokens: IToken[], startsStatement: boolean): boolean {
  const first = lineTokens[0];
  const last = lineTokens[lineTokens.length - 1];

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

  if (startsStatement && isKeywordLessAssignment(lineTokens)) {
    return true;
  }

  return SINGLE_LINE_HEADER.has(first.image.toLowerCase());
}

/*
 * The lines that open a statement rather than continue the one above. Whether a
 * line closes its statement can depend on whether that line started one, so the
 * answer comes from folding the file top down; doing it here once keeps the
 * rules that ask from each carrying their own copy of that state.
 */
export function statementStartLines(tokens: IToken[]): ReadonlySet<number> {
  const out = new Set<number>();
  let previous: { tokens: IToken[]; starts: boolean } | undefined;

  for (const { line, tokens: lineTokens } of groupByLine(tokens)) {
    const starts = previous === undefined || closesStatement(previous.tokens, previous.starts);

    if (starts) {
      out.add(line);
    }

    previous = { tokens: lineTokens, starts };
  }

  return out;
}

/** True when `token` opens a row below the one `current` has reached. */
function startsNewRow(current: IToken[], token: IToken): boolean {
  const last = current[current.length - 1];

  return (token.startLine ?? 1) > (last.endLine ?? last.startLine ?? 1);
}

/*
 * Split the token stream into statements at top-level semicolons, and at the
 * row end of an assignment written without a keyword.
 * Parenthesised content keeps a `;` from terminating the statement; in
 * practice no Qlik construct puts `;` inside parens, but the depth check
 * keeps the splitter robust.
 */
export function splitStatements(tokens: IToken[]): IToken[][] {
  const stmts: IToken[][] = [];
  let current: IToken[] = [];
  let depth = 0;

  for (const t of tokens) {
    if (depth === 0 && current.length > 0 && startsNewRow(current, t) && isKeywordLessAssignment(current)) {
      stmts.push(current);
      current = [];
    }

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
  const starts = statementStartLines(tokens);
  const out: StatementSpan[] = [];
  let previous: IToken[] | undefined;

  for (const { line, tokens: lineTokens } of groupByLine(tokens)) {
    const continues = previous !== undefined && (!starts.has(line) || endsLabel(previous));

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
