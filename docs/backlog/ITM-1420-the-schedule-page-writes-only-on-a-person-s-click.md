---
id: ITM-1420
title: The schedule page writes only on a person's click
level: module
realises:
  - UC-027
  - THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
modules:
  - MOD-test-pages
builds_on:
  - ITM-772
tests:
  - unit
origin:
  - noted by ITM-772's writer and ruled at its gate in team1's sprint 142 (docs/gates/20261102-0829-development-release-testing-0772.md)
---
# ITM-1420 The schedule page writes only on a person's click

**REGISTER**

## Outcome

`THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK`. The schedule page's *Save* and *Merge* act on any click, a script's
included. MOD-site-frame's forms (`src/site-frame/forms.mjs:208`) and the generate page of MOD-test-pages itself
(`src/test-pages/generate.mjs:68`) act only on a click the browser marks trusted.

## Acceptance

- A click a script makes on the schedule page's *Save* or *Merge* writes nothing. A person's click writes as before.
- No existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
