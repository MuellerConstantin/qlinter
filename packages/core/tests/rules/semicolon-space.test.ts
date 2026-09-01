import { describe, expect, it } from 'vitest';
import { semicolonSpace, trailingWhitespace } from '../../src/rules/index.js';
import { formatRule, formatRules, lintRule } from '../support.js';
import { lintFixture } from './helpers.js';

const lines = (...parts: string[]) => parts.join('\n');

describe('semicolon-space', () => {
  it('flags every spaced terminator in the violation fixture', () => {
    const diagnostics = lintFixture('violation', semicolonSpace);

    expect(diagnostics).toHaveLength(3);
    for (const diagnostic of diagnostics) {
      expect(diagnostic.ruleId).toBe('semicolon-space');
      expect(diagnostic.severity).toBe('warning');
      expect(diagnostic.message).toBe("Unexpected space before ';'.");
    }
  });

  it('does not flag the clean fixture', () => {
    expect(lintFixture('clean', semicolonSpace)).toEqual([]);
  });

  describe('what it closes', () => {
    it('flags a single space', () => {
      const diagnostics = lintRule('Let x = 1 ;\n', semicolonSpace);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].range.start).toEqual({ line: 1, column: 11 });
    });

    it('flags a run of spaces', () => {
      expect(lintRule('Let x = 1    ;\n', semicolonSpace)).toHaveLength(1);
    });

    it('flags a tab', () => {
      expect(lintRule('Let x = 1\t;\n', semicolonSpace)).toHaveLength(1);
    });

    it('flags the terminator of a Load', () => {
      expect(lintRule('Load Id Resident Src ;\n', semicolonSpace)).toHaveLength(1);
    });

    it('flags each terminator separately', () => {
      expect(lintRule('Let x = 1 ;\nLet y = 2 ;\n', semicolonSpace)).toHaveLength(2);
    });

    it('accepts a tight terminator', () => {
      expect(lintRule('Let x = 1;\n', semicolonSpace)).toEqual([]);
    });
  });

  /*
   * The gap is read between two tokens, never backwards through the source, so
   * whitespace a token owns is out of reach by construction.
   */
  describe('gaps that belong to somebody else', () => {
    it('leaves the spaces before a Trace terminator alone, since they are message text', () => {
      const source = 'Trace loading sales   ;\n';

      expect(lintRule(source, semicolonSpace)).toEqual([]);
      expect(formatRule(source, semicolonSpace).output).toBe(source);
    });

    it('leaves a terminator that opens its own line alone', () => {
      const source = lines('Load', '    Id', 'Resident Src', ';', '');

      expect(lintRule(source, semicolonSpace)).toEqual([]);
    });

    it('leaves an indented terminator on its own line alone', () => {
      const source = lines('Load', '    Id', 'Resident Src', '    ;', '');

      expect(lintRule(source, semicolonSpace)).toEqual([]);
    });

    it('leaves a comment standing before the terminator alone', () => {
      const source = 'Let x = 1 /* done */ ;\n';

      expect(lintRule(source, semicolonSpace)).toEqual([]);
    });

    it('leaves the closing bracket of Inline data alone', () => {
      const source = lines('Load * Inline [', 'Id', '1', '];', '');

      expect(lintRule(source, semicolonSpace)).toEqual([]);
    });

    it('flags the gap after an Inline block when one is there', () => {
      const source = lines('Load * Inline [', 'Id', '1', ']   ;', '');

      expect(lintRule(source, semicolonSpace)).toHaveLength(1);
    });
  });

  describe('autofix', () => {
    it('closes the gap', () => {
      const result = formatRule('Let x = 1 ;\n', semicolonSpace);

      expect(result.output).toBe('Let x = 1;\n');
      expect(result.fixed).toBe(1);
      expect(result.diagnostics).toEqual([]);
    });

    it('closes a run of spaces and tabs', () => {
      const result = formatRule('Let x = 1 \t  ;\n', semicolonSpace);

      expect(result.output).toBe('Let x = 1;\n');
    });

    it('closes several terminators in one pass', () => {
      const result = formatRule('Let x = 1 ;\nLet y = 2 ;\n', semicolonSpace);

      expect(result.output).toBe('Let x = 1;\nLet y = 2;\n');
      expect(result.fixed).toBe(2);
    });

    it('preserves CRLF line endings', () => {
      const result = formatRule('Let x = 1 ;\r\nLet y = 2;\r\n', semicolonSpace);

      expect(result.output).toBe('Let x = 1;\r\nLet y = 2;\r\n');
    });

    it('settles alongside trailing-whitespace', () => {
      const result = formatRules('Let x = 1 ;   \n', [semicolonSpace, trailingWhitespace]);

      expect(result.output).toBe('Let x = 1;\n');
      expect(result.diagnostics).toEqual([]);
    });
  });
});
