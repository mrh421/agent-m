// The harness of the system and release tests of UC-026 (Generate a multi-level test battery): the product alice/thesis-tool and the instance are git repositories on disk, as tests/uc-010-harness.mjs lays them
// out — a bare origin each, the dashboard's clone of the product, and the checkouts of the job workflow's runs. The dashboard's side is the real route `generate` of MOD-test-pages, drawn into the fixture DOM over
// the dashboard's clone, with the real MOD-runtimes `queueJob` on the route `ci hosted`; the job's side is the real entries of MOD-workflow-entries, run in-process as `node src/workflow-entries/main.mjs
// <entry>` runs them, over the real MOD-job-runner, MOD-job-catalogue and MOD-result-records (the recipe test-selection, the check test-proposals). The participant is a fake model endpoint behind the global
// `fetch`: it answers the proposal of the kind propose-tests, and, for the kind write-tests, does the work of a coding agent on the runner — it pushes the branch with the tests and their counter-proofs to the
// product's origin — before it reports the branch. Nothing reaches the network. The in-memory host `memoryProduct` serves the cases that call a module's interface directly. It holds no test and no expected
// result: what it builds are inputs, and every test states its own expected values.
// Imported by tests/system-uc-026-generate-a-multi-level-test-battery.test.mjs and tests/release-uc-026-generate-a-multi-level-test-battery.test.mjs.
//
// Module: MOD-test-pages
// Module: MOD-result-records
// Module: MOD-runtimes
// Module: MOD-workflow-entries
// Level: system
//
// Authored by developer-sonnet-j (ITM-771), who built none of the behaviour UC-026 walks: the participants who built it are named in the header of tests/system-uc-026-generate-a-multi-level-test-battery.test.mjs.
// The product alice/thesis-tool has the SPEC rules A LOAN HAS A DUE DATE (guarded by an existing unit test and an existing release test) and A LOAN CAN BE EXTENDED ONCE (guarded by none), the use cases UC-001
// (accepted by an approval record, guarded by an existing system test) and UC-002 (not accepted, guarded by none), the modules MOD-loans (exercised by an existing unit and an existing component test) and
// MOD-members (exercised by none), the test file tests/loan.test.mjs with TST-310 to TST-314, and the job workflow. The instance's register holds the CI agents test-bot, other-bot and small-bot (the capabilities
// of the test-writing role; the last holds a context of 100 tokens) and the model endpoint drafter-ep (it declares only `draft text`).

import "./review-pages-harness.mjs";
import { writeFileSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { ACCEPTED, ENDPOINT, INSTANCE_REPO, KEY, PRODUCT_TOKEN, PRODUCT_URL, RULE, UC1, UC1_TEXT, UC2, UC2_TEXT, click, entry, environment, find, git, installFast, text, until, withClass, world } from "./uc-010-harness.mjs";
import { startRecord } from "../src/job-ledger/index.mjs";
import { withStoredGraph } from "./stored-graph-fake.mjs";

export { ENDPOINT, KEY, PRODUCT_URL, RULE, UC1, UC2, click, find, git, until, withClass, world };

const { openStore, writeSetting } = await import("../src/browser-store/index.mjs");
export const OTHER_RULE = "A LOAN CAN BE EXTENDED ONCE";
export const LOAN_TESTS = "tests/loan.test.mjs";
const ENDPOINT_ORIGIN = new URL(ENDPOINT.baseUrl).origin;
const CAN = "read the repository, write to the repository, run code and tests";

// ---------------------------------------------------------------- the product

/** A test file's text: one declaration for each entry { id, level, module, guards, given, input, expect }, built by join, so that no line of this file is a declaration. */
export const declarations = (entries) => entries.map(({ id, level, module = "system", guards, given = "a product", input = "an input", expect = "a result", code = `check("${id}");` }) =>
  ["// TST-" + id + " · level: " + level + " · module: " + module, "// guards: " + guards, "// given: " + given, "// input: " + input, "// expect: " + expect, "test(\"" + id + "\", () => { " + code + " });", ""].join("\n")).join("\n");

const moduleFile = (id, folder) => text("---", `id: ${id}`, `title: Module ${id}`, `folder: ${folder}`, "realises:", `  - ${RULE}`, "follows:", "uses:", "provides:", "  - f", "---", `# ${id} Module`);
const SPEC = text("# Thesis tool — Specification", "", "## Lending", "", `**${RULE}** *(Product Owner)*`, "Every loan states the date by which the book is returned.", "*Check:* `tests/loan.test.mjs`", "",
  `**${OTHER_RULE}** *(Product Owner)*`, "A member extends a loan once.", "*Check:* no automatic check; at review.");

/** The existing tests of the product. */
export const EXISTING = [
  { id: "310", level: "unit", module: "MOD-loans", guards: RULE, given: "a loan made on 1 June", input: "the due date of the loan", expect: "the due date is 15 June", code: "dueDate(loan('2026-06-01'));" },
  { id: "311", level: "release", module: "system", guards: RULE, given: "a loan on the shelf", input: "the member opens the loan", expect: "the loan shows its due date" },
  { id: "312", level: "system", module: "system", guards: "UC-001", given: "a book on the shelf", input: "the member borrows it", expect: "the loan is made" },
  { id: "313", level: "component", module: "MOD-loans", guards: RULE, given: "the loan store and the calendar", input: "a loan is stored", expect: "its due date is stored with it" },
  { id: "314", level: "unit", module: "MOD-loans", guards: RULE, given: "a loan with no book", input: "the loan is made", expect: "the loan is refused" },
];

/** The product's files; `files` laid over them (a path set to null is left out). */
export const productFiles = (files = {}) => ({ ...ACCEPTED, "SPEC.md": SPEC, [UC1]: UC1_TEXT, [UC2]: UC2_TEXT, "docs/architecture/MOD-loans.md": moduleFile("MOD-loans", "src/loans/"),
  "docs/architecture/MOD-members.md": moduleFile("MOD-members", "src/members/"), [LOAN_TESTS]: declarations(EXISTING), ...files });

// ---------------------------------------------------------------- the instance

const row = (name, type, model, context, place, route, capabilities = CAN) => `| ${name} | ${type} | ${model} | ${context} | — | ${capabilities} | ${place} | ${route} |`;
/** The instance's register of participants; `rows` are further rows. */
export const register = (...rows) => text("# Participants of this instance", "", "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |", "|---|---|---|---|---|---|---|---|",
  row("test-bot", "CI agent", "fixture-llm", 200000, "GitHub's hosted runners", "ci hosted secret FIXTURE_KEY"), row("other-bot", "CI agent", "fixture-llm", 200000, "GitHub's hosted runners", "ci hosted secret FIXTURE_KEY"),
  row("small-bot", "CI agent", "fixture-llm", 100, "GitHub's hosted runners", "ci hosted secret FIXTURE_KEY"),
  row("drafter-ep", "model endpoint", "fixture-llm", 200000, "this machine", "endpoint ep1", "draft text"), ...rows);

/** The record of a job of kind `implement` that `participant` ran, working on `worksOn`, ended done: a record the page reads for the implementer of what a selection checks. */
export const implemented = (participant, worksOn, id = "JOB-20261010-0900-ab01") => {
  const { path, text: body } = startRecord({ id, kind: "implement", worksOn, participant, model: "fixture-llm", route: "ci hosted", run: null, retries: null, startedBy: "alice", start: new Date("2026-10-10T09:00:00Z"),
    agentM: { version: "2026.10.0", commit: "abc1234" }, inputs: [], limit: 5, destinations: [], params: {} });
  return { [path]: body };
};
/** A backlog item that realises `realises` and changes `modules`, as the product's backlog holds it. */
export const item = (id, realises, modules) => ({ [`docs/backlog/${id}-the-work.md`]: text("---", `id: ${id}`, "title: The work", "level: module", "realises:", ...realises.map((name) => `  - ${name}`), "modules:",
  ...modules.map((name) => `  - ${name}`), "builds_on: []", "tests:", "  - unit", "origin:", "  - the fixture", "---", `# ${id} The work`, "", "## Outcome", "", "The work.", "", "## Acceptance", "", "- a unit test.") });

/** battery({ product, instance }, run) — tests/uc-010-harness.mjs' world over this product and this instance, the job workflow installed; `run(w)` is what `world` runs. */
export function battery({ product = {}, instance = {} } = {}, run) {
  return world({ product: productFiles(product), instance: { "docs/participants.md": register(), ...instance } }, async (w) => { await installFast(w); return run(w); });
}

// ---------------------------------------------------------------- the dashboard's page

/** The context the route generate is drawn with: the instance's repository, the browser's store with the person's token and the endpoints of the CI agents, and the product chosen. `go` records a link. */
export function pageContext(w, { go = () => {}, extra = [] } = {}) {
  globalThis.location = { hostname: "akmaier.github.io", pathname: "/agent-m/", origin: "https://akmaier.github.io", href: "https://akmaier.github.io/agent-m/" };
  const store = openStore(INSTANCE_REPO);
  writeSetting(store, "github-token:alice/thesis-tool", PRODUCT_TOKEN);
  for (const name of ["test-bot", "other-bot", "small-bot", ...extra]) writeSetting(store, `endpoint:${name}`, { kind: ENDPOINT.kind, url: ENDPOINT.baseUrl, model: ENDPOINT.model });
  const real = w.dashboardHost();
  const host = { ...real, readSnapshot: async (ref) => withStoredGraph(await real.readSnapshot(ref)) };
  return { page: "main", instance: { repository: INSTANCE_REPO, host: w.instanceHost() }, store, go, product: { address: PRODUCT_URL, kind: "github", host } };
}

/** openGenerate(w, options) -> the element: the route generate drawn over the clones as the origins stand now. */
export async function openGenerate(w, options = {}) {
  const { view } = await import("../src/test-pages/index.mjs");
  const { registerStrategies } = await import("../src/job-runner/index.mjs");
  view.strategies.forEach((strategies, at) => registerStrategies(`tests/uc-026-harness.mjs#${at}`, strategies));
  const target = document.createElement("div");
  document.body.append(target);
  await view.routes.find((route) => route.name === "generate").render(target, pageContext(w, options), {});
  return target;
}

export const byClass = (root, name, className) => find(root, (node) => node.localName === name && String(node.className).split(" ").includes(className));
export const checkedNames = (target) => byClass(target, "input", "name").filter((box) => box.checked).map((box) => box.value);
export const checkedLevels = (target) => byClass(target, "input", "level").filter((box) => box.checked).map((box) => box.value);
export const listedNames = (target) => byClass(target, "tr", "uncovered").concat(byClass(target, "tr", "covered")).map((each) => each.getAttribute("data-name")).sort();
export const offeredNames = (target) => byClass(target, "tr", "participant").map((each) => each.getAttribute("data-name")).sort();
export const settle = async () => { for (let i = 0; i < 20; i += 1) await new Promise((resolve) => setImmediate(resolve)); };
export const runButtons = (root) => find(root, (node) => node.localName === "button" && node.textContent === "Run");
/** Ticks exactly `names` and `levels` on the page, as the person narrows the selection. */
export async function select(target, names, levels) {
  for (const box of byClass(target, "input", "name")) box.checked = names.includes(box.value);
  const boxes = byClass(target, "input", "level");
  for (const box of boxes) box.checked = levels.includes(box.value);
  boxes[0].dispatchEvent(new Event("change"));
  await settle();
}
/** Chooses the participant `writer`, enters the name and presses *Show the run panel*; resolves once the panel stands (or the page has said why not). */
export async function prepare(target, writer, person = "alice") {
  byClass(target, "input", "person")[0].value = person;
  const box = byClass(target, "input", "participant").find((each) => each.value === writer);
  if (box) box.checked = true;
  click(byClass(target, "button", "prepare")[0]);
  await until(() => byClass(target, "section", "run-panel").length === 1 || byClass(target, "p", "problem").length > 0, "the run panel or the page's reason");
  await settle();
}
/** Presses Run once and waits for the job to be queued. */
export async function run(target) {
  click(runButtons(target)[0]);
  await until(() => byClass(target, "p", "queued").length === 1 || byClass(target, "p", "problem").length > 0, "the queued job");
  await settle();
}
/** Presses *Read the proposal* and waits for what it draws. */
export async function readProposal(target) {
  click(byClass(target, "button", "read")[0]);
  await until(() => byClass(target, "section", "proposal")[0].childNodes.length > 0, "the proposal");
  await settle();
}
export const caseNode = (target, id) => find(target, (node) => node.localName === "li" && node.getAttribute("data-case") === id)[0];
export const fieldOfCase = (target, id, className) => byClass(caseNode(target, id), "textarea", className)[0];
export const selectOfCase = (target, id, className) => byClass(caseNode(target, id), "select", className)[0];
export const writeButton = (target) => byClass(target, "button", "write")[0];
/** Presses *Write tests* and waits for the page to say what it queued or why not. */
export async function writeTests(target) {
  click(writeButton(target));
  await until(() => byClass(target, "p", "queued").length >= 1 || byClass(target, "p", "result").length > 0 || byClass(target, "p", "all-duplicates").length > 0 || byClass(target, "p", "problem").length > 0, "what Write tests queued");
  await settle();
}

// ---------------------------------------------------------------- the participant

// The checkout of the run in progress, in whose folder the participant works.
let checkout = null;
/** ciRun(w) -> { status, run } — the job workflow's run on the default branch as it stands: a checkout made now, MOD-workflow-entries' onRecordsChanged in it, with the secrets AGENT_M_TOKEN and FIXTURE_KEY. */
export async function ciRun(w) {
  checkout = w.checkout();
  try {
    return { status: await entry("onRecordsChanged", environment(w, checkout)), run: checkout };
  } finally { checkout = null; }
}

/**
 * participant(script) — the fake model endpoint behind the global `fetch`. `script(request, n, { folder })` is called for the n-th request to the endpoint, with { address, headers, sent } (`sent` the text of
 * every message) and the folder of the checkout the run works in (during ciRun), and answers the draft of its answer (an object) or the raw text of the answer (a string). The requests to the server's API,
 * which the writer asks for the repository's history, are answered with an empty list; any other request is refused. -> the list of the requests to the endpoint; `elsewhere` and `outside` hold the others.
 */
export function participant(script) {
  const requests = [];
  requests.elsewhere = [];
  requests.outside = [];
  requests.pulls = [];
  globalThis.fetch = async (address, init = {}) => {
    const origin = new URL(String(address)).origin;
    if (origin === "https://api.github.com") {
      const url = new URL(String(address));
      // "Create a pull request" and "List pull requests" of the server's API; every other request is answered with an empty list.
      if ((init.method ?? "GET") === "POST" && url.pathname === "/repos/alice/thesis-tool/pulls") {
        const made = JSON.parse(init.body);
        requests.pulls.push(made);
        return new Response(JSON.stringify({ number: requests.pulls.length, html_url: `${PRODUCT_URL}/pull/${requests.pulls.length}`, title: made.title, state: "open", draft: false, body: made.body,
          head: { ref: made.head, sha: "c".repeat(40) }, base: { ref: made.base }, created_at: "2026-11-01T09:00:00Z", merged_at: null, closed_at: null }), { status: 201, headers: { "content-type": "application/json" } });
      }
      requests.elsewhere.push(String(address));
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    }
    if (origin !== ENDPOINT_ORIGIN) {
      requests.outside.push(String(address));
      return Promise.reject(new TypeError(`the test's network refuses ${address}`));
    }
    const body = JSON.parse(init.body);
    const request = { address: String(address), headers: init.headers ?? {}, sent: body.messages.map((message) => (typeof message.content === "string" ? message.content : JSON.stringify(message.content))).join("\n") };
    requests.push(request);
    const answer = await script(request, requests.length, { folder: checkout?.productDir ?? null });
    const content = typeof answer === "string" ? answer : JSON.stringify({ draft: answer, answers: [] });
    return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 120, completion_tokens: 30 } }), { status: 200 });
  };
  return requests;
}

/**
 * pushBranch(folder, branch, files) — what a coding agent does in the job's checkout `folder` (a clone of the product): the branch `branch` off the commit checked out, `files` ({ path: text }) written and
 * committed, the branch pushed to the origin, the checkout left on the branch it began on. -> the commit.
 */
export function pushBranch(folder, branch, files) {
  const began = git(folder, "rev-parse", "--abbrev-ref", "HEAD");
  git(folder, "checkout", "-q", "-b", branch);
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(folder, path, ".."), { recursive: true });
    writeFileSync(join(folder, path), body);
  }
  git(folder, "add", "-A");
  git(folder, "commit", "-q", "-m", `Write tests (${branch})`);
  git(folder, "push", "-q", "origin", `HEAD:refs/heads/${branch}`);
  const commit = git(folder, "rev-parse", "HEAD");
  git(folder, "checkout", "-q", began);
  return commit;
}

/** A counter-proof record, docs/tests/counter-proofs/<id>.md, of the schema counter-proof. */
export const counterProof = (id, { outcome = "failed", fault = "- return loan.due;\n+ return null;", result = "fails with the fault planted, passes once it is removed" } = {}) => text("---", `test: TST-${id}`, `commit: ${"a".repeat(40)}`,
  "participant: test-bot", "date: 2026-11-01T09:00:00Z", `outcome: ${outcome}`, "---", "## Fault", "", fault, "", "## Result", "", result);
export const proofPath = (id) => `docs/tests/counter-proofs/TST-${id}.md`;

/** A proposed case, of the form the answer of the kind propose-tests gives. */
export const proposed = (identifier, level, guards, over = {}) => ({ identifier, level, guards, precondition: "a loan made on 1 June", input: `the input of ${identifier}`, expected: `the result of ${identifier}`, class: "new", ...over });

// ---------------------------------------------------------------- the product in memory

const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
/** memoryProduct(files, branches) -> { snapshot, host, context(params) } — a product in memory for the cases that call a module's interface: its default branch `main` holds `files`, each branch of `branches` ({ name: files }) is `files` with its own on top. */
export function memoryProduct(files = productFiles(), branches = {}) {
  const snapshotOf = (tree, ref) => ({ repository: { server: "github", origin: "https://github.com", path: "alice/thesis-tool", web: PRODUCT_URL }, ref, commit: createHash("sha1").update(ref + JSON.stringify(Object.keys(tree))).digest("hex"),
    paths: Object.keys(tree).sort(), read: async (path) => (Object.hasOwn(tree, path) ? tree[path] : null), blob: (path) => (Object.hasOwn(tree, path) ? blobOf(tree[path]) : null) });
  const snapshot = snapshotOf(files, "main");
  const opened = [];
  const host = {
    async repositoryInfo() { return { defaultBranch: "main", visibility: "private", canWrite: true, archived: false, description: "" }; },
    async readSnapshot(ref) {
      if (ref === "main") return snapshot;
      if (!Object.hasOwn(branches, ref)) throw Object.assign(new Error(`no branch ${ref}`), { name: "NotFound" });
      return snapshotOf({ ...files, ...branches[ref] }, ref);
    },
    async listPullRequests() { return []; },
    async openPullRequest(pull) { opened.push(pull); return { url: `${PRODUCT_URL}/pull/${opened.length}`, number: opened.length }; },
  };
  const context = (params = {}, over = {}) => ({ kind: null, params, product: { address: PRODUCT_URL, snapshot, host }, instance: { snapshot: { paths: [], read: async () => null, blob: () => null }, host: null, checkout: null },
    connect: async () => null, participants: [], places: { sources: {}, mailbox: null }, gates: [], person: "alice", now: new Date("2026-11-01T09:00:00Z"), agentM: { version: "2026.11.0", commit: "b".repeat(40) },
    jobId: "JOB-20261101-0900-cd01", ...over });
  return { snapshot, host, opened, context };
}

/** The text of a file of the repository, from the disk. */
export const onDisk = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// ---------------------------------------------------------------- the job run in memory

/** The participant the jobs of `proposeRun` are given: a CI agent with the three capabilities of the test-writing role. */
export const WRITER = { name: "test-bot", type: "CI agent", model: "fixture-llm", context: 200000, price: null, capabilities: ["read the repository", "write to the repository", "run code and tests"],
  place: "GitHub's hosted runners", route: "ci hosted secret FIXTURE_KEY" };

// The instance's files from the disk: AGENTS.md, the register of the book and its chapters.
const BOOK = "docs/sources/SRC-vibe-coding/2026-10-05/";
const instanceSnapshot = () => {
  const paths = ["AGENTS.md", "docs/sources/SRC-vibe-coding.md", ...readdirSync(new URL(`../${BOOK}`, import.meta.url)).map((name) => BOOK + name)];
  return { repository: { server: "github", origin: "https://github.com", path: "akmaier/agent-m", web: "https://github.com/akmaier/agent-m" }, ref: "main", commit: "a".repeat(40), paths,
    read: async (path) => (paths.includes(path) ? onDisk(path) : null), blob: () => null };
};

/**
 * proposeRun(answers, { files, params, limit }) -> { prepared, result, failed, inputs, context } — the job of the kind propose-tests for the selection `params` over the product `files` in memory, prepared and run by
 * MOD-job-runner as the job workflow runs it, unattended, with a driver that answers `answers` in turn (each an object sent as the draft of the answer's envelope, or a function of the input; the last again where the
 * list is spent). `inputs` are the inputs the driver was sent. The strategies of the page's view are registered with the runner, as the frame does.
 */
export async function proposeRun(answers, { files = productFiles(), params = { requirements: [OTHER_RULE], useCases: ["UC-001"], modules: ["MOD-members"], levels: ["unit"] }, limit } = {}) {
  const { view } = await import("../src/test-pages/index.mjs");
  const { kindOf } = await import("../src/job-catalogue/index.mjs");
  const { prepareJob, registerStrategies, runJob } = await import("../src/job-runner/index.mjs");
  view.strategies.forEach((strategies, at) => registerStrategies(`tests/uc-026-harness.mjs#${at}`, strategies));
  const product = memoryProduct(files);
  const context = product.context(params, { kind: await kindOf("propose-tests"), participants: [WRITER] });
  context.instance = { snapshot: instanceSnapshot(), host: null, checkout: null };
  const prepared = await prepareJob("propose-tests", context, { drafter: WRITER, reviewers: [], ...(limit ? { limit } : {}) });
  const inputs = [];
  const queue = [...answers];
  const drafter = { participant: WRITER, inputs, async send(input) {
    inputs.push(input);
    const next = queue.length > 1 ? queue.shift() : queue[0];
    return { text: JSON.stringify({ draft: typeof next === "function" ? next(input) : next, answers: [] }), usage: null };
  } };
  try {
    return { prepared, result: await runJob(prepared, { drafter, reviewers: [] }, { attended: false, context }), failed: null, inputs, context };
  } catch (error) {
    return { prepared, result: null, failed: { name: error.name, message: error.message }, inputs, context };
  }
}

/**
 * sharedWorld(options) -> { start(), stop(), w } — a `battery` kept open from `start()` to `stop()`, for the tests of one walk that run in order over one product: `w` is the world once started.
 */
export function sharedWorld(options = {}) {
  let ready, release;
  const up = new Promise((resolve) => { ready = resolve; });
  const down = new Promise((resolve) => { release = resolve; });
  const shared = { w: null, running: null,
    async start() { shared.running = battery(options, async (w) => { shared.w = w; ready(); await down; }); await Promise.race([up, shared.running]); },
    async stop() { release(); await shared.running; } };
  return shared;
}
