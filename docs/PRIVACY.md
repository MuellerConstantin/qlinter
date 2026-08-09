# Privacy Policy

This policy covers every part of qlinter — the Chrome extension, the VS Code extension, the CLI, and the
engine they all share — and applies from 2026-08-02.

## Summary

qlinter transmits nothing and contacts no server. Every part of it — parsing, linting, formatting — runs
locally on your machine. There is no backend, no telemetry, no analytics, no crash reporting, no
advertising, and no remotely hosted code. The only user data qlinter touches is the script you are
editing, and it never leaves the browser tab or the editor it is written in.

This is a structural property, not a promise: the engine (`@qlinter/core`) performs no I/O at all, and none
of the bindings contain a single network call. The full source is public.

## What each part does with your data

### Chrome extension (`@qlinter/chrome-ext`)

The extension lives entirely inside the tab you enabled it for: it reads the script out of the editor on
that page, lints it in place, and keeps your rule choices in Chrome's own settings storage.

**Reads**

- The **content of the Qlik script** in the Data Load Editor, read from the page's CodeMirror instance and
  passed straight into the bundled engine to produce diagnostics or formatted output. It is held in memory
  for the duration of the lint pass and written back only when you trigger a format.
- The **URL and DOM of pages on origins you have granted**, solely to determine whether the current page is
  a Qlik Sense Data Load Editor. Detection is three checks — a `qv-page-container` element, a
  `/dataloadeditor/` path segment, and a `script-editor-container` element. Nothing else on the page is
  inspected, and pages that fail these checks are left untouched.

**Stores**

- Your **lint configuration** — preset names and per-rule severities/options — under a single `config` key
  in `chrome.storage.sync`. It contains no script content and no personal data.
- Because this uses `chrome.storage.sync`, Chrome replicates that configuration across your signed-in
  Chrome profiles via **Google's sync infrastructure**, if you have Chrome Sync enabled. That transfer is
  performed by Chrome, not by qlinter, and is governed by Google's privacy policy. Rule names and severities
  are the only thing that travels; your scripts are never written to storage.

**Transmits**

- Nothing. The extension makes no network requests of any kind.

**Site access**

- No host permissions are granted at install time. The extension declares `<all_urls>` as an _optional_
  host permission and holds access to nothing until you explicitly grant a single origin via the "Enable
  qlinter for this page" button in the popup. Revoking that access in Chrome's extension settings
  unregisters the content scripts immediately. See
  [the permission rationale](../packages/chrome-ext/docs/permissions.md) for the per-permission detail.

### VS Code extension (`qlinter-vscode-ext`)

The extension runs inside the editor host and touches only what it needs to lint the file in front of you:
the open document and the configuration that applies to it.

**Reads**

- The **content of open Qlik script documents**, from VS Code's in-memory document model, to produce
  diagnostics and formatting edits.
- A **`qlinter.json`** at the workspace folder root, if present, and otherwise your `qlinter.presets` and
  `qlinter.rules` settings.

**Stores**

- Nothing of its own. Resolved configurations are cached in memory for the lifetime of the editor session.
  Diagnostics live in VS Code's Problems panel; error details are written to a local output channel.

**Transmits**

- Nothing. The extension makes no network requests and emits no telemetry — including none of VS Code's own
  telemetry APIs.

### CLI (`@qlinter/cli`) and engine (`@qlinter/core`)

The CLI reads the files you point it at and the config file you name, writes formatted output back when
asked, and reports results on stdout/stderr. The engine performs no I/O whatsoever — it takes a string and
a config and returns diagnostics or formatted text. Neither makes network requests.

## Third parties

There are none. qlinter has no service providers, no processors, and no integrations. Nothing is sold,
shared, or disclosed, because nothing ever leaves your device.

The only outbound requests connected to qlinter are ones **you** initiate: rule identifiers shown in the
Chrome extension's options page and hover tooltips link to the rule reference on GitHub. Following such a
link is an ordinary page load, and GitHub will see it under GitHub's own privacy statement. Nothing about
your script or configuration is attached to that link beyond the rule id in the URL fragment.

## Permissions and data-use commitments (Chrome Web Store)

- qlinter's **single purpose** is linting and formatting Qlik load scripts.
- It **handles exactly one category** of user data: **website content**, namely the Qlik script text in
  the Data Load Editor. That text is read into memory, linted, and written back — never transmitted,
  never stored, never shared. Chrome requires this to be disclosed even though the processing is purely
  local and the script never leaves the tab.
- It does **not** handle user data of any other category.
- It does **not** sell or transfer user data to third parties.
- It does **not** use or transfer data for purposes unrelated to its single purpose.
- It does **not** use or transfer data to determine creditworthiness or for lending purposes.
- It contains **no remotely hosted code** — all executable code, including the linting engine, is bundled
  in the extension package.

## Your data, your machine

Because nothing ever leaves your device, there is nothing held about you to access, correct, export, or
delete. The only data that exists is local:

- **Chrome:** remove your stored configuration with the "Reset" button on the options page, or by
  uninstalling the extension. Revoke site access at any time under `chrome://extensions`.
- **VS Code:** delete your `qlinter.json` or clear the `qlinter.*` settings; uninstalling leaves nothing
  behind.

## Changes to this policy

Material changes are recorded in the affected package's `CHANGELOG.md` and, for the extensions, take
effect with the release that carries them. The full revision history of this document is the commit
history of this file.

## Contact

Questions, or something in this document that does not match what the code does?
Open an issue at <https://github.com/MuellerConstantin/qlinter/issues> or write to
<info@mueller-constantin.de>.
