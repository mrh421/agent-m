# Supported coding-agent register

The supported local coding-agent CLIs. Every row supplies the exact invocation data used by this module; JSON cells keep
each command's argument vector, interpretation and final-answer rule in data rather than in vendor-specific code. A
Task's arguments never hold the prompt: the agent reads it on its standard input.

```json
{
  "schema": "agent-processes",
  "shape": "document",
  "rule": "THE BRIDGE FINDS THE INSTALLED AGENTS",
  "path": "src/agent-processes/agents.md",
  "sections": [
    { "underTitle": true, "required": true, "table": { "columns": [
      { "name": "Agent", "value": { "type": "text", "required": true } },
      { "name": "Command", "value": { "type": "text", "required": true } },
      { "name": "Version", "value": { "type": "text", "required": true } },
      { "name": "Task", "value": { "type": "text", "required": true } },
      { "name": "Login check", "value": { "type": "text", "required": true } },
      { "name": "Key variable", "value": { "type": "text" } },
      { "name": "Endpoint", "value": { "type": "text" } },
      { "name": "Key holder", "value": { "type": "text" } },
      { "name": "Install macos", "value": { "type": "url", "required": true } },
      { "name": "Install windows", "value": { "type": "url", "required": true } },
      { "name": "Install linux", "value": { "type": "url", "required": true } }
    ] } }
  ]
}
```
