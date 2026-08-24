import { describe, expect, it } from 'vitest';
import { format } from '../src/index.js';
import { recommended } from '../src/rules/index.js';

/*
 * The *statement header* of a LOAD is everything the statement spends on its own
 * head before the field list: a label, a prefix chain (`Left Join(X)`,
 * `NoConcatenate`, `CrossTable(...)`, `First 10`, ...), the `Load` keyword, and
 * an optional `Distinct`.
 *
 * qlinter takes a deliberate position on the header, and this file is where that
 * position is written down rather than left to emerge from whichever rule
 * happens to reach a line first:
 *
 *   1. **Where the header breaks is the author's call.** One line, three lines,
 *      prefix split off its `Load` — all accepted. The header is a short
 *      fixed-arity sequence whose line breaks carry emphasis (a `Left Join` on
 *      its own line is hard to miss), unlike the field list, where
 *      `load-field-per-line` does pick a shape.
 *   2. **Where the header sits horizontally is not.** Every header line belongs
 *      at the statement's own indent, so the field list one step deeper reads as
 *      subordinate to it.
 *
 * Point 2 used to be nobody's job: `block-indent` claims only the opening line
 * and `load-indent` only fields and clauses, so a `Load` torn off its prefix
 * fell through to `continuation-indent` and was pushed one level in — landing on
 * the same column as the fields it introduces. The shapes below are checked
 * against the full `recommended` preset, because that gap was an interaction
 * between rules that each looked correct on its own.
 */

interface Shape {
  readonly name: string;
  readonly source: string;
}

const ACCEPTED: readonly Shape[] = [
  {
    name: 'label and Load on one line',
    source: ['[A]: Load', '    Id', 'Resident [B];', ''].join('\n'),
  },
  {
    name: 'Load on its own line',
    source: ['[A]:', 'Load', '    Id', 'Resident [B];', ''].join('\n'),
  },
  {
    name: 'parenthesised join prefix on its own line',
    source: ['[A]:', 'Left Join(X)', 'Load', '    Id', 'Resident [B];', ''].join('\n'),
  },
  {
    name: 'bare join prefix on its own line',
    source: ['[A]:', 'Left Join', 'Load', '    Id', 'Resident [B];', ''].join('\n'),
  },
  {
    name: 'NoConcatenate on its own line',
    source: ['[A]:', 'NoConcatenate', 'Load', '    Id', 'Resident [B];', ''].join('\n'),
  },
  {
    name: 'Distinct on its own line',
    source: ['[A]:', 'Load', 'Distinct', '    Id', 'Resident [B];', ''].join('\n'),
  },
  {
    name: 'prefix, Load and Distinct each on their own line',
    source: ['[A]:', 'NoConcatenate', 'Load', 'Distinct', '    Id', 'Resident [B];', ''].join('\n'),
  },
  {
    name: 'prefix and Load joined on one line',
    source: ['[A]:', 'Left Join(X) Load', '    Id', 'Resident [B];', ''].join('\n'),
  },
  {
    name: 'whole header on one line',
    source: ['[A]:', 'NoConcatenate Load Distinct', '    Id', 'Resident [B];', ''].join('\n'),
  },
  {
    name: 'Load and Distinct joined, prefix split off',
    source: ['[A]:', 'Left Join(X)', 'Load Distinct', '    Id', 'Resident [B];', ''].join('\n'),
  },
  {
    name: 'Keep prefix',
    source: ['[A]:', 'Inner Keep(X)', 'Load', '    Id', 'Resident [B];', ''].join('\n'),
  },
  {
    name: 'Concatenate with a table argument',
    source: ['[A]:', 'Concatenate([B])', 'Load', '    Id', 'Resident [B];', ''].join('\n'),
  },
  {
    name: 'First prefix with a count',
    source: ['[A]:', 'First 10', 'Load', '    Id', 'Resident [B];', ''].join('\n'),
  },
  {
    name: 'CrossTable prefix',
    source: ['[A]:', 'CrossTable(Month, Sales, 1)', 'Load', '    Id', 'Resident [B];', ''].join('\n'),
  },
  {
    name: 'Mapping prefix',
    source: ['[A]:', 'Mapping', 'Load', '    Id,', '    Name', 'Resident [B];', ''].join('\n'),
  },
  {
    name: 'Add prefix',
    source: ['[A]:', 'Add', 'Load', '    Id', 'Resident [B];', ''].join('\n'),
  },
  {
    name: 'Hierarchy prefix',
    source: ['[A]:', 'Hierarchy(NodeId, ParentId, NodeName)', 'Load', '    NodeId', 'Resident [B];', ''].join('\n'),
  },
  {
    name: 'stacked Join and IntervalMatch prefixes',
    source: ['[A]:', 'Left Join([M]) IntervalMatch (Stichtag, PERNR)', 'Load', '    BEGDA', 'Resident [B];', ''].join(
      '\n',
    ),
  },
  {
    name: 'header inside a Sub, at the Sub-body indent',
    source: [
      'Sub s',
      '    [A]:',
      '    Left Join(X)',
      '    Load',
      '        Id',
      '    Resident [B];',
      'End Sub',
      '',
    ].join('\n'),
  },
  /*
   * A prefix whose *argument list* is wrapped is not a header line but a
   * genuine continuation of an expression, and keeps hanging one level off the
   * line that opens the statement. Only the `Load` below it is header.
   */
  {
    name: 'prefix with a wrapped argument list',
    source: ['[A]:', 'CrossTable(Month, Sales,', '    1)', 'Load', '    Id', 'Resident [B];', ''].join('\n'),
  },
];

interface Normalization extends Shape {
  readonly expected: string;
}

const NORMALIZED: readonly Normalization[] = [
  {
    name: 'header indented as if it were a continuation',
    source: ['[A]:', 'Left Join(X)', '    Load', '    Distinct', '    Id', 'Resident [B];', ''].join('\n'),
    expected: ['[A]:', 'Left Join(X)', 'Load', 'Distinct', '    Id', 'Resident [B];', ''].join('\n'),
  },
  {
    name: 'header indented past the field list',
    source: ['[A]:', 'NoConcatenate', '        Load', '    Id', 'Resident [B];', ''].join('\n'),
    expected: ['[A]:', 'NoConcatenate', 'Load', '    Id', 'Resident [B];', ''].join('\n'),
  },
  {
    name: 'header outdented out of its Sub',
    source: ['Sub s', '    [A]:', '    Left Join(X)', 'Load', '        Id', '    Resident [B];', 'End Sub', ''].join(
      '\n',
    ),
    expected: [
      'Sub s',
      '    [A]:',
      '    Left Join(X)',
      '    Load',
      '        Id',
      '    Resident [B];',
      'End Sub',
      '',
    ].join('\n'),
  },
  {
    name: 'header indented with tabs under the space style',
    source: ['[A]:', 'Left Join(X)', '\tLoad', '    Id', 'Resident [B];', ''].join('\n'),
    expected: ['[A]:', 'Left Join(X)', 'Load', '    Id', 'Resident [B];', ''].join('\n'),
  },
];

describe('LOAD statement header', () => {
  describe('line arrangement is the author’s call', () => {
    for (const { name, source } of ACCEPTED) {
      it(`leaves ${name} alone`, () => {
        const result = format(source, recommended);

        expect(result.output).toBe(source);
        expect(result.fixed).toBe(0);
      });
    }
  });

  describe('horizontal position is enforced', () => {
    for (const { name, source, expected } of NORMALIZED) {
      it(`pulls ${name} back to the statement indent`, () => {
        const result = format(source, recommended);

        expect(result.output).toBe(expected);
        expect(result.diagnostics.filter((d) => d.fix)).toEqual([]);
      });
    }
  });

  /*
   * Rewriting an accepted shape into another accepted shape would be a silent
   * change of position on point 1 above, so pin the two directions explicitly:
   * a split header is never joined, and a joined one is never split.
   */
  it('never joins a split header onto one line', () => {
    const source = ['[A]:', 'Left Join(X)', 'Load', 'Distinct', '    Id', 'Resident [B];', ''].join('\n');

    expect(format(source, recommended).output).toContain('Left Join(X)\nLoad\nDistinct\n');
  });

  it('never splits a joined header across lines', () => {
    const source = ['[A]:', 'Left Join(X) Load Distinct', '    Id', 'Resident [B];', ''].join('\n');

    expect(format(source, recommended).output).toContain('Left Join(X) Load Distinct\n');
  });
});
