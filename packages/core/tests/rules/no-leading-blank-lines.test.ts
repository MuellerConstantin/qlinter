import { describe, expect, it } from 'vitest';
import { noLeadingBlankLines, noMultipleEmptyLines } from '../../src/rules/index.js';
import { formatRule, formatRules, lintRule } from '../support.js';
import { lintFixture } from './helpers.js';

describe('no-leading-blank-lines', () => {
  it('flags the leading run in the violation fixture', () => {
    const diagnostics = lintFixture('violation', noLeadingBlankLines);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      ruleId: 'no-leading-blank-lines',
      severity: 'warning',
      message: 'File must not start with a blank line.',
    });
    expect(diagnostics[0].range).toEqual({ start: { line: 1, column: 1 }, end: { line: 3, column: 1 } });
  });

  it('does not flag the clean fixture', () => {
    expect(lintFixture('clean', noLeadingBlankLines)).toEqual([]);
  });

  describe('what counts as leading', () => {
    it('flags a single leading blank line', () => {
      expect(lintRule('\nLet x = 1;\n', noLeadingBlankLines)).toHaveLength(1);
    });

    it('reports a run of several as one finding', () => {
      const diagnostics = lintRule('\n\n\nLet x = 1;\n', noLeadingBlankLines);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].range.end.line).toBe(4);
    });

    it('treats whitespace-only lines as blank', () => {
      expect(lintRule('   \n\t\nLet x = 1;\n', noLeadingBlankLines)).toHaveLength(1);
    });

    it('does not treat a leading comment as blank', () => {
      expect(lintRule('// header\nLet x = 1;\n', noLeadingBlankLines)).toEqual([]);
    });

    it('flags a blank line above a leading comment', () => {
      expect(lintRule('\n// header\nLet x = 1;\n', noLeadingBlankLines)).toHaveLength(1);
    });

    it('accepts a file that starts with content', () => {
      expect(lintRule('Let x = 1;\n', noLeadingBlankLines)).toEqual([]);
    });

    it('leaves blank lines below the first content line alone', () => {
      expect(lintRule('Let x = 1;\n\n\nLet y = 2;\n', noLeadingBlankLines)).toEqual([]);
    });

    it('leaves trailing blank lines alone', () => {
      expect(lintRule('Let x = 1;\n\n\n', noLeadingBlankLines)).toEqual([]);
    });
  });

  describe('files with no content', () => {
    it('says nothing about an empty file', () => {
      expect(lintRule('', noLeadingBlankLines)).toEqual([]);
    });

    it('says nothing about a file that is only blank lines', () => {
      expect(lintRule('\n\n\n', noLeadingBlankLines)).toEqual([]);
    });

    it('says nothing about a file that is only whitespace', () => {
      expect(lintRule('   \n\t\n', noLeadingBlankLines)).toEqual([]);
    });
  });

  describe('autofix', () => {
    it('removes the leading run', () => {
      const result = formatRule('\n\n\nLet x = 1;\n', noLeadingBlankLines);

      expect(result.output).toBe('Let x = 1;\n');
      expect(result.fixed).toBe(1);
      expect(result.diagnostics).toEqual([]);
    });

    it('keeps the comment the blank line was pushing down', () => {
      const result = formatRule('\n// header\nLet x = 1;\n', noLeadingBlankLines);

      expect(result.output).toBe('// header\nLet x = 1;\n');
    });

    it('removes whitespace-only leading lines', () => {
      const result = formatRule('   \n\t\nLet x = 1;\n', noLeadingBlankLines);

      expect(result.output).toBe('Let x = 1;\n');
    });

    it('preserves CRLF line endings', () => {
      const result = formatRule('\r\n\r\nLet x = 1;\r\n', noLeadingBlankLines);

      expect(result.output).toBe('Let x = 1;\r\n');
    });

    it('clears the whole run alongside no-multiple-empty-lines', () => {
      const result = formatRules('\n\n\nLet x = 1;\n', [noLeadingBlankLines, noMultipleEmptyLines]);

      expect(result.output).toBe('Let x = 1;\n');
      expect(result.diagnostics).toEqual([]);
    });
  });
});
