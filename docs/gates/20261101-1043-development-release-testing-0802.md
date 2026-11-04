---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 063d9e8263d95cac503b45e834be3f1b82aded5d
  - https://github.com/akmaier/agent-m/pull/1651
date: 2026-11-01 10:43 UTC
---
# Development → Release testing: ITM-802, #1651, the system and release tests of UC-031

**REGISTER**

## Reason

ITM-802 was written by developer-sonnet-l (`Agent-M-Participant` on `063d9e826`). The commits of
`src/implementation-pages/process.mjs` and `src/model-catalogue/` on the sprint branch name developer-opus-e (4),
developer-sol-b (3) and developer-sonnet-k (1), and never sonnet-l (known positive: the same count finds opus-e). I wrote
none of it.
1. **No failing first commit:** a battery adds no behaviour (141.md, *Readings taken*).
2. **CI is green on the head:** run 41298372961 (`063d9e826`), at the first attempt. `git merge-tree` with the sprint
   branch's head is clean.
3. **Only new test files:**
   - `tests/uc-031-harness.mjs`;
   - `tests/system-uc-031-configure-a-process-model.test.mjs`;
   - `tests/release-uc-031-requirements-of-a-model.test.mjs`.
4. **MOD-test-document's reader:**
   - `testDeclarations` reads 11 system cases (TST-802201 to 802211) and 12 release cases (TST-802301 to 802312). Each
     declares `module: system`, and `testFindings` reports none.
   - `testHeader` gives MOD-implementation-pages and MOD-model-catalogue for every file, with no finding.
5. **The Acceptance holds:**
   - TST-802301 maps the requirements UC-031 realises. Those already guarded by name (TST-779101 to 779103, 779111,
     777001, 840010) are mapped, not written again. The new release cases guard the rest.
   - The system file walks the main flow and the alternative flows.
   - The pull request records 22 planted faults, one or more for every case that is not a `todo`.

## Findings, ruled

Each is registered in this commit, under the general reading of the ITM-1061 gate
(`20261101-1036-development-release-testing-1061.md`, *Findings, ruled*).
- **UC031-F1 (TST-802211) → ITM-1371 (MOD-implementation-pages).** UC-031 6a lists the products that use the adapted
  model. The routes `models` and `models/<name>` read which products declare a model (MOD-implementation-pages.md:157-161),
  and the editor and its notice after *Save* name none.
- **UC031-R2 (TST-802312) → ITM-1372 (MOD-product-process).** `roleAssignmentFindings` lets a person hold a role the model
  fills by `agent`. The SPEC states who may fill a role, and `roleAssignmentFindings` is the module's check of the role
  assignments. That its list of findings does not name this is noted for akmaier.
- **UC031-R3 (TST-802311) → ITM-1373 (MOD-model-catalogue).** The cause is the definition, not the progress page.
  MOD-progress-measures draws the board for a model with a work-in-progress limit, as its text states
  (MOD-progress-measures.md:232-235). `modelFindings` refuses "a measure that does not fit the kind of work"
  (MOD-model-catalogue.md:101), and a measure per time box does not fit work without a time box. So such a definition is
  refused, and TST-802311's expectation changes to that refusal, by the brief's rule for a moved release test.

## Readings taken

- `#models` is the menu entry of UC-031 step 1.
- "Agent M lists them" (6a) means the editor or its notice names the products.
- The capabilities a role needs are guarded through the saved roles and `roleAssignmentFindings`.
- A role filled by `agent` is not held by a person.

All are taken.

## Noted

- The harness copies the form-reading helpers of the existing release file of UC-031, which exports none. Two copies of
  one helper are a candidate for a later item; nothing waits on it.
- TST-779110's `todo` stands as before.
