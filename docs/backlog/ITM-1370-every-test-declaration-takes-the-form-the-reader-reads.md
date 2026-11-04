---
id: ITM-1370
title: Every test declaration takes the form the reader reads
level: module
realises:
  - A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
  - EVERY TEST HAS ONE LEVEL
modules:
  - MOD-bridge-client
  - MOD-spec-changes
  - MOD-work-plans
  - MOD-mail-protocols
  - MOD-desktop-shell
  - MOD-documents
  - MOD-result-records
  - MOD-source-register
  - MOD-settings-pages
  - MOD-product-process
tests:
  - unit
origin:
  - developer-sonnet-j's note in ITM-1061's pull request (#1650), ruled at its gate in team1's sprint 141 (docs/gates/20261101-1036-development-release-testing-1061.md)
---
# ITM-1370 Every test declaration takes the form the reader reads

**REGISTER**

## Outcome

MOD-test-document's declaration names the identifier on its first line with its keys separated by ` · `
(MOD-test-document.md:42-53). 13 test files write 32 declarations as `TST-<nnn> - level: … - module: …`, which
`testDeclarations` does not read, so their cases are invisible to the checks built on it: `tests/test_mail_password_route.py`,
`test_mail_routes.py`, `test_prompted_source.py`, `test_derivation_context.py`, `test_implementation_job.py`,
`test_bridge_mail.py`, `test_derivation_classes.py`, `test_result_records.py`, `test_job_preconditions.py`,
`test_job_reading_checkout.py`, `test_no_history.py`, `test_settings_disclosure.py` and `test_definition_of_done.py`. The
item names their headers' modules, for these tests only.

## Acceptance

- Each of these declarations takes the form ` · `, with no other byte of its case changed. `testDeclarations` reads every
  case of the 13 files, and `testFindings` is reported in the pull request for each.
- A declaration that the reader then finds incomplete is completed from its own case's text, and listed in the pull request.
- Only those 13 files change; no code of a module changes. No expected result changes.
- It adds no behaviour, so it begins without a failing test.
