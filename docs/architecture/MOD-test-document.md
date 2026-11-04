---
id: MOD-test-document
title: The declaration of a test case
folder: src/test-document/
realises:
follows:
  - ARC-048
uses:
  - MOD-identifiers.kindOfIdentifier
  - MOD-text-tools.finding
  - MOD-text-tools.Finding
provides:
  - TestDeclaration
  - isTestFile
  - isNamedTestFile
  - testDeclarations
  - unidentifiedDeclarations
  - testFindings
  - testHeader
---
# MOD-test-document The declaration of a test case

## Responsibility

It belongs to the artifact model (ARC-048). It owns the form in which a test case declares itself inside a test file of
any language — its identifier, its one level, what it guards, the module it exercises, its precondition, input and
expected result — so that what a test checks can be read without running it (`A TEST STATES ITS EXPECTED RESULT BEFORE IT
RUNS`), and it checks these declarations. It also owns the header in which a test file or a test helper names the module it
exercises, what it guards and its level. It runs in a browser and in Node, and performs no input or output.

## Parts

- `index.mjs` — the interface.
- `declarations.mjs` — finding the declarations in a file.
- `checks.mjs` — the findings of a declaration.
- `header.mjs` — the header of a test file or a test helper.
- **Taken over, outside this folder** (`CODE OUTSIDE THE ARCHITECTURE IS MOVED INTO IT`; the count in `docs/measurements/2026-10-17_code-outside-every-module.md`). Each file goes as stated, in this module's own implementation jobs:
  - `tests/jsrun.py`: moved in as the runner by which the Python tests call the code of the modules: a test of any language is this module's concern, and no other module states it.
  - `tests/test_test_levels.py`, `tests/test_release_sprint_02_c.py`, `tests/test_test_battery.py`, `tests/test_rate_reporting.py`: their headers name this module.

## Data

It keeps nothing. It owns the **test declaration**: a block of comment lines directly before a test case, in the
comment marker of the file's language — `//`, `#`, `--`, `;` or ` *` inside a block comment —, or, for a manual test of
level `user`, the same lines under a heading `### TST-<nnn> <title>` in a Markdown file. Its first line names the
identifier; each following line is `key: value`.

```text
// TST-014 · level: unit · module: MOD-text-tools
// guards: A FINDING READS LIKE A COMPILER MESSAGE
// given: a finding of kind error on line 4 of UC-007
// input: the finding formatted as text
// expect: "UC-007:4: error: … [A FINDING READS LIKE A COMPILER MESSAGE] — …"
```

| Key | Holds | Required |
|---|---|---|
| `TST-<nnn>` | the test case's identifier, on the first line | yes |
| `level` | one of `unit`, `component`, `system`, `release`, `user` (`EVERY TEST HAS ONE LEVEL`) | yes |
| `module` | the module it exercises, `MOD-<slug>`; for a test of level `system`, `release` or `user`, which exercises the whole product, the word `system` | yes |
| `guards` | the requirements it guards by name, or use cases by identifier, separated by `;` | yes |
| `given` | the precondition | yes |
| `input` | the input | yes |
| `expect` | the expected result | yes |
| `runs` | for a test whose outcome depends on a model's answer, the number of runs, fixed before the first | for such a test |
| `phrasings` | for such a test, how many phrasings of the same question it holds | for such a test |
| `paid` | the name of a paid service it calls, if any | when it calls one |

A declaration ends at the first line that is not a comment line of this form.

The **title** of a declaration is, for a manual test, the heading's `<title>`; for a test in code, the name the test case
gives itself on the first line after the declaration — its first string literal, or else the name it defines —; none
where neither is found.

A **test file** is a file under a folder named `test`, `tests` or `__tests__`, or a file named as tests are named in its
language — such as `*.test.mjs`, `test_*.py` or `*_test.go` —; a Markdown file under such a folder holds manual tests.

The **header** of a test file that is no Markdown file — a test or a test helper — is its lines `Module: MOD-<slug>`,
`Guards: <name>[; <name> …]` and `Level: <level>` among its first 20 lines, each after the comment marker of the file's
language; a line that begins with a letter, a digit or a quote is no header line. `Module:` names the module it exercises,
`Guards:` what it guards — requirements by name, use cases by identifier, separated by `;` — and `Level:` its one level.

## Interfaces

- `TestDeclaration` — `{ id: string | null, title: string | null, level: "unit" | "component" | "system" | "release" | "user", module: string | null,
  guards: string[], given: string | null, input: string | null, expect: string | null, runs: number | null, phrasings:
  number | null, paid: string | null, path: string, line: number }`; `module` is a module's identifier or the word
  `system`; `id` is `null` only in a declaration `unidentifiedDeclarations` gives.
- `isTestFile(path: string) -> boolean` — whether a path is a test file as defined under Data.
- `isNamedTestFile(path: string) -> boolean` — whether a path is named as tests are named in its language, as defined
  under Data, wherever it lies: the test files a test runner runs, as against a helper, a fixture or a Markdown file of
  manual tests, which are test files by their folder alone.
- `testDeclarations(path: string, text: string) -> TestDeclaration[]` — every declaration in a test file, in order. It
  never throws on content: a declaration missing a key is read with that key `null`, and `testFindings` names it. A file
  with no declaration yields none; the caller decides whether that is a gap.
- `unidentifiedDeclarations(path: string, text: string) -> TestDeclaration[]` — every block of comment lines in a test
  file that is written as a declaration but whose first line names no identifier — in its place, `key: value` parts with
  keys of the declaration, such as `// level: unit · module: MOD-text-tools` —, in order, each read as a declaration is
  read, with `id` `null`, its `path` and its `line`; `testDeclarations` gives none of them. It never throws on content.
- `testFindings(declaration: TestDeclaration) -> Finding[]` — an error under `EVERY TEST HAS ONE LEVEL` for a missing or
  unknown level; under `A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS` for a missing precondition, input or expected
  result; under `EVERY ARTIFACT NAMES ITS ORIGIN` for a test that guards nothing or names no module, or a test of level
  `unit` or `component` that names `system`; under `A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION` for each `guards` entry
  that is neither a requirement's name nor a use case's identifier — a use case written with its step, such as
  `UC-005 (alternative flow 6a)`, is none —, naming the test and the entry, from the first declaration read: a header that
  writes such an entry fails it; under `A MODEL-DEPENDENT TEST IS MEASURED AS A RATE` for a test with `phrasings` and
  no `runs`, or with fewer than two runs. Whether a guarded name exists, and whether a commit-level test calls a paid
  service, need the graph and the schedule; they are decided by MOD-trace-graph and by the test schedule's owner.
- `testHeader(path: string, text: string) -> { modules: string[], guards: string[], level: string | null, findings:
  Finding[] } | null` — the header of a test file as defined under Data: the modules its `Module:` lines name and the names
  its `Guards:` lines guard, each once and in order; the value of its one `Level:` line, `null` without one or with more
  than one; and an error under `EVERY TEST HAS ONE LEVEL`, naming the file by its path, for a header with no `Level:` line,
  with more than one, or with a level outside the five. `null` for a path that is no test file and for a Markdown file. It
  never throws on content.

## Files

It reads and writes no file; its callers give it the texts of test files.

## Uses

- `MOD-identifiers.kindOfIdentifier` — whether a `guards` entry is a requirement's name or a use case's identifier.
- `MOD-text-tools.finding` and the type `MOD-text-tools.Finding` — the findings it reports.
