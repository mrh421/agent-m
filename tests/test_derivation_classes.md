# Derivation Class Cases

## classifier keeps participant classes and rule decisions

The precondition is that the existing artifacts hold `A SAMPLE RULE` and `A WRITE RULE`, and the input draft contains
one kept class of each participant class, one exact duplicate by rule and two candidates that state one new rule.

### Case

```json
{
  "input": {
    "kind": "classifier",
    "existing": [
      { "id": "A SAMPLE RULE", "keys": ["A SAMPLE RULE", "A reader reads a file whole."] },
      { "id": "A WRITE RULE", "keys": ["A WRITE RULE", "A writer writes a file whole."] }
    ],
    "candidates": [
      {
        "name": "A NEW RULE",
        "rule": "A reader keeps a trace.",
        "check": "no automatic check; at review",
        "constrains": "product",
        "passage": "ch. 1",
        "class": "new"
      },
      {
        "name": "A SAMPLE RULE UPDATE",
        "rule": "A reader reads a file whole, or says why not.",
        "check": "no automatic check; at review",
        "constrains": "product",
        "passage": "ch. 2",
        "class": "change",
        "of": "A SAMPLE RULE"
      },
      {
        "name": "RESTATES WRITE RULE",
        "rule": "A writer writes a file whole.",
        "check": "no automatic check; at review",
        "constrains": "product",
        "passage": "ch. 3",
        "class": "new"
      },
      {
        "name": "A NEW RULE AGAIN",
        "rule": "A reader keeps a trace.",
        "check": "no automatic check; at review",
        "constrains": "product",
        "passage": "ch. 4",
        "class": "new"
      },
      {
        "name": "A MODEL DUPLICATE",
        "rule": "",
        "check": "no automatic check; at review",
        "constrains": "product",
        "passage": "ch. 5",
        "class": "duplicate",
        "of": "A SAMPLE RULE"
      },
      {
        "name": "A CONFLICTING RULE",
        "rule": "A writer writes no files.",
        "check": "no automatic check; at review",
        "constrains": "product",
        "passage": "ch. 6",
        "class": "conflict",
        "of": "A WRITE RULE"
      }
    ]
  },
  "expected": {
    "classes": [
      {
        "refs": ["A NEW RULE", "A NEW RULE AGAIN"],
        "from": ["ch. 1", "ch. 4"],
        "class": "new",
        "of": null,
        "decidedBy": "participant"
      },
      {
        "refs": ["A SAMPLE RULE UPDATE"],
        "from": ["ch. 2"],
        "class": "change",
        "of": "A SAMPLE RULE",
        "decidedBy": "participant"
      },
      {
        "refs": ["RESTATES WRITE RULE"],
        "from": ["ch. 3"],
        "class": "duplicate",
        "of": "A WRITE RULE",
        "decidedBy": "rule"
      },
      {
        "refs": ["A MODEL DUPLICATE"],
        "from": ["ch. 5"],
        "class": "duplicate",
        "of": "A SAMPLE RULE",
        "decidedBy": "participant"
      },
      {
        "refs": ["A CONFLICTING RULE"],
        "from": ["ch. 6"],
        "class": "conflict",
        "of": "A WRITE RULE",
        "decidedBy": "participant"
      }
    ]
  }
}
```

## job runner classes are written as queue entries

The precondition is that the product SPEC holds `A SAMPLE RULE`, `ANOTHER SAMPLE RULE` and `A WRITE RULE`, and the job
runner receives a draft that already names the existing artifacts for its change, duplicate and conflict classes.

### Case

```json
{
  "input": {
    "kind": "job-runner-and-queue",
    "source": "SRC-fixture-book",
    "productSpec": "# Fixture product - Specification\n\n## 1. Reading\n\n**A SAMPLE RULE** *(Product Owner)*\nA reader reads a file whole.\n*Check:* `tests/sample.test.mjs`\n\n**ANOTHER SAMPLE RULE** *(Product Owner)*\nA reader sees the name of a file.\n*Check:* no automatic check; at review\n\n## 2. Writing\n\n**A WRITE RULE** *(Product Owner)*\nA writer writes a file whole.\n*Check:* no automatic check; at review\n",
    "candidates": [
      {
        "name": "A BETTER READING RULE",
        "rule": "A reader reads a file whole, or says why not.",
        "check": "`tests/better.test.mjs`",
        "constrains": "product",
        "passage": "ch. 8",
        "class": "change",
        "of": "A SAMPLE RULE"
      },
      {
        "name": "RESTATES THE WRITE RULE",
        "rule": "A writer writes a file whole.",
        "check": "no automatic check; at review",
        "constrains": "product",
        "passage": "ch. 9",
        "class": "duplicate",
        "of": "A WRITE RULE"
      },
      {
        "name": "A WRITER NAMES ITS FILE",
        "rule": "A writer names the file it wrote.",
        "check": "no automatic check; at review",
        "constrains": "product",
        "passage": "ch. 8",
        "class": "new"
      },
      {
        "name": "CONTRADICTS ANOTHER",
        "rule": "A reader sees nothing.",
        "check": "no automatic check; at review",
        "constrains": "product",
        "passage": "ch. 10",
        "class": "conflict",
        "of": "ANOTHER SAMPLE RULE"
      }
    ]
  },
  "expected": {
    "run": {
      "stoppedBecause": "passed",
      "remaining": [],
      "classes": [
        {
          "refs": ["A BETTER READING RULE"],
          "from": ["ch. 8"],
          "class": "change",
          "of": "A SAMPLE RULE",
          "decidedBy": "participant"
        },
        {
          "refs": ["RESTATES THE WRITE RULE"],
          "from": ["ch. 9"],
          "class": "duplicate",
          "of": "A WRITE RULE",
          "decidedBy": "rule"
        },
        {
          "refs": ["A WRITER NAMES ITS FILE"],
          "from": ["ch. 8"],
          "class": "new",
          "of": null,
          "decidedBy": "participant"
        },
        {
          "refs": ["CONTRADICTS ANOTHER"],
          "from": ["ch. 10"],
          "class": "conflict",
          "of": "ANOTHER SAMPLE RULE",
          "decidedBy": "participant"
        }
      ]
    },
    "writer": {
      "productCommits": 1,
      "instanceCommits": 0,
      "sections": [
        {
          "name": "01-reading.md",
          "text": "## 1. Reading\n\n**A SAMPLE RULE** *(Product Owner; SRC-fixture-book, ch. 8)*\nA reader reads a file whole, or says why not.\n*Check:* `tests/better.test.mjs`\n\n**ANOTHER SAMPLE RULE** *(Product Owner)*\nA reader sees the name of a file.\n*Check:* no automatic check; at review\n\n"
        },
        {
          "name": "01-writing.md",
          "text": "## 2. Writing\n\n**A WRITE RULE** *(Product Owner; SRC-fixture-book, ch. 9)*\nA writer writes a file whole.\n*Check:* no automatic check; at review\n\n**A WRITER NAMES ITS FILE** *(SRC-fixture-book, ch. 8)*\nA writer names the file it wrote.\n*Check:* no automatic check; at review\n"
        }
      ],
      "notes": [],
      "conflictWritten": false
    }
  }
}
```

## architecture files are classed by their format keys

The precondition is that the architecture already shows decisions by their titles and modules by their identifiers. The
draft contains decision and module files that are new, changed, duplicates, conflicts and two new module files with the
same identifier; a decision that keeps the title of the decision it changes and a module changed under its own identifier,
which keep the class change; and a module file with the identifier of another existing module, a duplicate of it, decided
by rule.

### Case

```json
{
  "input": {
    "kind": "architecture-classes",
    "existing": [
      { "id": "ARC-001", "keys": ["Static client"] },
      { "id": "MOD-reader", "keys": ["MOD-reader"] },
      { "id": "ARC-002", "keys": ["Fixed layout"] },
      { "id": "MOD-store", "keys": ["MOD-store"] },
      { "id": "MOD-index", "keys": ["MOD-index"] }
    ],
    "files": [
      {
        "path": "docs/architecture/ARC-010-new-shape.md",
        "text": "---\nid: ARC-010\ntitle: New shape\nforced_by:\n  - UC-001\n---\n# ARC-010 New shape\n\n## Context\n\nx\n\n## Decision\n\nx\n\n## Alternatives\n\nx\n\n## Consequences\n\nx\n",
        "class": "new"
      },
      {
        "path": "docs/architecture/ARC-011-static-client-copy.md",
        "text": "---\nid: ARC-011\ntitle: Static client\nforced_by:\n  - UC-001\n---\n# ARC-011 Static client\n\n## Context\n\nx\n\n## Decision\n\nx\n\n## Alternatives\n\nx\n\n## Consequences\n\nx\n",
        "class": "duplicate",
        "of": "ARC-001"
      },
      {
        "path": "docs/architecture/ARC-012-static-client-cache.md",
        "text": "---\nid: ARC-012\ntitle: Static client with cache\nforced_by:\n  - UC-001\n---\n# ARC-012 Static client with cache\n\n## Context\n\nx\n\n## Decision\n\nx\n\n## Alternatives\n\nx\n\n## Consequences\n\nx\n",
        "class": "change",
        "of": "ARC-001"
      },
      {
        "path": "docs/architecture/ARC-013-no-static-client.md",
        "text": "---\nid: ARC-013\ntitle: No static client\nforced_by:\n  - UC-001\n---\n# ARC-013 No static client\n\n## Context\n\nx\n\n## Decision\n\nx\n\n## Alternatives\n\nx\n\n## Consequences\n\nx\n",
        "class": "conflict",
        "of": "ARC-001"
      },
      {
        "path": "docs/architecture/MOD-reader-copy.md",
        "text": "---\nid: MOD-reader\ntitle: Reader copy\nfolder: src/reader-copy/\nrealises:\n  - UC-001\nfollows:\n  - ARC-001\nuses: []\nprovides:\n  - readFile\n---\n# MOD-reader Reader copy\n\n## Responsibility\n\nx\n\n## Parts\n\nx\n\n## Data\n\nx\n\n## Interfaces\n\nx\n\n## Files\n\nx\n\n## Uses\n\nx\n",
        "class": "duplicate",
        "of": "MOD-reader"
      },
      {
        "path": "docs/architecture/MOD-writer.md",
        "text": "---\nid: MOD-writer\ntitle: Writer\nfolder: src/writer/\nrealises:\n  - UC-001\nfollows:\n  - ARC-001\nuses: []\nprovides:\n  - writeFile\n---\n# MOD-writer Writer\n\n## Responsibility\n\nx\n\n## Parts\n\nx\n\n## Data\n\nx\n\n## Interfaces\n\nx\n\n## Files\n\nx\n\n## Uses\n\nx\n",
        "class": "change",
        "of": "MOD-reader"
      },
      {
        "path": "docs/architecture/MOD-cache-a.md",
        "text": "---\nid: MOD-cache\ntitle: Cache A\nfolder: src/cache-a/\nrealises:\n  - UC-001\nfollows:\n  - ARC-001\nuses: []\nprovides:\n  - cache\n---\n# MOD-cache Cache A\n\n## Responsibility\n\nx\n\n## Parts\n\nx\n\n## Data\n\nx\n\n## Interfaces\n\nx\n\n## Files\n\nx\n\n## Uses\n\nx\n",
        "class": "new"
      },
      {
        "path": "docs/architecture/MOD-cache-b.md",
        "text": "---\nid: MOD-cache\ntitle: Cache B\nfolder: src/cache-b/\nrealises:\n  - UC-001\nfollows:\n  - ARC-001\nuses: []\nprovides:\n  - cache\n---\n# MOD-cache Cache B\n\n## Responsibility\n\nx\n\n## Parts\n\nx\n\n## Data\n\nx\n\n## Interfaces\n\nx\n\n## Files\n\nx\n\n## Uses\n\nx\n",
        "class": "new"
      },
      {
        "path": "docs/architecture/ARC-014-fixed-layout-kept.md",
        "text": "---\nid: ARC-014\ntitle: Fixed layout\nforced_by:\n  - UC-001\n---\n# ARC-014 Fixed layout\n\n## Context\n\nx\n\n## Decision\n\nx\n\n## Alternatives\n\nx\n\n## Consequences\n\nx\n",
        "class": "change",
        "of": "ARC-002"
      },
      {
        "path": "docs/architecture/MOD-store-changed.md",
        "text": "---\nid: MOD-store\ntitle: Store changed\nfolder: src/store/\nrealises:\n  - UC-001\nfollows:\n  - ARC-001\nuses: []\nprovides:\n  - save\n---\n# MOD-store Store changed\n\n## Responsibility\n\nx\n\n## Parts\n\nx\n\n## Data\n\nx\n\n## Interfaces\n\nx\n\n## Files\n\nx\n\n## Uses\n\nx\n",
        "class": "change",
        "of": "MOD-store"
      },
      {
        "path": "docs/architecture/MOD-index-again.md",
        "text": "---\nid: MOD-index\ntitle: Index again\nfolder: src/index-again/\nrealises:\n  - UC-001\nfollows:\n  - ARC-001\nuses: []\nprovides:\n  - find\n---\n# MOD-index Index again\n\n## Responsibility\n\nx\n\n## Parts\n\nx\n\n## Data\n\nx\n\n## Interfaces\n\nx\n\n## Files\n\nx\n\n## Uses\n\nx\n",
        "class": "duplicate",
        "of": "MOD-index"
      }
    ]
  },
  "expected": {
    "stoppedBecause": "passed",
    "remaining": [],
    "classes": [
      {
        "refs": ["docs/architecture/ARC-010-new-shape.md"],
        "from": ["docs/architecture/ARC-010-new-shape.md"],
        "class": "new",
        "of": null,
        "decidedBy": "participant"
      },
      {
        "refs": ["docs/architecture/ARC-011-static-client-copy.md"],
        "from": ["docs/architecture/ARC-011-static-client-copy.md"],
        "class": "duplicate",
        "of": "ARC-001",
        "decidedBy": "rule"
      },
      {
        "refs": ["docs/architecture/ARC-012-static-client-cache.md"],
        "from": ["docs/architecture/ARC-012-static-client-cache.md"],
        "class": "change",
        "of": "ARC-001",
        "decidedBy": "participant"
      },
      {
        "refs": ["docs/architecture/ARC-013-no-static-client.md"],
        "from": ["docs/architecture/ARC-013-no-static-client.md"],
        "class": "conflict",
        "of": "ARC-001",
        "decidedBy": "participant"
      },
      {
        "refs": ["docs/architecture/ARC-014-fixed-layout-kept.md"],
        "from": ["docs/architecture/ARC-014-fixed-layout-kept.md"],
        "class": "change",
        "of": "ARC-002",
        "decidedBy": "participant"
      },
      {
        "refs": ["docs/architecture/MOD-reader-copy.md"],
        "from": ["docs/architecture/MOD-reader-copy.md"],
        "class": "duplicate",
        "of": "MOD-reader",
        "decidedBy": "rule"
      },
      {
        "refs": ["docs/architecture/MOD-writer.md"],
        "from": ["docs/architecture/MOD-writer.md"],
        "class": "change",
        "of": "MOD-reader",
        "decidedBy": "participant"
      },
      {
        "refs": ["docs/architecture/MOD-cache-a.md", "docs/architecture/MOD-cache-b.md"],
        "from": ["docs/architecture/MOD-cache-a.md", "docs/architecture/MOD-cache-b.md"],
        "class": "new",
        "of": null,
        "decidedBy": "participant"
      },
      {
        "refs": ["docs/architecture/MOD-store-changed.md"],
        "from": ["docs/architecture/MOD-store-changed.md"],
        "class": "change",
        "of": "MOD-store",
        "decidedBy": "participant"
      },
      {
        "refs": ["docs/architecture/MOD-index-again.md"],
        "from": ["docs/architecture/MOD-index-again.md"],
        "class": "duplicate",
        "of": "MOD-index",
        "decidedBy": "rule"
      }
    ]
  }
}
```
