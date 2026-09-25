import { describe, expect, it } from 'vitest';
import { lint, type Diagnostic } from '../src/index.js';
import { recommended } from '../src/rules/index.js';
import { clashes, clashesWhileFormatting, orderDependence } from './invariants.js';
import { allFixtures, fixtureSource } from './support.js';

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
      expect(clashes([at('a', 3, 5, ' '), at('b', 3, 5, '')])).toHaveLength(1);
    });

    it('accepts a line break against a space, which the break wins by design', () => {
      expect(clashes([at('a', 3, 5, ' '), at('b', 3, 5, '\n')])).toEqual([]);
      expect(clashes([at('a', 3, 5, '\r\n    '), at('b', 3, 5, '\t')])).toEqual([]);
    });

    it('reports a line break against anything but whitespace', () => {
      expect(clashes([at('a', 3, 5, '\n'), at('b', 3, 5, ', ')])).toHaveLength(1);
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
        const fixed = lint(fixtureSource(fixture), recommended).filter((diagnostic) => diagnostic.fix !== undefined);

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
        clashesWhileFormatting(fixtureSource(fixture)).map((clash) => `${fixture}: ${clash}`),
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
      const found = allFixtures().flatMap((fixture) =>
        orderDependence(fixtureSource(fixture)).map((finding) => `${fixture}: ${finding}`),
      );

      expect(found).toEqual([]);
    });
  });
});
