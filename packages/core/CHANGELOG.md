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
  the escapes each form carries, which for brackets means the doubled closing
  bracket alone. Constructs whose interior is not Qlik expression syntax lex as a
  single opaque token, so no rule can rewrite their insides: `$(Include=…)` /
  `$(Must_Include=…)`, whose `=` Qlik forbids a space around, and unbracketed
  `lib://` paths, whose `//` would otherwise read as a line comment.
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
- Initial rule set covering layout (`block-indent`, `load-indent`,
  `continuation-indent`, `load-clause-newline`, `load-field-per-line`, `multiline-call`,
  `one-statement-per-line`, `max-line-length`, `no-multiple-empty-lines`,
  `blank-line-before-table`, `blank-line-before-block`, `blank-line-after-block`,
  `padded-blocks`, `no-blank-line-in-statement`,
  `no-leading-blank-lines`, `comma-style`, `trailing-whitespace`, `eol-last`),
  casing (`builtin-function-case`,
  `builtin-keyword-case`, `variable-case`), spacing (`comma-space`, `semicolon-space`,
  `comment-space`, `inline-comment-space`, `block-comment-stars`,
  `operator-spacing`, `paren-spacing`, `word-spacing`), and correctness
  (`include-no-spaces`, `no-legacy-path-variables`, `table-label-brackets`,
  `load-identifier-brackets`,
  `variable-charset`). Each rule answers one question and claims its own lines
  or tokens: `comma-space` owns the whitespace on both sides of a comma,
  `comma-style` owns which line the comma sits on. See
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
  rather than keeping their own sets of lowercased images. `Then`, which the
  Engine BNF dump folds into the `If` production instead of listing as a
  terminal, is named explicitly in the keyword list and is therefore cased by
  `builtin-keyword-case` like any other keyword.
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
