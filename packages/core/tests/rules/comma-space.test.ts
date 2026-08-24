import { describe, expect, it } from 'vitest';
import { formatRule, formatRules, lintRule } from '../support.js';
import { commaSpace, commaStyle } from '../../src/rules/index.js';
import { lintFixture } from './helpers.js';

describe('comma-space', () => {
  it('flags every comma-space problem in the violation fixture', () => {
    const diagnostics = lintFixture('violation', commaSpace);

    expect(diagnostics).toHaveLength(17);
    for (const d of diagnostics) {
      expect(d.ruleId).toBe('comma-space');
      expect(d.severity).toBe('warning');
    }
  });

  it('does not flag the clean fixture', () => {
    const diagnostics = lintFixture('clean', commaSpace);

    expect(diagnostics).toEqual([]);
  });

  it('flags a missing space after a comma', () => {
    const diagnostics = lintRule("LET x = If(1,'a','b');\n", commaSpace);

    expect(diagnostics).toHaveLength(2);
    expect(diagnostics[0].message).toBe("Expected a space after ','.");
  });

  it('flags more than one space after a comma', () => {
    const diagnostics = lintRule("LET x = If(1,  'a', 'b');\n", commaSpace);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toBe("Expected exactly one space after ','.");
  });

  it('flags a tab after a comma', () => {
    const diagnostics = lintRule("LET x = If(1,\t'a', 'b');\n", commaSpace);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toBe("Expected exactly one space after ','.");
  });

  it('accepts a single space after a comma', () => {
    const diagnostics = lintRule("LET x = If(1, 'a', 'b');\n", commaSpace);

    expect(diagnostics).toEqual([]);
  });

  it('does not flag a comma at the end of a line', () => {
    const diagnostics = lintRule('LOAD\n    A,\n    B,\n    C\nFROM [lib://x/y.qvd];\n', commaSpace);

    expect(diagnostics).toEqual([]);
  });

  it('does not flag a comma followed only by trailing whitespace before newline', () => {
    const diagnostics = lintRule('LOAD\n    A,   \n    B\nFROM [lib://x/y.qvd];\n', commaSpace);

    expect(diagnostics).toEqual([]);
  });

  it('requires a space before an inline block comment after the comma', () => {
    const diagnostics = lintRule("LET x = If(1,/* hint */ 'a', 'b');\n", commaSpace);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toBe("Expected a space after ','.");
  });

  it('accepts a single space before an inline block comment after the comma', () => {
    const diagnostics = lintRule("LET x = If(1, /* hint */ 'a', 'b');\n", commaSpace);

    expect(diagnostics).toEqual([]);
  });

  it('ignores commas inside string literals', () => {
    const diagnostics = lintRule("LET x = 'a,b,c';\n", commaSpace);

    expect(diagnostics).toEqual([]);
  });

  it('ignores commas inside bracket identifiers', () => {
    const diagnostics = lintRule('LOAD [Order,Items] AS X FROM [lib://x/y.qvd];\n', commaSpace);

    expect(diagnostics).toEqual([]);
  });

  it('ignores commas inside Trace bodies', () => {
    const diagnostics = lintRule('Trace loading a,b,c;\n', commaSpace);

    expect(diagnostics).toEqual([]);
  });

  it('flags a space before a comma', () => {
    const diagnostics = lintRule("LET x = If(1 , 'a');\n", commaSpace);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toBe("Unexpected space before ','.");
  });

  it('flags a tab before a comma', () => {
    const diagnostics = lintRule("LET x = If(1\t, 'a');\n", commaSpace);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toBe("Unexpected space before ','.");
  });

  it('flags both sides of the same comma independently', () => {
    const diagnostics = lintRule("LET x = If(1 ,'a');\n", commaSpace);

    expect(diagnostics.map((d) => d.message)).toEqual(["Unexpected space before ','.", "Expected a space after ','."]);
  });

  it('flags a space before a comma that ends its line', () => {
    const diagnostics = lintRule('LOAD\n    A ,\n    B\nFROM [lib://x/y.qvd];\n', commaSpace);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toBe("Unexpected space before ','.");
  });

  it('flags a space between a block comment and the comma after it', () => {
    const diagnostics = lintRule('LOAD A /* x */ , B FROM [lib://x/y.qvd];\n', commaSpace);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toBe("Unexpected space before ','.");
  });

  /*
   * A comma that opens its own line is a placement question owned by
   * comma-style. Flagging its indentation here would have the two rules
   * fighting over the same characters.
   */
  it('leaves the indentation of a comma that opens a line to comma-style', () => {
    const diagnostics = lintRule('LOAD\n    A\n    , B\nFROM [lib://x/y.qvd];\n', commaSpace);

    expect(diagnostics).toEqual([]);
  });

  it('leaves a comma sitting alone on its line to comma-style', () => {
    const diagnostics = lintRule('LOAD\n    A\n    ,\n    B\nFROM [lib://x/y.qvd];\n', commaSpace);

    expect(diagnostics).toEqual([]);
  });

  it('ignores a comma opening the file with nothing to close up against', () => {
    const diagnostics = lintRule(' , A;\n', commaSpace);

    expect(diagnostics).toEqual([]);
  });

  it('ignores a space before a comma inside a string literal or Trace body', () => {
    const diagnostics = lintRule("LET x = 'a ,b';\nTrace loading a ,b;\n", commaSpace);

    expect(diagnostics).toEqual([]);
  });

  it('autofixes a space before a comma by removing it', () => {
    const result = formatRule("LET x = If(1 , 'a'\t, 'b');\n", commaSpace);

    expect(result.output).toBe("LET x = If(1, 'a', 'b');\n");
    expect(result.fixed).toBe(2);
    expect(result.diagnostics).toEqual([]);
  });

  it('autofixes both sides of a comma in a single pass', () => {
    const result = formatRule("LET x = If(1 ,'a' ,  'b');\n", commaSpace);

    expect(result.output).toBe("LET x = If(1, 'a', 'b');\n");
    expect(result.fixed).toBe(4);
    expect(result.diagnostics).toEqual([]);
  });

  /*
   * The two rules partition the whitespace around a comma between them: this
   * one owns what touches the comma on its own line, comma-style owns which
   * line the comma is on. Together they take a leading comma all the way to
   * the canonical shape.
   */
  it('composes with comma-style to bring a leading comma tight against its operand', () => {
    const result = formatRules('LOAD\n    A\n    , B\nFROM [lib://x/y.qvd];\n', [commaSpace, commaStyle]);

    expect(result.output).toBe('LOAD\n    A,\n    B\nFROM [lib://x/y.qvd];\n');
    expect(result.diagnostics).toEqual([]);
  });

  it('autofixes a missing space by inserting one', () => {
    const result = formatRule("LET x = If(1,'a','b');\n", commaSpace);

    expect(result.output).toBe("LET x = If(1, 'a', 'b');\n");
    expect(result.fixed).toBe(2);
    expect(result.diagnostics).toEqual([]);
  });

  it('autofixes excess whitespace by collapsing to a single space', () => {
    const result = formatRule("LET x = If(1,    'a',\t'b');\n", commaSpace);

    expect(result.output).toBe("LET x = If(1, 'a', 'b');\n");
    expect(result.fixed).toBe(2);
    expect(result.diagnostics).toEqual([]);
  });
});
