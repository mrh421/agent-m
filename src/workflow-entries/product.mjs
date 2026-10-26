// product.mjs — the entries of a product's job workflow (MOD-workflow-entries, Parts): ITM-365 builds onRecordsChanged and onDispatch, which take
// and run the queued jobs of this CI route; ITM-498 adds to onDispatch the job whose task travels with a conversation's hand-over (UC-049 4a), which onRecordsChanged
// leaves queued. ITM-791 adds to onRecordsChanged the resumption of the jobs of this route whose gate is recorded (A JOB STOPS AT EVERY GATE). The runs' next actions and onPullRequestClosed
// are other items'. ITM-1032 builds onSchedule: the close of a sprint an agent closes. ITM-1209 adds onTestsFinished, ITM-1210 onDoneCheck and ITM-1215 runTests, which MOD-test-schedule's test configuration runs.
//
// Module: MOD-workflow-entries
//
// A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET; A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET; A CI AGENT'S DRAFT ENTERS AS
// OPEN; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; NO SECRET IN THE REPOSITORY. No person attends a job in CI: the job runner calls the kind's
// writer at once. The entry keeps nothing between runs.

import { appendToRecord, jobCost, jobState, newJobId, recordsNewestFirst, startRecord, takeJob } from "../job-ledger/index.mjs";
import { kindOf } from "../job-catalogue/index.mjs";
import { handOverParams, prepareJob, provenanceLines, runJob } from "../job-runner/index.mjs";
import { endpointDriver, testEndpoint } from "../endpoint-calls/index.mjs";
import { agentDriver, installedAgents } from "../agent-processes/index.mjs";
import { participantSchema, participantsOf } from "../participant-list/index.mjs";
import { readDocument } from "../documents/index.mjs";
import { productFacts } from "../progress-measures/index.mjs";
import { doneCheck, recordGateDecision } from "../product-process/index.mjs";
import { queueJob } from "../runtimes/index.mjs";
import { sprintsToClose } from "../work-plans/index.mjs";
import { appendResult, parseOutcomes, resultSchema } from "../result-records/index.mjs";
import { isTestFile, testDeclarations } from "../test-document/index.mjs";
import { testsOfRow } from "../test-schedule/index.mjs";
import { composeProduct, composeTestJob, composeTestRun } from "./compose.mjs";
import { packResult, readResult, checkResult, writeBranches, pendingPullRequest } from "./result.mjs";

const fs = globalThis.process?.getBuiltinModule?.("node:fs");

// The route of this CI service's jobs, as MOD-job-ledger writes a record's route, and the form of a CI agent's route in the register.
const routeOf = (runner) => (runner === "hosted" ? "ci hosted" : `ci runner:${runner}`);
const CI_ROUTE = /^ci (?:hosted|runner:\S+) secret (\S+)$/;
// The secret a participant's route names, of any route that names one (`endpoint <name> secret <NAME>`, `ci hosted secret <NAME>`), and the words of a record whose task a hand-over brings.
const SECRET_OF = / secret (\S+)$/;
const WITH_HAND_OVER = "with the hand-over";
const NO_TASK = "the task travels with its hand-over, and this run was started without it";
// A run a page or a hand-over started: GitHub's workflow_dispatch; on GitLab a pipeline whose source is `web` or `api`, as the job workflow's rules start onDispatch.
const dispatched = (env) => (env.service === "gitlab" ? ["web", "api"].includes(env.event?.name) : env.event?.name === "workflow_dispatch");
const failedStatus = (summary) => ({ outcome: "failed", summary, findings: [] });
const notRun = (summary) => ({ outcome: "not run", summary, findings: [] });

// The sum of the usage the participants reported, or null where none reported any.
function usageOf(usages) {
  const reported = usages.map((each) => each.usage).filter(Boolean);
  if (reported.length === 0) return null;
  const sum = (field) => (reported.every((each) => each[field] == null) ? null : reported.reduce((total, each) => total + (each[field] ?? 0), 0));
  return { inputTokens: sum("inputTokens"), outputTokens: sum("outputTokens"), minutes: sum("minutes"), cost: reported.find((each) => each.cost)?.cost ?? null };
}

// The driver of a participant for a job: a model endpoint from the endpoint the job's record names, its key the participant's secret; or a coding
// agent the record names, its key variable that secret's name.
async function driverOf(participant, params, secretName, key, workdir) {
  if (params.endpoint) return endpointDriver({ ...params.endpoint, key }, participant);
  if (typeof params.agent === "string") {
    const agent = (await installedAgents()).find((each) => each.name === params.agent);
    if (!agent?.installed) throw Object.assign(new Error(`The agent ${params.agent} is not installed on this runner.`), { name: "AgentMissing" });
    return agentDriver(agent, { workdir, keyVariable: secretName }, participant);
  }
  throw Object.assign(new Error("The job's record names no endpoint and no agent for its participant."), { name: "NoDriver" });
}

// Ends a taken job in its record, on the current head: the End part appended to the record as it stands there, committed through the product's
// host, with the provenance lines of the job.
async function endRecord(host, path, part, trailers) {
  for (let attempt = 1; ; attempt++) {
    const head = await host.readSnapshot("HEAD");
    const id = /([^/]+)\.md$/.exec(path)?.[1] ?? path;
    try {
      await host.commitFiles({ branch: part.branch, expectedHead: head.commit, files: [{ path, text: appendToRecord(await head.read(path), part.part) }],
        message: `end ${id}: ${part.part.state}${trailers.length ? `\n\n${trailers.join("\n")}` : ""}` });
      return;
    } catch (error) {
      if (error?.name !== "Moved" || attempt >= 5) throw error;
    }
  }
}

// How a job's end is written: on the agent's machine kept for the writing machine, which writes it once the result is written (result.mjs); elsewhere at once.
const endOf = (composed) => (composed.result ? (path, part, trailers) => composed.result.end(path, part, trailers) : (path, part, trailers) => endRecord(composed.product.host, path, part, trailers));

// The driver of a model endpoint a hand-over names: opencode working with that endpoint, its key the variable the participant's secret names (MOD-agent-processes).
async function opencodeDriver(participant, endpoint, secretName, workdir) {
  const agent = (await installedAgents()).find((each) => each.name === "opencode");
  if (!agent?.installed) throw Object.assign(new Error("opencode is not installed on this runner."), { name: "AgentMissing" });
  return agentDriver(agent, { workdir, keyVariable: secretName ?? null, endpoint }, participant);
}

// The endpoint a hand-over's input names: { kind, baseUrl, model } read from its JSON text.
function endpointOf(text) {
  let read = null;
  try { read = JSON.parse(text); } catch { /* refused below */ }
  if (!read || typeof read.kind !== "string" || typeof read.baseUrl !== "string" || typeof read.model !== "string") {
    throw Object.assign(new Error("the input endpoint is not the JSON text of { kind, baseUrl, model }."), { name: "BadEndpoint" });
  }
  return { kind: read.kind, baseUrl: read.baseUrl, model: read.model };
}

// A kind that only reads and drafts text — its needs hold draft text and nothing but draft text and read the repository — runs through Agent M's own job runner
// calling the endpoint (MOD-endpoint-calls' endpointDriver); any other through opencode (MOD-workflow-entries, onDispatch).
const READS_AND_DRAFTS = new Set(["draft text", "read the repository"]);
const readsAndDrafts = (kind) => kind.needs.includes("draft text") && kind.needs.every((need) => READS_AND_DRAFTS.has(need));

// What a writer's outcome lists in the job's end: its commits, files and pull request, and its notes.
const resultsOf = (outcome) => (outcome ? [...outcome.commits, ...outcome.files, ...(outcome.pullRequest ? [outcome.pullRequest] : []), ...outcome.notes.map((note) => `note: ${note}`)] : []);

// An item of the backlog or a step of the plan, by its identifier.
const PLANNED = /^ITM-\d+$/;

// The hand-over a job's draft holds (UC-049 4f), run in the same run with the same participant and driver where its kind's result waits for a person and it works on no item
// of the backlog or step of the plan: its parameters the job's source, those handOverParams gives for what it works on, and its task as instruction; run unattended, so that its
// writer writes at once. -> the lines the job's end lists: what its writer wrote, or `not run: <kind> — <why>`.
async function handedOver(handOver, context, participant, driver, record) {
  const worksOn = [handOver.works_on].flat().filter(Boolean).map(String);
  // One line each, as the record's `results` holds them: a failure's own text may span several, as git's does.
  const notRun = (why) => [`not run: ${handOver.kind} — ${String(why).replace(/\s*\n\s*/g, " ")}`];
  let kind;
  try {
    kind = await kindOf(handOver.kind);
  } catch (error) {
    return notRun(error?.message ?? String(error));
  }
  if (kind.name === context.kind.name) return notRun("it is this conversation itself, which a hand-over does not start again");
  if (kind.review !== "person") return notRun("its result does not wait for a person, so it is started from the dashboard, by its start rules, for a holder of its role");
  const planned = worksOn.filter((name) => PLANNED.test(name));
  if (planned.length > 0) return notRun(`it works on ${planned.join(", ")} of the plan, whose start rules are checked where a person starts it`);
  const params = { ...(typeof record.params?.source === "string" ? { source: record.params.source } : {}), ...handOverParams(worksOn, context.product.snapshot),
    instruction: String(handOver.task ?? "") };
  const nested = { ...context, kind, params };
  try {
    const prepared = await prepareJob(kind.name, nested, { drafter: participant, reviewers: [], limit: record.limit });
    if (prepared.blocking.length > 0 || prepared.notFitting.length > 0) {
      return notRun(prepared.blocking.map((found) => `${found.what} [${found.rule}]`).join("; ") || "the job does not fit its participant");
    }
    const result = await runJob(prepared, { drafter: driver, reviewers: [] }, { attended: false, context: nested });
    const lines = resultsOf(result.written);
    return lines.length > 0 ? lines : [`${handOver.kind}: no change`];
  } catch (error) {
    return notRun(error?.message ?? String(error));
  }
}

// The task, trimmed, must not appear in a run's PR text or new branch commit messages. Without a PR, compare the reported branch at one
// pinned commit against the job's pre-run snapshot by complete commit identities, including merge-side history. -> { branch, where } or null.
async function refusedBranch(host, written, task, baseCommit) {
  const number = /\/(?:pull|merge_requests)\/(\d+)\b/.exec(written?.pullRequest ?? "")?.[1];
  const holds = (value) => typeof value === "string" && value.includes(task.trim());
  if (number) {
    const facts = await host.pullRequestFacts(Number(number));
    const where = facts.commits.some((commit) => holds(commit.message)) ? "a commit message" : Object.values(facts.pullRequest).some(holds) ? "the pull request's text" : null;
    return where ? { branch: facts.pullRequest.branch, where } : null;
  }
  const branch = written?.shown?.branch;
  if (typeof branch !== "string" || !branch) return null;
  const pinned = await host.readSnapshot(branch);
  const history = await host.readHistory(null, { ref: pinned.commit, changes: false });
  const before = new Set((await host.readHistory(null, { ref: baseCommit, changes: false })).map((entry) => entry.commit));
  return history.some((entry) => !before.has(entry.commit) && holds(entry.message)) ? { branch, where: "a commit message" } : null;
}

// The participant's answer: the draft's `answer` where it is a text, else the draft as it stands, as JSON.
function answerOf(draft) {
  if (typeof draft === "string") return draft;
  if (typeof draft?.answer === "string") return draft.answer;
  return draft == null ? "" : JSON.stringify(draft, null, 2);
}

// A hand-over's answer, left in the run's summary — the file GITHUB_STEP_SUMMARY names where it is set — and in the log, between the lines
// `--- answer of <id> ---` and `--- end of the answer of <id> ---`, by which the prompt bar finds it in the run's log (MOD-prompt-bar). It goes to no record.
function leaveAnswer(env, id, answer) {
  if (!answer) return;
  console.log(`--- answer of ${id} ---\n${answer}\n--- end of the answer of ${id} ---`);
  if (env.job.summaryFile) fs.appendFileSync(env.job.summaryFile, `## ${id}\n\n${answer}\n`);
}

// One job: taken, prepared, run, ended in its record. -> { id, state, summary }. `handOver` is { task, endpoint } for a job whose task travels with its hand-over: the
// task is the job's instruction in memory only, the record keeps none, and what is written about the run hides the task and every secret.
async function runJobOf(env, composed, participants, row, handOver = null) {
  const { record, path } = row;
  const { job } = env;
  const product = composed.product, instance = composed.instance;
  const participant = participants.find((each) => each.name === record.participant);
  const taking = await takeJob(product.host, path, job.runUrl ?? `ci ${job.runner}`, (await product.host.readSnapshot("HEAD")).commit);
  if (!taking.taken) return { id: record.id, state: "skipped", summary: `${record.id} was taken by ${taking.by}` };
  // A hand-over with an endpoint reads its key from the secret the input `secret` names, and no other; every other job from the secret its participant's route names.
  const secretName = handOver?.endpoint ? (handOver.secret ?? undefined) : (handOver ? SECRET_OF : CI_ROUTE).exec(participant.route ?? "")?.[1];
  const hidden = (value) => {
    let said = String(value);
    if (handOver) said = said.split(handOver.task.trim()).join("[the task]");
    for (const secret of [env.job.personToken, ...Object.values(env.job.keys)].filter(Boolean)) said = said.split(secret).join("[secret]");
    return said;
  };
  const context = { kind: null, params: handOver ? { ...(record.params ?? {}), instruction: handOver.task } : record.params ?? {}, product: { address: product.address, snapshot: await product.host.readSnapshot("HEAD"), host: product.host },
    instance: { snapshot: await instance.host.readSnapshot("HEAD"), host: instance.host, checkout: instance.checkout },
    connect: async (address) => product.host, participants, places: { sources: {}, mailbox: null }, gates: [], person: record.startedBy ?? null, now: env.now,
    agentM: record.agentM, jobId: record.id };
  let ended = { state: "failed", results: [], draft: null, rounds: [], usage: null, reason: null }, outcome = null, endpoint = null;
  try {
    context.kind = await kindOf(record.kind);
    endpoint = handOver?.endpoint ? endpointOf(handOver.endpoint) : null;
    // A model endpoint driven by Agent M's own tool loop works in no checkout: its input begins with AGENTS.md as text, not as a path in the
    // instance's checkout, which only a coding agent can read (EVERY MODEL READS AGENT M'S AGENTS.MD FIRST).
    const ownLoop = endpoint ? readsAndDrafts(context.kind) : Boolean((record.params ?? {}).endpoint);
    if (ownLoop) context.instance = { ...context.instance, checkout: undefined };
    const prepared = await prepareJob(record.kind, context, { drafter: participant, reviewers: [], limit: record.limit });
    if (prepared.blocking.length > 0 || prepared.notFitting.length > 0) {
      throw Object.assign(new Error(prepared.blocking.map((found) => found.what).join("; ") || "the job does not fit its participant"), { name: "NotStartable" });
    }
    const driver = !endpoint ? await driverOf(participant, record.params ?? {}, secretName, job.keys[secretName], instance.checkout)
      : readsAndDrafts(context.kind) ? endpointDriver({ name: "hand-over", ...endpoint, key: job.keys[secretName] ?? null }, participant)
        : await opencodeDriver(participant, endpoint, secretName, job.productDir ?? instance.checkout);
    const result = await runJob(prepared, { drafter: driver, reviewers: [] }, { attended: false, context });
    outcome = result.written;
    // What the participant handed on is run in the same run, and its results join the job's (UC-049 4f).
    const passed = result.draft?.handOver ? await handedOver(result.draft.handOver, context, participant, driver, record) : [];
    // On the agent's machine the branch is not on the server yet: the writing machine refuses a result whose commits or pull request hold the task (result.mjs).
    if (handOver && !composed.result) {
      const refused = await refusedBranch(product.host, outcome, handOver.task, context.product.snapshot.commit);
      if (refused) throw Object.assign(new Error(`the branch ${refused.branch} is refused: ${refused.where} holds the task of the hand-over.`), { name: "TaskInBranch" });
    }
    if (handOver) leaveAnswer(env, record.id, answerOf(outcome?.shown ?? result.draft));
    const handedBack = context.kind.writer === "return-draft";
    const made = outcome ? [...outcome.commits, ...(handOver || outcome.pullRequest ? [...outcome.files, ...(outcome.pullRequest ? [outcome.pullRequest] : [])] : [])] : [];
    // A result is one item of the end's list, in which a comma separates items: a comma of a note or a reason becomes a semicolon.
    const listed = [...made, ...[...(outcome?.notes ?? []).map((note) => `note: ${note}`), ...passed].map((line) => line.replaceAll(",", ";"))];
    ended = { state: "done", results: listed.length > 0 ? listed : handedBack ? [] : ["no change"],
      draft: handOver ? null : handedBack ? (outcome?.shown ?? result.draft) : null, rounds: result.rounds, usage: usageOf(result.usage), reason: null,
      stoppedBecause: result.stoppedBecause, drafter: result.drafter };
  } catch (error) {
    let reason = error?.message ?? String(error);
    if (endpoint && error?.name === "AgentFailed") {
      const said = String(error.lastOutput ?? "").trim().split("\n").filter(Boolean).at(-1) ?? error.message;
      // One short request to the endpoint, with the key the agent was given: where it fails, its diagnosis is the reason; where it works, the run reached it and the failure is the agent's.
      const probe = await testEndpoint({ name: "hand-over", ...endpoint, key: job.keys[secretName] ?? null });
      reason = probe.works ? `the agent failed (exit code ${error.exitCode}) working with the endpoint ${endpoint.baseUrl} (${endpoint.model}): ${said}`
        : `the run failed against the endpoint ${endpoint.baseUrl} (${endpoint.model}): ${probe.diagnosis.reason} — ${probe.diagnosis.message}. The routes that would work: a self-hosted runner, or a Bridge.`;
    } else if (endpoint && error?.name === "EndpointFailed" && error.diagnosis) {
      // The job runner called the endpoint itself (a kind that only reads and drafts): its own diagnosis is the reason (UC-049 4d).
      reason = `the run failed against the endpoint ${endpoint.baseUrl} (${endpoint.model}): ${error.diagnosis.reason} — ${error.diagnosis.message}. The routes that would work: a self-hosted runner, or a Bridge.`;
    }
    ended = { ...ended, reason: handOver ? hidden(reason) : reason };
  }
  const part = { part: { part: "end", at: env.now, state: ended.state, results: ended.results, draft: ended.draft, rounds: ended.rounds, usage: ended.usage,
    cost: jobCost(ended.usage, participant), reason: ended.reason, log: job.runUrl ?? null, ...(ended.stoppedBecause ? { stoppedBecause: ended.stoppedBecause } : {}) }, branch: env.branch };
  const trailers = provenanceLines({ agentM: record.agentM, jobId: record.id, kind: record.kind, participant, rounds: ended.rounds.length, instruction: record.params?.instruction ?? null });
  await endOf(composed)(path, part, trailers);
  const noChange = ended.state === "done" && ended.results.length === 1 && ended.results[0] === "no change";
  return { id: record.id, state: ended.state, summary: ended.state === "failed" ? `${record.id} failed: ${ended.reason}` : `${record.id} ${noChange ? "ended done, no change" : "ended done"}` };
}

// The queued jobs of this route in the product's checkout, oldest first, each with its path. A job whose task travels with its hand-over is one only `onDispatch` takes.
async function queuedOf(env, snapshot, { handedOver = false } = {}) {
  const wanted = routeOf(env.job.runner);
  const rows = [];
  for await (const record of recordsNewestFirst(snapshot)) {
    if (record.route === wanted && jobState(record, null) === "queued" && (handedOver || record.task !== WITH_HAND_OVER)) rows.push({ record, path: record.path });
  }
  return rows.reverse();
}

// The key secret a queued job's participant reads, as its route names it — `ci <runner> secret <NAME>` —, or null.
const keyOfRow = (participants, { record }) => CI_ROUTE.exec(participants.find((each) => each.name === record.participant)?.route ?? "")?.[1] ?? null;

// The jobs this machine runs: on the agent's machine, those whose key is the one it was given, or none the job workflow reads; a job whose key is another of
// those the file reads is left queued for the run its own key's machine makes. Elsewhere every job.
function ofThisMachine(env, participants, rows) {
  if (env.job.part !== "agent") return rows;
  return rows.filter((row) => {
    const key = keyOfRow(participants, row);
    return key === null || key === env.job.agentKey || !Object.hasOwn(env.job.keys, key);
  });
}

// The product's facts of the scope `work`, read once: the workflow, the jobs and the states of the gates (gateStates).
async function workFacts(env, composed) {
  const { instance, product } = composed;
  // The facts are read through the clone alone: the gates and jobs need no pull request, and the server's answer is not asked for (productFacts takes a refusal as `unknown`).
  const clone = { ...product.host, listPullRequests: async () => { throw Object.assign(new Error("pull requests are not read here"), { name: "NotSupported" }); } };
  return productFacts(clone, await instance.host.readSnapshot("HEAD"), (commit) => instance.host.readSnapshot(commit), env.now, { scope: "work" });
}

// The jobs of this route waiting at a gate that is now passed, each with the gate record that passed it. A gate record whose decider is the job's own participant —
// whose work the gate checks — does not resume the job.
async function resumable(env, composed) {
  const facts = await workFacts(env, composed);
  const wanted = routeOf(env.job.runner);
  const rows = [];
  for (const { record, state } of facts.jobs) {
    if (state !== "waiting at a gate" || record.route !== wanted) continue;
    const reached = record.gates.at(-1)?.gate;
    const passed = facts.gateStates.find((each) => each.gate === reached && each.state === "passed");
    const decided = passed && facts.gates.find((each) => each.path === passed.record);
    if (decided && decided.fields.decider !== record.participant) rows.push({ record, path: record.path, gateRecord: passed.record });
  }
  return rows;
}

// Resumes a job: the `Resumed` part naming the gate record, committed on the current head.
async function resume(host, branch, now, { record, path, gateRecord }) {
  const head = await host.readSnapshot("HEAD");
  await host.commitFiles({ branch, expectedHead: head.commit, files: [{ path, text: appendToRecord(await head.read(path), { part: "resumed", at: now, gateRecord }) }],
    message: `resume ${record.id}: ${gateRecord}` });
  return `${record.id} resumed by ${gateRecord}`;
}

// The participants of the instance's register, read from its checkout.
async function participantsOfInstance(snapshot) {
  const register = await snapshot.read("docs/participants.md");
  return register === null ? [] : participantsOf(readDocument(participantSchema(), "docs/participants.md", register));
}

// The secrets a job needs, as a status when one is missing: the person's token, and the key of each participant whose route names a secret.
function missingSecret(env, participants, rows) {
  if (!env.job.personToken && env.job.part !== "agent") return `${env.job.tokenName} is missing: the person's Agent M token is a secret of this repository, passed to the job as ${env.job.tokenName}. Nothing was written.`;
  for (const { record } of rows) {
    const participant = participants.find((each) => each.name === record.participant);
    const secret = CI_ROUTE.exec(participant?.route ?? "")?.[1];
    if (secret && !env.job.keys[secret]) return `${secret} is missing: the key of ${participant.name} is a secret of this repository, passed to the job as ${secret}. Nothing was written.`;
  }
  return null;
}

// Takes and runs the jobs given by `rows` — the queued ones of this route, or the one dispatched — and ends with a status.
async function runRows(env, composed, participants, rows, handOver = null) {
  const results = [];
  for (const row of rows) results.push(await runJobOf(env, composed, participants, row, handOver));
  const ran = results.filter((each) => each.state !== "skipped");
  if (ran.length === 0) return { outcome: "nothing to do", summary: "No queued job of this route was taken.", findings: [] };
  return { outcome: ran.some((each) => each.state === "failed") ? "failed" : "done", summary: results.map((each) => each.summary).join("; "), findings: [] };
}

/**
 * onRecordsChanged(env: CiEnvironment) -> Promise<EntryStatus> — on a push to docs/jobs/ or docs/gates/ of a product: takes each queued job whose
 * route is this CI service's and runs it from its record alone with the driver of its participant, its key from its secret, unattended; the kind's
 * writer writes at once and the job's end is appended; a job whose writer committed nothing ends done with `no change`. A secret that is missing
 * ends the entry at once, `not run`, naming it, before anything is written.
 */
export async function onRecordsChanged(env) {
  const composed = composeProduct(env);
  const participants = await participantsOfInstance(await composed.instance.host.readSnapshot("HEAD"));
  const rows = ofThisMachine(env, participants, await queuedOf(env, await composed.product.host.readSnapshot("HEAD")));
  const missing = missingSecret(env, participants, rows);
  if (missing) return notRun(missing);
  const resumed = [];
  for (const row of await resumable(env, composed)) resumed.push(await resume(composed.product.host, env.branch, env.now, row));
  const status = await runRows(env, composed, participants, rows);
  if (resumed.length === 0) return status;
  return { ...status, outcome: status.outcome === "nothing to do" ? "done" : status.outcome, summary: [...resumed, ...(status.outcome === "nothing to do" ? [] : [status.summary])].join("; ") };
}

/**
 * onCheckCompleted(env: CiEnvironment) -> Promise<EntryStatus> — on a completed CI check (GitHub's check_run event, action completed) that a gate of the product's workflow
 * names as its decider, `check: <name>`: the gate's record, decided by that check — `passed` for the conclusion `success`, else `rejected` with the reason "the check <name>
 * concluded <conclusion>" —, on the check's commit, written through recordGateDecision, whose push resumes the job waiting at the gate. A check no gate names, a check that is
 * not completed and a gate that is passed already write nothing (`nothing to do`). A missing token ends the entry at once as `not run`.
 */
export async function onCheckCompleted(env) {
  const check = env.event?.payload?.check_run;
  if (!check || check.status !== "completed" || typeof check.name !== "string") return { outcome: "nothing to do", summary: "No completed check is named by the event.", findings: [] };
  if (!env.job.personToken) return notRun(`${env.job.tokenName} is missing: the person's Agent M token is a secret of this repository, passed to the job as ${env.job.tokenName}. Nothing was written.`);
  const composed = composeProduct(env);
  const facts = await workFacts(env, composed);
  const gates = (Array.isArray(facts.workflow?.gates) ? facts.workflow.gates : []).filter((gate) => /^check:[ \t]*(.+?)[ \t]*$/.exec(gate.decider ?? "")?.[1] === check.name);
  const written = [];
  for (const gate of gates) {
    if (facts.gateStates.some((each) => each.gate === gate.name && each.state === "passed")) continue;
    const waiting = facts.jobs.find(({ record, state }) => state === "waiting at a gate" && record.gates.at(-1)?.gate === gate.name);
    const passed = check.conclusion === "success";
    const head = await composed.product.host.readSnapshot("HEAD");
    const { path } = await recordGateDecision(composed.product.host, { gate: gate.name, job: waiting?.record.id ?? null, decider: { name: check.name, kind: "check" }, role: "check",
      decision: passed ? "passed" : "rejected", reason: passed ? null : `the check ${check.name} concluded ${check.conclusion}`, on: [check.head_sha] },
    { workflow: facts.workflow, assignment: null, workBy: [], head: head.commit, now: env.now, trailers: [] });
    written.push(`${gate.name} ${passed ? "passed" : "rejected"} by ${check.name}: ${path}`);
  }
  if (written.length === 0) return { outcome: "nothing to do", summary: `No gate of the workflow awaits the check ${check.name}.`, findings: [] };
  return { outcome: "done", summary: written.join("; "), findings: [] };
}

/**
 * onDispatch(env: CiEnvironment) -> Promise<EntryStatus> — on a run started from the server's own page: the input `job` names the job; a record of
 * that identifier that exists is run; otherwise the inputs `kind`, `participant`, `works_on` and `parameters` (a JSON text) make its start record, written in
 * one commit with the actor as the one who started it — its `works_on` the input of that name, identifiers separated by commas —, and it is run as onRecordsChanged runs a job.
 */
export async function onDispatch(env) {
  const inputs = env.event.payload?.inputs ?? {};
  if (!inputs.job) return notRun("The input job is missing: the identifier of the job to start. Nothing was written.");
  const composed = composeProduct(env);
  const participants = await participantsOfInstance(await composed.instance.host.readSnapshot("HEAD"));
  const path = `docs/jobs/${inputs.job}.md`;
  let snapshot = await composed.product.host.readSnapshot("HEAD");
  if ((await snapshot.read(path)) === null) {
    const participant = participants.find((each) => each.name === inputs.participant);
    const worksOn = String(inputs.works_on ?? "").split(/\s*,\s*/).filter(Boolean);
    if (!inputs.kind || !participant || worksOn.length === 0) {
      return failedStatus(`There is no record ${inputs.job}, and the inputs kind, participant and works_on do not name one to write.`);
    }
    const missingFirst = missingSecret(env, participants, [{ record: { participant: participant.name } }]);
    if (missingFirst) return notRun(missingFirst);
    const { text } = startRecord({ id: inputs.job, kind: inputs.kind, worksOn, participant: participant.name, model: participant.model, route: routeOf(env.job.runner), run: null,
      retries: null, startedBy: env.job.actor ?? "unknown", start: env.now, agentM: { version: "unreleased", commit: (await composed.instance.host.readSnapshot("HEAD")).commit }, inputs: [], limit: (await kindOf(inputs.kind)).limit,
      destinations: [{ participant: participant.name, place: participant.place ?? "", parts: [] }], params: inputs.parameters ? JSON.parse(inputs.parameters) : {} });
    await composed.product.host.commitFiles({ branch: env.branch, expectedHead: snapshot.commit, files: [{ path, text }], message: `Queue job ${inputs.job}: ${inputs.kind}` });
    snapshot = await composed.product.host.readSnapshot("HEAD");
  }
  const rows = (await queuedOf(env, snapshot, { handedOver: true })).filter(({ record }) => record.id === inputs.job);
  const handed = rows.find(({ record }) => record.task === WITH_HAND_OVER);
  if (handed) return runHandOver(env, composed, participants, handed, inputs);
  const missing = missingSecret(env, participants, ofThisMachine(env, participants, rows));
  if (missing) return notRun(missing);
  return runRows(env, composed, participants, ofThisMachine(env, participants, rows));
}

// A run a hand-over started (UC-049 4a), for the queued job whose task travels with it: without the input `task` the job ends failed with the reason, and nothing is written
// but the end; with it the job is run with the task as its instruction and, for a model endpoint, with the input `endpoint`.
async function runHandOver(env, composed, listed, row, inputs) {
  const { record, path } = row;
  // A job that is a model endpoint's own, which the prompt bar offered from a browser's configuration (THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND
  // AS PARTICIPANTS ARE): the instance does not list it, so it is the participant its record declares — its name, model, place (## Destinations), context and
  // capabilities (`declares`) — with the route of the endpoint the input names. Any other job goes only to a participant the instance lists.
  const own = !listed.some((each) => each.name === record.participant) && inputs.endpoint && record.declares ? declaredParticipant(record, inputs) : null;
  const participants = own ? [...listed, own] : listed;
  const participant = participants.find((each) => each.name === record.participant);
  if (!participant) return failedStatus(`${record.id} names the participant ${record.participant}, whom the instance does not list.`);
  const noToken = missingSecret(env, participants, []);
  if (noToken) return notRun(noToken);
  const task = typeof inputs.task === "string" ? inputs.task : "";
  if (!task.trim()) {
    const part = { part: { part: "end", at: env.now, state: "failed", results: [], draft: null, rounds: [], usage: null, cost: jobCost(null, participant), reason: NO_TASK, log: env.job.runUrl ?? null }, branch: env.branch };
    await endOf(composed)(path, part, provenanceLines({ agentM: record.agentM, jobId: record.id, kind: record.kind, participant, rounds: 0 }));
    return failedStatus(`${record.id} failed: ${NO_TASK}`);
  }
  // The key: for a model endpoint, the secret the input `secret` names, which the job workflow must name among its keys (`AGENT_M_KEY_NAMES`, by own property, so that no other
  // variable is read); for any other hand-over, the secret the participant's route names.
  const secret = inputs.endpoint ? (typeof inputs.secret === "string" && inputs.secret ? inputs.secret : null) : SECRET_OF.exec(participant.route ?? "")?.[1];
  if (secret && !(Object.hasOwn(env.job.keys, secret) && env.job.keys[secret])) {
    const unnamed = !Object.hasOwn(env.job.keys, secret);
    return notRun(unnamed
      ? `${secret} is missing: the job workflow names no such key, so no secret of that name reaches the run; the job workflow is installed again from Settings, which names the keys of the participants' routes and of this browser's endpoints. Nothing was written.`
      : `${secret} is missing: the key of ${participant.name} is a secret of this repository, passed to the job as ${secret}. Nothing was written.`);
  }
  return runRows(env, composed, participants, [row], { task, endpoint: inputs.endpoint ?? null, secret });
}

// The participant a record declares for a model endpoint the instance does not list (MOD-job-ledger's `declares`).
function declaredParticipant(record, inputs) {
  const secret = typeof inputs.secret === "string" && inputs.secret ? ` secret ${inputs.secret}` : "";
  return { name: record.participant, type: "model endpoint", model: record.model ?? null, context: record.declares.context ?? null, price: null,
    capabilities: Array.isArray(record.declares.capabilities) ? record.declares.capabilities : [], place: record.destinations?.[0]?.place || null,
    route: `endpoint ${record.participant}${secret}` };
}

// The items a sprint selects, as its record lists them in its front matter: what its close works on (a job's `works_on` names items, not a sprint).
const itemsOf = (sprints, name) => [].concat(sprints.find((record) => record.path === `docs/backlog/sprints/${name}.md`)?.fields?.selection ?? []);

// The route a participant's register row names, as queueJob takes it: a CI route, hosted or a self-hosted runner's label; null for a route CI cannot queue for (a person's account, a model endpoint called from a tab).
function queueRouteOf(participant) {
  const ci = /^ci (hosted|runner:(\S+))(?: |$)/.exec(participant?.route ?? "");
  return ci ? { kind: "ci", runner: ci[2] ?? "hosted" } : null;
}

/**
 * onSchedule(env: CiEnvironment) -> Promise<EntryStatus> — on the product's schedule: each sprint MOD-work-plans' sprintsToClose names, at the day of `env.now`, whose closer is a participant of the instance's register that is no person,
 * gets its close — a job of kind `close-sprint`, working on the items of its selection (`works_on`; the parameter `sprint` names the sprint `<team>/<nn>`), started by the schedule — queued for that agent's route, in one commit each, unless a close
 * of the sprint is queued, taken or waiting at a gate already (a record without an end). A closer who is a person, or no participant, gets none; neither does an agent whose route CI cannot queue for. A missing person's token ends
 * the entry `not run`, before anything is written.
 */
export async function onSchedule(env) {
  if (!env.job.personToken) return notRun(`${env.job.tokenName} is missing: the person's Agent M token is a secret of this repository, passed to the job as ${env.job.tokenName}. Nothing was written.`);
  const composed = composeProduct(env);
  const { product, instance } = composed;
  const participants = await participantsOfInstance(await instance.host.readSnapshot("HEAD"));
  const facts = await workFacts(env, composed);
  const states = Array.isArray(facts.plan?.states) ? facts.plan.states : [];
  const open = new Set(facts.jobs.filter(({ record }) => record.kind === "close-sprint" && !record.end).map(({ record }) => String(record.params?.sprint ?? "")));
  const agentM = { version: "unreleased", commit: (await instance.host.readSnapshot("HEAD")).commit };
  const limit = (await kindOf("close-sprint")).limit;
  const queued = [], skipped = [];
  for (const due of sprintsToClose(Array.isArray(facts.sprints) ? facts.sprints : [], states, env.now.toISOString().slice(0, 10))) {
    const closer = participants.find((each) => each.name === due.closer);
    if (!closer || closer.type === "person") continue;
    if (open.has(due.sprint)) { skipped.push(`${due.sprint}: its close is queued or running`); continue; }
    const route = queueRouteOf(closer);
    if (!route) { skipped.push(`${due.sprint}: the route of ${closer.name} is no route of CI`); continue; }
    const head = await product.host.readSnapshot("HEAD");
    const id = newJobId(env.now, new Set(head.paths.map((path) => /^docs\/jobs\/(JOB-[^/]+)\.md$/.exec(path)?.[1]).filter(Boolean)));
    await queueJob(product.host, { id, kind: "close-sprint", worksOn: itemsOf(facts.sprints, due.sprint), participant: closer.name, model: closer.model, route: routeOf(route.runner), run: null, retries: null, startedBy: "schedule", start: env.now, agentM,
      inputs: [], limit, destinations: [{ participant: closer.name, place: closer.place ?? "", parts: [] }], params: { sprint: due.sprint } }, route, head.commit);
    queued.push(`${id}: the close of ${due.sprint} (${due.because}) for ${closer.name}`);
  }
  if (queued.length === 0) return { outcome: "nothing to do", summary: skipped.length ? skipped.join("; ") : "No sprint that an agent closes has ended.", findings: [] };
  return { outcome: "done", summary: [...queued, ...skipped].join("; "), findings: [] };
}

// ---------------------------------------------------------------- the machines of the job workflow

/**
 * chooseAgentKey(env: CiEnvironment) -> Promise<EntryStatus> — before the agent's machine starts: which of the job workflow's agent jobs runs, given to the
 * workflow — on GitHub as the step's output `agent`, on GitLab as the line `AGENT_M_AGENT=<n>` of the dotenv file the job's output names — the place, from 1, of
 * the key the run's job reads among AGENT_M_KEY_NAMES, or 0 for none. The key is the one the input
 * `secret` names for a hand-over to a model endpoint; for any other dispatch the one the route of the job's participant names; on a push the one of the oldest queued
 * job of this route. A key the file does not read is none: the agent's machine then reports it missing, as it reports a missing key. Holds no secret; writes nothing.
 */
export async function chooseAgentKey(env) {
  const composed = composeProduct(env);
  const participants = await participantsOfInstance(await composed.instance.host.readSnapshot("HEAD"));
  const snapshot = await composed.product.host.readSnapshot("HEAD");
  const inputs = dispatched(env) ? env.event.payload?.inputs ?? {} : null;
  let key = null;
  if (inputs?.endpoint) key = typeof inputs.secret === "string" && inputs.secret ? inputs.secret : null;
  else if (inputs) {
    const row = (await queuedOf(env, snapshot, { handedOver: true })).find(({ record }) => record.id === inputs.job);
    const participant = participants.find((each) => each.name === (row?.record.participant ?? inputs.participant));
    key = (row?.record.task === WITH_HAND_OVER ? SECRET_OF : CI_ROUTE).exec(participant?.route ?? "")?.[1] ?? null;
  } else {
    const [first] = await queuedOf(env, snapshot);
    key = first ? keyOfRow(participants, first) : null;
  }
  const at = key !== null && Object.hasOwn(env.job.keys, key) ? Object.keys(env.job.keys).indexOf(key) + 1 : 0;
  if (env.job.outputFile) fs.appendFileSync(env.job.outputFile, env.service === "gitlab" ? `AGENT_M_AGENT=${at}\n` : `agent=${at}\n`);
  return { outcome: "done", findings: [], summary: at > 0 ? `The agent's machine receives the key ${key}.`
    : key ? `${key} is not a key this job workflow reads: the agent's machine receives none.` : "The agent's machine receives no key." };
}

/**
 * leaveResult(env: CiEnvironment) -> Promise<EntryStatus> — on the agent's machine, after its entry, whether that ended well or not: the run's result packed for the
 * writing machine (result.mjs' packResult); `nothing to do` where the entry made none.
 */
export async function leaveResult(env) {
  if (env.job.part !== "agent" || !env.job.resultDir) return notRun("This is not the agent's machine of a job workflow: AGENT_M_PART is not agent, or AGENT_M_RESULT_DIR is not set.");
  const packed = packResult(env.job.resultDir);
  if (!packed) return { outcome: "nothing to do", summary: "The entry left no result.", findings: [] };
  return { outcome: "done", findings: [], summary: `The result holds ${packed.refs.length} branch(es), ${packed.ends} end(s) of jobs and ${packed.pullRequests} pull request(s) to open.` };
}

/**
 * writeResult(env: CiEnvironment) -> Promise<EntryStatus> — on the writing machine, which runs no agent, with the person's token: reads the result the agent's machine
 * left (readResult) and checks it (checkResult) against the token and every key of the file and, for a hand-over, its task. A result that passes is written:
 * its branches pushed (writeBranches), each pull request kept for later opened — or the open or merged one of its branch taken —, and each job's end appended, its
 * commits and pull requests named as they now stand. A result that is refused, or that does not apply, writes no branch; each job it ended is ended failed, naming
 * why — except one another run has taken or ended meanwhile. `nothing to do` where no result was left; `not run` without the token.
 */
export async function writeResult(env) {
  if (!env.job.personToken) return notRun(`${env.job.tokenName} is missing: the person's Agent M token is a secret of this repository, passed to the job as ${env.job.tokenName}. Nothing was written.`);
  const path = globalThis.process.getBuiltinModule("node:path");
  const out = env.job.resultDir ? path.join(env.job.resultDir, "out") : null;
  const resultFile = out ? path.join(out, "result.json") : null;
  if (!resultFile || !fs.existsSync(resultFile)) return { outcome: "nothing to do", summary: "The agent's machine left no result.", findings: [] };
  const composed = composeProduct(env);
  const task = dispatched(env) && typeof env.event.payload?.inputs?.task === "string" ? env.event.payload.inputs.task : null;
  let result = JSON.parse(fs.readFileSync(resultFile, "utf8")), refused = null, notApplied = null, renamed = new Map();
  const pulls = new Map();
  try {
    const read = readResult(env.job.productDir, out);
    result = read.result;
    refused = checkResult(read, [env.job.personToken, ...Object.values(env.job.keys)].filter(Boolean), task);
  } catch (error) { refused = error.message; }
  if (!refused) {
    try {
      renamed = writeBranches(env.job.productDir, result);
      for (const request of result.pullRequests) {
        const open = (await composed.product.host.listPullRequests({ branch: request.branch, state: "all" })).find((pull) => pull.state === "open" || pull.state === "merged");
        pulls.set(pendingPullRequest(request.branch), open?.url ?? (await composed.product.host.openPullRequest(request)).url);
      }
    } catch (error) { notApplied = error.message; }
  }
  const why = refused ? `the result of the agent's machine is refused: ${refused}` : notApplied ? `the result of the agent's machine was not written: ${notApplied}` : null;
  // Where nothing was written, a record another run has taken or ended meanwhile is that run's.
  const others = new Set();
  if (why) {
    for await (const record of recordsNewestFirst(await composed.product.host.readSnapshot("HEAD"))) if (record.taken || record.end) others.add(record.path);
  }
  const ended = [];
  for (const { path: recordPath, part, trailers } of result.ends) {
    if (why && others.has(recordPath)) continue;
    const end = why ? { ...part.part, at: new Date(part.part.at), state: "failed", results: [], draft: null, reason: why }
      : { ...part.part, at: new Date(part.part.at), results: part.part.results.map((each) => renamed.get(each) ?? pulls.get(each) ?? each) };
    await endRecord(composed.product.host, recordPath, { part: end, branch: part.branch }, trailers);
    ended.push(`${/([^/]+)\.md$/.exec(recordPath)?.[1] ?? recordPath} ${end.state}`);
  }
  if (why) return failedStatus(`${why}${ended.length ? `; ended: ${ended.join(", ")}` : ""}.`);
  return { outcome: "done", findings: [], summary: `Written: ${result.refs.length} branch(es)${pulls.size ? `, ${pulls.size} pull request(s)` : ""}${ended.length ? `; ended: ${ended.join(", ")}` : ""}.` };
}

// ---------------------------------------------------------------- the test configuration

const LEVELS = ["unit", "component", "system", "release", "user"];
// The rows of a schedule, in its order (MOD-test-schedule, Data: Schema schedule).
const ROWS = ["unit", "component", "system", "paid", "release", "user"];
// A report or a status a test job kept, by its name <occasion>.<row>.<shard>.xml or .status (Data: The reports of a run).
const KEPT = /^(commit|pull-request|nightly|release-candidate|on-demand)\.(unit|component|system|paid|release|user)\.([1-9]\d*)\.(xml|status)$/;
// The status of a test job that did not run since a secret was missing (runTests), and the identifier at the start of a test case's name (MOD-result-records, Data).
const SECRET_MISSING = /^not run: secret missing: (\S+)$/;
const TEST_ID = /^TST-\d+/;
const two = (number) => String(number).padStart(2, "0");
// A cell of a record's table: its lines joined by <br>, a bar escaped, so that a log stays in its one row.
const cellOf = (value) => String(value ?? "").trim().replace(/\r?\n/g, "<br>").replace(/\|/g, "\\|");

// The folder below the product's checkout that holds a run's reports and statuses (Data: The reports of a run).
const REPORTS = "agent-m-reports";
const childProcess = globalThis.process?.getBuiltinModule?.("node:child_process");
const pathOf = globalThis.process?.getBuiltinModule?.("node:path");

// The test files among a commit's files, with their texts: every file MOD-test-document counts a test file, of which testsOfRow takes those named as tests. The clone reads a
// file by one process of git, so they are read thirty-two at a time.
async function testFilesAt(snapshot) {
  const paths = snapshot.paths.filter((path) => isTestFile(path));
  await snapshot.readMany?.(paths);
  const files = [];
  for (let at = 0; at < paths.length; at += 32) {
    files.push(...await Promise.all(paths.slice(at, at + 32).map(async (path) => ({ path, text: (await snapshot.read(path)) ?? "" }))));
  }
  return files;
}

// The product's command run with the files as its arguments — `<command> "$@"` in a shell —, or, where the command is empty, node's test runner, which draws the shard's share
// with its own sharding and writes the JUnit XML report with its own reporter, besides its readable output. The output goes to the job's log as it comes. Resolves with how it
// ended: its status, or the signal that stopped it.
function runCommand(command, files, { cwd, variables, shard, shards, report }) {
  const [program, args] = command ? ["sh", ["-c", `${command} "$@"`, "agent-m-tests", ...files]]
    : [globalThis.process.execPath, ["--test", `--test-shard=${shard}/${shards}`, "--test-reporter=spec", "--test-reporter-destination=stdout", "--test-reporter=junit",
      `--test-reporter-destination=${report}`, ...files]];
  return new Promise((resolve) => {
    const child = childProcess.spawn(program, args, { cwd, env: variables, stdio: ["ignore", "inherit", "inherit"] });
    child.on("error", (error) => resolve({ code: null, signal: null, error }));
    child.on("close", (code, signal) => resolve({ code, signal, error: null }));
  });
}

/**
 * runTests(env: CiEnvironment) -> Promise<EntryStatus> — in each test job of MOD-test-schedule's test configuration, on a machine that holds no token: the files of the row
 * AGENT_M_ROW among the commit's committed files, read through the local clone, as testsOfRow names them; then AGENT_M_COMMAND, or node's test runner where it is empty, run in
 * the checkout with those files and the job's variables, AGENT_M_REPORT among them, the path of the report agent-m-reports/<occasion>.<row>.<shard>.xml. As it ends it writes
 * its status, one line, to agent-m-reports/<occasion>.<row>.<shard>.status: `done`, `nothing to do`, `failed: <why>` or `not run: secret missing: <name>`. A secret
 * AGENT_M_SECRETS names that is not set — absent or empty — ends it `not run` before anything runs; a named test file whose level cannot be read ends it `failed` before
 * anything runs, naming each; a row without a file ends `nothing to do`, with no report. The command ending with 0 is `done`, any other end `failed`, naming its status. Reads
 * no token and writes nothing to a repository. Without the row, the occasion or the shard, no status can be named: it ends `failed` and writes none.
 */
export async function runTests(env) {
  const { row, occasion, shard, shards, command, secrets, variables } = env.run;
  if (!row || !occasion || !shard) {
    return failedStatus(`${!row ? "AGENT_M_ROW" : !occasion ? "AGENT_M_OCCASION" : "AGENT_M_SHARD"} is missing: the test job names its row, occasion and shard. Nothing was run.`);
  }
  const folder = pathOf.join(env.checkout, REPORTS);
  const name = `${occasion}.${row}.${shard}`;
  const report = pathOf.join(folder, `${name}.xml`);
  const end = (outcome, reason, summary) => {
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(pathOf.join(folder, `${name}.status`), `${reason ? `${outcome}: ${String(reason).replace(/\s*\n\s*/g, " ")}` : outcome}\n`);
    return { outcome, summary, findings: [] };
  };
  const missing = secrets.find((secret) => !variables[secret]);
  if (missing) return end("not run", `secret missing: ${missing}`, `The secret ${missing}, which AGENT_M_SECRETS names, is not set: the tests of the row ${row} did not run.`);
  try {
    const snapshot = await composeTestJob(env).checkout.readSnapshot("HEAD");
    const { files, unreadable } = testsOfRow(row, await testFilesAt(snapshot));
    if (unreadable.length) {
      const why = `the level of ${unreadable.join(", ")} cannot be read`;
      return end("failed", why, `Nothing was run: ${why}; a test file names its level in its header's Level: or in its declarations.`);
    }
    if (!files.length) return end("nothing to do", null, `The row ${row} has no test file at ${snapshot.commit}: nothing was run.`);
    fs.mkdirSync(folder, { recursive: true });
    const ended = await runCommand(command, files, { cwd: env.checkout, variables: { ...variables, AGENT_M_REPORT: report }, shard, shards, report });
    const ran = `${files.length} test file(s) of the row ${row}, shard ${shard} of ${shards}`;
    if (ended.code === 0) return end("done", null, `The ${command ? "command" : "node test runner"} ran the ${ran}; it ended with 0.`);
    const why = ended.error ? `the command could not be started: ${ended.error.message}` : ended.signal ? `the command was stopped by ${ended.signal}` : `the command ended with status ${ended.code}`;
    return end("failed", why, `The ${ran} were run, and ${why}.`);
  } catch (error) {
    const why = `${error?.name === "UnknownRow" ? "" : "runTests failed: "}${error?.message ?? error}`;
    return end("failed", why, `${why}. Nothing was run.`);
  }
}

// Whether the checkout's tracked files hold changes the commit does not: a file the run added, such as its report, is none.
function uncommittedIn(checkout) {
  const said = globalThis.process.getBuiltinModule("node:child_process").execFileSync("git", ["-C", checkout, "status", "--porcelain", "--untracked-files=no"],
    { encoding: "utf8", env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
  return said.trim() !== "";
}

// The text of a run's record in the schema `result-record`: its front matter, its outcomes with the reason of a test not run, and the failures where a test failed.
function recordText({ commit, levels, occasion, participant, now, run, uncommitted, outcomes }) {
  const failures = outcomes.filter((outcome) => outcome.failure);
  return ["---", `commit: ${commit}`, "levels:", ...levels.map((level) => `  - ${level}`), `occasion: ${occasion}`, `participant: ${participant}`,
    `date: ${now.getUTCFullYear()}-${two(now.getUTCMonth() + 1)}-${two(now.getUTCDate())} ${two(now.getUTCHours())}:${two(now.getUTCMinutes())} UTC`,
    ...(run ? [`run: ${run}`] : []), ...(uncommitted ? ["uncommitted: true"] : []), "---",
    "## Outcomes", "", "| Test | Level | Outcome | Runs | Reason |", "|---|---|---|---|---|",
    ...outcomes.map((outcome) => `| ${cellOf(outcome.test)} | ${outcome.level} | ${outcome.outcome} | ${cellOf(outcome.runs)} | ${cellOf(outcome.reason)} |`), "",
    ...(failures.length ? ["## Failures", "", "| Test | Expected | Observed | Log |", "|---|---|---|---|",
      ...failures.map(({ test, failure }) => `| ${cellOf(test)} | ${cellOf(failure.expected)} | ${cellOf(failure.observed)} | ${cellOf(failure.log)} |`), ""] : [])].join("\n");
}

// The reports and statuses a run's test jobs kept in the folder, by their names; files of other names are none of them.
function keptIn(folder) {
  const names = fs.existsSync(folder) ? fs.readdirSync(folder) : [];
  return names.map((name) => KEPT.exec(name)).filter(Boolean).map(([name, occasion, row, shard, kind]) => ({ name, occasion, row, shard: Number(shard), kind }));
}
// The first line of a status file, or null where the job left none.
function statusIn(folder, name) {
  const path = pathOf.join(folder, name);
  return fs.existsSync(path) ? fs.readFileSync(path, "utf8").split(/\r?\n/)[0].trim() : null;
}
// The line an entry's status file holds: the outcome, and after it the summary where the outcome is neither `done` nor `nothing to do`.
const statusLineOf = (status) => (["done", "nothing to do"].includes(status.outcome) ? status.outcome : `${status.outcome}: ${status.summary.replace(/\s*\n\s*/g, " ")}`);

// The outcomes of a row's reports, read together: a report parseOutcomes refuses as unreadable is left out and the others read again. `withCase` holds the tests some readable
// report holds a case of — read as the cases no declaration claims, which parseOutcomes names by their own names —, `unreadable` the paths of the reports left out.
function outcomesOfRow(reports, declared) {
  const readable = [...reports];
  const unreadable = [];
  for (;;) {
    try {
      const texts = readable.map((report) => report.text);
      const outcomes = parseOutcomes(texts, declared);
      const withCase = new Set(parseOutcomes(texts, []).map((outcome) => TEST_ID.exec(outcome.test)?.[0]).filter(Boolean));
      return { outcomes, withCase, unreadable };
    } catch (error) {
      if (error?.name !== "UnreadableReport" || !(error.index >= 0 && error.index < readable.length)) throw error;
      unreadable.push(readable[error.index].path);
      readable.splice(error.index, 1);
    }
  }
}

// The run's record: its levels and outcomes, from every row that left a report or a status — the declared tests of the files testsOfRow names for the row, each undeclared
// case with the level of its row —, or null where no test of any row is recorded.
function runOutcomes(folder, kept, files) {
  const levels = new Set();
  const outcomes = [];
  for (const row of ROWS.filter((each) => kept.some((file) => file.row === each))) {
    const texts = new Map(files.map((file) => [file.path, file.text]));
    const declared = testsOfRow(row, files).files.flatMap((path) => testDeclarations(path, texts.get(path)));
    const ofRow = kept.filter((file) => file.row === row).sort((a, b) => a.shard - b.shard);
    const reports = ofRow.filter((file) => file.kind === "xml").map((file) => ({ path: `${REPORTS}/${file.name}`, text: fs.readFileSync(pathOf.join(folder, file.name), "utf8") }));
    const secret = ofRow.filter((file) => file.kind === "status").map((file) => SECRET_MISSING.exec(statusIn(folder, file.name) ?? "")?.[1]).find(Boolean);
    const { outcomes: own, withCase, unreadable } = outcomesOfRow(reports, declared);
    const reason = unreadable.length ? `report unreadable: ${unreadable.join(", ")}` : secret ? `secret missing: ${secret}` : null;
    const ofLevels = row === "paid" ? LEVELS.filter((level) => declared.some((declaration) => declaration.level === level)) : [row];
    if (reports.length) for (const level of ofLevels) levels.add(level);
    for (const outcome of own) {
      if (outcome.outcome === "undeclared") {
        if (ofLevels.length) outcomes.push({ ...outcome, level: ofLevels[0] });
      } else outcomes.push(outcome.outcome === "not run" && reason && !withCase.has(outcome.test) ? { ...outcome, reason } : outcome);
    }
  }
  const run = LEVELS.filter((level) => levels.has(level));
  const recorded = run.length ? run : LEVELS.filter((level) => outcomes.some((outcome) => outcome.level === level));
  return recorded.length ? { levels: recorded, outcomes } : null;
}

/**
 * onTestsFinished(env: CiEnvironment) -> Promise<EntryStatus> — in the job `agent-m records` of MOD-test-schedule's test configuration, after the run's test jobs: the run's one
 * result record added to the branch test-results through the server's API (appendResult). It reads every report and status the test jobs kept in agent-m-reports/ together: the
 * occasion is the one their names give, the levels run the rows that left a report — the row paid standing for the levels of the tests it ran —, and the outcomes those of the
 * declared tests of each row that left a report or a status, the files testsOfRow names for it, matched by parseOutcomes; a test whose shard left no report reads `not run`. A
 * report parseOutcomes refuses is left out and the others read again; the row's tests no readable report holds a case of read `not run` with the reason `report unreadable:
 * <file>, …`. The tests of a row whose status is `not run: secret missing: <name>` read `not run` with the reason `secret missing: <name>`. The record names the commit the
 * checkout holds, the runner, the date, the run's page and `uncommitted` where tracked files changed. On Moved it reads the branch again and adds again; a record that cannot be
 * added ends `failed`. A run without a report or a status ends `nothing to do`; a missing token ends `not run` before anything is read. As it ends it writes its status, one
 * line, to agent-m-reports/records.status.
 */
export async function onTestsFinished(env) {
  const folder = pathOf.join(env.checkout, REPORTS);
  let status;
  try {
    status = await recordRun(env, folder);
  } catch (error) {
    status = failedStatus(`onTestsFinished failed: ${error?.message ?? error}`);
  }
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(pathOf.join(folder, "records.status"), `${statusLineOf(status)}\n`);
  return status;
}

async function recordRun(env, folder) {
  if (!env.job.personToken) return notRun(`${env.job.tokenName} is missing: the person's Agent M token is a secret of this repository, passed to the step as ${env.job.tokenName}. Nothing was written.`);
  const kept = keptIn(folder);
  if (!kept.length) return nothingToDo(`The run's test jobs kept no report and no status in ${REPORTS}/: there is nothing to record.`);
  const occasions = [...new Set(kept.map((file) => file.occasion))];
  if (occasions.length > 1) return failedStatus(`The reports in ${REPORTS}/ name the occasions ${occasions.join(", ")}: they are not one run's. Nothing was written.`);
  const [occasion] = occasions;
  const { checkout, server } = composeTestRun(env);
  const snapshot = await checkout.readSnapshot("HEAD");
  const run = runOutcomes(folder, kept, await testFilesAt(snapshot));
  if (!run) return nothingToDo(`No row of the run holds a test at ${snapshot.commit}: there is nothing to record.`);
  const hex = [...globalThis.crypto.getRandomValues(new Uint8Array(2))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const { now } = env;
  const path = `runs/${snapshot.commit}/${now.getUTCFullYear()}${two(now.getUTCMonth() + 1)}${two(now.getUTCDate())}-${two(now.getUTCHours())}${two(now.getUTCMinutes())}-${occasion}-${hex}.md`;
  const text = recordText({ commit: snapshot.commit, levels: run.levels, occasion, participant: env.tests.runner ?? (env.service === "gitlab" ? "GitLab CI" : "GitHub Actions"), now,
    run: env.job.runUrl, uncommitted: uncommittedIn(env.checkout), outcomes: run.outcomes });
  const record = readDocument(resultSchema.run, path, text);
  for (let attempt = 1; ; attempt++) {
    try {
      const { commit } = await appendResult(server, record);
      return { outcome: "done", summary: `The run's record ${path} was added to test-results in ${commit}.`, findings: [] };
    } catch (error) {
      if (error?.name === "Moved" && attempt < 5) continue;
      return failedStatus(`The run's record ${path} was not added to test-results: ${error?.message ?? error}`);
    }
  }
}

// A job's identifier, as a pull request's title and description name it (MOD-runtimes' writer branch-and-pull-request: the title `<id>: <kind> …`, the line `Job: <id>`).
const JOB_ID = /\bJOB-\d{8}-\d{4}-[0-9a-f]+\b/;
// The kinds of an implementation job, whose pull request the Definition of Done is checked for (MOD-product-process' doneCheck).
const IMPLEMENTING = ["implement", "refactor", "fix-bug"];
const nothingToDo = (summary) => ({ outcome: "nothing to do", summary, findings: [] });
const findingLine = (found) => `${found.artifact}:${found.line}: ${found.kind}: ${found.what} [${found.rule}] — ${found.fix}`;

// The rule a head without green CI misses (MOD-product-process' doneCheck names the same), and the jobs of a pull request's run that AGENT_M_EXPECTED names: `<row>:<shards>`,
// separated by commas; null where it names none or one cannot be read.
const GREEN_CI = "CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI";
function expectedJobs(expected) {
  const entries = String(expected ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
  const jobs = entries.map((entry) => /^(unit|component|system|paid|release|user):([1-9]\d*)$/.exec(entry));
  return jobs.length && jobs.every(Boolean) ? jobs.map(([, row, shards]) => ({ row, shards: Number(shards) })) : null;
}

// The CI result of the pull request's head, from the run's own statuses in the folder (Data: The reports of a run): green only when every shard the expected jobs name left
// `done` or `nothing to do` and the job `agent-m records` left `done`. Each job that is not green is a finding, named by its status file: a status that is missing — a job that
// failed before its end, was cancelled or ran out of time — or any other.
function headCi(folder, jobs) {
  const findings = [];
  const weigh = (name, job, green) => {
    const line = statusIn(folder, `${name}.status`);
    if (line !== null && green.includes(line)) return;
    findings.push({ artifact: `${REPORTS}/${name}.status`, line: 1, kind: "error", rule: GREEN_CI,
      what: line === null ? `${job} (${name}) left no status: it failed before its end, was cancelled or ran out of time` : `${job} (${name}) ended "${line}"`,
      fix: "repair the failure and push, or run the job again" });
  };
  for (const { row, shards } of jobs) {
    for (let shard = 1; shard <= shards; shard++) weigh(`pull-request.${row}.${shard}`, `the test job of the row ${row}, shard ${shard} of ${shards},`, ["done", "nothing to do"]);
  }
  weigh("records", "the job agent-m records", ["done"]);
  return { green: findings.length === 0, findings };
}

// The pull request's facts with the head's CI result the run's statuses give: the head commit green or failed by them, and none of the head's checks the server reports weighed.
// The earlier commits keep the CI results the server gives.
function withHeadCi(facts, green) {
  const head = facts.commits.at(-1);
  return { ...facts, checks: [], commits: facts.commits.map((commit) => (commit === head ? { ...commit, ci: green ? "success" : "failure" } : commit)) };
}

// The modules of a job: those its items and plan steps name, and a module it works on itself.
function modulesOfJob(record, items) {
  const modules = new Set();
  for (const id of record.worksOn ?? []) {
    if (/^MOD-/.test(id)) modules.add(id);
    for (const item of items.filter((each) => each.fields?.id === id)) for (const module of [].concat(item.fields.modules ?? [])) modules.add(module);
  }
  return [...modules];
}

/**
 * onDoneCheck(env: CiEnvironment) -> Promise<EntryStatus> — in the job `agent-m done` of MOD-test-schedule's test configuration, on a pull request opened or updated: MOD-product-process'
 * doneCheck of the pull request's facts (pullRequestFacts, through the server's API with the person's token), for the job its title or description names, with the product's workflow,
 * module files and gate records as the checkout of the pull request holds them (productFacts, the instance's catalogue read from the checkout of the instance, `.agent-m`), the job's
 * modules those of the items and plan steps it works on. The CI result of the head is read from the run's own statuses in agent-m-reports/, with no call to the server: green
 * only when every shard AGENT_M_EXPECTED names left `done` or `nothing to do` and records.status is `done` (headCi); each job that is not green is a finding naming it. `done` when
 * the Definition of Done holds, `failed` with each condition it misses as a finding; the status and the findings stand in the check's log and in the run's summary. A pull request
 * that names no job, or a job of no implementing kind, is `nothing to do`; a missing token, pull request or AGENT_M_EXPECTED ends the entry `not run` before anything is read.
 */
export async function onDoneCheck(env) {
  if (!env.job.personToken) return notRun(`${env.job.tokenName} is missing: the person's Agent M token is a secret of this repository, passed to the step as ${env.job.tokenName}. Nothing was written.`);
  const number = env.tests.pullRequest;
  if (!number) return notRun("The event names no pull request: the Definition of Done is checked on a pull request. Nothing was written.");
  const jobs = expectedJobs(env.tests.expected);
  if (!jobs) return notRun(`AGENT_M_EXPECTED ${env.tests.expected ? `names no job as <row>:<shards>: ${env.tests.expected}` : "is missing"}: without it the jobs of the run are not known. Nothing was read.`);
  const { checkout, server, instance } = composeTestRun(env);
  const facts = await server.pullRequestFacts(number);
  const id = JOB_ID.exec(`${facts.pullRequest.title}\n${facts.pullRequest.body}`)?.[0];
  if (!id) return nothingToDo(`Pull request #${number} names no job: the Definition of Done is checked for an implementation job's pull request.`);
  const product = await productFacts(checkout, await instance.readSnapshot("HEAD"), (commit) => instance.readSnapshot(commit), env.now, { scope: "work" });
  const row = product.jobs.find(({ record }) => record.id === id);
  if (!row) return failedStatus(`Pull request #${number} names the job ${id}, which has no record in docs/jobs/.`);
  if (!IMPLEMENTING.includes(row.record.kind)) return nothingToDo(`Pull request #${number} is of the job ${id} of kind ${row.record.kind}, which is no implementation job.`);
  if (!product.workflow || product.workflow === "unknown") {
    return failedStatus(`The product's declared process could not be read${product.modelUnread ? ` at ${product.modelUnread.commit}: ${product.modelUnread.error}` : ": docs/process.md declares none"}.`);
  }
  const ci = headCi(pathOf.join(env.checkout, REPORTS), jobs);
  const findings = [...ci.findings, ...await doneCheck(withHeadCi(facts, ci.green), product.workflow, product.modules, product.gates,
    { kind: row.record.kind, modules: modulesOfJob(row.record, product.plan.items) })];
  const failed = findings.some((found) => found.kind === "error");
  const summary = failed ? `The Definition of Done of pull request #${number} (${id}) does not hold: ${findings.length} finding(s).`
    : `The Definition of Done of pull request #${number} (${id}) holds.`;
  if (env.job.summaryFile) fs.appendFileSync(env.job.summaryFile, `## agent-m done\n\n${summary}\n${findings.map((found) => `\n- ${findingLine(found)}`).join("")}\n`);
  return { outcome: failed ? "failed" : "done", summary, findings };
}
