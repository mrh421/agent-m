// inputs.mjs — the recipe of `runStrategies` (MOD-run-planner, Parts: inputs.mjs; Interfaces: runStrategies): the inputs of an implementation job, `implementation-inputs`
// (UC-024 step 4).
//
// Module: MOD-run-planner
//
// The recipe reads the product through the job's snapshot, once, as the trace graph of MOD-trace-graph: the graph holds the plan steps and backlog items with their modules (`changes`
// edges) and level, the decisions with what they refine and design, the modules with what they follow and use, and the tests with the module they exercise (`exercises` edges). It makes
// no request of its own; the snapshot reads what the host holds. Part, JobContext and Strategies are MOD-job-runner's types.
//
// The product's coding standards file is not part of it: the accepted text names no path for one.

import { systemDecisions, traceGraph } from "../trace-graph/index.mjs";

const SPEC = "SPEC.md";
const INTERFACES = "## Interfaces";

// A failure of the module's own, by name.
const failure = (name, message, fields) => Object.assign(new Error(message), { name, ...fields });

const trimmed = (folder) => folder.replace(/^\/+/, "").replace(/\/+$/, "");
const within = (path, place) => path === trimmed(place) || path.startsWith(`${trimmed(place)}/`);
const unique = (values) => [...new Set(values)];

// The `## Interfaces` section of a module file: its heading line up to the next heading of level two, without the blank lines at its end.
function interfacesOf(text) {
  const rows = text.split("\n");
  const start = rows.indexOf(INTERFACES);
  if (start < 0) return "";
  let end = rows.findIndex((row, at) => at > start && row.startsWith("## "));
  if (end < 0) end = rows.length;
  const section = rows.slice(start, end);
  while (section.length > 1 && section[section.length - 1].trim() === "") section.pop();
  return `${section.join("\n")}\n`;
}

/**
 * The recipe implementation-inputs(context, params) -> Part[] — for each step (`params.steps`) or backlog item (`params.items`), in that order, as UC-024 step 4 gives it:
 * - a module step or an item, and each module `params.modules` names (after the steps and items), for each of its modules (the item's `modules`): the module's file; the decisions it follows and then the decision that refines no other; SPEC.md; the
 *   `## Interfaces` section alone of the file of each module it uses; the files under its folder; the test files with an `exercises` edge to it;
 * - a subsystem's integration: the subsystem's decision (the one that designs the step's modules), then for each module it designs the module's file, its files and its tests;
 * - the system: the decision that refines no other, the decisions that refine it and design modules, and the use cases.
 * A part is one file, named by its path (the interfaces of a file: `<path> ## Interfaces`), given once; it carries the sources of every `context.places.contents` entry that names its
 * path or a folder above it. Throws NoWorkNamed for params naming no step, no item and no module, and UnknownWork { id } for a name that is no step, item or module of the product's files.
 */
async function implementationInputs(context, params) {
  const names = [params?.steps ?? [], params?.items ?? []].flat().map(String);
  const named = (params?.modules ?? []).map(String);
  if (names.length === 0 && named.length === 0) throw failure("NoWorkNamed", "an implementation job names the steps, the items or the modules it implements");
  const snapshot = context.product.snapshot;
  const graph = await traceGraph(snapshot);
  const known = (id, kind) => {
    const node = graph.nodes.get(id);
    if (!node || node.kind !== kind) throw failure("UnknownWork", `${id} is no ${kind === "ITM" ? "step or item" : kind === "MOD" ? "module" : "decision"} of this product`, { id });
    return node;
  };
  const from = (id, via) => graph.edges.filter((edge) => edge.from === id && edge.via === via);
  const { system, subsystems } = systemDecisions(graph);

  const parts = new Map();
  const give = async (name, path, text) => {
    if (parts.has(name)) return;
    const body = text ?? await snapshot.read(path);
    if (body === null) throw failure("UnknownWork", `${path} is not in the product's files`, { id: path });
    const sources = unique((context.places.contents ?? []).filter(({ paths }) => paths.some((place) => within(path, place))).map(({ source }) => source));
    parts.set(name, { name, text: body, size: 0, sources, required: true });
  };
  const file = (id, kind) => give(known(id, kind).path, known(id, kind).path);
  const filesOf = async (module) => {
    for (const path of snapshot.paths.filter((each) => within(each, known(module, "MOD").folder)).sort()) await give(path, path);
  };
  const testsOf = async (module) => {
    const paths = unique(graph.edges.filter((edge) => edge.via === "exercises" && edge.to === module).map((edge) => edge.path)).sort();
    for (const path of paths) await give(path, path);
  };

  const moduleInputs = async (module) => {
    await file(module, "MOD");
    for (const { to: decision } of from(module, "follows")) await file(decision, "ARC");
    for (const decision of system) await file(decision, "ARC");
    await give(SPEC, SPEC);
    for (const used of unique(from(module, "uses").map((edge) => edge.to.split(".")[0]))) {
      const path = known(used, "MOD").path;
      await give(`${path} ${INTERFACES}`, path, interfacesOf(await snapshot.read(path) ?? ""));
    }
    await filesOf(module);
    await testsOf(module);
  };

  for (const name of names) {
    const work = known(name, "ITM");
    const modules = from(name, "changes").map((edge) => edge.to);
    if (work.level === "system") {
      for (const id of system) await file(id, "ARC");
      for (const id of subsystems) await file(id, "ARC");
      for (const useCase of [...graph.nodes.values()].filter((node) => node.kind === "UC").sort((a, b) => (a.id < b.id ? -1 : 1))) await give(useCase.path, useCase.path);
    } else if (work.level === "subsystem") {
      const designer = [...graph.nodes.values()].find((node) => node.kind === "ARC" && from(node.id, "designs").some((edge) => modules.includes(edge.to)));
      if (!designer) throw failure("UnknownWork", `no decision designs the modules of ${name}`, { id: name });
      await file(designer.id, "ARC");
      for (const { to: module } of from(designer.id, "designs")) {
        await file(module, "MOD");
        await filesOf(module);
        await testsOf(module);
      }
    } else {
      for (const module of modules) await moduleInputs(module);
    }
  }
  for (const module of named) await moduleInputs(module);
  return [...parts.values()];
}

// runStrategies: MOD-job-runner's Partial<Strategies> with the one recipe.
export const runStrategies = { recipes: { "implementation-inputs": implementationInputs } };
