/** Mirrors the directive pattern Core reads, so an extended directive is still one Core accepts. */
const DIRECTIVE_PATTERN = /^([ \t]*\/\/[ \t]*qlinter-disable-next-line)(?:[ \t]+(.+?))?[ \t]*$/;

/** A line-level edit: insert a new line before `line`, or replace the text of `line`. */
export type IgnoreEdit =
  | { readonly kind: 'insert'; readonly line: number; readonly text: string }
  | { readonly kind: 'replace'; readonly line: number; readonly text: string };

/**
 * Computes the edit that disables `ruleId` on `line` through a
 * `// qlinter-disable-next-line` directive: a new directive above the line,
 * indented like it, or the rule appended to a directive already there.
 *
 * @param getLine - Returns the text of a 0-based line, without its line break.
 * @param line - 0-based line the diagnostic starts on.
 * @param ruleId - Rule to disable.
 * @param eol - Line break the document already uses.
 * @returns The edit, or `undefined` when the rule is already disabled there.
 */
export function ignoreEdit(
  getLine: (line: number) => string,
  line: number,
  ruleId: string,
  eol: string,
): IgnoreEdit | undefined {
  const match = line > 0 ? DIRECTIVE_PATTERN.exec(getLine(line - 1)) : null;

  if (!match) {
    const indent = /^[ \t]*/.exec(getLine(line))?.[0] ?? '';
    return { kind: 'insert', line, text: `${indent}// qlinter-disable-next-line ${ruleId}${eol}` };
  }

  const [, directive, list] = match;

  // A directive without a rule list already disables every rule on the line.
  if (list === undefined) {
    return undefined;
  }

  const ids = list
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  if (ids.includes(ruleId)) {
    return undefined;
  }

  return { kind: 'replace', line: line - 1, text: `${directive} ${[...ids, ruleId].join(', ')}` };
}
