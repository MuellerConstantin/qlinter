import type { IToken } from 'chevrotain';
import { builtinFunctionToken, commaToken } from '../lexer.js';
import type { Rule, Finding } from '../types.js';
import type { LineSpan } from '../lines.js';
import { tokenRange } from '../token.js';
import { isKeywordLessAssignment, splitStatements } from './utils/statements.js';
import { isCloseParen, isOpenParen } from './utils/tokens.js';
import { whitespaceEndAfter, whitespaceStartBefore } from './utils/whitespace.js';

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

function lineLengthAt(lines: LineSpan[], line: number): number {
  const span = lines[line - 1];

  return span === undefined ? 0 : span.end - span.start;
}

/*
 * Decides *where* an over-long call is broken, not how far the resulting lines
 * are indented: the fix emits bare newlines. Writing the leading whitespace here
 * too would put a second, independently configured width on the same characters,
 * and whichever pass ran last would silently win.
 */
function breakableCalls(
  tokens: IToken[],
  source: string,
  whitespaces: IToken[],
  lines: LineSpan[],
  lineEnding: string,
  maxLineLength: number,
): Finding[] {
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

    if (lineLengthAt(lines, funcLine) <= maxLineLength) {
      i++;
      continue;
    }

    /*
     * Only the arguments that open on the over-long line are separated. A call
     * reaching past that line is already broken further down, and what it holds
     * there is not what made this line long.
     */
    const commas = topLevelCommas(tokens, openIdx, closeIdx).filter(
      (comma) => (comma.startLine ?? funcLine) === funcLine,
    );

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
      args.push(
        source.slice(whitespaceEndAfter(whitespaces, cursor), whitespaceStartBefore(whitespaces, comma.startOffset)),
      );
      cursor = (comma.endOffset ?? comma.startOffset) + 1;
    }

    /*
     * A call that closes on this line is separated whole, its closing paren
     * moved onto a line of its own. One that closes further down keeps
     * everything past its last comma here exactly where it stands, the last
     * comma included — which is why that one is re-emitted rather than covered.
     */
    const closesHere = (closeToken.endLine ?? closeToken.startLine ?? funcLine) === funcLine;

    if (closesHere) {
      args.push(source.slice(whitespaceEndAfter(whitespaces, cursor), whitespaceStartBefore(whitespaces, innerEnd)));
    }

    const fixEnd = closesHere ? innerEnd : whitespaceEndAfter(whitespaces, cursor);
    const replacement = lineEnding + args.join(`,${lineEnding}`) + (closesHere ? lineEnding : `,${lineEnding}`);

    out.push({
      range: tokenRange(funcToken),
      message: `Call '${funcToken.image}(...)' exceeds the maximum line length of ${maxLineLength}; break its arguments onto their own lines.`,
      fix: { range: { start: innerStart, end: fixEnd }, replacement },
    });

    i = closeIdx + 1;
  }

  return out;
}

export const multilineCall: Rule<MultilineCallOptions, 'multiline-call'> = {
  id: 'multiline-call',
  defaultSeverity: 'warning',
  defaultOptions: { maxLineLength: 120 },
  options: { maxLineLength: { type: 'number', min: 20, max: 1000 } },
  // eslint-disable-next-line no-restricted-syntax -- each argument travels onto its own line byte for byte, comment and all
  check: ({ source, tokens, whitespaces, lines, lineEnding }, { maxLineLength }) => {
    const out: Finding[] = [];

    for (const statement of splitStatements(tokens)) {
      /* Breaking one of these apart moves half of it onto a row Qlik will not read. */
      if (isKeywordLessAssignment(statement)) {
        continue;
      }

      out.push(...breakableCalls(statement, source, whitespaces, lines, lineEnding, maxLineLength));
    }

    return out;
  },
};
