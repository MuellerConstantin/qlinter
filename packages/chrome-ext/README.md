<p align="center">
  <img width="200" alt="Logo" src="./docs/images/logo.svg">
  <h1 align="center">@qlinter/chrome-ext</h1>
</p>
<p align="center">
  Chrome extension for qlinter — brings inline linting and one-click formatting directly into the Qlik Sense Data Load Editor.
</p>
<p align="center">
  <img src="https://img.shields.io/badge/Browser-Chrome-4285F4?logo=chromewebstore" />
  <img src="https://img.shields.io/badge/Qlik-QSEoW-009848?logo=qlik" />
</p>

<table align="center">
  <tr><td align="center"><img src="./docs/images/demo.gif" width="600" alt="Demo"></td></tr>
  <tr><td align="center"><b>Demo:</b> Extension in action</td></tr>
</table>

<br />

## Table of contents

- [Introduction](#introduction)
  - [Features](#features)
- [Privacy & permissions](#privacy--permissions)

## Introduction

Everyone on your team writes Qlik script their own way? Nothing consistent, code hard to
read and a pain to maintain? This extension fixes that — it enforces an opinionated style
guide, autoformats on demand, and flags violations inline, right where you write the script.

A browser binding around [`@qlinter/core`](https://github.com/MuellerConstantin/qlinter/tree/main/packages/core):
the extension owns the platform concerns — injecting into the Data Load Editor, locating the script
content, surfacing diagnostics as inline UI, and wiring up the format action — and delegates every
linting and formatting decision to Core. The bundled Core engine runs entirely client-side; no
script ever leaves the browser, and no backend is involved.

> [!NOTE]
> Currently supports **Qlik Sense Enterprise on Windows** only. Qlik Cloud support is planned.

## Features

- **Inline lint feedback** — diagnostics rendered directly against the editor, with
  underlines on the offending tokens and hover tooltips that explain the rule, so style
  violations surface exactly where you write the script.
- **Severity-aware diagnostics** — each finding is classified as error, warning, or info,
  and the extension popup shows a live count per severity for the active editor.
- **Conformance score** — the popup puts one figure next to the counts: the share of
  lines in the open script that carry no finding. Scripts under ten lines are left
  unscored, where a single finding would swing the number further than the style it
  describes.
- **One-click auto-format** — a single "Fix All" action applies every available autofix
  to the current script and writes the normalized output back into the editor.
- **Configurable, opinionated ruleset** — ships with a sensible default style guide, but
  every rule can be toggled or tuned via Core's config, so teams can adapt the linter to
  their own conventions instead of fighting the defaults.
- **Fully client-side** — the bundled Core engine runs entirely in the browser; your
  script never leaves the page and no backend is involved.

## Privacy & permissions

qlinter collects nothing, transmits nothing, and contacts no server — there is not a single network
call in the extension. Your scripts are linted in the page and never leave the browser. The only
thing persisted is your own rule configuration.

The extension holds **no site access at install**: `<all_urls>` is declared as an *optional* host
permission and grants nothing until you enable a specific Qlik server through the popup, one origin
at a time. That indirection exists because Qlik Sense Enterprise is self-hosted — every installation
lives on its own private hostname, so no fixed URL pattern could ever match them.

- [**Permission rationale**](./docs/permissions.md) — every permission, why it's needed, and the
  code that uses it.
- [**Privacy policy**](../../docs/PRIVACY.md) — what is read, what is stored, and what leaves your
  machine.
