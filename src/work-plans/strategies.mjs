// strategies.mjs — the recipes, checks, step and writers of `workStrategies` (MOD-work-plans, Parts: strategies.mjs; Interfaces: workStrategies). Of it, this file has the recipes
// `architecture-and-model` (UC-045 step 2), `backlog-inputs` (UC-032 step 2) and `sprint-facts` (UC-041 step 2), the checks `plan-checks` (UC-045), `backlog-checks` (UC-032 step 3) and `sprint-record-checks` (UC-041 1a), the step `leave-out-named-modules` (UC-008 step 6) and the writers `plan-steps` (UC-045 5), `backlog-items` (UC-032 4) and `sprint-record` (UC-041 6).
//
// Module: MOD-work-plans
//
// The recipe reads the product through the job's snapshot, once, as the trace graph of MOD-trace-graph: the graph holds the decisions with what they refine and design, and the modules.
// It makes no request of its own; the snapshot reads what the host holds, and the instance at the declared version is read through the instance's host, as workflowOf reads it. It follows the pattern of MOD-run-planner's `implementation-inputs`, which MOD-work-plans does not use and
// does not import. Part, JobContext and Strategies are MOD-job-runner's types.

import { statuses } from "../approvals/index.mjs";
import { artifactSchemas, readDocument, writeDocument } from "../documents/index.mjs";
import { listJobs } from "../job-ledger/index.mjs";
import { provenanceLines } from "../job-runner/index.mjs";
import { declarationSchema, gateSchema, gateStates, productWorkflow } from "../product-process/index.mjs";
import { parseSpec } from "../spec-document/index.mjs";
import { queues } from "../spec-changes/index.mjs";
import { isTestFile, testDeclarations } from "../test-document/index.mjs";
import { systemDecisions, traceGraph } from "../trace-graph/index.mjs";
import { finding } from "../text-tools/index.mjs";
import { backlogFindings, planFindings } from "./checks.mjs";
import { closeSprint, ITEM_FILE, saveItems, savePlan, WorkPlansError } from "./saves.mjs";
import { sprintFacts } from "./facts.mjs";
import { selectionOf as selectionOfRecord } from "./sprints.mjs";
import { planOrderSchema, sprintSchema } from "./schemas.mjs";
import { itemStates } from "./states.mjs";

const PROCESS = "docs/process.md";
const PLAN = "docs/plan";
const WORKFLOW_PART = "phases and gates of the product's workflow";

// A failure of the module's own, by name.
const failure = (name, message, fields) => Object.assign(new Error(message), { name, ...fields });

const within = (path, place) => path === place.replace(/^\/+|\/+$/g, "") || path.startsWith(`${place.replace(/^\/+|\/+$/g, "")}/`);
const unique = (values) => [...new Set(values)];
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
// The sources of every `context.places.contents` entry that names `path` or a folder above it.
const sourcesFor = (context, path) => unique((context.places.contents ?? []).filter(({ paths }) => paths.some((place) => within(path, place))).map(({ source }) => source));

/**
 * The recipe architecture-and-model(context, params) -> Part[] — what UC-045 step 2 sends to the drafting participant, one part per file, in this order:
 * - the decision that states the system (the one that refines no other; each, if the product has several), by identifier;
 * - the subsystems' decisions (those that refine it and design at least one module), by identifier;
 * - every module's file, by identifier;
 * - the process model, `docs/process.md`, and then its phases and gates: one part, "phases and gates of the product's workflow", JSON `{ phases, gates }` of the workflow workflowOf gives
 *   from that declaration, carrying the sources of `docs/process.md`;
 * - the existing plan, every file under `docs/plan/`, by path.
 * A file's part is the file, named by its path, whole, given once; it carries the sources of every `context.places.contents` entry that names its path or a folder above it. Throws
 * UnknownWork { id } when the product has no `docs/process.md`, and UnknownWork { id: <model_file> } when the instance holds no model at the declared `model_file` and `model_version`.
 */
async function architectureAndModel(context) {
  const snapshot = context.product.snapshot;
  const graph = await traceGraph(snapshot);
  const nodes = [...graph.nodes.values()];
  const { system: systemIds, subsystems: subsystemIds } = systemDecisions(graph);
  const system = systemIds.map((id) => graph.nodes.get(id));
  const subsystems = subsystemIds.map((id) => graph.nodes.get(id));
  const modules = nodes.filter((node) => node.kind === "MOD").sort(byId);

  const parts = new Map();
  const give = async (path) => {
    if (parts.has(path)) return;
    const text = await snapshot.read(path);
    if (text === null) throw failure("UnknownWork", `${path} is not in the product's files`, { id: path });
    parts.set(path, { name: path, text, size: 0, sources: sourcesFor(context, path), required: true });
  };
  for (const node of [...system, ...subsystems, ...modules]) await give(node.path);
  await give(PROCESS);
  const { declaration, workflow } = await workflowOf(context);
  if (workflow === null) {
    throw failure("UnknownWork", `the product has no workflow: the instance holds no model at ${declaration.fields.model_file} at ${declaration.fields.model_version}, the model and commit it declared`,
      { id: String(declaration.fields.model_file ?? "") });
  }
  parts.set(WORKFLOW_PART, { name: WORKFLOW_PART, text: JSON.stringify({ phases: workflow.phases, gates: workflow.gates }, null, 2), size: 0, sources: sourcesFor(context, PROCESS), required: true });
  for (const path of snapshot.paths.filter((each) => within(each, PLAN)).sort()) await give(path);
  return [...parts.values()];
}

// The product's pull requests as itemStates takes them: "unknown" without a host, or where the host does no server operations (NotSupported).
async function pullRequestsOf(host) {
  if (!host) return "unknown";
  try { return await host.listPullRequests(); } catch (error) { if (error?.name === "NotSupported") return "unknown"; throw error; }
}

const SPRINT_NAME = /^[^/\s]+\/\d+$/;
const ORDER = "docs/plan/order.md";
const PLAN_STEP = /^docs\/plan\/ITM-\d{3,}-[^/]+\.md$/;
const GATE_RECORD = /^docs\/gates\/[^/]+\.md$/;
const CHECKED = /^([^\s@]+)@[0-9a-f]{7,64}$/;
const day = (value) => String(value ?? "").slice(0, 10);

// The blobs the gates check, by path: the product's current blob of each artifact a gate record names.
function checkedBlobs(records, snapshot) {
  const blobs = {};
  for (const record of records) {
    for (const entry of Array.isArray(record.fields.on) ? record.fields.on : []) {
      const path = CHECKED.exec(String(entry))?.[1];
      if (path !== undefined && snapshot.blob(path) !== null) blobs[path] = snapshot.blob(path);
    }
  }
  return blobs;
}

/**
 * The recipe sprint-facts(context, params) -> Part[] — what UC-041 sends to the closer: the sprint is the one the job's parameter `sprint` names, `<team>/<nn>`, and its record
 * docs/backlog/sprints/<team>/<nn>.md must exist (UnknownWork otherwise). Five parts, in this order:
 * - the sprint's record, whole, by its path;
 * - "facts of sprint <name>": `sprintFacts` as JSON, of the product's items (the plan's steps, else the backlog's), its tests with what each guards, the items' states (`itemStates`, with the
 *   workflow `productWorkflow` gives from the declaration, read at the version it names, and with the requirements the SPEC holds as accepted, as Progress derives them), its jobs (`listJobs`, without live states), the branch `test-results` (the host's readSnapshot) and its
 *   pull requests;
 * - "issues of sprint <name>": the issues the host gives (of every state) whose `opened` or `closed` is dated within the sprint's time box, one line each with its address; where the host gives
 *   none, one line saying they were not read, with the reason;
 * - "job records of sprint <name>": the product's jobs that work on an item of the selection, one line each with the job and the path of its record;
 * - "result records of sprint <name>": the records of the branch test-results for the head of each merged pull request of the increment, one line each with its path.
 * Each line of the last three names its source; no mail is read.
 */
async function sprintFactsRecipe(context, params) {
  const { name, path, recordText, facts, issueLines, jobLines, recordLines } = await sprintInputs(context, params);
  const part = (partName, text) => ({ name: partName, text, size: 0, sources: [], required: true });
  return [part(path, recordText), part(`facts of sprint ${name}`, JSON.stringify(facts, null, 2)), part(`issues of sprint ${name}`, issueLines.join("\n")),
    part(`job records of sprint ${name}`, jobLines.length ? jobLines.join("\n") : "none of the product's job records works on an item of the sprint"),
    part(`result records of sprint ${name}`, recordLines.length ? recordLines.join("\n") : "no record of the branch test-results names a head commit of the increment")];
}

// What the recipe sprint-facts reads of the sprint `params.sprint` names, before it makes its parts; the writer sprint-record takes the facts from here, so that the rule stands once.
async function sprintInputs(context, params) {
  const name = String(params?.sprint ?? "");
  if (!SPRINT_NAME.test(name)) throw failure("UnknownWork", `the job names no sprint: its parameter sprint is "${name}", not <team>/<nn>`, { id: name });
  const { snapshot, host, address } = context.product;
  const path = `docs/backlog/sprints/${name}.md`;
  const recordText = await snapshot.read(path);
  if (recordText === null) throw failure("UnknownWork", `${path} is not in the product's files: the sprint ${name} has no record`, { id: path });
  const sprint = readDocument(sprintSchema, path, recordText);

  const planned = snapshot.paths.includes(ORDER) || snapshot.paths.some((each) => PLAN_STEP.test(each));
  const itemPaths = snapshot.paths.filter((each) => (planned ? PLAN_STEP : ITEM_FILE).test(each)).sort();
  const items = await Promise.all(itemPaths.map(async (each) => readDocument(artifactSchemas().item, each, (await snapshot.read(each)) ?? "")));
  const order = snapshot.paths.includes(ORDER) ? readDocument(planOrderSchema, ORDER, (await snapshot.read(ORDER)) ?? "") : null;

  const { workflow } = await workflowOf(context);

  const pullRequests = await pullRequestsOf(host);
  const jobs = await listJobs([{ address, snapshot }], new Map());
  const gates = await Promise.all(snapshot.paths.filter((each) => GATE_RECORD.test(each)).sort().map(async (each) => readDocument(gateSchema, each, (await snapshot.read(each)) ?? "")));
  const states = itemStates(items, order, { statuses: await acceptanceOf(snapshot), queues: await queues(snapshot), jobs, pullRequests, workflow,
    gates: workflow ? gateStates(workflow, gates, checkedBlobs(gates, snapshot)) : [] });

  const tests = (await Promise.all(snapshot.paths.filter(isTestFile).map(async (each) => testDeclarations(each, (await snapshot.read(each)) ?? "")))).flat()
    .map((each) => ({ id: each.id, guards: each.guards ?? [] }));
  let results = { paths: [], read: async () => null };
  if (host) {
    try { results = await host.readSnapshot("test-results"); } catch (error) { if (!["NotFound", "NotSupported"].includes(error?.name)) throw error; }
  }
  const start = day(sprint.fields.start), end = day(sprint.fields.end) || day(context.now.toISOString());
  const within = (date) => date && day(date) >= start && day(date) <= end;
  let sprintIssues = [], issueLines;
  try {
    const issues = host ? await host.listIssues({ state: "all" }) : null;
    if (issues === null) throw failure("NotSupported", "the product has no host");
    sprintIssues = issues.filter((each) => within(each.opened) || within(each.closed));
    issueLines = sprintIssues.map((each) => `- issue #${each.number} ${each.title} — ${each.url}`);
    if (issueLines.length === 0) issueLines = ["none of the product's issues was opened or closed within the time box"];
  } catch (error) {
    if (error?.name !== "NotSupported") throw error;
    issueLines = [`The issues were not read: the product's host gives none (${error.name}).`];
  }
  const facts = await sprintFacts(sprint, { items, tests, states, jobs, results, pullRequests: pullRequests === "unknown" ? [] : pullRequests, issues: sprintIssues });

  const selection = new Set(selectionOfRecord(sprint));
  const jobLines = jobs.filter((row) => (row.record.worksOn ?? []).some((item) => selection.has(item)))
    .map((row) => `- job ${row.record.id} — ${row.record.path} — ${row.state}; works on ${(row.record.worksOn ?? []).join(", ")}`);
  const heads = facts.increment.map((each) => (pullRequests === "unknown" ? null : pullRequests.find((pull) => String(pull.number) === each.pullRequest)?.head)).filter(Boolean);
  const recordLines = unique(heads.flatMap((head) => (results.paths ?? []).filter((each) => each.startsWith(`runs/${head}/`)))).sort().map((each) => `- result record ${each}`);

  return { name, path, recordText, facts, issueLines, jobLines, recordLines };
}

const DECLARED = "THE PROCESS MODEL IS DECLARED PER PRODUCT";
const PLAN_RULE = "THE IMPLEMENTATION PLAN LIVES IN THE PRODUCT REPOSITORY";
const ARCHITECTURE_FILE = /^docs\/architecture\/(?:ARC-\d+-[^/]+|MOD-[^/]+)\.md$/;
const ITEM_ID = /(?:^|\/)(ITM-\d{3,})-/;
const slugOf = (title) => String(title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "step";
const idOfDocument = (document) => String(document.id ?? document.fields?.id ?? "");

// The product's workflow in a job: productWorkflow of its declaration docs/process.md, with the instance read at the version the declaration names and the instance's SPEC; `declaration` and `workflow`
// null where the product declares none, `workflow` null where the instance holds no model at the declared file and version. The one reading of it that architecture-and-model, plan-checks, plan-steps and sprint-facts
// share.
async function workflowOf(context) {
  const declarationText = await context.product.snapshot.read(PROCESS);
  if (declarationText === null) return { declaration: null, workflow: null };
  const declaration = readDocument(declarationSchema, PROCESS, declarationText);
  const instanceAt = (commit) => (context.instance.host ? context.instance.host.readSnapshot(commit) : Promise.resolve(context.instance.snapshot));
  return { declaration, workflow: await productWorkflow(declaration, instanceAt, (await context.instance.snapshot.read("SPEC.md")) ?? "") };
}

// The architecture's decisions and module files at a snapshot, by path, each read with its schema: the one read of them that plan-checks and plan-steps share.
const architectureFiles = async (snapshot) => Promise.all(snapshot.paths.filter((each) => ARCHITECTURE_FILE.test(each)).sort()
  .map(async (each) => readDocument(/\/ARC-/.test(each) ? artifactSchemas().decision : artifactSchemas().module, each, (await snapshot.read(each)) ?? "")));

/**
 * draftedPlan(draft, architecture, idFor) -> { steps: Document[], order: Document } — the steps and the order of a drafted plan, the answer of the kind `draft-plan`, `{ steps: [{ title, implements, level, phase,
 * after }] }`, as Documents of the item and plan-order schemas: the one reading of a drafted plan that plan-checks and plan-steps share. Each entry becomes a step: `implements` names modules (level module), a
 * subsystem's decision (level subsystem, `integrates` that decision, its `modules` those the decision designs) or `system` (level system, every module); its `tests` are the draft's `level`, the system's also
 * `release`; it realises what forces what it implements — a module's `realises` and the `forced_by` of the decisions it follows, a subsystem's decision's `forced_by`, the `forced_by` of the decisions that
 * refine none —, and `origin` is the same list; `builds_on` names the steps of the draft whose titles its `after` names; `## Outcome` says what it implements or integrates, `## Acceptance` holds the tests of
 * its level, one bullet each. `idFor(entry, index)` gives a step's identifier, or null for a new step, which then has no `id` and no path and is named in `builds_on` and in the order by its title. The order
 * holds a row per entry in the drafted sequence, with its phase.
 */
function draftedPlan(draft, architecture, idFor) {
  const entries = asList(draft?.steps);
  const byId = new Map(architecture.map((document) => [idOfDocument(document), document]));
  const field = (id, name) => asList(byId.get(id)?.fields?.[name]);
  const moduleIds = architecture.map(idOfDocument).filter((id) => id.startsWith("MOD-"));
  const roots = architecture.map(idOfDocument).filter((id) => id.startsWith("ARC-") && String(byId.get(id).fields?.refines ?? "").trim() === "");
  const ids = entries.map((entry, index) => idFor(entry, index));
  const refOfTitle = new Map(entries.map((entry, index) => [entry.title, ids[index] ?? String(entry.title)]));
  const steps = entries.map((entry, index) => {
    const implemented = asList(entry.implements).map(String);
    const system = implemented.includes("system");
    const subsystems = implemented.filter((name) => name.startsWith("ARC-"));
    const level = system ? "system" : subsystems.length ? "subsystem" : "module";
    const modules = unique(system ? moduleIds : subsystems.length ? subsystems.flatMap((id) => field(id, "designs")) : implemented);
    const realises = unique(system ? roots.flatMap((id) => field(id, "forced_by")) : subsystems.length ? subsystems.flatMap((id) => field(id, "forced_by"))
      : modules.flatMap((id) => [...field(id, "realises"), ...field(id, "follows").flatMap((decision) => field(decision, "forced_by"))]));
    const tests = system ? ["system", "release"] : [String(entry.level)];
    const buildsOn = asList(entry.after).map((title) => refOfTitle.get(title)).filter(Boolean);
    const id = ids[index];
    const title = String(entry.title);
    const outcome = system ? `Integrates the system: ${modules.join(", ")}.` : subsystems.length ? `Integrates ${subsystems.join(", ")}: ${modules.join(", ")}.` : `Implements ${modules.join(", ")}.`;
    return { kind: "item", path: id ? `docs/plan/${id}-${slugOf(title)}.md` : null, id: id ?? null, title, appended: [], body: id ? `# ${id} ${title}\n\n` : "",
      fields: { ...(id ? { id } : {}), title, level, realises, modules, ...(subsystems.length ? { integrates: subsystems[0] } : {}), ...(buildsOn.length ? { builds_on: buildsOn } : {}), tests, origin: realises },
      sections: [{ heading: "## Outcome", text: `\n${outcome}\n\n` }, { heading: "## Acceptance", text: `\n${tests.map((one) => `- ${one[0].toUpperCase()}${one.slice(1)} tests.`).join("\n")}\n` }] };
  });
  const order = { kind: "plan-order", path: ORDER, fields: {}, body: "", appended: [],
    sections: [{ heading: "## Order", text: "", rows: entries.map((entry, index) => ({ cells: { Step: ids[index] ?? String(entry.title), Phase: String(entry.phase) } })) }] };
  return { steps, order };
}

/**
 * The check plan-checks(draft, context) -> Promise<Finding[]> — planFindings on the drafted plan of a job of the kind `draft-plan`, with the product's workflow (workflowOf); where the product has none — no
 * declaration, or the instance holds no model at its `model_file` at its `model_version` — one error finding that names the declared model and its commit. The draft becomes steps and an order as draftedPlan
 * reads it, each step with an identifier after the product's highest, in the drafted sequence; a draft that cannot be written as the plan's files gives one error finding that says why. The steps replace the
 * product's plan in the source the graph is read from. A finding about a drafted step names it by its title.
 */
async function planChecks(draft, context) {
  const { snapshot } = context.product;
  const error = (what, fix) => [finding({ artifact: PROCESS, line: 1, kind: "error", rule: DECLARED, what, fix })];
  const { declaration, workflow } = await workflowOf(context);
  if (declaration === null) return error("the product declares no process model: docs/process.md is missing, so there is no workflow to check the plan against", "declare the process model first (UC-002)");
  if (workflow === null) {
    return error(`the product has no workflow: the instance holds no model at ${declaration.fields.model_file} at ${declaration.fields.model_version}, the model and commit it declared`,
      "declare a model the instance's catalogue holds, at a version that holds it (UC-031)");
  }

  const architecture = await architectureFiles(snapshot);
  const highest = Math.max(0, ...snapshot.paths.map((each) => Number(ITEM_ID.exec(each)?.[1].slice(4) ?? 0)));
  const { steps, order } = draftedPlan(draft, architecture, (_, index) => `ITM-${String(highest + index + 1).padStart(3, "0")}`);
  const files = new Map();
  try {
    for (const each of steps) files.set(each.path, writeDocument(artifactSchemas().item, each));
    files.set(ORDER, writeDocument(planOrderSchema, order));
  } catch (failed) {
    return [finding({ artifact: PLAN, line: 1, kind: "error", rule: PLAN_RULE, what: `the drafted plan cannot be written as the plan's files: ${failed.message}`,
      fix: "name modules, a subsystem's decision or system under implements, and the level of the tests" })];
  }
  const source = { paths: [...snapshot.paths.filter((each) => !each.startsWith("docs/plan/")), ...files.keys()], read: async (each) => files.get(each) ?? snapshot.read(each) };
  const titleOf = new Map(steps.map((each) => [each.id, each.title]));
  const named = (value) => String(value).replace(/ITM-\d{3,}/g, (id) => (titleOf.has(id) ? `the step "${titleOf.get(id)}"` : id));
  return (await planFindings(order, steps, architecture, workflow, source))
    .map((each) => finding({ artifact: named(each.artifact), line: each.line, kind: each.kind, rule: each.rule, what: named(each.what), fix: named(each.fix) }));
}

/**
 * The writer plan-steps(result, context) -> Promise<WriteOutcome> — the drafted plan of a job of the kind `draft-plan` through savePlan (UC-045 step 5): `result.draft` is the answer of the kind, which plan-checks
 * has checked, read as draftedPlan reads it. The drafted plan is the whole plan: a drafted step whose title is that of a step of the product's plan keeps that step's identifier, every other is new, and every
 * step of the plan the draft does not hold is removed. `architecture` the decisions and module files of the job's snapshot; `workflow` the product's (workflowOf); `head` the snapshot's commit; `trailers`
 * provenanceLines of the job. A draft without steps writes nothing and its outcome names no commit. Otherwise commits once, to the product's default branch; the outcome names the commit and the written files.
 * Throws what savePlan throws.
 */
async function planSteps(result, context) {
  const { snapshot, host } = context.product;
  if (asList(result.draft?.steps).length === 0) return { commits: [], files: [], pullRequest: null, shown: null, notes: [] };
  const architecture = await architectureFiles(snapshot);
  const { workflow } = await workflowOf(context);
  const existing = await Promise.all(snapshot.paths.filter((each) => PLAN_STEP.test(each)).sort().map(async (each) => readDocument(artifactSchemas().item, each, (await snapshot.read(each)) ?? "")));
  const kept = new Map(existing.map((each) => [String(each.fields.title), each.id]));
  const { steps, order } = draftedPlan(result.draft, architecture, (entry) => kept.get(String(entry.title)) ?? null);
  const stays = new Set(steps.map((each) => each.id).filter(Boolean));
  const removed = existing.map((each) => each.id).filter((id) => !stays.has(id));
  const trailers = provenanceLines({ agentM: context.agentM, jobId: context.jobId, kind: context.kind.name, participant: result.drafter ?? { name: "none", model: null }, rounds: result.rounds.length });
  const { commit, written } = await savePlan(host, { steps, order, removed }, { architecture, workflow, head: snapshot.commit, trailers });
  return { commits: [commit], files: written, pullRequest: null, shown: null, notes: [] };
}

const MODULE_FILE = /^docs\/architecture\/MOD-[^/]+\.md$/;
// The architecture's module files at a snapshot, by path, each read with the module schema: the one read of them that backlog-checks, backlog-items and sprint-record share.
export const moduleFiles = async (snapshot) => Promise.all(snapshot.paths.filter((each) => MODULE_FILE.test(each)).sort()
  .map(async (each) => readDocument(artifactSchemas().module, each, (await snapshot.read(each)) ?? "")));

/**
 * The check backlog-checks(draft, context) -> Promise<Finding[]> — backlogFindings on the drafted items of a job of the kind `propose-items` (UC-032 step 3). The draft is the answer of the kind,
 * `{ items: [{ title, realises, modules, buildsOn, ... }] }`; each entry becomes an item with an identifier after the product's highest, in the drafted sequence. An entry of `buildsOn` names an existing
 * item by its identifier or its title, or a drafted entry by its title; a title is replaced by that item's identifier, any other entry stays as it is. backlogFindings runs on the existing items of
 * docs/backlog/ and the drafted ones, with the module files of docs/architecture/ of the job's snapshot; the check gives the findings of the drafted items, each naming its item by its title. A draft
 * without items has none.
 */
async function backlogChecks(draft, context) {
  const { snapshot } = context.product;
  const schemas = artifactSchemas();
  const documents = (pattern, schema) => Promise.all(snapshot.paths.filter((each) => pattern.test(each)).sort()
    .map(async (each) => readDocument(schema, each, (await snapshot.read(each)) ?? "")));
  const existing = await documents(ITEM_FILE, schemas.item);
  const architecture = await moduleFiles(snapshot);
  const highest = Math.max(0, ...snapshot.paths.map((each) => Number(ITEM_ID.exec(each)?.[1].slice(4) ?? 0)));
  const drafted = asList(draft?.items).map((each, index) => ({ ...each, id: `ITM-${String(highest + index + 1).padStart(3, "0")}` }));
  const idOfTitle = new Map([...drafted.map((each) => [each.title, each.id]), ...existing.map((each) => [each.fields.title, each.id])]);
  const items = drafted.map((each) => ({ kind: "item", path: `docs/backlog/${each.id}-${slugOf(each.title)}.md`, id: each.id, title: each.title, sections: [], appended: [], body: "",
    fields: { id: each.id, title: each.title, realises: asList(each.realises), modules: asList(each.modules), builds_on: asList(each.buildsOn).map((name) => idOfTitle.get(name) ?? name) } }));
  const titleOf = new Map(drafted.map((each) => [each.id, each.title]));
  const named = (value) => String(value).replace(/ITM-\d{3,}/g, (id) => (titleOf.has(id) ? `the item "${titleOf.get(id)}"` : id));
  return backlogFindings([...existing, ...items], architecture).filter((each) => titleOf.has(each.artifact))
    .map((each) => finding({ artifact: named(each.artifact), line: each.line, kind: each.kind, rule: each.rule, what: named(each.what), fix: named(each.fix) }));
}

const AFFECTED_RULE = "ACCEPTING A USE CASE PUTS THE MODULES IT CHANGES INTO THE BACKLOG";

/**
 * The step leave-out-named-modules(draft, context) -> Promise<{ draft, findings }> — of the items a job of the kind `check-affected-modules` drafted (UC-008 step 6), leaves out each item for a
 * module that an item not yet done names: an item of docs/backlog/ of the job's snapshot whose state `itemStates` gives is not `done`, from the approval statuses, the change queues, the product's
 * jobs and its pull requests ("unknown" where the host gives none). A drafted item is left out when one of its modules is so named; each item left out gives a warning that names the item not done
 * and the module. The draft keeps its shape, `{ items: [...] }`, with the items that stay in their order. A draft without items stays as it is.
 */
async function leaveOutNamedModules(draft, context) {
  const { snapshot, host, address } = context.product;
  const drafted = asList(draft?.items);
  if (drafted.length === 0) return { draft, findings: [] };
  const items = await Promise.all(snapshot.paths.filter((each) => ITEM_FILE.test(each)).sort()
    .map(async (each) => readDocument(artifactSchemas().item, each, (await snapshot.read(each)) ?? "")));
  const states = itemStates(items, null, { statuses: statuses(snapshot), queues: await queues(snapshot), jobs: await listJobs([{ address, snapshot }], new Map()),
    pullRequests: await pullRequestsOf(host), gates: [], workflow: null });
  const notDone = new Set(states.filter((each) => each.state !== "done").map((each) => each.item));
  const namedBy = new Map();
  for (const item of items.filter((each) => notDone.has(each.id))) for (const module of asList(item.fields.modules)) if (!namedBy.has(module)) namedBy.set(module, item.id);
  const findings = [];
  const kept = drafted.filter((entry) => {
    const named = asList(entry?.modules).filter((module) => namedBy.has(module));
    for (const module of named) {
      findings.push(finding({ artifact: String(entry.title), line: 1, kind: "warning", rule: AFFECTED_RULE, what: `${module} is named by ${namedBy.get(module)}, which is not done`,
        fix: `the change of ${module} belongs to ${namedBy.get(module)}: no item is added for it` }));
    }
    return named.length === 0;
  });
  return { draft: { ...draft, items: kept }, findings };
}

const SPEC_PATH = "SPEC.md";
const NOT_REALISED = "not yet realised by an item";
const EXISTING_ITEMS = "existing items";

// The requirements the SPEC of a snapshot holds, in its order; a requirement is accepted when the SPEC holds it. None where the snapshot has no SPEC.md.
const specRequirements = async (snapshot) => [...parseSpec((await snapshot.read(SPEC_PATH)) ?? "").requirements.values()];

// What an item names, accepted or not, as the pages read it to derive an item's state: the approval statuses, and every requirement the SPEC holds as accepted.
async function acceptanceOf(snapshot) {
  const accepted = new Map(statuses(snapshot));
  for (const { name } of await specRequirements(snapshot)) accepted.set(name, { id: name, kind: "requirement", status: "accepted" });
  return accepted;
}

// A requirement as the SPEC states it: its name and source, its rule, its check; a field it lacks is left out.
const stated = ({ name, source, rule, check }) => [`**${name}**${source === null ? "" : ` *(${source})*`}`, rule, check === null ? null : `*Check:* ${check}`].filter((line) => line !== null).join("\n");

/**
 * The recipe backlog-inputs(context, params) -> Part[] — what UC-032 step 2 sends to the drafting participant, in this order:
 * - the accepted requirements, one part each, named by the requirement and holding it as the SPEC states it, in the order the SPEC lists them; a requirement is accepted when the SPEC holds it, so that
 *   one that stands only in an open entry of a change queue is not given;
 * - the accepted use cases, one part each, named by the file's path and holding the file whole, by path; a use case is accepted when `statuses` gives it accepted;
 * - one part "not yet realised by an item": the accepted requirements and then the accepted use cases that no existing item names under `realises`, one to a line; not given where there are none;
 * - the architecture, every decision and module file of docs/architecture/, one part each, named by the path and holding the file whole, by path;
 * - one part "existing items": the files of the items of docs/backlog/ whole, by path, which carries each item as an artifact, its identifier and the key of the item format, its title; not given
 *   where the product has no item.
 * Only the part of the items carries artifacts. A part carries the sources of every `context.places.contents` entry that names a path its text comes from or a folder above it. A product without
 * a SPEC.md gives no requirement. The recipe makes no request of its own.
 */
async function backlogInputs(context) {
  const { snapshot } = context.product;
  const schemas = artifactSchemas();
  const part = (name, text, paths, artifacts) => ({ name, text, size: 0, sources: unique(paths.flatMap((path) => sourcesFor(context, path))), required: true, ...(artifacts ? { artifacts } : {}) });
  const filesOf = async (pattern) => Promise.all(snapshot.paths.filter((each) => pattern.test(each)).sort().map(async (path) => ({ path, text: (await snapshot.read(path)) ?? "" })));

  const requirements = await specRequirements(snapshot);
  const useCases = await Promise.all([...statuses(snapshot)].filter(([, { kind, status }]) => kind === "use-case" && status === "accepted").sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(async ([path, { id }]) => ({ id, path, text: (await snapshot.read(path)) ?? "" })));
  const items = (await filesOf(ITEM_FILE)).map((file) => ({ ...file, document: readDocument(schemas.item, file.path, file.text) }));
  const realised = new Set(items.flatMap(({ document }) => asList(document.fields.realises)));
  const unrealised = [...requirements.map(({ name }) => name), ...useCases.map(({ id }) => id)].filter((name) => !realised.has(name));

  return [
    ...requirements.map((requirement) => part(requirement.name, stated(requirement), [SPEC_PATH])),
    ...useCases.map(({ path, text }) => part(path, text, [path])),
    ...(unrealised.length ? [part(NOT_REALISED, unrealised.map((name) => `- ${name}`).join("\n"), [])] : []),
    ...(await filesOf(ARCHITECTURE_FILE)).map(({ path, text }) => part(path, text, [path])),
    ...(items.length ? [part(EXISTING_ITEMS, items.map(({ text }) => text).join("\n"), items.map(({ path }) => path),
      items.map(({ document }) => ({ id: document.id, keys: schemas.item.key.map((field) => String(document.fields[field] ?? "")) })))] : []),
  ];
}

const REVIEW_RULE = "AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM";
const RETRO_RULE = "A SPRINT ENDS WITH A RETROSPECTIVE";
const PROCESS_RULE = "AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY ITSELF";
// The keys of closeSprint's `close` (MOD-work-plans, Interfaces), of its review and of an entry of its retrospective: a draft holds no other.
const CLOSE_KEYS = ["sprint", "review", "unfinished", "retrospective", "newItems"];
const REVIEW_KEYS = ["feedback", "tookPart", "sources"];
const ENTRY_KEYS = ["text", "kind", "goes"];
// A line that says that no stakeholder took part.
const NO_STAKEHOLDER = /\bno stakeholders?\b[^.]*\b(?:took|take|taken|takes) part\b/i;

const asList = (value) => (Array.isArray(value) ? value : []);
const lower = (value) => String(value ?? "").toLowerCase();

/**
 * The check sprint-record-checks(draft) -> Finding[] — on the draft of a job of the kind `close-sprint`, which has the shape of closeSprint's `close`; every such job is an agent's, so every draft is an
 * agent's review (UC-041 steps 2 to 6). An error, each with its rule, for:
 * - a review whose `sources` are null or empty (AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM);
 * - a name in `tookPart` whose feedback no feedback line and no source records, and an empty `tookPart` with no feedback line that says that no stakeholder took part (the same rule);
 * - an empty retrospective (A SPRINT ENDS WITH A RETROSPECTIVE);
 * - an entry of kind `change` without `goes`, and a key outside the shape of `close`, in the draft, its review or an entry of its retrospective (AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY ITSELF).
 * Findings stand at line 1 of the sprint record. A clean draft gives none.
 */
function sprintRecordChecks(draft) {
  const close = draft !== null && typeof draft === "object" ? draft : {};
  const review = close.review !== null && typeof close.review === "object" ? close.review : {};
  const artifact = typeof close.sprint === "string" && close.sprint ? `the record of sprint ${close.sprint}` : "the sprint record";
  const found = [];
  const add = (rule, what, fix) => found.push(finding({ artifact, line: 1, kind: "error", rule, what, fix }));

  const sources = asList(review.sources);
  if (sources.length === 0) add(REVIEW_RULE, "the review names no sources of its feedback", "name each source: the issues, mails, job records and test results it read");
  const lines = asList(review.feedback).map((each) => String(each?.line ?? ""));
  const tookPart = asList(review.tookPart);
  if (tookPart.length === 0) {
    if (!lines.some((line) => NO_STAKEHOLDER.test(line))) add(REVIEW_RULE, "the review does not state that no stakeholder took part", "say in a feedback line that no stakeholder took part, or name who did");
  }
  for (const name of tookPart) {
    const recorded = [...lines, ...sources.map(String)].some((text) => lower(text).includes(lower(name)));
    if (!recorded) add(REVIEW_RULE, `the feedback of ${name}, who took part, is recorded in no feedback line and in no source`, "record their feedback in a line or name where it is kept among the sources");
  }

  const retrospective = asList(close.retrospective);
  if (retrospective.length === 0) add(RETRO_RULE, "the retrospective has no entry", "record what the team will change in how it works");
  for (const entry of retrospective) {
    if (entry?.kind === "change" && !entry.goes) {
      add(PROCESS_RULE, `the change "${entry.text ?? ""}" does not say where it is proposed to`, "give where it goes: the process model, the Definition of Done, a participant's instructions or the team agreement");
    }
  }
  const strange = [...Object.keys(close).filter((key) => !CLOSE_KEYS.includes(key)).map((key) => key),
    ...Object.keys(review).filter((key) => !REVIEW_KEYS.includes(key)).map((key) => `review.${key}`),
    ...retrospective.flatMap((entry) => Object.keys(entry ?? {}).filter((key) => !ENTRY_KEYS.includes(key)).map((key) => `retrospective.${key}`))];
  for (const key of strange) add(PROCESS_RULE, `the draft holds ${key}, which is no part of a close`, "the draft proposes; it writes nothing of the process itself: remove it");
  return found;
}

/**
 * The writer sprint-record(result, context) -> Promise<WriteOutcome> — an agent's close of the sprint the job's parameter `sprint` names, the one the recipe sprint-facts reads, through closeSprint (UC-041 step 6):
 * the draft, `result.draft`, which sprint-record-checks has checked, is closeSprint's `close` with its `sprint` that of the parameter, whatever the draft holds; `facts` are those of the same sprint as the recipe sprint-facts computes them (its own function); `architecture` the module files of the job's snapshot; `head` the snapshot's
 * commit; `trailers` provenanceLines of the job, the participant's name among them — the closer's; `instance` the host of the instance's SPEC. The proposals of the retrospective stay proposals: lines of the
 * sprint's record, and each change to the process an open entry of the instance's SPEC, as closeSprint writes it.
 * A review that sprint-record-checks finds under AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM — no source named, or no statement that no stakeholder took part when none did — is refused with
 * ReviewRefused { findings }, those findings, and nothing is written: the job runner calls the writer also when nobody attends and its loop ended with the finding open.
 * Otherwise the outcome names the record's commit, then each entry's, and the record; its notes name each entry and each change not proposed. Throws what closeSprint throws.
 */
async function sprintRecord(result, context) {
  const { snapshot, host } = context.product;
  const { name, facts } = await sprintInputs(context, context.params);
  const close = { ...result.draft, sprint: name };
  const unnamed = sprintRecordChecks(close).filter((each) => each.rule === REVIEW_RULE);
  if (unnamed.length) {
    throw new WorkPlansError("ReviewRefused", { findings: unnamed }, `The review of sprint ${name} is not recorded: ${unnamed.map((each) => each.what).join("; ")}.`);
  }
  const architecture = await moduleFiles(snapshot);
  const trailers = provenanceLines({ agentM: context.agentM, jobId: context.jobId, kind: context.kind.name, participant: result.drafter ?? { name: "none", model: null }, rounds: result.rounds.length });
  // The instance's SPEC takes the retrospective's changes to the process; a product that is its own instance — the job's instance at the product's address — through the product's host,
  // the one whose commits the job's result carries.
  const web = (side) => side?.snapshot?.repository?.web ?? null;
  const instance = web(context.product) !== null && web(context.product) === web(context.instance) ? host : context.instance.host;
  const { commit, written, entries = [], notes = [] } = await closeSprint(host, close, { facts, architecture, head: snapshot.commit, trailers, instance });
  return { commits: [commit, ...entries.map((one) => one.commit)], files: written, pullRequest: null, shown: null,
    notes: [...entries.map((one) => `A change of the retrospective is proposed as entry ${String(one.entry).padStart(2, "0")} of the queue ${one.queue}.`), ...notes] };
}

const BACKLOG_RULE = "THE BACKLOG LIVES IN THE PRODUCT REPOSITORY";
const TEST_LEVELS = ["unit", "component", "system", "release"];

/**
 * The writer backlog-items(result, context) -> Promise<WriteOutcome> — the drafted items of a job of the kind `propose-items` through saveItems (UC-032 step 4): `result.draft` is the answer of the kind, which
 * backlog-checks has checked; `architecture` the module files of the job's snapshot; `head` the snapshot's commit; `trailers` provenanceLines of the job. Each entry becomes a new item: `origin` the requirements and
 * use cases it realises; `## Outcome` its `outcome`, `## Acceptance` one bullet for each entry of `acceptance`; `builds_on` its `buildsOn`; `class` and `of` are not written, an entry classed duplicate is saved like
 * the others. Its `tests` are the levels its acceptance names as unit, component, system or release tests and its `level` the highest of them (unit: module, component: subsystem, system or release: system); a
 * subsystem's `integrates` is the one decision that all its modules follow. An entry whose acceptance names no level, or whose modules follow no one decision at the level subsystem, is refused with ItemsRefused
 * { findings } and nothing is written. A draft without items writes nothing and its outcome names no commit. Otherwise commits once, to the product's default branch; the outcome names the commit and the files, and holds the warnings of saveItems as notes, one line each: the item, "warning:" and what it says. Throws what saveItems throws.
 */
async function backlogItems(result, context) {
  const { snapshot, host } = context.product;
  const architecture = await moduleFiles(snapshot);
  const followed = (name) => asList(architecture.find((one) => one.id === name)?.fields.follows);
  const refusals = [];
  const items = asList(result.draft?.items).map((entry) => {
    const acceptance = asList(entry.acceptance).map(String);
    const tests = TEST_LEVELS.filter((level) => acceptance.some((line) => new RegExp(`\\b${level} tests?\\b`, "i").test(line)));
    const level = tests.some((one) => one === "system" || one === "release") ? "system" : tests.includes("component") ? "subsystem" : tests.includes("unit") ? "module" : null;
    const refuse = (what, fix) => refusals.push(finding({ artifact: String(entry.title), line: 1, kind: "error", rule: BACKLOG_RULE, what, fix }));
    if (level === null) refuse("its acceptance names no tests of a level", "name unit, component, system or release tests in the acceptance criteria");
    const modules = asList(entry.modules);
    const decisions = modules.map(followed).reduce((common, each) => common.filter((one) => each.includes(one)), modules.length ? followed(modules[0]) : []);
    if (level === "subsystem" && decisions.length !== 1) refuse("its modules follow no one subsystem decision, so that the item integrates none", "name the modules of one subsystem, or the tests of another level");
    const realises = asList(entry.realises);
    return { fields: { title: entry.title, level, realises, modules, ...(level === "subsystem" && decisions.length === 1 ? { integrates: decisions[0] } : {}), builds_on: asList(entry.buildsOn), tests, origin: realises },
      sections: [{ heading: "## Outcome", text: `\n${entry.outcome ?? ""}\n\n` }, { heading: "## Acceptance", text: `\n${acceptance.map((line) => `- ${line}`).join("\n")}\n` }] };
  });
  if (refusals.length) throw new WorkPlansError("ItemsRefused", { findings: refusals }, `The items are not saved: ${refusals.map((one) => `${one.artifact} ${one.what}`).join("; ")}.`);
  if (items.length === 0) return { commits: [], files: [], pullRequest: null, shown: null, notes: [] };
  const trailers = provenanceLines({ agentM: context.agentM, jobId: context.jobId, kind: context.kind.name, participant: result.drafter ?? { name: "none", model: null }, rounds: result.rounds.length });
  const { commit, written, warnings } = await saveItems(host, { items, removed: [] }, { architecture, head: snapshot.commit, trailers });
  return { commits: [commit], files: written, pullRequest: null, shown: null, notes: warnings.map((one) => `${one.artifact} warning: ${one.what}`) };
}

/** workStrategies: MOD-job-runner's Partial<Strategies> with the recipes architecture-and-model, backlog-inputs and sprint-facts, the checks plan-checks, backlog-checks and sprint-record-checks, the step leave-out-named-modules and the writers plan-steps, backlog-items and sprint-record. */
export const workStrategies = { recipes: { "architecture-and-model": architectureAndModel, "backlog-inputs": backlogInputs, "sprint-facts": sprintFactsRecipe }, checks: { "plan-checks": planChecks, "backlog-checks": backlogChecks, "sprint-record-checks": sprintRecordChecks }, steps: { "leave-out-named-modules": leaveOutNamedModules }, writers: { "plan-steps": planSteps, "backlog-items": backlogItems, "sprint-record": sprintRecord } };
