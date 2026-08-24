import { allRules, type AnyRule, type LintConfig, type OptionSchema } from '@qlinter/core';
import {
  DEFAULT_CHOICE,
  SEVERITY_CHOICES,
  optionsFor,
  severityFor,
  withOption,
  withSeverity,
  type SeverityChoice,
} from './state.js';

const DOCS_URL = 'https://github.com/MuellerConstantin/qlinter/blob/main/packages/core/docs/rules.md';

/**
 * Hands an edit up to the caller, which decides whether the result is
 * acceptable. The list holds no config of its own and re-renders from whatever
 * config is in force afterwards, so a rejected edit resets its own control.
 */
type ApplyEdit = (transform: (config: LintConfig) => LintConfig) => void;

export interface RuleList {
  render(config: LintConfig): void;
}

interface BoundControl {
  ruleId: string;
  key: string;
  element: HTMLSelectElement | HTMLInputElement;
}

function enumControl(schema: Extract<OptionSchema, { type: 'enum' }>): HTMLSelectElement {
  const select = document.createElement('select');
  select.className = 'rule-option-input';

  for (const value of [DEFAULT_CHOICE, ...schema.values]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }

  return select;
}

function numberControl(schema: Extract<OptionSchema, { type: 'number' }>): HTMLInputElement {
  const input = document.createElement('input');
  input.className = 'rule-option-input';
  input.type = 'number';
  input.step = '1';

  if (schema.min !== undefined) {
    input.min = String(schema.min);
  }

  if (schema.max !== undefined) {
    input.max = String(schema.max);
  }

  return input;
}

/** The control's value, or `undefined` when it is empty or set to "default". */
function readControl(element: HTMLSelectElement | HTMLInputElement): string | number | undefined {
  if (element instanceof HTMLSelectElement) {
    return element.value === DEFAULT_CHOICE ? undefined : element.value;
  }

  if (element.value.trim() === '') {
    return undefined;
  }

  /*
   * Parsed rather than handed on as text: a number input yields a string, while
   * the config expects a number and is validated as one.
   */
  const parsed = Number(element.value);

  return Number.isFinite(parsed) ? parsed : element.value;
}

function writeControl(element: HTMLSelectElement | HTMLInputElement, value: unknown): void {
  if (element instanceof HTMLSelectElement) {
    element.value = value === undefined ? DEFAULT_CHOICE : String(value);
    return;
  }

  element.value = value === undefined ? '' : String(value);
}

/*
 * Option keys are shown verbatim, the same names the JSON below uses. A friendlier
 * label would mean a translated string per option, maintained by hand beside the
 * schema that already describes it.
 */
function optionField(
  rule: AnyRule,
  key: string,
  schema: OptionSchema,
  apply: ApplyEdit,
): { field: HTMLElement; element: HTMLSelectElement | HTMLInputElement } {
  const field = document.createElement('label');
  field.className = 'rule-option';

  const name = document.createElement('span');
  name.className = 'rule-option-key';
  name.textContent = key;

  const element = schema.type === 'enum' ? enumControl(schema) : numberControl(schema);
  element.setAttribute('aria-label', `${rule.id} ${key}`);

  const fallback = (rule.defaultOptions as Record<string, unknown> | undefined)?.[key];

  if (element instanceof HTMLInputElement && fallback !== undefined) {
    element.placeholder = String(fallback);
  }

  element.addEventListener('change', () => {
    const value = readControl(element);

    apply((config) => withOption(config, rule.id, key, value));
  });

  field.append(name, element);

  return { field, element };
}

function ruleRow(
  rule: AnyRule,
  apply: ApplyEdit,
): { row: HTMLLIElement; severity: HTMLSelectElement; options: BoundControl[] } {
  const row = document.createElement('li');
  row.className = 'rule-row';

  const head = document.createElement('div');
  head.className = 'rule-head';

  const id = document.createElement('a');
  id.className = 'rule-id';
  id.textContent = rule.id;
  id.href = `${DOCS_URL}#${rule.id}`;
  id.target = '_blank';
  id.rel = 'noopener noreferrer';

  const severity = document.createElement('select');
  severity.className = 'rule-severity';
  severity.setAttribute('aria-label', rule.id);

  for (const choice of SEVERITY_CHOICES) {
    const option = document.createElement('option');
    option.value = choice;
    option.textContent = choice;
    severity.appendChild(option);
  }

  severity.addEventListener('change', () => {
    const choice = severity.value as SeverityChoice;

    apply((config) => withSeverity(config, rule.id, choice));
  });

  head.append(id, severity);
  row.appendChild(head);

  const options: BoundControl[] = [];

  if (rule.options !== undefined) {
    const container = document.createElement('div');
    container.className = 'rule-options';

    for (const [key, schema] of Object.entries(rule.options)) {
      const { field, element } = optionField(rule, key, schema, apply);

      container.appendChild(field);
      options.push({ ruleId: rule.id, key, element });
    }

    row.appendChild(container);
  }

  return { row, severity, options };
}

export function createRuleList(list: HTMLUListElement, apply: ApplyEdit): RuleList {
  const severitySelects = new Map<string, HTMLSelectElement>();
  const optionControls: BoundControl[] = [];

  list.replaceChildren();

  for (const rule of allRules as readonly AnyRule[]) {
    const { row, severity, options } = ruleRow(rule, apply);

    list.appendChild(row);
    severitySelects.set(rule.id, severity);
    optionControls.push(...options);
  }

  return {
    render(config: LintConfig): void {
      for (const [ruleId, select] of severitySelects) {
        select.value = severityFor(config, ruleId);
      }

      for (const { ruleId, key, element } of optionControls) {
        writeControl(element, optionsFor(config, ruleId)[key]);
      }
    },
  };
}
