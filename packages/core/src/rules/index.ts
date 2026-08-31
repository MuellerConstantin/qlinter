import type { AnyRule, RulesConfigOf } from '../types.js';
export { CASE_STYLES } from './types.js';
export type { CaseStyle, CaseRuleOptions } from './types';
import { blankLineBeforeTable } from './blank-line-before-table.js';
import { blockCommentStars } from './block-comment-stars.js';
import { blockIndent } from './block-indent.js';
import { builtinFunctionCase } from './builtin-function-case.js';
import { builtinKeywordCase } from './builtin-keyword-case.js';
import { commaSpace } from './comma-space.js';
import { commaStyle } from './comma-style.js';
import { commentSpace } from './comment-space.js';
import { continuationIndent } from './continuation-indent.js';
import { eolLast } from './eol-last.js';
import { includeNoSpaces } from './include-no-spaces.js';
import { inlineCommentSpace } from './inline-comment-space.js';
import { loadClauseNewline } from './load-clause-newline.js';
import { loadFieldPerLine } from './load-field-per-line.js';
import { loadIndent } from './load-indent.js';
import { maxLineLength } from './max-line-length.js';
import { multilineCall } from './multiline-call.js';
import { noLegacyPathVariables } from './no-legacy-path-variables.js';
import { noMultipleEmptyLines } from './no-multiple-empty-lines.js';
import { oneStatementPerLine } from './one-statement-per-line.js';
import { operatorSpacing } from './operator-spacing.js';
import { paddedBlocks } from './padded-blocks.js';
import { parenSpacing } from './paren-spacing.js';
import { tableLabelBrackets } from './table-label-brackets.js';
import { trailingWhitespace } from './trailing-whitespace.js';
import { variableCase } from './variable-case.js';
import { variableCharset } from './variable-charset.js';
export { INDENT_STYLES } from './utils/indent.js';
export { LINE_ENDINGS } from './one-statement-per-line.js';
export { BLOCK_PADDING_STYLES } from './padded-blocks.js';
export { VARIABLE_CASE_STYLES } from './variable-case.js';
export type { IndentStyle } from './utils/indent.js';
export type { BlockIndentOptions } from './block-indent.js';
export type { ContinuationIndentOptions } from './continuation-indent.js';
export type { LoadIndentOptions } from './load-indent.js';
export type { MaxLineLengthOptions } from './max-line-length.js';
export type { MultilineCallOptions } from './multiline-call.js';
export type { NoMultipleEmptyLinesOptions } from './no-multiple-empty-lines.js';
export type { LineEnding, OneStatementPerLineOptions } from './one-statement-per-line.js';
export type { BlockPaddingStyle, PaddedBlocksOptions } from './padded-blocks.js';
export type { VariableCaseStyle, VariableCaseOptions } from './variable-case.js';

/**
 * Index of every rule shipped with Core. Use this to enumerate the full rule
 * catalog — for example to populate an options UI that lists every available
 * rule. Not a default lint preset; pass {@link recommended} to `lint()` /
 * `format()` for the opinionated out-of-the-box behavior.
 */
export const allRules = [
  tableLabelBrackets,
  blankLineBeforeTable,
  blockCommentStars,
  blockIndent,
  builtinFunctionCase,
  builtinKeywordCase,
  commaSpace,
  commaStyle,
  commentSpace,
  continuationIndent,
  eolLast,
  includeNoSpaces,
  inlineCommentSpace,
  loadClauseNewline,
  loadFieldPerLine,
  loadIndent,
  maxLineLength,
  multilineCall,
  noLegacyPathVariables,
  noMultipleEmptyLines,
  oneStatementPerLine,
  operatorSpacing,
  paddedBlocks,
  parenSpacing,
  trailingWhitespace,
  variableCase,
  variableCharset,
] as const;

/**
 * Registry mapping every built-in rule id to its rule object. The runner
 * resolves a config's rule ids against this map — a rule not present here is
 * unknown and rejected.
 */
export const registry: ReadonlyMap<string, AnyRule> = new Map(allRules.map((rule) => [rule.id, rule] as const));

/** Union of every built-in rule id. */
export type RuleId = (typeof allRules)[number]['id'];

/** Per-rule configuration keyed by built-in rule id, with rule-specific option typing. */
export type RulesConfig = RulesConfigOf<typeof allRules>;

/**
 * A lint/format configuration. `presets` names one or more built-in presets to
 * use as a base (see {@link PresetName}); `rules` both selects which additional
 * rules run (a rule not listed is not checked) and overrides the severity and
 * options of any rule — including those pulled in by a preset. A config with no
 * `presets` gets no preset base: the runner applies nothing implicitly.
 */
export interface LintConfig {
  presets?: PresetName | PresetName[];
  rules?: RulesConfig;
}

/**
 * Curated preset for the opinionated out-of-the-box experience: every rule
 * enabled at its declared {@link Rule.defaultSeverity}.
 */
export const recommended: LintConfig = {
  rules: Object.fromEntries(allRules.map((rule) => [rule.id, rule.defaultSeverity])) as RulesConfig,
};

/** The built-in named presets, keyed by the name {@link LintConfig.presets} references. */
const presetRegistry = { recommended } as const;

/** Names of the built-in presets that {@link LintConfig.presets} may reference. */
export type PresetName = keyof typeof presetRegistry;

/** Every built-in preset name, for validation and enumeration. */
export const presetNames = Object.keys(presetRegistry) as PresetName[];

/**
 * Expands a config's {@link LintConfig.presets} into a flat `{ rules }` object.
 *
 * The named presets are merged left-to-right (a later preset's rule wins over an
 * earlier one's), then the config's own `rules` overlay them per rule id. There
 * is no implicit default: a config without `presets` resolves to just its own
 * `rules`. `lint` calls this internally, so `presets` works transparently for
 * both `lint` and `format`.
 *
 * @throws If `presets` names a preset that is not built in.
 */
export function resolveConfig(config: LintConfig): LintConfig {
  const names = config.presets === undefined ? [] : Array.isArray(config.presets) ? config.presets : [config.presets];
  const rules: Record<string, unknown> = {};

  for (const name of names) {
    const preset = presetRegistry[name];

    if (!preset) {
      throw new Error(`Unknown preset "${name}".`);
    }

    Object.assign(rules, preset.rules);
  }

  Object.assign(rules, config.rules);

  return { rules: rules as RulesConfig };
}

export {
  blankLineBeforeTable,
  blockCommentStars,
  blockIndent,
  builtinFunctionCase,
  builtinKeywordCase,
  commaSpace,
  commaStyle,
  commentSpace,
  continuationIndent,
  eolLast,
  includeNoSpaces,
  inlineCommentSpace,
  loadClauseNewline,
  loadFieldPerLine,
  loadIndent,
  maxLineLength,
  multilineCall,
  noLegacyPathVariables,
  noMultipleEmptyLines,
  oneStatementPerLine,
  operatorSpacing,
  paddedBlocks,
  parenSpacing,
  tableLabelBrackets,
  trailingWhitespace,
  variableCase,
  variableCharset,
};
