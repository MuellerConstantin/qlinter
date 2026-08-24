import type { IToken } from 'chevrotain';
import { commaToken } from '../lexer.js';
import type { Rule, Finding } from '../types.js';
import { tokenRange } from '../token.js';

/** Whitespace between the comma and the code before it on the same line. */
function spaceBefore(source: string, token: IToken): Finding | null {
  const start = token.startOffset;
  let cursor = start;

  while (cursor > 0 && (source[cursor - 1] === ' ' || source[cursor - 1] === '\t')) {
    cursor--;
  }

  if (cursor === start) {
    return null;
  }

  /*
   * Nothing but whitespace back to the line break (or the start of the file):
   * the comma opens its line, which is `comma-style`'s call, not this rule's.
   */
  if (cursor === 0 || source[cursor - 1] === '\n' || source[cursor - 1] === '\r') {
    return null;
  }

  return {
    range: tokenRange(token),
    message: "Unexpected space before ','.",
    fix: { range: { start: cursor, end: start }, replacement: '' },
  };
}

/** Whitespace between the comma and the code after it on the same line. */
function spaceAfter(source: string, token: IToken): Finding | null {
  const after = (token.endOffset ?? token.startOffset) + 1;
  let cursor = after;

  while (cursor < source.length && (source[cursor] === ' ' || source[cursor] === '\t')) {
    cursor++;
  }

  if (cursor >= source.length || source[cursor] === '\n' || source[cursor] === '\r') {
    return null;
  }

  const gap = source.slice(after, cursor);

  if (gap === ' ') {
    return null;
  }

  return {
    range: tokenRange(token),
    message: gap.length === 0 ? "Expected a space after ','." : "Expected exactly one space after ','.",
    fix: { range: { start: after, end: cursor }, replacement: ' ' },
  };
}

export const commaSpace: Rule<undefined, 'comma-space'> = {
  id: 'comma-space',
  defaultSeverity: 'warning',
  defaultOptions: undefined,
  check: ({ source, tokens }) => {
    const out: Finding[] = [];

    for (const token of tokens) {
      if (token.tokenType !== commaToken) {
        continue;
      }

      const before = spaceBefore(source, token);

      if (before !== null) {
        out.push(before);
      }

      const after = spaceAfter(source, token);

      if (after !== null) {
        out.push(after);
      }
    }

    return out;
  },
};
