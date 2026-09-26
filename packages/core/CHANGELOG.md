# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Tokenizer for Qlik load script built on Chevrotain, covering keywords, builtin
  functions, variables, comments, string literals, and the LOAD/SELECT statement
  surface. A delimited field or table name lexes as one token in all three forms
  Qlik accepts — brackets, double quotation marks and grave accents — including
  the escapes each form carries. Spaces, tabs and line breaks lex into a group of
  their own, so every rule reads the same answer to what whitespace is.
- Text Qlik does not read as script lexes as one opaque token, and no rule
  rewrites it: the command of a SQL statement or a bare `Select`, which reaches
  the database driver unread; a `Trace` message; the remark of a `Rem`; the value
  of a `Set`, which is assigned unevaluated; `$(Include=…)` and
  `$(Must_Include=…)`, whose `=` Qlik forbids a space around, including a file
  name built from a nested expansion; and unbracketed `lib://` paths. A `Set`
  value's edges are not part of it: Qlik drops the spaces around it and the line
  breaks before its `;` — the reference is silent, so this was measured in Qlik
  Sense Enterprise on Windows May 2025 Patch 19 — and they are spaced like any
  other gap. A `///` line comment, which tools use to mark script sections, is
  kept exactly as written.
- `lint(source, config)` API that runs the rules named in `config.rules` over a
  script and returns structured `Diagnostic` objects (severity, range, ruleId,
  message). Rules are resolved against an internal registry keyed by rule id; a
  rule not listed in the config is not checked, and an unknown rule id throws.
- `format(source, config)` API that applies autofixes in successive passes until
  the output stabilizes, returning the formatted source, remaining diagnostics,
  and a fix count. Every break a fix inserts matches the line ending the source
  already uses, so a CRLF script never comes back with mixed terminators.
- `validateConfig(value, sourceLabel?)` API that validates an arbitrary
  JSON-parsed value against the `LintConfig` shape and returns it typed, throwing
  readable errors for unknown rule ids, invalid severities, malformed rule
  entries, and rule options that violate the schema their rule declares — an
  unknown option key, an enum value outside the declared set, or a number outside
  its `min`/`max`. The optional `sourceLabel` is interpolated into error messages
  so host integrations (CLI, browser, IDE) can point users at the offending
  source.
- `conformanceScore(source, diagnostics)` reduces a lint result to a single
  number from 0 to 100: the share of lines that no diagnostic points at, rounded
  down so 100 means every line is clean. A script under ten lines scores `null`,
  because a single finding would swing the number further than the style it is
  meant to describe. See [docs/score.md](docs/score.md).
- A rule set of 40 rules covering
  - layout: `block-indent`, `load-indent`, `continuation-indent`,
    `comment-indent`, `load-clause-newline`, `load-field-per-line`,
    `multiline-call`, `one-statement-per-line`, `comma-style`,
    `semicolon-style`, `max-line-length`;
  - blank lines: `blank-line-before-table`, `blank-line-after-table`,
    `blank-line-before-block`, `blank-line-after-block`, `padded-blocks`,
    `no-blank-line-in-statement`, `no-multiple-empty-lines`,
    `no-leading-blank-lines`, `trailing-whitespace`, `eol-last`;
  - casing: `builtin-function-case`, `builtin-keyword-case`, `variable-case`;
  - spacing: `comma-space`, `semicolon-space`, `operator-spacing`,
    `paren-spacing`, `word-spacing`;
  - comments: `comment-space`, `inline-comment-space`, `block-comment-stars`,
    `multiline-comment-block`, `no-rem`;
  - correctness: `include-no-spaces`, `no-empty-statement`,
    `no-legacy-path-variables`, `table-label-brackets`,
    `load-identifier-brackets`, `variable-charset`.

  Each rule answers one question and claims its own lines or tokens. See
  [docs/rules.md](docs/rules.md) for the full reference.

- `recommended` preset, a ready-to-use `LintConfig` that enables every rule at
  its declared `defaultSeverity`. Pass it straight to `lint()` / `format()`.
- Named presets via the `presets` field on `LintConfig`, which selects one or
  more built-in presets (currently only `recommended`) as a base. The exported
  `resolveConfig()` expands them — presets merge left-to-right, then `rules`
  overlay them per rule id. There is no implicit base: a config without
  `presets` runs only its listed `rules`, and `presets: []` explicitly opts out
  of every preset.
- `allRules` export listing every rule shipped with Core. Host integrations (CLI,
  browser, IDE) can enumerate the full rule catalog.
- `Rule.defaultSeverity` field declaring each rule's out-of-the-box severity.
  Findings carry only location, message, and optional fix; the runner attaches
  severity from the user config (if set) or from `rule.defaultSeverity`. Host
  integrations can read this field to surface the recommended severity next to
  per-rule controls.
- `Rule.options` field describing each option of a rule as a machine-readable
  `OptionSchema` — `{ type: 'number', min?, max? }` or
  `{ type: 'enum', values }`. It is required by the type for any rule that has
  options, so the description cannot fall out of step with the rule. Config
  validation and host settings UIs both read it instead of keeping their own copy
  of every rule's option shape. The allowed values of an enum option are exported
  as `as const` arrays (`CASE_STYLES`, `INDENT_STYLES`, `LINE_ENDINGS`,
  `VARIABLE_CASE_STYLES`) from which the corresponding union types are derived,
  so they remain readable at runtime rather than being erased with the types.
- Token categories for the keywords that carry structure — block openers and
  closers, statement terminators, and the clause keywords that close a LOAD
  field list. Which words these are is lexical vocabulary and lives in the lexer
  beside the keyword list; rules match them with chevrotain's `tokenMatcher`
  rather than keeping their own sets of lowercased images.
- Inline disable directives (`// qlinter-disable`, `// qlinter-disable-next-line`,
  `// qlinter-disable-line`) for opting individual lines or blocks out of
  linting.
- `null` accepted in the severity slot of a rule entry's tuple form
  (`"block-indent": [null, { "size": 2 }]`), meaning "leave the severity
  alone". The rule keeps whatever a preset or its own `defaultSeverity` gives it
  and follows along when that changes, where restating a severity to reach the
  options beside it would have pinned it silently.
- Public TypeScript types: `Diagnostic`, `Rule`, `AnyRule`, `Severity`, `Fix`,
  `OptionSchema`, `OptionsSchemaOf`, `LintConfig`, `RulesConfig`, `RuleId`,
  `PresetName`, `RulesConfigOf`, `RuleConfigEntry`, `SeverityOrOff`,
  `SeverityOrInherit`, `FormatResult`, and per-rule option types.
