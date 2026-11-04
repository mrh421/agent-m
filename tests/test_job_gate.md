# Job gate cases

The data of tests/test_job_gate.py. Every case is a job of the participant `ci-bot` that has reached a gate of the model Scrum in a product of two teams — team1, whose sprint holds ITM-001, and team2, whose sprint holds ITM-002 —, and the decisions that are tried on that gate.

- `jobTeam` is the team whose sprint holds the item the job works on; its role assignment is the job's role assignment.
- `assignments` gives, for each team, who holds the role Product Owner (`po`), which decides the gate Development → Sprint Review, and who holds Developers (`dev`).
- `gate` is `role`: the gate Development → Sprint Review, decided by the Product Owner; or `check`: a gate that a requirement of the instance's SPEC adds, decided by the check `build`.
- `attempts` are the decisions tried through MOD-product-process' `recordGateDecision`, in order: who decides (`by`, a `person` or an `agent`), `decision` and, for a rejection, its `reason`. A refused attempt writes nothing; a decision that stands is committed to the product.
- `check` is the completed check run (`name`, `conclusion`) that MOD-workflow-entries' `onCheckCompleted` receives, where the gate is decided by a check.
- `expected` is what the case must give: `refused` the attempts MOD-product-process refused, each as [who, reason]; `recorded` the gate records that stand, each as "<decider> <decision>"; `resumed` whether the job's route resumed the job when its records changed, and `resumedBy` the decider of the record that resumed it.

## stops: no decision is recorded

### Case

```json
{
  "group": "stops",
  "jobTeam": "team1",
  "assignments": { "team1": { "po": "alice", "dev": "ci-bot" }, "team2": { "po": "bob", "dev": "ci-bot" } },
  "gate": "role",
  "attempts": [],
  "check": null,
  "expected": { "refused": [], "recorded": [], "resumed": false, "resumedBy": null }
}
```

## stops: a person who holds no role decides

### Case

```json
{
  "group": "stops",
  "jobTeam": "team1",
  "assignments": { "team1": { "po": "alice", "dev": "ci-bot" }, "team2": { "po": "bob", "dev": "ci-bot" } },
  "gate": "role",
  "attempts": [{ "by": "carol", "kind": "person", "decision": "passed" }],
  "check": null,
  "expected": { "refused": [["carol", "not a holder of the deciding role"]], "recorded": [], "resumed": false, "resumedBy": null }
}
```

## stops: the Product Owner of the other team decides

### Case

```json
{
  "group": "stops",
  "jobTeam": "team1",
  "assignments": { "team1": { "po": "alice", "dev": "ci-bot" }, "team2": { "po": "bob", "dev": "ci-bot" } },
  "gate": "role",
  "attempts": [{ "by": "bob", "kind": "person", "decision": "passed" }],
  "check": null,
  "expected": { "refused": [["bob", "not a holder of the deciding role"]], "recorded": [], "resumed": false, "resumedBy": null }
}
```

## stops: the deciding role rejects

### Case

```json
{
  "group": "stops",
  "jobTeam": "team1",
  "assignments": { "team1": { "po": "alice", "dev": "ci-bot" }, "team2": { "po": "bob", "dev": "ci-bot" } },
  "gate": "role",
  "attempts": [{ "by": "alice", "kind": "person", "decision": "rejected", "reason": "The increment lacks a test." }],
  "check": null,
  "expected": { "refused": [], "recorded": ["alice rejected"], "resumed": false, "resumedBy": null }
}
```

## stops: the check fails

### Case

```json
{
  "group": "stops",
  "jobTeam": "team1",
  "assignments": { "team1": { "po": "alice", "dev": "ci-bot" }, "team2": { "po": "bob", "dev": "ci-bot" } },
  "gate": "check",
  "attempts": [],
  "check": { "name": "build", "conclusion": "failure" },
  "expected": { "refused": [], "recorded": ["check: build rejected"], "resumed": false, "resumedBy": null }
}
```

## proceeds: a person's decision

### Case

```json
{
  "group": "proceeds",
  "jobTeam": "team1",
  "assignments": { "team1": { "po": "alice", "dev": "ci-bot" }, "team2": { "po": "bob", "dev": "ci-bot" } },
  "gate": "role",
  "attempts": [{ "by": "alice", "kind": "person", "decision": "passed" }],
  "check": null,
  "expected": { "refused": [], "recorded": ["alice passed"], "resumed": true, "resumedBy": "alice" }
}
```

## proceeds: an agent's decision

### Case

```json
{
  "group": "proceeds",
  "jobTeam": "team1",
  "assignments": { "team1": { "po": "po-bot", "dev": "ci-bot" }, "team2": { "po": "bob", "dev": "ci-bot" } },
  "gate": "role",
  "attempts": [{ "by": "po-bot", "kind": "agent", "decision": "passed" }],
  "check": null,
  "expected": { "refused": [], "recorded": ["po-bot passed"], "resumed": true, "resumedBy": "po-bot" }
}
```

## proceeds: a CI check's decision

### Case

```json
{
  "group": "proceeds",
  "jobTeam": "team1",
  "assignments": { "team1": { "po": "alice", "dev": "ci-bot" }, "team2": { "po": "bob", "dev": "ci-bot" } },
  "gate": "check",
  "attempts": [],
  "check": { "name": "build", "conclusion": "success" },
  "expected": { "refused": [], "recorded": ["check: build passed"], "resumed": true, "resumedBy": "check: build" }
}
```

## work: the participant whose work the gate checks holds the role and decides

### Case

```json
{
  "group": "work",
  "jobTeam": "team1",
  "assignments": { "team1": { "po": "alice, ci-bot", "dev": "ci-bot" }, "team2": { "po": "bob", "dev": "ci-bot" } },
  "gate": "role",
  "attempts": [{ "by": "ci-bot", "kind": "agent", "decision": "passed" }],
  "check": null,
  "expected": { "refused": [["ci-bot", "did the work this gate checks"]], "recorded": [], "resumed": false, "resumedBy": null }
}
```

## work: a second agent that holds the role decides after the first is refused

### Case

```json
{
  "group": "work",
  "jobTeam": "team1",
  "assignments": { "team1": { "po": "ci-bot, po-bot", "dev": "ci-bot" }, "team2": { "po": "bob", "dev": "ci-bot" } },
  "gate": "role",
  "attempts": [{ "by": "ci-bot", "kind": "agent", "decision": "passed" }, { "by": "po-bot", "kind": "agent", "decision": "passed" }],
  "check": null,
  "expected": { "refused": [["ci-bot", "did the work this gate checks"]], "recorded": ["po-bot passed"], "resumed": true, "resumedBy": "po-bot" }
}
```

## within: a job of the first team, decided by the other team's Product Owner and then by its own

### Case

```json
{
  "group": "within",
  "jobTeam": "team1",
  "assignments": { "team1": { "po": "alice", "dev": "ci-bot" }, "team2": { "po": "bob", "dev": "ci-bot" } },
  "gate": "role",
  "attempts": [{ "by": "bob", "kind": "person", "decision": "passed" }, { "by": "alice", "kind": "person", "decision": "passed" }],
  "check": null,
  "expected": { "refused": [["bob", "not a holder of the deciding role"]], "recorded": ["alice passed"], "resumed": true, "resumedBy": "alice" }
}
```

## within: a job of the second team, decided by the first team's Product Owner and then by its own

### Case

```json
{
  "group": "within",
  "jobTeam": "team2",
  "assignments": { "team1": { "po": "alice", "dev": "ci-bot" }, "team2": { "po": "bob", "dev": "ci-bot" } },
  "gate": "role",
  "attempts": [{ "by": "alice", "kind": "person", "decision": "passed" }, { "by": "bob", "kind": "person", "decision": "passed" }],
  "check": null,
  "expected": { "refused": [["alice", "not a holder of the deciding role"]], "recorded": ["bob passed"], "resumed": true, "resumedBy": "bob" }
}
```
