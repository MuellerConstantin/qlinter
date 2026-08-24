import type { IToken } from 'chevrotain';

/** How serious a diagnostic is. */
export type Severity = 'error' | 'warning' | 'info';

/** A 1-based line/column location in the source. */
export interface Position {
  line: number;
  column: number;
}

/** A span between two {@link Position}s; `end` is exclusive. */
export interface Range {
  start: Position;
  end: Position;
}

/**
 * An autofix: replaces the source between the byte offsets `range.start` and
 * `range.end` (0-based, end-exclusive) with `replacement`.
 */
export interface Fix {
  range: { start: number; end: number };
  replacement: string;
}

/**
 * A single lint result: which rule fired (`ruleId`), how serious it is
 * (`severity`), where (`range`), a human-readable `message`, and an optional
 * {@link Fix} when the violation can be auto-corrected.
 */
export interface Diagnostic {
  ruleId: string;
  severity: Severity;
  range: Range;
  message: string;
  fix?: Fix;
}

export type Finding = Omit<Diagnostic, 'ruleId' | 'severity'>;

export interface RuleContext {
  source: string;
  tokens: IToken[];
  firstOnLine: IToken[];
  comments: IToken[];
}

/**
 * Runtime description of a single rule option, so a host can validate and render
 * it without knowing the rule. Deliberately limited to the two shapes the
 * built-in rules need: a rule wanting something else validates it in its own
 * `check` rather than growing this union speculatively.
 */
export type OptionSchema = { type: 'number'; min?: number; max?: number } | { type: 'enum'; values: readonly string[] };

/**
 * The per-key schema for a rule's options type `O`. Being a mapped type, a
 * missing, misspelled, or wrongly-typed key is a compile error.
 *
 * An option whose type has no {@link OptionSchema} counterpart resolves to a
 * marker no literal can satisfy, so it fails to compile naming that type until
 * `OptionSchema` and everything switching exhaustively over it are extended.
 */
export type OptionsSchemaOf<O> = {
  [K in keyof O]-?: [O[K]] extends [number]
    ? { type: 'number'; min?: number; max?: number }
    : [O[K]] extends [string]
      ? { type: 'enum'; values: readonly O[K][] }
      : { __unsupported: ['no OptionSchema variant for', O[K]] };
};

interface RuleBase<O, Id extends string> {
  id: Id;
  defaultSeverity: Severity;
  defaultOptions?: O;
  check(ctx: RuleContext, options: O): Finding[];
}

/**
 * A lint rule. A rule with options must describe them under `options` so hosts
 * can validate and render them; a rule without options must leave it out.
 */
export type Rule<O = undefined, Id extends string = string> = RuleBase<O, Id> &
  ([O] extends [undefined] ? { options?: never } : { options: OptionsSchemaOf<O> });

/** A {@link Severity}, or `'off'` to disable a rule in a config entry. */
export type SeverityOrOff = Severity | 'off';

export type SeverityOrInherit = SeverityOrOff | null;

/**
 * A rule's entry in `config.rules`: a bare severity (`'error'`), a
 * single-element tuple (`['warning']`), or — for rules with options — a
 * `[severity, options]` tuple (`['error', { max: 100 }]`). The tuple forms also
 * accept `null` in place of the severity (`[null, { max: 100 }]`).
 */
export type RuleConfigEntry<O = unknown> = [O] extends [undefined]
  ? SeverityOrOff | [SeverityOrInherit]
  : SeverityOrOff | [SeverityOrInherit] | [SeverityOrInherit, Partial<O>];

/*
 * Rule is invariant in O, so heterogeneous rule tuples can only share a common
 * element type via `any`. Spelled out rather than written as `Rule<any, string>`:
 * the conditional in `Rule` distributes over `any` and produces a union that
 * includes the `{ options?: never }` branch, which no rule with options fits.
 * `options` is widened to a plain record here so consumers iterating a rule from
 * the registry get `OptionSchema` back instead of `unknown`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRule = RuleBase<any, string> & { options?: Readonly<Record<string, OptionSchema>> };

/*
 * Options are inferred from `check` rather than from `Rule<infer O, string>`,
 * because inference through the intersection that `Rule` now is would depend on
 * which member TypeScript picks.
 */
type OptionsOfRule<R> = R extends { check(ctx: RuleContext, options: infer O): Finding[] } ? O : never;

export type RulesConfigOf<R extends readonly AnyRule[]> = {
  [I in R[number]['id']]?: RuleConfigEntry<OptionsOfRule<Extract<R[number], { id: I }>>>;
};

/**
 * The result of {@link format}: the fixed `output`, the `diagnostics` that remain
 * after fixing (i.e. those without an autofix), and `fixed`, the number of fixes
 * applied across all passes.
 */
export interface FormatResult {
  output: string;
  diagnostics: Diagnostic[];
  fixed: number;
}
