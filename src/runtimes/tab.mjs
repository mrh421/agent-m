// tab.mjs — jobs running in this tab (docs/architecture/MOD-runtimes.md, Parts: "tab.mjs — jobs running in this tab"). Of it, ITM-319 builds queueOnTab,
// the tab route of queueJob, and runOnTab; ITM-790 the result kept for a job that waits at a gate and the end appended when it goes on (requireWaitingOnTab, endOnTab). The Bridge's drivers (bridgeDriver, ITM-325, bridge.mjs) are built for an agent on a Bridge and for an endpoint a Bridge calls.
//
// Module: MOD-runtimes
//
// It writes the job's record through the host only by MOD-job-ledger's startRecord and appendToRecord. A part is appended on the head read just before, as the
// person's commit. The results of an end read: a line `commit <sha>`, `file <path>` and `pull request <address>` for what the writer did, a line `note: <note>` for
// each note it made (MOD-job-runner's WriteOutcome), `no change` where it committed nothing (UC-010 4a), and `waits for a person` where nothing was written, or a
// kind handed its draft back (MOD-job-ledger, Data). A gate's `decider` is the context's gate's own where it carries one, else the gate's name.

import { endpointDriver } from "../endpoint-calls/index.mjs";
import { instanceOfPagesAddress } from "../identifiers/index.mjs";
import { openStore, readSetting, writeSetting } from "../browser-store/index.mjs";
import { appendToRecord, jobCost, startRecord } from "../job-ledger/index.mjs";
import { failedBecause, runJob } from "../job-runner/index.mjs";
import { bridgeDriver } from "./bridge.mjs";
import { RuntimeError } from "./ci.mjs";

// ---------------------------------------------------------------- which browser took a job (MOD-runtimes, Data: "This browser")
//
// This browser is the identifier MOD-browser-store keeps under `browser` in the store of the instance whose Pages address the tab shows. Only queueJob makes it; liveState only reads. Where the tab's address names no
// instance, or the browser refuses localStorage, queueJob makes an identifier of the same form for this tab alone, kept in memory, so that no other browser reads the job as its own.
const newIdentifier = () => [...crypto.getRandomValues(new Uint8Array(8))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
let tabOwn = null;

function browserStore() {
  const location = globalThis.location;
  const instance = location ? instanceOfPagesAddress({ hostname: location.hostname, pathname: location.pathname }) : null;
  if (instance === null) return null;
  try { return openStore(instance); } catch (error) { if (error?.name === "StorageUnavailable") return null; throw error; }
}

// This browser's identifier as the store holds it, or null; with `make`, made and stored where it is not set.
function thisBrowser(make) {
  const store = browserStore();
  if (store === null) return null;
  try {
    const kept = readSetting(store, "browser");
    if (typeof kept === "string" && kept !== "") return kept;
    if (!make) return null;
    const made = newIdentifier();
    writeSetting(store, "browser", made);
    return made;
  } catch (error) {
    if (error?.name === "StorageUnavailable") return null;
    throw error;
  }
}

/**
 * tookOnTab(by) -> "this" | "other" — whether the `by:` of a tab job's `## Taken` (`tab`, or `tab <browser>`) names this browser: the bare `tab`, this browser's identifier and this tab's own are this browser's; every
 * other browser is another.
 */
export function tookOnTab(by) {
  const named = String(by).replace(/^tab\s*/, "").trim();
  if (named === "") return "this";
  return [thisBrowser(false), tabOwn].includes(named) ? "this" : "other";
}

/**
 * queueOnTab(host, start, head) -> Promise<{ path, commit }> — MOD-runtimes' queueJob for the tab's route: the job's start record and its taking (`## Taken`, by
 * `tab <browser>`, at the job's start) in one commit, on the head that was read, as the person's commit, on the branch the host's repositoryInfo names. Fails as the host
 * fails — Moved, TokenRefused, RateLimited, Unreachable — unchanged; nothing is written then.
 */
export async function queueOnTab(host, start, head) {
  const { defaultBranch } = await host.repositoryInfo();
  const { path, text } = startRecord(start);
  const { commit } = await host.commitFiles({
    branch: defaultBranch, expectedHead: head, files: [{ path, text: appendToRecord(text, { part: "taken", at: start.start, by: `tab ${thisBrowser(true) ?? (tabOwn ??= newIdentifier())}` }) }],
    message: `Queue job ${start.id}: ${start.kind}`,
  });
  return { path, commit };
}

// The driver of a participant, from its route: an endpoint it names, from its configuration — `endpointDriver` where the endpoint is called from this tab, `bridgeDriver` with the endpoint
// on the Bridge its `bridge` names —, or an agent on the Bridge its route names. Each Bridge is found by its name among `connections.bridges`.
function driverOf(participant, connections) {
  const bridgeOf = (name) => {
    const bridge = connections.bridges?.[name];
    if (!bridge) throw new RuntimeError("BridgeNotConnected", { bridge: name }, `the Bridge ${name} is not among the connected Bridges`);
    return bridge;
  };
  const agent = /^bridge\s+(\S+)\s+agent\s+(\S+)/.exec(participant.route ?? "");
  if (agent) return bridgeDriver(bridgeOf(agent[1]), { agent: agent[2] }, participant);
  const endpoint = /^endpoint\s+(\S+)/.exec(participant.route ?? "")?.[1];
  const entry = endpoint === undefined ? undefined : connections.endpoints[endpoint];
  if (!entry) throw new RuntimeError("EndpointNotConfigured", { endpoint }, `the endpoint ${endpoint} has no configuration`);
  if (entry.bridge !== null) return bridgeDriver(bridgeOf(entry.bridge), { endpoint: entry.config }, participant);
  return endpointDriver(entry.config, participant);
}

// The usage of a job: the tokens and the cost its exchanges reported, summed; null while none reported any. The cost counts only where every exchange that reported usage also reported a cost, all in one currency: otherwise it is null, since a sum of some exchanges' costs is not the job's cost.
function usageOf(exchanges) {
  const known = exchanges.map((each) => each.usage).filter(Boolean);
  if (known.length === 0) return null;
  const sum = (key) => (known.some((usage) => usage[key] !== null) ? known.reduce((total, usage) => total + (usage[key] ?? 0), 0) : null);
  const costs = known.map((usage) => usage.cost);
  const cost = costs.every(Boolean) && costs.every((each) => each.currency === costs[0].currency)
    ? { amount: costs.reduce((total, each) => total + each.amount, 0), currency: costs[0].currency } : null;
  return { inputTokens: sum("inputTokens"), outputTokens: sum("outputTokens"), minutes: null, cost };
}

// What an end says of the writer's outcome.
function resultsOf(written) {
  if (!written || (written.commits.length === 0 && written.shown !== null && written.shown !== undefined)) return ["waits for a person"];
  const notes = (written.notes ?? []).map((note) => `note: ${note}`);
  if (written.commits.length === 0 && !written.pullRequest) return ["no change", ...notes];
  return [...written.commits.map((commit) => `commit ${commit}`), ...written.files.map((file) => `file ${file}`),
    ...(written.pullRequest ? [`pull request ${written.pullRequest}`] : []), ...notes];
}

/**
 * tabContext(inputs) -> JobContext — the context of a job that runs in this tab, from what its caller has read; it makes no request. Its caller has connected the hosts
 * already, as the review pages do: `connect(address)` gives the product's host for the product's address and the instance's host for the instance's address
 * (`instance.snapshot.repository.web`), and `null` for any other address. `now` is the moment of the call and `instance.checkout` is `null`.
 */
export function tabContext({ kind, params, product, instance, participants, places, gates, person, agentM, jobId }) {
  const hosts = new Map([[instance.snapshot.repository.web, instance.host], [product.address, product.host]]);
  return { kind, params, product, instance: { ...instance, checkout: null }, connect: async (address) => hosts.get(address) ?? null,
    participants, places, gates, person, now: new Date(), agentM, jobId };
}

// The jobs this tab runs with a record, by the record's id, each with the controller that aborts it: held from the start of its runOnTab until that call settles (MOD-runtimes, Data: it keeps, in memory, the
// jobs running in this tab). cancelJob aborts one through abortOnTab; liveState asks heldOnTab.
const held = new Map();
// The result of each job of this tab that waits at a gate, by the record's id, with its drafter (for the cost of its end): kept when runOnTab stops at a gate, taken when the job goes on (MOD-runtimes, Data).
const waiting = new Map();
export const heldOnTab = (id) => held.has(id);
export function abortOnTab(id) {
  held.get(id)?.abort();
}

/**
 * runOnTab(prepared, context, connections, hooks) -> Promise<JobResult> — runs the prepared job in this tab with MOD-job-runner, attended unless its record names a
 * run: the drafter's and the reviewers' drivers from their routes (an endpoint's driver from its configuration, `endpointDriver`), a gate reached and the end
 * appended to the job's record through the host, and the result returned for the page. A job that waits at a gate has no end. A failure — a driver's, by its name —
 * ends the record as failed, with the failure's name and message as the reason, and is thrown again unchanged; a cancelled job is ended by cancelJob, not here.
 */
export async function runOnTab(prepared, context, connections, hooks) {
  const { host, record, refine, from, onOutput } = hooks;
  // The job's own abort: the caller's signal aborts it, and so does cancelJob. After it fires, nothing more is appended to the record (A CANCELLED JOB WRITES NOTHING MORE): the end is cancelJob's.
  const controller = new AbortController();
  const signal = controller.signal;
  if (hooks.signal?.aborted) controller.abort();
  else hooks.signal?.addEventListener("abort", () => controller.abort(), { once: true });
  if (record) held.set(record.id, controller);
  try {
    return await runHeld(prepared, context, connections, { host, record, refine, from, onOutput, signal });
  } finally {
    if (record && held.get(record.id) === controller) held.delete(record.id);
  }
}

async function runHeld(prepared, context, connections, { host, record, refine, from, onOutput, signal }) {
  const append = async (part) => {
    if (!record || signal.aborted) return; // a conversation of the prompt bar has no record: nothing is appended anywhere; a cancelled job appends nothing more
    const { defaultBranch } = await host.repositoryInfo();
    const snapshot = await host.readSnapshot(defaultBranch);
    const text = appendToRecord(await snapshot.read(record.path), part);
    await host.commitFiles({ branch: defaultBranch, expectedHead: snapshot.commit, files: [{ path: record.path, text }],
      message: `Job ${record.id}: ${part.part}` });
  };
  const onGate = async (name) => {
    const gate = context.gates.find((each) => each.name === name);
    await append({ part: "gate reached", at: new Date(), gate: name, decider: gate?.decider ?? name });
  };
  let result;
  try {
    const drivers = { drafter: prepared.drafter ? driverOf(prepared.drafter, connections) : null,
      reviewers: prepared.reviewers.map((reviewer) => driverOf(reviewer, connections)) };
    result = await runJob(prepared, drivers, { attended: !record?.run, context, refine, from, onOutput, onGate, signal });
  } catch (error) {
    if (error.name === "Cancelled") throw error;
    // The job's own failure is what the caller must see: a record that cannot be appended to does not hide it.
    await append(ended({ state: "failed", reason: `${error.name}: ${error.message}`, cost: jobCost(null, prepared.drafter) })).catch(() => {});
    throw error;
  }
  if (result.stoppedBecause === "gate") {
    if (record) waiting.set(record.id, { result, drafter: prepared.drafter });
    return result;
  }
  await append(ended(endFields(result, prepared.drafter)));
  return result;
}

const ended = (fields) => ({ part: "end", at: new Date(), draft: null, rounds: [], usage: null, reason: null, log: null, results: [], ...fields });

// The end of a job of this tab from its result. For a job that stopped at a gate `stoppedBecause` is "gate": the loop's own reason is not kept, so the record derives it from the last round.
function endFields(result, drafter) {
  const usage = usageOf(result.usage);
  const failed = failedBecause(result);
  return {
    state: failed ? "failed" : "done", reason: failed, results: failed ? [] : resultsOf(result.written),
    draft: result.written?.shown ?? null, rounds: result.rounds, forPerson: result.forPerson, stoppedBecause: result.stoppedBecause === "gate" ? undefined : result.stoppedBecause, usage,
    cost: jobCost(usage, drafter),
  };
}

/**
 * requireWaitingOnTab(id) — throws RuntimeError NotHeld { job } where this tab keeps no result for the job that waits at a gate: it was not run here, or the tab was closed (UC-036: its record shows it as ended without record).
 */
export function requireWaitingOnTab(id) {
  if (!waiting.has(id)) throw new RuntimeError("NotHeld", { job: id }, `this tab keeps no result of the job ${id}: it was not run here, or the tab was closed`);
}

/**
 * endOnTab(record, host) -> Promise<void> — the job goes on from the result the tab kept for it: its end is appended on the head the branch has, as a job of the tab ends. The result is taken once the end is committed;
 * a commit the host refuses leaves it kept.
 */
export async function endOnTab(record, host) {
  requireWaitingOnTab(record.id);
  const { result, drafter } = waiting.get(record.id);
  const { defaultBranch } = await host.repositoryInfo();
  const snapshot = await host.readSnapshot(defaultBranch);
  const text = appendToRecord(await snapshot.read(record.path), ended(endFields(result, drafter)));
  await host.commitFiles({ branch: defaultBranch, expectedHead: snapshot.commit, files: [{ path: record.path, text }], message: `Job ${record.id}: end` });
  waiting.delete(record.id);
}
