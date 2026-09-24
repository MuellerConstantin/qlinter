import { describe, expect, it } from 'vitest';
import { lint, type Fix } from '../src/index.js';
import { COMMENT_GROUP, WHITESPACE_GROUP, lexer } from '../src/lexer.js';
import { recommended } from '../src/rules/index.js';
import { rewriteReason, unsafeFixes, unsafeReason } from './invariants.js';
import { allFixtures, fixtureSource } from './support.js';

/** Count of the fixes `recommended` produces for `source`, unsafe or not. */
function fixCount(source: string): number {
  return lint(source, recommended).filter((diagnostic) => diagnostic.fix !== undefined).length;
}

describe('fix geometry', () => {
  /*
   * The sweep below asserts an absence, which a broken verdict would satisfy
   * just as well as correct rules. These pin the verdict itself against hand-built
   * ranges, so the sweep cannot pass by failing to look.
   */
  describe('verdict', () => {
    const source = 'LOAD /* why */ A FROM [lib://x/y.qvd];\n';
    const comments = lexer.tokenize(source).groups[COMMENT_GROUP] ?? [];
    const comment = { start: 5, end: 14 };

    it('reads the comment span the cases below are built against', () => {
      expect(comments).toHaveLength(1);
      expect(source.slice(comment.start, comment.end)).toBe('/* why */');
    });

    it('rejects a range that swallows a comment without carrying it', () => {
      const fix: Fix = { range: { start: 4, end: 15 }, replacement: '\n' };

      expect(unsafeReason(fix, source, comments, [])).toBe('drops a comment it overwrites');
    });

    it('rejects a range that clips a comment', () => {
      const fix: Fix = { range: { start: 4, end: 10 }, replacement: '\n' };

      expect(unsafeReason(fix, source, comments, [])).toBe('partially overwrites a comment');
    });

    it('rejects a range that touches a character the lexer skipped', () => {
      const fix: Fix = { range: { start: 20, end: 22 }, replacement: '\n' };

      expect(unsafeReason(fix, source, comments, [{ start: 21, end: 22 }])).toBe(
        'overlaps characters the lexer skipped',
      );
    });

    it('accepts a range sitting inside a comment', () => {
      const fix: Fix = { range: { start: 7, end: 8 }, replacement: 'x' };

      expect(unsafeReason(fix, source, comments, [])).toBeNull();
    });

    it('accepts a range that carries the comment it covers through verbatim', () => {
      const fix: Fix = { range: { start: 4, end: 15 }, replacement: '\n/* why */ ' };

      expect(unsafeReason(fix, source, comments, [])).toBeNull();
    });

    it('accepts a range in plain whitespace', () => {
      const fix: Fix = { range: { start: 14, end: 15 }, replacement: '\n' };

      expect(unsafeReason(fix, source, comments, [])).toBeNull();
    });
  });

  describe('comment-rewriter verdict', () => {
    const run = 'SET a = 1;\n// first\n// second\n';
    const groups = lexer.tokenize(run).groups;
    const runComments = groups[COMMENT_GROUP] ?? [];
    const runWhitespaces = groups[WHITESPACE_GROUP] ?? [];
    const block = '/*\n * first\n * second\n */';
    const fold = { start: 11, end: run.length - 1 };

    it('reads the run the cases below are built against', () => {
      expect(runComments).toHaveLength(2);
      expect(run.slice(fold.start, fold.end)).toBe('// first\n// second');
    });

    it('accepts a range holding comments and the whitespace between them', () => {
      const fix: Fix = { range: fold, replacement: block };

      expect(rewriteReason(fix, runComments, runWhitespaces, [])).toBeNull();
    });

    it('rejects a range reaching over a code token', () => {
      const fix: Fix = { range: { start: 0, end: fold.end }, replacement: block };

      expect(rewriteReason(fix, runComments, runWhitespaces, [])).toBe('reaches past the comments it rewrites');
    });

    it('rejects a range touching a character the lexer skipped', () => {
      const fix: Fix = { range: fold, replacement: block };

      expect(rewriteReason(fix, runComments, runWhitespaces, [{ start: 12, end: 13 }])).toBe(
        'overlaps characters the lexer skipped',
      );
    });
  });

  /*
   * Sweeps every fix the whole rule set produces over the whole fixture corpus.
   *
   * What this reaches that a rule's own tests do not is every *other* rule: a
   * fixture is written for one of them but is real Qlik script the rest also
   * act on, so a rule added later is audited here without anyone writing a test
   * for it. What it cannot reach is a construct the corpus does not contain —
   * the corpus held 192 comments and not one of them opened a code line, which
   * is how the class of bug this guards went unnoticed. Coverage here is
   * coverage by position, never by volume.
   */
  describe('fixture corpus', () => {
    it('produces enough fixes for the sweep to be worth running', () => {
      const total = allFixtures().reduce((sum, fixture) => sum + fixCount(fixtureSource(fixture)), 0);

      expect(total).toBeGreaterThan(100);
    });

    it('covers fixtures whose comments sit where a fix could swallow them', () => {
      const commented = allFixtures().filter((fixture) => {
        const source = fixtureSource(fixture);
        const result = lexer.tokenize(source);
        const comments = result.groups[COMMENT_GROUP] ?? [];

        return comments.some((comment) =>
          result.tokens.some(
            (token) => (token.startLine ?? 1) === (comment.startLine ?? 1) && comment.startOffset < token.startOffset,
          ),
        );
      });

      expect(commented.length).toBeGreaterThan(0);
    });

    for (const fixture of allFixtures()) {
      it(`applies no content-destroying fix to ${fixture}`, () => {
        expect(unsafeFixes(fixtureSource(fixture))).toEqual([]);
      });
    }
  });
});
