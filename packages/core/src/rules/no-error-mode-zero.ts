import { tokenMatcher, type IToken } from 'chevrotain';
import { equalsToken, identifierToken, semicolonToken } from '../lexer.js';
import type { Rule, Finding } from '../types.js';
import { tokenRange } from '../token.js';
import { isKeyword } from './utils/tokens.js';
import { isKeywordLessAssignment, splitStatements } from './utils/statements.js';

/*
 * Case-insensitive although the reference calls variables case sensitive: it
 * does not say so for the system variables, and missing an `errormode = 0` that
 * Qlik honours costs more than flagging a user variable of that name.
 *
 * @see {@link https://help.qlik.com/en-US/sense/November2025/Subsystems/Hub/Content/Sense_Hub/Scripting/work-with-variables-in-data-load-editor.htm | Variables in the data load editor}
 * @see {@link https://help.qlik.com/en-US/sense/November2025/Subsystems/Hub/Content/Sense_Hub/Scripting/ErrorVariables/ErrorMode.htm | ErrorMode}
 */
const NAME = 'errormode';

const STOPPING_VALUES = new Set(['1', '2']);

/* The value tokens of the assignment whose `=` sits at `equalsIndex`, up to its `;`. */
function valueAfter(tokens: IToken[], equalsIndex: number): IToken[] {
  const end = tokens.findIndex((token, index) => index > equalsIndex && tokenMatcher(token, semicolonToken));

  return tokens.slice(equalsIndex + 1, end === -1 ? tokens.length : end);
}

function isErrorModeAssignment(name: IToken | undefined, equals: IToken | undefined): boolean {
  return (
    name !== undefined &&
    equals !== undefined &&
    tokenMatcher(name, identifierToken) &&
    name.image.toLowerCase() === NAME &&
    tokenMatcher(equals, equalsToken)
  );
}

function finding(name: IToken, value: IToken[]): Finding | undefined {
  const images = value.map((token) => token.image);

  if (images.length === 1 && STOPPING_VALUES.has(images[0])) {
    return undefined;
  }

  const last = value[value.length - 1] ?? name;
  const range = { start: tokenRange(name).start, end: tokenRange(last).end };

  if (images.length === 1 && images[0] === '0') {
    return {
      range,
      message: `'${name.image} = 0' lets the reload skip failed statements and still report success. Remove it, or confirm it with a disable directive.`,
    };
  }

  return {
    range,
    message: `'${name.image}' is set to a value that is not provably 1 or 2; if it is 0, failed statements are skipped silently.`,
  };
}

export const noErrorModeZero: Rule<undefined, 'no-error-mode-zero'> = {
  id: 'no-error-mode-zero',
  defaultSeverity: 'error',
  defaultOptions: undefined,
  check: ({ tokens }) => {
    const out: Finding[] = [];

    for (let index = 0; index < tokens.length - 2; index++) {
      const token = tokens[index];

      if (!isKeyword(token, 'set') && !isKeyword(token, 'let')) {
        continue;
      }

      if (!isErrorModeAssignment(tokens[index + 1], tokens[index + 2])) {
        continue;
      }

      const result = finding(tokens[index + 1], valueAfter(tokens, index + 2));

      if (result) {
        out.push(result);
      }
    }

    for (const statement of splitStatements(tokens)) {
      if (!isKeywordLessAssignment(statement) || !isErrorModeAssignment(statement[0], statement[1])) {
        continue;
      }

      const result = finding(statement[0], valueAfter(statement, 1));

      if (result) {
        out.push(result);
      }
    }

    return out;
  },
};
