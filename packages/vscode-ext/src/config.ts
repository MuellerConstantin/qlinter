import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateConfig, type LintConfig } from '@qlinter/core';

/** Conventional config filename, matching the CLI's `--config` convention. */
export const CONFIG_FILENAME = 'qlinter.json';

/** Where a resolved config came from, surfaced in the status bar. */
export type ConfigSource = 'qlinter.json' | 'settings';

export interface ResolvedConfig {
  readonly config: LintConfig;
  readonly source: ConfigSource;
  /** Absolute path of the `qlinter.json` used, only when `source` is `qlinter.json`. */
  readonly path?: string;
}

/**
 * Raw `qlinter.*` setting values, as read from VS Code's configuration. Rules
 * have no setting: they are configured in a `qlinter.json`, the one place with a
 * schema the editor completes against.
 */
export interface SettingsInput {
  readonly presets: unknown;
}

/**
 * Reads, parses, and validates a `qlinter.json`. Mirrors the CLI's loader so both
 * bindings report identical errors. Kept as a separate copy rather than shared:
 * it is a trivial three-liner, and Core stays I/O-free by design, so there is no
 * natural home to extract it to yet (Rule of Three).
 *
 * @throws If the file is missing, not valid JSON, or not a valid config.
 */
export function loadConfigFile(path: string): LintConfig {
  let raw: string;

  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    throw new Error(`Config file not found: ${path}`, { cause: err });
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid JSON in config file ${path}: ${message}`, { cause: err });
  }

  return validateConfig(parsed, path);
}

/**
 * Builds a {@link LintConfig} from VS Code setting values. An empty preset list
 * collapses to an empty config, which runs no rules.
 *
 * Core still applies nothing implicitly: `qlinter.presets` simply *declares*
 * `["recommended"]` as its default in the manifest, so the value arriving here
 * is an explicit user-visible setting that the Settings UI shows and that can
 * be set back to `[]`. The extension never writes to the user's settings.
 *
 * @throws If the settings do not form a valid config (e.g. an unknown preset).
 */
export function configFromSettings(input: SettingsInput): LintConfig {
  const raw: Record<string, unknown> = {};

  if (Array.isArray(input.presets) && input.presets.length > 0) {
    raw.presets = input.presets;
  }

  return validateConfig(raw, 'VS Code settings');
}

/**
 * Resolves the config for a document. A `qlinter.json` at the document's workspace
 * folder root wins; otherwise the VS Code settings apply. This is the deliberate
 * split for Qlik scripts, which — unlike ESLint projects — often open as a lone
 * `.qvs` file with no folder: those fall through to settings.
 *
 * Precedence is strict, never merged. A folder root of `undefined` (a loose file
 * with no workspace) skips the file lookup entirely.
 *
 * @throws If a present `qlinter.json` is invalid, or the settings are invalid.
 */
export function resolveConfig(folderRoot: string | undefined, settings: SettingsInput): ResolvedConfig {
  if (folderRoot !== undefined) {
    const path = join(folderRoot, CONFIG_FILENAME);

    if (existsSync(path)) {
      return { config: loadConfigFile(path), source: 'qlinter.json', path };
    }
  }

  return { config: configFromSettings(settings), source: 'settings' };
}
