import { describe, expect, it } from 'vitest';
import { commentIndent } from '../../src/rules/index.js';
import { lintFixture } from './helpers.js';
import { formatRule, lintRule } from '../support.js';

describe('comment-indent', () => {
  it('flags violations in the violation fixture', () => {
    const diagnostics = lintFixture('violation', commentIndent);

    expect(diagnostics[0]).toMatchObject({ ruleId: 'comment-indent', severity: 'warning' });
    expect(diagnostics.map((diagnostic) => diagnostic.range.start.line)).toEqual([3, 6, 14]);
  });

  it('does not flag the clean fixture', () => {
    expect(lintFixture('clean', commentIndent)).toEqual([]);
  });

  describe('autofix', () => {
    it('indents a comment like the line of code below it', () => {
      expect(formatRule('If x Then\n            // note\n    Let a = 1;\nEndIf\n', commentIndent).output).toBe(
        'If x Then\n    // note\n    Let a = 1;\nEndIf\n',
      );
    });

    it('moves a block comment by its first line', () => {
      expect(formatRule('/* a\n * b */\n    Let a = 1;\n', commentIndent).output).toBe(
        '    /* a\n * b */\n    Let a = 1;\n',
      );
    });

    it('takes the indent from the next line of code across blank lines and further comments', () => {
      expect(formatRule('  // one\n\n// two\n    Let a = 1;\n', commentIndent).output).toBe(
        '    // one\n\n    // two\n    Let a = 1;\n',
      );
    });

    it('indents a comment below the last code like the line of code above it', () => {
      expect(formatRule('    End Sub\n/* end */\n\n            // the end\n', commentIndent).output).toBe(
        '    End Sub\n    /* end */\n\n    // the end\n',
      );
    });

    it('copies the indent as written, tabs included', () => {
      expect(formatRule('// note\n\tLet a = 1;\n', commentIndent).output).toBe('\t// note\n\tLet a = 1;\n');
    });
  });

  describe('above the line that ends a body', () => {
    it('accepts the level of the body', () => {
      expect(lintRule('If x Then\n    Let a = 1;\n    // note\nEndIf\n', commentIndent)).toEqual([]);
    });

    it('accepts the level of the closing line', () => {
      expect(lintRule('If x Then\n    Let a = 1;\n// note\nEndIf\n', commentIndent)).toEqual([]);
    });

    it('flags any other level', () => {
      expect(lintRule('If x Then\n    Let a = 1;\n  // note\nEndIf\n', commentIndent)).toHaveLength(1);
    });
  });

  describe('left alone', () => {
    it('a comment sharing its line with code', () => {
      expect(lintRule('    Let a = 1; // note\nLet b = 2;\n', commentIndent)).toEqual([]);
    });

    it('a file holding no code at all', () => {
      expect(lintRule('    // nothing but a remark\n', commentIndent)).toEqual([]);
    });

    it('a section marker, whose column is part of it', () => {
      expect(lintRule('  ///$tab Main\nLet a = 1;\n', commentIndent)).toEqual([]);
    });
  });
});
