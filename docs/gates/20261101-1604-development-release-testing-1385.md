---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 8a38155c303b936a3c83561a3c575b2a7e61adf0
  - https://github.com/akmaier/agent-m/pull/1679
date: 2026-11-01 16:04 UTC
---
# Development → Release testing: ITM-1385, #1679

**REGISTER**

## Reason

ITM-1385 (the document check finds a diagram its schema requires missing) may go on. The pull request is #1679 into
`sprint/team1/142`, at `8a38155c3`. developer-opus-f wrote the tests-only commit `cc50f8f84` and the code `3f4879303`.
developer-sonnet-l wrote the system and release fixtures `b74a60d42`, before the code, and `8a38155c3`, the lift of
TST-580305's `todo`, after it (`Agent-M-Participant` on each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `cc50f8f84` changes
   `tests/documents-diagram-images.test.mjs` (MOD-documents), with the new TST-1385001 and 1385002. It gives the unit
   fixtures their Mermaid block: `tests/fixtures/use-cases/UC-013-image-diagram.md` (read by `test_diagrams_are_mermaid.py`),
   `UC2_CHANGED` of `test_prompted_change_context.py` (which `test_artifact_provenance.py` imports),
   `review-pages-draft-use-cases` and `review-pages-conversation-draft`. In run 41322556373 the only failing cases are the
   two new ones.
2. **CI is green on the head:** run 41324075103 (`8a38155c3`), at the first attempt. No job failed or was cancelled, and
   `test_release_sprint_02_d.py` is read there. `git merge-tree` with the sprint branch's head is clean.
3. **Only the item's code changes:** `src/documents/checks.mjs`. After the image loop, a schema with `diagrams: required`
   and no block whose info string is `mermaid` gives one error on line 1 under `DIAGRAMS ARE MERMAID IN MARKDOWN`. With
   `none`, each such block gives an error at its fence. The file's head comment no longer lists the check as not done. The
   tests the item changes name the modules its `modules` list for its tests.
4. **The Acceptance holds.**
   - The probe found that each of the repository's 48 use cases holds a block, so no accepted text changes.
   - The system and release fixtures changed are `tests/uc-019-prompt-bar-harness.mjs`, `tests/uc-010-harness.mjs` (its
     `useCase` and `UC3_TEXT`) and TST-580304's draft. sonnet-l made them in a commit of their own. It has written no code
     under `src/` other than merge commits, so it built none of the behaviour they test.
   - No expected result moves. TST-580304 still drafts an image in place of the diagram and expects its one image
     finding. Known positive: with the old fixtures and the check, `system-uc-019` fails 5 cases and `release-uc-007` 1.
   - TST-580305 loses its `todo`: red at `b74a60d42` (2 requests expected, 1 sent), green on `3f4879303`. The release file
     of UC-007 gives 19 of 19.

## Readings taken

- The unit fixtures are those of the item's five unit files.
- A missing diagram stands on no line, so its finding names line 1, as the file does for any missing part.
- A block where `none` names no diagram is found under the schema's own rule, the rule of the part closest to it.
- A Mermaid block is a fenced block whose info string is `mermaid`.

All are taken.
