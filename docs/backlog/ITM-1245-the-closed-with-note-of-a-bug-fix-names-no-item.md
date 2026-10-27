---
id: ITM-1245
title: The closed-with note of a bug fix names no item
level: module
realises:
  - UC-012
modules:
  - MOD-mail-records
builds_on: []
tests:
  - unit
origin:
  - the developer of ITM-583, who found that the comment of a bug fix's close cannot be produced; verified by the scrum master on main at 11ee0249
---
# ITM-1245 The closed-with note of a bug fix names no item

**REGISTER**

## Outcome

MOD-mail-records.md:73 states the note `closed-with` as ``Closed with <the address of the pull request or commit>; item
`ITM-…`.`` "(the item part only where there is one)". UC-012 step 5 closes a fixed bug "with a link to the fix" (UC-012.md:58),
and a bug fix has no item: MOD-issue-handling's `closeWithLinks` takes `links.item: string | null` (MOD-issue-handling.md:82).

The code refuses a `closed-with` without an item: `noteText` (`src/mail-records/issue-marks.mjs:29-32`) checks the subject
against the item identifier for `closed-with` and throws `NotAnIdentifier` for `""` and `null`; with `"ITM-123"` it gives
``Closed with https://x/pull/1; item `ITM-123`.``

`noteText("closed-with", null, date, link)` gives ``Closed with <link>.``, without the item part; with an item it stays as
it is; any other subject that is no item identifier is still refused. The other kinds do not change.

## Acceptance

- Unit tests naming MOD-mail-records: `closed-with` without an item gives the text without the item part; with an item the
  text is unchanged; a subject that is no item identifier is still refused. Counter-proof: before the change the first
  throws `NotAnIdentifier`.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/mail-records/` and the tests that name MOD-mail-records change.
