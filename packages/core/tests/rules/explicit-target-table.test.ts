import { describe, expect, it } from 'vitest';
import { explicitTargetTable } from '../../src/rules/index.js';
import { lintFixture } from './helpers.js';

describe('explicit-target-table', () => {
  it('flags every prefix that names no target table', () => {
    const diagnostics = lintFixture('violation', explicitTargetTable);

    expect(diagnostics).toHaveLength(3);
    expect(diagnostics[0]).toMatchObject({
      ruleId: 'explicit-target-table',
      severity: 'warning',
      range: { start: { line: 4, column: 1 }, end: { line: 4, column: 12 } },
    });
    expect(diagnostics[0].message).toContain("'Concatenate'");
    expect(diagnostics[1]).toMatchObject({ range: { start: { line: 7, column: 6 } } });
    expect(diagnostics[2]).toMatchObject({ range: { start: { line: 13, column: 7 } } });
  });

  it('does not offer an autofix', () => {
    const diagnostics = lintFixture('violation', explicitTargetTable);

    for (const diagnostic of diagnostics) {
      expect(diagnostic.fix).toBeUndefined();
    }
  });

  it('does not flag the clean fixture', () => {
    expect(lintFixture('clean', explicitTargetTable)).toEqual([]);
  });
});
