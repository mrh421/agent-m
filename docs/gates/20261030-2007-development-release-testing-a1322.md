---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - b9e64731780b87a328e1854af36de3b1d7d7b250
  - https://github.com/akmaier/agent-m/pull/1537
date: 2026-10-30 20:07 UTC
---
# Development → Release testing: ITM-1322, the prompt bar's one-kind tests guard use cases by their identifier

**REGISTER**

## Reason

ITM-1322, pull request #1537 into `sprint/team1/129`, passes on `b9e64731`, its head and only commit when this was
decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1875-1880).

1. **CI.** Run 41118985001 (`pull_request`, attempt 1) on `b9e64731` succeeds: 41 jobs succeed, 17 are skipped, and none
   failed.
2. **No failing first commit is due.** AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST (SPEC.md:1460-1463) binds a job
   "that adds or changes behaviour". This one changes four comment lines of one test file. It changes no case body, no
   assertion and no code, so no first commit can be red. That is the reading the item states ("One commit … CI is green
   on it, since no expected result changes"). The DoD's clause is read with that sentence.
3. **Only the item's file changes:** `tests/prompt-bar-one-kind.test.mjs`, +7 −5, by developer-sonnet-k
   (`Agent-M-Participant`).
   - The header's one `Module:` line becomes three: MOD-prompt-bar, MOD-trace-pages and MOD-site-frame.
   - TST-1360003 now guards `UC-049; UC-019; THE PERSON WHO PROMPTS IS A SOURCE`. "(UC-019 step 4b)" moves into its
     `expect`.
   - TST-1360004 now guards `UC-049; A PARTICIPANT THAT WRITES TO A REPOSITORY NEVER RECEIVES A MAIL`. "(UC-049 step
     3b)" moves into its `given`.
4. **MOD-test-document's reader,** in an export of `b9e64731`:
   - The file has 5 declarations and 0 findings, and its header gives `["MOD-prompt-bar","MOD-trace-pages","MOD-site-frame"]`
     at level `component`.
   - Known positive: on `main` at `4c27ee9e2` the same reader gives 2 findings under A REFERENCE NAMES THE IDENTIFIER,
     NOT THE POSITION, for the guards entries "UC-019 4b" (TST-1360003) and "UC-049 3b" (TST-1360004). Its header there
     gives one module.
   - The control, `tests/release-itm-1254-issue-move.test.mjs`, has 4 declarations and 0 findings.
5. **Every case passes as before.** `node --test` on the file in the export: 5 tests, 5 pass, 0 fail.
6. **No repeat is added.** The repeat reading over 1,485 test files finds 5,805 declarations and 2 repeats on `b9e64731`.
   Those are TST-1290001 and TST-1290002, the same 2 as on the base, which ITM-1324 removes. No identifier changes here.

## Noted

- **The developer's point: TST-1360004's and TST-1360005's own `module:` lines join two modules.** They read
  "MOD-prompt-bar · MOD-job-runner" and "MOD-trace-pages; MOD-prompt-bar". Ruled: out of this item's scope, noted, and
  no item.
  - The item's Outcome and Acceptance name the two `guards` lines and the file's header, and nothing else. YAGNI.
  - It is not particular to this file. Over the 5,805 declarations of the repository, 275 in 58 files name more than one
    module in `module:`, the gate's own control among them (TST-1254301 to 1254304).
  - MOD-test-document's `testFindings` names no finding for it, so nothing here fails a rule its check reads.
