import { describe, expect, it } from 'vitest';
import { allRules, presetNames, validateConfig, type AnyRule } from '@qlinter/core';
import { ruleDocsUrl } from '../src/docs.js';
import { configSchema } from '../src/schema.js';

type Schema = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const schema: Schema = configSchema(allRules, presetNames, ruleDocsUrl);
const rules: Schema = schema.properties.rules.properties;

/** The bare-severity form of a rule entry. */
function severity(entry: Schema): Schema {
  return entry.oneOf[0];
}

/** The `[severity, options]` form of a rule entry. */
function tuple(entry: Schema): Schema {
  return entry.oneOf[1];
}

function optionsOf(id: string): Schema {
  return tuple(rules[id]).items[1].properties;
}

const ruleWithOptions = (allRules as readonly AnyRule[]).find((rule) => rule.options !== undefined)!;

describe('configSchema', () => {
  it('describes every rule and no other', () => {
    expect(Object.keys(rules)).toEqual(allRules.map((rule) => rule.id));
    expect(schema.properties.rules.additionalProperties).toBe(false);
  });

  it('accepts only the keys a config may have', () => {
    expect(Object.keys(schema.properties)).toEqual(['presets', 'rules']);
    expect(schema.additionalProperties).toBe(false);
  });

  it('offers every preset, alone or in a list', () => {
    expect(schema.properties.presets.oneOf).toEqual([
      { enum: presetNames },
      { type: 'array', items: { enum: presetNames } },
    ]);
  });

  it('offers exactly the severities Core accepts', () => {
    const offered: string[] = severity(rules[allRules[0].id]).enum;

    for (const value of offered) {
      expect(() => validateConfig({ rules: { [allRules[0].id]: value } })).not.toThrow();
    }

    expect(tuple(rules[allRules[0].id]).items[0].enum).toEqual([...offered, null]);
  });

  it("links each rule's hover to its section of the rule reference", () => {
    for (const rule of allRules) {
      expect(rules[rule.id].markdownDescription).toContain(ruleDocsUrl(rule.id));
      expect(rules[rule.id].markdownDescription).toContain(`\`${rule.defaultSeverity}\``);
    }
  });

  it('describes every option of every rule, and nothing beyond', () => {
    for (const rule of allRules as readonly AnyRule[]) {
      expect(Object.keys(optionsOf(rule.id))).toEqual(Object.keys(rule.options ?? {}));
      expect(tuple(rules[rule.id]).items[1].additionalProperties).toBe(false);
    }
  });

  it("carries each option's values, bounds and default", () => {
    for (const rule of allRules as readonly AnyRule[]) {
      const defaults = (rule.defaultOptions ?? {}) as Record<string, unknown>;

      for (const [key, spec] of Object.entries(rule.options ?? {})) {
        const option = optionsOf(rule.id)[key];
        expect(option.default).toEqual(defaults[key]);

        if (spec.type === 'enum') {
          expect(option.enum).toEqual(spec.values);
        } else {
          expect(option).toMatchObject({ type: 'integer', minimum: spec.min, maximum: spec.max });
        }
      }
    }
  });

  it('describes options Core actually accepts', () => {
    const [key, option] = Object.entries(optionsOf(ruleWithOptions.id))[0];
    const value = option.enum?.[0] ?? option.minimum ?? option.default;

    expect(() => validateConfig({ rules: { [ruleWithOptions.id]: [null, { [key]: value }] } })).not.toThrow();
  });
});
