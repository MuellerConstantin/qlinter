import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { format, lint, type Diagnostic, type LintConfig } from '../src/index.js';
import { runFormatLoop } from '../src/runner.js';
import { recommended } from '../src/rules/index.js';

const FIXTURES = join(import.meta.dirname, 'rules', 'fixtures');

/* Every fixture in the repo as a `<rule-id>/<name>.qvs` path, discovered rather than listed. */
function allFixtures(): string[] {
  return readdirSync(FIXTURES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((dir) =>
      readdirSync(join(FIXTURES, dir.name))
        .filter((file) => file.endsWith('.qvs'))
        .map((file) => `${dir.name}/${file}`),
    );
}

const read = (fixture: string): string => readFileSync(join(FIXTURES, fixture), 'utf8');

/*
 * Two rules rewriting one stretch of existing text into different things.
 *
 * Overlapping fixes are ordinary: the runner keeps one, and the rule that lost
 * asks again on the next pass. An identical span with two answers falls outside
 * that arbitration, because it has no winner the design chose — the runner
 * keeps whichever rule the config happens to list first, and the other
 * overwrites it on the next pass or backs off.
 *
 * An empty span is a different question and not this one. Two zero-width
 * inserts at one offset never displace each other, so both land; whether the
 * result is right depends on what the two rules emit, and is pinned in their
 * own tests rather than judged from geometry here.
 */
function clashes(diagnostics: readonly Diagnostic[]): string[] {
  const out: string[] = [];

  for (let i = 0; i < diagnostics.length; i++) {
    for (let j = i + 1; j < diagnostics.length; j++) {
      const a = diagnostics[i];
      const b = diagnostics[j];

      if (a.ruleId === b.ruleId || a.fix === undefined || b.fix === undefined) {
        continue;
      }

      const { start, end } = a.fix.range;

      if (start === end || start !== b.fix.range.start || end !== b.fix.range.end) {
        continue;
      }

      if (a.fix.replacement !== b.fix.replacement) {
        out.push(
          `${a.ruleId} and ${b.ruleId} both rewrite [${start},${end}): ` +
            `${JSON.stringify(a.fix.replacement)} vs ${JSON.stringify(b.fix.replacement)}`,
        );
      }
    }
  }

  return out;
}

/*
 * Every clash the rule set reaches while formatting `source` to a fixed point.
 *
 * The passes come from the real loop rather than a second one written here: a
 * clash the first pass does not show is the interesting kind, because it means
 * one rule's fix moved the script into another rule's reach.
 */
function clashesWhileFormatting(source: string): string[] {
  const found: string[] = [];

  runFormatLoop(source, (current) => {
    const diagnostics = lint(current, recommended);
    found.push(...clashes(diagnostics));

    return diagnostics;
  });

  return found;
}

/* A shuffle that is the same on every run, so a failure here can be reproduced. */
function seeded(seed: number): () => number {
  let state = seed;

  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;

    return state / 4294967296;
  };
}

function permute<T>(items: readonly T[], next: () => number): T[] {
  const out = [...items];

  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }

  return out;
}

/*
 * The recommended rule set in several config orders. Nothing in the API ranks
 * the rules, so each of these is a configuration a user can write.
 */
function orderings(): LintConfig[] {
  const base = Object.entries(recommended.rules ?? {});

  return [base, [...base].reverse(), ...[1, 2, 3, 4].map((seed) => permute(base, seeded(seed)))].map(
    (entries) => ({ rules: Object.fromEntries(entries) }) as LintConfig,
  );
}

describe('fix interaction', () => {
  /*
   * The sweeps below assert an absence, which a verdict that never fires would
   * satisfy just as well as a well-behaved rule set. This pins the verdict
   * against hand-built diagnostics so they cannot pass by failing to look.
   */
  describe('verdict', () => {
    const at = (ruleId: string, start: number, end: number, replacement: string): Diagnostic => ({
      ruleId,
      severity: 'warning',
      range: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } },
      message: 'x',
      fix: { range: { start, end }, replacement },
    });

    it('reports two rules rewriting one span differently', () => {
      expect(clashes([at('a', 3, 5, ' '), at('b', 3, 5, '\n')])).toHaveLength(1);
    });

    it('accepts two rules rewriting one span into the same thing', () => {
      expect(clashes([at('a', 3, 5, ' '), at('b', 3, 5, ' ')])).toEqual([]);
    });

    it('accepts two rules inserting at one offset', () => {
      expect(clashes([at('a', 3, 3, '\n'), at('b', 3, 3, '\n')])).toEqual([]);
    });

    it('accepts one rule reaching for the same span twice', () => {
      expect(clashes([at('a', 3, 5, ' '), at('a', 3, 5, '\n')])).toEqual([]);
    });

    it('accepts spans that merely overlap', () => {
      expect(clashes([at('a', 3, 6, ' '), at('b', 4, 5, '\n')])).toEqual([]);
    });
  });

  /*
   * Sweeps the whole rule set over the whole fixture corpus.
   *
   * What this reaches that a rule's own tests do not is the other rules: a
   * fixture is written for one of them but is real Qlik script the rest also
   * act on, so two rules competing for the same characters are caught here
   * without anyone writing a test for the pair.
   */
  describe('fixture corpus', () => {
    it('produces overlapping fixes for the sweep to be worth running', () => {
      const overlapping = allFixtures().filter((fixture) => {
        const fixed = lint(read(fixture), recommended).filter((diagnostic) => diagnostic.fix !== undefined);

        return fixed.some((a) =>
          fixed.some(
            (b) =>
              a.ruleId !== b.ruleId && a.fix!.range.start < b.fix!.range.end && b.fix!.range.start < a.fix!.range.end,
          ),
        );
      });

      expect(overlapping.length).toBeGreaterThan(0);
    });

    it('leaves no fix pair the runner cannot arbitrate', () => {
      const found = allFixtures().flatMap((fixture) =>
        clashesWhileFormatting(read(fixture)).map((clash) => `${fixture}: ${clash}`),
      );

      expect(found).toEqual([]);
    });

    /*
     * The runner arbitrates competing fixes by position alone, so where two
     * rules reach for the same characters the winner is whichever the config
     * lists first. That is invisible while the rules agree, and becomes a
     * formatter whose output depends on how its config was written, so the
     * property is checked rather than assumed.
     */
    it('formats a script the same whatever order the rules are configured in', () => {
      const configs = orderings();

      for (const fixture of allFixtures()) {
        const source = read(fixture);
        const outputs = configs.map((config) => format(source, config).output);

        expect(new Set(outputs).size, `${fixture} formats differently depending on rule order`).toBe(1);
      }
    });
  });
});
