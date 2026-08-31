import { describe, expect, it } from 'vitest';
import { loadIdentifierBrackets, tableLabelBrackets } from '../../src/rules/index.js';
import { formatRule, formatRules, lintRule } from '../support.js';
import { lintFixture } from './helpers.js';

describe('load-identifier-brackets', () => {
  it('flags every quoted identifier in the violation fixture', () => {
    const diagnostics = lintFixture('violation', loadIdentifierBrackets);

    expect(diagnostics).toHaveLength(6);
    for (const diagnostic of diagnostics) {
      expect(diagnostic.ruleId).toBe('load-identifier-brackets');
      expect(diagnostic.severity).toBe('warning');
    }
  });

  it('does not flag the clean fixture', () => {
    expect(lintFixture('clean', loadIdentifierBrackets)).toEqual([]);
  });

  describe('what it rewrites', () => {
    it('flags a quoted field name', () => {
      const diagnostics = lintRule('Load "Order Id" Resident Src;\n', loadIdentifierBrackets);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].message).toBe('The identifier "Order Id" should be enclosed in brackets: \'[Order Id]\'.');
      expect(diagnostics[0].range.start).toEqual({ line: 1, column: 6 });
    });

    it('flags a quoted table label', () => {
      expect(lintRule('"Sales":\nLoad Id Resident Src;\n', loadIdentifierBrackets)).toHaveLength(1);
    });

    it('flags a quoted identifier inside a function call', () => {
      expect(lintRule('Load Sum("Amount") as Total Resident Src;\n', loadIdentifierBrackets)).toHaveLength(1);
    });

    it('flags a quoted table in a Resident clause', () => {
      expect(lintRule('Load Id Resident "Src";\n', loadIdentifierBrackets)).toHaveLength(1);
    });

    it('flags the target of an as alias', () => {
      const result = formatRule('Load Id as "Order Id" Resident Src;\n', loadIdentifierBrackets);

      expect(result.output).toBe('Load Id as [Order Id] Resident Src;\n');
      expect(result.fixed).toBe(1);
    });

    it('flags a name delimited by grave accents', () => {
      const result = formatRule('Load `Order Id` Resident Src;\n', loadIdentifierBrackets);

      expect(result.output).toBe('Load [Order Id] Resident Src;\n');
      expect(result.fixed).toBe(1);
    });

    it('keeps a double quote carried inside a backtick name', () => {
      const result = formatRule('Load `Name"5` Resident Src;\n', loadIdentifierBrackets);

      expect(result.output).toBe('Load [Name"5] Resident Src;\n');
    });

    it('takes a backtick name literally, since no escape is documented for one', () => {
      const result = formatRule('Load `a""b` Resident Src;\n', loadIdentifierBrackets);

      expect(result.output).toBe('Load [a""b] Resident Src;\n');
    });

    it('accepts an identifier already in brackets', () => {
      expect(lintRule('Load [Order Id] Resident [Src];\n', loadIdentifierBrackets)).toEqual([]);
    });

    it('accepts a bare identifier', () => {
      expect(lintRule('Load OrderId Resident Src;\n', loadIdentifierBrackets)).toEqual([]);
    });
  });

  /*
   * Single quotes are string literals and bracket-delimited text is not always a
   * name, so neither may be touched by a rule about how a name is spelled.
   */
  describe('what it leaves alone', () => {
    it('leaves a string literal alone', () => {
      expect(lintRule("Load 'Order Id' as Label Resident Src;\n", loadIdentifierBrackets)).toEqual([]);
    });

    it('leaves Inline data alone', () => {
      const source = 'Load * Inline [\nId, Name\n1, a\n];\n';

      expect(lintRule(source, loadIdentifierBrackets)).toEqual([]);
      expect(formatRule(source, loadIdentifierBrackets).output).toBe(source);
    });

    it('leaves a bracketed path alone', () => {
      const source = 'Store Src Into [lib://out/s.qvd] (qvd);\n';

      expect(formatRule(source, loadIdentifierBrackets).output).toBe(source);
    });

    it('leaves a quoted name inside a Trace message alone', () => {
      expect(lintRule('Trace loading "Sales";\n', loadIdentifierBrackets)).toEqual([]);
    });

    it('leaves a quoted name inside a comment alone', () => {
      expect(lintRule('// loads "Sales"\nLoad Id Resident Src;\n', loadIdentifierBrackets)).toEqual([]);
    });
  });

  /*
   * Qlik reads a double-quoted name inside a LOAD as a field, but in an
   * expression elsewhere as a variable reference. Brackets only ever mean the
   * field, so rewriting one outside a LOAD would change what the script does.
   *
   * @see https://help.qlik.com/en-US/sense/November2025/Subsystems/Hub/Content/Sense_Hub/Scripting/use-quotes-in-script.htm
   */
  describe('quotes outside a row-reading statement', () => {
    it('leaves a variable reference in a Let alone', () => {
      const source = 'Let vX = "vOther" + 1;\n';

      expect(lintRule(source, loadIdentifierBrackets)).toEqual([]);
      expect(formatRule(source, loadIdentifierBrackets).output).toBe(source);
    });

    it('leaves a variable reference in an If header alone', () => {
      const source = 'If "vFlag" = 1 Then\n    Let y = 1;\nEnd If\n';

      expect(formatRule(source, loadIdentifierBrackets).output).toBe(source);
    });

    it('leaves a Set alone', () => {
      expect(lintRule('Set vX = "vOther";\n', loadIdentifierBrackets)).toEqual([]);
    });

    it('leaves a Store target alone', () => {
      expect(lintRule('Store "Sales" Into [lib://out/s.qvd] (qvd);\n', loadIdentifierBrackets)).toEqual([]);
    });

    it('leaves a Drop target alone', () => {
      expect(lintRule('Drop Table "Sales";\n', loadIdentifierBrackets)).toEqual([]);
    });

    it('still rewrites inside a Where clause, which is part of the Load', () => {
      const result = formatRule('Load Id Resident Src Where "Flag" = 1;\n', loadIdentifierBrackets);

      expect(result.output).toBe('Load Id Resident Src Where [Flag] = 1;\n');
    });
  });

  /*
   * The text of a Select reaches the database untouched, so its quoting follows
   * that database's dialect. `"..."` is the ANSI delimited identifier every
   * engine accepts; `[...]` is SQL Server's alone and a syntax error elsewhere.
   *
   * @see https://docs.oracle.com/javadb/10.8.3.0/ref/crefsqlj1003454.html
   */
  describe('passthrough SQL', () => {
    it('leaves a Select alone', () => {
      const source = 'SQL Select "Order Id" From orders;\n';

      expect(lintRule(source, loadIdentifierBrackets)).toEqual([]);
      expect(formatRule(source, loadIdentifierBrackets).output).toBe(source);
    });

    it('leaves a Select alone even when it carries a table label', () => {
      const source = '[Sales]:\nSQL Select "Order Id" From orders;\n';

      expect(formatRule(source, loadIdentifierBrackets).output).toBe(source);
    });

    it('rewrites the Load half of a preceding load but not the Select below it', () => {
      const source = '[Sales]:\nLoad "Order Id";\nSQL Select "Order Id" From orders;\n';

      const result = formatRule(source, loadIdentifierBrackets);

      expect(result.output).toBe('[Sales]:\nLoad [Order Id];\nSQL Select "Order Id" From orders;\n');
      expect(result.fixed).toBe(1);
    });
  });

  /*
   * Brackets escape asymmetrically: only the closing one doubles. A name
   * carrying `]` therefore has a bracketed form after all, and the round trip
   * holds because the lexer reads `]]` back as one literal bracket.
   */
  describe('names carrying a closing bracket', () => {
    it('doubles the closing bracket of a quoted name', () => {
      const result = formatRule('Load "Order]Id" Resident Src;\n', loadIdentifierBrackets);

      expect(result.output).toBe('Load [Order]]Id] Resident Src;\n');
      expect(result.diagnostics).toEqual([]);
    });

    it('doubles the closing bracket of a backtick name', () => {
      const result = formatRule('Load `Order]Id` Resident Src;\n', loadIdentifierBrackets);

      expect(result.output).toBe('Load [Order]]Id] Resident Src;\n');
    });

    it('doubles every closing bracket in the name', () => {
      const result = formatRule('Load "a]b]c" Resident Src;\n', loadIdentifierBrackets);

      expect(result.output).toBe('Load [a]]b]]c] Resident Src;\n');
    });

    it('leaves the escaped form alone on a second pass', () => {
      const source = 'Load [Order]]Id] Resident Src;\n';

      expect(lintRule(source, loadIdentifierBrackets)).toEqual([]);
      expect(formatRule(source, loadIdentifierBrackets).output).toBe(source);
    });

    it('says nothing about an empty name', () => {
      expect(lintRule('Load "" Resident Src;\n', loadIdentifierBrackets)).toEqual([]);
    });

    it('leaves a backtick name outside a Load alone', () => {
      const source = 'Let vThreshold = `vOther` + 1;\n';

      expect(formatRule(source, loadIdentifierBrackets).output).toBe(source);
    });

    it('unescapes a doubled quote when moving to brackets', () => {
      const result = formatRule('Load "Say ""hi""" Resident Src;\n', loadIdentifierBrackets);

      expect(result.output).toBe('Load [Say "hi"] Resident Src;\n');
      expect(result.diagnostics).toEqual([]);
    });
  });

  describe('autofix', () => {
    it('rewrites every quoted identifier in one pass', () => {
      const source = 'Load "A", "B" Resident "C";\n';

      const result = formatRule(source, loadIdentifierBrackets);

      expect(result.output).toBe('Load [A], [B] Resident [C];\n');
      expect(result.fixed).toBe(3);
      expect(result.diagnostics).toEqual([]);
    });

    it('settles alongside table-label-brackets', () => {
      const source = 'Sales:\nLoad "Order Id" Resident Src;\n';

      const result = formatRules(source, [loadIdentifierBrackets, tableLabelBrackets]);

      expect(result.output).toBe('[Sales]:\nLoad [Order Id] Resident Src;\n');
      expect(result.diagnostics).toEqual([]);
    });

    it('leaves a label the neighbouring rule already bracketed', () => {
      const source = '"Sales":\nLoad Id Resident Src;\n';

      const result = formatRules(source, [loadIdentifierBrackets, tableLabelBrackets]);

      expect(result.output).toBe('[Sales]:\nLoad Id Resident Src;\n');
      expect(result.diagnostics).toEqual([]);
    });
  });
});
