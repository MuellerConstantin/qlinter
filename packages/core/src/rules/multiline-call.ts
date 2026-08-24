import type { IToken } from 'chevrotain';
import { builtinFunctionToken, commaToken } from '../lexer.js';
import type { Rule, Finding } from '../types.js';
import { tokenRange } from '../token.js';
import { detectLineEnding } from './utils/lines.js';
import { isCloseParen, isOpenParen } from './utils/tokens.js';

export interface MultilineCallOptions {
  maxLineLength: number;
}

function findMatchingClose(tokens: IToken[], openIdx: number): number {
  let depth = 0;

  for (let i = openIdx; i < tokens.length; i++) {
    if (isOpenParen(tokens[i])) {
      depth++;
    } else if (isCloseParen(tokens[i])) {
      depth--;

      if (depth === 0) {
        return i;
      }
    }
  }

  return -1;
}

function topLevelCommas(tokens: IToken[], openIdx: number, closeIdx: number): IToken[] {
  const out: IToken[] = [];
  let depth = 0;

  for (let i = openIdx + 1; i < closeIdx; i++) {
    const t = tokens[i];

    if (isOpenParen(t)) {
      depth++;
    } else if (isCloseParen(t)) {
      depth--;
    } else if (depth === 0 && t.tokenType === commaToken) {
      out.push(t);
    }
  }

  return out;
}

function lineLengthAt(source: string, line: number): number {
  const lines = source.split(/\r?\n/);
  return lines[line - 1]?.length ?? 0;
}

/*
 * Decides *where* an over-long call is broken, not how far the resulting lines
 * are indented. The fix emits bare newlines and leaves the indentation to
 * `continuation-indent`, which owns every line inside a wrapped expression —
 * the same division of labour `load-clause-newline` and `load-field-per-line`
 * have with `load-indent`. Emitting an indent here would mean two rules with
 * two independent width settings writing the same leading whitespace, and the
 * one running later would silently win.
 */
export const multilineCall: Rule<MultilineCallOptions, 'multiline-call'> = {
  id: 'multiline-call',
  defaultSeverity: 'warning',
  defaultOptions: { maxLineLength: 120 },
  options: { maxLineLength: { type: 'number', min: 20, max: 1000 } },
  check: ({ source, tokens }, { maxLineLength }) => {
    const newline = detectLineEnding(source);
    const out: Finding[] = [];
    let i = 0;

    while (i < tokens.length) {
      const funcToken = tokens[i];

      if (funcToken.tokenType !== builtinFunctionToken) {
        i++;
        continue;
      }

      const openIdx = i + 1;

      if (openIdx >= tokens.length || !isOpenParen(tokens[openIdx])) {
        i++;
        continue;
      }

      const closeIdx = findMatchingClose(tokens, openIdx);

      if (closeIdx === -1) {
        i++;
        continue;
      }

      const closeToken = tokens[closeIdx];
      const funcLine = funcToken.startLine ?? 1;
      const closeLine = closeToken.endLine ?? closeToken.startLine ?? funcLine;

      if (funcLine !== closeLine) {
        i++;
        continue;
      }

      if (lineLengthAt(source, funcLine) <= maxLineLength) {
        i++;
        continue;
      }

      const commas = topLevelCommas(tokens, openIdx, closeIdx);

      if (commas.length === 0) {
        i++;
        continue;
      }

      const openToken = tokens[openIdx];
      const innerStart = (openToken.endOffset ?? openToken.startOffset) + 1;
      const innerEnd = closeToken.startOffset;
      const args: string[] = [];
      let cursor = innerStart;

      for (const comma of commas) {
        args.push(source.slice(cursor, comma.startOffset).trim());
        cursor = (comma.endOffset ?? comma.startOffset) + 1;
      }

      args.push(source.slice(cursor, innerEnd).trim());

      const replacement = newline + args.join(`,${newline}`) + newline;

      out.push({
        range: tokenRange(funcToken),
        message: `Call '${funcToken.image}(...)' exceeds the maximum line length of ${maxLineLength}; break each argument onto its own line.`,
        fix: { range: { start: innerStart, end: innerEnd }, replacement },
      });

      i = closeIdx + 1;
    }

    return out;
  },
};
