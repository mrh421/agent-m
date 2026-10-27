// hand-over.mjs — a conversation's work handed over (docs/architecture/MOD-runtimes.md, Parts: "hand-over.mjs — a conversation's work handed over"). Of it, ITM-495 builds
// handOverJob. A GitLab server's pipeline takes the task as an input only once the GitLab template declares it (ITM-532); retryJob, which refuses a job whose task travelled with
// its hand-over, is not built yet.
//
// Module: MOD-runtimes
//
// It writes through the host only by MOD-job-ledger's startRecord (in ci.mjs and bridge.mjs, the routes' own commits) and appendToRecord, and the task in no file: it travels in the
// inputs of the started workflow or in the hand-over to the Bridge. The findings of a refusal are made as MOD-text-tools' `finding` makes them — a line of at least 1, a rule's name
// in capitals — without importing it, which the module file's Uses do not list.

import { appendToRecord } from "../job-ledger/index.mjs";
import { taskRefusal } from "../job-runner/index.mjs";
import { queueOnBridge } from "./bridge.mjs";
import { RuntimeError, commitStart } from "./ci.mjs";

// The findings that keep a prepared job from being handed over: those of its preconditions and eligibility, one for each participant it does not fit, and one for a kind whose
// gate points hold before-write, since such a job would wait for its task at the gate; and MOD-job-runner's taskRefusal for a kind that takes no instruction,
// since its task would reach no prompt.
function refusalsOf(prepared) {
  const artifact = prepared.kind.name;
  return [
    ...prepared.blocking,
    ...prepared.notFitting.map(({ participant, size, context }) => ({ artifact, line: 1, kind: "error", rule: "NO REQUIREMENT IS LEFT OUT OF THE CONTEXT SILENTLY",
      what: `${participant.name} cannot hold what it would receive: ${size} tokens, its context holds ${context ?? "no declared size"}`,
      fix: "choose a participant whose context is larger" })),
    ...(prepared.kind.gatePoints.includes("before-write") ? [{ artifact, line: 1, kind: "error", rule: "A JOB STOPS AT EVERY GATE",
      what: `the kind ${artifact} has the gate point before-write, so a handed-over job would wait at that gate for its task`,
      fix: "keep this work in the conversation of the tab, where the person decides at the gate" }] : []),
    ...[taskRefusal(prepared.kind)].filter(Boolean),
  ];
}

// The job's record ended as failed, with the refusal as its reason, on the head the default branch has now. A record that cannot be appended to does not hide the refusal
// (as in runOnTab): the caller drops this function's own failure.
async function endAsFailed(host, id, path, refusal) {
  const { defaultBranch } = await host.repositoryInfo();
  const snapshot = await host.readSnapshot(defaultBranch);
  const text = appendToRecord(await snapshot.read(path), { part: "end", at: new Date(), state: "failed", results: [], draft: null, rounds: [], usage: null,
    cost: { known: false, usage: null }, reason: `${refusal.name}: ${refusal.message}`, log: null });
  await host.commitFiles({ branch: defaultBranch, expectedHead: snapshot.commit, files: [{ path, text }], message: `Job ${id}: end` });
}

// The CI secret of an endpoint's key, as the route of the participant `prepared` was prepared for names it — `endpoint <name> secret <NAME>` —, or null for a route that names none.
const secretOf = (prepared) => /^endpoint\s+\S+\s+secret\s+(\S+)$/.exec(String(prepared.drafter?.route ?? "").trim())?.[1] ?? null;

/**
 * handOverJob(prepared, route, start, host, head, task, target) -> Promise<{ path, commit }> — queues the work a conversation of the prompt bar handed over, on the person's click
 * (MOD-runtimes, Interfaces). Refused before anything is written with NotStartable { findings } — the findings of `prepared.blocking`, one for each entry of `prepared.notFitting`,
 * one for a kind with the gate point before-write, and MOD-job-runner's taskRefusal for a kind that takes no instruction —, and with TypeError for a route that is neither CI nor a Bridge, an empty task, and a Bridge route without the Bridge's handle,
 * since the task could not travel. Then commits `start` with `task: "with the hand-over"` as the person's commit on the head that was read, with the message `Queue job <id>: <kind>`;
 * on the CI route it starts the product's job workflow with `startWorkflow` on the default branch and the inputs `job`, `task` and, for a model endpoint, `endpoint`, the JSON text
 * of the endpoint's kind, address and model, and `secret`, the name of the CI secret that its participant's route names (never its value), where it names one; on a Bridge it hands the job over with the task. WorkflowMissing as queueJob raises it, with nothing written. A start the server
 * refuses after the commit ends the job's record as failed, with the refusal's name and message as the reason, and is thrown again unchanged.
 */
export async function handOverJob(prepared, route, start, host, head, task, target) {
  if (route.kind !== "ci" && route.kind !== "bridge") throw new TypeError(`handOverJob hands work over to CI or a Bridge, not to the "${route.kind}" route`);
  if (typeof task !== "string" || !task.trim()) throw new TypeError("handOverJob hands over a task: the task is empty");
  if (route.kind === "bridge" && !target.bridge) throw new TypeError("handOverJob to a Bridge needs the Bridge: the task travels only in the hand-over");
  const findings = refusalsOf(prepared);
  if (findings.length > 0) {
    throw new RuntimeError("NotStartable", { findings }, `the job ${start.id} is not handed over: ${findings.map((each) => each.what).join("; ")}`);
  }

  const queuedStart = { ...start, task: "with the hand-over" };
  let queued;
  try {
    if (route.kind === "bridge") return await queueOnBridge(host, queuedStart, head, target.bridge, task);
    const { path, commit, defaultBranch, workflow } = await commitStart(host, queuedStart, head);
    queued = { path, commit };
    const { kind, baseUrl, model } = target.endpoint ?? {};
    await host.startWorkflow(workflow, defaultBranch, { job: start.id, task, ...(target.endpoint ? { endpoint: JSON.stringify({ kind, baseUrl, model }), ...(secretOf(prepared) ? { secret: secretOf(prepared) } : {}) } : {}) });
    return queued;
  } catch (refusal) {
    // A start the server refused after the commit: the Bridge client's error carries what was queued, a CI start's is what commitStart returned.
    const record = queued ?? refusal.queued;
    if (record) await endAsFailed(host, start.id, record.path, refusal).catch(() => {});
    throw refusal;
  }
}
