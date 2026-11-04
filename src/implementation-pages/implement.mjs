// implement.mjs — the route `implement`: the ready items of the backlog started as implementation jobs (MOD-implementation-pages, Parts; Interfaces: implement; UC-034 steps 1 to 4, 2a, 3a, 4a). The items of the
// backlog — or, with the address `#implement/sprint=<team>/<nn>`, which *Start sprint work* leads to, every item of that sprint's selection — each with its state and, if it cannot start, every reason MOD-work-plans'
// startable gives; for a startable item the participants that hold the implementing role in the item's role assignment and can write and run tests (MOD-participant-list's eligible), each with where it processes data
// and its routes from MOD-runtimes' routesFor, the attempt limit, who merges, the target branch, the gates the job will meet with who decides them, and what is sent where (MOD-job-runner's prepareJob). *Start jobs*, one
// click of a person, writes each chosen item's start record under docs/jobs/ and queues it on its participant's route with queueJob, handed to a Bridge at once where the route is one; a route that does not answer leaves the
// job queued, and is named.
//
// Module: MOD-implementation-pages
//
// NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED; NO JOB STARTS ABOVE THE WORK-IN-PROGRESS LIMIT; A TIME BOX WORKS ONLY ON WHAT WAS SELECTED FOR IT; A JOB GOES ONLY TO A HOLDER OF ITS ROLE; THE PAGE NAMES WHERE IT SENDS;
// ONE CLICK PER DECISION. A render writes nothing and sends nothing: *Start jobs* and *Merge* are the writes, each on a person's click. Readings the texts leave open, which this file takes:
//   - In a model that works from a backlog, the items, their states, their holds and the teams' running sprints are those of the backlog's view of the head (backlog.mjs' viewOf: MOD-progress-measures' storedView,
//     else the view derived in the page from the facts of the scope `work`). Besides it the route reads, at the view's commit and in one batch, the declaration, the role assignments and the running sprints' records,
//     and the workflow the declaration declares with MOD-product-process' workflowOf (plan.mjs' declaredWorkflowOf), from the declared model's file at the commit the declaration names and the files of the practices it
//     names at that commit, as the route `process` builds it; the instance's SPEC is not read for it, so a gate a process requirement adds keeps its source null (`addedBy.source`), which this route does not show. While the head's view is not stored yet, the route draws the items with their states from the view stored last, with the line naming its commit, and offers no
//     *Start jobs*. In a model that plans its work, the steps are those of the facts of the scope `work`, as the route `plan` reads them.
//   - An item is listed in every state but done; the startable ones are ticked, the others carry their reasons and cannot be ticked.
//   - The implementing roles are those of the phases that produce MOD; the item's role assignment is its team's — the team whose running sprint selects it —, else the product's first.
//   - Who merges is the parameter `merges` (`agent` or `person`) of the job's `## Parameters`, chosen when the jobs are started; acting on it is the merge's.
//   - What is sent where is drawn from prepareJob's destinations and parts, in the page's own list, with no second Run: *Start jobs* is the one click.
//   - A pull request is of a job the page started when its description has the line `Job: <id>` (MOD-runtimes' writer writes it) and `<id>` is a record of kind implement or refactor under docs/jobs/. The page lists the
//     open pull requests only and reads the records they name, in one batch; for each it shows the CI runs of the first commit and of the head, and whether the Definition of Done holds: the result of the head's check
//     `agent-m done` among the checks pullRequestFacts gives, linked. *Merge* is offered for a pull request that is no draft and whose head passed that check, and calls mergePullRequest on the head the page read.
//   - A ready item or step whose state carries a reason shows it in its State cell, in <p data-returned>: the reason of an item a rejected gate returned (UC-034 7a). The reason is the state's own, passed on unchanged.
//   - Where the repositoryInfo the page reads gives greenToMerge false, the head of the page says that the server does not enforce "merge only on green" and links webLinks' branchProtection (UC-024 12a).

import { kindOf } from "../job-catalogue/index.mjs";
import { listJobs, newJobId } from "../job-ledger/index.mjs";
import { prepareJob } from "../job-runner/index.mjs";
import { eligible } from "../participant-list/index.mjs";
import { readDocument } from "../documents/index.mjs";
import { declarationSchema, holdsRole, roleAssignmentSchema } from "../product-process/index.mjs";
import { productFacts } from "../progress-measures/index.mjs";
import { queueJob, routesFor } from "../runtimes/index.mjs";
import { explain as frameExplain } from "../site-frame/index.mjs";
import { planSchemas, startable, targetBranch } from "../work-plans/index.mjs";
import { connectionsOf, contextOf, participantsIn, personOf, placesOf, viewOf } from "./backlog.mjs";
import { declaredWorkflowOf } from "./plan.mjs";
import { asOfLine, jobHref } from "./progress.mjs";
import { heads } from "./routes.mjs";

const WORKFLOWS = [".github/workflows/agent-m-jobs.yml", ".gitlab/agent-m-jobs.yml"];
const DECLARATION = "docs/process.md";
const ASSIGNMENT_FILE = /^docs\/role-assignments\/([^/]+)\.md$/;
const JOB_FILE = /^docs\/jobs\/(JOB-[^/]+)\.md$/;
// The kinds of job that implement, whose pull requests the page shows, and the check of the product's CI whose result is whether the Definition of Done holds (MOD-workflow-entries' onDoneCheck).
const IMPLEMENTING = new Set(["implement", "refactor"]);
const DONE_CHECK = "agent-m done";

const text = (value) => (typeof value === "string" ? value : value === null || value === undefined ? "" : String(value));
const h = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const explain = (html) => `<details class="explain"><summary>What is this?</summary><div>${html}</div></details>`;
const recordRoute = (route) => (route.kind === "tab" ? "tab" : route.kind === "ci" ? (route.runner === "hosted" ? "ci hosted" : `ci runner:${route.runner}`) : `bridge ${route.bridge}`);

// Why a ready item or step returned (UC-034 7a, UC-024 10a): the reason its state carries — a rejected gate's End, as MOD-work-plans' itemStates passes it on —, drawn beside its state. A state with no reason, or not ready, draws none.
const returnedBy = (state) => (state?.state === "ready" && text(state.reason) ? `<p class="small" data-returned>${h(state.reason)}</p>` : "");

// The phases that produce MOD are the implementing ones, and their roles the implementing roles (as MOD-work-plans' startable reads them).
const implementingRoles = (workflow) => {
  const names = new Set((workflow?.phases ?? []).filter((phase) => (phase.produces ?? []).includes("MOD")).flatMap((phase) => phase.roles ?? []));
  return (workflow?.roles ?? []).filter((role) => names.has(role.name));
};

// The Bridges a participant's route names, as the tab holds them.
const bridgesOf = (participants, store) => connectionsOf(participants, store).bridges;

// What one startable item shows: the holders that can implement, and for the chosen one what is sent where.
async function sentFor(prepare, participant) {
  const prepared = await prepare(participant);
  const sent = prepared.destinations.map((destination) => `${h(destination.participant.name)} at ${h(destination.place ?? "no declared place")}: ${destination.parts.map(h).join(", ") || "nothing"}`);
  const blocking = prepared.blocking.map((found) => `${h(found.what)}`);
  return { prepared, html: `<ul>${sent.map((line) => `<li>${line}</li>`).join("")}</ul>${blocking.length ? `<p class="warn">${blocking.join("; ")}</p>` : ""}<p class="small">Correction rounds: at most ${h(prepared.limit)}</p>` };
}

// The page's head: the title, the folded explanation of the route the product's model prescribes (UC-024 step 1), and the part given.
function headOf(target, body, note = "Ready backlog items are handed to coding agents, one job per item (UC-034).") {
  target.innerHTML = `<section class="panel head"><h2>Implement</h2><div data-route-explain></div>${explain(`<p>${note}</p>`)}${body}</section>`;
  target.querySelector("[data-route-explain]")?.append(frameExplain("implementation-route"));
}

// Of the holders of a role, those the job can go to and those a linked source forbids (UC-024 5b): a holder is withheld where preparing the job for it finds that a source whose content the job includes does not permit its place;
// what is said of it is that finding's words, which name the source and the place. A job that cannot be prepared is not judged here: the holder stays, and the page shows the failure where it shows what is sent.
async function placed(holders, prepare) {
  const offered = [], withheld = [];
  for (const participant of holders) {
    try {
      const forbidden = (await prepare(participant)).blocking.filter((found) => found.rule === "RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS");
      if (forbidden.length) withheld.push({ participant, said: forbidden.map((found) => found.what) });
      else offered.push(participant);
    } catch {
      offered.push(participant);
    }
  }
  return { offered, withheld };
}

// What starting a job needs, whichever the part of the page: the page's context and facts, the participants, and what the product allows of a route.
const agentMOf = (snapshot) => ({ version: snapshot.commit ?? "unknown", commit: snapshot.commit ?? "unknown" });
function jobContextOf(m, definition, params) {
  return { kind: definition, params, product: { address: m.ctx.snapshot.repository?.web ?? m.context.product.address, snapshot: m.ctx.snapshot, host: m.context.product.host },
    instance: { snapshot: m.instanceSnapshot, host: m.context.instance.host, checkout: null }, connect: async () => m.context.product.host, participants: m.participants, places: m.places, gates: [],
    person: personOf(m.context), now: new Date(), agentM: agentMOf(m.instanceSnapshot), jobId: null };
}
const prepareFor = (m, definition, params, participant) => prepareJob(definition.name, jobContextOf(m, definition, params), { drafter: participant, reviewers: [] });

// One job: its start record written and queued on the participant's route with queueJob, handed to a Bridge at once where the route is one. A failure carries the job it was for (`failure.job`).
async function startJob(m, { definition, worksOn, participant, params, limit = null }) {
  const job = { kind: definition.name, participant: participant.name };
  try {
    const offer = routesFor(participant, m.participants, m.productInfo, []).find((each) => each.available);
    if (!offer) throw new Error(`${participant.name} has no route a job can take`);
    const bridge = offer.route.kind === "bridge" ? bridgesOf([participant], m.context.store)[offer.route.bridge] : undefined;
    if (offer.route.kind === "bridge" && !bridge) throw new Error(`The Bridge ${offer.route.bridge} is not connected in this browser, so the job cannot be handed to it`);
    const prepared = await prepareFor(m, definition, params, participant);
    const id = newJobId(new Date(), m.taken);
    m.taken.add(id);
    job.id = id;
    const record = { id, kind: definition.name, worksOn, participant: participant.name, model: participant.model, route: recordRoute(offer.route), run: null, retries: null, startedBy: personOf(m.context), start: new Date(),
      agentM: agentMOf(m.instanceSnapshot), inputs: prepared.parts.map((part) => part.name), limit: limit ?? prepared.limit,
      destinations: prepared.destinations.map((each) => ({ participant: each.participant.name, place: each.place, parts: each.parts })), params };
    const defaultBranch = (await m.context.product.host.repositoryInfo()).defaultBranch;
    const head = (await m.context.product.host.readSnapshot(defaultBranch)).commit;
    const queued = await queueJob(m.context.product.host, record, offer.route, head, bridge);
    return { id, path: queued.path, route: recordRoute(offer.route) };
  } catch (failure) {
    throw Object.assign(failure, { job });
  }
}

// The phase each step is in, by the plan's order (a row of the order document names a step and its phase).
const phasesOf = (order) => new Map((order?.sections ?? []).flatMap((section) => section.rows ?? []).map((row) => [text(row.cells?.Step), text(row.cells?.Phase)]));

// For a model that plans its work (UC-024 steps 1 to 3): the steps of the plan in their order, each with its derived state and its phase; the ready, startable steps of the current phase ticked, the others
// not selectable, with their reasons. The jobs' participants and *Start jobs* are not on this part of the page.
async function drawPlan(target, context, facts, ctx, participants, workflow, m) {
  if (facts.plan.items.length === 0) {
    headOf(target, `<p class="warn" data-missing>This product has no implementation plan yet, so there is nothing to start. <a href="#plan">Plan the implementation</a>; the process is declared on <a href="#process">How this product is developed</a>.</p>`,
      "A model that plans its work implements the steps of its implementation plan.");
    return;
  }
  const phases = phasesOf(facts.plan.order);
  const assignment = ctx.assignments[0] ?? null;
  const states = facts.plan.states;
  const rows = states.map((state) => ({ state, phase: phases.get(state.item) ?? "", verdict: startable(state.item, states, { workflow, assignment, sprint: null, held: [], wip: null, participants }) }));
  const current = rows.find((row) => row.state.state !== "done")?.phase ?? null;
  const preselected = (row) => row.verdict.startable && row.state.state === "ready" && row.phase === current;
  headOf(target, rows.length === 0 ? "" : `<table class="list"><thead><tr><th></th><th>Step</th><th>Phase</th><th>State</th><th>Why not</th></tr></thead><tbody>${rows.map((row) => `
    <tr data-step="${h(row.state.item)}" data-state="${h(row.state.state)}" data-phase="${h(row.phase)}"><td data-label=""><input type="checkbox" data-select-step aria-label="Select ${h(row.state.item)}"${row.verdict.startable ? "" : " disabled"}${preselected(row) ? " checked" : ""}></td>
    <td data-label="Step">${h(row.state.item)}</td><td data-label="Phase">${h(row.phase)}</td><td data-label="State"><span class="badge">${h(row.state.state)}</span>${returnedBy(row.state)}</td>
    <td data-label="Why not">${row.verdict.startable ? "" : `<ul data-reasons>${row.verdict.reasons.map((reason) => `<li>${h(reason)}</li>`).join("")}</ul>${row.verdict.reasons.some((reason) => /^No job can implement/.test(reason)) ? `<p data-none-of="${h(row.state.item)}">No participant can write and run tests. <a href="#participants">Declare a participant with the capabilities</a>; a model endpoint can draft a decision, not implement it.</p>` : ""}`}</td></tr>`).join("")}</tbody></table>
    <p data-selected></p><div data-jobs></div><p><button type="button" class="btn" data-start-jobs>Start jobs</button></p><div data-start-result></div>`, "A model that plans its work implements the steps of its implementation plan, in the plan's order.");
  // A box is ticked by its property; a document that does not keep the property is read by the attribute the page wrote.
  const isTickedBox = (box) => box.getAttribute("disabled") === null && (box.checked === undefined ? box.getAttribute("checked") !== null : box.checked === true);
  const count = () => {
    const n = target.querySelectorAll("[data-select-step]").filter(isTickedBox).length;
    const out = target.querySelector("[data-selected]");
    if (out) out.textContent = `${n} step${n === 1 ? "" : "s"} selected`;
    return drawJobs();
  };

  // UC-024 steps 5 and 6 for the selected steps: the holders of the implementing role that can write and run tests, with where each processes data; the attempt limit, who merges, refactoring; the target
  // branch, the gates from the step's phase on, and what is sent where. Nothing is sent: *Start jobs* is the one click.
  const definitions = { implement: await kindOf("implement"), refactor: await kindOf("refactor") };
  const roles = implementingRoles(workflow);
  const phaseNames = (workflow?.phases ?? []).map((phase) => phase.name);
  const branchOf = (step) => targetBranch(step, { sprints: facts.sprints ?? [], order: facts.plan.order ?? null, branches: workflow?.branches ?? {}, defaultBranch: m.defaultBranch });
  const gatesOf = (phase) => (workflow?.gates ?? []).filter((gate) => phaseNames.indexOf(gate.from) >= phaseNames.indexOf(phase)).map((gate) => `${h(gate.name)} (decided by ${h(gate.decider)})`);
  const holdersFor = () => eligible(participants.filter((participant) => assignment && roles.some((role) => holdsRole(assignment, participant.name, role.name))), { capabilities: definitions.implement.needs }).eligible;
  const jobBox = target.querySelector("[data-jobs]");
  const choice = (step, attribute) => target.querySelector(`[data-${attribute}-of="${step}"]`);
  async function drawJobs() {
    if (!jobBox) return;
    const boxes = target.querySelectorAll("[data-select-step]");
    const steps = rows.filter((row, at) => row.verdict.startable && isTickedBox(boxes[at]));
    const capable = holdersFor();
    const placedBy = new Map();
    for (const row of steps) placedBy.set(row.state.item, await placed(capable, (participant) => prepareFor(m, definitions.implement, { steps: [row.state.item] }, participant)));
    const holdersOf = (step) => placedBy.get(step).offered;
    jobBox.innerHTML = steps.map((row) => {
      const step = row.state.item;
      const { offered: holders, withheld } = placedBy.get(step);
      const withheldText = withheld.length ? `<p class="warn small" data-withheld-of="${h(step)}">${withheld.map(({ said }) => said.map(h).join("; ")).join("; ")}</p>` : "";
      return capable.length === 0
        ? `<div data-job-of="${h(step)}"><h3>${h(step)}</h3><p class="warn" data-none-of="${h(step)}">No participant can write and run tests, so ${h(step)} cannot start. <a href="#participants">Declare a participant with the capabilities</a>; a model endpoint can draft a decision, not implement it.</p></div>`
        : holders.length === 0
        ? `<div data-job-of="${h(step)}"><h3>${h(step)}</h3><p class="warn" data-none-of="${h(step)}">No holder of the implementing role is at a place the linked sources permit for this job, so ${h(step)} cannot start.</p>${withheldText}</div>`
        : `<div data-job-of="${h(step)}"><h3>${h(step)}</h3>
          <label>Participant <select data-participant-of="${h(step)}">${holders.map((participant) => `<option value="${h(participant.name)}">${h(participant.name)}</option>`).join("")}</select></label>
          ${withheldText}
          <p class="small" data-places-of="${h(step)}">${holders.map((participant) => `${h(participant.name)} processes data at ${h(participant.place ?? "no declared place")}`).join("; ")}</p>
          <label>Attempt limit <input type="number" data-limit-of="${h(step)}" value="${h(definitions.implement.limit)}"></label>
          <label>Merges <select data-merges-of="${h(step)}"><option value="agent">the coding agent</option><option value="person">a person</option></select></label>
          <label><input type="checkbox" data-refactor-of="${h(step)}"> Refactoring: structure changes, behaviour does not</label>
          <p class="small" data-branch-of="${h(step)}">Target branch: ${h(branchOf(step))}</p>
          <p class="small" data-gates-of="${h(step)}">${gatesOf(row.phase).length ? `Gates: ${gatesOf(row.phase).join(", ")}.` : "No gate stands after this phase."}</p>
          <div data-sent-of="${h(step)}"></div></div>`;
    }).join("");
    for (const row of steps) {
      const step = row.state.item;
      const sent = target.querySelector(`[data-sent-of="${step}"]`);
      const draw_ = async () => {
        const participant = holdersOf(step).find((each) => each.name === choice(step, "participant")?.value) ?? holdersOf(step)[0];
        if (!participant || !sent) return;
        const kind = choice(step, "refactor")?.checked === true ? "refactor" : "implement";
        try {
          const prepared = await prepareFor(m, definitions[kind], { steps: [step] }, participant);
          sent.innerHTML = `<ul>${prepared.destinations.map((each) => `<li>${h(each.participant.name)} at ${h(each.place ?? "no declared place")}: ${each.parts.map(h).join(", ") || "nothing"}</li>`).join("")}</ul>${prepared.blocking.length ? `<p class="warn">${prepared.blocking.map((found) => h(found.what)).join("; ")}</p>` : ""}`;
        } catch (failure) { sent.innerHTML = `<p class="warn">${h(failure?.message ?? failure)}</p>`; }
      };
      await draw_();
      for (const attribute of ["participant", "refactor"]) choice(step, attribute)?.addEventListener("change", draw_);
    }
  }
  await count();
  target.querySelectorAll("[data-select-step]").forEach((box) => box.addEventListener("change", count));
  target.querySelector("[data-start-jobs]")?.addEventListener("click", async (event) => {
    if (event?.isTrusted === false) return;
    const out = target.querySelector("[data-start-result]");
    const steps = rows.filter((row) => row.verdict.startable && target.querySelector(`[data-job-of="${row.state.item}"]`) && choice(row.state.item, "participant"));
    if (steps.length === 0) { out.innerHTML = `<p class="warn">No selected step can start: nothing starts.</p>`; return; }
    const holders = holdersFor();
    const lines = [];
    for (const row of steps) {
      const step = row.state.item;
      const kind = choice(step, "refactor")?.checked === true ? "refactor" : "implement";
      const participant = holders.find((each) => each.name === choice(step, "participant")?.value) ?? holders[0];
      try {
        const started = await startJob(m, { definition: definitions[kind], worksOn: [step], participant, limit: Number(choice(step, "limit")?.value) || definitions.implement.limit,
          params: { steps: [step], merges: choice(step, "merges")?.value ?? "agent", ...(kind === "refactor" ? { refactoring: true } : {}) } });
        lines.push(`<li>${h(step)}: job ${h(started.id)} (<code>${h(started.path)}</code>) is queued on the route ${h(started.route)}.</li>`);
      } catch (failure) {
        if (failure?.name === "PermissionMissing") {
          const actions = (typeof context.product.host.webLinks === "function" ? context.product.host.webLinks()?.actions : null) ?? `${context.product.address.replace(/\/$/, "")}/actions`;
          lines.push(`<li class="warn">${h(step)}: the token may not start workflows. <a data-run-workflow href="${h(actions)}">Open the workflow's Run workflow page</a> and start it there with the inputs job ${h(failure.job?.id ?? "")}, kind ${h(failure.job?.kind ?? kind)}, participant ${h(participant.name)}.</li>`);
        } else lines.push(`<li class="warn">${h(step)}: ${h(failure?.name === "WorkflowMissing" ? `the job workflow is missing (${(failure.files ?? []).join(", ")})` : failure?.message ?? failure)}; ${failure?.queued ? `its start record is committed and stays queued` : "nothing was started for it"}.</li>`);
      }
    }
    out.innerHTML = `<ul>${lines.join("")}</ul>`;
  });
}

// A box is ticked by its property; a document that does not keep the property is read by the attribute the page wrote.
const isTicked = (box) => box !== null && box !== undefined && (box.checked === undefined ? box.getAttribute("checked") !== null : box.checked === true);

// What starting jobs needs of the page: its context and facts, the participants, what the product allows of a route, and the job identifiers taken.
async function machineryFor(context, ctx, instanceSnapshot, participants) {
  const info = await context.product.host.repositoryInfo();
  const places = { ...(await placesOf(instanceSnapshot, ctx.snapshot.repository?.web ?? context.product.address)), mailbox: null };
  return { context, ctx, instanceSnapshot, participants, places, info, defaultBranch: info.defaultBranch, productInfo: { visibility: info.visibility, jobWorkflow: WORKFLOWS.some((path) => ctx.snapshot.paths.includes(path)) },
    taken: new Set(ctx.snapshot.paths.map((path) => JOB_FILE.exec(path)?.[1]).filter(Boolean)) };
}

// UC-024 12a: where repositoryInfo gives greenToMerge false — the server merges into the default branch without waiting for its required checks —, the head of the page says so and links the server's page on which
// that rule is set (MOD-repository-hosts' WebLinks `branchProtection`). Where it is true, or null because the token may not read the rule, nothing is said. No request is made: `info` is the answer the page read.
function noteGreenToMerge(target, info, host) {
  if (info?.greenToMerge !== false) return;
  const page = typeof host?.webLinks === "function" ? host.webLinks()?.branchProtection ?? null : null;
  const note = document.createElement("p");
  note.className = "warn";
  note.setAttribute("data-green-to-merge", "");
  note.innerHTML = `The server does not enforce "merge only on green": it lets a pull request into the default branch before its checks have passed.${page ? ` <a href="${h(page)}">Require the checks on the server's page for branch protection</a>.` : ""} Agent M still merges a job's pull request only once its CI is green and the Definition of Done holds.`;
  const head = target.querySelector("section");
  if (head) head.append(note);
  else target.append(note);
}

// The runs of one commit, each as a link to its page with its state; "no run listed" where the server lists none.
async function runsOf(host, commit) {
  const runs = commit ? await host.listCiRuns({ commit }) : [];
  return runs.length ? runs.map((run) => `<a href="${h(run.url)}">run ${h(run.id)}</a> ${h(run.state)}`).join(", ") : "no run listed";
}

// Whether the Definition of Done holds on a pull request's head: the result of the check `agent-m done` among its checks, linked to its run.
function doneLine(checks) {
  const done = (checks ?? []).find((check) => check.name === DONE_CHECK) ?? null;
  const run = done ? `<a href="${h(done.url)}">${h(DONE_CHECK)}</a>` : "";
  if (done?.state === "success") return { holds: true, html: `<p data-done data-holds="true">The Definition of Done holds: ${run} passed on the head.</p>` };
  return { holds: false, html: done ? `<p class="warn" data-done data-holds="false">The Definition of Done does not hold: ${run} is ${h(done.state)} on the head.</p>`
    : `<p class="warn" data-done data-holds="false">The Definition of Done is not checked on the head yet: no run of ${h(DONE_CHECK)} is listed.</p>` };
}

// The open pull requests of the jobs this page started (UC-024 steps 11 to 13): the open pull requests are listed, the records of the jobs they name read in one batch from `snapshot`; each pull request of a job
// that implements is shown with its branch, the CI runs of its first (tests-only) commit and of its head, whether the Definition of Done holds, and *Merge* once it does, on the head read. A pull request that cannot be
// read is named, not left out. A merged one stands on its job's page (MOD-main-page, route `job`).
async function drawPulls(target, context, snapshot) {
  const host = context.product.host;
  let open;
  try {
    open = await host.listPullRequests({ state: "open" });
  } catch (failure) {
    if (failure?.name === "NotSupported") return;
    throw failure;
  }
  const named = open.map((pull) => ({ pull, id: /^Job: (\S+)/m.exec(pull.body ?? "")?.[1] })).filter((each) => each.id);
  const paths = [...new Set(named.map((each) => `docs/jobs/${each.id}.md`))].filter((path) => snapshot.paths.includes(path));
  if (paths.length === 0) return;
  await snapshot.readMany?.(paths);
  const records = (await listJobs([{ address: snapshot.repository?.web ?? context.product.address, snapshot: { ...snapshot, paths } }], new Map())).map((row) => row.record);
  const jobs = new Map(records.filter((record) => IMPLEMENTING.has(record.kind)).map((record) => [record.id, record]));
  const own = named.map(({ pull, id }) => ({ pull, job: jobs.get(id) })).filter((each) => each.job);
  if (own.length === 0) return;
  const parts = [], mergeable = [];
  for (const { pull, job } of own) {
    try {
      const read = await host.pullRequestFacts(pull.number);
      const first = read.commits[0], last = read.commits.at(-1);
      const ci = `<ul><li data-ci="first">${first === last ? "The only commit" : "The first commit, with the tests only,"} <code>${h(first?.sha.slice(0, 7) ?? "none")}</code>: ${await runsOf(host, first?.sha)}</li>
        ${first === last ? "" : `<li data-ci="last">The head <code>${h(last?.sha.slice(0, 7) ?? "none")}</code>: ${await runsOf(host, last?.sha)}</li>`}</ul>`;
      const shown = `<h4>#${h(pull.number)} ${h(pull.title)}</h4><p class="small">Job ${h(job.id)}; branch <code>${h(pull.branch)}</code> into <code>${h(pull.base)}</code>; head <code>${h(read.pullRequest.head.slice(0, 7))}</code>.</p>${ci}`;
      const done = doneLine(read.checks);
      const offered = done.holds && !pull.draft;
      if (offered) mergeable.push({ number: pull.number, head: read.pullRequest.head });
      parts.push(`<div data-pull="${h(pull.number)}" data-state="open">${shown}
        ${done.html}
        ${pull.draft ? `<p class="warn">The pull request is a draft.</p>` : ""}
        ${offered ? `<p><button type="button" class="btn" data-merge-pull="${h(pull.number)}">Merge</button></p>` : ""}<p data-merge-result></p></div>`);
    } catch (failure) {
      parts.push(`<div data-pull="${h(pull.number)}"><h4>#${h(pull.number)} ${h(pull.title)}</h4><p class="warn">${h(failure?.message ?? failure)}</p></div>`);
    }
  }
  const section = document.createElement("section");
  section.className = "panel";
  section.setAttribute("data-pulls", "");
  section.innerHTML = `<h3>Pull requests of the jobs</h3>${explain(`<p>CI runs the tests on every push, and its check <code>${h(DONE_CHECK)}</code> decides on the head whether the pull request meets the product's Definition of Done. <em>Merge</em> is offered once it passed, and merges only while the head is the one shown (UC-024 steps 11 to 13). A merged pull request stands on its job's page.</p>`)}${parts.join("")}`;
  target.append(section);
  for (const { number, head } of mergeable) {
    const button = section.querySelector(`[data-merge-pull="${number}"]`);
    button?.addEventListener("click", async (event) => {
      if (event?.isTrusted === false) return;
      const out = section.querySelector(`[data-pull="${number}"]`)?.querySelector("[data-merge-result]");
      try {
        const merged = await host.mergePullRequest(number, head);
        out.textContent = `Merged as ${String(merged.commit).slice(0, 7)}.`;
        button.setAttribute("disabled", "");
      } catch (failure) {
        out.textContent = `Not merged: ${failure?.reason ?? failure?.message ?? failure}`;
      }
    });
  }
}

// What `startable` takes besides the view, read at the view's commit: the declaration, the role assignments and the running sprints' records in one batch, and the workflow the declaration
// declares (plan.mjs' declaredWorkflowOf; neither startable nor this route reads a gate's `addedBy.source`). -> { declaration, assignments, sprints: Map(path -> record), workflow }
async function judgedBy(context, snapshot, view) {
  const assignmentPaths = snapshot.paths.filter((path) => ASSIGNMENT_FILE.test(path)).sort();
  const sprintPaths = view.teams.map((team) => team.running?.path).filter((path) => path && snapshot.paths.includes(path));
  await snapshot.readMany?.([DECLARATION, ...assignmentPaths, ...sprintPaths].filter((path) => snapshot.paths.includes(path)));
  const declared = await snapshot.read(DECLARATION);
  const declaration = declared === null ? null : readDocument(declarationSchema, DECLARATION, declared);
  const assignments = await Promise.all(assignmentPaths.map(async (path) => readDocument(roleAssignmentSchema, path, (await snapshot.read(path)) ?? "")));
  const sprints = new Map(await Promise.all(sprintPaths.map(async (path) => [path, readDocument(planSchemas.sprint, path, (await snapshot.read(path)) ?? "")])));
  const workflow = declaration === null ? null : await declaredWorkflowOf(context, declaration);
  return { declaration, assignments, sprints, workflow };
}

// The role assignment and the running sprint of an item: its team's — the team whose running sprint selects it —, else the product's first assignment with its team's running sprint.
function placeOf(view, judged, id) {
  const selecting = view.teams.find((team) => team.running?.selection.includes(id)) ?? null;
  const first = judged.assignments[0] ?? null;
  const team = selecting?.team ?? (first ? ASSIGNMENT_FILE.exec(first.path)?.[1] : null) ?? null;
  const assignment = selecting ? judged.assignments.find((each) => ASSIGNMENT_FILE.exec(each.path)?.[1] === team) ?? null : first;
  const running = view.teams.find((each) => each.team === team)?.running ?? null;
  return { team, assignment, sprint: running ? judged.sprints.get(running.path) ?? null : null };
}

async function draw(target, context, params) {
  const { product, instance } = context;
  const backlog = await viewOf(context);
  const { view, snapshot } = backlog;
  if (!view.declared || view.modelUnread || !view.model) {
    headOf(target, `<p class="warn" data-missing>${!view.declared ? "No process model is declared for this product" : "The declared process model could not be read"}, so there is nothing to start. <a href="#process">Declare or open the process</a>; the plan or the backlog follows it (<a href="#plan">plan</a>, <a href="#backlog">backlog</a>).</p>`);
    return;
  }
  const instanceSnapshot = await instance.host.readSnapshot((await instance.host.repositoryInfo()).defaultBranch);
  const participants = await participantsIn(context);
  if (view.model.kind !== "pulled") {
    const facts = backlog.facts ?? await productFacts(product.host, instanceSnapshot, (commit) => instance.host.readSnapshot(commit), new Date(), { scope: "work" });
    const ctx = await contextOf(context, facts);
    const m = await machineryFor(context, ctx, instanceSnapshot, participants);
    await drawPlan(target, context, facts, ctx, participants, facts.workflow !== "unknown" ? facts.workflow : null, m);
    noteGreenToMerge(target, m.info, product.host);
    await drawPulls(target, context, facts.snapshot);
    return;
  }
  const head = (body) => headOf(target, `<p data-backlog-link>This model works from a backlog: <a href="#backlog">open the backlog</a>.</p>${backlog.asOf ? asOfLine(backlog.asOf) : ""}${body}`);
  const asked = text(params?.sprint);
  const chosenSprint = asked ? view.teams.map((team) => team.running).find((running) => running?.path.endsWith(`/${asked}.md`)) ?? null : null;
  const items = view.rows.filter((row) => (chosenSprint ? chosenSprint.selection.includes(row.item) : true)).filter((row) => row.state.state !== "done");

  // While the head's view is being stored, the items stand with their states as the view stored last gives them, and no job is started from it.
  if (backlog.asOf) {
    head(items.length === 0 ? `<p>No item is waiting to be implemented.</p>` : `<table class="list"><thead><tr><th>Item</th><th>State</th></tr></thead><tbody>${items.map((row) => `
      <tr data-item="${h(row.item)}" data-state="${h(row.state.state)}"><td data-label="Item">${h(row.item)}</td><td data-label="State"><span class="badge">${h(row.state.state)}</span>${returnedBy(row.state)}</td></tr>`).join("")}</tbody></table>
      <p class="muted small">Jobs are started on the view of the newest commit, which is being stored: open the page again in a moment.</p>`);
    await drawPulls(target, context, snapshot);
    return;
  }
  const judged = await judgedBy(context, snapshot, view);
  const { workflow } = judged;
  if (judged.declaration === null || workflow === null) {
    head(`<p class="warn">No process model is declared for this product, so there is nothing to implement from. <a href="#process">Declare one</a>.</p>`);
    return;
  }
  const states = view.rows.map((row) => row.state);
  const held = view.rows.map((row) => row.held).filter(Boolean);
  const definition = await kindOf("implement");
  const info = await product.host.repositoryInfo();
  const productInfo = { visibility: info.visibility, jobWorkflow: WORKFLOWS.some((path) => snapshot.paths.includes(path)) };

  const places = { ...(await placesOf(instanceSnapshot, snapshot.repository?.web ?? product.address)), mailbox: null };
  const now = () => new Date();
  const jobContextFor = (id, merges) => ({ kind: definition, params: { items: [id], merges }, product: { address: snapshot.repository?.web ?? product.address, snapshot, host: product.host },
    instance: { snapshot: instanceSnapshot, host: instance.host, checkout: null }, connect: async () => product.host, participants, places, gates: [], person: personOf(context),
    now: now(), agentM: { version: instanceSnapshot.commit ?? "unknown", commit: instanceSnapshot.commit ?? "unknown" }, jobId: null });
  const prepareFor = (id, merges) => (participant) => prepareJob("implement", jobContextFor(id, merges), { drafter: participant, reviewers: [] });
  const rows = [];
  for (const { item: id, state } of items) {
    const { assignment, sprint, team } = placeOf(view, judged, id);
    const verdict = startable(id, states, { workflow, assignment, sprint, held, wip: workflow.model?.flow?.wip ?? null, participants });
    const roles = implementingRoles(workflow);
    const holding = verdict.startable
      ? eligible(participants.filter((participant) => assignment && roles.some((role) => holdsRole(assignment, participant.name, role.name))), { capabilities: definition.needs }).eligible : [];
    const { offered: holders, withheld } = await placed(holding, prepareFor(id, "agent"));
    rows.push({ id, state, verdict, holders, withheld, team, sprint });
  }

  // The holders a linked source forbids, each with the finding's words naming the source and the place (UC-024 5b).
  const withheldText = (row) => (row.withheld.length ? `<p class="warn small" data-withheld-of="${h(row.id)}">${row.withheld.map(({ said }) => said.map(h).join("; ")).join("; ")}</p>` : "");
  const gatesText = (workflow?.gates ?? []).filter((gate) => implementingRoles(workflow).some((role) => (workflow.phases.find((phase) => phase.name === gate.from)?.roles ?? []).includes(role.name)))
    .map((gate) => `${h(gate.name)} (decided by ${h(gate.decider)})`);
  const body = rows.length === 0 ? `<p>No item is waiting to be implemented.</p>` : `<table class="list"><thead><tr><th></th><th>Item</th><th>State</th><th>Start</th></tr></thead><tbody>${rows.map((row) => `
    <tr data-item="${h(row.id)}" data-state="${h(row.state.state)}" data-startable="${row.verdict.startable}"><td data-label="">${row.verdict.startable ? `<input type="checkbox" data-start-item="${h(row.id)}"${params?.item && params.item !== row.id ? "" : " checked"} aria-label="Start ${h(row.id)}">` : ""}</td>
    <td data-label="Item">${h(row.id)}</td><td data-label="State"><span class="badge">${h(row.state.state)}</span>${returnedBy(row.state)}</td>
    <td data-label="Start">${row.verdict.startable ? (row.holders.length === 0 ? `<p class="warn" data-reasons>${row.withheld.length ? "No holder of the implementing role is at a place the linked sources permit for this job." : "No holder of the implementing role can write and run tests."}</p>${withheldText(row)}` : `
      <label>Participant <select data-participant-of="${h(row.id)}">${row.holders.map((participant) => `<option value="${h(participant.name)}">${h(participant.name)}</option>`).join("")}</select></label>
      ${withheldText(row)}
      <p class="small" data-holders>${row.holders.map((participant) => `${h(participant.name)} processes data at ${h(participant.place ?? "no declared place")}; routes: ${routesFor(participant, participants, productInfo, []).map((offer) => `${h(recordRoute(offer.route))}${offer.available ? "" : " (not available)"}`).join(", ") || "none"}`).join("<br>")}</p>
      <p class="small">Attempt limit: ${h(definition.limit)}. Merges: <select data-merges-of="${h(row.id)}"><option value="agent">the coding agent</option><option value="person">a person</option></select>.
        Target branch: ${h(targetBranch(row.id, { sprints: [...judged.sprints.values()], order: null, branches: workflow.branches ?? {}, defaultBranch: info.defaultBranch }))}. ${gatesText.length ? `Gates: ${gatesText.join(", ")}.` : "No gate stands before the merge."}</p>
      <div data-sent="${h(row.id)}"></div>`) : `<ul data-reasons>${row.verdict.reasons.map((reason) => `<li>${h(reason)}</li>`).join("")}</ul>`}</td></tr>`).join("")}</tbody></table>
    <p><button type="button" class="btn" data-start-jobs>Start jobs</button></p><div data-start-result></div>`;
  head(body);
  noteGreenToMerge(target, info, product.host);

  // What is sent where, for the participant chosen on each startable row: the job is prepared, nothing is sent.
  const taken = new Set(snapshot.paths.map((path) => JOB_FILE.exec(path)?.[1]).filter(Boolean));
  const choice = (id) => target.querySelector(`[data-participant-of="${id}"]`)?.value;
  const merges = (id) => target.querySelector(`[data-merges-of="${id}"]`)?.value ?? "agent";
  const drawSent = async (row) => {
    const place = target.querySelector(`[data-sent="${row.id}"]`);
    const participant = row.holders.find((each) => each.name === choice(row.id)) ?? row.holders[0];
    if (!place || !participant) return;
    try { place.innerHTML = (await sentFor(prepareFor(row.id, merges(row.id)), participant)).html; } catch (failure) { place.innerHTML = `<p class="warn">${h(failure?.message ?? failure)}</p>`; }
  };
  for (const row of rows.filter((each) => each.verdict.startable && each.holders.length)) {
    await drawSent(row);
    target.querySelector(`[data-participant-of="${row.id}"]`)?.addEventListener("change", () => drawSent(row));
  }

  target.querySelector("[data-start-jobs]")?.addEventListener("click", async (event) => {
    if (event?.isTrusted === false) return;
    const out = target.querySelector("[data-start-result]");
    const chosen = rows.filter((row) => row.verdict.startable && row.holders.length && isTicked(target.querySelector(`[data-start-item="${row.id}"]`)));
    if (chosen.length === 0) { out.innerHTML = `<p class="warn">No startable item is ticked: nothing starts.</p>`; return; }
    const lines = [];
    for (const row of chosen) {
      const participant = row.holders.find((each) => each.name === choice(row.id)) ?? row.holders[0];
      let id = null, routeName = null;
      try {
        const offer = routesFor(participant, participants, productInfo, []).find((each) => each.available);
        if (!offer) throw new Error(`${participant.name} has no route a job can take`);
        routeName = recordRoute(offer.route);
        const { prepared } = await sentFor(prepareFor(row.id, merges(row.id)), participant);
        id = newJobId(now(), taken);
        taken.add(id);
        const record = { id, kind: "implement", worksOn: [row.id], participant: participant.name, model: participant.model, route: recordRoute(offer.route), run: null, retries: null, startedBy: personOf(context), start: now(),
          agentM: { version: instanceSnapshot.commit ?? "unknown", commit: instanceSnapshot.commit ?? "unknown" }, inputs: prepared.parts.map((part) => part.name), limit: prepared.limit,
          destinations: prepared.destinations.map((each) => ({ participant: each.participant.name, place: each.place, parts: each.parts })), params: { items: [row.id], merges: merges(row.id) } };
        const defaultBranch = (await product.host.repositoryInfo()).defaultBranch;
        const head = (await product.host.readSnapshot(defaultBranch)).commit;
        const queued = await queueJob(product.host, record, offer.route, head, bridgesOf([participant], context.store)[offer.route.bridge]);
        lines.push(`<li>${h(row.id)}: job ${h(id)} (<code>${h(queued.path)}</code>) is queued on the route ${h(recordRoute(offer.route))}.</li>`);
      } catch (failure) {
        const said = failure?.name === "WorkflowMissing" ? `the job workflow is missing (${(failure.files ?? []).join(", ")})` : failure?.message ?? failure;
        // UC-034 4a: a start record committed before the route failed (queueOnBridge's `failure.queued`) is a job that stays queued; the route that did not answer is named, and the job's page (UC-036) cancels or reassigns it.
        lines.push(failure?.queued
          ? `<li class="warn" data-queued="${h(row.id)}">${h(row.id)}: job ${h(id)} (<code>${h(failure.queued.path)}</code>) stays queued on the route ${h(routeName)}, which did not answer: ${h(said)}. <a data-job-page href="${h(jobHref(context, id))}">Cancel or reassign it on its page</a>.</li>`
          : `<li class="warn">${h(row.id)}: ${h(said)}; nothing was started for it.</li>`);
      }
    }
    out.innerHTML = `<ul>${lines.join("")}</ul>`;
  });
  await drawPulls(target, context, snapshot);
}

export const route = {
  ...heads.implement,
  async render(target, context, params = {}) {
    try {
      await draw(target, context, params);
    } catch (failure) {
      target.innerHTML = `<section class="panel"><h2>Implement</h2><p class="warn">${h(failure?.message ?? failure)}</p></section>`;
    }
  },
};
