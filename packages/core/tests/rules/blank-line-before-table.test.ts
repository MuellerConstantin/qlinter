import { describe, expect, it } from 'vitest';
import { blankLineBeforeTable, noMultipleEmptyLines } from '../../src/rules/index.js';
import { formatRule, formatRules, lintRule } from '../support.js';
import { lintFixture } from './helpers.js';

const lines = (...parts: string[]) => parts.join('\n');

describe('blank-line-before-table', () => {
  it('flags every table that opens without a blank line above it', () => {
    const diagnostics = lintFixture('violation', blankLineBeforeTable);

    expect(diagnostics).toHaveLength(5);
    for (const diagnostic of diagnostics) {
      expect(diagnostic.ruleId).toBe('blank-line-before-table');
      expect(diagnostic.severity).toBe('warning');
    }
    expect(diagnostics.map((diagnostic) => diagnostic.range.start.line)).toEqual([2, 7, 13, 16, 20]);
  });

  it('does not flag the clean fixture', () => {
    const diagnostics = lintFixture('clean', blankLineBeforeTable);

    expect(diagnostics).toEqual([]);
  });

  describe('table labels', () => {
    it('flags a bracketed label', () => {
      const diagnostics = lintRule(lines('Let x = 1;', '[Sales]:', 'Load Id Resident Src;', ''), blankLineBeforeTable);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].message).toBe("Table '[Sales]' should be preceded by a blank line.");
      expect(diagnostics[0].range.start).toEqual({ line: 2, column: 1 });
    });

    it('flags an unbracketed label', () => {
      const diagnostics = lintRule(lines('Let x = 1;', 'Sales:', 'Load Id Resident Src;', ''), blankLineBeforeTable);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].message).toBe("Table 'Sales' should be preceded by a blank line.");
    });

    it('flags a quoted label', () => {
      const diagnostics = lintRule(lines('Let x = 1;', '"Sales":', 'Load Id Resident Src;', ''), blankLineBeforeTable);

      expect(diagnostics).toHaveLength(1);
    });

    it('flags a label that happens to spell a keyword', () => {
      const diagnostics = lintRule(lines('Let x = 1;', 'Order:', 'Load Id Resident Src;', ''), blankLineBeforeTable);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].message).toBe("Table 'Order' should be preceded by a blank line.");
    });

    it('flags the label rather than the Load underneath it', () => {
      const source = lines('Let x = 1;', '[Sales]:', 'Load', '    Id', 'Resident Src;', '');

      const diagnostics = lintRule(source, blankLineBeforeTable);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].range.start.line).toBe(2);
    });

    it('accepts a label with a blank line above it', () => {
      const source = lines('Let x = 1;', '', '[Sales]:', 'Load Id Resident Src;', '');

      expect(lintRule(source, blankLineBeforeTable)).toEqual([]);
    });

    it('accepts a label separated by more than one blank line', () => {
      const source = lines('Let x = 1;', '', '', '[Sales]:', 'Load Id Resident Src;', '');

      expect(lintRule(source, blankLineBeforeTable)).toEqual([]);
    });
  });

  /*
   * A Qlik table label is optional: an unlabeled Load creates an auto-named
   * table or auto-concatenates onto the one before it. Either way it opens a
   * block the reader has to find.
   */
  describe('tables without a label', () => {
    it('flags a bare Load', () => {
      const diagnostics = lintRule(lines('Let x = 1;', 'Load Id Resident Src;', ''), blankLineBeforeTable);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].message).toBe('A table should be preceded by a blank line.');
    });

    it('flags a Concatenate-prefixed Load', () => {
      const source = lines('Let x = 1;', 'Concatenate([Sales])', 'Load Id Resident Src;', '');

      expect(lintRule(source, blankLineBeforeTable)).toHaveLength(1);
    });

    it('flags a Join-prefixed Load', () => {
      const source = lines('Let x = 1;', 'Left Join([Sales])', 'Load Id Resident Src;', '');

      expect(lintRule(source, blankLineBeforeTable)).toHaveLength(1);
    });

    it('flags a Mapping Load', () => {
      const source = lines('Let x = 1;', 'Mapping Load Id, Name Resident Src;', '');

      expect(lintRule(source, blankLineBeforeTable)).toHaveLength(1);
    });

    it('flags a SQL Select', () => {
      const source = lines('Let x = 1;', 'SQL Select Id From orders;', '');

      expect(lintRule(source, blankLineBeforeTable)).toHaveLength(1);
    });

    it('accepts a bare Load with a blank line above it', () => {
      const source = lines('Let x = 1;', '', 'Load Id Resident Src;', '');

      expect(lintRule(source, blankLineBeforeTable)).toEqual([]);
    });

    it('flags the second of two tables that each name a source', () => {
      const source = lines('Load A Resident X;', 'Load B Resident Y;', '');

      expect(lintRule(source, blankLineBeforeTable)).toHaveLength(1);
    });
  });

  /*
   * A Load naming no source clause reads from the statement below it. The pair
   * is one table and must not be pushed apart.
   */
  describe('preceding loads', () => {
    it('does not separate a preceding load from its source', () => {
      const source = lines('[Sales]:', 'Load Id, Upper(Name) as N;', 'Load Id, Name Resident Src;', '');

      expect(lintRule(source, blankLineBeforeTable)).toEqual([]);
    });

    it('does not separate a chain of preceding loads', () => {
      const source = lines('[Sales]:', 'Load Id;', 'Load Id;', 'Load Id Resident Src;', '');

      expect(lintRule(source, blankLineBeforeTable)).toEqual([]);
    });

    it('does not separate a preceding load from a SQL Select source', () => {
      const source = lines('[Sales]:', 'Load Id;', 'SQL Select Id From orders;', '');

      expect(lintRule(source, blankLineBeforeTable)).toEqual([]);
    });

    it('treats Inline as a source, so the statement below it opens a table', () => {
      const source = lines('[Sales]:', 'Load * Inline [', 'Id', '];', 'Load Id Resident Src;', '');

      expect(lintRule(source, blankLineBeforeTable)).toHaveLength(1);
    });

    it('treats Where as no source, so the statement below it is the load it filters', () => {
      const source = lines('[Sales]:', 'Load Id Where Id > 0;', 'Load Id Resident Src;', '');

      expect(lintRule(source, blankLineBeforeTable)).toEqual([]);
    });

    it('still flags a labeled table below a source-less Load', () => {
      const source = lines('Load Id;', '[Sales]:', 'Load Id Resident Src;', '');

      expect(lintRule(source, blankLineBeforeTable)).toHaveLength(1);
    });
  });

  describe('file and block boundaries', () => {
    it('does not flag the first statement in the file', () => {
      expect(lintRule(lines('[Sales]:', 'Load Id Resident Src;', ''), blankLineBeforeTable)).toEqual([]);
    });

    it('does not flag a table introduced by the first comment in the file', () => {
      const source = lines('// header', '// more', '[Sales]:', 'Load Id Resident Src;', '');

      expect(lintRule(source, blankLineBeforeTable)).toEqual([]);
    });

    it.each([
      ['Sub', lines('Sub Fill', '[Sales]:', 'Load Id Resident Src;', 'End Sub', '')],
      ['If', lines('If vRun Then', '[Sales]:', 'Load Id Resident Src;', 'End If', '')],
      ['Else', lines('If vRun Then', 'Let x = 1;', 'Else', '[Sales]:', 'Load Id Resident Src;', 'End If', '')],
      ['For', lines('For i = 1 To 3', '[Sales]:', 'Load Id Resident Src;', 'Next', '')],
      ['Case', lines('Switch vX', 'Case 1', '[Sales]:', 'Load Id Resident Src;', 'End Switch', '')],
    ])('does not flag the first statement of a %s body', (_name, source) => {
      expect(lintRule(source, blankLineBeforeTable)).toEqual([]);
    });

    it.each([
      ['End Sub', lines('Sub Fill', 'Let x = 1;', 'End Sub', '[Sales]:', 'Load Id Resident Src;', '')],
      ['Next', lines('For i = 1 To 3', 'Let x = 1;', 'Next', '[Sales]:', 'Load Id Resident Src;', '')],
      ['End If', lines('If vRun Then', 'Let x = 1;', 'End If', '[Sales]:', 'Load Id Resident Src;', '')],
    ])('flags a table that follows a closing %s', (_name, source) => {
      expect(lintRule(source, blankLineBeforeTable)).toHaveLength(1);
    });
  });

  describe('comments above a table', () => {
    it('requires the gap above the comment, not between comment and table', () => {
      const source = lines('Let x = 1;', '// sales', '[Sales]:', 'Load Id Resident Src;', '');

      const diagnostics = lintRule(source, blankLineBeforeTable);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].range.start.line).toBe(3);
    });

    it('accepts a blank line above the comment run', () => {
      const source = lines('Let x = 1;', '', '// sales', '// still sales', '[Sales]:', 'Load Id Resident Src;', '');

      expect(lintRule(source, blankLineBeforeTable)).toEqual([]);
    });

    it('walks a multi-line block comment', () => {
      const source = lines('Let x = 1;', '', '/*', ' * sales', ' */', '[Sales]:', 'Load Id Resident Src;', '');

      expect(lintRule(source, blankLineBeforeTable)).toEqual([]);
    });

    it('does not treat a trailing comment as a comment-only line', () => {
      const source = lines('Let x = 1; // note', '[Sales]:', 'Load Id Resident Src;', '');

      expect(lintRule(source, blankLineBeforeTable)).toHaveLength(1);
    });
  });

  describe('statements that build no table', () => {
    it.each([
      ['Set', lines('Let x = 1;', 'Set y = 2;', '')],
      ['Drop', lines('Let x = 1;', 'Drop Table [Sales];', '')],
      ['Store', lines('Let x = 1;', 'Store [Sales] Into [lib://out/sales.qvd] (qvd);', '')],
      ['Rename', lines('Let x = 1;', 'Rename Table [Sales] To [Orders];', '')],
      ['Call', lines('Let x = 1;', 'Call Fill;', '')],
      ['Sub header naming a Load', lines('Let x = 1;', 'Sub LoadSales', 'Let y = 2;', 'End Sub', '')],
      ['Trace mentioning Load', lines('Let x = 1;', 'Trace Loading Sales;', '')],
    ])('does not flag a %s statement', (_name, source) => {
      expect(lintRule(source, blankLineBeforeTable)).toEqual([]);
    });
  });

  describe('autofix', () => {
    it('inserts the missing blank line', () => {
      const source = lines('Let x = 1;', '[Sales]:', 'Load Id Resident Src;', '');

      const result = formatRule(source, blankLineBeforeTable);

      expect(result.output).toBe(lines('Let x = 1;', '', '[Sales]:', 'Load Id Resident Src;', ''));
      expect(result.fixed).toBe(1);
      expect(result.diagnostics).toEqual([]);
    });

    it('inserts above the comment introducing the table', () => {
      const source = lines('Let x = 1;', '// sales', '[Sales]:', 'Load Id Resident Src;', '');

      const result = formatRule(source, blankLineBeforeTable);

      expect(result.output).toBe(lines('Let x = 1;', '', '// sales', '[Sales]:', 'Load Id Resident Src;', ''));
      expect(result.fixed).toBe(1);
    });

    it('fixes several tables in one pass', () => {
      const source = lines('Let x = 1;', '[A]:', 'Load Id Resident Src;', '[B]:', 'Load Id Resident Src;', '');

      const result = formatRule(source, blankLineBeforeTable);

      expect(result.output).toBe(
        lines('Let x = 1;', '', '[A]:', 'Load Id Resident Src;', '', '[B]:', 'Load Id Resident Src;', ''),
      );
      expect(result.fixed).toBe(2);
      expect(result.diagnostics).toEqual([]);
    });

    it('preserves CRLF line endings', () => {
      const source = 'Let x = 1;\r\n[Sales]:\r\nLoad Id Resident Src;\r\n';

      const result = formatRule(source, blankLineBeforeTable);

      expect(result.output).toBe('Let x = 1;\r\n\r\n[Sales]:\r\nLoad Id Resident Src;\r\n');
      expect(result.fixed).toBe(1);
    });

    it('settles on exactly one blank line alongside no-multiple-empty-lines', () => {
      const source = lines('Let x = 1;', '[Sales]:', 'Load Id Resident Src;', '');

      const result = formatRules(source, [blankLineBeforeTable, noMultipleEmptyLines]);

      expect(result.output).toBe(lines('Let x = 1;', '', '[Sales]:', 'Load Id Resident Src;', ''));
      expect(result.diagnostics).toEqual([]);
    });
  });
});
