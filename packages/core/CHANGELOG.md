# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Tokenizer for Qlik load script built on Chevrotain, covering keywords, builtin
  functions, variables, comments, string literals, and the LOAD/SELECT statement
  surface.
- `lint(source, config)` API that runs the rules named in `config.rules` over a
  script and returns structured `Diagnostic` objects (severity, range, ruleId,
  message). Rules are resolved against an internal registry keyed by rule id; a
  rule not listed in the config is not checked, and an unknown rule id throws.
- `format(source, config)` API that applies autofixes in successive passes until
  the output stabilizes, returning the formatted source, remaining diagnostics,
  and a fix count.
- `validateConfig(value, sourceLabel?)` API that validates an arbitrary
  JSON-parsed value against the `LintConfig` shape and returns it typed, throwing
  readable errors for unknown rule ids, invalid severities, and malformed rule
  entries. The optional `sourceLabel` is interpolated into error messages so host
  integrations (CLI, browser, IDE) can point users at the offending source.
- Initial rule set covering layout (`block-indent`, `load-indent`,
  `continuation-indent`, `load-clause-newline`, `load-field-per-line`, `multiline-call`,
  `one-statement-per-line`, `max-line-length`, `no-multiple-empty-lines`,
  `trailing-whitespace`, `eol-last`), casing (`builtin-function-case`,
  `builtin-keyword-case`, `variable-case`), spacing (`comma-space`,
  `comment-space`, `inline-comment-space`, `block-comment-stars`,
  `operator-spacing`, `paren-spacing`), and correctness
  (`include-no-spaces`, `no-legacy-path-variables`, `table-label-brackets`,
  `variable-charset`).
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
- Inline disable directives (`// qlinter-disable`, `// qlinter-disable-next-line`,
  `// qlinter-disable-line`) for opting individual lines or blocks out of
  linting.
- Public TypeScript types: `Diagnostic`, `Rule`, `Severity`, `Fix`,
  `LintConfig`, `RulesConfig`, `RuleId`, `PresetName`, `RulesConfigOf`,
  `RuleConfigEntry`, `SeverityOrOff`, `FormatResult`, and per-rule option types.

### Fixed

- `$(Include=…)` / `$(Must_Include=…)` is no longer broken by `operator-spacing`.
  Qlik forbids a space around the `=` of that dollar expansion, so the inserted
  spaces made the Data Load Editor reject the script. The expansion now lexes as
  a single opaque token and is left untouched; the new `include-no-spaces` rule
  repairs scripts that already carry the broken spacing.
- An unbracketed `lib://` path is no longer mangled. The scheme used to split
  into the `Lib` keyword plus a `//` line comment, which uppercased `LIB` and
  silently commented out the rest of the path. It now lexes as one token.
- A `Load` header torn across lines is no longer indented as if it were a
  continuation. `continuation-indent` used to claim the `Load`, `Distinct` and
  `NoConcatenate` lines of a prefixed statement (`Left Join(X)` on one line, its
  `Load` on the next) and push them one level in — landing them on the same
  column as the field list they introduce. `load-indent` now owns those header
  lines and pins them to the statement's own indent. A prefix whose argument
  list is wrapped (`Hierarchy(NodeId, ParentId,\n    NodeName)`) is still a
  continuation and keeps hanging one level off the opening line.
