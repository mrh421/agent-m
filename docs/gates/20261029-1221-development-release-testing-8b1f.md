---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 6a5d7a9822b1d5055a6772127126fa30cae883ee
  - https://github.com/akmaier/agent-m/pull/1445
  - docs/gates/20261029-1159-development-release-testing-3775.md
date: 2026-10-29 12:21 UTC
---
# Development → Release testing: ITM-1306, the tests that stage Electron do not flip on a registry fault

**REGISTER**

## Reason

ITM-1306, pull request #1445 into `sprint/team1/117`, passes on `6a5d7a98`, its head when this was decided. My return of
`cd55a6a8` (`docs/gates/20261029-1159-development-release-testing-3775.md`) asked that the setup leave Electron's
executable in the cached folder, and that the run of the mended head show the tests take it from there.
- The points under "What holds" in that record stand for the commits before the mend.
- This record checks the mend.

The Definition of Done is the default (SPEC.md:1869-1874).

1. **CI is green.** Run 40871481305, `pull_request`, on `6a5d7a98` passes 39 of 39 pull-request and setup jobs, in its
   attempt 2.
   - Attempt 1 failed only `unit-pull-request (15)`, in `tests/review-pages-release-limitations.test.mjs`. That is the
     flip registered as ITM-1287, a test of MOD-review-pages that this pull request does not touch.
2. **The mend is what the return asked.**
   - `5862c6da` (tests) has the setup's test expect `install.js` to run (TST-1306001). Its fake npm leaves an `install.js`,
     as npm does. TST-476901 expects the new cache path. Both are tests of MOD-test-schedule.
   - `eb8b3b95` (implementation):
     - `tests/test-schedule-setup.sh` runs `node "$electron/node_modules/electron/install.js"` after `npm install`, and its
       comment says why;
     - the schedule's `cache` names `/home/runner/agent-m-electron-44/node_modules/electron`, the package with its
       executable;
     - `.github/workflows/agent-m-tests.yml` is written again by the generator. TST-476903 asserts that it is exactly
       the generator's output, and passes.
   - `6a5d7a98` changes the fake npm of TST-1217006 (`test-schedule-command`, MOD-test-schedule) to leave `install.js`,
     which the setup now runs. No assertion changes.
     - The run of `eb8b3b95` (40870191003) failed on that case alone.
     - That fixture defect was mended after the implementation commit, as ITM-1276's and ITM-1281's were. The
       expectation stands as before. Noted for the review.
3. **The counter-proof on the real path, read by me in run 40871481305 (attempt 1, every job):**
   - Every test job logs "Cache restored from key" for the setup's entry.
   - Each of these logs "ready" with the executable `/home/runner/agent-m-electron-44/node_modules/electron/dist/electron`:
     `tests/desktop-shell.test.mjs` (`component-pull-request (2)`) and `tests/release-itm-276-desktop-shell.test.mjs`
     (`release-pull-request (2)`).
   - Each of these logs "site-usability staging: Electron ready after 0 ms" or "1 ms":
     - `tests/markdown-render-918-diagram-drawn.test.mjs` (component 3);
     - `tests/release-itm-1174-917-rendered.test.mjs` (release 1);
     - `tests/site-accessibility.test.mjs` (system 1);
     - `tests/site-usability.test.mjs` (system 3).
   - `tests/desktop-shell-bridge-jobs.test.mjs` (component 1) logs no acquisition stage.
   - The word "acquisition" stands once in the whole run, in the title of TST-1306202, the case that shows a helper
     without the setup's Electron asks the registry. No test logs a stage "Electron package acquisition" or "binary
     acquisition".
   - So the seven files take Electron from the setup's cached folder, and no test job asks the npm registry for it.
4. **Only its modules change.**
   - `tests/test-schedule-setup.sh`, `docs/tests/schedule.md`, the workflow, and the tests `test-schedule-setup-electron`,
     `test-schedule-own-ci`, `test-schedule-dpkg-time` and `test-schedule-command` belong to MOD-test-schedule.
   - The helpers and tests of the four places belong to MOD-site-frame and MOD-desktop-shell, and
     `release-itm-276-desktop-shell` was changed by developer-sonnet-l.
   - No test is removed.
5. **The reader.** On `6a5d7a98`:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - `test-schedule-setup-electron` 2, `site-usability-electron-from-setup` 2, `desktop-shell-electron-from-setup` 3,
     `test-schedule-own-ci` 8, `release-itm-276-desktop-shell` 1, `test-schedule-dpkg-time` 9, `test-schedule-command` 11.
   - All with 0 findings. `test-document-one-line` passes.

## Noted

- The cached path is the package's folder alone, `node_modules/electron`, not its dependencies. The tests need only its
  executable, and the setup's check (`-x …/dist/electron`) finds it restored, so `npm` is not called.
