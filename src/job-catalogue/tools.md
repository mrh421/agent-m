# Tools

The tools a kind may offer its drafter, one row each: its name, the capability the drafter must declare besides *use
tools*, the description the drafter reads, and the JSON schema of the arguments of a call.

| Tool | Needs | Description | Input |
|---|---|---|---|
| list-files | read the repository | Name the files under a folder of the product, at the commit the job read. | {"type":"object","properties":{"folder":{"type":"string"}},"required":["folder"]} |
| read-file | read the repository | Read one file of the product, by its path. | {"type":"object","properties":{"path":{"type":"string"}},"required":["path"]} |
| search-files | read the repository | Find the lines that hold a text in the product's files below a path — a file such as SPEC.md, or a folder such as docs/use-cases/; a search of more than 200 files is refused. | {"type":"object","properties":{"text":{"type":"string"},"path":{"type":"string"}},"required":["text"]} |
| propose-edit | draft text | Propose the new text of one document below docs/, whole; it is held for a person, who may save it. | {"type":"object","properties":{"path":{"type":"string"},"text":{"type":"string"}},"required":["path","text"]} |
| hand-over | draft text | Hand work on to the kind that owns it — change-requirements, change-use-case or change-architecture for a change of requirements, a use case or the architecture — or to a kind that does what you cannot here, such as running code or tests, changing code or reaching the web, with `works_on` naming the requirements, use cases, decisions, modules or items the job works on, and the task in your words; it goes on without a further click, and what it drafts is a proposal the person accepts. | {"type":"object","properties":{"kind":{"type":"string"},"works_on":{"type":"array","items":{"type":"string"}},"task":{"type":"string"}},"required":["kind","works_on","task"]} |
