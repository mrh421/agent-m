---
id: ITM-1306
title: The tests that stage Electron do not flip on a registry fault
level: module
realises:
  - A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
modules:
  - MOD-site-frame
  - MOD-desktop-shell
  - MOD-markdown-render
  - MOD-test-schedule
builds_on: []
tests:
  - component
  - system
  - release
origin:
  - po-opus-c's gate of ITM-1275 (PR #1420), docs/gates/20261029-0834-development-release-testing-39fa.md, point 1
---
# ITM-1306 The tests that stage Electron do not flip on a registry fault

**REGISTER**

## Outcome

Run 40841875847 (attempt 1) on commit `eaabd0bf` failed seven jobs: component shards 1 to 3, system shards 1 and 2, and
release shards 1 and 2. The rerun of the same commit (attempt 2) passed them, so their tests flip on one commit. Every
failing case is in one of seven files:
- `site-usability`, `site-accessibility` and `release-itm-1174-917-rendered` (MOD-site-frame);
- `desktop-shell`, `desktop-shell-bridge-jobs` and `release-itm-276-desktop-shell` (MOD-desktop-shell);
- `markdown-render-918-diagram-drawn` (MOD-markdown-render).

Each fails at "Electron package acquisition". The tests install `electron@44.5.1` from the npm registry while they run,
and the registry answered 404 for
`https://registry.npmjs.org/@electron-internal/extract-zip/-/extract-zip-1.0.8.tgz`. Minutes later, it answered 200 for
the same address.

The installs stand in four places:
- `tests/site-usability.d/browser.mjs:74`;
- `tests/desktop-shell.test.mjs:119`;
- `tests/desktop-shell.d/electron.mjs:54`;
- `tests/release-itm-276-desktop-shell.test.mjs:123`.

So these tests' outcome on a commit depends on the registry at the moment they run.

The first task names, from these places and from how the pull-request jobs prepare the tests, where Electron could be
acquired so that a registry fault during the run cannot change a test's outcome. The change follows from the cause
named. No retry of the install is added. The task stops and names the missing sentence where the change needs one that
the module files do not hold, such as a step of the generated CI configuration (THE CI CONFIGURATION IS GENERATED FROM
THE SCHEDULE).

## Where the fix lies

Agent M's schedule already installs what the tests need before they run:
- Its `setup` (`tests/test-schedule-setup.sh`, MOD-test-schedule) installs xvfb and openbox, "so that the tests that start
  Electron find openbox installed and install nothing (their own install stays the local fallback)".
- Its `cache` names the paths the setup fills. The CI service keeps them "under a key made of `setup` and the week, so
  that the shards restore them instead of all fetching at once" (MOD-test-schedule.md:170-171).
- The generated workflow's `agent-m setup` job and the shards' `actions/cache/restore` steps carry those paths
  (`.github/workflows/agent-m-tests.yml:37-46`, `:79-83`).

Electron is not among what the setup installs. Each of the four places installs `electron@44.5.1` itself from the
registry, in a folder of its own under the temporary directory. Each first looks for a "bundled" copy at a fixed path
(`tests/site-usability.d/browser.mjs:69-71`, `tests/desktop-shell.test.mjs:107`,
`tests/release-itm-276-desktop-shell.test.mjs:111`).

So the setup installs `electron@44.5.1` into a folder that the schedule's `cache` names, where it is not there yet. Each
of the four places looks there first, as it does for the bundled copy, and keeps its own install as the local fallback,
as openbox's does. The CI configuration is generated from the schedule (THE CI CONFIGURATION IS GENERATED FROM THE
SCHEDULE): the workflow is written again with MOD-test-schedule's generator, and the pull request names the call.

## Acceptance

- The pull request names where Electron is installed and cached, with the data-flow path from the setup to each of the
  four places.
- **Its files:**
  - `tests/test-schedule-setup.sh` and `docs/tests/schedule.md`'s `cache` (MOD-test-schedule);
  - `.github/workflows/agent-m-tests.yml`, exactly the generator's output for the schedule, compared byte for byte at
    the gate, as for ITM-1296;
  - the helpers and tests of the four places: `tests/site-usability.d/browser.mjs` (MOD-site-frame), and
    `tests/desktop-shell.test.mjs` and `tests/desktop-shell.d/electron.mjs` (MOD-desktop-shell).
- **One release test changes, by a participant who implemented none of this item:**
  `tests/release-itm-276-desktop-shell.test.mjs` (`:111-123`), in a commit of its own on the item's branch. Its header
  names MOD-desktop-shell, and its level is `release`.
- **The key.** The cache's key is made of `setup` and the week. A `setup` whose text does not change keeps the week's
  entry without Electron, so the pull request names how the first run after the merge gets a new entry. Where that
  needs a change of the generator, the item stops and names it.
- **The time limit.** The `agent-m setup` job runs within the two minutes every pull-request job carries (A PULL
  REQUEST'S CI RUNS WITHIN TWO MINUTES). The pull request names the install's time in its run.
- No expected result of the seven files changes. The counter-proof: with the npm registry unreachable
  (`npm_config_registry` set to a closed port) after the setup has run, none of the seven fails at "package
  acquisition". The same run before the change fails there.
- **Tests of other modules this Outcome changes:** the seven files named in the Outcome, each only where it acquires
  Electron. The search was every file under `tests/` naming `electron@44.5.1`, `electronCache` or `agent-m-electron-44`,
  read to its end. It found the four places above, and `desktop-shell-bridge-jobs:39`, which acquires through
  `tests/desktop-shell.d/electron.mjs`.
- It removes no test.
