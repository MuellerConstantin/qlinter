import { registry, presetNames } from '../rules/index.js';
import type { LintConfig } from '../rules/index.js';
import type { AnyRule } from '../types.js';
import { validateOptions } from './options.js';

const VALID_SEVERITIES = new Set(['error', 'warning', 'info', 'off']);
const VALID_PRESETS = new Set<string>(presetNames);
const ALLOWED_KEYS = new Set(['presets', 'rules']);

/**
 * Validates an untrusted, JSON-parsed value against the {@link LintConfig} shape
 * and returns it typed.
 *
 * Ensures the value is an object whose only keys are `presets` and `rules`, that
 * every rule id is known to the built-in registry, that each entry is a valid
 * severity or a `[severity, options]` tuple, and that any options satisfy the
 * schema the rule declares.
 *
 * @param value - The parsed JSON value to validate.
 * @param sourceLabel - Optional label (e.g. a file path) interpolated into error
 *   messages so users can locate the offending source.
 * @returns The same value, typed as {@link LintConfig}.
 * @throws If the value is not a valid config — unknown top-level key, unknown
 *   rule id, invalid severity, or malformed rule entry.
 */
export function validateConfig(value: unknown, sourceLabel?: string): LintConfig {
  const where = sourceLabel ? ` in ${sourceLabel}` : '';

  if (!isPlainObject(value)) {
    throw new Error(`Config${where} must be a JSON object.`);
  }

  for (const key of Object.keys(value)) {
    if (!ALLOWED_KEYS.has(key)) {
      throw new Error(`Config${where} has unknown key "${key}". Only "presets" and "rules" are supported.`);
    }
  }

  if (value.presets !== undefined) {
    validatePresets(value.presets, where);
  }

  if (value.rules === undefined) {
    return value as LintConfig;
  }

  if (!isPlainObject(value.rules)) {
    throw new Error(`Config field "rules"${where} must be an object.`);
  }

  for (const [ruleId, entry] of Object.entries(value.rules)) {
    const rule = registry.get(ruleId);

    if (!rule) {
      throw new Error(`Config${where} references unknown rule "${ruleId}".`);
    }

    validateRuleEntry(rule, entry, where);
  }

  return value as LintConfig;
}

function validatePresets(value: unknown, where: string): void {
  const names = Array.isArray(value) ? value : [value];

  for (const name of names) {
    if (typeof name !== 'string') {
      throw new Error(`Config field "presets"${where} must be a preset name or an array of preset names.`);
    }

    if (!VALID_PRESETS.has(name)) {
      throw new Error(`Config${where} references unknown preset "${name}". Known presets: ${presetNames.join(', ')}.`);
    }
  }
}

function validateRuleEntry(rule: AnyRule, entry: unknown, where: string): void {
  if (typeof entry === 'string') {
    assertSeverity(entry, rule.id, where);
    return;
  }

  if (Array.isArray(entry)) {
    if (entry.length < 1 || entry.length > 2) {
      throw new Error(`Rule "${rule.id}"${where} must be [severity] or [severity, options].`);
    }
    assertTupleSeverity(entry[0], rule.id, where);
    validateOptions(rule, entry[1], where);
    return;
  }

  throw new Error(`Rule "${rule.id}"${where} must be a severity string or an array.`);
}

function assertSeverity(value: unknown, ruleId: string, where: string): void {
  if (typeof value !== 'string' || !VALID_SEVERITIES.has(value)) {
    throw new Error(
      `Rule "${ruleId}"${where} has invalid severity "${String(value)}". Expected one of: error, warning, info, off.`,
    );
  }
}

/*
 * The tuple's severity slot additionally accepts `null`: "leave the severity as
 * it is, but apply these options". Without it, setting a single option forces
 * the author to restate a severity they never chose, which silently pins it
 * against later changes to the preset or the rule's default.
 */
function assertTupleSeverity(value: unknown, ruleId: string, where: string): void {
  if (value === null) {
    return;
  }

  if (typeof value !== 'string' || !VALID_SEVERITIES.has(value)) {
    throw new Error(
      `Rule "${ruleId}"${where} has invalid severity "${String(value)}". Expected one of: error, warning, info, off, ` +
        `or null to keep the current severity.`,
    );
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
