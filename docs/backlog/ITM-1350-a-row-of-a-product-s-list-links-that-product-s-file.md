---
id: ITM-1350
title: A row of a product's list links that product's file
level: module
realises:
  - UC-008
modules:
  - MOD-review-pages
builds_on:
  - ITM-372
tests:
  - unit
origin:
  - finding UC008-S2 of ITM-372's system test TST-372216 (#1605), ruled at its gate in team1's sprint 141 (docs/gates/20261101-0613-development-release-testing-0372.md)
---
# ITM-1350 A row of a product's list links that product's file

**REGISTER**

## Outcome

UC-008 step 2: the reviewer opens a use case of the product chosen. A row's link on a product's list is
`#use-case/id=<id>`, without the product (`src/review-pages/flow.mjs:272`). The frame takes the product from the address
alone (`chosenProduct`), so following the link draws the instance's page of that identifier.

## Acceptance

- On a product's list, each row links the file's page in the form the frame reads back:
  `#<route>/id=<id>/product=<the product's address, percent-encoded>` (MOD-site-frame.md:222). On the instance's list
  the link stays as it is.
- TST-372216 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
