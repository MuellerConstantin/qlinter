import { tokenRange } from '../token.js';
import type { Fix, Finding, Rule } from '../types.js';
import { classifyBlockLine, closesBody, opensBody } from './utils/blocks.js';
import { detectLineEnding, isBlankLine, splitLines, type LineSpan } from './utils/lines.js';
import { collectStatementSpans } from './utils/statements.js';

export const BLOCK_PADDING_STYLES = ['always', 'never'] as const;

export type BlockPaddingStyle = (typeof BLOCK_PADDING_STYLES)[number];

export interface PaddedBlocksOptions {
  padding: BlockPaddingStyle;
}

/** First line at or below `from` that holds something. Comments count as content. */
function contentBelow(source: string, spans: LineSpan[], from: number): number {
  let line = from;

  while (line <= spans.length && isBlankLine(source, spans[line - 1])) {
    line++;
  }

  return line;
}

/** Last line at or above `from` that holds something. Comments count as content. */
function contentAbove(source: string, spans: LineSpan[], from: number): number {
  let line = from;

  while (line >= 1 && isBlankLine(source, spans[line - 1])) {
    line--;
  }

  return line;
}

function insertBefore(spans: LineSpan[], line: number, ending: string): Fix {
  const offset = spans[line - 1].start;

  return { range: { start: offset, end: offset }, replacement: ending };
}

function deleteLines(spans: LineSpan[], from: number, to: number): Fix {
  const first = spans[from - 1];
  const last = spans[to - 1];

  return { range: { start: first.start, end: last.end + last.terminator.length }, replacement: '' };
}

export const paddedBlocks: Rule<PaddedBlocksOptions, 'padded-blocks'> = {
  id: 'padded-blocks',
  defaultSeverity: 'warning',
  defaultOptions: { padding: 'always' },
  options: { padding: { type: 'enum', values: BLOCK_PADDING_STYLES } },
  check: ({ source, tokens }, { padding }) => {
    const out: Finding[] = [];
    const spans = splitLines(source);
    const statements = collectStatementSpans(tokens);
    const ending = detectLineEnding(source);
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
        const body = contentBelow(source, spans, above.lastLine + 1);
        const padded = body > above.lastLine + 1;

        if (padded === wanted) {
          continue;
        }

        out.push({
          range: tokenRange(above.first),
          message: wanted
            ? 'Block body should start with a blank line.'
            : 'Block body should not start with a blank line.',
          fix: wanted ? insertBefore(spans, body, ending) : deleteLines(spans, above.lastLine + 1, body - 1),
        });

        continue;
      }

      const body = contentAbove(source, spans, below.line - 1);
      const padded = body < below.line - 1;

      if (padded === wanted) {
        continue;
      }

      out.push({
        range: tokenRange(below.first),
        message: wanted ? 'Block body should end with a blank line.' : 'Block body should not end with a blank line.',
        fix: wanted ? insertBefore(spans, below.line, ending) : deleteLines(spans, body + 1, below.line - 1),
      });
    }

    return out;
  },
};
