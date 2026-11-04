---
id: ITM-1152
title: The check `tests/test_issue_to_spec.py` is written, as the SPEC names it
level: module
realises:
  - EVOLUTION ENTERS THROUGH THE SPECIFICATION
modules:
  - MOD-issue-handling
builds_on:
  - ITM-582
  - ITM-584
tests:
  - release
origin:
  - developer-sonnet-g's release tests of UC-038 (ITM-965, pull request #1188, head 2ec69bc7), finding TST-965202
---
# ITM-1152 The check `tests/test_issue_to_spec.py` is written, as the SPEC names it

**REGISTER**

## Outcome

The SPEC names `tests/test_issue_to_spec.py` as the Check of `EVOLUTION ENTERS THROUGH THE SPECIFICATION`
(SPEC.md:863-866), and the file does not exist. TST-965202 found it, and marks it `todo`
(`tests/release-uc-038-turn-mails-into-issues.test.mjs:50`, `:94-95`). The behaviour it checks is MOD-issue-handling's:
an issue classed as a change becomes a change of requirements first, and a code change second. What it checks is on
`main`: `confirmClass` (ITM-582, #1255, `src/issue-handling/classes.mjs`) and the change drafted and saved as a queue
naming the issue (ITM-584, #1379, `src/maintenance-pages/issues.mjs`).
- The file is written as the SPEC words the check. Data in a Markdown file and code in the Python file (AGENTS.md §7), as
  `tests/test_conversation_not_recorded.py` does.
- A case that fails on the code as it stands is a finding. It is marked as the repository's release tests mark one, and
  the Product Owner registers an item for it.
- Where the Check sentence cannot be tested as worded, the writer stops and names it. A wrong pointer is a SPEC draft
  for akmaier.

## Acceptance

- `tests/test_issue_to_spec.py` exists and holds a case for the check the SPEC names. Each case is shown to fail on a
  fault planted in the code it checks.
- TST-965202's `todo` mark is removed, in a commit of its own, by a participant who did not write this file.
- It is not written by the implementer of the behaviour it checks.
