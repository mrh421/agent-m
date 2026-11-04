// stored.mjs — what MOD-progress-measures reads back from the branch `overview-cache` and derives from Facts without another module: the overview and the views stored for a
// commit (storedOverview, latestOverview, waitingQueues, storedView), the stage a product is in, its build in progress and what waits for a person (currentStage,
// buildInProgress, waitingForAPerson). A page that shows what is stored loads this file alone, not the derivation of the facts and the views (stages.mjs, views.mjs, facts.mjs).
// MOD-spec-changes is imported only where no overview is stored.
//
// Module: MOD-progress-measures

/** The branch that holds the overviews and the views (Data). */
export const OVERVIEW_BRANCH = "overview-cache";
/** The file of that branch that names the commit stored last (Data). */
export const LATEST = "latest.json";
/** The file of a page's view of a commit (Data). */
export const viewFile = (commit, page) => `${commit}.${page}.json.gz`;
// The rows of the ScheduleView's counts: the five levels and the tests that call a paid service.
export const COUNTED = ["unit", "component", "system", "release", "user", "paid"];
// What each page's view holds, by which a view of another format is told apart: a list of the progress's teams or the backlog's rows, the schedule's count of every row.
const FORMAT = { progress: (view) => Array.isArray(view.teams), backlog: (view) => Array.isArray(view.rows),
  schedule: (view) => COUNTED.every((row) => Number.isInteger(view.counts?.[row])) };

// The statuses MOD-approvals derives that still wait for the person's acceptance — not accepted.
const WAITING_STATUSES = new Set(["open", "changed"]);

// Every queue's folder, docs/spec-freigaben/<slug>/ (MOD-spec-changes, Data), stripped to build an entry's
// identifier, spec-<slug>-<NN> (MOD-approvals, Data: the approval record's path for an entry of a change queue).
const QUEUE_FOLDER_PREFIX = "docs/spec-freigaben/";

// The entries of the queues that are open — the SPEC changes that wait for a person: { kind, id, path, blob }.
export function openSpecChanges(queueList) {
  return queueList.flatMap((queue) => {
    const slug = queue.folder.slice(QUEUE_FOLDER_PREFIX.length);
    return queue.entries
      .filter((entry) => entry.state === "open")
      .map((entry) => ({
        kind: "SPEC change",
        id: `spec-${slug}-${String(entry.number).padStart(2, "0")}`,
        path: entry.proposal.path,
        blob: entry.proposal.blob,
      }));
  });
}

// The reviewed files of the kinds given whose status is open or changed: { kind, id, path }.
export function waitingReviewed(statusMap, kinds) {
  return [...statusMap]
    .filter(([, status]) => Object.hasOwn(kinds, status.kind) && WAITING_STATUSES.has(status.status))
    .map(([path, status]) => ({ kind: kinds[status.kind], id: status.id, path }));
}

/**
 * currentStage(shares) -> string | null — the first stage that is not full: a share below 1, or none. Null when every stage is full.
 * @param {Array<{ stage: string, share: number | null }>} shares
 */
export function currentStage(shares) {
  return shares.find(({ share }) => share === null || share < 1)?.stage ?? null;
}

// ---------------------------------------------------------------- the build

// The states of the plan's steps or items in progress that a job of `rows` (the job rows by identifier) works on, in the plan's order.
export const buildStates = (facts, rows) => facts.plan.states.filter((state) => state.state === "in progress" && rows.has(state.job));

/**
 * buildInProgress(facts) -> Array<{ item, job, participant, state, elapsed, reachable }> — the steps or items in progress that a job
 * works on, in the plan's order: the job's participant, its state as its record and the live state give it, its elapsed time in
 * seconds, and whether its runtime answers. An item whose pull request is merged is done and is not listed.
 * @param {object} facts MOD-progress-measures' Facts
 */
export function buildInProgress(facts) {
  const rows = new Map(facts.jobs.map((row) => [row.record.id, row]));
  return buildStates(facts, rows).map((state) => {
    const row = rows.get(state.job);
    return { item: state.item, job: state.job, participant: row.record.participant, state: row.state, elapsed: row.elapsed,
      reachable: row.source.reachable };
  });
}

// ---------------------------------------------------------------- what waits for a person

// The participants that hold each role, by role, in the role assignments of the facts.
function holdersByRole(assignments) {
  const holders = new Map();
  for (const row of assignments.flatMap((assignment) => assignment.sections.flatMap((section) => section.rows ?? []))) {
    holders.set(row.cells.Role, [...(holders.get(row.cells.Role) ?? []), ...row.cells.Participants]);
  }
  return holders;
}

// The pending gates a person decides: { kind: "gate", id, path }.
function gatesOfAPerson(facts) {
  if (!facts.workflow || facts.workflow === "unknown") return [];
  const people = new Set(facts.participants.filter((participant) => participant.type === "person").map((participant) => participant.name));
  const holders = holdersByRole(facts.assignments);
  const pending = new Set(facts.gateStates.filter((state) => state.state === "pending").map((state) => state.gate));
  return facts.workflow.gates
    .filter((gate) => pending.has(gate.name) && (holders.get(gate.decider) ?? []).some((holder) => people.has(holder)))
    .map((gate) => {
      const waiting = facts.jobs.find((row) => row.state === "waiting at a gate"
        && row.record.gates.some((reached) => reached.gate === gate.name && reached.resumedBy === null));
      return { kind: "gate", id: gate.name, path: waiting ? waiting.record.path : facts.declaration.path };
    });
}

/**
 * waitingForAPerson(facts) -> Array<{ kind: "use case" | "SPEC change" | "gate" | "failed job", id, path }> — what waits for a
 * person in the product: its open or changed use cases, its open SPEC change entries, its pending gates whose deciding role a person
 * holds, and its failed jobs; `path` is the file or record each concerns.
 * @param {object} facts MOD-progress-measures' Facts
 */
export function waitingForAPerson(facts) {
  const changes = openSpecChanges(facts.queues).map(({ kind, id, path }) => ({ kind, id, path }));
  const failed = facts.jobs.filter((row) => row.state === "failed").map((row) => ({ kind: "failed job", id: row.record.id, path: row.record.path }));
  return [...waitingReviewed(facts.statuses, { "use-case": "use case" }), ...changes, ...gatesOfAPerson(facts), ...failed];
}

// ---------------------------------------------------------------- stored

const through = (bytes, stream) => new Response(new Blob([bytes]).stream().pipeThrough(stream));
/** A text gzipped: the platform's CompressionStream, the same in a browser and in Node. */
export const gzipped = async (value) => new Uint8Array(await through(new TextEncoder().encode(value), new CompressionStream("gzip")).arrayBuffer());
const gunzipped = (bytes) => through(bytes, new DecompressionStream("gzip")).text();

// A readOn that answers null for a missing branch or file (NotFound).
async function readOrNull(readOn, path, options) {
  try {
    return await readOn(OVERVIEW_BRANCH, path, options);
  } catch (error) {
    if (error?.name === "NotFound") return null;
    throw error;
  }
}

/**
 * The commit `latest.json` names, read with one readOn; null where the branch or the file is missing or holds no commit.
 * @param {(branch: string, path: string, options?: object) => Promise<string | Uint8Array | null>} readOn
 */
export async function latestCommit(readOn) {
  const named = await readOrNull(readOn, LATEST);
  let commit = "";
  try { commit = typeof named === "string" ? String(JSON.parse(named)?.commit ?? "") : ""; } catch { return null; }
  return /^[0-9a-f]{40}$/.test(commit) ? commit : null;
}

// The view of `page` stored for `commit`, or null where it is missing or of another format.
async function readView(readOn, commit, page) {
  const bytes = await readOrNull(readOn, viewFile(commit, page), { bytes: true });
  if (!(bytes instanceof Uint8Array)) return null;
  let held;
  try { held = JSON.parse(await gunzipped(bytes)); } catch { return null; }
  return held !== null && typeof held === "object" && held.commit === commit && FORMAT[page](held) ? held : null;
}

/**
 * storedView(snapshot: Snapshot, page: "progress" | "backlog" | "schedule") -> Promise<{ view, asOf: string | null } | null> — the page's view of the snapshot's commit, in one request,
 * and asOf null; while that is not stored yet, the view of the commit latest.json names, in two requests more, and asOf that commit; null without readOn, or where neither is
 * stored or one holds another format. Fails with the host's errors but NotFound.
 * @param {object} snapshot @param {"progress" | "backlog" | "schedule"} page
 */
export async function storedView(snapshot, page) {
  if (!Object.hasOwn(FORMAT, page)) throw new TypeError(`a stored view is the progress's, the backlog's or the schedule's: ${String(page)}`);
  if (typeof snapshot?.readOn !== "function" || typeof snapshot.commit !== "string") return null;
  const own = await readView(snapshot.readOn, snapshot.commit, page);
  if (own) return { view: own, asOf: null };
  const commit = await latestCommit(snapshot.readOn);
  if (commit === null || commit === snapshot.commit) return null;
  const last = await readView(snapshot.readOn, commit, page);
  return last ? { view: last, asOf: commit } : null;
}

// The overviews read in this page, by repository and commit: a commit's overview does not change once it is stored, so it is read once however many snapshots of the commit
// (of one repository, as the host gives them) ask; a snapshot with no object as its repository is kept by itself. One that is missing or failed is not kept, and is read again at the next call.
const OVERVIEWS = new WeakMap();

const isFile = (value) => value !== null && typeof value === "object" && typeof value.path === "string" && typeof value.text === "string";

/**
 * storedOverview(snapshot) -> Promise<{ shares, waiting, model, build: { states, records }, queues } | null> — the overview stored for the snapshot's commit, read with the
 * snapshot's readOn in one request, once for each commit of a repository in a page; null where the branch or the file is missing or holds another format (not JSON, another shape, another commit, or an
 * overview without the model, the build and the queues).
 * @param {object} snapshot
 */
export function storedOverview(snapshot) {
  if (snapshot === null || typeof snapshot !== "object") return Promise.resolve(null);
  const scope = snapshot.repository !== null && typeof snapshot.repository === "object" ? snapshot.repository : snapshot;
  if (!OVERVIEWS.has(scope)) OVERVIEWS.set(scope, new Map());
  const kept = OVERVIEWS.get(scope);
  const commit = snapshot.commit;
  if (!kept.has(commit)) {
    const reading = readOverview(snapshot);
    kept.set(commit, reading);
    reading.then((held) => { if (held === null) kept.delete(commit); }, () => kept.delete(commit));
  }
  return kept.get(commit);
}

/**
 * latestOverview(snapshot) -> Promise<{ commit, shares, waiting, model, build, queues } | null> — the overview stored last on the branch, whichever commit it is of, as the file
 * latest.json names it: what a page shows while the overview of its head is not stored yet, never deriving one itself. Null where the branch, `latest` or that overview is missing.
 * @param {object} snapshot
 */
export async function latestOverview(snapshot) {
  if (typeof snapshot?.readOn !== "function") return null;
  const commit = await latestCommit(snapshot.readOn);
  if (commit === null) return null;
  const held = await readOverview({ readOn: snapshot.readOn, commit });
  return held && { commit, ...held };
}

/**
 * waitingQueues(snapshot) -> Promise<{ queues, asOf: string | null }> — the change queues with an entry not in the SPEC yet: those of the overview stored for the snapshot's commit, and asOf
 * null; while that is not stored yet, those of the overview stored last, and asOf its commit; where the repository stores no overview, those MOD-spec-changes' queues derives from every queue
 * of the snapshot, and asOf null. Fails with the host's errors but NotFound.
 * @param {object} snapshot
 */
export async function waitingQueues(snapshot) {
  const own = await storedOverview(snapshot);
  if (own) return { queues: own.queues, asOf: null };
  const last = await latestOverview(snapshot);
  if (last) return { queues: last.queues, asOf: last.commit };
  return { queues: await (await import("../spec-changes/index.mjs")).queues(snapshot), asOf: null };
}

async function readOverview(snapshot) {
  if (typeof snapshot.readOn !== "function" || typeof snapshot.commit !== "string") return null;
  let text;
  try {
    text = await snapshot.readOn(OVERVIEW_BRANCH, `${snapshot.commit}.json`);
  } catch (error) {
    if (error?.name === "NotFound") return null;
    throw error;
  }
  if (typeof text !== "string") return null;
  let held;
  try { held = JSON.parse(text); } catch { return null; }
  if (held === null || typeof held !== "object" || held.commit !== snapshot.commit || !Array.isArray(held.shares) || !Array.isArray(held.waiting)) return null;
  const { build } = held;
  if (!(held.model === null || typeof held.model === "string") || !Array.isArray(build?.states) || !Array.isArray(build?.records) || !build.records.every(isFile)
    || !Array.isArray(held.queues)) return null;
  return { shares: held.shares, waiting: held.waiting, model: held.model, build: { states: build.states, records: build.records }, queues: held.queues };
}
