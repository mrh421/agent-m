---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 5e2dd22c9fa262ac0506e9069358f64cd211f1b8
  - https://github.com/akmaier/agent-m/pull/1439
date: 2026-10-29 11:09 UTC
---
# Development → Release testing: ITM-1281, the start page reads the instance only for a card it derives

**REGISTER**

## Reason

ITM-1281, pull request #1439 into `sprint/team1/116`, passes on `5e2dd22c`, its head when this was decided.

The Definition of Done is the default (SPEC.md:1869-1874).

1. **CI is green.** Run 40862431176, `pull_request`, on `5e2dd22c` passes 38 of 38 pull-request jobs.
2. **Red first, with one deviation, checked again by me.**
   - **The run.** The tests-only commit `e08b9c56` is red in run 40861208389, in three jobs:
     - TST-1281001 and TST-943005 fail for the item's reason: the route reads the instance while every card has an
       overview;
     - TST-1169002 fails because TST-1281001's `given:` and `expect:` ran onto further comment lines. `5e2dd22c` joins
       them, with no word or assertion changed.
   - **TST-943005's changed expectation** (`main-page-home.test.mjs`: the instance's requests become none) stands in the
     tests-only commit, as the Acceptance names.
   - **The deviation.** The implementation commit `3c3527b2` also changes TST-1281001's last counter-proof, Agent M's own
     card. The red run never reached it, since the case failed before.
     - The tests-only version asserted that the requests to the instance are exactly its repository, the commit of main
       and its tree.
     - For Agent M's own card the instance is the card's own repository. So the card also reads its overview, its pull
       requests and its tags there, as before the item.
     - The new assertion counts each of the three reads exactly once. That is the count TST-684003
       (`main-page-root-entry`) makes of the same card.
   - **Nothing is weakened.**
     - What the Outcome bounds, the instance's commit and tree read once, is asserted exactly as before.
     - What the new form no longer forbids is the own card's reads of its own repository, which no text bounds and which
       the code did before the item.
     - The agreement asks that a changed expectation stand in the tests-only commit (`team1/116.md`, the brief). This is
       its second miss, after ITM-1276's. Noted for the review.
   - **The red, shown on the final tests.** I ran `main-page-home-instance` and `main-page-home` of `5e2dd22c` against
     `src/main-page/home.mjs` of `sprint/team1/116`. They run 41 pass and 2 fail: TST-1281001 and TST-943005, for the
     item's reason. On the item's code they pass.
3. **Only its module changes.**
   - Code: `src/main-page/home.mjs`.
   - Tests: the new `main-page-home-instance` and `main-page-home`, both named MOD-main-page.
   - As its Acceptance says, no test of another module changes, and no test is removed.
   - TST-684003 passes unchanged.
   - The code adds no import. It calls `repositoryInfo` and `readSnapshot`, which MOD-main-page's Uses name.
4. **The Outcome is the accepted text** (MOD-main-page.md:127-129). The instance's snapshot "is read only for a card
   drawn from that scope, once for all such cards, and for Agent M's own card; while every card has an overview, the
   route reads none of the instance".
   - `instanceOnce` reads the instance's repository information and its snapshot when a card first needs them, and
     keeps them for every other card.
5. **The behaviour on an unreadable instance is within the texts.**
   - Before the item, a failure to read the instance turned every card into an error card. Now only the cards that read
     the instance say so ("Agent M's own repository could not be read: …"). A card drawn from its stored overview is
     drawn.
   - MOD-main-page.md:111-112: "A card whose repository cannot be read says which". A card drawn from its overview
     reads nothing of the instance, so it has no reading that fails.
   - Its own repository is read, and a failure there still makes it an error card.
   - UC-046 names no flow for an unreadable instance.
6. **The reader.** On `5e2dd22c`:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - `main-page-home-instance`: 1 declaration, TST-1281001. `main-page-home`: 42.
   - Both with 0 findings.
