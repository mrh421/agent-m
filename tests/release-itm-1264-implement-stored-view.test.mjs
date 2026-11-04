// Release tests of ITM-1264, narrowed to `#implement` — the route judges its items from the head's backlog view, and lists the open pull requests of the jobs with the Definition of Done the head's check
// `agent-m done` gave — seen from outside: what the page asks of the product's host, and what it shows. The behaviour is docs/architecture/MOD-implementation-pages.md's (`implement`: "In a model that
// works from a backlog, it takes every item's state, hold and what keeps it from a team from the backlog's view of the head (MOD-progress-measures' `storedView`, `asOf` null), and reads besides only the
// declaration, the declared model's file, the role assignments and the running sprints' records, from which `startable` judges each item; while the head's view is not stored yet, it says so and offers no
// *Start jobs*, and where the repository stores no view, it derives the same view in the page from the facts of the scope `work`. ... The pull requests it shows are the open ones that name a job
// (`listPullRequests` with the state `open`), and the records of those jobs, in one batch; whether the Definition of Done holds is the result of the check `agent-m done` among the runs of the head
// (MOD-workflow-entries' `onDoneCheck`), and no gate record or module file is read for it."), the requirements PROGRESS AND JOB STATE ARE DERIVED, NOT STORED, A PAGE LOAD READS THE REPOSITORY IN BATCHES and
// A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS, UC-034 (steps 2 and 8: an item starts only where it is ready and selected, a pull request is merged once the Definition of Done holds) and
// UC-024 (steps 11 to 13: the pull request, its runs, its merge).
// Run: node --test tests/release-itm-1264-implement-stored-view.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-034; UC-024; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; A PAGE LOAD READS THE REPOSITORY IN BATCHES; A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS
// Level: release
//
// Written for the release testing of sprint 113 by a participant who implemented none of ITM-1264 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The implementers' cases
// (tests/implementation-pages-implement-stored-view.test.mjs and the route's other tests) take one fixture over a counting fake of GitHub; these cases take their own product and walk what the page meets:
// views written by hand that say other words than the product's files do (so that a page that derived would show the files' words), views that CI stored by publishOverview, the boundaries of which view is
// read (the head's, the one stored last, none, one that cannot be used), the holds and the running sprints a view names, and the pull requests of the jobs with each state of the head's check `agent-m done`.
// The product, its host and the DOM are this file's own; the host stands in for MOD-repository-hosts' interface (repositoryInfo, readSnapshot with readMany and readOn, listPullRequests, pullRequestFacts,
// listCiRuns, containsCommit, mergePullRequest, commitFiles) and logs every request of a page; no request leaves the process. Readings the texts leave open, taken here:
//   - "the declaration, the declared model's file, the role assignments and the running sprints' records, in one batch" (the item's Acceptance) is read as one batch of the product that holds the declaration,
//     the role assignments and the running sprints' records, and one read of the declared model's file at the commit the declaration names, through the instance's readFileAt, which only the declaration gives.
//   - "the records of those jobs, in one batch" is read as one batch of the product that holds the record of each job an open pull request names, and no other record.
//   - the running sprints are those the head's view names (`teams[].running`); a sprint file of the product that the view does not name as running is not read.
//   - the check `agent-m done` of the head is its run: <p data-done data-holds="true|false"> links it where the host lists one; Merge (<button data-merge-pull>) is offered only where it passed.

import "./site-frame-dom.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import * as measures from "../src/progress-measures/index.mjs";

const { view } = await import("../src/implementation-pages/index.mjs");
const { registerStrategies } = await import("../src/job-runner/index.mjs");
const { startRecord } = await import("../src/job-ledger/index.mjs");

// ---------------------------------------------------------------- the fixture DOM
//
// The selectors this route uses, as a browser answers them: [attr] and [attr="value"]; and the listeners of the click events kept by element, so that a test presses a button as a person does.

const matches = (element, selector) => {
  const attribute = /^\[([a-z-]+)(?:="([^"]*)")?\]$/.exec(selector);
  return attribute ? (attribute[2] === undefined ? element.getAttribute(attribute[1]) !== null : element.getAttribute(attribute[1]) === attribute[2]) : false;
};
const found = (root, selector) => {
  const all = [];
  (function walk(node) { for (const child of node.childNodes) if (child.nodeType === 1) { if (matches(child, selector)) all.push(child); walk(child); } })(root);
  return all;
};
globalThis.window.Element.prototype.querySelectorAll = function querySelectorAll(selector) { return found(this, selector); };
globalThis.window.Element.prototype.querySelector = function querySelector(selector) { return found(this, selector)[0] ?? null; };
globalThis.SVGElement ??= class SVGElement {};
const text = (node) => node.textContent.replace(/\s+/g, " ").trim();

// ---------------------------------------------------------------- the strategies the kind `implement` names: stand-ins (the real ones are other modules')
const part = (name) => ({ name, text: name, size: 0, sources: [], required: true });
registerStrategies("tests/release-itm-1264-implement-stored-view.test.mjs", {
  recipes: { "implementation-inputs": async (_, params) => [part(`inputs of ${(params.items ?? []).join(", ")}`)], "chapters-for-implementation": async () => [part("chapters 9, 11, 12 and 13")],
    "resource-pins": async () => [] },
  preconditions: { "rests-on-accepted": async () => [] },
  writers: { "branch-and-pull-request": async () => ({ commits: [], files: [], pullRequest: null, shown: null, notes: [] }) },
});

// ---------------------------------------------------------------- the product
//
// One team, alpha, under a Scrum model: its sprint 07 runs and selects ITM-101 to ITM-106 and ITM-108. ITM-101 is merged by pull request 1; ITM-102 to ITM-105 each have an open pull request of a job (2 to 5);
// ITM-106 is ready and selected; ITM-107 is ready and selected by no sprint; ITM-108 realises a requirement the SPEC does not hold. A pull request 6 names no job. The job JOB-…-0707 stands in the
// repository and no pull request names it. A gate record, five module files and the item files stand in the repository and no page of this route has a reason to read them.

const lines = (...rows) => `${rows.join("\n")}\n`;
const blobOf = (content) => createHash("sha1").update(content).digest("hex");
const ADDRESS = "https://github.com/acme/ledger";
const COMMIT = "c".repeat(40);
const C0 = "0c".repeat(20);
const BRANCH_HEAD = "b".repeat(40);
const MODEL_FILE = "docs/process-models/fixture.md";
const MODEL_VERSION = "a".repeat(40);
const RUNNING = "docs/backlog/sprints/alpha/07.md";
const NEWER = "docs/backlog/sprints/alpha/08.md";
const ASSIGNMENT = "docs/role-assignments/alpha.md";
const DECLARATION_PATH = "docs/process.md";
const GATE = "docs/gates/20261021-1000-building-checking-aaaa.md";
const MODULES = ["MOD-store", "MOD-pages", "MOD-mail"].map((id) => `docs/architecture/${id}.md`);
const modelText = (name) => readFileSync(new URL(`./fixtures/flow/${name}.md`, import.meta.url), "utf8");

const SPEC = lines("# SPEC", "", "## 1. Rules", "", "**RULE ALPHA** *(PO)*", "The first rule.", "*Check:* no automatic check; at review.");
const declaration = (model) => lines("---", `model: fixture-${model}`, `model_file: ${MODEL_FILE}`, `model_version: ${MODEL_VERSION}`, "---", "# How the product is developed", "",
  "## Practices", "", "- none", "", "## Definition of Done", "", "The job rules hold.");
const assignment = lines("# alpha", "", "## Roles", "", "| Role | Participants |", "|---|---|", "| Owner | carol |", "| Builders | dev-a |", "| Checker | dev-a |");
const itemPath = (n) => `docs/backlog/ITM-${n}-item-${n}.md`;
const item = (n, module, realises = "RULE ALPHA") => lines("---", `id: ITM-${n}`, `title: The files' title of item ${n}`, "level: module", "realises:", `  - ${realises}`, "modules:", `  - ${module}`,
  "builds_on: []", "tests:", "  - unit", "origin:", "  - RULE ALPHA", "---", `# ITM-${n} The files' title of item ${n}`, "", "## Outcome", "", `What item ${n} delivers.`, "", "## Acceptance", "", "- a unit test.");
const sprint = ({ n, start, goal, selection }) => lines("---", `sprint: ${n}`, `goal: ${goal}`, `start: ${start}`, "end:", "closer: carol", "branch:", "selection:", ...selection.map((each) => `  - ${each}`), "---", `# Sprint ${n}`);
const moduleFile = (id) => lines("---", `id: ${id}`, `title: The module ${id}`, `folder: src/${id.slice(4)}/`, "realises:", "  - RULE ALPHA", "follows:", "  - ARC-001", "uses: []", "provides:", "  - read",
  "---", `# ${id} The module ${id}`);
const gateFile = lines("---", "gate: Building → Checking", "decider: carol", "role: Owner", "decision: passed", "on:", `  - ${ADDRESS}/pull/3`, "date: 2026-10-21 10:00 UTC", "---", "# Building → Checking");

const JOB = { 1: "JOB-20261021-1200-0101", 2: "JOB-20261021-1200-0202", 3: "JOB-20261021-1200-0303", 4: "JOB-20261021-1200-0404", 5: "JOB-20261021-1200-0505", unnamed: "JOB-20261021-1200-0707" };
const jobFile = (id, worksOn) => startRecord({ id, kind: "implement", worksOn: [worksOn], participant: "dev-a", model: "model-a", route: "ci hosted", run: null, retries: null, startedBy: "carol",
  start: new Date("2026-10-21T09:00:00Z"), agentM: { version: "2026.10.0", commit: COMMIT }, inputs: [], limit: 5, destinations: [], params: { items: [worksOn], merges: "person" } }).text;

const ROOT = new URL("../", import.meta.url);
const REGISTER_HEAD = readFileSync(new URL("docs/participants.md", ROOT), "utf8").split("\n").filter((row, at, all) => at <= all.findIndex((each) => each.startsWith("|---"))).join("\n");
const REGISTER = `${REGISTER_HEAD}\n| dev-a | model endpoint | model-a | 200000 | — | read the repository, write to the repository, run code and tests, use tools | this machine | ci hosted secret DEV_KEY |\n`;

const productFiles = (model = "scrum", extra = {}) => ({
  "SPEC.md": SPEC, [DECLARATION_PATH]: declaration(model), [ASSIGNMENT]: assignment,
  [itemPath(101)]: item(101, "MOD-store"), [itemPath(102)]: item(102, "MOD-pages"), [itemPath(103)]: item(103, "MOD-mail"), [itemPath(104)]: item(104, "MOD-store"), [itemPath(105)]: item(105, "MOD-pages"),
  [itemPath(106)]: item(106, "MOD-mail"), [itemPath(107)]: item(107, "MOD-store"), [itemPath(108)]: item(108, "MOD-pages", "RULE NOT ACCEPTED"),
  [RUNNING]: sprint({ n: 7, start: "2026-10-20", goal: "Judge from the view", selection: ["ITM-101", "ITM-102", "ITM-103", "ITM-104", "ITM-105", "ITM-106", "ITM-108"] }),
  ...Object.fromEntries(MODULES.map((path) => [path, moduleFile(path.slice(18, -3))])), [GATE]: gateFile,
  ".github/workflows/agent-m-jobs.yml": "name: agent-m jobs\n",
  ...Object.fromEntries([[1, "ITM-101"], [2, "ITM-102"], [3, "ITM-103"], [4, "ITM-104"], [5, "ITM-105"], ["unnamed", "ITM-199"]].map(([n, worksOn]) => [`docs/jobs/${JOB[n]}.md`, jobFile(JOB[n], worksOn)])),
  ...extra,
});
const JOB_RECORDS = [2, 3, 4, 5].map((n) => `docs/jobs/${JOB[n]}.md`);

// The pull requests: 1 merged, 2 to 5 open and naming a job, 6 open and naming none. The first commit of each stands apart from its head; the head's check `agent-m done` is
// passed on 2, failed on 3, pending on 4 and not listed on 5.
const FIRST = Object.fromEntries([1, 2, 3, 4, 5, 6].map((n) => [n, `${n}a`.repeat(20)])), LAST = Object.fromEntries([1, 2, 3, 4, 5, 6].map((n) => [n, `${n}b`.repeat(20)]));
const DONE = { 2: "success", 3: "failure", 4: "pending" };
const doneRun = (n) => `${ADDRESS}/actions/runs/${n}01/job/${n}02`;
const runUrl = (n, which) => `${ADDRESS}/actions/runs/${n}0${which}`;
const pr = (number, id, state, body) => ({ number, title: `${id}: the work of ${id}`, branch: `work/${id}`, base: "main", head: LAST[number], state, draft: false, url: `${ADDRESS}/pull/${number}`,
  opened: "2026-10-21T12:00:00Z", merged: state === "merged" ? "2026-10-21T13:00:00Z" : null, closed: state === "merged" ? "2026-10-21T13:00:00Z" : null, body, updated: "2026-10-21T12:00:00Z",
  mergeCommit: state === "merged" ? "f".repeat(40) : null });
const PULLS = [pr(1, "ITM-101", "merged", `Job: ${JOB[1]}\nKind: implement\n`), pr(2, "ITM-102", "open", `Job: ${JOB[2]}\nKind: implement\n`), pr(3, "ITM-103", "open", `Job: ${JOB[3]}\nKind: implement\n`),
  pr(4, "ITM-104", "open", `Job: ${JOB[4]}\nKind: implement\n`), pr(5, "ITM-105", "open", `Job: ${JOB[5]}\nKind: implement\n`), pr(6, "Tidy the README", "open", "No job made this.\n")];

// ---------------------------------------------------------------- the hosts
//
// The product's host logs what it is asked, into `log`: `tree <ref>` for a snapshot, `file <path>` for a file read by itself, `batch <n>` for a readMany that fetches n files (`batches` keeps their paths,
// `reads` the path of every file read, either way), `on <branch> <path>` for a readOn, `pulls <state>` for a listing of pull requests (`listings` keeps the state asked), `contains`, `info`, `facts <n>`
// for pullRequestFacts, `ci <sha>` for listCiRuns and `merge <n>` for mergePullRequest (`merges` keeps number and head). `overview` holds the files of the branch overview-cache by path (null: no such branch);
// a commit to that branch adds its files to it, so that a view CI stored is the view a page then reads.

const named = (name, message) => Object.assign(new Error(message), { name });
const unsupported = (what) => async () => { throw named("NotSupported", what); };

function productHost({ files, overview = null, pullRequests = PULLS, log, batches, reads, listings, facts, merges, commits }) {
  const snapshot = (ref) => {
    const fetched = new Set();
    log.push(`tree ${ref}`);
    return {
      repository: { server: "github", path: "acme/ledger", web: ADDRESS }, ref, commit: COMMIT, paths: Object.keys(files),
      blob: (path) => (Object.hasOwn(files, path) ? blobOf(files[path]) : null),
      read: async (path) => { if (Object.hasOwn(files, path) && !fetched.has(path)) { fetched.add(path); reads.push(path); log.push(`file ${path}`); } return Object.hasOwn(files, path) ? files[path] : null; },
      readMany: async (paths) => {
        const wanted = [...new Set(paths)].filter((path) => Object.hasOwn(files, path) && !fetched.has(path));
        wanted.forEach((path) => { fetched.add(path); reads.push(path); });
        if (wanted.length) { batches.push(wanted); log.push(`batch ${wanted.length}`); }
      },
      readOn: async (branch, path) => {
        log.push(`on ${branch} ${path}`);
        return branch === "overview-cache" && overview !== null && Object.hasOwn(overview, path) ? overview[path] : null;
      },
    };
  };
  return {
    async repositoryInfo() { log.push("info"); return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
    async readSnapshot(ref) {
      if (ref === "overview-cache") {
        if (overview === null) throw named("NotFound", "no branch overview-cache");
        return { commit: BRANCH_HEAD, paths: Object.keys(overview) };
      }
      if (ref === "test-results") throw named("NotFound", "no branch test-results");
      return snapshot(ref);
    },
    async listPullRequests(filter) {
      const state = filter?.state ?? "all";
      listings.push(state);
      log.push(`pulls ${state}`);
      return pullRequests.filter((each) => state === "all" || each.state === state);
    },
    async pullRequestFacts(number) {
      facts.push(number);
      log.push(`facts ${number}`);
      return { pullRequest: { head: LAST[number] }, commits: [{ sha: FIRST[number], message: "tests", files: [], ci: null }, { sha: LAST[number], message: "code", files: [], ci: null }], files: [], reviews: [],
        checks: number in DONE ? [{ name: "agent-m done", state: DONE[number], url: doneRun(number) }, { name: "tests", state: "success", url: runUrl(number, 1) }] : [] };
    },
    async listCiRuns({ commit } = {}) {
      log.push(`ci ${commit}`);
      const n = [1, 2, 3, 4, 5, 6].find((each) => FIRST[each] === commit || LAST[each] === commit);
      return n === undefined ? [] : [{ id: `${n}0${commit === FIRST[n] ? 0 : 1}`, url: runUrl(n, commit === FIRST[n] ? 0 : 1), state: commit === FIRST[n] ? "failure" : "success" }];
    },
    async mergePullRequest(number, expectedHead) { merges.push([number, expectedHead]); log.push(`merge ${number}`); return { commit: "e".repeat(40) }; },
    async containsCommit() { log.push("contains"); return false; },
    async commitFiles(change) {
      commits.push(change);
      if (change.branch === "overview-cache") for (const file of change.files) overview[file.path] = file.text ?? file.bytes;
      return { commit: "d".repeat(40), url: "https://example.org/d" };
    },
    readHistory: async () => [], listTags: unsupported("the tags"),
  };
}

// The instance: its SPEC, the participants and the process model of the product's declaration, as a snapshot (the facts read the model there) and through readFileAt (the route reads it so).
function instanceHost(model, log) {
  const files = { "SPEC.md": "# Instance\n", "docs/participants.md": REGISTER, [MODEL_FILE]: modelText(model) };
  const snapshot = { repository: { server: "github", path: "acme/agent-m", web: "https://github.com/acme/agent-m" }, ref: "main", commit: "1".repeat(40), paths: Object.keys(files),
    blob: (path) => (Object.hasOwn(files, path) ? blobOf(files[path]) : null), read: async (path) => files[path] ?? null, readMany: async () => {} };
  return {
    async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
    async readSnapshot() { return snapshot; },
    async readFileAt(path, atCommits) { log.push(`readFileAt ${path} ${atCommits.join(",")}`); return new Map(atCommits.map((at) => [at, files[path] ?? null])); },
    async listPullRequests() { log.push("instance pulls"); return []; },
    readHistory: async () => [], listTags: unsupported("the tags"), listCiRuns: unsupported("the runs"),
  };
}

// The route `implement` rendered over the product: what the host was asked, the page, and press(element) — a person's click, awaited.
async function render({ model = "scrum", overview = null, pullRequests = PULLS, files = productFiles(model), params = {} } = {}) {
  const route = view.routes.find((candidate) => candidate.name === "implement");
  const out = { log: [], batches: [], reads: [], listings: [], facts: [], merges: [], commits: [], instanceLog: [] };
  const product = productHost({ files, overview, pullRequests, ...out });
  const instance = instanceHost(model, out.instanceLog);
  const handlers = [];
  const Element = globalThis.window.Element, add = Element.prototype.addEventListener;
  Element.prototype.addEventListener = function (type, listener, ...rest) { if (type === "click") handlers.push([this, listener]); return add.call(this, type, listener, ...rest); };
  globalThis.mermaid = { initialize() {}, mermaidAPI: { getDiagramFromText: async () => ({ db: { getVertices: () => ({}) } }) }, run: async () => {} };
  const target = globalThis.document.createElement("div");
  globalThis.document.body.append(target);
  const context = { page: "review", instance: { repository: "acme/agent-m", host: instance }, product: { address: ADDRESS, kind: "github", host: product, tokenStored: true, ref: "main" }, store: {}, go() {} };
  await route.render(target, context, params);
  const press = async (element, event = { isTrusted: true }) => {
    const listener = handlers.filter(([at]) => at === element).at(-1)?.[1];
    if (typeof listener !== "function") throw new Error("the element has no click listener");
    await listener(event);
    await new Promise((resolve) => setTimeout(resolve, 30));
  };
  return { ...out, target, html: () => target.innerHTML, press, done: () => { Element.prototype.addEventListener = add; delete globalThis.mermaid; } };
}

// What CI stores: the facts of the scope `all` over the product, and publishOverview to an overview-cache that exists (empty): { overview, commits }.
async function published(model = "scrum") {
  const overview = {}, out = { log: [], batches: [], reads: [], listings: [], facts: [], merges: [], commits: [] };
  const product = productHost({ files: productFiles(model), overview, pullRequests: PULLS, ...out });
  const instance = instanceHost(model, []);
  const snapshot = await product.readSnapshot("main");
  const factsOf = await measures.productFacts(product, await instance.readSnapshot("main"), () => instance.readSnapshot("main"), new Date("2026-10-22T12:00:00Z"), { scope: "all" });
  await measures.publishOverview(product, snapshot, factsOf);
  return { overview, commits: out.commits };
}

// ---------------------------------------------------------------- the views stored on overview-cache, written by hand
//
// A BacklogView in the format of the module file that says other words than the product's files do, so that a page that derived would show the files' words. The product's files make ITM-102 in progress, ITM-106 ready,
// ITM-103 to ITM-105 in progress, ITM-107 ready and ITM-108 waiting for acceptance; and give no ITM-199.

const gz = (value) => new Uint8Array(gzipSync(JSON.stringify(value)));
const state = (id, name, reason = null) => ({ item: id, state: name, reason, job: null, pullRequest: null });
const MODEL = (wip) => ({ name: "fixture", kind: "pulled", sprints: true, wip, measure: "remaining items per time box" });
const heldBy = (id) => ({ item: id, team: "alpha", sprint: "alpha/07", changes: ["MOD-pages"], uses: [] });
const row = (id, name, reason = null, held = null) => ({ item: id, path: `docs/backlog/${id}-item.md`, title: `Stored title of ${id}`, realises: ["RULE ALPHA"], state: state(id, name, reason), held, kept: [] });
const alpha = (running) => ({ team: "alpha", owner: "carol", running, lastEnded: null });
const running = (path, selection) => ({ name: path.slice(22, -3), path, goal: "Stored goal", closer: "carol", selection });
const backlog = ({ commit = COMMIT, rows, teams = [alpha(running(RUNNING, ["ITM-102", "ITM-106"]))], wip = null }) => ({ commit, declared: true, modelFile: MODEL_FILE, modelUnread: null, model: MODEL(wip), teams, rows,
  uncovered: { requirements: [], useCases: [] } });
const head = (value) => ({ [`${COMMIT}.backlog.json.gz`]: gz(value) });
const last = (value) => ({ "latest.json": `${JSON.stringify({ commit: C0 })}\n`, [`${C0}.backlog.json.gz`]: gz(value) });

// What the page lists: [{ item, state, startable }] in order, and the reasons of an item.
const rowsOf = (target) => found(target, "[data-item]").map((each) => ({ item: each.getAttribute("data-item"), state: each.getAttribute("data-state"), startable: each.getAttribute("data-startable") }));
const rowOf = (target, id) => found(target, `[data-item="${id}"]`)[0];
const reasons = (target, id) => found(rowOf(target, id), "[data-reasons]").map(text).join(" ");
const holders = (target, id) => found(rowOf(target, id), `[data-participant-of="${id}"]`).map(text).join(" ");
const AS_OF = (commit) => new RegExp(`As of ${commit.slice(0, 7)}: the view of the newest commit is being stored\\.`);
const cacheReads = (log) => log.filter((entry) => entry.startsWith("on overview-cache "));

// ================================================================== the tests

// TST-1264301 · level: release · module: MOD-implementation-pages
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-034
// given: overview-cache holding a backlog view of the head ccc…c whose rows say ITM-102 ready, ITM-106 waiting for the item ITM-199, ITM-107 ready and ITM-199 ready — words the product's files do not say: they make ITM-102 in progress, ITM-106 ready, and hold no ITM-199 —; alpha's running sprint 07 selects ITM-102 and ITM-106 and ITM-107 is selected by none; dev-a holds Builders in alpha's assignment
// input: the route implement rendered, given the branch it shows
// expect: the page lists exactly the view's rows ITM-102, ITM-106, ITM-107 and ITM-199, with the view's states; ITM-102 is startable and offers dev-a; ITM-106 is not and names ITM-199; ITM-107 and ITM-199 are not and say they are not selected; none of the product's other items (ITM-103 to ITM-105, ITM-108) is a row
// Planted fault: a route that derives the view although one is stored (the stored branch of viewOf in src/implementation-pages/backlog.mjs left out) lists ITM-102 in progress and ITM-103 to ITM-108, and no ITM-199; a route that judges an item by the state its pull request gives, not the view's, fails ITM-102.
test("TST-1264301 #implement lists the head's stored view's rows with the view's states, and judges each item from them", async () => {
  const page = await render({ overview: head(backlog({ rows: [row("ITM-102", "ready"), row("ITM-106", "waiting for an item it builds on", "ITM-199"), row("ITM-107", "ready"), row("ITM-199", "ready")] })) });
  try {
    assert.deepEqual(rowsOf(page.target), [{ item: "ITM-102", state: "ready", startable: "true" }, { item: "ITM-106", state: "waiting for an item it builds on", startable: "false" },
      { item: "ITM-107", state: "ready", startable: "false" }, { item: "ITM-199", state: "ready", startable: "false" }], page.html().slice(0, 3000));
    assert.match(holders(page.target, "ITM-102"), /dev-a/, "a holder of Builders in alpha's assignment is offered");
    assert.match(reasons(page.target, "ITM-106"), /ITM-199/);
    assert.match(reasons(page.target, "ITM-107"), /not selected/);
    assert.match(reasons(page.target, "ITM-199"), /not selected/);
    assert.deepEqual(cacheReads(page.log), [`on overview-cache ${COMMIT}.backlog.json.gz`], "one read of overview-cache");
  } finally { page.done(); }
});

// TST-1264302 · level: release · module: MOD-implementation-pages
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; NO JOB STARTS ABOVE THE WORK-IN-PROGRESS LIMIT; UC-034
// given: the product under the Scrum model whose limit is 2; a backlog view of the head that holds ITM-102 ready, and ITM-103 and ITM-104 in progress, each held by alpha's sprint 07; and, for the counter-proofs, the same view with ITM-104 not held, and with ITM-104 not in progress
// input: the route implement rendered over each of the three views
// expect: over the first ITM-102 is not startable and its reason names the limit of 2 and the items ITM-103 and ITM-104 in progress under alpha; over the second, where ITM-104 is in progress and held by no sprint, ITM-102 is startable; over the third, where one item is held and in progress, ITM-102 is startable
// Planted fault: a route that hands startable no holds (the `held` of the view's rows in `draw` of src/implementation-pages/implement.mjs left out, so `held` is empty) counts no item under alpha and offers ITM-102 over the first view; a route that counts the product's in-progress items whatever their hold fails the second.
test("TST-1264302 #implement counts the work in progress from the view's states and holds, and offers no Start jobs above the limit", async () => {
  const wipRows = (rows) => backlog({ rows, wip: 2 });
  const cases = [
    ["two items in progress and held", [row("ITM-102", "ready"), row("ITM-103", "in progress", null, heldBy("ITM-103")), row("ITM-104", "in progress", null, heldBy("ITM-104"))], false],
    ["two items in progress, one held", [row("ITM-102", "ready"), row("ITM-103", "in progress", null, heldBy("ITM-103")), row("ITM-104", "in progress")], true],
    ["one item in progress and held", [row("ITM-102", "ready"), row("ITM-103", "in progress", null, heldBy("ITM-103")), row("ITM-104", "ready")], true],
  ];
  for (const [what, rows, expected] of cases) {
    const page = await render({ model: "scrum-wip", overview: head(wipRows(rows)) });
    try {
      assert.equal(rowOf(page.target, "ITM-102").getAttribute("data-startable"), String(expected), what);
      if (!expected) {
        assert.match(reasons(page.target, "ITM-102"), /work-in-progress limit of 2/, what);
        for (const busy of ["ITM-103", "ITM-104"]) assert.match(reasons(page.target, "ITM-102"), new RegExp(busy), `${what}: ${busy} is named`);
      }
    } finally { page.done(); }
  }
});

// TST-1264303 · level: release · module: MOD-implementation-pages
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; A TIME BOX WORKS ONLY ON WHAT WAS SELECTED FOR IT; UC-034
// given: the product whose files hold alpha's sprints 07 (selecting ITM-102 and ITM-106) and 08 (selecting ITM-107); three backlog views of the head — naming sprint 07 as alpha's running sprint, naming sprint 08, naming none — whose rows are ITM-102, ITM-106 and ITM-107, each ready
// input: the route implement rendered over each view
// expect: over the view naming 07, ITM-102 and ITM-106 are startable and ITM-107 is not; over the view naming 08, ITM-107 is startable and ITM-102 and ITM-106 are not, saying they are not selected; over the view naming none, no item is startable and each says that no sprint of alpha is running; the sprint file the view names is read, in the batch of the declaration, and the other is not
// Planted fault: a route that takes the running sprint from the product's files (the newest sprint of the team in `placeOf` of src/implementation-pages/implement.mjs, not the view's) judges by sprint 08 over the first view and by a sprint over the third; one that reads every sprint file reads the one the view does not name.
test("TST-1264303 #implement judges each item by the running sprint the head's view names, and reads that sprint's record", async () => {
  const rows = [row("ITM-102", "ready"), row("ITM-106", "ready"), row("ITM-107", "ready")];
  const files = productFiles("scrum", { [NEWER]: sprint({ n: 8, start: "2026-10-27", goal: "The newer sprint", selection: ["ITM-107"] }) });
  for (const [what, team, expected, read, unread] of [
    ["07 runs", alpha(running(RUNNING, ["ITM-102", "ITM-106"])), { "ITM-102": "true", "ITM-106": "true", "ITM-107": "false" }, RUNNING, NEWER],
    ["08 runs", alpha(running(NEWER, ["ITM-107"])), { "ITM-102": "false", "ITM-106": "false", "ITM-107": "true" }, NEWER, RUNNING],
    ["none runs", alpha(null), { "ITM-102": "false", "ITM-106": "false", "ITM-107": "false" }, null, null],
  ]) {
    const page = await render({ files, overview: head(backlog({ rows, teams: [team] })) });
    try {
      for (const [id, startable] of Object.entries(expected)) assert.equal(rowOf(page.target, id).getAttribute("data-startable"), startable, `${what}: ${id}`);
      if (what === "08 runs") assert.match(reasons(page.target, "ITM-102"), /not selected/);
      if (what === "none runs") assert.match(reasons(page.target, "ITM-102"), /No sprint of alpha is running/);
      assert.equal(page.batches.some((batch) => batch.includes(DECLARATION_PATH)), true, `${what}: the declaration is read in a batch`);
      if (read) assert.ok(page.batches.find((batch) => batch.includes(DECLARATION_PATH)).includes(read), `${what}: ${read} is read in the declaration's batch`);
      for (const path of [RUNNING, NEWER].filter((each) => each !== read)) assert.equal(page.reads.includes(path), false, `${what}: ${path} is not read`);
      if (unread) assert.equal(page.reads.includes(unread), false);
    } finally { page.done(); }
  }
});

// TST-1264304 · level: release · module: MOD-implementation-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-034; UC-024
// given: the product with its declaration, one role assignment, the running sprint 07, eight item files, three module files, a gate record, a workflow file, and six job records of which four are named by open pull requests, one by the merged pull request 1 and one by none; a backlog view of the head stored on overview-cache; the instance serves the declared model's file by readFileAt
// input: the route implement rendered, given the branch it shows
// expect: of the product, one tree; one read of ccc…c.backlog.json.gz on overview-cache; exactly two batches, the first of docs/process.md, docs/role-assignments/alpha.md and the running sprint, the second of the four job records the open pull requests name; no file read by itself; one listing of pull requests, with the state open; no containsCommit; of the instance the declared model's file once, at the commit the declaration names, and no listing of pull requests; no .facts.json, no gate record, no module file, no backlog item, no SPEC.md, and no job record but those four
// Planted fault: a route that reads the gate records beside the declaration (a `docs/gates/` filter added to the readMany of judgedBy in src/implementation-pages/implement.mjs), or the module files, or the items, fails the last assertions; one that reads the declaration and the assignments one after the other in two batches fails the batch count; one that lists every pull request (listPullRequests with no state in drawPulls) fails the listing.
test("TST-1264304 #implement reads the declaration, the role assignments and the running sprint in one batch, the open pull requests and their jobs, and no gate, module or item file", async () => {
  const page = await render({ overview: head(backlog({ rows: [row("ITM-106", "ready")] })) });
  try {
    assert.ok(found(page.target, "[data-start-jobs]").length === 1, "known positive: the page offers Start jobs, so it judged the items");
    assert.equal(page.log.filter((entry) => entry.startsWith("tree ")).length, 1, page.log.join("\n"));
    assert.deepEqual(cacheReads(page.log), [`on overview-cache ${COMMIT}.backlog.json.gz`]);
    assert.equal(page.batches.length, 2, JSON.stringify(page.batches));
    assert.deepEqual([...page.batches[0]].sort(), [DECLARATION_PATH, ASSIGNMENT, RUNNING].sort(), "the declaration, the role assignment and the running sprint in one batch");
    assert.deepEqual([...page.batches[1]].sort(), [...JOB_RECORDS].sort(), "the records of the jobs the open pull requests name in one batch");
    assert.deepEqual(page.log.filter((entry) => entry.startsWith("file ")), [], "no file is read by itself");
    assert.deepEqual(page.listings, ["open"]);
    assert.equal(page.log.includes("contains"), false);
    assert.deepEqual(page.instanceLog, [`readFileAt ${MODEL_FILE} ${MODEL_VERSION}`], "the declared model's file once, at the commit the declaration names");
    const read = page.reads;
    assert.deepEqual(read.filter((path) => path.endsWith(".facts.json") || path.startsWith("docs/gates/") || path.startsWith("docs/architecture/") || path.startsWith("docs/backlog/ITM-") || path === "SPEC.md"), []);
    assert.deepEqual(read.filter((path) => path.startsWith("docs/jobs/")).sort(), [...JOB_RECORDS].sort());
  } finally { page.done(); }
});

// TST-1264305 · level: release · module: MOD-implementation-pages
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-034
// given: overview-cache holding no backlog view of the head ccc…c, a latest.json naming 0c0c…0c and 0c0c…0c's backlog view with the rows ITM-102 and ITM-106, each ready, and the title "Older"; and, for the counter-proof, the same branch holding the head's view as well
// input: the route implement rendered over each, given the branch it shows
// expect: over the older view the line "As of 0c0c0c0: the view of the newest commit is being stored." stands; the rows ITM-102 and ITM-106 are drawn with their state ready; no Start jobs and no box to tick an item; no declaration, role assignment or sprint is read and no listing of pull requests asks for every one; over the head's view no line stands and Start jobs is offered
// Planted fault: a route that offers Start jobs on the view stored last (the `backlog.asOf` branch of `draw` in src/implementation-pages/implement.mjs left out) fails the first assertions; one that derives the view in the page while the head's is being stored lists the product's files' items and the pull requests with state=all, and fails the rows and the listing.
test("TST-1264305 #implement says so while the head's view is being stored, and offers no Start jobs on the view stored last", async () => {
  const older = backlog({ commit: C0, rows: [row("ITM-102", "ready"), row("ITM-106", "ready")] });
  const page = await render({ overview: last(older) });
  try {
    assert.match(page.html(), AS_OF(C0));
    assert.deepEqual(rowsOf(page.target).map((each) => [each.item, each.state]), [["ITM-102", "ready"], ["ITM-106", "ready"]]);
    assert.equal(found(page.target, "[data-start-jobs]").length, 0, "no Start jobs");
    assert.equal(found(page.target, "[data-start-item]").length, 0, "no item to tick");
    assert.equal(page.reads.includes(DECLARATION_PATH), false, "nothing is judged");
    assert.equal(page.listings.includes("all"), false, "the view is not derived");
  } finally { page.done(); }
  const stored = await render({ overview: { ...last(older), ...head(backlog({ rows: [row("ITM-102", "ready"), row("ITM-106", "ready")] })) } });
  try {
    assert.doesNotMatch(stored.html(), /As of /);
    assert.equal(found(stored.target, "[data-start-jobs]").length, 1, "known positive: with the head's view stored Start jobs is offered");
  } finally { stored.done(); }
});

// TST-1264306 · level: release · module: MOD-implementation-pages
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-034
// given: the product, and five stores that hold no usable backlog view of the head — no branch overview-cache; a latest.json naming 0c0c…0c with no view of it; a latest.json naming the head with no view; a view of the head of another format (gzip JSON without rows); bytes that are no gzip —; and the views that publishOverview stored for the head
// input: the route implement rendered over each
// expect: over each of the five the page derives the view from the files — ITM-102 to ITM-105 in progress and not startable, ITM-106 ready and startable, ITM-107 ready and not startable, ITM-108 waiting for acceptance naming RULE NOT ACCEPTED —, shows no "As of" line, and asks for the pull requests with the state all besides the one listing with the state open; the page drawn from the views CI stored lists the same rows and asks for no listing with the state all
// Planted fault: a route that treats a store it cannot use as an error, or that derives without the facts' pull requests (ITM-102 would be ready), fails each store; storedView trusting a view without its rows (the Array.isArray check of readView in src/progress-measures/views.mjs left out) fails the fourth; a derived view that differs from the one CI stores (a field only the scope all gives) fails the last comparison.
test("TST-1264306 #implement derives the same rows in the page only where no view is stored or the stored one cannot be used", async () => {
  const expected = [["ITM-102", "in progress", "false"], ["ITM-103", "in progress", "false"], ["ITM-104", "in progress", "false"], ["ITM-105", "in progress", "false"], ["ITM-106", "ready", "true"],
    ["ITM-107", "ready", "false"], ["ITM-108", "waiting for acceptance", "false"]];
  const stores = [
    ["no branch", null],
    ["latest.json names a commit without a view", { "latest.json": `${JSON.stringify({ commit: C0 })}\n` }],
    ["latest.json names the head", { "latest.json": `${JSON.stringify({ commit: COMMIT })}\n` }],
    ["a view of another format", { [`${COMMIT}.backlog.json.gz`]: gz({ commit: COMMIT, teams: [] }) }],
    ["a view that is no gzip", { [`${COMMIT}.backlog.json.gz`]: new TextEncoder().encode("not gzip") }],
  ];
  for (const [what, overview] of stores) {
    const page = await render({ overview });
    try {
      assert.doesNotMatch(page.html(), /As of /, `${what}: no line`);
      assert.deepEqual(rowsOf(page.target).map((each) => [each.item, each.state, each.startable]), expected, what);
      assert.match(reasons(page.target, "ITM-108"), /RULE NOT ACCEPTED/, what);
      assert.ok(page.listings.includes("all"), `${what}: the pull requests are read, every one`);
      assert.equal(page.listings.filter((state) => state === "open").length, 1, `${what}: one listing of the open ones`);
    } finally { page.done(); }
  }
  const { overview } = await published();
  assert.ok(Object.keys(overview).includes(`${COMMIT}.backlog.json.gz`), "known positive: CI stored the head's backlog view");
  assert.equal(JSON.parse(gunzipSync(Buffer.from(overview[`${COMMIT}.backlog.json.gz`])).toString("utf8")).commit, COMMIT);
  const page = await render({ overview });
  try {
    assert.deepEqual(rowsOf(page.target).map((each) => [each.item, each.state, each.startable]), expected, "the view CI stored");
    assert.equal(page.listings.includes("all"), false, "the stored view needs no listing of every pull request");
  } finally { page.done(); }
});

// TST-1264307 · level: release · module: MOD-implementation-pages
// guards: A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-024
// given: the product with the open pull requests 2 to 6 and the merged 1; 2's head passed the check agent-m done, 3's failed it, 4's is pending, 5's has no such check, 6 names no job; the views that publishOverview stored for the head; a gate record that names pull request 3 stands in the repository
// input: the route implement rendered
// expect: the pull requests of the jobs shown are 2, 3, 4 and 5 — not the merged 1, not 6 —; pull request 2 says the Definition of Done holds, links its run of agent-m done and offers Merge; 3 and 4 say it does not hold, link their runs of agent-m done, and offer no Merge; 5 says the check is not run yet, links none and offers no Merge; for each the runs of its first commit and its head are listed; pullRequestFacts is asked of 2, 3, 4 and 5 only
// Planted fault: a drawPulls that lists every pull request (listPullRequests with no state) shows the merged 1; one that takes the Definition of Done from anything but the head's agent-m done (for instance true for every pull request) offers Merge on 3, 4 and 5; one that offers Merge whenever the check ran (the `state === "success"` test of doneLine left out) offers it on 3 and 4.
test("TST-1264307 #implement lists the open pull requests of jobs, shows the head's agent-m done, and offers Merge only where it passed", async () => {
  const { overview } = await published();
  const page = await render({ overview });
  try {
    const boxes = found(page.target, "[data-pull]");
    assert.deepEqual(boxes.map((box) => box.getAttribute("data-pull")), ["2", "3", "4", "5"], page.html().slice(-3000));
    const box = (n) => found(page.target, `[data-pull="${n}"]`)[0];
    const done = (n) => found(box(n), "[data-done]")[0];
    assert.equal(done(2).getAttribute("data-holds"), "true");
    for (const n of [3, 4, 5]) assert.equal(done(n).getAttribute("data-holds"), "false", `#${n}`);
    for (const n of [2, 3, 4]) assert.equal(found(done(n), "[href]")[0]?.getAttribute("href"), doneRun(n), `#${n} links its run of agent-m done`);
    assert.equal(found(done(5), "[href]").length, 0, "#5 has no run to link");
    assert.match(text(done(5)), /not checked on the head yet/);
    assert.deepEqual(found(page.target, "[data-merge-pull]").map((button) => button.getAttribute("data-merge-pull")), ["2"], "Merge is offered for #2 only");
    for (const n of [2, 3, 4, 5]) {
      const first = found(box(n), '[data-ci="first"]')[0], lastRuns = found(box(n), '[data-ci="last"]')[0];
      assert.equal(found(first, "[href]")[0]?.getAttribute("href"), runUrl(n, 0), `#${n}: the run of the first commit`);
      assert.equal(found(lastRuns, "[href]")[0]?.getAttribute("href"), runUrl(n, 1), `#${n}: the run of the head`);
    }
    assert.deepEqual([...page.facts].sort(), [2, 3, 4, 5]);
    assert.deepEqual(page.listings, ["open"]);
  } finally { page.done(); }
});

// TST-1264308 · level: release · module: MOD-implementation-pages
// guards: A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; UC-024
// given: the page of TST-1264307, whose pull request 2 offers Merge and whose pull request 3 does not
// input: a click a script makes on Merge of pull request 2; then a click of a person
// expect: the script's click merges nothing; the person's click merges pull request 2 once, on the head 2b2b…2b the page read, and the page says "Merged as eeeeeee."; no merge is asked for any other pull request
// Planted fault: a Merge that does not wait for the person's click (the `event?.isTrusted === false` guard of drawPulls in src/implementation-pages/implement.mjs left out) merges on the script's click; one that merges the head it reads anew, or a pull request other than the one shown, fails the arguments.
test("TST-1264308 Merge merges the pull request on the head the page read, on a person's click only", async () => {
  const { overview } = await published();
  const page = await render({ overview });
  try {
    const button = found(page.target, '[data-merge-pull="2"]')[0];
    assert.ok(button, "known positive: Merge is offered for #2");
    await page.press(button, { isTrusted: false });
    assert.deepEqual(page.merges, [], "a script's click merges nothing");
    await page.press(button);
    assert.deepEqual(page.merges, [[2, LAST[2]]]);
    assert.match(text(found(page.target, '[data-pull="2"]')[0]), /Merged as eeeeeee\./);
  } finally { page.done(); }
});
