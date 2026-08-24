import { describe, expect, it } from 'vitest';
import { validateConfig } from '../src/config/index.js';

describe('validateConfig', () => {
  it('returns empty config when "rules" is missing', () => {
    expect(validateConfig({})).toEqual({});
  });

  it('parses a severity-only rule entry', () => {
    expect(validateConfig({ rules: { 'trailing-whitespace': 'off' } })).toEqual({
      rules: { 'trailing-whitespace': 'off' },
    });
  });

  it('parses a [severity, options] rule entry', () => {
    expect(validateConfig({ rules: { 'max-line-length': ['warning', { max: 120 }] } })).toEqual({
      rules: { 'max-line-length': ['warning', { max: 120 }] },
    });
  });

  it('throws when the top level is not an object', () => {
    expect(() => validateConfig([])).toThrow(/must be a JSON object/);
  });

  it('throws when "rules" is not an object', () => {
    expect(() => validateConfig({ rules: [] })).toThrow(/"rules".*must be an object/);
  });

  it('throws on unknown top-level keys instead of silently dropping them', () => {
    expect(() => validateConfig({ 'trailing-whitespace': 'off' })).toThrow(
      /unknown key "trailing-whitespace".*Only "presets" and "rules" are supported/,
    );
  });

  it('accepts a single preset name', () => {
    expect(validateConfig({ presets: 'recommended' })).toEqual({ presets: 'recommended' });
  });

  it('accepts an array of preset names', () => {
    expect(validateConfig({ presets: ['recommended'] })).toEqual({ presets: ['recommended'] });
  });

  it('accepts an empty preset list (explicit opt-out of every base)', () => {
    expect(validateConfig({ presets: [], rules: { 'trailing-whitespace': 'off' } })).toEqual({
      presets: [],
      rules: { 'trailing-whitespace': 'off' },
    });
  });

  it('throws on an unknown preset name', () => {
    expect(() => validateConfig({ presets: 'strict' })).toThrow(/unknown preset "strict"/);
  });

  it('throws when a preset entry is not a string', () => {
    expect(() => validateConfig({ presets: [42] })).toThrow(/"presets".*must be a preset name or an array/);
  });

  it('throws on an unknown rule id', () => {
    expect(() => validateConfig({ rules: { 'not-a-rule': 'off' } })).toThrow(/unknown rule "not-a-rule"/);
  });

  it('throws on an unknown severity string', () => {
    expect(() => validateConfig({ rules: { 'trailing-whitespace': 'fatal' } })).toThrow(/invalid severity "fatal"/);
  });

  it('throws when a rule entry has the wrong shape', () => {
    expect(() => validateConfig({ rules: { 'trailing-whitespace': 42 } })).toThrow(
      /must be a severity string or an array/,
    );
  });

  it('throws when a [severity, options] array has too many elements', () => {
    expect(() => validateConfig({ rules: { 'trailing-whitespace': ['warning', {}, 'extra'] } })).toThrow(
      /\[severity\] or \[severity, options\]/,
    );
  });

  it('embeds the source label in error messages when provided', () => {
    expect(() => validateConfig([], 'qlinter.json')).toThrow(/Config in qlinter\.json must be a JSON object/);
  });

  it('omits the "in <label>" fragment when no source label is provided', () => {
    expect(() => validateConfig([])).toThrow(/^Config must be a JSON object\.$/);
  });
});
