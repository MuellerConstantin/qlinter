import { validateConfig, type LintConfig } from '@qlinter/core';
import { DEFAULT_CONFIG, loadConfig, saveConfig } from '../util/config.js';
import { createConfigEditor } from './editor.js';
import { createPresetControls } from './presets.js';
import { createRuleList } from './rule-list.js';

const title = document.getElementById('options-title') as HTMLHeadingElement;
const subtitle = document.getElementById('options-subtitle') as HTMLParagraphElement;
const presetsLabel = document.getElementById('options-presets-label') as HTMLSpanElement;
const presetsHelp = document.getElementById('options-presets-help') as HTMLParagraphElement;
const rulesLabel = document.getElementById('options-rules-label') as HTMLSpanElement;
const rulesHelp = document.getElementById('options-rules-help') as HTMLParagraphElement;
const ruleList = document.getElementById('options-rule-list') as HTMLUListElement;
const advancedDetails = document.getElementById('options-advanced') as HTMLDetailsElement;
const configLabel = document.getElementById('options-config-label') as HTMLElement;
const configHelp = document.getElementById('options-config-help') as HTMLParagraphElement;
const editorMount = document.getElementById('options-config') as HTMLDivElement;
const feedback = document.getElementById('options-feedback') as HTMLDivElement;
const saveButton = document.getElementById('options-save') as HTMLButtonElement;
const resetButton = document.getElementById('options-reset') as HTMLButtonElement;
const form = document.getElementById('options-form') as HTMLFormElement;

const presetElements = {
  list: document.getElementById('options-preset-list') as HTMLUListElement,
  select: document.getElementById('options-preset-select') as HTMLSelectElement,
  addButton: document.getElementById('options-preset-add') as HTMLButtonElement,
  addRow: document.getElementById('options-preset-add-row') as HTMLDivElement,
};

const localizedTitle = chrome.i18n.getMessage('optionsTitle');

document.title = localizedTitle;
document.documentElement.lang = chrome.i18n.getUILanguage();

title.textContent = localizedTitle;
subtitle.textContent = chrome.i18n.getMessage('optionsSubtitle');
presetsLabel.textContent = chrome.i18n.getMessage('optionsPresetsLabel');
presetsHelp.textContent = chrome.i18n.getMessage('optionsPresetsHelp');
presetElements.addButton.textContent = chrome.i18n.getMessage('optionsPresetAddButton');
rulesLabel.textContent = chrome.i18n.getMessage('optionsRulesLabel');
rulesHelp.textContent = chrome.i18n.getMessage('optionsRulesHelp');
configLabel.textContent = chrome.i18n.getMessage('optionsConfigLabel');
configHelp.textContent = chrome.i18n.getMessage('optionsConfigHelp');
saveButton.textContent = chrome.i18n.getMessage('optionsSaveButton');
resetButton.textContent = chrome.i18n.getMessage('optionsResetButton');

let state: LintConfig = {};

function showFeedback(text: string, kind: 'error' | 'success'): void {
  feedback.textContent = text;
  feedback.classList.toggle('feedback-error', kind === 'error');
  feedback.classList.toggle('feedback-success', kind === 'success');
  feedback.hidden = false;
}

function clearFeedback(): void {
  feedback.hidden = true;
  feedback.textContent = '';
  feedback.classList.remove('feedback-error', 'feedback-success');
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function renderControls(): void {
  rules.render(state);
  presets.render(state);
}

function renderAll(): void {
  editor.write(state);
  renderControls();
}

/*
 * Every edit from the controls goes through here, so a value the config rejects
 * never reaches the stored state. On rejection the controls are re-rendered from
 * the state still in force, which resets the offending one, and the message
 * comes from `validateConfig` rather than being restated here.
 */
function apply(transform: (config: LintConfig) => LintConfig): void {
  const candidate = transform(state);

  try {
    state = validateConfig(candidate);
    clearFeedback();
  } catch (err) {
    showFeedback(errorMessage(err), 'error');
  }

  renderAll();
}

const rules = createRuleList(ruleList, apply);
const presets = createPresetControls(presetElements, apply);

const editor = createConfigEditor(
  editorMount,
  (config) => {
    state = config;
    renderControls();
  },
  clearFeedback,
);

advancedDetails.addEventListener('toggle', () => {
  if (advancedDetails.open) {
    editor.refresh();
  }
});

async function persist(next: LintConfig): Promise<void> {
  try {
    await saveConfig(next);
    state = next;
    renderAll();
    showFeedback(chrome.i18n.getMessage('optionsConfigSaved'), 'success');
  } catch (err) {
    showFeedback(errorMessage(err), 'error');
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  let next: LintConfig;

  try {
    next = editor.read();
  } catch (err) {
    showFeedback(err instanceof SyntaxError ? `Invalid JSON: ${errorMessage(err)}` : errorMessage(err), 'error');
    return;
  }

  await persist(next);
});

/*
 * Restores the config a fresh install is seeded with rather than clearing to
 * `{}`. An empty config lints nothing, which looks like a broken extension and
 * is rarely what someone reaching for "restore defaults" wants — and it is still
 * reachable by removing every preset from the list. This is also the only in-UI
 * way back to the default once a config has been stored, since seeding never
 * overwrites an existing one.
 */
resetButton.addEventListener('click', async () => {
  if (!window.confirm(chrome.i18n.getMessage('optionsResetConfirm'))) {
    return;
  }

  await persist({ ...DEFAULT_CONFIG });
});

async function init(): Promise<void> {
  state = await loadConfig();
  renderAll();
}

void init();
