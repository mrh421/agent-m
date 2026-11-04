---
id: UC-033
title: Move an issue into the backlog
area: evolution
actors:
  - Product Owner
  - Contributor
  - GitHub
realises:
  - THE BACKLOG LIVES IN THE PRODUCT REPOSITORY
  - A BACKLOG ITEM NAMES WHAT IT REALISES
  - A BACKLOG ITEM NAMES THE MODULES IT CHANGES
  - NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED
  - EVOLUTION ENTERS THROUGH THE SPECIFICATION
  - EVERY ARTIFACT NAMES ITS ORIGIN
  - A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION
  - A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
  - ONE CLICK PER DECISION
---
# UC-033 Move an issue into the backlog

**Goal.** An issue that UC-012 has classified becomes a backlog item, with links in both directions,
so that the work is planned like every other item.

- A **bug** can be started at once. Its item realises the requirement that the code currently
  violates.
- A **change** goes through the specification first (`EVOLUTION ENTERS THROUGH THE SPECIFICATION`).
  Its item may enter the backlog early so that it is not lost, but no job starts until the
  specification change is accepted.

## Actors

- **Product Owner**: fills the backlog and plans from it (UC-032).
- **Contributor**: filed the issue and follows it.
- **GitHub**: hosts the issue and the product repository (or the product's GitLab server).

## Precondition

- The product works from a backlog (UC-002).
- The issue is classified as *bug* or *change* (UC-012, step 4).

## Main flow

1. On the issue's panel in Agent M, the Product Owner presses **Move to backlog**.
2. Agent M prefills the item:
   - **title** from the issue;
   - **outcome** from the issue's description;
   - **origin**: the issue's address, for example `https://github.com/alice/thesis-tool/issues/57`;
   - **realises**:
     - for a *bug*, the requirement that UC-012's analysis named as violated, for example
       `EXPORT IS A PDF`;
     - for a *change*, the entries under `docs/spec-freigaben/` that UC-012 wrote for
       this issue, by requirement name;
   - **modules**: the modules of the architecture the fix or the change will touch, as UC-012's analysis
     and the architecture name them; the Product Owner confirms or corrects them.
3. Agent M checks the item as it checks a drafted item (UC-032, step 3) and names what fails; the Product Owner
   corrects it.
4. The Product Owner presses **Add**: one click. Agent M:
   - commits the item file under `docs/backlog/`;
   - adds a comment to the issue with the item's identifier and a link to the item file in the product's repository;
   - adds the label `backlog` to the issue.
5. The item appears in the backlog (UC-032):
   - A bug item is *ready*.
   - A change item is *waiting for acceptance* until every requirement it names is accepted
     (UC-006). It then becomes *ready* by itself, because its state is derived.
6. When a pull request for the item is merged (UC-034), the issue is closed with a link to the pull
   request and the item.

```mermaid
sequenceDiagram
    actor O as Product Owner
    actor C as Contributor
    participant M as Agent M
    participant G as Product repository and issues
    O->>M: Move to backlog
    M->>G: read issue, UC-012 class and queue
    M-->>O: item prefilled, origin and what it realises
    O->>M: Add
    M->>G: commit item
    M->>G: comment and label on the issue
    G-->>C: notification with the item link
    M-->>O: item ready, or waiting for acceptance
```

## Alternative flows

- **1a. The issue is not classified yet.** **Move to backlog** is not offered. Agent M links to
  UC-012, step 2.
- **2a. The change's specification entries are rejected** (UC-006). The item names requirements that
  will never be accepted. Agent M marks it, and offers to remove it and close the issue with a link
  to the rejected entry.
- **2b. The change is accepted under a different name than proposed.** The item follows the
  accepted name, because the approval record names the entry it accepted. Agent M updates the item's
  *realises* when the Product Owner confirms.
- **4a. Several issues describe the same work.** The Product Owner adds a second issue to an
  existing item instead. The item then names both issues as origins, and both issues get the
  comment.
- **4b. No token for the issue tracker is stored, or the token may not comment.** The item is
  committed. Agent M shows the comment text with a copy button and the issue's address.
- **1b. The product works from a plan.** There is no backlog.
  - A bug is fixed directly (UC-012, step 5).
  - An accepted change enters the plan of requirements × phases by itself, because that plan covers every
    accepted requirement (`A PLAN COVERS THE WHOLE SPECIFICATION`, UC-035). Its implementation needs a step
    of the implementation plan, which the planner adds (UC-045) — after the architecture is changed, where
    the change needs it (UC-023).

## Postcondition

- The backlog holds an item that names the issue as its origin, what it realises and the modules it changes.
- The issue names the item.
- No implementation job can start for a change item before its specification change is accepted.
