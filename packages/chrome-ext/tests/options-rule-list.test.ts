import { allRules, type AnyRule, type LintConfig } from '@qlinter/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { createRuleList } from '../src/options/rule-list.js';

const rules = allRules as readonly AnyRule[];
const withOptions = rules.filter((rule) => rule.options !== undefined);

let list: HTMLUListElement;
let applied: LintConfig;

/** Stands in for the options page, which validates and re-renders after each edit. */
function mount(initial: LintConfig = {}) {
  applied = initial;

  const handle = createRuleList(list, (transform) => {
    applied = transform(applied);
    handle.render(applied);
  });

  handle.render(applied);

  return handle;
}

function row(ruleId: string): HTMLLIElement {
  const index = rules.findIndex((rule) => rule.id === ruleId);

  return list.children[index] as HTMLLIElement;
}

function optionInput(ruleId: string, key: string): HTMLSelectElement | HTMLInputElement {
  return row(ruleId).querySelector(`[aria-label="${ruleId} ${key}"]`) as HTMLSelectElement | HTMLInputElement;
}

function severitySelect(ruleId: string): HTMLSelectElement {
  return row(ruleId).querySelector('.rule-severity') as HTMLSelectElement;
}

function change(element: HTMLElement): void {
  element.dispatchEvent(new Event('change'));
}

beforeEach(() => {
  document.body.innerHTML = '<ul id="rules"></ul>';
  list = document.getElementById('rules') as HTMLUListElement;
});

describe('rule list rendering', () => {
  it('renders one row per rule', () => {
    mount();

    expect(list.children).toHaveLength(rules.length);
  });

  it('renders a control for every option a rule declares, and none otherwise', () => {
    mount();

    for (const rule of rules) {
      const inputs = row(rule.id).querySelectorAll('.rule-option-input');

      expect(inputs).toHaveLength(Object.keys(rule.options ?? {}).length);
    }
  });

  it('covers rules on both sides, so neither expectation is vacuous', () => {
    expect(withOptions.length).toBeGreaterThan(0);
    expect(rules.length).toBeGreaterThan(withOptions.length);
  });

  it('offers exactly the enum values the schema lists, plus default', () => {
    mount();

    const select = optionInput('variable-case', 'style') as HTMLSelectElement;

    expect([...select.options].map((option) => option.value)).toEqual([
      'default',
      'camel',
      'pascal',
      'snake',
      'upperSnake',
    ]);
  });

  it('bounds a number control by the schema range', () => {
    mount();

    const input = optionInput('block-indent', 'size') as HTMLInputElement;

    expect(input.type).toBe('number');
    expect(input.min).toBe('1');
    expect(input.max).toBe('8');
  });

  it('shows the rule default as the placeholder of an empty number control', () => {
    mount();

    expect((optionInput('max-line-length', 'max') as HTMLInputElement).placeholder).toBe('120');
  });
});

describe('rule list editing', () => {
  it('sets an option without touching the severity', () => {
    mount({ presets: 'recommended' });

    const input = optionInput('block-indent', 'size') as HTMLInputElement;
    input.value = '2';
    change(input);

    expect(applied.rules?.['block-indent']).toEqual([null, { size: 2 }]);
    expect(severitySelect('block-indent').value).toBe('default');
  });

  it('writes a number, not the string the input holds', () => {
    mount();

    const input = optionInput('max-line-length', 'max') as HTMLInputElement;
    input.value = '80';
    change(input);

    expect(applied.rules?.['max-line-length']).toEqual([null, { max: 80 }]);
  });

  it('clearing a number control removes the option again', () => {
    mount();

    const input = optionInput('max-line-length', 'max') as HTMLInputElement;
    input.value = '80';
    change(input);
    input.value = '';
    change(input);

    expect(applied.rules?.['max-line-length']).toBeUndefined();
  });

  it('selecting default on an enum clears that option', () => {
    mount();

    const select = optionInput('variable-case', 'style') as HTMLSelectElement;
    select.value = 'snake';
    change(select);
    expect(applied.rules?.['variable-case']).toEqual([null, { style: 'snake' }]);

    select.value = 'default';
    change(select);
    expect(applied.rules?.['variable-case']).toBeUndefined();
  });

  it('keeps the options when a severity is chosen afterwards', () => {
    mount();

    const input = optionInput('block-indent', 'size') as HTMLInputElement;
    input.value = '2';
    change(input);

    const severity = severitySelect('block-indent');
    severity.value = 'error';
    change(severity);

    expect(applied.rules?.['block-indent']).toEqual(['error', { size: 2 }]);
  });

  it('keeps the options when the severity goes back to default', () => {
    mount({ rules: { 'block-indent': ['error', { size: 2 }] } });

    const severity = severitySelect('block-indent');
    severity.value = 'default';
    change(severity);

    expect(applied.rules?.['block-indent']).toEqual([null, { size: 2 }]);
  });
});

describe('rule list display of an existing config', () => {
  it('shows the stored severity and options', () => {
    mount({ rules: { 'block-indent': ['error', { size: 2, style: 'tab' }] } });

    expect(severitySelect('block-indent').value).toBe('error');
    expect((optionInput('block-indent', 'size') as HTMLInputElement).value).toBe('2');
    expect((optionInput('block-indent', 'style') as HTMLSelectElement).value).toBe('tab');
  });

  it('shows a null-severity entry as default while keeping its options visible', () => {
    mount({ rules: { 'block-indent': [null, { size: 2 }] } });

    expect(severitySelect('block-indent').value).toBe('default');
    expect((optionInput('block-indent', 'size') as HTMLInputElement).value).toBe('2');
  });

  it('leaves controls empty for a rule the config does not mention', () => {
    mount({});

    expect(severitySelect('block-indent').value).toBe('default');
    expect((optionInput('block-indent', 'size') as HTMLInputElement).value).toBe('');
  });
});
