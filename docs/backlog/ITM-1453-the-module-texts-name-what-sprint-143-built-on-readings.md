---
id: ITM-1453
title: The module texts name what sprint 143 built on readings
level: system
realises:
  - A MODULE STATES ITS RESPONSIBILITY AND ITS INTERFACES
  - AN INTERFACE TELLS ITS USER WHAT TO CONSIDER
  - A USE CASE REALISES NAMED REQUIREMENTS
modules:
  - MOD-spec-changes
  - MOD-work-plans
  - MOD-trace-pages
  - MOD-site-frame
builds_on: []
tests:
  - unit
origin:
  - the readings team1's sprint 143 took where an accepted text says less or other than what was built or needed, each named at its gate or ruling in 143.md; akmaier's direction that a module change is presented on the dashboard as a draft
---
# ITM-1453 The module texts name what sprint 143 built on readings

**REGISTER**

## Outcome

Some of this sprint's readings stand where an accepted text lacks a sentence or says something else. Each goes to akmaier
as a draft on the dashboard: an open change of its file, which stays open until he accepts it. No code changes. These are
the drafts:
- **MOD-spec-changes, `proposeSection`:** the text reads "Considers: called only on a person's click". The draft adds that
  a job may call it too, where its SPEC rule asks for an open entry (`AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY
  ITSELF`), and that it builds the trace graph of the head it reads where none is stored (ITM-1406, *Waiting for
  akmaier*).
- **MOD-work-plans, the close:** a retrospective's change to the process model, the Definition of Done or a participant's
  instructions is written as a new requirement through `proposeSection`. It is appended to the section that holds the
  requirement governing what it changes (143.md, *Ruled* for ITM-1406).
- **MOD-trace-pages, Data:** "never its rationale" holds for what the page asks for itself. The rationales that `queues`
  reads for each entry's issue are `queues`' reads (143.md, *Ruled* for ITM-1397).
- **MOD-site-frame, the `#spec` fallback:** it also reads the rationales that `queues` reads (the same ruling).
- **UC-046:** `realises` names `EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE`, which its release case TST-1062104 guards
  (ITM-1451's gate).

## Acceptance

- Each draft above stands in the file it changes, one commit per file, and shows on the dashboard as open.
- The drafts change no other file, no code and no test.
- The checks of the documents pass on each changed file.
