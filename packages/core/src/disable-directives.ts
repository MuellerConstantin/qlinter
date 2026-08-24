/**
 * Inline directive that suppresses lint diagnostics on the next source line.
 *
 *   // qlinter-disable-next-line
 *   // qlinter-disable-next-line rule-id
 *   // qlinter-disable-next-line rule-a, rule-b
 *
 * Without rule IDs every diagnostic on the following line is suppressed; with
 * rule IDs only matching diagnostics are.
 */
const DIRECTIVE_PATTERN = /^[ \t]*\/\/[ \t]*qlinter-disable-next-line(?:[ \t]+(.+?))?[ \t]*$/;

export type DisabledLines = Map<number, Set<string> | 'all'>;

export function collectDisabledLines(source: string): DisabledLines {
  const disabled: DisabledLines = new Map();
  const lines = source.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const match = DIRECTIVE_PATTERN.exec(lines[i]);

    if (!match) {
      continue;
    }

    const targetLine = i + 2;
    const idList = match[1];

    if (idList === undefined) {
      disabled.set(targetLine, 'all');
      continue;
    }

    const existing = disabled.get(targetLine);

    if (existing === 'all') {
      continue;
    }

    const ids = idList
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
    const set = existing ?? new Set<string>();

    for (const id of ids) {
      set.add(id);
    }

    disabled.set(targetLine, set);
  }

  return disabled;
}

export function isDisabled(disabled: DisabledLines, line: number, ruleId: string): boolean {
  const entry = disabled.get(line);

  if (entry === undefined) {
    return false;
  }

  if (entry === 'all') {
    return true;
  }

  return entry.has(ruleId);
}
