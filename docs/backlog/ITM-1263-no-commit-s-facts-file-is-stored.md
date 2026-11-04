---
id: ITM-1263
title: No commit's facts file is stored
level: module
realises:
  - UC-035
  - UC-046
  - A PAGE LOAD READS THE REPOSITORY IN BATCHES
modules:
  - MOD-progress-measures
  - MOD-workflow-entries
  - MOD-test-pages
  - MOD-implementation-pages
  - MOD-site-frame
builds_on: []
tests:
  - unit
  - component
origin:
  - akmaier, 2026-10-28: "I think I want the 20 mb facts file gone." … "delete them and make sure they are not built in the future again."
built_by:
  - ebb8590f7849ca7c2cd79ff076244d9b1963bc54
  - 7339b4226ae849689646ac5c97c333b6bff9eac9
  - 574649f957e7dab94592076bf03b289e1b27f459
---
# ITM-1263 No commit's facts file is stored

**REGISTER**

## Outcome

`publishOverview` writes no `<commit>.facts.json` to `overview-cache`, and nothing reads one: `productFacts` reads the
files, as before ITM-1117. On the commit this item starts from, the file was about 20 MB (job records 7.3 MB, gate
records 4.0 MB, test declarations 3.7 MB, sprints 2.5 MB, items 2.1 MB, module files 0.8 MB), written on every push to
main, and read first by every page that asked for facts; the branch held 673 of them, about 14.4 GB of file data over
880 commits. The files already stored are removed from the branch's history once this item is on main, on akmaier's
decision of 2026-10-28.

## Acceptance

- Unit tests naming MOD-progress-measures: `publishOverview` adds no `*.facts.json` (counter-proof: it still adds
  `<commit>.json` and `latest.json`); `productFacts` asks for no `.facts.json` in any scope, over a counting fake whose
  `readOn` would serve one.
- The tests that asserted the file is written or read change to the files; the request counts of the pages fall by one.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only the modules named here and their tests change; preloads are regenerated in a commit of their own.
