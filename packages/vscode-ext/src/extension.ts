import * as vscode from 'vscode';
import {
  conformanceScore,
  format,
  lint,
  type Diagnostic,
  type Fix,
  type LintConfig,
  type Severity,
} from '@qlinter/core';
import { resolveConfig, type ResolvedConfig, type SettingsInput } from './config.js';
import { ignoreEdit } from './ignore.js';

/**
 * Language identifier contributed for Qlik load scripts. Kept in sync with the
 * `contributes.languages` entry in package.json.
 */
const QLIK_LANGUAGE_ID = 'qlik';

/** Identifies qlinter diagnostics in the editor UI and the Problems panel. */
const DIAGNOSTIC_SOURCE = 'qlinter';

/** Command wired to the status bar item; reveals the active config source. */
const SHOW_CONFIG_COMMAND = 'qlinter.showConfig';

/** Command that applies every autofix to the active script in one pass. */
const FIX_ALL_COMMAND = 'qlinter.fixAll';

/** Rule reference whose sections are headed by rule id, so `#<rule id>` lands on one. */
const DOCS_URL = 'https://github.com/MuellerConstantin/qlinter/blob/main/packages/core/docs/rules.md';

/**
 * Kind for the whole-document autofix action. Nested under `source.fixAll` so it
 * runs when the editor requests `source.fixAll` on save (via
 * `editor.codeActionsOnSave`) or from the "Fix All" command, while staying out of
 * the ordinary quick-fix lightbulb.
 */
const FIX_ALL_KIND = vscode.CodeActionKind.SourceFixAll.append('qlinter');

/** Cache key standing in for documents that belong to no workspace folder. */
const LOOSE_FILE_KEY = '\0loose';

const SEVERITY_MAP: Record<Severity, vscode.DiagnosticSeverity> = {
  error: vscode.DiagnosticSeverity.Error,
  warning: vscode.DiagnosticSeverity.Warning,
  info: vscode.DiagnosticSeverity.Information,
};

/** A resolved config, or the message explaining why resolution failed. */
type ConfigResult =
  | { readonly ok: true; readonly resolved: ResolvedConfig }
  | { readonly ok: false; readonly message: string };

/**
 * Maps a Core diagnostic range to a VS Code range. Core positions are 1-based
 * while VS Code positions are 0-based, so both line and column are shifted down
 * by one (floored at zero to stay within valid bounds).
 */
function toVscodeRange(range: Diagnostic['range']): vscode.Range {
  const { start, end } = range;
  return new vscode.Range(
    Math.max(0, start.line - 1),
    Math.max(0, start.column - 1),
    Math.max(0, end.line - 1),
    Math.max(0, end.column - 1),
  );
}

/**
 * Maps a Core {@link Diagnostic} to a VS Code diagnostic. The rule id becomes a
 * code with a target, which the editor renders as a link to the rule reference.
 */
function toVscodeDiagnostic(diagnostic: Diagnostic): vscode.Diagnostic {
  const result = new vscode.Diagnostic(
    toVscodeRange(diagnostic.range),
    diagnostic.message,
    SEVERITY_MAP[diagnostic.severity],
  );
  result.source = DIAGNOSTIC_SOURCE;
  result.code = { value: diagnostic.ruleId, target: vscode.Uri.parse(`${DOCS_URL}#${diagnostic.ruleId}`) };

  return result;
}

/** The rule id a qlinter diagnostic was created with by {@link toVscodeDiagnostic}. */
function ruleIdOf(diagnostic: vscode.Diagnostic): string | number | undefined {
  return typeof diagnostic.code === 'object' ? diagnostic.code.value : diagnostic.code;
}

/**
 * Builds a quick-fix code action that applies a Core {@link Fix} to `document`.
 * The fix's byte offsets are turned into a document range via
 * {@link vscode.TextDocument.positionAt}, and the action is linked back to its
 * diagnostic so the editor marks the problem as fixable.
 */
function createFixAction(document: vscode.TextDocument, diagnostic: vscode.Diagnostic, fix: Fix): vscode.CodeAction {
  const action = new vscode.CodeAction(`Fix: ${diagnostic.message}`, vscode.CodeActionKind.QuickFix);
  action.diagnostics = [diagnostic];
  action.isPreferred = true;

  action.edit = new vscode.WorkspaceEdit();
  action.edit.replace(
    document.uri,
    new vscode.Range(document.positionAt(fix.range.start), document.positionAt(fix.range.end)),
    fix.replacement,
  );

  return action;
}

/**
 * Builds a quick-fix code action that disables `ruleId` on `line` through a
 * disable directive, or `undefined` when the rule is already disabled there.
 */
function createIgnoreAction(
  document: vscode.TextDocument,
  diagnostics: vscode.Diagnostic[],
  line: number,
  ruleId: string,
): vscode.CodeAction | undefined {
  const eol = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
  const change = ignoreEdit((index) => document.lineAt(index).text, line, ruleId, eol);

  if (change === undefined) {
    return undefined;
  }

  const action = new vscode.CodeAction(`Ignore ${ruleId} for this line`, vscode.CodeActionKind.QuickFix);
  action.diagnostics = diagnostics;
  action.edit = new vscode.WorkspaceEdit();

  if (change.kind === 'insert') {
    action.edit.insert(document.uri, new vscode.Position(change.line, 0), change.text);
  } else {
    action.edit.replace(document.uri, document.lineAt(change.line).range, change.text);
  }

  return action;
}

/** A range spanning the entire document, used to replace it wholesale. */
function fullRange(document: vscode.TextDocument): vscode.Range {
  return new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
}

/** Whether a resolved config would run no rules at all. */
function isEmptyConfig(config: LintConfig): boolean {
  const noPresets = config.presets === undefined || (Array.isArray(config.presets) && config.presets.length === 0);
  const noRules = config.rules === undefined || Object.keys(config.rules).length === 0;
  return noPresets && noRules;
}

/**
 * Entry point invoked by the VS Code extension host once the extension is
 * activated. Wires up live linting for Qlik scripts, resolving the config per
 * document (a workspace `qlinter.json` wins, otherwise the `qlinter.*` settings),
 * exposes Core's autofixes as quick fixes, and reflects the active config source
 * in the status bar. Disposables are tracked against the extension
 * {@link vscode.ExtensionContext context} so they are torn down on deactivation.
 *
 * @param context - Extension context provided by the host.
 */
export function activate(context: vscode.ExtensionContext): void {
  const collection = vscode.languages.createDiagnosticCollection(DIAGNOSTIC_SOURCE);
  const output = vscode.window.createOutputChannel('qlinter');
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 0);
  statusBar.command = SHOW_CONFIG_COMMAND;
  const scoreItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, -1);
  scoreItem.command = 'workbench.actions.view.problems';
  context.subscriptions.push(collection, output, statusBar, scoreItem);

  // Scores of open documents, keyed by URI, kept from the last lint pass so the
  // status bar never lints a second time to show one.
  const scores = new Map<string, number | null>();

  // Resolved configs are cached per workspace folder (loose files share one
  // entry) so a `qlinter.json` is not re-read on every keystroke. The cache is
  // cleared wholesale whenever settings or a `qlinter.json` change.
  const cache = new Map<string, ConfigResult>();

  function getConfig(document: vscode.TextDocument): ConfigResult {
    const folderRoot = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;
    const key = folderRoot ?? LOOSE_FILE_KEY;
    const cached = cache.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const settingsScope = vscode.workspace.getConfiguration('qlinter', document.uri);
    const settings: SettingsInput = {
      presets: settingsScope.get('presets'),
      rules: settingsScope.get('rules'),
    };

    let result: ConfigResult;

    try {
      result = { ok: true, resolved: resolveConfig(folderRoot, settings) };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result = { ok: false, message };
      output.appendLine(message);
      void vscode.window.showErrorMessage(`qlinter: ${message}`);
    }

    cache.set(key, result);
    return result;
  }

  function refreshDiagnostics(document: vscode.TextDocument): void {
    scores.delete(document.uri.toString());

    if (document.languageId !== QLIK_LANGUAGE_ID) {
      collection.delete(document.uri);
      return;
    }

    const result = getConfig(document);

    if (!result.ok) {
      collection.delete(document.uri);
      return;
    }

    const source = document.getText();
    const diagnostics = lint(source, result.resolved.config);
    collection.set(document.uri, diagnostics.map(toVscodeDiagnostic));

    // With no rules every line is clean, and a perfect score would say nothing.
    if (!isEmptyConfig(result.resolved.config)) {
      scores.set(document.uri.toString(), conformanceScore(source, diagnostics));
    }

    if (document === vscode.window.activeTextEditor?.document) {
      updateScore(document);
    }
  }

  function updateScore(document: vscode.TextDocument | undefined): void {
    const score = document === undefined ? undefined : scores.get(document.uri.toString());

    // `null` is Core declining to score a script too short for the figure to mean anything.
    if (score === undefined || score === null) {
      scoreItem.hide();
      return;
    }

    scoreItem.text = `$(pass) ${score}%`;
    scoreItem.tooltip = `qlinter conformance: ${score}% of lines carry no finding. Click to open the Problems panel.`;
    scoreItem.show();
  }

  function updateStatusBar(editor: vscode.TextEditor | undefined): void {
    const document = editor?.document;
    updateScore(document);

    if (document === undefined || document.languageId !== QLIK_LANGUAGE_ID) {
      statusBar.hide();
      return;
    }

    const result = getConfig(document);

    if (!result.ok) {
      statusBar.text = '$(error) qlinter: config error';
      statusBar.tooltip = result.message;
    } else if (result.resolved.source === 'qlinter.json') {
      statusBar.text = '$(check) qlinter: qlinter.json';
      statusBar.tooltip = `Using ${result.resolved.path}`;
    } else if (isEmptyConfig(result.resolved.config)) {
      statusBar.text = '$(warning) qlinter: no rules';
      statusBar.tooltip = 'No qlinter.json found and no rules configured. Click to open settings.';
    } else {
      statusBar.text = '$(check) qlinter: settings';
      statusBar.tooltip = 'Configured via VS Code settings. Click to open settings.';
    }

    statusBar.show();
  }

  function refreshAll(): void {
    cache.clear();

    for (const document of vscode.workspace.textDocuments) {
      refreshDiagnostics(document);
    }

    updateStatusBar(vscode.window.activeTextEditor);
  }

  /**
   * Runs Core's whole-document formatter and returns the formatted text, or
   * `undefined` when the document is already formatted or formatting fails. A
   * failure (e.g. autofixes that do not converge) is surfaced rather than
   * swallowed, but never throws out of a provider — that would leave "Format
   * Document" or a save silently broken.
   */
  function formatDocument(document: vscode.TextDocument): string | undefined {
    const result = getConfig(document);

    if (!result.ok) {
      return undefined;
    }

    const source = document.getText();

    try {
      const { output: formatted } = format(source, result.resolved.config);
      return formatted === source ? undefined : formatted;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      output.appendLine(message);
      void vscode.window.showErrorMessage(`qlinter: ${message}`);
      return undefined;
    }
  }

  const formattingProvider: vscode.DocumentFormattingEditProvider = {
    provideDocumentFormattingEdits(document): vscode.TextEdit[] {
      const formatted = formatDocument(document);
      return formatted === undefined ? [] : [vscode.TextEdit.replace(fullRange(document), formatted)];
    },
  };

  /** Builds the autofix and ignore quick fixes for the qlinter diagnostics in `context`. */
  function quickFixes(
    document: vscode.TextDocument,
    config: LintConfig,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const qlinterDiagnostics = context.diagnostics.filter((diagnostic) => diagnostic.source === DIAGNOSTIC_SOURCE);

    if (qlinterDiagnostics.length === 0) {
      return [];
    }

    const coreDiagnostics = lint(document.getText(), config);
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of qlinterDiagnostics) {
      const match = coreDiagnostics.find(
        (core) =>
          core.fix !== undefined &&
          core.ruleId === ruleIdOf(diagnostic) &&
          toVscodeRange(core.range).isEqual(diagnostic.range),
      );

      if (match?.fix) {
        actions.push(createFixAction(document, diagnostic, match.fix));
      }
    }

    // One rule can report several findings on a line, but one directive covers them all.
    const ignored = new Map<string, { line: number; ruleId: string; diagnostics: vscode.Diagnostic[] }>();

    for (const diagnostic of qlinterDiagnostics) {
      const ruleId = String(ruleIdOf(diagnostic));
      const line = diagnostic.range.start.line;
      const key = `${line}:${ruleId}`;
      const entry = ignored.get(key) ?? { line, ruleId, diagnostics: [] };
      entry.diagnostics.push(diagnostic);
      ignored.set(key, entry);
    }

    for (const { line, ruleId, diagnostics } of ignored.values()) {
      const action = createIgnoreAction(document, diagnostics, line, ruleId);

      if (action) {
        actions.push(action);
      }
    }

    return actions;
  }

  /** Builds the whole-document "fix all" action, or `undefined` if nothing changes. */
  function fixAllAction(document: vscode.TextDocument): vscode.CodeAction | undefined {
    const formatted = formatDocument(document);

    if (formatted === undefined) {
      return undefined;
    }

    const action = new vscode.CodeAction('qlinter: Fix all auto-fixable problems', FIX_ALL_KIND);
    action.edit = new vscode.WorkspaceEdit();
    action.edit.replace(document.uri, fullRange(document), formatted);

    return action;
  }

  const fixProvider: vscode.CodeActionProvider = {
    provideCodeActions(document, _range, actionContext): vscode.CodeAction[] {
      const only = actionContext.only;
      const wantsQuickFix = only === undefined || vscode.CodeActionKind.QuickFix.intersects(only);
      // `source.fixAll` is a source action: offer it only when explicitly
      // requested (on save or "Fix All"), never in the ordinary lightbulb.
      const wantsFixAll = only !== undefined && FIX_ALL_KIND.intersects(only);

      if (!wantsQuickFix && !wantsFixAll) {
        return [];
      }

      const result = getConfig(document);

      if (!result.ok) {
        return [];
      }

      const actions: vscode.CodeAction[] = [];

      if (wantsQuickFix) {
        actions.push(...quickFixes(document, result.resolved.config, actionContext));
      }

      if (wantsFixAll) {
        const fixAll = fixAllAction(document);

        if (fixAll) {
          actions.push(fixAll);
        }
      }

      return actions;
    },
  };

  const configWatcher = vscode.workspace.createFileSystemWatcher('**/qlinter.json');

  for (const document of vscode.workspace.textDocuments) {
    refreshDiagnostics(document);
  }

  updateStatusBar(vscode.window.activeTextEditor);

  context.subscriptions.push(
    configWatcher,
    vscode.commands.registerCommand(SHOW_CONFIG_COMMAND, async () => {
      const document = vscode.window.activeTextEditor?.document;

      if (document !== undefined) {
        const result = getConfig(document);

        if (result.ok && result.resolved.source === 'qlinter.json' && result.resolved.path !== undefined) {
          const opened = await vscode.workspace.openTextDocument(result.resolved.path);
          await vscode.window.showTextDocument(opened);
          return;
        }
      }

      await vscode.commands.executeCommand('workbench.action.openSettings', 'qlinter');
    }),
    vscode.commands.registerTextEditorCommand(FIX_ALL_COMMAND, (editor, edit) => {
      const document = editor.document;

      if (document.languageId !== QLIK_LANGUAGE_ID || !getConfig(document).ok) {
        return;
      }

      const formatted = formatDocument(document);

      if (formatted === undefined) {
        vscode.window.setStatusBarMessage('qlinter: nothing to fix', 3000);
        return;
      }

      edit.replace(fullRange(document), formatted);
    }),
    vscode.workspace.onDidOpenTextDocument((document) => refreshDiagnostics(document)),
    vscode.workspace.onDidChangeTextDocument((event) => refreshDiagnostics(event.document)),
    vscode.workspace.onDidCloseTextDocument((document) => {
      collection.delete(document.uri);
      scores.delete(document.uri.toString());
    }),
    vscode.window.onDidChangeActiveTextEditor((editor) => updateStatusBar(editor)),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('qlinter')) {
        refreshAll();
      }
    }),
    configWatcher.onDidCreate(() => refreshAll()),
    configWatcher.onDidChange(() => refreshAll()),
    configWatcher.onDidDelete(() => refreshAll()),
    vscode.languages.registerCodeActionsProvider(QLIK_LANGUAGE_ID, fixProvider, {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix, FIX_ALL_KIND],
    }),
    vscode.languages.registerDocumentFormattingEditProvider(QLIK_LANGUAGE_ID, formattingProvider),
  );
}

/**
 * Invoked by the VS Code extension host when the extension is deactivated. The
 * diagnostic collection, status bar item, output channel, and event
 * subscriptions are disposed automatically via the extension context, so there
 * is nothing to clean up here.
 */
export function deactivate(): void {}
