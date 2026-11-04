---
id: ITM-1317
title: A change under its existing identifier is not classed a duplicate of itself
level: module
realises:
  - UC-023
  - THE DERIVATION RULES HOLD FOR ARCHITECTURE
  - A CHANGE IS PROPOSED UNDER THE EXISTING NAME
  - EXACT DUPLICATES ARE FOUND WITHOUT A MODEL
modules:
  - MOD-documents
builds_on:
  - ITM-739
tests:
  - unit
origin:
  - po-opus-c's gate of ITM-739 (PR #1510), docs/gates/20261030-0753-development-release-testing-c739.md, finding UC023-S1; akmaier's ruling ("Resolving a duplicate is a different process than proposing a change. duplication is avoided in the first, such that the second can always work."), accepted in MOD-documents with d27b1e408
---
# ITM-1317 A change under its existing identifier is not classed a duplicate of itself

**REGISTER**

## Outcome

The accepted `classifyCandidates` (MOD-documents.md:298-307): "a candidate whose normalised key equals that of an
existing artifact other than the one its participant proposed it as a change of is a duplicate of it, whatever class its
participant proposed, decided by rule (`EXACT DUPLICATES ARE FOUND WITHOUT A MODEL`), since a change stands under the
name of what it changes (`A CHANGE IS PROPOSED UNDER THE EXISTING NAME`)" (:301-305).

`src/documents/candidates.mjs` (`classifyCandidates`) makes a merged candidate a duplicate of the first existing
artifact whose key it shares, whatever its participant proposed, the artifact it changes included. A module's key is its
`id` and a decision's its `title` (MOD-documents.md:200, :223), so a module changed under its own identifier, or a
decision that keeps its title, is classed a duplicate of itself, and `candidate-classes` (MOD-job-runner) reports it as
an error the loop cannot fix. The system test of UC-023 holds this as the finding UC023-S1 (TST-739010, `todo`).

With this item, a candidate proposed as a change of an artifact keeps its class against that artifact; against every
other existing artifact it is compared as today. MOD-job-runner does not change: with no duplicate found,
`candidate-classes` reports nothing.

## Acceptance

- Unit cases of `classifyCandidates`:
  - a module candidate keyed `MOD-sync`, proposed as a change of `MOD-sync`, stays a change of `MOD-sync`, decided by
    participant; the same for a decision that keeps its title, proposed as a change of that decision;
  - counter-proof: the same candidates proposed *new* are duplicates of `MOD-sync` and of the decision, decided by rule;
  - known positive: a candidate proposed as a change of `MOD-sync` whose key equals that of another existing artifact is
    a duplicate of that other artifact, decided by rule; a requirement changed under its name keeps the class *change*,
    as today.
- `tests/test_derivation_classes.py` gains the architecture case of a change under its own identifier.
- TST-739010 (`tests/system-uc-023-modify-the-architecture.test.mjs`) loses its `todo` and passes, and TST-739001's
  `FLOW_FINDINGS` entry `2-changes-under-existing-identifiers` moves to `FLOW_EVIDENCE` with TST-739010 as its evidence.
  Both are changed on the item's branch, in a commit of their own, by a participant who implemented none of this item.
- TST-739005 (UC-023 2a: a new identifier for something that exists is sent back) still passes.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/documents/` and the tests that name MOD-documents change, with the system test named above.

## The planning run (sprint team1/127)

A stand-in in `classifyCandidates`: the merged candidate's first proposal, when it is a change, names the artifact it
changes, and that artifact is left out of the search for a duplicate; every other existing artifact is compared as today.

On `main` at `d27b1e408`, in an export, every test file of the repository: 1,020 files, 6,351 Node cases and 564 Python
cases. MOD-documents is imported by most modules, so the tests of every importer are among them. The same files were run
without the change.
- No case fails only with it.
- TST-739010 passes with it, still marked `todo`: that is its known positive. TST-739005 passes on both.
- The base's own failures are the same with and without it.
- No other test moves.
