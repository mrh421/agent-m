// MOD-trace-graph — the trace graph and everything derived from it (docs/architecture/MOD-trace-graph.md): its
// interface: traceGraph, graphFindings, tracesTo, requirementImpact, architectureImpact, coverageGaps, compareGraphs, moduleOrder,
// moduleRows and selfSufficiencyFindings.
// traceGraph reads, of its Data, SPEC.md through MOD-spec-document, the test files through MOD-test-document, the use cases, the
// architecture decisions, the module files, the plan steps and the backlog items through MOD-documents, and the group files through
// MOD-group-document, so that its graph holds every requirement, test, document and group with the edges it states and the facts
// the checks across artifacts need, and lists a file it cannot read with the reason. graphFindings decides from the graph alone the
// checks across artifacts, and selfSufficiencyFindings the links that reach a path the product repository does not hold, or the
// instance's repository or dashboard; both are in checks.mjs. tracesTo gives a requirement the sources its node keeps and the use
// cases, decisions, modules, tests and items that name it, requirementImpact every place an artifact names it, and coverageGaps the
// requirements and use cases that lack a counterpart and the names that match nothing. architectureImpact derives the architecture-change list from those facts and
// supplied before/after texts. traceGraph also reads the code files, a node of the kind `code` for each by its path, and, for
// JavaScript, TypeScript, Python and CSS, their imports (code.mjs): an `imports` edge from the code node to each other module whose
// folder holds the path imported. moduleRows gives one row per module and the gaps of UC-025.
// compareGraphs gives the requirements added, changed and removed between two versions' graphs, and the coverage gained and lost (UC-020 1b).
//
// Module: MOD-trace-graph
//
// It belongs to the artifact model (ARC-048). It runs unchanged in a browser and in Node, keeps nothing between calls
// (THE TRACEABILITY MATRIX IS DERIVED), and performs no input or output of its own: it reads only through the
// `TextSource` its caller gives it.

/**
 * The files of one repository at one commit, as the caller hands them; a snapshot of Access fits it.
 * @typedef {{ paths: string[], read: (path: string) => Promise<string | null>, readMany?: (paths: string[]) => Promise<void>,
 * readOn?: (branch: string, path: string) => Promise<string | null> }} TextSource
 */

/**
 * One node of the graph: an artifact or a code file, by its identifier, or a group of a group file. A document's `title` is
 * the `title` of its front matter and its `blob` the git blob SHA of its file; a group's `title` is its title, its `blob`
 * the SHA of its group file, and, since it carries no identifier, its `id` is where it stands, `<path>:<line>`. SPEC.md's
 * requirements and the test files' declarations carry neither a title nor a blob of their own: both are `null`. A node keeps,
 * besides, the facts of its kind, and has the others as `null`: a module its `folder` and the interfaces it `provides`, a plan
 * step or backlog item its `level` and its `tests`, a requirement its `sources`, the items of its source as the SPEC writes it.
 * @typedef {{
 *   id: string,
 *   kind: "requirement" | "SRC" | "UC" | "ARC" | "MOD" | "TST" | "ITM" | "RES" | "JOB" | "code" | "group",
 *   path: string,
 *   line: number,
 *   title: string | null,
 *   blob: string | null,
 *   folder: string | null,
 *   provides: string[] | null,
 *   level: string | null,
 *   tests: string[] | null,
 *   sources: string[] | null,
 * }} GraphNode
 */

/**
 * One link an artifact states to another, with the file and line that state it. A `uses` edge keeps, besides, the `interface`
 * it names after the module, `parseSpec` of MOD-spec-document.parseSpec; the `interface` of every other edge is `null`.
 * @typedef {{
 *   from: string,
 *   to: string,
 *   via: "realises" | "forced_by" | "designs" | "follows" | "refines" | "uses" | "guards" | "exercises" | "changes"
 *     | "builds_on" | "imports" | "names",
 *   interface: string | null,
 *   path: string,
 *   line: number,
 * }} GraphEdge
 */

/**
 * One link a document writes in its text, a Markdown link `[text](target)` or an autolink `<target>`: the identifier of the
 * document, the target as written, and the file and line.
 * @typedef {{ from: string, target: string, path: string, line: number }} GraphLink
 */

/**
 * The graph traceGraph builds: every node and every edge, the facts the checks across artifacts need, and the files it could
 * not read, with the reason. Its nodes are the requirements of SPEC.md, the tests of the test files, the use cases, decisions,
 * modules, plan steps and items, and the groups of the group files; its edges are `guards` from a test, `realises`, `forced_by`,
 * `designs`, `follows`, `refines`, `uses`, `changes` and `builds_on` from a document's front matter — a `uses` edge points at
 * the interface as the module file writes it, `MOD-<slug>.<name>` —, and `names` from a document to each identifier its text
 * writes on a line no other edge states. `files` is every path the TextSource lists; `links` the links the documents write;
 * `positions` the warnings MOD-identifiers' positionalReferences gives for the documents' texts, as it gives them.
 * @typedef {{
 *   commit: string | null,
 *   nodes: Map<string, GraphNode>,
 *   edges: GraphEdge[],
 *   files: string[],
 *   links: GraphLink[],
 *   positions: Finding[],
 *   unread: { path: string, reason: string }[],
 * }} Graph
 */

/**
 * For a requirement, the items of its source its node keeps, and every use case, decision, module, test and item that names
 * it (A REQUIREMENT SHOWS WHAT TRACES TO IT). tracesTo reads the node and the edges that point at the name: `sources` come from the
 * node, `tests` from the `guards` edges, and `useCases`, `decisions`, `modules` and `items` from the edges of artifacts of their kind,
 * a module also through the tests of it that guard the requirement.
 * @typedef {{
 *   sources: string[],
 *   useCases: string[],
 *   decisions: string[],
 *   modules: string[],
 *   tests: string[],
 *   items: string[],
 * }} Traces
 */

/**
 * One row of the impact list of a requirement: one place at which an artifact names it, with the identifier and the kind of the
 * artifact, the file and the line at which it does, and the edge by which it does, the `via` of the graph's edge.
 * @typedef {{
 *   id: string,
 *   kind: "requirement" | "SRC" | "UC" | "ARC" | "MOD" | "TST" | "ITM" | "RES" | "JOB",
 *   path: string,
 *   line: number,
 *   via: string,
 * }} ImpactEntry
 */

/**
 * The gaps of coverage, none of which blocks anything: the requirements of the SPEC that no use case realises and — once the graph
 * holds a module, or a test — that no module realises, that no test guards; the use cases that realise no requirement; and the
 * names that match no requirement or use case, each with the artifact, the file and the line of every place that states it.
 * @typedef {{
 *   requirementsWithoutUseCase: string[],
 *   requirementsWithoutModule: string[],
 *   requirementsWithoutTest: string[],
 *   useCasesWithoutRequirement: string[],
 *   unknownNames: { name: string, namedBy: { id: string, path: string, line: number }[] }[],
 * }} Gaps
 */

export { latestGraph, storedGraph, traceGraph } from "./build.mjs";
export { graphFromText, graphText, publishGraph, storedGaps, storedImpacts, storedReferences } from "./stored.mjs";
export { graphFindings, selfSufficiencyFindings } from "./checks.mjs";
export { architectureImpact, compareGraphs, coverageGaps, moduleOrder, moduleRows, requirementImpact, systemDecisions, tracesTo } from "./derive.mjs";
