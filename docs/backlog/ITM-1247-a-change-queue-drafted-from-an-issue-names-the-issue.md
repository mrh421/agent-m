---
id: ITM-1247
title: A change queue drafted from an issue names the issue
level: module
realises:
  - UC-012
modules:
  - MOD-spec-changes
builds_on: []
tests:
  - unit
origin:
  - the developer of ITM-584, who found that no queue can name the issue it came from; the architecture a2fe0994, accepted in 6c0aa1ab
---
# ITM-1247 A change queue drafted from an issue names the issue

**REGISTER**

## Outcome

MOD-spec-changes, as accepted: the queue's `index.md` carries, for a queue drafted from an issue, the line
`**Issue:** #<number> of <product address>`; `Queue` gains `issue: { number, product } | null`, which `queues()` reads from
that line; the writer `queue-entries`, given the job's parameter `issue`, names the issue as the origin in each rationale
beside the source, and writes the index line.

The code does otherwise: the writer (`src/spec-changes/propose.mjs`, `rationaleOf` and the decision line) names as origin only
the source and a conversation in the prompt bar, and no parameter carries an issue; `queues()` (`src/spec-changes/queues.mjs`)
gives no `issue`; the schema `src/spec-changes/queue-index.schema.md` names no such line. Without the parameter `issue`,
everything stays as it is.

## Acceptance

- Unit tests naming MOD-spec-changes: a `queue-entries` write with the parameter `issue` names the issue in each rationale's
  origin and writes the index line; `queues()` reads it back as `issue`, and `null` for a queue without it; a write without
  `issue` is unchanged. Counter-proof: before the change the rationale names no issue and `queues()` gives no `issue`.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/spec-changes/` and the tests that name MOD-spec-changes change.
