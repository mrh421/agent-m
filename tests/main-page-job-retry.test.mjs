// MOD-main-page's route `job` — *Retry* for a failed, cancelled or ended job (ITM-974), as the accepted text of docs/architecture/MOD-main-page.md (Interfaces: `job`; Responsibility) and UC-036 (step 7, 1c, 7a) state it: "*Retry* for a failed,
// cancelled or ended job whose step or item is still startable (MOD-work-plans' `startable` — otherwise the reasons are shown and nothing is queued, UC-036 7a), as a new job, with the same participant or another holder of its role on a
// route offered for it"; "Retrying a job that ran in a tab opens the prompt bar on this page with the job's kind and parameters: the route `job` gives the bar, for the retry, the subject (`MOD-prompt-bar.Subject`)".
// Run: node --test tests/main-page-job-retry.test.mjs
//
// Module: MOD-main-page
// Guards: UC-036; ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; A JOB GOES ONLY TO A HOLDER OF ITS ROLE; A JOB IDENTIFIER IS NEVER REUSED
// Level: unit
//
// The real MOD-job-ledger, MOD-runtimes, MOD-progress-measures, MOD-work-plans, MOD-product-process, MOD-repository-hosts, MOD-browser-store and MOD-site-frame run as they are; only `fetch` is faked: by tests/main-page-home-harness.mjs (the fake
// GitHub) and, over it, by this file, which serves the instance's commit that the product's declaration names, and the product's head commit, as the commit of the repository's `main`, and answers the writes of one commit to alice/product (the ref, the tree, the commit and
// the move of the ref), keeping what it was given. The product follows the scrum model (a sprint of team1 selecting ITM-0900; the role assignment of team1: Developers are dev-cli and dev-two); the instance's participants are dev-cli and dev-two (CLI agents
// on the Bridge lab-pc-4). No request leaves the fixtures; nothing sleeps.
//
// Readings the module file leaves open, which the tests state (the pull request names them):
//   - The page: <div class="job-retry"> holds, for a job whose state is failed, cancelled or ended without record, <select class="retry-participant"> (the participants for which startable admits every item the job works on; the job's own
//     participant among them, chosen first; for a job on no plan item, that participant alone), <select class="retry-route"> (the routes routesFor offers that participant, those available) and <button class="retry"> "Retry"; where no
//     participant is admitted, <ul class="retry-reasons"> with the reasons startable gives and no button. <p class="retry-result"> says what came of a click.
//   - A job that ran in a tab (its record's route is `tab`) is not queued: the person's click calls go("job", { id, product, retry: <kind> }) and the route's `subject` for those parameters is the bar's Subject — the job's kind, key `retry:<id>`,
//     and as its parameters those of the record. A job whose task travelled with its hand-over (TaskNotInRecord) gets the same button instead of Retry, <button class="retry-prompt-bar"> "Open the prompt bar".
//   - A confirmed Retry (MOD-site-frame's confirmDecision, its confirm button "Retry the job") calls retryJob with the chosen participant and route, on the head the facts were read at; the page says the new job's identifier.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { view } from "../src/main-page/index.mjs";
import { startRecord, appendToRecord } from "../src/job-ledger/index.mjs";
import { INSTANCE, PRODUCT, browser, byClass, draw, headOf, network, smallProduct, timers, withEnd } from "./main-page-home-harness.mjs";

const job = view.routes.find((candidate) => candidate.name === "job");
let ID = "JOB-20261016-1000-7e01";
let net;
afterEach(() => { net?.restore(); timers.restore(); document.body.replaceChildren(); });

const flush = async () => { for (let n = 0; n < 80; n += 1) await new Promise((resolve) => setImmediate(resolve)); };
const trusted = async (node) => { const event = new Event("click"); Object.defineProperty(event, "isTrusted", { value: true }); node.dispatchEvent(event); await flush(); };
const walk = (root, match) => { const found = []; (function visit(node) { for (const child of node.children ?? []) { if (typeof child === "string") continue; if (match(child)) found.push(child); visit(child); } })(root); return found; };
const one = (root, name) => byClass(root, name)[0];
const dialog = () => byClass(document.body, "decision")[0];
const inDialog = (text) => walk(dialog(), (node) => node.localName === "button" && node.textContent === text)[0];
const choose = (select, value) => { select.value = value; select.dispatchEvent(new Event("change")); };
const optionsOf = (select) => walk(select, (node) => node.localName === "option").map((node) => node.value);

const MODEL = headOf(INSTANCE);
const DECLARATION = ["---", "model: scrum", "model_file: src/model-catalogue/models/scrum.md", `model_version: ${MODEL}`, "---", "# Process", "", "## Practices", "", "- none", "", "## Branches", "",
  "| Phase or time box | Branch |", "|---|---|", "| Sprint | sprint/<team>/<nn> |", "", "## Definition of Done", "", "The job rules hold; no condition is added.", ""].join("\n");
const ASSIGNMENT = ["# Role assignment of the product", "", "## Roles", "", "| Role | Participants |", "|---|---|", "| Product Owner | alice |", "| Scrum Master | alice |", "| Developers | dev-cli, dev-two |", ""].join("\n");
const SPRINT = ["---", "sprint: 1", "goal: The fixture sprint", "start: 2026-10-12", "end: ", "closer: alice", "branch: ", "selection:", "  - ITM-0900", "---", "# team1 Sprint 01", ""].join("\n");
const REGISTER = ["# Participants of this instance", "", "**REGISTER**", "", "The people and agents of the fixture instance.", "",
  "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |", "|---|---|---|---|---|---|---|---|",
  "| alice | person | — | — | — | read the repository, write to the repository | — | account github.com/alice |",
  "| dev-cli | CLI agent | model-x | 200000 | — | read the repository, write to the repository, run code and tests | lab-pc-4 | bridge lab-pc-4 agent claude |",
  "| dev-two | CLI agent | model-y | 200000 | — | read the repository, write to the repository, run code and tests | lab-pc-4 | bridge lab-pc-4 agent codex |", ""].join("\n");

/** The job (dev-cli, ITM-0900) in the state given: failed, cancelled, ended without record (taken, no end, not listed by the Bridge), running (listed), done; `route` and `task` as the record writes them. */
function jobIn(state, { route = "bridge lab-pc-4", task = "in parameters" } = {}) {
  const { path, text } = startRecord({ id: ID, kind: "implement-item", worksOn: ["ITM-0900"], participant: "dev-cli", model: "model-x", route, run: null, retries: null, startedBy: "alice",
    start: new Date("2026-10-16T10:00:00Z"), agentM: { version: "2026.1.0", commit: "abc1234" }, inputs: [`docs/backlog/ITM-0900-work.md@${"b".repeat(40)}`], limit: 5, task, conversation: null, destinations: [], params: { item: "ITM-0900" } });
  const taken = appendToRecord(text, { part: "taken", at: new Date("2026-10-16T10:00:00Z"), by: route === "tab" ? "tab" : "lab-pc-4" });
  return { path, text: ["failed", "cancelled", "done"].includes(state) ? withEnd(taken, state) : taken };
}

/** The world: the product with the job, the declaration and the role assignment; the instance with its participants; the Bridge lab-pc-4 listing the job only when `listed`; the writes of one commit answered and kept. */
function world(given, { listed = false, assignment = ASSIGNMENT, declaration = DECLARATION, sprint = SPRINT, more = {} } = {}) {
  const files = { ...smallProduct({ jobs: [given] }), "docs/process.md": declaration, "docs/role-assignments/team1.md": assignment, "docs/backlog/sprints/team1/01.md": sprint, ...more };
  net = network({ [PRODUCT]: files, [INSTANCE]: { "SPEC.md": "# Instance — Specification\n", "docs/participants.md": REGISTER } }, { bridgeLists: listed ? ID : null });
  net.install();
  const seen = { trees: [], commits: [], moves: 0 };
  const inner = globalThis.fetch;
  const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input));
    const method = String(init.method ?? "GET").toUpperCase();
    if (url.host === "api.github.com" && url.pathname === `/repos/${PRODUCT}/commits/${headOf(PRODUCT)}`) return inner(new URL(`https://api.github.com/repos/${PRODUCT}/commits/main`), init);
    if (url.host === "api.github.com" && url.pathname === `/repos/${INSTANCE}/commits/${MODEL}`) return inner(new URL(`https://api.github.com/repos/${INSTANCE}/commits/main`), init);
    if (url.host === "api.github.com" && url.pathname.startsWith(`/repos/${PRODUCT}/git/`) && !url.pathname.includes("/git/trees/")) {
      if (method === "GET" && url.pathname.endsWith("/git/ref/heads/main")) return json({ object: { sha: headOf(PRODUCT) } });
      if (method === "GET" && url.pathname.includes("/git/commits/")) return json({ tree: { sha: "tree-1" } });
      if (method === "POST" && url.pathname.endsWith("/git/commits")) { seen.commits.push(JSON.parse(init.body)); return json({ sha: "commit-2" }); }
      if (method === "PATCH") { seen.moves += 1; return json({}); }
    }
    if (url.host === "api.github.com" && method === "POST" && url.pathname === `/repos/${PRODUCT}/git/trees`) { seen.trees.push(JSON.parse(init.body)); return json({ sha: "tree-2" }); }
    return inner(input, init);
  };
  return { seen, context: browser() };
}
const drawJob = async (context) => draw(job, context, { id: ID });
const use = (n) => { ID = `JOB-20261016-1000-7e0${n}`; };

// TST-974001 · level: unit · module: MOD-main-page
// guards: UC-036; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the job dev-cli worked on, in each of the states failed, cancelled, ended without record, running (the Bridge lists it) and done
// input: the route job drawn for each
// expect: a button Retry for failed, cancelled and ended without record, and none for running and done (counter-proof: Retry on a running job fails); nothing is written by drawing
test("TST-974001 Retry is offered for a failed, cancelled or ended job, and not for a running or a done one", async () => {
  const offered = {};
  const cases = [["failed", {}], ["cancelled", {}], ["ended without record", {}], ["running", { listed: true }], ["done", {}]];
  for (const [at, [state, options]] of cases.entries()) {
    use(at + 1);
    const { seen, context } = world(jobIn(state === "ended without record" || state === "running" ? "taken" : state), options);
    const target = await drawJob(context);
    assert.equal(one(target, "job-facts").textContent.includes(state), true, `${state}: the job is in that state`);
    offered[state] = walk(target, (node) => node.localName === "button" && node.textContent === "Retry").length === 1;
    assert.deepEqual(seen.trees, [], `${state}: nothing is written by drawing`);
    net.restore();
    document.body.replaceChildren();
  }
  assert.deepEqual(offered, { failed: true, cancelled: true, "ended without record": true, running: false, done: false });
});

// TST-974002 · level: unit · module: MOD-main-page
// guards: UC-036; A JOB GOES ONLY TO A HOLDER OF ITS ROLE; A JOB IDENTIFIER IS NEVER REUSED; ONE CLICK PER DECISION
// given: the failed job of dev-cli (scrum, team1's sprint selects ITM-0900; Developers are dev-cli and dev-two; Bridge routes for both)
// input: the route job drawn; the participants and routes offered; dev-two chosen; a click a script makes on Retry; the person's click, declined; the person's click, confirmed
// expect: the participants offered are dev-cli (first) and dev-two, and the route offered is `bridge lab-pc-4`; the script's click and the declined dialog write nothing; the confirmed one writes one commit with one new record under docs/jobs/ whose identifier is not the earlier job's, whose participant is dev-two, whose `retries` names the earlier job and whose inputs and parameters are the earlier job's; the page names the new job
test("TST-974002 one confirmed click retries the job with the chosen holder and route, and the new job names the earlier one", async () => {
  use(1);
  const { seen, context } = world(jobIn("failed"));
  const target = await drawJob(context);
  assert.deepEqual(optionsOf(one(target, "retry-participant")), ["dev-cli", "dev-two"]);
  choose(one(target, "retry-participant"), "dev-two");
  assert.deepEqual(optionsOf(one(target, "retry-route")), ["bridge lab-pc-4"]);
  const button = walk(target, (node) => node.localName === "button" && node.textContent === "Retry")[0];
  button.dispatchEvent(new Event("click"));
  await flush();
  assert.equal(dialog(), undefined);
  await trusted(button);
  await trusted(inDialog("Cancel"));
  assert.deepEqual(seen.trees, []);
  await trusted(button);
  await trusted(inDialog("Retry the job"));
  assert.equal(seen.trees.length, 1, one(target, "retry-result").textContent);
  assert.equal(seen.trees[0].tree.length, 1);
  const { path, content } = seen.trees[0].tree[0];
  assert.equal(/^docs\/jobs\/JOB-[^/]+\.md$/.test(path), true, path);
  assert.equal(path.includes(ID), false, "a new identifier");
  for (const line of [`retries: ${ID}`, "participant: dev-two", "docs/backlog/ITM-0900-work.md@", '"item": "ITM-0900"']) assert.equal(content.includes(line), true, `the new record holds ${line}`);
  assert.equal(one(target, "retry-result").textContent.includes(path.match(/(JOB-[^.]+)/)[1]), true);
});

// TST-974003 · level: unit · module: MOD-main-page
// guards: UC-036; A JOB GOES ONLY TO A HOLDER OF ITS ROLE
// given: the failed job of dev-cli, in a product whose work-in-progress limit is reached — here: whose role assignment names nobody for the role Developers
// input: the route job drawn
// expect: no button Retry; the page lists the reasons startable gives (naming the role), and nothing is written
test("TST-974003 where no holder may start the item, the reasons are shown and nothing is queued", async () => {
  use(3);
  const { seen, context } = world(jobIn("failed"), { assignment: ASSIGNMENT.replace("| Developers | dev-cli, dev-two |", "| Developers | nobody |") });
  const target = await drawJob(context);
  assert.deepEqual(walk(target, (node) => node.localName === "button" && node.textContent === "Retry"), []);
  const reasons = byClass(target, "retry-reason").map((node) => node.textContent);
  assert.equal(reasons.length >= 1, true);
  assert.equal(reasons.some((text) => /Developer|implementing role/.test(text)), true, reasons.join(" | "));
  assert.deepEqual(seen.trees, []);
});

// TST-974004 · level: unit · module: MOD-main-page
// guards: UC-036; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: a failed job that ran in a tab (its record's route is tab, taken by the tab)
// input: the route job drawn; the person's click on Retry; the route's subject for the parameters of the go() it made
// expect: nothing is queued or written; go("job", { id, product, retry: "implement-item" }) was called once; the route's subject for those parameters is the Subject of the bar, context only (it names no kind: the bar runs converse, which hands the retry on): key retry:<id>, no menu entry, and as parameters those of the record ({ item: "ITM-0900" }) beside a page that names the job and its kind implement-item; the route's subject for the parameters of an ordinary page is null
test("TST-974004 a job that ran in a tab opens the prompt bar with its kind and parameters, and queues nothing", async () => {
  use(4);
  const { seen, context } = world(jobIn("failed", { route: "tab" }));
  const target = await drawJob(context);
  const button = walk(target, (node) => node.localName === "button" && node.textContent === "Retry")[0];
  await trusted(button);
  assert.equal(dialog(), undefined);
  assert.deepEqual(seen.trees, []);
  assert.deepEqual(context.went, [["job", { id: ID, product: "https://github.com/alice/product", retry: "implement-item" }]]);
  const subject = job.subject(context.went[0][1], context);
  assert.deepEqual([subject.kind, subject.key, subject.entry], [undefined, `retry:${ID}`, null]);
  const { page, ...params } = subject.paramsFor({ name: "dev-cli" });
  assert.deepEqual(params, { item: "ITM-0900" });
  assert.ok(page.includes(ID) && page.includes("implement-item"), page);
  assert.equal(job.subject({ id: ID }, context), null);
});

// TST-974005 · level: unit · module: MOD-main-page
// guards: UC-036; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON
// given: a failed job whose task travelled with its hand-over (its record says task: with the hand-over)
// input: the route job drawn; the person's click on Open the prompt bar
// expect: no button Retry and no select of participants; the page says the task is not in the record and offers the prompt bar; the click calls go("job", { id, product, retry: "implement-item" }) and writes nothing
test("TST-974005 a job whose task travelled with its hand-over offers the prompt bar instead of Retry", async () => {
  use(5);
  const { seen, context } = world(jobIn("failed", { task: "with the hand-over" }));
  const target = await drawJob(context);
  assert.deepEqual(walk(target, (node) => node.localName === "button" && node.textContent === "Retry"), []);
  assert.equal(one(target, "retry-result").textContent.includes("task"), true);
  await trusted(one(target, "retry-prompt-bar"));
  assert.deepEqual(context.went, [["job", { id: ID, product: "https://github.com/alice/product", retry: "implement-item" }]]);
  assert.deepEqual(seen.trees, []);
});

// ---------------------------------------------------------------- ITM-1024: a retry whose item is no longer startable names the reason and starts nothing (UC-036 7a)
//
// Readings the module file leaves open, which the tests state (the pull request names them):
//   - "Retry ... whose step or item is still startable" is read for every way a retry is offered: a job queued on a Bridge, a job that ran in a tab (its retry opens the prompt bar) and a job whose task travelled with its hand-over.
//     A job whose item is not startable is offered neither Retry nor "Open the prompt bar"; the page lists the reasons (<li class="retry-reason">) and calls go() never.
//   - "The item left its sprint": the sprint file no longer selects it. "The WIP limit is reached": the product follows kanban (WIP limit 3) and three other items are in progress.

const OTHER_SPRINT = SPRINT.replace("  - ITM-0900", "  - ITM-0901");
const item = (id) => ["---", `id: ${id}`, "title: The work", "level: module", "realises:", "  - UC-001", "modules:", "  - MOD-store", "---", `# ${id} The work`, ""].join("\n");
const KANBAN = DECLARATION.replace("model: scrum", "model: kanban").replace("scrum.md", "kanban.md").replace("| Sprint | sprint/<team>/<nn> |", "| Development | work/<item> |");
const KANBAN_ASSIGNMENT = ASSIGNMENT.replace("| Product Owner | alice |", "| Product owner | alice |").replace("| Scrum Master | alice |\n", "").replace("| Developers |", "| Developer |");
const busy = (n) => { const { path, text } = startRecord({ id: `JOB-20261016-1000-7f0${n}`, kind: "implement-item", worksOn: [`ITM-090${n}`], participant: "dev-two", model: "model-y", route: "bridge lab-pc-4", run: null, retries: null, startedBy: "alice",
  start: new Date("2026-10-16T10:00:00Z"), agentM: { version: "2026.1.0", commit: "abc1234" }, inputs: [`docs/backlog/ITM-090${n}-work.md@${"b".repeat(40)}`], limit: 5, task: "in parameters", conversation: null, destinations: [], params: { item: `ITM-090${n}` } });
  return { path, text: appendToRecord(text, { part: "taken", at: new Date("2026-10-16T10:00:00Z"), by: "lab-pc-4" }) }; };
const crowded = () => { const more = {}; for (const n of [1, 2, 3]) { const { path, text } = busy(n); more[path] = text; more[`docs/backlog/ITM-090${n}-work.md`] = item(`ITM-090${n}`); } return more; };
const retryButtons = (target) => walk(target, (node) => node.localName === "button" && ["Retry", "Open the prompt bar"].includes(node.textContent));
const reasonsOf = (target) => byClass(target, "retry-reason").map((node) => node.textContent);

// TST-1024001 · level: unit · module: MOD-main-page
// guards: UC-036; A TIME BOX WORKS ONLY ON WHAT WAS SELECTED FOR IT
// given: the failed job of dev-cli on ITM-0900, whose sprint (team1's) no longer selects ITM-0900 (it selects ITM-0901)
// input: the route job drawn
// expect: no button Retry; the page lists a reason that says ITM-0900 is not selected for a sprint; nothing is written
test("TST-1024001 a job whose item left its sprint is offered no retry, and the reason is named", async () => {
  use(1);
  const { seen, context } = world(jobIn("failed"), { sprint: OTHER_SPRINT, more: { "docs/backlog/ITM-0901-other.md": item("ITM-0901") } });
  const target = await drawJob(context);
  assert.deepEqual(retryButtons(target), []);
  assert.equal(reasonsOf(target).some((text) => /ITM-0900/.test(text) && /sprint/i.test(text)), true, reasonsOf(target).join(" | "));
  assert.deepEqual(seen.trees, []);
});

// TST-1024002 · level: unit · module: MOD-main-page
// guards: UC-036; NO JOB STARTS ABOVE THE WORK-IN-PROGRESS LIMIT
// given: the failed job of dev-cli on ITM-0900 in a kanban product (WIP limit 3) in which ITM-0901, ITM-0902 and ITM-0903 are in progress (a taken job each, none ended)
// input: the route job drawn
// expect: no button Retry; the page lists a reason that names the work-in-progress limit; nothing is written
test("TST-1024002 a job whose product is at its work-in-progress limit is offered no retry, and the reason is named", async () => {
  use(2);
  const { seen, context } = world(jobIn("failed"), { declaration: KANBAN, assignment: KANBAN_ASSIGNMENT, more: crowded() });
  const target = await drawJob(context);
  assert.deepEqual(retryButtons(target), []);
  assert.equal(reasonsOf(target).some((text) => /work-in-progress limit/.test(text)), true, reasonsOf(target).join(" | "));
  assert.deepEqual(seen.trees, []);
});

// TST-1024003 · level: unit · module: MOD-main-page
// guards: UC-036; A TIME BOX WORKS ONLY ON WHAT WAS SELECTED FOR IT; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the failed job that ran in a tab, on ITM-0900, which team1's sprint no longer selects
// input: the route job drawn; a click a person makes on every button the page offers
// expect: no button Retry or Open the prompt bar; a reason naming ITM-0900 and the sprint; go() is never called; nothing is written (counter-proof: with the item selected, TST-974004 retries the tab job)
test("TST-1024003 a job that ran in a tab, whose item left its sprint, opens no prompt bar and names the reason", async () => {
  use(3);
  const { seen, context } = world(jobIn("failed", { route: "tab" }), { sprint: OTHER_SPRINT, more: { "docs/backlog/ITM-0901-other.md": item("ITM-0901") } });
  const target = await drawJob(context);
  assert.deepEqual(retryButtons(target), []);
  assert.equal(reasonsOf(target).some((text) => /ITM-0900/.test(text) && /sprint/i.test(text)), true, reasonsOf(target).join(" | "));
  assert.deepEqual(context.went, []);
  assert.deepEqual(seen.trees, []);
});

// TST-1024004 · level: unit · module: MOD-main-page
// guards: UC-036; NO JOB STARTS ABOVE THE WORK-IN-PROGRESS LIMIT
// given: the failed job whose task travelled with its hand-over, on ITM-0900, in a kanban product at its work-in-progress limit (three other items in progress)
// input: the route job drawn
// expect: no button Open the prompt bar or Retry; a reason naming the work-in-progress limit; go() is never called; nothing is written
test("TST-1024004 a job whose task travelled with its hand-over, at the work-in-progress limit, opens no prompt bar and names the reason", async () => {
  use(4);
  const { seen, context } = world(jobIn("failed", { task: "with the hand-over" }), { declaration: KANBAN, assignment: KANBAN_ASSIGNMENT, more: crowded() });
  const target = await drawJob(context);
  assert.deepEqual(retryButtons(target), []);
  assert.equal(reasonsOf(target).some((text) => /work-in-progress limit/.test(text)), true, reasonsOf(target).join(" | "));
  assert.deepEqual(context.went, []);
  assert.deepEqual(seen.trees, []);
});

// TST-1024005 · level: unit · module: MOD-main-page
// guards: UC-036; NO JOB STARTS ABOVE THE WORK-IN-PROGRESS LIMIT
// given: as TST-1024002, but only two other items are in progress, so that ITM-0900 is under the limit of 3
// input: the route job drawn
// expect: a button Retry and no reason (the retry of a startable item is still offered)
test("TST-1024005 a job whose product is under its work-in-progress limit is still offered a retry", async () => {
  use(5);
  const more = crowded();
  for (const path of Object.keys(more).filter((each) => each.includes("7f03"))) delete more[path];
  const { context } = world(jobIn("failed"), { declaration: KANBAN, assignment: KANBAN_ASSIGNMENT, more });
  const target = await drawJob(context);
  assert.equal(walk(target, (node) => node.localName === "button" && node.textContent === "Retry").length, 1);
  assert.deepEqual(reasonsOf(target), []);
});

// TST-1024006 · level: unit · module: MOD-main-page
// guards: UC-036; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: a failed job that ran in a tab and one whose task travelled with its hand-over, in a product whose facts cannot be read (the instance's repository is refused with an error)
// input: the route job drawn for each
// expect: no button Retry and no Open the prompt bar; the page says "Retry could not be prepared" and names the reason the read failed (the failure's own message, not an empty reason); go() is never called; nothing is written
test("TST-1024006 a tab or hand-over retry whose facts cannot be read says so and names the reason", async () => {
  const messages = [];
  for (const [n, options] of [[6, { route: "tab" }], [7, { task: "with the hand-over" }]]) {
    use(n);
    const { seen, context } = world(jobIn("failed", options));
    net.refusing = { how: "error", repository: INSTANCE };
    const target = await drawJob(context);
    assert.deepEqual(retryButtons(target), [], `${n}: nothing is offered`);
    const unreadable = byClass(target, "retry-unreadable")[0];
    assert.ok(unreadable, `${n}: the page says the retry could not be prepared`);
    messages.push(unreadable.textContent);
    assert.deepEqual(context.went, []);
    assert.deepEqual(seen.trees, []);
    net.restore();
    document.body.replaceChildren();
  }
  for (const message of messages) {
    assert.match(message, /^Retry could not be prepared: \S/, message);
    assert.doesNotMatch(message, /prepared: (undefined|\[object Object\]|)$/, message);
  }
});
