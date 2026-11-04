// MOD-implementation-pages' route `implement`, the backlog's Start jobs when the route of a job does not answer after its start record was committed (UC-034 4a), as the accepted text states it: "The bridge or the
// runner does not answer. The job stays *queued*. Agent M says which route is down, and the author may cancel or reassign the job (UC-036)." and docs/architecture/MOD-implementation-pages.md: "*Start jobs*, which
// queues each job on its participant's route — handed to a Bridge at once where the route is one".
// Run: node --test tests/implementation-pages-implement-queued.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-034; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; THE LOCAL BRIDGE REQUIRES A TOKEN
// Level: unit
//
// The product is the one-team fixture of tests/implementation-pages-implement.test.mjs (ITM-005 the one startable item), held in memory behind a host of this file's own that keeps every commit; the one builder, dev-a,
// is a CLI agent reached through the Bridge lab-pc, which this browser has a connection to; the network is replaced by a `fetch` that answers nothing. Readings the texts leave open, which the tests state:
//   - "the author may cancel or reassign the job (UC-036)": the controls are those of the job's page on the job dashboard (UC-036 steps 6 and 7: Cancel for a queued job, Retry offering another holder); the line of the
//     result links that page, as the page of progress links the jobs it lists.
//   - A failure before anything was committed (no `queued` on it) is still "nothing was started for it".
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import "./site-frame-dom.mjs";
const { view } = await import("../src/implementation-pages/index.mjs");
const { registerStrategies } = await import("../src/job-runner/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "implement");

// ---------------------------------------------------------------- the DOM: the selectors the route finds its controls by
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
const trusted = () => Object.defineProperty(new Event("click"), "isTrusted", { value: true });

// ---------------------------------------------------------------- the strategies the kind names: stand-ins
const part = (name) => ({ name, text: name, size: 0, sources: [], required: true });
registerStrategies("tests/implementation-pages-implement-queued.test.mjs", {
  recipes: { "implementation-inputs": async (_, params) => [part(`inputs of ${(params.items ?? []).join(", ")}`)], "chapters-for-implementation": async () => [part("chapters 9, 11, 12 and 13")],
    "resource-pins": async () => [] },
  preconditions: { "rests-on-accepted": async () => [] },
  writers: { "branch-and-pull-request": async () => ({ commits: [], files: [], pullRequest: null, shown: null, notes: [] }) },
});

// ---------------------------------------------------------------- the fixture product
const lines = (...rows) => `${rows.join("\n")}\n`;
const blobOf = (content) => createHash("sha1").update(content).digest("hex");
const ADDRESS = "https://github.com/acme/product";
const SPEC = lines("# SPEC", "", "## 1. Rules", "", "**RULE ONE** *(PO, 2026-09-01)*", "The first rule.", "*Check:* no automatic check; at review.");
const DECLARATION = lines("---", "model: fixture-scrum-wip", "model_file: docs/process-models/fixture.md", `model_version: ${"a".repeat(40)}`, "---", "# How the fixture product is developed", "", "## Practices", "",
  "- none", "", "## Branches", "", "| Phase or time box | Branch |", "|---|---|", "| Sprint | `sprint/<team>/<nn>` |", "", "## Definition of Done", "", "The job rules hold.");
const assignment = lines("# team1", "", "## Roles", "", "| Role | Participants |", "|---|---|", "| Owner | alice |", "| Builders | dev-a |", "| Checker | dev-a |");
const moduleFile = (id) => lines("---", `id: ${id}`, `title: The module ${id}`, `folder: src/${id.slice(4)}/`, "realises:", "  - RULE ONE", "follows:", "  - ARC-001", "uses: []", "provides:", "  - read", "---", `# ${id} The module ${id}`);
const itemText = lines("---", "id: ITM-005", "title: The work of item 5", "level: module", "realises:", "  - RULE ONE", "modules:", "  - MOD-store", "builds_on: []", "tests:", "  - unit", "origin:", "  - RULE ONE", "---",
  "# ITM-005 The work of item 5", "", "## Outcome", "", "What item 5 delivers.", "", "## Acceptance", "", "- a unit test.");
const sprint = lines("---", "sprint: 1", "goal: Store and show", "start: 2026-09-14", "end:", "closer: alice", "branch:", "selection:", "  - ITM-005", "---", "# team1 Sprint 01");
const FILES = {
  "SPEC.md": SPEC, "docs/process.md": DECLARATION, "docs/process-models/fixture.md": readFileSync(new URL("./fixtures/flow/scrum-wip.md", import.meta.url), "utf8"),
  "docs/role-assignments/team1.md": assignment, "docs/architecture/MOD-store.md": moduleFile("MOD-store"), "docs/backlog/ITM-005-item-5.md": itemText,
  "docs/backlog/sprints/team1/01.md": sprint, ".github/workflows/agent-m-jobs.yml": "name: agent-m jobs\n",
};
const ROOT = new URL("../", import.meta.url);
const HEAD = readFileSync(new URL("docs/participants.md", ROOT), "utf8").split("\n").filter((row, at, all) => at <= all.findIndex((each) => each.startsWith("|---"))).join("\n");
const CAPABILITIES = "read the repository, write to the repository, run code and tests, use tools";
const REGISTER = `${HEAD}\n| dev-a | CLI agent | model-a | 200000 | — | ${CAPABILITIES} | this machine | bridge lab-pc agent claude |\n`;
const SETTINGS = { "bridge:lab-pc": JSON.stringify({ address: "http://127.0.0.1:4799", token: "pairing-token" }) };

// A host of this file's own: the part of MOD-repository-hosts' interface the route uses, keeping every commit it is asked for; `refuse` makes the commit fail.
function hostOf(files, commits, refuse = null) {
  let head = 0;
  const tree = new Map(Object.entries(files));
  const snapshot = () => ({ repository: { server: "github", path: "acme/product", web: ADDRESS }, ref: "main", commit: String(head).padStart(40, "c"), paths: [...tree.keys()], blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null),
    read: async (path) => (tree.has(path) ? tree.get(path) : null) });
  return {
    async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
    async readFileAt(path, shas) { return new Map(shas.map((commit) => [commit, tree.has(path) ? tree.get(path) : null])); },
    async readSnapshot() { return snapshot(); },
    async listPullRequests() { return []; },
    async commitFiles(change) {
      if (refuse) throw refuse;
      commits.push(structuredClone(change));
      head += 1;
      for (const file of change.files) tree.set(file.path, file.text);
      return { commit: String(head).padStart(40, "c"), url: `${ADDRESS}/commit/${head}` };
    },
  };
}

// Render the route, press Start jobs as a person, and give back what the page said and what was committed; the Bridge answers nothing.
async function started({ refuse = null } = {}) {
  const commits = [];
  const host = hostOf(FILES, commits, refuse);
  const instanceHost = hostOf({ "docs/participants.md": REGISTER, "SPEC.md": "# Instance\n", "docs/process-models/fixture.md": FILES["docs/process-models/fixture.md"] }, []);
  const store = { prefix: "", storage: { getItem: (key) => SETTINGS[key] ?? null } };
  const context = { page: "review", instance: { repository: "acme/agent-m", host: instanceHost }, product: { address: ADDRESS, kind: "github", host, tokenStored: true }, store, go() {} };
  const target = document.createElement("div");
  document.body.append(target);
  const fetched = globalThis.fetch;
  globalThis.fetch = async () => { throw new TypeError("fetch failed"); };
  try {
    await route.render(target, context, {});
    found(target, "[data-start-jobs]")[0].dispatchEvent(trusted());
    for (let turn = 0; turn < 400 && text(found(target, "[data-start-result]")[0]) === ""; turn += 1) await new Promise((resolve) => setImmediate(resolve));
    return { target, commits, result: found(target, "[data-start-result]")[0] };
  } finally { globalThis.fetch = fetched; }
}
const records = (commits) => commits.flatMap((commit) => commit.files).filter((file) => /^docs\/jobs\/JOB-/.test(file.path));
const idOf = (file) => /\/(JOB-[^/]+)\.md$/.exec(file.path)[1];

// TST-1410001 · level: unit · module: MOD-implementation-pages
// guards: UC-034; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY
// given: the one-team fixture, ITM-005 ready and ticked; dev-a is a CLI agent reached through the Bridge lab-pc, which this browser has a connection to and which answers nothing
// input: a click of a person on Start jobs
// expect: UC-034 4a "The job stays queued. Agent M says which route is down": the start record of ITM-005 is committed under docs/jobs/ with the route bridge lab-pc; the result names ITM-005, the job's id, says the job stays queued, names the route bridge lab-pc, and does not say that nothing was started for it
test("TST-1410001: a Bridge that does not answer leaves the job queued, and the result names the route", async () => {
  const { commits, result } = await started();
  assert.equal(records(commits).length, 1, "the start record is committed: the job is queued");
  const [record] = records(commits);
  assert.match(record.text, /^route: bridge lab-pc$/m);
  const said = text(result);
  assert.match(said, /ITM-005/);
  assert.ok(said.includes(idOf(record)), "the result names the job");
  assert.match(said, /queued/i);
  assert.match(said, /bridge lab-pc/);
  assert.doesNotMatch(said, /nothing was started/i, "the page does not say that nothing was started for a job whose record it committed");
});

// TST-1410002 · level: unit · module: MOD-implementation-pages
// guards: UC-034; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY
// given: the product of TST-1410001, whose Bridge answers nothing
// input: a click of a person on Start jobs
// expect: UC-034 4a "the author may cancel or reassign the job (UC-036)": the line of the queued job links the job's page on the job dashboard (#job/id=<the job's id>/product=<the product's address>, the product not being the instance), where Cancel and Retry stand, and the link says cancel and reassign
test("TST-1410002: the queued job's line links its page, where the author cancels or reassigns it", async () => {
  const { commits, result } = await started();
  const links = found(result, "[data-job-page]");
  assert.equal(links.length, 1, "one link to the job's page");
  assert.ok(links[0].getAttribute("href").endsWith(`#job/id=${idOf(records(commits)[0])}/product=${encodeURIComponent(ADDRESS)}`),links[0].getAttribute("href"));
  assert.match(text(links[0]), /cancel/i);
  assert.match(text(links[0]), /reassign/i);
});

// TST-1410003 · level: unit · module: MOD-implementation-pages
// guards: UC-034; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY
// given: the product of TST-1410001, in which the server refuses the commit of the start record (the branch moved), so nothing is committed
// input: a click of a person on Start jobs
// expect: counter-proof of TST-1410001: no start record is committed; the result names ITM-005 and says "nothing was started for it", and it carries no link to a job's page
test("TST-1410003: a start the server refused before anything was committed still says that nothing was started", async () => {
  const { commits, result } = await started({ refuse: Object.assign(new Error("The branch moved"), { name: "Moved" }) });
  assert.equal(records(commits).length, 0, "nothing is committed");
  assert.match(text(result), /ITM-005: The branch moved; nothing was started for it\./);
  assert.equal(found(result, "[data-job-page]").length, 0, "no job, no link");
});
