import { tokenMatcher, type IToken } from 'chevrotain';
import { blockCloseToken, blockOpenToken, keywordToken } from '../../lexer.js';

/**
 * What a statement-start line does to the block structure around it.
 * `mid-flat` is `Else`/`ElseIf` and `mid-case` is `Case`/`Default`: both end
 * the body above them and start the one below, without closing the block.
 */
export type LineKind = 'open' | 'close' | 'mid-flat' | 'mid-case' | 'regular';

/*
 * Which words open and close a block comes from the lexer's token categories.
 * The `else`/`case` distinctions stay on the image: they are not about what the
 * word is but about how a line starting with it bounds a body, which is the one
 * thing every rule reading block structure has to agree on.
 */
export function classifyBlockLine(lineTokens: IToken[]): LineKind {
  const first = lineTokens[0];

  if (!tokenMatcher(first, keywordToken)) {
    return 'regular';
  }

  if (tokenMatcher(first, blockCloseToken)) {
    return 'close';
  }

  const lower = first.image.toLowerCase();

  if (lower === 'else' || lower === 'elseif') {
    return 'mid-flat';
  }

  if (lower === 'case' || lower === 'default') {
    return 'mid-case';
  }

  if (tokenMatcher(first, blockOpenToken)) {
    return 'open';
  }

  return 'regular';
}

/** True when a body begins below a line of this kind. */
export function opensBody(kind: LineKind): boolean {
  return kind === 'open' || kind === 'mid-flat' || kind === 'mid-case';
}

/** True when a body ends above a line of this kind. */
export function closesBody(kind: LineKind): boolean {
  return kind === 'close' || kind === 'mid-flat' || kind === 'mid-case';
}
