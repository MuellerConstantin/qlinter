export { lint, format } from './runner.js';
export { validateConfig } from './config/index.js';
export { resolveConfig } from './rules/index.js';
export type {
  Diagnostic,
  Rule,
  AnyRule,
  Severity,
  Fix,
  OptionSchema,
  OptionsSchemaOf,
  RulesConfigOf,
  RuleConfigEntry,
  SeverityOrOff,
  SeverityOrInherit,
  FormatResult,
} from './types.js';
export type { LintConfig, RulesConfig, RuleId, PresetName } from './rules/index.js';
export {
  allRules,
  recommended,
  presetNames,
  CASE_STYLES,
  INDENT_STYLES,
  LINE_ENDINGS,
  VARIABLE_CASE_STYLES,
  tableLabelBrackets,
  blockIndent,
  builtinFunctionCase,
  builtinKeywordCase,
  commentSpace,
  loadClauseNewline,
  loadFieldPerLine,
  loadIndent,
  noLegacyPathVariables,
  noMultipleEmptyLines,
  trailingWhitespace,
  variableCase,
} from './rules/index.js';
export type {
  BlockIndentOptions,
  CaseStyle,
  CaseRuleOptions,
  IndentStyle,
  LoadIndentOptions,
  NoMultipleEmptyLinesOptions,
  VariableCaseStyle,
  VariableCaseOptions,
} from './rules/index.js';
