import { tokenMatcher } from 'chevrotain';
import { describe, expect, it } from 'vitest';
import { format } from '../../src/index.js';
import { equalsToken, keywordToken, lexer, semicolonToken, setValueToken } from '../../src/lexer.js';
import { builtinKeywordCase, recommended, variableCase } from '../../src/rules/index.js';
import { lintRule } from '../support.js';

/*
 * A Set assigns the text to the right of its `=` without evaluating it; the
 * spaces and line breaks at its edges are dropped, which the reference does not
 * say and was measured in Qlik Sense Enterprise on Windows May 2025 Patch 19.
 *
 * @see https://help.qlik.com/en-US/sense/May2026/Subsystems/Hub/Content/Sense_Hub/Scripting/work-with-variables-in-data-load-editor.htm
 */
describe('set_head and set_value lexer modes', () => {
  const names = (source: string): string[] => lexer.tokenize(source).tokens.map((t) => t.tokenType.name);

  it('lexes the value as one token and the spaces at its edges as whitespace', () => {
    const { tokens, errors } = lexer.tokenize('SET vList = a,b ;');

    expect(errors).toEqual([]);
    expect(tokens.map((t) => t.tokenType.name)).toEqual([
      'SetKeyword',
      'Identifier',
      'SetEquals',
      'SetValue',
      'SetEnd',
    ]);
    expect(tokens[3].image).toBe('a,b');
  });

  it('keeps the name, the = and the ; what they are to the rest of the engine', () => {
    const { tokens } = lexer.tokenize('Set vX = 1;');

    expect(tokenMatcher(tokens[0], keywordToken)).toBe(true);
    expect(tokenMatcher(tokens[2], equalsToken)).toBe(true);
    expect(tokenMatcher(tokens[4], semicolonToken)).toBe(true);
  });

  /*
   * @see https://help.qlik.com/en-US/sense/May2026/Subsystems/Hub/Content/Sense_Hub/Scripting/NumberInterpretationVariables/MoneyFormat.htm
   */
  it('does not end the value at a ; inside quotes', () => {
    const { tokens, errors } = lexer.tokenize("Set MoneyFormat='$ #,##0.00; ($ #,##0.00)';\nLet y = 1;");

    expect(errors).toEqual([]);
    expect(tokens[3].image).toBe("'$ #,##0.00; ($ #,##0.00)'");
    expect(tokens[4].tokenType.name).toBe('SetEnd');
  });

  it('takes an escaped quote as part of the quoted stretch', () => {
    const { tokens } = lexer.tokenize("Set x = 'it''s; fine';");

    expect(tokens[3].image).toBe("'it''s; fine'");
  });

  it('ends a value with a quote left open at the next ;', () => {
    const { tokens, errors } = lexer.tokenize("Set x = 'open;\nLet y = 1;");

    expect(errors).toEqual([]);
    expect(tokens[3].image).toBe("'open");
    expect(tokens[5].image).toBe('Let');
  });

  it('has no value token for an empty value', () => {
    expect(names('Set vEmpty =;')).toEqual(['SetKeyword', 'Identifier', 'SetEquals', 'SetEnd']);
  });

  it('carries a multi-line value whole', () => {
    const { tokens, errors } = lexer.tokenize('Set vFields = A,\n  B;');

    expect(errors).toEqual([]);
    expect(tokens.find((t) => t.tokenType === setValueToken)?.image).toBe('A,\n  B');
  });

  it('lexes the line break before a ; on the next line as whitespace', () => {
    const { tokens, groups } = lexer.tokenize('Set x = 1.2\n;');

    expect(tokens[3].image).toBe('1.2');
    expect(groups.whitespace.map((t) => t.image)).toContain('\n');
  });

  it('keeps a tab at the edge inside the value, since only spaces were measured', () => {
    expect(lexer.tokenize('Set x = \t1\t;').tokens[3].image).toBe('\t1\t');
  });

  it('lexes a dynamic name as ordinary script', () => {
    expect(names('Set $(vName) = 1;')).toEqual([
      'SetKeyword',
      'Identifier',
      'Punctuation',
      'Identifier',
      'Punctuation',
      'SetEquals',
      'SetValue',
      'SetEnd',
    ]);
  });

  it('returns to the default mode after the terminator', () => {
    expect(names('Set x = 1;\nLet y = a,b;')).toEqual([
      'SetKeyword',
      'Identifier',
      'SetEquals',
      'SetValue',
      'SetEnd',
      'Keyword',
      'Identifier',
      'Equals',
      'Identifier',
      'Comma',
      'Identifier',
      'Semicolon',
    ]);
  });

  it('leaves its head the way it came in when no = follows', () => {
    expect(names('Set;\nLet y = 1;')).toEqual([
      'SetKeyword',
      'SetHeadEnd',
      'Keyword',
      'Identifier',
      'Equals',
      'NumberLiteral',
      'Semicolon',
    ]);
  });
});

describe('rules + set_value interaction', () => {
  it('formats nothing inside the value, and its edges like any gap', () => {
    const source = 'Set vList =a,b;\nSet vSum = 3+4 ;\nSet vSep = ,;\nSet vEmpty =;\n';

    expect(format(source, recommended).output).toBe(
      'Set vList = a,b;\nSet vSum = 3+4;\nSet vSep = ,;\nSet vEmpty =;\n',
    );
  });

  it('still recases the keyword and checks the name', () => {
    expect(lintRule('SET x = 1;', builtinKeywordCase)).toHaveLength(1);
    expect(lintRule('Set my_var = 1;', variableCase)).toHaveLength(1);
  });

  it('keeps formatting the right-hand side of a Let, which is an expression', () => {
    expect(format('Let x=a,b;\n', recommended).output).toBe('Let x = a, b;\n');
  });
});
