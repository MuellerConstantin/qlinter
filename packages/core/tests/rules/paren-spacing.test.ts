import { describe, expect, it } from 'vitest';
import { parenSpacing } from '../../src/rules/index.js';
import { lintFixture } from './helpers.js';
import { formatRule, lintRule } from '../support.js';

describe('paren-spacing', () => {
  it('flags paren-spacing problems in the violation fixture', () => {
    const diagnostics = lintFixture('violation', parenSpacing);

    expect(diagnostics.length).toBeGreaterThan(0);
    for (const d of diagnostics) {
      expect(d.ruleId).toBe('paren-spacing');
      expect(d.severity).toBe('warning');
    }
  });

  it('does not flag the clean fixture', () => {
    const diagnostics = lintFixture('clean', parenSpacing);

    expect(diagnostics).toEqual([]);
  });

  it('flags a space between a built-in function and its opening paren', () => {
    const diagnostics = lintRule('LET x = Sum (v);\n', parenSpacing);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toBe("Unexpected space before '('.");
  });

  it('collapses multiple spaces before a function paren', () => {
    const diagnostics = lintRule('LET x = Sum  (v);\n', parenSpacing);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toBe("Unexpected space before '('.");
  });

  it('flags padding after an opening paren', () => {
    const diagnostics = lintRule('LET x = Sum( v);\n', parenSpacing);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toBe("Unexpected space after '('.");
  });

  it('flags padding before a closing paren', () => {
    const diagnostics = lintRule('LET x = Sum(v );\n', parenSpacing);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toBe("Unexpected space before ')'.");
  });

  it('flags padding inside grouping parens after a keyword', () => {
    const diagnostics = lintRule('LOAD * Resident [t] Where ( Amount > 0 );\n', parenSpacing);

    expect(diagnostics).toHaveLength(2);
    expect(diagnostics.map((d) => d.message)).toEqual(["Unexpected space after '('.", "Unexpected space before ')'."]);
  });

  it('does not glue a keyword to a grouping paren', () => {
    const diagnostics = lintRule('LOAD * Resident [t] Where (Amount > 0);\n', parenSpacing);

    expect(diagnostics).toEqual([]);
  });

  it('flags a space inside empty parens once', () => {
    const diagnostics = lintRule('LET x = Rand( );\n', parenSpacing);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toBe("Unexpected space after '('.");
  });

  it('flags a run of whitespace between a closing paren and the word after it', () => {
    const diagnostics = lintRule('LOAD Sum(Amount)   as Total Resident [t];\n', parenSpacing);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toBe("Expected exactly one space after ')'.");
  });

  it('accepts a single space between a closing paren and the word after it', () => {
    const diagnostics = lintRule('LOAD Sum(Amount) as Total Resident [t];\n', parenSpacing);

    expect(diagnostics).toEqual([]);
  });

  it('does not open the gap a dollar-sign expansion closes', () => {
    const diagnostics = lintRule('LOAD $(vPrefix)Sales as Total Resident [t];\n', parenSpacing);

    expect(diagnostics).toEqual([]);
  });

  it('leaves the gap before a comma alone', () => {
    const diagnostics = lintRule('LOAD Sum(Amount)  , Currency Resident [t];\n', parenSpacing);

    expect(diagnostics).toEqual([]);
  });

  it('does not remove a comment sitting after a closing paren', () => {
    const diagnostics = lintRule('LOAD Sum(Amount) /* hint */ as Total Resident [t];\n', parenSpacing);

    expect(diagnostics).toEqual([]);
  });

  it('leaves a closing paren that ends its line alone', () => {
    const diagnostics = lintRule('LOAD Sum(Amount)\n    as Total\nResident [t];\n', parenSpacing);

    expect(diagnostics).toEqual([]);
  });

  it('leaves a multi-line call untouched', () => {
    const diagnostics = lintRule('LET x = If(\n    a,\n    b\n);\n', parenSpacing);

    expect(diagnostics).toEqual([]);
  });

  it('does not remove a comment sitting before a function paren', () => {
    const diagnostics = lintRule('LET x = Sum /* hint */ (v);\n', parenSpacing);

    expect(diagnostics).toEqual([]);
  });

  it('autofixes a function-call space', () => {
    const result = formatRule('LET x = Sum (v);\n', parenSpacing);

    expect(result.output).toBe('LET x = Sum(v);\n');
    expect(result.fixed).toBe(1);
    expect(result.diagnostics).toEqual([]);
  });

  it('autofixes inner padding on both sides', () => {
    const result = formatRule('LET x = If( a, b );\n', parenSpacing);

    expect(result.output).toBe('LET x = If(a, b);\n');
    expect(result.fixed).toBe(2);
    expect(result.diagnostics).toEqual([]);
  });

  it('autofixes a tab run before an alias', () => {
    const result = formatRule('LOAD Sum(Amount)\t\t\tas Total Resident [t];\n', parenSpacing);

    expect(result.output).toBe('LOAD Sum(Amount) as Total Resident [t];\n');
    expect(result.fixed).toBe(1);
    expect(result.diagnostics).toEqual([]);
  });

  it('autofixes a space inside empty parens', () => {
    const result = formatRule('LET x = Rand( );\n', parenSpacing);

    expect(result.output).toBe('LET x = Rand();\n');
    expect(result.fixed).toBe(1);
    expect(result.diagnostics).toEqual([]);
  });
});
