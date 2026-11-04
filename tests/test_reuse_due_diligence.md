# Reuse Due Diligence Cases

## chosen candidate and alternative carry fetched facts

kind: step

### Precondition

The product has an MIT `LICENSE`; the draft architecture decision names one chosen npm package and one npm alternative;
fixture registry responses and source-repository issue counts are available for both candidates.

### Input

```json
{
  "path": "docs/architecture/ARC-910-reuse-helper.md",
  "license": "MIT License\n",
  "read": "2026-10-13",
  "routes": {
    "https://registry.npmjs.org/left-pad": {
      "license": "MIT",
      "dist-tags": { "latest": "1.2.0" },
      "versions": { "1.0.0": {}, "1.2.0": {} },
      "time": {
        "1.0.0": "2020-01-02T00:00:00.000Z",
        "1.2.0": "2022-04-01T00:00:00.000Z"
      }
    },
    "https://api.npmjs.org/downloads/point/last-month/left-pad": { "downloads": 1234 },
    "https://registry.npmjs.org/copyleft-lib": {
      "license": "GPL-3.0",
      "dist-tags": { "latest": "0.2.0" },
      "versions": { "0.1.0": {}, "0.2.0": {} },
      "time": {
        "0.1.0": "2022-01-01T00:00:00.000Z",
        "0.2.0": "2024-01-01T00:00:00.000Z"
      }
    },
    "https://api.npmjs.org/downloads/point/last-month/copyleft-lib": { "downloads": 11 }
  },
  "issue_counts": {
    "https://github.com/acme/left-pad": { "open": 2, "closed": 5 },
    "https://github.com/acme/copyleft-lib": { "open": 4, "closed": 6 }
  }
}
```

### Draft

```markdown
---
id: ARC-910
title: Reuse helper
forced_by:
  - A REUSE DECISION RECORDS ITS DUE DILIGENCE
---
# ARC-910 Reuse helper

## Context

The architecture needs a reused helper.

## Decision

| Candidate | Ecosystem | Repository | Role |
|---|---|---|---|
| left-pad | npm | https://github.com/acme/left-pad | chosen |

## Alternatives

| Candidate | Ecosystem | Repository |
|---|---|---|
| copyleft-lib | npm | https://github.com/acme/copyleft-lib |

## Consequences

The chosen package is reused.
```

### Expected Result

```json
{
  "rows": [
    {
      "Candidate": "left-pad (npm) - chosen",
      "Licence": "MIT",
      "Compatible with the product's licence": "yes",
      "First release": "1.0.0 on 2020-01-02",
      "Latest release": "1.2.0 on 2022-04-01",
      "Releases": "2",
      "Open / closed issues": "2 / 5",
      "Adoption": "1234 downloads last month",
      "Read from": "https://registry.npmjs.org/left-pad, https://github.com/acme/left-pad, https://api.npmjs.org/downloads/point/last-month/left-pad",
      "Read on": "2026-10-13"
    },
    {
      "Candidate": "copyleft-lib (npm)",
      "Licence": "GPL-3.0",
      "Compatible with the product's licence": "not known to be compatible",
      "First release": "0.1.0 on 2022-01-01",
      "Latest release": "0.2.0 on 2024-01-01",
      "Releases": "2",
      "Open / closed issues": "4 / 6",
      "Adoption": "11 downloads last month",
      "Read from": "https://registry.npmjs.org/copyleft-lib, https://github.com/acme/copyleft-lib, https://api.npmjs.org/downloads/point/last-month/copyleft-lib",
      "Read on": "2026-10-13"
    }
  ],
  "findings": [],
  "fetches": [
    "https://registry.npmjs.org/left-pad",
    "https://api.npmjs.org/downloads/point/last-month/left-pad",
    "https://registry.npmjs.org/copyleft-lib",
    "https://api.npmjs.org/downloads/point/last-month/copyleft-lib"
  ],
  "connections": [
    "https://github.com/acme/left-pad",
    "https://github.com/acme/copyleft-lib"
  ]
}
```

## product without LICENSE leaves every licence not checked

kind: step

### Precondition

The product snapshot has no `LICENSE`; the draft architecture decision names one chosen MIT npm candidate and one
GPL-3.0 npm alternative; fixture registry and repository facts are available for both candidates.

### Input

```json
{
  "path": "docs/architecture/ARC-911-unlicensed-product.md",
  "read": "2026-10-13",
  "routes": {
    "https://registry.npmjs.org/left-pad": {
      "license": "MIT",
      "dist-tags": { "latest": "1.0.0" },
      "versions": { "1.0.0": {} },
      "time": { "1.0.0": "2020-01-02T00:00:00.000Z" }
    },
    "https://api.npmjs.org/downloads/point/last-month/left-pad": { "downloads": 1234 },
    "https://registry.npmjs.org/copyleft-lib": {
      "license": "GPL-3.0",
      "dist-tags": { "latest": "0.2.0" },
      "versions": { "0.2.0": {} },
      "time": { "0.2.0": "2024-01-01T00:00:00.000Z" }
    },
    "https://api.npmjs.org/downloads/point/last-month/copyleft-lib": { "downloads": 11 }
  },
  "issue_counts": {
    "https://github.com/acme/left-pad": { "open": 2, "closed": 5 },
    "https://github.com/acme/copyleft-lib": { "open": 4, "closed": 6 }
  }
}
```

### Draft

```markdown
---
id: ARC-911
title: Unlicensed product
forced_by:
  - A PRODUCT DECLARES ITS LICENCE
---
# ARC-911 Unlicensed product

## Context

The architecture needs a reused helper.

## Decision

| Candidate | Ecosystem | Repository | Role |
|---|---|---|---|
| left-pad | npm | https://github.com/acme/left-pad | chosen |

## Alternatives

| Candidate | Ecosystem | Repository |
|---|---|---|
| copyleft-lib | npm | https://github.com/acme/copyleft-lib |

## Consequences

The chosen package is reused.
```

### Expected Result

```json
{
  "rows": [
    {
      "Candidate": "left-pad (npm) - chosen",
      "Licence": "MIT",
      "Compatible with the product's licence": "not checked",
      "First release": "1.0.0 on 2020-01-02",
      "Latest release": "1.0.0 on 2020-01-02",
      "Releases": "1",
      "Open / closed issues": "2 / 5",
      "Adoption": "1234 downloads last month",
      "Read from": "https://registry.npmjs.org/left-pad, https://github.com/acme/left-pad, https://api.npmjs.org/downloads/point/last-month/left-pad",
      "Read on": "2026-10-13"
    },
    {
      "Candidate": "copyleft-lib (npm)",
      "Licence": "GPL-3.0",
      "Compatible with the product's licence": "not checked",
      "First release": "0.2.0 on 2024-01-01",
      "Latest release": "0.2.0 on 2024-01-01",
      "Releases": "1",
      "Open / closed issues": "4 / 6",
      "Adoption": "11 downloads last month",
      "Read from": "https://registry.npmjs.org/copyleft-lib, https://github.com/acme/copyleft-lib, https://api.npmjs.org/downloads/point/last-month/copyleft-lib",
      "Read on": "2026-10-13"
    }
  ],
  "findings": [],
  "fetches": [
    "https://registry.npmjs.org/left-pad",
    "https://api.npmjs.org/downloads/point/last-month/left-pad",
    "https://registry.npmjs.org/copyleft-lib",
    "https://api.npmjs.org/downloads/point/last-month/copyleft-lib"
  ],
  "connections": [
    "https://github.com/acme/left-pad",
    "https://github.com/acme/copyleft-lib"
  ]
}
```

## candidate not in registry is reported as not found

kind: step

### Precondition

The product has an MIT `LICENSE`; the draft architecture decision names a chosen npm candidate for which the fixture
registry has no package record.

### Input

```json
{
  "path": "docs/architecture/ARC-912-missing-helper.md",
  "license": "MIT License\n",
  "read": "2026-10-13",
  "routes": {},
  "issue_counts": {}
}
```

### Draft

```markdown
---
id: ARC-912
title: Missing helper
forced_by:
  - DUE DILIGENCE IS FETCHED, NOT RECALLED
---
# ARC-912 Missing helper

## Context

The architecture needs a reused helper.

## Decision

| Candidate | Ecosystem | Repository | Role |
|---|---|---|---|
| missing-lib | npm |  | chosen |

## Alternatives

| Candidate | Ecosystem | Repository |
|---|---|---|

## Consequences

The chosen package is reused.
```

### Expected Result

```json
{
  "rows": [
    {
      "Candidate": "missing-lib (npm) - chosen",
      "Licence": "not found - the name may be invented",
      "Compatible with the product's licence": "not checked",
      "First release": "-",
      "Latest release": "-",
      "Releases": "-",
      "Open / closed issues": "-",
      "Adoption": "-",
      "Read from": "https://registry.npmjs.org/missing-lib",
      "Read on": "2026-10-13"
    }
  ],
  "findings": [
    {
      "artifact": "docs/architecture/ARC-912-missing-helper.md",
      "line": 17,
      "kind": "warning",
      "rule": "DUE DILIGENCE IS FETCHED, NOT RECALLED",
      "what": "missing-lib was not found at https://registry.npmjs.org/missing-lib",
      "fix": "check the candidate's name or choose another candidate"
    }
  ],
  "fetches": [
    "https://registry.npmjs.org/missing-lib"
  ],
  "connections": []
}
```

## record row missing address or date is detected

kind: record

### Precondition

An architecture decision already holds a due-diligence table; one candidate row lacks the address read and another lacks
the date read.

### Input

```json
{
  "path": "docs/architecture/ARC-913-broken-record.md"
}
```

### Record

```markdown
# ARC-913 Broken record

## Due diligence

Product licence: MIT.

| Candidate | Licence | Compatible with the product's licence | First release | Latest release | Releases | Open / closed issues | Adoption | Read from | Read on |
|---|---|---|---|---|---|---|---|---|---|
| left-pad (npm) - chosen | MIT | yes | 1.0.0 on 2020-01-02 | 1.2.0 on 2022-04-01 | 2 | 2 / 5 | 1234 downloads last month | - | 2026-10-13 |
| copyleft-lib (npm) | GPL-3.0 | not known to be compatible | 0.1.0 on 2022-01-01 | 0.2.0 on 2024-01-01 | 2 | 4 / 6 | 11 downloads last month | https://registry.npmjs.org/copyleft-lib | - |
```

### Expected Result

```json
{
  "findings": [
    {
      "artifact": "docs/architecture/ARC-913-broken-record.md",
      "line": 9,
      "kind": "error",
      "rule": "DUE DILIGENCE IS FETCHED, NOT RECALLED",
      "what": "left-pad (npm) - chosen has a due-diligence fact row without Read from",
      "fix": "record the registry or repository address read"
    },
    {
      "artifact": "docs/architecture/ARC-913-broken-record.md",
      "line": 10,
      "kind": "error",
      "rule": "DUE DILIGENCE IS FETCHED, NOT RECALLED",
      "what": "copyleft-lib (npm) has a due-diligence fact row without Read on",
      "fix": "record the date the fact was read"
    }
  ]
}
```

## written record passes the record check and an emptied fact fails it

kind: step-record

from: chosen candidate and alternative carry fetched facts

### Precondition

The step case named in `from` has written its due-diligence section into the draft; the record check reads that written
text. Then one cell of the written table is emptied at a time: first the date read of the chosen candidate's row, then
the address read of the alternative's row.

### Input

```json
{
  "mutations": [
    { "row": 0, "column": "Read on" },
    { "row": 1, "column": "Read from" }
  ]
}
```

### Expected Result

```json
{
  "written_findings": [],
  "mutated_findings": [
    [
      {
        "artifact": "docs/architecture/ARC-910-reuse-helper.md",
        "line": 31,
        "kind": "error",
        "rule": "DUE DILIGENCE IS FETCHED, NOT RECALLED",
        "what": "left-pad (npm) - chosen has a due-diligence fact row without Read on",
        "fix": "record the date the fact was read"
      }
    ],
    [
      {
        "artifact": "docs/architecture/ARC-910-reuse-helper.md",
        "line": 32,
        "kind": "error",
        "rule": "DUE DILIGENCE IS FETCHED, NOT RECALLED",
        "what": "copyleft-lib (npm) has a due-diligence fact row without Read from",
        "fix": "record the registry or repository address read"
      }
    ]
  ]
}
```
