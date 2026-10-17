import type { AnyRule, OptionSchema } from '@qlinter/core';

/*
 * Imported by tsdown.config.ts, which Node loads without a bundler, so this
 * module must not import anything at runtime that a relative `.js` specifier
 * would have to resolve to a `.ts` file.
 */

const SEVERITIES = ['error', 'warning', 'info', 'off'] as const;

type JsonSchema = Record<string, unknown>;

function optionSchema(spec: OptionSchema, defaultValue: unknown): JsonSchema {
  const base: JsonSchema = defaultValue === undefined ? {} : { default: defaultValue };

  if (spec.type === 'enum') {
    return { ...base, enum: [...spec.values] };
  }

  return {
    ...base,
    type: 'integer',
    ...(spec.min === undefined ? {} : { minimum: spec.min }),
    ...(spec.max === undefined ? {} : { maximum: spec.max }),
  };
}

function ruleEntrySchema(rule: AnyRule, docsUrl: string): JsonSchema {
  const defaults = (rule.defaultOptions ?? {}) as Record<string, unknown>;
  const options = Object.fromEntries(
    Object.entries(rule.options ?? {}).map(([key, spec]) => [key, optionSchema(spec, defaults[key])]),
  );

  return {
    markdownDescription: `Default severity: \`${rule.defaultSeverity}\`. [Rule reference](${docsUrl})`,
    oneOf: [
      { enum: [...SEVERITIES] },
      {
        type: 'array',
        minItems: 1,
        maxItems: 2,
        items: [{ enum: [...SEVERITIES, null] }, { type: 'object', properties: options, additionalProperties: false }],
      },
    ],
  };
}

/**
 * Builds a JSON Schema (draft-07) for `qlinter.json` from the rules and presets
 * Core ships, so the editor's completions and checks cannot drift from what
 * `validateConfig` accepts.
 *
 * @param rules - Every rule a config may name.
 * @param presets - Every preset a config may name.
 * @param docsUrl - Where a rule is documented, linked from its hover.
 */
export function configSchema(
  rules: readonly AnyRule[],
  presets: readonly string[],
  docsUrl: (ruleId: string) => string,
): JsonSchema {
  const preset = { enum: [...presets] };

  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'qlinter configuration',
    type: 'object',
    additionalProperties: false,
    properties: {
      presets: {
        description: 'Preset or presets to use as a base. Nothing is applied implicitly.',
        oneOf: [preset, { type: 'array', items: preset }],
      },
      rules: {
        description: 'Per-rule entries: a severity, [severity], or [severity, options]; null keeps the severity.',
        type: 'object',
        additionalProperties: false,
        properties: Object.fromEntries(rules.map((rule) => [rule.id, ruleEntrySchema(rule, docsUrl(rule.id))])),
      },
    },
  };
}
