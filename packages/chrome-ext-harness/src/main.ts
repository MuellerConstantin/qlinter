import CodeMirror from 'codemirror';

import 'codemirror/lib/codemirror.css';
import './globals.css';

/*
 * The Data Load Editor DOM as the chrome-ext was built against it, written out here on purpose
 * instead of imported, so a wrong assumption in the extension shows up instead of being mirrored.
 * Not yet checked against a capture of a real Qlik Sense page.
 */
const EDITOR_CONTAINER_TEST_ID = 'script-editor-container';
const EDITOR_CODE_AREA_TAG = 'scripteditor-code-area';

const FIXTURES = import.meta.glob<string>('../../core/tests/rules/fixtures/*/violation.qvs', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const pageContainer = requireElement<HTMLDivElement>('qv-page-container');
const scriptSelect = requireElement<HTMLSelectElement>('harness-script');
const fileInput = requireElement<HTMLInputElement>('harness-file');

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`harness: #${id} missing from index.html`);
  }

  return element as T;
}

function mountEditor(script: string): CodeMirror.Editor {
  const container = document.createElement('div');
  container.dataset.testid = EDITOR_CONTAINER_TEST_ID;

  const codeArea = document.createElement(EDITOR_CODE_AREA_TAG);
  container.append(codeArea);
  pageContainer.append(container);

  return CodeMirror(codeArea, { value: script, lineNumbers: true });
}

function ruleName(path: string): string {
  return path.split('/').at(-2) ?? path;
}

for (const [path, script] of Object.entries(FIXTURES)) {
  scriptSelect.add(new Option(ruleName(path), script));
}

const editor = mountEditor(scriptSelect.value);

scriptSelect.addEventListener('change', () => {
  editor.setValue(scriptSelect.value);
});

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];

  if (!file) {
    return;
  }

  editor.setValue(await file.text());
});
