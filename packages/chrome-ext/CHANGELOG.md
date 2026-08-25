# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0]

### Added

- `comma-style` rule, which requires a comma to close the line of the operand it
  follows rather than open the next one. Comes from the bundled Core engine, so a
  configuration on the `recommended` preset picks it up without any change.
- Per-rule option controls on the settings page. Every rule that takes options
  now renders one control per option beneath its severity — a dropdown for an
  enum option, a number input carrying the option's own `min`/`max` and showing
  the rule's default as its placeholder. The controls are built from the option
  schemas the bundled Core engine ships, so what the page offers cannot drift
  from what the linter accepts. Setting an option no longer pins a severity on
  the rule: the entry is written as `"block-indent": [null, { "size": 2 }]`, and
  the rule keeps following whatever a preset or its own default gives it. An edit
  the configuration rejects never reaches storage — the error from Core is shown
  as it stands and the offending control resets itself.

### Changed

- Rule options are validated against the schema of the rule they belong to. An
  unknown option key, an enum value outside the declared set, or a number outside
  its `min`/`max` is now an error where it used to pass unnoticed. A stored
  configuration carrying one no longer loads at all: the extension falls back to
  an empty configuration — which lints nothing — and logs the reason to the
  console. A configuration hand-written against 0.1.x is worth opening the
  settings page for once.
- `comma-space` claims the space before a comma as well, which must now be empty
  (`Load A ,B` → `Load A, B`). It previously owned only the side after it.
- The `*` wildcard in a LOAD field list is a field like any other and takes its
  own line. It used to stay on the LOAD header line when it made up the whole
  field list, which formatted `Load *` and `Load Id` — structurally the same
  statement — two different ways.
- `Then` is cased by `builtin-keyword-case` along with every other keyword.

### Fixed

- A line break inserted by an autofix uses the line ending the script already
  uses, so a CRLF script no longer comes back with mixed terminators.
- A LOAD header torn across lines is no longer indented as a continuation of
  itself.

## [0.1.1]

### Added

- `include-no-spaces` rule, which repairs an `$(Include=…)` / `$(Must_Include=…)`
  expansion that already carries the spacing Qlik rejects. Comes from the bundled
  Core engine, so it is available in the editor without any configuration change
  beyond enabling the rule.

### Fixed

- Diagnostics are no longer lost when the Data Load Editor mounts late or is
  replaced. Leaving the script editor and coming back swaps the CodeMirror
  instance; the extension used to stay bound to the dead one — or, if its mount
  watch had already timed out, to none at all — while the popup still reported
  the editor as active. Both halves now re-arm on every in-app navigation, and a
  timed-out watch is no longer terminal.
- The popup no longer shows an active editor with no severity counts underneath.
  It reads the counts once, right after the content script reports `active`, and
  the debounced first lint pass lost that race often enough to matter. The
  initial pass now runs undebounced.
- `$(Include=…)` / `$(Must_Include=…)` is no longer broken by `operator-spacing`.
  Qlik forbids a space around the `=` of that dollar expansion, so the inserted
  spaces made the Data Load Editor reject the script. The expansion now lexes as
  a single opaque token and is left untouched.
- An unbracketed `lib://` path is no longer mangled. The scheme used to split
  into the `Lib` keyword plus a `//` line comment, which uppercased `LIB` and
  silently commented out the rest of the path. It now lexes as one token.

## [0.1.0]

### Added

- Manifest V3 Chrome extension that injects `@qlinter/core` into the Qlik Sense
  Data Load Editor on Qlik Sense Enterprise on Windows (QSEoW).
- Inline lint feedback rendered directly against the editor, with underlines on
  the offending tokens and hover tooltips that explain the rule.
- Severity-aware popup showing live error / warning / info counts for the
  active editor.
- "Format automatically" action that applies every available autofix to the
  current script in a single pass and writes the result back into the editor.
- Per-origin permission gating: the extension declares
  `optional_host_permissions: ["<all_urls>"]` and requests access only for the
  origin the user explicitly enables via the popup.
- English and German UI locales via `_locales/`, selected through
  `default_locale: "en"`.
- Fully client-side processing: the bundled Core engine runs entirely in the
  browser; scripts never leave the page.
- Settings page that persists a JSON lint configuration in
  `chrome.storage.sync` and applies it live to the editor lint pipeline
  without a tab reload. Presets are chosen explicitly from an add/remove list —
  nothing is applied implicitly, matching the CLI and VS Code extension — while
  individual rule severities are set via a per-rule list, and the raw
  configuration is editable inline via an embedded CodeMirror editor with JSON
  syntax highlighting, bracket matching, and auto-indent. A "Restore defaults"
  button writes back the same configuration a fresh install is seeded with —
  the only in-UI way back to it, since seeding never overwrites an existing
  config. The same JSON shape is accepted by the
  CLI's `--config` flag, so configs carry over between the two.
- A fresh install is seeded with the `recommended` preset, written to
  `chrome.storage.sync` as a real, explicit `presets` entry rather than applied
  as a hidden fallback — so the options page shows it selected and it can be
  removed like any other. Seeding keys off the absence of a stored config, so a
  configuration the user emptied (including via "Reset") is never overwritten
  on a later startup.
- Permission rationale in `docs/permissions.md` documenting every requested
  permission, the code that uses it, and what breaks without it — alongside the
  project [privacy policy](../../docs/PRIVACY.md).
