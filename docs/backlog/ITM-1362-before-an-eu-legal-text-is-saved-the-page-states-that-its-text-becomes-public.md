---
id: ITM-1362
title: Before an EU legal text is saved, the page states that its fetched text becomes public
level: module
realises:
  - UC-004
  - RESTRICTED CONTENT STAYS OUT OF THE PUBLIC INSTANCE
modules:
  - MOD-settings-pages
builds_on:
  - ITM-370
tests:
  - unit
origin:
  - finding UC004-S2 of ITM-370's system test TST-370214 (#1631), ruled by the Product Owner of team1's sprint 141
---
# ITM-1362 Before an EU legal text is saved, the page states that its fetched text becomes public

**REGISTER**

## Outcome

UC-004 step 5: "Before saving, Agent M states what becomes public: the register entry always; the content only if it may
be republished." Step 7 then stores the EU legal text's official text in the instance. MOD-settings-pages gives "what
becomes public stated before *Save*" (MOD-settings-pages.md:219-220). For an EU legal text, the statement names only the
register entry (`src/settings-pages/library.mjs:186-197`, `statementOf`), not the text the fetch will store in the public
instance.

## Acceptance

- Before an EU legal text is saved, the statement names the register entry and the official text that the fetch stores
  in the instance repository.
- The statement of the other routes is unchanged.
- TST-370214 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
