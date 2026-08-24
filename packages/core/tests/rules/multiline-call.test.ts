import { describe, expect, it } from 'vitest';
import { format } from '../../src/index.js';
import { multilineCall } from '../../src/rules/index.js';
import { lintFixture } from './helpers.js';
import { formatRule, lintRule } from '../support.js';

describe('multiline-call', () => {
  it('flags every overlong single-line call in the violation fixture', () => {
    const diagnostics = lintFixture('violation', multilineCall);

    expect(diagnostics).toHaveLength(2);
    for (const d of diagnostics) {
      expect(d.ruleId).toBe('multiline-call');
      expect(d.severity).toBe('warning');
    }
  });

  it('does not flag the clean fixture', () => {
    const diagnostics = lintFixture('clean', multilineCall);

    expect(diagnostics).toEqual([]);
  });

  it('does not flag a call whose single line stays within the limit', () => {
    const diagnostics = lintRule('LET x = If(a, b, c);\n', multilineCall, { maxLineLength: 40 });

    expect(diagnostics).toEqual([]);
  });

  it('flags a call whose single line exceeds the limit', () => {
    const diagnostics = lintRule("LET x = If(a, 'b', 'c');\n", multilineCall, { maxLineLength: 20 });

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain("'If(...)'");
    expect(diagnostics[0].message).toContain('20');
  });

  it('does not flag a call that is already multi-line', () => {
    const diagnostics = lintRule("LET x = If(\n\ta,\n\t'b',\n\t'c'\n);\n", multilineCall, { maxLineLength: 20 });

    expect(diagnostics).toEqual([]);
  });

  it('does not flag a single-argument call even when its line is too long', () => {
    const diagnostics = lintRule('LET x = Sum(vSomeVeryLongFieldName);\n', multilineCall, { maxLineLength: 10 });

    expect(diagnostics).toEqual([]);
  });

  /*
   * This rule decides where the call is broken and emits bare newlines;
   * continuation-indent owns the indentation of the lines that appear. The
   * tests below therefore assert the unindented shape for the rule on its own,
   * and the finished shape only where both rules run.
   */
  it('autofixes by breaking each top-level argument onto its own line', () => {
    const result = formatRule("LET x = If(a, 'b', 'c');\n", multilineCall, { maxLineLength: 20 });

    expect(result.output).toBe("LET x = If(\na,\n'b',\n'c'\n);\n");
    expect(result.fixed).toBe(1);
    expect(result.diagnostics).toEqual([]);
  });

  it('leaves the indentation of the lines it creates to continuation-indent', () => {
    const result = format("LET x = If(a, 'b', 'c');\n", {
      rules: {
        'multiline-call': ['warning', { maxLineLength: 20 }],
        'continuation-indent': 'warning',
      },
    });

    expect(result.output).toBe("LET x = If(\n    a,\n    'b',\n    'c'\n);\n");
    expect(result.diagnostics.filter((d) => d.fix)).toEqual([]);
  });

  it('produces a tab-indented break when the indent rules are configured for tabs', () => {
    const result = format("Sub greet\nLET x = If(a, 'b', 'c');\nEnd Sub\n", {
      rules: {
        'multiline-call': ['warning', { maxLineLength: 20 }],
        'block-indent': ['warning', { style: 'tab' }],
        'continuation-indent': ['warning', { style: 'tab' }],
      },
    });

    expect(result.output).toBe("Sub greet\n\tLET x = If(\n\t\ta,\n\t\t'b',\n\t\t'c'\n\t);\nEnd Sub\n");
  });

  it('keeps a trailing tail like `As Field` intact after the broken call', () => {
    const result = formatRule("LOAD If(a, 'b', 'c') As Category\nFROM [lib://x/y.qvd];\n", multilineCall, {
      maxLineLength: 20,
    });

    expect(result.output).toBe("LOAD If(\na,\n'b',\n'c'\n) As Category\nFROM [lib://x/y.qvd];\n");
    expect(result.fixed).toBe(1);
  });

  it('breaks nested calls iteratively across format passes', () => {
    const result = formatRule("LET x = If(Pick(aaa, bbb, ccc), 'y', 'n');\n", multilineCall, { maxLineLength: 15 });

    expect(result.output).toBe("LET x = If(\nPick(\naaa,\nbbb,\nccc\n),\n'y',\n'n'\n);\n");
    expect(result.fixed).toBe(2);
    expect(result.diagnostics).toEqual([]);
  });

  it('nests correctly once continuation-indent indents the broken calls', () => {
    const result = format("LET x = If(Pick(aaa, bbb, ccc), 'y', 'n');\n", {
      rules: {
        'multiline-call': ['warning', { maxLineLength: 15 }],
        'continuation-indent': 'warning',
      },
    });

    expect(result.output).toBe(
      "LET x = If(\n    Pick(\n        aaa,\n        bbb,\n        ccc\n    ),\n    'y',\n    'n'\n);\n",
    );
    expect(result.diagnostics.filter((d) => d.fix)).toEqual([]);
  });

  it('flags only the outermost qualifying call per pass', () => {
    const diagnostics = lintRule("LET x = If(Pick(aaa, bbb, ccc), 'y', 'n');\n", multilineCall, { maxLineLength: 15 });

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain("'If(...)'");
  });

  /*
   * CRLF coverage lives in inline sources rather than a fixture: `core.autocrlf`
   * decides what a checked-out `.qvs` actually holds, so a committed CRLF
   * fixture would assert something different on each machine.
   */
  it('breaks arguments apart with CRLF in a CRLF script', () => {
    const result = formatRule("LET x = If(aaa, 'yes', 'no');\r\n", multilineCall, { maxLineLength: 15 });

    expect(result.output).toBe("LET x = If(\r\naaa,\r\n'yes',\r\n'no'\r\n);\r\n");
    expect(result.output).not.toMatch(/(?<!\r)\n/);
  });

  it('ignores commas inside string literals, bracket identifiers, and Trace bodies', () => {
    const diagnostics = lintRule(
      "LET vStr = 'a,b,c,d,e,f';\nLOAD [Order,Items,More] FROM [lib://x.qvd];\nTrace loading a,b,c,d,e,f;\n",
      multilineCall,
      { maxLineLength: 10 },
    );

    expect(diagnostics).toEqual([]);
  });
});
