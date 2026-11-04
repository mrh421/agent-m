---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: rejected
on:
  - 6b368cde7a3ef22fe5bfc7aa04fc41903609ca11
  - https://github.com/akmaier/agent-m/pull/1457
  - docs/backlog/ITM-1290-a-forms-finding-on-a-key-the-document-lacks-stands-beside-its-field.md
date: 2026-10-29 15:01 UTC
---
# Development → Release testing: ITM-1290, a form's finding on a key the document lacks stands beside its field

**REGISTER**

## Reason

ITM-1290, pull request #1457 into `sprint/team1/119`, is returned on `6b368cde`, its head when this was decided.
- CI is green on the head (run 40895927210). The tests-only commit `6b6d0a01` is red (run 40895797698).
- The placing reads a wording that no interface states. The developer built the design my planning stand-in showed, so
  the cause lies in my planning.

The Definition of Done is the default (SPEC.md:1869-1874).

1. **What the code does.** `placed()` (`src/site-frame/forms.mjs`) takes a finding that falls on no field's line and
   reads the key out of its `fix` with `/^give the key (\S+) a value$/`. That wording is written in
   `src/documents/checks.mjs:169`, an implementation of MOD-documents.
2. **What the texts give.**
   - `documentFindings` names "front matter keys missing" (MOD-documents.md:276-277) and gives `Finding`s.
   - A `Finding` is `{ artifact, line, kind, rule, what, fix }` (MOD-text-tools.md:79). Its `fix` is "the correction
     expected", in words (`A FINDING READS LIKE A COMPILER MESSAGE`, SPEC.md:894-897).
   - No interface states the wording of a fix, nor which key a finding on line 1 concerns. Reading it is using
     MOD-documents through its implementation, which `DEVELOP AGAINST INTERFACES` forbids (SPEC.md:1262-1264). That the
     placing falls back to the form's end without a sound if the wording changes is the symptom the developer named.
3. **TST-1290002 makes the same wording a contract for callers.** Its `extraChecks` give findings whose `fix` reads
   "give the key colour a value" and "give the key title a value", and it asserts their places. No text gives a caller
   that form.
4. **A reading within the texts, which the developer may take or set aside under AGENTS.md §6a.6.**
   - A finding is placed by "the line it concerns" (SPEC.md:894-897). A key that stands has its line.
   - The form may check, while typing, the document with each emptied field's key standing with an empty value. MOD-documents
     reads an empty value as left out. `documentFindings` then gives the required key's finding on that key's line, and
     `placed()` puts it beside the field as it does now.
   - What `onSave` hands over stays as it is.
   - Where that does not hold, the item stops and names the missing sentence. A draft would then say where a finding on a
     key the document lacks stands, or let a `Finding` name its key; either is for akmaier.
5. **The rest holds.**
   - Only `src/site-frame/` and MOD-site-frame's tests change.
   - The red run fails only TST-1290001 and 002.
   - TST-1257002's `expect:` changes in the tests-only commit, as the Acceptance names.
   - **TST-1290002's red:** its known positive, the finding on `title` beside its field, needed the change, so a red
     tests-only commit does not show that the case's own guard can fail. With 002 recast on the line of a finding rather
     than on its fix, its known positive should pass before the change and its expectation fail.

## The mend

- Placing by line only, as item ITM-1290's Acceptance now says. Then TST-1290001 as it stands, and TST-1290002 recast
  without a fix's wording. A finding on a line that no field holds, such as a key the schema does not know, still stands
  at the form's end.
- The mend is a new change, so I rerun the planning set on it at the next gate: every test of the modules whose code
  calls `schemaForm`.
- The tests-only commit and its red run stay. A mended case goes in a commit of its own on #1457's branch, with no
  force-push.
