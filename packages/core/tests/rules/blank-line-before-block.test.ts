import { describe, expect, it } from 'vitest';
import {
  blankLineBeforeBlock,
  blankLineBeforeTable,
  noMultipleEmptyLines,
  paddedBlocks,
} from '../../src/rules/index.js';
import { format } from '../../src/index.js';
import { formatRule, formatRules, lintRule } from '../support.js';
import { lintFixture } from './helpers.js';

const lines = (...parts: string[]) => parts.join('\n');

describe('blank-line-before-block', () => {
  it('flags every block that opens without a blank line above it', () => {
    const diagnostics = lintFixture('violation', blankLineBeforeBlock);

    expect(diagnostics).toHaveLength(3);
    for (const diagnostic of diagnostics) {
      expect(diagnostic.ruleId).toBe('blank-line-before-block');
      expect(diagnostic.severity).toBe('warning');
    }
    expect(diagnostics.map((diagnostic) => diagnostic.range.start.line)).toEqual([2, 8, 13]);
  });

  it('does not flag the clean fixture', () => {
    expect(lintFixture('clean', blankLineBeforeBlock)).toEqual([]);
  });

  describe('which headers it claims', () => {
    it.each([
      ['Sub', lines('Let x = 1;', 'Sub Fill', '', '    Let y = 1;', '', 'End Sub', '')],
      ['If', lines('Let x = 1;', 'If vRun Then', '', '    Let y = 1;', '', 'End If', '')],
      ['For', lines('Let x = 1;', 'For i = 1 To 3', '', '    Let y = i;', '', 'Next', '')],
      ['Do', lines('Let x = 1;', 'Do', '', '    Let y = 1;', '', 'Loop', '')],
      ['Switch', lines('Let x = 1;', 'Switch vX', 'Case 1', '', '    Let y = 1;', '', 'End Switch', '')],
    ])('flags a %s header that follows a statement', (_name, source) => {
      const diagnostics = lintRule(source, blankLineBeforeBlock);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].range.start.line).toBe(2);
    });

    it('names the keyword in the message', () => {
      const diagnostics = lintRule(lines('Let x = 1;', 'Sub Fill', 'End Sub', ''), blankLineBeforeBlock);

      expect(diagnostics[0].message).toBe("A 'Sub' block should be preceded by a blank line.");
    });

    /*
     * Else and Case bound a body from inside a block, so the gap above them is
     * that body's edge rather than the start of something new.
     */
    it.each([
      ['Else', lines('If vRun Then', '    Let x = 1;', 'Else', '    Let x = 2;', 'End If', '')],
      ['ElseIf', lines('If vRun Then', '    Let x = 1;', 'ElseIf vOther Then', '    Let x = 2;', 'End If', '')],
      ['Case', lines('Switch vX', 'Case 1', '    Let x = 1;', 'Case 2', '    Let x = 2;', 'End Switch', '')],
      ['Default', lines('Switch vX', 'Case 1', '    Let x = 1;', 'Default', '    Let x = 2;', 'End Switch', '')],
    ])('leaves %s alone', (_name, source) => {
      expect(lintRule(source, blankLineBeforeBlock)).toEqual([]);
    });

    it('leaves a block closer alone', () => {
      const source = lines('Sub Fill', '    Let x = 1;', 'End Sub', '');

      expect(lintRule(source, blankLineBeforeBlock)).toEqual([]);
    });

    it('leaves an ordinary statement alone', () => {
      expect(lintRule(lines('Let x = 1;', 'Let y = 2;', ''), blankLineBeforeBlock)).toEqual([]);
    });

    it('leaves a table alone', () => {
      expect(lintRule(lines('Let x = 1;', '[Sales]:', 'Load Id Resident Src;', ''), blankLineBeforeBlock)).toEqual([]);
    });
  });

  describe('exemptions', () => {
    it('does not flag the first statement in the file', () => {
      expect(lintRule(lines('Sub Fill', '    Let x = 1;', 'End Sub', ''), blankLineBeforeBlock)).toEqual([]);
    });

    it('does not flag a block introduced by the first comment in the file', () => {
      const source = lines('// header', 'Sub Fill', '    Let x = 1;', 'End Sub', '');

      expect(lintRule(source, blankLineBeforeBlock)).toEqual([]);
    });

    it('does not flag a nested block opening its parent body', () => {
      const source = lines('Sub Outer', '    Sub Inner', '        Let x = 1;', '    End Sub', 'End Sub', '');

      expect(lintRule(source, blankLineBeforeBlock)).toEqual([]);
    });

    it('does not flag a block opening an If body', () => {
      const source = lines('If vRun Then', '    For i = 1 To 3', '        Let x = i;', '    Next', 'End If', '');

      expect(lintRule(source, blankLineBeforeBlock)).toEqual([]);
    });

    it('does flag a block that follows a closing keyword', () => {
      const source = lines('Sub A', '    Let x = 1;', 'End Sub', 'Sub B', '    Let y = 2;', 'End Sub', '');

      const diagnostics = lintRule(source, blankLineBeforeBlock);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].range.start.line).toBe(4);
    });

    it('accepts a blank line already there', () => {
      const source = lines('Let x = 1;', '', 'Sub Fill', '    Let y = 1;', 'End Sub', '');

      expect(lintRule(source, blankLineBeforeBlock)).toEqual([]);
    });
  });

  describe('comments above a block', () => {
    it('requires the gap above the comment, not between comment and header', () => {
      const source = lines('Let x = 1;', '// fills the table', 'Sub Fill', '    Let y = 1;', 'End Sub', '');

      const diagnostics = lintRule(source, blankLineBeforeBlock);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].range.start.line).toBe(3);
    });

    it('accepts a blank line above the comment run', () => {
      const source = lines('Let x = 1;', '', '// fills', '// the table', 'Sub Fill', '    Let y = 1;', 'End Sub', '');

      expect(lintRule(source, blankLineBeforeBlock)).toEqual([]);
    });

    it('walks a multi-line block comment', () => {
      const source = lines('Let x = 1;', '', '/*', ' * fills', ' */', 'Sub Fill', '    Let y = 1;', 'End Sub', '');

      expect(lintRule(source, blankLineBeforeBlock)).toEqual([]);
    });
  });

  describe('autofix', () => {
    it('inserts the missing blank line', () => {
      const source = lines('Let x = 1;', 'Sub Fill', '    Let y = 1;', 'End Sub', '');

      const result = formatRule(source, blankLineBeforeBlock);

      expect(result.output).toBe(lines('Let x = 1;', '', 'Sub Fill', '    Let y = 1;', 'End Sub', ''));
      expect(result.fixed).toBe(1);
      expect(result.diagnostics).toEqual([]);
    });

    it('inserts above the comment introducing the block', () => {
      const source = lines('Let x = 1;', '// fills', 'Sub Fill', '    Let y = 1;', 'End Sub', '');

      const result = formatRule(source, blankLineBeforeBlock);

      expect(result.output).toBe(lines('Let x = 1;', '', '// fills', 'Sub Fill', '    Let y = 1;', 'End Sub', ''));
    });

    it('preserves CRLF line endings', () => {
      const source = 'Let x = 1;\r\nSub Fill\r\n    Let y = 1;\r\nEnd Sub\r\n';

      const result = formatRule(source, blankLineBeforeBlock);

      expect(result.output).toBe('Let x = 1;\r\n\r\nSub Fill\r\n    Let y = 1;\r\nEnd Sub\r\n');
    });

    it('settles alongside no-multiple-empty-lines', () => {
      const source = lines('Let x = 1;', 'Sub Fill', '    Let y = 1;', 'End Sub', '');

      const result = formatRules(source, [blankLineBeforeBlock, noMultipleEmptyLines]);

      expect(result.output).toBe(lines('Let x = 1;', '', 'Sub Fill', '    Let y = 1;', 'End Sub', ''));
      expect(result.diagnostics).toEqual([]);
    });

    /*
     * padded-blocks owns the gap directly under a header, this rule the one
     * above it. A nested block sits at both at once, so the two have to agree
     * on who fills which.
     */
    it('settles alongside padded-blocks around a nested block', () => {
      const source = lines('Sub Outer', '    Sub Inner', '        Let x = 1;', '    End Sub', 'End Sub', '');

      const result = formatRules(source, [blankLineBeforeBlock, paddedBlocks]);

      expect(result.output).toBe(
        lines('Sub Outer', '', '    Sub Inner', '', '        Let x = 1;', '', '    End Sub', '', 'End Sub', ''),
      );
      expect(result.diagnostics).toEqual([]);
    });

    /*
     * The exemption is what keeps this pair apart under `never`: padded-blocks
     * strips the gap under a header, and this rule must not put it back.
     */
    it('settles alongside padded-blocks set to never', () => {
      const source = lines('Sub Outer', '    Sub Inner', '        Let x = 1;', '    End Sub', 'End Sub', '');

      const result = format(source, {
        rules: { 'blank-line-before-block': 'warning', 'padded-blocks': ['warning', { padding: 'never' }] },
      });

      expect(result.output).toBe(source);
      expect(result.diagnostics).toEqual([]);
    });

    it('settles alongside blank-line-before-table', () => {
      const source = lines('Sub Fill', '    [Sales]:', '    Load Id Resident Src;', 'End Sub', '');

      const result = formatRules(source, [blankLineBeforeBlock, blankLineBeforeTable]);

      expect(result.output).toBe(source);
      expect(result.diagnostics).toEqual([]);
    });
  });
});
