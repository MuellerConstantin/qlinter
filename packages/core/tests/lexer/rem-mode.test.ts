import { tokenMatcher } from 'chevrotain';
import { describe, expect, it } from 'vitest';
import { format } from '../../src/index.js';
import { keywordToken, lexer, remKeywordToken, semicolonToken } from '../../src/lexer.js';
import { builtinKeywordCase } from '../../src/rules/index.js';
import { lintRule } from '../support.js';

/*
 * "Everything between the rem and the next semicolon ; is considered to be a comment."
 *
 * @see https://help.qlik.com/en-US/sense/May2026/Subsystems/Hub/Content/Sense_Hub/Scripting/ScriptRegularStatements/Rem.htm
 */
describe('rem_body lexer mode', () => {
  const names = (source: string): string[] => lexer.tokenize(source).tokens.map((t) => t.tokenType.name);

  it('swallows the remark as one token', () => {
    const { tokens, errors } = lexer.tokenize('Rem ** This is a comment **;');

    expect(errors).toEqual([]);
    expect(tokens.map((t) => t.tokenType.name)).toEqual(['RemKeyword', 'RemText', 'RemEnd']);
    expect(tokens[1].image).toBe(' ** This is a comment **');
  });

  it('keeps the keyword a keyword and the ; a terminator', () => {
    const { tokens } = lexer.tokenize('REM note;');

    expect(tokens[0].tokenType).toBe(remKeywordToken);
    expect(tokenMatcher(tokens[0], keywordToken)).toBe(true);
    expect(tokenMatcher(tokens[2], semicolonToken)).toBe(true);
  });

  it('emits no keyword for script words inside the remark', () => {
    const { tokens } = lexer.tokenize('Rem If deletes requested, Load the rest;');

    expect(tokens.filter((t) => tokenMatcher(t, keywordToken)).map((t) => t.image)).toEqual(['Rem']);
  });

  it('carries a remark over several lines up to its ;', () => {
    expect(names('Rem Quarters:\n  Q1, Q2;\nLet x = 1;')).toEqual([
      'RemKeyword',
      'RemText',
      'RemEnd',
      'Keyword',
      'Identifier',
      'Equals',
      'NumberLiteral',
      'Semicolon',
    ]);
  });

  it('keeps a name that merely starts with Rem a name', () => {
    expect(names('Load Remark From x;')).toEqual(['Keyword', 'Identifier', 'From', 'Identifier', 'Semicolon']);
  });
});

describe('rules + rem_body interaction', () => {
  it('formats nothing inside the remark', () => {
    const source = 'Rem ===== Begin of Qvc.qvs version 11.3 =====;\n';
    const keepingRem = { presets: 'recommended', rules: { 'no-rem': 'off' } } as const;

    expect(format(source, keepingRem).output).toBe(source);
  });

  it('still recases the keyword', () => {
    expect(lintRule('REM note;', builtinKeywordCase)).toHaveLength(1);
  });
});
