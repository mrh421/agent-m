// Release tests of ITM-1260 — the routes `progress` and `backlog` draw the view stored for their commit, and `plan` and `board` look at the declared model first, seen from outside: what the
// pages ask of the product's host, and what they show. The behaviour is docs/architecture/MOD-progress-measures.md's ("`publishOverview` ... adds `<commit>.json`, `<commit>.progress.json.gz` and
// `<commit>.backlog.json.gz` to the branch `overview-cache` in one commit ... A file the branch holds already is left as it is; `written` is `false` when it holds all three. A commit that adds any
// also writes `latest.json` naming the snapshot's commit; where it adds none, `latest.json` is left as it is."; "`storedView` ... the page's view of the snapshot's commit, read with the snapshot's
// `readOn` in one request, and `asOf` null; while that is not stored yet, the view of the commit `latest.json` names, in two requests more, and `asOf` that commit — what a page shows, with the line `As
// of <asOf, 7 characters>: the view of the newest commit is being stored.`, never deriving one itself."; "`ProgressView` ... `blocked` the items the running sprints hold, in a model with sprints"),
// docs/architecture/MOD-implementation-pages.md (`progress`: "It draws the view stored for the head ... and reads no record, no facts and no pull request, and it names no first wave; while the head's
// view is not stored yet, it draws the view stored last, with the line `storedView` gives, and only where the repository stores no view does it derive the same view in the page ... *End sprint* is
// offered on the head's own view only, and writes on its commit."; `backlog`: "... *Plan sprint* and *Cancel* draw from the view read. *Start sprint* is offered on the head's own view only: on the
// click it reads the declaration, the declared model, the module files and the team's running sprint at the view's commit, and hands them with the view's states and holds to `startSprint`, which
// writes on that commit. The route `board` reads the declaration and the declared model's file first, as `plan` does: for a model without a work-in-progress limit it says so and reads nothing else;
// with one, it reads the product's facts with the scope `work`, every pull request among them."; `plan`: "first the declaration and the declared model's file ... for a model that works from a
// backlog, a link to `backlog`, and nothing else is read"), docs/architecture/MOD-repository-hosts.md (`listPullRequests(filter: { state?, branch? })`), the requirements PROGRESS AND JOB STATE ARE
// DERIVED, NOT STORED and A PAGE LOAD READS THE REPOSITORY IN BATCHES, and UC-035 (the progress), UC-032 (the backlog, steps 1 and 6) and UC-045 alternative flow 1a (a model that works from a backlog
// has no plan).
// Run: node --test tests/release-itm-1260-stored-views.test.mjs
//
// Module: MOD-progress-measures; MOD-implementation-pages; MOD-repository-hosts
// Guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-035; UC-032; UC-045
// Level: release
//
// Written for the release testing of sprint 112 by a participant who implemented none of ITM-1260 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The implementers' cases
// (tests/progress-measures-views.test.mjs, tests/progress-measures-publish-views.test.mjs, tests/implementation-pages-progress-stored-view.test.mjs,
// tests/implementation-pages-backlog-stored-view.test.mjs, tests/implementation-pages-model-first.test.mjs) take one fixture and the views progressView and backlogView derive from it; these cases take
// their own product and walk what the pages meet: views that CI stored by publishOverview and the pages draw, views written by hand that differ from what the files derive (so that a page that
// derived would show other words), the boundaries of which view is read (the head's, the one stored last, none, a view of another format), and the controls that are offered on the head's view only.
// The product, its host and the DOM are this file's own; the host stands in for MOD-repository-hosts' interface (repositoryInfo, readSnapshot with readOn, readMany, listPullRequests,
// containsCommit, commitFiles) and logs every request of a page; no request leaves the process. Readings the texts leave open, taken here:
//   - "the four files of the commit and latest.json" (the item's Acceptance) is read as the module file's three files of the commit — the overview and the two views — and latest.json, four in all;
//     the module file binds, and it names no file of the schedule's view for publishOverview of this item.
//   - "reads its commit and the commit's tree once" and "1 file of overview-cache" (the item's measurable outcome): the log of a page drawn from the head's view is exactly the tree of the branch and
//     the one view read on overview-cache; the route is given the branch it shows (`ref`), as the live page gives it, so it asks no repository information.
//   - a view "of another format" is read as storedView reads it in its own text: JSON that is gzipped but holds no list of teams (progress) or rows (backlog), or bytes that are not gzip.
//   - the route plan "reads nothing else" than the declaration and the model's file: of the product, the tree and the one read of docs/process.md; the model's file is read through the instance's
//     readFileAt, once, at the commit the declaration names.

import "./site-frame-dom.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import * as measures from "../src/progress-measures/index.mjs";

// ---------------------------------------------------------------- the fixture DOM
//
// The selectors these routes use, as a browser answers them: [attr], [attr="value"] and the Mermaid code block; and the listeners of the click events kept by element, so that a test presses a
// button as a person does.

const matches = (element, selector) => {
  const attribute = /^\[([a-z-]+)(?:="([^"]*)")?\]$/.exec(selector);
  if (selector === "pre > code.language-mermaid") return element.localName === "code" && element.getAttribute("class") === "language-mermaid" && element.parentNode?.localName === "pre";
  return attribute ? (attribute[2] === undefined ? element.getAttribute(attribute[1]) !== null : element.getAttribute(attribute[1]) === attribute[2]) : false;
};
const found = (root, selector) => {
  const all = [];
  (function walk(node) { for (const child of node.childNodes) if (child.nodeType === 1) { if (matches(child, selector)) all.push(child); walk(child); } })(root);
  return all;
};
globalThis.window.Element.prototype.querySelectorAll = function querySelectorAll(selector) { return found(this, selector); };
globalThis.window.Element.prototype.replaceWith = function replaceWith(node) { this.parentNode.insertBefore(node, this); this.parentNode.removeChild(this); };
globalThis.window.Element.prototype.querySelector = function querySelector(selector) { return found(this, selector)[0] ?? null; };
globalThis.SVGElement ??= class SVGElement {};

const { view } = await import("../src/implementation-pages/index.mjs");

// ---------------------------------------------------------------- the product
//
// Two teams, alpha and beta, under a Scrum model with a work-in-progress limit of 2 (tests/fixtures/flow/scrum-wip.md, the model of the instance). Alpha runs sprint 07 since 2026-10-20 with ITM-101
// (merged by pull request 1 at 2026-10-21T10:00Z) and ITM-102 (pull request 2 open, a job working on it); its sprint 06 is closed. Beta closed sprint 03 with ITM-103 (merged by pull request 3). ITM-104
// realises UC-099, which is not accepted, and ITM-105 is ready: no running sprint selects either of them. RULE BETA is realised by no item.

const lines = (...rows) => `${rows.join("\n")}\n`;
const blobOf = (content) => createHash("sha1").update(content).digest("hex");
const ADDRESS = "https://github.com/acme/ledger";
const COMMIT = "c".repeat(40);
const C0 = "0c".repeat(20);
const BRANCH_HEAD = "b".repeat(40);
const MODEL_FILE = "docs/process-models/fixture.md";
const MODEL_VERSION = "a".repeat(40);
const JOB = "JOB-20261021-0900-a1b2";
const JOB_MARKER = "MARKER-OF-A-JOB-RECORD-1260-RELEASE";
const PR_MARKER = "MARKER-OF-A-PULL-REQUEST-BODY-1260-RELEASE";
const FILES_GOAL = "Goal the files of alpha 07 hold";
const modelText = (name) => readFileSync(new URL(`./fixtures/flow/${name}.md`, import.meta.url), "utf8");

const SPEC = lines("# SPEC", "", "## 1. Rules", "", "**RULE ALPHA** *(PO)*", "The first rule.", "*Check:* no automatic check; at review.", "",
  "**RULE BETA** *(PO)*", "The second rule, which no item realises.", "*Check:* no automatic check; at review.");
const DECLARATION = lines("---", "model: fixture-scrum-wip", `model_file: ${MODEL_FILE}`, `model_version: ${MODEL_VERSION}`, "---", "# How the product is developed", "",
  "## Practices", "", "- none", "", "## Definition of Done", "", "The job rules hold.");
const assignment = (team, owner, builder) => lines(`# ${team}`, "", "## Roles", "", "| Role | Participants |", "|---|---|", `| Owner | ${owner} |`, `| Builders | ${builder} |`, `| Checker | ${builder} |`);
const item = (n, module, realises = "RULE ALPHA") => lines("---", `id: ITM-10${n}`, `title: The files' title of item ${n}`, "level: module", "realises:", `  - ${realises}`, "modules:", `  - ${module}`,
  "builds_on: []", "tests:", "  - unit", "origin:", "  - RULE ALPHA", "---", `# ITM-10${n} The files' title of item ${n}`, "", "## Outcome", "", `What item ${n} delivers.`, "", "## Acceptance", "", "- a unit test.");
const CLOSE = (back) => ["", "## Review", "", "What was done is done.", "", "## Unfinished items", "", `to the backlog:${back ? ` ${back}` : ""}`, "into the next sprint:", "", "## Retrospective", "", "- change: smaller items."];
const sprint = ({ n, start, end = "", goal, selection, closed = false, back = "" }) => lines("---", `sprint: ${n}`, `goal: ${goal}`, `start: ${start}`, `end: ${end}`, "closer: carol", "branch:",
  "selection:", ...selection.map((each) => `  - ${each}`), "---", `# Sprint ${n}`, ...(closed ? CLOSE(back) : []));
const moduleFile = (id) => lines("---", `id: ${id}`, `title: The module ${id}`, `folder: src/${id.slice(4)}/`, "realises:", "  - RULE ALPHA", "follows:", "  - ARC-001", "uses: []", "provides:", "  - read",
  "---", `# ${id} The module ${id}`);
const JOB_RECORD = lines("---", `id: ${JOB}`, "kind: implement", "works_on:", "  - ITM-102", "participant: dev-a", "model: example-model", "route: ci hosted", "started_by: carol",
  "start: 2026-10-21 09:00 UTC", "agent_m: unknown, commit unknown", "limit: 1", "---", "## Destinations", "", JOB_MARKER, "", "## Parameters", "", "```json", "{}", "```");

const RUNNING = "docs/backlog/sprints/alpha/07.md";
const MODULES = ["MOD-store", "MOD-pages", "MOD-mail", "MOD-feed", "MOD-news"].map((id) => `docs/architecture/${id}.md`);
const productFiles = (overrides = {}) => ({
  "SPEC.md": SPEC, "docs/process.md": DECLARATION,
  "docs/role-assignments/alpha.md": assignment("alpha", "carol", "dev-a"), "docs/role-assignments/beta.md": assignment("beta", "dora", "dev-b"),
  "docs/backlog/ITM-101-first.md": item(1, "MOD-store"), "docs/backlog/ITM-102-second.md": item(2, "MOD-pages"), "docs/backlog/ITM-103-third.md": item(3, "MOD-mail"),
  "docs/backlog/ITM-104-fourth.md": item(4, "MOD-feed", "UC-099"), "docs/backlog/ITM-105-fifth.md": item(5, "MOD-news"),
  "docs/backlog/sprints/alpha/06.md": sprint({ n: 6, start: "2026-10-06", end: "2026-10-17", goal: "Feed", selection: ["ITM-104"], closed: true, back: "ITM-104" }),
  [RUNNING]: sprint({ n: 7, start: "2026-10-20", goal: FILES_GOAL, selection: ["ITM-101", "ITM-102"] }),
  "docs/backlog/sprints/beta/03.md": sprint({ n: 3, start: "2026-10-06", end: "2026-10-12", goal: "Mail", selection: ["ITM-103"], closed: true }),
  [`docs/jobs/${JOB}.md`]: JOB_RECORD,
  ...Object.fromEntries(MODULES.map((path) => [path, moduleFile(path.slice(18, -3))])),
  ...overrides,
});
const pr = (number, id, state, opened, merged = null) => ({ number, title: `${id}: the work of ${id}`, branch: `work/${id}`, base: "main", head: String(number).repeat(40).slice(0, 40), state, draft: false,
  url: `${ADDRESS}/pull/${number}`, opened, merged, closed: merged, body: PR_MARKER, updated: merged ?? opened, mergeCommit: merged ? "f".repeat(40) : null });
const PULLS = [pr(1, "ITM-101", "merged", "2026-10-20T09:00:00Z", "2026-10-21T10:00:00Z"), pr(2, "ITM-102", "open", "2026-10-21T12:00:00Z"),
  pr(3, "ITM-103", "merged", "2026-10-07T09:00:00Z", "2026-10-08T10:15:00Z")];

// ---------------------------------------------------------------- the hosts
//
// The product's host logs what it is asked, into `log`: `tree <ref>` for a snapshot, `file <path>` for a file read by itself, `batch <n>` for a readMany that fetches n files (`reads` keeps the path of every file read, either way), `on <branch> <path>` for
// a readOn, `pulls` for a listing of pull requests, `contains` for containsCommit, `info` for repositoryInfo. `overview` holds the files of the branch overview-cache by path (null: the repository
// has no such branch); a commit to that branch adds its files to it, so that a view CI stored is the view a page then reads. A missing file or branch answers a readOn with null, as the interface states.

const named = (name, message) => Object.assign(new Error(message), { name });
const unsupported = (what) => async () => { throw named("NotSupported", what); };

function productHost({ files = productFiles(), overview = null, pullRequests = PULLS, log = [], commits = [], reads = [] } = {}) {
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
        if (wanted.length) log.push(`batch ${wanted.length}`);
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
    async listPullRequests() { log.push("pulls"); return pullRequests; },
    async containsCommit() { log.push("contains"); return false; },
    async commitFiles(change) {
      commits.push(change);
      if (change.branch === "overview-cache") for (const file of change.files) overview[file.path] = file.text ?? file.bytes;
      return { commit: "d".repeat(40), url: "https://example.org/d" };
    },
    readHistory: async () => [], listTags: unsupported("the tags"), listCiRuns: unsupported("the runs"),
  };
}

// The instance: its SPEC and the process model of the product's declaration, as a snapshot (the facts read the model there) and through readFileAt (plan and board read it so).
function instanceHost(model, log = []) {
  const files = { "SPEC.md": "# Instance\n", [MODEL_FILE]: modelText(model) };
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

// The route `name` rendered with `params` over the product: { target, html(), log, commits, instanceLog, reads (the paths read), press(element), done() }.
async function render(name, { params = {}, model = "scrum-wip", ...hostOptions } = {}) {
  const route = view.routes.find((candidate) => candidate.name === name);
  const log = [], commits = [], instanceLog = [], reads = [];
  const product = productHost({ ...hostOptions, log, commits, reads });
  const instance = instanceHost(model, instanceLog);
  const handlers = [];
  const Element = globalThis.window.Element, add = Element.prototype.addEventListener;
  Element.prototype.addEventListener = function (type, listener, ...rest) { if (type === "click") handlers.push([this, listener]); return add.call(this, type, listener, ...rest); };
  globalThis.mermaid = { initialize() {}, mermaidAPI: { getDiagramFromText: async () => ({ db: { getVertices: () => ({}) } }) }, run: async () => {} };
  const target = globalThis.document.createElement("div");
  globalThis.document.body.append(target);
  const context = { page: "review", instance: { repository: "acme/agent-m", host: instance }, product: { address: ADDRESS, kind: "github", host: product, tokenStored: true, ref: "main" },
    store: {}, go() {} };
  await route.render(target, context, params);
  const press = async (element) => {
    const listener = handlers.filter(([at]) => at === element).at(-1)?.[1];
    if (typeof listener !== "function") throw new Error("the element has no click listener");
    await listener({ isTrusted: true });
    await new Promise((resolve) => setTimeout(resolve, 30));
  };
  return { target, html: () => target.innerHTML, log, commits, instanceLog, reads, press, done: () => { Element.prototype.addEventListener = add; delete globalThis.mermaid; } };
}

// The HTML of the part that begins with `marker` and ends where the next panel begins.
function part(html, marker) {
  const at = html.indexOf(marker);
  if (at < 0) return "";
  const next = html.indexOf('<section class="panel"', at + marker.length);
  return html.slice(at, next < 0 ? undefined : next);
}
const rowsOf = (html) => [...part(html, 'data-part="backlog"').matchAll(/<tr data-item="(ITM-\d{3})"/g)].map((match) => match[1]);
const cacheLog = (log) => log.filter((entry) => entry.startsWith("on overview-cache "));
const pullsIn = (log) => log.filter((entry) => entry === "pulls" || entry === "contains");
const AS_OF = (commit) => new RegExp(`As of ${commit.slice(0, 7)}: the view of the newest commit is being stored\\.`);

// ---------------------------------------------------------------- the stored views, written by hand
//
// A view in the format of the module file (ProgressView, BacklogView) that says other words than the product's files do, so that a page that derived would show the files' words.

const sorted = (list) => [...list].sort();
const gz = (value) => new Uint8Array(gzipSync(JSON.stringify(value)));
const MODEL = { name: "fixture-scrum-wip", kind: "pulled", sprints: true, wip: 2, measure: "items per state over time" };
const state = (id, name, reason = null) => ({ item: id, state: name, reason, job: null, pullRequest: null });
const storedProgress = (commit, tag) => ({ commit, declared: true, modelFile: MODEL_FILE, modelUnread: null, model: MODEL, measure: null,
  teams: [{ team: "alpha", sprint: { name: "alpha/07", path: RUNNING, goal: `${tag} goal`, start: "2026-10-20", end: "", branch: "", closer: "carol", ended: null, final: false, endable: true,
    items: [{ item: "ITM-101", path: "docs/backlog/ITM-101-first.md", title: `${tag} title`, state: state("ITM-101", "done"), changes: ["MOD-store"], uses: [] }], merges: [] } },
  { team: "beta", sprint: null }],
  gates: [], blocked: [], who: { participants: [{ participant: `${tag}-participant`, roles: ["Builders"], teams: ["alpha"], jobs: [] }], held: [], unreachable: [] } });
const storedBacklog = (commit, tag) => ({ commit, declared: true, modelFile: MODEL_FILE, modelUnread: null, model: MODEL,
  teams: [{ team: "alpha", owner: "carol", running: { name: "alpha/07", path: RUNNING, goal: `${tag} goal`, closer: "carol", selection: ["ITM-101"] }, lastEnded: null },
    { team: "beta", owner: "dora", running: null, lastEnded: null }],
  rows: [{ item: "ITM-105", path: "docs/backlog/ITM-105-fifth.md", title: `${tag} row of 105`, realises: ["RULE ALPHA"], state: state("ITM-105", "ready"), held: null, kept: [] },
    { item: "ITM-199", path: "docs/backlog/ITM-199-only-the-view.md", title: `${tag} row that only the view holds`, realises: [], state: state("ITM-199", "ready"), held: null, kept: [] }],
  uncovered: { requirements: [`${tag} requirement`], useCases: [] } });
const head = (page, tag = "Stored") => ({ [`${COMMIT}.${page}.json.gz`]: gz((page === "progress" ? storedProgress : storedBacklog)(COMMIT, tag)) });
const last = (page, tag = "Older") => ({ "latest.json": `${JSON.stringify({ commit: C0 })}\n`, [`${C0}.${page}.json.gz`]: gz((page === "progress" ? storedProgress : storedBacklog)(C0, tag)) });

// ---------------------------------------------------------------- what CI stores
//
// The facts of the scope `all` over the product, and publishOverview to an overview-cache that exists and holds `held`: { overview, commits, log, facts, result }.

async function publish(held = {}, { files = productFiles() } = {}) {
  const overview = { ...held }, log = [], commits = [];
  const product = productHost({ files, overview, log, commits });
  const instance = instanceHost("scrum-wip");
  const snapshot = await product.readSnapshot("main");
  const facts = await measures.productFacts(product, await instance.readSnapshot("main"), () => instance.readSnapshot("main"), new Date("2026-10-22T12:00:00Z"), { scope: "all" });
  const result = await measures.publishOverview(product, snapshot, facts);
  return { overview, commits, log, facts, result };
}
const unzipped = (bytes) => JSON.parse(gunzipSync(Buffer.from(bytes)).toString("utf8"));
const VIEWS = [`${COMMIT}.progress.json.gz`, `${COMMIT}.backlog.json.gz`];
const SCHEDULE = `${COMMIT}.schedule.json.gz`;

// ================================================================== the tests

// TST-1260401 · level: release · module: MOD-progress-measures
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-035; UC-032
// given: the product at the commit ccc…c with a branch overview-cache that holds no file of it; the facts of the scope all
// input: publishOverview(host, snapshot, facts)
// expect: { written: true } by one commit on overview-cache, at the head it read, that holds ccc…c.json, ccc…c.progress.json.gz, ccc…c.backlog.json.gz and latest.json naming ccc…c, and no file of facts (.facts.json); the two views gunzip to JSON of the commit, the progress view with the teams alpha and beta, the backlog view with the five items; counter-proof: a second run on the branch as it is now writes nothing
// Planted fault: publishOverview leaving a view out of the commit (the progress or the backlog entry of its list in src/progress-measures/stages.mjs), or not writing latest.json, fails on the paths of the commit; one writing the facts beside them fails on the .facts.json check.
test("TST-1260401 publishOverview adds the overview, the two views and latest.json of a commit in one commit, and no facts file", async () => {
  const { overview, commits, result } = await publish();
  assert.deepEqual(result, { commit: COMMIT, written: true });
  assert.equal(commits.length, 1, "one commit");
  assert.deepEqual([commits[0].branch, commits[0].expectedHead], ["overview-cache", BRANCH_HEAD]);
  const written = commits[0].files.map((file) => file.path);
  for (const path of [`${COMMIT}.json`, ...VIEWS, "latest.json"]) assert.ok(written.includes(path), `${path} is written: ${written.join(", ")}`);
  assert.deepEqual(written.filter((path) => path.endsWith(".facts.json")), [], "no facts file");
  assert.equal(JSON.parse(overview["latest.json"]).commit, COMMIT);
  const progress = unzipped(overview[VIEWS[0]]), backlog = unzipped(overview[VIEWS[1]]);
  assert.equal(progress.commit, COMMIT);
  assert.deepEqual(progress.teams.map((team) => team.team), ["alpha", "beta"]);
  assert.equal(backlog.commit, COMMIT);
  assert.deepEqual(sorted(backlog.rows.map((row) => row.item)), ["ITM-101", "ITM-102", "ITM-103", "ITM-104", "ITM-105"]);
  const again = await publish(overview);
  assert.deepEqual(again.result, { commit: COMMIT, written: false }, "counter-proof: everything is stored");
  assert.deepEqual(again.commits, []);
});

// TST-1260402 · level: release · module: MOD-progress-measures
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-035
// given: a branch overview-cache that holds ccc…c.json and ccc…c.progress.json.gz, with marker bytes, and latest.json naming 0c0c…0c, but not ccc…c.backlog.json.gz
// input: publishOverview(host, snapshot, facts) for the commit ccc…c
// expect: { written: true } by one commit that holds ccc…c.backlog.json.gz, ccc…c.schedule.json.gz and latest.json naming ccc…c, and neither ccc…c.json nor ccc…c.progress.json.gz; the two files the branch held stay as they were
// Planted fault: publishOverview writing a file the branch holds already (the `branch.paths.includes` guard of the overview or of a view left out in src/progress-measures/stages.mjs) puts that file in the commit and the marker bytes are replaced, and the case fails.
test("TST-1260402 publishOverview leaves a file the branch holds, and adds the one that is missing with latest.json", async () => {
  const held = { [`${COMMIT}.json`]: "{\"marker\":\"overview\"}\n", [VIEWS[0]]: new Uint8Array([1, 2, 3]), "latest.json": `${JSON.stringify({ commit: C0 })}\n` };
  const { overview, commits, result } = await publish(held);
  assert.deepEqual(result, { commit: COMMIT, written: true });
  assert.equal(commits.length, 1);
  assert.deepEqual(commits[0].files.map((file) => file.path).sort(), sorted([VIEWS[1], SCHEDULE, "latest.json"]));
  assert.equal(JSON.parse(overview["latest.json"]).commit, COMMIT);
  assert.equal(overview[`${COMMIT}.json`], held[`${COMMIT}.json`], "the overview is as it was");
  assert.deepEqual([...overview[VIEWS[0]]], [1, 2, 3], "the progress view is as it was");
  assert.equal(unzipped(overview[VIEWS[1]]).commit, COMMIT, "known positive: the missing view was added");
});

// TST-1260403 · level: release · module: MOD-progress-measures
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-035
// given: a branch overview-cache that holds ccc…c.json, both views of ccc…c and its schedule view, and a latest.json naming 0c0c…0c
// input: publishOverview(host, snapshot, facts) for the commit ccc…c
// expect: { written: false }, no commit, and latest.json still names 0c0c…0c
// Planted fault: publishOverview writing latest.json whenever it runs (the `files.length > 0` guard of latest.json in src/progress-measures/stages.mjs left out) commits it and fails the case.
test("TST-1260403 publishOverview where the branch holds all four files writes nothing, latest.json included", async () => {
  const held = { [`${COMMIT}.json`]: "{\"marker\":\"overview\"}\n", [VIEWS[0]]: new Uint8Array([1]), [VIEWS[1]]: new Uint8Array([2]), [SCHEDULE]: new Uint8Array([3]), "latest.json": `${JSON.stringify({ commit: C0 })}\n` };
  const { overview, commits, result } = await publish(held);
  assert.deepEqual(result, { commit: COMMIT, written: false });
  assert.deepEqual(commits, []);
  assert.equal(JSON.parse(overview["latest.json"]).commit, C0);
});

// TST-1260404 · level: release · module: MOD-implementation-pages
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-035; UC-032
// given: the product, drawn once from the views that publishOverview stored on overview-cache (the facts of the scope all) and once, on a repository without that branch, from the views the page derives (the facts of the scope work)
// input: the routes progress and backlog, each rendered both ways
// expect: for each route the page is the same, byte for byte, whether the view was stored by CI or derived in the page; known positive: the stored page is drawn by one read of overview-cache and no pull request, the derived one reads the pull requests, and both show alpha/07 with its goal from the files and ITM-101 done
// Planted fault: a progressView or backlogView that differs by the facts' scope (for instance a field only the scope all gives) draws another page from the stored view than from the derived one and fails the comparison; a page that derived although a view is stored fails the known positive on its log.
test("TST-1260404 a view CI stored and the view the page derives draw the same page", async () => {
  const { overview } = await publish();
  for (const name of ["progress", "backlog"]) {
    const stored = await render(name, { overview });
    const derived = await render(name, { overview: null });
    try {
      assert.deepEqual(cacheLog(stored.log), [`on overview-cache ${COMMIT}.${name}.json.gz`], `${name}: one read of overview-cache`);
      assert.deepEqual(pullsIn(stored.log), [], `${name}: the stored page reads no pull request`);
      assert.ok(pullsIn(derived.log).length > 0, `${name}: known positive: the derived page reads the pull requests`);
      if (name === "progress") {
        assert.match(part(stored.html(), 'data-team="alpha"'), new RegExp(`alpha/07[\\s\\S]*${FILES_GOAL}[\\s\\S]*ITM-101[\\s\\S]*done`));
      } else {
        assert.deepEqual(rowsOf(stored.html()), ["ITM-101", "ITM-102", "ITM-103", "ITM-104", "ITM-105"]);
      }
      assert.equal(stored.html(), derived.html(), `${name}: the same page`);
    } finally { stored.done(); derived.done(); }
  }
});

// TST-1260405 · level: release · module: MOD-implementation-pages
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-035
// given: overview-cache holding a progress view of the head ccc…c that says other words than the product's files — the goal "Stored goal", the item title "Stored title", the participant "Stored-participant"
// input: the route progress rendered, given the branch it shows
// expect: the page shows alpha/07 with the goal "Stored goal", ITM-101 titled "Stored title" and the participant "Stored-participant", and neither the files' goal, an item the view does not hold (ITM-102) nor the job's marker; the log of the host is exactly the tree of the branch and the read of ccc…c.progress.json.gz on overview-cache — no file, no batch, no pull request, no facts file
// Planted fault: a route that derives the view although one is stored (the stored branch of viewOf left out in src/implementation-pages/progress.mjs) shows the files' goal and reads the files and the pull requests, and fails; a route that reads the job records or the sprint files besides fails on the log.
test("TST-1260405 #progress draws the head's stored view and reads the tree and that one file", async () => {
  const page = await render("progress", { overview: head("progress") });
  try {
    const html = page.html();
    const alpha = part(html, 'data-team="alpha"');
    assert.match(alpha, /alpha\/07/);
    assert.match(alpha, /Stored goal/);
    assert.match(alpha, /Stored title/);
    assert.match(part(html, 'data-part="who"'), /Stored-participant/);
    assert.ok(!html.includes(FILES_GOAL) && !html.includes("ITM-102") && !html.includes(JOB_MARKER), "nothing the view does not hold");
    assert.match(part(html, 'data-team="beta"'), /no running sprint/i);
    assert.deepEqual(page.log, ["tree main", `on overview-cache ${COMMIT}.progress.json.gz`]);
  } finally { page.done(); }
});

// TST-1260406 · level: release · module: MOD-implementation-pages
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-032; ONE CLICK PER DECISION
// given: overview-cache holding a backlog view of the head ccc…c that lists two items — ITM-105 titled "Stored row of 105" and ITM-199, which no file of the product holds — and the uncovered requirement "Stored requirement"
// input: the route backlog rendered, given the branch it shows; then the person's clicks on Plan sprint of beta and on Cancel
// expect: the backlog lists ITM-105 and ITM-199 with their stored titles and nothing of the product's five files (ITM-101 to ITM-104 are not rows), and names the requirement "Stored requirement"; the log is exactly the tree of the branch and the read of ccc…c.backlog.json.gz on overview-cache; the two clicks open and close the planning of beta and send no request
// Planted fault: a route that derives the backlog although a view is stored lists the product's five items and reads the files and the pull requests, and fails; a Plan sprint or Cancel that reads again (a viewOf call in `again` of src/implementation-pages/backlog.mjs) adds a request and fails the last assertion.
test("TST-1260406 #backlog draws the head's stored view, reads the tree and that one file, and Plan sprint and Cancel send no request", async () => {
  const page = await render("backlog", { overview: head("backlog") });
  try {
    const html = page.html();
    assert.deepEqual(rowsOf(html), ["ITM-105", "ITM-199"]);
    assert.match(html, /Stored row of 105/);
    assert.match(html, /Stored row that only the view holds/);
    assert.match(html, /Stored requirement/);
    assert.deepEqual(page.log, ["tree main", `on overview-cache ${COMMIT}.backlog.json.gz`]);
    const found_ = (selector) => found(page.target, selector)[0];
    await page.press(found_('[data-plan="beta"]'));
    assert.match(page.html(), /data-plan-team="beta"/, "known positive: the planning is open");
    await page.press(found_("[data-cancel-plan]"));
    assert.doesNotMatch(page.html(), /data-plan-team=/);
    assert.deepEqual(page.log, ["tree main", `on overview-cache ${COMMIT}.backlog.json.gz`], "the clicks sent no request");
  } finally { page.done(); }
});

// TST-1260407 · level: release · module: MOD-implementation-pages
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-035
// given: overview-cache holding no progress view of the head ccc…c, a latest.json naming 0c0c…0c and 0c0c…0c's progress view with the goal "Older goal"
// input: the route progress rendered, given the branch it shows
// expect: the line "As of 0c0c0c0: the view of the newest commit is being stored."; alpha/07 with the goal "Older goal" drawn; the log is the tree of the branch and three reads of overview-cache in this order — ccc…c.progress.json.gz, latest.json, 0c0c…0c.progress.json.gz — and no file, no batch and no pull request
// Planted fault: a route that derives when the head's view is missing (the `asOf` branch of viewOf in src/implementation-pages/progress.mjs left out) shows the files' goal and no line; storedView that does not follow latest.json fails on the reads.
test("TST-1260407 #progress draws the view stored last while the head's is stored, with the line and three reads", async () => {
  const page = await render("progress", { overview: last("progress") });
  try {
    const html = page.html();
    assert.match(html, AS_OF(C0));
    assert.match(part(html, 'data-team="alpha"'), /Older goal/);
    assert.ok(!html.includes(FILES_GOAL), "the page did not derive");
    assert.deepEqual(page.log, ["tree main", `on overview-cache ${COMMIT}.progress.json.gz`, "on overview-cache latest.json", `on overview-cache ${C0}.progress.json.gz`]);
  } finally { page.done(); }
});

// TST-1260408 · level: release · module: MOD-implementation-pages
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-032
// given: overview-cache holding no backlog view of the head ccc…c, a latest.json naming 0c0c…0c and 0c0c…0c's backlog view with the row "Older row of 105"
// input: the route backlog rendered, given the branch it shows
// expect: the line "As of 0c0c0c0: the view of the newest commit is being stored."; the rows ITM-105 and ITM-199 drawn with their older titles; the log is the tree of the branch and the same three reads of overview-cache, and no file, no batch and no pull request
// Planted fault: a route that derives when the head's view is missing shows the product's five items and no line, and fails; one that drops the line fails the first assertion.
test("TST-1260408 #backlog draws the view stored last while the head's is stored, with the line and three reads", async () => {
  const page = await render("backlog", { overview: last("backlog") });
  try {
    const html = page.html();
    assert.match(html, AS_OF(C0));
    assert.deepEqual(rowsOf(html), ["ITM-105", "ITM-199"]);
    assert.match(html, /Older row of 105/);
    assert.deepEqual(page.log, ["tree main", `on overview-cache ${COMMIT}.backlog.json.gz`, "on overview-cache latest.json", `on overview-cache ${C0}.backlog.json.gz`]);
  } finally { page.done(); }
});

// TST-1260409 · level: release · module: MOD-implementation-pages
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-035
// given: the product with its sprint files, and five stores that hold no usable progress view — no branch overview-cache; a branch whose latest.json names 0c0c…0c but holds no view of it; a branch whose latest.json names the head itself while its view is missing; a branch whose view of the head is gzip JSON of another format (no teams) and one whose view is bytes that are no gzip
// input: the route progress rendered over each
// expect: in each the page derives the view from the files — alpha/07 with the goal the files hold and ITM-101 done, ITM-102 in progress — reads the pull requests and shows no "As of" line; known positive: with the head's view stored the same page reads no pull request
// Planted fault: a route that treats a store it cannot use as an error (the null of storedView not met by the derivation in viewOf of src/implementation-pages/progress.mjs) fails each; storedView that trusts a view without its list of teams (the Array.isArray check of readView in src/progress-measures/views.mjs left out) draws it and fails the fourth store.
test("TST-1260409 #progress derives the view in the page only where none is stored, or one that is stored cannot be used", async () => {
  const stores = [
    ["no branch", null],
    ["latest.json names a commit without a view", { "latest.json": `${JSON.stringify({ commit: C0 })}\n` }],
    ["latest.json names the head", { "latest.json": `${JSON.stringify({ commit: COMMIT })}\n` }],
    ["a view of another format", { [`${COMMIT}.progress.json.gz`]: gz({ commit: COMMIT, goal: "no teams" }) }],
    ["a view that is no gzip", { [`${COMMIT}.progress.json.gz`]: new TextEncoder().encode("not gzip") }],
  ];
  for (const [what, overview] of stores) {
    const page = await render("progress", { overview });
    try {
      const html = page.html();
      assert.doesNotMatch(html, /As of /, `${what}: no line`);
      const alpha = part(html, 'data-team="alpha"');
      assert.match(alpha, new RegExp(FILES_GOAL), `${what}: the goal of the files`);
      assert.match(alpha, /ITM-101[\s\S]*done/, what);
      assert.match(alpha, /ITM-102[\s\S]*in progress/, what);
      assert.ok(pullsIn(page.log).length > 0, `${what}: the pull requests are read`);
    } finally { page.done(); }
  }
  const stored = await render("progress", { overview: head("progress") });
  try { assert.deepEqual(pullsIn(stored.log), [], "known positive: with the view stored no pull request is read"); } finally { stored.done(); }
});

// TST-1260410 · level: release · module: MOD-implementation-pages
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-032
// given: the product with its sprint files, and the same five stores that hold no usable backlog view as in the progress case
// input: the route backlog rendered over each
// expect: in each the page derives the view from the files — the five items ITM-101 to ITM-105 in this order, ITM-101 done, and the requirement RULE BETA among those realised by no item —, reads the pull requests and shows no "As of" line; known positive: with the head's view stored the same page reads no pull request
// Planted fault: a route that does not derive where storedView answers null, or that derives without the SPEC's requirements (the parseSpec read of viewOf in src/implementation-pages/backlog.mjs left out) lists no uncovered requirement and fails.
test("TST-1260410 #backlog derives the view in the page only where none is stored, or one that is stored cannot be used", async () => {
  const stores = [
    ["no branch", null],
    ["latest.json names a commit without a view", { "latest.json": `${JSON.stringify({ commit: C0 })}\n` }],
    ["latest.json names the head", { "latest.json": `${JSON.stringify({ commit: COMMIT })}\n` }],
    ["a view of another format", { [`${COMMIT}.backlog.json.gz`]: gz({ commit: COMMIT, teams: [] }) }],
    ["a view that is no gzip", { [`${COMMIT}.backlog.json.gz`]: new TextEncoder().encode("not gzip") }],
  ];
  for (const [what, overview] of stores) {
    const page = await render("backlog", { overview });
    try {
      const html = page.html();
      assert.doesNotMatch(html, /As of /, `${what}: no line`);
      assert.deepEqual(rowsOf(html), ["ITM-101", "ITM-102", "ITM-103", "ITM-104", "ITM-105"], what);
      assert.match(part(html, 'data-item="ITM-101"').slice(0, 1500), /done/, what);
      assert.match(part(html, 'data-part="uncovered"'), /RULE BETA/, what);
      assert.ok(pullsIn(page.log).length > 0, `${what}: the pull requests are read`);
    } finally { page.done(); }
  }
  const stored = await render("backlog", { overview: head("backlog") });
  try { assert.deepEqual(pullsIn(stored.log), [], "known positive: with the view stored no pull request is read"); } finally { stored.done(); }
});

// TST-1260411 · level: release · module: MOD-implementation-pages
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-035
// given: the product whose host counts every listing of pull requests and every containsCommit, and a pull request body that holds a marker; the views stored for the head, those stored last, and views that CI stored by publishOverview
// input: the route progress rendered over each
// expect: no listing of pull requests, no containsCommit and no file of the product is asked in any of them, and the marker of the pull request body stands nowhere in the page; known positive: the page derived on a repository without views asks for the pull requests and the files
// Planted fault: a route that lists the pull requests beside the stored view (for instance the listPullRequests of the scope now that the item withdraws) fails each store; a stored view that carries the pull request's body fails the marker check.
test("TST-1260411 #progress asks no pull request of the host where a view is stored, whichever view it draws", async () => {
  const { overview: published } = await publish();
  const stores = [["the head's view", head("progress")], ["the view stored last", last("progress")], ["the view CI stored", published]];
  for (const [what, overview] of stores) {
    const page = await render("progress", { overview });
    try {
      assert.deepEqual(pullsIn(page.log), [], what);
      assert.deepEqual(page.reads, [], `${what}: no file of the product`);
      assert.ok(!page.html().includes(PR_MARKER), `${what}: no pull request's body`);
    } finally { page.done(); }
  }
  const derived = await render("progress", { overview: null });
  try {
    assert.ok(pullsIn(derived.log).length > 0, "known positive: the derived page asks for the pull requests");
    assert.ok(derived.reads.length > 0, "known positive: the derived page reads files");
  } finally { derived.done(); }
});

// TST-1260412 · level: release · module: MOD-implementation-pages
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-035; UC-032; ONE CLICK PER DECISION
// given: alpha's sprint 07 running without a time box, in the view stored for the head ccc…c and in the view stored last (0c0c…0c); beta without a running sprint
// input: the route progress and the route backlog rendered over the head's view and over the view stored last; on the backlog the click on Plan sprint of beta
// expect: over the head's view End sprint of alpha is offered on the progress and Start sprint of beta on the opened planning; over the view stored last neither is — the progress offers no End sprint, the planning opens and offers no Start sprint, and says why
// Planted fault: a route that offers End sprint or Start sprint whatever view it draws (the `ctx.asOf === null` condition of endable in src/implementation-pages/progress.mjs or of own in planPanel of backlog.mjs left out) shows the button over the view stored last and fails.
test("TST-1260412 End sprint and Start sprint are offered on the head's own view only", async () => {
  const offered = async (page, planning) => {
    if (planning) await page.press(found(page.target, '[data-plan="beta"]')[0]);
    return planning ? page.html().includes('data-start-sprint="beta"') : page.html().includes('data-end-sprint="alpha"');
  };
  for (const [what, name, store, planning, expected] of [
    ["progress, the head's view", "progress", head("progress"), false, true], ["progress, the view stored last", "progress", last("progress"), false, false],
    ["backlog, the head's view", "backlog", head("backlog"), true, true], ["backlog, the view stored last", "backlog", last("backlog"), true, false],
  ]) {
    const page = await render(name, { overview: store });
    try {
      if (planning) assert.match(page.html(), /data-plan="beta"/, `${what}: known positive: the planning can be opened`);
      assert.equal(await offered(page, planning), expected, what);
      if (planning) assert.match(page.html(), /data-plan-team="beta"/, `${what}: the planning is open`);
      if (planning && !expected) assert.match(page.html(), /open the page again in a moment/, `${what}: the planning says why`);
    } finally { page.done(); }
  }
});

// TST-1260413 · level: release · module: MOD-implementation-pages
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-032; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the backlog view stored for the head ccc…c, which lists ITM-105 ready; the product's declaration, its model's file, its five module files and no running sprint of beta
// input: the person opens the planning of beta, ticks ITM-105, names a goal and the closer dora, and presses Start sprint
// expect: the click reads docs/process.md and the model's file at the commit the declaration names, the five module files, and writes one commit with the new record docs/backlog/sprints/beta/04.md naming ITM-105, on the branch main with the expected head ccc…c, the commit the view is of; and, on the progress over the head's view, End sprint of alpha writes one commit that appends ## Ended to docs/backlog/sprints/alpha/07.md on the expected head ccc…c
// Planted fault: a Start sprint that commits on the head it reads anew (the head of startSprint's context taken from the branch rather than view.commit in src/implementation-pages/backlog.mjs) or that reads no module file fails the expected head or the reads; an End sprint without the head of its view fails the expected head.
test("TST-1260413 Start sprint and End sprint on the head's view read what they need and write on the view's commit", async () => {
  const page = await render("backlog", { overview: head("backlog") });
  try {
    await page.press(found(page.target, '[data-plan="beta"]')[0]);
    found(page.target, '[data-select-item="ITM-105"]')[0].checked = true;
    found(page.target, "[data-sprint-goal]")[0].value = "Release goal";
    found(page.target, "[data-sprint-closer]")[0].value = "dora";
    const at = page.log.length, readAt = page.reads.length;
    await page.press(found(page.target, '[data-start-sprint="beta"]')[0]);
    const read = page.reads.slice(readAt);
    for (const path of ["docs/process.md", ...MODULES]) assert.ok(read.includes(path), `${path} is read: ${read.join(", ")}`);
    assert.ok(page.instanceLog.includes(`readFileAt ${MODEL_FILE} ${MODEL_VERSION}`), `the model's file is read at the commit the declaration names: ${page.instanceLog.join(" | ")}`);
    assert.equal(page.commits.length, 1, page.log.slice(at).join("\n"));
    const [commit] = page.commits;
    assert.deepEqual([commit.branch, commit.expectedHead], ["main", COMMIT]);
    assert.deepEqual(commit.files.map((file) => file.path), ["docs/backlog/sprints/beta/04.md"]);
    assert.match(commit.files[0].text, /ITM-105/);
  } finally { page.done(); }
  const progress = await render("progress", { overview: head("progress") });
  try {
    await progress.press(found(progress.target, '[data-end-sprint="alpha"]')[0]);
    assert.equal(progress.commits.length, 1);
    assert.deepEqual([progress.commits[0].branch, progress.commits[0].expectedHead], ["main", COMMIT]);
    assert.deepEqual(progress.commits[0].files.map((file) => file.path), [RUNNING]);
    assert.match(progress.commits[0].files[0].text, /## Ended/);
  } finally { progress.done(); }
});

// TST-1260414 · level: release · module: MOD-progress-measures
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE; UC-035
// given: the product's facts, in which ITM-103 is selected by beta's closed sprint only and ITM-104, which realises the open UC-099 and is blocked, and ITM-105 by no sprint; a job record that holds a marker and pull requests whose body holds a marker
// input: the progress view that publishOverview stored for the commit, as JSON, and the page drawn from it
// expect: ITM-101 and ITM-102, which alpha's running sprint selects, stand in the view; ITM-103, ITM-104 and ITM-105 stand nowhere in its text — not in a team's items, not among the blocked, not in the measure —; neither marker stands in the progress view or in the backlog view; known positive: blocked(facts) lists ITM-104, so that a view which took the blocked items of the product would show it
// Planted fault: a progressView that gives the blocked items of the whole product (blocked(facts) without the filter on the running sprints' items in src/progress-measures/views.mjs) or a measure over every sprint's items puts ITM-104 or ITM-103 in the view and fails; a view that carries a record's text or a pull request's body fails the marker checks.
test("TST-1260414 an item no running sprint selects is absent from the progress view CI stores, and no record's text or pull request is in a view", async () => {
  const { overview, facts } = await publish();
  assert.ok(measures.blocked(facts).some((entry) => entry.item === "ITM-104"), "known positive: ITM-104 is blocked in the facts");
  const progress = JSON.stringify(unzipped(overview[VIEWS[0]])), backlog = JSON.stringify(unzipped(overview[VIEWS[1]]));
  for (const inside of ["ITM-101", "ITM-102"]) assert.ok(progress.includes(inside), `${inside} is in the progress view`);
  for (const outside of ["ITM-103", "ITM-104", "ITM-105"]) assert.ok(!progress.includes(outside), `${outside} is not in the progress view`);
  for (const [name, text] of [["progress", progress], ["backlog", backlog]]) {
    assert.ok(!text.includes(JOB_MARKER), `${name}: no record's text`);
    assert.ok(!text.includes(PR_MARKER), `${name}: no pull request's body`);
  }
  const page = await render("progress", { overview });
  try {
    for (const outside of ["ITM-103", "ITM-104", "ITM-105"]) assert.ok(!page.html().includes(outside), `${outside} is not on the page`);
    assert.match(page.html(), /data-item="ITM-102"/, "known positive: alpha's items are drawn");
  } finally { page.done(); }
});

// TST-1260415 · level: release · module: MOD-implementation-pages
// guards: UC-045; UC-032; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a product whose declared model is Scrum without a work-in-progress limit, and one with a limit of 2 (the models of tests/fixtures/flow/); the instance serves the model's file by readFileAt
// input: the routes plan and board, each rendered over each product, given the branch they show
// expect: plan links #backlog for both models, and board says there is no board and links #backlog for the model without a limit; each of them asks the product for its tree and the read of docs/process.md and nothing else — no pull request, no file but the declaration, no batch, no overview-cache —, and the instance for the model's file once, at the commit the declaration names, and for no pull request
// Planted fault: a plan or board that reads the product's facts before the model (the productFacts call of plan.mjs or of drawBoard before modelFirst) lists the pull requests and reads the files, and fails the log.
test("TST-1260415 #plan and #board of a model that works from a backlog read the declaration and the model's file, and nothing else", async () => {
  for (const [model, name] of [["scrum", "plan"], ["scrum", "board"], ["scrum-wip", "plan"]]) {
    const page = await render(name, { model, overview: head("progress") });
    try {
      const html = page.html();
      assert.match(html, /href="#backlog"/, `${model} ${name}: the link to the backlog`);
      if (name === "board") assert.match(html, /no board/i, `${model}: the board says so`);
      assert.deepEqual(page.log, ["tree main", "file docs/process.md"], `${model} ${name}: ${page.log.join(" | ")}`);
      assert.deepEqual(page.instanceLog, [`readFileAt ${MODEL_FILE} ${MODEL_VERSION}`], `${model} ${name}: the model's file once`);
    } finally { page.done(); }
  }
});

// TST-1260416 · level: release · module: MOD-implementation-pages
// guards: UC-032; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the product whose declared model is Scrum with a work-in-progress limit of 2
// input: the route board rendered, given the branch it shows
// expect: the board is drawn — the columns Backlog, Doing, Review and Done and the line "of 2 items in progress" — from the product's facts, the pull requests among them (counter-proof of TST-1260415: the reading of the model first does not keep a model with a limit from its board)
// Planted fault: a board that answers "no board" for every model (the check of `flow.wip` in drawBoard of src/implementation-pages/backlog.mjs inverted) draws no column and fails.
test("TST-1260416 #board of a model with a limit draws the board from the facts", async () => {
  const page = await render("board", { model: "scrum-wip" });
  try {
    const html = page.html();
    for (const column of ["Backlog", "Doing", "Review", "Done"]) assert.match(html, new RegExp(`data-column="${column}"`), column);
    assert.match(html, /of 2 items in progress/);
    assert.ok(pullsIn(page.log).length > 0, "the pull requests are read");
  } finally { page.done(); }
});

// ---------------------------------------------------------------- MOD-repository-hosts: no date bound on a listing

const json = (body, headers = {}) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json", ...headers } });

// A fake server: `answer(url)` gives the Response; every request is recorded.
async function serving(answer, run) {
  const requests = [], real = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input));
    requests.push(url);
    return answer(url);
  };
  try { return { result: await run(), requests }; } finally { globalThis.fetch = real; }
}

// TST-1260417 · level: release · module: MOD-repository-hosts
// guards: UC-035; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a GitHub repository and a GitLab project each with three merged pull requests — merged on 2026-08-02, 2026-09-15 and 2026-10-20 — and one open; a server that answers only the listing of pull requests (GitHub /pulls, GitLab /merge_requests) and refuses any other request, a search of issues among them
// input: listPullRequests({ state: "merged", updatedSince: "2026-10-01T00:00:00Z" }) on each
// expect: every request is the listing, none is a search and none carries the date bound (no updated_after, no query for a date); the three merged pull requests come back, the one merged before the bound among them, and the open one does not
// Planted fault: the adapter's search for pull requests updated since a date (the `updatedSince` branch of listPullRequests in src/repository-hosts/github.mjs) asks /search/issues, which the fake refuses, and the case fails; a GitLab adapter adding updated_after fails the query check.
test("TST-1260417 listPullRequests has no date bound: the listing is asked for as it stands, on GitHub and on GitLab", async () => {
  const merged = ["2026-08-02T00:00:00Z", "2026-09-15T00:00:00Z", "2026-10-20T00:00:00Z"];
  const gh = (n, mergedAt) => ({ number: n, title: `Pull ${n}`, state: mergedAt ? "closed" : "open", draft: false, html_url: `https://github.com/carol/tool/pull/${n}`, created_at: "2026-08-01T00:00:00Z",
    updated_at: mergedAt ?? "2026-10-21T00:00:00Z", body: "", merged_at: mergedAt, merge_commit_sha: mergedAt ? "f".repeat(40) : null, closed_at: mergedAt, head: { ref: `feature-${n}`, sha: "2".repeat(40) },
    base: { ref: "main", sha: "b".repeat(40) } });
  const github = [...merged.map((at, i) => gh(i + 1, at)), gh(4, null)].reverse();
  const hostGh = connect(parseAddress("https://github.com/carol/tool"), { token: "github_pat_CAROLtoolRELEASE0123456789abcdef" });
  const onGithub = await serving((url) => {
    assert.equal(url.pathname, "/repos/carol/tool/pulls", `a request this fake does not serve: ${url.href}`);
    const state = url.searchParams.get("state") ?? "open";
    return json(github.filter((p) => state === "all" || p.state === state));
  }, () => hostGh.listPullRequests({ state: "merged", updatedSince: "2026-10-01T00:00:00Z" }));
  assert.ok(onGithub.requests.length >= 1);
  assert.deepEqual(onGithub.requests.filter((url) => [...url.searchParams.keys()].some((key) => /since|updated_after|updated_before|^q$/.test(key))), [], "GitHub: no date bound in a query");
  assert.deepEqual(onGithub.result.map((p) => p.number).sort(), [1, 2, 3], "GitHub: the merged pull requests, the oldest among them");

  const gl = (iid, mergedAt) => ({ iid, title: `Merge ${iid}`, state: mergedAt ? "merged" : "opened", draft: false, web_url: `https://gitlab.example.org/space/tool/-/merge_requests/${iid}`,
    created_at: "2026-08-01T00:00:00.000Z", updated_at: mergedAt ?? "2026-10-21T00:00:00.000Z", description: "", merged_at: mergedAt, closed_at: null, source_branch: `feature-${iid}`,
    target_branch: "main", sha: "2".repeat(40), merge_commit_sha: mergedAt ? "f".repeat(40) : null });
  const gitlab = [...merged.map((at, i) => gl(i + 1, at)), gl(4, null)].reverse();
  const hostGl = connect(parseAddress("https://gitlab.example.org/space/tool"), { token: "glpat-SPACEtoolRELEASEvalue0123456789" });
  const onGitlab = await serving((url) => {
    assert.equal(url.pathname, "/api/v4/projects/space%2Ftool/merge_requests", `a request this fake does not serve: ${url.href}`);
    const state = url.searchParams.get("state") ?? "all";
    return json(gitlab.filter((m) => state === "all" || m.state === state), { "X-Total-Pages": "1", "X-Page": "1", "X-Next-Page": "" });
  }, () => hostGl.listPullRequests({ state: "merged", updatedSince: "2026-10-01T00:00:00Z" }));
  assert.ok(onGitlab.requests.length >= 1);
  assert.deepEqual(onGitlab.requests.filter((url) => [...url.searchParams.keys()].some((key) => /since|updated_after|updated_before/.test(key))), [], "GitLab: no date bound in a query");
  assert.deepEqual(onGitlab.result.map((p) => p.number).sort(), [1, 2, 3], "GitLab: the merged merge requests, the oldest among them");
});
