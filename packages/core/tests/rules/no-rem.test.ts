import { describe, expect, it } from 'vitest';
import { recommended, noRem } from '../../src/rules/index.js';
import { format } from '../../src/index.js';
import { lintFixture, readFixture } from './helpers.js';
import { formatRule, lintRule } from '../support.js';

describe('no-rem', () => {
  it('flags violations in the violation fixture', () => {
    const diagnostics = lintFixture('violation', noRem);

    expect(diagnostics[0]).toMatchObject({ ruleId: 'no-rem', severity: 'warning' });
    expect(diagnostics.map((diagnostic) => diagnostic.range.start.line)).toEqual([1, 4, 5, 10]);
  });

  it('does not flag the clean fixture', () => {
    expect(lintFixture('clean', noRem)).toEqual([]);
  });

  it('formats the violation fixture into the clean shape under the full preset', () => {
    const output = format(readFixture('violation', noRem), recommended).output;

    expect(output).toContain('// Default configuration for the calendar\n');
    expect(output).toContain(
      '/*\n * Quarters are numbered from the start of the fiscal year\n * which begins in April\n */\n',
    );
    expect(output).toContain('    // Builds one row per day\n');
    expect(output).not.toMatch(/\bRem\b/i);
  });

  describe('autofix', () => {
    it('writes the remark as a line comment and drops its terminator', () => {
      expect(formatRule('REM Default configuration;\n', noRem).output).toBe('// Default configuration\n');
    });

    it('writes a remark over several lines as one line comment per line, at its indent', () => {
      expect(formatRule('    REM Quarters:\n  Q1, Q2;\n', noRem).output).toBe('    // Quarters:\n    //  Q1, Q2\n');
    });

    it('keeps the line ending of the file', () => {
      expect(formatRule('REM a\r\nb;\r\n', noRem).output).toBe('// a\r\n//b\r\n');
    });

    it('writes an empty remark as an empty comment', () => {
      expect(formatRule('Rem;\n', noRem).output).toBe('//\n');
    });
  });

  describe('flagged without a fix', () => {
    const unfixed = (source: string) => {
      const diagnostics = lintRule(source, noRem);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].fix).toBeUndefined();
    };

    it('a remark holding a dollar-sign expansion', () => {
      unfixed('REM uses $(vPath);\n');
    });

    it('a remark that would become a disable directive', () => {
      unfixed('REM qlinter-disable-next-line variable-case;\n');
    });

    it('a remark sharing its line with what follows it', () => {
      unfixed('REM note; Let x = 1;\n');
    });

    it('a remark sharing its line with the statement before it', () => {
      unfixed('Let x = 1; REM note;\n');
      unfixed('Let x = 1; REM first\nsecond;\n');
    });

    it('a remark the file ends inside', () => {
      unfixed('REM never closed\n');
    });
  });

  describe('a Rem where no statement begins', () => {
    const load = 'LOAD a, REM, b RESIDENT MyTable;\n';

    it('is a name, not a remark, and is not flagged', () => {
      expect(lintRule(load, noRem)).toEqual([]);
    });

    it('keeps the rest of its statement out of a comment', () => {
      const output = format(load, recommended).output;

      expect(output).not.toContain('//');
      expect(output).toMatch(/Resident MyTable|RESIDENT MyTable/);
    });
  });

  describe('a Rem after a statement on its line', () => {
    const source = 'If x Then\n    exit script;\tREM Exit the script;\nEndIf\n';

    it('reaches one result whatever order the rules are configured in', () => {
      const entries = Object.entries(recommended.rules ?? {});
      const forward = format(source, { rules: Object.fromEntries(entries) }).output;
      const backward = format(source, { rules: Object.fromEntries([...entries].reverse()) }).output;

      expect(forward).toBe(backward);
      expect(forward).toContain('\n    // Exit the script\n');
    });
  });
});
