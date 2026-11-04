// The fixture of the tests of MOD-implementation-pages' routes `progress` and `backlog` over a product with sprints (ITM-1252) — a helper, no test of its own. A small
// Scrum-with-limit product of two teams held in memory behind a host of this file's own that answers MOD-repository-hosts' interface — listPullRequests by the state asked —,
// records every call, and applies a commit to its files; the process model is the instance's, read from a second host.
// A route is rendered into a fixture DOM, with the listeners of its click events kept by element, so that a test presses a button as a person does. Nothing reaches the network.
//
// Module: MOD-implementation-pages
// Level: component
//
// The product: team1 closed its sprint 02 (ITM-004, sent back to the backlog) and runs its sprint 03 since 2026-10-20, without a time box and without a branch of its own, with
// ITM-001 — merged into main on 2026-10-21 — and ITM-002, whose pull request is open; team2 closed its sprints 01 and 02 (ITM-003, merged into main on 2026-10-08, during sprint
// 02). ITM-005 is in no sprint. The job JOB-20261027-0900-a1b2 of developer dev-a works on ITM-002 and has not ended.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { gzipSync } from "node:zlib";

import "./site-frame-dom.mjs";
import { REPO, TOKEN, repoServer } from "./app-harness.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import * as measures from "../src/progress-measures/index.mjs";
import { parseSpec } from "../src/spec-document/index.mjs";

export const ADDRESS = "https://github.com/acme/product";
export const COMMIT = "c".repeat(40);
export const JOB = "JOB-20261027-0900-a1b2";

const lines = (...rows) => `${rows.join("\n")}\n`;
const blobOf = (content) => createHash("sha1").update(content).digest("hex");
const SPEC = lines("# SPEC", "", "## 1. Rules", "", "**RULE ONE** *(PO, 2026-09-01)*", "The first rule.", "*Check:* no automatic check; at review.");
const DECLARATION = lines("---", "model: fixture-scrum-wip", "model_file: docs/process-models/fixture.md", `model_version: ${"a".repeat(40)}`, "---", "# How the fixture product is developed", "",
  "## Practices", "", "- none", "", "## Definition of Done", "", "The job rules hold.");
const assignment = (team, owner, builder) => lines(`# ${team}`, "", "## Roles", "", "| Role | Participants |", "|---|---|", `| Owner | ${owner} |`, `| Builders | ${builder} |`, `| Checker | ${builder} |`);
const item = (n, module) => lines("---", `id: ITM-00${n}`, `title: The work of item ${n}`, "level: module", "realises:", "  - RULE ONE", "modules:", `  - ${module}`, "builds_on: []", "tests:", "  - unit",
  "origin:", "  - RULE ONE", "---", `# ITM-00${n} The work of item ${n}`, "", "## Outcome", "", `What item ${n} delivers.`, "", "## Acceptance", "", "- a unit test.");
const CLOSE = (back) => ["", "## Review", "", "What was done is done.", "", "## Unfinished items", "", `to the backlog:${back ? ` ${back}` : ""}`, "into the next sprint:", "", "## Retrospective", "", "- change: smaller items."];
export const sprint = ({ n, start, end = "", goal, selection, closed = false, back = "" }) => lines("---", `sprint: ${n}`, `goal: ${goal}`, `start: ${start}`, `end: ${end}`, "closer: alice", "branch:",
  "selection:", ...selection.map((each) => `  - ${each}`), "---", `# Sprint ${n}`, ...(closed ? CLOSE(back) : []));
const JOB_RECORD = lines("---", `id: ${JOB}`, "kind: implement", "works_on:", "  - ITM-002", "participant: dev-a", "model: example-model", "route: ci hosted", "started_by: alice",
  "start: 2026-10-27 09:00 UTC", "agent_m: unknown, commit unknown", "limit: 1", "---", "## Destinations", "", "## Parameters", "", "```json", "{}", "```");

export const TEAM1_RUNNING = "docs/backlog/sprints/team1/03.md";
export const TEAM2_LAST = "docs/backlog/sprints/team2/02.md";

export function productFiles(overrides = {}) {
  return {
    "SPEC.md": SPEC, "docs/process.md": DECLARATION, "docs/process-models/fixture.md": readFileSync(new URL("./fixtures/flow/scrum-wip.md", import.meta.url), "utf8"),
    "docs/role-assignments/team1.md": assignment("team1", "alice", "dev-a"), "docs/role-assignments/team2.md": assignment("team2", "bob", "dev-b"),
    "docs/backlog/ITM-001-item-1.md": item(1, "MOD-store"), "docs/backlog/ITM-002-item-2.md": item(2, "MOD-pages"), "docs/backlog/ITM-003-item-3.md": item(3, "MOD-mail"),
    "docs/backlog/ITM-004-item-4.md": item(4, "MOD-feed"), "docs/backlog/ITM-005-item-5.md": item(5, "MOD-news"),
    "docs/backlog/sprints/team1/02.md": sprint({ n: 2, start: "2026-10-06", end: "2026-10-17", goal: "Feed", selection: ["ITM-004"], closed: true, back: "ITM-004" }),
    [TEAM1_RUNNING]: sprint({ n: 3, start: "2026-10-20", goal: "Store and show", selection: ["ITM-001", "ITM-002"] }),
    "docs/backlog/sprints/team2/01.md": sprint({ n: 1, start: "2026-09-01", end: "2026-09-07", goal: "Mail", selection: ["ITM-003"], closed: true, back: "ITM-003" }),
    [TEAM2_LAST]: sprint({ n: 2, start: "2026-10-06", end: "2026-10-12", goal: "Mail again", selection: ["ITM-003"], closed: true }),
    [`docs/jobs/${JOB}.md`]: JOB_RECORD,
    ...overrides,
  };
}

// A pull request with the date it was last updated, as GitHub gives it.
const pr = (number, id, state, opened, merged = null) => ({ number, title: `${id}: the work of ${id}`, branch: `work/${id}`, base: "main", head: String(number).repeat(40).slice(0, 40), state, draft: false,
  url: `${ADDRESS}/pull/${number}`, opened, merged, closed: merged, body: "", updated: merged ?? opened, mergeCommit: merged ? "f".repeat(40) : null });
export const PULL_REQUESTS = [pr(1, "ITM-001", "merged", "2026-10-20T09:00:00Z", "2026-10-21T10:00:00Z"), pr(2, "ITM-002", "open", "2026-10-21T12:00:00Z"),
  pr(3, "ITM-003", "merged", "2026-10-07T09:00:00Z", "2026-10-08T10:15:00Z"), pr(4, "Tidy the README", "merged", "2026-09-02T09:00:00Z", "2026-09-02T10:00:00Z")];

const named = (name, message) => Object.assign(new Error(message), { name });
// The product's host, applying a commit to `files`; `calls` keeps every call by its name and arguments, `commits` each commitFiles call.
export function hostOf(files, { pullRequests = PULL_REQUESTS, calls = [], commits = [] } = {}) {
  const snapshot = () => ({ repository: { server: "github", path: "acme/product", web: ADDRESS }, ref: "main", commit: COMMIT, paths: Object.keys(files),
    blob: (path) => (Object.hasOwn(files, path) ? blobOf(files[path]) : null), read: async (path) => (Object.hasOwn(files, path) ? files[path] : null), readMany: async () => {},
    readOn: async () => { throw named("NotFound", "no such file"); } });
  return {
    calls, commits,
    async repositoryInfo() { calls.push(["repositoryInfo"]); return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
    async readSnapshot(ref) { calls.push(["readSnapshot", ref]); return snapshot(); },
    async listPullRequests(...filter) {
      calls.push(["listPullRequests", ...filter]);
      const { state = "all" } = filter[0] ?? {};
      return pullRequests.filter((p) => state === "all" || p.state === state);
    },
    async containsCommit(...args) { calls.push(["containsCommit", ...args]); return false; },
    async commitFiles(change) { calls.push(["commitFiles"]); commits.push(change); for (const file of change.files) { if (file.delete) delete files[file.path]; else files[file.path] = file.text; } return { commit: "d".repeat(40), url: "https://example.org/d" }; },
  };
}

// The fixture DOM's selectors, as a browser answers them for the selectors these routes use: [attr] and [attr="value"], and the Mermaid code block.
const matches = (element, selector) => {
  const attribute = /^\[([a-z-]+)(?:="([^"]*)")?\]$/.exec(selector);
  if (selector === "pre > code.language-mermaid") return element.localName === "code" && element.getAttribute("class") === "language-mermaid" && element.parentNode?.localName === "pre";
  return attribute ? (attribute[2] === undefined ? element.getAttribute(attribute[1]) !== null : element.getAttribute(attribute[1]) === attribute[2]) : false;
};
export const found = (root, selector) => {
  const all = [];
  (function walk(node) { for (const child of node.childNodes) if (child.nodeType === 1) { if (matches(child, selector)) all.push(child); walk(child); } })(root);
  return all;
};
globalThis.window.Element.prototype.querySelectorAll = function querySelectorAll(selector) { return found(this, selector); };
globalThis.window.Element.prototype.replaceWith = function replaceWith(node) { this.parentNode.insertBefore(node, this); this.parentNode.removeChild(this); };
globalThis.window.Element.prototype.querySelector = function querySelector(selector) { return found(this, selector)[0] ?? null; };
globalThis.SVGElement ??= class SVGElement {};

const { view } = await import("../src/implementation-pages/index.mjs");

// The page of route `name` with `params`: the target it is drawn into, the product's files and host, press(element) — the person's click on an element, awaited —, and `went`, each
// route and params the route asked the frame to go to (ViewContext's go), in order.
// Every click listener the route adds, now or when it draws itself again, is kept by its element.
export async function render(name, params = {}, { files = productFiles(), pullRequests = PULL_REQUESTS } = {}) {
  const route = view.routes.find((candidate) => candidate.name === name);
  const host = hostOf(files, { pullRequests });
  const instance = hostOf({ "SPEC.md": "# Instance\n", "docs/process-models/fixture.md": files["docs/process-models/fixture.md"] }, { pullRequests: [] });
  const handlers = [];
  const Element = globalThis.window.Element, add = Element.prototype.addEventListener;
  Element.prototype.addEventListener = function (type, listener, ...rest) { if (type === "click") handlers.push([this, listener]); return add.call(this, type, listener, ...rest); };
  globalThis.mermaid = { initialize() {}, mermaidAPI: { getDiagramFromText: async () => ({ db: { getVertices: () => ({}) } }) }, run: async () => {} };
  const target = globalThis.document.createElement("div");
  globalThis.document.body.append(target);
  const went = [];
  const context = { page: "review", instance: { repository: "acme/agent-m", host: instance }, product: { address: ADDRESS, kind: "github", host, tokenStored: true }, store: {},
    go(to, params = {}) { went.push([to, params]); } };
  await route.render(target, context, params);
  const press = async (element) => {
    const listener = handlers.filter(([at]) => at === element).at(-1)?.[1];
    if (typeof listener !== "function") throw new Error("the element has no click listener");
    await listener({ isTrusted: true });
    // What the click started without waiting for it — a page that draws itself again — settles before the test looks.
    await new Promise((resolve) => setTimeout(resolve, 30));
  };
  const done = () => { Element.prototype.addEventListener = add; delete globalThis.mermaid; };
  return { target, files, host, route, press, done, went, html: () => target.innerHTML };
}

// The HTML of the part that begins with `marker` and ends where the next panel begins.
export function part(html, marker) {
  const at = html.indexOf(marker);
  if (at < 0) return "";
  const next = html.indexOf('<section class="panel"', at + marker.length);
  return html.slice(at, next < 0 ? undefined : next);
}
export const row = (html, item) => { const at = html.indexOf(`data-item="${item}"`); return at < 0 ? "" : html.slice(at, html.indexOf("</tr>", at)); };

// ---------------------------------------------------------------- the same product over a counting fake of GitHub (ITM-1260)
//
// The fixture's files served by tests/app-harness.mjs' repoServer, a fake of GitHub's API that counts every request, through the real MOD-repository-hosts host connected
// with a token; the product is the instance itself, at the commit COMMIT. `overview` holds the files of the branch overview-cache by path, served through the contents API
// (`?ref=overview-cache`) and counted as `handler GET …`; a file it does not hold is answered 404. The pull requests are those above, in GitHub's form, at /pulls; a test's own
// handlers, `server`, answer what else it asks of the server, as repoServer's handlers do.

export const GITHUB_ADDRESS = `https://github.com/${REPO}`;
// The declaration of the product over GitHub: its model_version is the head, which the instance — the same repository — holds.
export const DECLARATION_AT_HEAD = DECLARATION.replace("a".repeat(40), COMMIT);

const githubPull = (p) => ({ number: p.number, title: p.title, head: { ref: p.branch, sha: p.head }, base: { ref: p.base }, state: p.state === "open" ? "open" : "closed",
  merged_at: p.merged, merge_commit_sha: p.mergeCommit, created_at: p.opened, updated_at: p.updated, closed_at: p.closed, draft: false, html_url: p.url, body: p.body });

// The view of `page` — "progress" or "backlog" — of `files` at `commit`, as the workflow stores it: progressView or backlogView of the product's facts (here the scope `work`
// over the in-memory host above, with the SPEC's requirements, and the pull requests given), as gzipped JSON.
export async function storedViewBytes(page, files, commit = COMMIT, pullRequests = PULL_REQUESTS) {
  const host = hostOf({ ...files }, { pullRequests });
  const snapshot = await host.readSnapshot("main");
  const facts = await measures.productFacts(host, snapshot, () => host.readSnapshot("main"), new Date(), { scope: "work" });
  const requirements = [...parseSpec(files["SPEC.md"] ?? "").requirements.keys()];
  const view = page === "progress" ? measures.progressView(facts, new Date()) : measures.backlogView({ ...facts, requirements }, new Date());
  return new Uint8Array(gzipSync(JSON.stringify({ ...view, commit })));
}

export async function renderOverGitHub(name, params = {}, { files = productFiles({ "docs/process.md": DECLARATION_AT_HEAD }), overview = {}, pullRequests = PULL_REQUESTS, server = [] } = {}) {
  const route = view.routes.find((candidate) => candidate.name === name);
  const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  const cache = (url) => {
    if (url.origin !== "https://api.github.com" || url.searchParams.get("ref") !== "overview-cache") return undefined;
    const path = decodeURIComponent(url.pathname.slice(`/repos/${REPO}/contents/`.length));
    return Object.hasOwn(overview, path) ? new Response(overview[path], { status: 200 }) : new Response('{"message":"Not Found"}', { status: 404 });
  };
  const pulls = (url) => (url.origin === "https://api.github.com" && url.pathname === `/repos/${REPO}/pulls` ? json(pullRequests.map(githubPull)) : undefined);
  const srv = await repoServer({ files, handlers: [cache, pulls, ...server], head: COMMIT });
  const real = globalThis.fetch;
  globalThis.fetch = srv.fetch;
  const host = connect(parseAddress(GITHUB_ADDRESS), { token: TOKEN });
  const handlers = [];
  const Element = globalThis.window.Element, add = Element.prototype.addEventListener;
  Element.prototype.addEventListener = function (type, listener, ...rest) { if (type === "click") handlers.push([this, listener]); return add.call(this, type, listener, ...rest); };
  globalThis.mermaid = { initialize() {}, mermaidAPI: { getDiagramFromText: async () => ({ db: { getVertices: () => ({}) } }) }, run: async () => {} };
  const target = globalThis.document.createElement("div");
  globalThis.document.body.append(target);
  const went = [];
  const context = { page: "review", instance: { repository: REPO, host }, product: { address: GITHUB_ADDRESS, kind: "github", host, tokenStored: true, ref: "main" }, store: {},
    go(to, params = {}) { went.push([to, params]); } };
  const done = () => { Element.prototype.addEventListener = add; delete globalThis.mermaid; globalThis.fetch = real; };
  try { await route.render(target, context, params); } catch (failure) { done(); throw failure; }
  const press = async (element) => {
    const listener = handlers.filter(([at]) => at === element).at(-1)?.[1];
    if (typeof listener !== "function") throw new Error("the element has no click listener");
    await listener({ isTrusted: true });
    await new Promise((resolve) => setTimeout(resolve, 30));
  };
  return { target, srv, route, press, done, went, html: () => target.innerHTML };
}

// The requests of a page about the branch overview-cache, about pull requests, for a facts file, and the batches of files.
export const cacheReads = (requests) => requests.filter((r) => r.startsWith("handler GET ") && r.includes("ref=overview-cache"));
export const pullsReads = (requests) => requests.filter((r) => /\/pulls\b|\/search\/issues/.test(r));
export const factsReads = (requests) => requests.filter((r) => r.includes(".facts.json"));
export const batchReads = (requests) => requests.filter((r) => r.startsWith("batch "));
