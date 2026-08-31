import { describe, expect, it } from 'vitest';
import { formatRule, lintRule } from '../support.js';
import { noMultipleEmptyLines } from '../../src/rules/index.js';
import { lintFixture } from './helpers.js';

describe('no-multiple-empty-lines', () => {
  it('flags every run of consecutive blank lines that exceeds the default max', () => {
    const diagnostics = lintFixture('violation', noMultipleEmptyLines);

    expect(diagnostics).toHaveLength(2);
    for (const d of diagnostics) {
      expect(d.ruleId).toBe('no-multiple-empty-lines');
      expect(d.severity).toBe('warning');
    }
    expect(diagnostics[0].message).toContain('max 1');
    expect(diagnostics[0].message).toContain('got 3');
    expect(diagnostics[1].message).toContain('got 2');
  });

  it('does not flag single blank separators or comment-only lines between blanks', () => {
    const diagnostics = lintFixture('clean', noMultipleEmptyLines);

    expect(diagnostics).toEqual([]);
  });

  it('points the diagnostic at the first excess blank line', () => {
    const diagnostics = lintRule('SET a = 1;\n\n\n\nSET b = 2;\n', noMultipleEmptyLines);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].range.start).toEqual({ line: 3, column: 1 });
  });

  it('accepts a single blank line between statements', () => {
    const diagnostics = lintRule('SET a = 1;\n\nSET b = 2;\n', noMultipleEmptyLines);

    expect(diagnostics).toEqual([]);
  });

  it('accepts a single trailing newline at end of file', () => {
    const diagnostics = lintRule('SET a = 1;\n', noMultipleEmptyLines);

    expect(diagnostics).toEqual([]);
  });

  it('flags multiple trailing blank lines at end of file', () => {
    const diagnostics = lintRule('SET a = 1;\n\n\n', noMultipleEmptyLines);

    expect(diagnostics).toHaveLength(1);
  });

  it('flags multiple leading blank lines at beginning of file', () => {
    const diagnostics = lintRule('\n\n\nSET a = 1;\n', noMultipleEmptyLines);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].range.start.line).toBe(2);
  });

  it('treats whitespace-only lines as empty', () => {
    const diagnostics = lintRule('SET a = 1;\n   \n\t\nSET b = 2;\n', noMultipleEmptyLines);

    expect(diagnostics).toHaveLength(1);
  });

  it('autofixes a run that contains whitespace-only blank lines', () => {
    const result = formatRule('SET a = 1;\n   \n\t\nSET b = 2;\n', noMultipleEmptyLines);

    expect(result.output).toBe('SET a = 1;\n   \nSET b = 2;\n');
    expect(result.fixed).toBe(1);
  });

  it('does not treat comment-only lines as empty', () => {
    const diagnostics = lintRule('SET a = 1;\n\n// note\n\nSET b = 2;\n', noMultipleEmptyLines);

    expect(diagnostics).toEqual([]);
  });

  it('supports CRLF line endings', () => {
    const diagnostics = lintRule('SET a = 1;\r\n\r\n\r\n\r\nSET b = 2;\r\n', noMultipleEmptyLines);

    expect(diagnostics).toHaveLength(1);
  });

  it('reports multiple independent runs separately', () => {
    const source = 'SET a = 1;\n\n\nSET b = 2;\n\n\nSET c = 3;\n';

    const diagnostics = lintRule(source, noMultipleEmptyLines);

    expect(diagnostics).toHaveLength(2);
  });

  it('honors a custom max option', () => {
    const source = 'SET a = 1;\n\n\nSET b = 2;\n';

    const diagnostics = lintRule(source, noMultipleEmptyLines, { max: 2 });

    expect(diagnostics).toEqual([]);
  });

  it('autofixes a run down to the configured max', () => {
    const result = formatRule('SET a = 1;\n\n\n\nSET b = 2;\n', noMultipleEmptyLines);

    expect(result.output).toBe('SET a = 1;\n\nSET b = 2;\n');
    expect(result.fixed).toBe(1);
    expect(result.diagnostics).toEqual([]);
  });

  it('autofixes trailing blank lines', () => {
    const result = formatRule('SET a = 1;\n\n\n', noMultipleEmptyLines);

    expect(result.output).toBe('SET a = 1;\n\n');
    expect(result.fixed).toBe(1);
  });

  it('autofixes leading blank lines', () => {
    const result = formatRule('\n\n\nSET a = 1;\n', noMultipleEmptyLines);

    expect(result.output).toBe('\nSET a = 1;\n');
    expect(result.fixed).toBe(1);
  });

  it('autofixes multiple runs in a single format pass', () => {
    const source = 'SET a = 1;\n\n\nSET b = 2;\n\n\n\nSET c = 3;\n';

    const result = formatRule(source, noMultipleEmptyLines);

    expect(result.output).toBe('SET a = 1;\n\nSET b = 2;\n\nSET c = 3;\n');
    expect(result.fixed).toBe(2);
  });

  it('autofixes a run down to a custom max', () => {
    const source = 'SET a = 1;\n\n\n\n\nSET b = 2;\n';

    const result = formatRule(source, noMultipleEmptyLines, { max: 2 });

    expect(result.output).toBe('SET a = 1;\n\n\nSET b = 2;\n');
    expect(result.fixed).toBe(1);
  });

  it('preserves CRLF line endings when autofixing', () => {
    const result = formatRule('SET a = 1;\r\n\r\n\r\n\r\nSET b = 2;\r\n', noMultipleEmptyLines);

    expect(result.output).toBe('SET a = 1;\r\n\r\nSET b = 2;\r\n');
    expect(result.fixed).toBe(1);
  });

  /*
   * Regression: the rule read the source line by line with no idea which of
   * those lines a token had claimed, and trimmed runs out of the inside of
   * constructs the lexer keeps opaque. For a string literal that changed the
   * value the script loads.
   */
  describe('lines an opaque token carries', () => {
    it('leaves a run inside a string literal alone', () => {
      const source = "Load\n    'line one\n\n\nline two' as Note\nResident Src;\n";

      expect(lintRule(source, noMultipleEmptyLines)).toEqual([]);
      expect(formatRule(source, noMultipleEmptyLines).output).toBe(source);
    });

    it('leaves a run inside Inline data alone', () => {
      const source = '[R]:\nLoad * Inline [\nId, Name\n1, a\n\n\n2, b\n];\n';

      expect(lintRule(source, noMultipleEmptyLines)).toEqual([]);
      expect(formatRule(source, noMultipleEmptyLines).output).toBe(source);
    });

    it('leaves a run inside a block comment alone', () => {
      const source = 'Let x = 1;\n/*\n\n\n*/\nLet y = 2;\n';

      expect(lintRule(source, noMultipleEmptyLines)).toEqual([]);
    });

    it('still trims a real run in a script that also carries one', () => {
      const source = "Load 'a\n\n\nb' as T Resident S;\n\n\nLet y = 2;\n";

      const result = formatRule(source, noMultipleEmptyLines);

      expect(result.output).toBe("Load 'a\n\n\nb' as T Resident S;\n\nLet y = 2;\n");
      expect(result.fixed).toBe(1);
    });
  });
});
