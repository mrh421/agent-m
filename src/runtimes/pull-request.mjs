// pull-request.mjs — the writer `branch-and-pull-request` (MOD-runtimes, Parts: pull-request.mjs; Interfaces: routeStrategies): it reads the branch a coding participant reports, opens the
// pull request for it if the participant has not, and gives it a description. It never merges: a pull request is merged once the Definition of Done holds.
//
// Module: MOD-runtimes
//
// It reads and writes only through the host of the job's context (`context.product.host`): `readSnapshot` for the branch, `listPullRequests`, `repositoryInfo` and `openPullRequest`
// for the pull request. The job's own snapshot, `context.product.snapshot`, says what the branch changed and, through MOD-trace-graph's `traceGraph`, which modules the plan steps and backlog items the job names change. Strategies, JobContext, JobResult and WriteOutcome are MOD-job-runner's types.

import { provenanceLines } from "../job-runner/index.mjs";
import { parseFrontMatter } from "../text-tools/index.mjs";
import { testDeclarations } from "../test-document/index.mjs";
import { traceGraph } from "../trace-graph/index.mjs";

// A failure of the writer's own, by name.
const failure = (name, message, fields) => Object.assign(new Error(message), { name, ...fields });
const unique = (values) => [...new Set(values)];
const named = (value) => (Array.isArray(value) ? value.map(String) : []);

// The branch the pull request is opened into where a sprint is open: that of the sprint of docs/backlog/sprints/<team>/<nn>.md, in the job's snapshot, that has no `end` and selects
// one of the backlog items the job names, provided the host holds the branch; null where there is none, and the default branch is the base.
const SPRINT_FILE = /^docs\/backlog\/sprints\/[^/]+\/\d+\.md$/;
async function sprintBase(snapshot, host, items) {
  if (items.length === 0) return null;
  for (const path of snapshot.paths.filter((each) => SPRINT_FILE.test(each))) {
    const { fields } = parseFrontMatter(await snapshot.read(path) ?? "");
    const branch = typeof fields.branch === "string" ? fields.branch.trim() : "";
    if (!branch || (typeof fields.end === "string" && fields.end.trim() !== "")) continue;
    if (!named(fields.selection).some((item) => items.includes(item))) continue;
    try { await host.readSnapshot(branch); } catch (error) { if (error?.name === "NotFound") continue; throw error; }
    return branch;
  }
  return null;
}

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

// The modules of the plan steps and backlog items the job names: the `changes` edges of their nodes in the trace graph of the job's snapshot, in the order of the names and, within a name, of its edges.
// The graph is built only where a step or an item is named.
async function modulesOf(snapshot, work) {
  if (work.length === 0) return [];
  const graph = await traceGraph(snapshot);
  return unique(work.flatMap((name) => graph.edges.filter((edge) => edge.from === name && edge.via === "changes").map((edge) => edge.to)));
}

// The description of the pull request: the job, its kind, the plan steps and backlog items it works on, their modules and the requirements the new tests guard, then the provenance lines.
function describe(result, context, modules, tests) {
  const { steps, items } = context.params ?? {};
  const guards = unique(tests.flatMap((test) => test.guards));
  const lines = [`Job: ${context.jobId}`, `Kind: ${context.kind.name}`];
  if (named(steps).length) lines.push(`Plan step: ${named(steps).join(", ")}`);
  if (named(items).length) lines.push(`Backlog item: ${named(items).join(", ")}`);
  if (modules.length) lines.push(`Modules: ${modules.join(", ")}`);
  if (guards.length) lines.push(`Requirements guarded by the new tests: ${guards.join("; ")}`);
  lines.push("", ...provenanceLines({ agentM: context.agentM, jobId: context.jobId, kind: context.kind.name, participant: result.drafter, rounds: result.rounds.length }));
  return lines.join("\n");
}

/**
 * The writer branch-and-pull-request(result, context) -> Promise<WriteOutcome> — reads the branch the participant's answer reports (`result.draft.branch`) through `context.product.host`;
 * with a host of a server's API it opens the pull request into the branch of the open sprint that selects one of the job's backlog items, else into the default branch `repositoryInfo` names, unless the branch has one open or merged, and gives it the description of
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
  const base = await sprintBase(snapshot, host, named(context.params?.items)) ?? defaultBranch;
  const opened = await host.openPullRequest({ branch: name, base, title: `${context.jobId}: ${context.kind.name}${work.length ? ` ${work.join(", ")}` : ""}`,
    body: describe(result, context, await modulesOf(snapshot, work), await newTests(branch, snapshot, files)) });
  return outcome(opened.url);
}

// routeStrategies: MOD-job-runner's Partial<Strategies> with the one writer.
export const routeStrategies = { writers: { "branch-and-pull-request": branchAndPullRequest } };
