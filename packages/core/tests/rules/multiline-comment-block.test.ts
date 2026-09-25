import { describe, expect, it } from 'vitest';
import { blockCommentStars, multilineCommentBlock, variableCase } from '../../src/rules/index.js';
import { lintFixture, readFixture } from './helpers.js';
import { formatRule, formatRules, lintRule } from '../support.js';

describe('multiline-comment-block', () => {
  it('flags violations in the violation fixture', () => {
    const diagnostics = lintFixture('violation', multilineCommentBlock);

    expect(diagnostics[0]).toMatchObject({
      ruleId: 'multiline-comment-block',
      severity: 'warning',
    });

    /*
     * One per run the fixture holds, so a case added or lost there is a
     * deliberate edit rather than a number that quietly drifts.
     */
    expect(diagnostics.map((diagnostic) => [diagnostic.range.start.line, diagnostic.range.end.line])).toEqual([
      [1, 2],
      [5, 6],
      [10, 11],
      [15, 17],
      [21, 22],
      [26, 27],
      [29, 30],
    ]);
  });

  it('does not flag the clean fixture', () => {
    const diagnostics = lintFixture('clean', multilineCommentBlock);

    expect(diagnostics).toEqual([]);
  });

  it('leaves the violation fixture settled after one format pass', () => {
    const first = formatRule(readFixture('violation', multilineCommentBlock), multilineCommentBlock);
    const second = formatRule(first.output, multilineCommentBlock);

    expect(first.diagnostics).toEqual([]);
    expect(second.output).toBe(first.output);
    expect(second.fixed).toBe(0);
  });

  it('folds a run of line comments into one block comment', () => {
    const result = formatRule('// first\n// second\nSET vYear = 2026;\n', multilineCommentBlock);

    expect(result.output).toBe('/*\n * first\n * second\n */\nSET vYear = 2026;\n');
    expect(result.fixed).toBeGreaterThan(0);
    expect(result.diagnostics).toEqual([]);
  });

  it('draws the rail from the indentation the run opens at', () => {
    const result = formatRule('IF 1 THEN\n    // first\n    // second\nEND IF\n', multilineCommentBlock);

    expect(result.output).toBe('IF 1 THEN\n    /*\n     * first\n     * second\n     */\nEND IF\n');
  });

  it('folds each run separately when a blank line splits them', () => {
    const result = formatRule('// a\n// b\n\n// c\n// d\n', multilineCommentBlock);

    expect(result.output).toBe('/*\n * a\n * b\n */\n\n/*\n * c\n * d\n */\n');
  });

  it('leaves a single line comment alone', () => {
    expect(lintRule('// only one\nSET vYear = 2026;\n', multilineCommentBlock)).toEqual([]);
  });

  it('leaves comments trailing code alone', () => {
    expect(lintRule('SET a = 1; // one\nSET b = 2; // two\n', multilineCommentBlock)).toEqual([]);
  });

  it('leaves a run holding a section marker alone', () => {
    expect(lintRule('///$tab Main\n// Setup\n// more\nSET x = 1;\n', multilineCommentBlock)).toEqual([]);
  });

  it('leaves a run of decorative banners alone', () => {
    expect(lintRule('////////////\n// Section\n////////////\n', multilineCommentBlock)).toEqual([]);
  });

  it('leaves a disable directive on its own line and folds the prose above it', () => {
    const source = '// reason one\n// reason two\n// qlinter-disable-next-line variable-case\nSET Wrong_Case = 1;\n';

    const result = formatRule(source, multilineCommentBlock);

    expect(result.output).toBe(
      '/*\n * reason one\n * reason two\n */\n// qlinter-disable-next-line variable-case\nSET Wrong_Case = 1;\n',
    );
  });

  it('keeps a folded-over directive suppressing what it was written for', () => {
    const source = '// reason one\n// reason two\n// qlinter-disable-next-line variable-case\nSET Wrong_Case = 1;\n';

    const folded = formatRule(source, multilineCommentBlock).output;

    expect(lintRule(folded, variableCase)).toEqual([]);
  });

  it('leaves a lone directive alone', () => {
    const source = '// qlinter-disable-next-line variable-case\nSET Wrong_Case = 1;\n';

    expect(lintRule(source, multilineCommentBlock)).toEqual([]);
  });

  it('steps a line spelling a block-comment marker out of the run', () => {
    expect(lintRule('// mentions /* here\n// and continues\n', multilineCommentBlock)).toEqual([]);
    expect(lintRule('// mentions */ here\n// and continues\n', multilineCommentBlock)).toEqual([]);

    const result = formatRule('// prose one\n// prose two\n// mentions /* here\n', multilineCommentBlock);

    expect(result.output).toBe('/*\n * prose one\n * prose two\n */\n// mentions /* here\n');
  });

  it('settles on the same shape the block-comment rail rule expects', () => {
    const source = '    // first\n    // second\n';

    const alone = formatRule(source, multilineCommentBlock);
    const together = formatRules(source, [multilineCommentBlock, blockCommentStars]);

    expect(together.output).toBe(alone.output);
    expect(together.diagnostics).toEqual([]);
  });

  /*
   * A line comment turning up beside a block after that block was folded is the
   * same comment either way; without this, which shape a script ends in would
   * depend on which fix happened to land first.
   */
  describe('a line comment beside a block comment', () => {
    it('joins the block below it', () => {
      expect(formatRule('// note\n/*\n * block\n */\nLet a = 1;\n', multilineCommentBlock).output).toBe(
        '/*\n * note\n * block\n */\nLet a = 1;\n',
      );
    });

    it('joins the block above it', () => {
      expect(formatRule('/* block */\n// note\nLet a = 1;\n', multilineCommentBlock).output).toBe(
        '/*\n * block\n * note\n */\nLet a = 1;\n',
      );
    });

    it('keeps a blank line inside the block, and drops the padding at its edges', () => {
      expect(formatRule('// note\n/*\n * one\n *\n * two\n */\n', multilineCommentBlock).output).toBe(
        '/*\n * note\n * one\n *\n * two\n */\n',
      );
    });

    it('reaches the same block whichever half was folded first', () => {
      const lines = '// a\n// b\n// c\nLet x = 1;\n';
      const early = '// a\n/*\n * b\n * c\n */\nLet x = 1;\n';

      expect(formatRule(early, multilineCommentBlock).output).toBe(formatRule(lines, multilineCommentBlock).output);
    });
  });

  describe('left alone', () => {
    it('blocks beside each other with no line comment among them', () => {
      expect(lintRule('/* one */\n/* two */\nLet a = 1;\n', multilineCommentBlock)).toEqual([]);
    });

    it('a banner of asterisks', () => {
      expect(lintRule('// note\n/*****/\nLet a = 1;\n', multilineCommentBlock)).toEqual([]);
    });

    it('a block sharing its line with code', () => {
      expect(lintRule('// note\n/* block */ Let a = 1;\n', multilineCommentBlock)).toEqual([]);
    });
  });
});
