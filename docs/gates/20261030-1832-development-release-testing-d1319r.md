---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: rejected
on:
  - 9e9c87e92040a51a56fad7865d47221a9f277a3d
  - https://github.com/akmaier/agent-m/pull/1531
date: 2026-10-30 18:32 UTC
---
# Development → Release testing: ITM-1319, rejected while a page of use cases in a pulled product reads its commit three times and its whole tree twice

**REGISTER**

## Reason

ITM-1319, pull request #1531 into `sprint/team1/128`, does not pass on `9e9c87e9`, its head when this was decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). CI is
green on the head: run 41106003947 (`pull_request`, attempt 1), 41 jobs succeed, 17 are skipped, none failed. That run
includes the two uc-003 bridge files that hang on the planning machine.

What stops the gate is the reads of one page load, which the brief asks to count at this gate against the base, in a
pulled fixture (`team1/128.md`).

1. **The count.**
   - **The method:** the counting fake GitHub of `tests/load-per-view.test.mjs`, on its fixture with two use cases, run
     in an export of the head and in one of `2af740feb`. The probe added only `docs/process.md`, declaring `scrum-wip` at
     the fixture's commit, and the model's file.
   - **Without a declaration,** the head sends what the base sends:
     - `#use-case`: commit, folders, one batch of 2 and the repository's information.
     - `#use-case/id=UC-002` and `#use-case/id=all`: 9 requests each.
   - **With the pulled declaration,** the base sends the same, and the head sends:
     - `#use-case`: 11 requests. The commit is read 3 times and the tree twice. `docs/process.md` and `SPEC.md` are read
       one file each, beside one batch of 2 and one of 1.
     - `#use-case/id=UC-002` and `#use-case/id=all`: 16 requests each. Of them, 3 commits and 2 trees, and `docs/process.md`
       and `SPEC.md` one file each.
     - Its known positive: the same probe without the declaration gives the base's counts.
2. **Why this stops the gate.** A PAGE LOAD READS THE REPOSITORY IN BATCHES (SPEC.md:684-687) says that "one load of a
   dashboard page reads its commit and that commit's tree once, and the texts of the files it shows in requests of at
   most 100 files each".
   - The path is `src/review-pages/affected-modules.mjs`, `affectedCheck`.
     - Through `wholeHost`, `host.readSnapshot(snapshot.commit)` reads the page's commit again, with its whole tree. On the
       instance's own pages this is the instance; on a product's page, the product.
     - `productWorkflow`'s `instanceAt` reads the commit a third time at `model_version`, here the same commit, with its
       tree.
   - `snapshot.read` then reads `docs/process.md` and the instance's `SPEC.md` one file at a time.
   - The planning named these reads (`team1/128.md`), and named this gate to count them. Counted, they read the commit and
     its tree more than once in one load.
   - The coordinator's own counts, host calls before the click going from 4 to 20 in a pulled product and to 9 in a planned
     one, point the same way. A planned product's page now reads the catalogue's commit to learn its model, and runs
     nothing.
3. **What moves the gate.**
   - One load of a page of use cases reads the page's commit once and its tree once. The whole snapshot the job's
     preparation needs is read from that one commit, and the page's own folder snapshot does not read the commit again. On
     the instance's own pages, the instance at the same commit is not read a second time.
   - The declaration's model is read from the instance at `model_version` only where that is another commit.
   - `docs/process.md`, which is among the page's folders now, and `SPEC.md` are read in the page's batches, not one file
     each.
   - A case of `tests/load-per-view.test.mjs`, or of the item's own file, counts the requests of `#use-case` in a product
     that declares a pulled model, as the case above does. Known positive: the same page without the declaration sends
     what the base sends.
   - The gate is then read again on the new head. The rest below stands unless the change moves it.

## Read, and holding

- **The commits.** `e8f31f40` and `92ce32a0` hold tests only, and `9e9c87e9` holds the code. All three are developer-opus-e's.
- **The kind is stated.** `check-affected-modules` is written as MOD-job-catalogue.md:96 states it, with a schema of its
  own, and its row stands in `kinds.md` after `propose-items`.
- **The step is stated.** `leave-out-named-modules` in `workStrategies` leaves out a drafted item for a module that an
  item not yet done names, with a finding (MOD-work-plans.md:276-277).
- **The pull request's readings hold:**
  - "chosen as on `<k>/draft`" is the first of `loadStage`'s drafters whose route is this tab, since the job runs in this
    tab;
  - the parameters are `{ useCase }`, the recipe's;
  - a drafted item is left out when any module it names is named by an item not done;
  - the strategies come from `workStrategies`, which the frame registers.
- **Within the module:** `startRecord` is exported within MOD-review-pages, and `loadStage` takes an optional snapshot.
  `index.mjs`'s exports do not change.
- **Shared file.** `tests/job-catalogue.test.mjs` is shared with #1528 (ITM-1318). Whichever is merged second takes the
  other's change by a merge commit.

## Noted

- The reading of `wholeHost` from `dashboard-app.mjs:650`, that a job reads the product whole, is not wrong. It is the
  second read of the same commit within the page's load that the count finds.
