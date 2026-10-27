# 10. Review on GitHub Pages: a proposal is rejected with a reason

**The change.** Two new requirements, before `THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK`:
- `A PROPOSAL IS REJECTED WITH A REASON` — **Reject** stands beside **Accept** for use cases, architecture decisions
  and SPEC change entries, and writes nothing until a reason is typed.
- `A REJECTION REMOVES THE PROPOSAL` — one commit under the person's account, the reason in its message; a SPEC change
  entry leaves its queue, a reviewed file returns to its last accepted text or leaves the working tree.

`WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK` names rejecting beside accepting and editing.

**Why.** akmaier, 2026-10-27: "there is an accept button, but none to reject. We also need this for UCs and
Architecture changes, not just requirements. The reject also should prompt for a reason of the rejection." Today a
rejection leaves the entry open "until it is removed from the queue by a commit" (UC-006 4a), so an agent has to
withdraw it by hand, and no reason is recorded where the next draft can find it.

**Design principles** (AGENTS.md §2):
- One responsibility per rule: offering Reject and requiring a reason is one sentence; what the rejection writes is
  another.
- Nothing twice: the reason lives in the rejection commit's message only; the history keeps the rejected text
  (AGENTS.md §1, "History belongs in git commit messages").
- Nothing the SPEC already says: `ACCEPTANCE IS A COMMIT BY THE ACCEPTING PERSON` and `STATUS IS DERIVED FROM THE
  RECORDS` stay as they are; a rejection adds no record, so no status is stored.
- No special first case: use cases, architecture decisions (modules included, as `A MODULE'S FILE IS WRITTEN, REVIEWED,
  ACCEPTED AND CHANGED AS AN ARCHITECTURE DECISION IS` says) and SPEC change entries are rejected the same way.

**Impact list.**
- Requirements: the two above, new; `WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK`, changed. Check:
  `tests/review-core.test.mjs`.
- Use cases: UC-006 4a (rejecting a SPEC change), UC-008 (a new alternative flow for a use case), UC-023 (a new
  alternative flow for an architecture change); each realises the two new requirements. Changed in the same commit,
  open for acceptance.
- Architecture: MOD-review-pages (the button and the reason), MOD-spec-changes (removing an entry from its queue),
  MOD-approvals (the last accepted text of a file); changed after acceptance.

**Origin.** SRC-po-a-maier (registered person github.com/akmaier).
