import { describe, expect, it } from 'vitest';
import {
  bracketToken,
  builtinFunctionToken,
  identifierToken,
  lexer,
  numberLiteralToken,
  backtickIdentifierToken,
  quotedIdentifierToken,
} from '../../src/lexer.js';

/*
 * Qlik has no published positive grammar for identifiers — only a list of
 * characters to avoid. We tokenize permissively: anything that is not a
 * structural stop char (whitespace, ASCII operators, brackets, parens,
 * statement delimiters, quotes) counts as identifier material. These tests
 * pin the resulting positive and negative cases so regressions are loud
 * when the pattern is touched.
 */
describe('identifier tokenization', () => {
  describe('positive cases (single identifier token)', () => {
    it.each([
      ['#Field', '#Field'],
      ['@Field', '@Field'],
      ['$Field', '$Field'],
      ['Field.', 'Field.'],
      ['Field#x', 'Field#x'],
      ['Field.Sub.Sub2', 'Field.Sub.Sub2'],
      ['$Fie...ld', '$Fie...ld'],
      ['日本語', '日本語'],
      ['v_öäü', 'v_öäü'],
      ['Field123', 'Field123'],
      ['_private', '_private'],
    ])('tokenizes %s as a single identifier', (source, expected) => {
      const { tokens, errors } = lexer.tokenize(source);

      expect(errors).toEqual([]);
      expect(tokens).toHaveLength(1);
      expect(tokens[0].tokenType).toBe(identifierToken);
      expect(tokens[0].image).toBe(expected);
    });
  });

  describe('negative cases (multi-token splits)', () => {
    it('splits .Foo into punctuation + identifier (no leading dot)', () => {
      const { tokens, errors } = lexer.tokenize('.Foo');

      expect(errors).toEqual([]);
      expect(tokens).toHaveLength(2);
      expect(tokens[0].image).toBe('.');
      expect(tokens[1].tokenType).toBe(identifierToken);
      expect(tokens[1].image).toBe('Foo');
    });

    it('splits 123Foo into number + identifier (no leading digit)', () => {
      const { tokens, errors } = lexer.tokenize('123Foo');

      expect(errors).toEqual([]);
      expect(tokens).toHaveLength(2);
      expect(tokens[0].tokenType).toBe(numberLiteralToken);
      expect(tokens[0].image).toBe('123');
      expect(tokens[1].tokenType).toBe(identifierToken);
      expect(tokens[1].image).toBe('Foo');
    });

    it('splits $(var) — stop chars terminate the identifier on (', () => {
      const { tokens, errors } = lexer.tokenize('$(var)');

      expect(errors).toEqual([]);
      expect(tokens.map((t) => t.image)).toEqual(['$', '(', 'var', ')']);
    });

    it.each([
      ['a+b', ['a', '+', 'b']],
      ['a-b', ['a', '-', 'b']],
      ['a*b', ['a', '*', 'b']],
      ['a/b', ['a', '/', 'b']],
      ['a,b', ['a', ',', 'b']],
      ['a;b', ['a', ';', 'b']],
      ['a=b', ['a', '=', 'b']],
      ['a<b', ['a', '<', 'b']],
      ['a>b', ['a', '>', 'b']],
      ['a|b', ['a', '|', 'b']],
      ['a&b', ['a', '&', 'b']],
      ['a%b', ['a', '%', 'b']],
      ['a^b', ['a', '^', 'b']],
      ['a!b', ['a', '!', 'b']],
      ['a?b', ['a', '?', 'b']],
    ])('stop char in %s splits into three tokens', (source, expected) => {
      const { tokens, errors } = lexer.tokenize(source);

      expect(errors).toEqual([]);
      expect(tokens.map((t) => t.image)).toEqual(expected);
    });
  });

  describe('quoted / bracketed identifiers', () => {
    it('tokenizes [0] as a bracket identifier (table label form)', () => {
      const { tokens, errors } = lexer.tokenize('[0]');

      expect(errors).toEqual([]);
      expect(tokens).toHaveLength(1);
      expect(tokens[0].tokenType).toBe(bracketToken);
      expect(tokens[0].image).toBe('[0]');
    });

    it('tokenizes "0" as a quoted identifier (not a string)', () => {
      const { tokens, errors } = lexer.tokenize('"0"');

      expect(errors).toEqual([]);
      expect(tokens).toHaveLength(1);
      expect(tokens[0].tokenType).toBe(quotedIdentifierToken);
      expect(tokens[0].image).toBe('"0"');
    });

    it('tokenizes "my field" as one quoted identifier including the space', () => {
      const { tokens, errors } = lexer.tokenize('"my field"');

      expect(errors).toEqual([]);
      expect(tokens).toHaveLength(1);
      expect(tokens[0].tokenType).toBe(quotedIdentifierToken);
      expect(tokens[0].image).toBe('"my field"');
    });

    it('handles "" as the escape inside a quoted identifier', () => {
      const { tokens, errors } = lexer.tokenize('"a""b"');

      expect(errors).toEqual([]);
      expect(tokens).toHaveLength(1);
      expect(tokens[0].tokenType).toBe(quotedIdentifierToken);
      expect(tokens[0].image).toBe('"a""b"');
    });

    /*
     * The grave accent is the third delimiter Qlik accepts for a field or table
     * name. Before it had a token of its own, `my field` split into two bare
     * identifiers and `Name"5` raised a lex error, so every rule downstream saw
     * a stream that did not match the script.
     *
     * @see https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Scripting/use-quotes-in-script.htm
     */
    it('tokenizes `my field` as one backtick identifier', () => {
      const { tokens, errors } = lexer.tokenize('`my field`');

      expect(errors).toEqual([]);
      expect(tokens).toHaveLength(1);
      expect(tokens[0].tokenType).toBe(backtickIdentifierToken);
      expect(tokens[0].image).toBe('`my field`');
    });

    it('keeps a double quote inside a backtick identifier', () => {
      const { tokens, errors } = lexer.tokenize('`Name"5`');

      expect(errors).toEqual([]);
      expect(tokens).toHaveLength(1);
      expect(tokens[0].image).toBe('`Name"5`');
    });

    it('treats a grave accent as a stop character for a bare identifier', () => {
      const { tokens } = lexer.tokenize('`a`b`c`');

      expect(tokens.map((token) => token.image)).toEqual(['`a`', 'b', '`c`']);
    });

    it('still tokenizes [my field] as one bracket identifier', () => {
      const { tokens, errors } = lexer.tokenize('[my field]');

      expect(errors).toEqual([]);
      expect(tokens).toHaveLength(1);
      expect(tokens[0].tokenType).toBe(bracketToken);
    });
  });

  describe('built-in function interaction with #', () => {
    it('Date#(...) still tokenizes as a built-in function', () => {
      const { tokens, errors } = lexer.tokenize("Date#(Field, 'YYYY-MM-DD')");

      expect(errors).toEqual([]);
      expect(tokens[0].tokenType).toBe(builtinFunctionToken);
      expect(tokens[0].image).toBe('Date#');
    });

    it('Date#x (no parens after) tokenizes as one identifier instead', () => {
      const { tokens, errors } = lexer.tokenize('Date#x');

      expect(errors).toEqual([]);
      expect(tokens).toHaveLength(1);
      expect(tokens[0].tokenType).toBe(identifierToken);
      expect(tokens[0].image).toBe('Date#x');
    });
  });
});
