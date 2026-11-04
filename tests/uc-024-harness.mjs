// The harness of the system and release tests of UC-024 (Implement the architecture): the real route `implement` of MOD-implementation-pages drawn into the fixture DOM over the real MOD-repository-hosts GitHub host, MOD-runtimes,
// MOD-product-process, MOD-work-plans, MOD-run-planner, MOD-job-runner and MOD-source-register, behind tests/app-harness.mjs' fake of GitHub's API for the product and the instance, with the parts of GitHub's API the pull
// requests of the jobs need (a pull request, its commits, files, reviews and checks, the runs of a commit, the merge, and greenToMerge's GraphQL field) answered here; the job check of UC-024 step 11, MOD-workflow-entries'
// onDoneCheck, run in a temporary git checkout as the job `agent-m done` lays it out; and a fake of a GitLab project's merge requests (1c). No request leaves the process. It holds no test and no expected result: what it
// builds are inputs, and every test states its own expected values.
// Imported by tests/system-uc-024-implement-the-architecture.test.mjs and tests/release-uc-024-implement-the-architecture.test.mjs.
//
// Module: MOD-implementation-pages
// Module: MOD-runtimes
// Module: MOD-repository-hosts
// Module: MOD-product-process
// Level: system
//
// Authored by developer-opus-e (ITM-740). The product is tests/uc-045-harness.mjs' planned product (alice/thesis-tool: the V-model, the system ARC-001, the subsystems ARC-002 designing MOD-store and MOD-pages, MOD-pages using
// MOD-store.read, and ARC-003 designing MOD-mail; the plan ITM-101 to ITM-106; the role assignment giving dev-a Developer and Tester and bob Reviewer), whose fixtures this file takes and does not change. The instance
// (akmaier/agent-m) holds, besides that harness's files, the register entry SRC-vibe-coding and the files of its version 2026-10-05 as this repository holds them, so that the job's chapters are read as a page reads them.
// The kinds' strategies are those the dashboard registers: the view's own, MOD-source-register's (the chapters of the book) and MOD-resource-list's (the resources' pins).

import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import "./site-frame-dom.mjs";
import { REPO, TOKEN, repoServer } from "./app-harness.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { sourceStrategies } from "../src/source-register/index.mjs";
import { resourceStrategies } from "../src/resource-list/index.mjs";
import { startRecord } from "../src/job-ledger/index.mjs";
import { blobSha } from "../src/text-tools/index.mjs";
import { ADDRESS, GATES, HEAD, PARTICIPANTS, PRODUCT_REPO, V_MODEL, SCRUM_MODEL, architecture, decision, declaration, found, instanceFiles, lines, modulePath, plain, planFiles, planned, pr, stepId, stepPath, stepText, textOf,
  walk, waitFor, ORDER_PATH } from "./uc-045-harness.mjs";
import { open as openScrum, product as scrumProduct, sprintPath, sprintText } from "./uc-032-harness.mjs";

export { ADDRESS, GATES, HEAD, PARTICIPANTS, PRODUCT_REPO, REPO, TOKEN, V_MODEL, SCRUM_MODEL, architecture, declaration, found, lines, modulePath, plain, planFiles, planned, pr, stepId, stepPath, stepText, textOf, walk,
  waitFor, ORDER_PATH, openScrum };

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(ROOT, path), "utf8");

// ---------------------------------------------------------------- the strategies and the instance

for (const [owner, strategies] of [["tests/uc-024-harness.mjs#sources", sourceStrategies], ["tests/uc-024-harness.mjs#resources", resourceStrategies]]) {
  try { registerStrategies(owner, strategies); } catch { /* registered already in this process */ }
}

/** The register entry of the book and the files of its version 2026-10-05, as the instance holds them. */
export const BOOK = (() => {
  const files = { "docs/sources/SRC-vibe-coding.md": read("docs/sources/SRC-vibe-coding.md") };
  for (const name of readdirSync(join(ROOT, "docs/sources/SRC-vibe-coding/2026-10-05"))) files[`docs/sources/SRC-vibe-coding/2026-10-05/${name}`] = read(`docs/sources/SRC-vibe-coding/2026-10-05/${name}`);
  return files;
})();
/** The instance's files: tests/uc-045-harness.mjs' instance (AGENTS.md, SPEC.md, the participants, the V-model), the book, and `over` laid over them. */
export const instance = (over = {}) => ({ ...instanceFiles(), ...BOOK, ...over });

/**
 * backlogProduct(files) -> the Scrum product of tests/uc-032-harness.mjs (the instance and the product one repository, akmaier/agent-m), with the decision ARC-001 its modules follow, the book, and team1's running sprint 02
 * selecting ITM-001 (done), ITM-002 (in progress) and ITM-003 (ready, MOD-mail); `files` laid over them. Opened with openScrum(name, params, { files }).
 */
export const backlogProduct = (files = {}) => scrumProduct({ files: { ...BOOK, "docs/architecture/ARC-001-the-whole.md": decision("ARC-001", "The whole", ["forced_by:", "  - UC-001"]),
  [sprintPath("team1", 2)]: sprintText({ n: 2, goal: "Store and show", selection: ["ITM-001", "ITM-002", "ITM-003"], branch: "sprint/team1/02" }), ...files } });

/** A unit test file of a module, declaring one test that guards RULE ONE and exercises `module`. */
export const testFileOf = (module, id = "TST-001") => lines(`// Module: ${module}`, "// Level: unit", "", `// ${id} · level: unit · module: ${module}`, "// guards: RULE ONE", "// given: g", "// input: i", "// expect: e",
  `test("${id}", () => {`, "  assert.equal(1, 1);", "});");

/** A job's start record: { path, text } of the job `id` of `kind` working on `worksOn`, by `participant`. */
export function jobRecord({ id = "JOB-20261101-0900-a1b2", kind = "implement", worksOn = ["ITM-101"], participant = "dev-a", params = { steps: worksOn, merges: "person" } } = {}) {
  return startRecord({ id, kind, worksOn, participant, model: "model-c", route: "ci hosted", run: null, retries: null, startedBy: "alice", start: new Date("2026-11-01T09:00:00Z"),
    agentM: { version: "unreleased", commit: HEAD }, inputs: [], limit: 5, destinations: [{ participant, place: "this machine", parts: [] }], params });
}

/**
 * A job's pull request, as the fake of GitHub serves it: `number`, its `job` (named in its description by the line `Job: <id>`, as MOD-runtimes' writer writes it), the step it works on, its
 * commits — each { sha, files, ci: "success" | "failure", checks? } — in order, and the checks of its head besides its CI (`done`: the state of the check `agent-m done`, null for none).
 */
export function jobPull({ number = 7, job = "JOB-20261101-0900-a1b2", step = "ITM-101", draft = false, commits = [{ sha: "1".repeat(40), files: ["tests/store.test.mjs"], ci: "failure" },
  { sha: "2".repeat(40), files: ["src/store/index.mjs"], ci: "success" }], done = "success" } = {}) {
  return { number, title: `${job}: implement ${step}`, branch: `agent-m/${job}`, base: "main", head: commits.at(-1).sha, state: "open", draft, url: `${ADDRESS}/pull/${number}`, opened: "2026-11-01T09:30:00Z",
    merged: null, closed: null, body: `Job: ${job}\nKind: implement\nPlan step: ${step}\nModules: MOD-store`, updated: "2026-11-01T09:30:00Z", mergeCommit: null, commits, done };
}

// ---------------------------------------------------------------- the page

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const conclusion = (ci) => (ci === "success" ? "success" : ci === "failure" ? "failure" : null);
const githubPull = (p) => ({ number: p.number, title: p.title, head: { ref: p.branch, sha: p.head }, base: { ref: p.base, sha: "b".repeat(40) }, state: p.state === "open" ? "open" : "closed", merged_at: p.merged,
  merge_commit_sha: p.mergeCommit, created_at: p.opened, updated_at: p.updated, closed_at: p.closed, draft: p.draft === true, html_url: p.url, body: p.body });

/**
 * openImplement(params, { files, instance, pullRequests, green, denyWrites, store }) -> { target, srv, inst, log, merges, press, script, done, html } — the route `implement` drawn for the product `files` (alice/thesis-tool)
 * and the instance `instance`, each behind tests/app-harness.mjs' fake of GitHub. `pullRequests` are the product's (pr() of tests/uc-045-harness.mjs, or jobPull() of this file, whose commits and checks are served);
 * `green` the answer of greenToMerge's GraphQL field — true (a rule requires a check), false (none does) or undefined (the fake's own answer); `denyWrites` refuses every write of a commit with 403, as GitHub refuses a
 * token that may not write. `log` holds each request that writes, `merges` each merge asked for. `press(element)` is a person's click awaited, `script(element)` a script's; `done()` ends the page.
 */
export async function openImplement(params = {}, { files, instance: instanceGiven = instance(), pullRequests = [], green, denyWrites = false, store = {}, name = "implement" } = {}) {
  const { view } = await import("../src/implementation-pages/index.mjs");
  for (const [at, strategies] of view.strategies.entries()) {
    try { registerStrategies(`tests/uc-024-harness.mjs#${at}`, strategies); } catch { /* registered already */ }
  }
  const route = view.routes.find((candidate) => candidate.name === name);
  const { srv, inst, log, merges, outside, host, instanceHost, restore } = await servers({ files, instance: instanceGiven, pullRequests, green, denyWrites });
  const handlers = [];
  const Element = globalThis.window.Element, add = Element.prototype.addEventListener;
  Element.prototype.addEventListener = function (type, listener, ...rest) { if (type === "click") handlers.push([this, listener]); return add.call(this, type, listener, ...rest); };
  globalThis.mermaid = { initialize() {}, mermaidAPI: { getDiagramFromText: async () => ({ db: { getVertices: () => ({}) } }) }, run: async () => {} };
  const target = globalThis.document.createElement("div");
  globalThis.document.body.append(target);
  const context = { page: "review", instance: { repository: REPO, host: instanceHost }, product: { address: ADDRESS, kind: "github", host, tokenStored: true, ref: "main" }, store, go() {} };
  const done = () => { Element.prototype.addEventListener = add; delete globalThis.mermaid; restore(); };
  try { await route.render(target, context, params); } catch (failure) { done(); throw failure; }
  const settle = () => new Promise((resolve) => setTimeout(resolve, 30));
  const call = async (element, event) => {
    const listener = handlers.filter(([at]) => at === element).at(-1)?.[1];
    if (typeof listener !== "function") throw new Error("the element has no click listener");
    await listener(event);
    await settle();
  };
  return { target, srv, inst, log, merges, outside, done, html: () => target.innerHTML, text: () => plain(target.innerHTML), press: (element) => call(element, { isTrusted: true }), script: (element) => call(element, { isTrusted: false }) };
}

/**
 * servers({ files, instance, pullRequests, green, denyWrites }) -> { srv, inst, log, merges, outside, host, instanceHost, restore } — the product's and the instance's fakes of GitHub as openImplement describes them, the global
 * `fetch` routed to them until `restore()`, and the real MOD-repository-hosts hosts of both, connected with the person's token.
 */
export async function servers({ files, instance: instanceGiven = instance(), pullRequests = [], green, denyWrites = false } = {}) {
  const merges = [];
  const api = `/repos/${PRODUCT_REPO}`;
  const pulls = (url, init) => {
    if (url.origin !== "https://api.github.com") return undefined;
    const p = url.pathname, page = Number(url.searchParams.get("page") ?? "1");
    const paged = (list) => json(page === 1 ? list : []);
    if (p === `${api}/pulls` && init.method === "GET") {
      const state = url.searchParams.get("state") ?? "open";
      return json(page === 1 ? pullRequests.filter((each) => state === "all" || (state === "open" ? each.state === "open" : each.state !== "open")).map(githubPull) : []);
    }
    const one = new RegExp(`^${api}/pulls/(\\d+)(/commits|/files|/reviews|/merge)?$`).exec(p);
    const pull = one ? pullRequests.find((each) => each.number === Number(one[1])) : null;
    if (one && pull) {
      if (!one[2]) return json(githubPull(pull));
      if (one[2] === "/merge" && init.method === "PUT") { merges.push({ number: pull.number, sha: JSON.parse(init.body).sha }); return json({ sha: "e".repeat(40), merged: true }); }
      if (one[2] === "/commits") return paged((pull.commits ?? []).map((c, at) => ({ sha: c.sha, parents: [{ sha: at ? pull.commits[at - 1].sha : "b".repeat(40) }], commit: { message: at ? "the code" : "the tests", committer: { date: `2026-11-01T09:0${at}:00Z` } } })));
      if (one[2] === "/files") return paged([...new Set((pull.commits ?? []).flatMap((c) => c.files))].map((filename) => ({ filename, status: "added" })));
      if (one[2] === "/reviews") return paged([]);
    }
    for (const pullOf of pullRequests) {
      for (const c of pullOf.commits ?? []) {
        const checks = [{ name: "node", status: "completed", conclusion: conclusion(c.ci), html_url: `${ADDRESS}/actions/runs/${c.sha.slice(0, 4)}/job/1` },
          ...(c.sha === pullOf.head && pullOf.done ? [{ name: "agent-m done", status: "completed", conclusion: pullOf.done, html_url: `${ADDRESS}/actions/runs/${c.sha.slice(0, 4)}/job/2` }] : [])];
        if (p === `${api}/commits/${c.sha}/check-runs`) return json({ total_count: page === 1 ? checks.length : 0, check_runs: page === 1 ? checks : [] });
        if (p === `${api}/commits/${c.sha}/statuses`) return paged([]);
        if (p === `${api}/commits/${c.sha}`) return json({ sha: c.sha, files: page === 1 ? c.files.map((filename) => ({ filename, status: "added" })) : [] });
      }
    }
    if (p === `${api}/actions/runs`) {
      const sha = url.searchParams.get("head_sha");
      const runs = pullRequests.flatMap((each) => each.commits ?? []).filter((c) => c.sha === sha).map((c) => ({ id: Number.parseInt(c.sha.slice(0, 4), 16), path: ".github/workflows/agent-m-tests.yml",
        head_sha: c.sha, event: "pull_request", status: "completed", conclusion: conclusion(c.ci), html_url: `${ADDRESS}/actions/runs/${c.sha.slice(0, 4)}`, run_started_at: "2026-11-01T09:10:00Z", updated_at: "2026-11-01T09:12:00Z" }));
      return json({ total_count: page === 1 ? runs.length : 0, workflow_runs: page === 1 ? runs : [] });
    }
    if (p === "/graphql" && green !== undefined && String(init.body ?? "").includes("refUpdateRule")) {
      return json({ data: { repository: { defaultBranchRef: { refUpdateRule: green ? { requiredStatusCheckContexts: ["agent-m tests"] } : null, rules: { nodes: [] } } } } });
    }
    if (denyWrites && init.method !== "GET" && p.startsWith(`${api}/git/`)) return json({ message: "Resource not accessible by personal access token" }, 403);
    return undefined;
  };
  const head = createHash("sha1").update(JSON.stringify(Object.entries(files).sort())).digest("hex");
  const srv = await repoServer({ files, handlers: [pulls], head, repo: PRODUCT_REPO });
  const inst = await repoServer({ files: instanceGiven, head: HEAD });
  const ofProduct = (url, init) => {
    if (url.pathname.startsWith(`/repos/${PRODUCT_REPO}`) || url.pathname.startsWith(`/${PRODUCT_REPO}/`)) return true;
    if (url.origin === "https://api.github.com" && url.pathname === "/graphql" && init?.body) return JSON.parse(init.body).variables?.name === PRODUCT_REPO.split("/")[1];
    return false;
  };
  const real = globalThis.fetch;
  const log = [], outside = [];
  globalThis.fetch = (input, init = {}) => {
    const url = new URL(String(input?.url ?? input));
    if (url.origin !== "https://api.github.com" && url.origin !== "https://raw.githubusercontent.com") { outside.push(url.href); return Promise.reject(new TypeError(`the test's network refuses ${url.href}`)); }
    const mine = ofProduct(url, init);
    if ((init.method ?? "GET") !== "GET" && url.pathname !== "/graphql") log.push({ repository: mine ? PRODUCT_REPO : REPO, method: init.method, path: url.pathname, authorization: init.headers?.Authorization ?? init.headers?.authorization ?? null });
    return (mine ? srv : inst).fetch(input, init);
  };
  const host = connect(parseAddress(ADDRESS), { token: TOKEN });
  const instanceHost = connect(parseAddress(`https://github.com/${REPO}`), { token: TOKEN });
  return { srv, inst, log, merges, outside, host, instanceHost, restore: () => { globalThis.fetch = real; } };
}

/** The steps of the page: [{ id, state, phase, selectable, ticked, reasons }]. */
export const stepRows = (page) => found(page.target, "[data-step]").map((row) => {
  const box = found(row, "[data-select-step]")[0];
  return { id: row.getAttribute("data-step"), state: row.getAttribute("data-state"), phase: row.getAttribute("data-phase"), selectable: box.getAttribute("disabled") === null,
    ticked: box.getAttribute("disabled") === null && (box.checked === undefined ? box.getAttribute("checked") !== null : box.checked === true), reasons: textOf(found(row, "[data-reasons]")[0] ?? { textContent: "" }) };
});
/** The part of the page for the job of `step`, and a field of it by its attribute (`participant`, `places`, `limit`, `merges`, `refactor`, `branch`, `gates`, `sent`, `none`, `withheld`). */
export const jobOf = (page, step) => found(page.target, `[data-job-of="${step}"]`)[0] ?? null;
export const fieldOf = (page, step, name) => found(page.target, `[data-${name}-of="${step}"]`)[0] ?? null;
/** The commits the product's fake received: { message, files }; the start records among their files. */
export const startRecords = (page) => page.srv.writes.flatMap((write) => Object.entries(write.files).filter(([path]) => /^docs\/jobs\/JOB-[^/]+\.md$/.test(path)).map(([path, text]) => ({ path, text })));
/** A time in which a write that a page started by itself would have been made (the fake of GitHub answers each request in a timer of its own). */
export const quiet = () => new Promise((resolve) => setTimeout(resolve, 400));

// ---------------------------------------------------------------- the job check of step 11 (MOD-workflow-entries' onDoneCheck in the job `agent-m done`)

const NO_GIT_CONFIG = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null", GIT_TERMINAL_PROMPT: "0" };
function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", env: NO_GIT_CONFIG });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${result.stderr}`);
  return result.stdout.trim();
}
function writeAll(root, files) {
  for (const [path, body] of Object.entries(files)) { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), body); }
}
function repository(folder, files) {
  mkdirSync(folder, { recursive: true });
  git(folder, "init", "-q", "-b", "main");
  git(folder, "config", "user.name", "Seed");
  git(folder, "config", "user.email", "seed@example.org");
  writeAll(folder, files);
  git(folder, "add", "-A");
  git(folder, "commit", "-q", "-m", "first");
  return git(folder, "rev-parse", "HEAD");
}

export const CHECK_JOB = "JOB-20261101-0900-c4d5";
export const FIRST = "1".repeat(40), SECOND = "2".repeat(40), BASE = "b".repeat(40);
/** The test of the step ITM-101 as the participant writes it: TST-001 guarding RULE ONE and exercising MOD-store. */
export const STORE_TEST = testFileOf("MOD-store");

/**
 * jobCheck({ commits, headGreen, kind, gates, contents, files }) -> Promise<{ outcome, findings, summary }> — the job `agent-m done` of the product's CI on the pull request #7 of the job CHECK_JOB, which works on the plan step ITM-101
 * (MOD-store, folder src/store/) of a V-model product: MOD-workflow-entries' onDoneCheck run in a temporary checkout of the product with the instance in its folder .agent-m, both git repositories, and the pull request's facts
 * read from a fake of GitHub's API. `commits` are the pull request's — { sha, files, ci } —, `headGreen` whether the run's own shards of the head ended green, `kind` the job's kind, `gates` laid over the gate records of
 * the product — the two of the V-model before the phase Implementation (docs/gates/20261030-1000-requirements-design-aaaa.md and docs/gates/20261030-1001-design-implementation-bbbb.md), each passed on the declaration's text; a path set to null is left out —, `contents` the texts of files at a commit (`<sha>:<path>`), `files` laid over the product's, `modified` the paths the pull request changes rather than adds.
 */
export async function jobCheck({ commits = [{ sha: FIRST, files: ["tests/store.test.mjs"], ci: "failure" }, { sha: SECOND, files: ["src/store/index.mjs"], ci: "success" }], headGreen = true, kind = "implement", gates = {},
  contents = {}, files = {}, modified = [] } = {}) {
  const root = mkdtempSync(join(tmpdir(), "agent-m-uc024-"));
  const checkout = join(root, "product");
  const { runEntry } = await import("../src/workflow-entries/main.mjs");
  try {
    const model = "src/model-catalogue/models/v-model.md";
    const instanceCommit = repository(join(checkout, ".agent-m"), { "SPEC.md": "# Spec\n", [model]: V_MODEL });
    const declared = lines("---", "model: v-model", `model_file: ${model}`, `model_version: ${instanceCommit}`, "---", "# Process", "", "## Practices", "", "- none", "", "## Branches", "", "| Phase or time box | Branch |", "|---|---|",
      "", "## Definition of Done", "", "The job rules hold; no condition is added.");
    const passedOn = `docs/process.md@${await blobSha(declared)}`;
    const record = (gate, n) => lines("---", `gate: ${gate}`, "job:", "decider: bob", "role: Reviewer", "decision: passed", "on:", `  - ${passedOn}`, "date: 2026-10-30 10:00 UTC", "---", `# ${gate}`, "", "## Reason", "", "Checked.");
    const gateFiles = { "docs/gates/20261030-1000-requirements-design-aaaa.md": record("Requirements → Design"), "docs/gates/20261030-1001-design-implementation-bbbb.md": record("Design → Implementation"), ...gates };
    const job = startRecord({ id: CHECK_JOB, kind, worksOn: ["ITM-101"], participant: "dev-a", model: "model-c", route: "ci hosted", run: null, retries: null, startedBy: "alice", start: new Date("2026-11-01T09:00:00Z"),
      agentM: { version: "unreleased", commit: instanceCommit }, inputs: [], limit: 2, destinations: [{ participant: "dev-a", place: "this machine", parts: [] }], params: { steps: ["ITM-101"] } });
    const base = { "README.md": "# Thesis tool\n", "docs/process.md": declared, ...architecture(), ...planFiles({ which: [101] }), [job.path]: job.text, "src/store/index.mjs": "export const read = () => 1;\n",
      "tests/store.test.mjs": STORE_TEST, ...gateFiles, ...files };
    for (const path of Object.keys(base)) if (base[path] === null) delete base[path];
    writeAll(checkout, base);
    git(checkout, "init", "-q", "-b", "main");
    git(checkout, "config", "user.name", "Seed");
    git(checkout, "config", "user.email", "seed@example.org");
    git(checkout, "add", ...Object.keys(base).map((path) => path.split("/")[0]).filter((top, at, all) => all.indexOf(top) === at));
    git(checkout, "commit", "-q", "-m", "the merge of the pull request");
    const event = join(root, "event.json"), summary = join(root, "summary.md");
    writeFileSync(event, JSON.stringify({ action: "synchronize", number: 7, pull_request: { number: 7 } }));
    writeAll(checkout, { "agent-m-reports/pull-request.unit.1.status": headGreen ? "done\n" : "failed\n", "agent-m-reports/records.status": "done\n" });
    const real = globalThis.fetch;
    globalThis.fetch = gitHubOfPull(commits, contents, modified, base);
    try {
      const status = await runEntry("onDoneCheck", { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "pull_request", GITHUB_EVENT_PATH: event, GITHUB_WORKSPACE: checkout, GITHUB_SERVER_URL: "https://github.com",
        GITHUB_REPOSITORY: PRODUCT_REPO, GITHUB_REF_NAME: "7/merge", GITHUB_SHA: "3".repeat(40), GITHUB_RUN_ID: "4711", GITHUB_JOB: "agent-m-done", GITHUB_ACTOR: "alice", GITHUB_STEP_SUMMARY: summary,
        AGENT_M_INSTANCE_COMMIT: "f".repeat(40), AGENT_M_EXPECTED: "unit:1", AGENT_M_TOKEN: TOKEN }, { now: new Date("2026-11-01T10:00:00Z") });
      return { ...status, shown: existsSync(summary) ? readFileSync(summary, "utf8") : "" };
    } finally { globalThis.fetch = real; }
  } finally { rmSync(root, { recursive: true, force: true }); }
}

// A fake of GitHub's REST API serving the pull request #7 of alice/thesis-tool of the job CHECK_JOB: its commits with their files and the check `node` of each commit's CI, its files, no review, and the texts of files at
// a commit (`contents`, keyed `<sha>:<path>`; at the head, the product's files unless given).
function gitHubOfPull(commits, contents, modified, headFiles) {
  const answer = (status, value) => new Response(typeof value === "string" ? value : JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
  const web = `https://github.com/${PRODUCT_REPO}`, head = commits.at(-1).sha;
  const changed = [...new Set(commits.flatMap((c) => c.files))];
  const status = (path) => (modified.includes(path) ? "modified" : "added");
  return async (address) => {
    const url = new URL(String(address)), path = url.pathname.replace(`/repos/${PRODUCT_REPO}`, ""), page = Number(url.searchParams.get("page") ?? "1");
    if (url.origin !== "https://api.github.com" || !url.pathname.startsWith(`/repos/${PRODUCT_REPO}`)) throw new TypeError(`the test's network refuses ${address}`);
    const paged = (list) => answer(200, page === 1 ? list : []);
    if (path === "/pulls/7") {
      return answer(200, { number: 7, title: `${CHECK_JOB}: implement ITM-101`, body: `Job: ${CHECK_JOB}\nKind: implement\nPlan step: ITM-101\nModules: MOD-store`, state: "open", draft: false, html_url: `${web}/pull/7`,
        created_at: "2026-11-01T09:10:00Z", merged_at: null, closed_at: null, merge_commit_sha: null, head: { ref: `agent-m/${CHECK_JOB}`, sha: head }, base: { ref: "main", sha: BASE } });
    }
    if (path === "/pulls/7/commits") return paged(commits.map((c, at) => ({ sha: c.sha, parents: [{ sha: at ? commits[at - 1].sha : BASE }], commit: { message: at ? "the code" : "the tests", committer: { date: `2026-11-01T09:0${at}:00Z` } } })));
    if (path === "/pulls/7/files") return paged(changed.map((filename) => ({ filename, status: status(filename) })));
    if (path === "/pulls/7/reviews") return paged([]);
    for (const c of commits) {
      if (path === `/commits/${c.sha}/check-runs`) {
        const runs = [{ name: "node", status: "completed", conclusion: c.ci, html_url: `${web}/actions/runs/47${c.sha.slice(0, 2)}/job/1` }];
        return answer(200, { total_count: page === 1 ? runs.length : 0, check_runs: page === 1 ? runs : [] });
      }
      if (path === `/commits/${c.sha}/statuses`) return paged([]);
      if (path === `/commits/${c.sha}`) return answer(200, { sha: c.sha, files: page === 1 ? c.files.map((filename) => ({ filename, status: status(filename) })) : [] });
    }
    const content = /^\/contents\/(.+)$/.exec(path);
    if (content) {
      const file = decodeURIComponent(content[1]), ref = url.searchParams.get("ref");
      const text = contents[`${ref}:${file}`] ?? (ref === head ? headFiles[file] ?? null : null);
      return text === null ? answer(404, { message: "Not Found" }) : answer(200, text);
    }
    throw new TypeError(`the fake GitHub does not serve ${path}`);
  };
}

// ---------------------------------------------------------------- a GitLab project's merge requests (1c)

/**
 * gitlabProject({ mr }) -> { host, merges, fetch } — the host of the GitLab project team/product on gitlab.example.org, connected with a project access token, behind a fake of GitLab's REST API v4 that serves the merge
 * request `mr` ({ iid, job, step, commits: [{ sha, files, ci }], done }): the list of open merge requests, the merge request, its commits and diffs, no approval, each commit's diff and newest pipeline, the jobs of the head's
 * pipeline (`node`, and `agent-m done` of the state `done`), and the merge. `fetch` replaces the global one while the host is used.
 */
export function gitlabProject({ mr }) {
  const origin = "https://gitlab.example.org", api = "/api/v4/projects/team%2Fproduct", merges = [];
  const answer = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json", "x-total-pages": "1" } });
  const head = mr.commits.at(-1).sha;
  const request = { iid: mr.iid, title: `${mr.job}: implement ${mr.step}`, description: `Job: ${mr.job}\nKind: implement\nPlan step: ${mr.step}`, source_branch: `agent-m/${mr.job}`, target_branch: "main", sha: head,
    state: "opened", draft: false, web_url: `${origin}/team/product/-/merge_requests/${mr.iid}`, created_at: "2026-11-01T09:30:00Z", diff_refs: { base_sha: "b".repeat(40) } };
  const pipelineOf = (sha) => { const at = mr.commits.findIndex((c) => c.sha === sha); return at < 0 ? null : { id: 900 + at, sha, status: mr.commits[at].ci === "success" ? "success" : "failed", web_url: `${origin}/team/product/-/pipelines/${900 + at}` }; };
  const fetch = async (address, init = {}) => {
    const url = new URL(String(address)), method = (init.method ?? "GET").toUpperCase(), page = Number(url.searchParams.get("page") ?? "1");
    if (url.origin !== origin || !url.pathname.startsWith(api)) throw new TypeError(`the test's network refuses ${address}`);
    const p = url.pathname.slice(api.length);
    const paged = (list) => answer(page === 1 ? list : []);
    if (p === "/merge_requests") return paged(url.searchParams.get("state") === "opened" || url.searchParams.get("state") === "all" ? [request] : []);
    if (p === `/merge_requests/${mr.iid}`) return answer(request);
    if (p === `/merge_requests/${mr.iid}/commits`) return paged(mr.commits.map((c, at) => ({ id: c.sha, message: at ? "the code" : "the tests", parent_ids: [at ? mr.commits[at - 1].sha : "b".repeat(40)], committed_date: `2026-11-01T09:0${at}:00Z` })));
    if (p === `/merge_requests/${mr.iid}/diffs`) return paged([...new Set(mr.commits.flatMap((c) => c.files))].map((path) => ({ old_path: path, new_path: path, new_file: true })));
    if (p === `/merge_requests/${mr.iid}/approvals`) return answer({ approved_by: [] });
    if (p === `/merge_requests/${mr.iid}/merge` && method === "PUT") { merges.push({ iid: mr.iid, sha: JSON.parse(init.body).sha }); return answer({ ...request, state: "merged", merge_commit_sha: "e".repeat(40) }); }
    const diff = /^\/repository\/commits\/([0-9a-f]{40})\/diff$/.exec(p);
    if (diff) return paged((mr.commits.find((c) => c.sha === diff[1])?.files ?? []).map((path) => ({ old_path: path, new_path: path, new_file: true })));
    if (p === "/pipelines") { const pipeline = pipelineOf(url.searchParams.get("sha")); return answer(pipeline ? [pipeline] : []); }
    const jobs = /^\/pipelines\/(\d+)\/jobs$/.exec(p);
    if (jobs) {
      const pipeline = pipelineOf(head);
      const list = Number(jobs[1]) === pipeline?.id ? [{ id: 1, name: "node", status: pipeline.status, web_url: `${origin}/team/product/-/jobs/1` }, ...(mr.done ? [{ id: 2, name: "agent-m done", status: mr.done, web_url: `${origin}/team/product/-/jobs/2` }] : [])] : [];
      return paged(list);
    }
    throw new TypeError(`the fake GitLab does not serve ${method} ${p}`);
  };
  const host = connect(parseAddress(`${origin}/team/product`), { token: "glpat-ALICEteamPRODUCT0123456789ab" });
  return { host, merges, fetch };
}
