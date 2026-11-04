---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 49eec10702ccb094e84a0b1e08373fae081c0ccf
  - https://github.com/akmaier/agent-m/pull/1398
  - docs/backlog/ITM-1268-the-last-accepted-text-is-read-as-one-file-at-one-commit.md@23c1821b8
date: 2026-10-29 03:47 UTC
---
# Development → Release testing: ITM-1268, the last accepted text is read as one file at one commit

**REGISTER**

## Reason

ITM-1268, pull request #1398 into `sprint/team1/111`, passes on `49eec107`, its head when this was decided. The item is
read as it stands on `main` at `23c1821b8`.

The Definition of Done is the default (SPEC.md:1870-1873), with AN IMPLEMENTATION JOB CHANGES ONLY ITS MODULES
(SPEC.md:1478-1481).

1. **CI is green.** Run 40813147384, `pull_request`, on `49eec107`, attempt 2, passes 38 of 38 pull-request jobs. Two
   set-up jobs of attempt 1 were cancelled by a timeout downloading an action, and were rerun.
2. **Red first.**
   - `e832e238` changes only tests: the new `approvals-last-accepted-one-file`, `approvals-last-accepted-requests`,
     `load-per-view` and `review-page`.
   - Run 40812653997 fails, in four jobs (123246432127, 123246432246, 123246432313, 123246432354), only these 7 cases:
     - the 3 cases of the new file;
     - `approvals-last-accepted-requests` (GitHub);
     - `#review/uc` and "opening one use case …" of `load-per-view`;
     - the `#review/arc` count of `review-page`.
   - The implementation commit `49eec107` changes no test.
3. **Only what the item allows changes.**
   - `src/approvals/status.mjs:162` now reads `host.readSnapshot(last.commit, { folders: [file] })`.
   - `pagesHost().readSnapshot` in `src/site-frame/dashboard-app.mjs` hands `options` on to the real host, and returns
     the load's snapshot only for the load's `ref` with no `folders` named.
   - The tests are MOD-approvals' and the cases of `load-per-view` and `review-page` (MOD-site-frame) that count the
     reads of a changed file's last accepted text.
4. **The options reaching the real host are shown, with the counter-proof the Acceptance asks.**
   - `load-per-view`'s "opening one use case …" asserts `srv.folders.at(-1)` is `[UC2]`, and the era's requests are
     `era commit` and `era file`, with no era tree.
   - I planted the wrapper as it stands on `sprint/team1/111`, the approvals change kept, in the PR's checkout. The case
     and `#review/uc` fail, "the older commit is asked for the file alone: the options reach the real host" (2 fail).
     Restored, both pass.
5. **The reader.** I ran MOD-test-document's `testDeclarations` and `testFindings` on the PR's checkout:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - `approvals-last-accepted-one-file`: TST-1268001 to 003, 0 findings.
   - `approvals-last-accepted-requests`: TST-929001 to 003, 0 findings.
   - `load-per-view`: 10 declarations, TST-1266101 to 110, 0 findings.
   - `review-page`: 0 declarations. Its cases carry no TST identifier on `sprint/team1/111` either, so this PR does not
     change that.

## Noted

- `tests/review-page.test.mjs` and `load-per-view`'s "opening one use case …" are cases without a TST identifier, so the
  reader and the traces do not see them. That predates this item, and is for a new item.
