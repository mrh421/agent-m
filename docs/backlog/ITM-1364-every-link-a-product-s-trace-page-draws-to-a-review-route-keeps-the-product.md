---
id: ITM-1364
title: Every link a product's trace page draws to a review route keeps the product
level: module
realises:
  - UC-021
  - UC-020
modules:
  - MOD-trace-pages
builds_on:
  - ITM-1356
tests:
  - unit
origin:
  - developer-sonnet-j's open point in ITM-1356's pull request (#1633), ruled at its gate in team1's sprint 141 (docs/gates/20261101-1830-development-release-testing-1356.md)
---
# ITM-1364 Every link a product's trace page draws to a review route keeps the product

**REGISTER**

## Outcome

ITM-1355 made every link a product's review page draws to another review route carry `/product=<address>`, the form the
frame's `chosenProduct` reads back (MOD-site-frame.md:222). ITM-1356 gives `reviewLink` of MOD-trace-pages an optional
product, which the tests view's *Arrange* uses. The specification view's *Arrange* (`#arrange/kind=requirements`) and
MOD-trace-pages' other links to MOD-review-pages' routes still leave the product out, so following one on a product's page
draws the instance's page.

## Acceptance

- On a product's trace page, every link to a route of MOD-review-pages carries `/product=<the product's address,
  percent-encoded>`, built through `reviewLink`. On the instance's pages the links stay as they are.
- TST-738002's expectation of the specification view's `#arrange/kind=requirements` changes with it, in the tests-only
  commit. Its file names MOD-trace-pages.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
