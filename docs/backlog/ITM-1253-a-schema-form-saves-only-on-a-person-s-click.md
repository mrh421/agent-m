---
id: ITM-1253
title: A schema form saves only on a person's click
level: module
realises:
  - THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
modules:
  - MOD-site-frame
builds_on: []
tests:
  - unit
origin:
  - the review of ITM-1250 (PR #1380) by reviewer-sonnet: a scripted click on the form's Add commits, comments and labels
---
# ITM-1253 A schema form saves only on a person's click

**REGISTER**

## Outcome

SPEC, THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK: "The dashboard writes to a repository only as the direct result of a
person's action on it". MOD-site-frame's `schemaForm` "writes nothing itself: `onSave` does" (MOD-site-frame.md:257-263).

The form's *Save* calls `onSave` on any click event, also a script's (`src/site-frame/forms.mjs:189`), so every page built on
it writes on a scripted click: the settings pages' library, participants and resources, the process page, and the issue
route's *Add* (ITM-1250). The pages that draw their own buttons check the event first (`src/maintenance-pages/mail.mjs:57`,
`replies.mjs:64`). The form calls `onSave` only for a click a person made.

## Acceptance

- Unit tests naming MOD-site-frame: a script-made click on *Save* calls no `onSave`; a person's click calls it once with the
  document. Counter-proof: before the change the script-made click calls `onSave`.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/site-frame/` and the tests that name MOD-site-frame change; tests of the pages that drive the form by a script
  click change only to click as a person does.
