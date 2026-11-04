---
id: ITM-1290
title: A form's finding on a key the document lacks stands beside its field
level: module
realises:
  - A FINDING READS LIKE A COMPILER MESSAGE
modules:
  - MOD-site-frame
builds_on:
  - ITM-1257
tests:
  - unit
origin:
  - po-opus-c's gate of ITM-1257 (PR #1392), docs/gates/20261029-0247-development-release-testing-4142.md, reading 2
---
# ITM-1290 A form's finding on a key the document lacks stands beside its field

**REGISTER**

## Outcome

MOD-site-frame.md:270-271 says `schemaForm` shows the findings of `documentFindings` and of `extraChecks` "beside their
fields while typing". A finding on a key the document lacks — a required field emptied, so the key is left out — is
shown at the end of the form (the header of `src/site-frame/forms.mjs`; TST-1257002). The form has a field for every key
of its schema, so that finding too stands beside the field of its key.

## Acceptance

- A unit case empties a required list field and a required text field, and finds each "required" finding beside its
  field; it fails on the form as it stands. A finding on a key the schema does not know stays at the form's end.
- Only `src/site-frame/` and its tests change.
- The form places a finding by its line, the line it concerns (`A FINDING READS LIKE A COMPILER MESSAGE`). It reads no
  wording of a finding's `what` or `fix`, which no interface of MOD-documents states (DEVELOP AGAINST INTERFACES).
- TST-1257002 (`tests/site-frame-schema-form-lists.test.mjs`, MOD-site-frame) says in its `expect:` that the finding
  "modules is required" stands "at its end, where the frame shows a finding on a key the document lacks". That sentence
  changes in the tests-only commit; its assertions hold, since they look for the finding anywhere in the form.
- Tests of other modules this Outcome changes: none. The run was made on `main` at `b40c5059d` with a stand-in of the
  change: in `placed()`, a finding that falls on no field's line goes beside the key its fix names ("give the key <key>
  a value"). That stand-in served the run only; it reads a fix's wording, which the line above excludes. A probe showed the stand-in placing "the key modules is required" beside the field `modules`. The run took
  every test that names `schemaForm`, `src/site-frame/forms.mjs` or one of the modules whose code calls `schemaForm`:
  MOD-site-frame, MOD-implementation-pages, MOD-maintenance-pages, MOD-settings-pages and MOD-test-pages. That is 286
  files, less the four mailbox and Bridge files that hang on this machine.
  - No case fails because of the change.
  - Seven cases fail, all of them Bridge, Electron or endpoint-route cases: TST-1281004, TST-1306307 to 309, TST-266001
    and 002, and the file `release-itm-269-endpoint-route`. The latter fails without the change too.
