import { describe, expect, it } from 'vitest';
import { noEmptyStatement, semicolonSpace, semicolonStyle } from '../../src/rules/index.js';
import { formatRule, formatRules, lintRule } from '../support.js';
import { lintFixture } from './helpers.js';

const lines = (...parts: string[]) => parts.join('\n');

describe('no-empty-statement', () => {
  it('flags every empty statement in the violation fixture', () => {
    const diagnostics = lintFixture('violation', noEmptyStatement);

    expect(diagnostics).toHaveLength(4);
    for (const diagnostic of diagnostics) {
      expect(diagnostic.ruleId).toBe('no-empty-statement');
      expect(diagnostic.severity).toBe('warning');
      expect(diagnostic.message).toBe("Unnecessary ';' ending an empty statement.");
    }
  });

  it('does not flag the clean fixture', () => {
    expect(lintFixture('clean', noEmptyStatement)).toEqual([]);
  });

  describe('what it flags', () => {
    it('flags a terminator opening the file', () => {
      const diagnostics = lintRule(lines(';', 'Let x = 1;', ''), noEmptyStatement);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].range.start).toEqual({ line: 1, column: 1 });
    });

    it('flags a terminator after a comment following a finished statement', () => {
      expect(lintRule(lines('Let x = 1;', '// done', ';', ''), noEmptyStatement)).toHaveLength(1);
    });

    it('flags each of several terminators', () => {
      expect(lintRule('Let x = 1;;;\n', noEmptyStatement)).toHaveLength(2);
    });

    it('accepts a terminator closing a statement on the line below', () => {
      expect(lintRule(lines('Let x = 1', ';', ''), noEmptyStatement)).toEqual([]);
    });
  });

  describe('a ; inside something the lexer keeps whole', () => {
    it.each([
      ['a string', "Load ';;' as Separator Resident Src;\n"],
      ['a quoted name', 'Load "Order;;Id" Resident Src;\n'],
      ['a bracketed name', 'Load [Order;;Id] Resident Src;\n'],
      ['a Set value', "Set vFormat = '#,##0.00;;-#,##0.00';\n"],
      ['a line comment', 'Let x = 1; // ;;\n'],
      ['a block comment', 'Let x = 1; /* ;; */\n'],
      ['inline data', lines('Load * Inline [', 'Sep', ';;', '];', '')],
    ])('is not a terminator in %s', (_, source) => {
      expect(lintRule(source, noEmptyStatement)).toEqual([]);
    });
  });

  /*
   * The lexer ends a SQL command and a Trace message at their first `;`. Whether
   * Qlik does the same with a `;` quoted inside them is unmeasured, so what
   * follows may still be their text.
   */
  describe('after a body whose end is unmeasured', () => {
    it.each([
      ['a SQL command', "SQL SELECT ';;' FROM t;\n"],
      ['a Trace message', "Trace ';;';\n"],
      ['a SQL command, however many follow', 'SQL SELECT 1 FROM t;;;\n'],
    ])('reports without a fix after %s', (_, source) => {
      const diagnostics = lintRule(source, noEmptyStatement);

      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].fix).toBeUndefined();
      expect(formatRule(source, noEmptyStatement).output).toBe(source);
    });

    it('fixes after a Rem, which ends at the next ; by definition', () => {
      expect(formatRule('Rem note;;\n', noEmptyStatement).output).toBe('Rem note;\n');
    });
  });

  describe('autofix', () => {
    it('drops a line holding only the terminator', () => {
      const result = formatRule(lines('Let x = 1;', '    ;', 'Let y = 2;', ''), noEmptyStatement);

      expect(result.output).toBe(lines('Let x = 1;', 'Let y = 2;', ''));
      expect(result.fixed).toBe(1);
      expect(result.diagnostics).toEqual([]);
    });

    it('drops a terminator opening the file', () => {
      expect(formatRule(lines(';', 'Let x = 1;', ''), noEmptyStatement).output).toBe('Let x = 1;\n');
    });

    it('drops a doubled terminator and the blanks before it', () => {
      expect(formatRule('Let x = 1; ;\n', noEmptyStatement).output).toBe('Let x = 1;\n');
    });

    it('keeps a comment on the terminator line', () => {
      const result = formatRule(lines('Let x = 1;', '; // done', ''), noEmptyStatement);

      expect(result.output).toBe(lines('Let x = 1;', ' // done', ''));
    });

    it('drops a terminator on the last line without a line ending', () => {
      expect(formatRule('Let x = 1;\n;', noEmptyStatement).output).toBe('Let x = 1;\n');
    });

    it('preserves CRLF line endings', () => {
      expect(formatRule('Let x = 1;\r\n;\r\nLet y = 2;\r\n', noEmptyStatement).output).toBe(
        'Let x = 1;\r\nLet y = 2;\r\n',
      );
    });

    it('settles alongside the rules placing and spacing a terminator', () => {
      const source = lines('Drop Table A', ';  ;', '', ';', 'Drop Table B;', '');
      const result = formatRules(source, [noEmptyStatement, semicolonSpace, semicolonStyle]);

      expect(result.output).toBe(lines('Drop Table A;', '', 'Drop Table B;', ''));
      expect(result.diagnostics).toEqual([]);
    });
  });
});
