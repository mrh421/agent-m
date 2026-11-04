---
id: ITM-1456
title: The decision's reason field has an accessible name
level: module
realises:
  - THE SITE SERVES A SCREEN READER
modules:
  - MOD-site-frame
builds_on:
  - ITM-1445
tests:
  - unit
origin:
  - ITM-1445's gate (docs/gates/20261102-2024-development-release-testing-1445.md, Noted)
---
# ITM-1456 The decision's reason field has an accessible name

**REGISTER**

## Outcome

`THE SITE SERVES A SCREEN READER` asks that every control has an accessible name. `confirmDecision` draws its reason
`textarea` without one (`src/site-frame/decision.mjs:20`). So when a person rejects with a reason, a screen reader names
no field.

## Acceptance

- The reason field of `confirmDecision` has an accessible name, which says that it asks for the reason. Counter-proof: the
  field without it fails.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
