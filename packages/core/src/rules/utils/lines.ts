import type { IToken } from 'chevrotain';

/*
 * The line ending `text` is written in.
 */
export function detectLineEnding(text: string): string {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

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

/** One source line: the byte offsets of its content, plus the terminator ending it. */
export interface LineSpan {
  start: number;
  end: number;
  terminator: string;
}

/*
 * Every line of `text` as a span, in order. The blank-line rules read the source
 * rather than the token stream — a blank line has no tokens — so they need one
 * shared answer to where a line begins, ends, and whether it holds anything.
 * A final line without a terminator is included; a trailing terminator adds no
 * empty span after it.
 */
export function splitLines(text: string): LineSpan[] {
  const lines: LineSpan[] = [];
  const re = /\r?\n/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    lines.push({ start: cursor, end: match.index, terminator: match[0] });
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    lines.push({ start: cursor, end: text.length, terminator: '' });
  }

  return lines;
}

/** True when the span holds nothing but whitespace. A comment does not count as blank. */
export function isBlankLine(text: string, span: LineSpan): boolean {
  return text.slice(span.start, span.end).trim() === '';
}
