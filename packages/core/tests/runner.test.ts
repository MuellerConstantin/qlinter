import { describe, expect, it } from 'vitest';
import type { Diagnostic, Fix } from '../src/index.js';
import { applyFixes, runFormatLoop } from '../src/runner.js';

describe('runner', () => {
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
