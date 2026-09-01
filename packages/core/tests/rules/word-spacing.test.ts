import { describe, expect, it } from 'vitest';
import { commaSpace, operatorSpacing, parenSpacing, semicolonSpace, wordSpacing } from '../../src/rules/index.js';
import { formatRule, formatRules, lintRule } from '../support.js';
import { lintFixture } from './helpers.js';

const lines = (...parts: string[]) => parts.join('\n');

describe('word-spacing', () => {
  it('flags every widened gap in the violation fixture', () => {
    const diagnostics = lintFixture('violation', wordSpacing);

    expect(diagnostics).toHaveLength(6);
    for (const diagnostic of diagnostics) {
      expect(diagnostic.ruleId).toBe('word-spacing');
      expect(diagnostic.severity).toBe('warning');
      expect(diagnostic.message).toBe('Expected exactly one space between words.');
    }
  });

  it('does not flag the clean fixture', () => {
    expect(lintFixture('clean', wordSpacing)).toEqual([]);
  });

  describe('what it collapses', () => {
    it('flags a gap between a keyword and an identifier', () => {
      const diagnostics = lintRule('Let    vY = 2;\n', wordSpacing);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].range.start).toEqual({ line: 1, column: 8 });
    });

    it('flags a gap between two keywords', () => {
      expect(lintRule('Load    Distinct Id Resident Src;\n', wordSpacing)).toHaveLength(1);
    });

    it('flags a gap between two identifiers', () => {
      expect(lintRule('Load Id Resident    Src;\n', wordSpacing)).toHaveLength(1);
    });

    it('flags a gap between the halves of Group By', () => {
      expect(lintRule('Load Id Resident Src Group   By Id;\n', wordSpacing)).toHaveLength(1);
    });

    it('flags a lone tab, which is whitespace but not one space', () => {
      expect(lintRule('Drop\tTable Src;\n', wordSpacing)).toHaveLength(1);
    });

    it('flags a gap before a bracketed name', () => {
      expect(lintRule('Load Id Resident    [Src Table];\n', wordSpacing)).toHaveLength(1);
    });

    it('accepts a single space', () => {
      expect(lintRule('Let vY = 2;\n', wordSpacing)).toEqual([]);
    });

    it('reports each gap separately', () => {
      expect(lintRule('NoConcatenate  Load  Distinct Id Resident Src;\n', wordSpacing)).toHaveLength(2);
    });
  });

  /*
   * Every gap touching punctuation already has an owner, and the arithmetic
   * characters are deliberately left to nobody. Claiming either here would
   * undo a decision another rule made on purpose.
   */
  describe('gaps that belong to somebody else', () => {
    it.each([
      ['an equals sign', 'Let vY   =   2;\n'],
      ['a comma', 'Load Id ,  Name Resident Src;\n'],
      ['a call paren', 'Load Sum  ( Amount ) as T Resident Src;\n'],
      ['a semicolon', 'Load Id Resident Src   ;\n'],
      ['a label colon', '[Sales]   :\nLoad Id Resident Src;\n'],
      ['a minus sign', 'Load a  -  b as C Resident Src;\n'],
      ['a unary minus', 'Let vY =  -1;\n'],
      ['the Load wildcard', 'Load  *  Resident Src;\n'],
      ['a division sign', 'Load a  /  b as C Resident Src;\n'],
    ])('leaves the gap around %s alone', (_name, source) => {
      expect(lintRule(source, wordSpacing)).toEqual([]);
    });

    it('leaves leading indentation alone', () => {
      const source = lines('Load', '        Id', 'Resident Src;', '');

      expect(lintRule(source, wordSpacing)).toEqual([]);
    });

    it('leaves a gap carrying a comment alone', () => {
      expect(lintRule('Load  /* keep */  Id Resident Src;\n', wordSpacing)).toEqual([]);
    });

    it('leaves the spacing inside a Trace message alone', () => {
      const source = 'Trace   loading   sales;\n';

      expect(lintRule(source, wordSpacing)).toEqual([]);
      expect(formatRule(source, wordSpacing).output).toBe(source);
    });

    it('leaves the spacing inside Inline data alone', () => {
      const source = lines('Load * Inline [', 'Id,   Name', '1,   a', '];', '');

      expect(formatRule(source, wordSpacing).output).toBe(source);
    });

    it('leaves the spacing inside a string literal alone', () => {
      const source = "Load 'a    b' as T Resident Src;\n";

      expect(formatRule(source, wordSpacing).output).toBe(source);
    });
  });

  /*
   * Two words with no gap at all would have lexed as one token, so the rule
   * never has a separation to invent — it only ever narrows one.
   */
  describe('it never inserts', () => {
    it('says nothing about two names written against each other', () => {
      expect(lintRule('Load [A][B] Resident Src;\n', wordSpacing)).toEqual([]);
    });

    it('says nothing about a name against a string literal', () => {
      expect(lintRule("Load [A]'b' Resident Src;\n", wordSpacing)).toEqual([]);
    });
  });

  describe('autofix', () => {
    it('collapses the gap to one space', () => {
      const result = formatRule('Let    vY = 2;\n', wordSpacing);

      expect(result.output).toBe('Let vY = 2;\n');
      expect(result.fixed).toBe(1);
      expect(result.diagnostics).toEqual([]);
    });

    it('replaces a tab with a space', () => {
      expect(formatRule('Drop\tTable Src;\n', wordSpacing).output).toBe('Drop Table Src;\n');
    });

    it('collapses several gaps in one pass', () => {
      const result = formatRule('NoConcatenate  Load  Distinct Id Resident    Src;\n', wordSpacing);

      expect(result.output).toBe('NoConcatenate Load Distinct Id Resident Src;\n');
      expect(result.fixed).toBe(3);
    });

    it('preserves CRLF line endings', () => {
      const result = formatRule('Let    vY = 2;\r\nLet vZ = 3;\r\n', wordSpacing);

      expect(result.output).toBe('Let vY = 2;\r\nLet vZ = 3;\r\n');
    });

    it('settles alongside the rules owning the neighbouring gaps', () => {
      const source = 'Load    Id ,  Sum  ( Amount ) as T Resident    Src   ;\n';

      const result = formatRules(source, [wordSpacing, commaSpace, operatorSpacing, parenSpacing, semicolonSpace]);

      expect(result.output).toBe('Load Id, Sum(Amount) as T Resident Src;\n');
      expect(result.diagnostics).toEqual([]);
    });
  });
});
