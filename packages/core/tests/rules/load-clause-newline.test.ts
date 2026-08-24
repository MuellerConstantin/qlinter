import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatRule, lintRule } from '../support.js';
import { loadClauseNewline } from '../../src/rules/index.js';
import { lintFixture } from './helpers.js';

const FIXTURES = join(import.meta.dirname, 'fixtures');

function readFixture(kind: 'violation' | 'clean'): string {
  return readFileSync(join(FIXTURES, 'load-clause-newline', `${kind}.qvs`), 'utf8');
}

describe('load-clause-newline', () => {
  it('does not flag any clean LOAD shape', () => {
    const diagnostics = lintFixture('clean', loadClauseNewline);

    expect(diagnostics).toEqual([]);
  });

  it('flags every top-level clause that does not start its own line', () => {
    const diagnostics = lintFixture('violation', loadClauseNewline);

    expect(diagnostics.map((d) => d.range.start.line)).toEqual([2, 2, 2, 7, 13, 13, 21, 24, 24, 28, 32, 39, 45]);
    for (const d of diagnostics) {
      expect(d.ruleId).toBe('load-clause-newline');
      expect(d.severity).toBe('warning');
      expect(d.fix).toBeDefined();
    }
  });

  it('autofix moves each offending clause keyword onto its own line', () => {
    const source = '[A]: Load Id, Name From [lib://x.qvd] (qvd) Where Active = 1 Order By Id;';

    const result = formatRule(source, loadClauseNewline);

    expect(result.output).toBe('[A]: Load Id, Name\nFrom [lib://x.qvd] (qvd)\nWhere Active = 1\nOrder By Id;');
    expect(result.diagnostics).toEqual([]);
    expect(result.fixed).toBe(3);
  });

  it('preserves a block comment that sits between the previous token and the clause keyword', () => {
    const source = '[A]: Load Id /* keep me */ From [lib://x.qvd] (qvd);';

    const result = formatRule(source, loadClauseNewline);

    expect(result.output).toBe('[A]: Load Id /* keep me */\nFrom [lib://x.qvd] (qvd);');
  });

  it('ignores clause-shaped keywords nested inside parentheses', () => {
    const source = [
      '[A]:',
      'Load',
      '\tConcat(Distinct CustomerId) as Customers,',
      '\tIf(Where = 1, 1, 0) as Flag',
      'From [lib://x.qvd] (qvd)',
      'Where Active = 1;',
    ].join('\n');

    const diagnostics = lintRule(source, loadClauseNewline);

    expect(diagnostics).toEqual([]);
  });

  it('does not flag statements that contain no LOAD keyword', () => {
    const source = 'SQL Select Id From dbo.X Where Active = 1 Order By Id;';

    const diagnostics = lintRule(source, loadClauseNewline);

    expect(diagnostics).toEqual([]);
  });

  it('treats the table-label line as separate from the LOAD body when they share a line', () => {
    const source = '[A]: Load Id From [lib://x.qvd] (qvd);';

    const diagnostics = lintRule(source, loadClauseNewline);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      ruleId: 'load-clause-newline',
      range: { start: { line: 1 } },
    });
    expect(diagnostics[0].message).toContain("'From'");
  });

  it('checks each LOAD statement independently when several share a line', () => {
    const source = '[A]: Load Id From X; [B]: Load Id Resident A;';

    const diagnostics = lintRule(source, loadClauseNewline);

    expect(diagnostics).toHaveLength(2);
    expect(diagnostics.map((d) => d.message)).toEqual([
      expect.stringContaining("'From'"),
      expect.stringContaining("'Resident'"),
    ]);
  });

  it('flags Group and Order independently of the trailing By', () => {
    const source = [
      '[A]:',
      'Load',
      '\tRegion,',
      '\tSum(Amount) as Total',
      'Resident X Where Active = 1 Group By Region Order By Total;',
    ].join('\n');

    const diagnostics = lintRule(source, loadClauseNewline);

    expect(diagnostics.map((d) => d.message)).toEqual([
      expect.stringContaining("'Where'"),
      expect.stringContaining("'Group'"),
      expect.stringContaining("'Order'"),
    ]);
  });

  it('autofix on the full violation fixture converges with no remaining findings', () => {
    const result = formatRule(readFixture('violation'), loadClauseNewline);

    expect(result.diagnostics).toEqual([]);
    expect(result.fixed).toBe(13);
  });

  /*
   * CRLF coverage lives in inline sources rather than a fixture: `core.autocrlf`
   * decides what a checked-out `.qvs` actually holds, so a committed CRLF
   * fixture would assert something different on each machine.
   */
  it('starts a clause with CRLF in a CRLF script', () => {
    const result = formatRule('Load Id From X Where Active = 1;\r\n', loadClauseNewline);

    expect(result.output).toBe('Load Id\r\nFrom X\r\nWhere Active = 1;\r\n');
    expect(result.output).not.toMatch(/(?<!\r)\n/);
  });
});
