import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatRule, lintRule } from '../support.js';
import { oneStatementPerLine } from '../../src/rules/index.js';
import { lintFixture } from './helpers.js';

const FIXTURES = join(import.meta.dirname, 'fixtures');

function readFixture(kind: 'violation' | 'clean'): string {
  return readFileSync(join(FIXTURES, 'one-statement-per-line', `${kind}.qvs`), 'utf8');
}

describe('one-statement-per-line', () => {
  /*
   * Regression: the `;` closing a Trace statement lexes as TraceEnd and carries
   * Semicolon only as a category, so an identity check on the token type let a
   * statement following a Trace on the same line pass unflagged.
   */
  it('flags a statement that follows a Trace on the same line', () => {
    const diagnostics = lintRule('Trace loading; Let x = 1;\n', oneStatementPerLine);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ ruleId: 'one-statement-per-line', severity: 'warning' });
  });

  it('autofixes a statement that follows a Trace on the same line', () => {
    const result = formatRule('Trace loading; Let x = 1;\n', oneStatementPerLine);

    expect(result.output).toBe('Trace loading;\nLet x = 1;\n');
  });

  it('flags two statements separated by a semicolon on the same line', () => {
    const diagnostics = lintFixture('violation', oneStatementPerLine);

    expect(diagnostics).toHaveLength(2);
    expect(diagnostics[0]).toMatchObject({
      ruleId: 'one-statement-per-line',
      severity: 'warning',
      range: { start: { line: 1, column: 19 } },
    });
    expect(diagnostics[1]).toMatchObject({
      ruleId: 'one-statement-per-line',
      severity: 'warning',
      range: { start: { line: 7, column: 20 } },
    });
    expect(diagnostics[1].message).toContain('own line');
  });

  it('does not flag multi-line LOAD bodies, trailing comments, or implicitly terminated blocks', () => {
    const diagnostics = lintFixture('clean', oneStatementPerLine);

    expect(diagnostics).toEqual([]);
  });

  it('rewrites a violation by splitting the second statement onto a new line', () => {
    const violation = readFixture('violation');

    const result = formatRule(violation, oneStatementPerLine);

    expect(result.output).toContain('SET vYear = 2026;\nLET vMonth = 6;');
    expect(result.output).toContain('Resident [Source];\nSET vDone = 1;');
    expect(result.diagnostics).toEqual([]);
    expect(result.fixed).toBe(2);
  });

  it('uses LF newlines by default when the source has no CRLF', () => {
    const result = formatRule('SET x = 1; SET y = 2;\n', oneStatementPerLine);

    expect(result.output).toBe('SET x = 1;\nSET y = 2;\n');
  });

  it('auto-detects CRLF when the source uses CRLF line endings', () => {
    const result = formatRule('SET x = 1; SET y = 2;\r\n', oneStatementPerLine);

    expect(result.output).toBe('SET x = 1;\r\nSET y = 2;\r\n');
  });

  it('honors an explicit lineEnding override', () => {
    const result = formatRule('SET x = 1; SET y = 2;\n', oneStatementPerLine, { lineEnding: 'crlf' });

    expect(result.output).toBe('SET x = 1;\r\nSET y = 2;\n');
  });

  it('produces a single fix range covering the gap between semicolon and next token', () => {
    const diagnostics = lintRule('SET x = 1;   SET y = 2;', oneStatementPerLine);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].fix).toEqual({
      range: { start: 10, end: 13 },
      replacement: '\n',
    });
  });
});
