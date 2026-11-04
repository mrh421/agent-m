---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - c5dc42e8358584f1b28d2c7f6da59e6133defa02
  - https://github.com/akmaier/agent-m/pull/1510
date: 2026-10-30 07:53 UTC
---
# Development → Release testing: ITM-739, the system and release tests of UC-023

**REGISTER**

## Reason

ITM-739, pull request #1510 into `sprint/team1/126`, passes on `c5dc42e8`, its head when this was decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1869-1874).

1. **CI.** Run 41021662079 (`pull_request`) on `c5dc42e8` succeeds: 41 jobs succeed, 17 are skipped, none failed.
   - The item adds tests of behaviour already merged, so no commit of it is red. The pull request says so.
   - Each new case's counter-proof is a fault planted in the code it guards (point 5).
2. **Only new test files change.** The Acceptance asks for that:
   - `tests/uc-023-harness.mjs`, a helper;
   - `tests/system-uc-023-modify-the-architecture.test.mjs`;
   - `tests/release-uc-023-review-pages.test.mjs`, `release-uc-023-reject.test.mjs` and
     `release-uc-023-described-change.test.mjs`.
   - No code, SPEC, use case, architecture file or existing test changes.
3. **The author implemented none of the behaviour the tests check** (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER,
   SPEC.md:1537-1541).
   - The pull request names developer-sonnet-l as the author of every new test.
   - The builders read at planning (`team1/126.md`): ITM-728 and ITM-729, developer-sonnet-f; ITM-724,
     developer-sonnet-i; ITM-730, developer-opus-e; ITM-731, developer-sonnet-e.
4. **It builds the Acceptance.**
   - **The system test** walks the main flow, step 1 by both routes, steps 2 to 6, and the alternative flows 1b, 2a,
     4a, 4b, 4c and 5a, with fixture participants and a fixture repository host.
   - **Release tests.** UC-023 realises 37 requirements, of which 28 name a check that is a test. A reader over the three
     release files finds every one of the 28 among their `guards`, and finds none missing. Its known positive: A
     REJECTION REMOVES THE PROPOSAL is found.
   - **Findings.** Where the pages and UC-023 disagree, the case follows UC-023, is marked `todo` and names the finding:
     six cases, S1 to S5 (below).
   - On the sprint branch merged locally with `c5dc42e8`, Node 26:
     - the four files with the release tests of ITM-1314 and ITM-1186: 50 tests, 44 pass, 6 `todo`, 0 fail;
     - those six are the findings.
5. **Counter-proofs.**
   - The pull request lists a planted fault for each of the 41 cases, each failing its case.
   - Two of my own, on the head, restored after:
     - The impact list without the mark *breaks* fails TST-739002 and TST-739006.
     - `rejectShown` writing a text instead of deleting a never-accepted file fails TST-739122.
6. **MOD-test-document's reader:**
   - The system file: 13 declarations, 0 findings. Its header gives four modules, one per line, and the level `system`.
   - The release files:
     - `release-uc-023-review-pages`: 14 declarations, 0 findings;
     - `release-uc-023-reject`: 3, 0;
     - `release-uc-023-described-change`: 11, 0.
     Each header gives level `release`, one module per line, and no finding.
   - The harness: no declaration, and a header without a finding.
   - The control, `tests/release-itm-1254-issue-move.test.mjs`: 4 declarations, 0 findings.
   - The six samples, as the reader reads them:
     - **TST-739002** (system, MOD-review-pages).
       - Given: the accepted module MOD-sync, which provides push and pull, with the module MOD-desk that uses pull and
         MOD-report that uses push, code files, two tests, a backlog item and a plan step that name modules, and a token
         of the author for the product.
       - Input: the author opens MOD-sync, chooses Edit, removes the interface pull, presses Save; the reviewer opens
         MOD-sync again and presses Accept.
       - Expect: nothing is written before Save; Save makes one commit on the head the editor opened, with the edited
         MOD-sync alone and no record, and MOD-sync is then changed since acceptance; the page shows the removed line
         against the accepted text and the impact list — MOD-desk first, marked breaks, with its code file and test, then
         MOD-sync, MOD-report not at all, ITM-901 and the plan step ITM-902 as items —; Accept makes one commit holding
         the record of the text shown and no code file, made with the reviewer's token and naming the reviewer; the old
         record stays; MOD-sync is then accepted.
     - **TST-739005** (system, MOD-job-runner).
       - Given: the accepted product; the drafter first answers a new decision ARC-009 with the title of ARC-001 and the
         class new, then, once told, ARC-001 itself changed.
       - Input: the author opens ARC-001, describes the change in the bar, presses Send and then Review the draft.
       - Expect: the second request to the drafter carries the finding that ARC-009 states the title of the existing
         ARC-001, in the compiler's form; the draft the author sees holds ARC-001 alone, with the change, and no ARC-009;
         it shows two correction rounds and no finding left; Save commits ARC-001 alone.
     - **TST-739011** (system, MOD-review-pages).
       - Given: the participants drafter (model-a) and reviewer (model-b) offered by the bar, a reviewer that answers no
         finding; known positive first — the drafter is asked.
       - Input: the author describes a change in the bar, chooses drafter and presses Send.
       - Expect: known positive — the drafter received the instruction; the reviewing participant is asked as well,
         before the author sees the draft, as UC-023 2 says the author chooses a deriving and a reviewing participant.
         FINDING: the bar chooses one participant, prepares the change with no reviewer (src/prompt-bar/send.mjs,
         prepareIn: `reviewers: []`), and the reviewer is never asked.
     - **TST-739104** (release, MOD-approvals).
       - Given: ARC-002 changed so that it is forced by UC-003, whose text no approval record names; then the same with a
         record naming UC-003.
       - Input: the reviewer opens ARC-002 and, on the review page of the whole architecture, presses "Accept all 1
         shown".
       - Expect: the page names UC-003 as what ARC-002 rests on and offers no Accept that can be pressed; the click on the
         review page writes nothing and names UC-003 as the reason ARC-002 was left out; with a record naming UC-003
         (counter-proof) the page names nothing it rests on and Accept can be pressed.
     - **TST-739108** (release, MOD-approvals).
       - Given: MOD-sync changed since acceptance; the reviewer's token for the product, named "github.com/reviewer"; then
         the same with no token for the product.
       - Input: the reviewer presses Accept.
       - Expect: one commit adds the approval record and nothing else, its message naming the person ("Accepted by
         github.com/reviewer."), and every write request carries the reviewer's token; without a token no Accept is
         offered, nothing is written, and GitHub's page for the record is linked (counter-proof).
     - **TST-739209** (release, MOD-job-runner).
       - Given: a described change of two module files, MOD-sync and MOD-desk, with a reviewing participant; the
         architecture holds six files.
       - Input: the job is run; the reviewer's input is read.
       - Expect: the reviewer's input holds the whole text of every one of the six files of the architecture, the two
         changed ones and the four that the change leaves as they are. FINDING: it holds the files of the draft and the
         SPEC and the accepted use cases, not the other files (the kind review-architecture names no recipe
         whole-architecture), so a change is not checked together with the whole architecture.
7. **The pull request's readings hold.**
   - **"2a … classes it as a change under the existing identifier"** is read as the draft that reaches the author
     holding it under the existing identifier. The rule sends the new identifier back, naming the existing one
     (TST-739005), and the author then sees ARC-001 alone.
   - **"The use cases the change concerns"** is read as the job's `useCases` parameter, which `rests-on-accepted` checks.
   - **Step 4's items** are read as the impact list's "Items" line, the backlog items and the plan steps that name an
     affected module (TST-739002: ITM-901 and the plan step ITM-902).

## The findings, ruled

None of the five is registered as an item; each was searched for in `docs/backlog/`. None holds this gate: the
Acceptance asks that a disagreement be named as a finding, and each is.

- **S1 (TST-739010): a change returned under its existing identifier is refused as a duplicate of itself. It is
  akmaier's to settle, not a Developer's item.**
  - The code does what the accepted texts say. The recipe `whole-architecture` carries each file as an artifact "keyed by
    the key of its format" (ITM-724, MOD-approvals). The key of a module is its `id`, and that of a decision its `title`
    (MOD-documents.md:200, :223). `classifyCandidates` makes a candidate whose key equals an existing artifact's "a
    duplicate of it, whatever its participant proposed, decided by rule" (MOD-documents.md:300-303).
  - Read for the architecture (THE DERIVATION RULES HOLD FOR ARCHITECTURE, SPEC.md:1368-1375), EXACT DUPLICATES ARE
    FOUND WITHOUT A MODEL makes a candidate with an existing name a duplicate (SPEC.md:276-279). A CHANGE IS PROPOSED
    UNDER THE EXISTING NAME asks for the change under that very name (SPEC.md:286-289).
  - So a module's change by description, and a decision's that keeps its title, cannot end the loop without the error.
    For requirements, the code decides on the rule alone and so meets the second sentence.
  - The effect is real: UC-023 step 2 fails for a module. But no reading of the accepted text lets a Developer build it
    away. It goes to the close's feedback, for akmaier.
- **S2 (TST-739209, 739210): the reviewer of a change is not sent the whole architecture. akmaier's.**
  - The accepted table gives `review-architecture` the recipes `instruction?`, `whole-spec`, `accepted-use-cases`,
    `draft`, `chapters-for-architecture` (MOD-job-catalogue.md:92). That is no `whole-architecture`, and the kind file
    follows it.
  - This goes against THE ARCHITECTURE'S PARTICIPANTS RECEIVE THE WHOLE PROJECT (SPEC.md:1352-1356) and A CHANGE ACROSS
    MODULES IS CHECKED AS A WHOLE (SPEC.md:1382-1385).
  - It is a gap of the architecture against the SPEC, so for akmaier.
- **S3 (TST-739011): a change described in the bar is not checked by a reviewing participant. akmaier's.**
  - UC-023 step 2 has the author choose a deriving and a reviewing participant.
  - MOD-prompt-bar, the one route to *Describe the change*, offers one participant and names a reviewer only among the
    destinations "for a kind with reviewers" (MOD-prompt-bar.md:223). No sentence says where the reviewer is chosen.
  - MOD-review-pages chooses one only for `<k>/draft`, the first derivation (MOD-review-pages.md:257-261).
  - This goes against AN ARCHITECTURE DRAFT IS CHECKED BEFORE A PERSON SEES IT. It is a gap of the architecture, so for
    akmaier.
- **S4 (TST-739013): after Accept no list of the affected modules with their plan steps and backlog items is shown.
  akmaier's.**
  - UC-023 step 6 asks for it. No module file of the architecture states it: MOD-review-pages and
    MOD-implementation-pages name no list after an acceptance.
  - It is a scenario the architecture does not make possible (THE USE CASES ARE THE SCENARIOS OF THE ARCHITECTURE), so
    for akmaier.
- **S5 (TST-739012): for a file that rests on an open use case, no Accept is drawn. A new item, buildable.**
  - UC-023 4b: "*Accept* stays disabled and names it."
  - MOD-review-pages lists *Accept* on `<k>/<id>` (MOD-review-pages.md:200-201). ITM-729's Acceptance says "*Accept*
    stays as it is: disabled while the file names what is not accepted (4b, ITM-440)".
  - `offerAcceptance` (`src/review-pages/flow.mjs:610-618`) names what the file rests on and returns before any Accept.
  - A disabled *Accept* beside the names is built against the accepted text in MOD-review-pages. The close registers it
    as an item.

## Noted

- The pull request's description names no `JOB-` identifier. The run's id is the one the Scrum Master gave.
- The release tests of ITM-1314 (#1511) and ITM-1186 (#1512) are merged into the sprint branch. They are decided at
  the gate Release testing → Sprint review.
