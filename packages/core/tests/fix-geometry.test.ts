import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { IToken } from 'chevrotain';
import { lint, type Fix } from '../src/index.js';
import { COMMENT_GROUP, lexer } from '../src/lexer.js';
import { recommended } from '../src/rules/index.js';

const FIXTURES = join(import.meta.dirname, 'rules', 'fixtures');

/*
 * Every fixture in the repo as a `<rule-id>/<name>.qvs` path. Discovered rather
 * than listed, so a fixture added for a new rule joins the sweep below without
 * anyone remembering to register it.
 */
function allFixtures(): string[] {
  return readdirSync(FIXTURES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((dir) =>
      readdirSync(join(FIXTURES, dir.name))
        .filter((file) => file.endsWith('.qvs'))
        .map((file) => `${dir.name}/${file}`),
    );
}

interface Span {
  start: number;
  end: number;
}

const spanOf = (token: IToken): Span => ({
  start: token.startOffset,
  end: (token.endOffset ?? token.startOffset) + 1,
});

const overlaps = (a: Span, b: Span): boolean => a.start < b.end && b.start < a.end;

const contains = (outer: Span, inner: Span): boolean => outer.start <= inner.start && inner.end <= outer.end;

/*
 * Why a fix is unsafe to apply, or null when it is safe.
 *
 * A rule computes its fix range from token offsets, so the range can cover
 * source the token stream does not carry: a comment, which the lexer routes to
 * its own group, and in a script the lexer could not read whole, a character it
 * skipped. Replacing such a range wholesale deletes that content.
 *
 * The verdict is geometric on purpose. Asking whether content survives cannot
 * work: rewriting `"My Field"` into `[My Field]` drops both quotes and is
 * exactly right. What separates the two is where the range sits, not what it
 * emits — with one exception, a range that carries a comment through verbatim,
 * which is how a rule moves a token across one.
 */
function unsafeReason(fix: Fix, source: string, comments: IToken[], skipped: Span[]): string | null {
  for (const skip of skipped) {
    if (overlaps(fix.range, skip)) {
      return 'overlaps characters the lexer skipped';
    }
  }

  for (const comment of comments) {
    const span = spanOf(comment);

    if (contains(span, fix.range)) {
      return null;
    }

    if (!overlaps(fix.range, span)) {
      continue;
    }

    if (!contains(fix.range, span)) {
      return 'partially overwrites a comment';
    }

    if (!fix.replacement.includes(source.slice(span.start, span.end))) {
      return 'drops a comment it overwrites';
    }
  }

  return null;
}

/** Every unsafe fix `recommended` produces for `source`, as readable lines. */
function unsafeFixes(source: string): string[] {
  const result = lexer.tokenize(source);
  const comments = result.groups[COMMENT_GROUP] ?? [];
  const skipped = result.errors.map((error) => ({ start: error.offset, end: error.offset + error.length }));
  const out: string[] = [];

  for (const diagnostic of lint(source, recommended)) {
    const { fix } = diagnostic;

    if (fix === undefined) {
      continue;
    }

    const reason = unsafeReason(fix, source, comments, skipped);

    if (reason !== null) {
      out.push(
        `${diagnostic.ruleId} ${reason}: ` +
          `${JSON.stringify(source.slice(fix.range.start, fix.range.end))} -> ${JSON.stringify(fix.replacement)}`,
      );
    }
  }

  return out;
}

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
      const total = allFixtures().reduce(
        (sum, fixture) => sum + fixCount(readFileSync(join(FIXTURES, fixture), 'utf8')),
        0,
      );

      expect(total).toBeGreaterThan(100);
    });

    it('covers fixtures whose comments sit where a fix could swallow them', () => {
      const commented = allFixtures().filter((fixture) => {
        const source = readFileSync(join(FIXTURES, fixture), 'utf8');
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
        expect(unsafeFixes(readFileSync(join(FIXTURES, fixture), 'utf8'))).toEqual([]);
      });
    }
  });
});
