---
id: ITM-1335
title: A requirement proposed as a change of itself with its rule unchanged is a duplicate
level: module
realises:
  - UC-005
  - A CHANGE IS PROPOSED UNDER THE EXISTING NAME
  - EXACT DUPLICATES ARE FOUND WITHOUT A MODEL
modules:
  - MOD-documents
builds_on:
  - ITM-1317
tests:
  - unit
origin:
  - akmaier's ruling "ITM-1317 no", drafted in MOD-documents with e8f52366a (#1546) and accepted with d70cbd918 (docs/approvals/MOD-documents-0045cd85e993.md)
---
# ITM-1335 A requirement proposed as a change of itself with its rule unchanged is a duplicate

**REGISTER**

## Outcome

The accepted `classifyCandidates` (MOD-documents, Interfaces): "a requirement whose normalised rule equals that of the
requirement it is proposed as a change of is a duplicate of that requirement all the same".

ITM-1317 leaves the artifact a candidate is proposed as a change of out of the search for a duplicate, for every kind
(`src/documents/candidates.mjs`). So a requirement proposed as a change of itself whose rule is its own rule, in other
letters at most, keeps the class *change*. TST-1317004 (`tests/documents-change-under-own-key.test.mjs`) asserts that
(its candidate `r2`).

With this item, such a requirement is a duplicate of that requirement, decided by rule. A requirement changed under its
name with another rule stays a change; a module or decision changed under its own key stays a change (ITM-1317).

## Readiness

It is ready.
- **Reading.** `classifyCandidates` reads no schema; the caller gives the key. A requirement's key is its name and its
  rule, a module's or decision's one field (the file's header). So "a requirement" is a candidate whose key has more than
  one value, and its rule is the last.
- **The tests that move.** With the planning probe — the artifact proposed as changed left out of the search only for a
  key of one value — the files that import `classifyCandidates` were run one by one on `main` at `d70cbd918`. Only
  TST-1317004 fails, at `r2`; `test_derivation_classes.py`, TST-1317001 to 1317003 and TST-1317101 to 1317103 pass as on
  the base.

## Acceptance

- A unit case of `classifyCandidates`: a requirement proposed as a change of itself, its rule in other letters, is a
  duplicate of it, decided by rule.
  - Counter-proof: the same requirement with another rule stays a change, decided by the participant.
  - Known positive: a module candidate keyed `MOD-sync`, proposed as a change of `MOD-sync`, stays a change.
- TST-1317004's expectation for `r2` changes to a duplicate of A REPORT HAS A TITLE, decided by rule, in the tests-only
  commit; its `expect` line says so. Its other two assertions stay.
- The first commit holds only the tests, and CI is red on it for the item's reason.
