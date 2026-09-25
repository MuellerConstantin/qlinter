# Survey

The fixtures hold the constructs somebody here thought of. The survey runs the
same invariants over scripts nobody here wrote, to find the ones nobody did.

It is a measurement, not a test. It never fails on a finding, it is not part of
`npm test` or CI — vitest only collects `*.test.ts` — and its findings are leads,
not regressions.

## Running it

```sh
npm run survey -w @qlinter/core -- <corpus-dir> [report.json]
```

Every `.qvs` below `<corpus-dir>` is read the way the CLI reads it: as UTF-8, a
byte order mark dropped, a file that is not UTF-8 skipped. The summary goes to
the terminal; the full report to `<corpus-dir>-survey.json`, beside the corpus
rather than inside the repo, because it quotes the scripts.

| Check              | A finding means                                                          |
| ------------------ | ------------------------------------------------------------------------ |
| `input-lex-error`  | the lexer skips a character of the script as it arrived                  |
| `new-lex-error`    | formatting leaves the lexer a character it could not read before         |
| `unsafe-fix`       | a fix reaches over a comment or a character the lexer skipped            |
| `rule-clash`       | two rules rewrite one span into different things — a line break against a space excepted, which the break wins by design |
| `order-dependence` | the output depends on the order the rules are configured in              |
| `bare-lf`          | a CRLF script comes out with a bare LF                                   |
| `second-pass`      | a second `format` still changes something; `throws` if it never settles |
| `not-utf8`         | the file is not valid UTF-8, so the CLI skips it                         |

## Growing the corpus

```sh
npm run survey:fetch -w @qlinter/core -- <corpus-dir> [--max 100] [--per-repo 5] [--query "LOAD extension:qvs"]
```

Downloads `.qvs` files found by GitHub code search into `<corpus-dir>`, numbered
on from the highest number already there, byte for byte. A file whose content
the corpus already holds is skipped, and at most `--per-repo` files come from one
repository across all runs, so no single author's style dominates. Where each
file came from is appended to `github-sources.jsonl` beside them.

Code search needs authentication: `GITHUB_TOKEN`, or a logged-in `gh`. One query
yields at most 1000 results; another `--query` reaches further.

## Rules

- **The corpus stays outside the repo**, and so do the reports. Scripts from
  customers are anonymized before they join it.
- **A finding is reduced before anything is fixed.** Cut the script down to the
  few lines that still show the problem, rename every table, field and variable
  to something neutral (`Orders`, `OrderId`, `vPath`), and pin it in the
  fixture of the rule that should have handled it. The fixture is what guards
  the fix from then on; the corpus only found it.
- **Never copy foreign code into the repo verbatim.** The reduced case is ours;
  the script it came from is not.
- **A fixture is valid Qlik.** A script that is broken in its own right —
  truncated, or a test of what an editor highlights — is a lead for robustness at
  most, never a fixture.
- **An `input-lex-error` in an unverified script is checked first.** A script
  from GitHub may simply be wrong. Look the construct up in the
  [Qlik Sense help](https://help.qlik.com/en-US/sense/) before teaching the
  lexer anything.
- **What the checks cannot see still needs looking at.** They catch crashes,
  clashes and unreadable output — not a rewrite that is well-formed but means
  something else, such as a changed `Set` value or SQL text. When a finding
  leads into a construct, check what formatting does to its content by hand.
