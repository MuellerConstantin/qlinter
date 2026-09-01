import { tokenRange } from '../token.js';
import type { Finding, Rule } from '../types.js';
import { classifyBlockLine, closesBody } from './utils/blocks.js';
import {
  commentOnlyLines,
  detectLineEnding,
  insertLineBefore,
  introductionStart,
  precededByBlankLine,
  splitLines,
} from './utils/lines.js';
import { collectStatementSpans, opensTable } from './utils/statements.js';

export const blankLineAfterBlock: Rule<undefined, 'blank-line-after-block'> = {
  id: 'blank-line-after-block',
  defaultSeverity: 'warning',
  defaultOptions: undefined,
  check: ({ source, tokens, comments }) => {
    const out: Finding[] = [];
    const spans = splitLines(source);
    const commented = commentOnlyLines(comments, tokens);
    const statements = collectStatementSpans(tokens);

    for (let index = 0; index < statements.length; index++) {
      const statement = statements[index];
      const next = statements[index + 1];

      if (classifyBlockLine(statement.tokens) !== 'close' || next === undefined) {
        continue;
      }

      const kind = classifyBlockLine(next.tokens);

      /* A closer meeting another is the end of a nest, not the end of a section. */
      if (closesBody(kind)) {
        continue;
      }

      /*
       * What follows opens a section of its own, and the gap above it is asked
       * for there. Claiming it here too would fill the same gap twice.
       */
      if (kind === 'open' || opensTable(next.tokens)) {
        continue;
      }

      const top = introductionStart(commented, next.line);

      if (precededByBlankLine(source, spans, top)) {
        continue;
      }

      out.push({
        range: tokenRange(statement.first),
        message: 'A block should be followed by a blank line.',
        fix: insertLineBefore(spans, top, detectLineEnding(source)),
      });
    }

    return out;
  },
};
