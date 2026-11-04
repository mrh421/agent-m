// The harness of the system and release tests of UC-032 (Maintain the backlog): the real routes of MOD-implementation-pages (`backlog`, `board`, `progress`, `plan`, `implement`) are drawn into a fixture DOM over the real
// MOD-repository-hosts GitHub host, which talks to tests/app-harness.mjs' fake of GitHub's API (repoServer: git-data commits, the contents API, batch reads), a fake of the pull requests listing and of "Create a
// reference", and, for the model endpoints a job asks, a fake of two endpoints. The product is the instance repository itself, as tests/implementation-pages-sprints.mjs holds it. A person's click is the page's own
// listener called with a trusted event (`isTrusted` true), a script's click one whose `isTrusted` is false; no input event of the operating system is made and nothing reaches the network.
// Imported by tests/system-uc-032-maintain-the-backlog.test.mjs and the release tests of UC-032. It holds no test and no expected result: what it builds are inputs, and every test states its own expected values.
//
// Module: MOD-implementation-pages
// Module: MOD-work-plans
// Level: system
//
// Authored by developer-sonnet-l (ITM-803), who implemented none of ITM-681, ITM-782, ITM-783, ITM-784 or ITM-1316 and no UC-032 production behaviour.
//
// The product (`product()`): a Scrum product without a time box, with the work-in-progress limit 2, of two teams. Its SPEC holds RULE ONE, RULE TWO, RULE THREE and RULE FOUR, all accepted; UC-001 is accepted by an approval
// record; RULE TWO and UC-001 are realised by no item. Modules: MOD-store, MOD-pages (uses MOD-store.read), MOD-mail, MOD-feed (uses MOD-mail.read) and MOD-news. Items: ITM-001 (MOD-store; merged), ITM-002 (MOD-pages,
// builds on ITM-001; open pull request), ITM-003 (MOD-mail; ready), ITM-004 (MOD-feed, builds on ITM-003), ITM-005 (MOD-store), ITM-006 (realises RULE NOT ACCEPTED, which no one accepted) and ITM-007 (MOD-news; its job failed).
// team1 runs its sprint 02 since 2026-10-20 with ITM-001 and ITM-002, on its own branch; team2 has run no sprint.

import { readFileSync } from "node:fs";

import "./site-frame-dom.mjs";
import { REPO, TOKEN, repoServer } from "./app-harness.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { blobSha } from "../src/text-tools/index.mjs";
import { artifactSchemas, readDocument } from "../src/documents/index.mjs";
import { planSchemas } from "../src/work-plans/index.mjs";
import { found, row, part } from "./implementation-pages-sprints.mjs";
export { found, row, part };

export const ADDRESS = `https://github.com/${REPO}`;
export const lines = (...rows) => `${rows.join("\n")}\n`;
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
export const MODELS = { scrum: read("tests/fixtures/flow/scrum-wip.md"), timeBox: read("tests/fixtures/flow/scrum.md"), kanban: read("tests/fixtures/flow/kanban.md") };

// ---------------------------------------------------------------- the page, as a person reads and fills it

export const textOf = (node) => String(node?.textContent ?? "").replace(/\s+/g, " ").trim();
/** The text of an HTML fragment, tags dropped. */
export const plain = (html) => String(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
export const walk = (root, match) => {
  const all = [];
  (function visit(node) { for (const child of node.childNodes) if (child.nodeType === 1) { if (match(child)) all.push(child); visit(child); } })(root);
  return all;
};
export const classed = (root, name) => walk(root, (element) => String(element.getAttribute("class") ?? "").split(/\s+/).includes(name));
export const buttons = (root, label) => walk(root, (element) => element.localName === "button" && element.textContent.trim() === label);
const realTimeout = globalThis.setTimeout;
export const settle = async () => { for (let n = 0; n < 40; n += 1) await new Promise((resolve) => setImmediate(resolve)); };
export const waitFor = async (condition) => { for (let n = 0; n < 400 && !condition(); n += 1) await new Promise((resolve) => realTimeout(resolve, 10)); await settle(); };
/** Whether a control the page wrote as HTML is disabled: the fixture DOM keeps a disabled attribute, not a property. */
export const disabledOf = (control) => control.disabled === true || control.getAttribute("disabled") !== null;
/** A person types `value` into a field of a form: the field's own input listener is called. */
export const typeInto = async (input, value) => { input.value = value; input.dispatchEvent(new Event("input")); await settle(); };
export const choose = async (select, value) => { select.value = value; select.dispatchEvent(new Event("change")); await settle(); };
/** A person's click, or a script's (isTrusted false), on an element that is not the page's own listener target (a button of a form the page built). */
export const clickOn = async (node, person = true) => { const event = new Event("click"); if (person) Object.defineProperty(event, "isTrusted", { value: true }); node.dispatchEvent(event); await settle(); };
/** The value of the front-matter field `key` of a committed Markdown file. */
export const fieldOf = (text, key) => new RegExp(`^${key}:[ \\t]*(.*)$`, "m").exec(text)?.[1].trim() ?? null;
/** The list a front-matter field holds in a committed Markdown file. */
export const listOf = (text, key) => (new RegExp(`^${key}:\\n((?:  - .*\\n)+)`, "m").exec(text)?.[1] ?? "").split("\n").filter(Boolean).map((line) => line.replace(/^ {2}- /, ""));

// ---------------------------------------------------------------- the files of the product

export const requirement = (name) => [`**${name}** *(PO, 2026-09-01)*`, `The rule ${name}.`, "*Check:* no automatic check; at review.", ""];
export const specOf = (...names) => lines("# SPEC", "", "## 1. Rules", "", ...names.flatMap(requirement));
// A browser's insertAdjacentHTML("afterbegin"), which the page's notice after a decision uses and the fixture DOM lacks: the fragment's nodes are put before the element's first child, the nodes already there stay.
globalThis.window.Element.prototype.insertAdjacentHTML ??= function insertAdjacentHTML(where, html) {
  const box = globalThis.document.createElement("div");
  box.innerHTML = html;
  const nodes = [...box.childNodes];
  if (where === "afterbegin") for (const node of nodes.reverse()) this.insertBefore(node, this.firstChild);
  else for (const node of nodes) this.appendChild(node);
};
export const HEAD = "c0ffee".padEnd(40, "0");
// The instance is the product itself, so the model version the declaration names is the head.
export const declaration = (modelFile = "docs/process-models/fixture.md") => lines("---", "model: fixture-scrum-wip", `model_file: ${modelFile}`, `model_version: ${HEAD}`, "---",
  "# How the fixture product is developed", "", "## Practices", "", "- none", "", "## Branches", "", "| Phase or time box | Branch |", "|---|---|", "| Sprint | `sprint/<team>/<nn>` |", "",
  "## Definition of Done", "", "The job rules hold.");
export const assignment = (team, owner, builder) => lines(`# ${team}`, "", "## Roles", "", "| Role | Participants |", "|---|---|", `| Owner | ${owner} |`, `| Builders | ${builder} |`, `| Checker | ${builder} |`);
export const moduleFile = (id, uses = []) => lines("---", `id: ${id}`, `title: The module ${id}`, `folder: src/${id.slice(4)}/`, "realises:", "  - RULE ONE", "follows:", "  - ARC-001",
  `uses:${uses.length ? `\n${uses.map((use) => `  - ${use}`).join("\n")}` : " []"}`, "provides:", "  - read", "---", `# ${id} The module ${id}`);
export const MODULES = { "MOD-store": [], "MOD-pages": ["MOD-store.read"], "MOD-mail": [], "MOD-feed": ["MOD-mail.read"], "MOD-news": [], "MOD-report": ["MOD-pages.read"] };
export const idOf = (n) => `ITM-${String(n).padStart(3, "0")}`;
export const itemPath = (n) => `docs/backlog/${idOf(n)}-item-${n}.md`;
export const itemText = (n, { modules, buildsOn = [], realises = ["RULE ONE"], title = `The work of item ${n}`, origin = ["the request of the Product Owner"], extra = [] }) => lines("---", `id: ${idOf(n)}`, `title: ${title}`, "level: module",
  "realises:", ...realises.map((name) => `  - ${name}`), "modules:", ...modules.map((module) => `  - ${module}`),
  ...(buildsOn.length ? ["builds_on:", ...buildsOn.map((dependency) => `  - ${dependency}`)] : ["builds_on: []"]), "tests:", "  - unit", "origin:", ...origin.map((name) => `  - ${name}`), ...extra, "---",
  `# ${idOf(n)} ${title}`, "", "## Outcome", "", `What item ${n} delivers.`, "", "## Acceptance", "", "- a unit test.");
export const sprintPath = (team, nn) => `docs/backlog/sprints/${team}/${String(nn).padStart(2, "0")}.md`;
export const sprintText = ({ n, goal = "A goal", start = "2026-10-20", end = "", closer = "alice", branch = "", selection, tail = [] }) => lines("---", `sprint: ${n}`, `goal: ${goal}`, `start: ${start}`, `end: ${end}`,
  `closer: ${closer}`, `branch: ${branch}`, "selection:", ...selection.map((each) => `  - ${each}`), "---", `# Sprint ${n}`, ...tail);
export const UC1 = lines("---", "id: UC-001", "title: Load", "area: lending", "actors:", "  - Member", "realises:", "  - RULE ONE", "---", "# UC-001 Load", "", "**Goal.** Load.");
export const UC1_PATH = "docs/use-cases/UC-001-load.md";
const blobOf = async (text) => (await import("node:crypto")).createHash("sha1").update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest("hex");
const failedJob = lines("---", "id: JOB-20261028-1000-f001", "kind: implement", "works_on:", "  - ITM-007", "participant: dev-a", "model: example-model", "route: ci hosted", "started_by: alice",
  "start: 2026-10-28 10:00 UTC", "agent_m: unknown, commit unknown", "limit: 1", "---", "## Destinations", "", "## Parameters", "", "```json", "{}", "```", "", "## End", "", "at: 2026-10-28 11:00 UTC",
  "state: failed", "");

const runningJob = lines("---", "id: JOB-20261029-0900-r001", "kind: implement", "works_on:", "  - ITM-010", "participant: dev-a", "model: example-model", "route: ci hosted", "started_by: alice",
  "start: 2026-10-29 09:00 UTC", "agent_m: unknown, commit unknown", "limit: 1", "---", "## Destinations", "", "## Parameters", "", "```json", "{}", "```");

/** product({ model, files }) -> the files of the product, `files` laid over them (a path set to null is left out). */
export async function product({ model = MODELS.scrum, files = {} } = {}) {
  const base = {
    "SPEC.md": specOf("RULE ONE", "RULE TWO", "RULE THREE", "RULE FOUR"), "docs/process.md": declaration(), "docs/process-models/fixture.md": model,
    "docs/role-assignments/team1.md": assignment("team1", "alice", "dev-a"), "docs/role-assignments/team2.md": assignment("team2", "bob", "dev-b"),
    ...Object.fromEntries(Object.entries(MODULES).map(([id, uses]) => [`docs/architecture/${id}.md`, moduleFile(id, uses)])),
    [itemPath(1)]: itemText(1, { modules: ["MOD-store"] }), [itemPath(2)]: itemText(2, { modules: ["MOD-pages"], buildsOn: ["ITM-001"] }), [itemPath(3)]: itemText(3, { modules: ["MOD-mail"] }),
    [itemPath(4)]: itemText(4, { modules: ["MOD-feed"], buildsOn: ["ITM-003"] }), [itemPath(5)]: itemText(5, { modules: ["MOD-store"] }),
    [itemPath(6)]: itemText(6, { modules: ["MOD-mail"], realises: ["RULE NOT ACCEPTED"] }), [itemPath(7)]: itemText(7, { modules: ["MOD-news"], realises: ["RULE THREE"] }),
    [sprintPath("team1", 2)]: sprintText({ n: 2, goal: "Store and show", selection: ["ITM-001", "ITM-002"], branch: "sprint/team1/02" }),
    [itemPath(8)]: itemText(8, { modules: ["MOD-report"], realises: ["RULE FOUR"] }), [itemPath(9)]: itemText(9, { modules: ["MOD-pages"], realises: ["RULE FOUR"] }),
    [itemPath(10)]: itemText(10, { modules: ["MOD-news"], realises: ["RULE FOUR"] }),
    "docs/jobs/JOB-20261028-1000-f001.md": failedJob, "docs/jobs/JOB-20261029-0900-r001.md": runningJob, [UC1_PATH]: UC1, "docs/participants.md": PARTICIPANTS, "AGENTS.md": "# AGENTS.md of the instance\n",
    ".github/workflows/agent-m-jobs.yml": "name: agent-m jobs\n",
  };
  base[`docs/approvals/UC-001-${(await blobOf(UC1)).slice(0, 12)}.md`] = lines("kind: use-case", `file: ${UC1_PATH}`, `blob: ${await blobOf(UC1)}`);
  const merged = { ...base, ...files };
  for (const path of Object.keys(merged)) if (merged[path] === null) delete merged[path];
  return merged;
}

// ---------------------------------------------------------------- the pull requests

/** pr(number, title, state, opened, merged, { branch, base }) -> a pull request in the form of MOD-repository-hosts. */
export const pr = (number, item, state, opened, merged = null, { base = "main", branch = `work/${item}` } = {}) => ({ number, title: `${item}: the work of ${item}`, branch, base, head: String(number).repeat(40).slice(0, 40),
  state, draft: false, url: `${ADDRESS}/pull/${number}`, opened, merged, closed: merged, body: "", updated: merged ?? opened, mergeCommit: merged ? "f".repeat(40) : null });
export const PULL_REQUESTS = [pr(1, "ITM-001", "merged", "2026-10-20T09:00:00Z", "2026-10-21T10:00:00Z"), pr(2, "ITM-002", "open", "2026-10-21T12:00:00Z")];
const githubPull = (p) => ({ number: p.number, title: p.title, head: { ref: p.branch, sha: p.head }, base: { ref: p.base }, state: p.state === "open" ? "open" : "closed", merged_at: p.merged, merge_commit_sha: p.mergeCommit,
  created_at: p.opened, updated_at: p.updated, closed_at: p.closed, draft: false, html_url: p.url, body: p.body });

/** documentsOf(files) -> { sprints, items, architecture } — the sprint records, the backlog items and the module files of a product's files, as MOD-documents reads them for MOD-work-plans' functions. */
export function documentsOf(files) {
  const of = (pattern, schema) => Object.keys(files).filter((path) => pattern.test(path)).sort().map((path) => readDocument(schema, path, files[path]));
  return { sprints: of(/^docs\/backlog\/sprints\/[^/]+\/\d+\.md$/, planSchemas.sprint), items: of(/^docs\/backlog\/ITM-\d+-[^/]+\.md$/, artifactSchemas().item), architecture: of(/^docs\/architecture\/MOD-[^/]+\.md$/, artifactSchemas().module) };
}

// ---------------------------------------------------------------- a host in memory, for the functions of MOD-work-plans called without a page

const named = (name, message) => Object.assign(new Error(message), { name });
/**
 * memoryHost(files) -> { host, commits, files, branches } — the part of MOD-repository-hosts' interface that MOD-work-plans' saves use, over `files` held in memory. Each commit moves the head on and is kept in `commits`
 * (its branch, expected head, files and message); a commit whose expected head is not the head is refused with Moved, as the real host refuses it; `readHistory` lists the paths each commit changed, a deletion
 * among them, so that an identifier a commit withdrew is still held by the history.
 */
export function memoryHost(files) {
  const commits = [], branches = [], history = [];
  let head = 1;
  const sha = () => String(head).padStart(40, "0");
  const snapshot = () => ({ repository: { server: "github", path: REPO, web: ADDRESS }, ref: "main", commit: sha(), paths: Object.keys(files), blob: () => null, read: async (path) => (Object.hasOwn(files, path) ? files[path] : null),
    readMany: async () => {} });
  const host = {
    async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
    async readSnapshot() { return snapshot(); },
    async readHistory() { return [...history].reverse(); },
    async createBranch(branch, from) { branches.push({ branch, from }); },
    async commitFiles(change) {
      if (change.expectedHead !== sha()) throw named("Moved", `main has moved on to ${sha().slice(0, 12)} since it was read`);
      commits.push(structuredClone(change));
      history.push({ commit: sha(), changes: change.files.map((file) => ({ path: file.path, from: null })) });
      for (const file of change.files) { if (file.delete) delete files[file.path]; else files[file.path] = file.text; }
      head += 1;
      return { commit: sha(), url: `${ADDRESS}/commit/${sha()}` };
    },
  };
  return { host, commits, files, branches, get head() { return sha(); } };
}

// ---------------------------------------------------------------- the servers behind the page

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
/**
 * frozen(commit, files) -> a request handler that serves the product as it stood at `commit` — a commit the branch has moved on from — as GitHub serves an earlier commit: the commit, its tree, the batch reads
 * and the contents API at that commit. The fake of tests/app-harness.mjs serves the head alone, so a page drawn before another person's commit reads its own commit through this.
 */
export async function frozen(commit, files) {
  const api = `/repos/${REPO}`;
  const shas = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([path, text]) => [path, await blobSha(text)])));
  return async (url, init) => {
    if (url.origin !== "https://api.github.com") return undefined;
    const p = url.pathname;
    if (p === `${api}/commits/${commit}`) return json({ sha: commit });
    if (p === `${api}/git/commits/${commit}`) return json({ sha: commit, tree: { sha: "t".repeat(40) } });
    if (p === `${api}/git/trees/${commit}`) return json({ sha: "t".repeat(40), truncated: false, tree: Object.keys(files).sort().map((path) => ({ path, mode: "100644", type: "blob", sha: shas[path] })) });
    if (p.startsWith(`${api}/contents/`) && url.searchParams.get("ref") === commit) {
      const path = p.slice(`${api}/contents/`.length).split("/").map(decodeURIComponent).join("/");
      return path in files ? new Response(files[path], { status: 200 }) : new Response('{"message":"Not Found"}', { status: 404 });
    }
    if (p === "/graphql" && init.method === "POST") {
      const asks = [...JSON.parse(init.body).query.matchAll(/(f\d+):object\(expression:("(?:[^"\\]|\\.)*")\)/g)].map((m) => [m[1], JSON.parse(m[2])]).filter(([, expression]) => expression.startsWith(`${commit}:`));
      if (asks.length === 0) return undefined;
      return json({ data: { repository: Object.fromEntries(asks.map(([alias, expression]) => [alias, expression.slice(commit.length + 1) in files ? { text: files[expression.slice(commit.length + 1)], isTruncated: false } : null])) } });
    }
    return undefined;
  };
}
/** The model endpoints ep1 and ep2, answering `draft` once as the kind propose-items asks, recorded in `asked`. */
export function endpoints(draft, asked) {
  return async (url, init) => {
    if (!["https://ep1.example.test", "https://ep2.example.test"].includes(url.origin)) return undefined;
    asked.push({ origin: url.origin, body: JSON.parse(init.body) });
    return json({ choices: [{ message: { content: JSON.stringify({ draft, answers: [] }) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
  };
}
const endpointOf = (name, model) => JSON.stringify({ url: `https://${name}.example.test/v1`, kind: "openai-compatible", model, key: `k-${name}` });
/** The browser's settings of a page: the model endpoints ep1 and ep2, as MOD-browser-store keeps them. */
export const STORE = { prefix: "", storage: { getItem: (key) => (key === "endpoint:ep1" ? endpointOf("ep1", "model-a") : key === "endpoint:ep2" ? endpointOf("ep2", "model-b") : null) } };
const register = (...rows) => lines("# Participants of this instance", "", "**REGISTER**", "", "The participants of the test instance.", "", "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |",
  "|---|---|---|---|---|---|---|---|", ...rows);
const BUILDS = "read the repository, write to the repository, run code and tests, use tools";
export const PARTICIPANTS = register("| local-llm | model endpoint | model-a | 200000 | — | draft text | this machine | endpoint ep1 |",
  "| cloud-llm | model endpoint | model-b | 200000 | — | draft text | a provider in the USA | endpoint ep2 |",
  `| dev-a | model endpoint | model-c | 200000 | — | ${BUILDS} | this machine | ci hosted secret DEV_KEY |`, `| dev-b | model endpoint | model-d | 200000 | — | ${BUILDS} | this machine | ci hosted secret DEV_KEY |`);

/**
 * open(name, params, { files, pullRequests, server, store }) -> { target, srv, route, press, click, done, html } — the route `name` drawn for the product `files` behind the fake of GitHub with `pullRequests` (the fake
 * holds a list a test can replace through `pulls.list`), `server` the test's own request handlers; `press(element)` is a person's click awaited, `script(element)` a script's click. `done()` ends the page.
 */
export async function open(name, params = {}, { files, pullRequests = PULL_REQUESTS, server = [], store = {}, pulls = { list: pullRequests } } = {}) {
  const { view } = await import("../src/implementation-pages/index.mjs");
  for (const [at, strategies] of view.strategies.entries()) {
    try { registerStrategies(`tests/uc-032-harness.mjs#${at}`, strategies); } catch { /* registered already */ }
  }
  const route = view.routes.find((candidate) => candidate.name === name);
  const created = [];
  const pullsApi = (url) => {
    if (url.origin !== "https://api.github.com" || url.pathname !== `/repos/${REPO}/pulls`) return undefined;
    const state = url.searchParams.get("state") ?? "open";
    return json(pulls.list.filter((p) => state === "all" || (state === "open" ? p.state === "open" : p.state !== "open")).map(githubPull));
  };
  const refsApi = (url, init) => {
    if (url.origin !== "https://api.github.com" || url.pathname !== `/repos/${REPO}/git/refs` || init.method !== "POST") return undefined;
    const body = JSON.parse(init.body);
    created.push(body);
    return json({ ref: body.ref, object: { sha: body.sha } }, 201);
  };
  const srv = await repoServer({ files, handlers: [pullsApi, refsApi, ...server], head: HEAD });
  const real = globalThis.fetch;
  globalThis.fetch = srv.fetch;
  const host = connect(parseAddress(ADDRESS), { token: TOKEN });
  const handlers = [];
  const Element = globalThis.window.Element, add = Element.prototype.addEventListener;
  Element.prototype.addEventListener = function (type, listener, ...rest) { if (type === "click") handlers.push([this, listener]); return add.call(this, type, listener, ...rest); };
  globalThis.mermaid = { initialize() {}, mermaidAPI: { getDiagramFromText: async () => ({ db: { getVertices: () => ({}) } }) }, run: async () => {} };
  const target = globalThis.document.createElement("div");
  globalThis.document.body.append(target);
  const context = { page: "review", instance: { repository: REPO, host }, product: { address: ADDRESS, kind: "github", host, tokenStored: true, ref: "main" }, store, go() {} };
  const done = () => { Element.prototype.addEventListener = add; delete globalThis.mermaid; globalThis.fetch = real; };
  try { await route.render(target, context, params); } catch (failure) { done(); throw failure; }
  const settle = () => new Promise((resolve) => setTimeout(resolve, 30));
  const call = async (element, event) => {
    const listener = handlers.filter(([at]) => at === element).at(-1)?.[1];
    if (typeof listener !== "function") throw new Error("the element has no click listener");
    await listener(event);
    await settle();
  };
  return { target, srv, route, created, done, html: () => target.innerHTML, press: (element) => call(element, { isTrusted: true }), script: (element) => call(element, { isTrusted: false }) };
}

// ---------------------------------------------------------------- readings of the backlog page, and the Product Owner's two ways to add items

export const backlogOf = (page) => part(page.html(), 'data-part="backlog"');
export const itemsOf = (page) => [...backlogOf(page).matchAll(/<tr data-item="(ITM-\d{3})"/g)].map((m) => m[1]);
export const cell = (html, label) => plain(new RegExp(`data-label="${label}">([\\s\\S]*?)</td>`).exec(html)?.[1] ?? "");
export const entry = (title, over = {}) => ({ title, outcome: `What ${title} delivers.`, realises: ["RULE TWO"], modules: ["MOD-store"], buildsOn: [], acceptance: ["Unit tests of it."], class: "new", ...over });
export const backlogWrites = (page) => page.srv.writes.filter((write) => Object.keys(write.files).some((path) => path.startsWith("docs/backlog/ITM-")));
export async function proposing(files, draft) {
  const asked = [];
  const page = await open("backlog", {}, { files, server: [endpoints(draft, asked)], store: STORE });
  await page.press(found(page.target, "[data-propose-items]")[0]);
  await waitFor(() => classed(page.target, "run-panel").length > 0);
  return { page, asked };
}
export async function drafted(files, draft) {
  const run = await proposing(files, draft);
  await run.page.press(buttons(classed(run.page.target, "run-panel")[0], "Run")[0]);
  await waitFor(() => found(run.page.target, "[data-draft]").length > 0);
  return run;
}
export const keptBy = (page, id) => cell(row(backlogOf(page), id), "Held or kept");
export const planOf = async (page, team) => { await page.press(found(page.target, `[data-plan="${team}"]`)[0]); return part(page.html(), `data-plan-team="${team}"`); };
export const tickOf = (page, id) => found(page.target, `[data-select-item="${id}"]`)[0];
export const typeValue = (page, selector, value) => { found(page.target, selector)[0].value = value; };
export const planResult = (page) => plain(found(page.target, "[data-plan-result]")[0]?.innerHTML ?? "");
export const flash = (page) => plain(classed(page.target, "flash").map((node) => node.innerHTML).join(" "));

/** itemForm(page) -> { form, field(key), add(), errors() } — the person presses + Item; the form of the item schema is drawn. */
export async function itemForm(page) {
  await page.press(found(page.target, "[data-add-item]")[0]);
  await waitFor(() => classed(page.target, "schema-form").length > 0);
  const form = classed(page.target, "schema-form")[0];
  const field = (key) => walk(found(form, `[data-key="${key}"]`)[0], (node) => node.localName === "input")[0];
  return { form, field, add: () => buttons(form, "Add")[0], errors: () => classed(form, "error").map(textOf).join(" | ") };
}
/** fillItem(item, values) — the person types each value into its field. */
export async function fillItem(item, values) { for (const [key, value] of Object.entries(values)) await typeInto(item.field(key), value); }
/** The values of a complete item; a case leaves out or changes what it tests. */
export const COMPLETE_ITEM = { title: "Show the second rule by hand", level: "module", realises: "RULE TWO", tests: "unit", origin: "the Product Owner", modules: "MOD-news" };
/** writerOf(log) -> a request handler that notes each request that writes, with the authorisation it carries, and answers nothing (the fake of GitHub goes on to answer it). */
export const writerOf = (log) => async (url, init) => {
  if (url.origin === "https://api.github.com" && init.method !== "GET" && !(init.method === "POST" && url.pathname === "/graphql")) {
    log.push({ method: init.method, path: url.pathname, authorization: init.headers?.Authorization ?? init.headers?.authorization ?? null });
  }
  return undefined;
};
