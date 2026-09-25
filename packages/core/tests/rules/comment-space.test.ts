import { describe, expect, it } from 'vitest';
import { formatRule, lintRule } from '../support.js';
import { commentSpace } from '../../src/rules/index.js';
import { lintFixture } from './helpers.js';

describe('comment-space', () => {
  it('flags missing spaces in line and block comments from the fixture', () => {
    const diagnostics = lintFixture('violation', commentSpace);

    expect(diagnostics).toHaveLength(5);
    for (const d of diagnostics) {
      expect(d.ruleId).toBe('comment-space');
      expect(d.severity).toBe('warning');
    }

    const messages = diagnostics.map((d) => d.message);
    expect(messages.filter((m) => m === "Expected a space after '//'.")).toHaveLength(1);
    expect(messages.filter((m) => m === "Expected a space after '/*'.")).toHaveLength(2);
    expect(messages.filter((m) => m === "Expected a space before '*/'.")).toHaveLength(2);
  });

  it('does not flag well-formatted comments, empty markers, or decorative banners', () => {
    const diagnostics = lintFixture('clean', commentSpace);

    expect(diagnostics).toEqual([]);
  });

  it('flags a line comment with no space after //', () => {
    const diagnostics = lintRule('//foo\n', commentSpace);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toBe("Expected a space after '//'.");
    expect(diagnostics[0].range.start).toEqual({ line: 1, column: 1 });
  });

  it('accepts an empty line comment', () => {
    const diagnostics = lintRule('//\n', commentSpace);

    expect(diagnostics).toEqual([]);
  });

  it('leaves a section marker as written', () => {
    expect(lintRule('///$tab Main\nSET x = 1;\n', commentSpace)).toEqual([]);
  });

  it('leaves any comment opening with a third slash as written', () => {
    expect(lintRule('///note\n', commentSpace)).toEqual([]);
  });

  it('accepts a decorative // banner (only slashes after //)', () => {
    const diagnostics = lintRule('//////////////////\n', commentSpace);

    expect(diagnostics).toEqual([]);
  });

  it('accepts a tab after //', () => {
    const diagnostics = lintRule('//\tfoo\n', commentSpace);

    expect(diagnostics).toEqual([]);
  });

  it('flags a block comment with no space after /*', () => {
    const diagnostics = lintRule('/*foo */\n', commentSpace);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toBe("Expected a space after '/*'.");
  });

  it('flags a block comment with no space before */', () => {
    const diagnostics = lintRule('/* foo*/\n', commentSpace);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toBe("Expected a space before '*/'.");
  });

  it('flags both sides of a fully tight block comment', () => {
    const diagnostics = lintRule('/*foo*/\n', commentSpace);

    expect(diagnostics).toHaveLength(2);
    expect(diagnostics.map((d) => d.message)).toEqual([
      "Expected a space after '/*'.",
      "Expected a space before '*/'.",
    ]);
  });

  it('accepts an empty block comment', () => {
    const diagnostics = lintRule('/**/\n', commentSpace);

    expect(diagnostics).toEqual([]);
  });

  it('accepts a decorative /*** banner (only asterisks inside)', () => {
    const diagnostics = lintRule('/****/\n', commentSpace);

    expect(diagnostics).toEqual([]);
  });

  it('accepts a multi-line block comment that opens with a newline', () => {
    const diagnostics = lintRule('/*\n * doc\n */\n', commentSpace);

    expect(diagnostics).toEqual([]);
  });

  it('does not look inside string literals', () => {
    const diagnostics = lintRule("LET vMsg = '//foo';\n", commentSpace);

    expect(diagnostics).toEqual([]);
  });

  it('does not flag comments hidden inside a Trace body', () => {
    const diagnostics = lintRule('Trace this //is just a message;\n', commentSpace);

    expect(diagnostics).toEqual([]);
  });

  it('autofixes a line comment by inserting a single space after //', () => {
    const result = formatRule('//foo\n', commentSpace);

    expect(result.output).toBe('// foo\n');
    expect(result.fixed).toBe(1);
    expect(result.diagnostics).toEqual([]);
  });

  it('autofixes both sides of a tight block comment', () => {
    const result = formatRule('/*foo*/\n', commentSpace);

    expect(result.output).toBe('/* foo */\n');
    expect(result.fixed).toBe(2);
    expect(result.diagnostics).toEqual([]);
  });

  it('autofixes a block comment that only misses the trailing space', () => {
    const result = formatRule('/* foo*/\n', commentSpace);

    expect(result.output).toBe('/* foo */\n');
    expect(result.fixed).toBe(1);
  });

  it('autofixes a multi-comment source in a single format pass', () => {
    const source = '//foo\n/*bar*/\n';

    const result = formatRule(source, commentSpace);

    expect(result.output).toBe('// foo\n/* bar */\n');
    expect(result.fixed).toBe(3);
  });
});
