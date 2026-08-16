import { describe, expect, it } from 'vitest';
import { format } from '../../src/index.js';
import { recommended } from '../../src/rules/index.js';
import { includeExpansionToken, lexer } from '../../src/lexer.js';

/*
 * `$(Include=…)` / `$(Must_Include=…)` is a fixed dollar expansion form: Qlik
 * rejects a space around the `=`, so the formatter must not treat that `=` as
 * a binary operator. These tests pin the atomic tokenization and the
 * end-to-end guarantee that formatting leaves the construct byte-identical.
 */
describe('include expansion tokenization', () => {
  it.each([
    '$(Include=abc.txt)',
    '$(Must_Include=abc.txt)',
    '$(Must_Include=lib://DataFiles/abc.qvs)',
    '$(Must_Include=[lib://DataFiles/abc.qvs])',
    '$(must_include=lib://DataFiles\\abc.txt)',
    '$(MUST_INCLUDE=abc.txt)',
  ])('tokenizes %s as a single opaque token', (source) => {
    const { tokens, errors } = lexer.tokenize(source);

    expect(errors).toEqual([]);
    expect(tokens).toHaveLength(1);
    expect(tokens[0].tokenType).toBe(includeExpansionToken);
    expect(tokens[0].image).toBe(source);
  });

  it('emits no Equals token inside the expansion', () => {
    const { tokens } = lexer.tokenize('$(Must_Include=[lib://DataFiles/abc.qvs]);');

    expect(tokens.map((t) => t.tokenType.name)).toEqual(['IncludeExpansion', 'Semicolon']);
  });

  it('keeps the already-broken spaced form in one token so it is not mangled further', () => {
    const { tokens } = lexer.tokenize('$(Must_Include = [lib://DataFiles/abc.qvs])');

    expect(tokens).toHaveLength(1);
    expect(tokens[0].tokenType).toBe(includeExpansionToken);
  });

  it('leaves an ordinary $(=…) evaluation expansion alone', () => {
    const { tokens } = lexer.tokenize('$(=Max(Year))');

    expect(tokens.some((t) => t.tokenType === includeExpansionToken)).toBe(false);
  });
});

describe('formatting an include expansion', () => {
  it.each([
    '$(Must_Include=[lib://DataFiles/abc.qvs]);\n',
    '$(Must_Include=lib://DataFiles/abc.qvs);\n',
    '$(Include=abc.txt);\n',
  ])('leaves %j untouched', (source) => {
    const result = format(source, recommended);

    expect(result.output).toBe(source);
    expect(result.fixed).toBe(0);
  });
});
