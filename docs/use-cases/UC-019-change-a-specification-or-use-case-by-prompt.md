---
id: UC-019
title: Change a specification or a use case by prompt
area: evolution
actors:
  - Author
  - Drafter
  - GitHub
realises:
  - A DRAFTED CHANGE IS SHOWN AGAINST THE CURRENT TEXT
  - A CI AGENT'S DRAFT ENTERS AS OPEN
  - A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT
  - A PROMPTED REQUIREMENT CHANGE FOLLOWS THE DERIVATION RULES
  - THE PERSON WHO PROMPTS IS A SOURCE
  - A PROMPTED USE-CASE CHANGE SEES ITS NEIGHBOURS
  - NO USE CASE IS LEFT OUT OF A PROMPT SILENTLY
  - DERIVATION SEES THE EXISTING REQUIREMENTS
  - NO REQUIREMENT IS LEFT OUT OF THE CONTEXT SILENTLY
  - A CANDIDATE IS NEW, A CHANGE, A DUPLICATE OR A CONFLICT
  - EXACT DUPLICATES ARE FOUND WITHOUT A MODEL
  - A CHANGE IS PROPOSED UNDER THE EXISTING NAME
  - A CONFLICT IS DECIDED BY A PERSON
  - A SPEC EDIT IS SAVED AS A PROPOSAL
  - A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE
  - A REFUSED SAVE KEEPS THE EDIT
  - AN EDITED FILE KEEPS ITS IDENTIFIER
  - A RENAMED REQUIREMENT IS WITHDRAWN AND ADDED
  - A GENERATED ARTIFACT IS A PROPOSAL
  - THE PAGE NAMES WHERE IT SENDS
  - A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON
  - AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT
  - ONE DEFINITION, THREE DRIVERS
  - A PARTICIPANT DECLARES ITS CAPABILITIES
  - A PARTICIPANT DECLARES WHERE IT PROCESSES DATA
  - THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
  - ONE CLICK PER DECISION
  - EVERY STEP EXPLAINS ITSELF
  - A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT
  - A FINDING READS LIKE A COMPILER MESSAGE
  - AN ERROR MUST BE FIXED, A WARNING FIXED OR JUSTIFIED
  - WHAT A PERSON DECIDES IS NOT SENT BACK
  - THE CORRECTION LOOP HAS A FIXED LIMIT
  - THE ROUNDS ARE COUNTED AND SHOWN
  - A REQUIREMENTS JOB RECEIVES THE CHAPTER ON REQUIREMENTS ENGINEERING
---
# UC-019 Change a specification or a use case by prompt

**Goal.** With a requirement or a use case open, the author says in the prompt bar (UC-049) what should change — "split
this requirement", "add error handling to UC-007" — and the drafter the bar talks to drafts the change. The author sees
the draft as a difference against the current text, corrects it in the editor of UC-018, and saves: a use case
is committed as open, a requirement becomes a proposal for UC-006. The book's advice to pair text
with models "for agents" (Vibe Coding, ch. 9 §1) is what makes this work: the drafter reads the
same Markdown the author does.

## Actors

- **Author** — writes the instruction and decides on the result.
- **Drafter** — the model endpoint or CLI session the prompt bar talks to (UC-049), configured in this browser, that can
  *draft text*.
- **GitHub** — hosts the product repository (a GitLab server for a GitLab product).

## Precondition

- The product is managed by the instance (UC-001).
- At least one model endpoint or CLI session with the capability *draft text* is configured in this browser (UC-049).
- A token that can write to the product repository is stored in this browser (otherwise UC-018 4a,
  4b apply at saving).

## Main flow

1. With a requirement open in the specification browser (UC-020), a group of requirements, or a use case, the author
   writes the instruction in the prompt bar (UC-049). The bar's folded **What is this?** gives examples: split a
   requirement, make a rule checkable, add an alternative flow, align a use case with a changed requirement.
2. The drafter is the one named above the prompt bar, with the place where it processes data (UC-049, step 1); for a
   change, Agent M offers there only those that can draft text.
3. The open requirement, group or use case is the target of the change; the author does not name it.
4. Agent M assembles what the drafter must see:
   - **requirements:** the requirements to change, and every requirement of the product — in its
     SPEC and in its open queues;
   - **use case:** the use case, every requirement it realises, and every other use case of the
     product;
   - **for both:** chapter 8 of the book *Vibe Coding*.

   It checks that the instruction and all of this fit into the drafter's context.
5. The author presses **Send** — that click is the decision to send.
6. Agent M sends the instruction and the context with the change prompt from the repository's single
   definition. The drafter returns the changed text; for requirements, each resulting requirement
   is classified as new, a change to a named requirement, a duplicate of one, or a conflict with one,
   and names among its sources the author's own source — the register entry of the author's account,
   which the product links (UC-004, UC-015).
7. **The correction loop.** Before showing anything, Agent M checks the draft without a model and
   sends every finding back to the drafter, which returns a corrected draft; this repeats until the
   draft passes, or until the limit of rounds fixed before the first round and named in the conversation (default 5), or until a round
   changes nothing. Each finding reads like a compiler message — artifact and line, *error* or
   *warning*, the rule by name, the correction expected:

   ```text
   UC-007:4: error: id changed from UC-007 to UC-043 [AN EDITED FILE KEEPS ITS IDENTIFIER] — keep UC-007.
   UC-007:12: error: realises "EXPORT AS PDF" matches no requirement [A USE CASE REALISES NAMED REQUIREMENTS] — use an existing name or remove the line.
   SPEC:§3: error: "EXPORT IS A PDF" restates the existing requirement word for word but is classed new [EXACT DUPLICATES ARE FOUND WITHOUT A MODEL] — class it as duplicate of EXPORT IS A PDF.
   SPEC:§3: warning: rule contains "and" [ONE STATEMENT PER REQUIREMENT] — split it, or keep it and give a one-line reason.
   ```

   Errors must be fixed; a warning may be kept with a one-line reason. Not sent back: a conflict with
   an existing requirement, which the author decides in step 8, and a requirement whose name changed,
   which Agent M itself proposes as withdrawal plus new requirement.
8. The dashboard opens the editor of UC-018 with the draft, showing the difference against the
   current text line by line; for requirements, each one carries its class and stands beside the
   existing requirement it refers to. The author edits freely, or writes a follow-up instruction in the prompt bar,
   which repeats steps 5–7 on the current draft.
9. The author presses **Save** — one click — and UC-018 continues at step 5: the use case is
   committed as open, or a queue entry is written and the SPEC stays unchanged. The commit, or the
   queue entry, records the drafter, the model, the Agent M version, the date, and how many
   correction rounds the draft needed — never the instruction, which is a message of the conversation and is kept only
   in its conversation record when the instance records conversations (UC-049, 6c).

```mermaid
sequenceDiagram
    actor A as Author
    participant D as Dashboard
    participant P as Drafter
    participant G as Product repository
    A->>D: instruction in the prompt bar, Send
    D->>G: read target, related requirements and use cases
    D->>P: instruction, context, change prompt
    P-->>D: changed text, classes for requirements
    D->>D: exact duplicates, identifiers, realised names
    D-->>A: difference against current text in the editor
    A->>D: edit or follow-up instruction, then Save
    alt use case
        D->>G: commit file (open)
    else requirement
        D->>G: commit queue entry, SPEC untouched
    end
```

## Alternative flows

- **3a. Nothing configured can draft text.** Agent M says so and links to the configuration of endpoints (UC-003).
- **4a. The context does not fit into the chosen drafter.** Nothing is sent. Agent M says how
  many requirements or use cases there are and how much fits, and offers a drafter with a larger
  context; it never leaves any of them out silently.
- **4b. A change of requirements, and the author has no source of their own that the product links.**
  Nothing is sent. Agent M says so and links registering the author as a source (UC-004) and linking
  it to the product (UC-015).
- **5a. The author does not press Send.** Nothing is sent.
- **6a. The drafter is a CLI session** (UC-011). The request goes through the local
  bridge; the agent returns the draft to the dashboard and the flow continues at step 7.
- **6b. The work is handed to GitHub Actions** (UC-049, 4a). The workflow runs the correction loop of step 7 from
  the same definition, then commits the draft to the default branch — a use case as open, a change to
  requirements as an entry of its section's queue under `docs/spec-freigaben/`; `SPEC.md` is not touched. The
  commit records what step 9 records, and its job record names no message of the conversation. Instead of step 8, the author reviews it on the dashboard: a use
  case in UC-008, shown against its last accepted text (UC-008, 2a); a queue entry in UC-006, beside the
  current SPEC section, where a conflict with an existing requirement is decided. Nothing counts before
  it is accepted.
- **6c. The drafter returns nothing usable** — no text, the unchanged text, or text that cannot
  be read as the artifact. That is a finding of the correction loop (step 7) like any other; if it is
  still so after the last round, the dashboard says which, shows the raw answer folded, and writes
  nothing.
- **7a. The loop ends with findings left** — the limit is reached, or a round changed nothing. The
  editor of step 8 opens with the draft and, beside it, the remaining findings in the same compiler
  form and the number of rounds; the author fixes them by hand, writes a follow-up instruction, or discards the
  draft. A changed `id` is restored by Agent M before the editor opens; a use case that should become two
  is split by keeping this one and adding another.
- **7b. The drafter dropped a name from `realises`.** The difference highlights it — a dropped name
  is not an error, it may be intended; an added name that matches no requirement is an error of the loop
  and is never turned into a requirement.
- **8a. A returned requirement conflicts with an existing one.** It is shown beside it, with both
  sources and their authority. It is not written until the author decides; undecided conflicts stay
  in the panel.
- **8b. The instruction touched several use cases** ("align UC-007 and UC-008 with the new rule").
  Each file is shown with its own difference; *Save* commits all of them in one commit, and each is
  accepted on its own (UC-008).
- **8c. The author discards the draft.** Nothing is written.
- **9a. The target changed while the drafter was drafting.** UC-018 5a: nothing is written, the
  draft stays in the editor beside the newer version.

## Postcondition

- Only what the author saved — or, through a CI agent, what its workflow committed for review (6b) —
  was written: a use case as open, or a queue entry beside the current SPEC section; the SPEC itself is
  unchanged.
- No requirement was duplicated: a restated rule became a duplicate, a changed rule kept its name.
- The record of the change names the drafter and the model that drafted it, and no message of the conversation.
