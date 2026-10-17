<p align="center">
  <img width="128" alt="Logo" src="./images/qlinter-128.png">
  <h1 align="center">qlinter-vscode-ext</h1>
</p>
<p align="center">
  VS Code extension for qlinter — brings inline linting and one-click formatting for Qlik load scripts into the editor.
</p>
<p align="center">
  <img src="https://img.shields.io/badge/Editor-VS%20Code-007ACC?logo=visualstudiocode&logoColor=white" />
  <img src="https://img.shields.io/badge/Qlik-QVS-009848?logo=qlik" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" />
</p>

<br />

## Table of contents

- [Introduction](#introduction)
- [Formatting](#formatting)
- [Configuration](#configuration)
- [Conformance score](#conformance-score)
- [Privacy](#privacy)

## Introduction

Everyone on your team writes Qlik script their own way? Nothing consistent, code hard to
read and a pain to maintain? This extension aims to fix that — bringing qlinter's opinionated
style guide, on-demand autoformatting, and inline diagnostics directly into VS Code, right
where you write the script.

A editor binding around [`@qlinter/core`](https://github.com/MuellerConstantin/qlinter/tree/main/packages/core):
the extension owns the platform concerns — activating in the editor, surfacing diagnostics, and
wiring up editor commands — and delegates every linting and formatting decision to Core. No style
logic lives here; the binding only translates between VS Code and Core's string-in, diagnostics-out API.

The extension's own interface — commands, status bar, quick fixes, notifications — follows VS
Code's display language in English and German. The findings themselves come from Core and are in
English.

## Formatting

Diagnostics come with fixes at three levels:

- **Quick Fix** — the lightbulb on a single fixable problem applies just that fix.
- **Format Document** (`Shift+Alt+F`) — reformats the whole script through Core's formatter.
  Enable `"editor.formatOnSave": true` (optionally scoped to the `qlik` language) to run it on
  every save.
- **Fix All** — applies every autofix in one pass, on demand through **qlinter: Fix all
  auto-fixable problems** in the Command Palette. Wire it into save with:

  ```jsonc
  "[qlik]": {
    "editor.codeActionsOnSave": { "source.fixAll": "explicit" }
  }
  ```

A finding you mean to keep can be silenced from the same lightbulb: **Ignore … for this line**
writes `// qlinter-disable-next-line <rule>` above it, or adds the rule to the directive already
there.

All three run entirely locally through the bundled Core engine, using the same resolved config
as the diagnostics.

## Configuration

The config for a script is resolved with a strict, two-level precedence — the two are never
merged:

1. **`qlinter.json` at the workspace folder root.** Same file and shape the [CLI](https://github.com/MuellerConstantin/qlinter/tree/main/packages/cli)
   uses (`{ "presets": "recommended", "rules": { … } }`). When present, it wins. This is the
   right home for a shared, checked-in team style. While you edit it, VS Code completes rule
   ids, severities and options, flags anything qlinter would reject, and links each rule to its
   reference on hover.
2. **The `qlinter.presets` setting**, used when no `qlinter.json` is found. Qlik scripts often
   open as a lone `.qvs` file with no project — the setting covers exactly that case. It names
   the preset(s) to lint with and defaults to `["recommended"]`.

Individual rules — turning one off, changing its severity, setting its options — are configured
in a `qlinter.json` only. There is no setting for them: a `qlinter.json` is the one place where
the editor completes and checks every entry, and keeping rules there means a team never lints
differently because of someone's personal settings. A single line can still be exempted from a
rule with `// qlinter-disable-next-line <rule>`.

**qlinter: Create qlinter.json** in the Command Palette starts one: it writes the same starter
file as the CLI's `qlinter init` (`{ "presets": "recommended", "rules": {} }`) to the workspace
folder of the open script, asking which folder when that is ambiguous, and opens it. An existing
`qlinter.json` is opened, never overwritten.

A fresh install therefore lints with the `recommended` preset out of the box. The default is
declared in the extension manifest, so VS Code shows it in the Settings UI like any other
setting and you can change it — set `qlinter.presets` to `[]` to run no rules at all. The
extension never writes to your `settings.json`, and Core still applies nothing implicitly: the
value it receives is always an explicit setting. The status bar item shows the active source
(`qlinter.json`, `settings`, or `no rules`); click it to open the config or the settings.

A broken `qlinter.json` is surfaced as an error notification rather than silently ignored, and no
diagnostics are shown for that file until it is fixed.

## Conformance score

Next to the configuration source, the status bar shows the share of lines in the open script
that carry no finding, as a percentage; click it to open the Problems panel. It updates with
every lint pass, and stays hidden for a script under ten lines, where a single finding would
swing the figure further than the style it describes, and when no rules are configured. What
the score measures is written up in the
[score reference](https://github.com/MuellerConstantin/qlinter/blob/main/packages/core/docs/score.md).

## Privacy

Nothing is collected, nothing is transmitted, and no telemetry is emitted — the extension contains no
network calls at all. Your scripts are analysed by the bundled engine inside the editor host and never
leave your machine. The extension stores nothing of its own: it reads the open document, your
`qlinter.json` or the `qlinter.presets` setting, and keeps the resolved config in memory for the session.

Full details are in the
[privacy policy](https://github.com/MuellerConstantin/qlinter/blob/main/docs/PRIVACY.md).
