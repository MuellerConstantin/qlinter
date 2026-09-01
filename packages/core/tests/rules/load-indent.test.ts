import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatRule, formatRules, lintRule } from '../support.js';
import { loadClauseNewline, loadFieldPerLine, loadIndent } from '../../src/rules/index.js';
import { lintFixture } from './helpers.js';

const FIXTURES = join(import.meta.dirname, 'fixtures');

function readFixture(kind: 'violation' | 'clean'): string {
  return readFileSync(join(FIXTURES, 'load-indent', `${kind}.qvs`), 'utf8');
}

describe('load-indent', () => {
  it('does not flag any clean LOAD shape', () => {
    const diagnostics = lintFixture('clean', loadIndent);

    expect(diagnostics).toEqual([]);
  });

  it('flags every misindented header-, field- and clause-start line', () => {
    const diagnostics = lintFixture('violation', loadIndent);

    expect(diagnostics.map((d) => d.range.start.line)).toEqual([4, 10, 17, 23, 25, 32, 33, 39, 46, 47]);
    for (const d of diagnostics) {
      expect(d.ruleId).toBe('load-indent');
      expect(d.severity).toBe('warning');
      expect(d.fix).toBeDefined();
      expect(d.message).toMatch(/Expected \d+ (tab|space)s? of indentation/);
    }
  });

  it('autofix rewrites leading whitespace to the expected width', () => {
    const source = ['[A]:', 'Load', 'Id,', '\t\tName', 'From X;'].join('\n');

    const result = formatRule(source, loadIndent);

    expect(result.output).toBe(['[A]:', 'Load', '    Id,', '    Name', 'From X;'].join('\n'));
    expect(result.diagnostics).toEqual([]);
    expect(result.fixed).toBe(2);
  });

  it('skips field tokens that share a line with the previous token', () => {
    const source = '[A]: Load Id, Name From X;';

    const diagnostics = lintRule(source, loadIndent);

    expect(diagnostics).toEqual([]);
  });

  it('does not touch continuation lines inside a multi-line field expression', () => {
    const source = ['[A]:', 'Load', '    Sum(', 'x', '    ) as Total', 'From X;'].join('\n');

    const diagnostics = lintRule(source, loadIndent);

    expect(diagnostics).toEqual([]);
  });

  /*
   * The wildcard is indented like any other field. While it was exempt here,
   * nothing owned its line and `continuation-indent` claimed it — the two rules
   * happened to agree on one step, so the gap stayed invisible.
   */
  it('indents a lone wildcard like a field', () => {
    const source = ['[A]:', 'Load', '*', 'From X;'].join('\n');

    const result = formatRule(source, loadIndent);

    expect(result.output).toBe(['[A]:', 'Load', '    *', 'From X;'].join('\n'));
    expect(result.diagnostics).toEqual([]);
  });

  it('inherits the enclosing indent when the LOAD sits inside a Sub', () => {
    const source = ['Sub foo', '    [A]:', '    Load', '        Id', '    From X;', 'End Sub'].join('\n');

    const diagnostics = lintRule(source, loadIndent);

    expect(diagnostics).toEqual([]);
  });

  /*
   * The base comes from the line that opens the statement, never from the
   * `Load` line itself — a misindented `Load` would otherwise drag the whole
   * field list sideways with it instead of being pulled back into line.
   */
  it('bases indent on the statement-start line, not on the LOAD line it precedes', () => {
    const source = [
      '    Left Join([M]) IntervalMatch (Stichtag, PERNR)',
      '  Load',
      'BEGDA,',
      'PERNR',
      '            Resident [Src];',
    ].join('\n');

    const result = formatRule(source, loadIndent);

    expect(result.output).toBe(
      [
        '    Left Join([M]) IntervalMatch (Stichtag, PERNR)',
        '    Load',
        '        BEGDA,',
        '        PERNR',
        '    Resident [Src];',
      ].join('\n'),
    );
    expect(result.diagnostics).toEqual([]);
  });

  it('pins a torn-apart header to the statement indent instead of one level in', () => {
    const source = ['[MyTable]:', 'Left Join(X)', '        Load', '        Distinct', 'A', 'Resident Z;'].join('\n');

    const result = formatRule(source, loadIndent);

    expect(result.output).toBe(['[MyTable]:', 'Left Join(X)', 'Load', 'Distinct', '    A', 'Resident Z;'].join('\n'));
    expect(result.diagnostics).toEqual([]);
    expect(result.fixed).toBe(3);
  });

  /*
   * The opening line of the statement is block-indent's; load-indent measures
   * from it but must never report it, or the two rules would flag it twice.
   */
  it('never reports the statement-opening line itself', () => {
    const source = ['[MyTable]:', '  Left Join(X)', 'Load', '    A', 'Resident Z;'].join('\n');

    const diagnostics = lintRule(source, loadIndent);

    expect(diagnostics.map((d) => d.range.start.line)).toEqual([3, 4, 5]);
  });

  /*
   * A prefix whose argument list is wrapped is a genuine continuation of an
   * expression, not a header line — claiming it here would fight
   * continuation-indent, which hangs it one level off the opening line.
   */
  it('does not claim a wrapped prefix argument list as a header line', () => {
    const source = ['[Tree]:', 'Hierarchy(NodeId, ParentId,', '    NodeName)', 'Load', '    NodeId', 'From X;'].join(
      '\n',
    );

    const diagnostics = lintRule(source, loadIndent);

    expect(diagnostics).toEqual([]);
  });

  it('inherits the enclosing indent for header lines of a LOAD inside a Sub', () => {
    const source = ['Sub s', '    Left Join(X)', 'Load', '        A', '    Resident Z;', 'End Sub'].join('\n');

    const result = formatRule(source, loadIndent);

    expect(result.output).toBe(
      ['Sub s', '    Left Join(X)', '    Load', '        A', '    Resident Z;', 'End Sub'].join('\n'),
    );
    expect(result.diagnostics).toEqual([]);
  });

  it('treats a correctly-indented continuation LOAD as clean', () => {
    const source = [
      '    Left Join([M]) IntervalMatch (K)',
      '    Load',
      '        A,',
      '        B',
      '    Resident [Src];',
    ].join('\n');

    const diagnostics = lintRule(source, loadIndent);

    expect(diagnostics).toEqual([]);
  });

  it('does not flag statements that contain no LOAD keyword', () => {
    const source = 'SQL Select Id, Name From dbo.X;';

    const diagnostics = lintRule(source, loadIndent);

    expect(diagnostics).toEqual([]);
  });

  it('honors a custom space-based style', () => {
    const source = ['[A]:', 'Load', '    Id', 'From X;'].join('\n');

    const diagnostics = lintRule(source, loadIndent, { style: 'space', size: 4 });

    expect(diagnostics).toEqual([]);
  });

  it('autofixes tab indentation to spaces under a custom space-based style', () => {
    const source = ['[A]:', 'Load', '\tId', 'From X;'].join('\n');

    const result = formatRule(source, loadIndent, { style: 'space', size: 2 });

    expect(result.output).toBe(['[A]:', 'Load', '  Id', 'From X;'].join('\n'));
  });

  it('autofix on the full violation fixture converges with no remaining findings', () => {
    const result = formatRule(readFixture('violation'), loadIndent);

    expect(result.diagnostics).toEqual([]);
    expect(result.fixed).toBe(10);
  });

  it('emits a non-empty range even when the misindented line has no leading whitespace', () => {
    const source = ['[A]:', 'Load', 'X,', 'Y', 'Resident B;'].join('\n');

    const diagnostics = lintRule(source, loadIndent);

    expect(diagnostics).toHaveLength(2);
    for (const d of diagnostics) {
      expect(d.range.end.column).toBeGreaterThan(d.range.start.column);
    }
  });

  it('flags a field whose indent width is right but uses tabs under the space style', () => {
    const source = ['[A]:', 'Load', '\t\t\t\tId', 'From X;'].join('\n');

    const diagnostics = lintRule(source, loadIndent);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].range.start.line).toBe(3);
    expect(diagnostics[0].message).toMatch(/use spaces/);
  });

  it('autofixes right-width tab indentation on a field to the configured spaces', () => {
    const source = ['[A]:', 'Load', '\t\t\t\tId', 'From X;'].join('\n');

    const result = formatRule(source, loadIndent);

    expect(result.output).toBe(['[A]:', 'Load', '    Id', 'From X;'].join('\n'));
    expect(result.diagnostics).toEqual([]);
    expect(result.fixed).toBe(1);
  });

  it('composes with load-field-per-line and load-clause-newline to break down a fully jammed LOAD', () => {
    const source = '[A]: Load Id, Name From X Where Active = 1 Order By Id;';

    const result = formatRules(source, [loadFieldPerLine, loadClauseNewline, loadIndent]);

    expect(result.output).toBe(
      ['[A]: Load', '    Id,', '    Name', 'From X', 'Where Active = 1', 'Order By Id;'].join('\n'),
    );
    expect(result.diagnostics).toEqual([]);
  });

  it('indents a field line by the comment opening it rather than dropping the comment', () => {
    const result = formatRule('Load\n/* why */ A,\n    B\nFrom [lib://x/y.qvd];\n', loadIndent);

    expect(result.output).toBe('Load\n    /* why */ A,\n    B\nFrom [lib://x/y.qvd];\n');
    expect(result.fixed).toBe(1);
    expect(result.diagnostics).toEqual([]);
  });
});
