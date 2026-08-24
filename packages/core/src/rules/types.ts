import type { OptionsSchemaOf } from '../types.js';

/**
 * Case styles shared by the keyword and function casing rules. The array is the
 * source: the union type is derived from it, so the values stay available at
 * runtime for config validation and options UIs.
 */
export const CASE_STYLES = ['pascal', 'lower', 'upper'] as const;

export type CaseStyle = (typeof CASE_STYLES)[number];

export interface CaseRuleOptions {
  style: CaseStyle;
}

/** Shared option schema for the rules built on {@link CaseRuleOptions}. */
export const CASE_OPTIONS_SCHEMA = {
  style: { type: 'enum', values: CASE_STYLES },
} as const satisfies OptionsSchemaOf<CaseRuleOptions>;
