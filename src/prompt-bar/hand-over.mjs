// MOD-prompt-bar, hand-over.mjs — a hand-over the participant proposed (docs/architecture/MOD-prompt-bar.md: Interfaces, startPromptBar; UC-049 4a): the route it would take, and
// queuing it as a job of the endpoint or CLI session itself (UC-049 4a.2). assess reads the product's default branch — its head, its paths, its visibility — and none of the product's
// facts: no start rule of the product's process applies to a hand-over, whatever it works on; its job's own preconditions decide when it is prepared — MOD-approvals' rests-on-accepted
// among them, which refuses an item or step whose requirements or use cases are not all accepted. queue prepares the job of the kind the participant named and hands it over with
// MOD-runtimes' handOverJob; the bar calls it once the participant's answer proposes it, the person's Send being the request (UC-049 4a).
//
// Module: MOD-prompt-bar
//
// THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK — the click is the Send whose answer proposed the hand-over. assess writes and queues nothing. The task's
// words reach no record and no commit through this file: they are the `instruction` of the job prepared in memory and the `task` handOverJob carries to the run.
// Readings of the module file this file takes (the pull request names them):
//   - routesFor is given the repository's visibility from the host's repositoryInfo, whether the product holds Agent M's job workflow (one of the two files below, as the review pages
//     look for them), and no resource needs.
//   - The job's identifier is new against the records the snapshot's paths under docs/jobs/ name (MOD-job-ledger's newJobId); no record is read for it.
//   - The job's parameters name what the hand-over works on, whatever the kind, by the keys the kinds' strategies read (MOD-approvals, MOD-spec-changes, MOD-run-planner, MOD-runtimes): `requirements`, `useCases`
//     and, for one use case alone, `useCase` beside it, `items` for backlog items and `steps` for plan steps; the task is no parameter. Nothing else is given: a key that `works_on` does not determine — a
//     source, a resource, a kind, an entry, a part — is left to the strategy that reads it, which refuses the preparation with its own error where it needs the key.

import { approvalStrategies } from "../approvals/index.mjs";
import { editStrategies } from "../artifact-edits/index.mjs";
import { newJobId } from "../job-ledger/index.mjs";
import { issueStrategies } from "../issue-handling/index.mjs";
import { handOverParams, prepareJob } from "../job-runner/index.mjs";
import { resourceStrategies } from "../resource-list/index.mjs";
import { resultStrategies } from "../result-records/index.mjs";
import { reuseStrategies } from "../reuse-facts/index.mjs";
import { runStrategies } from "../run-planner/index.mjs";
import { handOverJob, routeStrategies, routesFor, tabContext } from "../runtimes/index.mjs";
import { sourceStrategies } from "../source-register/index.mjs";
import { specStrategies } from "../spec-changes/index.mjs";
import { scheduleStrategies } from "../test-schedule/index.mjs";
import { workStrategies } from "../work-plans/index.mjs";
import { readParticipants } from "./offer.mjs";
import { connectionsOf, defaultSnapshot, personOf, placesOf } from "./send.mjs";

const WORKFLOWS = [".github/workflows/agent-m-jobs.yml", ".gitlab/agent-m-jobs.yml"];

/**
 * handOverStrategies: Strategies[] — the strategy sets a hand-over is prepared with in the tab (`queue` prepares it with prepareJob), which the bar hands to the frame as a view hands the
 * strategies of its kinds. They are the sets the job workflow registers in CI, since a handed-over job runs on CI or on a Bridge, of the thirteen the module file names the ones that modules
 * build and export today; the others join as the items that build them add them.
 */
export const handOverStrategies = [approvalStrategies, specStrategies, editStrategies, sourceStrategies, reuseStrategies, resourceStrategies, workStrategies, runStrategies,
  scheduleStrategies, resultStrategies, issueStrategies, routeStrategies];

/** recordRoute(route: Route) -> string — the route as a job's record writes it: `ci hosted`, `ci runner:<label>`, `bridge <name>`. */
export const recordRoute = (route) => (route.kind === "tab" ? "tab" : route.kind === "ci" ? (route.runner === "hosted" ? "ci hosted" : `ci runner:${route.runner}`) : `bridge ${route.bridge}`);

/** worksOnOf(handOver: { works_on }) -> string[] — what the hand-over works on, as a list. */
export const worksOnOf = (handOver) => [handOver.works_on].flat().filter(Boolean).map(String);

// A job record's path under docs/jobs/, with the job's identifier.
const JOB_RECORD = /^docs\/jobs\/(JOB-[^/]+)\.md$/;

/**
 * assess({ handOver, participant, instance, page, instanceSnapshot? }) -> Promise<{ route: Route | null, routeText: string, needsWorkflow: boolean, snapshot: Snapshot, head: string,
 * instanceSnapshot, participants }> — the route routesFor gives the hand-over { kind, works_on, task } of `participant`, now, with `routeText` the route as the record writes
 * it, or why none is offered; no start rule of the product's process is asked, and none of its facts is read. `page` is { address, host } of the repository the conversation is held on; `snapshot` is its default branch as it was read, `head` that snapshot's commit.
 * `instanceSnapshot` is the instance's default branch where the caller read it already; else it is read here. Reads through the hosts and writes nothing; throws what the hosts throw.
 */
export async function assess({ handOver, participant, instance, page, instanceSnapshot: given = null }) {
  const instanceSnapshot = given ?? await defaultSnapshot(instance.host);
  const participants = await readParticipants(instanceSnapshot);
  const { defaultBranch, visibility } = await page.host.repositoryInfo();
  const snapshot = await page.host.readSnapshot(defaultBranch);
  const jobWorkflow = WORKFLOWS.some((path) => snapshot.paths.includes(path));
  const offers = routesFor(participant, participants, { visibility, jobWorkflow }, []);
  const taken = offers.find((each) => each.route.kind !== "tab" && each.available) ?? null;
  const refused = offers.find((each) => each.route.kind !== "tab") ?? null;
  const routeText = taken ? recordRoute(taken.route) : refused ? refused.reason
    : offers.length > 0 ? "this participant's route is this tab, which a hand-over does not take" : "this participant has no route a job takes";
  // UC-049 4c: what is missing is the job workflow, when the product has none and the CI route is therefore unavailable.
  const needsWorkflow = taken === null && !jobWorkflow && offers.some((each) => each.route.kind === "ci" && !each.available);
  return { route: taken?.route ?? null, routeText, needsWorkflow, snapshot, head: snapshot.commit, instanceSnapshot, participants };
}

/**
 * queue({ handOver, participant, assessment, store, instance, page, ofProduct, conversation }) -> Promise<{ id: string, path: string, commit: string, person: string }> — prepares the job of
 * the kind the participant named, with the task as its instruction, and hands it over on the route `assessment` found, as the person's commit on the head `assessment` read
 * (MOD-runtimes' handOverJob). `conversation` is the path of the conversation record the job names, or null. `source` is the person's own source for a hand-over of the subject's own kind, else undefined. Throws NoToken when no token that writes to the page's repository is stored,
 * what prepareJob throws, and what handOverJob throws — NotStartable { findings } among it, with nothing written.
 */
export async function queue({ handOver, participant, assessment, store, instance, page, ofProduct, conversation, source }) {
  const { snapshot, route, instanceSnapshot, participants } = assessment;
  const person = personOf(store, snapshot, ofProduct, instanceSnapshot);
  if (person === null) throw Object.assign(new Error("no token that writes to this repository is stored in this browser"), { name: "NoToken" });
  const now = new Date();
  const id = newJobId(now, new Set(snapshot.paths.map((path) => JOB_RECORD.exec(path)?.[1]).filter(Boolean)));
  const commit = instanceSnapshot.commit ?? "unknown";
  const agentM = { version: commit, commit };
  const worksOn = worksOnOf(handOver);
  // For the subject's own kind, `source` is the person's own source that the subject's paramsFor gave: the one parameter beside what the hand-over works on, so that no message and no page text enters the job's record.
  const params = { ...(source === undefined ? {} : { source }), ...handOverParams(worksOn, snapshot) };
  const inputs = { product: { address: page.address, snapshot, host: page.host }, instance: { snapshot: instanceSnapshot, host: instance.host }, participants,
    places: { ...(await placesOf(instanceSnapshot, page.address)), mailbox: null }, gates: [], person, agentM, jobId: id };
  const prepared = await prepareJob(handOver.kind, tabContext({ kind: null, params: { ...params, instruction: handOver.task }, ...inputs }), { drafter: participant, reviewers: [] });
  const start = { id, kind: handOver.kind, worksOn, participant: participant.name, model: participant.model ?? null, route: recordRoute(route), run: null, retries: null, startedBy: person,
    start: now, agentM, inputs: prepared.parts.map((part) => part.name), limit: prepared.limit, task: "with the hand-over", conversation: conversation ?? null,
    destinations: prepared.destinations.map((each) => ({ participant: each.participant.name, place: each.place ?? "", parts: each.parts })), params,
    // A job that is an endpoint's own, which the instance does not list: its record declares the endpoint's context and capabilities (MOD-job-ledger's `declares`).
    ...(participants.some((each) => each.name === participant.name) ? {} : { declares: { context: participant.context ?? null, capabilities: participant.capabilities ?? [] } }) };
  const { endpoints, bridges } = connectionsOf(participant, store);
  const endpoint = endpoints[/^endpoint\s+(\S+)/.exec(participant.route ?? "")?.[1]]?.config ?? null;
  const target = { endpoint: route.kind === "ci" && endpoint ? { kind: endpoint.kind, baseUrl: endpoint.baseUrl, model: endpoint.model } : null,
    bridge: route.kind === "bridge" ? bridges[route.bridge] ?? null : null };
  const queued = await handOverJob(prepared, route, start, page.host, assessment.head, handOver.task, target);
  return { id, ...queued, person };
}

/**
 * spawnEndpointJob({ kind, task, participant, store, instance, page, ofProduct, conversation, source, instanceSnapshot? }) -> Promise<{ id, path, commit, person } | { refused: string,
 * needsWorkflow: boolean }> — the job that is a model endpoint's own (UC-049 4a.1, "for any other kind, the job is the endpoint's own"), spawned on GitHub Actions on a person's click: the job of
 * `kind`, working on the page's repository, by the web address of the snapshot that was read, with `task` travelling in the workflow's inputs, assessed and queued as a proposed hand-over is (assess,
 * queue), on the server's own runners. None of the product's facts is read: of the product, only its default branch — its head, its paths, its visibility. `instanceSnapshot` is the instance's default branch where the caller read it already. `participant` is the endpoint as the bar offers it (offer.mjs endpointsOffered), its route naming the CI secret of its key. Where
 * no CI route can be taken — the product has no job workflow, or the endpoint names no CI secret — nothing is written and `refused` says why, `needsWorkflow` whether the
 * job workflow is what is missing (UC-049 4c). Throws what queue throws.
 */
export async function spawnEndpointJob({ kind, task, participant, store, instance, page, ofProduct, conversation = null, source, instanceSnapshot = null }) {
  const assessment = await assess({ handOver: { kind, works_on: [], task }, participant, instance, page, instanceSnapshot });
  if (assessment.route === null || assessment.route.kind !== "ci") {
    return { refused: assessment.route === null ? assessment.routeText : "the endpoint's route is not GitHub Actions", needsWorkflow: assessment.needsWorkflow };
  }
  // It works on the repository the page is held on, by its web address as the snapshot that was read names it.
  const handOver = { kind, works_on: [assessment.snapshot.repository.web], task };
  return queue({ handOver, participant, assessment, store, instance, page, ofProduct, conversation, source });
}
