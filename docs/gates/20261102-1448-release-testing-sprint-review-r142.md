---
gate: Release testing → Sprint review
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 40b28039c3b38fc4b94fe2ad028b3d769ec5b87b
  - https://github.com/akmaier/agent-m/tree/sprint/team1/142
date: 2026-11-02 14:48 UTC
---
# Release testing → Sprint review: the release tests of team 1's sprint 142

**REGISTER**

## Reason

1. **The release tests.** These are the files under `tests/` with release cases that this sprint added or changed, from
   the cut `33bdd42ae` to the head `40b28039c`:
   - 21 files named `release-…`, and their helper `release-run-world.mjs`;
   - ten Python checks with cases of level `release`: `test_audit_view`, `test_counter_proof`, `test_gate_record`,
     `test_job_assignment`, `test_job_gate`, `test_process_run`, `test_release_run`, `test_settings_disclosure`,
     `test_test_generation_context` and `test_time_box_close`.

   Four changed files were left out because they hold no release case: `release-evidence-audit` (unit cases),
   `test_prompted_change_context` (unit and system cases), and `review-pages-release-limitations` and
   `review-pages-release-reports` (unit cases whose fixtures declare `level: release`). The same `grep` finds the level
   `release` in the 32 files above, which is the known positive.
2. **They are not written by the implementer** (`RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER`). I checked the
   participant named in the trailers of each of the 37 commits that touch these files this sprint:
   - **The batteries**, each read at its gate against the trailers of its use case's code, with a release case of behaviour
     the writer built going to another participant:
     - UC-003 (sonnet-k, ITM-266);
     - UC-005 (sonnet-j, ITM-579);
     - UC-006 (sonnet-j, ITM-371);
     - UC-007 (sonnet-k, ITM-580);
     - UC-017 (sonnet-j, ITM-375);
     - UC-018 (opus-e, ITM-376);
     - UC-022 (sonnet-k, ITM-448);
     - UC-024 (opus-e, ITM-740);
     - UC-026 (sonnet-j, ITM-771, with `test_counter_proof` and `test_test_generation_context`);
     - UC-027 (opus-e, ITM-772);
     - UC-029 (opus-f, ITM-774);
     - UC-030 (sonnet-k, ITM-775, with `test_audit_view`);
     - UC-034 (sonnet-j, ITM-805, with `test_gate_record`, `test_job_assignment` and `test_job_gate`);
     - UC-041 (opus-e, ITM-991, with `test_time_box_close`);
     - UC-043 (sonnet-k, ITM-1045, with `test_process_run`).

     Their later commits change only their own new cases, after the counter-proofs their gates asked for.
   - **developer-sonnet-l** wrote every `todo` lift and every moved release expectation after the code was pushed: ITM-1385,
     1386, 1387, 1390, 1394, 1395, 1396, 1404, 1424, 1425 and 1442, TST-371318 and TST-1297301. It also wrote ITM-1434's
     `test_release_run.py` with `release-run-world.mjs`. sonnet-l built no item of this sprint: no commit under `src/` since
     the cut carries its trailer, while the same count finds opus-e (17), sonnet-k (14), opus-f (11) and sonnet-j (6).
   - **sonnet-k's ITM-1415** changed only the `given` of `release-itm-1275` and `-1276`, and no assertion. Those cases
     guard ITM-1275's and ITM-1276's behaviour, which sonnet-j built (ruled at `20261102-0953-…-1415`).
   - **sonnet-j's ITM-1429** declared identifiers in `test_settings_disclosure.py` for component cases only. It changed
     no release case.
3. **Green on the sprint branch.** Pull request run 41463472487 on `b37ff4404` (#1747) is green at attempt 1. Every one of
   its twelve `release-pull-request` shards passed. The sprint head `40b28039c` differs from that commit only in this
   record's file `142.md` and the gate record of #1747, so it holds no other test or code change. The push runs on
   `f7c377bc1` and `40b28039c` are green.

## Noted

- ITM-1441 (MOD-settings-pages) is still in progress. The Scrum Master states that it changes no release file. If it does,
  this gate is decided again on its merge.
- Left for akmaier, not built: ITM-1414, ITM-1397 and ITM-1406, which wait for the SPEC packages and the module-text
  drafts, and the items the state section of `142.md` names.
