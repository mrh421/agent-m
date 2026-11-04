// stages.mjs — the six stages of a product's progress, the stage it is in, the build in progress, what waits for a person, and what
// waits for the person's acceptance in one repository (MOD-progress-measures, Interfaces: stageShares, currentStage,
// buildInProgress, waitingForAPerson, waitingForAcceptance). The first four derive from a product's Facts alone, as the Facts hold
// them; waitingForAcceptance derives from a snapshot and, for a release-test report, its host through MOD-release-evidence.
//
// Module: MOD-progress-measures
//
// Where the module file leaves a reading open, this file takes the one it names:
//   - A SPEC change entry is decided when its state is `approved` or `in SPEC` (MOD-spec-changes): a person's acceptance names it.
//   - A requirement is guarded by a passing test when a test whose `guards` name it passes (a test's `guards` is what MOD-trace-graph draws its
//     `guards` edges from; Facts.graph is never built). A test passes when its outcome is `passed` in the records of the first of
//     `resultCommits` that names it (MOD-result-records' resultsAt); a test no commit names is not run.
//   - For the instance's own repository (`own`), the bar is full once its first release is tagged: every stage is then full.
//   - A gate waits for a person when it is pending and its deciding role is held, in some role assignment, by a participant of the
//     type `person`; a gate decided by a check has no holder. The path of such a gate is the record of the job waiting at it, else the
//     product's declaration, where its gates are declared.
//   - stageShares is async.

import { statuses } from "../approvals/index.mjs";
import { reportsAwaitingAcceptance } from "../release-evidence/index.mjs";
import { resultsAt } from "../result-records/index.mjs";
import { backlogView, progressView, scheduleView } from "./views.mjs";
import { LATEST, OVERVIEW_BRANCH, buildInProgress, buildStates, currentStage, gzipped, latestOverview, openSpecChanges, storedOverview, viewFile, waitingForAPerson, waitingQueues, waitingReviewed } from "./stored.mjs";

export { currentStage, buildInProgress, waitingForAPerson, storedOverview, latestOverview, waitingQueues } from "./stored.mjs";

// The human-readable kind MOD-progress-measures' waitingForAcceptance names a reviewed file by (Interfaces), keyed by
// MOD-approvals' own kind (approval-record.schema.md). A kind with no entry here — release-report — names no
// reviewed file this item derives a wait from.
const REVIEWED_KINDS = { "use-case": "use case", "architecture-decision": "architecture decision", module: "module" };

// The states of a SPEC change entry that a person's acceptance has decided (MOD-spec-changes, Data).
const DECIDED_ENTRIES = new Set(["approved", "in SPEC"]);

// A release is tagged vYYYY.MINOR.PATCH (A RELEASE IS TAGGED AND LOGGED); a candidate's tag carries a suffix and is none.
const RELEASE_TAG = /^v\d{4}\.\d+\.\d+$/;

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const unknown = (what) => ({ share: null, detail: `the ${what} unknown` });

// ---------------------------------------------------------------- the six stages

function requirementsStage(facts) {
  const entries = facts.queues.flatMap((queue) => queue.entries);
  const open = entries.filter((entry) => !DECIDED_ENTRIES.has(entry.state));
  if (open.length) return { share: (entries.length - open.length) / entries.length, detail: `${plural(open.length, "change", "changes")} open` };
  if (facts.requirements === "unknown") return unknown("requirements are");
  return facts.requirements.length
    ? { share: 1, detail: `${plural(facts.requirements.length, "requirement", "requirements")}, no change open` }
    : { share: 0, detail: "no requirement yet" };
}

// The share of the files of the kinds given that are accepted, with the detail `none` when there is no file.
function acceptedStage(facts, kinds, text) {
  const files = [...facts.statuses.values()].filter((status) => kinds.has(status.kind));
  const accepted = files.filter((status) => status.status === "accepted").length;
  return files.length ? { share: accepted / files.length, detail: `${accepted} of ${files.length} ${text.of}` } : { share: 0, detail: text.none };
}

function implementationStage(facts) {
  if (facts.model === "unknown") return unknown("declared model is");
  if (facts.model === null) return { share: null, detail: "the process is configured when implementation starts" };
  const states = facts.plan.states;
  if (states.some((state) => state.state === "unknown")) return unknown("pull requests are");
  if (!states.length) return { share: 0, detail: "not planned yet" };
  const done = states.filter((state) => state.state === "done").length;
  const steps = facts.plan.order !== null || facts.plan.items.some((item) => item.path.startsWith("docs/plan/"));
  return { share: done / states.length, detail: `${done} of ${states.length} ${steps ? "steps" : "items"} done` };
}

// The tests that pass: those whose outcome in the records of the first of `commits` (newest first) that names them is `passed`. Each commit's
// records are read once, for the tests no newer commit named; the reading stops when every test is settled.
async function passingTests(results, commits, tests) {
  const passing = new Set();
  let pending = tests;
  for (const commit of commits) {
    if (pending.length === 0) break;
    const named = new Set();
    for (const group of await resultsAt(results, commit, pending.map(({ id, level }) => ({ id, level })))) {
      for (const test of group.tests.filter((entry) => entry.records.length > 0)) {
        named.add(test.id);
        if (test.outcome === "passed") passing.add(test.id);
      }
    }
    pending = pending.filter(({ id }) => !named.has(id));
  }
  return passing;
}

// A test passes “by the newest result record of a commit of the default branch that ran it”: the share of the requirements that a passing test guards.
async function testsStage(facts) {
  if (facts.requirements === "unknown") return unknown("requirements are");
  if (facts.tests === "unknown") return unknown("tests are");
  if (facts.results === "unknown") return unknown("test results are");
  if (facts.resultCommits === "unknown") return unknown("commits of the default branch are");
  if (!facts.requirements.length) return { share: 0, detail: "no requirement yet" };
  const passing = facts.results === null ? new Set() : await passingTests(facts.results, facts.resultCommits, facts.tests);
  const guarded = new Set(facts.tests.filter(({ id }) => passing.has(id)).flatMap((test) => test.guards));
  const count = facts.requirements.filter((requirement) => guarded.has(requirement)).length;
  return { share: count / facts.requirements.length, detail: `${count} of ${facts.requirements.length} requirements guarded by a passing test` };
}

function releaseStage(facts) {
  if (facts.tags === "unknown") return unknown("tags are");
  const released = facts.tags.map((tag) => tag.name).filter((name) => RELEASE_TAG.test(name));
  if (!released.length) return { share: 0, detail: "no release yet" };
  return { share: 1, detail: released.length === 1 ? `${released[0]} tagged` : `${released.length} releases tagged` };
}

/**
 * stageShares(facts) -> Promise<Array<{ stage: string, share: number | null, detail: string }>> — the six stages of the main
 * page's bar, in their order: Requirements, Use cases, Architecture, Implementation, Tests, Release. A share is between 0 and 1;
 * a stage whose share needs an unknown fact has none (null), and its detail says which. The tests stage reads the records of the branch test-results through resultsAt (MOD-result-records), the commits of resultCommits newest first, as far as a test is not settled; nothing else is read. For the instance's own repository (own), the bar is full once its first release is tagged.
 * @param {object} facts MOD-progress-measures' Facts
 */
export async function stageShares(facts) {
  const stages = [
    ["Requirements", requirementsStage(facts)],
    ["Use cases", acceptedStage(facts, new Set(["use-case"]), { of: "accepted", none: "no use case yet" })],
    ["Architecture", acceptedStage(facts, new Set(["architecture-decision", "module"]), { of: "files accepted", none: "not designed yet" })],
    ["Implementation", implementationStage(facts)],
    ["Tests", await testsStage(facts)],
    ["Release", releaseStage(facts)],
  ];
  // The instance's own repository has no product: its bar is full once its first release is tagged.
  const full = facts.own && stages.at(-1)[1].share === 1;
  return stages.map(([stage, { share, detail }]) => ({ stage, share: full ? 1 : share, detail }));
}

// ---------------------------------------------------------------- what waits for acceptance

/**
 * waitingForAcceptance(host, snapshot) -> Promise<Array<{ kind, id, path, blob }>> — what waits for the person's
 * acceptance in one repository (MOD-progress-measures, Interfaces): every entry of a change queue in the state open
 * (MOD-spec-changes' queues), and every use case, architecture decision and module file whose status is open or
 * changed (MOD-approvals' statuses), and a completed release candidate's report (MOD-release-evidence).
 * @param {{ listTags: (pattern: string) => Promise<Array<{ name: string, commit: string }>> }} host
 * @param {{ paths: string[], read: (path: string) => Promise<string | null>, blob: (path: string) => string | null }} snapshot
 * @returns {Promise<Array<{ kind: string, id: string, path: string, blob: string }>>}
 */
export async function waitingForAcceptance(host, snapshot) {
  const specChanges = openSpecChanges((await waitingQueues(snapshot)).queues);
  const reviewed = waitingReviewed(statuses(snapshot), REVIEWED_KINDS).map((file) => ({ ...file, blob: snapshot.blob(file.path) }));
  const report = await reportsAwaitingAcceptance(host, snapshot);
  const releaseReport = report ? [{
    kind: "release test report", id: `release-v${report.version}`, path: report.record, blob: report.blob,
  }] : [];
  return [...specChanges, ...reviewed, ...releaseReport];
}

// ---------------------------------------------------------------- the overview of a commit, stored

// The name of the declared model a card names, or null where none was read.
const modelName = (facts) => (typeof facts.model?.name === "string" ? facts.model.name : null);

// The build as the overview holds it: the states of the steps or items in progress that a job works on — as buildInProgress takes them, derived at the commit with every pull
// request — and the records of those jobs as the commit holds them, { path, text }. The main page derives the build's rows from them with the live states of those jobs alone.
async function storedBuild(snapshot, facts) {
  const rows = new Map(facts.jobs.map((row) => [row.record.id, row]));
  const states = buildStates(facts, rows);
  const paths = [...new Set(states.map((state) => rows.get(state.job).record.path))];
  return { states, records: await Promise.all(paths.map(async (path) => ({ path, text: (await snapshot.read(path)) ?? "" }))) };
}

// The change queues the overview holds: those with an entry that is not in the SPEC yet, as MOD-spec-changes' queues gives them — what the specification page lists as waiting and
// reads ahead, without reading every queue of the repository.
const undecidedQueues = (facts) => (Array.isArray(facts.queues) ? facts.queues : []).filter((queue) => queue.entries.some((entry) => entry.state !== "in SPEC"));

/**
 * publishOverview(host, snapshot, facts) -> Promise<{ commit: string, written: boolean }> — adds `<commit>.json`, `<commit>.progress.json.gz`, `<commit>.backlog.json.gz` and
 * `<commit>.schedule.json.gz` to the branch `overview-cache` by commitFiles, in one commit on the head it read: the stage shares, what waits for a person, the declared model's name, the build
 * (storedBuild) and the change queues with an entry not in the SPEC yet from `facts`, and the views of the progress, the backlog and the schedule page (views.mjs), gzipped, `facts` being read with the
 * scope `all` at the snapshot's commit. A file the branch holds already is left as it is; `written` is false when the branch holds all four — scheduleView's entry adds the schedule's view to the
 * files of publishOverview, "in the same commit as the other views". Crosses the network; fails as commitFiles fails, and with the host's NotFound where the repository has no such branch.
 * @param {object} host MOD-repository-hosts' Host @param {object} snapshot the product's snapshot @param {object} facts
 */
export async function publishOverview(host, snapshot, facts) {
  const commit = snapshot.commit;
  if (typeof commit !== "string" || commit === "") throw new TypeError("publishOverview needs the snapshot of a commit");
  const branch = await host.readSnapshot(OVERVIEW_BRANCH);
  const files = [];
  if (!branch.paths.includes(`${commit}.json`)) {
    const overview = { commit, shares: await stageShares(facts), waiting: waitingForAPerson(facts), model: modelName(facts), build: await storedBuild(snapshot, facts),
      queues: undecidedQueues(facts) };
    files.push({ path: `${commit}.json`, text: `${JSON.stringify(overview)}
` });
  }
  const now = new Date();
  for (const [page, view] of [["progress", progressView], ["backlog", backlogView], ["schedule", scheduleView]]) {
    const path = viewFile(commit, page);
    if (!branch.paths.includes(path)) files.push({ path, bytes: await gzipped(JSON.stringify(view(facts, now))) });
  }
  // latest.json names the commit of the overview stored last, which a page shows while its head's own is not stored yet (latestOverview).
  if (files.length > 0) files.push({ path: LATEST, text: `${JSON.stringify({ commit })}\n` });
  if (files.length === 0) return { commit, written: false };
  await host.commitFiles({ branch: OVERVIEW_BRANCH, expectedHead: branch.commit ?? null, message: `Overview of ${commit}`, files });
  return { commit, written: true };
}
