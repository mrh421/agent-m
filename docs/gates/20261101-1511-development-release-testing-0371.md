---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 6300b51c5e1a9ec8f9b156e019b5da9ef9590a08
  - https://github.com/akmaier/agent-m/pull/1675
date: 2026-11-01 15:11 UTC
---
# Development → Release testing: ITM-371, #1675, the system and release tests of UC-006

**REGISTER**

## Reason

ITM-371 was written by developer-sonnet-j (`Agent-M-Participant` on `6300b51c5`). I wrote none of it.
1. **No failing first commit:** a battery adds no behaviour (142.md, *Readings taken*).
2. **CI is green on the head:** run 41319502439 (`6300b51c5`), at the first attempt. `git merge-tree` with the sprint
   branch's head is clean.
3. **Only new test files:** `tests/uc-006-harness.mjs`, `tests/system-uc-006-decide-an-entry.test.mjs` (TST-371201 to
   371212) and `tests/release-uc-006-approve-a-specification-change.test.mjs` (TST-371301 to 371320). MOD-test-document
   reads 32 declarations with no finding; TST-3712nn and 3713nn had no history (known positive: TST-371001).
4. **Who wrote what it tests.** sonnet-j built ITM-1315, ITM-659 and ITM-1274. It wrote no release case of their
   behaviour: `A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST` is mapped to sonnet-l's TST-479201 and 1274301, and
   `WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK` is left out of sonnet-j's cases (`LEFT` of TST-371301).
5. **The Acceptance holds:** TST-371201 maps the main flow, 3a, 3b, 4a to 4d, 5a and the postcondition, the three older
   system files of UC-006 among them; TST-371301 maps the 21 requirements UC-006 realises. The pull request records 37
   planted faults; every case but the two maps fails on one. TST-371204's fault hangs the run, so its catch is the timeout.

## Ruled

- **The fallback without a token.** The Acceptance asks a release test for every requirement UC-006 realises. Its release
  test is TST-372304 (`tests/release-uc-008-review-and-accept-a-use-case.test.mjs`), passed at ITM-372's gate, and the
  SPEC-entry page's fallback is walked by the system cases TST-371005, 371208 and 479105. Read as mapped; no case is added
  now.

## Readings taken

- "Who decided" is the commit made with the person's token.
- `A RULE IS CHECKABLE` and `NO STATE IN THE SPECIFICATION` are checked at review only.
- 4b is read for the instance.
- The Why is an input of *Save*.
- 4d "offered only together": the entry's page offers no *Accept* and names the entry that creates the anchor.

All are taken.

## Noted

- `spec-entries.mjs`' `described` holds a branch "waiting, createdBy null" that no queue reaches, since `queues.mjs` marks
  an entry waiting only when another creates its anchor (MOD-review-pages). No behaviour is wrong; no item.
