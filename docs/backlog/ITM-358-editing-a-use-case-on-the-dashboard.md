---
id: ITM-358
title: Editing a use case on the dashboard
level: module
realises:
  - UC-008
  - UC-018
  - EDITS ARE PREPARED ON THE DASHBOARD
  - A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE
  - A REFUSED SAVE KEEPS THE EDIT
  - AN EDITED FILE KEEPS ITS IDENTIFIER
  - A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN
  - A USE CASE HAS ACTOR, PRECONDITION, FLOW AND POSTCONDITION
  - WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK
  - NO TEXT TRAVELS IN A URL
  - A GITLAB PRODUCT IS WRITTEN WITH A TOKEN
  - ONE CLICK PER DECISION
  - THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
modules:
  - MOD-review-pages
builds_on:
  - ITM-335
  - ITM-343
  - ITM-355
  - ITM-306
tests:
  - unit
origin:
  - UC-018 steps 1 to 7 for a use case, 3b, 3c, 3e, 4a, 4b, 5a, 6b, 7a
  - UC-008 3a
built_by:
  - 7749380ae3e59944210e6f39d38a86901b841980
---
# ITM-358 Editing a use case on the dashboard

**REGISTER**

## Outcome

MOD-review-pages' route `use-case/<id>/edit`, as its file states it: the editor with live preview (ITM-343) shows the
descriptor's marks without blocking *Save* — a missing field from the use-case schema, and a name under `realises` that
matches no requirement, from `graphFindings` (ITM-306); *Save* goes through `saveFile`, on the blob the editor was
opened on; a changed `id` disables *Save* and shows the reason (ITM-335); a refused save keeps the edit beside the newer
text; without a token, GitHub's editor opens with the text on the clipboard, and a warning when the file differs; on
GitLab without a token there is no *Save* and the token's step is linked; without write access, the GitHub route is
offered; a link leads to the arrangement for another group (UC-021); leaving with unsaved changes asks first.

## Acceptance

- Unit tests that name MOD-review-pages state, before the code exists: an edit saved in one commit, the use case open
  or changed afterwards; marks shown with *Save* still offered; a changed `id`: *Save* disabled, with the reason;
  changed meanwhile: nothing written, the edit kept beside the newer text; without a token: a link without text, the
  text for the clipboard; GitLab without a token: no *Save*.
- The first commit holds only these tests, and CI is red on it; every new test's counter-proof is recorded in the pull
  request.
- The existing tests stay green, with no expected result changed.
- Only `src/review-pages/` and the tests that name MOD-review-pages change.
