---
id: ITM-632
title: A part's sources are read in one place
level: module
realises:
  - RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS
modules:
  - MOD-job-runner
  - MOD-run-planner
  - MOD-work-plans
builds_on:
  - ITM-610
tests:
  - unit
origin:
  - ITM-610's gate (docs/gates/20261017-0155-development-release-testing-6b7e.md)
---
# ITM-632 A part's sources are read in one place

**REGISTER**

## Outcome

Three places compute which of `context.places.contents`' sources a file carries:
- MOD-job-runner's `sourcesOf(context, path)` (`src/job-runner/tools.mjs:79`, exported at `src/job-runner/index.mjs:25`),
  built by `b4d8b472`, which its tools' `withheld` calls (`tools.mjs:90`); `JobContext`'s JSDoc names `contents`
  (`index.mjs:50`);
- MOD-run-planner's `implementation-inputs` (`src/run-planner/inputs.mjs:64`), its own copy;
- MOD-work-plans' `architecture-and-model` (`src/work-plans/strategies.mjs:37`, `sourcesFor`), its own copy.

The rule is the same in each: the sources of every entry that names the path or a folder above it. What is left: the two
copies call MOD-job-runner's `sourcesOf` instead (nothing twice), and `sourcesOf`'s cases have their tests.

It waits for akmaier's acceptance of the draft committed with ITM-610's gate. That draft gives MOD-job-runner
`sourcesOf`, and the Uses of MOD-run-planner and MOD-work-plans name it.

**Existing tests.** The three callers' tests keep their expected parts and sources. Before the start, they are grepped for
the sources of a part, and listed.

**Settled at sprint team1/67's start, added as its third item. Selectable.**
- **The modules whose files it changes** (sprint 65's agreement):
  - MOD-job-runner: none for the code — `sourcesOf` stands in `tools.mjs:79`; its tests are added;
  - MOD-run-planner: `inputs.mjs:64`;
  - MOD-work-plans: `strategies.mjs:37`.
  - No topic is added.
- **The grep, full output read:** `grep -rn "sourcesOf\|places.contents\|places?.contents" src tests` finds:
  - the three computations above;
  - the comments at `run-planner/inputs.mjs:42` and `work-plans/strategies.mjs:29`;
  - the tests `tests/work-plans-architecture-and-model.test.mjs:115-118` and `tests/run-planner-inputs.test.mjs:153-157`,
    whose expected parts and sources stay.
  - It also finds other functions named `sourcesOf`, private to MOD-trace-pages (`flow.mjs:76`), MOD-spec-changes
    (`accept.mjs:215`), MOD-review-pages (`spec-entries.mjs:38`) and MOD-main-page (`jobs.mjs:33`). They read a
    product's links and register, which is another rule, and they stay as they are.
- **The rule is MOD-job-runner's text** (`sourcesOf`, accepted): "the sources of every `context.places.contents` entry
  that names the path or a folder above it". The three callers call it and keep no copy (nothing twice).
- **Reads, against the token budget** (sprint 66): none. It is pure.
- **The expected results that change** (sprint 64): none is expected. The developer runs the three modules' tests and
  their callers' on a draft to show it.
- **Reachable:** every job whose recipe gives parts, through `prepareJob`.

## Acceptance

- `sourcesOf` gives each case once: a path that a content place names, a folder above it, and neither.
- The three callers call it and copy no rule of their own.
- The first commit holds only the tests, and CI is red on it. No stub is committed.

**The draft it waited for is accepted** (akmaier, `b43da779`): MOD-job-runner's `sourcesOf` (accepted blob 7a7c5c8918aa). It is free of drafts; its readings are read at its start.

**Held (2026-10-17).** The auto-mode classifier denied the developer's first command, creating the item's branch, as
"[Modify Shared Resources]". The developer stopped, as sprint 66's agreement asks. The item holds until akmaier answers
the permission question.
