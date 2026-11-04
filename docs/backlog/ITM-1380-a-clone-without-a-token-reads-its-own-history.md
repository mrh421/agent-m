---
id: ITM-1380
title: A clone without a token reads its own history
level: module
realises:
  - UC-010
  - THE NAME IS THE ID AND IT SURVIVES
modules:
  - MOD-repository-hosts
builds_on:
  - ITM-373
tests:
  - unit
origin:
  - finding UC010-F4 of ITM-373's system test TST-373209 (#1654), ruled at its gate in team1's sprint 141 (docs/gates/20261101-1118-development-release-testing-0373.md)
---
# ITM-1380 A clone without a token reads its own history

**REGISTER**

## Outcome

On the agent's machine, which reads no token (MOD-workflow-entries.md:164-170), the writer's commits land in the run's
result. The writer `open-files` keeps every identifier the version history holds (`THE NAME IS THE ID AND IT SURVIVES`),
so it reads `readHistory` (`src/artifact-edits/strategies.mjs:117`). A host of a clone without a token answers
`NotSupported` for it (`src/repository-hosts/index.mjs:160-166`), and the use cases are not written.

## Not ready — for akmaier

MOD-repository-hosts states this: "With `clone`, files are read and committed in that clone … and every other function
uses the REST adapter where a token is given, or throws `NotSupported`" (MOD-repository-hosts.md:189-190). So no reading
lets the clone answer `readHistory`, while MOD-workflow-entries runs the writer where no token is.

The general change it asks: a clone reads its own history through `git`, as it reads its files; only what needs the
server's API stays `NotSupported` without a token.

## Acceptance

- `readHistory` of a host of a clone without a token gives the clone's commits that changed the path, newest first, as the
  REST adapters give them.
- TST-373209 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
