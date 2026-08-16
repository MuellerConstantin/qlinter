import { describe, expect, it } from 'vitest';
import { format } from '../../src/index.js';
import { includeNoSpaces, recommended } from '../../src/rules/index.js';
import { lintFixture } from './helpers.js';
import { formatRule, lintRule } from '../support.js';

describe('include-no-spaces', () => {
  it('flags spaced include expansions in the violation fixture', () => {
    const diagnostics = lintFixture('violation', includeNoSpaces);

    expect(diagnostics).toHaveLength(6);
    for (const d of diagnostics) {
      expect(d.ruleId).toBe('include-no-spaces');
      expect(d.severity).toBe('error');
    }
  });

  it('does not flag the clean fixture', () => {
    const diagnostics = lintFixture('clean', includeNoSpaces);

    expect(diagnostics).toEqual([]);
  });

  it('flags a space on each side separately', () => {
    const diagnostics = lintRule('$(Must_Include = abc.txt);\n', includeNoSpaces);

    expect(diagnostics).toHaveLength(2);
    expect(diagnostics[0].message).toContain("space before the '='");
    expect(diagnostics[1].message).toContain("space after the '='");
  });

  it('points at the offending whitespace, not the whole expansion', () => {
    const diagnostics = lintRule('$(Include = abc.txt);\n', includeNoSpaces);

    // `$(Include` is 9 characters, so the space before `=` is column 10.
    expect(diagnostics[0].range).toEqual({ start: { line: 1, column: 10 }, end: { line: 1, column: 11 } });
    expect(diagnostics[1].range).toEqual({ start: { line: 1, column: 12 }, end: { line: 1, column: 13 } });
  });

  it('reports the right line for an expansion further down the script', () => {
    const diagnostics = lintRule("SET vX = 1;\n\n$(Include= abc.txt);\n", includeNoSpaces);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].range.start.line).toBe(3);
  });

  it('leaves a $(= …) evaluation expansion alone', () => {
    const diagnostics = lintRule('LET vEval = $(=Max(OrderDate));\n', includeNoSpaces);

    expect(diagnostics).toEqual([]);
  });

  it('autofixes both sides in one pass', () => {
    const result = formatRule('$(Must_Include = [lib://DataFiles/abc.qvs]);\n', includeNoSpaces);

    expect(result.output).toBe('$(Must_Include=[lib://DataFiles/abc.qvs]);\n');
    expect(result.fixed).toBe(2);
    expect(result.diagnostics).toEqual([]);
  });

  it('collapses a run of whitespace on either side', () => {
    const result = formatRule('$(Include  =\tabc.txt);\n', includeNoSpaces);

    expect(result.output).toBe('$(Include=abc.txt);\n');
    expect(result.fixed).toBe(2);
  });

  it('preserves spaces inside the include target', () => {
    const result = formatRule('$(Must_Include = [lib://Data Files/my helpers.qvs]);\n', includeNoSpaces);

    expect(result.output).toBe('$(Must_Include=[lib://Data Files/my helpers.qvs]);\n');
  });

  it('converges under the full recommended preset', () => {
    const result = format('$(Must_Include = [lib://DataFiles/abc.qvs]);\n', recommended);

    expect(result.output).toBe('$(Must_Include=[lib://DataFiles/abc.qvs]);\n');
    expect(result.diagnostics).toEqual([]);
  });
});
