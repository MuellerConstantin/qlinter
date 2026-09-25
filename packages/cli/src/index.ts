#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import { lint, format, type Diagnostic, type LintConfig } from '@qlinter/core';
import { initConfig, loadConfig } from './config.js';

const HELP_TEXT = `qlinter – Style-Linter for Qlik Script (QVS) files

Usage: qlinter --config <path> [options] <files|dirs...>
       qlinter init

Commands:
  init                      Create a qlinter.json (presets: recommended) in the
                            current directory; fails if one already exists

Options:
  --fix                     Auto-fix violations and write files in place
  --format <stylish|json>   Format (default: stylish)
  --quiet                   Show 'error' only, 'warning'/'info' is supressed
  -c, --config <path>       Path to a JSON config file (required)
  -h, --help                This help

The config is used verbatim — there is no implicit default. To run the
opinionated default rule set, name it in the config: { "presets": "recommended" }.`;

function collectScriptFiles(target: string): string[] {
  let stats;

  try {
    stats = statSync(target);
  } catch {
    console.error(`Path not found: ${target}`);
    process.exit(2);
  }

  if (stats.isFile()) {
    return target.endsWith('.qvs') ? [target] : [];
  }

  const out: string[] = [];

  for (const element of readdirSync(target, { withFileTypes: true })) {
    const path = join(target, element.name);
    out.push(...(element.isDirectory() ? collectScriptFiles(path) : path.endsWith('.qvs') ? [path] : []));
  }

  return out;
}

/*
 * A script that is not UTF-8 cannot be read without guessing its encoding, and
 * written back as UTF-8 it would lose every character the guess got wrong. It is
 * skipped rather than read.
 *
 * A byte order mark says how the file is encoded, not what the script says, so
 * the decoder drops it and Core never sees it. It is put back on write: on
 * Windows Qlik reads a script as UTF-8 only when it starts with one and assumes
 * ANSI otherwise, so losing it would change how every non-ASCII character of
 * the script is read.
 *
 * @see {@link https://help.qlik.com/en-US/sense/May2026/Subsystems/Hub/Content/Sense_Hub/Scripting/SystemVariables/Include.htm | Include — Limitations}
 */
const UTF8 = new TextDecoder('utf-8', { fatal: true });

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

function stylish(file: string, d: Diagnostic): string {
  const { line, column } = d.range.start;
  return `  ${relative(process.cwd(), file)}:${line}:${column}  ${d.severity}  ${d.ruleId}  ${d.message}`;
}

function main(): void {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      fix: { type: 'boolean', default: false },
      format: { type: 'string', default: 'stylish' },
      quiet: { type: 'boolean', default: false },
      config: { type: 'string', short: 'c' },
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: true,
  });

  if (values.help || positionals.length === 0) {
    console.log(HELP_TEXT);
    process.exit(values.help ? 0 : 2);
  }

  if (positionals[0] === 'init') {
    try {
      const path = initConfig(process.cwd());
      console.log(`Created ${relative(process.cwd(), path)}`);
      process.exit(0);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  }

  // The CLI assumes nothing implicitly: a config must be supplied and is used
  // verbatim. To get the opinionated defaults, the config names them via
  // `"presets": "recommended"`.
  if (!values.config) {
    console.error('No config file provided. Pass one with --config <path>, e.g. { "presets": "recommended" }.');
    process.exit(2);
  }

  const files = positionals.flatMap(collectScriptFiles);

  if (files.length === 0) {
    console.error('No Qlik Script (QVS) files found.');
    process.exit(2);
  }

  let config: LintConfig;

  try {
    config = loadConfig(values.config);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(2);
  }

  let errors = 0;
  let warnings = 0;
  let fixedTotal = 0;
  let skipped = 0;

  for (const file of files) {
    const bytes = readFileSync(file);
    const bom = bytes.subarray(0, BOM.length).equals(BOM) ? '﻿' : '';
    let source: string;

    try {
      source = UTF8.decode(bytes);
    } catch {
      console.error(
        `${relative(process.cwd(), file)}: not valid UTF-8, skipped. Save it as UTF-8 with a byte order mark to lint it.`,
      );
      skipped++;
      continue;
    }

    let diagnostics: Diagnostic[];

    if (values.fix) {
      const result = format(source, config);
      diagnostics = result.diagnostics;
      fixedTotal += result.fixed;

      if (result.output !== source) {
        writeFileSync(file, bom + result.output, 'utf8');
      }
    } else {
      diagnostics = lint(source, config);
    }

    if (values.quiet) {
      diagnostics = diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
    }

    for (const diagnostic of diagnostics) {
      if (diagnostic.severity === 'error') {
        errors++;
      } else if (diagnostic.severity === 'warning') {
        warnings++;
      }

      if (values.format === 'json') {
        console.log(JSON.stringify({ file, ...diagnostic }));
      } else {
        console.log(stylish(file, diagnostic));
      }
    }
  }

  if (values.format !== 'json') {
    const fixedNote = values.fix ? `, ${fixedTotal} fix(es) applied` : '';
    const skippedNote = skipped > 0 ? `, ${skipped} file(s) skipped` : '';
    console.log(`\n${errors} error(s), ${warnings} warning(s) in ${files.length} file(s)${fixedNote}${skippedNote}.`);
  }

  // A skipped file was never checked, so the run cannot vouch for it whatever the others found.
  process.exit(skipped > 0 ? 2 : errors > 0 ? 1 : 0);
}

main();
