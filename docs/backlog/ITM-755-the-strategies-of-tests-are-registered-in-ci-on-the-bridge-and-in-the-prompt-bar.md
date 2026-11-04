---
id: ITM-755
title: The strategies of tests are registered in CI, on the Bridge and in the prompt bar
level: module
realises:
  - UC-026
  - UC-027
  - UC-028
  - ONE DEFINITION, THREE DRIVERS
modules:
  - MOD-workflow-entries
  - MOD-desktop-shell
  - MOD-prompt-bar
builds_on:
  - ITM-747
  - ITM-754
  - ITM-586
tests:
  - unit
origin:
  - akmaier's request of 2026-10-17 to implement UC-021 to UC-035
  - ITM-572's reading: "The others (… scheduleStrategies, resultStrategies …) join as the items that build them add them"
built_by:
  - dbf9956a0fc2632cd4a504f8ab099b1c9b1974f6
  - 6da35df1bc4b5e29453b9f11f8e25dc5dcca9e86
---
# ITM-755 The strategies of tests are registered in CI, on the Bridge and in the prompt bar

**REGISTER**

## Outcome

`scheduleStrategies` (ITM-747) and `resultStrategies` (ITM-752 to ITM-754, ITM-586) are added to three lists:
- `OFFERED` in `src/workflow-entries/compose.mjs`;
- `STRATEGIES` in `src/desktop-shell/compose.mjs`;
- `handOverStrategies` in `src/prompt-bar/hand-over.mjs`.

Then a job of the kinds `set-up-ci`, `propose-tests`, `write-tests` or `run-tests` finds its strategies on CI, on a
Bridge and in a hand-over. Without this, a CI agent's `propose-tests` job (MOD-test-pages' `generate`) fails with
`UnknownStrategy`.

**On a page, since `ac9378ef`,** `registerViews` (`src/site-frame/register.mjs`) registers every view's strategy sets at
load, each set once — MOD-test-pages' view with `scheduleStrategies` and `resultStrategies` among them
(`src/test-pages/index.mjs:19`) —, and the prompt bar's `handOverStrategies` beside them. A set already registered on the
load is skipped, so adding the two sets to `handOverStrategies` adds no `DuplicateStrategy` on the page.

## Acceptance

- In each of the three places, `prepareJob` of each of the four kinds finds every strategy it names, and each set is
  registered once.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only the three modules' folders and the tests that name them change.
