import { validateConfig, type LintConfig } from '@qlinter/core';
import CodeMirror from 'codemirror';
import 'codemirror/mode/javascript/javascript.js';
import 'codemirror/addon/edit/matchbrackets.js';
import 'codemirror/addon/edit/closebrackets.js';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/material-darker.css';

const SYNC_DEBOUNCE_MS = 150;

export interface ConfigEditor {
  /** Replaces the text without reporting the change back. */
  write(config: LintConfig): void;
  /** The current text, parsed and validated. Throws on either failure. */
  read(): LintConfig;
  refresh(): void;
}

export function createConfigEditor(
  mount: HTMLElement,
  onEdited: (config: LintConfig) => void,
  onDirty: () => void,
): ConfigEditor {
  const darkMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const editor = CodeMirror(mount, {
    value: '',
    mode: { name: 'javascript', json: true },
    lineNumbers: true,
    matchBrackets: true,
    autoCloseBrackets: true,
    smartIndent: true,
    indentUnit: 2,
    tabSize: 2,
    indentWithTabs: false,
    theme: darkMediaQuery.matches ? 'material-darker' : 'default',
  });

  darkMediaQuery.addEventListener('change', (event) => {
    editor.setOption('theme', event.matches ? 'material-darker' : 'default');
  });

  let suppress = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  editor.on('change', () => {
    if (suppress) {
      return;
    }

    onDirty();

    if (timer !== undefined) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      timer = undefined;

      try {
        onEdited(validateConfig(JSON.parse(editor.getValue())));
      } catch {
        /* Invalid JSON or schema: the controls keep the last good value. */
      }
    }, SYNC_DEBOUNCE_MS);
  });

  return {
    write(config: LintConfig): void {
      suppress = true;

      try {
        editor.setValue(JSON.stringify(config, null, 2));
      } finally {
        suppress = false;
      }
    },

    read(): LintConfig {
      return validateConfig(JSON.parse(editor.getValue()));
    },

    refresh(): void {
      editor.refresh();
    },
  };
}
