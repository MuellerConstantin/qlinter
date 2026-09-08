# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `conformanceScore(source, diagnostics)` reduces a lint result to a single
  number from 0 to 100: the share of lines that no diagnostic points at, rounded
  down so 100 means every line is clean. Every line counts, blank and comment
  lines included, and every enabled rule counts the same regardless of severity;
  a line carrying several findings counts once, and a finding spanning several
  lines counts against the line it starts on. A script under ten lines scores
  `null`, because a single finding would swing the number further than the style
  it is meant to describe. Core returns the number only — how it is displayed is
  each binding's decision. See `docs/score.md`.

### Changed

- Whitespace is reported by the lexer instead of discarded, and the rules ask it
  what whitespace is rather than each deciding for itself. Spaces, tabs and line
  breaks now lex into a group of their own and reach a rule through
  `RuleContext.whitespaces`, the way comments already did. Every spacing, indent
  and blank-line rule reads those runs; the character walks and whitespace
  patterns they each used to carry are gone, and with them a dozen separate
  definitions of the same thing. Two consequences are visible from outside: a gap
  holding anything the lexer routed elsewhere — a comment, or input it could not
  read — is left alone by the spacing rules rather than measured across, and a
  line inside a construct the lexer keeps whole (inline data, a block comment, a
  multi-line string) no longer counts as a blank line.
- `eol-last` skips a file carrying a carriage return that is not part of a CRLF
  pair. Qlik's reference never defines what ends a line — the page on commenting
  says a `//` comment runs to the end of "the same row" without saying what a row
  is — so whether such a file is already terminated cannot be answered here. It
  used to be answered anyway: a file ending in two carriage returns was rewritten
  to a single newline, and one written entirely with carriage returns had a
  newline appended, leaving two conventions mixed inside it.

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
