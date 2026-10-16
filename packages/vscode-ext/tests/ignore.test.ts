import { describe, expect, it } from 'vitest';
import { lint } from '@qlinter/core';
import { ignoreEdit, type IgnoreEdit } from '../src/ignore.js';

function edit(lines: readonly string[], line: number, ruleId: string, eol = '\n'): IgnoreEdit | undefined {
  return ignoreEdit((index) => lines[index] ?? '', line, ruleId, eol);
}

function apply(lines: readonly string[], change: IgnoreEdit, eol = '\n'): string {
  const copy = [...lines];

  if (change.kind === 'insert') {
    copy.splice(change.line, 0, change.text.slice(0, -eol.length));
  } else {
    copy[change.line] = change.text;
  }

  return copy.join(eol);
}

describe('ignoreEdit', () => {
  it('inserts a directive above the line, indented like it', () => {
    expect(edit(['If x Then', '  Set a = 1;', 'End If'], 1, 'variable-case')).toEqual({
      kind: 'insert',
      line: 1,
      text: '  // qlinter-disable-next-line variable-case\n',
    });
  });

  it('inserts above the first line', () => {
    expect(edit(['Set a = 1;'], 0, 'variable-case')).toEqual({
      kind: 'insert',
      line: 0,
      text: '// qlinter-disable-next-line variable-case\n',
    });
  });

  it("ends the inserted line with the document's own line break", () => {
    expect(edit(['Set a = 1;'], 0, 'variable-case', '\r\n')?.text).toBe(
      '// qlinter-disable-next-line variable-case\r\n',
    );
  });

  it('appends the rule to a directive already above the line', () => {
    expect(edit(['  // qlinter-disable-next-line comma-space', '  Set a = 1;'], 1, 'variable-case')).toEqual({
      kind: 'replace',
      line: 0,
      text: '  // qlinter-disable-next-line comma-space, variable-case',
    });
  });

  it('offers nothing when the directive already names the rule', () => {
    expect(edit(['// qlinter-disable-next-line variable-case', 'Set a = 1;'], 1, 'variable-case')).toBeUndefined();
  });

  it('offers nothing when a directive without a rule list disables every rule', () => {
    expect(edit(['// qlinter-disable-next-line', 'Set a = 1;'], 1, 'variable-case')).toBeUndefined();
  });

  it('inserts rather than extends when the line above is an ordinary comment', () => {
    expect(edit(['// load the facts', 'Set a = 1;'], 1, 'variable-case')?.kind).toBe('insert');
  });

  it.each([
    ['a new directive', ['Set a=1;']],
    ['an extended directive', ['// qlinter-disable-next-line comma-space', 'Set a=1;']],
  ])('silences the diagnostic through %s', (_name, lines) => {
    const config = { rules: { 'operator-spacing': 'warning' as const } };
    const line = lines.length - 1;
    const change = edit(lines, line, 'operator-spacing');

    expect(lint(lines.join('\n'), config)).not.toHaveLength(0);
    expect(change).toBeDefined();
    expect(lint(apply(lines, change!), config)).toHaveLength(0);
  });
});
