// watch.mjs — reading the served products, taking jobs and running them (MOD-bridge-jobs, Parts: watch.mjs; Interfaces: startWatching,
// stopWatching). Of it, ITM-327 builds taking and running the queued jobs of this Bridge's agents; resuming after a gate is another item's; ITM-1033 adds an agent's sprint close.
//
// Module: MOD-bridge-jobs
//
// Every job is run from its start record alone, prepared by the job runner on the job's working clone and driven by agentDriver without a key,
// unattended: its kind's writer writes at once. The Bridge keeps no state of a job beyond its record; in memory it holds the jobs it runs.

import { agentDriver, installedAgents } from "../agent-processes/index.mjs";
import { readRegister } from "../documents/index.mjs";
import { kindOf } from "../job-catalogue/index.mjs";
import { appendToRecord, jobCost, newJobId, recordsNewestFirst, takeJob } from "../job-ledger/index.mjs";
import { failedBecause, prepareJob, runJob } from "../job-runner/index.mjs";
import { participantSchema, participantsOf } from "../participant-list/index.mjs";
import { productFacts } from "../progress-measures/index.mjs";
import { queueJob } from "../runtimes/index.mjs";
import { sprintsToClose } from "../work-plans/index.mjs";
import { checkoutAt, cloneOrFetch, defaultHead, exclusively, foldersOf, hostOf, makeOutbox, publish, removeClone, workingClone } from "./workfolders.mjs";
import { enclosureOf } from "./enclosures.mjs";

const PARTICIPANTS = "docs/participants.md";
const QUIT = "the Bridge was quit";
const WITH_HAND_OVER = "with the hand-over";
const failure = (code, message) => Object.assign(new Error(message), { code });

// The Bridge and agent a participant's route names: `bridge <bridge> agent <agent>`, or null for any other route.
function bridgeRoute(route) {
  const named = /^bridge\s+(\S+)\s+agent\s+(\S+)/.exec(String(route ?? "").trim());
  return named ? { bridge: named[1], agent: named[2] } : null;
}

// One record, read from a snapshot, as the ledger reads records.
async function recordAt(snapshot, path) {
  for await (const record of recordsNewestFirst({ paths: snapshot.paths.filter((each) => each === path), read: (each) => snapshot.read(each) })) return record;
  return null;
}

// The usage of every exchange of a job, added up; null when no runtime reported any.
function totalUsage(exchanges) {
  const reported = exchanges.map(({ usage }) => usage).filter(Boolean);
  if (!reported.length) return null;
  const sum = (key) => (reported.some((usage) => typeof usage[key] === "number") ? reported.reduce((all, usage) => all + (usage[key] ?? 0), 0) : null);
  return { inputTokens: sum("inputTokens"), outputTokens: sum("outputTokens"), minutes: sum("minutes"), cost: null };
}

// Why a job failed, in the failure's words: what the agent said last, or what kept the job from starting.
const reasonOf = (error) => [error.message, error.lastOutput, ...(error.blocking ?? []).map((found) => found.what),
  ...(error.notFitting ?? []).map(({ participant, size, context }) => `${participant.name}'s context (${context ?? "none declared"}) does not hold the ${size} tokens of the job`)].filter(Boolean).join(": ");

// The watchers this program runs. A hand-over reaches every one of them.
const watchers = new Set();

// The jobs this program took, in the order it took them, kept in memory only: what GET /v1/jobs lists (MOD-bridge-jobs, Interfaces).
const jobsTaken = new Map();

// The log of each job this program took: the lines its agent's process wrote to standard output, in order, and whether the job has ended; and the jobs still running, to cancel. In memory only.
const logs = new Map();
const live = new Map();

/** jobLog(id, from) -> { lines, next, ended } — the lines of a job's log from `from` on, the index after the last line, and whether the job has ended; not-found for a job this Bridge did not take. */
export function jobLog(id, from = 0) {
  const entry = logs.get(id);
  if (!entry) throw failure("not-found", "This Bridge took no such job.");
  return { lines: entry.lines.slice(from), next: entry.lines.length, ended: entry.ended };
}

/**
 * cancelJob(id) -> Promise<{ confirmed: true }> — stops the agent's process of a running job and answers once the job has ended; the Bridge writes no end for it, the person's page appends the record
 * of the cancel (a job ended by a quit still gets its cancelled end); a job that has ended already is confirmed as it is; not-found for a job this Bridge did not take.
 */
export async function cancelJob(id) {
  const entry = live.get(id);
  if (!entry) {
    if (!jobsTaken.has(id)) throw failure("not-found", "This Bridge took no such job.");
    return { confirmed: true };
  }
  entry.cancelledByPage = true;
  entry.controller.abort();
  while (!entry.done && live.has(id)) await new Promise((resolve) => setTimeout(resolve, 5));
  await entry.done?.catch(() => {});
  return { confirmed: true };
}

// The text an agent wrote, added to a job's log line by line: a line is complete at its line break.
function appended(entry, chunk) {
  const pieces = (entry.partial + chunk).split("\n");
  entry.partial = pieces.pop();
  entry.lines.push(...pieces);
}

/**
 * listJobs() -> { id, product, kind, agent, state, started, usage }[] — the jobs this Bridge took since it started, in the order it took them: `state` is `running` while the agent works and, once the job
 * has ended, the state of its end (`done`, `failed` or `cancelled`); `started` the moment it took the job (ISO); `usage` null while it runs and the usage its end records afterwards. A job another route took is
 * not listed.
 */
export function listJobs() {
  return [...jobsTaken.values()].map((job) => ({ ...job }));
}

function createWatcher(config) {
  const { bridgeName, products, every, instance, onSkipped } = config;
  const offered = config.agents.filter((agent) => agent.folder);
  const running = new Map();
  const busy = new Set();
  // The task of each handed-over job whose record says it travels with the hand-over: in memory only, until the job ends.
  const tasks = new Map();
  let timer = null, stopped = false, chain = Promise.resolve();
  const skip = (product, reason) => onSkipped?.({ product, reason });
  const serially = (work) => (chain = chain.then(work, work));

  // The participants of the instance as the commit a record names holds them, read through this agent's clone of the instance.
  async function participantsAt(agent, commit, cache) {
    if (!cache.has(commit)) {
      cache.set(commit, (async () => {
        const folder = await cloneOrFetch(instance, foldersOf(agent.folder).instance);
        const host = await hostOf(instance, folder);
        const text = await (await host.readSnapshot(commit)).read(PARTICIPANTS);
        if (text === null) throw new Error(`the instance holds no ${PARTICIPANTS} at ${commit}`);
        return participantsOf(readRegister(participantSchema(), PARTICIPANTS, text).document);
      })());
    }
    return cache.get(commit);
  }

  // The queued records of a product the clone in `agent`'s folder holds, oldest first, with the participant each names and the agent it runs on.
  async function queuedOf(agent, product, cache) {
    const folder = await cloneOrFetch(product, foldersOf(agent.folder).product(product));
    const host = await hostOf(product, folder);
    const { commit } = await defaultHead(folder);
    const snapshot = await host.readSnapshot(commit);
    const queued = [];
    // A record whose task travels with the hand-over is taken only once its hand-over has brought the task.
    for await (const record of recordsNewestFirst(snapshot)) {
      if (!record.taken && !record.end && (record.task !== WITH_HAND_OVER || tasks.has(record.id))) queued.unshift(record);
    }
    const found = [];
    for (const record of queued) {
      const participants = await participantsAt(agent, record.agentM.commit, cache);
      const participant = participants.find((each) => each.name === record.participant);
      const route = bridgeRoute(participant?.route);
      if (route && route.bridge === bridgeName) found.push({ record, participant, agent: route.agent, host, commit });
    }
    return { found, folder, host, commit };
  }

  // The closes of the sprints a product assigned to `agent`: a sprint that MOD-work-plans' sprintsToClose names, at today's date, whose closer is a participant whose route names this Bridge and this agent, gets
  // its close — a job of the kind close-sprint working on the items of its selection, its parameter `sprint` the sprint's name — queued for this route, once: none is queued for a sprint of which the product holds
  // a close record in any state. The queued close is then taken and run like any queued job of this Bridge. Throws what reading the product or the instance throws, so that the product is skipped with the reason.
  async function queueCloses(agent, product, cache) {
    const folders = foldersOf(agent.folder);
    const productFolder = folders.product(product);
    await cloneOrFetch(product, productFolder);
    const productHead = await defaultHead(productFolder);
    const instanceFolder = await cloneOrFetch(instance, folders.instance);
    const instanceHost = await hostOf(instance, instanceFolder);
    const instanceCommit = (await defaultHead(instanceFolder)).commit;
    const host = await hostOf(product, productFolder);
    // The facts are read through the clone alone: the sprints and the job records need no pull request (productFacts takes a refusal as `unknown`). They are read at the head the clone fetched
    // (`productHead`), not at the clone's own branch, which stands where the clone was made: the records this Bridge has queued, taken and ended since are on the origin only.
    const clone = { ...host, repositoryInfo: async () => ({ ...(await host.repositoryInfo()), defaultBranch: productHead.commit }),
      listPullRequests: async () => { throw Object.assign(new Error("pull requests are not read here"), { name: "NotSupported" }); } };
    const now = new Date();
    const facts = await productFacts(clone, await instanceHost.readSnapshot(instanceCommit), (commit) => instanceHost.readSnapshot(commit), now, { scope: "work" });
    const due = sprintsToClose(Array.isArray(facts.sprints) ? facts.sprints : [], Array.isArray(facts.plan?.states) ? facts.plan.states : [], now.toISOString().slice(0, 10));
    if (due.length === 0) return;
    const participants = await participantsAt(agent, instanceCommit, cache);
    const started = new Set(facts.jobs.filter(({ record }) => record.kind === "close-sprint").map(({ record }) => String(record.params?.sprint ?? "")));
    const limit = (await kindOf("close-sprint")).limit;
    await exclusively(`take ${product}`, async () => {
      await cloneOrFetch(product, productFolder);
      let head = await defaultHead(productFolder);
      const taken = new Set((await host.readSnapshot(head.commit)).paths.map((path) => /^docs\/jobs\/(JOB-[^/]+)\.md$/.exec(path)?.[1]).filter(Boolean));
      for (const sprint of due) {
        const closer = participants.find((each) => each.name === sprint.closer);
        const route = bridgeRoute(closer?.route);
        if (!route || route.bridge !== bridgeName || route.agent !== agent.name || started.has(sprint.sprint)) continue;
        const id = newJobId(now, taken);
        taken.add(id);
        const selected = facts.sprints.find((record) => record.path === `docs/backlog/sprints/${sprint.sprint}.md`)?.fields?.selection;
        const queued = await queueJob(host, { id, kind: "close-sprint", worksOn: [].concat(selected ?? []), participant: closer.name, model: closer.model ?? null, route: `bridge ${bridgeName} agent ${agent.name}`,
          run: null, retries: null, startedBy: bridgeName, start: now, agentM: { version: "unreleased", commit: instanceCommit }, inputs: [], limit, destinations: [{ participant: closer.name, place: closer.place ?? "", parts: [] }],
          params: { sprint: sprint.sprint } }, { kind: "bridge", bridge: bridgeName }, head.commit);
        head = { ...head, commit: queued.commit };
      }
    });
  }

  // One job: taken on the head that was read, run in the agent's working folder, its working clone removed, ended in its record.
  async function run(agent, product, { record, participant, host, commit }, folder) {
    const folders = foldersOf(agent.folder);
    const controller = new AbortController();
    const mine = { controller, done: null };
    running.set(record.id, mine);
    live.set(record.id, mine);
    const logged = { lines: [], partial: "", ended: false };
    const working = folders.job(record.id), cleanup = [];
    let result = null, failed = null, listed = null;
    try {
      // Taking is one at a time in this program, on the head read just before: two watchers of one name that took on the same head in the same
      // minute would write the same commit, which a push accepts twice, and both would run the job.
      const taken = await exclusively(`take ${product}`, async () => {
        await cloneOrFetch(product, folder);
        return takeJob(host, record.path, bridgeName, (await defaultHead(folder)).commit);
      });
      if (!taken.taken) return;
      listed = { id: record.id, product, kind: record.kind, agent: agent.name, state: "running", started: new Date().toISOString(), usage: null };
      jobsTaken.set(record.id, listed);
      logs.set(record.id, logged);
      try {
        // No enclosure, no agent (ARC-054): the job ends failed with the enclosure's reason and its one-time step.
        const enclosure = await enclosureOf(config.enclosures, agent.folder);
        const head = await host.readSnapshot(taken.commit);
        const instanceFolder = await checkoutAt(await cloneOrFetch(instance, folders.instance), record.agentM.commit);
        const instanceHost = await hostOf(instance, instanceFolder);
        const context = {
          kind: await kindOf(record.kind),
          params: tasks.has(record.id) ? { ...record.params, instruction: tasks.get(record.id) } : record.params,
          product: { address: product, snapshot: head, host },
          instance: { snapshot: await instanceHost.readSnapshot(record.agentM.commit), host: instanceHost, checkout: instanceFolder },
          connect: async (address) => hostOf(address, await cloneOrFetch(address, foldersOf(agent.folder).product(address))),
          participants: await participantsAt(agent, record.agentM.commit, new Map()), places: { sources: {}, mailbox: null }, gates: [],
          person: record.startedBy, now: new Date(), agentM: record.agentM, jobId: record.id,
        };
        await workingClone(product, working);
        // The agent pushes into its outbox; the Bridge, outside the enclosure, pushes what it made to the origin before the writer reads it.
        const outbox = await makeOutbox(working);
        cleanup.push(outbox.path);
        const writable = [working, outbox.path];
        await enclosure.prepare({ writable, readable: [instanceFolder] });
        const installed = (await installedAgents({ enclosure, workdir: working })).find((each) => each.name === agent.name);
        const enclosed = agentDriver(installed, { workdir: working, keyVariable: null, enclosure, writable }, participant);
        const driver = { ...enclosed, send: async (input, options) => {
          const answer = await enclosed.send(input, options);
          await publish({ outbox, clone: folder, job: record.id });
          return answer;
        } };
        const prepared = await prepareJob(record.kind, context, { drafter: participant, reviewers: [], limit: record.limit });
        result = await runJob(prepared, { drafter: driver, reviewers: [] }, { attended: false, context, signal: controller.signal, onOutput: (chunk) => appended(logged, chunk) });
      } catch (error) {
        failed = error;
      }
      await removeClone(working);
      for (const path of cleanup) await removeClone(path);
      if (mine.cancelledByPage && !mine.quit) {
        // A cancel through the page (POST /v1/jobs/{id}/cancel): the Bridge commits nothing more; the person's page appends the record of the cancel.
        listed.state = "cancelled";
      } else {
        const end = await ended(host, product, folder, record, participant, result, failed, controller.signal.aborted && mine.quit);
        listed.state = end.state;
        listed.usage = end.usage;
      }
    } finally {
      if (listed?.state === "running") listed.state = "failed";
      if (logged.partial) { logged.lines.push(logged.partial); logged.partial = ""; }
      logged.ended = true;
      live.delete(record.id);
      tasks.delete(record.id);
      running.delete(record.id);
    }
  }

  // The end appended to the job's record on the head the product has now, read again where the branch moved.
  async function ended(host, product, folder, record, participant, result, failed, quit) {
    const cancelled = quit || failed?.name === "Cancelled";
    const usage = result ? totalUsage(result.usage) : null;
    const written = result?.written;
    const part = { part: "end", at: new Date(), draft: tasks.has(record.id) ? null : written?.shown ?? null, rounds: result?.rounds ?? [], usage, cost: jobCost(usage, participant), log: null };
    const unusable = result ? failedBecause(result) : null;
    if (failed || unusable) {
      Object.assign(part, { state: cancelled ? "cancelled" : "failed", results: [],
        reason: quit ? QUIT : cancelled ? "the job was cancelled" : failed ? reasonOf(failed) : unusable, ...(unusable ? { stoppedBecause: result.stoppedBecause } : {}) });
    } else {
      Object.assign(part, { state: "done", results: [...(written?.commits ?? []), ...(written?.files ?? []), ...(written?.pullRequest ? [written.pullRequest] : [])],
        reason: null, stoppedBecause: result.stoppedBecause, forPerson: result.forPerson });
    }
    for (let attempt = 0; ; attempt += 1) {
      await cloneOrFetch(product, folder);
      const { branch, commit } = await defaultHead(folder);
      const text = await (await host.readSnapshot(commit)).read(record.path);
      try {
        await host.commitFiles({ branch, expectedHead: commit, files: [{ path: record.path, text: appendToRecord(text, part) }], message: `end ${record.id} (${part.state})` });
        return part;
      } catch (error) {
        if (error?.name !== "Moved" || attempt >= 5) throw error;
      }
    }
  }

  async function visit(agent) {
    const cache = new Map();
    for (const product of products.map(({ address }) => address)) {
      if (stopped || busy.has(agent.name)) return;
      let queue;
      try {
        await queueCloses(agent, product, cache);
        queue = await queuedOf(agent, product, cache);
      } catch (error) {
        skip(product, error.message);
        continue;
      }
      const mine = queue.found.find((each) => each.agent === agent.name);
      if (!mine || stopped) continue;
      busy.add(agent.name);
      const job = run(agent, product, { ...mine, host: queue.host, commit: queue.commit }, queue.folder)
        .catch((error) => skip(product, `${mine.record.id}: ${error.message}`))
        .finally(() => busy.delete(agent.name));
      const entry = running.get(mine.record.id);
      if (entry) entry.done = job;
      jobs.add(job);
      job.finally(() => jobs.delete(job));
      return;
    }
  }
  const jobs = new Set();

  const tick = () => serially(async () => {
    if (stopped) return;
    for (const agent of offered) if (!busy.has(agent.name)) await visit(agent);
  });

  return {
    config, tick,
    start() { timer = setInterval(() => { tick(); }, every); timer.unref?.(); },
    async stop(reason) {
      stopped = true;
      clearInterval(timer);
      if (reason === "quit") for (const entry of running.values()) { entry.quit = true; entry.controller.abort(); }
      await chain;
      if (reason === "quit") await Promise.allSettled([...jobs]);
    },
    // A job the page handed over: which agent runs it, or the refusal.
    async accept(product, path, commit, task) {
      if (!products.some((each) => each.address === product)) return null;
      const any = offered[0];
      if (!any) throw failure("invalid-request", "No agent of this Bridge has a working folder set.");
      const record = await serially(async () => {
        const folder = await cloneOrFetch(product, foldersOf(any.folder).product(product));
        const snapshot = await (await hostOf(product, folder)).readSnapshot(commit);
        return recordAt(snapshot, path);
      });
      if (!record) throw failure("invalid-request", `${path} is not a job record at ${commit}.`);
      const participant = (await participantsAt(any, record.agentM.commit, new Map())).find((each) => each.name === record.participant);
      const route = bridgeRoute(participant?.route);
      const agent = route && route.bridge === bridgeName ? config.agents.find((each) => each.name === route.agent) : null;
      if (!agent || !agent.folder) throw failure("invalid-request", `This Bridge does not offer the agent of ${record.participant} with a working folder.`);
      if (record.task === WITH_HAND_OVER) {
        if (typeof task !== "string" || !task) throw failure("invalid-request", `${record.id} carries its task with the hand-over, and none was handed over.`);
        tasks.set(record.id, task);
      }
      tick();
      return record.id;
    },
  };
}

/**
 * startWatching(config: { bridgeName: string, agents: { name: string, folder: string }[], products: { address: string }[], every: number,
 * instance: string, onSkipped?: ({ product, reason }) => void }) -> void — reads every served product through a clone in each offered agent's
 * working folder, with the computer's own git login, at the given interval and after every hand-over, and takes and runs the queued jobs whose
 * participant's route names this Bridge and an agent it offers: a commit only on the head that was read, so that no other route takes them too.
 * `instance` is the address of the instance repository, whose `docs/participants.md` names the participants; `onSkipped` is told of each product
 * that could not be read, with the reason, which is read again at the next interval.
 */
export function startWatching(config) {
  const watcher = createWatcher(config);
  watchers.add(watcher);
  watcher.start();
}

/** stopWatching(reason: "pause" | "quit") -> Promise<void> — takes nothing new; on quit every job still running ends as cancelled. */
export async function stopWatching(reason) {
  const stopping = [...watchers];
  watchers.clear();
  await Promise.all(stopping.map((watcher) => watcher.stop(reason)));
}

/**
 * handOver({ product, record, commit, task? }) -> Promise<string> — the id of the job a page handed over, run before the next interval;
 * invalid-request for one no watcher offers, and for a job whose record says its task travels with the hand-over, handed over without one.
 */
export async function handOver({ product, record, commit, task }) {
  for (const watcher of watchers) {
    const id = await watcher.accept(product, record, commit, task);
    if (id) return id;
  }
  throw failure("invalid-request", "This Bridge serves no such product, or is not watching.");
}
