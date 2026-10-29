import type { Severity } from '@qlinter/core';

const SVG_OPEN =
  '<svg viewBox="0 0 16 16" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';

/** Outline icons in the manner of VS Code's codicons; they take the colour of the element they sit in. */
export const SEVERITY_ICON: Record<Severity, string> = {
  error: `${SVG_OPEN}<circle cx="8" cy="8" r="6.3"/><path d="M5.9 5.9l4.2 4.2M10.1 5.9l-4.2 4.2"/></svg>`,
  warning: `${SVG_OPEN}<path d="M8 1.9l6.6 11.7H1.4z"/><path d="M8 6.3v3.3M8 11.5v.1"/></svg>`,
  info: `${SVG_OPEN}<circle cx="8" cy="8" r="6.3"/><path d="M8 7.3v3.9M8 4.9v.1"/></svg>`,
};
