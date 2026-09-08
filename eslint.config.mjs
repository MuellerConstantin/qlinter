// @ts-check

import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import tseslint from 'typescript-eslint';

/*
 * A rule reads the script through the structure the engine hands it — tokens,
 * comments, whitespace runs, line spans — and not through the raw text. Reading
 * the text means deciding a second time what the lexer already decided, and the
 * two answers drift: that is how rules came to delete comments they never knew
 * were there.
 *
 * Slicing `source` to carry bytes through a fix unchanged stays legitimate, and
 * so does the odd construct the lexer cannot model. Both are exceptions, and an
 * exception is made where it applies, with an eslint-disable comment naming the
 * reason — not here.
 *
 * The property check names no object, so it catches a context parameter whatever
 * it is called — at the price of firing on any other `.source` a rule reads, a
 * regular expression's own pattern among them. That trade is deliberate: a false
 * alarm costs a line somebody reads, a gap costs nothing until it matters.
 *
 * It is a tripwire, not a proof. Passed on under another name — `f(text)` — the
 * text walks past it, which is why the access itself is what gets watched.
 */
const NO_RAW_SOURCE_RESTRICTION = [
  {
    selector: "ObjectPattern > Property[key.name='source']",
    message:
      'A rule reads the script through the context (tokens, comments, whitespaces, lines), not as raw text. Slicing `source` to carry bytes into a fix is the exception — disable this rule on the line and say why.',
  },
  {
    selector: "MemberExpression[property.name='source']",
    message:
      'A rule reads the script through the context (tokens, comments, whitespaces, lines), not as raw text. Slicing `source` to carry bytes into a fix is the exception — disable this rule on the line and say why.',
  },
];

const SYNTAX_RESTRICTIONS = [...NO_RAW_SOURCE_RESTRICTION];

export default defineConfig(
  globalIgnores(['**/dist/**', '**/node_modules/**', 'tests/assets/**']),
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
  },
  {
    // Build scripts run in Node, outside any package's TypeScript setup.
    files: ['**/scripts/**/*.mjs'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly' },
    },
  },
  {
    files: ['packages/core/src/rules/**/*.ts'],
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: { 'no-restricted-syntax': ['error', ...SYNTAX_RESTRICTIONS] },
  },
  prettier,
);
