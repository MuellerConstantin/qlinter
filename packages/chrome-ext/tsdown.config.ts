import { defineConfig } from 'tsdown';

/*
 * Keyed by output name so an entry can live in a folder without changing the
 * emitted filename — options.html loads `options.js`, whatever its source path.
 */
const ENTRIES: Record<string, string> = {
  background: 'src/background.ts',
  content: 'src/content.ts',
  popup: 'src/popup.ts',
  options: 'src/options/index.ts',
  main: 'src/main.ts',
};

/*
 * MV3 service workers forbid runtime import(); content scripts (including
 * world: 'MAIN' ones) are loaded as classic scripts by chrome.scripting and
 * also choke on import statements. `codeSplitting: false` only suppresses
 * dynamic splitting, not the shared-chunk extraction rolldown performs across
 * entries — so once two entries depend on @qlinter/core, the build emits a
 * shared chunk that the extension cannot load. Building each entry as its
 * own config keeps every output self-contained.
 */
export default defineConfig(
  Object.entries(ENTRIES).map(([name, path], index) => ({
    entry: { [name]: path },
    format: 'esm' as const,
    platform: 'browser' as const,
    deps: { alwaysBundle: ['@qlinter/core', /^codemirror(\/|$)/] },
    outExtensions: () => ({ js: '.js' }),
    dts: false,
    clean: index === 0,
  })),
);
