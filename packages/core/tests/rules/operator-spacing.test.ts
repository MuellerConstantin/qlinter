import { describe, expect, it } from 'vitest';
import { operatorSpacing, semicolonSpace } from '../../src/rules/index.js';
import { lintFixture } from './helpers.js';
import { formatRule, formatRules, lintRule } from '../support.js';

describe('operator-spacing', () => {
  it('flags operator-spacing problems in the violation fixture', () => {
    const diagnostics = lintFixture('violation', operatorSpacing);

    expect(diagnostics.length).toBeGreaterThan(0);
    for (const d of diagnostics) {
      expect(d.ruleId).toBe('operator-spacing');
      expect(d.severity).toBe('warning');
    }
  });

  it('does not flag the clean fixture', () => {
    const diagnostics = lintFixture('clean', operatorSpacing);

    expect(diagnostics).toEqual([]);
  });

  it('flags a missing space on both sides of "="', () => {
    const diagnostics = lintRule('LET x=1;\n', operatorSpacing);

    expect(diagnostics).toHaveLength(2);
    expect(diagnostics[0].message).toBe("Expected a space before '='.");
    expect(diagnostics[1].message).toBe("Expected a space after '='.");
  });

  it('flags a missing space around "&"', () => {
    const diagnostics = lintRule("LET x = 'a'&'b';\n", operatorSpacing);

    expect(diagnostics).toHaveLength(2);
    expect(diagnostics[0].message).toBe("Expected a space before '&'.");
  });

  it('collapses runs of whitespace around an operator', () => {
    const diagnostics = lintRule("LET x = 'a'  &  'b';\n", operatorSpacing);

    expect(diagnostics).toHaveLength(2);
    expect(diagnostics[0].message).toBe("Expected exactly one space before '&'.");
    expect(diagnostics[1].message).toBe("Expected exactly one space after '&'.");
  });

  it('treats ">=" as a single operator unit', () => {
    const diagnostics = lintRule('LET x = If(a>=b, 1, 0);\n', operatorSpacing);

    expect(diagnostics).toHaveLength(2);
    expect(diagnostics[0].message).toBe("Expected a space before '>='.");
    expect(diagnostics[1].message).toBe("Expected a space after '>='.");
  });

  it('treats "<>" as a single operator unit', () => {
    const diagnostics = lintRule('LET x = If(a<>b, 1, 0);\n', operatorSpacing);

    expect(diagnostics).toHaveLength(2);
    expect(diagnostics[0].message).toBe("Expected a space before '<>'.");
    expect(diagnostics[1].message).toBe("Expected a space after '<>'.");
  });

  it('does not flag an operator that ends its line (wrapped expression)', () => {
    const diagnostics = lintRule("LET x = 'a'\n    & 'b';\n", operatorSpacing);

    expect(diagnostics).toEqual([]);
  });

  it('does not flag the leading "=" of a $(= …) dollar expansion', () => {
    const diagnostics = lintRule('LET x = $(=Max(Year));\n', operatorSpacing);

    expect(diagnostics).toEqual([]);
  });

  it('leaves arithmetic operators alone', () => {
    const diagnostics = lintRule('LET x = 1+2;\nLET y = -1;\n', operatorSpacing);

    expect(diagnostics).toEqual([]);
  });

  it('leaves the Load wildcard alone', () => {
    const diagnostics = lintRule('Load *\nResident [Raw];\n', operatorSpacing);

    expect(diagnostics).toEqual([]);
  });

  it('autofixes missing spaces around "="', () => {
    const result = formatRule('LET x=1;\n', operatorSpacing);

    expect(result.output).toBe('LET x = 1;\n');
    expect(result.fixed).toBe(2);
    expect(result.diagnostics).toEqual([]);
  });

  it('autofixes excess whitespace around "&" by collapsing to one space', () => {
    const result = formatRule("LET x = 'a'  &  'b';\n", operatorSpacing);

    expect(result.output).toBe("LET x = 'a' & 'b';\n");
    expect(result.fixed).toBe(2);
    expect(result.diagnostics).toEqual([]);
  });

  it('autofixes a relational operator unit', () => {
    const result = formatRule('LET x = If(a>=b, 1, 0);\n', operatorSpacing);

    expect(result.output).toBe('LET x = If(a >= b, 1, 0);\n');
    expect(result.fixed).toBe(2);
    expect(result.diagnostics).toEqual([]);
  });

  /*
   * The spaces at the edges of a Set value are not part of it — measured in Qlik
   * Sense Enterprise on Windows May 2025 Patch 19, the reference being silent —
   * so the `=` of a Set is spaced like any other.
   */
  describe('the = of a Set', () => {
    it('spaces the side of the name', () => {
      expect(formatRule('SET x= 1;\n', operatorSpacing).output).toBe('SET x = 1;\n');
    });

    it('spaces the side of the value', () => {
      expect(formatRule('SET x =1;\nSET y =   1;\n', operatorSpacing).output).toBe('SET x = 1;\nSET y = 1;\n');
    });

    it('leaves a tab at the edge of the value inside it', () => {
      expect(formatRule('SET z =\t1;\n', operatorSpacing).output).toBe('SET z = \t1;\n');
    });

    it('leaves an empty value empty', () => {
      expect(lintRule('SET x =;\n', operatorSpacing)).toEqual([]);
    });
  });

  describe('before a ;', () => {
    it('leaves the gap to the terminator', () => {
      expect(lintRule('Let x =;\n', operatorSpacing)).toEqual([]);
      expect(lintRule("Let x = 'a' &;\n", operatorSpacing)).toEqual([]);
    });

    it('settles an empty Let beside the terminator rule instead of trading fixes with it', () => {
      expect(formatRules('Let x = ;\n', [operatorSpacing, semicolonSpace]).output).toBe('Let x =;\n');
    });
  });
});
