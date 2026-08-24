import { describe, expect, it } from 'vitest';
import { allRules } from '../src/index.js';
import type { AnyRule } from '../src/index.js';

/*
 * The options schema is what config validation and every host options UI read
 * instead of hard-coding a copy of each rule's option shape. The type system
 * guarantees that a declared schema matches its options type; what it cannot see
 * is a rule that declares `defaultOptions` and then leaves the schema off, or a
 * default its own schema would reject. Both are pinned here.
 */
describe('rule options contract', () => {
  const rules: readonly AnyRule[] = allRules;
  const withOptions = rules.filter((rule) => rule.defaultOptions !== undefined);
  const withoutOptions = rules.filter((rule) => rule.defaultOptions === undefined);

  const cases = (subset: readonly AnyRule[]) => subset.map((rule) => [rule.id, rule] as const);

  it('finds rules on both sides, so neither set of assertions is vacuous', () => {
    expect(withOptions.length).toBeGreaterThan(0);
    expect(withoutOptions.length).toBeGreaterThan(0);
  });

  it.each(cases(withOptions))('%s declares an options schema', (_id, rule) => {
    expect(rule.options).toBeDefined();
  });

  it.each(cases(withOptions))('%s describes exactly the keys of its defaultOptions', (_id, rule) => {
    const defaults = rule.defaultOptions as Record<string, unknown>;

    expect(Object.keys(rule.options ?? {}).sort()).toEqual(Object.keys(defaults).sort());
  });

  it.each(cases(withOptions))('%s has defaults its own schema accepts', (_id, rule) => {
    const defaults = rule.defaultOptions as Record<string, unknown>;

    for (const [key, spec] of Object.entries(rule.options ?? {})) {
      const value = defaults[key];

      if (spec.type === 'enum') {
        expect(spec.values).toContain(value);
        continue;
      }

      expect(typeof value).toBe('number');
      expect(Number.isInteger(value)).toBe(true);

      if (spec.min !== undefined) {
        expect(value as number).toBeGreaterThanOrEqual(spec.min);
      }

      if (spec.max !== undefined) {
        expect(value as number).toBeLessThanOrEqual(spec.max);
      }
    }
  });

  it.each(cases(withoutOptions))('%s declares no schema because it has no options', (_id, rule) => {
    expect(rule.options).toBeUndefined();
  });
});
