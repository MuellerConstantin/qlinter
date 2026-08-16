import type { IToken } from 'chevrotain';
import { includeExpansionToken } from '../lexer.js';
import type { Rule, Finding, Position } from '../types.js';

/*
 * Head of an include expansion, up to and including the whitespace that follows
 * the `=`. Group 1 is the run of spaces before the `=`, group 2 the run after —
 * either or both may be empty, and either being non-empty is the violation.
 *
 * The token pattern in the lexer forbids line breaks inside the expansion, so
 * everything matched here sits on the token's own line. That is what lets the
 * offsets below be converted to columns by simple addition.
 */
const INCLUDE_HEAD = /^\$\([ \t]*(?:Must_)?Include([ \t]*)=([ \t]*)/i;

const positionAt = (token: IToken, index: number): Position => ({
  line: token.startLine ?? 1,
  column: (token.startColumn ?? 1) + index,
});

const spaceFinding = (token: IToken, start: number, end: number, side: 'before' | 'after'): Finding => ({
  range: { start: positionAt(token, start), end: positionAt(token, end) },
  message: `Remove the space ${side} the '=' of an include expansion; Qlik does not accept one there.`,
  fix: { range: { start: token.startOffset + start, end: token.startOffset + end }, replacement: '' },
});

/**
 * Reject whitespace around the `=` of a `$(Include=…)` / `$(Must_Include=…)`
 * expansion. Qlik matches that construct as a fixed literal form and states
 * outright that no space may appear on either side of the equal sign; a script
 * carrying one is rejected by the Data Load Editor with a syntax error rather
 * than merely reading oddly. The autofix deletes the offending whitespace and
 * leaves the include target byte-for-byte alone — a data connection path may
 * legitimately contain spaces of its own.
 *
 * @see {@link https://help.qlik.com/en-US/sense/May2026/Subsystems/Hub/Content/Sense_Hub/Scripting/SystemVariables/Include.htm | Include}
 */
export const includeNoSpaces: Rule<undefined, 'include-no-spaces'> = {
  id: 'include-no-spaces',
  defaultSeverity: 'error',
  defaultOptions: undefined,
  check: ({ tokens }) => {
    const out: Finding[] = [];

    for (const token of tokens) {
      if (token.tokenType !== includeExpansionToken) {
        continue;
      }

      const match = INCLUDE_HEAD.exec(token.image);

      if (match === null) {
        continue;
      }

      const [head, before, after] = match;
      const equalsIndex = head.length - after.length - 1;

      if (before.length > 0) {
        out.push(spaceFinding(token, equalsIndex - before.length, equalsIndex, 'before'));
      }

      if (after.length > 0) {
        out.push(spaceFinding(token, equalsIndex + 1, equalsIndex + 1 + after.length, 'after'));
      }
    }

    return out;
  },
};
