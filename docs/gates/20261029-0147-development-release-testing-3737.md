---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 1a2d54c5840760b8c55fee7a0324ff177bd21283
  - https://github.com/akmaier/agent-m/pull/1388
  - docs/backlog/ITM-1266-a-review-page-reads-only-the-folders-it-shows-of-its-commit-s-tree.md@44c931de4
date: 2026-10-29 01:47 UTC
---
# Development → Release testing: ITM-1266, a review page reads only the folders it shows of its commit's tree

**REGISTER**

## Reason

ITM-1266, pull request #1388 into `sprint/team1/110`, passes on `1a2d54c5`. That is the head the return of
`20261029-0142-development-release-testing-2ddc.md` read, and it is unchanged. The item is read as it stands on `main`
at `44c931de4`.

The Definition of Done is the default, SPEC.md:1870-1873, with AN IMPLEMENTATION JOB CHANGES ONLY ITS MODULES
(SPEC.md:1478-1481): "only code files in the folders of the modules the job was given, tests that name one of those
modules".

1. **The scope, the reason for the return, now holds.** ITM-1266 names MOD-repository-hosts, MOD-site-frame,
   MOD-review-pages, MOD-notifications, MOD-settings-pages and MOD-trace-pages.
   - The code it changes lies in `src/repository-hosts/`, `src/review-pages/` and `src/site-frame/` only.
   - Every changed test names one of the six in its header:
     - `tests/release-sprint-07-uc-047-notifications.test.mjs:13`: MOD-notifications;
     - `tests/dashboard-review-flows.test.mjs:8`: MOD-settings-pages;
     - `tests/system-itm-597-spec-traces.test.mjs:6`: MOD-trace-pages;
     - `tests/dashboard-spec-impact.test.mjs:7`: MOD-review-pages;
     - the others: MOD-site-frame or MOD-repository-hosts.
   - The Acceptance allows only the fakes of the three new modules' tests that the read sent as POST to `/graphql`
     reaches, and no code of them. Those edits are exactly that.
2. **CI is green.** Run 40801015509 on `1a2d54c5` passes 38 of 38 pull-request jobs.
3. **Red first.** `f615893a` holds only tests. Run 40798082332 fails only the new and rewritten cases and TST-1169002
   over their declarations; no test that existed before failed. The return's record names the jobs.
4. **Every new test names its module and requirement**: MOD-repository-hosts and MOD-site-frame, with A PAGE LOAD READS
   THE REPOSITORY IN BATCHES and two others.

## Noted

- **`tests/review-pages-release-limitations.test.mjs` is flaky,** as A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
  (SPEC.md:1587-1589) defines it.
  - On `2f3238dc`, in run 40799673718, its case "a green report has no reason field and is accepted as before" failed in
    attempt 1, "waited for the tag" (unit shard 7, job 123204544193).
  - All five of its cases passed in attempt 2 (job 123212708513).
  - Its wait counts 400 event-loop turns (`:119-124`). The failure is not this pull request's: it passes on the head.
  - It is for a new item.
- **The prompt bar's files on the instance's page** wait for a draft of MOD-site-frame, as ITM-1286.
