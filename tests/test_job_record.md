# Job Record Release Cases

The cases of `tests/test_job_record.py`, for the three requirements whose Check sentence names it (SPEC.md): A JOB IS RECORDED IN ITS PRODUCT REPOSITORY ("Every job other than a conversation held in a browser tab has a record
`docs/jobs/JOB-<id>.md` in the repository of the product it works on - the instance's own repository for a job of the instance - naming its inputs, participant, runtime and start, and, once it has ended, its end state and results.
*Check:* a job in the tab, in CI and on a Bridge each leaves its record; counter-proof: a conversation held in the tab leaves none."), A JOB IDENTIFIER IS NEVER REUSED ("No two jobs of a product share an identifier, a retried
job included."), and A RUN IS A JOB THAT NAMES ITS JOBS ("A run is recorded as a job whose record lists every job it started, and each of those jobs names the run.").

**How a case reads.** `given` is its precondition and `input` what it does; `expected` names only what the case asserts. For `routes`: `productRecords` and `instanceRecords` (the records under docs/jobs/ of the product's and of
another repository), `path` (the record is docs/jobs/<its id>.md), `kind`, `participant`, `route`, `inputs`, `worksOn`, `started`, `endState` and `results` (as listJobs reads them), `handedOver` (the hand-overs a Bridge received).
For the conversation cases, the keys are those of tests/test_conversation_not_recorded.md. For `ids`: `freeOnly`, `retryN` (`new`: no earlier record held the identifier; `retries`: the record names the job it retries), `records` and
`distinct`. For `ciEnd`: `outcome` (of the entry), `queuedBefore` and `records` (the records of the product's origin before and after), `takenByCi`, `endState`, `endNamesLog` (the record's Taken names the pipeline, its End has the state and names the pipeline as its log). For `run`: `listed` (the jobs the run's record lists), `started`, `allListed`, `allNameTheRun`.

## A JOB IS RECORDED IN ITS PRODUCT REPOSITORY

### A job queued for the tab, run there, leaves its record with its end

```json
{
  "given": "A job of the kind converse queued for the tab of a product's repository and run there by the tab runtime.",
  "input": {
    "kind": "routes",
    "routes": [
      "tab"
    ]
  },
  "expected": {
    "tab": {
      "productRecords": 1,
      "instanceRecords": 0,
      "path": true,
      "rows": 1,
      "id": true,
      "kind": "converse",
      "participant": "worker",
      "route": "tab",
      "inputs": [
        "docs/notes.md"
      ],
      "worksOn": [
        "A LOAN HAS A DUE DATE"
      ],
      "started": true,
      "endState": "done",
      "results": [
        "waits for a person"
      ],
      "handedOver": 0
    }
  }
}
```

### A job queued for CI leaves its record at once

```json
{
  "given": "A job queued for the hosted CI route of a product whose repository holds the job workflow.",
  "input": {
    "kind": "routes",
    "routes": [
      "ci hosted"
    ]
  },
  "expected": {
    "ci hosted": {
      "productRecords": 1,
      "instanceRecords": 0,
      "path": true,
      "rows": 1,
      "id": true,
      "kind": "converse",
      "participant": "worker",
      "route": "ci hosted",
      "inputs": [
        "docs/notes.md"
      ],
      "worksOn": [
        "A LOAN HAS A DUE DATE"
      ],
      "started": true,
      "endState": null,
      "results": null,
      "handedOver": 0
    }
  }
}
```

### A job handed over to a Bridge leaves its record, and the Bridge is told of it

```json
{
  "given": "A job queued for the Bridge lab and handed over to it with the record's path and commit.",
  "input": {
    "kind": "routes",
    "routes": [
      "bridge lab"
    ]
  },
  "expected": {
    "bridge lab": {
      "productRecords": 1,
      "instanceRecords": 0,
      "path": true,
      "rows": 1,
      "id": true,
      "kind": "converse",
      "participant": "worker",
      "route": "bridge lab",
      "inputs": [
        "docs/notes.md"
      ],
      "worksOn": [
        "A LOAN HAS A DUE DATE"
      ],
      "started": true,
      "endState": null,
      "results": null,
      "handedOver": 1
    }
  }
}
```

### A job taken by CI ends in the same record: its taking and its end are appended by the CI run

```json
{
  "given": "A job of the kind decide-gate queued in a product's repository for the hosted CI route (the record queueJob writes), and the entry onDispatch run on a CI runner's checkout of the product and of the instance, as the job workflow runs it, with a fake model endpoint.",
  "input": {
    "kind": "ciEnd"
  },
  "expected": {
    "outcome": "done",
    "queuedBefore": 1,
    "records": 1,
    "takenByCi": true,
    "endState": "done",
    "endNamesLog": true
  }
}
```

## A JOB IS RECORDED IN ITS PRODUCT REPOSITORY - a conversation in the tab

### Counter-proof: a conversation of two messages leaves no record and starts no workflow

```json
{
  "given": "With recording off, the person sends two messages to tooler on a page of the product and hands nothing over.",
  "input": {
    "recording": false,
    "page": "product",
    "replies": [
      {
        "answer": "NEEDLE-ANSWER-A the first reply."
      },
      {
        "answer": "NEEDLE-ANSWER-B the second reply."
      }
    ],
    "steps": [
      {
        "send": "NEEDLE-ONE hello",
        "to": "tooler"
      },
      {
        "send": "NEEDLE-TWO and again",
        "to": "tooler"
      }
    ],
    "needles": []
  },
  "expected": {
    "jobRecords": 0,
    "workflowStarts": 0,
    "commits": {
      "instance": 0,
      "product": 0
    }
  }
}
```

### A conversation whose task is handed over leaves exactly one record in the product

```json
{
  "given": "With recording off, the person sends two messages, and the participant proposes handing its task over, which goes on without a further click.",
  "input": {
    "recording": false,
    "page": "product",
    "replies": [
      {
        "answer": "NEEDLE-ANSWER-A the first reply."
      },
      {
        "answer": "NEEDLE-ANSWER-C I will hand this on.",
        "handOver": {
          "kind": "converse",
          "works_on": [
            "A LOAN HAS A DUE DATE"
          ],
          "task": "run the tests of the notes"
        }
      }
    ],
    "steps": [
      {
        "send": "NEEDLE-ONE hello",
        "to": "tooler"
      },
      {
        "send": "NEEDLE-THREE run the tests of the notes",
        "to": "tooler"
      },
      {
        "handOver": true
      }
    ],
    "needles": []
  },
  "expected": {
    "jobRecords": 1,
    "workflowStarts": 1,
    "commits": {
      "instance": 0,
      "product": 1
    }
  }
}
```

## A JOB IDENTIFIER IS NEVER REUSED

### When every identifier of the minute but one is taken, the free one is given every time

```json
{
  "given": "The 65 535 identifiers of the minute 2026-10-20 10:00 other than one are taken.",
  "input": {
    "kind": "ids"
  },
  "expected": {
    "freeOnly": true
  }
}
```

### A failed job retried three times in a row: every retry has a new identifier and names the job it retries

```json
{
  "given": "A job in a product's repository, retried, and the retry retried, three times.",
  "input": {
    "kind": "ids",
    "retries": 3
  },
  "expected": {
    "retry0": {
      "new": true,
      "retries": true
    },
    "retry1": {
      "new": true,
      "retries": true
    },
    "retry2": {
      "new": true,
      "retries": true
    },
    "records": 4,
    "distinct": 4
  }
}
```

## A RUN IS A JOB THAT NAMES ITS JOBS

### A run that started two jobs lists both, and both name the run

```json
{
  "given": "A run record of kind run with two `## Job started` parts, and the start records of the two jobs it started, each naming the run.",
  "input": {
    "kind": "run",
    "jobs": [
      "converse",
      "converse"
    ]
  },
  "expected": {
    "kind": "run",
    "listed": [
      "JOB-20261020-0910-b000",
      "JOB-20261020-0910-b001"
    ],
    "allListed": true,
    "allNameTheRun": true
  }
}
```

### Counter-proof: a job the run started that its record does not list is not listed

```json
{
  "given": "The same run, whose record leaves out the part of its second job.",
  "input": {
    "kind": "run",
    "jobs": [
      "converse",
      "converse"
    ],
    "omitPart": 1
  },
  "expected": {
    "allListed": false,
    "allNameTheRun": true
  }
}
```

### Counter-proof: a job of the run that does not name the run is told apart

```json
{
  "given": "The same run, whose second job's start record names no run.",
  "input": {
    "kind": "run",
    "jobs": [
      "converse",
      "converse"
    ],
    "unnamed": 1
  },
  "expected": {
    "allListed": true,
    "allNameTheRun": false
  }
}
```
