---
id: UC-043
title: Run the process over a selection
area: 5 implementation
actors:
  - Author
  - Run's participant
  - Participants of the product's roles
  - CI
  - Product repository
realises:
  - A RUN EXECUTES THE PROCESS MODEL OVER A SELECTION
  - A RUN CONTINUES WITHOUT A CLICK BETWEEN ITS JOBS
  - A RUN FOLLOWS THE MODULES' INTERFACES
  - A RUN SETS UP CI BEFORE IT IMPLEMENTS
  - A RUN HAS LIMITS FIXED AT ITS START
  - A RUN IS A JOB THAT NAMES ITS JOBS
  - A RUN ENDS WITH THE VALIDATION OF ITS MODULES
  - THE MODEL DETERMINES THE PHASES AND THE GATES
  - A PLANNED MODEL IMPLEMENTS ITS IMPLEMENTATION PLAN
  - AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES
  - A PLAN STEP NAMES THE TESTS OF ITS LEVEL
  - AGILE IMPLEMENTATION STARTS FROM THE BACKLOG
  - A JOB GOES ONLY TO A HOLDER OF ITS ROLE
  - A JOB STOPS AT EVERY GATE
  - A GATE NAMES WHO DECIDES IT
  - NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED
  - ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS
  - NO JOB STARTS ABOVE THE WORK-IN-PROGRESS LIMIT
  - RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER
  - A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS
  - THE CORRECTION LOOP HAS A FIXED LIMIT
  - NO COST IS GUESSED
  - A JOB IS RECORDED IN ITS PRODUCT REPOSITORY
  - ONE CLICK PER DECISION
  - EVERY TEAM RUNS SPRINTS OF ITS OWN
---
# UC-043 Run the process over a selection

**Goal.** The author selects what to build — steps of the implementation plan in a model that plans its
work (UC-045), backlog items in Scrum or Kanban (UC-032) — and starts one **run**, which an agent carries out in a
session of its own the way the product's process model (UC-002, UC-031) prescribes: the CI configuration if it is
missing, the steps in the plan's order or the items after those they build on, the test battery, and at the end the
validation of what was built. The author is asked only where the model puts a gate that a person decides, or when a
limit fixed at the start is reached. For a critical step, the single parts remain: UC-024, UC-026 and UC-027 can
each be started on their own.

| Part of the run | What it does | On its own |
|---|---|---|
| CI | generates the CI configuration from the test schedule, if the product has none | UC-027 |
| Implementation | one job per step of the implementation plan, in its order — the modules, then each subsystem's integration, then the system; independent steps side by side | UC-024 |
| Tests | the test battery for the selected modules at every level of the schedule; release tests by a participant other than the implementer | UC-026 |
| Validation | what each module realises, its code and tests, and every gap | UC-025 |

The model decides the details: in a V-model, the Testing phase runs after Implementation and its gate may
belong to a person; in Scrum or Kanban, the selection is the ready backlog items of the sprint or under the
work-in-progress limit (UC-034), and each item's job includes its tests.

## Actors

- **Author** — selects, sets the limits, starts the run, decides where a gate names a person.
- **Run's participant** — the agent the author hands the run to, in a session of its own; it records the run and
  starts its jobs.
- **Participants of the product's roles** — the agents and people assigned in UC-048; each job goes to a
  holder of its role.
- **CI** — the product's continuous integration, which runs the tests of every push.
- **Product repository** — holds architecture, code, tests, job records.

## Precondition

- The product declares a process model (UC-002), and its roles are filled (UC-048).
- The architecture is accepted (UC-022, UC-023).
- The product has an implementation plan (UC-045), or, in Scrum or Kanban, a planned and filled backlog (UC-032).

## Main flow

1. The author selects the steps of the implementation plan the run builds — those not done, as their derived states
   give them (UC-045), all of them or down to one step.
2. The author sets the **limits**: jobs at once (the model's work-in-progress limit, or 3), the cost limit (counted only
   from costs the runtimes report), and the correction rounds per draft (5).
3. The author hands the run to its participant, which plans it from the model: the parts of the run in their order,
   the jobs they consist of, the participant of each role that will do them, and every gate on the way and who decides
   it.
4. The run's participant writes the run's job record, naming the selection, the limits and the author who started it,
   and starts the first jobs.
5. The run proceeds without a click:
   1. **CI** — if the product has no CI configuration, the job of UC-027 generates it from the schedule
      (the book's default where none is declared) and its pull request is merged once green;
   2. **Implementation** — one job per step (UC-024), each starting as soon as the steps it waits for are
      done, and a phase's steps once the gate before it is recorded; up to the limit of jobs at once;
   3. **Tests** — the job of UC-026 for the selection, at every level the schedule names; release tests
      go to a participant other than the one who implemented;
   4. **Validation** — UC-025 for the selection.

   Every job merges its pull request once the Definition of Done holds, writes its own record naming the
   run, and goes through the correction loop where it drafts; the run's record names every job it started.
6. The job dashboard (UC-036) and the process dashboard (UC-035) show the run's jobs, their states and what waits. No
   click is needed between jobs.
7. The run ends. Its participant completes the run's record. The validation of the selection — what each module
   realises, its code, its tests, every gap — is the view of UC-025 for the modules of the selection.

```mermaid
sequenceDiagram
    actor A as Author
    participant R as Run's participant
    participant P as Participants
    participant C as CI
    participant G as Product repository
    A->>R: run, selection, limits
    R->>G: run record (job naming its jobs)
    opt no CI configuration
        R->>P: CI job (UC-027)
        P->>G: pull request, merged on green
    end
    loop steps in the plan's order, up to the limit at once
        R->>P: implementation job (UC-024)
        P->>G: failing tests, code, pull request
        G->>C: run
        C-->>G: green, Definition of Done holds, merged
    end
    R->>P: test battery (UC-026), release tests by another participant
    P->>G: pull request with tests and counter-proofs
    R->>G: run record completed
    A->>G: validation of the selection (UC-025)
```

## Alternative flows

- **1a. The product works from a backlog (Scrum, Kanban).** The selection is backlog items, not modules:
  in Scrum, the ready items of the current sprint of the author's team, each team starting runs of its own; in Kanban,
  as many as the work-in-progress limit allows. Each item's job
  is that of UC-034, including its tests; the rest of this use case applies unchanged.
- **1b. A selected step's module file or decision is not accepted.** It is not built: the run's participant names what
  is open (UC-022, UC-023).
- **1c. The author wants only one part for one step** — for example a critical module implemented and
  reviewed by hand. They start UC-024, UC-026 or UC-027 on its own; no run is created.
- **1d. The product has no implementation plan, or no ready backlog item.** Nothing starts; the plan is made in UC-045,
  the backlog in UC-032.
- **3a. The interfaces form a cycle.** The run starts nothing; its participant names the modules of the cycle, and the
  architecture is changed in UC-023.
- **3b. No participant holds a role the plan needs.** The run's participant names the role and the missing capability
  (UC-017, UC-002); nothing starts.
- **5a. A job reaches a gate its model gives to a person** — a security review, a documented verification
  required by IEC 62304. The run waits there; the jobs that do not depend on it go on. The gate appears on
  the job dashboard with what it checks; the person decides with one click (UC-036), and the run continues.
- **5b. A job fails** — CI stays red after the fix cycle, a participant does not answer. The job ends as
  *failed*; the jobs that depend on it do not start; the others go on. The run's record names the failed job and
  everything it blocked; the job may be retried (UC-036).
- **5c. A limit is reached** — cost, or rounds. The run starts no further job, lets the running ones
  finish, and its record says which limit stopped it. The author may raise the limit; the run then goes on with the
  remaining jobs under the same record.
- **5d. The author stops the run.** Its participant starts no further job, and every running job is cancelled
  (`A CANCELLED JOB WRITES NOTHING MORE`, UC-036); what was merged stays.

## Postcondition

- Every selected step or item has code and tests merged through pull requests whose Definition of Done
  held, or is listed with the job that failed or the gate that waits.
- The run's record names the selection, the limits, every job it started and the end state; each job's
  record names the run.
- The author acted to start the run, and wherever the model gave a gate to a person — nowhere else.
