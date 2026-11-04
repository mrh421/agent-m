# Issue To Specification Release Cases

The cases of `tests/test_issue_to_spec.py`, for the requirement `EVOLUTION ENTERS THROUGH THE SPECIFICATION` (SPEC.md): "An issue that changes behaviour — on
GitHub or on the product's GitLab server — becomes a specification change first and a code change second." UC-012 gives the order in step 6, which "writes them
as entries under `docs/spec-freigaben/`, each naming the issue", and in its postcondition, "A change is in the specification before any code implements it, and the
accepted entry names the issue it came from." The cases check the side of that order that precedes the queue's acceptance: the change leaves the issue as a queue,
nothing else is committed, and no fix is offered for it. On a GitLab server the class of the issue is checked over a fake fetch, and the queue is written and checked over a fake GitLab server that serves the project, the issue and GitLab's commit API.

**How a case reads.** `given` is its precondition. `input` holds the issues of the product `alice/product` (`issues`: the number and the labels of each),
the number of the page opened (`issue`), the person's steps in order (`class`: the click on a class of the issue; `draft`: the participant drafts the
change and the person saves it), and the candidates the fake participant answers (`candidates`). `expected` names only what the case asserts, out of:
`labels` and `state` (the issue at the end), `issueWrites` (the writes made to the issue), `committed` (every path committed to the product),
`outsideDocs` (those of them that do not lie under `docs/`, which are code or tests), `queueNames` (the issue named by the line `**Issue:** #<number> of <product address>` in the rationale of each entry),
`queueHolds` (each of the case's `needles`: whether an entry of a queue holds it), `jobKinds` (the kind of each job record committed), and `changeSection` and `fixSection` (whether the page
offers the section that drafts the change and the one that fixes a bug). A case with `server` `gitlab` in its `input` runs the product on the fake GitLab server (its `issues` hold the one issue) and
may state `unserved` (the requests of the project's API the fake did not serve). The class case on a GitLab server has `input` `issue` and `cls` (the class clicked) and `expected` `writes`
(every request that is not a read, the project's path left out) and `requests` (how many requests the server received).

## EVOLUTION ENTERS THROUGH THE SPECIFICATION - a change is written as a queue naming the issue

### The saved draft of a change is a queue naming the issue and holding the new requirement

```json
{
  "given": "The issue 7 of the product is labelled change. The product links the person's source. The participant answers a new requirement; the person runs the draft and saves it.",
  "input": {
    "issues": [{ "number": 7, "labels": ["change"] }],
    "issue": 7,
    "needles": ["EVERY EXPORT KEEPS ALL PAGES"],
    "steps": [{ "draft": true }],
    "candidates": [
      { "name": "EVERY EXPORT KEEPS ALL PAGES", "rule": "An export holds every page of the document.", "check": "tests/unit.test.mjs", "constrains": "product", "passage": "the export is cut off after the second page", "class": "new" }
    ]
  },
  "expected": {
    "queueNames": ["#7 of https://github.com/alice/product"],
    "queueHolds": { "EVERY EXPORT KEEPS ALL PAGES": true },
    "outsideDocs": [],
    "jobKinds": ["change-requirements"],
    "state": "open",
    "fixSection": false
  }
}
```

## EVOLUTION ENTERS THROUGH THE SPECIFICATION - a change is written as a queue on a GitLab server

### The saved draft of a change on a GitLab product is a queue naming the issue and holding the new requirement

```json
{
  "given": "The product is on a GitLab server and its issue 7 is labelled change. The product links the person's source. The participant answers a new requirement; the person runs the draft and saves it.",
  "input": {
    "server": "gitlab",
    "issues": [{ "number": 7, "labels": ["change"] }],
    "issue": 7,
    "needles": ["EVERY EXPORT KEEPS ALL PAGES"],
    "steps": [{ "draft": true }],
    "candidates": [
      { "name": "EVERY EXPORT KEEPS ALL PAGES", "rule": "An export holds every page of the document.", "check": "tests/unit.test.mjs", "constrains": "product", "passage": "the export is cut off after the second page", "class": "new" }
    ]
  },
  "expected": {
    "queueNames": ["#7 of https://gitlab.example.org/space/release-tool"],
    "queueHolds": { "EVERY EXPORT KEEPS ALL PAGES": true },
    "outsideDocs": [],
    "jobKinds": ["change-requirements"],
    "state": "open",
    "issueWrites": [],
    "fixSection": false,
    "unserved": []
  }
}
```

## EVOLUTION ENTERS THROUGH THE SPECIFICATION - the code is not changed by a change

### An issue classed as a change by a click offers the draft of the change and no fix, and commits nothing

```json
{
  "given": "The issue 5 has no class. The person clicks Change.",
  "input": {
    "issues": [{ "number": 5, "labels": [] }],
    "issue": 5,
    "steps": [{ "class": "change" }],
    "candidates": []
  },
  "expected": {
    "labels": ["change"],
    "committed": [],
    "changeSection": true,
    "fixSection": false
  }
}
```

### A bug offers the fix and not the change - the known positive of the sections

```json
{
  "given": "The issue 6 is labelled defect.",
  "input": {
    "issues": [{ "number": 6, "labels": ["defect"] }],
    "issue": 6,
    "steps": [],
    "candidates": []
  },
  "expected": {
    "changeSection": false,
    "fixSection": true
  }
}
```

## EVOLUTION ENTERS THROUGH THE SPECIFICATION - on a GitLab server

### The class change on a GitLab server is one edit of the issue's labels and nothing else

```json
{
  "given": "The product is on a GitLab server. The person clicks Change on its issue 7.",
  "input": {
    "issue": 7,
    "cls": "change"
  },
  "expected": {
    "writes": ["PUT /issues/7 {\"add_labels\":\"change\",\"remove_labels\":\"defect,not-reproducible\"}"],
    "requests": 1
  }
}
```
