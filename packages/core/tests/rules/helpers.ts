import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AnyRule, Diagnostic } from '../../src/index.js';
import { lintRule } from '../support.js';

const FIXTURES = join(import.meta.dirname, 'fixtures');

export function lintFixture(kind: 'violation' | 'clean', rule: AnyRule, options?: object): Diagnostic[] {
  const source = readFileSync(join(FIXTURES, rule.id, `${kind}.qvs`), 'utf8');
  return lintRule(source, rule, options);
}
