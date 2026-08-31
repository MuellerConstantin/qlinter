import { describe, expect, it } from 'vitest';
import { noBlankLineInStatement, noMultipleEmptyLines, paddedBlocks } from '../../src/rules/index.js';
import { formatRule, formatRules, lintRule } from '../support.js';
import { lintFixture } from './helpers.js';

const lines = (...parts: string[]) => parts.join('\n');

describe('no-blank-line-in-statement', () => {
  it('flags every statement broken up in the violation fixture', () => {
    const diagnostics = lintFixture('violation', noBlankLineInStatement);

    expect(diagnostics).toHaveLength(3);
    for (const diagnostic of diagnostics) {
      expect(diagnostic.ruleId).toBe('no-blank-line-in-statement');
      expect(diagnostic.severity).toBe('warning');
      expect(diagnostic.message).toBe('A statement should not be broken up by a blank line.');
    }
    expect(diagnostics.map((diagnostic) => diagnostic.range.start.line)).toEqual([4, 9, 17]);
  });

  it('does not flag the clean fixture', () => {
    expect(lintFixture('clean', noBlankLineInStatement)).toEqual([]);
  });

  describe('inside a LOAD', () => {
    it('flags a blank line in the field list', () => {
      const source = lines('Load', '    Id,', '', '    Name', 'Resident Src;', '');

      const diagnostics = lintRule(source, noBlankLineInStatement);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].range.start).toEqual({ line: 3, column: 1 });
    });

    it('flags a blank line before a clause', () => {
      const source = lines('Load', '    Id', '', 'Resident Src;', '');

      expect(lintRule(source, noBlankLineInStatement)).toHaveLength(1);
    });

    it('flags a blank line between a label and its Load', () => {
      const source = lines('[Sales]:', '', 'Load Id Resident Src;', '');

      expect(lintRule(source, noBlankLineInStatement)).toHaveLength(1);
    });

    it('flags a blank line between a prefix and its Load', () => {
      const source = lines('Concatenate([Sales])', '', 'Load Id Resident Src;', '');

      expect(lintRule(source, noBlankLineInStatement)).toHaveLength(1);
    });

    it('reports one finding per run, not per line', () => {
      const source = lines('Load', '    Id,', '', '', '', '    Name', 'Resident Src;', '');

      const diagnostics = lintRule(source, noBlankLineInStatement);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].range).toEqual({ start: { line: 3, column: 1 }, end: { line: 6, column: 1 } });
    });

    it('reports two runs in one statement separately', () => {
      const source = lines('Load', '    Id,', '', '    Name,', '', '    Region', 'Resident Src;', '');

      expect(lintRule(source, noBlankLineInStatement)).toHaveLength(2);
    });

    it('accepts a comment line inside the field list', () => {
      const source = lines('Load', '    Id,', '    // the name', '    Name', 'Resident Src;', '');

      expect(lintRule(source, noBlankLineInStatement)).toEqual([]);
    });

    it('accepts a statement written on one line', () => {
      expect(lintRule('Load Id Resident Src;\n', noBlankLineInStatement)).toEqual([]);
    });
  });

  /*
   * The lexer keeps these constructs whole, so a blank line in them is content
   * the script carries rather than spacing anyone chose.
   */
  describe('blank lines the statement carries', () => {
    it('accepts a blank line inside Inline data', () => {
      const source = lines('Load * Inline [', 'Id, Name', '1, a', '', '2, b', '];', '');

      expect(lintRule(source, noBlankLineInStatement)).toEqual([]);
    });

    it('accepts a blank line inside a block comment', () => {
      const source = lines('Load', '    Id,', '    /*', '', '     */', '    Name', 'Resident Src;', '');

      expect(lintRule(source, noBlankLineInStatement)).toEqual([]);
    });

    it('accepts a blank line inside a string literal', () => {
      const source = lines('Load', "    'a", '', "b' as Text", 'Resident Src;', '');

      expect(lintRule(source, noBlankLineInStatement)).toEqual([]);
    });

    it('still flags a chosen blank line in a statement that also carries one', () => {
      const source = lines('Load * Inline [', 'Id', '', '2', ']', '', ';', '');

      const diagnostics = lintRule(source, noBlankLineInStatement);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].range.start.line).toBe(6);
    });
  });

  describe('gaps that belong to other lines', () => {
    it('leaves the gap between two statements alone', () => {
      const source = lines('Let x = 1;', '', 'Let y = 2;', '');

      expect(lintRule(source, noBlankLineInStatement)).toEqual([]);
    });

    it('leaves the gap above a table alone', () => {
      const source = lines('Let x = 1;', '', '[Sales]:', 'Load Id Resident Src;', '');

      expect(lintRule(source, noBlankLineInStatement)).toEqual([]);
    });

    it('leaves the padding inside a block alone', () => {
      const source = lines('Sub Fill', '', '    Let x = 1;', '', 'End Sub', '');

      expect(lintRule(source, noBlankLineInStatement)).toEqual([]);
    });

    it('leaves leading and trailing blank lines alone', () => {
      expect(lintRule('\nLet x = 1;\n\n', noBlankLineInStatement)).toEqual([]);
    });
  });

  describe('autofix', () => {
    it('closes the gap', () => {
      const source = lines('Load', '    Id,', '', '    Name', 'Resident Src;', '');

      const result = formatRule(source, noBlankLineInStatement);

      expect(result.output).toBe(lines('Load', '    Id,', '    Name', 'Resident Src;', ''));
      expect(result.fixed).toBe(1);
      expect(result.diagnostics).toEqual([]);
    });

    it('closes a multi-line run in one fix', () => {
      const source = lines('Load', '    Id,', '', '', '    Name', 'Resident Src;', '');

      const result = formatRule(source, noBlankLineInStatement);

      expect(result.output).toBe(lines('Load', '    Id,', '    Name', 'Resident Src;', ''));
      expect(result.fixed).toBe(1);
    });

    it('closes two runs in one pass', () => {
      const source = lines('Load', '    Id,', '', '    Name,', '', '    Region', 'Resident Src;', '');

      const result = formatRule(source, noBlankLineInStatement);

      expect(result.output).toBe(lines('Load', '    Id,', '    Name,', '    Region', 'Resident Src;', ''));
      expect(result.fixed).toBe(2);
    });

    it('preserves CRLF line endings', () => {
      const source = 'Load\r\n    Id,\r\n\r\n    Name\r\nResident Src;\r\n';

      const result = formatRule(source, noBlankLineInStatement);

      expect(result.output).toBe('Load\r\n    Id,\r\n    Name\r\nResident Src;\r\n');
    });

    it('settles alongside no-multiple-empty-lines', () => {
      const source = lines('Load', '    Id,', '', '', '    Name', 'Resident Src;', '');

      const result = formatRules(source, [noBlankLineInStatement, noMultipleEmptyLines]);

      expect(result.output).toBe(lines('Load', '    Id,', '    Name', 'Resident Src;', ''));
      expect(result.diagnostics).toEqual([]);
    });

    it('settles alongside padded-blocks, which owns the gaps around it', () => {
      const source = lines(
        'Sub Fill',
        '    Load',
        '        Id,',
        '',
        '        Name',
        '    Resident Src;',
        'End Sub',
        '',
      );

      const result = formatRules(source, [noBlankLineInStatement, paddedBlocks]);

      expect(result.output).toBe(
        lines('Sub Fill', '', '    Load', '        Id,', '        Name', '    Resident Src;', '', 'End Sub', ''),
      );
      expect(result.diagnostics).toEqual([]);
    });
  });
});
