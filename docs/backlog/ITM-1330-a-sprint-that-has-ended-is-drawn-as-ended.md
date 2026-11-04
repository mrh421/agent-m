---
id: ITM-1330
title: A sprint that has ended is drawn as ended
level: module
realises:
  - UC-032
  - UC-035
  - A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT
modules:
  - MOD-progress-measures
builds_on:
tests:
  - unit
origin:
  - findings UC032-S7 and UC032-S8 of ITM-803's battery, ruled at its gate (docs/gates/20261030-2035-development-release-testing-d803.md, Noted), and team1's sprint 129 Review (docs/backlog/sprints/team1/129.md)
---
# ITM-1330 A sprint that has ended is drawn as ended

**REGISTER**

## Outcome

UC-032 6b says that a sprint ends "at the end of its time box or, in a sprint without one, when every selected item is
done or the Product Owner presses **End sprint**". `teamSprint` (`src/progress-measures/measures.mjs:116`) takes a
sprint as final only with `## Review` or `end < today`:
- a sprint ended today by *End sprint* is drawn as running (TST-803019);
- a sprint without a time box whose every selected item is done is drawn as running (TST-803020).

MOD-work-plans' `sprintsToClose` decides the same question already: "its `end` date is before or on `today`; or, without a
time box, every item of its selection is `done`, or its record holds `## Ended`".

With this item, `final` and a team's last ended sprint follow that one rule.

## Readiness

It is ready.
- **Uses, read at the level of the module.** The team's agreement reads Uses "at the level of the module, as TST-106805
  reads it" (`team1/124.md`, Retrospective). MOD-progress-measures' Uses name MOD-work-plans, and `sprintsToClose` is in
  MOD-work-plans' `provides`. So `measures.mjs` may import it, and no text is needed.
  - MOD-trace-graph's import check, run on the stand-in below, gives no finding for `measures.mjs`. Known positive: an
    import of MOD-bridge-client planted in the same file gives one.
- **Interface types.** `sprintsToClose(sprints: Document[], states: ItemState[], today: string)` (MOD-work-plans.md:210-214).
  `teamSprint` holds the record, the states and `today` as `yyyy-mm-dd` already. A record with `## Review` is never named
  by it, so `## Review` stays a reason for `final` of its own.
- **Nothing twice.** `teamSprint` asks `sprintsToClose` and writes no rule of its own for "ended".
- **No cycle, no top-level await.** No file of `src/work-plans/` imports MOD-progress-measures, and its `index.mjs` awaits
  nothing at the top level.
- **The planning stand-in** (sprint 130's planning, on `main` at `13e66ee14`): `final` becomes `## Review` or
  `sprintsToClose([record], states, today)` naming the sprint, with one import. It changes no value of an interface.
  - TST-803019 and TST-803020 pass with it, and fail on the base.
  - A time-boxed sprint is now final on its last day (`end` on `today`), as `sprintsToClose` reads it.
  - Its planning run is in `team1/130.md`.

## Acceptance

- Unit cases of `progressView` and `backlogView`:
  - a sprint whose `## Ended` is today is final;
  - a sprint without a time box whose every item is done is final;
  - known positive: a sprint whose time box ends tomorrow is not.
- **A test of another module moves:** TST-783002 of MOD-implementation-pages
  (`tests/implementation-pages-backlog-end-sprint.test.mjs:111-123`). Its second page, a sprint without a time box whose
  `## Ended` is today, asserts as its known positive that the sprint "still runs" (`Change the selection`). With the
  stand-in it is drawn as ended. Its `given` and that known positive change to the ended sprint, in the tests-only commit;
  its assertion that no End sprint is offered stays.
- TST-803019's and TST-803020's `todo` are taken away on the item's branch, in a commit of its own, by a participant who
  implemented none of the item.
- The first commit holds only the tests, and CI is red on it for the item's reason.
