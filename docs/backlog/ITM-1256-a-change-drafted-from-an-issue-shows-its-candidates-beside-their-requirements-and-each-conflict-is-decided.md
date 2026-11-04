---
id: ITM-1256
title: A change drafted from an issue shows its candidates beside their requirements, and each conflict is decided
level: module
realises:
  - UC-012
  - UC-033
modules:
  - MOD-maintenance-pages
builds_on:
  - ITM-584
tests:
  - unit
origin:
  - the review of ITM-584 (PR #1379) by reviewer-sonnet: the issue route lists the candidates and writes no conflict, and offers no way to decide one
---
# ITM-1256 A change drafted from an issue shows its candidates beside their requirements, and each conflict is decided

**REGISTER**

## Outcome

MOD-maintenance-pages.md:119-120: on the issue route, the change drafted from an issue is "run attended, its candidates
shown by class beside the requirements they refer to and every conflict decided by the person, then *Save*".

ITM-584 lists the candidates by class only (`src/maintenance-pages/issues.mjs`, `changeSection`), and a conflict is not
written, since `queueEntries` composes a conflict only as the person resolved it (`src/spec-changes/propose.mjs:18`, `:83`);
the page offers no decision. The review pages already show candidates by class with the conflicts and their decisions
(`src/review-pages/jobs.mjs:341-414`, `src/review-pages/candidates.mjs`); the issue route shows the same, not a copy of it.

## The reading of the accepted text

- **What the accepted text gives.** No interface of MOD-review-pages gives candidates by class: it provides `view` only.
  MOD-maintenance-pages draws them itself, from what its Uses name:
  - each candidate's class from the result's `classes`, `Classified` of MOD-documents (MOD-job-runner.md:278-283);
  - the rule of the requirement a candidate refers to from the prepared job's parts, whose `artifacts` give "for a
    requirement its name and its rule" (MOD-job-runner.md:254-255);
  - a conflict decided as the class the person gives it, written by `writeResult` with "its `classes` replaced by theirs"
    (MOD-job-runner.md:356-360), which `entrySections` composes "only as the person resolved it"
    (MOD-spec-changes.md:178-179).
- **The reading taken.** The item builds what MOD-maintenance-pages.md:119-120 states, from what its Uses name. The
  existing requirement's sources, which the sentence below asks for beside a conflict, are not shown on the issue route;
  the pull request names that as a finding, a gap between the SPEC and the module's text, for akmaier, and the item does
  not wait for it.
- **What it does not give.** A CONFLICT IS DECIDED BY A PERSON (SPEC.md:296-298): "A candidate that contradicts an
  existing requirement is shown beside it, with both sources and their authority". The sources of the existing
  requirement stand in its head line in the SPEC. No function MOD-maintenance-pages' Uses name gives them: a part's
  `artifacts` give the name and the rule, and MOD-maintenance-pages names no MOD-spec-document, which MOD-review-pages
  names to read them.

## Acceptance

- Unit tests naming MOD-maintenance-pages, over the issue route with a drafted change: each candidate is shown beside the
  requirement it refers to; a conflict offers the person's decision, and *Save* writes it as decided; *Save* is offered
  only when every conflict is decided. Counter-proof: before the change a conflict cannot be decided and is not written.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/maintenance-pages/` and the tests that name MOD-maintenance-pages change.
