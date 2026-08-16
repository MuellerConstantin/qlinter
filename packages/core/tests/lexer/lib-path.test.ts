import { describe, expect, it } from 'vitest';
import { format } from '../../src/index.js';
import { recommended } from '../../src/rules/index.js';
import { COMMENT_GROUP, keywordToken, lexer, libPathToken } from '../../src/lexer.js';

/*
 * An unbracketed `lib://` path used to shatter into the LIB keyword plus a
 * `//` line comment, which swallowed the rest of the path. These tests pin it
 * as one token and guard the two rules that did the damage.
 */
describe('lib:// path tokenization', () => {
  it.each([
    'lib://DataFiles/abc.qvs',
    'lib://DataFiles\\abc.txt',
    'LIB://DataFiles/abc.qvd',
    'lib://DataFiles/sub.dir/abc-1.qvd',
  ])('tokenizes %s as a single LibPath token', (source) => {
    const { tokens, errors } = lexer.tokenize(source);

    expect(errors).toEqual([]);
    expect(tokens).toHaveLength(1);
    expect(tokens[0].tokenType).toBe(libPathToken);
    expect(tokens[0].image).toBe(source);
  });

  it('does not produce a comment for the // in the scheme', () => {
    const { groups } = lexer.tokenize('Load * From lib://DataFiles/abc.qvd (qvd);');

    expect(groups[COMMENT_GROUP] ?? []).toEqual([]);
  });

  it('does not produce a LIB keyword token for the scheme', () => {
    const { tokens } = lexer.tokenize('Load * From lib://DataFiles/abc.qvd (qvd);');

    expect(tokens.filter((t) => t.tokenType === keywordToken).map((t) => t.image)).not.toContain('lib');
  });

  it('still recognises Lib as a keyword in a Lib Connect To statement', () => {
    const { tokens } = lexer.tokenize('Lib Connect To [DataFiles];');

    expect(tokens.some((t) => t.tokenType === keywordToken && t.image === 'Lib')).toBe(true);
  });

  it('stops at the statement terminator', () => {
    const { tokens } = lexer.tokenize('lib://DataFiles/abc.qvs;');

    expect(tokens.map((t) => t.tokenType.name)).toEqual(['LibPath', 'Semicolon']);
  });

  it('leaves a real line comment mentioning a lib path as a comment', () => {
    const { tokens, groups } = lexer.tokenize('// see lib://DataFiles/abc.qvs\n');

    expect(tokens).toEqual([]);
    expect(groups[COMMENT_GROUP]).toHaveLength(1);
  });
});

describe('formatting an unbracketed lib:// path', () => {
  it('leaves the path untouched', () => {
    const source = 'Load *\nFrom lib://DataFiles/abc.qvd (qvd);\n';

    const result = format(source, recommended);

    expect(result.output).toBe(source);
    expect(result.fixed).toBe(0);
  });
});
