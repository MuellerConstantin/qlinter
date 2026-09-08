# Conformance Score

The conformance score is a single number from 0 to 100 that says how much of a script
already follows the configured style. It exists to give a team a shared sense of
direction during adoption — a value you can look at, act on, and watch move — without
reading through every finding.

```
score = 100 × (lines with no finding ÷ all lines)
```

The result is rounded **down**, so 100 is reached only when every single line is clean.
A script with one flagged line in five hundred reads as 99, never as 100.

## What counts

- **Every line counts**, including blank lines and comment-only lines. Rules apply to
  those lines too — comment spacing, blank-line placement, trailing whitespace — so
  leaving them out of the total would make their violations invisible to the score.
- **Every enabled rule counts the same.** A line is conforming or it is not; the score
  does not weigh an `error` against a `warning`. Severity decides how a finding is
  presented, not how much it costs.
- **A line counts once**, however many findings land on it. One badly written line
  cannot drag the score down further than any other line.
- **A finding spanning several lines counts against the line it starts on**, the same
  line the CLI and the editor integrations report it at.

## Scripts too short to score

Below ten lines no score is produced (`conformanceScore` returns `null`). In an
eight-line script a single finding moves the value by twelve points, so the number would
report the script's length rather than its style. Show the findings instead.

## How to read it

**The measurement is a fact; the judgement is not.** "84 % of your lines are conforming"
is a plain statement about a file. Whether 84 is good is a question for your team, not
for the linter — pick a target together and treat it as an agreement, not a gate.

**Only comparable under one configuration.** Two scripts linted with different rules or
different rule options are measuring different things. Within a team on a shared config,
the number orders scripts sensibly.

**It measures style, not correctness.** The score says nothing about whether a script
loads the right data, or loads at all. It is a conformance number, and a low one is a
reason to reformat, never a reason to distrust the logic.

## Usage

```ts
import { lint, conformanceScore, recommended } from '@qlinter/core';

const diagnostics = lint(source, recommended);
const score = conformanceScore(source, diagnostics);

console.log(score === null ? 'too short to score' : `${score}%`);
```

`conformanceScore` takes the diagnostics rather than producing them, so a host that has
already linted does not pay for a second run. Pass the diagnostics from the same source
string and the same configuration — anything else scores one script against another
script's findings.

Core returns the number and nothing else. How it is displayed — a percentage, a badge, a
colour, a threshold — is each binding's decision.
