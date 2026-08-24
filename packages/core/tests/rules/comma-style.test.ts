import { describe, expect, it } from 'vitest';
import { formatRule, lintRule } from '../support.js';
import { commaStyle } from '../../src/rules/index.js';
import { lintFixture } from './helpers.js';

describe('comma-style', () => {
  it('flags every leading comma in the violation fixture', () => {
    const diagnostics = lintFixture('violation', commaStyle);

    expect(diagnostics).toHaveLength(6);
    for (const d of diagnostics) {
      expect(d.ruleId).toBe('comma-style');
      expect(d.severity).toBe('warning');
    }
  });

  it('does not flag the clean fixture', () => {
    const diagnostics = lintFixture('clean', commaStyle);

    expect(diagnostics).toEqual([]);
  });

  it('flags a comma that opens a line', () => {
    const diagnostics = lintRule('LOAD\n    A\n    , B\nFROM [lib://x/y.qvd];\n', commaStyle);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toBe("Expected ',' at the end of the previous line.");
    expect(diagnostics[0].range.start).toEqual({ line: 3, column: 5 });
  });

  it('flags a comma sitting alone on its line', () => {
    const diagnostics = lintRule('LOAD\n    A\n    ,\n    B\nFROM [lib://x/y.qvd];\n', commaStyle);

    expect(diagnostics).toHaveLength(1);
  });

  it('flags a comma that a comment line pushed off its operand', () => {
    const diagnostics = lintRule('LOAD\n    A\n    // note\n    , B\nFROM [lib://x/y.qvd];\n', commaStyle);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].range.start).toEqual({ line: 4, column: 5 });
  });

  it('flags a comma that only a block comment precedes on its line', () => {
    const diagnostics = lintRule('LOAD\n    A\n    /* x */, B\nFROM [lib://x/y.qvd];\n', commaStyle);

    expect(diagnostics).toHaveLength(1);
  });

  it('flags leading commas in a function call argument list', () => {
    const diagnostics = lintRule("LET x = If(1\n    , 'a'\n    , 'b');\n", commaStyle);

    expect(diagnostics).toHaveLength(2);
  });

  it('accepts a comma at the end of its operand line', () => {
    const diagnostics = lintRule('LOAD\n    A,\n    B\nFROM [lib://x/y.qvd];\n', commaStyle);

    expect(diagnostics).toEqual([]);
  });

  it('accepts commas within a single line', () => {
    const diagnostics = lintRule('LOAD A, B, C FROM [lib://x/y.qvd];\n', commaStyle);

    expect(diagnostics).toEqual([]);
  });

  /*
   * `firstOnLine` keys off `startLine`, so the comma below counts as first on
   * line 2 even though `Bar]` visually precedes it. It already trails its
   * operand and must not be moved.
   */
  it('accepts a comma trailing a token that spans lines', () => {
    const diagnostics = lintRule('LOAD [Foo\nBar], X\nFROM [lib://x/y.qvd];\n', commaStyle);

    expect(diagnostics).toEqual([]);
  });

  it('ignores commas absorbed into string literals and Trace bodies', () => {
    const diagnostics = lintRule("LET x = 'a\n,b';\nTrace loading\n, a, b;\n", commaStyle);

    expect(diagnostics).toEqual([]);
  });

  it('does not crash on a comma with nothing before it', () => {
    const diagnostics = lintRule(', A;\n', commaStyle);

    expect(diagnostics).toEqual([]);
  });

  it('autofixes a leading comma onto the previous line without shifting the operand', () => {
    const result = formatRule('LOAD\n    A\n    , B\nFROM [lib://x/y.qvd];\n', commaStyle);

    expect(result.output).toBe('LOAD\n    A,\n    B\nFROM [lib://x/y.qvd];\n');
    expect(result.fixed).toBe(1);
    expect(result.diagnostics).toEqual([]);
  });

  it('autofixes a run of leading commas in one pass', () => {
    const result = formatRule('LOAD\n    A\n    , B\n    , C\nFROM [lib://x/y.qvd];\n', commaStyle);

    expect(result.output).toBe('LOAD\n    A,\n    B,\n    C\nFROM [lib://x/y.qvd];\n');
    expect(result.fixed).toBe(2);
  });

  it('autofixes a lone comma by closing up the line it sat on', () => {
    const result = formatRule('LOAD\n    A\n    ,\n    B\nFROM [lib://x/y.qvd];\n', commaStyle);

    expect(result.output).toBe('LOAD\n    A,\n    B\nFROM [lib://x/y.qvd];\n');
    expect(result.fixed).toBe(1);
  });

  it('leaves a comment that sat between the operand and the comma on its own line', () => {
    const result = formatRule('LOAD\n    A\n    // note\n    , B\nFROM [lib://x/y.qvd];\n', commaStyle);

    expect(result.output).toBe('LOAD\n    A,\n    // note\n    B\nFROM [lib://x/y.qvd];\n');
  });

  it('leaves no blank line behind when a lone comma followed a comment', () => {
    const result = formatRule('LOAD\n    A\n    // note\n    ,\n    B\nFROM [lib://x/y.qvd];\n', commaStyle);

    expect(result.output).toBe('LOAD\n    A,\n    // note\n    B\nFROM [lib://x/y.qvd];\n');
  });

  it('keeps a trailing comment on the operand line it annotated', () => {
    const result = formatRule('LOAD\n    A // note\n    , B\nFROM [lib://x/y.qvd];\n', commaStyle);

    expect(result.output).toBe('LOAD\n    A, // note\n    B\nFROM [lib://x/y.qvd];\n');
  });

  it('keeps the space separating a block comment from the operand it precedes', () => {
    const result = formatRule('LOAD\n    A\n    /* x */, B\nFROM [lib://x/y.qvd];\n', commaStyle);

    expect(result.output).toBe('LOAD\n    A,\n    /* x */ B\nFROM [lib://x/y.qvd];\n');
  });

  it('preserves CRLF line endings', () => {
    const result = formatRule('LOAD\r\n    A\r\n    , B\r\nFROM [lib://x/y.qvd];\r\n', commaStyle);

    expect(result.output).toBe('LOAD\r\n    A,\r\n    B\r\nFROM [lib://x/y.qvd];\r\n');
  });

  it('autofixes leading commas in a nested call without disturbing its indent', () => {
    const result = formatRule("LOAD\n    If(1\n        , 'a'\n        , 'b') AS X\nFROM [lib://x/y.qvd];\n", commaStyle);

    expect(result.output).toBe("LOAD\n    If(1,\n        'a',\n        'b') AS X\nFROM [lib://x/y.qvd];\n");
  });
});
