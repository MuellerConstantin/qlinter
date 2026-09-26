import { describe, expect, it } from 'vitest';
import { continuationIndent, semicolonStyle, trailingWhitespace } from '../../src/rules/index.js';
import { formatRule, formatRules, lintRule } from '../support.js';
import { lintFixture } from './helpers.js';

const lines = (...parts: string[]) => parts.join('\n');

describe('semicolon-style', () => {
  it('flags every detached terminator in the violation fixture', () => {
    const diagnostics = lintFixture('violation', semicolonStyle);

    expect(diagnostics).toHaveLength(4);
    for (const diagnostic of diagnostics) {
      expect(diagnostic.ruleId).toBe('semicolon-style');
      expect(diagnostic.severity).toBe('warning');
      expect(diagnostic.message).toBe("Expected ';' at the end of the statement's last line.");
    }
  });

  it('does not flag the clean fixture', () => {
    expect(lintFixture('clean', semicolonStyle)).toEqual([]);
  });

  describe('what it flags', () => {
    it('flags a terminator on the line below its statement', () => {
      const diagnostics = lintRule(lines('Let x = 1', ';', ''), semicolonStyle);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].range.start).toEqual({ line: 2, column: 1 });
    });

    it('flags a terminator several lines below', () => {
      expect(lintRule(lines('Drop Table Src', '', '', ';', ''), semicolonStyle)).toHaveLength(1);
    });

    it('flags the terminator of a Set value', () => {
      expect(lintRule(lines('Set x = 1.2', ';', ''), semicolonStyle)).toHaveLength(1);
    });

    it('flags the terminator after the closing bracket of Inline data', () => {
      expect(lintRule(lines('Load * Inline [', 'Id', '1', ']', ';', ''), semicolonStyle)).toHaveLength(1);
    });

    it('accepts a terminator on the last line', () => {
      expect(lintRule(lines('Load', '    Id', 'Resident Src;', ''), semicolonStyle)).toEqual([]);
    });

    it('accepts a terminator on the last line of a token spanning several', () => {
      expect(lintRule(lines('Load * Inline [', 'Id', '1', '];', ''), semicolonStyle)).toEqual([]);
    });

    it('leaves the terminator of an empty statement alone', () => {
      const source = lines('Drop Table Src;', '', '// done', ';', '');

      expect(lintRule(source, semicolonStyle)).toEqual([]);
    });

    it('leaves the spacing before a terminator on the same line to somebody else', () => {
      expect(lintRule('Let x = 1 ;\n', semicolonStyle)).toEqual([]);
    });
  });

  /*
   * Measured in Qlik Sense Enterprise on Windows May 2025 Patch 19: a Trace
   * prints the line breaks before its `;`, so they are message text. SQL edges
   * are unmeasured. Either way the lexer keeps the body whole up to the `;`.
   */
  describe('bodies that own their line breaks', () => {
    it.each([
      ['a Trace message', lines('Trace', 'loading sales', ';', '')],
      ['a SQL command', lines('SQL SELECT OrderId', 'FROM dbo.Orders', ';', '')],
      ['a bare Select', lines('Select OrderId', 'FROM dbo.Orders', ';', '')],
      ['a Rem', lines('Rem the calendar', ';', '')],
    ])('leaves the terminator of %s where it stands', (_, source) => {
      expect(lintRule(source, semicolonStyle)).toEqual([]);
      expect(formatRule(source, semicolonStyle).output).toBe(source);
    });
  });

  describe('autofix', () => {
    it('pulls the terminator up and drops the line it stood on', () => {
      const result = formatRule(lines('Let x = 1', ';', 'Let y = 2;', ''), semicolonStyle);

      expect(result.output).toBe(lines('Let x = 1;', 'Let y = 2;', ''));
      expect(result.fixed).toBe(1);
      expect(result.diagnostics).toEqual([]);
    });

    it('drops the indent and blank lines before the terminator', () => {
      const result = formatRule(lines('Load', '    Id', 'Resident Src', '', '    ;', ''), semicolonStyle);

      expect(result.output).toBe(lines('Load', '    Id', 'Resident Src;', ''));
    });

    it('keeps a Set value unchanged', () => {
      expect(formatRule(lines('Set x = #,##0.00', ';', ''), semicolonStyle).output).toBe('Set x = #,##0.00;\n');
    });

    it('closes an emptied Set value', () => {
      expect(formatRule(lines('Set x =', ';', ''), semicolonStyle).output).toBe('Set x =;\n');
    });

    it('puts the terminator before a comment trailing the statement', () => {
      const result = formatRule(lines('Drop Table Src // done', ';', ''), semicolonStyle);

      expect(result.output).toBe(lines('Drop Table Src; // done', ''));
    });

    it('keeps a comment line standing between the statement and its terminator', () => {
      const result = formatRule(lines('Drop Table Src', '// done', ';', ''), semicolonStyle);

      expect(result.output).toBe(lines('Drop Table Src;', '// done', ''));
    });

    it('keeps a comment trailing the terminator', () => {
      const result = formatRule(lines('Drop Table Src', '; // done', ''), semicolonStyle);

      expect(result.output).toBe(lines('Drop Table Src; // done', ''));
    });

    it('leaves the next statement on a line of its own', () => {
      const result = formatRule(lines('Drop Table A', '; Drop Table B;', ''), semicolonStyle);

      expect(result.output).toBe(lines('Drop Table A;', 'Drop Table B;', ''));
    });

    it('preserves CRLF line endings', () => {
      const result = formatRule('Let x = 1\r\n;\r\nLet y = 2;\r\n', semicolonStyle);

      expect(result.output).toBe('Let x = 1;\r\nLet y = 2;\r\n');
    });

    it('settles alongside the rules that own the lines and their ends', () => {
      const source = lines('Load', '    Id', 'Resident Src   ', '        ;', '');
      const result = formatRules(source, [semicolonStyle, trailingWhitespace, continuationIndent]);

      expect(result.output).toBe(lines('Load', '    Id', 'Resident Src;', ''));
      expect(result.diagnostics).toEqual([]);
    });
  });
});
