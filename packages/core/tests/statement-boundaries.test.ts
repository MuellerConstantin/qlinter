import { describe, expect, it } from 'vitest';
import { tokenMatcher } from 'chevrotain';
import {
  blockCloseToken,
  blockOpenToken,
  clauseStarterToken,
  keywordToken,
  lexer,
  sourceClauseToken,
  statementTerminatorToken,
} from '../src/lexer.js';
import { previousLineClosesStatement, splitStatements } from '../src/rules/utils/statements.js';
import { groupByLine } from '../src/rules/utils/lines.js';

function tokenize(source: string) {
  return lexer.tokenize(source).tokens;
}

/*
 * Which words open, close, or terminate a statement is lexical vocabulary and
 * lives in the lexer as token categories. These tests pin the categories down
 * and the statement segmentation that reads them, so a rule never has to keep
 * its own copy of the answer.
 */
describe('statement boundaries', () => {
  describe('lexer categories', () => {
    it.each([
      ['End', blockCloseToken],
      ['EndIf', blockCloseToken],
      ['EndSub', blockCloseToken],
      ['EndSwitch', blockCloseToken],
      ['Next', blockCloseToken],
      ['Loop', blockCloseToken],
    ])('%s closes a block', (image, category) => {
      const [token] = tokenize(image);

      expect(tokenMatcher(token, category)).toBe(true);
      expect(tokenMatcher(token, statementTerminatorToken)).toBe(true);
      expect(tokenMatcher(token, keywordToken)).toBe(true);
    });

    it.each(['Sub', 'If', 'For', 'Do', 'Switch'])('%s opens a block', (image) => {
      const [token] = tokenize(image);

      expect(tokenMatcher(token, blockOpenToken)).toBe(true);
      expect(tokenMatcher(token, keywordToken)).toBe(true);
    });

    it('keeps If a function when it is called as one', () => {
      const [token] = tokenize('If(1, 2, 3)');

      expect(token.tokenType.name).toBe('BuiltinFunction');
      expect(tokenMatcher(token, blockOpenToken)).toBe(false);
    });

    it('does not let End swallow the EndIf that starts with it', () => {
      const [token] = tokenize('EndIf');

      expect(token.tokenType.name).toBe('EndIf');
      expect(token.image).toBe('EndIf');
    });

    it('does not let Else swallow ElseIf', () => {
      const [token] = tokenize('ElseIf x Then');

      expect(token.image).toBe('ElseIf');
    });

    /*
     * `Then` is absent from the Engine BNF dump behind KEYWORDS — the dump folds
     * it into the If production instead of listing it as a terminal — so it is
     * listed there explicitly. It is a keyword like any other, casing included.
     */
    it('treats Then as a keyword that terminates its header', () => {
      const token = tokenize('If x Then')[2];

      expect(token.image).toBe('Then');
      expect(tokenMatcher(token, statementTerminatorToken)).toBe(true);
      expect(tokenMatcher(token, keywordToken)).toBe(true);
    });

    it.each([
      'From',
      'From_Field',
      'Resident',
      'Inline',
      'AutoGenerate',
      'Extension',
      'Where',
      'While',
      'Group',
      'Order',
    ])('%s starts a LOAD clause', (image) => {
      const [token] = tokenize(image);

      expect(tokenMatcher(token, clauseStarterToken)).toBe(true);
      expect(tokenMatcher(token, keywordToken)).toBe(true);
    });

    it.each(['From', 'From_Field', 'Resident', 'Inline', 'AutoGenerate', 'Extension'])(
      '%s names where a LOAD gets its rows',
      (image) => {
        const [token] = tokenize(image);

        expect(tokenMatcher(token, sourceClauseToken)).toBe(true);
        expect(tokenMatcher(token, clauseStarterToken)).toBe(true);
      },
    );

    it.each(['Where', 'While', 'Group', 'Order'])('%s narrows a LOAD and names no source', (image) => {
      const [token] = tokenize(image);

      expect(tokenMatcher(token, sourceClauseToken)).toBe(false);
      expect(tokenMatcher(token, clauseStarterToken)).toBe(true);
    });

    it('does not let From swallow the From_Field that starts with it', () => {
      const [token] = tokenize('From_Field');

      expect(token.image).toBe('From_Field');
    });

    it.each(['Distinct', 'NoConcatenate', 'Concatenate', 'Mapping', 'Buffer', 'First'])(
      '%s modifies the LOAD and starts no clause',
      (image) => {
        const [token] = tokenize(image);

        expect(tokenMatcher(token, clauseStarterToken)).toBe(false);
      },
    );
  });

  describe('splitStatements', () => {
    /*
     * Regression: a `;` closing a Trace statement lexes as TraceEnd, which
     * carries Semicolon only as a category. While the split used an identity
     * check it missed that terminator and merged the Trace with the statement
     * after it.
     */
    it('splits at a semicolon that closes a Trace statement', () => {
      const stmts = splitStatements(tokenize('Trace loading;\nLet x = 1;\n'));

      expect(stmts).toHaveLength(2);
      expect(stmts[0].map((t) => t.image).join(' ')).toContain('Trace');
      expect(stmts[1].map((t) => t.image).join(' ')).toContain('Let');
    });

    it('splits ordinary statements at their semicolons', () => {
      expect(splitStatements(tokenize('Let a = 1;\nLet b = 2;\n'))).toHaveLength(2);
    });

    it('keeps a parenthesised semicolon from splitting a statement', () => {
      expect(splitStatements(tokenize("Load Replace(x, ';', '') AS Y Resident S;\n"))).toHaveLength(1);
    });
  });

  describe('previousLineClosesStatement', () => {
    const closes = (source: string) => {
      const lines = groupByLine(tokenize(source));

      return previousLineClosesStatement(lines[0].tokens);
    };

    it.each([
      ['Let x = 1;', 'a semicolon'],
      ['MyTable:', 'a table label colon'],
      ['If x > 1 Then', 'a Then'],
      ['Do', 'a dangling Do'],
      ['Else', 'an Else'],
      ['End If', 'a block close'],
      ['Sub greet', 'a single-line Sub header'],
      ['Case 1', 'a Case header'],
    ])('%s closes its statement (%s)', (source) => {
      expect(closes(source)).toBe(true);
    });

    it.each([
      ['Load', 'a bare Load'],
      ['    A,', 'a field line'],
      ['Resident Src', 'a clause line'],
    ])('%s does not close its statement (%s)', (source) => {
      expect(closes(source)).toBe(false);
    });
  });
});
