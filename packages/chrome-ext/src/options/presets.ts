import { presetNames, type LintConfig, type PresetName } from '@qlinter/core';
import { presetsOf, withPresets } from './state.js';

type ApplyEdit = (transform: (config: LintConfig) => LintConfig) => void;

export interface PresetControls {
  render(config: LintConfig): void;
}

export interface PresetElements {
  list: HTMLUListElement;
  select: HTMLSelectElement;
  addButton: HTMLButtonElement;
  addRow: HTMLDivElement;
}

export function createPresetControls(elements: PresetElements, apply: ApplyEdit): PresetControls {
  elements.addButton.addEventListener('click', () => {
    const value = elements.select.value as PresetName | '';

    if (value === '') {
      return;
    }

    apply((config) => {
      const selected = presetsOf(config);

      return selected.includes(value) ? config : withPresets(config, [...selected, value]);
    });
  });

  return {
    render(config: LintConfig): void {
      const selected = presetsOf(config);

      elements.list.replaceChildren();

      for (const preset of selected) {
        const row = document.createElement('li');
        row.className = 'preset-row';

        const name = document.createElement('span');
        name.className = 'preset-name';
        name.textContent = preset;

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'preset-remove';
        remove.textContent = '×';
        remove.setAttribute('aria-label', chrome.i18n.getMessage('optionsPresetRemove', [preset]));
        remove.addEventListener('click', () => {
          apply((config) =>
            withPresets(
              config,
              presetsOf(config).filter((entry) => entry !== preset),
            ),
          );
        });

        row.append(name, remove);
        elements.list.appendChild(row);
      }

      elements.list.hidden = selected.length === 0;

      const available = presetNames.filter((preset) => !selected.includes(preset));

      elements.select.replaceChildren();

      for (const preset of available) {
        const option = document.createElement('option');
        option.value = preset;
        option.textContent = preset;
        elements.select.appendChild(option);
      }

      /*
       * The whole add row is hidden rather than left as an empty, disabled
       * dropdown: with one preset in existence "everything already added" is the
       * normal state, and a permanently dead control is worse than none.
       */
      elements.addRow.hidden = available.length === 0;
    },
  };
}
