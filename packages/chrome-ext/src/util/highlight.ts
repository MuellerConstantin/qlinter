import type { Editor, LineHandle, TextMarker, Position } from 'codemirror';
import type { Diagnostic, Severity } from '@qlinter/core';
import { SEVERITY_ICON } from './icons';

const TOOLTIP_HIDE_DELAY_MS = 200;
// Long enough that a pointer passing over marked code on its way to a click opens nothing.
const TOOLTIP_SHOW_DELAY_MS = 500;

const SEVERITY_CLASS: Record<Severity, string> = {
  error: 'qlinter-mark-error',
  warning: 'qlinter-mark-warning',
  info: 'qlinter-mark-info',
};

const MARK_SELECTOR = Object.values(SEVERITY_CLASS)
  .map((className) => `.${className}`)
  .join(', ');

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

const SEVERITY_TEXT: Record<Severity, string> = {
  error: 'ql:text-error',
  warning: 'ql:text-warning',
  info: 'ql:text-info',
};

const TOOLTIP_ACTION_CLASS =
  'ql:p-0 ql:border-0 ql:bg-transparent ql:font-[inherit] ql:text-xs ql:text-accent-text ql:cursor-pointer ql:hover:underline';

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
  let showTimer: ReturnType<typeof setTimeout> | undefined;
  let currentMarker: TextMarker | null = null;
  let linted = '';

  const closeTooltip = (): void => {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);

    if (tooltipElement) {
      tooltipElement.style.display = 'none';
    }
    currentMarker = null;
  };

  const hideTooltip = (): void => {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    hideTimer = setTimeout(closeTooltip, TOOLTIP_HIDE_DELAY_MS);
  };

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

  /*
   * Outside an operation CodeMirror runs a full update for every single
   * markText and line-class call, which blocks the page for hundreds of
   * milliseconds on a script with a few thousand findings.
   */
  const apply = (diagnostics: Diagnostic[], source: string): void => {
    // The open tooltip belongs to a marker this repaint is about to remove.
    closeTooltip();
    editor.operation(() => paint(diagnostics, source));
  };

  const paint = (diagnostics: Diagnostic[], source: string): void => {
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

  const showTooltipFor = (marker: TextMarker, diagnostic: Diagnostic, mouseX: number): void => {
    clearTimeout(hideTimer);

    if (!tooltipElement) {
      tooltipElement = document.createElement('div');
      tooltipElement.className =
        'ql:fixed ql:z-[99999] ql:box-border ql:max-w-120 ql:overflow-hidden ql:rounded-md ql:border ql:border-input-border ql:bg-background ql:font-sans ql:text-sm ql:text-foreground ql:shadow-[0_0_8px_2px_rgb(0_0_0/0.16)] ql:whitespace-normal';
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
    icon.className = `ql:flex-none ql:size-4 ql:mt-0.5 ${SEVERITY_TEXT[diagnostic.severity]}`;
    icon.innerHTML = SEVERITY_ICON[diagnostic.severity];

    const body = document.createElement('span');
    body.className = 'ql:flex-auto';
    body.append(`${diagnostic.message} `);

    const source = document.createElement('span');
    source.className = 'ql:text-muted';

    const rule = document.createElement('a');
    rule.className = 'ql:text-accent-text ql:no-underline ql:cursor-pointer ql:hover:underline';
    rule.textContent = diagnostic.ruleId;
    rule.href = `https://github.com/MuellerConstantin/qlinter/blob/main/packages/core/docs/rules.md#${diagnostic.ruleId}`;
    rule.target = '_blank';
    rule.rel = 'noopener noreferrer';
    source.append('qlinter(', rule, ')');
    body.append(source);

    const row = document.createElement('div');
    row.className = 'ql:flex ql:items-start ql:gap-2 ql:px-2.5 ql:py-2';
    row.append(icon, body);

    tooltipElement.replaceChildren(row);

    const actions = document.createElement('div');
    actions.className = 'ql:flex ql:gap-4 ql:px-2.5 ql:py-1 ql:bg-surface ql:border-t ql:border-border';

    if (diagnostic.fix) {
      const fixButton = document.createElement('button');
      fixButton.type = 'button';
      fixButton.className = TOOLTIP_ACTION_CLASS;
      fixButton.textContent = 'Quick Fix';
      fixButton.addEventListener('click', () => {
        applyFix(editor, linted, diagnostic.fix!);
        closeTooltip();
      });
      actions.append(fixButton);
    }

    const ignoreButton = document.createElement('button');
    ignoreButton.type = 'button';
    ignoreButton.className = TOOLTIP_ACTION_CLASS;
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

  /*
   * coordsChar snaps a point past a line's end back onto that line, so a hit
   * is decided by what lies under the pointer: underlined text, or an empty
   * line, which has nothing to underline and counts whole.
   */
  const hoveredMarkers = (event: MouseEvent): TextMarker[] => {
    if (!(event.target instanceof Element)) {
      return [];
    }

    const pos = editor.coordsChar({ left: event.clientX, top: event.clientY }, 'window');

    if (event.target.closest(MARK_SELECTOR) !== null) {
      return editor.findMarksAt(pos);
    }

    if (event.target.closest('.CodeMirror-line') === null || editor.getLine(pos.line) !== '') {
      return [];
    }

    // Only a finding that runs past this line's break covers it; one ending right here belongs to the line above.
    return editor.findMarksAt(pos).filter((marker) => {
      const range = marker.find();

      return range !== undefined && 'to' in range && range.to.line > pos.line;
    });
  };

  const onMouseMove = (event: MouseEvent): void => {
    // A held button means a selection is being dragged.
    if (event.buttons !== 0) {
      return;
    }

    for (const marker of hoveredMarkers(event)) {
      const diagnostic = byMarker.get(marker);

      if (!diagnostic) {
        continue;
      }

      // Once a tooltip is open, moving to a neighbouring marker swaps it without a second wait.
      if (tooltipElement?.style.display === 'block') {
        showTooltipFor(marker, diagnostic, event.clientX);
        return;
      }

      // Restarted on every move, so the tooltip opens only once the pointer rests.
      clearTimeout(showTimer);
      showTimer = setTimeout(() => showTooltipFor(marker, diagnostic, event.clientX), TOOLTIP_SHOW_DELAY_MS);
      return;
    }

    hideTooltip();
  };

  const wrapper = editor.getWrapperElement();
  wrapper.addEventListener('mousemove', onMouseMove);
  wrapper.addEventListener('mouseleave', hideTooltip);
  editor.on('mousedown', closeTooltip);
  editor.on('keydown', closeTooltip);
  // The tooltip is fixed to the window, so after a scroll it would cover unrelated code.
  editor.on('scroll', closeTooltip);

  return { apply, clear };
}
