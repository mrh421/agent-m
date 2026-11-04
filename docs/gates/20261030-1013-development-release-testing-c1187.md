---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 6ba155f91e944bbd3ada4ff378efd4086d521ebf
  - https://github.com/akmaier/agent-m/pull/1518
date: 2026-10-30 10:13 UTC
---
# Development → Release testing: ITM-1187, the prompt bar offers this browser's endpoints and CLI sessions

**REGISTER**

## Reason

ITM-1187, pull request #1518 into `sprint/team1/127`, passes on `6ba155f9`, its head when this was decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1877-1882).

1. **CI.**
   - **Tests-only commit `f6575f66`:** run 41033047841 (`pull_request`) fails in four jobs. Each job's own list of failing
     tests holds only the item's cases:
     - unit (4): the two `sessionsOffered` cases of `tests/prompt-bar-offer.test.mjs`;
     - unit (14): TST-506001 of `tests/site-frame-prompt-bar.test.mjs`;
     - component (4): four cases of the new `tests/prompt-bar-endpoints.test.mjs`;
     - component (7): four cases of `tests/prompt-bar.test.mjs`, the link to `endpoints` among them.
     - That is the item's reason: the base offered no CLI session, read `docs/participants.md` for the offer, and linked
       `participants` (`src/prompt-bar/bar.mjs:461-463`, `:501-505` of the base).
   - **Implementation commit `e10f61da`:** run 41033732418 fails in three system jobs and one release job. These are the
     system and release tests the Acceptance gives to a participant who did not build the item, and `system-uc-037`.
   - **`22d9c51b`:** run 41037073046 fails in one job, release (8), on TST-433802 of `release-uc-037` alone. `6ba155f9`
     changes that case.
   - **Head `6ba155f9`:** run 41037902554 (`pull_request`, attempt 1) succeeds: 41 jobs succeed, 17 are skipped, none
     failed. The Scrum Master reports that it merges into `sprint/team1/127` without conflict, which now holds #1515, #1516
     and #1520.
2. **Only the item's files change.**
   - Code: MOD-prompt-bar only, `offer.mjs` and `bar.mjs`.
     - `offer.mjs` adds `sessionsOffered(store)`.
     - `bar.mjs` offers `endpointsOffered` and then `sessionsOffered`, reads no participant list for the offer, and links
       `endpoints`.
     - Its new imports, `bridgeAt`, `settingsOf` and `testBridge`, are each named in MOD-prompt-bar's Uses
       (MOD-prompt-bar.md:64-67). No top-level await is added.
     - `readParticipants` and `offeredAmong` stay for `send.mjs` and `hand-over.mjs`, as the planning run said.
   - **Authors.** `f6575f66` holds tests only and `e10f61da` code only, both by developer-opus-e.
   - `22d9c51b` and `6ba155f9` are developer-sonnet-l's, and change only tests: the system and release files, the two
     Python checks with their data, and the harnesses.
   - **Two system and release files the Acceptance does not list:** `system-uc-037-connect-mailbox` and
     `release-uc-037-connect-mailbox` (TST-433702, 433706, 433707 and 433802), and the world of `system-uc-039`.
     - Their cases count requests to a Bridge, and drawing the bar now sends `testBridge`'s two (MOD-prompt-bar.md:191-194).
     - The planning run left them out, since `system-uc-037`, `release-uc-037` and `system-uc-039` hang on the planning
       machine (`team1/127.md`, the brief). It did not run them, so the gap is the planning's, not the Developer's.
     - They were changed by a participant who implemented none of the item.
3. **It builds the accepted text and the item's Acceptance** (MOD-prompt-bar.md:186-208; UC-049 1, 1a, 1b; UC-019 3a).
   - `tests/prompt-bar-endpoints.test.mjs` exists, the check SPEC.md:413-421 names, with six declarations, TST-1187101 to
     1187106, and its counter-proof that the list is not read for the offer.
   - The offer's unit cases TST-1187001 and 1187002 stand in `tests/prompt-bar-offer.test.mjs`. The store holds an
     endpoint, a Bridge offering a CLI session, and one of each lacking a model.
   - TST-377016 and 377017 lose their `todo` and pass. Their `FLOW_FINDINGS` entries move to `FLOW_EVIDENCE`.
   - TST-513202 loses its `todo`, and the requirement is covered by the file. `MISSING_CHECKS` was emptied and its code
     removed. The stricter rule now holds for every named check: each one is among the evidence.
   - The endpoint offer, *Spawn job* and the hand-over are not built again.
4. **The pull request's readings hold.**
   - **A CLI session is named `<bridge>:<agent>`.** No accepted text gives a session a participant name. MOD-prompt-bar
     gives its declaration as `session:<bridge>:<agent>` and its route as `bridge <bridge> agent <agent>`, and the settings
     page labels it "CLI session: `<bridge>:<agent>`". UC-049 1 asks only that the selector name it with its place. The
     reading takes the name its setting already gives (AGENTS.md §6a.6), and the item's planning stand-in named no other
     rule.
   - **A Bridge that cannot be tested offers nothing and is not named.** MOD-prompt-bar.md:192-195 offers a session "as
     MOD-bridge-client's `testBridge` lists it ready". A Bridge whose `testBridge` fails lists none, and "with none offered
     it draws nothing and says nothing" (UC-049 1a). No text asks the bar to name a failed Bridge. `settingsOf`'s
     `JumpHostMissing` is one such failure, caught alike. TST-1187103 c counts its one request.
   - **The wording where nothing can converse:** "No endpoint or CLI session of this browser can do converse: it needs
     draft text.", with *Set up endpoints*. MOD-prompt-bar.md:205-206 asks that the bar "says so, names the capabilities it
     needs, and links the route `endpoints`", and UC-019 3a asks that it "says so and links to the configuration of
     endpoints". Both are met.
5. **No case is weakened.** Every removed assertion of the diff was read beside what replaced it.
   - **TST-433702, 433706, 433707** (`system-uc-037`) **and TST-433802** (`release-uc-037`) now allow requests to a Bridge
     only if their path is `/v1/pair` or `/v1/agents`.
     - Each asserts the presence of those requests as its known positive.
     - Each asserts that no other request reached a Bridge.
     - The exemption could hide a mailbox request only if the mailbox route sends one of those two paths. It does not:
       - `src/settings-pages/mailbox.mjs` imports only `bridgeAt` and `settingsOf` of MOD-bridge-client;
       - a search of `src/mail-handling`, `mail-protocols`, `mail-records` and `mail-routes` for `/v1/pair`, `/v1/agents`,
         `testBridge` or `pair` finds only a word in a vendored address parser.
       - The same search over `src/` finds the senders, `bridge-client/index.mjs:123-139`, which is its known positive.
   - **TST-1186301 and 1186302** assert the exact list of paths, `["/v1/pair", "/v1/agents"]` at the draw and four with
     *Test*, not a looser filter.
   - **TST-1139001 and 1200002** (`prompt-bar-hand-over`) compare the requests with exactly the draw's two (`DRAWN`).
   - **TST-377010 now asserts the opposite of before, per the accepted text.**
     - It asserts that the bar offers drafter only.
     - It also asserts that `listed`, an endpoint of the participant list this browser does not configure, is not offered,
       which is new.
     - The message reads "No endpoint or CLI session of this browser can do converse".
     - Its old press of *Set up participants* to `#participants` is gone. TST-377017 asserts the new link instead: no
       *Set up participants*, and *Set up endpoints* opens `#endpoints`.
   - **The item's hand-overs** (TST-505001 to 505007 and the cases with them) are now proposed by the CLI session
     `lab-pc:claude` through the Bridge.
     - An endpoint's capabilities are fixed: *draft text* and *read the repository*, with *use tools* after a test
       (MOD-prompt-bar.md:197-199). So no endpoint can do `implement`.
     - The GitHub Actions route keeps its cases through dev-ci's `converse` hand-overs (TST-505008 and the cases with it),
       with the same strict counts of commits and workflow starts.
   - **TST-513205:** `nothing-declared`, an endpoint without a place, is no longer offered, by UC-049 1b. The case asserts
     its absence, and that it is configured and lacks its place as the known positive.
   - **TST-600020** keeps "nothing drawn, no request, no write" for a store whose only endpoint lacks a place and a
     context, beside a list that holds a reachable endpoint.
6. **Counter-proofs.**
   - The Acceptance's counter-proof is the red tests-only run of point 1.
   - **Planted on the head in an export, each restored after.** Ten files:
     - `prompt-bar-endpoints`, `prompt-bar-offer`, `prompt-bar`, `prompt-bar-hand-over`;
     - `site-frame-prompt-bar`, `main-page-jobs`, `test-document-one-line`;
     - `system-uc-019-change-by-prompt`, and UC-049's system and release files.
   - Unplanted, 141 cases: 140 pass, 1 `todo` (UC019-S10), 0 fail.
   - **`sessionsOffered` offers nothing,** as the base: 29 cases fail.
     - Among them: both offer cases, four of `prompt-bar-endpoints`, TST-377010, 377016 and 377017, and TST-513206 and
       513208.
     - Also the hand-over cases that now go through `lab-pc:claude`.
   - **The link goes to `participants` again:** TST-377017 and the link case of `prompt-bar` fail.
   - **An agent not ready is offered:** the `sessionsOffered` case "none of an agent not ready" and the 1b case of
     `prompt-bar-endpoints` fail.
   - **A session lacking a place, a context or a model is offered:** three cases fail:
     - the `sessionsOffered` shape case;
     - the 1b case of `prompt-bar-endpoints`;
     - TST-513007, alternative 1b.
   - Restored: `offer.mjs` and `bar.mjs` are byte-equal to the head's.
7. **MOD-test-document's reader,** over every changed and new test file and harness at the head:
   - `prompt-bar-endpoints` gives 6 declarations and `prompt-bar-offer` gives 11.
   - Every other file gives 0 findings, but one. Each header names its modules one per line, with one level.
   - The exception is `tests/prompt-bar-one-kind.test.mjs`: 5 declarations, 2 findings.
     - The findings are TST-1360003, which guards "UC-019 4b", and TST-1360004, which guards "UC-049 3b", under A
       REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION.
     - Both lines stand as they are on the base, and the item does not touch them. See Noted.
   - The control, `tests/release-itm-1254-issue-move.test.mjs`: 4 declarations, 0 findings.
8. **Reads and requests, against the planning count** (`team1/127.md`).
   - With no Bridge stored, drawing the bar sends no request, as before.
   - With one Bridge, it sends `GET /v1/pair` and `GET /v1/agents`. With two, it sends four. With a Bridge that refuses,
     it sends one.
   - `docs/participants.md` is no longer read at the draw. TST-506001 asserts 0 reads, where the base asserted 1.
   - Each count is asserted in TST-1187103 and the cases point 5 names.
9. **The UC-023 harness keeps `docs/participants.md`.**
   - MOD-review-pages' draft page still chooses its deriving and reviewing participants from the register
     (`src/review-pages/jobs.mjs`, `loadStage`), which is not this item's module.
   - The harness's rows now name `endpoint drafter` and `endpoint reviewer`, the store's new keys, and the bar takes its
     offer from those keys.

## Noted

- **For the Product Owner, a new item of MOD-prompt-bar's tests:** `tests/prompt-bar-one-kind.test.mjs` has two findings
  under A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION. TST-1360003 guards "UC-019 4b" and TST-1360004 guards
  "UC-049 3b", where a use case is to be named without its step. They stand on the base, and ITM-1187 did not write them.
- **For the next planning:** a planning run that leaves out the files that hang on the planning machine does not list the
  cases of those files that the change moves. Here they were `system-uc-037`, `release-uc-037` and `system-uc-039`'s
  world. Their CI result is read before the Acceptance is written, or the Acceptance names them as unread.
- The pull request's description names no `JOB-` identifier. Its "Green: pending" was written before the runs above.
