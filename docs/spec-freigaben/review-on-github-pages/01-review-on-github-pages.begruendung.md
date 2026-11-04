# 10. Review on GitHub Pages: A PERSON'S EDITS COLLECT IN ONE OPEN QUEUE withdrawn

**The change.** `A PERSON'S EDITS COLLECT IN ONE OPEN QUEUE` is withdrawn: its block — name, rule and check — leaves the
section. Every other byte of the section is carried over.

**Why.** akmaier, 2026-11-01: "Withdraw A PERSON'S EDITS COLLECT IN ONE OPEN QUEUE." With one package per SPEC section
("Spec-Freigaben packages: aren't packages modules?"), an edit is an entry of its section's queue, whoever saves it and
on whichever day; a queue per person and day has nothing left to collect. `A SPEC EDIT IS SAVED AS A PROPOSAL` still
says that an edit is written as an entry of a change queue under `docs/spec-freigaben/`.

**Impact list.**
- A PERSON'S EDITS COLLECT IN ONE OPEN QUEUE: withdrawn; named by UC-018 (realises), ARC-041 (forced_by),
  MOD-spec-changes (`openQueueOf`), `docs/groups/requirements.md`, and the checks in
  `tests/spec-changes-propose-section.test.mjs`, `tests/review-pages-edit-requirement.test.mjs` and
  `tests/repository-hosts-history.test.mjs`. UC-018, ARC-041, MOD-spec-changes and the group file drop the name in their
  own changed files beside this queue; the checks are moved with the code once this entry is accepted.

**Origin.** akmaier's decision of 2026-11-01 on the SPEC change packages.
