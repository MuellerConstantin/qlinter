import type { Rule, Finding } from '../types.js';
import { tokenRange } from '../token.js';
import { isKeyword, isOpenParen } from './utils/tokens.js';

/*
 * Each of these prefixes takes an optional `(tablename)` straight after it and
 * otherwise targets the last table loaded before the statement.
 *
 * @see {@link https://help.qlik.com/en-US/sense/November2025/Subsystems/Hub/Content/Sense_Hub/Scripting/ScriptPrefixes/concatenate.htm | Concatenate}
 * @see {@link https://help.qlik.com/en-US/sense/November2025/Subsystems/Hub/Content/Sense_Hub/Scripting/ScriptPrefixes/Join.htm | Join}
 * @see {@link https://help.qlik.com/en-US/sense/November2025/Subsystems/Hub/Content/Sense_Hub/Scripting/ScriptPrefixes/Keep.htm | Keep}
 */
const PREFIXES = ['concatenate', 'join', 'keep'];

export const explicitTargetTable: Rule<undefined, 'explicit-target-table'> = {
  id: 'explicit-target-table',
  defaultSeverity: 'warning',
  defaultOptions: undefined,
  check: ({ tokens }) => {
    const out: Finding[] = [];

    for (const [index, token] of tokens.entries()) {
      if (!PREFIXES.some((prefix) => isKeyword(token, prefix))) {
        continue;
      }

      const next = tokens[index + 1];

      if (next !== undefined && isOpenParen(next)) {
        continue;
      }

      out.push({
        range: tokenRange(token),
        message: `'${token.image}' names no target table, so it applies to whichever table was loaded last. Name it, e.g. '${token.image} (Orders)'.`,
      });
    }

    return out;
  },
};
