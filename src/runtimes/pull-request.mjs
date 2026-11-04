// pull-request.mjs — the writer `branch-and-pull-request` (MOD-runtimes, Parts: pull-request.mjs; Interfaces: routeStrategies): it reads the branch a coding participant reports, opens the
// pull request for it if the participant has not, and gives it a description. It never merges: a pull request is merged once the Definition of Done holds.
//
// Module: MOD-runtimes
//
// It reads and writes only through the host of the job's context (`context.product.host`): `readSnapshot` for the branch, `listPullRequests`, `repositoryInfo` and `openPullRequest`
// for the pull request. The job's own snapshot, `context.product.snapshot`, says what the branch changed and, through MOD-trace-graph's `traceGraph`, which modules the plan steps and backlog items the job names change.
// The pull request goes into MOD-work-plans' targetBranch of the first step or item the job names, over the sprint records, the plan's order and the declaration's ## Branches (MOD-product-process' branchesOf) that the
// job's snapshot holds, read with MOD-documents' readDocument, and the default branch `repositoryInfo` names. The same graph gives the requirements and use cases the steps and items realise, and their `origin`, read with
// MOD-documents' readDocument, the issues they come from; the description names both. Strategies, JobContext, JobResult and WriteOutcome are MOD-job-runner's types.

import { artifactSchemas, readDocument } from "../documents/index.mjs";
import { provenanceLines } from "../job-runner/index.mjs";
import { branchesOf, declarationSchema } from "../product-process/index.mjs";
import { testDeclarations } from "../test-document/index.mjs";
import { traceGraph } from "../trace-graph/index.mjs";
import { planSchemas, targetBranch } from "../work-plans/index.mjs";

const SPRINT = /^docs\/backlog\/sprints\/[^/]+\/[^/]+\.md$/;
const ORDER = "docs/plan/order.md";
const DECLARATION = "docs/process.md";
// An issue's address as an item's `origin` holds it: GitHub's `.../issues/<n>`, GitLab's `.../-/issues/<n>`; a requirement's name or a use case among the origins is none.
const ISSUE_ADDRESS = /^https?:\/\/\S+\/(?:-\/)?issues\/\d+$/;

// A failure of the writer's own, by name.
const failure = (name, message, fields) => Object.assign(new Error(message), { name, ...fields });
const unique = (values) => [...new Set(values)];
const named = (value) => (Array.isArray(value) ? value.map(String) : []);

// The files the branch adds or changes against the job's snapshot: those whose blob differs from the blob the snapshot has, a file the snapshot lacks having none.
const changedFiles = (branch, snapshot) => branch.paths.filter((path) => branch.blob(path) !== snapshot.blob(path)).sort();

// The declarations of the new tests, in the order of the changed files: those in a changed file whose identifier the snapshot's version of the file does not declare.
async function newTests(branch, snapshot, files) {
  const found = [];
  for (const path of files) {
    const declarations = testDeclarations(path, await branch.read(path) ?? "");
    if (declarations.length === 0) continue;
    const before = new Set(testDeclarations(path, await snapshot.read(path) ?? "").map((declaration) => declaration.id));
    found.push(...declarations.filter((declaration) => !before.has(declaration.id)));
  }
  return found;
}

// The snapshot read through a memory, so that the graph and the origins read each file once.
function remembering(snapshot) {
  const seen = new Map();
  return { ...snapshot, paths: snapshot.paths, read: (path) => { if (!seen.has(path)) seen.set(path, snapshot.read(path)); return seen.get(path); } };
}

// What the plan steps and backlog items the job names say: their modules and the requirements and use cases they realise — the `changes` and `realises` edges of their nodes in the trace graph of the job's snapshot —, and the
// issues they come from — the entries of their `origin` that are an issue's address —, each once, in the order of the names and, within a name, of its entries. The graph is built only where a step or an item is named.
async function workOf(snapshot, work) {
  if (work.length === 0) return { modules: [], realises: [], issues: [] };
  const memory = remembering(snapshot);
  const graph = await traceGraph(memory);
  const targets = (via) => unique(work.flatMap((name) => graph.edges.filter((edge) => edge.from === name && edge.via === via).map((edge) => edge.to)));
  const origins = await Promise.all(work.map(async (name) => {
    const node = graph.nodes.get(name);
    return node?.kind === "ITM" ? named(readDocument(artifactSchemas().item, node.path, (await memory.read(node.path)) ?? "").fields.origin) : [];
  }));
  return { modules: targets("changes"), realises: targets("realises"), issues: unique(origins.flat().filter((entry) => ISSUE_ADDRESS.test(entry))) };
}

// The branch the pull request goes into: targetBranch of the step or item, over the sprint records, the plan's order and the declared branches the job's snapshot holds — each read only where the snapshot
// holds it —, with the default branch. Without a step or an item, the default branch, and nothing is read.
async function baseOf(snapshot, item, defaultBranch) {
  if (item === undefined) return defaultBranch;
  const has = (path) => snapshot.paths.includes(path);
  const read = async (schema, path) => readDocument(schema, path, (await snapshot.read(path)) ?? "");
  const sprints = await Promise.all(snapshot.paths.filter((path) => SPRINT.test(path)).map((path) => read(planSchemas.sprint, path)));
  const order = has(ORDER) ? await read(planSchemas.planOrder, ORDER) : null;
  const branches = has(DECLARATION) ? branchesOf(await read(declarationSchema, DECLARATION)) : {};
  return targetBranch(item, { sprints, order, branches, defaultBranch });
}

// The description of the pull request: the job, its kind, the day the job ran (the context's `now`, in UTC), the plan steps and backlog items it works on, their modules, the requirements and use cases they realise, the issues they come from and the requirements the new tests
// guard, then the provenance lines.
function describe(result, context, { modules, realises, issues }, tests) {
  const { steps, items } = context.params ?? {};
  const guards = unique(tests.flatMap((test) => test.guards));
  const lines = [`Job: ${context.jobId}`, `Kind: ${context.kind.name}`, `Date: ${context.now.toISOString().slice(0, 10)}`];
  if (named(steps).length) lines.push(`Plan step: ${named(steps).join(", ")}`);
  if (named(items).length) lines.push(`Backlog item: ${named(items).join(", ")}`);
  if (modules.length) lines.push(`Modules: ${modules.join(", ")}`);
  if (realises.length) lines.push(`Realises: ${realises.join(", ")}`);
  if (issues.length) lines.push(`Issue: ${issues.join(", ")}`);
  if (guards.length) lines.push(`Requirements guarded by the new tests: ${guards.join("; ")}`);
  lines.push("", ...provenanceLines({ agentM: context.agentM, jobId: context.jobId, kind: context.kind.name, participant: result.drafter, rounds: result.rounds.length }));
  return lines.join("\n");
}

/**
 * The writer branch-and-pull-request(result, context) -> Promise<WriteOutcome> — reads the branch the participant's answer reports (`result.draft.branch`) through `context.product.host`;
 * with a host of a server's API it opens the pull request into the branch baseOf gives, unless the branch has one open or merged, and gives it the description of
 * `describe`; with a local host — one whose `listPullRequests` throws NotSupported — it opens nothing. It returns the pull request's address, or the one the agent reported. Throws NoBranch
 * for a branch the host does not hold, NoCommits for one with no commit beyond the job's snapshot, and what the host throws.
 */
async function branchAndPullRequest(result, context) {
  const { host, snapshot } = context.product;
  const draft = result.draft ?? {};
  const name = draft.branch;
  if (typeof name !== "string" || name === "") throw failure("NoBranch", "the answer reports no branch", { branch: name ?? null });
  let branch;
  try {
    branch = await host.readSnapshot(name);
  } catch (error) {
    if (error?.name === "NotFound") throw failure("NoBranch", `the branch ${name} is not on the host`, { branch: name });
    throw error;
  }
  if (branch.commit === snapshot.commit) throw failure("NoCommits", `the branch ${name} has no commit beyond the job's snapshot ${snapshot.commit}`, { branch: name });

  const files = changedFiles(branch, snapshot);
  const outcome = (pullRequest) => ({ commits: named(draft.commits), files, pullRequest, shown: draft, notes: [] });
  let existing;
  try {
    existing = (await host.listPullRequests({ branch: name, state: "all" })).find((pull) => pull.state === "open" || pull.state === "merged");
  } catch (error) {
    if (error?.name === "NotSupported") return outcome(draft.pullRequest || null);
    throw error;
  }
  if (existing) return outcome(existing.url);

  const { defaultBranch } = await host.repositoryInfo();
  const work = [...named(context.params?.steps), ...named(context.params?.items)];
  const opened = await host.openPullRequest({ branch: name, base: await baseOf(snapshot, work[0], defaultBranch), title: `${context.jobId}: ${context.kind.name}${work.length ? ` ${work.join(", ")}` : ""}`,
    body: describe(result, context, await workOf(snapshot, work), await newTests(branch, snapshot, files)) });
  return outcome(opened.url);
}

// routeStrategies: MOD-job-runner's Partial<Strategies> with the one writer.
export const routeStrategies = { writers: { "branch-and-pull-request": branchAndPullRequest } };
