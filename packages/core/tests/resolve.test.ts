import { describe, expect, it } from 'vitest';
import { lint } from '../src/runner.js';
import { maxLineLength, recommended, resolveConfig } from '../src/rules/index.js';

const SOURCE = 'SET vX=1;\n';

describe('resolveConfig', () => {
  it("expands a preset name to that preset's rules", () => {
    expect(resolveConfig({ presets: 'recommended' })).toEqual({ rules: recommended.rules });
  });

  it('treats a single preset name and a one-element array identically', () => {
    expect(resolveConfig({ presets: ['recommended'] })).toEqual(resolveConfig({ presets: 'recommended' }));
  });

  it('resolves an empty preset list to no rules', () => {
    expect(resolveConfig({ presets: [] })).toEqual({ rules: {} });
  });

  it('applies no preset when none is named', () => {
    expect(resolveConfig({ rules: { 'trailing-whitespace': 'off' } })).toEqual({
      rules: { 'trailing-whitespace': 'off' },
    });
  });

  it('overlays config rules over the preset base per rule id', () => {
    const resolved = resolveConfig({
      presets: 'recommended',
      rules: { 'max-line-length': ['error', { max: 50 }] },
    });

    expect(resolved.rules?.['max-line-length']).toEqual(['error', { max: 50 }]);
    expect(resolved.rules?.['trailing-whitespace']).toBe(recommended.rules?.['trailing-whitespace']);
  });

  it('throws on an unknown preset name', () => {
    expect(() => resolveConfig({ presets: 'strict' as 'recommended' })).toThrow(/Unknown preset "strict"/);
  });
});

describe('lint preset resolution', () => {
  it('lints with the named preset exactly as passing the recommended object', () => {
    expect(lint(SOURCE, { presets: 'recommended' })).toEqual(lint(SOURCE, recommended));
  });

  it('runs no rules when the preset list is empty', () => {
    expect(lint(SOURCE, { presets: [] })).toEqual([]);
  });

  it('runs no rules when no preset and no rules are given (no implicit base)', () => {
    expect(lint(SOURCE, {})).toEqual([]);
  });
});

/*
 * A null severity is how a config sets options without choosing a severity.
 * Restating one would silently pin it: the entry would keep saying "warning"
 * long after the preset or the rule's default moved on.
 */
describe('inherited severity', () => {
  const LONG = 'SET vVeryLongVariableName=1;\n';

  it('applies the options while leaving the severity to the rule default', () => {
    const [diagnostic] = lint(LONG, { rules: { 'max-line-length': [null, { max: 20 }] } });

    expect(diagnostic).toMatchObject({ ruleId: 'max-line-length', severity: maxLineLength.defaultSeverity });
  });

  it('takes the severity from the preset rather than the entry', () => {
    const withPreset = lint(LONG, {
      presets: 'recommended',
      rules: { 'max-line-length': [null, { max: 20 }] },
    });

    expect(withPreset.find((d) => d.ruleId === 'max-line-length')?.severity).toBe(maxLineLength.defaultSeverity);
  });

  it('still honours an explicit severity beside the options', () => {
    const [diagnostic] = lint(LONG, { rules: { 'max-line-length': ['error', { max: 20 }] } });

    expect(diagnostic.severity).toBe('error');
  });

  it('runs the rule at its default severity for a lone null tuple', () => {
    expect(lint(LONG, { rules: { 'max-line-length': [null] } })).toEqual([]);
  });
});
