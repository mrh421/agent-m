# Process Run Release Cases

The cases of `tests/test_process_run.py`, for the six requirements whose Check sentence names it (SPEC.md): A RUN EXECUTES THE PROCESS MODEL OVER A SELECTION ("A person can start one run over any selection of the product's accepted
work - one module, several or all, or, in a model that works from a backlog, backlog items - and Agent M carries it out as jobs in the phases, order, roles and gates of the product's declared process model. *Check:* a V-model
fixture with three accepted modules yields, from one start, the jobs of every phase for all three in the model's order."), A RUN CONTINUES WITHOUT A CLICK BETWEEN ITS JOBS ("*Check:* a fixture run of five jobs without a person's
gate needs one start and no further click; counter-proof: with a gate decided by a person, it waits there and nowhere else."), A RUN FOLLOWS THE MODULES' INTERFACES ("*Check:* for modules A -> B -> C and D, C starts after B and B
after A, while D runs alongside; counter-proof: a cycle in the interfaces is refused before the run starts, and named."), A RUN SETS UP CI BEFORE IT IMPLEMENTS ("A run whose product has no CI configuration generated from its test
schedule creates it before its first implementation job."), A RUN HAS LIMITS FIXED AT ITS START ("*Check:* a run whose reported cost reaches its limit starts no further job and says why; counter-proof: below the limit it
continues.") and A RUN ENDS WITH THE VALIDATION OF ITS MODULES ("When a run ends, the dashboard shows for its selection what each module realises, which code and tests belong to it, and every gap.").

**How a case reads.** `given` is its precondition and `input` what it does; `expected` names only what the case asserts. For `waves`: `waves` (the jobs each round of the run's participant starts, by step, or by module for the chain of
four modules, or `set-up-ci`), `refused` and `cycleNames` (the refusal of a cycle, and the modules it names), `clicks` (the times a person was asked), `runRecords` and `jobRecords` (the records under docs/jobs/ of the run and of its
jobs), `jobsNamingTheRun`, `started`, `kinds`, `done` (the steps derived done), `runState` (as MOD-run-planner's runOf reads it), `configured` and `drift` (the CI configuration present, and how many differences from the one the schedule
generates) and `earlyTesting` (steps of the phase Testing started in a round in which a step of the phase Implementation had not been done before the round began). For `gate`: the same, and `waitingAt` (steps derived blocked at a gate)
and `notStarted` (steps derived waiting). For `limit`: `state` of the run, `starts` (the steps the next actions start), `holds` and `mentionsCost` (an action `hold` with a reason that names the cost). For `validation`: `rows` (the
module rows of the view for the selection) and `all` (those of the view without one).

## A RUN EXECUTES THE PROCESS MODEL OVER A SELECTION

### A V-model fixture with three accepted modules yields, from one start, the jobs of every phase for all three in the model's order

```json
{
  "given": "The planned V-model product with MOD-store, MOD-pages and MOD-mail accepted, its plan of six steps, both gates before Implementation recorded and no CI configuration, and one run over the six steps.",
  "input": {
    "kind": "waves",
    "ci": false
  },
  "expected": {
    "waves": [
      [
        "set-up-ci"
      ],
      [
        "ITM-101",
        "ITM-103"
      ],
      [
        "ITM-102",
        "ITM-105"
      ],
      [
        "ITM-104"
      ],
      [
        "ITM-106"
      ]
    ],
    "started": [
      "ITM-101",
      "ITM-102",
      "ITM-103",
      "ITM-104",
      "ITM-105",
      "ITM-106",
      "set-up-ci"
    ],
    "kinds": [
      "implement",
      "set-up-ci"
    ],
    "runRecords": 1,
    "jobRecords": 7,
    "jobsNamingTheRun": 7,
    "clicks": 0,
    "refused": false,
    "done": [
      "ITM-101",
      "ITM-102",
      "ITM-103",
      "ITM-104",
      "ITM-105",
      "ITM-106"
    ]
  }
}
```

### The phases follow the model's order

```json
{
  "given": "The same run.",
  "input": {
    "kind": "waves",
    "ci": false
  },
  "expected": {
    "earlyTesting": []
  }
}
```

## A RUN CONTINUES WITHOUT A CLICK BETWEEN ITS JOBS

### A run of five jobs without a person's gate needs one start and no further click

```json
{
  "given": "A run over ITM-101 to ITM-105 of the planned product, whose CI configuration stands, with no gate a person has to decide.",
  "input": {
    "kind": "waves",
    "selection": [
      "ITM-101",
      "ITM-102",
      "ITM-103",
      "ITM-104",
      "ITM-105"
    ]
  },
  "expected": {
    "runRecords": 1,
    "jobRecords": 5,
    "jobsNamingTheRun": 5,
    "clicks": 0,
    "refused": false,
    "started": [
      "ITM-101",
      "ITM-102",
      "ITM-103",
      "ITM-104",
      "ITM-105"
    ],
    "done": [
      "ITM-101",
      "ITM-102",
      "ITM-103",
      "ITM-104",
      "ITM-105"
    ],
    "runState": "running"
  }
}
```

### With a gate decided by a person the run waits there and nowhere else

```json
{
  "given": "The same run in which the job of ITM-101 reaches the gate Validation & Verification → Operation & Maintenance, decided by the Reviewer, and waits there.",
  "input": {
    "kind": "gate",
    "selection": [
      "ITM-101",
      "ITM-102",
      "ITM-103",
      "ITM-104",
      "ITM-105"
    ],
    "gateStep": "ITM-101"
  },
  "expected": {
    "waitingAt": [
      "ITM-101"
    ],
    "notStarted": [
      "ITM-102",
      "ITM-104",
      "ITM-106"
    ],
    "done": [
      "ITM-103",
      "ITM-105"
    ],
    "runState": "waiting at a gate",
    "clicks": 0
  }
}
```

## A RUN FOLLOWS THE MODULES' INTERFACES

### Modules A → B → C and D: C starts after B, B after A, and D runs alongside

```json
{
  "given": "Four modules MOD-a to MOD-d of one subsystem, MOD-c using MOD-b and MOD-b using MOD-a, MOD-d using nothing; their steps ITM-201 to ITM-204 stand in the plan in the order C, D, B, A; the CI configuration stands.",
  "input": {
    "kind": "waves",
    "product": "chain"
  },
  "expected": {
    "waves": [
      [
        "MOD-d",
        "MOD-a"
      ],
      [
        "MOD-b"
      ],
      [
        "MOD-c"
      ]
    ],
    "refused": false,
    "clicks": 0,
    "runRecords": 1,
    "jobRecords": 4
  }
}
```

### A cycle in the interfaces is refused before the run starts, and named

```json
{
  "given": "The same four modules with MOD-a also using MOD-c: MOD-a, MOD-c and MOD-b use each other in a ring.",
  "input": {
    "kind": "waves",
    "product": "chain",
    "uses": {
      "MOD-b": [
        "MOD-a.read"
      ],
      "MOD-c": [
        "MOD-b.read"
      ],
      "MOD-a": [
        "MOD-c.read"
      ]
    }
  },
  "expected": {
    "refused": true,
    "waves": [],
    "jobRecords": 0,
    "runRecords": 1,
    "cycleNames": [
      "MOD-a",
      "MOD-b",
      "MOD-c"
    ]
  }
}
```

## A RUN SETS UP CI BEFORE IT IMPLEMENTS

### No CI configuration generated from the schedule: it is created before the first implementation job

```json
{
  "given": "The planned product without a CI configuration, and a run over ITM-101 and ITM-103, both ready.",
  "input": {
    "kind": "waves",
    "selection": [
      "ITM-101",
      "ITM-103"
    ],
    "ci": false
  },
  "expected": {
    "waves": [
      [
        "set-up-ci"
      ],
      [
        "ITM-101",
        "ITM-103"
      ]
    ],
    "kinds": [
      "implement",
      "set-up-ci"
    ],
    "configured": true,
    "drift": 0
  }
}
```

### CI in place: a product with its configuration gets no CI setup

```json
{
  "given": "The same product with the CI configuration generated from the book's default schedule in place.",
  "input": {
    "kind": "waves",
    "selection": [
      "ITM-101",
      "ITM-103"
    ]
  },
  "expected": {
    "waves": [
      [
        "ITM-101",
        "ITM-103"
      ]
    ],
    "kinds": [
      "implement"
    ],
    "configured": true
  }
}
```

## A RUN HAS LIMITS FIXED AT ITS START

### A run whose reported cost reaches its limit starts no further job and says why

```json
{
  "given": "A run over the six steps with a cost limit of 5, CI configured, whose first job (ITM-101) ended done at a cost the runtime reported as 6.",
  "input": {
    "kind": "limit",
    "cost": 5,
    "reported": 6
  },
  "expected": {
    "state": "held by a limit",
    "starts": [],
    "holds": true,
    "mentionsCost": true
  }
}
```

### Below the limit the run continues

```json
{
  "given": "The same run whose first job ended at a cost the runtime reported as 3.",
  "input": {
    "kind": "limit",
    "cost": 5,
    "reported": 3
  },
  "expected": {
    "state": "running",
    "starts": [
      "ITM-102",
      "ITM-103"
    ],
    "holds": false
  }
}
```

### The limit is read: a reported cost at the limit holds the run

```json
{
  "given": "The same run whose first job ended at a cost the runtime reported as 6.",
  "input": {
    "kind": "limit",
    "cost": 5,
    "reported": 6
  },
  "expected": {
    "state": "held by a limit"
  }
}
```

## A RUN ENDS WITH THE VALIDATION OF ITS MODULES

### The modules view of a run's selection shows those modules alone

```json
{
  "given": "The fixture product of tests/uc-025-harness.mjs, which has the modules MOD-mail, MOD-news, MOD-pages and MOD-store, and a run whose selection is MOD-store and MOD-pages.",
  "input": {
    "kind": "validation",
    "modules": [
      "MOD-store",
      "MOD-pages"
    ]
  },
  "expected": {
    "rows": [
      "MOD-pages",
      "MOD-store"
    ],
    "all": [
      "MOD-mail",
      "MOD-news",
      "MOD-pages",
      "MOD-store"
    ]
  }
}
```
