import { tokenMatcher } from 'chevrotain';
import { describe, expect, it } from 'vitest';
import { format } from '../../src/index.js';
import { keywordToken, lexer, sqlCommandToken, sqlKeywordToken, sqlSelectToken } from '../../src/lexer.js';
import { blankLineBeforeTable, builtinKeywordCase, recommended } from '../../src/rules/index.js';
import { lintRule } from '../support.js';

describe('sql_body lexer mode', () => {
  it('swallows the command after the SQL prefix as one token', () => {
    const { tokens, errors } = lexer.tokenize('SQL EXEC dbo.Refresh @Year = 2024, @Full = 1;');

    expect(errors).toEqual([]);
    expect(tokens.map((t) => t.tokenType.name)).toEqual(['SqlKeyword', 'SqlCommand', 'SqlEnd']);
    expect(tokens[1].image).toBe(' EXEC dbo.Refresh @Year = 2024, @Full = 1');
  });

  it('marks a prefixed Select as a Select', () => {
    const { tokens } = lexer.tokenize('SQL SELECT a, b FROM t;');

    expect(tokens[1].tokenType).toBe(sqlSelectToken);
    expect(tokenMatcher(tokens[1], sqlCommandToken)).toBe(true);
  });

  it('lexes a bare Select as the command itself, since the prefix is optional', () => {
    const { tokens, errors } = lexer.tokenize('SELECT a, b FROM t;');

    expect(errors).toEqual([]);
    expect(tokens.map((t) => t.tokenType.name)).toEqual(['SqlSelect', 'Semicolon']);
  });

  it('reads a command that is not SQL at all without errors', () => {
    const { tokens, errors } = lexer.tokenize('SQL {\n  "table": [ { "values": [ "" ] } ]\n};');

    expect(errors).toEqual([]);
    expect(tokens.map((t) => t.tokenType.name)).toEqual(['SqlKeyword', 'SqlCommand', 'SqlEnd']);
  });

  it('emits no keyword for words inside the command', () => {
    const { tokens } = lexer.tokenize('SQL SELECT Load FROM Resident WHERE x;');

    expect(tokens.filter((t) => tokenMatcher(t, keywordToken)).map((t) => t.image)).toEqual(['SQL']);
  });

  it('returns to the default mode after the terminator', () => {
    const { tokens } = lexer.tokenize('SQL SELECT a FROM t;\nLoad * Resident [t];');

    expect(tokens.filter((t) => tokenMatcher(t, keywordToken)).map((t) => t.image)).toEqual([
      'SQL',
      'Load',
      'Resident',
    ]);
  });

  it('keeps a name that merely starts with Select a name', () => {
    const { tokens } = lexer.tokenize('Load Selected From x;');

    expect(tokens.some((t) => t.tokenType === sqlSelectToken)).toBe(false);
  });

  it('keeps the SQL prefix a keyword of its own', () => {
    const { tokens } = lexer.tokenize('sql leave;');

    expect(tokens[0].tokenType).toBe(sqlKeywordToken);
    expect(tokenMatcher(tokens[0], keywordToken)).toBe(true);
  });
});

describe('rules + sql_body interaction', () => {
  it('formats nothing inside the command the database reads', () => {
    const source = 'SQL SELECT a,b FROM t WHERE x=1 AND y  =  2;\n\nselect c,d from u;\n';

    expect(format(source, recommended).output).toBe(source);
  });

  it('still recases the SQL prefix, which is Qlik and not the command', () => {
    const diagnostics = lintRule('sql SELECT a FROM t;', builtinKeywordCase);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain("'sql'");
  });

  it('still counts a prefixed Select as a table', () => {
    const diagnostics = lintRule('Let x = 1;\nSQL SELECT * FROM orders;\n', blankLineBeforeTable);

    expect(diagnostics).toHaveLength(1);
  });

  it('still counts a bare Select as a table', () => {
    const diagnostics = lintRule('Let x = 1;\nSELECT * FROM orders;\n', blankLineBeforeTable);

    expect(diagnostics).toHaveLength(1);
  });
});
