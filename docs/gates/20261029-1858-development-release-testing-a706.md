---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 85e1152fb5988677698abfe455c26144a519a397
  - https://github.com/akmaier/agent-m/pull/1476
date: 2026-10-29 18:58 UTC
---
# Development → Release testing: ITM-706, the release tests tell a write in one place

**REGISTER**

## Reason

ITM-706, pull request #1476 into `sprint/team1/122`, passes on `85e1152f`, its head and only commit when this was
decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1869-1874). The item is declared as refactoring, so CI is green on every
commit and no expected result changes.

1. **CI is green on every commit.** `85e1152f`: run 40932322784 (`pull_request`, attempt 1) succeeds, 58 jobs, 17
   skipped, none failed.
2. **Only the item's files change:** `tests/app-harness.mjs` (MOD-site-frame), `tests/release-sprint-15-spec-toggles.test.mjs`
   and `tests/system-sprint-14-spec-overview.test.mjs` (MOD-trace-pages), the three files `team1/122.md` names for it.
   No code of a module changes.
3. **One function tells a write, and no file keeps a copy.** `writeRequests(server)` stands in `tests/app-harness.mjs`,
   beside its other exports, with the release file's rule moved unchanged: every request that is not a GET, except the
   batch `POST …/graphql`. Both files import it, and neither holds `BATCH_OF_READS` or a local `writes` any more.
4. **No expected result changes.** In both files only the import and the name of the function called change. The
   expected values (`[]` and `0`) and the messages stand as they were. TST-472518's and TST-473080's declarations are
   untouched.
   - The system file now leaves the batch of reads out of its writes, which is the item's Outcome: before, it "would count
     that batch as a write". Its expected result, no write, is unchanged.
5. **Its counter-proof is recorded in the pull request:** a planted `POST …/issues` through the page's fake fails the
   release file (`actual: [ 'other POST …/issues' ], expected: []`) and the system file (`actual: 1, expected: 0`).
   - My probe of the shared rule on the head: of a write `POST …/issues`, a batch `POST …/graphql` and a `GET`, it gives
     the `POST …/issues` alone.
6. **Checked by me on `85e1152f`.**
   - The two files and `tests/test-document-one-line.test.mjs`: 4 pass, 0 fail.
   - MOD-test-document's reader: TST-472518 (release, MOD-trace-pages) and TST-473080 (system, MOD-trace-pages), 0
     findings, headers without findings. Its control, `tests/release-itm-1254-issue-move.test.mjs`, gives 4 declarations
     and 0 findings. No declaration is new or changed, so there is no `given`, `input` or `expect` to print.
   - `tests/app-harness.mjs` holds no declaration. Its header has one finding, no `Level:` line, on the head and on the
     sprint's base alike: the pull request does not touch its first 20 lines.
   - My planning run of the same change over the 84 files that import `tests/app-harness.mjs` gave 536 pass and 0 fail,
     with and without it.
7. **"Each passes on the base and on ITM-574's head."** ITM-574 was merged in sprint team1/72 (#728). Its change has
   stood in every base since, and `0e928b61b`, the sprint's base, holds it. So the base is a head that holds ITM-574's
   change, and both files pass there and on this head. Its own head of then, before the files' later changes, is not a
   base the item can be read against today; the clause was written while ITM-574 was open.

## Noted

- The developer's local broad run stopped at a file that hangs on that machine; CI ran every job.
- Release testing of ITM-706 needs no release test: it changes no behaviour.
