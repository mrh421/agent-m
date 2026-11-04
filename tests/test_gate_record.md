# Gate record cases

The data of tests/test_gate_record.py. Every case is a decision on a gate of the model Scrum, written as MOD-product-process' `recordGateDecision` writes it.

- `gate` is the gate as the workflow names it: `Development → Sprint Review`, decided by the role Product Owner, or `A GREEN BUILD GATES THE MERGE`, which a requirement of the instance's SPEC adds and the check `build` decides.
- `decider` is who decides (`name`, and `kind`: a `person`, an `agent` or a `check`); `role` the deciding role; `assignment` who holds the Product Owner in the job's role assignment.
- `checked` is the artifact the gate checks, with its path and its text at the time of the decision; `reason` the reasoning that an agent gives.
- `expected` is what the record must hold: `decider`, `role`, `decision`, `on` (what was checked: the checked artifact as `<path>@<blob>`, the blob being the git blob SHA-1 of its text, as the case states it), `reason`, the shape of `date`, the `subject` of the commit and whether the commit's message holds the job's trailers.

## person: the Product Owner passes the gate

### Case

```json
{
  "group": "person",
  "gate": "Development → Sprint Review",
  "decider": { "name": "alice", "kind": "person" },
  "role": "Product Owner",
  "assignment": "alice",
  "job": "JOB-20261008-0800-a1b2",
  "checked": { "path": "docs/backlog/ITM-001-the-work.md", "text": "# ITM-001 The work\n\nThe work.\n" },
  "reason": null,
  "trailers": [],
  "expected": { "decider": "alice", "role": "Product Owner", "decision": "passed", "on": ["docs/backlog/ITM-001-the-work.md@4d2ee9550ce934113275f1daf38f333510f18197"], "reason": null,
    "date": "2026-10-08 08:50 UTC", "subject": "gates: Development → Sprint Review passed by alice", "trailers": false }
}
```

## agent: an agent that holds the role passes it with its reasoning

### Case

```json
{
  "group": "agent",
  "gate": "Development → Sprint Review",
  "decider": { "name": "po-bot", "kind": "agent" },
  "role": "Product Owner",
  "assignment": "po-bot",
  "job": "JOB-20261008-0800-a1b2",
  "checked": { "path": "docs/backlog/ITM-001-the-work.md", "text": "# ITM-001 The work\n\nThe work.\n" },
  "reason": "Every selected item meets its acceptance criteria.",
  "trailers": ["Agent-M-Job: JOB-20261008-0801-c3d4", "Agent-M-Participant: po-bot"],
  "expected": { "decider": "po-bot", "role": "Product Owner", "decision": "passed", "on": ["docs/backlog/ITM-001-the-work.md@4d2ee9550ce934113275f1daf38f333510f18197"],
    "reason": "Every selected item meets its acceptance criteria.", "date": "2026-10-08 08:50 UTC", "subject": "gates: Development → Sprint Review passed by po-bot", "trailers": true }
}
```

## check: a CI check passes the gate it decides

### Case

```json
{
  "group": "check",
  "gate": "A GREEN BUILD GATES THE MERGE",
  "decider": { "name": "build", "kind": "check" },
  "role": "check",
  "assignment": null,
  "job": null,
  "checked": { "path": "docs/backlog/ITM-001-the-work.md", "text": "# ITM-001 The work\n\nThe work.\n" },
  "reason": null,
  "trailers": [],
  "expected": { "decider": "check: build", "role": "check", "decision": "passed", "on": ["docs/backlog/ITM-001-the-work.md@4d2ee9550ce934113275f1daf38f333510f18197"], "reason": null,
    "date": "2026-10-08 08:50 UTC", "subject": "gates: A GREEN BUILD GATES THE MERGE passed by build", "trailers": false }
}
```
