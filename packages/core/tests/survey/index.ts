import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { lexer } from '../../src/lexer.js';
import {
  bareLineFeeds,
  changedCommentContent,
  changedOpaqueContent,
  clashesWhileFormatting,
  newLexErrors,
  orderDependence,
  secondPassChanges,
  unsafeFixes,
} from '../invariants.js';

/*
 * A survey: runs the invariants over a corpus of scripts nobody here wrote,
 * and reports what they find instead of failing on it.
 *
 * The report quotes the scripts, so it defaults to a file beside the corpus
 * rather than anywhere inside the repo.
 *
 * The corpus lives outside the repo and its findings are leads, not
 * regressions: each one is reduced to a minimal script and pinned as a fixture
 * before anything is fixed.
 */

const CHECKS: Record<string, (source: string) => string[]> = {
  'unsafe-fix': unsafeFixes,
  'rule-clash': clashesWhileFormatting,
  'order-dependence': orderDependence,
  'new-lex-error': newLexErrors,
  'opaque-content': changedOpaqueContent,
  'comment-content': changedCommentContent,
  'bare-lf': bareLineFeeds,
  'second-pass': secondPassChanges,
};

/*
 * The scripts are known to run in Qlik, so a character the lexer skips in one
 * is a construct the lexer does not know yet, not an error in the script.
 */
function inputLexErrors(source: string): string[] {
  return lexer
    .tokenize(source)
    .errors.map(
      (error) =>
        `line ${error.line ?? '?'} skips ${JSON.stringify(source.slice(error.offset, error.offset + error.length))}`,
    );
}

const UTF8 = new TextDecoder('utf-8', { fatal: true });

interface Finding {
  file: string;
  check: string;
  detail: string;
}

/* Every `.qvs` below `dir`, the same files the CLI would pick up. */
function scripts(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      return scripts(path);
    }

    return entry.name.endsWith('.qvs') ? [path] : [];
  });
}

/* A finding's rule, or the finding itself where it names none, so like findings count together. */
function groupOf(finding: Finding): string {
  const rule = /^([a-z]+(?:-[a-z]+)+)\b/.exec(finding.detail);

  return `${finding.check}: ${rule === null ? finding.detail.replace(/\d+/g, 'N') : rule[1]}`;
}

function main(): void {
  const [dir, reportArg] = process.argv.slice(2);

  if (dir === undefined) {
    throw new Error('usage: npm run survey -w @qlinter/core -- <corpus-dir> [report.json]');
  }

  const reportPath = reportArg ?? `${resolve(dir)}-survey.json`;

  const files = scripts(dir);

  if (files.length === 0) {
    throw new Error(`no .qvs files below ${dir}`);
  }

  const findings: Finding[] = [];
  const started = Date.now();

  files.forEach((path, index) => {
    const file = relative(dir, path);
    let source: string;

    // Decoded the way the CLI decodes: a script that is not UTF-8 is skipped, and a byte order mark never reaches Core.
    try {
      source = UTF8.decode(readFileSync(path));
    } catch {
      findings.push({ file, check: 'not-utf8', detail: 'not valid UTF-8, the CLI skips it' });
      return;
    }

    for (const detail of inputLexErrors(source)) {
      findings.push({ file, check: 'input-lex-error', detail });
    }

    for (const [check, run] of Object.entries(CHECKS)) {
      try {
        for (const detail of run(source)) {
          findings.push({ file, check, detail });
        }
      } catch (error) {
        findings.push({ file, check, detail: `throws: ${error instanceof Error ? error.message : String(error)}` });
      }
    }

    if (process.stderr.isTTY) {
      process.stderr.write(`\r${index + 1}/${files.length}`);
    }
  });

  process.stderr.write('\n');

  const groups = new Map<string, { findings: number; files: Set<string>; example: Finding }>();

  for (const finding of findings) {
    const key = groupOf(finding);
    const group = groups.get(key) ?? { findings: 0, files: new Set<string>(), example: finding };
    group.findings++;
    group.files.add(finding.file);
    groups.set(key, group);
  }

  const summary = [...groups.entries()]
    .map(([group, { findings: count, files: hit, example }]) => ({
      group,
      files: hit.size,
      findings: count,
      example: `${example.file}: ${example.detail}`,
    }))
    .sort((a, b) => b.files - a.files);

  const affected = new Set(findings.map((finding) => finding.file)).size;

  console.log(`${files.length} scripts, ${affected} with findings, ${((Date.now() - started) / 1000).toFixed(1)}s\n`);

  for (const row of summary) {
    console.log(`${String(row.files).padStart(5)} files  ${String(row.findings).padStart(6)}x  ${row.group}`);
    console.log(`${' '.repeat(22)}e.g. ${row.example.slice(0, 160)}`);
  }

  writeFileSync(reportPath, JSON.stringify({ scripts: files.length, summary, findings }, null, 2));
  console.log(`\nfull report: ${reportPath}`);
}

main();
