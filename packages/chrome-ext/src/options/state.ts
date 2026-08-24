import type { LintConfig, PresetName, SeverityOrOff } from '@qlinter/core';

/** A severity the user can pick, plus `'default'` for "leave it to the rule". */
export type SeverityChoice = SeverityOrOff | 'default';

export const SEVERITY_CHOICES: readonly SeverityChoice[] = ['default', 'error', 'warning', 'info', 'off'];

/** The marker a control uses for "no value of my own". */
export const DEFAULT_CHOICE = 'default';

function rulesOf(config: LintConfig): Record<string, unknown> {
  return { ...(config.rules as Record<string, unknown> | undefined) };
}

function entryOf(config: LintConfig, ruleId: string): unknown {
  return (config.rules as Record<string, unknown> | undefined)?.[ruleId];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function severityFor(config: LintConfig, ruleId: string): SeverityChoice {
  const entry = entryOf(config, ruleId);

  if (typeof entry === 'string') {
    return entry as SeverityOrOff;
  }

  if (Array.isArray(entry) && typeof entry[0] === 'string') {
    return entry[0] as SeverityOrOff;
  }

  return 'default';
}

export function optionsFor(config: LintConfig, ruleId: string): Record<string, unknown> {
  const entry = entryOf(config, ruleId);

  if (Array.isArray(entry) && isPlainObject(entry[1])) {
    return entry[1];
  }

  return {};
}

/*
 * The single writer for a rule entry, so severity and options can never
 * disagree about the shape they share.
 *
 * An entry is only written in tuple form when it carries options; a bare
 * severity string stays a string, and a rule with neither is dropped entirely.
 * `null` in the severity slot is what lets options exist without a severity
 * being chosen — writing a concrete one would pin it.
 */
function withEntry(
  config: LintConfig,
  ruleId: string,
  severity: SeverityChoice,
  options: Record<string, unknown>,
): LintConfig {
  const rules = rulesOf(config);

  if (Object.keys(options).length > 0) {
    rules[ruleId] = [severity === DEFAULT_CHOICE ? null : severity, options];
  } else if (severity === DEFAULT_CHOICE) {
    delete rules[ruleId];
  } else {
    rules[ruleId] = severity;
  }

  const next: LintConfig = { ...config };

  if (Object.keys(rules).length === 0) {
    delete next.rules;
  } else {
    next.rules = rules as LintConfig['rules'];
  }

  return next;
}

export function withSeverity(config: LintConfig, ruleId: string, severity: SeverityChoice): LintConfig {
  return withEntry(config, ruleId, severity, optionsFor(config, ruleId));
}

/** Sets one option, or clears it when `value` is `undefined`. */
export function withOption(
  config: LintConfig,
  ruleId: string,
  key: string,
  value: string | number | undefined,
): LintConfig {
  const options = { ...optionsFor(config, ruleId) };

  if (value === undefined) {
    delete options[key];
  } else {
    options[key] = value;
  }

  return withEntry(config, ruleId, severityFor(config, ruleId), options);
}

/** The selected presets, normalized to an array. */
export function presetsOf(config: LintConfig): PresetName[] {
  const presets = config.presets;

  if (presets === undefined) {
    return [];
  }

  return Array.isArray(presets) ? [...presets] : [presets];
}

/*
 * An empty list drops the key entirely — nothing is applied implicitly. A single
 * entry is stored as a plain string to keep the JSON idiomatic, more as an array.
 */
export function withPresets(config: LintConfig, next: readonly PresetName[]): LintConfig {
  const result: LintConfig = { ...config };

  if (next.length === 0) {
    delete result.presets;
  } else {
    result.presets = next.length === 1 ? next[0] : [...next];
  }

  return result;
}
