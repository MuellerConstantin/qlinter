import { describe, expect, it } from 'vitest';
import { blankLineBeforeTable, noMultipleEmptyLines, paddedBlocks } from '../../src/rules/index.js';
import { formatRule, formatRules, lintRule } from '../support.js';
import { lintFixture } from './helpers.js';

const lines = (...parts: string[]) => parts.join('\n');
const never = { padding: 'never' } as const;

describe('padded-blocks', () => {
  it('flags both edges of every unpadded block in the violation fixture', () => {
    const diagnostics = lintFixture('violation', paddedBlocks);

    expect(diagnostics).toHaveLength(8);
    for (const diagnostic of diagnostics) {
      expect(diagnostic.ruleId).toBe('padded-blocks');
      expect(diagnostic.severity).toBe('warning');
    }
  });

  it('does not flag the clean fixture', () => {
    expect(lintFixture('clean', paddedBlocks)).toEqual([]);
  });

  it('reports the same eight edges as over-padded when the option is flipped', () => {
    const diagnostics = lintFixture('clean', paddedBlocks, never);

    expect(diagnostics).toHaveLength(8);
    expect(diagnostics.every((diagnostic) => diagnostic.message.includes('should not'))).toBe(true);
  });

  describe('always', () => {
    it('flags the opening edge', () => {
      const source = lines('Sub Fill', '    Let x = 1;', '', 'End Sub', '');

      const diagnostics = lintRule(source, paddedBlocks);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].message).toBe('Block body should start with a blank line.');
      expect(diagnostics[0].range.start).toEqual({ line: 1, column: 1 });
    });

    it('flags the closing edge', () => {
      const source = lines('Sub Fill', '', '    Let x = 1;', 'End Sub', '');

      const diagnostics = lintRule(source, paddedBlocks);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].message).toBe('Block body should end with a blank line.');
      expect(diagnostics[0].range.start).toEqual({ line: 4, column: 1 });
    });

    it('accepts a fully padded block', () => {
      const source = lines('Sub Fill', '', '    Let x = 1;', '', 'End Sub', '');

      expect(lintRule(source, paddedBlocks)).toEqual([]);
    });

    it('treats one blank line as a floor, not a ceiling', () => {
      const source = lines('Sub Fill', '', '', '    Let x = 1;', '', '', 'End Sub', '');

      expect(lintRule(source, paddedBlocks)).toEqual([]);
    });

    it.each([
      ['For / Next', lines('For i = 1 To 3', '    Let x = i;', 'Next', '')],
      ['Do / Loop', lines('Do', '    Let x = 1;', 'Loop', '')],
      ['Switch / End Switch', lines('Switch vX', 'Case 1', '    Let x = 1;', 'End Switch', '')],
    ])('flags both edges of a %s block', (_name, source) => {
      expect(lintRule(source, paddedBlocks)).toHaveLength(2);
    });

    it('treats Else as both the end of one body and the start of the next', () => {
      const source = lines('If vRun Then', '', '    Let x = 1;', 'Else', '    Let x = 2;', '', 'End If', '');

      const diagnostics = lintRule(source, paddedBlocks);

      expect(diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
        'Block body should end with a blank line.',
        'Block body should start with a blank line.',
      ]);
    });

    it('treats Case the same way', () => {
      const source = lines(
        'Switch vX',
        'Case 1',
        '',
        '    Let x = 1;',
        'Case 2',
        '',
        '    Let x = 2;',
        '',
        'End Switch',
        '',
      );

      const diagnostics = lintRule(source, paddedBlocks);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].message).toBe('Block body should end with a blank line.');
    });

    it.each([
      ['an empty Sub', lines('Sub LoadArchive', 'End Sub', '')],
      ['an empty Then branch', lines('If vRun Then', 'Else', '', '    Let x = 1;', '', 'End If', '')],
      [
        'a Switch header meeting its first Case',
        lines('Switch vX', 'Case 1', '', '    Let x = 1;', '', 'End Switch', ''),
      ],
      ['an empty Case body', lines('Switch vX', 'Case 1', 'Case 2', '', '    Let x = 1;', '', 'End Switch', '')],
    ])('pads nothing into %s', (_name, source) => {
      expect(lintRule(source, paddedBlocks)).toEqual([]);
    });

    it('leaves the gap above the block header alone', () => {
      const source = lines('Let x = 1;', 'Sub Fill', '', '    Let y = 1;', '', 'End Sub', '');

      expect(lintRule(source, paddedBlocks)).toEqual([]);
    });

    it('leaves blank lines in the middle of a body alone', () => {
      const source = lines('Sub Fill', '', '    Let x = 1;', '', '    Let y = 2;', '', 'End Sub', '');

      expect(lintRule(source, paddedBlocks)).toEqual([]);
    });

    it('counts a leading comment as body, so the blank belongs above it', () => {
      const source = lines('Sub Fill', '    // set up', '    Let x = 1;', '', 'End Sub', '');

      expect(lintRule(source, paddedBlocks)).toHaveLength(1);
    });

    it('accepts a blank line above a leading comment', () => {
      const source = lines('Sub Fill', '', '    // set up', '    Let x = 1;', '', 'End Sub', '');

      expect(lintRule(source, paddedBlocks)).toEqual([]);
    });

    it('counts a trailing comment as body, so the blank belongs below it', () => {
      const source = lines('Sub Fill', '', '    Let x = 1;', '    // done', 'End Sub', '');

      expect(lintRule(source, paddedBlocks)).toHaveLength(1);
    });

    it('handles nested blocks independently', () => {
      const source = lines('Sub Fill', 'If vRun Then', '    Let x = 1;', 'End If', 'End Sub', '');

      expect(lintRule(source, paddedBlocks)).toHaveLength(4);
    });
  });

  describe('never', () => {
    it('flags a padded opening edge', () => {
      const source = lines('Sub Fill', '', '    Let x = 1;', 'End Sub', '');

      const diagnostics = lintRule(source, paddedBlocks, never);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].message).toBe('Block body should not start with a blank line.');
    });

    it('flags a padded closing edge', () => {
      const source = lines('Sub Fill', '    Let x = 1;', '', 'End Sub', '');

      const diagnostics = lintRule(source, paddedBlocks, never);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].message).toBe('Block body should not end with a blank line.');
    });

    it('accepts a tight block', () => {
      const source = lines('Sub Fill', '    Let x = 1;', 'End Sub', '');

      expect(lintRule(source, paddedBlocks, never)).toEqual([]);
    });

    it('still pads nothing into an empty block', () => {
      expect(lintRule(lines('Sub LoadArchive', 'End Sub', ''), paddedBlocks, never)).toEqual([]);
    });
  });

  describe('autofix', () => {
    it('inserts both blank lines under always', () => {
      const source = lines('Sub Fill', '    Let x = 1;', 'End Sub', '');

      const result = formatRule(source, paddedBlocks);

      expect(result.output).toBe(lines('Sub Fill', '', '    Let x = 1;', '', 'End Sub', ''));
      expect(result.fixed).toBe(2);
      expect(result.diagnostics).toEqual([]);
    });

    it('inserts above a leading comment under always', () => {
      const source = lines('Sub Fill', '    // set up', '    Let x = 1;', '', 'End Sub', '');

      const result = formatRule(source, paddedBlocks);

      expect(result.output).toBe(lines('Sub Fill', '', '    // set up', '    Let x = 1;', '', 'End Sub', ''));
    });

    it('removes both blank lines under never', () => {
      const source = lines('Sub Fill', '', '    Let x = 1;', '', 'End Sub', '');

      const result = formatRule(source, paddedBlocks, never);

      expect(result.output).toBe(lines('Sub Fill', '    Let x = 1;', 'End Sub', ''));
      expect(result.fixed).toBe(2);
      expect(result.diagnostics).toEqual([]);
    });

    it('removes a multi-line run at the edge under never', () => {
      const source = lines('Sub Fill', '', '', '    Let x = 1;', 'End Sub', '');

      const result = formatRule(source, paddedBlocks, never);

      expect(result.output).toBe(lines('Sub Fill', '    Let x = 1;', 'End Sub', ''));
      expect(result.fixed).toBe(1);
    });

    it('preserves CRLF line endings', () => {
      const source = 'Sub Fill\r\n    Let x = 1;\r\nEnd Sub\r\n';

      const result = formatRule(source, paddedBlocks);

      expect(result.output).toBe('Sub Fill\r\n\r\n    Let x = 1;\r\n\r\nEnd Sub\r\n');
    });

    it('settles on one blank line alongside no-multiple-empty-lines', () => {
      const source = lines('Sub Fill', '    Let x = 1;', 'End Sub', '');

      const result = formatRules(source, [paddedBlocks, noMultipleEmptyLines]);

      expect(result.output).toBe(lines('Sub Fill', '', '    Let x = 1;', '', 'End Sub', ''));
      expect(result.diagnostics).toEqual([]);
    });

    it('settles alongside blank-line-before-table when a table opens the block', () => {
      const source = lines('Sub Fill', '    [Sales]:', '    Load Id Resident Src;', 'End Sub', '');

      const result = formatRules(source, [paddedBlocks, blankLineBeforeTable]);

      expect(result.output).toBe(lines('Sub Fill', '', '    [Sales]:', '    Load Id Resident Src;', '', 'End Sub', ''));
      expect(result.diagnostics).toEqual([]);
    });
  });
});
