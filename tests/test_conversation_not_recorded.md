# Conversation Recording Release Cases

The cases of `tests/test_conversation_not_recorded.py`. Every phrase that starts with `NEEDLE-` appears in this file and in no other file of the
repository, so that a text found in a commit, a commit message, a file or a record can only come from the conversation of the case.

**How a case reads.** `given` is its precondition. `input` holds whether the instance records conversations (`recording`), the page the
conversation is held on (`page`: a page of the product `alice/thesis-tool`, or of the instance `alice/agent-m`), the replies the fake model
endpoint gives in turn (`replies`: the tool calls of a model that can use tools, or an answer, which may propose a hand-over), the steps in
order (`send` a message to a participant; `save` an edit the person saves, as one commit with the job's provenance lines; `handOver` the
hand-over the participant proposes, followed without a further click), the `needles` to look for, and for the counter-proofs `plant` (a text put into the job record after the run) and
`omit` (a text taken out of the conversation record before it is looked at). `expected` names only what the case asserts, out of: `found`
and `foundCount` (each needle: where, and in how many places, it was found among every commit message, every file of every commit and every
job record), `conversationFiles` (how many records lie under docs/conversations/ in each repository), `conversationPaths` (whether every
record's path has the form docs/conversations/<yyyymmdd>-<hhmm>-<4 hex>.md), `jobRecords`, `workflowStarts`, `recorded` (each needle: whether
the conversation records of that repository hold it), `commits` and `strayRequests` (requests to anything but the fake endpoint).

## A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON

### Recording off: a conversation that reads files, saves an edit and hands its task to CI leaves no message in any commit, commit message or job record

```json
{
  "given": "The instance does not record conversations. On a page of the product the person asks tooler (a model endpoint that can use tools), which reads SPEC.md, then asks for a change of the notes and saves the edit, then asks it to run the tests; the answer proposes handing the task to GitHub Actions, which goes on without a further click.",
  "input": {
    "recording": false,
    "page": "product",
    "replies": [
      {
        "calls": [
          {
            "id": "c1",
            "name": "read-file",
            "args": {
              "path": "SPEC.md"
            }
          }
        ]
      },
      {
        "answer": "NEEDLE-ANSWER-A I read the SPEC and found one rule."
      },
      {
        "answer": "NEEDLE-ANSWER-B here is the change to the notes."
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
        "send": "NEEDLE-ONE the export of my thesis fails",
        "to": "tooler"
      },
      {
        "send": "NEEDLE-TWO please change the notes",
        "to": "tooler"
      },
      {
        "save": {
          "path": "docs/notes.md",
          "text": "# Notes\n\nNew text.\n"
        }
      },
      {
        "send": "NEEDLE-THREE run the tests of the notes",
        "to": "tooler"
      },
      {
        "handOver": true
      }
    ],
    "needles": [
      "NEEDLE-ONE the export of my thesis fails",
      "NEEDLE-TWO please change the notes",
      "NEEDLE-THREE run the tests of the notes",
      "NEEDLE-ANSWER-A",
      "NEEDLE-ANSWER-B",
      "NEEDLE-ANSWER-C"
    ]
  },
  "expected": {
    "found": {
      "NEEDLE-ONE the export of my thesis fails": [],
      "NEEDLE-TWO please change the notes": [],
      "NEEDLE-THREE run the tests of the notes": [],
      "NEEDLE-ANSWER-A": [],
      "NEEDLE-ANSWER-B": [],
      "NEEDLE-ANSWER-C": []
    },
    "conversationFiles": {
      "instance": 0,
      "product": 0
    },
    "jobRecords": 1,
    "workflowStarts": 1,
    "strayRequests": 0
  }
}
```

### Counter-proof: a message planted in the job record of the hand-over is found

```json
{
  "given": "The case above, after which the first message is put into the job record of the hand-over.",
  "input": {
    "recording": false,
    "page": "product",
    "replies": [
      {
        "calls": [
          {
            "id": "c1",
            "name": "read-file",
            "args": {
              "path": "SPEC.md"
            }
          }
        ]
      },
      {
        "answer": "NEEDLE-ANSWER-A I read the SPEC and found one rule."
      },
      {
        "answer": "NEEDLE-ANSWER-B here is the change to the notes."
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
        "send": "NEEDLE-ONE the export of my thesis fails",
        "to": "tooler"
      },
      {
        "send": "NEEDLE-TWO please change the notes",
        "to": "tooler"
      },
      {
        "save": {
          "path": "docs/notes.md",
          "text": "# Notes\n\nNew text.\n"
        }
      },
      {
        "send": "NEEDLE-THREE run the tests of the notes",
        "to": "tooler"
      },
      {
        "handOver": true
      }
    ],
    "needles": [
      "NEEDLE-ONE the export of my thesis fails",
      "NEEDLE-TWO please change the notes",
      "NEEDLE-THREE run the tests of the notes",
      "NEEDLE-ANSWER-A",
      "NEEDLE-ANSWER-B",
      "NEEDLE-ANSWER-C"
    ],
    "plant": "NEEDLE-ONE the export of my thesis fails"
  },
  "expected": {
    "foundCount": {
      "NEEDLE-ONE the export of my thesis fails": 1,
      "NEEDLE-TWO please change the notes": 0,
      "NEEDLE-THREE run the tests of the notes": 0,
      "NEEDLE-ANSWER-A": 0,
      "NEEDLE-ANSWER-B": 0,
      "NEEDLE-ANSWER-C": 0
    },
    "jobRecords": 1
  }
}
```

## A RECORDED CONVERSATION IS KEPT WHERE IT WAS HELD

### Recording on, on a page of the product: each message is found in a conversation record of that product and in none of the instance's

```json
{
  "given": "The instance records conversations. The person and the participant exchange two messages each on a page of the product.",
  "input": {
    "recording": true,
    "page": "product",
    "replies": [
      {
        "answer": "NEEDLE-ANSWER-A the export needs a newer version."
      },
      {
        "answer": "NEEDLE-ANSWER-B the notes are unchanged."
      }
    ],
    "steps": [
      {
        "send": "NEEDLE-ONE the export of my thesis fails",
        "to": "tooler"
      },
      {
        "send": "NEEDLE-TWO and what about the notes",
        "to": "tooler"
      }
    ],
    "needles": [
      "NEEDLE-ONE the export of my thesis fails",
      "NEEDLE-ANSWER-A",
      "NEEDLE-TWO and what about the notes",
      "NEEDLE-ANSWER-B"
    ]
  },
  "expected": {
    "recorded": {
      "product": {
        "NEEDLE-ONE the export of my thesis fails": true,
        "NEEDLE-ANSWER-A": true,
        "NEEDLE-TWO and what about the notes": true,
        "NEEDLE-ANSWER-B": true
      },
      "instance": {
        "NEEDLE-ONE the export of my thesis fails": false,
        "NEEDLE-ANSWER-A": false,
        "NEEDLE-TWO and what about the notes": false,
        "NEEDLE-ANSWER-B": false
      }
    },
    "conversationFiles": {
      "instance": 0,
      "product": 1
    },
    "conversationPaths": {
      "instance": true,
      "product": true
    },
    "strayRequests": 0
  }
}
```

### Recording on, on a page of the instance: each message is found in a conversation record of the instance and in none of the product's

```json
{
  "given": "The instance records conversations. The same exchange on a page of the instance itself.",
  "input": {
    "recording": true,
    "page": "instance",
    "replies": [
      {
        "answer": "NEEDLE-ANSWER-A the export needs a newer version."
      },
      {
        "answer": "NEEDLE-ANSWER-B the notes are unchanged."
      }
    ],
    "steps": [
      {
        "send": "NEEDLE-ONE the export of my thesis fails",
        "to": "tooler"
      },
      {
        "send": "NEEDLE-TWO and what about the notes",
        "to": "tooler"
      }
    ],
    "needles": [
      "NEEDLE-ONE the export of my thesis fails",
      "NEEDLE-ANSWER-A",
      "NEEDLE-TWO and what about the notes",
      "NEEDLE-ANSWER-B"
    ]
  },
  "expected": {
    "recorded": {
      "instance": {
        "NEEDLE-ONE the export of my thesis fails": true,
        "NEEDLE-ANSWER-A": true,
        "NEEDLE-TWO and what about the notes": true,
        "NEEDLE-ANSWER-B": true
      },
      "product": {
        "NEEDLE-ONE the export of my thesis fails": false,
        "NEEDLE-ANSWER-A": false,
        "NEEDLE-TWO and what about the notes": false,
        "NEEDLE-ANSWER-B": false
      }
    },
    "conversationFiles": {
      "instance": 1,
      "product": 0
    },
    "conversationPaths": {
      "instance": true,
      "product": true
    },
    "strayRequests": 0
  }
}
```

### Counter-proof: a message missing from the record is not found

```json
{
  "given": "The case of the product's page, after which the second message of the person is taken out of the record before it is looked at.",
  "input": {
    "recording": true,
    "page": "product",
    "replies": [
      {
        "answer": "NEEDLE-ANSWER-A the export needs a newer version."
      },
      {
        "answer": "NEEDLE-ANSWER-B the notes are unchanged."
      }
    ],
    "steps": [
      {
        "send": "NEEDLE-ONE the export of my thesis fails",
        "to": "tooler"
      },
      {
        "send": "NEEDLE-TWO and what about the notes",
        "to": "tooler"
      }
    ],
    "needles": [
      "NEEDLE-ONE the export of my thesis fails",
      "NEEDLE-ANSWER-A",
      "NEEDLE-TWO and what about the notes",
      "NEEDLE-ANSWER-B"
    ],
    "omit": "NEEDLE-TWO and what about the notes"
  },
  "expected": {
    "recorded": {
      "product": {
        "NEEDLE-ONE the export of my thesis fails": true,
        "NEEDLE-ANSWER-A": true,
        "NEEDLE-TWO and what about the notes": false,
        "NEEDLE-ANSWER-B": true
      },
      "instance": {
        "NEEDLE-ONE the export of my thesis fails": false,
        "NEEDLE-ANSWER-A": false,
        "NEEDLE-TWO and what about the notes": false,
        "NEEDLE-ANSWER-B": false
      }
    }
  }
}
```
