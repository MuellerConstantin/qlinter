import { describe, expect, it } from 'vitest';
import { conformanceScore } from '../src/index.js';
import type { Diagnostic } from '../src/index.js';
import { trailingWhitespace } from '../src/rules/index.js';
import { lintRule } from './support.js';

/** A diagnostic covering `start` to `end`, standing in for whichever rule produced it. */
function at(start: number, end = start): Diagnostic {
  return {
    ruleId: 'trailing-whitespace',
    severity: 'warning',
    range: { start: { line: start, column: 1 }, end: { line: end, column: 1 } },
    message: 'test finding',
  };
}

function script(lineCount: number): string {
  return Array.from({ length: lineCount }, (_, index) => `Set vValue${index} = ${index};`).join('\n');
}

describe('conformanceScore', () => {
  it('declines to score a script shorter than ten lines', () => {
    expect(conformanceScore(script(9), [])).toBeNull();
  });

  it('scores a script of exactly ten lines', () => {
    expect(conformanceScore(script(10), [])).toBe(100);
  });

  it('reaches 100 only when no line is flagged', () => {
    expect(conformanceScore(script(20), [])).toBe(100);
    expect(conformanceScore(script(20), [at(4)])).toBe(95);
  });

  it('counts a line once however many findings land on it', () => {
    expect(conformanceScore(script(20), [at(4), at(4), at(4)])).toBe(95);
  });

  it('counts a multi-line finding against the line it starts on', () => {
    expect(conformanceScore(script(20), [at(4, 9)])).toBe(95);
  });

  it('counts blank and comment lines towards the total', () => {
    const source = [
      'Set vA = 1;',
      '',
      '// a note',
      '',
      'Set vB = 2;',
      '',
      '// another',
      '',
      'Set vC = 3;',
      '',
      '// last',
      'Set vD = 4;',
    ].join('\n');

    // Twelve lines, one of them flagged — not four code lines, one of them flagged.
    expect(conformanceScore(source, [at(1)])).toBe(91);
  });

  it('rounds down, so a nearly clean script never reads as perfect', () => {
    expect(conformanceScore(script(200), [at(7)])).toBe(99);
  });

  it('ignores a finding pointing past the end of the script', () => {
    expect(conformanceScore(script(20), [at(80)])).toBe(100);
  });

  it('counts the same lines whichever line ending the script uses', () => {
    const lf = script(20);

    expect(conformanceScore(lf.replace(/\n/g, '\r\n'), [at(4)])).toBe(conformanceScore(lf, [at(4)]));
  });

  it('scores the diagnostics a real lint run produces', () => {
    const source = Array.from({ length: 12 }, (_, index) =>
      index === 2 || index === 6 ? `Set vValue${index} = ${index};   ` : `Set vValue${index} = ${index};`,
    ).join('\n');

    const diagnostics = lintRule(source, trailingWhitespace);

    expect(diagnostics).toHaveLength(2);
    expect(conformanceScore(source, diagnostics)).toBe(83);
  });
});
