---
id: ITM-1086
title: MOD-job-catalogue's table names resource-pins among the recipes of the five kinds that need the product's resources
level: module
realises:
  - UC-040
modules:
  - MOD-job-catalogue
builds_on:
tests:
  - unit
origin:
  - the second review of ITM-1083's draft (architecture-reviewer-opus-b), on main at 99cb48bd
built_by:
  - 45f37441b61cdd519db63e3430739fdbee51f2e5
  - 6c0aa1abe600d9887b808d76088aa313da4f1d67
---
# ITM-1086 MOD-job-catalogue's table names resource-pins among the recipes of the five kinds that need the product's resources

**REGISTER**

## Outcome

MOD-job-catalogue.md:141-143 says that `implement`, `refactor`, `fix-bug`, `write-tests` and `run-tests` "each" name
MOD-resource-list's `resource-pins` among their recipes. Their kind files do (`src/job-catalogue/kinds/<kind>/kind.md`). The
table's rows (:95, :96, :100, :101, :103) leave it out, so a reader of the rows alone misses it. The first review of ITM-1083's
draft did.

## Not ready: a draft for akmaier

The draft adds `resource-pins` to the recipes column of the five rows, and changes nothing else. It is a text change only.

## Acceptance

- Once the draft is accepted: `tests/` that compare the table's recipes with each kind file's find none missing. A
  counter-proof drops `resource-pins` from one row.
