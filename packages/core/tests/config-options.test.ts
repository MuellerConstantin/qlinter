import { describe, expect, it } from 'vitest';
import { validateConfig } from '../src/config/index.js';

describe('validateConfig — rule options', () => {
  it('accepts an enum option at a declared value', () => {
    expect(validateConfig({ rules: { 'variable-case': ['warning', { style: 'upperSnake' }] } })).toEqual({
      rules: { 'variable-case': ['warning', { style: 'upperSnake' }] },
    });
  });

  it('accepts a number option inside its bounds', () => {
    expect(validateConfig({ rules: { 'block-indent': ['warning', { size: 2, style: 'tab' }] } })).toEqual({
      rules: { 'block-indent': ['warning', { size: 2, style: 'tab' }] },
    });
  });

  it('accepts an entry with no options at all', () => {
    expect(validateConfig({ rules: { 'max-line-length': ['warning'] } })).toEqual({
      rules: { 'max-line-length': ['warning'] },
    });
  });

  it('accepts an empty options object, which asks for nothing', () => {
    expect(validateConfig({ rules: { 'trailing-whitespace': ['warning', {}] } })).toEqual({
      rules: { 'trailing-whitespace': ['warning', {}] },
    });
  });

  it('accepts null in place of the severity, to set options without pinning one', () => {
    expect(validateConfig({ rules: { 'block-indent': [null, { size: 2 }] } })).toEqual({
      rules: { 'block-indent': [null, { size: 2 }] },
    });
  });

  it('accepts a lone null tuple', () => {
    expect(validateConfig({ rules: { 'block-indent': [null] } })).toEqual({ rules: { 'block-indent': [null] } });
  });

  it('still rejects a bare null entry, which names no rule state at all', () => {
    expect(() => validateConfig({ rules: { 'block-indent': null } })).toThrow(/must be a severity string or an array/);
  });

  it('mentions null among the accepted tuple severities', () => {
    expect(() => validateConfig({ rules: { 'block-indent': ['fatal', { size: 2 }] } })).toThrow(
      /Expected one of: error, warning, info, off, or null to keep the current severity/,
    );
  });

  it('throws on an unknown option key rather than silently ignoring it', () => {
    expect(() => validateConfig({ rules: { 'max-line-length': ['warning', { maxLength: 80 }] } })).toThrow(
      /unknown option "maxLength". Known options: max/,
    );
  });

  it('names the rule as optionless when it declares no schema', () => {
    expect(() => validateConfig({ rules: { 'trailing-whitespace': ['warning', { max: 1 }] } })).toThrow(
      /takes no options, but "max" was given/,
    );
  });

  it('throws on an enum value outside the declared set', () => {
    expect(() => validateConfig({ rules: { 'variable-case': ['warning', { style: 'kebab' }] } })).toThrow(
      /invalid value "kebab". Expected one of: camel, pascal, snake, upperSnake/,
    );
  });

  it('throws when a number option is given as a string', () => {
    expect(() => validateConfig({ rules: { 'max-line-length': ['warning', { max: '120' }] } })).toThrow(
      /must be an integer, got "120"/,
    );
  });

  it('throws when a number option is fractional', () => {
    expect(() => validateConfig({ rules: { 'block-indent': ['warning', { size: 2.5 }] } })).toThrow(
      /must be an integer, got 2\.5/,
    );
  });

  it('throws when a number option is below its minimum', () => {
    expect(() => validateConfig({ rules: { 'block-indent': ['warning', { size: 0 }] } })).toThrow(
      /must be at least 1, got 0/,
    );
  });

  it('throws when a number option is above its maximum', () => {
    expect(() => validateConfig({ rules: { 'max-line-length': ['warning', { max: 5000 }] } })).toThrow(
      /must be at most 1000, got 5000/,
    );
  });

  it('throws when the options slot is not an object', () => {
    expect(() => validateConfig({ rules: { 'max-line-length': ['warning', 120] } })).toThrow(
      /Options for rule "max-line-length" must be an object/,
    );
  });

  it('throws when the options slot is null', () => {
    expect(() => validateConfig({ rules: { 'max-line-length': ['warning', null] } })).toThrow(
      /Options for rule "max-line-length" must be an object/,
    );
  });

  it('embeds the source label in option error messages', () => {
    expect(() => validateConfig({ rules: { 'block-indent': ['warning', { size: 99 }] } }, 'qlinter.json')).toThrow(
      /Option "size" of rule "block-indent" in qlinter\.json must be at most 8/,
    );
  });
});
