// Derive — what traceGraph's graph alone answers (MOD-trace-graph, Parts): tracesTo, which gives a requirement the
// sources its node keeps and the use cases, decisions, modules, tests and items that name it, read through the edges that point at
// it, requirementImpact, which lists every place an artifact names a requirement, read through the edges that point at it, and
// coverageGaps, which lists the requirements and use cases that lack a counterpart and the names that match nothing.
// architectureImpact derives the architecture-change list from the graph's facts and the caller's before/after texts, moduleOrder the
// order of the modules by the interfaces they use, moduleRows the module rows with their gaps, and compareGraphs what differs between two versions' graphs.
//
// Module: MOD-trace-graph

import { artifactSchemas, readDocument } from "../documents/index.mjs";
import { identifiersIn } from "../identifiers/index.mjs";
import { isCodePath, moduleFinder, readsImports } from "./code.mjs";

const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// tracesTo(graph: Graph, name: string) -> Traces — for a requirement, the items of its source its node keeps, and every use case,
// decision, module, test and item that names it (A REQUIREMENT SHOWS WHAT TRACES TO IT) — a module also through the tests of it that
// guard the requirement, as the module file states. `sources` are the items of the source as the SPEC writes it, from the node
// of the requirement, so that a name that is no requirement has none; `tests` names every test whose `guards` edge points at `name`;
// `useCases`, `decisions` and `items` name each artifact of that kind with an edge — its front matter's or a line of its text — that
// points at `name`; `modules` names each module with such an edge and, besides, each module a test that guards `name` exercises. Each
// list is by identifier, sorted, without repeats, and holds only artifacts the graph has a node for.
export function tracesTo(graph, name) {
  const node = graph.nodes.get(name);
  const sources = node?.kind === "requirement" ? [...(node.sources ?? [])] : [];
  const tests = graph.edges.filter((edge) => edge.via === "guards" && edge.to === name).map((edge) => edge.from).sort(byText);
  const naming = (kind) => graph.edges.filter((edge) => edge.to === name && graph.nodes.get(edge.from)?.kind === kind).map((edge) => edge.from);
  const exercised = graph.edges.filter((edge) => edge.via === "exercises" && tests.includes(edge.from) && graph.nodes.get(edge.to)?.kind === "MOD")
    .map((edge) => edge.to);
  return { sources, useCases: unique(naming("UC")), decisions: unique(naming("ARC")), modules: unique([...naming("MOD"), ...exercised]), tests,
    items: unique(naming("ITM")) };
}

// systemDecisions(graph: Graph) -> { system: string[], subsystems: string[] } — the decisions that refine no other, and the subsystems' decisions: those that refine one of them and design at least
// one module; each list by identifier. A decision that refines the system and designs no module, and one that refines a subsystem's decision, is in neither.
export function systemDecisions(graph) {
  const from = (id, via) => graph.edges.filter((edge) => edge.from === id && edge.via === via);
  const decisions = [...graph.nodes.values()].filter((node) => node.kind === "ARC");
  const system = decisions.filter((node) => from(node.id, "refines").length === 0).map((node) => node.id).sort(byText);
  const subsystems = decisions.filter((node) => from(node.id, "refines").some((edge) => system.includes(edge.to)) && from(node.id, "designs").length > 0).map((node) => node.id).sort(byText);
  return { system, subsystems };
}

// requirementImpact(graph: Graph, name: string) -> ImpactEntry[] — every artifact that names the requirement, to be listed beside a
// change to it (A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST): one row for each place an edge of the graph points at `name` —
// a use case's, a module's or an item's `realises`, a decision's `forced_by`, a test's `guards`, a text that names it —, with the
// naming artifact's identifier and kind, the file and the line at which it names the requirement (of a test, the line its
// declaration begins at) and the kind of the edge as `via`. It reads the edges alone, so a name no node carries, a withdrawn
// requirement among them, lists what still names it, and a name nothing names lists nothing. A name written twice on one line is
// one place. The rows come use cases first, then decisions, modules, items and tests, each kind by identifier, the rows of one
// artifact in the order its file gives them, so that the list does not depend on the order in which the repository lists its files.
const IMPACT_ORDER = ["UC", "ARC", "MOD", "ITM", "TST"];
export function requirementImpact(graph, name) {
  const places = new Map();
  for (const edge of graph.edges) {
    if (edge.to !== name) continue;
    const entry = { id: edge.from, kind: graph.nodes.get(edge.from).kind, path: edge.path, line: edge.line, via: edge.via };
    places.set(JSON.stringify(entry), entry);
  }
  return [...places.values()].sort((a, b) => IMPACT_ORDER.indexOf(a.kind) - IMPACT_ORDER.indexOf(b.kind) || byText(a.id, b.id));
}

const listOf = (value) => [value ?? []].flat();
const unique = (values) => [...new Set(values)].sort(byText);

// The document reader already isolates Interfaces. Compare its bullets, including their indented continuations, as the
// existing architecture model does; unrelated sections cannot turn a prose edit into an interface change.
function interfaceDeclarations(document) {
  const lines = document?.sections.find((section) => section.heading === "## Interfaces")?.text.split(/\r?\n/) ?? [];
  const declarations = new Map();
  for (let at = 0; at < lines.length; at += 1) {
    const name = /^- `([A-Za-z_][A-Za-z0-9_]*)/.exec(lines[at])?.[1];
    if (!name) continue;
    const declaration = [lines[at]];
    while (at + 1 < lines.length && /^\s+\S/.test(lines[at + 1])) declaration.push(lines[++at]);
    declarations.set(name, declaration.map((line) => line.trimEnd()).join("\n"));
  }
  return declarations;
}

// architectureImpact(graph, changes) -> ArchitectureImpact. All relationships come from the existing graph; only the supplied
// changed texts are parsed. Removed modules keep their before folder even when the current graph has no node for them.
export function architectureImpact(graph, changes) {
  const modules = new Map(), folders = new Set(), beforeNames = new Set(), afterNames = new Set();
  const priority = { changed: 0, "uses an interface that changes": 1, "uses an interface that is removed": 2 };
  const mark = (id, why = "changed") => {
    if (!modules.has(id) || priority[why] > priority[modules.get(id).why]) modules.set(id, { id, why, breaks: why !== "changed" });
  };
  const keepFolder = (folder) => { if (folder) folders.add(folder.endsWith("/") ? folder : `${folder}/`); };
  for (const { path, before, after } of changes) {
    const schema = path.startsWith("docs/architecture/ARC-") ? artifactSchemas().decision : artifactSchemas().module;
    const old = before === null ? null : readDocument(schema, path, before);
    const next = after === null ? null : readDocument(schema, path, after);
    const id = (next ?? old).id;
    for (const [text, names] of [[before, beforeNames], [after, afterNames]]) {
      for (const place of identifiersIn(path, text)) if (["requirement", "UC"].includes(place.kind)) names.add(place.id);
    }
    if (schema === artifactSchemas().decision) {
      for (const module of [...listOf(old?.fields.designs), ...listOf(next?.fields.designs)]) mark(module);
      for (const edge of graph.edges) {
        if (edge.via === "follows" && edge.to === id) mark(edge.from);
        if (edge.via === "designs" && edge.from === id) mark(edge.to);
      }
    } else {
      mark(id);
      keepFolder(old?.fields.folder);
      keepFolder(next?.fields.folder);
      const was = interfaceDeclarations(old), now = interfaceDeclarations(next);
      const provided = listOf(next?.fields.provides);
      for (const name of listOf(old?.fields.provides)) {
        const removed = !provided.includes(name);
        if (!removed && was.get(name) === now.get(name)) continue;
        for (const edge of graph.edges) {
          if (edge.via === "uses" && edge.interface === name && edge.to === `${id}.${name}`) {
            mark(edge.from, removed ? "uses an interface that is removed" : "uses an interface that changes");
          }
        }
      }
    }
  }
  for (const id of modules.keys()) keepFolder(graph.nodes.get(id)?.folder);
  const tests = unique(graph.edges.filter((edge) => edge.via === "exercises" && modules.has(edge.to)).map((edge) => edge.from));
  const guardsOf = new Map(tests.map((id) => [id, []]));
  for (const edge of graph.edges) if (edge.via === "guards") guardsOf.get(edge.from)?.push(edge.to);
  return {
    modules: [...modules.values()].sort((a, b) => priority[b.why] - priority[a.why] || byText(a.id, b.id)),
    codeFiles: unique(graph.files.filter((path) => isCodePath(path) && [...folders].some((folder) => path.startsWith(folder)))),
    tests: tests.map((id) => ({ id, guards: unique(guardsOf.get(id)) })),
    named: { added: unique([...afterNames].filter((name) => !beforeNames.has(name))),
      removed: unique([...beforeNames].filter((name) => !afterNames.has(name))) },
    items: unique(graph.edges.filter((edge) => edge.via === "changes" && modules.has(edge.to)).map((edge) => edge.from)),
  };
}

// The edges that name a requirement or a use case and match neither: a `realises`, a `forced_by` or a `guards` whose name is no
// requirement of the SPEC and no use case, in the order the graph holds them. coverageGaps lists their names, and graphFindings
// (checks.mjs) reports each as an error. A name merely written in a text, a `names` edge, is stated nowhere and is none.
const NAMING = new Set(["realises", "forced_by", "guards"]);
const MATCHED = new Set(["requirement", "UC"]);
export const unmatchedNames = (graph) =>
  graph.edges.filter((edge) => NAMING.has(edge.via) && !MATCHED.has(graph.nodes.get(edge.to)?.kind));

const idsOf = (graph, kind) => [...graph.nodes.values()].filter((node) => node.kind === kind).map((node) => node.id).sort(byText);
// The names the artifacts of one kind state under one edge.
const namedBy = (graph, kind, via) =>
  new Set(graph.edges.filter((edge) => edge.via === via && graph.nodes.get(edge.from)?.kind === kind).map((edge) => edge.to));

// coverageGaps(graph: Graph) -> Gaps — what the dashboard shows and the recipe chosen-requirements reads (UNREALISED REQUIREMENTS ARE
// REPORTED, NOT FORBIDDEN; none of it blocks anything): the requirements of the SPEC that no use case realises and — once the
// graph holds a module, or a test — that no module realises, that no test guards; the use cases that realise no requirement, one
// that names only unknown names among them; and every name that matches no requirement or use case, with the artifact, the file
// and the line of each place that states it. A requirement is realised by a use case or a module, and guarded by a test, only by
// the edge that names it itself: a test that guards a use case guards nothing the use case realises. Every list is sorted — the
// requirements and the use cases by name, the unknown names by name, who states one by identifier — so that it does not depend on
// the order in which the repository lists its files.
export function coverageGaps(graph) {
  const requirements = idsOf(graph, "requirement");
  const without = (named) => requirements.filter((name) => !named.has(name));
  const holds = (kind) => [...graph.nodes.values()].some((node) => node.kind === kind);
  const realising = new Set(graph.edges
    .filter((edge) => edge.via === "realises" && graph.nodes.get(edge.to)?.kind === "requirement").map((edge) => edge.from));
  const unknown = new Map();
  for (const edge of unmatchedNames(graph)) {
    unknown.set(edge.to, [...(unknown.get(edge.to) ?? []), { id: edge.from, path: edge.path, line: edge.line }]);
  }
  return {
    requirementsWithoutUseCase: without(namedBy(graph, "UC", "realises")),
    requirementsWithoutModule: holds("MOD") ? without(namedBy(graph, "MOD", "realises")) : [],
    requirementsWithoutTest: holds("TST") ? without(namedBy(graph, "TST", "guards")) : [],
    useCasesWithoutRequirement: idsOf(graph, "UC").filter((id) => !realising.has(id)),
    unknownNames: [...unknown].sort(([a], [b]) => byText(a, b))
      .map(([name, places]) => ({ name, namedBy: places.sort((a, b) => byText(a.id, b.id)) })),
  };
}

// moduleOrder(graph: Graph) -> { order: string[] } | { cycle: string[] } — the modules in an order in which every module stands after every
// module whose interfaces it uses, or the modules of a cycle when there is one (A RUN FOLLOWS THE MODULES' INTERFACES). It reads the
// graph's module nodes and its `uses` edges, whose `to` is `MOD-<slug>.<name>`: the module is the part before the dot. A use of a module
// the graph holds no node for orders nothing, graphFindings reports it. Modules that do not use each other stand in the order of their
// identifiers, which the interface does not promise. A cycle is the modules of one cycle in the order of the uses, each using the next and
// the last using the first, beginning with the first by identifier; a module that merely stands after a cycle is not in it.
export function moduleOrder(graph) {
  const modules = idsOf(graph, "MOD");
  const uses = new Map(modules.map((id) => [id, new Set()]));
  for (const edge of graph.edges) {
    const used = edge.to.split(".")[0];
    if (edge.via === "uses" && uses.has(edge.from) && uses.has(used)) uses.get(edge.from).add(used);
  }
  const order = [], placed = new Set();
  for (;;) {
    const ready = modules.filter((id) => !placed.has(id) && [...uses.get(id)].every((used) => placed.has(used)));
    if (ready.length === 0) break;
    ready.forEach((id) => { order.push(id); placed.add(id); });
  }
  if (order.length === modules.length) return { order };
  // Every module left uses a module that is left, so following the first of those from the first module left comes back to a module on the way.
  const next = (id) => [...uses.get(id)].filter((used) => !placed.has(used)).sort(byText)[0];
  const walk = [];
  let at = modules.find((id) => !placed.has(id));
  while (!walk.includes(at)) { walk.push(at); at = next(at); }
  const loop = walk.slice(walk.indexOf(at)), first = loop.indexOf([...loop].sort(byText)[0]);
  return { cycle: [...loop.slice(first), ...loop.slice(0, first)] };
}

// moduleRows(graph: Graph) -> { rows: ModuleRow[], gaps: ModuleGap[] } — one row per module, as UC-025 shows it, and the gaps (MODULE GAPS
// ARE REPORTED, NOT FORBIDDEN; none blocks anything). A row: the module; its `subsystem`, the decision its file follows, null where it
// follows none; the requirements its tests guard (`realises`), the tests being those that exercise it; the path of the file that
// describes it; its code, the code files whose path begins with its folder (the longest folder where two begin it); its tests; the
// modules its code files import; and whether the imports of all its code files could be read (`importsRead`). Rows come by module, gaps
// by kind, artifact and text. A gap: its `kind`, the `artifact` it concerns, the `path` of that artifact's file and `what` is missing.
const GAPS = {
  noSubsystem: "module-in-no-subsystem", notNamed: "subsystem-does-not-name-module", realisesNothing: "realises-nothing",
  noModule: "requirement-without-module", noTest: "module-without-test", noCode: "module-without-code",
  codeOutside: "code-without-module", importNotUsed: "import-not-in-uses", folderInside: "module-folder-inside-another",
  unknownName: "unknown-name", folderNamed: "folder-named-by-no-module",
};
// A name a module or a test states that matches no requirement, use case, decision or module (UC-025 step 4); for `uses` the module
// before the dot.
const NAME_VIAS = new Set(["realises", "forced_by", "guards", "follows", "uses"]);
const NAME_KINDS = new Set(["requirement", "UC", "ARC", "MOD"]);
// The `imports` edges of the graph from a code file to a module that the file's own module names no interface of among its `uses` (a `uses` entry of that module, before the dot): { edge, own }, `own` the module of the
// importing file, in the order of the edges. A file in no module's folder has none. The one decision both moduleRows (as a gap) and graphFindings (as a finding) make.
export function importsNotNamed(graph) {
  const moduleOf = moduleFinder([...graph.nodes.values()].filter((node) => node.kind === "MOD" && node.folder));
  const used = new Set(graph.edges.filter((edge) => edge.via === "uses").map((edge) => `${edge.from} ${edge.to.split(".")[0]}`));
  return graph.edges.filter((edge) => edge.via === "imports").flatMap((edge) => {
    const own = moduleOf(edge.from);
    return own === null || used.has(`${own} ${edge.to}`) ? [] : [{ edge, own }];
  });
}

export function moduleRows(graph) {
  const nodes = [...graph.nodes.values()];
  const modules = nodes.filter((node) => node.kind === "MOD").sort((a, b) => byText(a.id, b.id));
  const moduleOf = moduleFinder(modules.filter((module) => module.folder));
  const edgesVia = (via, from) => graph.edges.filter((edge) => edge.via === via && (from === undefined || edge.from === from));
  const codeOf = new Map(modules.map((module) => [module.id, []]));
  const codeOutside = [];
  for (const file of nodes.filter((node) => node.kind === "code").sort((a, b) => byText(a.path, b.path))) {
    const own = moduleOf(file.path);
    (own === null ? codeOutside : codeOf.get(own)).push(file.path);
  }
  const imported = edgesVia("imports");
  const rows = modules.map((module) => {
    const code = codeOf.get(module.id);
    const tests = unique(graph.edges.filter((edge) => edge.via === "exercises" && edge.to === module.id).map((edge) => edge.from));
    return {
      module: module.id,
      subsystem: edgesVia("follows", module.id).map((edge) => edge.to).find((to) => graph.nodes.get(to)?.kind === "ARC") ?? null,
      realises: unique(edgesVia("guards").filter((edge) => tests.includes(edge.from) && graph.nodes.get(edge.to)?.kind === "requirement").map((edge) => edge.to)),
      describedBy: module.path,
      code,
      tests,
      imports: unique(imported.filter((edge) => code.includes(edge.from)).map((edge) => edge.to)),
      importsRead: code.every(readsImports),
    };
  });

  const gaps = [];
  const gap = (kind, artifact, path, what) => gaps.push({ kind, artifact, path, what });
  const designed = new Set(edgesVia("designs").map((edge) => `${edge.from} ${edge.to}`));
  const where = (folder) => folder.replace(/\/+$/, "");
  for (const row of rows) {
    const module = graph.nodes.get(row.module);
    if (row.subsystem === null) gap(GAPS.noSubsystem, row.module, module.path, `${row.module} follows no decision, so it is in no subsystem`);
    else if (!designed.has(`${row.subsystem} ${row.module}`)) {
      gap(GAPS.notNamed, row.module, module.path, `${row.module} follows ${row.subsystem}, which does not name it among the modules it designs`);
    }
    if (row.realises.length === 0) gap(GAPS.realisesNothing, row.module, module.path, `${row.module} realises no requirement`);
    if (row.tests.length === 0) gap(GAPS.noTest, row.module, module.path, `no test exercises ${row.module}`);
    if (row.code.length === 0) gap(GAPS.noCode, row.module, module.path, `${row.module} has no code file in its folder`);
    const outer = module.folder && modules.find((other) => other !== module && other.folder && where(module.folder).startsWith(`${where(other.folder)}/`));
    if (outer) gap(GAPS.folderInside, row.module, module.path, `the folder ${module.folder} of ${row.module} lies inside the folder ${outer.folder} of ${outer.id}`);
  }
  const realised = new Set(rows.flatMap((row) => row.realises));
  for (const requirement of nodes.filter((node) => node.kind === "requirement")) {
    if (!realised.has(requirement.id)) gap(GAPS.noModule, requirement.id, requirement.path, `no module realises ${requirement.id}`);
  }
  for (const path of codeOutside) gap(GAPS.codeOutside, path, path, `${path} lies in the folder of no module`);
  for (const folder of unique(codeOutside.filter((path) => path.includes("/")).map((path) => path.slice(0, path.lastIndexOf("/"))))) {
    gap(GAPS.folderNamed, folder, folder, `no module names the folder ${folder}, which holds code files`);
  }
  const reported = new Set();
  for (const { edge, own } of importsNotNamed(graph)) {
    const key = `${edge.from} ${edge.to}`;
    if (reported.has(key)) continue;
    reported.add(key);
    gap(GAPS.importNotUsed, edge.from, edge.from, `${edge.from} imports ${edge.to}, which the file of ${own} does not name among the interfaces it uses`);
  }
  for (const edge of graph.edges) {
    if (!NAME_VIAS.has(edge.via) || NAME_KINDS.has(graph.nodes.get(edge.via === "uses" ? edge.to.split(".")[0] : edge.to)?.kind)) continue;
    gap(GAPS.unknownName, edge.from, edge.path, `${edge.via} "${edge.to}" matches no requirement, use case, decision or module`);
  }
  gaps.sort((a, b) => byText(a.kind, b.kind) || byText(a.artifact, b.artifact) || byText(a.what, b.what));
  return { rows, gaps };
}

// compareGraphs(earlier: Graph, later: Graph) -> Comparison — the requirements added, changed and removed between two versions, and the coverage gained
// and lost (UC-020). A requirement is added where only `later` holds it, removed where only `earlier` does, and changed where both hold it and what its
// node keeps differs but for its line, which moves whenever a requirement above it is added or removed: the graph keeps of a requirement no text, only
// the items of its source. A requirement is covered, as coverageGaps counts it, by a use case's or a module's `realises` and a test's `guards`: the
// coverage is one { name, by } for each requirement and each artifact that covers it, gained where only `later` has it and lost where only `earlier` has.
// The requirements come by name, the coverage by name and then by the artifact.
const COVERING = { realises: new Set(["UC", "MOD"]), guards: new Set(["TST"]) };
export function compareGraphs(earlier, later) {
  const requirementsOf = (graph) => new Map([...graph.nodes.values()].filter((node) => node.kind === "requirement").map((node) => [node.id, node]));
  const kept = ({ line, ...facts }) => JSON.stringify(facts);
  const before = requirementsOf(earlier), after = requirementsOf(later);
  const coverageOf = (graph, names) => new Map(graph.edges
    .filter((edge) => COVERING[edge.via]?.has(graph.nodes.get(edge.from)?.kind) && names.has(edge.to))
    .map((edge) => [`${edge.to}\0${edge.from}`, { name: edge.to, by: edge.from }]));
  const was = coverageOf(earlier, before), now = coverageOf(later, after);
  const only = (these, those) => [...these].filter(([key]) => !those.has(key)).sort(([a], [b]) => byText(a, b)).map(([, entry]) => entry);
  return {
    requirements: {
      added: unique([...after.keys()].filter((name) => !before.has(name))),
      changed: unique([...after.keys()].filter((name) => before.has(name) && kept(before.get(name)) !== kept(after.get(name)))),
      removed: unique([...before.keys()].filter((name) => !after.has(name))),
    },
    coverage: { gained: only(now, was), lost: only(was, now) },
  };
}
