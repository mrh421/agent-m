---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 2b1caa22795821a8ddb5a3109ab6a43e8cf07aea
  - https://github.com/akmaier/agent-m/pull/1414
date: 2026-10-29 07:27 UTC
---
# Development → Release testing: ITM-654, a fix shows each changed expectation, old beside new

**REGISTER**

## Reason

ITM-654, pull request #1414 into `sprint/team1/113`, passes on `2b1caa22`, its head when this was decided.

The Definition of Done is the default (SPEC.md:1870-1873).

1. **CI is green.** Run 40834975735, `pull_request`, on `2b1caa22` passes 38 of 38 pull-request jobs.
2. **Red first.** `1b836e75` adds only `tests/maintenance-pages-expectations-654.test.mjs`. Run 40834374117 fails one job,
   unit shard 3 (job 123315692397), in its two cases only. The implementation commit changes no test.
3. **Only its module changes.** `src/maintenance-pages/issues.mjs`, the header comment of `index.mjs`, and the new test,
   named MOD-maintenance-pages. As its Acceptance says, no test of another module changes.
4. **The Outcome is the accepted text.**
   - MOD-maintenance-pages.md:119: "before its pull request is merged, for each existing test whose expected result the
     fix changes, the requirement it now checks correctly with the old and the new expectation side by side".
   - It reads through `pullRequestFacts`, `isTestFile` and `testDeclarations`, which its Uses name for that (:179-184).
5. **The readings hold.**
   - **Two reads per changed test file,** through the facts' `read(path, side)`. That is the way MOD-repository-hosts'
     `PullRequestFacts` gives these texts (MOD-repository-hosts.md:136-140, :244-246).
     - A PAGE LOAD READS THE REPOSITORY IN BATCHES (SPEC.md:684-687) bounds a request to "at most 100 files". It does
       not forbid a request of one, and asks the batch at the start page, `#arc`, `#spec` and `#backlog`, which its
       Check counts.
     - A fix's pull request changes few test files.
   - **"Existing test"** as the same identifier on both sides, **the requirement** as the head declaration's guard, and
     **only while open,** follow "before its pull request is merged" and "the requirement it now checks".
6. **The reader.** On `2b1caa22`:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - `maintenance-pages-expectations-654`: 2 declarations, TST-654001 and 002, and 0 findings.

## Noted

- **The header comment of `src/maintenance-pages/index.mjs` reads "`branch-and-pull-request`)., and ITM-654 …".** That
  is a stray ")." to mend when the file is next touched.
- **The developer's two findings, both defects, both registered:**
  1. **ITM-1303.** TST-583207 (`tests/maintenance-pages-fix-583.test.mjs:288`) fakes no facts for its open pull request.
     So with ITM-654, its page draws "The fix could not be read" (`issues.mjs:414`), and the test, which does not look
     for it, passes. The fixture is to give the facts, and the test to state that no problem is drawn.
  2. **ITM-1304.** A declaration's value continued onto a further comment line is cut at its first line. That follows
     the text: "each following line is `key: value`" (MOD-test-document.md:45), and a declaration "ends at the first line
     that is not a comment line of this form" (:68).
     - Over `tests/`, 417 key lines in 147 files run onto the next line, 407 of them `expect:`.
     - So ITM-654's comparison sees the first line of each such `expect`, as the text gives it. A change below that
       first line is not shown.
