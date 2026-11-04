---
id: ARC-042
title: Process
refines: ARC-037
forced_by:
  - THE PROCESS MODEL IS DECLARED PER PRODUCT
  - THE CATALOGUE IS DATA
  - THE MODEL DETERMINES THE PHASES AND THE GATES
  - AGENT M CARRIES THE BOOK'S CATALOGUE
  - A PROCESS REQUIREMENT ADDS TO THE MODEL
  - A PROCESS MODEL ORGANISES PEOPLE AND AGENTS
  - A PRACTICE IS NOT A MODEL
  - A GATE NAMES WHAT IT CHECKS
  - A ROLE NAMES THE CAPABILITIES IT NEEDS
  - A ROLE NAMES HOW MANY FILL IT
  - THE PROCESS NAMES ROLES, NOT PARTICIPANTS
  - A ROLE ASSIGNMENT FILLS THE ROLES
  - A PRODUCT HAS ONE ROLE ASSIGNMENT, OR ONE PER TEAM
  - A PARTICIPANT MAY SERVE SEVERAL TEAMS
  - A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED
  - A PLAN COVERS THE WHOLE SPECIFICATION
  - A PLANNED MODEL IMPLEMENTS ITS IMPLEMENTATION PLAN
  - AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES
  - A PLAN STEP NAMES THE TESTS OF ITS LEVEL
  - THE IMPLEMENTATION PLAN LIVES IN THE PRODUCT REPOSITORY
  - AGILE IMPLEMENTATION STARTS FROM THE BACKLOG
  - THE BACKLOG LIVES IN THE PRODUCT REPOSITORY
  - NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED
  - NO JOB STARTS ABOVE THE WORK-IN-PROGRESS LIMIT
  - A TIME BOX WORKS ONLY ON WHAT WAS SELECTED FOR IT
  - EVERY TEAM RUNS SPRINTS OF ITS OWN
  - A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH
  - SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES
  - SPRINT PLANNING SHOWS WHAT THE OTHER TEAMS' SPRINTS HOLD
  - A JOB GOES ONLY TO A HOLDER OF ITS ROLE
  - A JOB STOPS AT EVERY GATE
  - A GATE NAMES WHO DECIDES IT
  - A GATE IS DECIDED WITHIN THE JOB'S ROLE ASSIGNMENT
  - A GATE IS NOT DECIDED BY THE PARTICIPANT WHOSE WORK IT CHECKS
  - THE GATE IS RECORDED
  - PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE
  - PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
  - A PRODUCT DECLARES ITS DEFINITION OF DONE
  - THE DEFAULT DEFINITION OF DONE IS THE JOB RULES
  - A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS
  - AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST
  - A REFACTORING JOB BEGINS WITHOUT A FAILING TEST
  - A REFACTORING JOB CHANGES NO EXPECTED RESULT
  - AN IMPLEMENTATION JOB CHANGES ONLY ITS MODULES
  - A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT
  - A SPRINT ENDS WITH A RETROSPECTIVE
  - A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN
  - WORK MERGES INTO THE DEFAULT BRANCH UNLESS A BRANCH IS SET
  - A RUN EXECUTES THE PROCESS MODEL OVER A SELECTION
  - A RUN CONTINUES WITHOUT A CLICK BETWEEN ITS JOBS
  - A RUN FOLLOWS THE MODULES' INTERFACES
  - A RUN SETS UP CI BEFORE IT IMPLEMENTS
  - A RUN HAS LIMITS FIXED AT ITS START
  - A RUN IS A JOB THAT NAMES ITS JOBS
  - A RUN ENDS WITH THE VALIDATION OF ITS MODULES
  - CLOSING A SPRINT CAN BE ASSIGNED TO A PARTICIPANT
  - A SPRINT CLOSED BY AN AGENT STARTS BY ITSELF
  - AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM
  - AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY ITSELF
  - THE MAIN PAGE SHOWS EACH PRODUCT'S PROGRESS BY STAGE
  - WITHOUT A PRODUCT, THE MAIN PAGE SHOWS AGENT M'S OWN PROGRESS
  - THE BUILD IS SHOWN AS IT HAPPENS
  - A PERSON IS TOLD WHAT WAITS FOR THEIR ACCEPTANCE
  - UC-002
  - UC-024
  - UC-031
  - UC-032
  - UC-033
  - UC-034
  - UC-035
  - UC-041
  - UC-043
  - UC-045
  - UC-046
  - UC-047
  - UC-048
designs:
  - MOD-model-catalogue
  - MOD-product-process
  - MOD-work-plans
  - MOD-run-planner
  - MOD-progress-measures
---
# ARC-042 Process

## Context

How a product is developed is declared, not assumed: one process model from a catalogue that is data, its roles filled by
participants in role assignments — one per product, or one per team in a model with sprints (UC-048) —, its gates with what they check and who decides them, a Definition of Done, practices, branches, and the
gates and artifacts its process requirements add (UC-002, UC-031). The work is organised in an implementation plan or a
backlog that builds the system bottom-up along the modules' interfaces (UC-045, UC-032); several teams plan sprints of
their own from one backlog, each against what the other teams' sprints hold (UC-032). Jobs start only for what is
accepted, selected and below the limits, stop at every gate, and a run carries a whole selection through the model
without a click between its jobs (UC-024, UC-034, UC-043). Progress is shown in the model's own measure (UC-035) and
on the main page as stages (UC-046), and what waits for a person's acceptance is told by the Site's notifications
(UC-047) — all derived from records.

## Decision

Process is the highest of the services of ARC-037: **declarations and plans as Markdown in the product repository,
everything about their state derived, and the next actions of a run as a pure function of the records**.
Its declarations, records and plans are documents of the common shape, defined by schemas in its modules' folders and
read by MOD-documents (ARC-048). Its jobs — drafting a plan, proposing backlog items, closing a sprint, implementing a
step or an item — are kinds in the job catalogue (ARC-046); it offers them their recipes,
checks and writers as strategies. Process uses Tests and releases, Specification and design, Sources and resources,
Participants and jobs, Access and the artifact model.

### Responsibility within the system

Validating process models, the product's declaration and its role assignments; deriving the product's workflow, its
gates' states and whether a participant may decide a gate within the job's role assignment; checking a pull request
against the Definition of Done; keeping implementation plans, backlogs and the sprints of each team, and deriving each
item's state, whether it can start and what the teams' sprints hold; turning a selection into a run and
computing its next actions, the implementation job's inputs included; computing progress in the model's measure, the
stages of the main page, and what waits for a person's acceptance.

### The interface it offers

| Module | Functions other subsystems use |
|---|---|
| MOD-model-catalogue | `catalogue`, `modelSchema`, `modelFindings`, `planGrid`, `modelDiagram` |
| MOD-product-process | `declarationSchema`, `declarationFindings`, `roleAssignmentSchema`, `roleAssignmentFindings`, `workflowOf`, `holdsRole`, `gateSchema`, `gateStates`, `mayDecide`, `recordGateDecision`, `doneCheck` |
| MOD-work-plans | `planSchemas`, `itemStates`, `startable`, `planFindings`, `backlogFindings`, `sprintFacts`, `heldItems`, `conflicts`, `savePlan`, `saveItems`, `startSprint`, `endSprint`, `closeSprint`, `workStrategies` |
| MOD-run-planner | `runOf`, `nextActions`, `runStrategies` |
| MOD-progress-measures | `productFacts`, `progressIn`, `stageShares`, `currentStage`, `gateOverview`, `blocked`, `whoWorksOnWhat`, `buildInProgress`, `waitingForAPerson`, `waitingForAcceptance` |

### Its modules

| Module | Folder | Responsibility |
|---|---|---|
| MOD-model-catalogue | `src/model-catalogue/` | the shipped catalogue — waterfall, V-model, reuse-oriented, Scrum, Kanban, and the practices — as data files in its folder, and the instance's models under `docs/process-models/`; the schema of a definition and the validation a schema cannot express; the plan of every accepted requirement in every phase; the model's diagram |
| MOD-product-process | `src/product-process/` | the schema of the product's `docs/process.md`: model and version, practices, branches, Definition of Done; the schema of its role assignments under `docs/role-assignments/`; the workflow with the gates process requirements add; the schema of gate records under `docs/gates/` and their states; who may decide a gate; the Definition-of-Done check of a pull request, which the product's CI runs |
| MOD-work-plans | `src/work-plans/` | the schemas of the order of a plan's steps under `docs/plan/` and of each team's sprints under `docs/backlog/sprints/<team>/` with their review and retrospective; each item's derived state and what keeps it from starting — acceptance, what it builds on, its team's sprint selection, the work-in-progress limit, the gate before its phase —; what the teams' sprints hold, and what keeps an item from a team's selection; checks of a plan or backlog against the architecture; the recipes, checks and writers of drafting a plan, proposing items and closing a sprint |
| MOD-run-planner | `src/run-planner/` | a run as the job that names its jobs, with its selection and limits; its next actions from the records — CI set up first, then the steps in the order of the modules' interfaces and of the model's phases and gates, none above the jobs at once its start allows, none after a failed job it depends on —; the recipe of an implementation job's inputs: the module's file, its subsystem's and the system's decisions, the SPEC, the interfaces of the modules it uses, its code and tests |
| MOD-progress-measures | `src/progress-measures/` | the facts of a product gathered once; progress in the model's measure — plan entries per phase, remaining items per time box, items per state over time —; gates passed, pending, not reached; what is blocked; who works on what; the six stages of the main page, the build in progress, what waits for a person; what waits for a person's acceptance in a repository, from its snapshot and tags alone |

```mermaid
flowchart BT
  M0[MOD-model-catalogue]
  M1[MOD-product-process]
  M2[MOD-work-plans]
  M3[MOD-run-planner]
  M4[MOD-progress-measures]
  M1 --> M0
  M4 --> M0
  M4 --> M1
  M4 --> M2
  M3 --> M1
  M3 --> M4
  M3 --> M2
  M2 --> M0
  M2 --> M1
```

### The formats it owns

The schema of a process model definition (MOD-model-catalogue); the schemas of the product's declaration, of a role
assignment and of the gate record (MOD-product-process); the schemas of the plan's order file and of the sprint record
with its review and retrospective (MOD-work-plans); the run's part of its job record (MOD-run-planner). The schema of plan steps and backlog
items is the artifact model's (MOD-documents).

## Alternatives

- **Process models as code paths.** Rejected: `THE CATALOGUE IS DATA`; a model is a data file the instance can adapt.
- **A scheduler that keeps the state of runs.** Rejected: there is no server to keep it, and records already hold
  everything.
- **Item states written into the item files.** Rejected: `PROGRESS AND JOB STATE ARE DERIVED, NOT STORED`.
- **The Definition-of-Done check in the browser.** Rejected: it must hold whoever merges, so it runs in the product's CI
  (`A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS`).

## Consequences

- A product's process can be changed later; earlier work keeps the model it was done under.
