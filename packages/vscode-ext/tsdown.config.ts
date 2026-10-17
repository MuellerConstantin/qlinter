import { defineConfig } from 'tsdown';
import { allRules, presetNames } from '@qlinter/core';
import { ruleDocsUrl } from './src/docs.ts';
import { configSchema } from './src/schema.ts';

/*
 * The VS Code extension host loads the entry point via CommonJS `require` and
 * provides the `vscode` module at runtime, so it must stay external — bundling
 * it would ship a second, non-functional copy of the API surface.
 *
 * The `qlinter.json` schema is emitted next to the bundle from the same Core
 * build, so a rule added to Core reaches the editor's completions on the next
 * build without anything checked in to go stale.
 */
export default defineConfig({
  entry: ['src/extension.ts'],
  format: ['cjs'],
  platform: 'node',
  deps: { alwaysBundle: ['@qlinter/core'], neverBundle: ['vscode'] },
  outExtensions: () => ({ js: '.js' }),
  dts: false,
  clean: true,
  plugins: [
    {
      name: 'qlinter-config-schema',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'qlinter.schema.json',
          source: `${JSON.stringify(configSchema(allRules, presetNames, ruleDocsUrl), null, 2)}\n`,
        });
      },
    },
  ],
});
