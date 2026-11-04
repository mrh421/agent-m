---
id: ITM-1323
title: Accept ticked and Accept all N shown put the modules each use case changes into the backlog, tested at release
level: module
realises:
  - UC-008
  - ACCEPTING A USE CASE PUTS THE MODULES IT CHANGES INTO THE BACKLOG
  - SEVERAL FILES ARE ACCEPTED IN ONE CLICK
modules:
  - MOD-review-pages
builds_on:
  - ITM-1319
tests:
  - release
origin:
  - po-opus-c's gate Release testing → Sprint review of sprint 128 (docs/gates/20261030-1930-release-testing-sprint-review-e128.md, point 5), and team1's sprint 128 Review (docs/backlog/sprints/team1/128.md)
---
# ITM-1323 Accept ticked and Accept all N shown put the modules each use case changes into the backlog, tested at release

**REGISTER**

## Outcome

ITM-1319 built the check of affected modules for three ways to accept use cases. In a product that declares a pulled
model, the code runs one job of `check-affected-modules` for each use case an acceptance recorded, after:
- a file's *Accept* (`src/review-pages/flow.mjs:648-653`);
- the list's *Accept ticked* (`:297-303`);
- Review all's *Accept all N shown* (`:442-447`).

Only the first is clicked by a test: TST-1319004 and the release case TST-1319201. TST-1319002 draws the notes beside
*Accept ticked* and *Accept all N shown* and does not click. The case of `tests/load-per-view.test.mjs` that clicks
*Accept all 3 shown* runs in a product without a declaration. #1535 named the gap ("Not covered").

With this item, release cases click the other two:
- *Accept ticked* with two use cases ticked;
- *Accept all 2 shown* on Review all.

In a Scrum product, each click writes the acceptance's one commit with both records. Then, for each of the two use
cases, it commits the items of the modules the checking participant names, each item realising its use case. No item
stands before the acceptance's commit.

## Readiness

It is ready. It writes one test file and no code:
- the texts are accepted: UC-008 3d, 3e and step 6, and MOD-review-pages' text that ITM-1319 built;
- the behaviour is built on `main`.

Its writer is a participant who implemented none of ITM-1319 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). Its
identifiers are TST-1319205 and onward. The history was searched, and no commit names TST-131920[5-9] or
TST-13192[1-9]; the same search finds TST-1319204's commit, `65b879c7c`, its known positive.

## Acceptance

- A release test file of MOD-review-pages, in the world of `tests/review-pages-draft-world.mjs` as
  `tests/release-itm-1319-accepting-adds-items.test.mjs` uses it:
  - *Accept ticked* over two open use cases of a Scrum product writes one commit with two approval records, then items
    for each use case, each realising that use case and naming one module the checking participant answers;
  - *Accept all 2 shown* does the same;
  - counter-proof: in a V-model product, either click writes the acceptance's commit alone and asks no participant.
- Each case's planted fault is recorded in the pull request: the job run only for the first use case recorded, and the
  check not run on that path.
- Only the new test file changes. CI is green on it, since the behaviour is built.
