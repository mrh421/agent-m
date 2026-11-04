---
id: MOD-trace-graph
title: The trace graph and everything derived from it
folder: src/trace-graph/
realises:
follows:
  - ARC-048
uses:
  - MOD-documents.artifactSchemas
  - MOD-documents.readDocument
  - MOD-documents.Document
  - MOD-identifiers.identifiersIn
  - MOD-identifiers.kindOfIdentifier
  - MOD-identifiers.positionalReferences
  - MOD-identifiers.IdentifierKind
  - MOD-identifiers.pagesAddress
  - MOD-spec-document.parseSpec
  - MOD-spec-document.Spec
  - MOD-test-document.isTestFile
  - MOD-test-document.testDeclarations
  - MOD-test-document.TestDeclaration
  - MOD-group-document.parseGroupFile
  - MOD-text-tools.blobSha
  - MOD-text-tools.finding
  - MOD-text-tools.Finding
  - MOD-repository-hosts.Host
  - MOD-repository-hosts.Snapshot
  - MOD-repository-hosts.commitFiles
provides:
  - TextSource
  - Graph
  - Traces
  - Gaps
  - ImpactEntry
  - ArchitectureImpact
  - ModuleRow
  - ModuleGap
  - Comparison
  - traceGraph
  - storedGraph
  - latestGraph
  - graphFindings
  - tracesTo
  - coverageGaps
  - requirementImpact
  - architectureImpact
  - moduleOrder
  - moduleRows
  - compareGraphs
  - selfSufficiencyFindings
  - systemDecisions
  - graphText
  - graphFromText
  - publishGraph
  - storedImpacts
  - storedGaps
  - storedReferences
---
# MOD-trace-graph The trace graph and everything derived from it

## Responsibility

It belongs to the artifact model (ARC-048). From the files of one repository at one commit it builds the graph of every
identifier and of what names it — requirements, use cases, architecture decisions, modules, tests, items, the sources a
requirement names, and the code files in the modules' folders —, and derives from that graph alone what needs several
artifacts at once: the checks across artifacts, the traces of a requirement, the coverage gaps, the impact lists of a
change, the order of the modules by their uses, the module rows of UC-025, the comparison of two versions, and
references to what exists only inside Agent M. The matrix is derived from the files of one commit alone and edited by no one (`THE TRACEABILITY
MATRIX IS DERIVED`): `traceGraph` builds it, and where the repository holds the graph of that very commit on its branch
`trace-cache`, `traceGraph` returns that graph and reads no file. A page never builds the graph: it reads the stored one through
`storedGraph`, or, where it may show the graph stored last while its commit's is not stored yet, through `latestGraph`, and the workflow that runs on every push to the default branch builds and stores it (MOD-workflow-entries'
`onMainChanged`). It runs in a browser and in Node; it reads only through the source it is given and writes only through
`publishGraph`, which adds the graph of one commit to that branch.

## Parts

- `index.mjs` — the interface.
- `build.mjs` — reading the artifacts of a repository into the graph, with the facts its checks need.
- `code.mjs` — code files by module folder, and the imports between module folders.
- `checks.mjs` — the checks across artifacts.
- `derive.mjs` — traces, gaps, impact lists, module order and rows, comparison.
- `stored.mjs` — the graph of one commit as a text and back, and adding it to the branch `trace-cache`.

## Data

It keeps nothing between calls. A graph lives as long as its caller holds it, or on the branch `trace-cache` of the repository,
which only grows: the file `<commit>.json.gz` is the text `graphText` gives for the graph of the commit it is named by, gzipped, the
file `<commit>.impacts.json` holds the impact lists of that commit's decision and module files that are not accepted, the file
`<commit>.gaps.json` holds `coverageGaps` of that commit's graph, `<commit>.references.json.gz` what names each requirement of it
and each name its edges lead to that no node is, and no file of these four kinds is changed or deleted. The file `latest.json`, `{ commit }`, names the commit of the graph stored last;
`publishGraph` writes it again with every commit that adds a graph, and `latestGraph` reads it while the graph of a page's commit
is not stored yet.

What it reads, and as what:

| Path | Read as |
|---|---|
| `SPEC.md` | requirements, through MOD-spec-document |
| `docs/use-cases/UC-*.md`, `docs/architecture/ARC-*.md`, `docs/architecture/MOD-*.md`, `docs/plan/ITM-*.md`, `docs/backlog/ITM-*.md` | documents, through MOD-documents with the schemas it owns |
| test files, as MOD-test-document's `isTestFile` tells them | test declarations, through MOD-test-document |
| `docs/groups/<kind>.md` | the groups' titles, through MOD-group-document, so that a group's title named where an identifier is expected is found |
| code files — files whose extension is one of those listed below, outside `docs/`, test files and folders named `vendor` or `node_modules` | paths, and for JavaScript, TypeScript, Python and CSS the modules they import |

A code file belongs to the module whose `folder` holds it; a module's folder is named after its identifier (`A MODULE IS
A FOLDER`). The graph holds no field for it: a code node's module is the module whose `folder` is the beginning of its
path, and a code file in no module's folder belongs to none.

The extensions of the four languages whose imports are read, and what an import is in each:

| Language | Extensions | An import is |
|---|---|---|
| JavaScript | `js`, `mjs`, `cjs`, `jsx` | a static `import … from "x"`, `import "x"` or `export … from "x"`, a `import("x")` and a `require("x")` whose argument is a string literal |
| TypeScript | `ts`, `tsx`, `mts`, `cts` | as in JavaScript |
| Python | `py` | `import a.b` and `from a.b import c`, where the dotted name is a path from the repository's root, and `from . import c` or `from ..a import c`, relative to the file's directory |
| CSS | `css` | `@import "x"` and `@import url("x")` |

The other extensions of code files, whose imports are not read: `rb`, `go`, `rs`, `java`, `kt`, `kts`, `scala`, `c`, `h`,
`cc`, `cpp`, `hpp`, `cs`, `swift`, `m`, `php`, `pl`, `lua`, `r`, `jl`, `sh`, `bash`, `zsh`, `ps1`, `sql`, `scss`, `html`,
`vue`, `svelte`, `dart`, `ex`, `exs`, `erl`, `hs`, `ml`, `fs`, `clj`.

A specifier that begins with `.` is resolved against the importing file's directory, any other against the repository's
root. The module imported is the one whose `folder` is the beginning of the resolved path. An `imports` edge is made only
when that module is another than the importing file's own; a specifier that names no path of the repository (a package, a
`node:` name) and a path in no module's folder make none.

The graph keeps, while it is built, every fact a check across artifacts needs, so that each check is decided from the
graph alone and no file is read twice:

- a node keeps from its file what the checks read: a module its `folder` and the interfaces it `provides`, a plan step or
  backlog item its `level` and its `tests`, a test its `level`, a requirement the items of its source as written;
- a `uses` edge keeps the interface it names after the module, such as `parseSpec` in `MOD-spec-document.parseSpec`;
- a group's title is a node of the kind `group`, keyed by its file and line, since a group carries no identifier (`A
  GROUP CARRIES NO IDENTIFIER`);
- the graph keeps the path of every file of the repository, each link an artifact writes — a Markdown link
  `[text](target)` or an autolink `<target>` — with its target as written, and the references by position that
  MOD-identifiers' `positionalReferences` finds in each artifact's text.

The sources a requirement names are kept on its node, not as links: no file the graph reads names a source by an
identifier, and which register entry an item names is MOD-source-register's to say.

## Interfaces

- `TextSource` — `{ paths: string[], read(path: string) -> Promise<string | null>, readMany?: (paths: string[]) ->
  Promise<void>, readOn?: (branch: string, path: string) -> Promise<string | null> }`: the files of one repository at one commit, as the caller hands them; a snapshot of Access fits it.
  `readMany`, where the source offers it, is told every path the graph will read before the first `read`, so that a
  source on a server reads them in batches. `readOn`, where the source offers it, reads a file of another branch of the
  same repository, as a snapshot of Access does; a source without it, such as one that holds an edited text in place of a
  file, never uses a stored graph.
- `Graph` — `{ commit: string | null, nodes: Map<string, { id: string, kind: IdentifierKind | "code" | "group", path:
  string, line: number, title: string | null, blob: string | null, folder: string | null, provides: string[] | null,
  level: string | null, tests: string[] | null, sources: string[] | null }>, edges: { from: string, to: string, via:
  "realises" | "forced_by" | "designs" | "follows" | "refines" | "uses" | "guards" | "exercises" | "changes" | "builds_on" |
  "imports" | "names", interface: string | null, path: string, line: number }[], files: string[], links: { from: string,
  target: string, path: string, line: number }[], positions: Finding[], unread: { path: string, reason: string }[] }` —
  every node and every link, with the facts listed under Data: a node's field that its kind does not have is `null`, and a
  group's node is keyed `<path>:<line>`; an edge's `interface` is `null` but for `uses`; `files` every path the
  `TextSource` lists; `links` each link an artifact writes, `from` the artifact's identifier; `positions` the warnings of
  `positionalReferences`, as it gives them; `unread` the files it could not read, with the reason; a code
  node's `id` is its path, its `line` is 1 and its `title`, `blob` and other facts are `null`; an `imports` edge's `from` is
  the importing code node's `id`, its `to` the identifier of the module imported, its `path` and `line` the file and line of
  the import. A code file of another extension is a node and is not read, so `readMany` is not told it; that its imports
  are not read follows from its extension, as `moduleRows`' `importsRead` says.
- `Traces` — `{ sources: string[], useCases: string[], decisions: string[], modules: string[], tests: string[], items:
  string[] }`.
- `Gaps` — `{ requirementsWithoutUseCase: string[], requirementsWithoutModule: string[], requirementsWithoutTest:
  string[], useCasesWithoutRequirement: string[], unknownNames: { name: string, namedBy: { id: string, path: string,
  line: number }[] }[] }`.
- `ImpactEntry` — `{ id: string, kind: IdentifierKind, path: string, line: number, via: string }`: one artifact that names
  what changes, and how.
- `ArchitectureImpact` — `{ modules: { id: string, why: "changed" | "uses an interface that changes" | "uses an interface
  that is removed", breaks: boolean }[], codeFiles: string[], tests: { id: string, guards: string[] }[], named: { added:
  string[], removed: string[] }, items: string[] }`.
- `ModuleRow` — `{ module: string, subsystem: string | null, realises: string[], describedBy: string, code: string[],
  tests: string[], imports: string[], importsRead: boolean }`.
- `ModuleGap` — `{ kind: string, artifact: string, path: string, what: string }`, its `kind` one of the gaps
  `moduleRows` lists.
- `Comparison` — `{ requirements: { added: string[], changed: string[], removed: string[] }, coverage: { gained: { name:
  string, by: string }[], lost: { name: string, by: string }[] } }`.
- `traceGraph(source: TextSource, options?: { commit?: string }) -> Promise<Graph>` — first, where `options.commit` is
  given and the source has `readOn`, reads `<commit>.json` on the branch `trace-cache` once; a text that `graphFromText`
  restores for that commit is the result, and no file is read. A missing branch or file, a text of another format and a
  text that names another commit are not failures: the graph is then built as follows. Names to the source's `readMany`,
  where it has one, every file it will read, then reads the repository's artifacts and
  code files as listed under Data and builds the graph, keeping the facts listed there. A file that cannot be read, or not
  read as its format, is listed
  in `unread` with the reason, never left out silently; the findings of a single document's format are MOD-documents' and
  are not repeated here. Rejects only when `source.read` itself rejects, with that error. It runs where a commit's graph is
  built: in the workflows and jobs, never on a page.
- `storedGraph(source: TextSource, commit: string) -> Promise<Graph>` — the graph stored for `commit` on the branch
  `trace-cache`, its `<commit>.json.gz` read once with the source's `readOn` and unzipped — once for each commit in a page,
  however many views and functions ask for it, since a commit's graph never changes; a graph not stored, or a read that
  failed, is read again at the next call. It never builds the graph and
  reads no other file; it rejects with `GraphNotStored`, naming the commit and the workflow that stores it, where the
  source has no `readOn`, `commit` is none, or the branch holds no graph of it. Every page reads a graph only through it,
  directly or through `latestGraph`.
- `latestGraph(source: TextSource, commit: string) -> Promise<{ graph: Graph, line: string | null }>` — the graph stored for
  `commit`, as `storedGraph` gives it, and `line` null; while that is not stored yet, `latest.json` on the branch
  `trace-cache` read once with the source's `readOn`, then the graph of the commit it names, as `storedGraph` gives it, and
  nothing else is tried; `line` is then the one line a page shows above what it draws from that graph, naming both commits:
  `As of <that commit, 7 characters>: the trace graph of the newest commit, <commit, 7 characters>, is being stored.` The
  graph's `commit` says which commit it is of. It never builds the graph and reads no other file; where neither graph is
  stored — no `readOn`, no `latest.json`, a text that names no commit, or no graph of the commit it names — it rejects with
  the `GraphNotStored` of `commit`.
- `graphFindings(graph: Graph) -> Finding[]` — the checks across artifacts, each decided from the graph alone and each an
  error naming the artifact and line:
  a name in `realises`, `forced_by`, an item's `realises` or a test's `guards` that matches no requirement or use case
  (`A USE CASE REALISES NAMED REQUIREMENTS`, `EVERY ARTIFACT NAMES ITS ORIGIN`); a `uses` edge whose interface the used
  module's node does not provide (`DEVELOP AGAINST INTERFACES`); a cycle among the modules' uses (`MODULES DEPEND ON EACH OTHER WITHOUT A CYCLE`);
  a test identifier declared at more than one place — the path and line of its node and of its `guards` and `exercises`
  edges, each the place of the declaration it was read from —, as an error at each place that names the other places by
  path and line (`THE NAME IS THE ID AND IT SURVIVES`);
  a module designed by no decision or by more than one, or that does not follow the decision that designs it (`A MODULE
  BELONGS TO ONE SUBSYSTEM`); more or fewer than one decision without `refines`, or a decision that does not refine it
  (`ONE DECISION STATES THE WHOLE ARCHITECTURE`); an item that names a module the architecture does not describe (`A
  BACKLOG ITEM NAMES THE MODULES IT CHANGES`), or a plan step whose `tests` are not those of its `level` (`A PLAN STEP
  NAMES THE TESTS OF ITS LEVEL`); a module whose `folder` is not named after its identifier, or lies inside another
  module's folder (`A MODULE IS A FOLDER`); a name where an identifier is expected that is the title of a `group` node (`A
  GROUP CARRIES NO IDENTIFIER`); a code file's `imports` edge to a module of which the file's own module names no
  interface among its `uses`, named at the file and line of the import with the module imported (`A MODULE STATES ITS
  RESPONSIBILITY AND ITS INTERFACES`), the same imports `moduleRows` lists as a gap; and, as the warnings they are, the
  graph's `positions` (`A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION`).
- `tracesTo(graph: Graph, name: string) -> Traces` — for a requirement, the items of its source its node keeps, and every
  use case, decision, module, test and item that names it (`A REQUIREMENT SHOWS WHAT TRACES TO IT`); a module traces to a
  requirement through the tests of it that guard the requirement.
- `coverageGaps(graph: Graph) -> Gaps` — the requirements no use case realises and — once modules and tests exist — no
  module realises and no test guards; the use cases that realise nothing; every name that matches no requirement, with
  what names it (`UNREALISED REQUIREMENTS ARE REPORTED, NOT FORBIDDEN`). The gaps are shown; none blocks anything.
- `requirementImpact(graph: Graph, name: string) -> ImpactEntry[]` — every artifact that names the requirement, which a
  change to it must list (`A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST`).
- `architectureImpact(graph: Graph, changes: { path: string, before: string | null, after: string | null }[]) ->
  ArchitectureImpact` — for changed, added or removed decision and module files: the modules they concern and the modules
  that use an interface they alter or remove, marked as breaking; the code files in each affected module's folder; the
  tests that exercise those modules and the requirements those tests guard; the requirements and use cases the files name
  and no longer name; the plan steps and backlog items that name an affected module (`AN ARCHITECTURE CHANGE IS NOT
  ACCEPTED WITHOUT AN IMPACT LIST`).
- `graphText(graph: Graph) -> string` — the graph as one text, the same text for the same graph, that names the commit the
  graph was built for.
- `graphFromText(text: string, commit: string) -> Graph | null` — the graph the text holds, or `null` for a text that is
  no `graphText` or names a commit other than `commit`. Reads nothing.
- `publishGraph(host: Host, snapshot: Snapshot, changed?: Array<{ path: string, before: { commit: string, text: string }
  | null }>) -> Promise<{ commit: string, written: boolean }>` — builds the graph of the snapshot's commit from its files
  and adds `<commit>.json.gz`, the graph's text gzipped, `<commit>.gaps.json`, its `coverageGaps`, and
  `<commit>.references.json.gz`, what names each requirement of it, gzipped, to the branch
  `trace-cache` by `commitFiles`, on the head it read, with `latest.json` naming the commit in the same commit; `written` is `false` when
  the branch holds the file already, which it then leaves as it is, and `latest.json` with it. With `changed`, the decision and module files of the
  commit that are not accepted, each with the text it was last accepted at and that text's commit (`null` for a file never
  accepted), as the caller reads them, it adds `<commit>.impacts.json` in the same commit: for each file, its path, its
  blob at the commit, `before`'s commit, and `architectureImpact(graph, [{ path, before: before.text, after }])`. This
  module reads no history and no approval record, so the caller hands `changed` in. Crosses the network; fails as
  `commitFiles` fails, with `NotFound` naming the branch when the repository has none.
- `storedImpacts(source: TextSource, commit: string) -> Promise<Map<string, { blob: string, before: string | null,
  impact: ArchitectureImpact }> | null>` — the impact lists stored for `commit` by `publishGraph`, keyed by path, read
  with the source's `readOn` in one request; `null` without `readOn`, or when the branch or the file is missing or holds
  another format. A caller uses an entry only while the file's blob is the one stored.
- `storedGaps(source: TextSource, commit: string) -> Promise<CoverageGaps | null>` — `coverageGaps` of the graph stored for
  `commit`, as `publishGraph` stored them beside it, read with the source's `readOn` in one request; `null` without `readOn`,
  or when the branch or the file is missing or holds another format.
- `storedReferences(source: TextSource, commit: string) -> Promise<Map<string, string[]> | null>` — for each requirement of
  the graph stored for `commit`, and each name an edge of it leads to that no node is, the identifiers of what names it, as
  `requirementImpact` gives them, each once; a name without an entry is named by nothing. Read with the source's `readOn` in
  one request, once for each commit; `null` without `readOn`, or when the branch or the file is missing or holds another format.
- `systemDecisions(graph: Graph) -> { system: string[], subsystems: string[] }` — the decisions that refine no other,
  and the subsystems' decisions: those that refine one of them and design at least one module; each list by identifier.
- `moduleOrder(graph: Graph) -> { order: string[] } | { cycle: string[] }` — the modules in an order in which every module
  stands after every module whose interfaces it uses, or the modules of a cycle when there is one (`A RUN FOLLOWS THE
  MODULES' INTERFACES`).
- `moduleRows(graph: Graph) -> { rows: ModuleRow[], gaps: ModuleGap[] }` — one row per module, as UC-025 shows it, and
  the gaps (`MODULE GAPS ARE REPORTED, NOT FORBIDDEN`): a module in no subsystem or whose subsystem's decision does not
  name it; a module that realises no requirement; an accepted requirement no module realises — accepted as its caller
  marks it —; a module no test exercises, or without code; a code file outside every module's folder, or a folder no
  module names; an import between modules that the importing module's file does not name among the interfaces it uses;
  a module folder inside another; a name that matches nothing. Where imports could not be read for a file's language,
  `importsRead` is false and the row says so.
- `compareGraphs(earlier: Graph, later: Graph) -> Comparison` — the requirements added, changed and removed between two
  versions, and the coverage gained and lost (UC-020).
- `selfSufficiencyFindings(graph: Graph, instance: string) -> Finding[]` — an error under `THE PRODUCT REPOSITORY IS
  SELF-SUFFICIENT` for each of the graph's `links` whose target is a path of the repository that `files` does not hold,
  the instance's repository `instance`, given as `owner/name`, or its dashboard at the address MOD-identifiers'
  `pagesAddress` gives it (`AN INSTANCE IS A FORK OF AGENT M`). MOD-job-runner's check `graph-checks` runs it on every draft.

## Files

It reads, through the `TextSource` it is given, the files listed under Data, and the files `<commit>.json.gz`,
`<commit>.impacts.json`, `<commit>.gaps.json`, `<commit>.references.json.gz` and `latest.json` of the branch `trace-cache`. It writes
them on that branch only in `publishGraph`: the first four only by adding, `latest.json` again in each commit that adds a graph.

## Uses

- `MOD-documents.artifactSchemas`, `MOD-documents.readDocument` and the type `MOD-documents.Document` — to read use cases,
  decisions, module files and items by their schemas.
- `MOD-identifiers.identifiersIn`, `MOD-identifiers.kindOfIdentifier`, `MOD-identifiers.positionalReferences` and the type
  `MOD-identifiers.IdentifierKind` — to find the identifiers and names a text writes, their kinds, and references by
  position; `MOD-identifiers.pagesAddress` — the instance's dashboard, which no artifact may link.
- `MOD-spec-document.parseSpec` and the type `MOD-spec-document.Spec` — to read the requirements.
- `MOD-test-document.isTestFile`, `MOD-test-document.testDeclarations` and the type `MOD-test-document.TestDeclaration` —
  to tell the test files and read their tests.
- `MOD-group-document.parseGroupFile` — to read the groups' titles.
- `MOD-text-tools.blobSha` — the blob of each node.
- `MOD-text-tools.finding` and the type `MOD-text-tools.Finding` — the findings it reports.
- `MOD-repository-hosts.Host`, `MOD-repository-hosts.Snapshot` and `MOD-repository-hosts.commitFiles` — `publishGraph`'s
  reading of the branch head and its one commit.
