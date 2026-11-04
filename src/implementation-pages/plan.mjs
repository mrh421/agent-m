// The route `plan` — the implementation plan (MOD-implementation-pages, docs/architecture/MOD-implementation-pages.md; Interfaces: view,
// route plan; UC-045 steps 1 and 4, alternative flows 1a and 1b): the architecture's system, subsystems and modules beside the plan's
// steps in the plan's order, each with its derived state and what it waits for, and a Mermaid diagram of the steps and what each waits
// for, drawn through renderMermaid; a folded What is this? (explain). A product whose model works from a backlog has no plan and gets a
// link to the backlog (1a); an architecture file that is open or changed is named, and nothing is planned (1b); a step whose module or subsystem file was changed or removed after the step
// was saved is marked, naming the file, and a module without a step is named (1c, ITM-1036), both from MOD-work-plans' planFindings with the history of the product's host. The marks
// write nothing: the steps stand as they are until the planner saves. *Draft the plan* (UC-045 steps 2 to 5, ITM-1058) runs the job of the kind draft-plan in this tab, attended, from its
// run panel (backlog.mjs' attendedJob); its draft waits for the planner, shown in its order with a Mermaid diagram of the steps and what each comes after, each step to edit, to move up or
// down, to split or to merge with the next; a change of the order after which a module stands before one whose interface it uses — the finding MOD-work-plans' planFindings gives on the
// order — is refused, naming the finding, and the draft stays as it was. *Save plan* hands the draft as the planner left it to MOD-job-runner's writeResult, which writes it through the kind's
// writer plan-steps in one commit, on the default branch read at the click. What the drafting needs only on the click — the run panel's job and writeResult — is imported then. *+ Step*
// (UC-045 2a, ITM-1059) adds an empty step to the plan being edited, and where none is, opens a plan written by hand in the same editor; its *Save plan* writes its steps after those of the
// plan of the default branch read at the click with MOD-work-plans' savePlan, which checks the plan with planFindings first and writes nothing on an error finding, with no provenance line: the
// planner's own input.
//
// Module: MOD-implementation-pages
//
// It reads the declaration and the declared model's file first (modelFirst), the file at the commit the declaration names through the instance's readFileAt: for a model that
// works from a backlog it links the backlog and reads nothing else (UC-045 1a). The route `board` reads them the same way, through modelFirst. The model is the catalogue's
// reading of that file (MOD-model-catalogue's catalogue over the one file); a commit the instance cannot read, or a version that is no commit identifier, leaves the model unknown.
//
// The steps and their states are those MOD-progress-measures' productFacts gives with the scope `work`: it reads the plan (docs/plan/,
// in the order of docs/plan/order.md), the approval statuses, the job records and the pull requests and derives each state with
// MOD-work-plans' itemStates; no state is stored. The architecture comes from MOD-trace-graph's latestGraph — the graph stored for the commit, or, while that is not
// stored yet, the graph stored last, with the line naming both commits above the page; the states and the statuses stay the head's. The system is the
// decision that refines no other, a subsystem one that refines it and designs a module, a module a module file; a module no subsystem
// designs stands under the system. An architecture file is open when MOD-approvals' status of it, in the facts, is not accepted.

import { renderMermaid } from "../markdown-render/index.mjs";
import { productFacts } from "../progress-measures/index.mjs";
import { latestGraph } from "../trace-graph/index.mjs";
import { artifactSchemas, readDocument } from "../documents/index.mjs";
import { catalogue, modelSchema } from "../model-catalogue/index.mjs";
import { declarationSchema, workflowOf } from "../product-process/index.mjs";
import { planFindings, planSchemas, savePlan } from "../work-plans/index.mjs";
import { explain } from "../site-frame/index.mjs";
import { heads } from "./routes.mjs";

const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const idOf = (document) => String(document?.id ?? document?.fields?.id ?? "");
const listOf = (value) => (Array.isArray(value) ? value.map(String) : []);
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const mermaidId = (id) => id.replace(/[^A-Za-z0-9]/g, "_");
// The first element below `root` that carries the attribute.
const placeOf = (root, attribute) => {
  for (const child of root.childNodes) {
    if (child.nodeType !== 1) continue;
    if (child.getAttribute(attribute) !== null) return child;
    const inner = placeOf(child, attribute);
    if (inner) return inner;
  }
  return null;
};
const REVIEWED = new Set(["architecture-decision", "module"]);
const DECLARATION = "docs/process.md";
// The failures with which the instance cannot read the commit a declaration names.
const UNREADABLE = new Set(["NotFound", "TokenRefused", "PermissionMissing", "Unreachable"]);

/**
 * The declared model as the instance held it at the commit the declaration's model_version names, its file read with the instance host's readFileAt and read as the catalogue
 * reads a model: { model: Model | null | "unknown", unread: { commit, error } | null } — null for a file the catalogue does not hold, "unknown" where the commit cannot be read.
 * @param {object} context the route's ViewContext @param {object | null} declaration the product's docs/process.md as a document
 */
export async function declaredModelOf(context, declaration) {
  if (declaration === null) return { model: null, unread: null };
  const file = String(declaration.fields?.model_file ?? ""), version = String(declaration.fields?.model_version ?? "");
  if (!/^[0-9a-f]{40}$/.test(version)) return { model: "unknown", unread: { commit: version, error: "NotFound" } };
  let held;
  try {
    held = (await context.instance.host.readFileAt(file, [version])).get(version) ?? null;
  } catch (error) {
    if (!UNREADABLE.has(error?.name)) throw error;
    return { model: "unknown", unread: { commit: version, error: error.name } };
  }
  const at = { paths: held === null ? [] : [file], read: async (path) => (path === file ? held : null), readMany: async () => {}, blob: () => null };
  return { model: (await catalogue(at)).models.find((each) => each.path === file) ?? null, unread: null };
}

/**
 * The workflow the declaration declares, built with MOD-product-process' workflowOf as the route `process` builds it: the declared model (declaredModelOf), and the practices the declaration names, each read
 * from its file at the commit the declaration names with the instance's readFileAt. The instance's SPEC is given as "": a gate a process requirement adds keeps `addedBy.source` null. -> Workflow | null —
 * null where the model cannot be read or the catalogue holds none at `model_file`. The one reading of it that the routes `plan` and `implement` share.
 * @param {object} context the route's ViewContext @param {object} declaration the product's docs/process.md as a document
 */
export async function declaredWorkflowOf(context, declaration) {
  const { model } = await declaredModelOf(context, declaration);
  if (model === null || model === "unknown") return null;
  const version = String(declaration.fields?.model_version ?? "");
  const names = workflowOf(declaration, model, [], "").practices;
  const none = { paths: [], read: async () => null, readMany: async () => {}, blob: () => null };
  const named = (await catalogue(none)).practices.filter((practice) => names.includes(practice.name));
  const practices = (await Promise.all(named.map(async (practice) => {
    const held = (await context.instance.host.readFileAt(practice.path, [version])).get(version) ?? null;
    return held === null ? null : readDocument(modelSchema.practice, practice.path, held);
  }))).filter(Boolean);
  return workflowOf(declaration, model, practices, "");
}

/**
 * What `plan` and `board` read first: the product's snapshot at the branch shown, its declaration and the declared model (declaredModelOf) -> { ref, snapshot, declaration, model }.
 * @param {object} context the route's ViewContext
 */
export async function modelFirst(context) {
  const { product } = context;
  const ref = product.ref ?? (await product.host.repositoryInfo()).defaultBranch;
  const snapshot = await product.host.readSnapshot(ref);
  const declared = await snapshot.read(DECLARATION);
  const declaration = declared === null ? null : readDocument(declarationSchema, DECLARATION, declared);
  return { ref, snapshot, declaration, ...(await declaredModelOf(context, declaration)) };
}
const ASSEMBLES = "AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES";

const FOLLOWS = "A RUN FOLLOWS THE MODULES' INTERFACES";

// The architecture's decisions and module files of the graph, read from the snapshot as documents with MOD-documents' schemas; null where they could not be read.
async function architectureDocuments(graph, snapshot) {
  try {
    const schemas = artifactSchemas();
    return await Promise.all([...graph.nodes.values()].filter((node) => node.kind === "ARC" || node.kind === "MOD")
      .map(async (node) => readDocument(node.kind === "ARC" ? schemas.decision : schemas.module, node.path, (await snapshot.read(node.path)) ?? "")));
  } catch {
    return null;
  }
}

// The findings of the plan against the architecture as it stands (planFindings with the history of the host): of them those that mark a step whose module or subsystem file was changed or
// removed after it, and a module, subsystem or system without a step. The marks could not be read: none.
async function marksOf(facts, graph, host, architecture) {
  if (architecture === null) return [];
  try {
    const found = await planFindings(facts.plan.order, facts.plan.items, architecture, null, facts.snapshot, { host }, graph);
    return found.filter((each) => each.rule === ASSEMBLES);
  } catch {
    return [];
  }
}

// The architecture of the graph as the page lists it: [{ id, kind, under, title }] — the system, each of its subsystems followed by
// its modules, then the modules no subsystem designs.
function architectureOf(graph) {
  const nodes = [...graph.nodes.values()];
  const from = (id, via) => graph.edges.filter((edge) => edge.from === id && edge.via === via);
  const decisions = nodes.filter((node) => node.kind === "ARC").sort(byId);
  const systems = decisions.filter((node) => from(node.id, "refines").length === 0);
  const modules = nodes.filter((node) => node.kind === "MOD").sort(byId);
  const rows = [];
  const placed = new Set();
  for (const system of systems) {
    rows.push({ id: system.id, kind: "system", under: null, title: system.title });
    const subsystems = decisions.filter((node) => from(node.id, "refines").some((edge) => edge.to === system.id) && from(node.id, "designs").length > 0);
    for (const subsystem of subsystems) {
      rows.push({ id: subsystem.id, kind: "subsystem", under: system.id, title: subsystem.title });
      for (const edge of from(subsystem.id, "designs")) {
        const module = modules.find((node) => node.id === edge.to);
        if (module && !placed.has(module.id)) { placed.add(module.id); rows.push({ id: module.id, kind: "module", under: subsystem.id, title: module.title }); }
      }
    }
    for (const module of modules) {
      if (!placed.has(module.id)) { placed.add(module.id); rows.push({ id: module.id, kind: "module", under: system.id, title: module.title }); }
    }
  }
  return rows;
}

// The flowchart of steps in their order, [{ id, label, after: [id] }]: each node with its label, an edge from each step a step comes after.
function diagramOf(steps) {
  const shown = new Set(steps.map((step) => step.id));
  return ["flowchart TD",
    ...steps.map((step) => `  ${mermaidId(step.id)}["${step.label.replace(/"/g, "'")}"]`),
    ...steps.flatMap((step) => step.after.filter((id) => shown.has(id)).map((id) => `  ${mermaidId(id)} --> ${mermaidId(step.id)}`))].join("\n");
}

// ---------------------------------------------------------------- Draft the plan and Save plan (UC-045 steps 2 to 5)

const KIND = "draft-plan";
const ORDER = "docs/plan/order.md";
const el = (name, className, ...children) => {
  const made = document.createElement(name);
  if (className) made.className = className;
  made.append(...children);
  return made;
};
const failed = (failure) => `${failure?.name ?? "Error"}: ${failure?.message ?? failure}`;
// A finding of a cycle in the modules' uses gets the link to the page of the architecture, where the planner changes it (UC-045 3a, UC-023); `href` is that page, the product kept.
const CYCLE = "MODULES DEPEND ON EACH OTHER WITHOUT A CYCLE";
const architectureLink = (href) => {
  const link = el("a", null, "Change the architecture");
  link.setAttribute("href", href);
  return link;
};
const findingLine = (found, href) => el("li", found.kind, `${found.kind}: ${found.what} — ${found.fix} [${found.rule}]`, ...(found.rule === CYCLE ? [" ", architectureLink(href)] : []));
// The page of the architecture beside the product shown, in the form `chosenProduct` reads back; the instance's own page keeps no product (as progress.mjs' jobHref).
const architectureHref = (context) => {
  const product = context.product?.address;
  return `#arc${product && product !== `https://github.com/${context.instance?.repository}` ? `/product=${encodeURIComponent(product)}` : ""}`;
};
const namesIn = (typed) => (Array.isArray(typed) ? typed.map(String) : String(typed ?? "").split(",")).map((part) => part.trim()).filter(Boolean);
const unique = (names) => [...new Set(names)];
// The fields of a drafted step as the answer of the kind draft-plan holds them, the lists among them typed as names separated by commas.
const FIELDS = [["title", "Title"], ["implements", "Implements"], ["level", "Tests of the level"], ["phase", "Phase"], ["after", "After"]];
const LISTS = new Set(["implements", "after"]);
const WHAT_DRAFT = `<details class="explain"><summary>What is this?</summary><div><p><em>Draft the plan</em> asks the participant you choose to draft the plan from the bottom up: a step per
  module, a module after every module whose interface it uses, then each subsystem's integration, then the system, each with the tests of its level. The run panel names the participant, where it
  processes data and what it receives — the architecture, the process model and the existing plan. The draft waits for you: you edit its steps, move them up or down, split or merge them; a move
  that puts a module before one whose interface it uses is refused and named. <em>Save plan</em> commits one file per step under <code>docs/plan/</code> and their order, as you left them
  (UC-045).</p></div></details>`;

// The diagram's steps of a draft: each by its place, labelled with its place and title, after the steps whose titles it names.
const draftNodes = (entries) => {
  const placeOf_ = new Map(entries.map((entry, at) => [entry.title, `S${at + 1}`]));
  return entries.map((entry, at) => ({ id: `S${at + 1}`, label: `${at + 1}. ${entry.title}`, after: entry.after.map((title) => placeOf_.get(title)).filter(Boolean) }));
};

// The findings MOD-work-plans' planFindings gives on the order of drafted steps: a module ordered before one whose interface it uses. A step is named by its place; one that implements modules
// only is of the level module.
async function orderFindings(entries, architecture, graph) {
  const steps = entries.map((entry, at) => ({ id: `S${at + 1}`,
    fields: { level: entry.implements.length && entry.implements.every((name) => name.startsWith("MOD-")) ? "module" : "integration", modules: entry.implements } }));
  const order = { sections: [{ rows: steps.map((step, at) => ({ cells: { Step: step.id, Phase: entries[at].phase } })) }] };
  return (await planFindings(order, steps, architecture, null, null, undefined, graph)).filter((one) => one.rule === FOLLOWS);
}

// The plan being edited (UC-045 step 4, 2a): its steps in their order, each to edit, Up, Down, Split and Merge with next, and the diagram of the steps and what each comes after; a change after which a
// module stands before one whose interface it uses is refused with the findings it adds, and the steps stay as they were. Save plan hands the steps as the planner left them to `save`, which writes them
// -> { commit, files }; a save that fails shows its findings, and Save plan is offered again. `lead` are the lines above the steps. -> { add } — + Step: an empty step after the last.
function editor(place, entries, { architecture, graph, href, lead, save }) {
  const line = (found) => findingLine(found, href);
  const list = el("div", "draft-steps");
  const diagram = el("div");
  diagram.setAttribute("data-draft-diagram", "");
  const refused = el("ul", "findings");
  refused.setAttribute("data-draft-refused", "");
  const saveButton = el("button", "btn primary", "Save plan");
  saveButton.setAttribute("type", "button");
  saveButton.setAttribute("data-save-plan", "");
  const result = el("div");
  result.setAttribute("data-plan-saved", "");
  const drawDiagram = async () => diagram.replaceChildren(await renderMermaid(diagramOf(draftNodes(entries))));
  // A change of the steps: refused, with the findings it adds, where a module would stand before one whose interface it uses; applied otherwise.
  async function change(next) {
    const before = new Set((await orderFindings(entries, architecture, graph)).map((one) => one.what));
    const added = (await orderFindings(next, architecture, graph)).filter((one) => !before.has(one.what));
    refused.replaceChildren(...added.map(line));
    if (added.length) return;
    entries = next;
    await show();
  }
  const button = (label, attribute, act) => {
    const made = el("button", "btn", label);
    made.setAttribute("type", "button");
    made.setAttribute(attribute, "");
    made.addEventListener("click", () => act().catch((failure) => refused.replaceChildren(el("li", "error", failed(failure)))));
    return made;
  };
  function box(entry, at) {
    const fields = FIELDS.map(([key, label]) => {
      const input = el("input");
      input.setAttribute("data-step-field", key);
      input.value = LISTS.has(key) ? entry[key].join(", ") : entry[key];
      input.addEventListener("input", () => {
        entry[key] = LISTS.has(key) ? namesIn(input.value) : String(input.value ?? "").trim();
        drawDiagram().catch(() => {});
      });
      return el("p", null, el("label", null, `${label} `, input));
    });
    const moved = (to) => () => {
      if (to < 0 || to >= entries.length) return Promise.resolve();
      const next = [...entries];
      [next[at], next[to]] = [next[to], next[at]];
      return change(next);
    };
    const split = () => change([...entries.slice(0, at + 1), { ...entry, title: `${entry.title} (2)`, implements: [...entry.implements], after: [...entry.after] }, ...entries.slice(at + 1)]);
    const merge = () => {
      const second = entries[at + 1];
      if (!second) return Promise.resolve();
      const merged = { ...entry, implements: unique([...entry.implements, ...second.implements]),
        after: unique([...entry.after, ...second.after]).filter((title) => title !== entry.title && title !== second.title) };
      return change(entries.filter((_, index) => index !== at + 1).map((each, index) => (index === at ? merged
        : { ...each, after: unique(each.after.map((title) => (title === second.title ? entry.title : title))) })));
    };
    const made = el("section", "panel draft", el("h4", null, `Step ${at + 1}`), ...fields,
      el("p", null, button("Up", "data-step-up", moved(at - 1)), " ", button("Down", "data-step-down", moved(at + 1)), " ", button("Split", "data-step-split", split), " ",
        button("Merge with next", "data-step-merge", merge)));
    made.setAttribute("data-draft-step", String(at));
    return made;
  }
  async function show() {
    list.replaceChildren(...entries.map(box));
    await drawDiagram();
  }
  saveButton.addEventListener("click", async (event) => {
    if (event?.isTrusted !== true || saveButton.disabled) return;
    saveButton.disabled = true;
    result.replaceChildren();
    try {
      const written = await save(entries.map(({ title, implements: names, level, phase, after }) => ({ title, implements: names, level, phase, after })));
      result.replaceChildren(el("p", "plan-saved", `Saved the plan, commit ${String(written.commit ?? "").slice(0, 7)}: ${(written.files ?? []).join(", ")}`));
    } catch (failure) {
      saveButton.disabled = false;
      result.replaceChildren(el("p", "warn", `The plan is not saved: ${failed(failure)}`),
        ...(failure?.findings?.length ? [el("ul", "findings", ...failure.findings.map(line))] : []));
    }
  });
  place.replaceChildren(...lead, list, refused, diagram, el("p", null, saveButton), result);
  const shown = show();
  return { shown, add: () => { entries = [...entries, { title: "", implements: [], level: "", phase: "", after: [] }]; return show(); } };
}

// The draft of a job of draft-plan, waiting for the planner (UC-045 step 4), in the editor, with the findings the job left (3b); Save plan hands the draft as the planner left it to writeResult (step 5),
// on the default branch read at the click. -> the editor, or null where the answer is no drafted plan.
function reviewDraft(place, context, { outcome, prepared, jobContext }, { architecture, graph, href, writeResult }) {
  const answer = Array.isArray(outcome.draft?.steps) ? outcome.draft.steps : null;
  if (answer === null) { place.replaceChildren(el("p", "warn", "The participant's answer could not be read as a drafted plan. Nothing was written.")); return null; }
  const left = outcome.remaining ?? [];
  return editor(place, answer.map((step) => ({ title: String(step.title ?? ""), implements: namesIn(step.implements), level: String(step.level ?? ""), phase: String(step.phase ?? ""), after: namesIn(step.after) })), {
    architecture, graph, href,
    lead: [el("p", "muted", `Drafted by ${prepared.drafter.name}; correction rounds: ${outcome.rounds?.length ?? 0}. Edit, move, split or merge the steps; nothing is written before Save plan.`),
      ...(left.length ? [el("p", "warn", "Findings left after the last round:"), el("ul", "findings", ...left.map((found) => findingLine(found, href)))] : [])],
    save: async (steps) => {
      const { host } = context.product;
      const head = await host.readSnapshot((await host.repositoryInfo()).defaultBranch);
      const written = await writeResult(prepared, { steps }, { result: outcome, context: { ...jobContext, product: { ...jobContext.product, snapshot: head } } });
      return { commit: written.commits?.[0], files: written.files };
    },
  });
}

// A step written by hand as MOD-work-plans' savePlan takes it (UC-045 2a), read as MOD-work-plans reads a drafted step for its writer plan-steps: `implements` names modules (level module), a subsystem's
// decision (level subsystem, integrating it; its modules those the decision designs) or `system` (level system, every module); its tests are the typed level, the system's also release; it realises what
// forces what it implements — a module's `realises` and the `forced_by` of the decisions it follows, a subsystem's decision's `forced_by`, the `forced_by` of the decisions that refine none —, and names
// the same as its origin; `after` names the steps it builds on by their titles, which savePlan replaces with their identifiers. It has no identifier: savePlan gives it the next one no history holds.
function ownStep(entry, architecture) {
  const byId = new Map(architecture.map((document) => [idOf(document), document]));
  const field = (id, name) => listOf(byId.get(id)?.fields?.[name]);
  const ids = [...byId.keys()];
  const system = entry.implements.includes("system");
  const subsystems = entry.implements.filter((name) => name.startsWith("ARC-"));
  const level = system ? "system" : subsystems.length ? "subsystem" : "module";
  const modules = unique(system ? ids.filter((id) => id.startsWith("MOD-")) : subsystems.length ? subsystems.flatMap((id) => field(id, "designs")) : entry.implements);
  const realises = unique(system ? ids.filter((id) => id.startsWith("ARC-") && field(id, "refines").length === 0).flatMap((id) => field(id, "forced_by"))
    : subsystems.length ? subsystems.flatMap((id) => field(id, "forced_by")) : modules.flatMap((id) => [...field(id, "realises"), ...field(id, "follows").flatMap((decision) => field(decision, "forced_by"))]));
  const tests = system ? ["system", "release"] : entry.level ? [entry.level] : [];
  const outcome = system ? `Integrates the system: ${modules.join(", ")}.` : subsystems.length ? `Integrates ${subsystems.join(", ")}: ${modules.join(", ")}.` : `Implements ${modules.join(", ")}.`;
  return { fields: { title: entry.title, level, realises, modules, ...(subsystems.length ? { integrates: subsystems[0] } : {}), ...(entry.after.length ? { builds_on: entry.after } : {}), tests, origin: realises },
    sections: [{ heading: "## Outcome", text: `\n${outcome}\n\n` }, { heading: "## Acceptance", text: `\n${tests.map((one) => `- ${one[0].toUpperCase()}${one.slice(1)} tests.`).join("\n")}\n` }] };
}

// Save plan of a plan written by hand (UC-045 2a): its steps after those of the plan of the default branch read at the click — the order's rows name them by their titles, which savePlan replaces with
// their identifiers —, in one commit through MOD-work-plans' savePlan with the workflow the declaration declares, and no provenance line: the person's own input. -> { commit, files }
async function saveOwn(context, steps, { architecture, declaration }) {
  const { host } = context.product;
  const head = await host.readSnapshot((await host.repositoryInfo()).defaultBranch);
  const held = await head.read(ORDER);
  const order = held === null ? { kind: "plan-order", path: ORDER, fields: {}, body: "", appended: [], sections: [{ heading: "## Order", text: "", rows: [] }] }
    : readDocument(planSchemas.planOrder, ORDER, held);
  const added = steps.filter((step) => step.phase).map((step) => ({ cells: { Step: step.title, Phase: step.phase } }));
  const { commit, written } = await savePlan(host, { steps: steps.map((step) => ownStep(step, architecture)),
    order: { ...order, sections: order.sections.map((section) => (Array.isArray(section.rows) ? { ...section, rows: [...section.rows, ...added] } : section)) }, removed: [] },
  { architecture, workflow: await declaredWorkflowOf(context, declaration), head: head.commit, trailers: [] });
  return { commit, files: written };
}

// Draft the plan (UC-045 step 2): the job of the kind draft-plan from its run panel (backlog.mjs' attendedJob), imported with writeResult on the person's click; its draft waits for the planner, in the
// editor handed to `opened`.
async function draftPlan(place, context, { worksOn, architecture, graph, href, opened }) {
  const [{ attendedJob }, { writeResult }] = await Promise.all([import("./backlog.mjs"), import("../job-runner/index.mjs")]);
  const { host } = context.product;
  await attendedJob(place, context, { kind: KIND, choice: "data-draft-participant", read: async () => ({ head: await host.readSnapshot((await host.repositoryInfo()).defaultBranch) }), worksOn,
    none: "No participant of the instance's register can draft text, so no plan can be drafted. Declare one on the page Participants.",
    drafting: "The participant drafts the plan…", notDrafted: "No plan was drafted",
    drafted: (drafts, result) => {
      const edited = reviewDraft(drafts, context, result, { architecture, graph, href, writeResult });
      opened(edited);
      return edited?.shown.catch((failure) => drafts.replaceChildren(el("p", "warn", failed(failure))));
    } });
}

export const route = {
  ...heads.plan,

  async render(target, context) {
    const { instance, product } = context;
    const note = (html) => { target.innerHTML = `<section class="panel"><h2>Plan</h2>${html}</section>`; };
    const first = await modelFirst(context);
    if (first.declaration === null) {
      note(`<p class="warn">No process model is declared for this product, so there is no plan to show. <a href="#process">Declare one</a>.</p>`);
      return;
    }
    if (first.model === null || first.model === "unknown") {
      note(`<p class="warn">The declared process model could not be read, so there is no plan to show. <a href="#process">Open the declaration</a>.</p>`);
      return;
    }
    if (first.model.kind === "pulled") {
      note(`<p>This product's model, ${h(first.model.name)}, works from a backlog and has no implementation plan. <a href="#backlog">Open the backlog</a>.</p>`);
      return;
    }
    const instanceInfo = await instance.host.repositoryInfo();
    const instanceSnapshot = await instance.host.readSnapshot(instanceInfo.defaultBranch);
    const facts = await productFacts(product.host, instanceSnapshot, (commit) => instance.host.readSnapshot(commit), new Date(), { scope: "work" });

    const open = [...facts.statuses].filter(([, entry]) => REVIEWED.has(entry.kind) && entry.status !== "accepted").sort(([a], [b]) => (a < b ? -1 : 1));
    if (open.length > 0) {
      note(`<p class="warn">The architecture is not accepted, so nothing is planned. Still to accept:</p>
        <ul>${open.map(([path, entry]) => `<li>${h(path)} — ${entry.status === "changed" ? "changed since it was accepted" : "open"}</li>`).join("")}</ul>
        <p class="muted small">Accept it first (<a href="#arc">the architecture</a>).</p>`);
      return;
    }

    const { graph, line } = await latestGraph(facts.snapshot, facts.snapshot.commit);
    const architecture = architectureOf(graph);
    const documents = await architectureDocuments(graph, facts.snapshot);
    const marked = await marksOf(facts, graph, product.host, documents);
    const marksFor = (id) => marked.filter((each) => each.artifact === id);
    const items = new Map(facts.plan.items.map((item) => [idOf(item), item]));
    const steps = facts.plan.states.map((state) => {
      const item = items.get(state.item);
      return { id: state.item, title: String(item?.fields?.title ?? ""), state: state.state, reason: state.reason ?? "", buildsOn: listOf(item?.fields?.builds_on) };
    });

    const tree = architecture.map((row) => `<li data-architecture="${h(row.id)}" data-kind="${row.kind}"${row.under ? ` data-under="${h(row.under)}"` : ""}>`
      + `${h(row.id)}${row.title ? ` — ${h(row.title)}` : ""} <span class="muted small">${row.kind}</span>${marksFor(row.id).map((each) => ` <span class="warn small" data-mark>${h(each.what)}</span>`).join("")}</li>`).join("");
    const table = steps.length === 0 ? `<p class="muted">No plan is saved yet.</p>`
      : `<table class="list"><thead><tr><th>Step</th><th>State</th><th>Waits for</th></tr></thead><tbody>${steps.map((step) => `<tr data-step="${h(step.id)}" data-state="${h(step.state)}">`
        + `<td data-label="Step">${h(step.id)}${step.title ? ` — ${h(step.title)}` : ""}${marksFor(step.id).map((each) => ` <span class="warn small" data-mark>${h(each.what)}</span>`).join("")}</td><td data-label="State">${h(step.state)}</td><td data-label="Waits for" data-waits-for>${h(step.reason)}</td></tr>`).join("")}</tbody></table>`;
    target.innerHTML = `<section class="panel"><h2>Plan</h2>${line ? `<p class="muted small" data-graph-as-of>${h(line)}</p>` : ""}<div data-plan-explain></div>
      <div class="cols"><div><h3>Architecture</h3><ul>${tree}</ul></div><div><h3>Steps</h3>${table}<div data-plan-diagram></div>
      <p><button type="button" class="btn" data-draft-plan>Draft the plan</button> <button type="button" class="btn" data-add-step>+ Step</button></p>${WHAT_DRAFT}<div data-plan-draft></div></div></div></section>`;
    placeOf(target, "data-plan-explain").append(explain("implementation-plan"));
    if (steps.length > 0) placeOf(target, "data-plan-diagram").append(await renderMermaid(diagramOf(steps.map((step) => ({ id: step.id, label: `${step.id} — ${step.state}`, after: step.buildsOn })))));
    // Draft the plan and + Step act only on the person's click. + Step adds a step to the plan being edited — the draft, or one written by hand, which it opens where none is (UC-045 2a).
    const place = placeOf(target, "data-plan-draft");
    let editing = null;
    placeOf(target, "data-draft-plan").addEventListener("click", (event) => {
      if (event?.isTrusted !== true) return;
      editing = null;
      draftPlan(place, context, { worksOn: architecture.map((row) => row.id), architecture: documents ?? [], graph, href: architectureHref(context), opened: (edited) => { editing = edited; } })
        .catch((failure) => place.replaceChildren(el("p", "warn", failed(failure))));
    });
    placeOf(target, "data-add-step").addEventListener("click", (event) => {
      if (event?.isTrusted !== true) return;
      editing ??= editor(place, [], { architecture: documents ?? [], graph, href: architectureHref(context),
        lead: [el("p", "muted", "Your plan, written by hand: + Step adds a step; name what it implements — modules, a subsystem's decision or system —, the level of its tests, its phase and the steps it comes after. Nothing is written before Save plan.")],
        save: (written) => saveOwn(context, written, { architecture: documents ?? [], declaration: first.declaration }) });
      editing.shown.then(() => editing.add()).catch((failure) => place.replaceChildren(el("p", "warn", failed(failure))));
    });
  },
};
