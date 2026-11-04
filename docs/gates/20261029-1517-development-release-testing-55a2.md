---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 8698e17e345c80778326a84d947ea24ebd3aa339
  - https://github.com/akmaier/agent-m/pull/1457
date: 2026-10-29 15:17 UTC
---
# Development → Release testing: ITM-1290, a form's finding on a key the document lacks stands beside its field

**REGISTER**

## Reason

ITM-1290, pull request #1457 into `sprint/team1/119`, passes on `8698e17e`, its head when this was decided. It was
returned once on `6b368cde` (`docs/gates/20261029-1501-development-release-testing-bcb0.md`), and the mend holds.

The Definition of Done is the default (SPEC.md:1869-1874).

1. **Each tests-only commit is red for the item's reason.**
   - `6b6d0a01`: run 40895797698 fails TST-1290001 and 002, read at the return.
   - `357e9350`: run 40898420900 fails only the recast TST-1290002, "a finding on a line no field holds stays at the end
     of the form, whatever its words name". It fails against the head that read a fix's wording. Its known positive,
     `documentFindings`' finding on the unknown key `colour` at the form's end, holds there.
   - The return asked for a known positive that passes before the change; 002 now has one.
2. **CI is green on the head.** Run 40898540014, `pull_request`, on `8698e17e` succeeds: 41 jobs pass and 17 are
   skipped.
3. **Only the item's files change:** `src/site-frame/forms.mjs`, `tests/site-frame-schema-form-missing-key.test.mjs` (new)
   and `tests/site-frame-schema-form-lists.test.mjs` (TST-1257002's `expect:`, in the first tests-only commit), all of
   MOD-site-frame. No test is removed. No commit is forced over.
4. **The Acceptance holds.**
   - `placed()` reads no wording of a finding: the pattern on `fix` is gone.
   - A finding is placed by its line. `documentFindings` checks the document with each empty field's key standing with
     an empty value, so a finding on a key the document lacks falls on that key's line.
   - `extraChecks` and `onSave` get the document as before, with the key left out.
   - TST-1290001: an emptied required list key and an emptied required text key each have their finding beside their
     field, and none at the end.
   - TST-1290002: a finding on a line no field holds stays at the end, whatever its words name.
5. **The planning set, run by me on `8698e17e`,** as the return said. It is every test that names `schemaForm`,
   `src/site-frame/forms.mjs`, MOD-site-frame, MOD-implementation-pages, MOD-maintenance-pages, MOD-settings-pages or
   MOD-test-pages: 286 files.
   - Left out, as at planning: the four mailbox files that hang on this machine.
   - I stopped the two `uc-003` Bridge files when they hung.
   - 2,399 pass, 7 fail and 12 todo. The 7 failing cases are, case for case, those of the planning run:
     `release-itm-269-endpoint-route`, TST-1281004, TST-1306307 to 309, TST-266001 and 002, all Bridge, Electron or
     endpoint-route cases this machine cannot run. No case fails because of the change.
6. **The reader.** On `8698e17e`:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - `site-frame-schema-form-missing-key`: 2 declarations; `site-frame-schema-form-lists`: 2; 0 findings each.
   - Both files and `test-document-one-line`: 6 pass and 0 fail.

## The readings ruled

1. **An empty front-matter value is read as a value left out.** MOD-documents states it for a table cell: "In a table, an
   empty cell or `—` is a value left out" (MOD-documents.md:115-116). For a front-matter key it states nothing either
   way. The reading takes the one sentence the texts hold on an empty value for the other place a value stands. It adds
   no rule the texts contradict, and needs no draft (AGENTS.md §6a.6).
   - It does not rest on the wording of a finding. It rests on the finding's line, which `A FINDING READS LIKE A COMPILER
     MESSAGE` gives (SPEC.md:894-897).
   - It is guarded loudly. Should `documentFindings` stop reading an empty value as left out, TST-1290001 fails on the
     missing finding. TST-1257002 fails on *Save* being offered while `modules` is empty
     (`site-frame-schema-form-lists:83`).
2. **On a new document, a required key's finding now stands beside its field.** That is the item's Outcome — "The form
   has a field for every key of its schema, so that finding too stands beside the field of its key" — and
   MOD-site-frame's "shown beside their fields while typing" (MOD-site-frame.md:270-271). In the planning set, no test of
   a form for a new document, such as the move form or the add-product form, expected it at the end.

## Noted

- ITM-1290 changes behaviour, so developer-sonnet-l writes its release tests.
