import { tokenMatcher } from 'chevrotain';
import { describe, expect, it } from 'vitest';
import { lintRule } from '../support.js';
import { keywordToken, lexer, traceEndToken, traceKeywordToken, traceMessageToken } from '../../src/lexer.js';
import { builtinKeywordCase, variableCase } from '../../src/rules/index.js';

describe('trace_body lexer mode', () => {
  it('swallows the trace body as a single TraceMessage token', () => {
    const { tokens, errors } = lexer.tokenize('Trace Load Where Resident is free text;');

    expect(errors).toEqual([]);
    expect(tokens.map((t) => t.tokenType.name)).toEqual(['TraceKeyword', 'TraceMessage', 'TraceEnd']);
    expect(tokens[1].image).toBe(' Load Where Resident is free text');
  });

  it('does not emit Keyword tokens for words inside a trace message', () => {
    const { tokens } = lexer.tokenize('Trace Load Where x;');

    const keywordHits = tokens.filter((t) => tokenMatcher(t, keywordToken));
    expect(keywordHits).toEqual([]);
  });

  it('returns to the default mode after the terminating semicolon', () => {
    const { tokens } = lexer.tokenize('Trace hello;\nLoad * Resident [t];');

    const names = tokens.map((t) => t.tokenType.name);
    expect(names).toContain('TraceKeyword');
    expect(names).toContain('TraceMessage');
    expect(names).toContain('TraceEnd');
    // Real Load/Resident in the following statement still tokenize as keywords.
    expect(tokens.some((t) => tokenMatcher(t, keywordToken) && t.image === 'Load')).toBe(true);
    expect(tokens.some((t) => tokenMatcher(t, keywordToken) && t.image === 'Resident')).toBe(true);
  });

  it('handles a multiline trace body', () => {
    const { tokens, errors } = lexer.tokenize('Trace first line\n  second line\n  third Load Where;\nLoad * From [t];');

    expect(errors).toEqual([]);
    const traceMessage = tokens.find((t) => t.tokenType === traceMessageToken);
    expect(traceMessage?.image).toContain('first line');
    expect(traceMessage?.image).toContain('second line');
    expect(traceMessage?.image).toContain('third Load Where');
    // After the ;, the real Load keyword is back.
    expect(tokens.filter((t) => tokenMatcher(t, keywordToken)).map((t) => t.image)).toContain('Load');
  });

  it('still recognises the leading Trace as a keyword token', () => {
    const { tokens } = lexer.tokenize('Trace foo;');

    expect(tokens[0].tokenType).toBe(traceKeywordToken);
    expect(tokens[2].tokenType).toBe(traceEndToken);
  });
});

describe('rules + trace_body interaction', () => {
  it('builtin-keyword-case does not flag keywords appearing inside a trace message', () => {
    const source = 'Trace LOAD WHERE this is FREE text;\nLoad * Resident [t];';
    const diagnostics = lintRule(source, builtinKeywordCase);

    // The only finding (if any) must be on line 2, never inside the trace body.
    expect(diagnostics.every((d) => d.range.start.line === 2)).toBe(true);
  });

  it('builtin-keyword-case still flags the trace keyword itself', () => {
    const diagnostics = lintRule('TRACE hello world;', builtinKeywordCase);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain("'TRACE'");
    expect(diagnostics[0].message).toContain("'Trace'");
  });

  it('variable-case does not pick up "Set" or "Let" appearing as words in a trace body', () => {
    const source = 'Trace Set foo Let bar;';
    const diagnostics = lintRule(source, variableCase);

    expect(diagnostics).toEqual([]);
  });
});
