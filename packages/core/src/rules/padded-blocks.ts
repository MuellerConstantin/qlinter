import type { IToken } from 'chevrotain';
import { tokenRange } from '../token.js';
import type { Finding, Rule } from '../types.js';
import { classifyBlockLine, closesBody, opensBody } from './utils/blocks.js';
import { deleteLineRange, insertLineBefore, isBlankLine } from './utils/lines.js';
import type { LineSpan } from '../lines.js';
import { collectStatementSpans } from './utils/statements.js';

export const BLOCK_PADDING_STYLES = ['always', 'never'] as const;

export type BlockPaddingStyle = (typeof BLOCK_PADDING_STYLES)[number];

export interface PaddedBlocksOptions {
  padding: BlockPaddingStyle;
}

/** First line at or below `from` that holds something. Comments count as content. */
function contentBelow(whitespaces: IToken[], spans: LineSpan[], from: number): number {
  let line = from;

  while (line <= spans.length && isBlankLine(whitespaces, spans[line - 1])) {
    line++;
  }

  return line;
}

/** Last line at or above `from` that holds something. Comments count as content. */
function contentAbove(whitespaces: IToken[], spans: LineSpan[], from: number): number {
  let line = from;

  while (line >= 1 && isBlankLine(whitespaces, spans[line - 1])) {
    line--;
  }

  return line;
}

export const paddedBlocks: Rule<PaddedBlocksOptions, 'padded-blocks'> = {
  id: 'padded-blocks',
  defaultSeverity: 'warning',
  defaultOptions: { padding: 'always' },
  options: { padding: { type: 'enum', values: BLOCK_PADDING_STYLES } },
  check: ({ tokens, whitespaces, lines: spans, lineEnding }, { padding }) => {
    const out: Finding[] = [];
    const statements = collectStatementSpans(tokens);
    const ending = lineEnding;
    const wanted = padding === 'always';

    for (let index = 1; index < statements.length; index++) {
      const above = statements[index - 1];
      const below = statements[index];
      const opening = opensBody(classifyBlockLine(above.tokens));
      const closing = closesBody(classifyBlockLine(below.tokens));

      /* Both at once means the two lines meet with no body between them — nothing to pad. */
      if (opening === closing) {
        continue;
      }

      if (opening) {
        const body = contentBelow(whitespaces, spans, above.lastLine + 1);
        const padded = body > above.lastLine + 1;

        if (padded === wanted) {
          continue;
        }

        out.push({
          range: tokenRange(above.first),
          message: wanted
            ? 'Block body should start with a blank line.'
            : 'Block body should not start with a blank line.',
          fix: wanted ? insertLineBefore(spans, body, ending) : deleteLineRange(spans, above.lastLine + 1, body - 1),
        });

        continue;
      }

      const body = contentAbove(whitespaces, spans, below.line - 1);
      const padded = body < below.line - 1;

      if (padded === wanted) {
        continue;
      }

      out.push({
        range: tokenRange(below.first),
        message: wanted ? 'Block body should end with a blank line.' : 'Block body should not end with a blank line.',
        fix: wanted ? insertLineBefore(spans, below.line, ending) : deleteLineRange(spans, body + 1, below.line - 1),
      });
    }

    return out;
  },
};
