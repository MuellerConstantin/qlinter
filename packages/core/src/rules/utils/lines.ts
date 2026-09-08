import type { IToken } from 'chevrotain';
import type { Fix } from '../../types.js';
import type { LineSpan } from '../../lines.js';
import { runsSpanning } from './whitespace.js';

/** Groups a token stream into one entry per source line, in order. */
export function groupByLine(tokens: IToken[]): { line: number; tokens: IToken[] }[] {
  const out: { line: number; tokens: IToken[] }[] = [];
  let currentLine = -1;

  for (const token of tokens) {
    const line = token.startLine ?? 1;

    if (line !== currentLine) {
      out.push({ line, tokens: [token] });
      currentLine = line;
    } else {
      out[out.length - 1].tokens.push(token);
    }
  }

  return out;
}

/*
 * True when the span holds nothing but whitespace the lexer reported.
 *
 * A comment does not count as blank, and neither does a line inside a construct
 * the lexer keeps whole: those bytes belong to a token rather than to the gaps
 * between tokens, so the walk across the span stops at them.
 */
export function isBlankLine(whitespaces: IToken[], span: LineSpan): boolean {
  return runsSpanning(whitespaces, span.start, span.end) !== undefined;
}

/** Fix that inserts one `ending` at the top of `line`, pushing it down a row. */
export function insertLineBefore(spans: LineSpan[], line: number, ending: string): Fix {
  const offset = spans[line - 1].start;

  return { range: { start: offset, end: offset }, replacement: ending };
}

/** Fix that removes lines `from` through `to` (1-based, inclusive) along with their terminators. */
export function deleteLineRange(spans: LineSpan[], from: number, to: number): Fix {
  const first = spans[from - 1];
  const last = spans[to - 1];

  return { range: { start: first.start, end: last.end + last.terminator.length }, replacement: '' };
}

/*
 * The lines held inside tokens that span more than one of them.
 *
 * The lexer keeps a construct whose interior is not Qlik expression syntax as a
 * single opaque token — inline data, a block comment, a string literal running
 * over a line break — precisely so no rule rewrites what is in it. A line in
 * there looks blank but is content the script carries, and editing it changes
 * what the script loads. Every rule that acts on blank lines has to agree on
 * that, so the answer is derived once here.
 */
export function tokenInteriorLines(tokens: IToken[], comments: IToken[]): Set<number> {
  const out = new Set<number>();

  const collect = (source: IToken[]) => {
    for (const token of source) {
      const first = token.startLine ?? 1;
      const last = token.endLine ?? first;

      for (let line = first + 1; line <= last; line++) {
        out.add(line);
      }
    }
  };

  collect(tokens);
  collect(comments);

  return out;
}

/*
 * The byte spans of the tokens that run across more than one line, in source
 * order. Only such a token can hold a line ending, so only such a token can
 * hold whitespace that looks trailing while being content the script carries.
 *
 * The line-based answer above cannot serve here: it starts at the token's
 * second line, and whitespace at the end of its *first* line is inside the
 * token just the same.
 */
export function multiLineTokenSpans(tokens: IToken[], comments: IToken[]): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];

  for (const token of [...tokens, ...comments]) {
    if ((token.endLine ?? token.startLine ?? 1) > (token.startLine ?? 1)) {
      out.push({ start: token.startOffset, end: (token.endOffset ?? token.startOffset) + 1 });
    }
  }

  return out.sort((a, b) => a.start - b.start);
}

/** Lines carrying a comment and no code. */
export function commentOnlyLines(comments: IToken[], tokens: IToken[]): Set<number> {
  const code = new Set(tokens.map((token) => token.startLine ?? 1));
  const out = new Set<number>();

  for (const comment of comments) {
    const first = comment.startLine ?? 1;
    const last = comment.endLine ?? first;

    for (let line = first; line <= last; line++) {
      if (!code.has(line)) {
        out.add(line);
      }
    }
  }

  return out;
}

/*
 * Where the run of lines introducing `line` begins: `line` itself, or the top of
 * an unbroken comment run directly above it. A comment introducing a statement
 * belongs to it, so a rule asking for a blank line above has to ask above the
 * comment rather than between the two.
 */
export function introductionStart(commented: ReadonlySet<number>, line: number): number {
  let top = line;

  while (top > 1 && commented.has(top - 1)) {
    top--;
  }

  return top;
}

/** True when a blank line sits directly above `line`, or nothing does. */
export function precededByBlankLine(whitespaces: IToken[], spans: LineSpan[], line: number): boolean {
  const above = spans[line - 2];

  return above === undefined || isBlankLine(whitespaces, above);
}
