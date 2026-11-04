---
id: ITM-1371
title: The model editor names the products that declare the model
level: module
realises:
  - UC-031
modules:
  - MOD-implementation-pages
builds_on:
  - ITM-802
tests:
  - unit
origin:
  - finding UC031-F1 of ITM-802's system test TST-802211 (#1651), ruled at its gate in team1's sprint 141 (docs/gates/20261101-1043-development-release-testing-0802.md)
---
# ITM-1371 The model editor names the products that declare the model

**REGISTER**

## Outcome

UC-031 6a: "The adapted model is already used by products. Agent M lists them." The routes `models` and `models/<name>`
read which products of this browser declare a model (MOD-implementation-pages.md:157-161). Only the list of the models
names them (`src/implementation-pages/process.mjs:438-449`); the editor and its notice after *Save* (`process.mjs:513-676`)
name none.

## Acceptance

- On `models/<name>` of a model that products of this browser declare, the editor and its notice after *Save* name those
  products, read as the list reads them, from each product's `docs/process.md` alone.
- TST-802211 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
