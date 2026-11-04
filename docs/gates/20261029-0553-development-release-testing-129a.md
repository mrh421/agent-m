---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - b5946c1864763a5bcd35024be8c2090efce36c3e
  - https://github.com/akmaier/agent-m/pull/1403
  - docs/backlog/ITM-1274-the-specification-reads-what-each-waiting-entry-changes-not-its-rationale.md@1eb05951c
date: 2026-10-29 05:53 UTC
---
# Development → Release testing: ITM-1274, the specification reads what each waiting entry changes, not its rationale

**REGISTER**

## Reason

ITM-1274, pull request #1403 into `sprint/team1/112`, passes on `b5946c18`, its head when this was decided. The item is
read as it stands on `main`: it names MOD-spec-changes, MOD-trace-pages and, for two cases of `load-per-view`,
MOD-site-frame.

The Definition of Done is the default (SPEC.md:1870-1873), with AN IMPLEMENTATION JOB CHANGES ONLY ITS MODULES
(SPEC.md:1478-1481).

1. **CI is green.** Run 40825495989, `pull_request`, on `b5946c18` passes 38 of 38 pull-request jobs.
2. **Red first.**
   - `07e9e52a` changes only tests: the new `tests/spec-changes-entry-impact.test.mjs`, and TST-1274003 appended to
     `tests/trace-pages-specification.test.mjs`.
   - Run 40824339410 fails two jobs, unit shards 16 (job 123283858698) and 12 (job 123283858833), in TST-1274001 to 003
     only.
   - The middle commit `ae98ea9e` failed `review-pages-read-problem` (run 40825039036), because `entryView` read an entry's
     files twice. `b5946c18` mends that in the code, and the test is not touched.
3. **Only what the item allows changes.**
   - Code: `src/spec-changes/accept.mjs` and `index.mjs`, and `src/trace-pages/flow.mjs`.
   - Tests: the two new ones, named MOD-spec-changes and MOD-trace-pages.
   - Of `tests/load-per-view.test.mjs` (MOD-site-frame), only the two `#spec` cases the ruling allowed change
     (`:181`, `:203`). The fourth batch, the rationale, is dropped from their expected batches, with their titles and
     comments. No other case changes.
4. **The reading of "the impact list as `entryImpact` gives it" holds.** MOD-spec-changes.md:188 states what `entryView`'s
   impact list is, not how it is computed.
   - The one definition `impactOfTexts` serves both. `entryView` gives it from the texts it has read already, so that no
     file is read twice.
   - `tests/spec-changes-entry-impact.test.mjs:111` asserts `view.impact` deep-equal to `entryImpact`'s, and `entryImpact`
     "reads no rationale" (:190-191), checked against a known positive of `entryView` reading it (`:88-89`).
   - `entryImpact` is exported from `index.mjs`, as MOD-spec-changes' `provides:` names it (:57).
5. **The reader.** I ran MOD-test-document's `testDeclarations` and `testFindings` on the PR's checkout:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - `spec-changes-entry-impact`: 2. `trace-pages-specification`: 31. `load-per-view`: 10.
   - All with 0 findings.

## Noted

- **The new expectations of the two `load-per-view` cases were changed in the implementation commit,** not in the
  tests-only one. The first commit still holds only tests and is red, as AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST
  asks (SPEC.md:1462-1464). A changed expectation is shown red best in the first commit.
- **One sentence of the first case's comment is wrong** (`tests/load-per-view.test.mjs`, the `#spec` case at `:181`). It
  says the open entry's impact list "is made from the stored graph and from nothing else". The sentence before it says
  the list is made "from its proposal and target", and the graph gives only the `referencedBy`
  (MOD-spec-changes.md:190-193). The assertions are right, so this does not fail the gate. The sentence is to be mended
  the next time the case is touched, by ITM-1260 or the release tests.
