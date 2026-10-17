/** Rule reference whose sections are headed by rule id, so `#<rule id>` lands on one. */
const DOCS_URL = 'https://github.com/MuellerConstantin/qlinter/blob/main/packages/core/docs/rules.md';

/** Where `ruleId` is documented in the rule reference. */
export function ruleDocsUrl(ruleId: string): string {
  return `${DOCS_URL}#${ruleId}`;
}
