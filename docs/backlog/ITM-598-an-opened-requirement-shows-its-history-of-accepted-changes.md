---
id: ITM-598
title: An opened requirement shows its history of accepted changes
level: module
realises:
  - UC-020
  - A REQUIREMENT SHOWS ITS HISTORY
modules:
  - MOD-spec-changes
  - MOD-trace-pages
builds_on:
  - ITM-597
tests:
  - unit
  - component
origin:
  - the coverage of UC-001 to UC-020 (docs/measurements/2026-10-16_coverage-uc-001-020.md), at akmaier's request of 2026-10-16
---
# ITM-598 An opened requirement shows its history of accepted changes

**REGISTER**

## Outcome

UC-020 step 5 (history) and 5d. `requirementHistory` is in MOD-spec-changes' file but not built (`src/spec-changes/index.mjs:3-4`).

**The reading of 2026-10-17 (sprint team1/63): it waits for ITM-597's merge,** whose opened requirement shows the history.
- `requirementHistory(name, host)` is stated in MOD-spec-changes' file, and its part `history.mjs` is not built.
- It reads through `MOD-repository-hosts.readHistory`, which MOD-spec-changes' Uses names. That call is built with real
  calls on both hosts (`github.mjs:202-219`, `gitlab.mjs:162-179`).
- `readHistory` gives a file's commits, not a section's. So the history reads `SPEC.md` at each commit through
  `readSnapshot` and keeps the commits where the requirement's text changed.

**Settled at sprint team1/66's start.** ITM-597 is merged, so it is selectable.
- **The modules whose files it changes** (sprint 65's agreement):
  - MOD-spec-changes: a new `src/spec-changes/history.mjs`, the part its file names; `index.mjs`'s export; and the
    "not built yet" lines of `index.mjs:3-4` and `queues.mjs:21`.
  - MOD-trace-pages: `flow.mjs`, the opened requirement's history.
  - No topic is added, so MOD-site-frame is not changed. UC-020's folded "why a requirement has a history of approvals"
    is ITM-602's.
- **The grep of what goes**, with its full output read: `grep -rn requirementHistory src tests docs/architecture` finds
  - the two "not built yet" comments above;
  - the declaration in MOD-spec-changes' file (:55, :197);
  - ARC-041:104;
  - MOD-trace-pages' Uses (:38, :148);
  - a fixture backlog item under `tests/fixtures/`, which is data.

  No test asserts that the function is absent.
- **The rule is MOD-spec-changes' text** (`requirementHistory`, Interfaces): every accepted change, oldest first, with the
  date and person of the accepting commit, its record, and the text before and after. A section written before any
  record shows the commit that introduced it, with `record: null`.
  - It reads through `MOD-repository-hosts.readHistory` and `readSnapshot`, both in MOD-spec-changes' Uses.
  - The view calls `requirementHistory`, in MOD-trace-pages' Uses, and computes nothing of it.
- **When it is read:** on opening a requirement, like ITM-597's graph, and kept per version and name. Drawing `#spec`
  does not grow.
- **Measurement** (sprint 59): the pull request states the requests of opening one requirement's history on this
  repository, with and without a token, on base and head. The bound stays ITM-574's.
- **At a tag:** the history up to that tag, as `ref` gives it.
- **The expected results that change** (sprint 64): the developer runs both modules' tests and their callers', release
  tests included, on a draft, and lists every changed one before the tests-only commit.
- **DOM assertions** (sprint 65): compare a boolean or a string, never a node.
- **Reachable:** the live `#spec`, as ITM-597.
- **Its tests guard `A REQUIREMENT SHOWS ITS HISTORY`** by name in `tests/trace-pages-specification.test.mjs` (queue
  `2026-10-17c`), and the function's own tests are in a test file of MOD-spec-changes.

## Acceptance

- Every accepted change of a requirement's text is shown with its commit.
- A requirement older than its records shows the commit that introduced it.
- Its tests in `tests/trace-pages-specification.test.mjs` guard `A REQUIREMENT SHOWS ITS HISTORY` by name (queue `2026-10-17c`).
- The first commit holds only the tests, and CI is red on it. No stub is committed.

**At its gate on #697 (`docs/gates/20261017-0634-development-release-testing-3c18.md`)** the history cost 380 requests
per first opening of a requirement on this repository, 286 of them API calls on the person's token; without a token it
could not load. Pull request #697 is still open.
- ITM-652 is merged (#1042): MOD-repository-hosts gives `readFileAt` (`src/repository-hosts/index.mjs:182`) and
  `readHistory(…, { changes: false })` (`src/repository-hosts/github.mjs:314-315`).
- MOD-spec-changes' Uses name `readFileAt` (`docs/architecture/MOD-spec-changes.md:16`, `:266`). So `requirementHistory`
  reads `SPEC.md`'s commits in one request per page, and their texts in batches.
