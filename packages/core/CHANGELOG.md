# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `semicolon-style` puts a `;` on the last line of the statement it closes
  instead of on a line of its own, carrying any comment in between along. A
  `Set` value is unaffected: Qlik drops a line break before its `;`, measured
  in Qlik Sense Enterprise on Windows May 2025 Patch 19. The `;` after a `Trace`
  message, a SQL command and a `Rem` stays where it is, since the line breaks
  before it belong to that text, and so does a `;` ending an empty statement.
- `comment-indent` indents a line holding only a comment like the next line of
  code below it. The indent rules place every line that holds code; a comment
  line fell to none of them and stayed at whatever column it was written at, so
  a comment drifted away from the code it describes as that code was reindented.
  Directly above the line that ends a body, the body's level is accepted as
  well; below the last line of code, a comment takes that line's indent. A
  `///` line is left alone.
- `no-rem` writes a remark as a `//` comment instead of a `Rem` statement, so a
  script has one way of saying one thing. Several remarks in a row become line
  comments that `multiline-comment-block` then folds into one block. A remark
  holding a dollar-sign expansion, one that would turn into a disable
  directive, and one sharing its line with another statement are flagged but
  left as written; a `Rem` where no statement begins — a field of that name in a
  `Load` — is not flagged at all.
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

- `multiline-comment-block` folds a block comment directly above or below a run
  of `//` lines into the same block, and a lone `//` line beside a block with
  it. A `//` line glued to a block was left as it stood, so a script could
  settle in two shapes: `REM` lines turned into comments after the lines beside
  them had already been folded ended up as a line comment on top of a block,
  and which shape came out depended on the order the rules were configured in.
  Blocks beside blocks, a banner of asterisks and a block sharing its line with
  code are still left alone. The message now reads "Consecutive comment lines
  should be a single block comment."
- `multiline-call` no longer requires a call to close on the line it opens on.
  That requirement was the rule's blind spot: in a nest of `If`s, the call that
  made a line too long is usually the one already spanning lines, and passing
  over it left the innermost call that did fit on one line as the only
  candidate. So the rule broke apart a `Match` that was never the reason the
  line was long, and left the line barely shorter. A call is now flagged when it
  opens on an over-long line and has a top-level comma there; the arguments that
  open on that line are separated, and everything past the last comma — the tail
  already broken onto lines of its own — stays exactly where it stands.
- `continuation-indent` counts the lines a continuation hangs below rather than
  the parentheses open above it. The two agree wherever each line opens at most
  one parenthesis, which is every shape the rule ever documented; they part on
  the two it did not. A line opening two — `If(Match(` — gave its contents two
  levels while the closing line came back only one, so the closer ended up
  aligned with neither the arguments above it nor the line that opened them. And
  a continuation that opened a parenthesis had its contents flattened against
  itself, because a line with nothing open and a line with one parenthesis open
  both resolved to a single level.
- `paren-spacing` narrows the gap between a closing parenthesis and the word
  after it to a single space. It was the one side of a paren no rule claimed:
  `Amount     as Total` was collapsed while `Sum(Amount)     as Total` came out
  of a format pass with its hand-aligned run of tabs intact. Only a word counts
  as the thing after `)` — a comma, a semicolon or an operator keeps its gap,
  which belongs to the rule that owns it — and an empty gap stays empty, because
  a dollar-sign expansion is spliced in as text and `$(vPrefix)Sales` is one
  name, not two.
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

### Fixed

- A `;` on a line of its own after a SQL command or a `Trace` message is no
  longer indented. Those texts run up to their `;`, line breaks included, so the
  indentation `continuation-indent` wrote in front of the `;` was read back as
  part of the text — and a `Trace` prints it. The indent rules now leave a line
  alone whose line break belongs to the token before it.
- An include whose file name is built from a variable —
  `$(Must_Include=[$(vLib)common.qvs])` — is read whole again. The include ended
  at the first `)`, which is the one closing the inner `$(vLib)`, so the rest of
  the file name spilled out as script: a stray `]` the lexer could not read, and
  text the rules then respaced. The include now runs to the parenthesis closing
  the expansion it opened with, since Qlik nests dollar-sign expansions.
- `Let vX =;`, the empty assignment that clears a variable, no longer makes
  `format` throw. `operator-spacing` asked for a space after the `=` and
  `semicolon-space` removed it again, pass after pass, until the loop gave up —
  and a comma or an operator right before a `;` did the same. The gap before a
  `;` now belongs to the terminator alone: the rules for the mark before it step
  aside, and the empty assignment keeps its form.
- The command of a SQL statement is no longer formatted. Qlik hands the text after
  the `SQL` prefix — and a bare `Select`, whose prefix is optional — to the
  database driver unread, yet the rules treated it as Qlik: they recased
  `SELECT … FROM` to `Select … From`, spaced `a,b` and `x=1`, and choked on a
  connector command that is not SQL at all, such as the JSON a SAP connector
  takes. The command now lexes as one opaque token up to its `;`, the way a
  `Trace` message does, and reaches the database exactly as written.
- The value of a `Set` is no longer formatted. A `Set` assigns the text right of
  its `=` without evaluating it, yet the rules spaced `a,b` into `a, b` and so
  changed what the variable holds. Two of them also fought over the empty value
  in `Set vX =;` — one inserting a space after the `=`, the other removing the
  space before the `;` — until `format` gave up and threw, which ended a CLI
  `--fix` run on the first script carrying one. The value now lexes as one opaque
  token that no rule rewrites. Its edges do not: Qlik drops the spaces around a
  `Set` value and the line breaks before its `;` — the reference is silent, so
  this was measured in Qlik Sense Enterprise on Windows May 2025 Patch 19 — and
  they are spaced like any other gap, `Set x =1.2 ;` becoming `Set x = 1.2;`. A
  tab at the edge was not measured and stays inside the value.
- The text of a `Rem` statement is no longer formatted. Everything between `Rem`
  and the next `;` is a comment, yet the rules read it as script: a banner such as
  `REM ===== Begin =====;` came out as `Rem = = = = = Begin = = = = = ;`, and two
  rules then fought over the space before its `;` until `format` gave up and
  threw. The remark now lexes as one opaque token, the way a `Trace` message does.
- A line comment opening with a third slash is kept as written. Tools that store
  a script as a text file mark each section with a `///$tab Main` line, and two
  rules destroyed it: `comment-space` turned it into `// /$tab Main`, and
  `multiline-comment-block` folded it with the comments below into one block
  comment. Either way the file came back with one section fewer. Both rules now
  leave any `///` line alone, the way they already left a banner of slashes.

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
