import type { Editor, LineHandle, TextMarker, Position } from 'codemirror';
import type { Diagnostic, Severity } from '@qlinter/core';

const STYLE_ID = 'qlinter-styles';
const TOOLTIP_HIDE_DELAY_MS = 200;

export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');

  style.id = STYLE_ID;
  style.textContent = `
    .qlinter-mark-error   { text-decoration: red wavy underline; text-decoration-skip-ink: none; }
    .qlinter-mark-warning { text-decoration: orange wavy underline; text-decoration-skip-ink: none; }
    .qlinter-mark-info    { text-decoration: #3b82f6 dotted underline; }

    /*
     * Left stripe painted on every line that carries at least one diagnostic.
     * Works in addition to the wavy character underline and stays visible on
     * whitespace-only lines, where the underline has nothing to paint over.
     */
    .qlinter-line-error   { box-shadow: inset 2px 0 0 #ef4444; }
    .qlinter-line-warning { box-shadow: inset 2px 0 0 #f59e0b; }
    .qlinter-line-info    { box-shadow: inset 2px 0 0 #3b82f6; }

    #qlinter-tooltip {
      position: fixed; z-index: 99999; max-width: 420px; padding: 8px 12px;
      border-radius: 4px; font: 13px/1.5 system-ui, sans-serif;
      color: #1f2937; background: #ffffff;
      border: 1px solid #e5e7eb;
      box-shadow: 0 2px 10px rgba(0,0,0,0.14); display: none;
      white-space: normal;
    }

    .qlinter-tt-row { display: flex; align-items: flex-start; gap: 8px; }
    .qlinter-tt-icon {
      flex: 0 0 auto; width: 14px; height: 14px; margin-top: 2px;
      border-radius: 50%; display: inline-flex; align-items: center;
      justify-content: center; font-size: 10px; font-weight: 700; color: #fff;
    }

    .qlinter-tt-icon[data-severity='error']   { background: #ef4444; }
    .qlinter-tt-icon[data-severity='warning'] { background: #f59e0b; }
    .qlinter-tt-icon[data-severity='info']    { background: #3b82f6; }
    .qlinter-tt-body { flex: 1 1 auto; }
    .qlinter-tt-rule { color: #2563eb; cursor: pointer; }
    .qlinter-tt-rule:hover { text-decoration: underline; }

    .qlinter-tt-actions {
      margin: 8px -12px -8px;
      padding: 6px 12px;
      background: #f7f8fa;
      border-top: 1px solid #e5e7eb;
      border-radius: 0 0 4px 4px;
      display: flex; gap: 12px;
    }
    .qlinter-tt-action {
      color: #2563eb; cursor: pointer; background: none;
      border: none; padding: 0; font: inherit; font-size: 12px;
    }
    .qlinter-tt-action:hover { text-decoration: underline; }
  `;

  document.head.appendChild(style);
}

const SEVERITY_CLASS: Record<Severity, string> = {
  error: 'qlinter-mark-error',
  warning: 'qlinter-mark-warning',
  info: 'qlinter-mark-info',
};

const LINE_CLASS: Record<Severity, string> = {
  error: 'qlinter-line-error',
  warning: 'qlinter-line-warning',
  info: 'qlinter-line-info',
};

const SEVERITY_RANK: Record<Severity, number> = {
  info: 0,
  warning: 1,
  error: 2,
};

const SEVERITY_GLYPH: Record<Severity, string> = {
  error: '\u00d7',
  warning: '!',
  info: 'i',
};

/** The part of a CodeMirror editor the tooltip actions write through. */
export type ScriptDoc = Pick<Editor, 'getValue' | 'getLine' | 'posFromIndex' | 'replaceRange'>;

/*
 * A diagnostic's offsets and line numbers describe the text it was linted
 * from, and linting runs debounced behind every edit. Applied to anything else
 * they land on the wrong characters, so an action on a diagnostic from an
 * older lint does nothing; the lint already pending redraws the marks.
 */
function isCurrent(doc: ScriptDoc, linted: string): boolean {
  return doc.getValue() === linted;
}

/** Applies `fix` when `doc` still holds `linted`; returns whether it did. */
export function applyFix(doc: ScriptDoc, linted: string, fix: NonNullable<Diagnostic['fix']>): boolean {
  if (!isCurrent(doc, linted)) {
    return false;
  }

  doc.replaceRange(fix.replacement, doc.posFromIndex(fix.range.start), doc.posFromIndex(fix.range.end), 'qlinter-fix');

  return true;
}

/** Adds a disable directive for `diagnostic` when `doc` still holds `linted`; returns whether it did. */
export function applyIgnore(doc: ScriptDoc, linted: string, diagnostic: Diagnostic): boolean {
  if (!isCurrent(doc, linted)) {
    return false;
  }

  const issueLineIdx = diagnostic.range.start.line - 1;
  const issueLineText = doc.getLine(issueLineIdx) ?? '';
  const indent = /^\s*/.exec(issueLineText)?.[0] ?? '';

  const prevLineIdx = issueLineIdx - 1;
  const prevLineText = prevLineIdx >= 0 ? (doc.getLine(prevLineIdx) ?? '') : '';
  const prevMatch = /^(\s*)(\/\/\s*qlinter-disable-next-line)(?:\s+(.+?))?\s*$/.exec(prevLineText);

  if (!prevMatch) {
    const directive = `${indent}// qlinter-disable-next-line ${diagnostic.ruleId}\n`;
    doc.replaceRange(directive, { line: issueLineIdx, ch: 0 }, { line: issueLineIdx, ch: 0 }, 'qlinter-ignore');
    return true;
  }

  const existingList = prevMatch[3];

  /* A bare directive already disables every rule on the line. */
  if (existingList === undefined) {
    return true;
  }

  const ids = existingList
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  if (!ids.includes(diagnostic.ruleId)) {
    ids.push(diagnostic.ruleId);
  }

  const replacement = `${prevMatch[1]}${prevMatch[2]} ${ids.join(', ')}`;
  doc.replaceRange(
    replacement,
    { line: prevLineIdx, ch: 0 },
    { line: prevLineIdx, ch: prevLineText.length },
    'qlinter-ignore',
  );

  return true;
}

export function createHighlighter(editor: Editor): {
  apply: (diagnostics: Diagnostic[], source: string) => void;
  clear: () => void;
} {
  const byMarker = new Map<TextMarker, Diagnostic>();
  const lineDecorations: { handle: LineHandle; className: string }[] = [];
  let tooltipElement: HTMLDivElement | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  let currentMarker: TextMarker | null = null;
  let linted = '';

  const clear = (): void => {
    for (const marker of byMarker.keys()) {
      marker.clear();
    }
    byMarker.clear();

    for (const { handle, className } of lineDecorations) {
      editor.removeLineClass(handle, 'wrap', className);
    }
    lineDecorations.length = 0;
    currentMarker = null;
  };

  const apply = (diagnostics: Diagnostic[], source: string): void => {
    clear();
    linted = source;

    /*
     * First collect the highest severity that touches each line, then paint
     * one stripe per line at that severity. This avoids stripe-colour churn
     * when several diagnostics overlap on the same line and keeps the
     * mental model simple: one line, one stripe, worst severity wins.
     */
    const lineSeverity = new Map<number, Severity>();

    const bump = (line: number, severity: Severity): void => {
      const current = lineSeverity.get(line);

      if (!current || SEVERITY_RANK[severity] > SEVERITY_RANK[current]) {
        lineSeverity.set(line, severity);
      }
    };

    for (const diagnostic of diagnostics) {
      const from = { line: diagnostic.range.start.line - 1, ch: diagnostic.range.start.column - 1 };
      const to = { line: diagnostic.range.end.line - 1, ch: diagnostic.range.end.column - 1 };

      if (from.line === to.line && from.ch === to.ch) {
        continue;
      }

      const marker = editor.markText(from, to, { className: SEVERITY_CLASS[diagnostic.severity] });
      byMarker.set(marker, diagnostic);

      const lastLine = to.ch === 0 ? to.line - 1 : to.line;

      for (let line = from.line; line <= lastLine; line++) {
        bump(line, diagnostic.severity);
      }
    }

    for (const [line, severity] of lineSeverity) {
      const className = LINE_CLASS[severity];
      const handle = editor.addLineClass(line, 'wrap', className);
      lineDecorations.push({ handle, className });
    }
  };

  const closeTooltip = (): void => {
    if (tooltipElement) {
      tooltipElement.style.display = 'none';
    }
    currentMarker = null;
  };

  const hideTooltip = (): void => {
    hideTimer = setTimeout(() => {
      if (tooltipElement) {
        tooltipElement.style.display = 'none';
      }
      currentMarker = null;
    }, TOOLTIP_HIDE_DELAY_MS);
  };

  const showTooltipFor = (marker: TextMarker, diagnostic: Diagnostic, mouseX: number): void => {
    clearTimeout(hideTimer);

    if (!tooltipElement) {
      tooltipElement = document.createElement('div');
      tooltipElement.id = 'qlinter-tooltip';
      tooltipElement.addEventListener('mouseenter', () => clearTimeout(hideTimer));
      tooltipElement.addEventListener('mouseleave', hideTooltip);
      document.body.appendChild(tooltipElement);
    }

    /*
     * Same marker still hovered: keep the tooltip pinned where it first
     * appeared. Re-anchoring on every mousemove would make it chase the
     * cursor.
     */
    if (currentMarker === marker && tooltipElement.style.display === 'block') {
      return;
    }

    currentMarker = marker;

    const range = marker.find();

    if (!range || !('from' in range)) {
      return;
    }

    const icon = document.createElement('span');
    icon.className = 'qlinter-tt-icon';
    icon.dataset.severity = diagnostic.severity;
    icon.textContent = SEVERITY_GLYPH[diagnostic.severity];

    const body = document.createElement('span');
    body.className = 'qlinter-tt-body';
    body.append(`${diagnostic.message} `);

    const rule = document.createElement('a');
    rule.className = 'qlinter-tt-rule';
    rule.textContent = `qlinter(${diagnostic.ruleId})`;
    rule.href = `https://github.com/MuellerConstantin/qlinter/blob/main/packages/core/docs/rules.md#${diagnostic.ruleId}`;
    rule.target = '_blank';
    rule.rel = 'noopener noreferrer';
    body.append(rule);

    const row = document.createElement('div');
    row.className = 'qlinter-tt-row';
    row.append(icon, body);

    tooltipElement.replaceChildren(row);

    const actions = document.createElement('div');
    actions.className = 'qlinter-tt-actions';

    if (diagnostic.fix) {
      const fixButton = document.createElement('button');
      fixButton.type = 'button';
      fixButton.className = 'qlinter-tt-action';
      fixButton.textContent = 'Quick Fix';
      fixButton.addEventListener('click', () => {
        applyFix(editor, linted, diagnostic.fix!);
        closeTooltip();
      });
      actions.append(fixButton);
    }

    const ignoreButton = document.createElement('button');
    ignoreButton.type = 'button';
    ignoreButton.className = 'qlinter-tt-action';
    ignoreButton.textContent = 'Ignore';
    ignoreButton.addEventListener('click', () => {
      applyIgnore(editor, linted, diagnostic);
      closeTooltip();
    });
    actions.append(ignoreButton);

    tooltipElement.append(actions);

    /*
     * Anchor X at the mouse so a horizontally scrolled-off token doesn't
     * pull the tooltip outside the editor; anchor Y at the token's bottom
     * so the tooltip sits below the offending line. Clamp horizontally to
     * the editor wrapper so an over-wide tooltip can't overflow the
     * editor on the right either.
     */
    const tokenBottom = editor.charCoords(range.from as Position, 'window').bottom;
    const wrapperRect = editor.getWrapperElement().getBoundingClientRect();

    tooltipElement.style.display = 'block';

    const ttWidth = tooltipElement.offsetWidth;
    let left = mouseX;

    if (left + ttWidth > wrapperRect.right) {
      left = wrapperRect.right - ttWidth;
    }

    if (left < wrapperRect.left) {
      left = wrapperRect.left;
    }

    tooltipElement.style.left = `${left}px`;
    tooltipElement.style.top = `${tokenBottom + 4}px`;
  };

  const onMouseMove = (event: MouseEvent): void => {
    const pos = editor.coordsChar({ left: event.clientX, top: event.clientY }, 'window');

    for (const marker of editor.findMarksAt(pos)) {
      const diagnostic = byMarker.get(marker);

      if (diagnostic) {
        showTooltipFor(marker, diagnostic, event.clientX);
        return;
      }
    }

    hideTooltip();
  };

  editor.getWrapperElement().addEventListener('mousemove', onMouseMove);

  return { apply, clear };
}
