import { validateConfig, type LintConfig } from '@qlinter/core';
import { describe, expect, it } from 'vitest';
import { optionsFor, severityFor, withOption, withPresets, withSeverity } from '../src/options/state.js';

/** Everything the controls produce has to survive the validator that guards storage. */
function valid(config: LintConfig): LintConfig {
  return validateConfig(config);
}

describe('severityFor', () => {
  it('reports an absent rule as default', () => {
    expect(severityFor({}, 'block-indent')).toBe('default');
  });

  it('reads a bare severity string', () => {
    expect(severityFor({ rules: { 'block-indent': 'error' } }, 'block-indent')).toBe('error');
  });

  it('reads the severity out of a tuple', () => {
    expect(severityFor({ rules: { 'block-indent': ['off', { size: 2 }] } }, 'block-indent')).toBe('off');
  });

  it('reports a null severity as default, since none was chosen', () => {
    expect(severityFor({ rules: { 'block-indent': [null, { size: 2 }] } }, 'block-indent')).toBe('default');
  });
});

describe('optionsFor', () => {
  it('returns an empty object when the entry carries none', () => {
    expect(optionsFor({ rules: { 'block-indent': 'error' } }, 'block-indent')).toEqual({});
  });

  it('returns the options of a tuple entry', () => {
    expect(optionsFor({ rules: { 'block-indent': [null, { size: 2 }] } }, 'block-indent')).toEqual({ size: 2 });
  });
});

describe('withSeverity', () => {
  it('writes a bare string when the rule has no options', () => {
    expect(withSeverity({}, 'block-indent', 'error')).toEqual({ rules: { 'block-indent': 'error' } });
  });

  it('drops the entry entirely when set back to default', () => {
    expect(withSeverity({ rules: { 'block-indent': 'error' } }, 'block-indent', 'default')).toEqual({});
  });

  it('keeps the options and nulls the severity when set back to default', () => {
    const before: LintConfig = { rules: { 'block-indent': ['error', { size: 2 }] } };

    expect(withSeverity(before, 'block-indent', 'default')).toEqual({
      rules: { 'block-indent': [null, { size: 2 }] },
    });
  });

  it('keeps the options when a severity is chosen', () => {
    const before: LintConfig = { rules: { 'block-indent': [null, { size: 2 }] } };

    expect(withSeverity(before, 'block-indent', 'warning')).toEqual({
      rules: { 'block-indent': ['warning', { size: 2 }] },
    });
  });

  it('leaves other rules untouched', () => {
    const before: LintConfig = { rules: { 'eol-last': 'off' } };

    expect(withSeverity(before, 'block-indent', 'error').rules?.['eol-last']).toBe('off');
  });
});

describe('withOption', () => {
  it('sets an option without choosing a severity', () => {
    expect(withOption({}, 'block-indent', 'size', 2)).toEqual({ rules: { 'block-indent': [null, { size: 2 }] } });
  });

  it('preserves an explicitly chosen severity', () => {
    const before: LintConfig = { rules: { 'block-indent': 'error' } };

    expect(withOption(before, 'block-indent', 'size', 2)).toEqual({
      rules: { 'block-indent': ['error', { size: 2 }] },
    });
  });

  it('adds a second option beside the first', () => {
    const once = withOption({}, 'block-indent', 'size', 2);

    expect(withOption(once, 'block-indent', 'style', 'tab')).toEqual({
      rules: { 'block-indent': [null, { size: 2, style: 'tab' }] },
    });
  });

  it('clearing the last option collapses the entry back to nothing', () => {
    const once = withOption({}, 'block-indent', 'size', 2);

    expect(withOption(once, 'block-indent', 'size', undefined)).toEqual({});
  });

  it('clearing the last option keeps a chosen severity as a bare string', () => {
    const before: LintConfig = { rules: { 'block-indent': ['error', { size: 2 }] } };

    expect(withOption(before, 'block-indent', 'size', undefined)).toEqual({ rules: { 'block-indent': 'error' } });
  });

  it('leaves presets alone', () => {
    const before: LintConfig = { presets: 'recommended' };

    expect(withOption(before, 'block-indent', 'size', 2).presets).toBe('recommended');
  });
});

describe('what the controls produce is accepted by validateConfig', () => {
  it('accepts an options-only entry', () => {
    expect(() => valid(withOption({ presets: 'recommended' }, 'block-indent', 'size', 2))).not.toThrow();
  });

  it('accepts an enum option', () => {
    expect(() => valid(withOption({}, 'variable-case', 'style', 'upperSnake'))).not.toThrow();
  });

  it('accepts severity and options together', () => {
    const withOpts = withOption({}, 'max-line-length', 'max', 100);

    expect(() => valid(withSeverity(withOpts, 'max-line-length', 'error'))).not.toThrow();
  });

  /*
   * The controls constrain the input but cannot guarantee it: a number field
   * accepts a typed value past its max. The rejection has to come from the
   * validator, which is what the options page reports back to the user.
   */
  it('rejects a number outside the schema range', () => {
    expect(() => valid(withOption({}, 'block-indent', 'size', 99))).toThrow(/must be at most 8/);
  });

  it('rejects an enum value the schema does not list', () => {
    expect(() => valid(withOption({}, 'variable-case', 'style', 'kebab'))).toThrow(/Expected one of/);
  });
});

describe('withPresets', () => {
  it('stores a single preset as a string', () => {
    expect(withPresets({}, ['recommended'])).toEqual({ presets: 'recommended' });
  });

  it('drops the key when the list is emptied', () => {
    expect(withPresets({ presets: 'recommended' }, [])).toEqual({});
  });
});
