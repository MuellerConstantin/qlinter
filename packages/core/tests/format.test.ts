import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { format, type Diagnostic, type Fix } from '../src/index.js';
import { applyFixes, runFormatLoop } from '../src/runner.js';
import {
  tableLabelBrackets,
  builtinFunctionCase,
  builtinKeywordCase,
  loadIdentifierBrackets,
  recommended,
} from '../src/rules/index.js';
import { formatRule } from './support.js';

const FIXTURES = join(import.meta.dirname, 'rules', 'fixtures');

function readFixture(ruleId: string, kind: 'violation' | 'clean'): string {
  return readFileSync(join(FIXTURES, ruleId, `${kind}.qvs`), 'utf8');
}

/*
 * Every fixture in the repo as a `<rule-id>/<name>.qvs` path. Discovered rather
 * than listed, so a fixture added for a new rule joins the sweep below without
 * anyone remembering to register it.
 */
function allFixtures(): string[] {
  return readdirSync(FIXTURES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((dir) =>
      readdirSync(join(FIXTURES, dir.name))
        .filter((file) => file.endsWith('.qvs'))
        .map((file) => `${dir.name}/${file}`),
    );
}

describe('format', () => {
  describe('per-rule fixing', () => {
    it('rewrites unbracketed table labels into the bracketed form', () => {
      const violation = readFixture('table-label-brackets', 'violation');
      const expected = readFixture('table-label-brackets', 'clean');

      const result = formatRule(violation, tableLabelBrackets);

      expect(result.output).toBe(expected);
      expect(result.fixed).toBe(1);
      expect(result.diagnostics).toEqual([]);
    });

    it('rewrites quoted identifiers into the bracketed form', () => {
      const violation = readFixture('load-identifier-brackets', 'violation');
      const expected = readFixture('load-identifier-brackets', 'clean');

      const result = formatRule(violation, loadIdentifierBrackets);

      expect(result.output).toBe(expected);
      expect(result.diagnostics).toEqual([]);
    });

    it('rewrites built-in functions to canonical case', () => {
      const violation = readFixture('builtin-function-case', 'violation');
      const expected = readFixture('builtin-function-case', 'clean');

      const result = formatRule(violation, builtinFunctionCase);

      expect(result.output).toBe(expected);
      expect(result.fixed).toBe(1);
      expect(result.diagnostics).toEqual([]);
    });

    it('rewrites keywords to canonical case', () => {
      const violation = readFixture('builtin-keyword-case', 'violation');
      const expected = readFixture('builtin-keyword-case', 'clean');

      const result = formatRule(violation, builtinKeywordCase);

      expect(result.output).toBe(expected);
      expect(result.fixed).toBe(1);
      expect(result.diagnostics).toEqual([]);
    });
  });

  describe('idempotence', () => {
    it('produces no further changes when re-run on already-fixed output', () => {
      const violation = readFixture('table-label-brackets', 'violation');

      const first = format(violation, recommended);
      const second = format(first.output, recommended);

      expect(second.output).toBe(first.output);
      expect(second.fixed).toBe(0);
    });

    it('formats identically whether the preset is named or passed as the object', () => {
      const violation = readFixture('table-label-brackets', 'violation');

      const byName = format(violation, { presets: 'recommended' });
      const byObject = format(violation, recommended);

      expect(byName.output).toBe(byObject.output);
    });

    /*
     * Sweeps the whole fixture corpus under `recommended` and requires every
     * file to reach a fixed point: a second `format` call must change nothing.
     *
     * What this guards is rule *composition*. Each fixture is written for one
     * rule but is real Qlik script that the other twenty-odd rules also see, so
     * the corpus doubles as a cheap cross-rule integration surface — far wider
     * than any one rule's own test file reaches. Two rules with contradictory
     * expectations for the same bytes rewrite each other on every pass until
     * `runFormatLoop` gives up; here that surfaces as one named failing fixture
     * rather than as a thrown error in a user's script.
     *
     * What it does not guard is whether the shape the rules settle on is the
     * *right* one — two rules can converge perfectly happily on something nobody
     * wants. Pinning a specific shape down is what a contract suite like
     * `load-header.test.ts` is for.
     */
    describe('fixture corpus', () => {
      it('discovers fixtures to sweep', () => {
        expect(allFixtures().length).toBeGreaterThan(0);
      });

      for (const fixture of allFixtures()) {
        it(`reaches a fixed point on ${fixture}`, () => {
          const source = readFileSync(join(FIXTURES, fixture), 'utf8');

          const first = format(source, recommended);
          const second = format(first.output, recommended);

          expect(second.output).toBe(first.output);
          expect(second.fixed).toBe(0);
        });
      }
    });
  });

  /*
   * A rule that inserts a line break has to insert the one the file already
   * uses. Three rules once hardcoded `\n`, so formatting a CRLF script left it
   * with mixed terminators — invisible in a rule's own LF test, and loud in the
   * diff of anyone on Windows.
   *
   * The sweep re-runs the whole fixture corpus with every ending flipped to
   * CRLF, so the guard covers rules written after this one for free. Flipping
   * in memory rather than committing CRLF fixtures keeps the assertion
   * independent of what `core.autocrlf` hands the working tree.
   */
  describe('line endings', () => {
    const BARE_LF = /(?<!\r)\n/;

    for (const fixture of allFixtures()) {
      it(`introduces no bare LF into the CRLF form of ${fixture}`, () => {
        const source = readFileSync(join(FIXTURES, fixture), 'utf8').replace(/\r?\n/g, '\r\n');

        const output = format(source, recommended).output;

        expect(output).not.toMatch(BARE_LF);
      });
    }

    it('leaves an LF script on LF', () => {
      const output = format('LOAD A, B FROM [lib://x/y.qvd];\n', recommended).output;

      expect(output).toBe('Load\n    A,\n    B\nFrom [lib://x/y.qvd];\n');
    });

    it('formats a CRLF script into the same shape as its LF twin', () => {
      const lf = format('LOAD A, B FROM [lib://x/y.qvd];\n', recommended).output;
      const crlf = format('LOAD A, B FROM [lib://x/y.qvd];\r\n', recommended).output;

      expect(crlf).toBe(lf.replace(/\n/g, '\r\n'));
    });
  });

  describe('overlapping fixes', () => {
    it('applies only the first of two overlapping fixes within a single pass', () => {
      const fixA: Fix = { range: { start: 0, end: 3 }, replacement: 'XXX' };
      const fixB: Fix = { range: { start: 1, end: 4 }, replacement: 'YYY' };

      const { output, applied } = applyFixes('abcdef', [fixA, fixB]);

      expect(['XXXdef', 'aYYYef']).toContain(output);
      expect(applied).toBe(1);
    });
  });

  describe('multi-pass convergence', () => {
    /** Diagnostic producer that rewrites the whole source A -> B -> C, one step per pass. */
    function chain(src: string): Diagnostic[] {
      const replacement = src === 'A' ? 'B' : src === 'B' ? 'C' : null;

      if (replacement === null) {
        return [];
      }

      return [
        {
          ruleId: 'chain',
          severity: 'warning',
          range: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
          message: `replace ${src}`,
          fix: { range: { start: 0, end: src.length }, replacement },
        },
      ];
    }

    it('iterates until no more fixes are produced', () => {
      const result = runFormatLoop('A', chain);

      expect(result.output).toBe('C');
      expect(result.fixed).toBe(2);
    });

    it('throws when fixes never stabilize', () => {
      const flip = (src: string): Diagnostic[] => {
        const replacement = src === 'A' ? 'B' : src === 'B' ? 'A' : null;

        if (replacement === null) {
          return [];
        }

        return [
          {
            ruleId: 'flip',
            severity: 'warning',
            range: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
            message: `flip ${src}`,
            fix: { range: { start: 0, end: src.length }, replacement },
          },
        ];
      };

      expect(() => runFormatLoop('A', flip)).toThrow(/did not converge/);
    });
  });
});
