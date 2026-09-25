import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/*
 * The CLI is exercised as a subprocess rather than by importing it: its entry
 * point runs on import and communicates through exit codes, which is precisely
 * the contract worth testing. Requires a build — CI builds before it tests.
 */
const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'index.js');

interface RunResult {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

let dir: string;

function run(...args: string[]): RunResult {
  const result = spawnSync(process.execPath, [CLI, ...args], { cwd: dir, encoding: 'utf8' });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

function write(name: string, contents: string): string {
  const path = join(dir, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, 'utf8');
  return path;
}

/** A config enabling a single rule, so assertions do not depend on preset contents. */
function config(severity: string): string {
  return write('qlinter.json', JSON.stringify({ rules: { 'trailing-whitespace': severity } }));
}

beforeAll(() => {
  if (!existsSync(CLI)) {
    throw new Error(`CLI not built at ${CLI} — run \`npm run build\` first.`);
  }
});

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'qlinter-cli-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('usage', () => {
  it('prints help and succeeds for --help', () => {
    const { code, stdout } = run('--help');

    expect(code).toBe(0);
    expect(stdout).toContain('Usage: qlinter');
  });

  it('prints help and fails when called without arguments', () => {
    const { code, stdout } = run();

    expect(code).toBe(2);
    expect(stdout).toContain('Usage: qlinter');
  });

  it('refuses to run without a config, rather than assuming defaults', () => {
    write('script.qvs', 'SET x = 1;\n');

    const { code, stderr } = run('script.qvs');

    expect(code).toBe(2);
    expect(stderr).toMatch(/No config file provided/);
  });

  it('reports an unreadable config', () => {
    write('script.qvs', 'SET x = 1;\n');
    write('broken.json', '{ rules: ');

    const { code, stderr } = run('--config', 'broken.json', 'script.qvs');

    expect(code).toBe(2);
    expect(stderr).toMatch(/Invalid JSON/);
  });
});

describe('file discovery', () => {
  it('reports a path that does not exist', () => {
    config('error');

    const { code, stderr } = run('--config', 'qlinter.json', 'nope.qvs');

    expect(code).toBe(2);
    expect(stderr).toMatch(/Path not found/);
  });

  it('reports when a directory holds no scripts', () => {
    config('error');
    mkdirSync(join(dir, 'empty'));

    const { code, stderr } = run('--config', 'qlinter.json', 'empty');

    expect(code).toBe(2);
    expect(stderr).toMatch(/No Qlik Script \(QVS\) files found/);
  });

  it('collects scripts recursively and ignores other file types', () => {
    config('error');
    write('scripts/nested/deep.qvs', 'SET x = 1;   \n');
    write('scripts/notes.txt', 'ignore me   \n');

    const { code, stdout } = run('--config', 'qlinter.json', 'scripts');

    expect(code).toBe(1);
    expect(stdout).toContain('deep.qvs');
    expect(stdout).not.toContain('notes.txt');
    expect(stdout).toMatch(/in 1 file\(s\)/);
  });
});

describe('exit codes', () => {
  it('succeeds on a clean file', () => {
    config('error');
    write('script.qvs', 'SET x = 1;\n');

    const { code, stdout } = run('--config', 'qlinter.json', 'script.qvs');

    expect(code).toBe(0);
    expect(stdout).toMatch(/0 error\(s\), 0 warning\(s\)/);
  });

  it('fails on an error-level violation', () => {
    config('error');
    write('script.qvs', 'SET x = 1;   \n');

    const { code, stdout } = run('--config', 'qlinter.json', 'script.qvs');

    expect(code).toBe(1);
    expect(stdout).toContain('script.qvs:1:11  error  trailing-whitespace');
    expect(stdout).toMatch(/1 error\(s\)/);
  });

  it('succeeds despite warnings, so only errors gate a pipeline', () => {
    config('warning');
    write('script.qvs', 'SET x = 1;   \n');

    const { code, stdout } = run('--config', 'qlinter.json', 'script.qvs');

    expect(code).toBe(0);
    expect(stdout).toContain('warning  trailing-whitespace');
    expect(stdout).toMatch(/0 error\(s\), 1 warning\(s\)/);
  });
});

describe('output formats', () => {
  it('suppresses non-errors with --quiet', () => {
    config('warning');
    write('script.qvs', 'SET x = 1;   \n');

    const { code, stdout } = run('--config', 'qlinter.json', '--quiet', 'script.qvs');

    expect(code).toBe(0);
    expect(stdout).not.toContain('trailing-whitespace');
  });

  it('emits one JSON object per diagnostic and no summary with --format json', () => {
    config('error');
    write('script.qvs', 'SET x = 1;   \n');

    const { stdout } = run('--config', 'qlinter.json', '--format', 'json', 'script.qvs');
    const lines = stdout.trim().split(/\r?\n/);

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({
      ruleId: 'trailing-whitespace',
      severity: 'error',
    });
  });
});

describe('--fix', () => {
  it('writes the fixed file back and reports the count', () => {
    config('error');
    const path = write('script.qvs', 'SET x = 1;   \n');

    const { stdout } = run('--config', 'qlinter.json', '--fix', 'script.qvs');

    expect(readFileSync(path, 'utf8')).toBe('SET x = 1;\n');
    expect(stdout).toMatch(/fix\(es\) applied/);
  });

  it('leaves a clean file untouched', () => {
    config('error');
    const path = write('script.qvs', 'SET x = 1;\n');

    const { code } = run('--config', 'qlinter.json', '--fix', 'script.qvs');

    expect(code).toBe(0);
    expect(readFileSync(path, 'utf8')).toBe('SET x = 1;\n');
  });
});

describe('encoding', () => {
  /* `Let x = 'Größe';   ` in Windows-1252, as a QlikView-era script is often saved. */
  const ansi = Buffer.from([...Buffer.from("Let x = 'Gr", 'latin1'), 0xf6, 0xdf, ...Buffer.from("e';   \n", 'latin1')]);

  it('skips a script that is not UTF-8 and fails the run', () => {
    config('warning');
    writeFileSync(join(dir, 'ansi.qvs'), ansi);

    const { code, stderr } = run('--config', 'qlinter.json', 'ansi.qvs');

    expect(code).toBe(2);
    expect(stderr).toContain('ansi.qvs: not valid UTF-8, skipped');
  });

  it('never writes to a script it could not read', () => {
    config('error');
    writeFileSync(join(dir, 'ansi.qvs'), ansi);

    run('--config', 'qlinter.json', '--fix', 'ansi.qvs');

    expect(readFileSync(join(dir, 'ansi.qvs'))).toEqual(ansi);
  });

  it('still checks the other scripts of the run', () => {
    config('error');
    writeFileSync(join(dir, 'ansi.qvs'), ansi);
    const path = write('utf8.qvs', 'SET x = 1;   \n');

    const { code, stdout } = run('--config', 'qlinter.json', '--fix', '.');

    expect(code).toBe(2);
    expect(readFileSync(path, 'utf8')).toBe('SET x = 1;\n');
    expect(stdout).toContain('1 file(s) skipped');
  });

  it('keeps a byte order mark through --fix', () => {
    config('error');
    const path = write('bom.qvs', '﻿SET x = 1;   \n');

    run('--config', 'qlinter.json', '--fix', 'bom.qvs');

    expect(readFileSync(path, 'utf8')).toBe('﻿SET x = 1;\n');
  });
});

describe('init', () => {
  it('creates a config naming the recommended preset', () => {
    const { code, stdout } = run('init');

    expect(code).toBe(0);
    expect(stdout).toContain('qlinter.json');
    expect(JSON.parse(readFileSync(join(dir, 'qlinter.json'), 'utf8'))).toEqual({
      presets: 'recommended',
      rules: {},
    });
  });

  it('refuses to overwrite an existing config', () => {
    run('init');

    const { code, stderr } = run('init');

    expect(code).toBe(1);
    expect(stderr).toMatch(/already exists/);
  });
});
