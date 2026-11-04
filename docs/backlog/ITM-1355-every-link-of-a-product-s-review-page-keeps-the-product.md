---
id: ITM-1355
title: Every link a product's review page draws to another review route keeps the product
level: module
realises:
  - UC-008
modules:
  - MOD-review-pages
builds_on:
  - ITM-1350
tests:
  - unit
origin:
  - developer-sonnet-k's reading in ITM-1350's pull request (#1627), ruled by the Product Owner of team1's sprint 141
---
# ITM-1355 Every link a product's review page draws to another review route keeps the product

**REGISTER**

## Outcome

ITM-1350 gives a product's list rows the frame's form `…/product=<address>`, so that following one draws that product's
file. The other links that MOD-review-pages draws on a product's page still leave the product out, so following one draws
the instance's page: *Review all*, *Draft*, *History*, *Older*, *Edit* and *All …*. The frame takes the product from the
address alone (`chosenProduct`, MOD-site-frame.md:222).

## Acceptance

- On a product's review page, every link to a route of MOD-review-pages carries `/product=<the product's address,
  percent-encoded>`, in the form `chosenProduct` reads back. On the instance's pages the links stay as they are.
- MOD-review-pages builds these links in one place, which the row link of ITM-1350 uses too.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
