---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: rejected
on:
  - 3d19a07bac8b8e019aafb27ce52639a6d9374aa9
  - https://github.com/akmaier/agent-m/pull/1720
date: 2026-11-02 09:03 UTC
---
# Development → Release testing: ITM-1414, #1720, rejected

**REGISTER**

## Reason

ITM-1414 (a test without an identifier is listed as incomplete) does not pass on `3d19a07ba`. developer-opus-f wrote the
tests-only commit `2a0108b69` and the code `0d6585855`; developer-sonnet-l wrote the lift `3d19a07ba`
(`Agent-M-Participant` on each). I wrote none of it. The tests-only commit is red for the item's reason (run 41415652745),
and the head is green (run 41416719163). The rejection is for the code's form alone.

**The stand-in identifier is a workaround.** The path: `tests.mjs:185` `showTests` → `declarationsOf` (:35-40) → MOD-test-
document's `testDeclarations`, which starts a declaration only at a line with `TST-<n>`
(`declarations.mjs:150-152`). So a block whose first line is `level: unit · module: …` is read as nothing, and is listed
nowhere.

The code's `unidentifiedOf` writes `TST-0` into the file's text so that `testDeclarations` reads the block. MOD-trace-pages
thus feeds another module a text that is not the file's, in order to reach what that module's interface does not give. This
is the custom access method AGENTS.md §6a.1 forbids while the module that owns the format can be made to give it.

**The accepted text already gives it, without a change of the architecture.**
- MOD-test-document's Data lists `TST-<nnn>` among a declaration's keys, "required".
- Its `testDeclarations` "never throws on content: a declaration missing a key is read with that key `null`, and
  `testFindings` names it".
- So a block of `key: value` lines whose first line names no identifier is a declaration missing that key. It is read with
  `id` `null`, and the tests view lists it from what `testDeclarations` gives.

The only gap is the type `TestDeclaration.id: string`, which does not show the `null` the Data allows. It is noted for
akmaier, and the reading builds without asking.

## What passes it

- ITM-1414 now names MOD-test-document beside MOD-trace-pages; the item is changed in this commit with the reading.
- `testDeclarations` reads such a block with `id` `null`, and `testFindings` names the missing identifier.
- The tests view draws it under **Incomplete** as the code already does, with no stand-in.
- Before the code, the probe names every caller of `testDeclarations` that would meet an `id` of `null`, and keeps their
  expected results.

The tests-only commit and sonnet-l's lift can stay. TST-1414010 and 1414011 and their counter-proofs F1 to F6 still hold.
The row of its own (`tests-unidentified`) and the release comparison that takes declared tests only stand as readings.
