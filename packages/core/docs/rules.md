# Rules Reference

| Rule                                                  | Description                                                      |
| :---------------------------------------------------- | :--------------------------------------------------------------- |
| [block-comment-stars](#block-comment-stars)           | Align multi-line block comments with a leading ` *` rail.        |
| [block-indent](#block-indent)                         | Enforce consistent indentation for Qlik block constructs.        |
| [table-label-brackets](#table-label-brackets)         | Require table labels to be enclosed in brackets.                 |
| [builtin-function-case](#builtin-function-case)       | Enforce canonical casing for Qlik built-in functions.            |
| [builtin-keyword-case](#builtin-keyword-case)         | Enforce canonical casing for Qlik keywords.                      |
| [comma-space](#comma-space)                           | Require exactly one space after a comma when followed by code.   |
| [comment-space](#comment-space)                       | Require a space after `//` and inside `/* */`.                   |
| [continuation-indent](#continuation-indent)           | Indent continuation lines one level per open parenthesis.        |
| [eol-last](#eol-last)                                 | Require the file to end with exactly one newline.                |
| [include-no-spaces](#include-no-spaces)               | Disallow spaces around the `=` of an include expansion.          |
| [inline-comment-space](#inline-comment-space)         | Require exactly one space between code and a trailing comment.   |
| [load-clause-newline](#load-clause-newline)           | Require each LOAD clause keyword to start its own line.          |
| [load-field-per-line](#load-field-per-line)           | Require each LOAD field to start on its own line.                |
| [load-indent](#load-indent)                           | Indent LOAD fields one step deeper than the LOAD keyword.        |
| [max-line-length](#max-line-length)                   | Limit how long a single line of script may be.                   |
| [multiline-call](#multiline-call)                     | Break overlong single-line function calls across multiple lines. |
| [no-legacy-path-variables](#no-legacy-path-variables) | Disallow legacy QlikView-era path system variables.              |
| [no-multiple-empty-lines](#no-multiple-empty-lines)   | Limit how many consecutive empty lines may appear.               |
| [one-statement-per-line](#one-statement-per-line)     | Require each statement to start on its own line.                 |
| [operator-spacing](#operator-spacing)                 | Require exactly one space around binary operators.               |
| [paren-spacing](#paren-spacing)                       | Disallow function-call and inner-padding spaces around parens.   |
| [trailing-whitespace](#trailing-whitespace)           | Disallow whitespace at the end of a line.                        |
| [variable-case](#variable-case)                       | Enforce a consistent casing style for user-defined vars.         |
| [variable-charset](#variable-charset)                 | Restrict user-defined variables to a safe identifier charset.    |

---

## block-comment-stars

Align every line of a multi-line block comment with a leading ` *`.

### Rule Details

A `/* … */` block that spans more than one line is structurally a doc-style
comment — the kind that benefits from a uniform vertical rail down its left edge
so the body reads as one connected paragraph. Without a convention, multi-line
blocks drift between several styles in the same script (flush-left content, no
stars at all, randomly indented stars, the closing `*/` glued to the end of a
content line), and a quick scan can no longer tell where the comment ends.

The rule walks every block comment and, when it spans multiple lines, normalises
it to a single JSDoc-like shape:

- `/*` and `*/` each occupy their own line.
- Every line in between starts with a ` *` whose `*` is one column to the right
  of the opening `/` — so middle lines and the closing `*/` share the same
  prefix and form a clean vertical rail.
- A single space follows the leading `*` before any content. Blank middle lines
  collapse to a bare ` *`.

The rule only triggers when `/*` sits at the start of its line (preceded by
whitespace only). Block comments mid-line (`LET x = 1; /* note */ y`) and
single-line block comments (`/* foo */`) are left alone — both common idioms
that the doc-style alignment does not apply to.

The autofix rewrites the whole comment in one pass: moves content off the
opening and closing lines, inserts missing stars, realigns misaligned ones, and
preserves the source's existing indentation and line-ending style (LF / CRLF).
The fix is idempotent.

This rule is complementary to [comment-space](#comment-space): `comment-space`
governs the whitespace immediately after `//`, after `/*`, and before `*/`;
`block-comment-stars` governs the structure of the lines in between for
multi-line blocks.

Examples of **incorrect** code for this rule:

```qlik
/*
hello
world
*/

/*
* misaligned star
* second line
*/

/*
 * content sits on the closing line */
```

Examples of **correct** code for this rule:

```qlik
/*
 * hello
 * world
 */

/* single-line block comments are untouched */

/*
 * blank middle lines stay as a bare ' *':
 *
 * second paragraph
 */
```

### Options

This rule has no options. The JSDoc-like shape is intentionally fixed — making
it configurable would invite every project to redefine "well-formatted block
comment", which defeats the point of an opinionated linter.

---

## block-indent

Enforce consistent indentation for Qlik block constructs (`Sub`, `If`, `For`,
`Do`, `Switch`).

### Rule Details

Qlik does not require indentation — block structure is defined by keywords
(`Sub`/`End Sub`, `If`/`End If`, `For`/`Next`, `Do`/`Loop`, `Switch`/`End Switch`),
not by whitespace. Without a convention, scripts mix flat and indented styles and
nested blocks become hard to scan. The rule walks the token stream, tracks the
open block depth, and flags every statement whose leading whitespace does not
match the expected level.

The rule only checks statement-start lines. Multi-line continuations — an `If`
header that spans several lines before `Then`, a `LOAD` body broken across
fields, a long `WHERE` clause — are intentionally **not** enforced; their layout
is a separate concern. This keeps the rule focused on block structure and out of
the way of formatting choices for long statements.

Indentation rules for the supported constructs:

- `Sub … End Sub`, `If … End If`, `For … Next`, `Do … Loop`, `Switch … End Switch`
  open a new block; the body is indented one level deeper.
- `Else` / `ElseIf` align with the surrounding `If`.
- `Case` / `Default` are indented one level **inside** the surrounding `Switch`;
  their bodies are indented one level deeper again.

A line is checked against the _exact_ expected indent string, not just its
width: a line indented with four tabs where four spaces are expected (or a
tab/space mix that happens to add up to the right column) is flagged, so the
configured `style` is enforced on its own — the rule does not rely on any
other rule to catch the wrong indent character.

The autofix replaces the leading whitespace of each offending line with the
expected indent. Lines whose first token is part of a function call named `If(…)`
are not treated as block openers — the lexer distinguishes the keyword from the
built-in function.

Examples of **incorrect** code for this rule (default `style: 'space'`, `size: 4`, shown with `·` for a space):

```qlik
Sub greet
Trace hello;
········End Sub

If vYear = 2026 Then
········LET vMsg = 'this year';
····Else
············LET vMsg = 'other';
End If

Switch vMode
Case 'A'
Trace mode A;
End Switch
```

Examples of **correct** code for this rule:

```qlik
Sub greet
····Trace hello;
End Sub

If vYear = 2026 Then
····LET vMsg = 'this year';
ElseIf vYear < 2026 Then
····LET vMsg = 'past';
Else
····LET vMsg = 'other';
End If

Switch vMode
····Case 'A'
········Trace mode A;
····Default
········Trace unknown;
End Switch
```

### Options

| Option  | Type               | Default   | Description                             |
| :------ | :----------------- | :-------- | :-------------------------------------- |
| `size`  | `number`           | `4`       | Number of indent units per block level. |
| `style` | `'space' \| 'tab'` | `'space'` | Character used for one indent unit.     |

- `size` — how many `style` units make up one indent level. With the default
  `style: 'space'`, `size: 4` is the qlinter default and matches how the Qlik
  Sense Data Load Editor renders a level (four columns wide).
- `style: 'space'` — indent with ASCII spaces (the default). `size` counts
  spaces per level; the default is `4`.
- `style: 'tab'` — indent with literal tab characters. `size` then counts tabs
  per level; almost every team that picks `'tab'` keeps `size: 1`. The display
  width of a tab is the editor's concern, not the linter's — the rule only
  inserts the literal `\t` byte.

Example configuration (override the default to tab-based indentation):

```ts
import { lint } from '@qlinter/core';

lint(source, {
  rules: {
    'block-indent': ['warning', { style: 'tab', size: 1 }],
  },
});
```

With `{ style: 'tab', size: 1 }`, the following is **correct** (`→` marks a tab):

```qlik
Sub greet
→Trace hello;
End Sub
```

---

## table-label-brackets

Require table labels to be enclosed in square brackets.

### Rule Details

Qlik allows table labels to be written with or without brackets. Unbracketed
labels break as soon as the name contains a space, a reserved word, or a special
character, and they read inconsistently against the bracketed form that `RESIDENT`
and field references already use. Requiring brackets everywhere removes that class
of error and keeps label syntax uniform across the script.

Examples of **incorrect** code for this rule:

```qlik
TableA:
Load
    Field1,
    Field2
Resident [TableA];
```

Examples of **correct** code for this rule:

```qlik
[TableA]:
Load
    Field1,
    Field2
Resident [TableA];
```

### Options

This rule has no options.

---

## builtin-function-case

Enforce the canonical casing for Qlik built-in functions.

### Rule Details

Qlik resolves built-in function names case-insensitively, so `sum`, `Sum`, and
`SUM` all work. That tolerance lets casing drift across a script and between
authors, which obscures the line between built-in functions and user-defined
fields or variables. Pinning each function to its canonical spelling (as listed
in the Qlik documentation) keeps calls visually consistent and makes built-ins
easy to distinguish from surrounding identifiers.

Examples of **incorrect** code for this rule:

```qlik
[Totals]:
Load
    sum(Value) as Total
Resident [TableA];
```

Examples of **correct** code for this rule:

```qlik
[Totals]:
Load
    Sum(Value) as Total
Resident [TableA];
```

### Options

| Option  | Type                             | Default    | Description                                |
| :------ | :------------------------------- | :--------- | :----------------------------------------- |
| `style` | `'pascal' \| 'lower' \| 'upper'` | `'pascal'` | Casing applied to built-in function names. |

- `'pascal'` — use the canonical spelling from the Qlik documentation (e.g. `Sum`, `Date`, `RangeSum`).
- `'lower'` — lowercase the canonical spelling (e.g. `sum`, `date`, `rangesum`).
- `'upper'` — uppercase the canonical spelling (e.g. `SUM`, `DATE`, `RANGESUM`).

Example configuration:

```ts
import { lint } from '@qlinter/core';

lint(source, {
  rules: {
    'builtin-function-case': ['warning', { style: 'upper' }],
  },
});
```

With `style: 'upper'`, the following is **correct**:

```qlik
[Totals]:
Load
    SUM(Value) as Total
Resident [TableA];
```

---

## builtin-keyword-case

Enforce the canonical casing for Qlik script keywords.

### Rule Details

Qlik parses keywords case-insensitively, so `LOAD`, `Load`, and `load` are all
accepted. Without a rule, casing drifts across a script and between authors.
Pinning each keyword to its canonical spelling (as listed in the Qlik
documentation) keeps statements visually consistent and makes the script's
structure easy to scan.

Examples of **incorrect** code for this rule:

```qlik
[Totals]:
LOAD
    Sum(Value) as Total
Resident [TableA];
```

Examples of **correct** code for this rule:

```qlik
[Totals]:
Load
    Sum(Value) as Total
Resident [TableA];
```

### Options

| Option  | Type                             | Default    | Description                        |
| :------ | :------------------------------- | :--------- | :--------------------------------- |
| `style` | `'pascal' \| 'lower' \| 'upper'` | `'pascal'` | Casing applied to script keywords. |

- `'pascal'` — use the canonical spelling from the Qlik documentation (e.g. `Load`, `Resident`, `From`).
- `'lower'` — lowercase the canonical spelling (e.g. `load`, `resident`, `from`).
- `'upper'` — uppercase the canonical spelling (e.g. `LOAD`, `RESIDENT`, `FROM`).

Example configuration:

```ts
import { lint } from '@qlinter/core';

lint(source, {
  rules: {
    'builtin-keyword-case': ['warning', { style: 'upper' }],
  },
});
```

With `style: 'upper'`, the following is **correct**:

```qlik
[Totals]:
LOAD
    Sum(Value) as Total
RESIDENT [TableA];
```

---

## comma-space

Require exactly one space after a comma when the next token is on the same line.

### Rule Details

Commas separate arguments, fields, and list elements. When the next token sits on
the same line, a single space after the comma keeps the boundary visible without
inflating the line; no space at all (`If(x>0,'pos','neg')`) makes arguments
visually run together, and runs of two or more spaces (or a tab) are usually
leftover alignment that bloats diffs whenever a sibling token changes length.

The rule walks the token stream, finds every comma, and inspects what follows
on the same line. If the next non-whitespace character is on a new line — the
common multi-line case (`LOAD A,\n B,\n C`) — the comma is left alone. Otherwise
the gap between the comma and the next character must be exactly one ASCII space.

The rule is intentionally narrow:

- Commas inside string literals (`'a,b,c'`), bracket identifiers (`[Order,Items]`),
  and `Trace` bodies are absorbed by the lexer into a single token and never
  reach this rule.
- Trailing whitespace after the comma but before the newline (`LOAD A,   \n B`)
  is not flagged here — that's the domain of [trailing-whitespace](#trailing-whitespace).
- A space is required before an inline block comment that follows the comma
  (`If(x, /* hint */ 'a', 'b')`), consistent with how
  [inline-comment-space](#inline-comment-space) treats other inline comments.

The autofix replaces the whitespace between the comma and the next same-line
character with a single space, so `If(x,'a','b')` and `If(x,   'a',\t'b')` both
converge on `If(x, 'a', 'b')` in one format pass.

Examples of **incorrect** code for this rule:

```qlik
LET vSum = RangeSum(1,2,3);
LET vIf = If(vSum > 0,'pos','neg');
LET vMix = If(vSum > 0,  'pos', 'neg');
LET vBlock = If(vSum > 0,/* hint */ 'pos', 'neg');
LOAD A,B,C
FROM [lib://x/y.qvd];
```

Examples of **correct** code for this rule:

```qlik
LET vSum = RangeSum(1, 2, 3);
LET vIf = If(vSum > 0, 'pos', 'neg');
LET vBlock = If(vSum > 0, /* hint */ 'pos', 'neg');

LOAD
    A,
    B,
    C
FROM [lib://x/y.qvd];

LET vStr = 'a,b,c';
LOAD [Order,Items] AS OrderItems FROM [lib://x/y.qvd];
Trace loading a,b,c;
```

### Options

This rule has no options. "Exactly one space after a comma" is the universally
expected convention; offering toggles for zero spaces or alignment runs would
defeat the purpose of an opinionated linter.

---

## comment-space

Require a single space between a comment marker and its body.

### Rule Details

Comments without separating whitespace (`//foo`, `/*foo*/`) read as one
continuous blob and make a quick scan of the script harder. A consistent single
space between the marker and the text keeps comments visually aligned with the
surrounding code and matches the convention used by every other linter in the
ecosystem.

The rule walks every comment token and enforces:

- `//` line comments must be followed by whitespace before any text.
- `/* … */` block comments must have whitespace immediately after `/*` and
  immediately before `*/` (a newline counts as whitespace, so multi-line block
  comments that open with a line break are fine).

Two intentional exceptions keep the rule out of the way of common idioms:

- Empty markers (`//`, `/**/`) are accepted.
- Decorative banners whose body consists only of the marker character are
  accepted: `////////////////` (only `/`s after `//`) and `/****/` (only `*`s
  between `/*` and `*/`). This covers the section-divider style that Qlik
  scripts often use to delimit pipeline stages without forcing an awkward
  rewrite.

The autofix inserts a single space at each offending position. A tight
`/*foo*/` becomes `/* foo */` in one format pass.

Examples of **incorrect** code for this rule:

```qlik
//No space after slashes
SET vYear = 2026;

/*tight block*/
LET vMonth = 6;

/* missing-at-end*/
LET vDay = 1;
```

Examples of **correct** code for this rule:

```qlik
// Comment with a space
SET vYear = 2026;

//
LET vMonth = 6;

////////////////////////////////////////
// Decorative banner
////////////////////////////////////////

/* spaced block */
LET vDay = 1;

/*
 * multi-line block comment
 * stays untouched
 */
LET vHour = 12;
```

### Options

This rule has no options. The single-space convention is intentionally fixed —
making it configurable would invite every project to redefine "well-formatted
comment", which defeats the point of an opinionated linter.

---

## continuation-indent

Indent continuation lines one level per open parenthesis, relative to the line
they continue.

### Rule Details

[block-indent](#block-indent) owns statement starts and [load-indent](#load-indent)
owns the header, field and clause lines of a `Load`. What is left over are
_continuation lines_: the lines inside a wrapped expression — a broken
`&`-concatenation chain, a multi-line `Where` condition, the arguments of a call
spread over several lines. This rule owns those.

A `Load` header torn across lines is explicitly **not** one of them. `Left
Join(X)` on one line with its `Load` on the next is a statement head split in
two, not a wrapped expression; hanging the `Load` one level in would put it at
the same column as the fields it introduces. Those lines are anchors, owned by
[load-indent](#load-indent) at the statement's own indent. A prefix whose
_argument list_ is wrapped is a different matter and stays a continuation:

```qlik
[Tree]:
Hierarchy(NodeId, ParentId,
    NodeName)                  // continuation — one level, this rule
Load                           // header line — base, load-indent
    NodeId
From [lib://qvd/tree.qvd] (qvd);
```

The expected indent hangs off the nearest preceding **anchor** — the statement
start or field/clause line the continuation belongs to — plus one level for
every parenthesis still open at the start of the line. Counting parentheses is
what keeps nesting readable instead of flattening every continuation to the same
column:

```qlik
Let vFlag = If(Status = 'A',   // anchor, base 0
    If(Region = 'North',       // depth 1
        1,                     // depth 2
        2),
    0);
```

A continuation that is not inside parentheses at all still gets one level, which
is what makes a broken condition or `&`-chain hang below its clause. A line that
_starts_ with a closing parenthesis is dedented by one level so the closer lands
back under its anchor — the same shape [multiline-call](#multiline-call) emits
when it breaks an over-long call apart, so the two rules never rewrite each
other.

Because the rule derives the full indent rather than adjusting what is there, it
fixes the indent _character_ as a side effect: a tab-indented continuation line
in a space-configured file is rewritten along with everything else. This is why
there is no separate character-level rule.

The anchor's **actual** indent is used, not its expected one — the same choice
[load-indent](#load-indent) makes for its base. When the anchor is itself
misindented, its owning rule corrects it and the autofix loop re-derives the
continuations on the next pass.

The check keys off the first _code_ token of each line, so lines that carry no
token of their own are never inspected:

- the interior and rail lines of a multi-line block comment (governed by
  [block-comment-stars](#block-comment-stars)),
- the interior of a multi-line string literal,
- the rows of an `Inline [...]` data block — a single bracket token, exactly as
  [load-indent](#load-indent) already treats it.

A line where a token started earlier and ends here (the `];` closing an `Inline`
block, for instance) is skipped too: its leading characters belong to the
previous token, and rewriting them would corrupt it.

Examples of **incorrect** code for this rule (default `size: 4`, `style: 'space'`):

```qlik
[Labelled]:
Load
    'Prefix: '
& Region as Label
From [lib://x.qvd] (qvd);

// Nesting flattened instead of following the parenthesis depth.
Let vFlag = If(Status = 'A',
    If(Region = 'North',
    1,
    2),
    0);
```

Examples of **correct** code for this rule:

```qlik
[Labelled]:
Load
    'Prefix: '
        & Region as Label
From [lib://x.qvd] (qvd)
Where Id > 0
    And Region <> 'n/a';

Let vFlag = If(Status = 'A',
    If(Region = 'North',
        1,
        2),
    0);

// A leading closing parenthesis dedents back under its anchor.
Let vName = ApplyMap('MapX',
    Region,
    'unknown'
);
```

### Options

| Option  | Type               | Default   | Description                               |
| :------ | :----------------- | :-------- | :---------------------------------------- |
| `size`  | `number`           | `4`       | Spaces per level (ignored under `'tab'`). |
| `style` | `'space' \| 'tab'` | `'space'` | Character each indent level is made of.   |

Keep `size` and `style` in sync with [block-indent](#block-indent) and
[load-indent](#load-indent) — a file whose statement lines are indented with
spaces while continuation lines demand tabs reads worse than either convention
on its own.

Example configuration:

```ts
import { lint } from '@qlinter/core';

lint(source, {
  rules: {
    'continuation-indent': ['warning', { size: 2, style: 'space' }],
  },
});
```

---

## eol-last

Require the file to end with exactly one newline.

### Rule Details

A file should end with a single line terminator. A missing final newline leaves
the last line incomplete: many tools render it with a "no newline at end of
file" marker, and editing that line later shows up in the diff as a change to
the newline as well as the content. Trailing blank lines at the other extreme
are pure padding that inflate diffs without conveying anything. Pinning the end
of the file to exactly one newline removes both.

The rule inspects only the very end of the file:

- A file whose last line has content but no terminator is flagged, and the
  autofix appends one newline.
- A file that ends with more than one line terminator (one or more trailing
  blank lines) is flagged, and the autofix trims the run back to a single
  newline.
- An empty file, or a file that is nothing but newlines, is left alone — there
  is no content to terminate.

The autofix reuses the source's dominant line ending: `\r\n` if the file
contains any CRLF, otherwise `\n`. Trailing spaces on the last line are not
this rule's concern — they are stripped by
[trailing-whitespace](#trailing-whitespace) — and blank-line runs in the middle
of the script belong to [no-multiple-empty-lines](#no-multiple-empty-lines);
the three compose so that the whole file, including its end, converges in one
format run.

Examples of **incorrect** code for this rule (`¬` marks the end of the file):

```qlik
SET vYear = 2026;
LET vMonth = 6;¬
```

```qlik
SET vYear = 2026;
LET vMonth = 6;

¬
```

Examples of **correct** code for this rule:

```qlik
SET vYear = 2026;
LET vMonth = 6;
¬
```

### Options

This rule has no options. "Exactly one newline at end of file" is the universal
convention; making it configurable would defeat the point of an opinionated
linter.

---

## include-no-spaces

Disallow whitespace around the `=` of a `$(Include=…)` / `$(Must_Include=…)`
expansion.

### Rule Details

An include expansion is not an assignment. Qlik matches `Include=` as a fixed
literal form and its documentation states outright that no space may appear
before or after the equal sign. A script that carries one does not merely read
oddly — the Data Load Editor fails to recognise the construct and rejects the
statement with a syntax error, so the included file is never loaded.

This makes the rule a correctness rule rather than a style rule, which is why it
defaults to `error`. It is also the reason the whole expansion is tokenized as a
single unit: [operator-spacing](#operator-spacing) would otherwise treat that `=`
as a binary operator and introduce exactly the spaces this rule removes.

The autofix deletes the offending whitespace and touches nothing else. The
include target is preserved byte for byte, because a data connection path may
legitimately contain spaces of its own.

The evaluation expansion `$(= …)` is a different construct and is out of scope —
its leading `=` is an evaluation marker, and Qlik accepts a space after it.

Examples of **incorrect** code for this rule:

```qlik
$(Include = abc.txt);
$(Must_Include =[lib://DataFiles/helpers.qvs]);
$(Must_Include= lib://DataFiles/more.qvs);
```

Examples of **correct** code for this rule:

```qlik
$(Include=abc.txt);
$(Must_Include=[lib://DataFiles/helpers.qvs]);
$(Must_Include=lib://DataFiles/more.qvs);

// A path may carry spaces of its own; only the equal sign is enforced.
$(Must_Include=[lib://Data Files/my helpers.qvs]);

// An evaluation expansion is a different construct entirely.
LET vEval = $(=Max(OrderDate));
```

### Options

This rule has no options. The spacing it forbids is a syntax error in Qlik, not
a matter of taste.

---

## inline-comment-space

Require exactly one space between code and a trailing comment on the same line.

### Rule Details

When a comment shares a line with code, the gap between the last code token and
the comment marker tends to drift — no space at all (`LET x = 1;// note`), a
single tab, or a long alignment run (`LET x = 1;        // note`). Each variant
reads differently and inflates diffs whenever an unrelated edit nudges the
column. Pinning that gap to exactly one ASCII space keeps trailing annotations
visually attached to the code they describe and removes the temptation to
hand-align comments into columns.

The rule walks every comment token, looks at what sits before it on the same
line, and only triggers when there is non-whitespace code before the marker. If
the gap between the last code character and the comment marker is not exactly
one space (`' '`), the rule flags the comment.

This rule is intentionally narrow:

- Standalone-line comments — where the comment is the first non-whitespace
  token on its line — are **not** flagged. Their leading whitespace is the
  domain of [block-indent](#block-indent), and the spacing _inside_ the
  marker is covered by [comment-space](#comment-space).
- Both `//` line comments and `/* … */` block comments are checked. A
  multi-line block comment that starts after code on a line is still treated
  as inline for the purpose of its leading gap; only the gap before `/*` is
  enforced.
- Comments hidden inside a `Trace` body are absorbed into the trace message
  by the lexer and never reach this rule.

The autofix replaces the whitespace between the last code character and the
comment marker with a single space, so `LET x = 1;// note` and
`LET x = 1;    // note` both converge on `LET x = 1; // note` in one format
pass.

Examples of **incorrect** code for this rule:

```qlik
SET vYear = 2026;// no space
LET vMonth = 6;    // too many spaces
LET vDay = 1;	// tab before comment
SET vHour = 12;/* tight inline block */
```

Examples of **correct** code for this rule:

```qlik
SET vYear = 2026; // exactly one space
LET vMonth = 6; /* spaced block */

// standalone-line comments are untouched
LET vDay = 1;

/*
 * a standalone block comment is also untouched
 */
LET vHour = 12;
```

### Options

This rule has no options. The single-space convention is intentionally fixed —
making it configurable would invite every project to redefine "well-formatted
inline comment", which defeats the point of an opinionated linter.

---

## load-clause-newline

Require each top-level clause of a `LOAD` statement to begin on its own line.

### Rule Details

A Qlik `LOAD` is built from a small set of clauses: the field list, a source
(`From`, `Resident`, `Inline`, `AutoGenerate`, `Extension`, `From_Field`), an
optional filter (`Where` / `While`), and optional `Group By` / `Order By`. When
two clauses share a physical line, the structural shape of the statement is
hidden — a long field list and an inlined `Where` read as one undifferentiated
blob, diffs become harder, and a quick scan can no longer tell what the
statement actually does.

The rule walks each statement, locates the `LOAD` keyword, and flags every
clause-starter keyword that is not the first non-whitespace token of its line.
Detection happens at parenthesis depth zero, so a stray `Where` or `Distinct`
inside an expression (`Concat(Distinct CustomerId, ', ')`, `If(Where = 1, …)`)
is not mistaken for a clause. Statements without a `LOAD` keyword — standalone
`SQL SELECT …`, `Hierarchy`-only forms, control flow — are ignored.

The rule is intentionally narrow. It does **not**:

- enforce one field per line — that is a separate concern;
- enforce indentation of the field list — same;
- require the `Load` header (`[NoConcatenate] Load [Distinct]`) to sit on a
  single line — those are modifiers, not clauses. A header spread over several
  lines is accepted; [load-indent](#load-indent) puts each of those lines at the
  statement's own indent;
- touch the bracketed data block that follows `Inline [...]`, which stays
  attached to its clause keyword and may span as many lines as it needs.

The autofix replaces the whitespace between the previous token and the
offending clause keyword with a single `\n`. Any comment sitting in that gap is
preserved — the fix range starts after the last comment that ends before the
keyword. The fix does not reindent the new line; that is left to
[block-indent](#block-indent) and any future LOAD-body indent rule.

`Group By` and `Order By` are treated as one clause each: only the `Group` /
`Order` head needs to start the line; the trailing `By` stays attached.

Recognised clause-starter keywords: `From`, `From_Field`, `Resident`, `Inline`,
`AutoGenerate`, `Extension`, `Where`, `While`, `Group`, `Order`.

Examples of **incorrect** code for this rule:

```qlik
[A]: Load Id, Name From [lib://x.qvd] (qvd) Where Active = 1 Order By Id;

[B]:
NoConcatenate Load
    Id, Name From [lib://x.qvd] (qvd);

[C]:
Load
    Id
From [lib://x.qvd] (qvd) Where Active = 1 Order By Id;
```

Examples of **correct** code for this rule:

```qlik
[Sales]:
NoConcatenate Load Distinct
    OrderId,
    CustomerId,
    Amount,
    If(Region = 'EU', Amount * 1.2, Amount) as AmountEUR
From [lib://qvd/sales.qvd] (qvd)
Where Year >= 2020
Group By OrderId
Order By OrderId;

// Header torn apart — also accepted; the rule does not police modifiers. The
// column those lines land in is load-indent's business, not this rule's.
[Numbers]:
NoConcatenate
Load
Distinct
    n,
    n * 2 as Double
Inline [
    n
    1
    2
];

// Standalone SQL passthrough — no LOAD keyword, not inspected.
SQL Select Id, Name From dbo.Customers Where Active = 1 Order By Id;
```

### Options

This rule has no options. The set of recognised clause keywords is fixed by the
Qlik grammar.

---

## load-field-per-line

Require each field of a `LOAD` statement to start on its own line.

### Rule Details

A long field list packed onto one line — or, more commonly, a field list that
is _almost_ one-per-line except for one stragger glued to a neighbour — hides
the shape of the LOAD: which fields are renamed, which are derived from
expressions, and where a long expression ends. The rule walks every LOAD
statement, identifies the field list, and flags every field-start token that
shares a line with the token immediately before it.

The field list runs from the first token after `Load` (skipping a single
`Distinct` modifier) up to the first top-level clause keyword (`From`,
`Resident`, `Inline`, `Where`, ...) or the closing `;`. Detection happens at
parenthesis depth zero, so commas inside expressions
(`If(x, y, z)`, `Concat(Name, ', ')`) are not treated as field separators.
Comma-separated lists _after_ a clause keyword (`Group By A, B, C`,
`Order By Total desc, Region asc`, `Where Status In ('A', 'B')`) sit beyond
the field-list boundary or inside parens and are not checked.

The rule enforces two things per LOAD:

- The first field token sits on a different line than the `Load [Distinct]`
  header that precedes it.
- After every top-level comma inside the field list, the next token starts a
  new line.

A single exception covers the wildcard placeholder: `Load * From X` and
`Load * Inline [...]` keep `*` on the LOAD header line — it is a placeholder,
not a real field. As soon as a real field accompanies the wildcard
(`Load *, Field1, ...`), `*` is treated like any other field and must take
its own line.

The autofix replaces the whitespace between the previous token and the
offending field with a single `\n`, preserving any comment in the gap. The
fix does not reindent the new line; that is left to the existing
[block-indent](#block-indent) rule and any future LOAD-body indent rule.

This rule pairs naturally with [load-clause-newline](#load-clause-newline):
together they break a fully jammed LOAD into its canonical multi-line shape.
Each rule stays in its own lane — clause keyword placement vs. field
placement — so they can be enabled or disabled independently.

Examples of **incorrect** code for this rule:

```qlik
[A]: Load Id, Name, Total From X;

[B]:
Load Id
From X;

[D]:
Load
    A,
    B, C
From X;

[E]:
NoConcatenate Load Distinct OrderId, CustomerId
From X;
```

Examples of **correct** code for this rule:

```qlik
[Sales]:
NoConcatenate Load Distinct
    OrderId,
    CustomerId,
    Amount,
    If(Region = 'EU', Amount * 1.2, Amount) as AmountEUR
From [lib://qvd/sales.qvd] (qvd)
Where Year >= 2020
Group By OrderId
Order By OrderId;

// Wildcard placeholder stays on the Load header line.
[Wildcard]:
Load * From [lib://x.qvd] (qvd);

// Multi-line field expressions are fine — only field starts are checked.
[LongExpr]:
Load
    Id,
    If(
        Status = 'A',
        1,
        0
    ) as Flag,
    Sum(Amount)
        & ' (' & Region & ')'
        as Label
From [lib://x.qvd] (qvd);
```

### Options

This rule has no options.

---

## load-indent

Indent the field list of a `LOAD` statement one step deeper than the `LOAD`
keyword, and keep clause keywords aligned with `LOAD`.

### Rule Details

Once a `LOAD` is broken across multiple lines (by
[load-field-per-line](#load-field-per-line) and
[load-clause-newline](#load-clause-newline)), its body still needs a
convention for where each line begins horizontally. Without one, fields and
clauses drift between flush-left and various tab stops in the same script and
the visual shape of a LOAD stops carrying meaning. This rule pins down the
structural levels of the LOAD statement:

- Every **header line** — a prefix broken off its `Load` (`Left Join(X)`,
  `NoConcatenate`), the `Load` keyword itself, a `Distinct` pushed onto its own
  line — sits at `base`.
- Every line that **starts a new field** sits at `base + step`.
- Every line that **starts a clause** (`From`, `Resident`, `Where`,
  `Group`, `Order`, ...) sits at `base`.

`base` is the indent of the line that **opens the LOAD statement**, so a LOAD
that lives inside a `Sub` (or any other [block-indent](#block-indent)-managed
construct) inherits the surrounding indent automatically — fields land at
"Sub body + one step", header and clauses land at "Sub body".

The opening line itself belongs to [block-indent](#block-indent) and is never
reported here, only measured. Everything the statement spends on its own head
after that line is a header line: the base is taken from the opening line, so a
misindented `Load` is pulled back into place instead of dragging the field list
sideways with it.

```qlik
[MyTable]:
Left Join(X)    // opens the statement — block-indent, base 0
Load            // header line — base
Distinct        // header line — base
    Id          // field — base + step
Resident Z;     // clause — base
```

Only header lines that _begin_ at parenthesis depth zero count. A prefix whose
argument list is wrapped is a genuine continuation of an expression and stays
with [continuation-indent](#continuation-indent):

```qlik
[Tree]:
Hierarchy(NodeId, ParentId,
    NodeName)   // continuation-indent, one level
Load            // header line — base
    NodeId
From [lib://qvd/tree.qvd] (qvd);
```

The rule is deliberately narrow:

- It only checks tokens that are already the first non-whitespace token of
  their line. Field tokens that share a line with the previous token are left
  to [load-field-per-line](#load-field-per-line) to surface first.
- **Continuation lines are not enforced.** A multi-line `If(...)` field, a
  long `&`-concatenation chain, a wrapped `Where` condition — anything that
  is not itself a header, a new field or a new clause keeps whatever indent the
  author chose here; [continuation-indent](#continuation-indent) governs it
  separately.
- It says nothing about _where the header breaks_. `Left Join(X) Load Distinct`
  on one line and the same header spread over three lines are both accepted;
  the rule only fixes the horizontal position of whatever lines exist.
- The wildcard placeholder exception from
  [load-field-per-line](#load-field-per-line) carries over: a lone `*` is
  never treated as a field, even when it sits on its own line.

Like [block-indent](#block-indent), a header-, field- or clause-start line is
compared against the exact expected indent string, not just its width: a
right-width run of the wrong character (tabs under the space style, or a
tab/space mix) is still flagged, so `style` is enforced independently of any
other rule.

The autofix replaces the leading whitespace of each offending line with the
expected indent string (`step` repeated to the expected width). The indent
character and step width are governed by the same `style` / `size` options
as [block-indent](#block-indent), so the two rules format scripts
consistently.

Examples of **incorrect** code for this rule (default `style: 'space'`,
`size: 4`, shown with `·` for a space):

```qlik
[A]:
Load
Id
From X;

[B]:
Load
········Total
From X;

[C]:
Load
····Id
····From X;

// Header lines indented as if they were continuations.
[D]:
Left Join([E])
····Load
····Distinct
····Id
From X;
```

Examples of **correct** code for this rule:

```qlik
[Sales]:
NoConcatenate Load Distinct
····OrderId,
····CustomerId,
····If(Region = 'EU', Amount * 1.2, Amount) as AmountEUR
From [lib://qvd/sales.qvd] (qvd)
Where Year >= 2020
Group By OrderId
Order By OrderId;

// LOAD nested in a Sub — base is the Sub-body indent.
Sub loadIt
····[Inner]:
····Load
········Id,
········Name
····From [lib://x.qvd] (qvd);
End Sub

// Multi-line field expression — continuation lines are unchecked.
[LongExpr]:
Load
····Id,
····Sum(Amount)
············& ' (' & Region & ')'
············as Label,
····Other
From [lib://x.qvd] (qvd);

// Header torn across lines — every header line sits at base, so the field
// list one step deeper still reads as subordinate to it.
[Torn]:
Left Join([M])
Load
Distinct
····Id
Resident [Src];

// Same, nested in a Sub — base is the Sub-body indent.
Sub mapIt
····Left Join([M]) IntervalMatch (Stichtag, PERNR)
····Load
········BEGDA,
········PERNR
····Resident [Src];
End Sub
```

### Options

| Option  | Type               | Default   | Description                              |
| :------ | :----------------- | :-------- | :--------------------------------------- |
| `size`  | `number`           | `4`       | Number of `style` units per indent step. |
| `style` | `'space' \| 'tab'` | `'space'` | Character used for one indent step.      |

The semantics mirror [block-indent](#block-indent): with the default
`style: 'space'` the rule inserts ASCII spaces and `size` counts spaces per
step (the default is `4`); with `style: 'tab'` it inserts literal `\t` bytes
and `size` counts tabs per step (almost always `1`). Keep this rule's options
in sync with `block-indent` — a script formatted with a space-based
`block-indent` and a tab-based `load-indent` would produce mixed indentation
that no editor agrees on.

Example configuration (override both indent rules to tab-based indentation):

```ts
import { lint } from '@qlinter/core';

lint(source, {
  rules: {
    'block-indent': ['warning', { style: 'tab', size: 1 }],
    'load-indent': ['warning', { style: 'tab', size: 1 }],
  },
});
```

With `{ style: 'tab', size: 1 }`, the following is **correct** (`→` marks a tab):

```qlik
[Sales]:
Load
→OrderId,
→CustomerId
From [lib://x.qvd] (qvd);
```

---

## max-line-length

Limit how long a single line of script may be.

### Rule Details

Long lines force horizontal scrolling, hide statement structure, and make diffs
harder to read. The rule walks the source line by line and flags every line
whose character count exceeds the configured maximum. CRLF and LF endings are
both counted the same way — only the visible characters of the line contribute
to the length.

The default of `120` was chosen because Qlik scripts have structurally long
constructs (`lib://...` data-connection paths, embedded SQL, function chains
like `Date(Timestamp#(...), '...')`) that make tighter defaults noisy on real
scripts. Teams that want a stricter limit can lower it via the `max` option.

There is no autofix: mechanically wrapping a Qlik line would risk cutting
string literals, SQL fragments, or data-connection paths and breaking syntax.

Examples of **incorrect** code for this rule (default `max: 120`):

```qlik
[Sales]:
Load
    Date(Timestamp#(OrderTimestamp, 'YYYY-MM-DDThh:mm:ss')) as OrderDate, CustomerName, ProductCategory, Region, Channel, Subtotal as RevenueLine
From [lib://Sales/orders.qvd] (qvd);
```

Examples of **correct** code for this rule (default `max: 120`):

```qlik
[Sales]:
Load
    Date(Timestamp#(OrderTimestamp, 'YYYY-MM-DDThh:mm:ss')) as OrderDate,
    CustomerName,
    ProductCategory,
    Region,
    Channel,
    Subtotal as RevenueLine
From [lib://Sales/orders.qvd] (qvd);
```

### Options

| Option | Type     | Default | Description                          |
| :----- | :------- | :------ | :----------------------------------- |
| `max`  | `number` | `120`   | Maximum allowed characters per line. |

Example configuration:

```ts
import { lint } from '@qlinter/core';

lint(source, {
  rules: {
    'max-line-length': ['warning', { max: 100 }],
  },
});
```

---

## multiline-call

Break a single-line built-in function call across multiple lines once its
host line exceeds the configured maximum length.

### Rule Details

Long nested expressions like
`If(condA, 'really long branch a', 'really long branch b')` are readable when
they fit on one line and unreadable as soon as they spill past the right
margin. Splitting each top-level argument onto its own line — with the
closing `)` realigned under the call's own indent — restores the visual
structure of the call and makes diffs of individual branches local instead of
shifting whole strings of arguments around.

The rule walks the token stream and inspects every built-in function call
(`If`, `Pick`, `Match`, `Alt`, `RangeSum`, ...). A call is flagged when **all**
of the following hold:

- The call starts and ends on the same line (already multi-line calls are
  left alone).
- That line is longer than `maxLineLength`.
- The call has at least two top-level arguments — a single-argument call
  cannot be meaningfully split.

Only the outermost qualifying call on a line is flagged per pass. Nested
calls are reached on subsequent format passes once their parent has been
broken, so each level is handled in turn without overlapping fixes.

User-defined function calls (`MyFunc(a, b)`) and `Call myFunc(...)` syntax
are intentionally out of scope — only built-in functions are considered.

The autofix replaces the parenthesised body with one argument per line and
places the closing `)` on its own line. It writes no indentation of its own:
the lines it creates are continuation lines, and
[continuation-indent](#continuation-indent) indents them on the next format
pass — one step deeper for the arguments, back under the call for the closing
paren. Anything after the closing paren on the original line (e.g. `As Field`,
an operator, a semicolon) is preserved verbatim.

Examples of **incorrect** code for this rule (with `maxLineLength: 80`):

```qlik
LET vCategory = If(vYear >= 2025 and vMonth >= 6, 'late 2025 or later', 'before mid-2025');
LET vTotal = RangeSum(vSalesA, vSalesB, vSalesC, vSalesD, vSalesE, vSalesF, vSalesG);
```

Examples of **correct** code for this rule:

```qlik
LET vCategory = If(
    vYear >= 2025 and vMonth >= 6,
    'late 2025 or later',
    'before mid-2025'
);

LET vSimple = If(vYear = 2025, 'this year', 'other');
LET vTotal = Sum(vRevenue);
```

### Options

| Option          | Type     | Default | Description                                              |
| :-------------- | :------- | :------ | :------------------------------------------------------- |
| `maxLineLength` | `number` | `120`   | Threshold above which a single-line call must be broken. |

The rule has no indentation options. It decides _where_ the call is broken and
emits bare newlines; [continuation-indent](#continuation-indent) owns the
indentation of the lines that appear, exactly as
[load-clause-newline](#load-clause-newline) and
[load-field-per-line](#load-field-per-line) leave theirs to
[load-indent](#load-indent). Configure the indent width and character once, on
the indent rules, and this rule follows automatically.

Run without `continuation-indent` and the broken-out arguments are left flush
left — the break is still correct, just not indented by anyone.

```ts
import { lint } from '@qlinter/core';

lint(source, {
  rules: {
    'multiline-call': ['warning', { maxLineLength: 100 }],
  },
});
```

---

## no-legacy-path-variables

Disallow the legacy QlikView-era path system variables (`CD`, `Floppy`,
`QvPath`, `QvRoot`, `QvWorkPath`, `QvWorkRoot`, `WinPath`, `WinRoot`).

### Rule Details

These variables come from the QlikView era, when scripts referenced files
directly via local operating-system paths. The Qlik Sense documentation still
lists them on the system variables reference page, but Qlik Sense executes
scripts server-side and resolves file access through `lib://` data connections.
The legacy variables are tied to concepts that no longer apply (local floppy
and CD drives, an installed QlikView client, a Windows-shaped working
directory) and their appearance is almost always a sign of code copied
verbatim from a QlikView script.

The rule does not offer an autofix because there is no mechanical replacement —
the script needs a real data connection, which is a configuration decision
outside the source file.

Examples of **incorrect** code for this rule:

```qlik
LET vRoot = QvRoot;

[Files]:
Load
    WinPath as Path
AutoGenerate 1;
```

Examples of **correct** code for this rule:

```qlik
LET vRoot = 'lib://MyDataLake/';

[Files]:
Load
    '$(vRoot)' as Path
AutoGenerate 1;
```

### Options

This rule has no options.

---

## no-multiple-empty-lines

Limit how many consecutive empty lines may appear in the script.

### Rule Details

Consecutive blank lines break the visual flow of a script and inflate diffs
without conveying information. Most scripts use a single blank line to separate
related blocks; runs of two or more blanks are usually leftover artifacts from
copy-and-paste or block deletions. The rule walks the source line by line,
tracks runs of empty (whitespace-only) lines, and flags any run that exceeds
the configured maximum.

A line counts as empty when it contains nothing but whitespace. Comment-only
lines are **not** considered empty — a `// section break` between two single
blank lines does not fuse them into one over-long run. CRLF and LF line
endings are treated identically; the autofix preserves whichever ending the
source uses.

The autofix collapses each over-long run down to the configured maximum by
deleting the excess line terminators.

Examples of **incorrect** code for this rule (default `max: 1`):

```qlik
SET vYear = 2026;



SET vMonth = 6;


SET vDay = 1;
```

Examples of **correct** code for this rule (default `max: 1`):

```qlik
SET vYear = 2026;

SET vMonth = 6;

// section break
SET vDay = 1;
```

### Options

| Option | Type     | Default | Description                              |
| :----- | :------- | :------ | :--------------------------------------- |
| `max`  | `number` | `1`     | Maximum allowed consecutive empty lines. |

Example configuration:

```ts
import { lint } from '@qlinter/core';

lint(source, {
  rules: {
    'no-multiple-empty-lines': ['warning', { max: 2 }],
  },
});
```

With `max: 2`, the following is **correct**:

```qlik
SET vYear = 2026;


SET vMonth = 6;
```

---

## one-statement-per-line

Require each statement to start on its own line.

### Rule Details

Qlik allows multiple statements to be packed onto a single physical line by
separating them with semicolons (`SET vYear = 2026; LET vMonth = 6;`). The
syntax is legal, but every extra statement on a line hides from a scan-read of
the script and complicates diffs — a one-character change can rewrite the
meaning of half the line.

The rule walks the token stream and flags any token that shares a line with
the semicolon immediately preceding it. Multi-line `LOAD` bodies are not
affected because their field separators are commas, not semicolons. Trailing
comments after a semicolon are also not affected, because the lexer routes
comment tokens to a separate group — only real code on the same line triggers
a finding.

Implicit terminators like `End Sub`, `Next`, and `Loop` end a statement only
across a line break; on the same line Qlik itself rejects a chained statement
unless an explicit semicolon is added, so they collapse to the same
semicolon-based check.

The autofix replaces the gap between the semicolon and the next token with a
single newline, so `SET x = 1;  SET y = 2;` becomes
`SET x = 1;\nSET y = 2;`. Any indentation of the new line is left to a
dedicated indent rule.

Examples of **incorrect** code for this rule:

```qlik
SET vYear = 2026; LET vMonth = 6;

[TableA]:
Load
    Field1,
    Field2
Resident [Source]; SET vDone = 1;
```

Examples of **correct** code for this rule:

```qlik
SET vYear = 2026;
LET vMonth = 6; // trailing comments are fine

[TableA]:
Load
    Field1,
    Field2
Resident [Source];

Sub greet
    Trace hello;
End Sub
SET vDone = 1;
```

### Options

| Option       | Type                       | Default  | Description                                         |
| :----------- | :------------------------- | :------- | :-------------------------------------------------- |
| `lineEnding` | `'auto' \| 'lf' \| 'crlf'` | `'auto'` | Line ending the autofix inserts between statements. |

- `'auto'` — match the source: `'\r\n'` if the source contains any CRLF, `'\n'` otherwise.
- `'lf'` — always insert `'\n'`.
- `'crlf'` — always insert `'\r\n'`.

Example configuration:

```ts
import { lint } from '@qlinter/core';

lint(source, {
  rules: {
    'one-statement-per-line': ['warning', { lineEnding: 'crlf' }],
  },
});
```

---

## operator-spacing

Require exactly one space on both sides of a binary operator.

### Rule Details

Operators packed tight against their operands (`vX=1`, `'a'&vName`, `Amount>0`)
read as one run of characters and hide the structure of an expression. A single
space on each side of the operator restores that structure, keeps assignments
and comparisons visually uniform, and removes the temptation to hand-align
runs of spaces that bloat diffs.

The rule walks the token stream and enforces exactly one space around a fixed
set of **unambiguously binary** operators:

- assignment / equality: `=`
- relational: `<`, `>`, `<=`, `>=`, `<>`
- string concatenation: `&`

The multi-character relational operators (`<=`, `>=`, `<>`) are treated as a
single unit — spacing is enforced around the whole operator, never between its
two characters.

Two boundaries are deliberately left alone, because there the layout belongs to
another concern:

- An operator whose side sits against a **line boundary** — leading
  indentation, or an operator that ends its line for a wrapped expression
  (`'Prefix: '\n    & Region`) — is not flagged on that side. Multi-line
  `&`-chains and wrapped conditions keep whatever indent the author chose;
  that is the domain of [block-indent](#block-indent) and
  [load-indent](#load-indent).
- The leading `=` of a `$(= …)` dollar-sign expansion is an evaluation marker,
  not a binary operator, and is left untouched.
- The `=` of an `$(Include=…)` / `$(Must_Include=…)` expansion belongs to a fixed
  form that Qlik matches literally. Qlik's documentation is explicit that no
  space may appear on either side of it, so a space there is a syntax error in
  the Data Load Editor rather than a style choice. The whole expansion is
  tokenized as one unit and never touched.

Arithmetic operators (`+`, `-`, `*`, `/`) are intentionally **out of scope**.
`+` and `-` are ambiguously unary (`LET x = -1`), and `*` doubles as the
`Load *` wildcard — a mechanical space around any of them could change what the
script means. They are left for the author to space by hand.

The autofix replaces the whitespace on each offending side with a single space,
so `vX=1`, `vX =1`, and `vX  =  1` all converge on `vX = 1` in one format pass.

Examples of **incorrect** code for this rule:

```qlik
SET vYear=2026;
LET vFlag = If(vYear>=2025, 'new', 'old');
LET vLabel = 'Year: '&vYear;
LET vGap = vYear  &  ' end';
```

Examples of **correct** code for this rule:

```qlik
SET vYear = 2026;
LET vFlag = If(vYear >= 2025, 'new', 'old');
LET vLabel = 'Year: ' & vYear;
LET vEval = $(=Max(OrderDate));

// An include expansion is a fixed form; its "=" is never spaced.
$(Must_Include=[lib://DataFiles/helpers.qvs]);

// Arithmetic and the Load wildcard are not enforced.
LET vSum = 1+2;
LET vNeg = -1;

[Sales]:
Load *
Resident [Raw];

// A wrapped concatenation keeps its multi-line layout.
[Labelled]:
Load
    'Prefix: '
        & Region
        as Label
Resident [Raw];
```

### Options

This rule has no options. "Exactly one space around a binary operator" is the
universally expected convention; offering toggles for tight or aligned operators
would defeat the purpose of an opinionated linter.

---

## paren-spacing

Disallow the space between a built-in function and its opening parenthesis, and
any padding immediately inside parentheses.

### Rule Details

Parentheses carry structure in a Qlik expression, and inconsistent spacing
around them blurs it. A call written `Sum (Amount)` reads as if `Sum` and
`(Amount)` were two separate things; padding like `If( x, y )` pushes the
arguments away from the parens that bound them and invites hand-alignment that
bloats diffs. The rule pins both down:

- **Function calls.** A built-in function name sits flush against its opening
  paren — `Sum(x)`, never `Sum (x)`. Only built-in functions are considered
  (the same scope as [multiline-call](#multiline-call)); the space between a
  **keyword** and a grouping paren (`Where (x > 0)`, `Not (a and b)`) is left
  alone, because gluing a keyword to a paren reads worse, not better.
- **Inner padding.** No space directly after `(` or directly before `)`, so
  `( x )` becomes `(x)` and `Rand( )` becomes `Rand()`. This applies to every
  paren, grouping ones included.

The rule only ever closes a gap that is **pure spaces or tabs**. Two situations
are therefore left untouched by design:

- A gap that spans a **line break** — the broken-out argument list produced by
  [multiline-call](#multiline-call), where `(` ends its line and `)` starts its
  own — keeps its layout; that is owned by the indent rules.
- A gap that contains a **comment** (`Sum /* note */ (x)`) is not collapsed, so
  the comment survives.

The autofix deletes the offending whitespace. `Sum ( x )` converges on
`Sum(x)` in one format pass.

Examples of **incorrect** code for this rule:

```qlik
LET vTotal = Sum (Amount);
LET vSign = If( Amount > 0, 'pos', 'neg' );
LET vEmpty = Rand( );

[Sales]:
Load
    Amount
Resident [Raw]
Where ( Amount > 0 );
```

Examples of **correct** code for this rule:

```qlik
LET vTotal = Sum(Amount);
LET vSign = If(Amount > 0, 'pos', 'neg');
LET vEmpty = Rand();
LET vEval = $(=Max(OrderDate));

// A keyword keeps its space before a grouping paren.
[Sales]:
Load
    Amount
Resident [Raw]
Where (Amount > 0);

// A broken-out call keeps its multi-line layout.
LET vRange = RangeSum(
    1,
    2
);
```

### Options

This rule has no options. The no-call-space / no-padding convention is
intentionally fixed — making it configurable would defeat the point of an
opinionated linter.

---

## trailing-whitespace

Disallow spaces or tabs at the end of a line.

### Rule Details

Trailing whitespace is invisible in most editors but shows up as noise in
diffs and version-control blame: editing the visible content of a line that
already carried trailing spaces produces a multi-character diff for what reads
as a single-character change. It also bloats whitespace-only lines into
"non-empty blank" lines that are harder to reason about. The rule walks the
source line by line and flags every line whose final character is a space or
tab.

CRLF and LF line endings are both recognised and preserved by the autofix —
only the whitespace immediately before the terminator is removed. Whitespace
on a line without a trailing newline (e.g. the very last line of a file) is
handled the same way.

The autofix strips the trailing whitespace from each offending line. This
composes cleanly with [no-multiple-empty-lines](#no-multiple-empty-lines):
whitespace-only lines first become truly empty under `trailing-whitespace`,
and the subsequent format pass collapses any over-long blank runs.

Examples of **incorrect** code for this rule (`·` marks a space, `→` marks a tab):

```qlik
SET vYear = 2026;···
SET vMonth = 6;→
SET vDay = 1;·→·
LET vHour = 12;
```

Examples of **correct** code for this rule:

```qlik
SET vYear = 2026;
SET vMonth = 6;
SET vDay = 1;
LET vHour = 12;
```

### Options

This rule has no options. The no-trailing-whitespace convention is
intentionally fixed — making it configurable would invite every project to
redefine "well-formatted line", which defeats the point of an opinionated
linter.

---

## variable-case

Enforce a consistent casing style for user-defined variables.

### Rule Details

In Qlik script, user-defined variables can only be introduced through a `SET` or
`LET` statement. Without a convention, the same script ends up mixing styles
(`vMaxDate`, `max_date`, `MaxDate`), which makes it harder to tell variable
references apart from fields, table names, or built-in identifiers.

The rule checks the identifier that follows each `SET` / `LET` keyword and flags
it when it does not match the configured style. Qlik system variables (such as
`DateFormat`, `ThousandSep`, `ErrorMode`) are recognised by the lexer as a
distinct token type and are intentionally excluded — their names are fixed by
the platform and are covered by other rules.

There is no autofix: converting between casing styles requires knowing where
the word boundaries are (`maxdate` could become `maxDate`, `MaxDate`, or
`max_date`), and guessing them mechanically would produce wrong names.

Examples of **incorrect** code for this rule (default `style: 'camel'`):

```qlik
SET BadName = 'first';
LET other_var = 1;
```

Examples of **correct** code for this rule (default `style: 'camel'`):

```qlik
SET vYear = 2026;
LET vMaxDate = Today();
Set someValue = 'ok';

// system variables stay untouched regardless of style
Let DateFormat = 'YYYY-MM-DD';
```

### Options

| Option  | Type                                             | Default   | Description                                 |
| :------ | :----------------------------------------------- | :-------- | :------------------------------------------ |
| `style` | `'camel' \| 'pascal' \| 'snake' \| 'upperSnake'` | `'camel'` | Casing required for user-defined variables. |

- `'camel'` — `myVariable`, `vYear`, `someValue`.
- `'pascal'` — `MyVariable`, `VYear`, `SomeValue`.
- `'snake'` — `my_variable`, `v_year`, `some_value`.
- `'upperSnake'` — `MY_VARIABLE`, `V_YEAR`, `SOME_VALUE`.

Example configuration:

```ts
import { lint } from '@qlinter/core';

lint(source, {
  rules: {
    'variable-case': ['warning', { style: 'snake' }],
  },
});
```

With `style: 'snake'`, the following is **correct**:

```qlik
SET max_date = Today();
LET row_count = NoOfRows('Sales');
```

---

## variable-charset

Restrict user-defined variables to a safe identifier charset.

### Rule Details

Qlik's tokenizer accepts almost anything as a variable name — leading `$`/`#`/`@`,
trailing dots, consecutive dots, non-ASCII letters, and other characters that
would be rejected by virtually every other language. Names like `v$Path`,
`vFoo.`, or `vÖÄÜ` parse without an error but read poorly, break grep,
trip up surrounding tooling, and turn into a different variable on every typo.

The rule checks the identifier that follows each `SET` / `LET` keyword and flags
it when it falls outside an opinionated, conservative charset:

- The name consists of one or more segments separated by dots (for the common
  Qlik namespacing convention like `vL.LocalVar` or `vG.Sys.Path`).
- Each segment must start with an ASCII letter or underscore and may then
  contain ASCII letters, digits, and underscores.

Consequences of that pattern: leading dot, trailing dot, consecutive dots,
segments starting with a digit, and any character outside `[A-Za-z0-9_.]` are
all rejected. Qlik system variables (such as `DateFormat`, `ThousandSep`,
`ErrorMode`) are recognised by the lexer as a distinct token type and are
intentionally excluded — their names are fixed by the platform.

There is no autofix: there is no mechanical way to rewrite `v$Path` or
`vÖÄÜ` into a sensible replacement without changing meaning.

This rule is complementary to [variable-case](#variable-case): casing and
charset are independent concerns. `vFüßBär` is valid camelCase, but its
characters are still outside the safe charset.

Examples of **incorrect** code for this rule:

```qlik
SET vFoo. = 1;
LET vL..Bar = 2;
Set v$Path = 'x';
Let vÖÄÜ = 'y';
```

Examples of **correct** code for this rule:

```qlik
SET vYear = 2026;
LET _privateVar = 1;
Set vL.MyVar = 'ok';
Let vG.Sys.Path = 'y';

// system variables stay untouched
SET DateFormat = 'YYYY-MM-DD';
```

### Options

This rule has no options. The charset is intentionally fixed — making it
configurable would invite every project to redefine "valid identifier", which
defeats the point of an opinionated linter.

---
