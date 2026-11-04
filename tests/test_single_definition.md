# Single Definition Cases

The cases of `tests/test_single_definition.py`: SPEC.md's check of ONE DEFINITION, THREE DRIVERS and THE BRIDGE IS BUILT FROM THE DASHBOARD'S CODE. Each case states what is given, what is done (`input`) and what is expected. A case named Counter-proof plants a fault in an in-memory copy of the tree (`plant`) and shows that the check names it.

## ONE DEFINITION, THREE DRIVERS

### Prompts and schemas appear in no driver's code

```json
{
  "given": "The files of src/ and docs/assets/; the prompts, the schemas and the answer schemas of the catalogue.",
  "input": {
    "kind": "in-code",
    "roots": [
      "src",
      "docs/assets"
    ],
    "minLength": 50
  },
  "expected": {
    "found": [],
    "textsLookedAt": true,
    "definitionFiles": true
  }
}
```

### Counter-proof: a sentence of a prompt copied into the workflow template is found

```json
{
  "given": "The same, with the first sentence of the prompt of converse of 50 characters or more added to src/runtimes/workflow/github.yml.",
  "input": {
    "kind": "in-code",
    "roots": [
      "src",
      "docs/assets"
    ],
    "minLength": 50,
    "plant": [
      {
        "path": "src/runtimes/workflow/github.yml",
        "copyOf": {
          "file": "src/job-catalogue/kinds/converse/prompt.md",
          "unit": 0
        },
        "minLength": 50
      }
    ]
  },
  "expected": {
    "found": [
      "src/job-catalogue/kinds/converse/prompt.md -> src/runtimes/workflow/github.yml"
    ]
  }
}
```

### Counter-proof: a string of an answer schema copied into the dashboard's code is found

```json
{
  "given": "The same, with the longest part of 50 characters or more of the answer schema of propose-items (the whole of it) added to src/site-frame/dashboard-app.mjs.",
  "input": {
    "kind": "in-code",
    "roots": [
      "src",
      "docs/assets"
    ],
    "minLength": 50,
    "expectHas": [
      "src/job-catalogue/kinds/propose-items/answer.schema.json -> src/site-frame/dashboard-app.mjs"
    ],
    "plant": [
      {
        "path": "src/site-frame/dashboard-app.mjs",
        "copyOf": {
          "file": "src/job-catalogue/kinds/propose-items/answer.schema.json",
          "unit": 0
        },
        "minLength": 50
      }
    ]
  },
  "expected": {
    "foundHas": {
      "src/job-catalogue/kinds/propose-items/answer.schema.json -> src/site-frame/dashboard-app.mjs": true
    }
  }
}
```

### Counter-proof: a sentence of a schema copied into the Bridge's code is found

```json
{
  "given": "The same, with the first sentence of 50 characters or more of the schema of the participant register added to src/desktop-shell/compose.mjs.",
  "input": {
    "kind": "in-code",
    "roots": [
      "src",
      "docs/assets"
    ],
    "minLength": 50,
    "plant": [
      {
        "path": "src/desktop-shell/compose.mjs",
        "copyOf": {
          "file": "src/participant-list/participants.schema.md",
          "unit": 0
        },
        "minLength": 50
      }
    ]
  },
  "expected": {
    "found": [
      "src/participant-list/participants.schema.md -> src/desktop-shell/compose.mjs"
    ]
  }
}
```

### No whole prompt, schema or job definition stands in a second file

```json
{
  "given": "The files of src/ and docs/assets/; the prompts, the schemas, the answer schemas and the job definitions of the catalogue.",
  "input": {
    "kind": "more-than-once",
    "roots": [
      "src",
      "docs/assets"
    ]
  },
  "expected": {
    "prompt": [],
    "schema": [],
    "definition": [],
    "textsLookedAt": true
  }
}
```

### Counter-proof: a prompt copied whole to another path is found

```json
{
  "given": "The same, with the prompt of converse copied whole to docs/assets/converse-prompt.md.",
  "input": {
    "kind": "more-than-once",
    "roots": [
      "src",
      "docs/assets"
    ],
    "plant": [
      {
        "path": "docs/assets/converse-prompt.md",
        "copyFile": "src/job-catalogue/kinds/converse/prompt.md"
      }
    ]
  },
  "expected": {
    "prompt": [
      "src/job-catalogue/kinds/converse/prompt.md -> docs/assets/converse-prompt.md"
    ],
    "schema": [],
    "definition": []
  }
}
```

### Counter-proof: a schema copied whole to another path is found

```json
{
  "given": "The same, with the schema of the participant register copied whole to src/desktop-shell/participants-copy.md.",
  "input": {
    "kind": "more-than-once",
    "roots": [
      "src",
      "docs/assets"
    ],
    "plant": [
      {
        "path": "src/desktop-shell/participants-copy.md",
        "copyFile": "src/participant-list/participants.schema.md"
      }
    ]
  },
  "expected": {
    "prompt": [],
    "schema": [
      "src/participant-list/participants.schema.md -> src/desktop-shell/participants-copy.md"
    ],
    "definition": []
  }
}
```

### Counter-proof: an answer schema copied whole to another path is found

```json
{
  "given": "The same, with the answer schema of propose-items copied whole to docs/assets/answer.json.",
  "input": {
    "kind": "more-than-once",
    "roots": [
      "src",
      "docs/assets"
    ],
    "plant": [
      {
        "path": "docs/assets/answer.json",
        "copyFile": "src/job-catalogue/kinds/propose-items/answer.schema.json"
      }
    ]
  },
  "expected": {
    "schema": [
      "src/job-catalogue/kinds/propose-items/answer.schema.json -> docs/assets/answer.json"
    ]
  }
}
```

### Counter-proof: a job definition copied whole to another path is found

```json
{
  "given": "The same, with the kind.md of implement copied whole to docs/assets/implement.md.",
  "input": {
    "kind": "more-than-once",
    "roots": [
      "src",
      "docs/assets"
    ],
    "plant": [
      {
        "path": "docs/assets/implement.md",
        "copyFile": "src/job-catalogue/kinds/implement/kind.md"
      }
    ]
  },
  "expected": {
    "definition": [
      "src/job-catalogue/kinds/implement/kind.md -> docs/assets/implement.md"
    ]
  }
}
```

## THE BRIDGE IS BUILT FROM THE DASHBOARD'S CODE

### Each job definition exists once

```json
{
  "given": "The catalogue's kinds.md and its folder of kinds.",
  "input": {
    "kind": "definitions",
    "roots": [
      "src",
      "docs/assets"
    ]
  },
  "expected": {
    "kinds": 27,
    "listedOnce": true,
    "namedLikeItsFolder": true,
    "duplicates": [],
    "elsewhere": []
  }
}
```

### Counter-proof: a kind listed twice is named

```json
{
  "given": "The same, with the row of converse added to kinds.md again.",
  "input": {
    "kind": "definitions",
    "roots": [
      "src",
      "docs/assets"
    ],
    "plant": [
      {
        "path": "src/job-catalogue/kinds.md",
        "append": "| converse | kinds/converse |\n"
      }
    ]
  },
  "expected": {
    "listedOnce": false,
    "duplicates": [
      "converse"
    ]
  }
}
```

### Counter-proof: a copy of a job definition in the Bridge's folder is named

```json
{
  "given": "The same, with the kind.md of converse copied to src/desktop-shell/kind.md.",
  "input": {
    "kind": "definitions",
    "roots": [
      "src",
      "docs/assets"
    ],
    "plant": [
      {
        "path": "src/desktop-shell/kind.md",
        "copyFile": "src/job-catalogue/kinds/converse/kind.md"
      }
    ]
  },
  "expected": {
    "elsewhere": [
      "src/desktop-shell/kind.md"
    ]
  }
}
```

### Counter-proof: a copy of a job definition in the dashboard's assets is named

```json
{
  "given": "The same, with the kind.md of implement copied to docs/assets/implement.md.",
  "input": {
    "kind": "definitions",
    "roots": [
      "src",
      "docs/assets"
    ],
    "plant": [
      {
        "path": "docs/assets/implement.md",
        "copyFile": "src/job-catalogue/kinds/implement/kind.md"
      }
    ]
  },
  "expected": {
    "elsewhere": [
      "docs/assets/implement.md"
    ]
  }
}
```

### The Bridge and the dashboard reach the same modules for jobs

```json
{
  "given": "The Bridge's entry, src/desktop-shell/main.mjs, and the dashboard's, src/site-frame/dashboard-app.mjs.",
  "input": {
    "kind": "bridge-reach",
    "bridge": "src/desktop-shell/main.mjs",
    "dashboard": "src/site-frame/dashboard-app.mjs",
    "shared": [
      "job-catalogue",
      "job-runner",
      "runtimes",
      "documents",
      "site-frame"
    ]
  },
  "expected": {
    "missingFromTheBridge": [],
    "missingFromTheDashboard": []
  }
}
```

### Counter-proof: a Bridge entry that imports none of them reaches none

```json
{
  "given": "The same, with every module of the Bridge's folder, its entry among them, replaced by one that imports nothing.",
  "input": {
    "kind": "bridge-reach",
    "bridge": "src/desktop-shell/main.mjs",
    "dashboard": "src/site-frame/dashboard-app.mjs",
    "shared": [
      "job-catalogue",
      "job-runner",
      "runtimes",
      "documents",
      "site-frame"
    ],
    "plant": [
      {
        "path": "src/desktop-shell/main.mjs",
        "pathsBelow": "src/desktop-shell/",
        "replaceWith": "export const nothing = true;\n"
      }
    ]
  },
  "expected": {
    "missingFromTheBridge": [
      "documents",
      "job-catalogue",
      "job-runner",
      "runtimes",
      "site-frame"
    ]
  }
}
```

### The build carries the dashboard's modules and the job definitions

```json
{
  "given": "MOD-bridge-build's electron-builder configuration for the folders the Bridge's entry reaches.",
  "input": {
    "kind": "build-files",
    "bridge": "src/desktop-shell/main.mjs",
    "carries": [
      "job-catalogue",
      "job-runner",
      "runtimes",
      "documents",
      "site-frame"
    ]
  },
  "expected": {
    "carried": [
      "job-catalogue",
      "job-runner",
      "runtimes",
      "documents",
      "site-frame"
    ],
    "kindsAreData": true,
    "copiesOfTheCatalogue": [],
    "carriedFolders": true
  }
}
```

### Counter-proof: with the job catalogue left out of the folders it is not carried

```json
{
  "given": "The same, with job-catalogue taken out of the folders given.",
  "input": {
    "kind": "build-files",
    "bridge": "src/desktop-shell/main.mjs",
    "carries": [
      "job-catalogue",
      "job-runner",
      "runtimes",
      "documents",
      "site-frame"
    ],
    "without": [
      "job-catalogue"
    ]
  },
  "expected": {
    "carried": [
      "job-runner",
      "runtimes",
      "documents",
      "site-frame"
    ],
    "kindsAreData": false
  }
}
```
