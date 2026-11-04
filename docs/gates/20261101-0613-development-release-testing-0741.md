---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 470985866cb5e5547a1a94d45ca56d29aaf632d5
  - https://github.com/akmaier/agent-m/pull/1607
date: 2026-11-01 06:13 UTC
---
# Development → Release testing: ITM-741, #1607, the system and release tests of UC-025

**REGISTER**

## Reason

ITM-741 was written by developer-opus-f (`Agent-M-Participant` on `470985866`). UC-025's items were built by
participants who are not in team 1 now (141.md, *Readings taken*). By the trailers, developer-opus-f's only commit in
`src/trace-pages/` or `src/trace-graph/` is `a9d56d229`. That commit belongs to ITM-600, which realises UC-020, and no
case of this battery reads `compareGraphs` or the gaps view (grep: 0). I wrote none of it.
1. **No failing first commit:** a battery adds no behaviour (141.md, *Readings taken*). One commit, and the sprint
   branch is its ancestor.
2. **CI is green on it:** run 41278699038 (pull_request), at the first attempt.
3. **Only new test files:**
   - `tests/system-uc-025-validate-modules.test.mjs`;
   - `tests/release-uc-025-validate-modules.test.mjs`;
   - the helper `tests/uc-025-harness.mjs`.

   No existing file changes.
4. **MOD-test-document's reader:**
   - `testDeclarations` reads 14 system cases (TST-741001 to 741014) and 12 release cases (TST-741101 to 741112). Each
     declares `module: system`, and `testFindings` reports none.
   - `testHeader` gives MOD-trace-pages and MOD-trace-graph for all three files, with no finding.
   - The control: the same reader on a copy of the system file with one `expect:` line removed reports "no expected
     result".
5. **The Acceptance holds, as far as reading shows:**
   - Each disagreement is a FINDING `todo`.
   - The counter-proofs are recorded in the pull request.

## Findings, ruled

F1, F2 and F3 are defects of the code against accepted module texts, so each is a new item. R1 has a reading under which
the page meets the SPEC.
- **UC025-F2 (TST-741003) → ITM-1351, MOD-trace-graph.** `moduleRows` takes a row's *realises* from the module file's own
  `realises`. UC-025 step 3 and MOD-trace-pages' modules view both say "the requirements its tests guard"
  (MOD-trace-pages.md:134), and `moduleRows` gives "one row per module, as UC-025 shows it" (MOD-trace-graph.md:267).
- **UC025-F1 (TST-741006) → ITM-1352, MOD-trace-pages.** The diagram marks no module that has a gap. MOD-trace-pages.md:134
  says "gaps marked".
- **UC025-F3 (TST-741008) → ITM-1353, MOD-trace-pages.** A gap does not lead to the file it concerns. The view's *leads
  to* is "the module's file and folder" (MOD-trace-pages.md:134), and UC-025 step 6 asks for the same.
- **UC025-R1 (TST-741112): no defect.** The SPEC's text is `A RUN ENDS WITH THE VALIDATION OF ITS MODULES`: "the
  dashboard shows for its selection what each module realises, which code and tests belong to it, and every gap"
  (SPEC.md:1949-1951). The modules view shows every module, those of the selection among them, with all of that. The
  sentence does not say *only*, and reading it in would add a word the text does not contain (AGENTS.md §6a.7). No item.
  The `todo` keeps the stricter reading beside the page.
