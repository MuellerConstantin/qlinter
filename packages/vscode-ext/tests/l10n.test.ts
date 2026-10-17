import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import manifest from '../package.json' with { type: 'json' };
import nls from '../package.nls.json' with { type: 'json' };
import nlsDe from '../package.nls.de.json' with { type: 'json' };
import bundleDe from '../l10n/bundle.l10n.de.json' with { type: 'json' };

/*
 * Neither VS Code nor the build notices a missing translation: the English text
 * is shown silently instead. These tests are the only place a gap surfaces.
 */

const source = readFileSync(new URL('../src/extension.ts', import.meta.url), 'utf8');
// Each message is one single-quoted literal so it can be found here.
const messages = new Set([...source.matchAll(/l10n\.t\(\s*'([^']*)'/g)].map((match) => match[1]));
const placeholders = new Set([...JSON.stringify(manifest).matchAll(/"%([^%"]+)%"/g)].map((match) => match[1]));

function args(text: string): string[] {
  return [...text.matchAll(/\{\d+\}/g)].map((match) => match[0]).sort();
}

describe('manifest localization', () => {
  it('defines every placeholder the manifest uses, and no other', () => {
    expect(Object.keys(nls).sort()).toEqual([...placeholders].sort());
  });

  it('translates every manifest string into German', () => {
    expect(Object.keys(nlsDe).sort()).toEqual(Object.keys(nls).sort());
  });
});

describe('runtime localization', () => {
  it('finds the messages it checks', () => {
    expect(messages.size).toBeGreaterThan(0);
  });

  it('translates every message into German, and nothing that is gone', () => {
    expect(Object.keys(bundleDe).sort()).toEqual([...messages].sort());
  });

  it('keeps every argument of a message in its translation', () => {
    for (const [message, translation] of Object.entries(bundleDe)) {
      expect(args(translation), message).toEqual(args(message));
    }
  });
});
