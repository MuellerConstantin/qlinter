import { describe, expect, it } from 'vitest';
import { changedCommentContent, changedCommentWords, changedOpaqueContent, changedOpaqueTexts } from './invariants.js';
import { allFixtures, fixtureSource } from './support.js';

/*
 * What formatting may not change: the text a script hands on as written, and
 * the words of its comments. The sweeps below assert an absence, so the
 * comparisons are pinned first against pairs built by hand.
 */
describe('content', () => {
  describe('opaque text verdict', () => {
    it('reports a Set value that was respaced', () => {
      expect(changedOpaqueTexts('Set v = a,b;\n', 'Set v = a, b;\n')).toEqual([
        'opaque text 1 changed: was "a,b", is "a, b"',
      ]);
    });

    it('reports a SQL command that was recased', () => {
      expect(changedOpaqueTexts('SQL SELECT a FROM t;\n', 'SQL Select a From t;\n')).toHaveLength(1);
    });

    it('reports a string that went missing', () => {
      expect(changedOpaqueTexts("Let a = 'x'; Let b = 'y';\n", "Let a = 'x';\n")).toHaveLength(1);
    });

    it('accepts everything around the texts changing', () => {
      expect(changedOpaqueTexts("SET v = a,b;\nLET s='x';\n", "Set v = a,b;\nLet s = 'x';\n")).toEqual([]);
    });
  });

  describe('comment word verdict', () => {
    it('reports a word that changed', () => {
      expect(changedCommentWords('// one two\n', '// one too\n')).toHaveLength(1);
    });

    it('reports a section marker that was respaced, though its words survive', () => {
      expect(changedCommentWords('///$tab Main\n', '// /$tab Main\n')).toHaveLength(1);
    });

    it('accepts a run folded into a block', () => {
      expect(changedCommentWords('// one two\n//three\n', '/*\n * one two\n * three\n */\n')).toEqual([]);
    });

    it('accepts a remark written as a comment', () => {
      expect(changedCommentWords('Rem one two;\n', '// one two\n')).toEqual([]);
    });
  });

  describe('fixture corpus', () => {
    for (const fixture of allFixtures()) {
      it(`hands on the opaque texts of ${fixture} as written`, () => {
        expect(changedOpaqueContent(fixtureSource(fixture))).toEqual([]);
      });

      it(`keeps the comment words of ${fixture}`, () => {
        expect(changedCommentContent(fixtureSource(fixture))).toEqual([]);
      });
    }
  });
});
