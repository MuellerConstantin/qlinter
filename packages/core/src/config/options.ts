import type { AnyRule, OptionSchema } from '../types.js';

/**
 * Validates the options half of a `[severity, options]` rule entry against the
 * rule's own {@link AnyRule.options} schema.
 *
 * Unknown option keys are rejected rather than ignored: a typo that silently
 * does nothing is the failure mode this validation exists to prevent.
 *
 * @param rule - The rule the entry configures, resolved from the registry.
 * @param value - The entry's options value; `undefined` when the entry carried
 *   none, which is always valid.
 * @param where - Source label fragment, already formatted as `" in <path>"`.
 * @throws If the rule takes no options, the value is not an object, a key is
 *   unknown, or a value does not satisfy its {@link OptionSchema}.
 */
export function validateOptions(rule: AnyRule, value: unknown, where: string): void {
  if (value === undefined) {
    return;
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Options for rule "${rule.id}"${where} must be an object.`);
  }

  /*
   * Judged per key rather than by the presence of an options object, so the
   * empty object stays valid everywhere.
   */
  const schema = rule.options ?? {};

  for (const [key, option] of Object.entries(value)) {
    const spec = schema[key];

    if (spec === undefined) {
      throw new Error(unknownOptionMessage(rule.id, key, Object.keys(schema), where));
    }

    validateOption(rule.id, key, spec, option, where);
  }
}

function unknownOptionMessage(ruleId: string, key: string, known: string[], where: string): string {
  if (known.length === 0) {
    return `Rule "${ruleId}"${where} takes no options, but "${key}" was given.`;
  }

  return `Rule "${ruleId}"${where} has unknown option "${key}". Known options: ${known.join(', ')}.`;
}

function validateOption(ruleId: string, key: string, spec: OptionSchema, value: unknown, where: string): void {
  const label = `Option "${key}" of rule "${ruleId}"${where}`;

  if (spec.type === 'enum') {
    if (typeof value !== 'string' || !spec.values.includes(value)) {
      throw new Error(
        `${label} has invalid value ${JSON.stringify(value)}. Expected one of: ${spec.values.join(', ')}.`,
      );
    }

    return;
  }

  if (spec.type === 'number') {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      throw new Error(`${label} must be an integer, got ${JSON.stringify(value)}.`);
    }

    if (spec.min !== undefined && value < spec.min) {
      throw new Error(`${label} must be at least ${spec.min}, got ${value}.`);
    }

    if (spec.max !== undefined && value > spec.max) {
      throw new Error(`${label} must be at most ${spec.max}, got ${value}.`);
    }

    return;
  }

  /*
   * Exhaustiveness guard. A new OptionSchema variant fails to compile here until
   * it is handled — the mechanism that keeps this validator in step with the
   * contract instead of silently waving the new kind through.
   */
  const unhandled: never = spec;

  throw new Error(`Unhandled option schema ${JSON.stringify(unhandled)}.`);
}
