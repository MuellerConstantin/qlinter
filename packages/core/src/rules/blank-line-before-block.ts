import { tokenRange } from '../token.js';
import type { Finding, Rule } from '../types.js';
import { classifyBlockLine, opensBody } from './utils/blocks.js';
import {
  commentOnlyLines,
  detectLineEnding,
  insertLineBefore,
  introductionStart,
  precededByBlankLine,
  splitLines,
} from './utils/lines.js';
import { collectStatementSpans } from './utils/statements.js';

export const blankLineBeforeBlock: Rule<undefined, 'blank-line-before-block'> = {
  id: 'blank-line-before-block',
  defaultSeverity: 'warning',
  defaultOptions: undefined,
  check: ({ source, tokens, comments }) => {
    const out: Finding[] = [];
    const spans = splitLines(source);
    const commented = commentOnlyLines(comments, tokens);
    const statements = collectStatementSpans(tokens);

    for (let index = 0; index < statements.length; index++) {
      const statement = statements[index];
      const previous = statements[index - 1];

      /*
       * Only a header that opens a block of its own. `Else` and `Case` bound a
       * body from inside one, and the gap above them belongs to that body.
       */
      if (classifyBlockLine(statement.tokens) !== 'open') {
        continue;
      }

      const top = introductionStart(commented, statement.line);

      if (precededByBlankLine(source, spans, top)) {
        continue;
      }

      /* The first statement of a block needs no gap between itself and the header it belongs to. */
      if (previous !== undefined && opensBody(classifyBlockLine(previous.tokens))) {
        continue;
      }

      out.push({
        range: tokenRange(statement.first),
        message: `A '${statement.first.image}' block should be preceded by a blank line.`,
        fix: insertLineBefore(spans, top, detectLineEnding(source)),
      });
    }

    return out;
  },
};
