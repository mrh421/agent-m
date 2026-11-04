---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 35ae5a9fa9f579b36b4b2c6278b035d7a40b46f8
  - https://github.com/akmaier/agent-m/pull/1605
date: 2026-11-01 06:13 UTC
---
# Development → Release testing: ITM-372, #1605, the system and release tests of UC-008

**REGISTER**

## Reason

ITM-372 was written by developer-sonnet-j (`Agent-M-Participant` on `af0d374ef` and `75db04042`). By the trailers on
`src/review-pages/` and `src/approvals/`, developer-sonnet-j built none of UC-008's items. Known positive: `92dd7b58f`
(ITM-1315, UC-023) carries that trailer. I wrote none of it.
1. **No failing first commit:** a battery adds no behaviour (141.md, *Readings taken*). The head `35ae5a9fa` merges the
   sprint branch without a conflict, and the sprint branch is its ancestor.
2. **CI is green on the head:** run 41278574641 (pull_request), at the first attempt.
3. **Only new test files:**
   - `tests/system-uc-008-review-and-accept-a-use-case.test.mjs`;
   - `tests/release-uc-008-review-and-accept-a-use-case.test.mjs`;
   - the helper `tests/uc-008-harness.mjs`.

   No existing file changes.
4. **MOD-test-document's reader:**
   - `testDeclarations` reads 16 system cases (TST-372201 to 372216) and 12 release cases (TST-372301 to 372312). Each
     declares `module: system`, and `testFindings` reports none.
   - `testHeader` gives MOD-review-pages and MOD-approvals for all three files, with level `system`, `release` and
     `system`, and no finding.
   - The control: the same reader on a copy with one `expect:` line removed reports "no expected result".
5. **The Acceptance holds, as far as reading shows:**
   - The system test walks the main flow and each alternative flow.
   - Every disagreement with UC-008 is a FINDING `todo`.
   - The counter-proofs and the author are named in the pull request.

## Findings, ruled

Both are defects of MOD-review-pages' code against UC-008 and the SPEC. An accepted text lets each be built, so each is a
new item:
- **UC008-S1 → ITM-1349.** The list offers a tick for every file that is not accepted, including one the reviewer has
  never opened. *Accept ticked* then records the blob of a text the reviewer was never shown. `SEVERAL FILES ARE
  ACCEPTED IN ONE CLICK` asks for one record "per file shown, and none for a file that was not shown" (SPEC.md:1091-1098).
  UC-008 3d says "each one read gets a tick".
- **UC008-S2 → ITM-1350.** A row's link is `#use-case/id=<id>` without the chosen product, so following it draws the
  instance's page. The frame's form `…/product=<address>`, which `chosenProduct` reads back, is MOD-site-frame's
  (MOD-site-frame.md:222). MOD-review-pages already uses `chosenProduct` (MOD-review-pages.md:10).
