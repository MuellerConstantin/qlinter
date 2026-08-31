---
name: qlinter-rule
description: Add, modify, rename, or remove a qlinter lint rule in packages/core. Use whenever the user asks to "add a rule", "create a new lint rule", "modify the X rule", "rename a rule", "remove a rule", "add an autofix to X", or otherwise edits files under packages/core/src/rules/. Enforces the rule file shape, the test+fixture layout, the four-step registration in rules/index.ts, the docs entry in packages/core/docs/rules.md, and protects the public rule contract from accidental changes.
---

# qlinter-rule

Scaffold and maintain qlinter lint rules consistently across rule file, registration,
tests, fixtures, and docs. The rule contract is a public API the CLI and the Chrome
extension depend on — keep it stable.

## When to use

- Adding a new rule.
- Modifying an existing rule's logic, message, severity, options, or fix.
- Renaming a rule (id, file, export, test, fixture dir, docs section all change).
- Removing a rule.
- Adding or removing an autofix on an existing rule.

## Rule scope

**One rule answers one question.** If a rule's description needs an "and", it is two
rules. When in doubt, split: two narrow rules compose through the format loop, while
one broad rule cannot be half-disabled — users set severity per rule id, and merging
takes that dial away from them.

The converse matters just as much: **one question stays one rule, even when it has
several defensible answers.** Tab versus space, two versus four, camel versus pascal
are values of one dimension and belong in an option on a single rule.
`indent-tab`, `indent-4-spaces` and `indent-2-spaces` would be three rules answering
the same question. Split by _question_, never by _value_.

Keep the axes apart. The main ones here:

| Axis            | Question                                   | Examples                                             |
| --------------- | ------------------------------------------ | ---------------------------------------------------- |
| **Placement**   | Which line does this token go on?          | `load-clause-newline`, `load-field-per-line`         |
| **Indentation** | Which column does that line start at?      | `block-indent`, `load-indent`, `continuation-indent` |
| **Spacing**     | What sits between two tokens on one line?  | `comma-space`, `operator-spacing`, `paren-spacing`   |
| **Naming**      | How is this identifier or keyword spelled? | `variable-case`, `builtin-keyword-case`              |

A rule that reaches across two axes is the one to split. `comma-space` governs the
space after a comma; whether a comma may _open a line_ is a placement question and
belongs in its own rule rather than bolted onto the spacing one.

### Every line needs exactly one owner

This is the failure mode that has produced real bugs here, more than once. The indent
rules partition lines between them: `block-indent` takes statement starts,
`load-indent` takes the header, field and clause lines of a LOAD, and
`continuation-indent` takes **everything left over**. That last one is a catch-all, so
a line your rule declines to claim does not become unmanaged — it silently becomes a
continuation line and is indented one level in.

So when writing or changing a rule, ask what happens to the tokens it does _not_
claim. Past bugs, all the same shape:

- A `Load` torn off its prefix was claimed by nobody, so `continuation-indent` pushed
  it to the same column as the field list it introduces.
- A lone `*` was exempted from the field rules, so `continuation-indent` indented it
  instead — landing on the right column by coincidence, which hid the gap for months.
- A leading comma opens a line no rule claims, and ends up two levels deep.

All three **converged**, so the fixture-corpus sweep in `tests/format.test.ts` did not
catch them. Convergence proves the rules do not fight; it does not prove the shape
they agree on is the intended one. Pin intended shapes down in a contract suite —
`tests/load-header.test.ts` is the model.

### Rules compose through the format loop, not through each other

A rule never calls another rule and never assumes another has already run. Each
`check` must be correct on the raw input it is handed. The runner re-lints after every
fix pass, so a fix that creates a new line (`load-clause-newline` inserting a `\n`) is
picked up by the indent rules on the next pass — that is the intended handoff, and the
reason a rule should not try to do a neighbour's job "while it is in there anyway".

**A rule file never imports from another rule file.** Not a helper, not a type, not a
constant — the dependency graph runs rule → `utils/`, never rule → rule. A rule that
reaches into a neighbour couples the two in both directions: the neighbour can no
longer change a helper without breaking a rule that does not appear in its tests, and
the importing rule stops being readable on its own terms.

When two rules need the same thing, there are exactly two correct answers. If it is
small and self-contained, **write it twice** — a four-line predicate in two files is
cheaper than a coupling. If it is large, subtle, or something the two rules must
_agree_ on to stay consistent, **put it in `utils/`**, where it has one owner and one
set of tests.

### What a word _is_ belongs to the lexer

Before adding a keyword set to a rule or to `utils/`, stop. "Which words close a
block", "which words end a statement" are claims about Qlik's vocabulary, and
vocabulary lives in [lexer.ts](../../../packages/core/src/lexer.ts) next to `KEYWORDS`
— as chevrotain **token categories**, not as a `Set<string>` compared against
`token.image`:

```ts
export const blockCloseToken = createToken({ name: 'BlockClose', pattern: Lexer.NA });
// the concrete keyword opts in via `categories: [keywordToken, blockCloseToken]`
```

Rules then ask `tokenMatcher(token, blockCloseToken)`. Two things follow:

- **Never compare token types with `===`.** A token carrying a category is not
  identical to it: `tokenType === keywordToken` is false for `End`, and
  `tokenType === semicolonToken` is false for the `;` that closes a `Trace`. Always
  `tokenMatcher`. An identity check here already caused one silent bug, where a Trace
  statement was merged with the statement after it.
- **What a rule _does_ with a word stays the rule's business.** Whether a block opener
  indents its body, whether its header is assumed to fit on one line — layout
  decisions, and they stay in the rule. `SINGLE_LINE_HEADER` in `utils/statements.ts`
  is the one such assumption left, and it says so.

Core has **no parser and no AST**, deliberately — that is what keeps the linter light,
not a gap waiting to be filled. A rule needing binding, scope, or expression structure
("is this identifier a field or a table", "is this variable unused", anything about
operator precedence) is a rule this project does not ship. Decline it rather than
approximating it with more keyword sets.

Shared vocabulary that is genuinely the rules' own lives in
`packages/core/src/rules/utils/`:

- `tokens.ts` — token-shape predicates (`isKeyword`, `isOpenParen`, ...).
- `lines.ts` — the source's line ending, grouping tokens by line, splitting it into spans, deciding which of those are blank, and which are carried inside a multi-line token.
- `blocks.ts` — what a statement-start line does to the block structure around it: opens a body, closes one, or (for `Else`/`Case`) both.
- `statements.ts` — statement splitting, statement line spans, LOAD field-list boundaries, and whether a line closes its statement.
- `indent.ts` — indent style vocabulary and option schema, the shared indent check and finding builder.
- `load-anchors.ts` — which lines of a LOAD are header, field, and clause anchors: the split `load-indent` enforces and `continuation-indent` takes the complement of.
- `fixes.ts` — fix-range construction that preserves comments.

## Naming contract

For a rule named `my-rule`, all five identifiers share the same kebab-case stem:

| Artifact          | Path / name                                   |
| ----------------- | --------------------------------------------- |
| Rule file         | `packages/core/src/rules/my-rule.ts`          |
| Exported binding  | `myRule` (camelCase)                          |
| Rule id literal   | `'my-rule'`                                   |
| Test file         | `packages/core/tests/rules/my-rule.test.ts`   |
| Fixture directory | `packages/core/tests/rules/fixtures/my-rule/` |

## Public contract — do not edit

A new or modified rule must **never** edit these files:

- `packages/core/src/types.ts` — the shared type vocabulary: `Rule`, `RuleContext`, `Finding`, `Diagnostic`, `Fix`, `Range`, `Severity`, `Position`, `SeverityOrOff`, `RuleConfigEntry`, `AnyRule`, `RulesConfigOf`, `FormatResult`.
- `packages/core/src/runner.ts` — `lint`, `format`, `applyFixes`, `runFormatLoop`.
- `packages/core/src/token.ts` — `tokenRange`, `tokenFix`.
- `packages/core/src/disable-directives.ts` — disable wiring is automatic; rules need no participation.
- `packages/core/src/config/` — `validateConfig` and `validateOptions`. A rule describes its options through its own `options` schema; the validator reads that schema and needs no per-rule knowledge.

`packages/core/src/rules/index.ts` holds the rule **registry**, the `LintConfig` /
`RulesConfig` / `RuleId` types, and the preset machinery (`recommended`, `PresetName`,
`resolveConfig`). You edit this file to register a rule (see below), but touch only the
import, `allRules`, options re-export, and named-export lines — never the registry,
presets, or config machinery.

If a rule appears to need a change in one of these files, **stop and confirm with
the user first**. State which downstream consumer (CLI, Chrome extension) is
affected and why the rule's own `options` type cannot cover the need. Do not edit
these files without explicit approval.

## Anatomy of a rule

The contract from [types.ts](../../../packages/core/src/types.ts):

```ts
type Rule<O = undefined, Id extends string = string> = {
  id: Id;
  defaultSeverity: Severity;
  defaultOptions?: O;
  check(ctx: RuleContext, options: O): Finding[];
} & ([O] extends [undefined] ? { options?: never } : { options: OptionsSchemaOf<O> });

type OptionSchema = { type: 'number'; min?: number; max?: number } | { type: 'enum'; values: readonly string[] };

interface RuleContext {
  source: string;
  tokens: IToken[];
  firstOnLine: IToken[];
  comments: IToken[];
}

type Finding = Omit<Diagnostic, 'ruleId' | 'severity'>; // range, message, fix?
```

Severity is declared once on the rule via `defaultSeverity` — the runner attaches it
to every finding the rule emits (or overrides it from the user config). Findings
themselves only carry location, message, and optional fix.

A rule **with** options must also declare `options`, a per-key `OptionSchema` that
`validateConfig` validates against and that host settings UIs (the Chrome extension's
options page) render controls from. It is required by the type, so a rule with
options cannot compile without it. A rule **without** options must leave it off.

Enum values live in a `as const` array, and the union type is derived from it — never
the other way round. Types are erased at runtime, so a hand-written union alone leaves
the validator and the UI with no values to check or render:

```ts
export const MY_RULE_STYLES = ['a', 'b'] as const;
export type MyRuleStyle = (typeof MY_RULE_STYLES)[number];
```

If an option needs a type `OptionSchema` has no variant for — a boolean, a nested
object — the rule will not compile, and the error names the unsupported type. That is
deliberate: extending the union means also extending its exhaustive consumers
(`validateOptions` in `src/config/options.ts` and the extension's options renderer),
and both fail to compile until you do. Prefer validating an exotic shape inside the
rule's own `check` over widening the union.

Helpers in [token.ts](../../../packages/core/src/token.ts):

- `tokenRange(token)` — converts a chevrotain `IToken` to a `Range`.
- `tokenFix(token, replacement)` — `Fix` that replaces a single token.

### Template: rule without options, with autofix

```ts
import type { Rule, Finding } from '../types.js';

export const myRule: Rule<undefined, 'my-rule'> = {
  id: 'my-rule',
  defaultSeverity: 'warning',
  defaultOptions: undefined,
  check: ({ source }) => {
    const out: Finding[] = [];

    // ... detect violations, push Findings ...
    out.push({
      range: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
      message: 'Describe the violation.',
      fix: { range: { start: 0, end: 1 }, replacement: '' }, // optional
    });

    return out;
  },
};
```

### Template: rule with options

```ts
import { keywordToken } from '../lexer.js';
import type { Rule, Finding } from '../types.js';
import { tokenRange } from '../token.js';

export const MY_RULE_STYLES = ['a', 'b'] as const;

export type MyRuleStyle = (typeof MY_RULE_STYLES)[number];

export interface MyRuleOptions {
  style: MyRuleStyle;
}

export const myRule: Rule<MyRuleOptions, 'my-rule'> = {
  id: 'my-rule',
  defaultSeverity: 'warning',
  defaultOptions: { style: 'a' },
  options: { style: { type: 'enum', values: MY_RULE_STYLES } },
  check: ({ tokens }, { style }) => {
    const out: Finding[] = [];

    for (const token of tokens) {
      if (token.tokenType !== keywordToken) {
        continue;
      }
      // ... use `style` ...
      out.push({
        range: tokenRange(token),
        message: `Violation in ${style} style.`,
      });
    }

    return out;
  },
};
```

### General notes

- `defaultSeverity`: `'error' | 'warning' | 'info'`. Default for new rules: `'warning'`.
  Use `'error'` only when the script is broken or near-broken; `'info'` for purely
  stylistic nudges. The runner attaches this to every finding the rule emits; do
  not set severity in the finding itself.
- `range`: 1-based `line`/`column`, end-exclusive. Use `tokenRange()` for token
  scoped findings.
- `fix.range`: **byte offsets** into `source` (0-based), not line/column. Use
  `tokenFix()` for token-scoped replacements.
- `fix` is optional. Omit it entirely if the rule cannot safely auto-fix.
- Disable directives (`// qlinter-disable-next-line my-rule`) are handled by the
  runner — do not implement them in the rule.
- Before adding a new rule, check whether an existing rule already owns that
  question. Extend it only when it is genuinely the _same_ question, not merely a
  neighbouring one — see [Rule scope](#rule-scope).
- **Options are for dimensions.** Where a rule has a natural dimension with several
  defensible values — `size`, `style`, `max`, case style — expose it as one option
  instead of shipping a rule per value.
- **But an option is not a prerequisite for a rule.** Where there is genuinely only
  one sensible shape, the rule ships with `defaultOptions: undefined`; most layout
  rules here do, and that is deliberate, not a gap. `severity: 'off'` stays the
  escape hatch. What is never an option is a switch whose two values amount to
  "enforce" and "do nothing" — that switch already exists.

## Registration in `rules/index.ts`

Four edits, alphabetical placement, in this order:

1. **Import:**
   ```ts
   import { myRule } from './my-rule.js';
   ```
2. **Options re-export** (only if the rule has options) — the types, plus the `as const`
   value array so hosts can enumerate the allowed values at runtime:
   ```ts
   export { MY_RULE_STYLES } from './my-rule.js';
   export type { MyRuleOptions, MyRuleStyle } from './my-rule.js';
   ```
   Re-export both from `src/index.ts` as well; a value array that never reaches the
   public entry point cannot be read by the CLI or either extension.
3. **Add to the `allRules` array** (always — every existing rule is in this list). The
   registry and the `recommended` config both derive from `allRules`, so this single
   edit enables the rule everywhere.
4. **Add to the named `export { ... }` block** at the bottom.

## Tests + fixtures

Layout for `my-rule`:

```
packages/core/tests/rules/
├── my-rule.test.ts
└── fixtures/
    └── my-rule/
        ├── violation.qvs
        └── clean.qvs
```

Fixtures are plain `.qvs` Qlik script — no metadata. `violation.qvs` must trigger
the rule at least once; `clean.qvs` must not trigger it at all.

Helper: `lintFixture(kind, rule, options?)` from
[helpers.ts](../../../packages/core/tests/rules/helpers.ts) reads
`fixtures/{rule.id}/{kind}.qvs` and lints it with the given rule at its default
severity, optionally passing rule `options`. For inline sources (not fixtures) use
`lintRule` / `formatRule` (single rule) or `lintRules` / `formatRules` (several rules)
from [support.ts](../../../packages/core/tests/support.ts).

### Test template

```ts
import { describe, expect, it } from 'vitest';
import { myRule } from '../../src/rules/index.js';
import { lintFixture } from './helpers.js';
import { formatRule } from '../support.js';

describe('my-rule', () => {
  it('flags violations in the violation fixture', () => {
    const diagnostics = lintFixture('violation', myRule);

    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics[0]).toMatchObject({
      ruleId: 'my-rule',
      severity: 'warning',
    });
  });

  it('does not flag the clean fixture', () => {
    const diagnostics = lintFixture('clean', myRule);

    expect(diagnostics).toEqual([]);
  });

  // Only if the rule provides a fix:
  it('autofixes the violation', () => {
    const result = formatRule('<input>', myRule);

    expect(result.output).toBe('<expected output>');
    expect(result.fixed).toBeGreaterThan(0);
    expect(result.diagnostics).toEqual([]);
  });
});
```

For rules with options, add a nested `describe('style option', ...)` block that passes
the options as the third argument to `lintFixture` (e.g.
`lintFixture('clean', myRule, { style: 'b' })`) — see `variable-case.test.ts` for the
pattern.

Disable-directive behavior is covered centrally; do not test it per rule.

## Comments in a rule file

The rule reference is the place for everything a user would ask. A comment in the
rule file is for whoever edits that line next, and nothing else:

- **No other rule's name appears in a comment.** It couples the two in the reader's
  head even where the code does not, and rots the moment the neighbour changes. A
  genuine shared agreement lives in `rules/utils/` and is explained there once.
- **No worked examples.** A snippet in a comment is unchecked; the same snippet as a
  fixture or a docs block is not. One line at most, or leave it out.
- **No design discussion.** Record the conclusion, not the argument that reached it. A
  justification that needs a paragraph is a `docs/rules.md` change.

Rationale that fails these tests is rarely worthless — it is usually in the wrong file.
Move it to the rule's docs section rather than deleting it.

## Docs entry — `packages/core/docs/rules.md`

This file is the public rules reference. On the first invocation of this skill, if
the file does not exist, bootstrap it with a short intro and one section per
existing rule (extract id, severity, options shape, and a small example from each
rule file in `packages/core/src/rules/`).

For every new or modified rule, write or update its section using this template:

```markdown
## `my-rule`

<one-line purpose>

- **Default severity:** warning
- **Autofix:** yes | no
- **Options:**

  | Field   | Type         | Default | Range | Description |
  | ------- | ------------ | ------- | ----- | ----------- |
  | `style` | `'a' \| 'b'` | `'a'`   | —     | ...         |

  _(Omit the Options block entirely if the rule has no options. The Range column
  carries the `min`–`max` of a number option and `—` for anything else; it is the
  documented face of what `validateConfig` enforces, so keep the two in step.)_

**Violates:**

\`\`\`qvs
<minimal violating snippet>
\`\`\`

**Passes:**

\`\`\`qvs
<minimal clean snippet>
\`\`\`
```

Keep sections alphabetical by rule id.

## Workflow

When invoked, walk this checklist in order. Skip steps that do not apply.

1. **Identify intent.** Add / modify / rename / remove? For modify and remove,
   confirm which existing rule and which aspect. For add, settle the scope first
   (see [Rule scope](#rule-scope)): what single question does it answer, which axis
   is it on, and which lines or tokens does it claim — and which does it leave to
   somebody else?
2. **Bootstrap docs if missing.** If `packages/core/docs/rules.md` does not exist,
   create it and seed entries for the existing rules before proceeding.
3. **Write/edit the rule file** following the templates above. Stay inside the
   rule file — never touch `types.ts`, `runner.ts`, or `disable-directives.ts`.
4. **Update `rules/index.ts`** with the four registration edits (alphabetical).
5. **Write/edit the test file** with at least violation + clean assertions, plus
   a `format()` assertion if the rule has a fix.
6. **Write/edit the fixtures** (`violation.qvs`, `clean.qvs`).
7. **Write/edit the docs section** in `packages/core/docs/rules.md`.
8. **Run the tests:** `npm test --workspace packages/core`. Fix any failures; do
   not declare the task complete with red tests.

For **rename**, update all five artifacts (file, export, id literal, test file,
fixture directory) plus the docs section heading plus the four entries in
`rules/index.ts` in a single pass — leave nothing referencing the old name.

For **remove**, delete the rule file, the test file, the fixture directory, the
four entries in `rules/index.ts`, and the docs section.
