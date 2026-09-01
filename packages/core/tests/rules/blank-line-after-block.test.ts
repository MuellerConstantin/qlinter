import { describe, expect, it } from 'vitest';
import {
  blankLineAfterBlock,
  blankLineBeforeBlock,
  blankLineBeforeTable,
  noMultipleEmptyLines,
  paddedBlocks,
} from '../../src/rules/index.js';
import { formatRule, formatRules, lintRule } from '../support.js';
import { lintFixture } from './helpers.js';

const lines = (...parts: string[]) => parts.join('\n');

describe('blank-line-after-block', () => {
  it('flags every block that closes without a blank line below it', () => {
    const diagnostics = lintFixture('violation', blankLineAfterBlock);

    expect(diagnostics).toHaveLength(2);
    for (const diagnostic of diagnostics) {
      expect(diagnostic.ruleId).toBe('blank-line-after-block');
      expect(diagnostic.severity).toBe('warning');
      expect(diagnostic.message).toBe('A block should be followed by a blank line.');
    }
    expect(diagnostics.map((diagnostic) => diagnostic.range.start.line)).toEqual([5, 12]);
  });

  it('does not flag the clean fixture', () => {
    expect(lintFixture('clean', blankLineAfterBlock)).toEqual([]);
  });

  describe('which closers it claims', () => {
    it.each([
      ['End Sub', lines('Sub Fill', '', '    Let x = 1;', '', 'End Sub', 'Let y = 2;', '')],
      ['End If', lines('If vRun Then', '', '    Let x = 1;', '', 'End If', 'Let y = 2;', '')],
      ['Next', lines('For i = 1 To 3', '', '    Let x = i;', '', 'Next', 'Let y = 2;', '')],
      ['Loop', lines('Do', '', '    Let x = 1;', '', 'Loop', 'Let y = 2;', '')],
      ['End Switch', lines('Switch vX', 'Case 1', '', '    Let x = 1;', '', 'End Switch', 'Let y = 2;', '')],
    ])('flags a block closed by %s', (_name, source) => {
      expect(lintRule(source, blankLineAfterBlock)).toHaveLength(1);
    });

    it('accepts a blank line already there', () => {
      const source = lines('Sub Fill', '', '    Let x = 1;', '', 'End Sub', '', 'Let y = 2;', '');

      expect(lintRule(source, blankLineAfterBlock)).toEqual([]);
    });

    it('says nothing when the block ends the file', () => {
      expect(lintRule(lines('Sub Fill', '', '    Let x = 1;', '', 'End Sub', ''), blankLineAfterBlock)).toEqual([]);
    });

    it('leaves a block header alone', () => {
      const source = lines('Sub Fill', '    Let x = 1;', 'End Sub', '');

      expect(lintRule(source, blankLineAfterBlock)).toEqual([]);
    });
  });

  /*
   * A closer meeting another ends a nest rather than a section, and what opens
   * a section of its own already asks for the gap above it. Claiming either
   * here would fill one gap twice.
   */
  describe('gaps another line already owns', () => {
    it.each([
      ['a nested closer', lines('Sub A', 'If x Then', '    Let y = 1;', 'End If', 'End Sub', '')],
      [
        'an Else',
        lines('If x Then', 'For i = 1 To 3', '    Let y = i;', 'Next', 'Else', '    Let y = 2;', 'End If', ''),
      ],
      [
        'a Case',
        lines(
          'Switch vX',
          'Case 1',
          'If x Then',
          '    Let y = 1;',
          'End If',
          'Case 2',
          '    Let y = 2;',
          'End Switch',
          '',
        ),
      ],
    ])('says nothing when %s follows', (_name, source) => {
      expect(lintRule(source, blankLineAfterBlock)).toEqual([]);
    });

    it('says nothing when a block header follows', () => {
      const source = lines('Sub A', '    Let x = 1;', 'End Sub', 'Sub B', '    Let y = 1;', 'End Sub', '');

      expect(lintRule(source, blankLineAfterBlock)).toEqual([]);
    });

    it('says nothing when a labelled table follows', () => {
      const source = lines('Sub A', '    Let x = 1;', 'End Sub', '[Sales]:', 'Load Id Resident Src;', '');

      expect(lintRule(source, blankLineAfterBlock)).toEqual([]);
    });

    it('says nothing when an unlabelled Load follows', () => {
      const source = lines('Sub A', '    Let x = 1;', 'End Sub', 'Load Id Resident Src;', '');

      expect(lintRule(source, blankLineAfterBlock)).toEqual([]);
    });
  });

  describe('comments below a block', () => {
    it('requires the gap above the comment, not between comment and statement', () => {
      const source = lines('Sub Fill', '', '    Let x = 1;', '', 'End Sub', '// next up', 'Let y = 2;', '');

      const diagnostics = lintRule(source, blankLineAfterBlock);

      expect(diagnostics).toHaveLength(1);
      expect(formatRule(source, blankLineAfterBlock).output).toBe(
        lines('Sub Fill', '', '    Let x = 1;', '', 'End Sub', '', '// next up', 'Let y = 2;', ''),
      );
    });

    it('accepts a blank line above the comment run', () => {
      const source = lines('Sub Fill', '', '    Let x = 1;', '', 'End Sub', '', '// next up', 'Let y = 2;', '');

      expect(lintRule(source, blankLineAfterBlock)).toEqual([]);
    });
  });

  describe('autofix', () => {
    it('inserts the missing blank line', () => {
      const source = lines('Sub Fill', '', '    Let x = 1;', '', 'End Sub', 'Let y = 2;', '');

      const result = formatRule(source, blankLineAfterBlock);

      expect(result.output).toBe(lines('Sub Fill', '', '    Let x = 1;', '', 'End Sub', '', 'Let y = 2;', ''));
      expect(result.fixed).toBe(1);
      expect(result.diagnostics).toEqual([]);
    });

    it('preserves CRLF line endings', () => {
      const source = 'Sub Fill\r\n\r\n    Let x = 1;\r\n\r\nEnd Sub\r\nLet y = 2;\r\n';

      const result = formatRule(source, blankLineAfterBlock);

      expect(result.output).toBe('Sub Fill\r\n\r\n    Let x = 1;\r\n\r\nEnd Sub\r\n\r\nLet y = 2;\r\n');
    });

    /*
     * Regression: without the exemption both rules emitted the same zero-width
     * insert at the same offset, `applyFixes` accepted both, and the gap came
     * out two lines wide.
     */
    it.each([
      ['a block', lines('Sub A', '    Let x = 1;', 'End Sub', 'Sub B', '    Let y = 1;', 'End Sub', '')],
      ['a table', lines('Sub A', '    Let x = 1;', 'End Sub', '[Sales]:', 'Load Id Resident Src;', '')],
    ])('opens exactly one blank line when %s follows', (_name, source) => {
      const result = formatRules(source, [
        blankLineAfterBlock,
        blankLineBeforeBlock,
        blankLineBeforeTable,
        paddedBlocks,
      ]);
      const output = result.output.split('\n');
      const closer = output.indexOf('End Sub');

      expect(output.slice(closer + 1).findIndex((line) => line !== '')).toBe(1);
      expect(result.diagnostics).toEqual([]);
    });

    it('settles alongside no-multiple-empty-lines', () => {
      const source = lines('Sub Fill', '', '    Let x = 1;', '', 'End Sub', 'Let y = 2;', '');

      const result = formatRules(source, [blankLineAfterBlock, noMultipleEmptyLines]);

      expect(result.output).toBe(lines('Sub Fill', '', '    Let x = 1;', '', 'End Sub', '', 'Let y = 2;', ''));
      expect(result.diagnostics).toEqual([]);
    });
  });
});
