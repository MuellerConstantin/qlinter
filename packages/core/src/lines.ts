import { LINE_BREAK } from './lexer.js';

/** One source line: the byte offsets of its content, plus the terminator ending it. */
export interface LineSpan {
  start: number;
  end: number;
  terminator: string;
}

/*
 * Every line of `text` as a span, in order.
 *
 * This reads the raw text rather than the token stream on purpose. A construct
 * the lexer keeps whole — inline data, a block comment, a string running over a
 * break — swallows the breaks inside it, so the token stream is short of lines
 * the file really has. Numbering off it would put every rule one row out.
 *
 * A final line without a terminator is included; a trailing terminator adds no
 * empty span after it.
 */
export function splitLines(text: string): LineSpan[] {
  const lines: LineSpan[] = [];
  const scanner = new RegExp(LINE_BREAK.source, 'g');
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = scanner.exec(text)) !== null) {
    lines.push({ start: cursor, end: match.index, terminator: match[0] });
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    lines.push({ start: cursor, end: text.length, terminator: '' });
  }

  return lines;
}

/*
 * The line ending `text` is written in.
 *
 * Any carriage return in the file decides it, not the first break found: a file
 * that mixes them is being edited from two platforms, and appending the shorter
 * ending would deepen the mix rather than settle it.
 */
export function detectLineEnding(text: string): string {
  return text.includes('\r\n') ? '\r\n' : '\n';
}
