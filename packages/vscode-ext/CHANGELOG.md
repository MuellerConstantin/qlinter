# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- VS Code extension that injects `@qlinter/core` into the editor for Qlik load
  scripts, contributing a `qlik` language for `.qvs` files (with a file icon)
  and activating on first open.
- Inline lint feedback published to the Problems panel and rendered against the
  offending ranges, refreshed live as the document changes and cleared when it
  closes. Each diagnostic's rule id links to that rule in the
  [rule reference](../core/docs/rules.md).
- Core autofixes surfaced as Quick Fix code actions on each fixable diagnostic.
- An "Ignore … for this line" Quick Fix on every diagnostic, which writes a
  `// qlinter-disable-next-line` directive above the line, or adds the rule to
  the directive already there. The inserted line ends with the line break the
  script already uses.
- Whole-document formatting via a document formatting provider, so "Format
  Document" and `editor.formatOnSave` reformat Qlik scripts through Core's
  `format()`.
- A `source.fixAll` code action that applies every autofix in one pass, wired for
  the "Fix All" command and `editor.codeActionsOnSave`, and a
  "qlinter: Fix all auto-fixable problems" command in the Command Palette that
  applies the same pass to the open script.
- Per-document configuration resolution with strict precedence: a `qlinter.json`
  at the workspace folder root wins, otherwise the `qlinter.presets` and
  `qlinter.rules` settings apply. Loose `.qvs` files with no workspace folder fall
  through to settings.
- A JSON schema for `qlinter.json`, so the editor completes rule ids,
  severities, presets and each rule's options, flags an unknown rule or option
  and a value out of range, and links each rule to its reference on hover. It
  is generated from the bundled Core engine at build time and cannot fall
  behind the rules it ships.
- `qlinter.presets` and `qlinter.rules` settings contributed to VS Code's native
  settings UI, with the preset picker offering the built-in presets.
  `qlinter.presets` declares `["recommended"]` as its manifest default, so a fresh
  install lints out of the box while the value stays an explicit, user-visible
  setting — VS Code shows it in the Settings UI and it can be set to `[]` to run
  no rules. The extension never writes to the user's `settings.json`.
- Status bar item showing the active configuration source (`qlinter.json`,
  `settings`, or `no rules`); clicking it opens the `qlinter.json` or the settings.
- A conformance score in the status bar beside it: the share of lines in the
  open script that no diagnostic points at, as a percentage, updated with every
  lint pass. Clicking it opens the Problems panel. It stays hidden for a script
  under ten lines, which Core declines to score, and when no rules are
  configured.
- Resolved configs cached per workspace folder and invalidated on settings
  changes and via a `qlinter.json` file watcher, so a config edit re-lints open
  documents without a reload.
- A broken `qlinter.json` surfaced as an error notification and written to the
  qlinter output channel, rather than being silently ignored; no diagnostics are
  shown for the affected file until it is fixed.
- Fully local processing: the bundled Core engine runs entirely in the editor
  host; scripts never leave the machine. No telemetry is emitted and no network
  request is made; see the [privacy policy](../../docs/PRIVACY.md).
