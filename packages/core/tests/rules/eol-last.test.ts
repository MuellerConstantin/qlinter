import { describe, expect, it } from 'vitest';
import { eolLast } from '../../src/rules/index.js';
import { lintFixture } from './helpers.js';
import { formatRule, lintRule } from '../support.js';

describe('eol-last', () => {
  it('flags the missing final newline in the violation fixture', () => {
    const diagnostics = lintFixture('violation', eolLast);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      ruleId: 'eol-last',
      severity: 'warning',
      message: 'File must end with a newline.',
    });
  });

  it('does not flag the clean fixture', () => {
    const diagnostics = lintFixture('clean', eolLast);

    expect(diagnostics).toEqual([]);
  });

  it('flags a file with no trailing newline', () => {
    const diagnostics = lintRule('SET x = 1;', eolLast);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toBe('File must end with a newline.');
  });

  it('accepts a single trailing LF', () => {
    expect(lintRule('SET x = 1;\n', eolLast)).toEqual([]);
  });

  it('accepts a single trailing CRLF', () => {
    expect(lintRule('SET x = 1;\r\n', eolLast)).toEqual([]);
  });

  it('flags a trailing blank line', () => {
    const diagnostics = lintRule('SET x = 1;\n\n', eolLast);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toBe('File must end with a single newline.');
  });

  it('flags multiple trailing blank lines', () => {
    const diagnostics = lintRule('SET x = 1;\n\n\n', eolLast);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toBe('File must end with a single newline.');
  });

  it('does not flag an empty file', () => {
    expect(lintRule('', eolLast)).toEqual([]);
  });

  it('does not flag a file that is only newlines', () => {
    expect(lintRule('\n\n', eolLast)).toEqual([]);
  });

  it('autofixes a missing newline by appending one', () => {
    const result = formatRule('SET x = 1;', eolLast);

    expect(result.output).toBe('SET x = 1;\n');
    expect(result.fixed).toBe(1);
    expect(result.diagnostics).toEqual([]);
  });

  it('autofixes trailing blank lines by trimming to a single newline', () => {
    const result = formatRule('SET x = 1;\n\n\n', eolLast);

    expect(result.output).toBe('SET x = 1;\n');
    expect(result.fixed).toBe(1);
    expect(result.diagnostics).toEqual([]);
  });

  it('preserves CRLF when trimming trailing blank lines', () => {
    const result = formatRule('SET x = 1;\r\n\r\n', eolLast);

    expect(result.output).toBe('SET x = 1;\r\n');
    expect(result.fixed).toBe(1);
    expect(result.diagnostics).toEqual([]);
  });

  /*
   * Qlik's reference does not say what ends a line, so whether a file written
   * with bare carriage returns is terminated cannot be decided here. Left alone
   * rather than guessed at: appending a newline would mix two conventions.
   */
  describe('a carriage return outside a CRLF pair', () => {
    it('is left alone where it ends the file', () => {
      expect(lintRule('SET x = 1;\r', eolLast)).toEqual([]);
    });

    it('is left alone where the file ends with several of them', () => {
      const result = formatRule('SET x = 1;\r\r', eolLast);

      expect(result.output).toBe('SET x = 1;\r\r');
      expect(result.fixed).toBe(0);
    });

    it('is left alone where the file ends without a terminator at all', () => {
      const result = formatRule('SET x = 1;\rSET y = 2;', eolLast);

      expect(result.output).toBe('SET x = 1;\rSET y = 2;');
      expect(result.fixed).toBe(0);
    });

    it('does not stop the rule on a file whose returns all pair with a newline', () => {
      const result = formatRule('SET x = 1;\r\nSET y = 2;', eolLast);

      expect(result.output).toBe('SET x = 1;\r\nSET y = 2;\r\n');
      expect(result.fixed).toBe(1);
    });
  });
});
