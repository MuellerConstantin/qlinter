import { describe, expect, it } from 'vitest';
import { blockIndent, continuationIndent, loadIndent, multilineCall } from '../../src/rules/index.js';
import { lintFixture } from './helpers.js';
import { formatRule, formatRules, lintRule } from '../support.js';

describe('continuation-indent', () => {
  it('flags misindented continuation lines in the violation fixture', () => {
    const diagnostics = lintFixture('violation', continuationIndent);

    expect(diagnostics.map((d) => d.range.start.line)).toEqual([6, 12, 13]);
    for (const d of diagnostics) {
      expect(d.ruleId).toBe('continuation-indent');
      expect(d.severity).toBe('warning');
    }
  });

  it('does not flag the clean fixture', () => {
    const diagnostics = lintFixture('clean', continuationIndent);

    expect(diagnostics).toEqual([]);
  });

  it('autofixes a continuation line that block-indent and load-indent leave alone', () => {
    const source = ['[A]:', 'Load', '    Total', '\t\t& Region', 'From X;'].join('\n');

    const result = formatRule(source, continuationIndent);

    expect(result.output).toBe(['[A]:', 'Load', '    Total', '        & Region', 'From X;'].join('\n'));
    expect(result.fixed).toBeGreaterThan(0);
    expect(result.diagnostics).toEqual([]);
  });

  it('adds one level per open parenthesis instead of flattening nesting', () => {
    const source = ['Let vFlag = If(A = 1,', 'If(B = 2,', '1,', '2),', '0);'].join('\n');

    const result = formatRule(source, continuationIndent);

    expect(result.output).toBe(
      ['Let vFlag = If(A = 1,', '    If(B = 2,', '        1,', '        2),', '    0);'].join('\n'),
    );
  });

  it('dedents a line that starts with a closing parenthesis back under its anchor', () => {
    const source = ["Let vName = ApplyMap('MapX',", '        Region', '        );'].join('\n');

    const result = formatRule(source, continuationIndent);

    expect(result.output).toBe(["Let vName = ApplyMap('MapX',", '    Region', ');'].join('\n'));
  });

  it('hangs an unparenthesized continuation one level off its clause', () => {
    const source = ['[A]:', 'Load', '    Id', 'From X', 'Where Id > 0', 'And Id < 10;'].join('\n');

    const diagnostics = lintRule(source, continuationIndent);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].range.start.line).toBe(6);
    expect(diagnostics[0].message).toMatch(/Expected 4 spaces of indentation but got 0\./);
  });

  it('does not reach inside a multi-line Inline data block', () => {
    const source = ['[A]:', 'Load * Inline [', '\ta, b', '\t1, 2', '];'].join('\n');

    const diagnostics = lintRule(source, continuationIndent);

    expect(diagnostics).toEqual([]);
  });

  it('does not check the indentation of comment-only lines', () => {
    const source = [
      '[A]:',
      'Load',
      '    Total',
      '\t// a tab-indented standalone comment',
      '        & Region',
      'From X;',
    ].join('\n');

    const diagnostics = lintRule(source, continuationIndent);

    expect(diagnostics).toEqual([]);
  });

  it('leaves statement starts and Load field/clause lines to their owning rules', () => {
    const source = ['Sub greet', '\tTrace hello;', 'End Sub'].join('\n');

    const diagnostics = lintRule(source, continuationIndent);

    expect(diagnostics).toEqual([]);
  });

  /*
   * A prefix torn off its `Load` is a statement head split across lines, not a
   * wrapped expression. Indenting the `Load` would put it at the same column as
   * the fields it introduces; those lines belong to load-indent at `base`.
   */
  it('does not claim the Load line of a prefixed statement', () => {
    const source = ['[MyTable]:', 'Left Join(X)', 'Load', '    A', 'Resident Z;'].join('\n');

    const diagnostics = lintRule(source, continuationIndent);

    expect(diagnostics).toEqual([]);
  });

  it('does not claim a Distinct or NoConcatenate broken onto its own line', () => {
    const source = ['[MyTable]:', 'NoConcatenate', 'Load', 'Distinct', '    A', 'Resident Z;'].join('\n');

    const diagnostics = lintRule(source, continuationIndent);

    expect(diagnostics).toEqual([]);
  });

  it('still hangs a wrapped prefix argument list one level off the opening line', () => {
    const source = ['[Tree]:', 'Hierarchy(NodeId, ParentId,', 'NodeName)', 'Load', '    NodeId', 'From X;'].join('\n');

    const result = formatRule(source, continuationIndent);

    expect(result.output).toBe(
      ['[Tree]:', 'Hierarchy(NodeId, ParentId,', '    NodeName)', 'Load', '    NodeId', 'From X;'].join('\n'),
    );
    expect(result.diagnostics).toEqual([]);
  });

  /*
   * The bug this split fixes: continuation-indent used to own the torn-apart
   * header and push `Load` to base + one step, landing it on the same column as
   * its own field list. Both rules together must leave the shape alone.
   */
  it('agrees with load-indent on a torn-apart header', () => {
    const source = ['[MyTable]:', 'Left Join(X)', 'Load', 'Distinct', '    A', 'Resident Z;', ''].join('\n');

    const result = formatRules(source, [blockIndent, continuationIndent, loadIndent]);

    expect(result.output).toBe(source);
    expect(result.diagnostics).toEqual([]);
  });

  describe('style option', () => {
    it('accepts tab-indented continuation lines under the tab style', () => {
      const source = ['[A]:', 'Load', '\tTotal', '\t\t& Region', 'From X;'].join('\n');

      const diagnostics = lintRule(source, continuationIndent, { style: 'tab' });

      expect(diagnostics).toEqual([]);
    });

    it('rewrites a space-indented continuation line to tabs', () => {
      const source = ['[A]:', 'Load', '\tTotal', '        & Region', 'From X;'].join('\n');

      const result = formatRule(source, continuationIndent, { style: 'tab' });

      expect(result.output).toBe(['[A]:', 'Load', '\tTotal', '\t\t& Region', 'From X;'].join('\n'));
      expect(result.diagnostics).toEqual([]);
    });
  });

  /*
   * multiline-call breaks an over-long call apart and picks the indentation of
   * the lines it creates. If the two rules disagreed on that shape they would
   * rewrite each other every pass and the autofix loop would never converge.
   */
  it('agrees with the shape multiline-call emits', () => {
    const source = [
      'Sub Wrap',
      "Let vX = Interval(Num(Round(SomethingVeryLongIndeedAndThenSome, 0.01), '#,##0.00'), 'hh:mm:ss', ExtraArgument, YetAnotherOne, AndMore);",
      'End Sub',
      '',
    ].join('\n');

    const result = formatRules(source, [continuationIndent, blockIndent, multilineCall]);

    expect(result.output).toBe(
      [
        'Sub Wrap',
        '    Let vX = Interval(',
        "        Num(Round(SomethingVeryLongIndeedAndThenSome, 0.01), '#,##0.00'),",
        "        'hh:mm:ss',",
        '        ExtraArgument,',
        '        YetAnotherOne,',
        '        AndMore',
        '    );',
        'End Sub',
        '',
      ].join('\n'),
    );
    expect(result.diagnostics.filter((d) => d.fix)).toEqual([]);
  });

  describe('size option', () => {
    it('uses the configured level width', () => {
      const source = ['[A]:', 'Load', '  Total', '& Region', 'From X;'].join('\n');

      const result = formatRule(source, continuationIndent, { size: 2 });

      expect(result.output).toBe(['[A]:', 'Load', '  Total', '    & Region', 'From X;'].join('\n'));
    });
  });

  it('indents a continuation line by the comment opening it rather than dropping the comment', () => {
    const result = formatRule('Let x = RangeSum(\n/* why */ 1,\n    2\n);\n', continuationIndent);

    expect(result.output).toBe('Let x = RangeSum(\n    /* why */ 1,\n    2\n);\n');
    expect(result.fixed).toBe(1);
    expect(result.diagnostics).toEqual([]);
  });
});
