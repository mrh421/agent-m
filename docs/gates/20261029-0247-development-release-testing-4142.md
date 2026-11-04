---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 4657f60b119b69b114cd68a6849193b596733679
  - https://github.com/akmaier/agent-m/pull/1392
date: 2026-10-29 02:47 UTC
---
# Development → Release testing: ITM-1257, a schema form hands a list field over as a list

**REGISTER**

## Reason

ITM-1257, pull request #1392 into `sprint/team1/111`, passes on `4657f60b`, its head when this was decided.

The Definition of Done is the default (SPEC.md:1870-1873).

1. **CI is green.** Run 40805825818 on `4657f60b` passes 38 of 38 pull-request jobs.
2. **Red first.** `ad17d62d` holds only the two new test files. Run 40805389326 fails only new cases:
   - TST-1257001 and 1257002 (unit shard 15, job 123223053223);
   - the case "a finding on a module stands beside its field, once" of `tests/maintenance-pages-move-lists.test.mjs`
     (unit shard 2, job 123223053102).
3. **Only its modules change.** `src/site-frame/forms.mjs`, `src/maintenance-pages/issues.mjs`, and two tests that name
   MOD-site-frame and MOD-maintenance-pages.
4. **The new tests name their requirement and module.** TST-1257001 and 1257002 are on MOD-site-frame, TST-1257003 and
   1257004 on MOD-maintenance-pages.
5. **The Outcome holds.**
   - `schemaForm` hands a list key over as a list, as MOD-site-frame.md:268-274 gives it the Document.
   - The issue route's second schema, `LIST_KEYS`, `listed` and its own `documentFindings` go. `extraChecks` is
     `backlogFindings` alone.

## The developer's readings

1. **A list is typed as its items separated by commas.**
   - MOD-site-frame.md:268-270 says only "one field per key". The reading follows how MOD-documents writes a list on one
     line, and the page did the same before (`namesOf`).
   - An item that holds a comma, such as a free-text `origin`, cannot be typed as one item. That was so before too.
2. **TST-1257002 changed in the implementation commit: an emptied list field's "required" finding now stands at the
   form's end.**
   - ITM-1257's Acceptance asks that "a list key typed in its field reaches `onSave` as a list, and a finding on it is
     shown beside its field". That still holds: the finding on the item `store` stands beside `modules`.
   - The emptied field is a key the document lacks. For every key, the frame shows such a finding at the end
     (`forms.mjs` header: "no field — a key or a section the document lacks … — is shown at the end of the form").
     This was so before the item.
   - So the first expectation went beyond the Acceptance, and its change does not bend the item's behaviour to the code.
   - It is noted against the text, for a new item: MOD-site-frame.md:270-271 says the findings are "shown beside their
     fields while typing", and a required key emptied has a field.
