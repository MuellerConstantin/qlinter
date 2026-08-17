import { debounce } from './util/debounce';
import { getEditor } from './util/editor';
import { format, lint } from '@qlinter/core';
import { createHighlighter, injectStyles } from './util/highlight';
import type { BridgeMessage, DiagnosticCounts, DiagnosticsBridgeMessage, GetConfigBridgeMessage } from './types.js';
import type { Diagnostic, LintConfig } from '@qlinter/core';
import type { Editor } from 'codemirror';

const MOUNT_TIMEOUT_MS = 10_000;
const LINT_DEBOUNCE_MS = 150;

// The loaded user config is used verbatim — nothing runs until it names a
// preset or rules. This matches the CLI and the VS Code extension: no preset is
// applied implicitly. A fresh install is seeded with the `recommended` preset as
// a real stored entry (see util/config.ts), which the user can remove again on
// the options page; until that config arrives, this empty default lints nothing.
let currentConfig: LintConfig = {};
let triggerLint: (() => void) | undefined;
let editorRef: Editor | undefined;
let mountWatch: MutationObserver | undefined;

function countBySeverity(diagnostics: Diagnostic[]): DiagnosticCounts {
  const counts: DiagnosticCounts = { error: 0, warning: 0, info: 0 };

  for (const diagnostic of diagnostics) {
    counts[diagnostic.severity]++;
  }

  return counts;
}

function fixAll(editor: Editor): void {
  const source = editor.getValue();

  try {
    const { output, fixed } = format(source, currentConfig);

    if (fixed === 0 || output === source) {
      return;
    }

    const lastLine = editor.lastLine();
    const end = { line: lastLine, ch: (editor.getLine(lastLine) ?? '').length };
    editor.replaceRange(output, { line: 0, ch: 0 }, end, '+qlinter-fix-all');
  } catch (error) {
    console.warn('[qlinter:main] fix-all failed', error);
  }
}

function onEditorReady(editor: Editor): void {
  console.log('[qlinter:main] CodeMirror ready');

  editorRef = editor;
  injectStyles();
  const highlighter = createHighlighter(editor);

  const runLint = (): void => {
    const diagnostics = lint(editor.getValue(), currentConfig);
    highlighter.apply(diagnostics);

    const fixable = diagnostics.reduce((count, diagnostic) => (diagnostic.fix ? count + 1 : count), 0);

    const message: DiagnosticsBridgeMessage = {
      source: 'qlinter-main',
      type: 'qlinter:diagnostics',
      counts: countBySeverity(diagnostics),
      fixable,
    };
    window.postMessage(message, window.location.origin);
  };

  editor.on('change', debounce(runLint, LINT_DEBOUNCE_MS));
  triggerLint = runLint;

  /*
   * The first pass runs undebounced. The popup reads the counts once, straight
   * after the content script reports `active`, and then never asks again — a
   * debounced first lint loses that race often enough to show an active status
   * with no severity summary underneath it.
   */
  runLint();
}

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window) {
    return;
  }

  const data = event.data as BridgeMessage | undefined;

  if (data?.source !== 'qlinter-content') {
    return;
  }

  if (data.type === 'qlinter:config') {
    currentConfig = data.config;
    triggerLint?.();
    return;
  }

  if (data.type === 'qlinter:location-change') {
    waitForEditor();
    return;
  }

  if (data.type === 'qlinter:fix-all' && editorRef) {
    fixAll(editorRef);
  }
});

const getConfigRequest: GetConfigBridgeMessage = { source: 'qlinter-main', type: 'qlinter:get-config' };
window.postMessage(getConfigRequest, window.location.origin);

/**
 * Binds to the CodeMirror instance, waiting for it to mount if it has not yet.
 *
 * Safe to call again on every SPA navigation, and the content script does
 * exactly that. The watch times out to avoid observing the DOM forever on a
 * page that never mounts an editor, but a timeout must not be terminal:
 * leaving the script editor and coming back replaces the instance, and a
 * one-shot watch would leave the main world bound to a dead editor — or to
 * nothing — while the isolated world still reports `active`.
 */
function waitForEditor(): void {
  mountWatch?.disconnect();
  mountWatch = undefined;

  const editor = getEditor();

  if (editor && editor !== editorRef) {
    onEditorReady(editor);
    return;
  }

  const start = performance.now();

  const watch = new MutationObserver(() => {
    const found = getEditor();

    if (found && found !== editorRef) {
      watch.disconnect();
      mountWatch = undefined;
      onEditorReady(found);
      return;
    }

    if (performance.now() - start > MOUNT_TIMEOUT_MS) {
      watch.disconnect();
      mountWatch = undefined;
      console.warn('[qlinter:main] CodeMirror mount watch timed out at', location.href);
    }
  });

  mountWatch = watch;
  watch.observe(document.body, { childList: true, subtree: true });
}

waitForEditor();
