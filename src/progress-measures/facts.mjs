// facts.mjs — productFacts: one product's facts, read once from its default branch through its host
// (docs/architecture/MOD-progress-measures.md, Interfaces: Facts, productFacts; STATUS IS DERIVED FROM THE RECORDS, PROGRESS AND
// JOB STATE ARE DERIVED, NOT STORED). The scope `build` reads what buildFacts lists; the scope `work` reads what is listed below; the scope `all` adds the requirements, the tests,
// the branch `test-results`, the tags, `info`, the history of the declaration (`modelSince`), the schedule, the CI runs and configuration (`ci`) and the resource list (`resourceNeeds`); `graph` stays
// "unknown" in both, and so does every fact the scope does not read. No job's live state is asked. The files are read ahead through Snapshot.readMany, in batches of a hundred where the host can.
//
// Module: MOD-progress-measures
//
// With the scope `work` it reads what MOD-work-plans' itemStates and startable and MOD-product-process' holdsRole take. Where the
// module file leaves a reading open, this file takes the one it names:
//   - The default branch is the one the host's repositoryInfo names; a host that does no server operations answers NotSupported,
//     and the snapshot is then read at "HEAD", the branch a clone has checked out. `info` stays "unknown": it is no fact of the
//     scope `work`. Pull requests that a host cannot list (NotSupported) are "unknown".
//   - The product keeps a plan where it holds docs/plan/order.md or a step under docs/plan/; its items are then the steps, with the
//     order, and otherwise the items of docs/backlog/, with no order.
//   - `gateStates` is [] and `gates` are the records as read where the workflow is null or "unknown": there is no gate to state.
//   - `resultCommits` (the scope `all`) are the commits of the default branch's history (readHistory of the whole repository, `changes: false`) under which
//     `results` holds a `runs/<commit>/` record, in the history's order; a history that fails with one of the host's own errors (HOST_FAILURES) is "unknown".
//   - `own` is whether the product's address is the address of the instance's snapshot.
//   - (the scope `all`) `modelSince` is the date of the oldest commit, in the unbroken run from the newest, whose docs/process.md names the `model` the current one names; `ci.runs` are the runs of the default
//     branch at its head; `ci.configured` and `ci.jobWorkflow` are whether the generated file and the job workflow are in the branch; `ci` is "unknown" where the schedule has an error finding or the
//     target of the drift is not known; a product without docs/resources.md has the resourceNeeds [], one without a saved schedule the book's default.
//   - A declared model that the catalogue at the commit lacks is null (the commit was read); one whose commit instanceAt cannot read
//     — an error named NotFound, TokenRefused, PermissionMissing or Unreachable — is "unknown", with modelUnread naming the commit
//     and the error. Any other error is not hidden.

import { statuses } from "../approvals/index.mjs";
import { queues } from "../spec-changes/index.mjs";
import { artifactSchemas, readDocument, readRegister } from "../documents/index.mjs";
import { declarationSchema, gateSchema, gateStates, productWorkflow, roleAssignmentSchema } from "../product-process/index.mjs";
import { participantSchema, participantsOf } from "../participant-list/index.mjs";
import { listJobs } from "../job-ledger/index.mjs";
import { heldItems, itemStates, planSchemas, undecidedHeads } from "../work-plans/index.mjs";
import { parseSpec } from "../spec-document/index.mjs";
import { isTestFile, testDeclarations } from "../test-document/index.mjs";
import { configurationDrift, defaultSchedule, scheduleSchema } from "../test-schedule/index.mjs";
import { reachableBy, resourceSchema } from "../resource-list/index.mjs";

const DECLARATION = "docs/process.md";
const PARTICIPANTS = "docs/participants.md";
const INSTANCE_SPEC = "SPEC.md";
const SPEC = "SPEC.md";
const JOB_RECORDS = "docs/jobs/";
const RESULTS_BRANCH = "test-results";
const SCHEDULE = "docs/tests/schedule.md";
const RESOURCES = "docs/resources.md";
// The file MOD-test-schedule generates (its Data: agent-m-tests.yml on GitHub, .gitlab/agent-m-tests.yml on GitLab) and the job workflow's (MOD-runtimes' Data). MOD-runtimes'
// jobWorkflowFiles names the latter but throws in a browser, where this file runs too; so the paths stand here, as the pages that ask for them have them (test-pages/generate.mjs).
const TESTS_WORKFLOW = { github: ".github/workflows/agent-m-tests.yml", gitlab: ".gitlab/agent-m-tests.yml" };
const JOBS_WORKFLOW = { github: ".github/workflows/agent-m-jobs.yml", gitlab: ".gitlab/agent-m-jobs.yml" };
// The committed configuration configurationDrift compares: on GitHub every workflow file (it names those Agent M did not generate), on GitLab the product's .gitlab-ci.yml and the generated file.
const CI_FILE = { github: /^\.github\/workflows\/[^/]+\.ya?ml$/, gitlab: /^\.gitlab-ci\.yml$|^\.gitlab\/agent-m-tests\.yml$/ };
const ORDER = "docs/plan/order.md";
const PLAN_STEP = /^docs\/plan\/ITM-\d{3,}-[^/]+\.md$/;
const BACKLOG_ITEM = /^docs\/backlog\/ITM-\d{3,}-[^/]+\.md$/;
const SPRINT = /^docs\/backlog\/sprints\/[^/]+\/[^/]+\.md$/;
const ASSIGNMENT = /^docs\/role-assignments\/[^/]+\.md$/;
const GATE_RECORD = /^docs\/gates\/[^/]+\.md$/;
const MODULE_FILE = /^docs\/architecture\/MOD-[^/]+\.md$/;
// An entry of a gate record's `on` that names an artifact: <path>@<blob> (MOD-product-process, gateStates).
const CHECKED = /^([^\s@]+)@[0-9a-f]{7,64}$/;

// The branch a clone has checked out, for a host whose repositoryInfo is NotSupported.
const CHECKED_OUT = "HEAD";
// The causes the module file names for a commit instanceAt cannot read.
const UNREADABLE = new Set(["NotFound", "TokenRefused", "PermissionMissing", "Unreachable"]);

const text = (value) => (typeof value === "string" ? value : "");

// WorkPlans remains the sole owner of plan and dependency ordering. Before it derives
// states, unordered product inputs have the stable numeric identifier order the facts contract names.
const itemsByNumber = (items) => [...items].sort((left, right) => {
  const numberOf = (item) => Number(/^ITM-(\d+)$/.exec(text(item?.id ?? item?.fields?.id))?.[1]);
  return numberOf(left) - numberOf(right);
});

// The documents of the paths the snapshot holds, read with `schema`, in the order of the paths.
const readAll = (snapshot, paths, schema) =>
  Promise.all(paths.map(async (path) => readDocument(schema, path, (await snapshot.read(path)) ?? "")));

// A server answer of a host that does no server operations is NotSupported: the fact is then "unknown".
async function orUnknown(read) {
  try {
    return await read();
  } catch (error) {
    if (error?.name === "NotSupported") return "unknown";
    throw error;
  }
}

// The facts of the product's declared model and workflow: what MOD-product-process' productWorkflow gives, read with the instance's SPEC; `model` is the
// workflow's model. Where the instance cannot read the commit the declaration names, they are "unknown" and `modelUnread` keeps the error; where the
// instance holds no model at `model_file`, they are null.
async function declaredWorkflow(declaration, instance, instanceAt) {
  if (declaration === null) return { model: null, workflow: null, modelUnread: null };
  try {
    const workflow = await productWorkflow(declaration, instanceAt, (await instance.read(INSTANCE_SPEC)) ?? "");
    return workflow === null ? { model: null, workflow: null, modelUnread: null } : { model: workflow.model, workflow, modelUnread: null };
  } catch (error) {
    if (!UNREADABLE.has(error?.name)) throw error;
    return { model: "unknown", workflow: "unknown", modelUnread: { commit: text(declaration.fields.model_version), error: error.name } };
  }
}

// The blobs the gates check, by path: the product's current blob of each artifact a gate record names (as done.mjs of
// MOD-product-process collects them for gateStates).
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

// The failures of a host that leave a server fact unread; the history of the default branch that fails with one of them is "unknown".
const HOST_FAILURES = new Set(["NotSupported", "NotFound", "TokenRefused", "PermissionMissing", "RateLimited", "Unreachable"]);
const RUN_FOLDER = /^runs\/([^/]+)\//;

// The commits of the default branch that `results` holds records of, newest first by the branch's history: [] while there is no branch
// test-results, "unknown" where the branch is unknown or its history cannot be read.
async function resultCommitsOf(host, branch, results) {
  if (results === "unknown") return "unknown";
  if (results === null) return [];
  const recorded = new Set(results.paths.map((path) => RUN_FOLDER.exec(path)?.[1]).filter(Boolean));
  try {
    return (await host.readHistory(null, { ref: branch, changes: false })).map((entry) => entry.commit).filter((commit) => recorded.has(commit));
  } catch (error) {
    if (HOST_FAILURES.has(error?.name)) return "unknown";
    throw error;
  }
}

// Whether the product's repository is the instance's own: the address of its snapshot is the address of the instance's.
const isOwn = (address, instance) => address !== "" && instance.repository?.web === address;

// The branch `test-results`: its snapshot, null while the repository has none, "unknown" where the host does no server operations.
async function resultsBranch(host) {
  try {
    return await host.readSnapshot(RESULTS_BRANCH);
  } catch (error) {
    if (error?.name === "NotFound") return null;
    if (error?.name === "NotSupported") return "unknown";
    throw error;
  }
}

// The facts only the scope `all` reads: the requirements of the SPEC, the declarations of the test files (MOD-test-document's isTestFile
// names them; they are told to the snapshot first, to be read in batches), the branch `test-results` and the tags. The trace graph is
// not built: nothing reads Facts.graph, so `graph` is "unknown" in both scopes and no file only the graph would read is read.
async function allFacts(host, snapshot, requirements = null) {
  const names = requirements ?? await requirementsOf(snapshot);
  const testFiles = snapshot.paths.filter(isTestFile);
  await snapshot.readMany?.(testFiles);
  const [results, tags, tests] = await Promise.all([resultsBranch(host), orUnknown(() => host.listTags()),
    Promise.all(testFiles.map(async (path) => testDeclarations(path, (await snapshot.read(path)) ?? "")))]);
  return { requirements: names, tags, results, tests: tests.flat() };
}

// The files of the schedule, the resources and the CI configuration that the snapshot holds, told to it before the first read (a test file's batch).
const schedulingPaths = (snapshot) => {
  const server = snapshot.repository?.server;
  return [SCHEDULE, RESOURCES, ...(Object.hasOwn(CI_FILE, server) ? snapshot.paths.filter((path) => CI_FILE[server].test(path)) : [])]
    .filter((path) => snapshot.paths.includes(path));
};

// The date the declared model was declared: the date of the oldest commit of the declaration's history in the unbroken run, newest first, of commits whose declaration names the model
// the current one names (`model`). null where the product declares none; "unknown" where the host cannot give the history. The texts are read a hundred commits at a time, only as far as the run goes.
async function modelSinceOf(host, branch, declaration) {
  if (declaration === null) return null;
  const model = text(declaration.fields.model);
  try {
    const history = await host.readHistory(DECLARATION, { ref: branch, changes: false });
    let since = null;
    for (let at = 0; at < history.length; at += 100) {
      const chunk = history.slice(at, at + 100);
      const texts = await host.readFileAt(DECLARATION, chunk.map((entry) => entry.commit));
      for (const entry of chunk) {
        const held = texts.get(entry.commit);
        if (typeof held !== "string" || text(readDocument(declarationSchema, DECLARATION, held).fields.model) !== model) return since;
        since = entry.date;
      }
    }
    return since;
  } catch (error) {
    if (HOST_FAILURES.has(error?.name)) return "unknown";
    throw error;
  }
}

// `ci`: the runs of the default branch's head, whether the configuration generated from the schedule is present, how the committed configuration differs from it (MOD-test-schedule's
// configurationDrift, given the committed files, the schedule, the instance as the target, the resources and the participants), and whether the job workflow is present. It is "unknown" where
// the drift cannot be told: the product's server or the instance's address or commit is not known, or the schedule has an error finding (`InvalidSchedule`), which generates no configuration.
async function ciFacts(host, branch, snapshot, instance, schedule, resources, register) {
  const server = snapshot.repository?.server, at = instance.repository;
  if (!Object.hasOwn(CI_FILE, server) || typeof at?.path !== "string" || typeof at?.web !== "string" || typeof instance.commit !== "string") return "unknown";
  const files = {};
  for (const path of snapshot.paths.filter((each) => CI_FILE[server].test(each))) files[path] = (await snapshot.read(path)) ?? "";
  let drift;
  try {
    drift = configurationDrift(files, schedule, { server, instance: server === "github" ? at.path : at.web, instanceCommit: instance.commit }, resources, register);
  } catch (error) {
    if (error?.name === "InvalidSchedule") return "unknown";
    throw error;
  }
  const runs = await orUnknown(() => host.listCiRuns({ branch, commit: snapshot.commit }));
  return { runs, configured: snapshot.paths.includes(TESTS_WORKFLOW[server]), drift, jobWorkflow: snapshot.paths.includes(JOBS_WORKFLOW[server]) };
}

// The facts the scope `all` reads of the schedule and the resources: the product's schedule, or the book's default where none is saved; the routes that reach its resources
// (`reachableBy` over docs/resources.md, none where the product has no such file); and `ci`.
async function schedulingFacts(host, branch, snapshot, instance, register) {
  const saved = await snapshot.read(SCHEDULE);
  const schedule = typeof saved === "string" ? readDocument(scheduleSchema, SCHEDULE, saved) : defaultSchedule();
  const resources = readRegister(resourceSchema(), RESOURCES, (await snapshot.read(RESOURCES)) ?? "");
  return { schedule, resourceNeeds: reachableBy(resources.rows.map((row) => ({ name: row.cells.Name, route: row.cells.Route }))),
    ci: await ciFacts(host, branch, snapshot, instance, schedule, resources.document, register) };
}

const requirementsOf = async (snapshot) => {
  await snapshot.readMany?.([SPEC]);
  const specText = await snapshot.read(SPEC);
  return specText === null ? [] : [...parseSpec(specText).requirements.keys()];
};

function realisedNames(items) {
  return new Set(items.flatMap((item) => {
    const value = item?.fields?.realises;
    return Array.isArray(value) ? value : typeof value === "string" ? value.split(",").map((name) => name.trim()).filter(Boolean) : [];
  }));
}

async function acceptanceStatuses(approvals, items, requirements, snapshot) {
  const known = new Set([...approvals.values()].map((status) => status?.id).filter(Boolean));
  const realised = realisedNames(items);
  if ([...realised].every((name) => known.has(name))) return approvals;
  const accepted = requirements ?? await requirementsOf(snapshot);
  const context = new Map(approvals);
  for (const name of accepted) context.set(name, { id: name, kind: "requirement", status: "accepted" });
  return context;
}

// The facts the scope `build` reads: what buildInProgress takes and nothing else — the plan or the backlog, the job records and the pull requests —,
// through the repository's default branch, and what the plan's states depend on: the approval statuses (derived from the tree's paths and blobs, which
// read no file), the change queues, and the gate records with the declaration, the model and the workflow they are stated against. So a step's
// state is what the scope `all` gives it. Not read: the sprints, the role assignments, the participants, the module files, nor the SPEC of the product,
// the tests, the results, the tags and the information. A fact not read is "unknown" where the type allows it, and empty where it does not.
async function buildFacts(host, instance, instanceAt) {
  const info = await orUnknown(() => host.repositoryInfo());
  const snapshot = await host.readSnapshot(info === "unknown" ? CHECKED_OUT : info.defaultBranch);
  const pullRequests = await orUnknown(() => host.listPullRequests());
  const address = snapshot.repository?.web ?? "";
  const pathsOf = (pattern) => snapshot.paths.filter((path) => pattern.test(path)).sort();
  const planned = snapshot.paths.includes(ORDER) || snapshot.paths.some((path) => PLAN_STEP.test(path));
  const itemPaths = pathsOf(planned ? PLAN_STEP : BACKLOG_ITEM);
  await snapshot.readMany?.([DECLARATION, ORDER, ...itemPaths, ...pathsOf(GATE_RECORD), ...snapshot.paths.filter((path) => path.startsWith(JOB_RECORDS))]
    .filter((path) => snapshot.paths.includes(path)));
  await instance.readMany?.((snapshot.paths.includes(DECLARATION) ? [INSTANCE_SPEC] : []).filter((path) => instance.paths?.includes(path)));
  const [declaration, order, items, gates] = await Promise.all([
    snapshot.paths.includes(DECLARATION) ? readDocument(declarationSchema, DECLARATION, (await snapshot.read(DECLARATION)) ?? "") : null,
    snapshot.paths.includes(ORDER) ? readDocument(planSchemas.planOrder, ORDER, (await snapshot.read(ORDER)) ?? "") : null,
    readAll(snapshot, itemPaths, artifactSchemas().item),
    readAll(snapshot, pathsOf(GATE_RECORD), gateSchema),
  ]);
  const approvals = statuses(snapshot);
  const changeQueues = await queues(snapshot);
  const { model, workflow, modelUnread } = await declaredWorkflow(declaration, instance, instanceAt);
  const jobs = await listJobs([{ address, snapshot }], new Map());
  const known = workflow !== null && workflow !== "unknown" ? workflow : null;
  const gateStatesOf = known ? gateStates(known, gates, checkedBlobs(gates, snapshot)) : [];
  const acceptance = await acceptanceStatuses(approvals, items, null, snapshot);
  const states = itemStates(itemsByNumber(items), order, { statuses: acceptance, queues: changeQueues, jobs, pullRequests, gates: gateStatesOf, workflow: known });
  return {
    address, info: "unknown", snapshot, graph: "unknown", requirements: "unknown", statuses: approvals, queues: changeQueues, declaration,
    workflow, model, modelUnread, modelSince: "unknown", participants: [], plan: { order, items, states },
    sprints: [], assignments: [], held: [], modules: [], gates, gateStates: gateStatesOf, jobs, pullRequests, schedule: "unknown", ci: "unknown", tags: "unknown",
    results: "unknown", tests: "unknown", resourceNeeds: "unknown", resultCommits: "unknown", own: isOwn(address, instance),
  };
}

/**
 * productFacts(host, instance, instanceAt, now, options?) -> Promise<Facts> — with the scope `build`, what buildInProgress takes
 * and nothing else (buildFacts above); with the scope `work`, what
 * MOD-progress-measures' file lists for it, read once from the product's default branch through `host`; every other field is
 * "unknown". With the scope `all`, the default, it adds the requirements of SPEC.md, the declarations of the test files, the
 * branch `test-results`, the tags, the repository's information, the date the declared model was declared (modelSince), the schedule, the CI runs and configuration (ci)
 * and the routes that reach the resources (resourceNeeds); graph stays "unknown".
 * @param {object} host MOD-repository-hosts' Host of the product
 * @param {object} instance the instance's Snapshot, for its participants and SPEC
 * @param {(commit: string) => Promise<object>} instanceAt the instance's Snapshot at a commit, for the commit a declaration names
 * @param {Date} now unused with the scope `work`
 * @param {{ scope: "all" | "work" | "build" }} [options]
 * @returns {Promise<object>}
 */
export async function productFacts(host, instance, instanceAt, now, options = { scope: "all" }) {
  const scope = options?.scope ?? "all";
  if (!["all", "work", "build"].includes(scope)) throw new TypeError(`a scope is "all", "work" or "build": ${String(scope)}`);
  if (scope === "build") return buildFacts(host, instance, instanceAt);
  const all = scope === "all";

  const info = await orUnknown(() => host.repositoryInfo());
  const branch = info === "unknown" ? CHECKED_OUT : info.defaultBranch;
  const snapshot = await host.readSnapshot(branch);
  const pullRequests = await orUnknown(() => host.listPullRequests());
  const address = snapshot.repository?.web ?? "";
  const pathsOf = (pattern) => snapshot.paths.filter((path) => pattern.test(path)).sort();

  const planned = snapshot.paths.includes(ORDER) || snapshot.paths.some((path) => PLAN_STEP.test(path));
  const itemPaths = pathsOf(planned ? PLAN_STEP : BACKLOG_ITEM);
  // Both scopes tell the snapshot every file they read themselves — and the job records listJobs reads — before the first read, so
  // that the snapshot fetches them in batches of a hundred where the host can (Snapshot.readMany); the instance's two files likewise.
  await snapshot.readMany?.([DECLARATION, ORDER, ...(all ? [SPEC, ...schedulingPaths(snapshot)] : []), ...itemPaths, ...pathsOf(SPRINT), ...pathsOf(ASSIGNMENT),
    ...pathsOf(GATE_RECORD), ...pathsOf(MODULE_FILE), ...snapshot.paths.filter((path) => path.startsWith(JOB_RECORDS))]
    .filter((path) => snapshot.paths.includes(path)));
  await instance.readMany?.([PARTICIPANTS, ...(snapshot.paths.includes(DECLARATION) ? [INSTANCE_SPEC] : [])].filter((path) => instance.paths?.includes(path)));
  const [declaration, order, items, sprints, assignments, gates, modules] = await Promise.all([
    snapshot.paths.includes(DECLARATION) ? readDocument(declarationSchema, DECLARATION, (await snapshot.read(DECLARATION)) ?? "") : null,
    snapshot.paths.includes(ORDER) ? readDocument(planSchemas.planOrder, ORDER, (await snapshot.read(ORDER)) ?? "") : null,
    readAll(snapshot, itemPaths, artifactSchemas().item),
    readAll(snapshot, pathsOf(SPRINT), planSchemas.sprint),
    readAll(snapshot, pathsOf(ASSIGNMENT), roleAssignmentSchema),
    readAll(snapshot, pathsOf(GATE_RECORD), gateSchema),
    readAll(snapshot, pathsOf(MODULE_FILE), artifactSchemas().module),
  ]);
  const approvals = statuses(snapshot);
  const changeQueues = await queues(snapshot);
  const { model, workflow, modelUnread } = await declaredWorkflow(declaration, instance, instanceAt);
  const registerText = await instance.read(PARTICIPANTS);
  const register = readDocument(participantSchema(), PARTICIPANTS, registerText ?? "");
  const participants = registerText === null ? [] : participantsOf(register);

  const jobs = await listJobs([{ address, snapshot }], new Map());
  const known = workflow !== null && workflow !== "unknown" ? workflow : null;
  const states = known ? gateStates(known, gates, checkedBlobs(gates, snapshot)) : [];
  const knownRequirements = all ? await requirementsOf(snapshot) : null;
  const acceptance = await acceptanceStatuses(approvals, items, knownRequirements, snapshot);
  const planStates = itemStates(itemsByNumber(items), order, { statuses: acceptance, queues: changeQueues, jobs, pullRequests, gates: states, workflow: known });

  // held: the head commits undecidedHeads names are the only ones the default branch is asked about (containsCommit), all of them at once.
  const onDefault = new Set();
  if (pullRequests !== "unknown") {
    const heads = undecidedHeads(sprints, pullRequests);
    const contained = await Promise.all(heads.map((head) => host.containsCommit(branch, head)));
    heads.forEach((head, at) => { if (contained[at]) onDefault.add(head); });
  }

  const more = all ? await allFacts(host, snapshot, knownRequirements) : { requirements: "unknown", tags: "unknown", results: "unknown", tests: "unknown" };
  const scheduling = all ? await schedulingFacts(host, branch, snapshot, instance, register) : { schedule: "unknown", ci: "unknown", resourceNeeds: "unknown" };
  return {
    address, info: all ? info : "unknown", snapshot, graph: "unknown", requirements: more.requirements, statuses: approvals, queues: changeQueues,
    declaration, workflow, model, modelUnread, modelSince: all ? await modelSinceOf(host, branch, declaration) : "unknown", participants,
    plan: { order, items, states: planStates }, sprints, assignments, held: heldItems(sprints, items, modules, pullRequests, onDefault), modules,
    gates, gateStates: states, jobs, pullRequests, schedule: scheduling.schedule, ci: scheduling.ci, tags: more.tags, results: more.results,
    tests: more.tests, resourceNeeds: scheduling.resourceNeeds, resultCommits: await resultCommitsOf(host, branch, more.results), own: isOwn(address, instance),
  };
}
