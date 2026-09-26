import { describe, expect, it } from 'vitest';
import {
  blankLineAfterBlock,
  blankLineAfterTable,
  blankLineBeforeBlock,
  blankLineBeforeTable,
  noMultipleEmptyLines,
  paddedBlocks,
} from '../../src/rules/index.js';
import { formatRule, formatRules, lintRule } from '../support.js';
import { lintFixture } from './helpers.js';

const lines = (...parts: string[]) => parts.join('\n');

describe('blank-line-after-table', () => {
  it('flags every table followed directly by a statement', () => {
    const diagnostics = lintFixture('violation', blankLineAfterTable);

    expect(diagnostics.map((diagnostic) => [diagnostic.range.start.line, diagnostic.message])).toEqual([
      [1, "Table '[Sales]' should be followed by a blank line."],
      [9, 'A table should be followed by a blank line.'],
      [15, 'A table should be followed by a blank line.'],
    ]);
    for (const diagnostic of diagnostics) {
      expect(diagnostic.ruleId).toBe('blank-line-after-table');
      expect(diagnostic.severity).toBe('warning');
    }
  });

  it('does not flag the clean fixture', () => {
    expect(lintFixture('clean', blankLineAfterTable)).toEqual([]);
  });

  describe('what it claims', () => {
    it.each([
      ['Store', 'Store Sales into [lib://qvd/sales.qvd] (qvd);'],
      ['Drop', 'Drop Table Sales;'],
      ['Let', 'Let vRows = 1;'],
      ['Set', 'Set vFormat = #,##0;'],
      ['Trace', 'Trace done;'],
      ['Rename', 'Rename Table Sales to Orders;'],
      ['Call', 'Call Fill;'],
    ])('flags a table followed directly by %s', (_name, next) => {
      expect(lintRule(lines('Sales:', 'Load * Resident Src;', next, ''), blankLineAfterTable)).toHaveLength(1);
    });

    it.each([
      ['an unlabeled Load', lines('Load * Resident Src;', 'Drop Table Src;', '')],
      ['a prefixed Load', lines('Left Join (Sales) Load * Resident Src;', 'Drop Table Src;', '')],
      ['a Select', lines('SQL SELECT Id FROM dbo.Orders;', 'Let x = 1;', '')],
    ])('flags %s as a table', (_name, source) => {
      expect(lintRule(source, blankLineAfterTable)).toHaveLength(1);
    });

    it('flags a table inside a block body followed by a statement', () => {
      const source = lines('If vRun Then', '', '    Load * Resident Src;', '    Drop Table Src;', '', 'End If', '');

      expect(lintRule(source, blankLineAfterTable)).toHaveLength(1);
    });

    it('accepts a blank line already there', () => {
      expect(lintRule(lines('Load * Resident Src;', '', 'Drop Table Src;', ''), blankLineAfterTable)).toEqual([]);
    });

    it('says nothing when the table ends the file', () => {
      expect(lintRule(lines('Load * Resident Src;', ''), blankLineAfterTable)).toEqual([]);
    });
  });

  /*
   * The end of a body is that body's edge, and a table or block below asks for
   * the gap above itself. Claiming either here would fill one gap twice.
   */
  describe('gaps another line already owns', () => {
    it.each([
      ['another table', lines('Load * Resident A;', 'Load * Resident B;', '')],
      ['a block', lines('Load * Resident A;', 'If x Then', '    Let y = 1;', 'End If', '')],
      ['the end of a body', lines('If x Then', '    Load * Resident A;', 'End If', '')],
      ['an Else', lines('If x Then', '    Load * Resident A;', 'Else', '    Let y = 1;', 'End If', '')],
    ])('leaves the gap before %s alone', (_name, source) => {
      expect(lintRule(source, blankLineAfterTable)).toEqual([]);
    });

    it('leaves a preceding load and its source together', () => {
      const source = lines('Load Id;', 'SQL EXEC dbo.Orders;', 'Drop Table Src;', '');

      expect(lintRule(source, blankLineAfterTable)).toEqual([]);
    });
  });

  describe('autofix', () => {
    it('inserts one line below the table', () => {
      const result = formatRule(lines('Load * Resident Src;', 'Drop Table Src;', ''), blankLineAfterTable);

      expect(result.output).toBe(lines('Load * Resident Src;', '', 'Drop Table Src;', ''));
      expect(result.fixed).toBe(1);
      expect(result.diagnostics).toEqual([]);
    });

    it('puts the line above a comment introducing the next statement', () => {
      const result = formatRule(lines('Load * Resident Src;', '// Done.', 'Drop Table Src;', ''), blankLineAfterTable);

      expect(result.output).toBe(lines('Load * Resident Src;', '', '// Done.', 'Drop Table Src;', ''));
    });

    it('preserves CRLF line endings', () => {
      const result = formatRule('Load * Resident Src;\r\nDrop Table Src;\r\n', blankLineAfterTable);

      expect(result.output).toBe('Load * Resident Src;\r\n\r\nDrop Table Src;\r\n');
    });

    it('settles alongside the other rules spacing sections apart', () => {
      const source = lines(
        'If vRun Then',
        '    Load * Resident Src;',
        '    Store Src into [lib://qvd/src.qvd] (qvd);',
        '    Drop Table Src;',
        'End If',
        'Load * Resident Other;',
        'Drop Table Other;',
        '',
      );
      const result = formatRules(source, [
        blankLineAfterTable,
        blankLineAfterBlock,
        blankLineBeforeBlock,
        blankLineBeforeTable,
        noMultipleEmptyLines,
        paddedBlocks,
      ]);

      expect(result.output).toBe(
        lines(
          'If vRun Then',
          '',
          '    Load * Resident Src;',
          '',
          '    Store Src into [lib://qvd/src.qvd] (qvd);',
          '    Drop Table Src;',
          '',
          'End If',
          '',
          'Load * Resident Other;',
          '',
          'Drop Table Other;',
          '',
        ),
      );
      expect(result.diagnostics).toEqual([]);
    });
  });
});
