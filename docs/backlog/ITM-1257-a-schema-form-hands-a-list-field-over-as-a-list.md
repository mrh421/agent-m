---
id: ITM-1257
title: A schema form hands a list field over as a list
level: module
realises:
  - UC-033
modules:
  - MOD-site-frame
  - MOD-maintenance-pages
builds_on:
  - ITM-1250
tests:
  - unit
origin:
  - the architecture draft of the item link (branch arch-item-link-in-product, developer-opus-c), on ITM-1250's issue route
---
# ITM-1257 A schema form hands a list field over as a list

**REGISTER**

## Outcome

MOD-site-frame.md:257-263: `schemaForm` gives "one field per key and section of a schema of MOD-documents", checks with
`documentFindings` while typing, and hands `onSave` the `Document`. The form does not build a key whose value is a list: it
"hands over as the text typed" (`src/site-frame/forms.mjs:21-22`). So the issue route of ITM-1250
(`src/maintenance-pages/issues.mjs`, *Move to backlog*) builds a second item schema with its list keys typed as text, reads
them back as lists, and runs `documentFindings` again, which MOD-maintenance-pages' Uses do not name.

The form hands a list key over as a list, and the issue route gives it the item schema itself, with no schema and no check
of its own.

## Acceptance

- Unit tests naming MOD-site-frame: a list key typed in its field reaches `onSave` as a list, and a finding on it is shown
  beside its field. Unit tests naming MOD-maintenance-pages: the move form is `schemaForm` over the item schema, and *Add*
  hands `moveToBacklog` the lists. Counter-proof: before the change the list key reaches `onSave` as text.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/site-frame/`, `src/maintenance-pages/` and the tests that name these modules change.
