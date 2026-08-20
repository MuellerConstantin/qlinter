# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
