// The findings of a backlog (docs/architecture/MOD-work-plans.md, Interfaces: backlogFindings; A BACKLOG ITEM NAMES WHAT IT
// REALISES, A BACKLOG ITEM NAMES THE MODULES IT CHANGES; UC-032 step 3). Pure: the items and the architecture's module files are
// handed in as Documents; nothing is read, written or requested.
//
// Module: MOD-work-plans
//
// An item is a Document as MOD-documents' readDocument gives it for the item schema — `id`, `path`, and `fields` holding `title`,
// `realises`, `modules` and `builds_on` — and the architecture a list of Documents of which those of kind `module` are the
// module files. A Document carries no line for a front matter field, so every finding names line 1, where the front matter
// begins. A finding is MOD-text-tools' `finding`.

import { classifyCandidates } from "../documents/index.mjs";
import { finding } from "../text-tools/index.mjs";
import { graphFindings, traceGraph } from "../trace-graph/index.mjs";

const REALISES = "A BACKLOG ITEM NAMES WHAT IT REALISES";
const MODULES = "A BACKLOG ITEM NAMES THE MODULES IT CHANGES";
// The rule of the item schema (artifactSchemas().item) that no closer part of it names: it applies to builds_on.
const BACKLOG = "THE BACKLOG LIVES IN THE PRODUCT REPOSITORY";
// An item that restates another is found as MOD-documents' classifyCandidates finds an exact duplicate, by the schema's key, the title.
const DUPLICATE = "EXACT DUPLICATES ARE FOUND WITHOUT A MODEL";

const text = (value) => (typeof value === "string" ? value : value === null || value === undefined ? "" : String(value));
// A list as a Document holds it — or as a comma-separated line, where a field was read as text; a blank entry names nothing.
const list = (value) => (Array.isArray(value) ? value.map(text) : text(value).split(","))
  .map((part) => part.trim()).filter(Boolean);
const idOf = (document) => text(document?.id ?? document?.fields?.id);
const fieldList = (document, field) => list(document?.fields?.[field]);
const titleOf = (document) => text(document?.fields?.title ?? document?.title);

// Whether `from` builds on `target`, directly or through any number of items of the backlog.
function buildsOnThrough(byId, from, target) {
  const seen = new Set();
  const queue = [from];
  while (queue.length) {
    const current = queue.pop();
    if (current === target) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    queue.push(...fieldList(byId.get(current), "builds_on"));
  }
  return false;
}

/**
 * backlogFindings(items: Document[], architecture: Document[]) -> Finding[] — for each item in the order given: an error for
 * an item that realises nothing; an error for an item that names no module that a module file of the architecture describes;
 * an error for each item it builds on that is not among `items`; an error for each item it builds on that builds on it in turn;
 * and a warning for an item whose title restates that of another of `items`, naming that one.
 */
export function backlogFindings(items, architecture) {
  const all = items ?? [];
  const byId = new Map(all.filter((item) => idOf(item)).map((item) => [idOf(item), item]));
  const described = new Set((architecture ?? []).filter((file) => file?.kind === "module").map(idOf));
  const out = [];
  for (const item of all) {
    const id = idOf(item);
    const at = (kind, rule, what, fix) => out.push(finding({ artifact: id || text(item.path), line: 1, kind, rule, what, fix }));
    if (!fieldList(item, "realises").length) {
      at("error", REALISES, "the item realises nothing",
        "name at least one requirement or use case the item realises, or remove the item");
    }
    const named = fieldList(item, "modules");
    if (!named.some((name) => described.has(name))) {
      at("error", MODULES, "the item names no module the architecture describes",
        "name the modules of the architecture that the item's implementation changes");
    } else {
      for (const name of named.filter((one) => !described.has(one))) {
        at("error", MODULES, `the item names ${name}, which the architecture does not describe`,
          `name only modules of the architecture, or remove ${name}`);
      }
    }
    for (const on of fieldList(item, "builds_on")) {
      const other = byId.get(on);
      if (!other) {
        at("error", BACKLOG, `the item builds on ${on}, which does not exist`,
          `name an item of the backlog under builds_on, or remove ${on}`);
      } else if (buildsOnThrough(byId, on, id)) {
        at("error", BACKLOG, `the item builds on ${on}, which builds on it in turn`,
          `remove ${id} from the items ${on} builds on, or ${on} from the items ${id} builds on`);
      }
    }
    const [classified] = classifyCandidates(
      [{ ref: id, keys: [titleOf(item)], from: [], proposed: { class: "new", of: null } }],
      all.filter((other) => other !== item).map((other) => ({ id: idOf(other), keys: [titleOf(other)] })),
    );
    if (classified.class === "duplicate") {
      at("warning", DUPLICATE, `the item restates ${classified.of}`,
        `extend ${classified.of} instead, or say how this item differs from it`);
    }
  }
  return out;
}

const ASSEMBLES = "AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES";
const FOLLOWS = "A RUN FOLLOWS THE MODULES' INTERFACES";
const PHASES = "THE MODEL DETERMINES THE PHASES AND THE GATES";
const LEVEL = "A PLAN STEP NAMES THE TESTS OF ITS LEVEL";
const CYCLE = "MODULES DEPEND ON EACH OTHER WITHOUT A CYCLE";

/**
 * planFindings(plan, steps, architecture, workflow, source, history?, graph?) -> Promise<Finding[]> — the findings of an implementation plan (MOD-work-plans, Interfaces):
 * - a module, a subsystem or the system without a step: a step names a module by level `module` and `modules`; a subsystem's integration is a step of level `subsystem` whose `modules` hold
 *   every module its decision designs (a decision that refines the system and designs a module is a subsystem); the system's step has level `system`;
 * - with `history`, a step whose module (or whose subsystem's) file was removed from the architecture, and a step whose module or subsystem file was changed by a commit later than the step's
 *   own last commit (`readHistory` with `changes: false`, newest entry), each naming the file and the step; a step with no history, a drafted one, is not asked about;
 * - a module ordered before one whose interface it uses (`plan`'s order, by the module steps); a subsystem's integration ordered before a step of one of its modules, and the system's step
 *   ordered before any other step (AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES: the modules, "then the integration of each subsystem, then the system");
 * - a step without a phase of the model: absent from the order, or in a phase `workflow.phases` lacks;
 * - of the findings `graphFindings` gives on `traceGraph(source)`, those of the steps' tests of their level and of a cycle among the modules' uses; on `graph`, the graph of the commit, where a caller
 *   whose steps are the commit's own passes it (the plan page), and `source` is then read for no graph.
 * `plan` is the order document, `steps` the step documents, `architecture` the decisions and module files; every finding is an error at line 1.
 */
export async function planFindings(plan, steps, architecture, workflow, source, history, graph) {
  const found = [];
  const add = (artifact, rule, what, fix) => found.push(finding({ artifact, line: 1, kind: "error", rule, what, fix }));
  const decisions = architecture.filter((document) => idOf(document).startsWith("ARC-"));
  const modules = architecture.filter((document) => idOf(document).startsWith("MOD-"));
  const roots = decisions.filter((decision) => !fieldList(decision, "refines").length);
  const subsystems = decisions.filter((decision) => fieldList(decision, "refines").length && fieldList(decision, "designs").length);
  const levelOf = (step) => text(step.fields?.level);
  const moduleSteps = steps.filter((step) => levelOf(step) === "module");

  for (const module of modules) {
    if (!moduleSteps.some((step) => fieldList(step, "modules").includes(idOf(module)))) add(idOf(module), ASSEMBLES, `${idOf(module)} has no step`, `add a step of level module for ${idOf(module)}`);
  }
  for (const subsystem of subsystems) {
    const designed = fieldList(subsystem, "designs");
    if (!steps.some((step) => levelOf(step) === "subsystem" && designed.every((name) => fieldList(step, "modules").includes(name)))) {
      add(idOf(subsystem), ASSEMBLES, `the subsystem ${idOf(subsystem)} has no step for its integration`, `add a step of level subsystem for ${idOf(subsystem)}, naming ${designed.join(", ")}`);
    }
  }
  if (!steps.some((step) => levelOf(step) === "system")) {
    add(roots[0] ? idOf(roots[0]) : "the system", ASSEMBLES, `the system${roots[0] ? ` (${idOf(roots[0])})` : ""} has no step`, "add a step of level system");
  }

  // The order: by the rows of the plan's order document.
  const rows = (plan?.sections ?? []).flatMap((section) => section.rows ?? []);
  const at = new Map(rows.map((row, index) => [text(row.cells?.Step), index]));
  const position = (moduleId) => Math.min(...moduleSteps.filter((step) => fieldList(step, "modules").includes(moduleId)).map((step) => at.get(idOf(step)) ?? Infinity));
  for (const module of modules) {
    for (const used of fieldList(module, "uses").map((entry) => entry.split(".")[0])) {
      const [mine, theirs] = [position(idOf(module)), position(used)];
      if (Number.isFinite(mine) && Number.isFinite(theirs) && mine < theirs) {
        add(idOf(module), FOLLOWS, `${idOf(module)} is ordered before ${used}, whose interface it uses`, `order the step of ${used} before the step of ${idOf(module)}`);
      }
    }
  }
  // The levels in their order: a subsystem's integration after the steps of its modules, the system after every other step.
  const placed = (step) => at.get(idOf(step)) ?? Infinity;
  const later = (step, others) => others.filter((other) => Number.isFinite(placed(step)) && Number.isFinite(placed(other)) && placed(step) < placed(other)).map(idOf);
  for (const integration of steps.filter((step) => levelOf(step) === "subsystem")) {
    const after = later(integration, moduleSteps.filter((step) => fieldList(step, "modules").some((name) => fieldList(integration, "modules").includes(name))));
    if (after.length) add(idOf(integration), ASSEMBLES, `the integration ${idOf(integration)} is ordered before ${after.join(", ")}, the steps of its modules`, `order ${idOf(integration)} after ${after.join(", ")}`);
  }
  for (const system of steps.filter((step) => levelOf(step) === "system")) {
    const after = later(system, steps.filter((step) => levelOf(step) !== "system"));
    if (after.length) add(idOf(system), ASSEMBLES, `the system's step ${idOf(system)} is ordered before ${after.join(", ")}`, `order ${idOf(system)} after every other step`);
  }

  // The phases: every step has one, of the model.
  const known = new Set((workflow?.phases ?? []).map((phase) => text(phase.name)));
  const phaseOf = new Map(rows.map((row) => [text(row.cells?.Step), text(row.cells?.Phase)]));
  for (const step of steps) {
    const phase = phaseOf.get(idOf(step));
    if (!phase) add(idOf(step), PHASES, `${idOf(step)} is in no phase: the order does not place it`, `put ${idOf(step)} in the order, in a phase of the model`);
    else if (!known.has(phase)) add(idOf(step), PHASES, `${idOf(step)} is in the phase ${phase}, which the model lacks`, `use a phase of the model: ${[...known].join(", ")}`);
  }

  // The checks of the graph, on the product's files with the steps in place.
  const stepIds = new Set(steps.map(idOf));
  for (const each of graphFindings(graph ?? await traceGraph(source))) {
    if ((each.rule === LEVEL && stepIds.has(each.artifact)) || each.rule === CYCLE) found.push(each);
  }

  // The history: a step is stale once the file it implements was removed or changed after it.
  if (history?.host) {
    const exists = new Map(modules.map((module) => [idOf(module), module]));
    const newest = async (path) => (await history.host.readHistory(path, { limit: 1, changes: false }))[0]?.date ?? null;
    for (const step of steps) {
      if (!["module", "subsystem"].includes(levelOf(step))) continue;
      const files = [];
      for (const name of fieldList(step, "modules")) {
        if (!exists.has(name)) add(idOf(step), ASSEMBLES, `the file docs/architecture/${name}.md of the step ${idOf(step)} was removed from the architecture`, `remove or change the step ${idOf(step)}`);
        else files.push(text(exists.get(name).path));
      }
      if (levelOf(step) === "subsystem") {
        const designed = fieldList(step, "modules");
        const decision = subsystems.find((each) => designed.every((name) => fieldList(each, "designs").includes(name)));
        if (decision) files.push(text(decision.path));
      }
      const stepDate = step.path ? await newest(text(step.path)) : null;
      if (!stepDate) continue;
      for (const file of files) {
        const fileDate = await newest(file);
        if (fileDate && Date.parse(fileDate) > Date.parse(stepDate)) {
          add(idOf(step), ASSEMBLES, `${file} was changed after the step ${idOf(step)}`, `check the step ${idOf(step)} against ${file}, then draft the plan again or edit the step`);
        }
      }
    }
  }
  return found;
}
