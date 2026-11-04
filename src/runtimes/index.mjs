// MOD-runtimes — the three routes a job takes (docs/architecture/MOD-runtimes.md): its interface. Of it, this item
// (ITM-253) builds Route and queueJob for the CI route alone: the job's start record committed on the head that was
// read, as the person's commit, whose push starts the product's job workflow; WorkflowMissing, naming the job
// workflow's file, for a product without it; and the host's other failures, by name. ITM-318 builds RouteOffer, ResourceNeed
// and routesFor (routes.mjs): the routes a participant offers, with the reason of each that cannot be taken. ITM-322 builds
// jobWorkflowFiles (ci.mjs) with the templates workflow/github.yml and workflow/gitlab.yml. bridgeAgentDriver
// is not part of
// this item (UC-010, UC-011, UC-036) and is not built yet; nor is a job of a run
// (start.run, MOD-job-ledger's appendToRecord). ITM-319 builds queueJob's tab route and runOnTab (tab.mjs); ITM-325 its Bridge route and bridgeDriver (bridge.mjs).
// ITM-535 builds liveState, jobLog and cancelJob for the CI route, the tab's route and a job no runtime has taken; ITM-545 for a job taken on a Bridge, through MOD-bridge-client's bridgeJobs, bridgeJobLog and cancelOnBridge (bridge.mjs).
// ITM-495 builds handOverJob (hand-over.mjs) and the inputs task and endpoint of the GitHub template; ITM-973 builds retryJob (retry.mjs).
// ITM-567 builds routeStrategies (pull-request.mjs): the writer branch-and-pull-request. ITM-790 builds resumeJob. ITM-1280 builds liveStates: one listing of a repository's job workflow runs for all its records.
//
// Module: MOD-runtimes
//
// It belongs to Participants and jobs (ARC-046). It uses MOD-job-ledger and MOD-repository-hosts only through their
// index.mjs. ci.mjs is private to it, besides the RuntimeError it re-exports here.

import { appendToRecord } from "../job-ledger/index.mjs";
import { readDocument } from "../documents/index.mjs";
import { gateSchema } from "../product-process/index.mjs";
import { cancelRun, jobWorkflowRuns, queueOnCi, runOfAddress } from "./ci.mjs";
import { abortOnTab, browserStore, dropOnTab, endOnTab, heldOnTab, queueOnTab, requireWaitingOnTab, tookOnTab } from "./tab.mjs";
import { retryJob as retryWith } from "./retry.mjs";
import { bridgeNamed, cancelBridgeJob, followBridgeLog, handOverAgain, listedOnBridge, queueOnBridge } from "./bridge.mjs";

export { routesFor } from "./routes.mjs";
export { jobWorkflowFiles, gitlabVariableScopes } from "./ci.mjs";
export { tabContext, runOnTab } from "./tab.mjs";
export { bridgeDriver } from "./bridge.mjs";
export { jobTrail, revertAfterCancel } from "./trail.mjs";
import { writtenAfterCancel } from "./trail.mjs";
export { handOverJob } from "./hand-over.mjs";
export { routeStrategies } from "./pull-request.mjs";

export { RuntimeError } from "./ci.mjs";

/**
 * Route: where a job runs; a runner other than "hosted" is a self-hosted runner's label (MOD-runtimes, Interfaces).
 * @typedef {{ kind: "tab" } | { kind: "ci", runner: "hosted" | string } | { kind: "bridge", bridge: string }} Route
 */

/**
 * queueJob(host, start, route, head, bridge?) -> Promise<{ path: string, commit: string }> (MOD-runtimes,
 * Interfaces). This item (ITM-253) builds the CI route alone: commits the job's start record, through MOD-job-
 * ledger's startRecord, on the head that was read, as the person's commit, on the branch the host's repositoryInfo
 * names; refused with WorkflowMissing, naming the job workflow's file, when the head read does not hold it. The push
 * starts the product's job workflow. Crosses the network through the host; fails with what the host names — the
 * branch moved, a refused token, a used-up rate limit —, and with WorkflowMissing of its own. The tab's route (ITM-319) commits the start and its
 * taking in one commit; the Bridge's route is UC-011's and is not built yet.
 * @param {unknown} host MOD-repository-hosts' Host.
 * @param {unknown} start MOD-job-ledger's JobStart.
 * @param {Route} route
 * @param {string} head
 * @param {unknown} [bridge]
 * @returns {Promise<{ path: string, commit: string }>}
 */
export async function queueJob(host, start, route, head, bridge) {
  if (route.kind === "ci") return queueOnCi(host, start, head, browserStore());
  if (route.kind === "tab") return queueOnTab(host, start, head);
  if (route.kind === "bridge") return queueOnBridge(host, start, head, bridge);
  throw new Error(`queueJob: the "${route.kind}" route is not built yet (UC-010, UC-011)`);
}

/**
 * retryJob(record, choice, host, head) -> Promise<{ path: string, commit: string }> (MOD-runtimes, Interfaces; retry.mjs) — queues a new job with a new identifier and the record's inputs and
 * parameters, which names the one it retries, to the chosen participant on the chosen route, with queueJob. Fails with TaskNotInRecord for a job whose task travelled with its hand-over, and as
 * queueJob fails.
 */
export function retryJob(record, choice, host, head) {
  return retryWith(record, choice, host, head, queueJob);
}

/**
 * resumeJob(record, gateRecord, route, host, head, bridge?) -> Promise<void> (MOD-runtimes, Interfaces; ITM-790) — appends the resumption, naming the gate record, to the record on the head read, as the person's commit, and hands the job
 * back to its route: in the tab it goes on from the result the tab kept for it, its end appended as a job of the tab ends; on a Bridge it is handed over again when `bridge` is given, else the Bridge takes it up when it next
 * reads the repository; on CI the push itself starts the job workflow. Where the gate record is a rejection (`decision: rejected`; ITM-1412) the job ends instead: one commit on the head read appends its End, `failed`, with the
 * gate, the gate record and the record's reason as its reason, and nothing goes on — the tab drops the result it kept, a Bridge is not asked, CI starts nothing. A record that is not rejected, or that the repository
 * does not hold, resumes. Fails with NotHeld { job } for a tab job of which the tab keeps no result — before anything is committed — (not for a rejection, whose end needs no result), with MOD-job-ledger's NotWaiting for a job
 * at no gate or at a gate already resumed and RecordEnded for an ended one, with what the host names (Moved among them: nothing is committed then), and with what the Bridge client names after the commit.
 */
export async function resumeJob(record, gateRecord, route, host, head, bridge) {
  const [{ defaultBranch }, snapshot] = await Promise.all([host.repositoryInfo(), host.readSnapshot(head)]);
  const decided = await snapshot.read(gateRecord);
  const rejection = decided === null ? null : readDocument(gateSchema, gateRecord, decided);
  if (rejection?.fields.decision === "rejected") return endRejected(record, gateRecord, rejection, route, host, { defaultBranch, snapshot, head });
  if (route.kind === "tab") requireWaitingOnTab(record.id);
  const text = appendToRecord(await snapshot.read(record.path), { part: "resumed", at: new Date(), gateRecord });
  const { commit } = await host.commitFiles({ branch: defaultBranch, expectedHead: head, files: [{ path: record.path, text }], message: `Job ${record.id}: resumed` });
  if (route.kind === "tab") await endOnTab(record, host);
  else if (route.kind === "bridge" && bridge) await handOverAgain(bridge, snapshot.repository.web, record.path, commit);
}

// A job whose gate was rejected: its End, `failed`, naming the gate the job last reached, the gate record and the record's `## Reason` on one line, committed on the head read; the tab then forgets the result it kept.
async function endRejected(record, gateRecord, rejection, route, host, { defaultBranch, snapshot, head }) {
  if (record.gates.at(-1)?.resumedBy !== null) throw Object.assign(new Error(`the job ${record.id} is not at a gate: there is nothing to end`), { name: "NotWaiting" });
  const why = rejection.sections.find((section) => section.heading === "## Reason")?.text.replace(/\s+/g, " ").trim();
  const text = appendToRecord(await snapshot.read(record.path), { part: "end", at: new Date(), state: "failed", results: [], draft: null, rounds: [], usage: null,
    cost: { known: false, usage: null }, reason: `the gate ${record.gates.at(-1).gate} was rejected by ${gateRecord}${why ? `: ${why}` : ""}`, log: null });
  await host.commitFiles({ branch: defaultBranch, expectedHead: head, files: [{ path: record.path, text }], message: `Job ${record.id}: end` });
  if (route.kind === "tab") dropOnTab(record.id);
}

// ---------------------------------------------------------------- a job's live state, its log and its cancel (ITM-535, ITM-545)

const UNKNOWN = { reachable: true, reason: null, known: false, running: false, cancelling: false, log: null, usage: null, writtenAfterCancel: [] };

// Which runtime took the job, from the `by:` of its `## Taken` (MOD-job-ledger, Data: "a CI run's address, a Bridge's name, this tab"): none; the tab; CI — a run's address, or `ci <runner>` where the
// run's address was not known —; any other is a Bridge's name.
function takenOn(record) {
  const by = record.taken?.by ?? null;
  if (by === null) return "none";
  if (by === "tab" || by.startsWith("tab ")) return "tab";
  return /^https?:\/\//.test(by) || by.startsWith("ci ") ? "ci" : "bridge";
}

/**
 * liveState(record, product, bridges) -> Promise<LiveState> — what the runtime that took the job reports (MOD-runtimes, Interfaces). A job no runtime has taken is unknown; a job taken on CI is running while its run
 * is queued, running or waiting, with the run's address as its log; one taken by this tab is running while the tab holds it; one taken on a Bridge is the job with the record's id among the Bridge's jobs
 * (bridgeJobs), running while its state is `running`, with its usage, and unknown where the Bridge lists none. A failure of the host, a Bridge missing from `bridges` and a Bridge that does not answer give
 * `reachable: false` and the reason (the client's, for a Bridge), never an error. `writtenAfterCancel` holds, for a job that ended cancelled, the commits of the branch named after the job dated after the cancel (trail.mjs), and is empty for any other.
 */
export function liveState(record, product, bridges) {
  return stateOf(record, product, bridges, () => undefined);
}

/**
 * liveStates(records, product, bridges) -> Promise<Map<string, LiveState>> — liveState for each of the records of one repository that have not ended, keyed by the job's identifier in the order of the records
 * (MOD-runtimes, Interfaces): the runs of the job workflow are listed once for all of them, when the first record taken on CI asks for them, and not at all where none is; the same states liveState gives one
 * by one, a failed listing included — each record taken on CI is then `reachable: false` with its reason.
 */
export async function liveStates(records, product, bridges) {
  const open = records.filter((record) => !record.end);
  let listed;
  const runs = () => (listed ??= jobWorkflowRuns(product.host));
  const states = await Promise.all(open.map((record) => stateOf(record, product, bridges, runs)));
  return new Map(open.map((record, at) => [record.id, states[at]]));
}

// The live state of one record (liveState); `runs()` gives the listing of the job workflow's runs a CI record is found in — undefined, where each record lists them for itself.
async function stateOf(record, product, bridges, runs) {
  // A job that ended cancelled has no runtime to ask: what its branch got after the cancel is what is reported (UC-036 6a).
  if (record.end?.state === "cancelled") {
    try {
      return { ...UNKNOWN, writtenAfterCancel: await writtenAfterCancel(record, product.host) };
    } catch (error) {
      return { ...UNKNOWN, reachable: false, reason: String(error?.message ?? error) };
    }
  }
  switch (takenOn(record)) {
    case "none": return { ...UNKNOWN };
    case "tab":
      if (heldOnTab(record.id)) return { ...UNKNOWN, known: true, running: true };
      // A job another browser took: its tab's closing cannot be seen here, so it stays unreachable (UC-036 1b).
      return tookOnTab(record.taken.by) === "this" ? { ...UNKNOWN }
        : { ...UNKNOWN, reachable: false, reason: "its live state and log exist only in that browser's tab" };
    case "bridge":
      try {
        const job = await listedOnBridge(bridgeNamed(bridges, record.taken.by), record.id);
        return job ? { ...UNKNOWN, known: true, running: job.state === "running", usage: job.usage ?? null } : { ...UNKNOWN };
      } catch (error) {
        return { ...UNKNOWN, reachable: false, reason: String(error?.message ?? error) };
      }
    default:
      try {
        const run = await runOfAddress(product.host, record.taken.by, runs());
        if (!run) return { ...UNKNOWN };
        return { ...UNKNOWN, known: true, running: ["queued", "running", "waiting"].includes(run.state), log: run.url };
      } catch (error) {
        return { ...UNKNOWN, reachable: false, reason: String(error?.message ?? error) };
      }
  }
}

/**
 * jobLog(record, product, bridges) -> Promise<{ stream: AsyncIterable<string> } | { address: string } | { gone: true }> — the CI run's log by the run's address; `{ gone: true }` for a run the server no longer lists,
 * for the tab, which keeps no log apart from the page, and for a job no runtime has taken. A job taken on a Bridge gives `{ stream }`, which asks the Bridge's log from line 0 and again from the answer's `next` until
 * it has ended (followBridgeLog); the Bridge client's failures are thrown by the stream, and a Bridge missing from `bridges` is refused with NotFound { what } (the Bridge's name). A CI job fails as the host fails.
 */
export async function jobLog(record, product, bridges) {
  switch (takenOn(record)) {
    case "bridge": return { stream: followBridgeLog(bridgeNamed(bridges, record.taken.by), record.id) };
    case "ci": {
      const run = await runOfAddress(product.host, record.taken.by);
      return run ? { address: run.url } : { gone: true };
    }
    default: return { gone: true };
  }
}

// The record's end, `cancelled`, appended as a commit on the head read, as hand-over.mjs appends a failed end (and runOnTab its parts).
async function endAsCancelled(host, record, log) {
  const { defaultBranch } = await host.repositoryInfo();
  const snapshot = await host.readSnapshot(defaultBranch);
  const text = appendToRecord(await snapshot.read(record.path), { part: "end", at: new Date(), state: "cancelled", results: [], draft: null, rounds: [], usage: null,
    cost: { known: false, usage: null }, reason: "cancelled by a person", log });
  await host.commitFiles({ branch: defaultBranch, expectedHead: snapshot.commit, files: [{ path: record.path, text }], message: `Job ${record.id}: end` });
}

/**
 * cancelJob(record, product, bridges) -> Promise<"cancelled" | "cancelling"> — stops the job at its runtime (MOD-runtimes, Interfaces). On CI it asks the run to cancel and reads it once: where it is cancelled it appends
 * the end `cancelled` and gives "cancelled", else "cancelling" with nothing appended. A job in the tab is aborted; a job no runtime has taken, and one the tab does not hold, is ended at once. A job taken on a Bridge is
 * cancelled with cancelOnBridge: where the Bridge confirms, the end `cancelled` is appended and "cancelled" given, else "cancelling" with nothing appended. Fails with NotFound { what } for a CI run the server does not
 * list and for a Bridge missing from `bridges`, with the host's failures, with the Bridge client's (nothing is appended), and with RecordEnded for a record that has its end.
 */
export async function cancelJob(record, product, bridges) {
  switch (takenOn(record)) {
    case "bridge": {
      if (!(await cancelBridgeJob(bridgeNamed(bridges, record.taken.by), record.id))) return "cancelling";
      await endAsCancelled(product.host, record, null);
      return "cancelled";
    }
    case "ci": {
      const { cancelled, address } = await cancelRun(product.host, record.taken.by);
      if (!cancelled) return "cancelling";
      await endAsCancelled(product.host, record, address);
      return "cancelled";
    }
    case "tab": abortOnTab(record.id); // falls through: the end follows the abort
    default:
      await endAsCancelled(product.host, record, null);
      return "cancelled";
  }
}
