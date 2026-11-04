// The harness of the system and release tests of UC-045 (Plan the implementation): the real route `plan` of MOD-implementation-pages (and `implement`, which starts the jobs of a plan's steps) is drawn into the fixture DOM over
// the real MOD-repository-hosts GitHub host, which talks to tests/app-harness.mjs' fake of GitHub's API (git-data commits, contents, batch reads, the history of a path, the trace-cache branch), a fake of the pull requests listing,
// and, for the drafting participant, a fake of two model endpoints; the plan is saved by the real MOD-work-plans and MOD-job-runner. The open page, its presses and its servers are those of tests/uc-032-harness.mjs.
// No request leaves the process. It holds no test and no expected result: what it builds are inputs, and every test states its own expected values.
// Imported by tests/system-uc-045-plan-the-implementation.test.mjs and tests/release-uc-045-plan-the-implementation.test.mjs.
//
// Module: MOD-implementation-pages
// Module: MOD-work-plans
// Level: system
//
// Authored by developer-sonnet-j (ITM-1061), who implemented none of ITM-614, ITM-1058, ITM-1059 and no UC-045 production behaviour.
//
// The product (`planned()`, the repository alice/thesis-tool): a V-model product, its model the shipped V-model that the instance (akmaier/agent-m, `instanceFiles()`) holds at the commit the declaration names. Its SPEC holds RULE ONE
// and RULE TWO; UC-001 is accepted by an approval record. Its architecture, every file accepted by a record naming its current text: the system ARC-001; the subsystem ARC-002 (Storage), designing MOD-store and MOD-pages, MOD-pages
// using MOD-store.read; the subsystem ARC-003 (Mail), designing MOD-mail. The plan (`planFiles()`): six steps in the order ITM-101 (MOD-store), ITM-102 (MOD-pages, after ITM-101), ITM-103 (MOD-mail), ITM-104 (the
// integration of ARC-002, after ITM-102), ITM-105 (the integration of ARC-003, after ITM-103) and ITM-106 (the system, after ITM-104 and ITM-105), in the phases Implementation and Testing. The gates Requirements → Design
// and Design → Implementation of the V-model have no record (`GATES` are the two records), so every step waits. The instance's participants are those of tests/uc-032-harness.mjs: local-llm and cloud-llm draft text, dev-a and
// dev-b cannot. Each call of `openPlan` takes the head of the product from its files, since MOD-trace-graph keeps the graph of a commit for the length of a test file; pages are ended in the order they were opened, last first (`done()`).

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { blobSha } from "../src/text-tools/index.mjs";
import "./site-frame-dom.mjs";
import { REPO, TOKEN, repoServer } from "./app-harness.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { HEAD, PARTICIPANTS, STORE, UC1, UC1_PATH, found, lines, plain, specOf, walk, classed, buttons, choose, settle, waitFor, typeInto, clickOn, textOf, writerOf, pr } from "./uc-032-harness.mjs";
export { HEAD, PARTICIPANTS, STORE, found, lines, plain, walk, classed, buttons, choose, settle, waitFor, typeInto, clickOn, textOf, writerOf, pr };

/** The product's repository and its address; the instance is akmaier/agent-m (tests/app-harness.mjs' REPO). */
export const PRODUCT_REPO = "alice/thesis-tool";
export const ADDRESS = `https://github.com/${PRODUCT_REPO}`;

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
export const V_MODEL = read("src/model-catalogue/models/v-model.md");
export const SCRUM_MODEL = read("tests/fixtures/flow/scrum-wip.md");

// ---------------------------------------------------------------- the files of the product

export const declaration = (model = "v-model", modelFile = "docs/process-models/v-model.md") => lines("---", `model: ${model}`, `model_file: ${modelFile}`, `model_version: ${HEAD}`, "---",
  "# How the fixture product is developed", "", "## Practices", "", "- none", "", "## Branches", "", "| Phase or time box | Branch |", "|---|---|", "| Implementation | `work/<item>` |", "",
  "## Definition of Done", "", "The job rules hold.");
export const decision = (id, title, extra = []) => lines("---", `id: ${id}`, `title: ${title}`, ...extra, "---", `# ${id} ${title}`, "", "## Context", "", "c", "", "## Decision", "", "d", "", "## Alternatives", "", "a", "",
  "## Consequences", "", "q");
export const moduleText = (id, uses = [], follows = "ARC-002") => lines("---", `id: ${id}`, `title: The module ${id}`, `folder: src/${id.slice(4)}/`, "realises:", "  - RULE ONE", "follows:", `  - ${follows}`,
  `uses:${uses.length ? `\n${uses.map((use) => `  - ${use}`).join("\n")}` : " []"}`, "provides:", "  - read", "---", `# ${id} The module ${id}`, "", "## Responsibility", "", "r", "", "## Parts", "", "p", "", "## Data", "", "d", "",
  "## Interfaces", "", "- `read` — i", "", "## Files", "", "f", "", "## Uses", "", "u");
export const ARC_PATHS = { system: "docs/architecture/ARC-001-the-whole.md", storage: "docs/architecture/ARC-002-storage.md", mail: "docs/architecture/ARC-003-mail.md" };
export const modulePath = (id) => `docs/architecture/${id}.md`;
/** The architecture's files: the system, two subsystems, three modules. `uses` of a module: { "MOD-pages": ["MOD-store.read"] } by default. */
export const architecture = ({ uses = { "MOD-pages": ["MOD-store.read"] } } = {}) => ({
  [ARC_PATHS.system]: decision("ARC-001", "The whole", ["forced_by:", "  - UC-001"]),
  [ARC_PATHS.storage]: decision("ARC-002", "Storage", ["refines: ARC-001", "forced_by:", "  - UC-001", "designs:", "  - MOD-store", "  - MOD-pages"]),
  [ARC_PATHS.mail]: decision("ARC-003", "Mail", ["refines: ARC-001", "forced_by:", "  - UC-001", "designs:", "  - MOD-mail"]),
  [modulePath("MOD-store")]: moduleText("MOD-store", uses["MOD-store"] ?? []),
  [modulePath("MOD-pages")]: moduleText("MOD-pages", uses["MOD-pages"] ?? []),
  [modulePath("MOD-mail")]: moduleText("MOD-mail", uses["MOD-mail"] ?? [], "ARC-003"),
});

export const stepId = (n) => `ITM-${String(n).padStart(3, "0")}`;
export const stepPath = (n, slug) => `docs/plan/${stepId(n)}-${slug}.md`;
/** A plan step as MOD-work-plans writes one: level, what it realises, the modules, the tests of its level and its origin. */
export const stepText = (n, title, { level = "module", modules, integrates = null, buildsOn = [], tests = null }) => {
  const kept = tests ?? (level === "system" ? ["system", "release"] : [level === "module" ? "unit" : "component"]);
  return lines("---", `id: ${stepId(n)}`, `title: ${title}`, `level: ${level}`, "realises:", "  - UC-001", "modules:", ...modules.map((module) => `  - ${module}`),
    ...(integrates ? [`integrates: ${integrates}`] : []), ...(buildsOn.length ? ["builds_on:", ...buildsOn.map((id) => `  - ${id}`)] : []), "tests:", ...kept.map((one) => `  - ${one}`), "origin:", "  - UC-001", "---",
    `# ${stepId(n)} ${title}`, "", "## Outcome", "", `Implements ${modules.join(", ")}.`, "", "## Acceptance", "", ...kept.map((one) => `- ${one[0].toUpperCase()}${one.slice(1)} tests.`));
};
export const SLUGS = { 101: "the-store", 102: "the-pages", 103: "the-mail", 104: "storage-integration", 105: "mail-integration", 106: "the-system" };
export const STEPS = {
  101: ["The store", { modules: ["MOD-store"] }], 102: ["The pages", { modules: ["MOD-pages"], buildsOn: [stepId(101)] }], 103: ["The mail", { modules: ["MOD-mail"] }],
  104: ["Storage integration", { level: "subsystem", modules: ["MOD-store", "MOD-pages"], integrates: "ARC-002", buildsOn: [stepId(102)] }],
  105: ["Mail integration", { level: "subsystem", modules: ["MOD-mail"], integrates: "ARC-003", buildsOn: [stepId(103)] }],
  106: ["The system", { level: "system", modules: ["MOD-store", "MOD-pages", "MOD-mail"], buildsOn: [stepId(104), stepId(105)] }],
};
export const ORDER_PATH = "docs/plan/order.md";
export const PHASES = { 101: "Implementation", 102: "Implementation", 103: "Implementation", 104: "Testing", 105: "Testing", 106: "Testing" };
export const orderText = (rows) => lines("## Order", "", "| Step | Phase |", "| --- | --- |", ...rows.map(([id, phase]) => `| ${id} | ${phase} |`));
/** The plan files of `which` steps (default all six) in the order ITM-101 … ITM-106; `over` replaces or removes (null) a step's text or the order. */
export function planFiles({ which = [101, 102, 103, 104, 105, 106], over = {} } = {}) {
  const files = { [ORDER_PATH]: orderText(which.map((n) => [stepId(n), PHASES[n]])) };
  for (const n of which) files[stepPath(n, SLUGS[n])] = stepText(n, STEPS[n][0], STEPS[n][1]);
  return { ...files, ...over };
}

const gateRecord = (gate, role, decider) => lines("---", `gate: ${gate}`, `decider: ${decider}`, `role: ${role}`, "decision: passed", "date: 2026-10-30 10:00 UTC", "on:", `  - ${HEAD}`, "---", `# ${gate}`);
/** The two gate records of the V-model that stand before the phase Implementation (the gate Design → Implementation is decided by the Reviewer). */
export const GATES = {
  "docs/gates/20261030-1000-requirements-design-aaaa.md": gateRecord("Requirements → Design", "Reviewer", "bob"),
  "docs/gates/20261030-1001-design-implementation-bbbb.md": gateRecord("Design → Implementation", "Reviewer", "bob"),
};

const record = async (id, kind, path, text) => [`docs/approvals/${id}-${(await blobSha(text)).slice(0, 12)}.md`, lines(`kind: ${kind}`, `file: ${path}`, `blob: ${await blobSha(text)}`)];

/**
 * planned({ model, files, plan, accepted }) -> the files of the product, `files` laid over them (a path set to null is left out). `plan` false leaves no plan; `accepted` a list of paths whose approval record is left out (open).
 * A planned product: the V-model declared, the architecture accepted, the plan of six steps, no gate record.
 */
export async function planned({ model = V_MODEL, files = {}, plan = true, open: left = [], declare = true } = {}) {
  const base = {
    "SPEC.md": specOf("RULE ONE", "RULE TWO"), "docs/process-models/v-model.md": model, "docs/role-assignments/plan.md": lines("# plan", "", "## Roles", "", "| Role | Participants |", "|---|---|",
      "| Product owner | alice |", "| Developer | dev-a |", "| Tester | dev-a |", "| Reviewer | bob |"),
    "docs/participants.md": PARTICIPANTS, "AGENTS.md": "# AGENTS.md of the instance\n", ".github/workflows/agent-m-jobs.yml": "name: agent-m jobs\n",
    [UC1_PATH]: UC1, ...architecture(), ...(plan ? planFiles() : {}),
  };
  if (declare) base["docs/process.md"] = declaration();
  const merged = { ...base, ...files };
  for (const path of Object.keys(merged)) if (merged[path] === null) delete merged[path];
  for (const [path, text] of Object.entries(merged)) {
    const reviewed = /^docs\/(architecture|use-cases)\/(ARC-\d+|MOD-[a-z]+|UC-\d+)/.exec(path);
    if (!reviewed || left.includes(path)) continue;
    const kind = reviewed[1] === "use-cases" ? "use-case" : reviewed[2].startsWith("MOD-") ? "module" : "architecture-decision";
    const [recordPath, recordText] = await record(reviewed[2], kind, path, text);
    merged[recordPath] = recordText;
  }
  return merged;
}

// ---------------------------------------------------------------- the instance and the page

/** The instance's files: AGENTS.md, its SPEC, the participants' register and the V-model it holds at its head (the version the product's declaration names). */
export const instanceFiles = ({ participants = PARTICIPANTS, model = V_MODEL } = {}) => ({ "AGENTS.md": "# AGENTS.md of the instance\n", "SPEC.md": "# Instance\n", "docs/participants.md": participants,
  "docs/process-models/v-model.md": model, "src/model-catalogue/models/v-model.md": model });
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const githubPull = (p) => ({ number: p.number, title: p.title, head: { ref: p.branch, sha: p.head }, base: { ref: p.base }, state: p.state === "open" ? "open" : "closed", merged_at: p.merged, merge_commit_sha: p.mergeCommit,
  created_at: p.opened, updated_at: p.updated, closed_at: p.closed, draft: false, html_url: p.url, body: p.body });

/**
 * openPlan(name, params, { files, instance, pullRequests, server, store }) -> { target, srv, inst, route, press, script, done, html } — the route `name` of MOD-implementation-pages drawn for the product `files` (the repository
 * alice/thesis-tool) and the instance `instance` (the repository akmaier/agent-m), each behind a fake of GitHub's API of its own (tests/app-harness.mjs' repoServer), `pullRequests` those of the product, `server` the test's own
 * request handlers (the model endpoints). `srv` is the product's server, `inst` the instance's; `press(element)` is a person's click awaited, `script(element)` a script's; `done()` ends the page.
 */
export async function openPlan(name, params = {}, { files, instance = instanceFiles(), pullRequests = [], server = [], store = {}, pulls = { list: pullRequests }, dates = {} } = {}) {
  const { view } = await import("../src/implementation-pages/index.mjs");
  for (const [at, strategies] of view.strategies.entries()) {
    try { registerStrategies(`tests/uc-045-harness.mjs#${at}`, strategies); } catch { /* registered already */ }
  }
  const route = view.routes.find((candidate) => candidate.name === name);
  const created = [];
  const pullsApi = (url) => {
    if (url.origin !== "https://api.github.com" || url.pathname !== `/repos/${PRODUCT_REPO}/pulls`) return undefined;
    const state = url.searchParams.get("state") ?? "open";
    return json(pulls.list.filter((p) => state === "all" || (state === "open" ? p.state === "open" : p.state !== "open")).map(githubPull));
  };
  const refsApi = (url, init) => {
    if (url.origin !== "https://api.github.com" || url.pathname !== `/repos/${PRODUCT_REPO}/git/refs` || init.method !== "POST") return undefined;
    const body = JSON.parse(init.body);
    created.push(body);
    return json({ ref: body.ref, object: { sha: body.sha } }, 201);
  };
  // MOD-trace-graph's storedGraph keeps the graph of a commit for the length of a test file, so a product of other files stands at a head of its own: the head is named by its files.
  const head = createHash("sha1").update(JSON.stringify(Object.entries(files).sort())).digest("hex");
  const srv = await repoServer({ files, handlers: [pullsApi, refsApi], head, repo: PRODUCT_REPO, dates });
  const inst = await repoServer({ files: instance, handlers: server, head: HEAD });
  const ofProduct = (url, init) => {
    if (url.pathname.startsWith(`/repos/${PRODUCT_REPO}`) || url.pathname.startsWith(`/${PRODUCT_REPO}/`)) return true;
    if (url.origin === "https://api.github.com" && url.pathname === "/graphql" && init?.body) return JSON.parse(init.body).variables?.name === PRODUCT_REPO.split("/")[1];
    return false;
  };
  const real = globalThis.fetch;
  const log = [];
  globalThis.fetch = (input, init = {}) => {
    const url = new URL(String(input?.url ?? input));
    const mine = ofProduct(url, init);
    // Each request that writes, with the authorisation it carries (a read through GraphQL's POST is no write).
    if (url.origin === "https://api.github.com" && (init.method ?? "GET") !== "GET" && url.pathname !== "/graphql") {
      log.push({ repository: mine ? PRODUCT_REPO : REPO, method: init.method, path: url.pathname, authorization: init.headers?.Authorization ?? init.headers?.authorization ?? null });
    }
    return (mine ? srv : inst).fetch(input, init);
  };
  const host = connect(parseAddress(ADDRESS), { token: TOKEN });
  const instanceHost = connect(parseAddress(`https://github.com/${REPO}`), { token: TOKEN });
  const handlers = [];
  const Element = globalThis.window.Element, add = Element.prototype.addEventListener;
  Element.prototype.addEventListener = function (type, listener, ...rest) { if (type === "click") handlers.push([this, listener]); return add.call(this, type, listener, ...rest); };
  globalThis.mermaid = { initialize() {}, mermaidAPI: { getDiagramFromText: async () => ({ db: { getVertices: () => ({}) } }) }, run: async () => {} };
  const target = globalThis.document.createElement("div");
  globalThis.document.body.append(target);
  const context = { page: "review", instance: { repository: REPO, host: instanceHost }, product: { address: ADDRESS, kind: "github", host, tokenStored: true, ref: "main" }, store, go() {} };
  const done = () => { Element.prototype.addEventListener = add; delete globalThis.mermaid; globalThis.fetch = real; };
  try { await route.render(target, context, params); } catch (failure) { done(); throw failure; }
  const settleOnce = () => new Promise((resolve) => setTimeout(resolve, 30));
  const call = async (element, event) => {
    const listener = handlers.filter(([at]) => at === element).at(-1)?.[1];
    if (typeof listener !== "function") throw new Error("the element has no click listener");
    await listener(event);
    await settleOnce();
  };
  return { target, srv, inst, route, created, log, done, html: () => target.innerHTML, press: (element) => call(element, { isTrusted: true }), script: (element) => call(element, { isTrusted: false }) };
}

/** The steps of the page in the order drawn: [{ id, state, waits }]. */
export const stepsOf = (page) => found(page.target, "[data-step]").map((row) => ({ id: row.getAttribute("data-step"), state: row.getAttribute("data-state"), waits: textOf(found(row, "[data-waits-for]")[0]) }));
/** The architecture of the page: [[id, kind, under]]. */
export const treeOf = (page) => found(page.target, "[data-architecture]").map((row) => [row.getAttribute("data-architecture"), row.getAttribute("data-kind"), row.getAttribute("data-under")]);
export const marksOf = (node) => found(node, "[data-mark]").map(textOf);
export const rowOf = (page, id) => found(page.target, `[data-step="${id}"]`)[0];
export const archRowOf = (page, id) => found(page.target, `[data-architecture="${id}"]`)[0];
/** The commits that wrote under docs/plan/ (the fake of GitHub keeps each commit's files). */
export const planWrites = (page) => page.srv.writes.filter((write) => Object.keys(write.files).some((path) => path.startsWith("docs/plan/")));

/** The answer of the drafting participant: the plan drafted from the bottom up for the architecture above, as the kind draft-plan states it. */
export const DRAFT = { steps: [
  { title: "Store", implements: ["MOD-store"], level: "unit", phase: "Implementation", after: [] },
  { title: "Pages", implements: ["MOD-pages"], level: "unit", phase: "Implementation", after: ["Store"] },
  { title: "Mail", implements: ["MOD-mail"], level: "unit", phase: "Implementation", after: [] },
  { title: "Storage", implements: ["ARC-002"], level: "component", phase: "Testing", after: ["Pages"] },
  { title: "Mailing", implements: ["ARC-003"], level: "component", phase: "Testing", after: ["Mail"] },
  { title: "Whole", implements: ["system"], level: "system", phase: "Testing", after: ["Storage", "Mailing"] },
] };
export const without = (title) => ({ steps: DRAFT.steps.filter((step) => step.title !== title).map((step) => ({ ...step, after: step.after.filter((each) => each !== title) })) });

/**
 * drafting(files, answers) -> { page, asked } — the planner presses Draft the plan on the route `plan` of the product `files`, the participant is chosen when the run panel offers several; `answers` are the drafts the
 * endpoints give, one for each request, the last for every later one; each request body is kept in `asked`. The run panel is shown and not run.
 */
export async function drafting({ files, instance = instanceFiles() }, ...answers) {
  const asked = [];
  let at = 0;
  const server = [async (url, init) => {
    if (!["https://ep1.example.test", "https://ep2.example.test"].includes(url.origin)) return undefined;
    asked.push({ origin: url.origin, body: JSON.parse(init.body) });
    const draft = answers[Math.min(at, answers.length - 1)];
    at += 1;
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ draft, answers: [] }) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), { status: 200, headers: { "Content-Type": "application/json" } });
  }];
  const page = await openPlan("plan", {}, { files, server, store: STORE, instance });
  await page.press(found(page.target, "[data-draft-plan]")[0]);
  await waitFor(() => classed(page.target, "run-panel").length > 0 || /warn/.test(found(page.target, "[data-plan-draft]")[0]?.innerHTML ?? ""));
  return { page, asked };
}
/** run(page) — the planner presses Run on the run panel and waits for the draft's steps. */
export async function run(page) {
  await page.press(buttons(classed(page.target, "run-panel")[0], "Run")[0]);
  await waitFor(() => found(page.target, "[data-draft-step]").length > 0 || /No plan was drafted/.test(textOf(page.target)));
}
/** handPlan(steps, files) -> the page after the planner typed `steps` with + Step and pressed Save plan (the product `files`, by default the planned one without a plan). */
export async function handPlan(steps, files) {
  const page = await openPlan("plan", {}, { files: files ?? await planned({ plan: false }) });
  await byHand(page, steps);
  await page.press(savePlan(page));
  return page;
}
/** quiet() — a time in which a write that a page started by itself would have been made (the fake of GitHub answers each request in a timer of its own). */
export const quiet = () => new Promise((resolve) => setTimeout(resolve, 400));
export const boxes = (page) => found(page.target, "[data-draft-step]");
export const titles = (page) => boxes(page).map((box) => found(box, '[data-step-field="title"]')[0].value);
export const boxOf = (page, title) => boxes(page).find((box) => found(box, '[data-step-field="title"]')[0].value === title);
export const savePlan = (page) => buttons(page.target, "Save plan")[0];
export const refused = (page) => classed(found(page.target, "[data-draft-refused]")[0], "error").map(textOf);
export const saved = (page) => textOf(found(page.target, "[data-plan-saved]")[0]);
/** byHand(page, steps) — the planner presses + Step for each step and types its fields. */
export async function byHand(page, steps) {
  for (const step of steps) {
    const before = boxes(page).length;
    await page.press(found(page.target, "[data-add-step]")[0]);
    await waitFor(() => boxes(page).length > before);
    const box = boxes(page).at(-1);
    for (const key of ["title", "implements", "level", "phase", "after"]) await typeInto(found(box, `[data-step-field="${key}"]`)[0], Array.isArray(step[key]) ? step[key].join(", ") : step[key]);
  }
}
