---
id: ITM-1344
title: Every page's load time is checked over night
level: system
realises:
  - EVERY PAGE LOADS IN UNDER THREE SECONDS
modules:
  - MOD-test-schedule
  - MOD-site-frame
builds_on: []
tests:
  - user
origin:
  - EVERY PAGE LOADS IN UNDER THREE SECONDS, accepted by akmaier in a18584a71 (queue 2026-11-01), whose Check is "over night, a browser with a window opens every page of the live site"
---
# ITM-1344 Every page's load time is checked over night

**REGISTER**

## Outcome

The requirement's Check is `tests/live-page-load.py` (`Level: user`, `Module: MOD-site-frame`), run over night. Nothing
runs it over night:
- Agent M's test schedule runs the row `user` on a release candidate and on demand only (`docs/tests/schedule.md`, table
  *Levels*); `live-page-load.py` is the only test of that level.
- The schedule's Python runner imports each file and runs the `unittest` cases in it
  (`tests/test-schedule-command.d/unittest_junit.py`). The check's work is in `main()`, and the file holds no case.
- It imports Playwright for Python, which the schedule's setup does not install: MOD-test-schedule's file names what the
  setup installs — xvfb, openbox and the Bridge app's packages (MOD-test-schedule.md:90-91) —, and no file of `src/` or
  `tests/` other than the check names Playwright.

After the change, the check runs every night against the live site, each page's time is in the run's result record, and a
page that ends its last request three seconds or more after its navigation began fails the run.

## Not ready

- Running the row `user` over night is a setting of the instance's schedule (`A PRODUCT'S SETTINGS LIVE IN ITS
  REPOSITORY`, `THE TEST SCHEDULE IS DECLARED PER PRODUCT`), the person's own input on the settings page; it waits for
  akmaier.
- Installing a browser driver for the check is not in MOD-test-schedule's accepted text; either that text names it, or
  the check is written with what the setup already installs. Which one is a decision of the architecture, for akmaier.

## Acceptance

- On the nightly run, the check opens every page it lists, with a token and without, and fails for a page whose last
  request ends at three seconds or later; the result record names each page's time.
- Counter-proof: a planted page that waits four seconds before its last request fails the check.
- Only the files of the item's modules and the tests that name them change.
