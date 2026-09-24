import type { IToken } from 'chevrotain';
import { format, lint, type Diagnostic, type Fix, type LintConfig } from '../src/index.js';
import { COMMENT_GROUP, WHITESPACE_GROUP, lexer } from '../src/lexer.js';
import { runFormatLoop } from '../src/runner.js';
import { recommended } from '../src/rules/index.js';

/*
 * Properties every script must keep under `recommended`, whatever it contains.
 *
 * Each check takes a script and returns what it found as readable lines, empty
 * when the property holds. None of them needs to know what the script is for,
 * which is what lets them run over any collection of scripts, not only the
 * fixtures they were written against.
 */

export interface Span {
  start: number;
  end: number;
}

const spanOf = (token: IToken): Span => ({
  start: token.startOffset,
  end: (token.endOffset ?? token.startOffset) + 1,
});

const overlaps = (a: Span, b: Span): boolean => a.start < b.end && b.start < a.end;

const contains = (outer: Span, inner: Span): boolean => outer.start <= inner.start && inner.end <= outer.end;

/** A second `format` over the output of the first, when it still changes something. */
export function secondPassChanges(source: string): string[] {
  const first = format(source, recommended);
  const second = format(first.output, recommended);

  if (second.output === first.output && second.fixed === 0) {
    return [];
  }

  return [`a second pass applies ${second.fixed} more fixes`];
}

const BARE_LF = /(?<!\r)\n/g;

/** Every line the formatter ends with a bare LF when the script arrives in CRLF. */
export function bareLineFeeds(source: string): string[] {
  const output = format(source.replace(/\r?\n/g, '\r\n'), recommended).output;

  return [...output.matchAll(BARE_LF)].map(
    (match) => `bare LF ends output line ${output.slice(0, match.index).split('\n').length}`,
  );
}

/*
 * Every lex error `after` has that `before` did not.
 *
 * Errors are matched by the text the lexer skipped, not by where it sits,
 * because formatting moves everything. A script that arrives unreadable in
 * places keeps those places; what must not happen is the formatter writing a
 * new one.
 */
export function unaccountedLexErrors(before: string, after: string): string[] {
  const known = new Map<string, number>();

  for (const error of lexer.tokenize(before).errors) {
    const text = before.slice(error.offset, error.offset + error.length);
    known.set(text, (known.get(text) ?? 0) + 1);
  }

  const out: string[] = [];

  for (const error of lexer.tokenize(after).errors) {
    const text = after.slice(error.offset, error.offset + error.length);
    const count = known.get(text) ?? 0;

    if (count > 0) {
      known.set(text, count - 1);
      continue;
    }

    out.push(`output line ${error.line ?? '?'} skips ${JSON.stringify(text)}`);
  }

  return out;
}

/** Every lex error formatting `source` introduces. */
export function newLexErrors(source: string): string[] {
  return unaccountedLexErrors(source, format(source, recommended).output);
}

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
export function unsafeReason(fix: Fix, source: string, comments: IToken[], skipped: Span[]): string | null {
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

/*
 * Rules whose subject is the comment text itself, and which therefore reformat
 * what they cover instead of carrying it through byte for byte. The verbatim
 * requirement above cannot apply to them; the geometry {@link rewriteReason}
 * checks still does.
 *
 * Membership is deliberate and stays small. A rule that is not about comments
 * and finds itself wanting an entry here is a rule reading the wrong offsets.
 */
const COMMENT_REWRITERS = new Set(['multiline-comment-block']);

/*
 * Why a comment-rewriting rule's fix is unsafe to apply, or null when it is safe.
 *
 * Such a rule cannot be asked to reproduce the text it covers, because
 * rewriting that text is the job. What it can be asked is to reach no further
 * than the comments it rewrites: a range holding comments and the whitespace
 * between them touches nothing else the script carries, whatever it emits in
 * their place.
 */
export function rewriteReason(fix: Fix, comments: IToken[], whitespaces: IToken[], skipped: Span[]): string | null {
  for (const skip of skipped) {
    if (overlaps(fix.range, skip)) {
      return 'overlaps characters the lexer skipped';
    }
  }

  const covering = [...comments, ...whitespaces]
    .map(spanOf)
    .filter((span) => overlaps(fix.range, span))
    .sort((a, b) => a.start - b.start);

  let at = fix.range.start;

  for (const span of covering) {
    if (span.start > at) {
      break;
    }

    at = Math.max(at, span.end);
  }

  return at >= fix.range.end ? null : 'reaches past the comments it rewrites';
}

/** Every unsafe fix `recommended` produces for `source`. */
export function unsafeFixes(source: string): string[] {
  const result = lexer.tokenize(source);
  const comments = result.groups[COMMENT_GROUP] ?? [];
  const whitespaces = result.groups[WHITESPACE_GROUP] ?? [];
  const skipped = result.errors.map((error) => ({ start: error.offset, end: error.offset + error.length }));
  const out: string[] = [];

  for (const diagnostic of lint(source, recommended)) {
    const { fix } = diagnostic;

    if (fix === undefined) {
      continue;
    }

    const reason = COMMENT_REWRITERS.has(diagnostic.ruleId)
      ? rewriteReason(fix, comments, whitespaces, skipped)
      : unsafeReason(fix, source, comments, skipped);

    if (reason !== null) {
      out.push(
        `${diagnostic.ruleId} ${reason}: ` +
          `${JSON.stringify(source.slice(fix.range.start, fix.range.end))} -> ${JSON.stringify(fix.replacement)}`,
      );
    }
  }

  return out;
}

/*
 * Two rules rewriting one stretch of existing text into different things.
 *
 * Overlapping fixes are ordinary: the runner keeps one, and the rule that lost
 * asks again on the next pass. An identical span with two answers falls outside
 * that arbitration, because it has no winner the design chose — the runner
 * keeps whichever rule the config happens to list first, and the other
 * overwrites it on the next pass or backs off.
 *
 * An empty span is a different question and not this one. Two zero-width
 * inserts at one offset never displace each other, so both land; whether the
 * result is right depends on what the two rules emit, and is pinned in their
 * own tests rather than judged from geometry here.
 */
export function clashes(diagnostics: readonly Diagnostic[]): string[] {
  const out: string[] = [];

  for (let i = 0; i < diagnostics.length; i++) {
    for (let j = i + 1; j < diagnostics.length; j++) {
      const a = diagnostics[i];
      const b = diagnostics[j];

      if (a.ruleId === b.ruleId || a.fix === undefined || b.fix === undefined) {
        continue;
      }

      const { start, end } = a.fix.range;

      if (start === end || start !== b.fix.range.start || end !== b.fix.range.end) {
        continue;
      }

      if (a.fix.replacement !== b.fix.replacement) {
        out.push(
          `${a.ruleId} and ${b.ruleId} both rewrite [${start},${end}): ` +
            `${JSON.stringify(a.fix.replacement)} vs ${JSON.stringify(b.fix.replacement)}`,
        );
      }
    }
  }

  return out;
}

/*
 * Every clash the rule set reaches while formatting `source` to a fixed point.
 *
 * The passes come from the real loop rather than a second one written here: a
 * clash the first pass does not show is the interesting kind, because it means
 * one rule's fix moved the script into another rule's reach.
 */
export function clashesWhileFormatting(source: string): string[] {
  const found: string[] = [];

  runFormatLoop(source, (current) => {
    const diagnostics = lint(current, recommended);
    found.push(...clashes(diagnostics));

    return diagnostics;
  });

  return found;
}

/* A shuffle that is the same on every run, so a failure here can be reproduced. */
function seeded(seed: number): () => number {
  let state = seed;

  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;

    return state / 4294967296;
  };
}

function permute<T>(items: readonly T[], next: () => number): T[] {
  const out = [...items];

  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }

  return out;
}

/*
 * The recommended rule set in several config orders. Nothing in the API ranks
 * the rules, so each of these is a configuration a user can write.
 */
function orderings(): LintConfig[] {
  const base = Object.entries(recommended.rules ?? {});

  return [base, [...base].reverse(), ...[1, 2, 3, 4].map((seed) => permute(base, seeded(seed)))].map(
    (entries) => ({ rules: Object.fromEntries(entries) }) as LintConfig,
  );
}

const ORDERINGS = orderings();

/*
 * How `source` formats differently depending on the order the rules are
 * configured in. The runner arbitrates competing fixes by position alone, so
 * where two rules reach for the same characters the winner is whichever the
 * config lists first.
 */
export function orderDependence(source: string): string[] {
  const outputs = new Set(ORDERINGS.map((config) => format(source, config).output));

  return outputs.size === 1 ? [] : [`formats ${outputs.size} different ways depending on rule order`];
}
