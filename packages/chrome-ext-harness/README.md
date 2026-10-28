<p align="center">
  <img width="200" alt="Logo" src="./public/qlinter.svg">
  <h1 align="center">@qlinter/chrome-ext-harness</h1>
</p>
<p align="center">
  Local stand-in for the Qlik Sense Data Load Editor — exercise the qlinter Chrome extension without a Qlik environment.
</p>
<p align="center">
  <img src="https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/private-dev%20only-lightgrey" />
</p>

<br />

## Table of contents

- [Introduction](#introduction)
  - [Features](#features)
- [Usage](#usage)
- [What the page models](#what-the-page-models)
- [Limits](#limits)

## Introduction

The [Chrome extension](../chrome-ext) only switches on inside the Qlik Sense Data Load Editor,
which usually lives on a corporate server. This package serves a minimal page on `localhost` that
carries the same anchors the extension looks for and hosts a CodeMirror 5 editor, so its lint
marks, tooltips, quick fixes, fix-all and popup score can be checked on any machine.

The package is private and never released. It is not part of the root `build` or `test` scripts,
only of `typecheck`.

## Features

- **Rule fixtures on tap** — the script picker offers the `violation.qvs` of every rule in
  [`@qlinter/core`](../core/tests/rules/fixtures), so each rule has a ready-made failing script.
- **Your own scripts** — *Open file* loads any local `.qvs` into the editor.
- **No build step** — Vite serves the page straight from source on a fixed port, so the origin you
  grant in the extension stays valid across restarts.

## Usage

1. Build the extension: `npm run build -w @qlinter/chrome-ext`.
2. In `chrome://extensions`, enable developer mode and load `packages/chrome-ext/dist` unpacked.
3. Start the harness from the repository root: `npm run harness:chrome-ext`.
4. Open `http://localhost:5180/dataloadeditor/app/` and enable the `localhost` origin through the
   extension popup.

After a change to the extension, rebuild it and reload it in `chrome://extensions`; the harness
itself reloads on save.

## What the page models

The page reproduces the Data Load Editor's DOM as the extension was built against it:

| Anchor                                    | In the harness                                      |
| ----------------------------------------- | --------------------------------------------------- |
| `#qv-page-container`                      | Root container of the editor area                   |
| URL path containing `/dataloadeditor/`    | Vite serves everything under `/dataloadeditor/app/` |
| `[data-testid="script-editor-container"]` | Wrapper created around the editor                   |
| `scripteditor-code-area .CodeMirror`      | CodeMirror 5 instance, reachable via `.CodeMirror`  |

These values are written out in the harness on purpose rather than imported from the extension:
if the extension's assumptions about Qlik are wrong, the harness should not repeat the mistake.
They have not yet been checked against a capture of a real Qlik Sense page.

Tailwind styles the page chrome only. Its preflight reset is left out, so CodeMirror and everything
the extension draws render with their own CSS, as they would in Qlik.

## Limits

The harness checks UI behaviour only. The real editor's CodeMirror version and options, its CSS,
the surrounding DOM and how Qlik switches script sections are not modelled, so a pass here never
replaces a check in Qlik Sense itself.
