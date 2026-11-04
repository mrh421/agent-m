---
id: UC-005
title: Derive requirements from a source
area: 2 requirements
actors:
  - Author
  - Deriving participant
  - GitHub
realises:
  - A REQUIREMENT HAS A REGISTERED SOURCE
  - A REQUIREMENT HAS FOUR FIELDS
  - ONE STATEMENT PER REQUIREMENT
  - A REQUIREMENT NAMES ITS CHECK
  - A GENERATED ARTIFACT IS A PROPOSAL
  - THE PAGE NAMES WHERE IT SENDS
  - AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT
  - EVERY ARTIFACT NAMES ITS ORIGIN
  - A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN
  - ONE CLICK PER DECISION
  - A REQUIREMENT NAMES WHAT IT CONSTRAINS
  - DERIVATION SEES THE EXISTING REQUIREMENTS
  - NO REQUIREMENT IS LEFT OUT OF THE CONTEXT SILENTLY
  - A CANDIDATE IS NEW, A CHANGE, A DUPLICATE OR A CONFLICT
  - EXACT DUPLICATES ARE FOUND WITHOUT A MODEL
  - THE MODEL'S CLASSIFICATION IS MEASURED, NOT TRUSTED
  - A CHANGE IS PROPOSED UNDER THE EXISTING NAME
  - A DUPLICATE ADDS A SOURCE, NOT A REQUIREMENT
  - A CONFLICT IS DECIDED BY A PERSON
  - CANDIDATES ARE DEDUPLICATED AMONG THEMSELVES
  - A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST
  - NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT
  - A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT
  - A FINDING READS LIKE A COMPILER MESSAGE
  - AN ERROR MUST BE FIXED, A WARNING FIXED OR JUSTIFIED
  - WHAT A PERSON DECIDES IS NOT SENT BACK
  - THE CORRECTION LOOP HAS A FIXED LIMIT
  - THE ROUNDS ARE COUNTED AND SHOWN
  - A REQUIREMENTS JOB RECEIVES THE CHAPTER ON REQUIREMENTS ENGINEERING
---
# UC-005 Derive requirements from a source

**Goal.** Agent M turns the content of a registered source into candidate requirements in the
four-field form, for the author to approve or reject one by one.

## Actors

- **Author** — decides which candidates become requirements.
- **Deriving participant** — a model endpoint or agent from the instance's list (UC-017) that can
  *draft text*; it drafts the candidates.
- **GitHub** — receives the proposal.

## Precondition

- The source is in the library (UC-004) and linked to the product (UC-015).
- At least one participant that can *draft text* is configured (UC-017); it runs in the browser, in
  GitHub Actions (UC-010) or behind the local bridge (UC-011).

## Main flow

1. The author selects one of the product's linked sources and, optionally, the part to work on. Agent M
   reads exactly the linked version, and checks its hash.
2. Agent M collects **every existing requirement of the product** — its SPEC and its open change
   queues — and checks that source excerpt, requirements and chapter 8 of the book *Vibe Coding* together
   fit into the chosen participant's context.
3. The run panel shows the destination, what exactly is sent (the excerpt *and* the existing
   requirements, with the chapter), and how many requirements are included; the author presses **Run** —
   that click is the decision.
4. Agent M sends them with the requirement prompt from the repository's single definition. The prompt
   asks for candidates *against* the existing requirements, not beside them.
5. The participant returns candidates, each with name, source passage, rule, check,
   whether it constrains the **product** or the **process** — and a class:
   - **new** — nothing existing covers it;
   - **change** — it alters a named existing requirement;
   - **duplicate** — it restates a named existing requirement;
   - **conflict** — it contradicts a named existing requirement.
6. **The deduplication pass**, before anything is written:
   1. candidates of this run that state the same rule are merged into one, naming every passage;
   2. a candidate whose name or normalised rule equals an existing requirement's is classified as a
      duplicate without a model, whatever the model said;
   3. Agent M sends back to the participant, as compiler-like findings, every candidate without one of
      the four fields or without a check (errors), and every rule containing a conjunction (warning: split
      or give a reason); the participant corrects, up to the limit of rounds the run panel states. What is
      left after the last round is shown flagged in step 7; conflicts are never sent back.
7. The review panel shows the candidates grouped by class, each beside the existing requirement it
   refers to. The author can move a candidate to another class — for example, from *new* to
   *duplicate of X* — and choose how each conflict is resolved.
8. The author presses **Write proposals** — one click. Agent M writes the entries, each in its section's queue under
   `docs/spec-freigaben/`, where they are open until accepted:
   - **new:** an entry adding the requirement to its section;
   - **change:** an entry for the section holding the existing requirement, changing it **under its
     name**, with the current text beside it and its impact list;
   - **duplicate:** an entry that adds the new source to the existing requirement;
   - **conflict:** written only as the author resolved it in step 7; undecided conflicts stay in the
     panel and are not written.

   Every entry records Agent M version, participant, model and date.
9. The author reviews and accepts entries as in UC-006.

```mermaid
sequenceDiagram
    actor A as Author
    participant M as Agent M
    participant E as Deriving participant
    participant G as Product repository
    A->>M: linked source and part
    M->>G: read SPEC and open queues
    M-->>A: destination, excerpt, number of existing requirements
    A->>M: Run
    M->>E: excerpt, existing requirements, prompt
    E-->>M: candidates with class new, change, duplicate, conflict
    M->>M: merge within run, exact duplicates without model, flags
    M-->>A: candidates beside the requirements they refer to
    A->>M: adjust classes, resolve conflicts, Write proposals
    M->>G: commit queue: new, changes under existing names, added sources
```

## Alternative flows

- **2a. The existing requirements and the excerpt do not fit into the participant's context.** Nothing
  is sent. Agent M says how many requirements there are and how much fits, and offers a participant
  with a larger context or a smaller part of the source; it never drops requirements silently.
- **3a. The author does not press Run.** Nothing is sent.
- **5a. A candidate points to a rule from a source the product does not link.** It is not proposed;
  Agent M lists it as a hint to link the source first (UC-015).
- **1a. The file's hash differs from the one recorded for the linked version.** Nothing is sent;
  Agent M says that the content changed and that a new version must be registered (UC-016).
- **6a. The author splits a flagged candidate.** Each part becomes an entry of its own.
- **5b. A candidate constrains the process.** It is marked as such; once accepted, it adds its gates
  and artifacts to the product's workflow (UC-002, step 7).
- **7a. A conflict involves a normative source.** The panel says which side is normative; the author
  still decides — a normative source does not win automatically, because the product may be out of
  that source's scope.
- **7b. Every candidate is a duplicate.** The panel says so; writing then only adds sources to existing
  requirements.

## Postcondition

- The product repository holds a queue of proposals; the SPEC itself is unchanged until entries are
  accepted.
- No proposal duplicates an existing requirement: what the source adds is new, what it alters is a
  change under the existing name, what it repeats is an added source.
- Each proposal names its source passage, the source version and the participant that produced it.
