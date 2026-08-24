<p align="center">
  <img width="200" alt="Logo" src="./docs/images/logo.svg">
  <h1 align="center">@qlinter/core</h1>
</p>
<p align="center">
  The engine behind qlinter — parses Qlik load scripts, applies an opinionated ruleset, and emits both lint diagnostics and formatted output.
</p>
<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" />
</p>

<br />

## Table of contents

- [Introduction](#introduction)
  - [Features](#features)
  - [Usage](#usage)
    - [Installation](#installation)
    - [Linting](#linting)
    - [Formatting](#formatting)
    - [Configuring rules](#configuring-rules)
    - [Picking your own rule set](#picking-your-own-rule-set)
    - [Disable directives](#disable-directives)
  - [Rules](#rules)

## Introduction

Core is the single source of truth for all qlinter bindings (CLI, Chrome extension, future
IDE integrations). It bundles the tokenizer, the complete ruleset, and the formatting
logic into one platform-agnostic module — no I/O, no filesystem access, no DOM, no
platform assumptions. Everything operates on strings: you hand it script source, it
hands back diagnostics and/or formatted source. That makes it equally at home in Node,
the browser, or a Web Worker.

Bindings stay thin by design: they handle their platform concerns (file discovery and
exit codes in the CLI, editor injection in the extension) and delegate every linting and
formatting decision to Core.

## Features

- **Lint** — surface style violations (whitespace, keyword casing, statement conventions)
  as structured diagnostics with line/column ranges, so callers can render them however
  they like (terminal, editor squiggles, CI report).
- **Format** — apply the same ruleset deterministically to produce normalized output.
  Formatting and linting share one source of truth, so they never disagree.
- **Opinionated default ruleset** — a curated `recommended` preset covering whitespace,
  keyword casing, `LOAD` formatting, variable conventions, comments, and more. See the
  full list in [`docs/rules.md`](./docs/rules.md).
- **Per-rule configuration** — override severity (`error` / `warning` / `info` / `off`)
  and per-rule options without touching rule code, so teams can adapt the linter to
  their own conventions instead of fighting the defaults.
- **Custom rule sets** — every rule is exported individually; assemble your own array of
  rules instead of the `recommended` preset when you need a tighter or looser scope.
- **Inline disable directives** — suppress findings for the next line via
  `// qlinter-disable-next-line` (all rules) or `// qlinter-disable-next-line rule-a, rule-b`
  (specific rules).
- **Strict TypeScript types** — `Diagnostic`, `Fix`, `Rule`, `LintConfig`, and friends are
  exported, so bindings get full IntelliSense and config typos surface at compile time.
- **Platform-agnostic** — pure string-in, diagnostics-out API. Runs anywhere JavaScript
  runs: Node, browser, Web Worker.

## Usage

### Installation

```bash
npm install @qlinter/core
```

### Linting

`lint(source, config)` returns an array of diagnostics, sorted by position:

```ts
import { lint, recommended } from '@qlinter/core';

const source = `Sales:
LOAD * FROM [lib://data/sales.qvd];`;

const diagnostics = lint(source, recommended);

for (const diagnostic of diagnostics) {
  const { line, column } = diagnostic.range.start;
  console.log(`${line}:${column}  ${diagnostic.severity}  ${diagnostic.ruleId}  ${diagnostic.message}`);
}
```

Each `Diagnostic` carries a `ruleId`, a `severity`, a `range` (start/end line + column),
a human-readable `message`, and an optional `fix` (a string replacement over a byte
range) when the rule can auto-correct the violation.

### Formatting

`format(source, config)` runs `lint` in a fixpoint loop — applying every
available autofix, re-linting, and repeating until no further fixes are produced (or a
safety cap of 10 passes is hit):

```ts
import { format, recommended } from '@qlinter/core';

const { output, diagnostics, fixed } = format(source, recommended);

console.log(output);                    // normalized source
console.log(`${fixed} fix(es) applied`);
console.log(`${diagnostics.length} diagnostic(s) remain`);
```

`output` is always returned; `diagnostics` contains anything the formatter could not
auto-correct (rules without a fix, or fixes that conflict).

### Configuring rules

Pass a `LintConfig` as the second argument to select a preset base and override
severity and per-rule options without forking the rule code. `presets` names the
built-in preset(s) to start from (currently only `'recommended'`), and each entry
under `rules` — a severity string or a `[severity, options]` tuple — overrides
them per rule. Passing `null` as the severity (`[null, { max: 100 }]`) sets the
options and leaves the severity to the preset or the rule's default:

```ts
import { lint } from '@qlinter/core';

const diagnostics = lint(source, {
  presets: 'recommended',
  rules: {
    'variable-case': ['warning', { style: 'camel' }],
    'max-line-length': ['error', { max: 120 }],
    'no-multiple-empty-lines': 'off',
  },
});
```

Use `'off'` to disable a rule entirely. There is no implicit base: without
`presets`, only the rules you list run, and `presets: []` explicitly opts out of
every preset. Omitted rules that a preset enables keep their built-in severity and
default options.

### Picking your own rule set

There is no implicit base, so running a subset is just a matter of skipping the
preset and listing the rules you want. Set `presets: []` (or omit `presets`
entirely) and name only those rules; per-rule options go inline in the
`[severity, options]` tuple:

```ts
import { lint } from '@qlinter/core';

const diagnostics = lint(source, {
  presets: [],
  rules: {
    'builtin-keyword-case': 'warning',
    'trailing-whitespace': 'warning',
    'variable-case': ['warning', { style: 'pascal' }],
  },
});
```

Use the `allRules` export to enumerate every available rule id — handy when
building a configuration UI.

### Disable directives

Suppress findings on the next line with an inline comment:

```qvs
// qlinter-disable-next-line
Set vBad   =   1;

// qlinter-disable-next-line variable-case, trailing-whitespace
Set my_var = 2;
```

Without rule IDs every diagnostic on the following line is suppressed; with rule IDs
only matching diagnostics are.

## Rules

The full list of built-in rules, what they enforce, and the options each one accepts is
documented in [`docs/rules.md`](./docs/rules.md).
