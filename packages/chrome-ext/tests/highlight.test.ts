import { describe, expect, it } from 'vitest';
import CodeMirror from 'codemirror';
import { lint, type Diagnostic, type LintConfig } from '@qlinter/core';
import { applyFix, applyIgnore, type ScriptDoc } from '../src/util/highlight.js';

const config: LintConfig = { rules: { 'semicolon-space': 'warning' } };

function lintedDoc(source: string): { doc: ScriptDoc; diagnostic: Diagnostic } {
  const [diagnostic] = lint(source, config);

  return { doc: new CodeMirror.Doc(source) as unknown as ScriptDoc, diagnostic };
}

describe('tooltip actions', () => {
  describe('Quick Fix', () => {
    it('applies the fix to the text it was linted from', () => {
      const source = 'Let x = 1 ;\n';
      const { doc, diagnostic } = lintedDoc(source);

      expect(applyFix(doc, source, diagnostic.fix!)).toBe(true);
      expect(doc.getValue()).toBe('Let x = 1;\n');
    });

    /*
     * Linting is debounced, so the editor can be ahead of the diagnostics it
     * shows. Offsets from the old text would cut into the new one.
     */
    it('does nothing once the text has changed since the lint', () => {
      const source = 'Let x = 1 ;\n';
      const { doc, diagnostic } = lintedDoc(source);

      doc.replaceRange('Let vYear = 2026;\n', { line: 0, ch: 0 });

      expect(applyFix(doc, source, diagnostic.fix!)).toBe(false);
      expect(doc.getValue()).toBe('Let vYear = 2026;\nLet x = 1 ;\n');
    });

    it('does nothing for a second fix from the same lint once the first has applied', () => {
      const source = 'Let x = 1 ;\nLet y = 2 ;\n';
      const [first, second] = lint(source, config);
      const doc = new CodeMirror.Doc(source) as unknown as ScriptDoc;

      expect(applyFix(doc, source, first.fix!)).toBe(true);
      expect(applyFix(doc, source, second.fix!)).toBe(false);
      expect(doc.getValue()).toBe('Let x = 1;\nLet y = 2 ;\n');
    });
  });

  describe('Ignore', () => {
    it('adds a directive above the line it was linted from', () => {
      const source = 'Let x = 1 ;\n';
      const { doc, diagnostic } = lintedDoc(source);

      expect(applyIgnore(doc, source, diagnostic)).toBe(true);
      expect(doc.getValue()).toBe('// qlinter-disable-next-line semicolon-space\nLet x = 1 ;\n');
    });

    it('extends a directive naming other rules', () => {
      const source = '// qlinter-disable-next-line word-spacing\nLet x = 1 ;\n';
      const { doc, diagnostic } = lintedDoc(source);

      expect(applyIgnore(doc, source, diagnostic)).toBe(true);
      expect(doc.getValue()).toBe('// qlinter-disable-next-line word-spacing, semicolon-space\nLet x = 1 ;\n');
    });

    it('does nothing once the text has changed since the lint', () => {
      const source = 'Let x = 1 ;\n';
      const { doc, diagnostic } = lintedDoc(source);

      doc.replaceRange('Let vYear = 2026;\n', { line: 0, ch: 0 });

      expect(applyIgnore(doc, source, diagnostic)).toBe(false);
      expect(doc.getValue()).toBe('Let vYear = 2026;\nLet x = 1 ;\n');
    });
  });
});
