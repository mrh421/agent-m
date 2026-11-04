# Runtime Levels Release Cases

The cases of `tests/test_runtime_levels.py`, for the three requirements whose Check line the SPEC gives that file: **AGENT M WORKS WITHOUT A LOCAL INSTALLATION**, **A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET** and **A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET**. Each case below is the SPEC's check sentence or its counter-proof, as the sentence words it.

**How a case reads.** `given` is its precondition. `input.check` says what the case asks of the code: `routes` (MOD-runtimes' `routesFor` for a CI agent whose register route is `participantRoute`, a product with `product`, and the resource `needs`), `kinds` (the same for every job kind of the catalogue whose definition names no local resource, with no needs), or `workflow` (the files `jobWorkflowFiles` generates for `server`, with the CI secret `token` and the agent key secrets `keys`, and for the counter-proofs a `plant` that changes the generated text the way the SPEC's counter-proof describes before it is checked). The sections on the part that runs the agent and on the machine that reads the token read the generated file job by job: a job runs the agent where it runs `onDispatch` or `onRecordsChanged` or installs an agent. `expected` names only what the case asserts: `available` (whether the hosted-CI route is offered), `kinds` (that the sweep read kinds) with `unavailable` (the kinds whose hosted route is not offered), `findings` (the lines the check of the generated text finds: none for a workflow as generated, some for a planted one) and `files` (the generated files).

## AGENT M WORKS WITHOUT A LOCAL INSTALLATION

### Every job kind whose definition names no local resource is runnable on the hosted-CI route

```json
{
  "given": "A CI agent on the server's own runners, a product with the job workflow, and every kind of the catalogue whose definition says `resources: none` (so the caller passes no needs).",
  "input": {
    "check": "kinds",
    "participantRoute": "ci hosted secret KEY_A",
    "product": {
      "visibility": "public",
      "jobWorkflow": true
    }
  },
  "expected": {
    "kinds": true,
    "unavailable": []
  }
}
```

### A job whose resources need no Bridge and no runner is runnable there too

```json
{
  "given": "A kind that says `resources: product`, for a product whose resources are all reached by neither a Bridge nor a runner (the caller passes no needs).",
  "input": {
    "check": "routes",
    "participantRoute": "ci hosted secret KEY_A",
    "product": {
      "visibility": "public",
      "jobWorkflow": true
    },
    "needs": []
  },
  "expected": {
    "available": true
  }
}
```

## AGENT M WORKS WITHOUT A LOCAL INSTALLATION: counter-proofs

### Counter-proof: a job needing a compute resource reached by a Bridge is not offered on the hosted-CI route

```json
{
  "given": "The same agent and product; the job needs a compute resource reached by `bridge workstation`.",
  "input": {
    "check": "routes",
    "participantRoute": "ci hosted secret KEY_A",
    "product": {
      "visibility": "public",
      "jobWorkflow": true
    },
    "needs": [
      {
        "resource": "the workstation's GPU",
        "route": "bridge workstation"
      }
    ]
  },
  "expected": {
    "available": false
  }
}
```

### Counter-proof: a job needing a compute resource reached by a self-hosted runner is not offered on the server's runners

```json
{
  "given": "The same agent and product; the job needs a compute resource reached by `runner:gpu`.",
  "input": {
    "check": "routes",
    "participantRoute": "ci hosted secret KEY_A",
    "product": {
      "visibility": "public",
      "jobWorkflow": true
    },
    "needs": [
      {
        "resource": "the GPU machine",
        "route": "runner:gpu"
      }
    ]
  },
  "expected": {
    "available": false
  }
}
```

### Counter-proof: the runner that reaches the compute resource is offered

```json
{
  "given": "The agent on the self-hosted runner `gpu`, for a private product, and the same need `runner:gpu`: the check offers the route that does reach it.",
  "input": {
    "check": "routes",
    "participantRoute": "ci runner:gpu secret KEY_A",
    "product": {
      "visibility": "private",
      "jobWorkflow": true
    },
    "needs": [
      {
        "resource": "the GPU machine",
        "route": "runner:gpu"
      }
    ]
  },
  "expected": {
    "available": true
  }
}
```


## A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET

### GitHub: the generated job workflow reads each agent key only from the secret of that name

```json
{
  "given": "The files for GitHub with the agent keys KEY_A and KEY_B named as CI secrets.",
  "input": {
    "check": "workflow",
    "server": "github",
    "token": "AGENT_M_TOKEN",
    "keys": [
      "KEY_A",
      "KEY_B"
    ],
    "runners": [
      "hosted",
      "gpu"
    ]
  },
  "expected": {
    "findings": [],
    "files": 2
  }
}
```

### GitLab: the generated job workflow reads each agent key only from the variable of that name

```json
{
  "given": "The files for GitLab with the same keys.",
  "input": {
    "check": "workflow",
    "server": "gitlab",
    "token": "AGENT_M_TOKEN",
    "keys": [
      "KEY_A",
      "KEY_B"
    ],
    "runners": [
      "hosted",
      "gpu"
    ]
  },
  "expected": {
    "findings": [],
    "files": 3
  }
}
```


## A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET: counter-proofs

### Counter-proof: a GitHub workflow with the key written into it fails

```json
{
  "given": "The generated GitHub workflow in which the line of KEY_A holds a key value instead of the secret.",
  "input": {
    "check": "workflow",
    "server": "github",
    "token": "AGENT_M_TOKEN",
    "keys": [
      "KEY_A",
      "KEY_B"
    ],
    "runners": [
      "hosted",
      "gpu"
    ],
    "plant": "key-literal"
  },
  "expected": {
    "flagged": true
  }
}
```

### Counter-proof: a GitLab workflow with the key written into it fails

```json
{
  "given": "The generated GitLab workflow in which a variable KEY_A holds a key value.",
  "input": {
    "check": "workflow",
    "server": "gitlab",
    "token": "AGENT_M_TOKEN",
    "keys": [
      "KEY_A",
      "KEY_B"
    ],
    "runners": [
      "hosted",
      "gpu"
    ],
    "plant": "key-literal"
  },
  "expected": {
    "flagged": true
  }
}
```


## A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET

### GitHub: the generated job workflow authenticates its checkouts, pushes and pull requests with the named secret

```json
{
  "given": "The files for GitHub with the token secret AGENT_M_TOKEN: the token of each checkout and the token the entry reads are that secret, and the workflow's built-in token is used for nothing.",
  "input": {
    "check": "workflow",
    "server": "github",
    "token": "AGENT_M_TOKEN",
    "keys": [
      "KEY_A",
      "KEY_B"
    ],
    "runners": [
      "hosted",
      "gpu"
    ]
  },
  "expected": {
    "findings": [],
    "files": 2
  }
}
```

### GitLab: the generated job workflow pushes with the named variable and not the job token

```json
{
  "given": "The files for GitLab with the token variable AGENT_M_TOKEN.",
  "input": {
    "check": "workflow",
    "server": "gitlab",
    "token": "AGENT_M_TOKEN",
    "keys": [
      "KEY_A",
      "KEY_B"
    ],
    "runners": [
      "hosted",
      "gpu"
    ]
  },
  "expected": {
    "findings": [],
    "files": 3
  }
}
```


## A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET: counter-proofs

### Counter-proof: a GitHub workflow that uses GITHUB_TOKEN for them fails

```json
{
  "given": "The generated GitHub workflow in which a checkout takes the built-in token.",
  "input": {
    "check": "workflow",
    "server": "github",
    "token": "AGENT_M_TOKEN",
    "keys": [
      "KEY_A",
      "KEY_B"
    ],
    "runners": [
      "hosted",
      "gpu"
    ],
    "plant": "builtin-token"
  },
  "expected": {
    "flagged": true
  }
}
```

### Counter-proof: a GitLab workflow that pushes with the job token fails

```json
{
  "given": "The generated GitLab workflow in which the credential helper of the product's checkout gives CI_JOB_TOKEN.",
  "input": {
    "check": "workflow",
    "server": "gitlab",
    "token": "AGENT_M_TOKEN",
    "keys": [
      "KEY_A",
      "KEY_B"
    ],
    "runners": [
      "hosted",
      "gpu"
    ],
    "plant": "builtin-token"
  },
  "expected": {
    "flagged": true
  }
}
```



## A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET: the part that runs the agent

### GitHub: each agent's job reads only the key of its participant, never the person's token

```json
{
  "given": "The files for GitHub with the agent keys KEY_A and KEY_B and the token secret AGENT_M_TOKEN, for the server's runners and the self-hosted runner gpu: every job that runs onDispatch, onRecordsChanged or installs an agent.",
  "input": {
    "check": "workflow",
    "server": "github",
    "token": "AGENT_M_TOKEN",
    "keys": [
      "KEY_A",
      "KEY_B"
    ],
    "runners": [
      "hosted",
      "gpu"
    ]
  },
  "expected": {
    "findings": []
  }
}
```

### GitLab: the job that runs the agent reads no secret but the key of its participant

```json
{
  "given": "The files for GitLab with the same keys and token: each agent's job is in the environment agent-m-key-<its key>, the plan in none, and no job inherits the product's default: or variables:.",
  "input": {
    "check": "workflow",
    "server": "gitlab",
    "token": "AGENT_M_TOKEN",
    "keys": [
      "KEY_A",
      "KEY_B"
    ],
    "runners": [
      "hosted",
      "gpu"
    ]
  },
  "expected": {
    "findings": []
  }
}
```


## A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET: the part that runs the agent, counter-proofs

### Counter-proof: a GitHub workflow whose agent part reads AGENT_M_TOKEN fails

```json
{
  "given": "The generated GitHub workflow in which the agent's job for KEY_A also reads the secret AGENT_M_TOKEN.",
  "input": {
    "check": "workflow",
    "server": "github",
    "token": "AGENT_M_TOKEN",
    "keys": [
      "KEY_A",
      "KEY_B"
    ],
    "runners": [
      "hosted",
      "gpu"
    ],
    "plant": "token-in-agent"
  },
  "expected": {
    "flagged": true
  }
}
```

### Counter-proof: a GitHub workflow whose agent part reads another participant's key fails

```json
{
  "given": "The generated GitHub workflow in which the agent's job for KEY_A also reads KEY_B, the key of another participant.",
  "input": {
    "check": "workflow",
    "server": "github",
    "token": "AGENT_M_TOKEN",
    "keys": [
      "KEY_A",
      "KEY_B"
    ],
    "runners": [
      "hosted",
      "gpu"
    ],
    "plant": "other-key-in-agent"
  },
  "expected": {
    "flagged": true
  }
}
```

### Counter-proof: a GitLab workflow whose agent part is in the environment of the token fails

```json
{
  "given": "The generated GitLab workflow in which the agent's job for KEY_A is in the environment agent-m-write, to which the token is scoped.",
  "input": {
    "check": "workflow",
    "server": "gitlab",
    "token": "AGENT_M_TOKEN",
    "keys": [
      "KEY_A",
      "KEY_B"
    ],
    "runners": [
      "hosted",
      "gpu"
    ],
    "plant": "token-in-agent"
  },
  "expected": {
    "flagged": true
  }
}
```

### Counter-proof: a GitLab workflow whose agent part is in another participant's key's environment fails

```json
{
  "given": "The generated GitLab workflow in which the agent's job for KEY_A is in the environment agent-m-key-KEY_B.",
  "input": {
    "check": "workflow",
    "server": "gitlab",
    "token": "AGENT_M_TOKEN",
    "keys": [
      "KEY_A",
      "KEY_B"
    ],
    "runners": [
      "hosted",
      "gpu"
    ],
    "plant": "other-key-in-agent"
  },
  "expected": {
    "flagged": true
  }
}
```

### Counter-proof: a GitLab workflow whose job inherits the product's variables fails

```json
{
  "given": "The generated GitLab workflow in which a job inherits the product's global variables:.",
  "input": {
    "check": "workflow",
    "server": "gitlab",
    "token": "AGENT_M_TOKEN",
    "keys": [
      "KEY_A",
      "KEY_B"
    ],
    "runners": [
      "hosted",
      "gpu"
    ],
    "plant": "inherited-variables"
  },
  "expected": {
    "flagged": true
  }
}
```

## A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET: the machine that reads the token

### GitHub: only jobs that run no agent read the token, on the server's runners, and the workflow's own token cannot write

```json
{
  "given": "The files for GitHub with the token secret AGENT_M_TOKEN, for the server's runners and the self-hosted runner gpu: every job that reads the token.",
  "input": {
    "check": "workflow",
    "server": "github",
    "token": "AGENT_M_TOKEN",
    "keys": [
      "KEY_A",
      "KEY_B"
    ],
    "runners": [
      "hosted",
      "gpu"
    ]
  },
  "expected": {
    "findings": []
  }
}
```

### GitLab: the job that reads the token runs no agent

```json
{
  "given": "The files for GitLab with the token variable AGENT_M_TOKEN: the job that reads the token is the one in the environment agent-m-write, to which the token is scoped.",
  "input": {
    "check": "workflow",
    "server": "gitlab",
    "token": "AGENT_M_TOKEN",
    "keys": [
      "KEY_A",
      "KEY_B"
    ],
    "runners": [
      "hosted",
      "gpu"
    ]
  },
  "expected": {
    "findings": []
  }
}
```


## A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET: the machine that reads the token, counter-proofs

### Counter-proof: a GitHub workflow that hands the secret to the machine the agent works on fails

```json
{
  "given": "The generated GitHub workflow in which the agent's job for KEY_A also reads the secret AGENT_M_TOKEN.",
  "input": {
    "check": "workflow",
    "server": "github",
    "token": "AGENT_M_TOKEN",
    "keys": [
      "KEY_A",
      "KEY_B"
    ],
    "runners": [
      "hosted",
      "gpu"
    ],
    "plant": "token-in-agent"
  },
  "expected": {
    "flagged": true
  }
}
```

### Counter-proof: a GitHub workflow whose writing job runs on the self-hosted runner its agents use fails

```json
{
  "given": "The generated GitHub workflow in which the job that writes for the route gpu runs on the self-hosted runner gpu, where that route's agent's jobs run.",
  "input": {
    "check": "workflow",
    "server": "github",
    "token": "AGENT_M_TOKEN",
    "keys": [
      "KEY_A",
      "KEY_B"
    ],
    "runners": [
      "hosted",
      "gpu"
    ],
    "plant": "writer-on-runner"
  },
  "expected": {
    "flagged": true
  }
}
```

### Counter-proof: a GitHub workflow that lets its own token write fails

```json
{
  "given": "The generated GitHub workflow whose permissions give the workflow's built-in token write access to the contents.",
  "input": {
    "check": "workflow",
    "server": "github",
    "token": "AGENT_M_TOKEN",
    "keys": [
      "KEY_A",
      "KEY_B"
    ],
    "runners": [
      "hosted",
      "gpu"
    ],
    "plant": "write-permission"
  },
  "expected": {
    "flagged": true
  }
}
```

### Counter-proof: a GitLab workflow that hands the token to the machine the agent works on fails

```json
{
  "given": "The generated GitLab workflow in which the agent's job for KEY_A is in the environment agent-m-write, to which the token is scoped.",
  "input": {
    "check": "workflow",
    "server": "gitlab",
    "token": "AGENT_M_TOKEN",
    "keys": [
      "KEY_A",
      "KEY_B"
    ],
    "runners": [
      "hosted",
      "gpu"
    ],
    "plant": "token-in-agent"
  },
  "expected": {
    "flagged": true
  }
}
```

