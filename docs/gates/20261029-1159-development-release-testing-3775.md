---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: rejected
on:
  - cd55a6a89d2134ec3b3c3d162989ce025fc0896e
  - https://github.com/akmaier/agent-m/pull/1445
date: 2026-10-29 11:59 UTC
---
# Development → Release testing: ITM-1306, the tests that stage Electron do not flip on a registry fault

**REGISTER**

## Reason

ITM-1306, pull request #1445 into `sprint/team1/117`, is returned on `cd55a6a8`, its head when this was decided.
- CI is green, and the new tests pass. On the CI's own runners, though, the tests that stage Electron still fetch it from
  the npm registry. The flip the item removes is still there.
- The new tests pass on a stand-in file, so CI alone did not show it.

The Definition of Done is the default (SPEC.md:1869-1874). The Acceptance asks: "with the npm registry unreachable
(`npm_config_registry` set to a closed port) after the setup has run, none of the seven fails at 'package acquisition'".

1. **The CI's tests still acquire Electron from the registry.** These are the logs of run 40868938564, on `cd55a6a8`:
   - `component-pull-request (1)`: `tests/desktop-shell-bridge-jobs.test.mjs` logs the stages "Electron package
     acquisition" ("added 13 packages") and "Electron binary acquisition".
   - `component-pull-request (2)`: `tests/desktop-shell.test.mjs` logs both stages, then "ready" with the executable
     `/tmp/agent-m-276-component-electron-44/node_modules/electron/dist/electron`, its own install.
   - `release-pull-request (2)`: `tests/release-itm-276-desktop-shell.test.mjs` does the same, with the executable
     `/tmp/agent-m-276-release-electron-44/…`.
   - No test logs "ready" with an executable under `/home/runner/agent-m-electron-44`.
2. **The cause, as a path.**
   - `tests/test-schedule-setup.sh:66-69` installs the package with `npm install --no-save --prefix "$HOME/agent-m-electron-44"
     electron@44.5.1`, on the reading that "Electron's package installs its executable when npm runs its install script".
   - In run 40868081472, the setup job logs "added 13 packages in 1s". That is the package, not its executable of some
     hundred megabytes.
   - The four places' own installs run the package's `install.js` as a step of its own, "binary acquisition", after
     `npm install` (`tests/release-itm-276-desktop-shell.test.mjs:121-124`). They do so because `npm install` alone leaves
     no executable here.
   - So `dist/electron` is not in the cached folder.
   - Each shard's setup then finds no executable (`:67`) and runs `npm install` again ("up to date in 313ms").
   - Each test's `runtime()` finds no `executableOf(setUp)` and falls back to the registry.
3. **Why the tests did not catch it.**
   - TST-1306101, 201 and 203 give the helpers a home whose `agent-m-electron-44` holds a stand-in executable.
   - They check that the helpers look there first, which they do. They do not check that the setup leaves an executable
     there.
   - TST-1306001 and 002 (`test-schedule-setup-electron`) read the script's text and the schedule's `cache`. They do not
     check what the script installs.

## The mend, for developer-opus-e, on #1445, with no force-push

1. **The setup leaves Electron's executable in the cached folder:** it runs the package's `install.js`, as the four
   places do. The script's comment says what it does.
2. **The run after the mend finds the executable in the cache.** This week's entry, saved by run 40868081472, holds the
   folder without the executable, under the same key and the same paths. So that entry is hit, and the setup job does not
   run again.
   - The pull request names how the next run gets an entry with the executable.
   - Where that needs a change of the generator, the item stops and names it, as its Acceptance says.
3. **The counter-proof on the real path.** The run of the mended head is the evidence asked for. In its logs, every test
   that stages Electron logs "ready" with an executable under `/home/runner/agent-m-electron-44`, and none logs "Electron
   package acquisition".
   - The pull request quotes those lines of each of the seven files that stage Electron, with their jobs.
   - A test that runs the setup's Electron step is not required, since it would download from the registry. The run's
     logs are the check.
4. Every other point below stands, and is checked again on the mended head.

## What holds, to be checked again on the mended head

- **CI:** run 40868938564 on `cd55a6a8` passes 39 of 39 pull-request and setup jobs.
- **Red first:**
  - The tests-only commit `ebf76cd4` is red in run 40867850320, on TST-1306001, 101, 201 and 203 and on TST-476901, the
    changed expectation of `test-schedule-own-ci` (MOD-test-schedule).
  - A red tests-only commit is stricter than the brief asked of a change of the test setup, and is right here: the item
    adds behaviour to the setup.
- **The modules.** The new tests name MOD-test-schedule, MOD-site-frame and MOD-desktop-shell, all modules of the item.
- **The release test.** developer-sonnet-l's `cd55a6a8` changes only `release-itm-276-desktop-shell`: `runtime()` looks
  first in the setup's folder, and no assertion changes.
- **The workflow.** TST-476903 asserts that the committed `agent-m-tests.yml` is exactly the generator's output, and it
  passes. The only change is the third cache path.
- **The cache key.** The key is the same, and the version is new, through the path list. Run 40868081472's setup job
  logs "Cache not found" and saves a new entry, in 24 s, within the two minutes.
- **The readings.** MOD-test-schedule's Parts list what the setup installs, not "only these". "First" means before the
  bundled copy too.
- **TST-1306203** runs on Linux, and passes in `component-pull-request (5)`. Its `before` hook stages Electron with no
  case of the file matched, and logs "ready".
- **The reader.**
  - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
  - `test-schedule-setup-electron` 2, `site-usability-electron-from-setup` 2, `desktop-shell-electron-from-setup` 3,
    `test-schedule-own-ci` 8, `release-itm-276-desktop-shell` 1.
  - All with 0 findings. `test-document-one-line` passes.
