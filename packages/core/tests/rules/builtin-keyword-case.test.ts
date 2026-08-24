import { describe, expect, it } from 'vitest';
import { builtinKeywordCase } from '../../src/rules/index.js';
import { lintFixture } from './helpers.js';
import { formatRule, lintRule } from '../support.js';

describe('builtin-keyword-case', () => {
  it('flags a keyword in non-canonical case', () => {
    const diagnostics = lintFixture('violation', builtinKeywordCase);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      ruleId: 'builtin-keyword-case',
      severity: 'warning',
      range: { start: { line: 2, column: 1 } },
    });
    expect(diagnostics[0].message).toContain("'LOAD'");
    expect(diagnostics[0].message).toContain("'Load'");
  });

  it('does not flag a keyword in canonical case', () => {
    const diagnostics = lintFixture('clean', builtinKeywordCase);

    expect(diagnostics).toEqual([]);
  });

  /*
   * `Then` is missing from the Engine BNF dump the keyword list is built from,
   * which left it lexing as an identifier and exempt from this rule. It is
   * listed explicitly now, so it is cased like every other keyword.
   */
  it('normalises Then, which the BNF dump does not list as a terminal', () => {
    const diagnostics = lintRule('If x > 1 then\nEnd If\n', builtinKeywordCase);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain("'then'");
    expect(diagnostics[0].message).toContain("'Then'");
  });

  it('autofixes a lowercase If/Then header', () => {
    expect(formatRule('if x > 1 then\nend if\n', builtinKeywordCase).output).toBe('If x > 1 Then\nEnd If\n');
  });

  describe('style option', () => {
    it('with style "upper" does not flag SQL-style LOAD', () => {
      const diagnostics = lintFixture('violation', builtinKeywordCase, { style: 'upper' });

      const flaggedImages = diagnostics.map((diagnostic) => diagnostic.fix?.replacement);
      expect(flaggedImages).not.toContain('LOAD');
    });

    it('with style "upper" flags PascalCase keyword', () => {
      const diagnostics = lintFixture('clean', builtinKeywordCase, { style: 'upper' });

      const loadDiagnostic = diagnostics.find((diagnostic) => diagnostic.message.includes("'Load'"));
      expect(loadDiagnostic).toBeDefined();
      expect(loadDiagnostic?.message).toContain("'LOAD'");
    });

    it('with style "lower" flags PascalCase keyword', () => {
      const diagnostics = lintFixture('clean', builtinKeywordCase, { style: 'lower' });

      const loadDiagnostic = diagnostics.find((diagnostic) => diagnostic.message.includes("'Load'"));
      expect(loadDiagnostic).toBeDefined();
      expect(loadDiagnostic?.message).toContain("'load'");
    });
  });
});
