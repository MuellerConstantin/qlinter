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
        row.className =
          'ql:inline-flex ql:items-center ql:gap-1 ql:h-6.5 ql:pl-2.5 ql:pr-0.5 ql:rounded-sm ql:bg-secondary';

        const name = document.createElement('span');
        name.className = 'ql:font-mono ql:text-xs';
        name.textContent = preset;

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className =
          'ql:inline-flex ql:items-center ql:justify-center ql:size-5.5 ql:rounded-sm ql:text-base ql:leading-none ql:text-muted ql:cursor-pointer ql:hover:bg-secondary-hover ql:hover:text-foreground ql:focus-visible:outline-1 ql:focus-visible:-outline-offset-1 ql:focus-visible:outline-accent';
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
