import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AnyRule, Diagnostic } from '../../src/index.js';
import { lintRule } from '../support.js';

const FIXTURES = join(import.meta.dirname, 'fixtures');

/** The source of one of a rule's own fixtures. */
export function readFixture(kind: 'violation' | 'clean', rule: AnyRule): string {
  return readFileSync(join(FIXTURES, rule.id, `${kind}.qvs`), 'utf8');
}

export function lintFixture(kind: 'violation' | 'clean', rule: AnyRule, options?: object): Diagnostic[] {
  return lintRule(readFixture(kind, rule), rule, options);
}
