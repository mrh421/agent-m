---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - f757807cef206f44015e1b57bb54af0b3da4b43e
  - https://github.com/akmaier/agent-m/pull/1540
date: 2026-10-30 20:35 UTC
---
# Development → Release testing: ITM-803, the system and release tests of UC-032

**REGISTER**

## Reason

ITM-803, pull request #1540 into `sprint/team1/129`, passes on `f757807c`, its head and only commit when this was
decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1875-1880).

1. **CI.** Run 41122985427 (`pull_request`, attempt 1) on `f757807c` succeeds: 41 jobs succeed, 17 are skipped, and none
   failed.
2. **No failing first commit is due.** AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST (SPEC.md:1460-1463) binds a job
   "that adds or changes behaviour". This one adds tests of behaviour that ITM-681, 782, 783, 784 and 1316 built, and
   changes no code. The planted faults below stand in for the red run.
3. **Only new test files change,** by developer-sonnet-l (`Agent-M-Participant`). The files are `tests/uc-032-harness.mjs`,
   `tests/system-uc-032-maintain-the-backlog.test.mjs` (TST-803001 to 803027) and three release files (TST-803101 to
   803113). No file of `src/`, `docs/` or an existing test changes. The harness reuses the helpers of
   `tests/implementation-pages-sprints.mjs` and does not change that file.
4. **Its writer implemented none of the behaviour it tests** (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER,
   SPEC.md:1535-1539). developer-sonnet-l has written no file under `src/` (`team1/129.md`, with its known positive).
5. **The Acceptance holds.**
   - **Release tests:** the release cases cover the twelve requirements UC-032 realises that the four existing release
     files do not guard. The four files stay.
   - **Flows:** the system test walks steps 1 to 7 and the alternative flows 1a, 1b, 1c, 2a, 2b, 3a, 3b, 6a, 6b, 6c, 6d
     and 7a. Steps 5, 6, 6c and 6d run with two teams' sprints.
   - **Findings:** where the page and UC-032 disagree, the case follows UC-032, is `todo`, and names its finding (below).
6. **The test run.** In an export of the head, `node --test` on the four test files gives 40 tests: 31 pass, 9 todo and
   0 fail.
7. **Counter-proofs.**
   - The pull request records 28 planted faults, each failing the cases it names, and one fix (S2) that turns its `todo`
     case green.
   - Two I planted myself on the head in an export, each restored after:
     - `startSprint` ignores `conflicts` (`src/work-plans/saves.mjs:81`): TST-803016 fails, and the other 30 pass;
     - `uncoveredPanel` drawn before `backlogPanel` (`backlog.mjs`, `paint`): TST-803004 passes, so its `todo` can be
       met.
   - Restored: 31 pass, 9 todo, 0 fail.
8. **MOD-test-document's reader,** in an export of `f757807c`:
   - The system file has 27 declarations and the release files 4, 4 and 5, each with 0 findings.
   - Each header names MOD-implementation-pages and MOD-work-plans, one per line.
   - The harness has no declaration and a header at level `system`.
   - The control, `tests/release-itm-1254-issue-move.test.mjs`, has 4 declarations and 0 findings.
   - **The repeat reading** finds 1,490 test files, 5,845 declarations and 2 repeats. These are TST-1290001 and 1290002,
     which the branch keeps from before ITM-1324's merge. TST-803001 to 803027 and 803101 to 803113 stand once each.
9. **The readings of the pull request.**
   - **"No real input events": holds.** A person's click is the page's listener called with `isTrusted: true`. The
     route's handlers test `event?.isTrusted` (`backlog.mjs`, `paint`), so the case walks the path of the person's click.
     This is the reading of ITM-782's and ITM-1316's release tests.
   - **3a: holds.** Step 1 defines the top list as "accepted requirements and use cases that no item realises yet",
     which TST-803010 tests. No step of UC-032 names a page that shows a requirement as covered once all its items are
     done, so there is no place for a case to look.
   - **Release cases for all twelve requirements not yet guarded: holds.** The item asks for "a release test … for each
     requirement UC-032 realises without one".
   - **TST-803001 reads UC-032 when it runs** (fault 27). This does not break A TEST DOES NOT TAKE ITS EXPECTED RESULT
     FROM A DOCUMENT (SPEC.md:1513-1514). That rule binds "a test that checks code". TST-803001 checks the battery's map
     against UC-032: it states each passage in its own text and asserts that it stands in the use case, as TST-739001
     does for UC-023.

## Noted

**The findings, each ruled** (sprint 126's agreement).

- **S1, TST-803005, an item's origin on its row (UC-032 step 1): for akmaier.**
  - The route draws the view stored for the head and reads no item file ("each item … links to its own file, which is
    read only when the person opens it", MOD-implementation-pages).
  - The row of MOD-progress-measures' `BacklogView` has no origin (`{ item, path, title, realises, state, held, kept }`).
  - So showing where an item came from needs a change of an accepted interface type, which the module's text holds.
- **S2, TST-803004, what no item realises at the top of the page (step 1): a new item** (MOD-implementation-pages).
  - No module text fixes the order of the parts, and `paint` draws `uncoveredPanel` after `backlogPanel`.
  - My fault 28 shows the change within the route.
- **S3, TST-803012, the other teams' held items beside the backlog without a plan open (step 5): a new item**
  (MOD-implementation-pages).
  - MOD-implementation-pages gives the route "in a product with several teams, what the other teams' sprints hold, from
    `heldItems`" without a planning.
  - `paint` draws `heldPanel` only under `planning && teams.length > 1`.
- **S4, TST-803014, a changed selection shows what it removes or adds (6a): a new item** (MOD-implementation-pages).
  - `startSprint` gives `added` and `removed` (MOD-work-plans).
  - The click's notice names only the file and the commit.
- **S5, TST-803015, Start sprint after another team's sprint (6c): two rulings.**
  - **Naming the sprint, the held item and the module: for akmaier.** The accepted texts make *Start sprint* read the
    holds "at the view's commit" and `startSprint` write "on that commit" (MOD-implementation-pages; MOD-work-plans:
    "`held` is read at the head the commit is written on"). A sprint committed after the view is therefore refused as
    `Moved`, before any check. To name it, the page would have to read the default branch's head at the click, which the
    route's text excludes; the head's view may also not be stored yet. This cannot be settled without changing a module
    text.
  - **The branch made before the refusal: a new item** (MOD-work-plans).
    - `saves.mjs:131-132` calls `createBranch(branch, head)` before `commitFiles`, so a refused start leaves `sprint/<team>/<nn>`
      at the old head.
    - The text names no order ("created from the head where it does not exist yet"). A refused start then writes
      nothing, as 6c's "is refused" reads.
- **S6, TST-803024, a planned model's backlog page (1b): a new item** (MOD-implementation-pages).
  - The route warns with a link to `#progress` and draws the backlog.
  - No module text gives `backlog` that case. The route `plan` holds its mirror ("for a model that works from a backlog,
    a link to `backlog`, and nothing else is read").
- **S7 and S8, TST-803019 and 803020, a sprint ended today, or with every item done, drawn as running (6b): one new item**
  (MOD-progress-measures).
  - `teamSprint` (`measures.mjs:116`) takes a sprint as final only with `## Review` or `end < today`.
  - The text gives `final` to "a running sprint whose time box is over or that was ended". It is read, as UC-032 6b reads
    "ends", by the one rule MOD-work-plans' `sprintsToClose` already gives:
    - its end on or before today;
    - `## Ended`;
    - without a time box, every selected item done.
  - Nothing twice: the two modules then decide "ended" alike.
- **S9, TST-803113, the closer checked against the register: for akmaier, as an open question, not a finding.**
  - UC-032 6 reads "who closes the sprint — themselves by default, or a participant such as an agent". SPEC.md:1949-1950
    reads "The Product Owner may assign closing a sprint … to a participant of the product".
  - Neither says that any other closer is refused, and `startSprint`'s errors name no such refusal. Reading a refusal in
    adds "only" (AGENTS.md §6a.7).
  - The field defaults to the team's owner (`backlog.mjs:254`), so "themselves by default" holds. The case stays `todo`
    until akmaier answers.
- **`tests/test_gate_record.py`, the check SPEC.md:870 names for THE GATE IS RECORDED, does not exist: already
  registered.** ITM-805, UC-034's battery, names it among its release tests, and it is not done.
- **The pull request's observation:** a step under `docs/plan/` makes the backlog page list the steps. That is stated on
  purpose (`src/progress-measures/facts.mjs:14-15`). Noted, no item.
- The new items, S2, S3, S4, S5's branch, S6 and S7/S8, are registered by the Product Owner with the close, as sprint
  128's were. The questions for akmaier, S1, S5's naming and S9, go with the close's handover.
