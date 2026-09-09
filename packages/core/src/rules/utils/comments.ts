const LINE_BANNER = /^\/+$/;

/*
 * A line comment whose body is nothing but further slashes: the divider a
 * script draws between its stages, and content in its own right rather than
 * prose. Two rules have to read it the same way — one accepts it as written,
 * the other declines to fold it into something else — so the shape is decided
 * here once.
 */
export function isBannerLineComment(image: string): boolean {
  return LINE_BANNER.test(image.slice(2));
}

/*
 * A block comment carrying `bodies`, one per line, on the ' *' rail one column
 * right of the opening slash. Blank bodies at either edge are padding rather
 * than content and are dropped.
 *
 * This is the canonical shape of a multi-line block comment. Building one and
 * re-normalizing one are the same question asked from two directions, so both
 * answers come from here and the result is idempotent: feeding the bodies of
 * this function's output back into it returns the output unchanged.
 */
export function blockCommentFrom(bodies: readonly string[], indent: string, eol: string): string {
  const prefix = `${indent} `;
  const trimmed = [...bodies];

  while (trimmed.length > 0 && trimmed[0] === '') {
    trimmed.shift();
  }

  while (trimmed.length > 0 && trimmed[trimmed.length - 1] === '') {
    trimmed.pop();
  }

  if (trimmed.length === 0) {
    return `/*${eol}${prefix}*/`;
  }

  const middle = trimmed.map((body) => (body === '' ? `${prefix}*` : `${prefix}* ${body}`));

  return `/*${eol}${middle.join(eol)}${eol}${prefix}*/`;
}
