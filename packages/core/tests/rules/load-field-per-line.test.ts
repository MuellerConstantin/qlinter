import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatRule, formatRules, lintRule } from '../support.js';
import { loadFieldPerLine } from '../../src/rules/index.js';
import { lintFixture } from './helpers.js';

const FIXTURES = join(import.meta.dirname, 'fixtures');

function readFixture(kind: 'violation' | 'clean'): string {
  return readFileSync(join(FIXTURES, 'load-field-per-line', `${kind}.qvs`), 'utf8');
}

describe('load-field-per-line', () => {
  it('does not flag any clean LOAD shape', () => {
    const diagnostics = lintFixture('clean', loadFieldPerLine);

    expect(diagnostics).toEqual([]);
  });

  it('flags every field that does not start its own line', () => {
    const diagnostics = lintFixture('violation', loadFieldPerLine);

    expect(diagnostics.map((d) => d.range.start.line)).toEqual([2, 2, 2, 6, 11, 11, 18, 23, 23, 33, 38, 38, 38, 38]);
    for (const d of diagnostics) {
      expect(d.ruleId).toBe('load-field-per-line');
      expect(d.severity).toBe('warning');
      expect(d.fix).toBeDefined();
      expect(d.message).toContain('own line');
    }
  });

  it('autofix moves every field onto its own line', () => {
    const source = '[A]: Load Id, Name, Total From X;';

    const result = formatRule(source, loadFieldPerLine);

    expect(result.output).toBe('[A]: Load\nId,\nName,\nTotal From X;');
    expect(result.diagnostics).toEqual([]);
    expect(result.fixed).toBe(3);
  });

  it('preserves a block comment that sits between the previous token and the field', () => {
    const source = '[A]: Load /* keep me */ Id From X;';

    const result = formatRule(source, loadFieldPerLine);

    expect(result.output).toBe('[A]: Load /* keep me */\nId From X;');
  });

  it('ignores commas nested inside parentheses', () => {
    const source = [
      '[A]:',
      'Load',
      '\tId,',
      "\tIf(Status = 'A', 1, 0) as Flag,",
      '\tConcat(Name, ", ") as Names',
      'From X;',
    ].join('\n');

    const diagnostics = lintRule(source, loadFieldPerLine);

    expect(diagnostics).toEqual([]);
  });

  it('ignores Group By and Order By comma lists (commas after the clause boundary)', () => {
    const source = [
      '[A]:',
      'Load',
      '\tRegion,',
      '\tCountry',
      'Resident Sales',
      'Group By Region, Country',
      'Order By Region, Country desc;',
    ].join('\n');

    const diagnostics = lintRule(source, loadFieldPerLine);

    expect(diagnostics).toEqual([]);
  });

  /*
   * The wildcard is a field like any other. It used to be exempt when it was
   * the whole field list, which left `Load *` and `Load Id` — the same shape —
   * formatted two different ways, and left the `*` line unowned by this rule
   * for `continuation-indent` to pick up.
   */
  it('breaks a lone wildcard onto its own line', () => {
    const source = '[A]: Load * From X;';

    const diagnostics = lintRule(source, loadFieldPerLine);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain('own line');
  });

  it('breaks a lone wildcard off a Distinct header too', () => {
    const source = '[A]: Load Distinct * From X;';

    const diagnostics = lintRule(source, loadFieldPerLine);

    expect(diagnostics).toHaveLength(1);
  });

  it('treats a wildcard combined with real fields as a regular field', () => {
    const source = '[A]: Load *, Field1 From X;';

    const diagnostics = lintRule(source, loadFieldPerLine);

    expect(diagnostics).toHaveLength(2);
    expect(diagnostics[0].message).toContain('own line');
  });

  it('does not flag statements that contain no LOAD keyword', () => {
    const source = 'SQL Select Id, Name From dbo.X;';

    const diagnostics = lintRule(source, loadFieldPerLine);

    expect(diagnostics).toEqual([]);
  });

  it('checks each LOAD statement independently when several share a line', () => {
    const source = '[A]: Load A, B From X; [B]: Load C, D Resident A;';

    const diagnostics = lintRule(source, loadFieldPerLine);

    expect(diagnostics).toHaveLength(4);
  });

  it('autofix on the full violation fixture converges with no remaining findings', () => {
    const result = formatRule(readFixture('violation'), loadFieldPerLine);

    expect(result.diagnostics).toEqual([]);
    expect(result.fixed).toBe(14);
  });

  /*
   * CRLF coverage lives in inline sources rather than a fixture: `core.autocrlf`
   * decides what a checked-out `.qvs` actually holds, so a committed CRLF
   * fixture would assert something different on each machine.
   */
  it('breaks fields apart with CRLF in a CRLF script', () => {
    const result = formatRule('LOAD A, B\r\nFROM [lib://x/y.qvd];\r\n', loadFieldPerLine);

    expect(result.output).toBe('LOAD\r\nA,\r\nB\r\nFROM [lib://x/y.qvd];\r\n');
    expect(result.output).not.toMatch(/(?<!\r)\n/);
  });

  it('composes with load-clause-newline so a fully jammed LOAD breaks down cleanly', async () => {
    const { loadClauseNewline } = await import('../../src/rules/index.js');
    const source = '[A]: Load Id, Name From X Where Active = 1 Order By Id;';

    const result = formatRules(source, [loadFieldPerLine, loadClauseNewline]);

    expect(result.output).toBe('[A]: Load\nId,\nName\nFrom X\nWhere Active = 1\nOrder By Id;');
    expect(result.diagnostics).toEqual([]);
  });
});
