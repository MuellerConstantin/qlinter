import { splitLines } from './lines.js';
import type { Diagnostic } from './types.js';

const MIN_LINES = 10;

/**
 * The share of lines in `source` that no diagnostic points at, as a whole number
 * from 0 to 100.
 *
 * Every line counts, blank and comment lines included, and every enabled rule
 * counts the same — a line is conforming or it is not, no matter which rule
 * flagged it or how serious that rule is. A line carrying several findings still
 * counts once, so one badly written line cannot dominate the score, and a
 * finding spanning several lines counts against the line it starts on.
 *
 * The result is meaningful only against the same rule configuration: two scripts
 * linted with different configs are measuring different things.
 *
 * @param source - The script the diagnostics were produced from.
 * @param diagnostics - The result of {@link lint} over that script.
 * @returns The score, or `null` for a script too short to score.
 *
 * @example
 * ```ts
 * import { lint, conformanceScore, recommended } from '@qlinter/core';
 *
 * const score = conformanceScore(source, lint(source, recommended));
 * console.log(score === null ? 'too short to score' : `${score}%`);
 * ```
 */
export function conformanceScore(source: string, diagnostics: readonly Diagnostic[]): number | null {
  const total = splitLines(source).length;

  if (total < MIN_LINES) {
    return null;
  }

  const flagged = new Set(diagnostics.map((diagnostic) => diagnostic.range.start.line));
  let conforming = 0;

  /*
   * Counted by walking the lines rather than subtracting the flagged ones, so a
   * diagnostic pointing outside the script cannot push the count below zero.
   */
  for (let line = 1; line <= total; line++) {
    if (!flagged.has(line)) {
      conforming++;
    }
  }

  // Rounded down, so 100 is reached only when every single line is clean.
  return Math.floor((conforming / total) * 100);
}
