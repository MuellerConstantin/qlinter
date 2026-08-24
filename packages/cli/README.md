<p align="center">
  <img width="200" alt="Logo" src="./docs/images/logo.svg">
  <h1 align="center">@qlinter/cli</h1>
</p>
<p align="center">
  Command-line interface for qlinter — lints and formats Qlik load scripts from the terminal or in CI.
</p>
<p align="center">
  <img src="https://img.shields.io/badge/npm-CB3837?logo=npm" />
  <img src="https://img.shields.io/badge/Node.js-5FA04E?logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" />
</p>

<br />

## Table of contents

- [Introduction](#introduction)
  - [Features](#features)
  - [Usage](#usage)
    - [Synopsis](#synopsis)
    - [Options](#options)
    - [Configuration](#configuration)
    - [Examples](#examples)
    - [Exit codes](#exit-codes)

## Introduction

Everyone on your team writes Qlik script their own way? Nothing consistent, code hard to
read and a pain to maintain? The qlinter CLI fixes that — run it locally against your
scripts or wire it into CI to enforce an opinionated style guide on every commit,
autoformat in place, and fail the build when violations slip through.

A thin wrapper around [`@qlinter/core`](https://github.com/MuellerConstantin/qlinter/tree/main/packages/core):
the CLI owns the platform concerns — file discovery (globs), reading/writing scripts,
configuration resolution, and process exit codes — and delegates every linting and formatting
decision to Core. No style logic lives here; the binding only translates between the filesystem and
Core's string-in, diagnostics-out API.

## Features

- **`check` mode** — lint-only. Reports diagnostics and exits non-zero on errors,
  leaving files untouched. Intended for CI gates and pre-commit hooks.
- **`--fix` mode** — auto-format. Applies Core's formatter in place and writes the
  normalized output back to disk.
- **Files or directories** — accepts one or more file paths or directories; directories
  are walked recursively for `.qvs` scripts.
- **Multiple output formats** — human-readable `stylish` (default) or machine-readable
  `json`, so diagnostics can feed straight into CI reporters or other tooling.
- **Severity-aware exit codes** — `0` when clean, non-zero on errors. Drop-in ready for
  CI gates, pre-commit hooks, and pipeline steps.
- **Explicit configuration** — the CLI applies no implicit defaults; it runs exactly the
  config you supply via `--config`. Name Core's `recommended` preset to get the same
  opinionated style guide the Chrome and VS Code extensions ship with, or tailor it per rule.

## Usage

### Synopsis

```
qlinter --config <path> [options] <files|dirs...>
```

`--config` is required. The CLI also takes one or more positional arguments — each a path to a `.qvs` file or a
directory. Directories are walked recursively and every `.qvs` script inside is linted.
Shell globs (e.g. `src/**/*.qvs`) work via shell expansion; the CLI itself does not
interpret glob patterns.

### Options

| Option                      | Description                                                          |
| --------------------------- | -------------------------------------------------------------------- |
| `--fix`                     | Auto-fix violations and write the formatted output back to disk.     |
| `--format <stylish\|json>`  | Output format. `stylish` (default) is human-readable; `json` emits one JSON object per diagnostic for machine consumption. |
| `--quiet`                   | Only print `error`-level diagnostics; suppress `warning` and `info`. |
| `-c`, `--config <path>`     | **Required.** Path to a JSON config file, used verbatim (no implicit defaults). |
| `-h`, `--help`              | Print the help text and exit.                                        |

### Configuration

The CLI applies **no implicit defaults** — it runs exactly the config you point
it at via `--config <path>`, used verbatim. Running without `--config` exits with
an error. There is no auto-discovery; the path must be supplied explicitly.

Run `qlinter init` to scaffold a starter `qlinter.json` in the current directory: it
names the `recommended` preset and leaves an empty `rules` map for your
overrides. It refuses to overwrite an existing `qlinter.json`, so an established
config is never clobbered.

The file has the same shape as Core's `LintConfig`: a `presets` field naming the
built-in preset(s) to start from and a `rules` object keyed by rule ID. To run
the opinionated default set, name it explicitly:

```json
{
  "presets": "recommended",
  "rules": {
    "trailing-whitespace": "off",
    "max-line-length": ["warning", { "max": 120 }]
  }
}
```

`rules` overrides the preset per rule — each entry is a severity string
(`"error"`, `"warning"`, `"info"`, `"off"`) or a `[severity, options]` tuple.
Use `null` as the severity (`[null, { "size": 2 }]`) to set options while leaving
the severity to the preset or the rule's own default.
Omit `presets` (or set `"presets": []`) to run **only** the rules you list, with
no preset base.

Unknown rule IDs, unknown preset names, invalid JSON, unknown severities, and
malformed rule entries all fail with a clear error and exit code `2` before any
linting starts.

### Examples

```bash
# Scaffold a qlinter.json in the current directory
qlinter init

# Lint a single script
qlinter --config qlinter.json scripts/load.qvs

# Lint everything under a directory tree
qlinter --config qlinter.json src/

# Lint multiple targets at once
qlinter --config qlinter.json src/load.qvs src/transform.qvs lib/

# Auto-fix and write changes back in place
qlinter --config qlinter.json --fix src/

# Errors only, machine-readable output (e.g. for CI reporters)
qlinter --config qlinter.json --quiet --format json src/
```

### Exit codes

| Code | Meaning                                                                |
| ---- | ---------------------------------------------------------------------- |
| `0`  | No errors. Files were clean, or only `warning`/`info` diagnostics were reported. |
| `1`  | At least one `error`-level diagnostic was reported.                    |
| `2`  | Usage error — no targets given, path not found, or no `.qvs` files matched. |
