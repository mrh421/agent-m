---
id: ITM-1274
title: The specification reads what each waiting entry changes, not its rationale
level: module
realises:
  - UC-020
  - OPEN PROPOSALS ARE SHOWN IN THE BROWSER
modules:
  - MOD-spec-changes
  - MOD-trace-pages
  - MOD-site-frame
builds_on:
  - ITM-1272
tests:
  - unit
  - component
origin:
  - akmaier, 2026-10-28: "A lot of the stuff that is loaded on the new pages right now is actually never looked at. It is unlikely that a user needs all records at once." Then: "Please follow up. I want all pages fixed this way."
---
# ITM-1274 The specification reads what each waiting entry changes, not its rationale

**REGISTER**

## Outcome

`#spec` marks each requirement that a waiting entry changes, withdraws or adds. `arrangement`
(`src/trace-pages/flow.mjs:549-569`) names every waiting entry's rationale to `readMany` (`:552-554`) and calls
`entryView` (`:556`), which reads the rationale too (`src/spec-changes/accept.mjs:101`); the page uses only `impact`.
The rationales — `NN-*.begruendung.md`, ~2.2 KB on average, 136 files in Agent M — are shown on an entry's own page,
never on `#spec`. At Agent M's head no entry waits, so the cost today is nil; it grows with each waiting entry.

After the change, as MOD-spec-changes and MOD-trace-pages say: `entryImpact(queue, entry, snapshot)` gives what one entry
changes, withdraws or adds, from its queue, target and proposal, and reads no rationale; `entryView` gives its impact list
as `entryImpact` does; the specification calls `entryImpact` and names no rationale to `readMany`.

Design principles (AGENTS.md §2 *Designing*): ch. 10 *a module interface is minimal* — the specification asks for the
impact, not for everything a reviewer sees; §2.2 — `entryView` builds its impact list with `entryImpact`, not with a
second copy.

## Acceptance

Tests written first, each red on the commit that holds only them:

- `tests/spec-changes-entry-impact.test.mjs` (MOD-spec-changes, unit): for an entry that changes one requirement and adds
  another, `entryImpact` gives both and reads no `.begruendung.md`; `entryView`'s `impact` equals it. Counter-proof: a
  fixture whose rationale cannot be read still gives the impact.
- `tests/trace-pages-specification.test.mjs` (MOD-trace-pages, component): with three waiting entries, the marks as
  today and no request for a `.begruendung.md`.

Measurable outcome: `#spec` reads, per waiting entry, its proposal and target and no rationale (~2.2 KB less each).

- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only the folders of MOD-spec-changes and MOD-trace-pages and the tests that name them change, and, of MOD-site-frame, only
  the two `#spec` cases of `tests/load-per-view.test.mjs` that count the open entry's rationale, its fourth batch: it is
  no longer read. No code of MOD-site-frame changes.
