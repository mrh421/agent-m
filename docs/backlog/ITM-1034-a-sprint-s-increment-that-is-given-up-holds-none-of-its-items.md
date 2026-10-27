---
id: ITM-1034
title: A sprint's increment that is given up holds none of its items
level: module
realises:
  - UC-041
  - A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH
modules:
  - MOD-work-plans
  - MOD-implementation-pages
builds_on:
  - ITM-990
tests:
  - unit
origin:
  - the gap analysis of UC-036 to UC-049 on main, proposal NEW-041-7, read against the accepted texts on main at 40e04d8d
  - akmaier's direction of 2026-10-18 ("fill the backlog to implement the remaining missing UC 36 to the end")
built_by:
  - 51d29e1a38afca8a0a6202ff6d49f672befa2b42
  - 9c0c927a175b1725f255257a7f28d8661871d056
---
# ITM-1034 A sprint's increment that is given up holds none of its items

**REGISTER**

## Outcome

UC-041 7b: "If the Product Owner gives the increment up, its done items stay done and are no longer held; a change to one of
them is a new item." It waits for the SPEC entry `docs/spec-freigaben/2026-10-25_a-given-up-increment-holds-no-item/` and for
the acceptance of UC-041 and MOD-work-plans as they read with it.

## The accepted text

The draft for this item is accepted (`1c30ad0b` and the acceptances before it); quoted from `main` at 40e04d8d:

MOD-work-plans.md:233-237:

> - `giveUpIncrement(host: Host, sprint: string, reason: string, context: { head: string, trailers: string[] }) -> Promise<{
>   commit: string }>` — the Product Owner's *Give up increment* for a closed sprint whose branch was not merged: appends
>   `## Increment given up` with the date, the person and the reason, in one commit; the sprint then holds none of its items
>   (UC-041 7b). Errors: `NotFound { path }`, `NotClosed` for a sprint without `## Review`, `Merged` for a sprint whose
>   branch's pull request is merged, and the host's.

## Done items stay done

Every merged pull request naming an item makes it `done`, into any branch (MOD-work-plans, `ItemState`: "A merged pull
request decides first"). An item merged into the branch of a sprint whose increment is given up therefore stays `done`, and
`startable` refuses a job on it ("a change to it is a new item"), as UC-041 7b states. This item changes nothing of that.

## Acceptance

- Unit tests that name MOD-work-plans: after the increment is given up, `heldItems` holds none of the sprint's items, and
  `itemStates` keeps its merged items `done`.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
