import { describe, expect, it } from 'vitest';
import { noErrorModeZero } from '../../src/rules/index.js';
import { lintFixture } from './helpers.js';
import { lintRule } from '../support.js';

describe('no-error-mode-zero', () => {
  it('flags every assignment that may turn error handling off', () => {
    const diagnostics = lintFixture('violation', noErrorModeZero);

    expect(diagnostics).toHaveLength(3);
    expect(diagnostics[0]).toMatchObject({
      ruleId: 'no-error-mode-zero',
      severity: 'error',
      range: { start: { line: 1, column: 5 }, end: { line: 1, column: 18 } },
    });
    expect(diagnostics[0].message).toContain("'ErrorMode = 0'");
    expect(diagnostics[1].range.start.line).toBe(9);
    expect(diagnostics[1].message).toContain('not provably 1 or 2');
    expect(diagnostics[2].range.start.line).toBe(11);
    expect(diagnostics[2].message).toContain("'ErrorMode = 0'");
  });

  it('does not offer an autofix', () => {
    const diagnostics = lintFixture('violation', noErrorModeZero);

    for (const diagnostic of diagnostics) {
      expect(diagnostic.fix).toBeUndefined();
    }
  });

  it('does not flag the clean fixture', () => {
    expect(lintFixture('clean', noErrorModeZero)).toEqual([]);
  });

  it('flags a zero set again after a later reset', () => {
    const diagnostics = lintRule(
      'Set ErrorMode = 0;\nLoad 1 as X AutoGenerate 1;\nSet ErrorMode = 1;\n',
      noErrorModeZero,
    );

    expect(diagnostics).toHaveLength(1);
  });

  it('flags a zero set inside a single-line If', () => {
    const diagnostics = lintRule('If 1 = 1 Then Let ErrorMode = 0; End If\n', noErrorModeZero);

    expect(diagnostics).toHaveLength(1);
  });

  it('matches the name in any case', () => {
    const diagnostics = lintRule('set errormode=0;\n', noErrorModeZero);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain("'errormode = 0'");
  });

  it('flags a quoted zero as unverifiable', () => {
    const diagnostics = lintRule("Set ErrorMode = '0';\n", noErrorModeZero);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain('not provably 1 or 2');
  });
});
