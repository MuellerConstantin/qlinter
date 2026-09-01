import { describe, expect, it } from 'vitest';
import { formatRule, formatRules, lintRule } from '../support.js';
import { noMultipleEmptyLines, trailingWhitespace } from '../../src/rules/index.js';
import { lintFixture } from './helpers.js';

describe('trailing-whitespace', () => {
  it('flags every line that ends with spaces or tabs', () => {
    const diagnostics = lintFixture('violation', trailingWhitespace);

    expect(diagnostics).toHaveLength(3);
    for (const d of diagnostics) {
      expect(d.ruleId).toBe('trailing-whitespace');
      expect(d.severity).toBe('warning');
      expect(d.message).toBe('Trailing whitespace.');
    }
    expect(diagnostics.map((d) => d.range.start.line)).toEqual([1, 2, 3]);
  });

  it('does not flag lines without trailing whitespace', () => {
    const diagnostics = lintFixture('clean', trailingWhitespace);

    expect(diagnostics).toEqual([]);
  });

  it('flags trailing spaces', () => {
    const diagnostics = lintRule('SET a = 1;   \n', trailingWhitespace);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].range.start).toEqual({ line: 1, column: 11 });
    expect(diagnostics[0].range.end).toEqual({ line: 1, column: 14 });
  });

  it('flags trailing tabs', () => {
    const diagnostics = lintRule('SET a = 1;\t\t\n', trailingWhitespace);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].range.start.column).toBe(11);
  });

  it('flags mixed trailing whitespace', () => {
    const diagnostics = lintRule('SET a = 1; \t \n', trailingWhitespace);

    expect(diagnostics).toHaveLength(1);
  });

  it('flags a line that is entirely whitespace', () => {
    const diagnostics = lintRule('SET a = 1;\n   \nSET b = 2;\n', trailingWhitespace);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].range.start).toEqual({ line: 2, column: 1 });
    expect(diagnostics[0].range.end).toEqual({ line: 2, column: 4 });
  });

  it('flags trailing whitespace on the last line when there is no terminator', () => {
    const diagnostics = lintRule('SET a = 1;   ', trailingWhitespace);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].range.start).toEqual({ line: 1, column: 11 });
  });

  it('flags trailing whitespace before a CRLF line ending', () => {
    const diagnostics = lintRule('SET a = 1;  \r\nSET b = 2;\r\n', trailingWhitespace);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].range.start.line).toBe(1);
  });

  it('does not flag inner whitespace between tokens', () => {
    const diagnostics = lintRule('SET   a    =    1;\n', trailingWhitespace);

    expect(diagnostics).toEqual([]);
  });

  it('reports each offending line separately', () => {
    const diagnostics = lintRule('SET a = 1; \nSET b = 2;\t\nSET c = 3;\n', trailingWhitespace);

    expect(diagnostics).toHaveLength(2);
    expect(diagnostics.map((d) => d.range.start.line)).toEqual([1, 2]);
  });

  it('autofixes trailing spaces by stripping them', () => {
    const result = formatRule('SET a = 1;   \n', trailingWhitespace);

    expect(result.output).toBe('SET a = 1;\n');
    expect(result.fixed).toBe(1);
    expect(result.diagnostics).toEqual([]);
  });

  it('autofixes mixed trailing whitespace', () => {
    const result = formatRule('SET a = 1; \t \nSET b = 2;\t\n', trailingWhitespace);

    expect(result.output).toBe('SET a = 1;\nSET b = 2;\n');
    expect(result.fixed).toBe(2);
  });

  it('preserves CRLF endings when autofixing', () => {
    const result = formatRule('SET a = 1;   \r\nSET b = 2;\r\n', trailingWhitespace);

    expect(result.output).toBe('SET a = 1;\r\nSET b = 2;\r\n');
    expect(result.fixed).toBe(1);
  });

  it('autofixes the last line when it has no trailing newline', () => {
    const result = formatRule('SET a = 1;   ', trailingWhitespace);

    expect(result.output).toBe('SET a = 1;');
    expect(result.fixed).toBe(1);
  });

  it('autofixes a whitespace-only line down to a truly empty line', () => {
    const result = formatRule('SET a = 1;\n   \nSET b = 2;\n', trailingWhitespace);

    expect(result.output).toBe('SET a = 1;\n\nSET b = 2;\n');
    expect(result.fixed).toBe(1);
  });

  it('converges with no-multiple-empty-lines across multiple format passes', () => {
    const source = 'SET a = 1;\n   \n\t\n  \nSET b = 2;\n';

    const result = formatRules(source, [trailingWhitespace, noMultipleEmptyLines]);

    expect(result.output).toBe('SET a = 1;\n\nSET b = 2;\n');
    expect(result.diagnostics).toEqual([]);
  });

  describe('multi-line tokens', () => {
    it('leaves whitespace inside an inline data block', () => {
      const diagnostics = lintRule('Load * Inline [\nName, Value\nAlice, 1   \n];\n', trailingWhitespace);

      expect(diagnostics).toEqual([]);
    });

    it('leaves whitespace inside a multi-line string literal', () => {
      const diagnostics = lintRule("Let x = 'one   \ntwo';\n", trailingWhitespace);

      expect(diagnostics).toEqual([]);
    });

    it('leaves whitespace inside a multi-line block comment', () => {
      const diagnostics = lintRule('/*\n * text   \n */\nLet x = 1;\n', trailingWhitespace);

      expect(diagnostics).toEqual([]);
    });

    it('leaves whitespace on the line a multi-line token opens', () => {
      const diagnostics = lintRule('Load * Inline [   \nA, B\n1, 2\n];\n', trailingWhitespace);

      expect(diagnostics).toEqual([]);
    });

    it('still flags whitespace past the end of a multi-line token', () => {
      const result = formatRule('Load * Inline [\nA, B\n1, 2\n];   \n', trailingWhitespace);

      expect(result.output).toBe('Load * Inline [\nA, B\n1, 2\n];\n');
      expect(result.fixed).toBe(1);
    });
  });
});
