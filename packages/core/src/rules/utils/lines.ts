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
