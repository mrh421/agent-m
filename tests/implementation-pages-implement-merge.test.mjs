// MOD-implementation-pages' route `implement` — the jobs' pull requests and Merge (ITM-734, ITM-1264), as the accepted text of docs/architecture/MOD-implementation-pages.md states it: "`implement` — … for each pull request its CI
// runs and whether the Definition of Done holds, and *Merge* once it does"; "The pull requests it shows are the open ones that name a job (`listPullRequests` with the state `open`), and the records of those jobs, in one
// batch; whether the Definition of Done holds is the result of the check `agent-m done` among the runs of the head (MOD-workflow-entries' `onDoneCheck`), and no gate record or module file is read for it. A merged pull
// request is shown on its job's page (MOD-main-page, route `job`)", and UC-024 steps 11 to 13: the pull request names the job; "CI is green and the Definition of Done holds. The pull request is merged — … by a person with
// **Merge** on the dashboard, one click. Until every condition holds, neither can merge."; "The dashboard shows the step as done, with branch, the red run, the green run and the merge".
// Run: node --test tests/implementation-pages-implement-merge.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-024; CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI; A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS; THE DEFAULT DEFINITION OF DONE IS THE JOB RULES
// Guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; ONE CLICK PER DECISION
// Level: unit
//
// The product is the Scrum-with-limit fixture of tests/implementation-pages-implement.test.mjs, held in memory behind a host of this file's own that answers MOD-repository-hosts' interface — listPullRequests,
// pullRequestFacts, listCiRuns, mergePullRequest — and records every call. Nothing reaches the network. Readings the texts leave open, which the tests state (the pull request names them):
//   - A pull request is "of a job the page started" when its description has the line `Job: <id>` (MOD-runtimes' writer `branch-and-pull-request` writes it) and the id is that of a record of kind implement or refactor under docs/jobs/.
//   - Each such pull request that is open is a <section data-pull="<number>" data-state="open">. Its CI runs are <li data-ci="first"> (the run or runs of the first commit, the tests-only one) and <li data-ci="last"> (those of the
//     head), each with a link to the run's page. <p data-done data-holds="true|false"> says whether the Definition of Done holds — whether the head's check `agent-m done`, among the checks pullRequestFacts gives, passed —
//     and links that run.
//   - <button data-merge-pull="<number>"> is Merge, offered for an open pull request that is no draft and whose head passed `agent-m done`; its outcome is <p data-merge-result>. A click a script makes merges nothing.
//   - A merged pull request is not listed: the page asks for the open ones only.
//   - ITM-1170: "where `repositoryInfo` gives `greenToMerge` false, that the server does not enforce "merge only on green", with the page `branchProtection` (UC-024 12a)" is one <p data-green-to-merge> with a link
//     to that page; where greenToMerge is true or null the page says nothing of it.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import "./site-frame-dom.mjs";
const { view } = await import("../src/implementation-pages/index.mjs");
const { startRecord } = await import("../src/job-ledger/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "implement");

// ---------------------------------------------------------------- the DOM: the selectors the route finds its controls by
const matches = (element, selector) => {
  const attribute = /^\[([a-z-]+)(?:="([^"]*)")?\]$/.exec(selector);
  return attribute ? (attribute[2] === undefined ? element.getAttribute(attribute[1]) !== null : element.getAttribute(attribute[1]) === attribute[2]) : element.localName === selector;
};
const found = (root, selector) => {
  const all = [];
  (function walk(node) { for (const child of node.childNodes) if (child.nodeType === 1) { if (matches(child, selector)) all.push(child); walk(child); } })(root);
  return all;
};
globalThis.window.Element.prototype.querySelectorAll = function querySelectorAll(selector) { return found(this, selector); };
globalThis.window.Element.prototype.querySelector = function querySelector(selector) { return found(this, selector)[0] ?? null; };
globalThis.SVGElement ??= class SVGElement {};
afterEach(() => { delete globalThis.mermaid; });
const text = (node) => node.textContent.replace(/\s+/g, " ").trim();
const trusted = () => Object.defineProperty(new Event("click"), "isTrusted", { value: true });
const settle = async () => { for (let turn = 0; turn < 60; turn += 1) await new Promise((resolve) => setImmediate(resolve)); };

// ---------------------------------------------------------------- the strategies the kind names: stand-ins
import { registerStrategies } from "../src/job-runner/index.mjs";
const part = (name) => ({ name, text: name, size: 0, sources: [], required: true });
registerStrategies("tests/implementation-pages-implement-merge.test.mjs", {
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
const moduleFile = (id, uses) => lines("---", `id: ${id}`, `title: The module ${id}`, `folder: src/${id.slice(4)}/`, "realises:", "  - RULE ONE", "follows:", "  - ARC-001", `uses:${uses.length ? `\n${uses.map((use) => `  - ${use}`).join("\n")}` : " []"}`,
  "provides:", "  - read", "---", `# ${id} The module ${id}`);
const id = (n) => `ITM-${String(n).padStart(3, "0")}`;
const itemPath = (n) => `docs/backlog/${id(n)}-item-${n}.md`;
const itemText = (n, { modules, buildsOn = [], realises = ["RULE ONE"] }) => lines("---", `id: ${id(n)}`, `title: The work of item ${n}`, "level: module", "realises:", ...realises.map((name) => `  - ${name}`), "modules:",
  ...modules.map((module) => `  - ${module}`), ...(buildsOn.length ? ["builds_on:", ...buildsOn.map((dependency) => `  - ${dependency}`)] : ["builds_on: []"]), "tests:", "  - unit", "origin:", "  - RULE ONE", "---",
  `# ${id(n)} The work of item ${n}`, "", "## Outcome", "", `What item ${n} delivers.`, "", "## Acceptance", "", "- a unit test.");
const sprint = (selection) => lines("---", "sprint: 1", "goal: Store and show", "start: 2026-09-14", "end:", "closer: alice", "branch:", "selection:", ...selection.map((each) => `  - ${each}`), "---", "# team1 Sprint 01");
const sha = (digit) => digit.repeat(40);
const NEXT = { 1: "2", 3: "4", 5: "6", 7: "8", 9: "a" };

// A job's start record, as MOD-job-ledger writes it.
const jobFile = (jobId, item, kind = "implement") => startRecord({ id: jobId, kind, worksOn: [item], participant: "dev-a", model: "model-a", route: "ci hosted", run: null, retries: null, startedBy: "alice",
  start: new Date("2026-09-16T09:00:00Z"), agentM: { version: "2026.10.0", commit: sha("a") }, inputs: [], limit: 5, destinations: [], params: { items: [item], merges: "person" } });
// The run of the check `agent-m done` on the head of pull request `number`.
const doneRun = (number) => `${ADDRESS}/actions/runs/${number}01/job/${number}02`;

// One job with its pull request. `first` and `last` are the CI results of the first (tests-only) and the last commit; `code` is the first commit's code file, if it changes one; `done` the result of the head's check
// `agent-m done`.
function pullOf({ number, item, jobId, digit, state = "open", draft = false, first = "failure", last = "success", code = null, done = "success", body = null }) {
  const commits = [{ sha: sha(digit), message: "tests", files: ["tests/store-734.test.mjs", ...(code ? [code] : [])], ci: first }, { sha: sha(NEXT[digit]), message: "code", files: ["src/store/index.mjs"], ci: last }];
  const request = { number, title: `${jobId}: implement ${item}`, branch: `job/${jobId}`, base: "main", head: commits[1].sha, mergeCommit: state === "merged" ? sha("e") : null, state, draft, url: `${ADDRESS}/pull/${number}`,
    opened: "2026-09-16T10:00:00Z", merged: state === "merged" ? "2026-09-16T12:00:00Z" : null, closed: state === "merged" ? "2026-09-16T12:00:00Z" : null, body: body ?? `Job: ${jobId}\nKind: implement\nBacklog item: ${item}\n` };
  const runs = commits.map((commit, at) => ({ id: `${number}0${at}`, workflow: "tests", commit: commit.sha, event: "pull_request", state: commit.ci === "failure" ? "failure" : "success", url: `${ADDRESS}/actions/runs/${number}0${at}`,
    started: "2026-09-16T10:00:00Z", ended: "2026-09-16T10:01:00Z" }));
  const facts = { pullRequest: request, commits, files: [{ path: "tests/store-734.test.mjs", change: "added" }, { path: "src/store/index.mjs", change: "modified" }, ...(code ? [{ path: code, change: "modified" }] : [])], reviews: [],
    checks: [{ name: "agent-m tests", state: last, url: runs[1].url }, { name: "agent-m done", state: done, url: doneRun(number) }] };
  const files = { [`docs/jobs/${jobId}.md`]: jobFile(jobId, item).text };
  return { request, facts, runs, files };
}

function productFiles(pulls) {
  return {
    "SPEC.md": SPEC, "docs/process.md": DECLARATION, "docs/process-models/fixture.md": readFileSync(new URL("./fixtures/flow/scrum-wip.md", import.meta.url), "utf8"),
    "docs/role-assignments/team1.md": assignment,
    "docs/architecture/MOD-store.md": moduleFile("MOD-store", []), "docs/architecture/MOD-pages.md": moduleFile("MOD-pages", ["MOD-store.read"]), "docs/architecture/MOD-mail.md": moduleFile("MOD-mail", []),
    [itemPath(1)]: itemText(1, { modules: ["MOD-store"] }), [itemPath(2)]: itemText(2, { modules: ["MOD-pages"], buildsOn: ["ITM-001"] }),
    [itemPath(3)]: itemText(3, { modules: ["MOD-mail"] }), [itemPath(4)]: itemText(4, { modules: ["MOD-pages"], buildsOn: ["ITM-003"] }),
    [itemPath(5)]: itemText(5, { modules: ["MOD-store"] }), [itemPath(6)]: itemText(6, { modules: ["MOD-mail"], realises: ["RULE NOT ACCEPTED"] }),
    "docs/backlog/sprints/team1/01.md": sprint(["ITM-004", "ITM-005", "ITM-006"]),
    ".github/workflows/agent-m-jobs.yml": "name: agent-m jobs\n",
    ...Object.assign({}, ...pulls.map((each) => each.files)),
  };
}

const ROOT = new URL("../", import.meta.url);
// The server's page on which the rule behind greenToMerge is set, as the host's webLinks gives it (MOD-repository-hosts' WebLinks `branchProtection`).
const BRANCH_PROTECTION = `${ADDRESS}/settings/branches`;
const HEAD = readFileSync(new URL("docs/participants.md", ROOT), "utf8").split("\n").filter((row, at, all) => at <= all.findIndex((each) => each.startsWith("|---"))).join("\n");
const REGISTER = `${HEAD}\n| dev-a | model endpoint | model-a | 200000 | — | read the repository, write to the repository, run code and tests, use tools | this machine | ci hosted secret DEV_KEY |\n`;

// A host of this file's own: the part of MOD-repository-hosts' interface the route uses, recording what it is asked for. `refuse` is what mergePullRequest throws, if anything; `greenToMerge` is what repositoryInfo
// gives for it (ITM-1170).
function hostOf(files, pulls, calls, refuse = null, greenToMerge = null) {
  const tree = new Map(Object.entries(files));
  const snapshot = () => ({ repository: { server: "github", path: "acme/product", web: ADDRESS }, ref: "main", commit: sha("c"), paths: [...tree.keys()], blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null),
    read: async (path) => (tree.has(path) ? tree.get(path) : null) });
  return {
    async repositoryInfo() { calls.push(["repositoryInfo"]); return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "", greenToMerge }; },
    // The file at each commit, as the one tree holds it (MOD-repository-hosts' readFileAt), for the declared model and practices the route reads (ITM-1264).
    async readFileAt(path, commits) { return new Map(commits.map((commit) => [commit, tree.has(path) ? tree.get(path) : null])); },
    async readSnapshot() { return snapshot(); },
    async listPullRequests({ state = "all" } = {}) { calls.push(["listPullRequests", state]); return pulls.map((each) => each.request).filter((request) => state === "all" || request.state === state); },
    async containsCommit() { return false; },
    async commitFiles() { calls.push(["commitFiles"]); throw new Error("a render writes nothing"); },
    async pullRequestFacts(number) { calls.push(["pullRequestFacts", number]); return pulls.find((each) => each.request.number === number).facts; },
    async listCiRuns({ commit }) { calls.push(["listCiRuns", commit]); return pulls.flatMap((each) => each.runs).filter((run) => run.commit === commit); },
    async mergePullRequest(number, expectedHead) {
      calls.push(["mergePullRequest", number, expectedHead]);
      if (refuse) throw refuse;
      return { commit: sha("e") };
    },
    webLinks() { return { actions: `${ADDRESS}/actions`, branchProtection: BRANCH_PROTECTION }; },
  };
}
async function render(pulls, { refuse = null, extraPulls = [], greenToMerge = null } = {}) {
  const calls = [];
  const all = [...pulls, ...extraPulls];
  const host = hostOf(productFiles(pulls), all, calls, refuse, greenToMerge);
  const instanceHost = hostOf({ "docs/participants.md": REGISTER, "SPEC.md": "# Instance\n", "docs/process-models/fixture.md": productFiles([])["docs/process-models/fixture.md"] }, [], []);
  const context = { page: "review", instance: { repository: "acme/agent-m", host: instanceHost }, product: { address: ADDRESS, kind: "github", host, tokenStored: true }, store: {}, go() {} };
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, context, {});
  return { target, calls };
}
const pullBox = (target, number) => found(target, `[data-pull="${number}"]`)[0];
const shown = (target, number) => { const box = pullBox(target, number); assert.ok(box, `pull request #${number} is shown`); return box; };
const merges = (calls) => calls.filter((call) => call[0] === "mergePullRequest");

// TST-734001 · level: unit · module: MOD-implementation-pages
// guards: UC-024; CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI; A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS; ONE CLICK PER DECISION
// given: the job JOB-20260916-0900-a1b2 for ITM-005, whose pull request #7 has a red run on its first (tests-only) commit and a green run on its head, whose head passed the check agent-m done, and every changed code file in MOD-store's folder
// input: the route implement's render; a click a script makes on Merge; then a click of a person
// expect: the page shows #7 with the red run of the first commit and the green run of the head, each linked to its page, and says the Definition of Done holds, linking the run of agent-m done; Merge is offered; the render and the script's click merge nothing; the person's click calls mergePullRequest(7) once, on the head shown, and the page says the pull request is merged
test("a job's pull request shows its red and green CI runs and that the Definition of Done holds, and Merge merges it on the head shown, on a person's click only", async () => {
  const pull = pullOf({ number: 7, item: "ITM-005", jobId: "JOB-20260916-0900-a1b2", digit: "1" });
  const { target, calls } = await render([pull]);
  const box = shown(target, 7);
  assert.equal(box.getAttribute("data-state"), "open");
  const first = found(box, `[data-ci="first"]`)[0], last = found(box, `[data-ci="last"]`)[0];
  assert.match(text(first), /failure/);
  assert.equal(found(first, "a")[0]?.getAttribute("href"), `${ADDRESS}/actions/runs/700`);
  assert.match(text(last), /success/);
  assert.equal(found(last, "a")[0]?.getAttribute("href"), `${ADDRESS}/actions/runs/701`);
  assert.equal(found(box, "[data-done]")[0].getAttribute("data-holds"), "true");
  assert.equal(found(found(box, "[data-done]")[0], "a")[0]?.getAttribute("href"), doneRun(7));
  const merge = found(box, `[data-merge-pull="7"]`)[0];
  assert.ok(merge, "Merge is offered");
  assert.equal(merges(calls).length, 0, "a render merges nothing");
  merge.dispatchEvent(new Event("click"));
  await settle();
  assert.equal(merges(calls).length, 0, "a click a script makes merges nothing");
  merge.dispatchEvent(trusted());
  await settle();
  assert.deepEqual(merges(calls), [["mergePullRequest", 7, pull.request.head]], "merged once, on the head that was shown");
  assert.match(text(found(box, "[data-merge-result]")[0]), /merged/i);
});

// TST-734002 · level: unit · module: MOD-implementation-pages
// guards: UC-024; A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS; THE DEFAULT DEFINITION OF DONE IS THE JOB RULES
// given: pull request #8 of the job for ITM-005, whose head's check agent-m done failed (as it does where the gate Building → Checking is not recorded); pull request #9 of the job for ITM-004, whose CI is red on its head and whose agent-m done failed with it
// input: the route's render; a click of a person on the place where Merge would stand
// expect: #8 and #9 each show that the Definition of Done does not hold and link the run of agent-m done of their head; neither offers Merge; no call to mergePullRequest is made
test("a pull request whose agent-m done failed says the Definition of Done does not hold, links that run and offers no Merge", async () => {
  const noGate = pullOf({ number: 8, item: "ITM-005", jobId: "JOB-20260916-0900-b1b2", digit: "3", done: "failure" });
  const red = pullOf({ number: 9, item: "ITM-004", jobId: "JOB-20260916-0900-c1c2", digit: "5", last: "failure", done: "failure" });
  const { target, calls } = await render([noGate, red]);
  for (const number of [8, 9]) {
    const done = found(shown(target, number), "[data-done]")[0];
    assert.equal(done.getAttribute("data-holds"), "false");
    assert.equal(found(done, "a")[0]?.getAttribute("href"), doneRun(number));
  }
  assert.equal(found(target, "[data-merge-pull]").length, 0, "no Merge is offered");
  assert.equal(merges(calls).length, 0);
});

// TST-734003 · level: unit · module: MOD-implementation-pages
// guards: UC-024; A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS
// given: the pull request of TST-734001, whose head moved after the page read it, so that the host refuses the merge as NotMergeable with the reason "Head branch was modified"
// input: a click of a person on Merge
// expect: mergePullRequest was called on the head shown; the page names the reason; it does not say the pull request is merged; Merge stays offered
test("a merge the host refuses because the head moved is named and nothing is claimed merged", async () => {
  const pull = pullOf({ number: 7, item: "ITM-005", jobId: "JOB-20260916-0900-a1b2", digit: "1" });
  const refused = Object.assign(new Error("GitHub refuses the merge: Head branch was modified"), { name: "NotMergeable", reason: "Head branch was modified" });
  const { target, calls } = await render([pull], { refuse: refused });
  found(shown(target, 7), `[data-merge-pull="7"]`)[0].dispatchEvent(trusted());
  await settle();
  assert.deepEqual(merges(calls), [["mergePullRequest", 7, pull.request.head]]);
  const result = text(found(shown(target, 7), "[data-merge-result]")[0]);
  assert.match(result, /Head branch was modified/);
  assert.match(result, /not merged/i);
  assert.equal(shown(target, 7).getAttribute("data-state"), "open", "the pull request is not claimed merged");
  assert.ok(found(shown(target, 7), `[data-merge-pull="7"]`)[0], "Merge stays offered");
});

// TST-734004 · level: unit · module: MOD-implementation-pages
// guards: UC-024; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: pull request #10 of the job for ITM-005, merged with the merge commit eeee…, beside the open pull request #7 of another job
// input: the route's render
// expect: the pull requests are asked for with the state open; #7 is shown and #10 is not — it stands on its job's page —; the host is not asked for #10's facts; no call to mergePullRequest
test("a merged pull request is not listed: the page asks for the open ones", async () => {
  const open = pullOf({ number: 7, item: "ITM-005", jobId: "JOB-20260916-0900-a1b2", digit: "1" });
  const pull = pullOf({ number: 10, item: "ITM-005", jobId: "JOB-20260916-0900-d1d2", digit: "7", state: "merged" });
  const { target, calls } = await render([open, pull]);
  assert.ok(calls.some((call) => call[0] === "listPullRequests" && call[1] === "open"), JSON.stringify(calls));
  shown(target, 7);
  assert.ok(!pullBox(target, 10), "the merged pull request is not listed");
  assert.ok(!calls.some((call) => call[0] === "pullRequestFacts" && call[1] === 10));
  assert.equal(merges(calls).length, 0);
});

// TST-734005 · level: unit · module: MOD-implementation-pages
// guards: UC-024; THE DEFAULT DEFINITION OF DONE IS THE JOB RULES
// given: pull request #11 that no job of the product started (its description names no job), beside the pull request #7 of a job that did
// input: the route's render
// expect: #7 is shown; #11 is not shown and the host is not asked for its facts
test("a pull request of no job the product started is not shown", async () => {
  const pull = pullOf({ number: 7, item: "ITM-005", jobId: "JOB-20260916-0900-a1b2", digit: "1" });
  const foreign = pullOf({ number: 11, item: "ITM-005", jobId: "JOB-20260916-0900-e1e2", digit: "9", body: "A change somebody made by hand.\n" });
  const { target, calls } = await render([pull], { extraPulls: [foreign] });
  shown(target, 7);
  assert.ok(!pullBox(target, 11), "the pull request of no job is not shown");
  assert.ok(!calls.some((call) => call[0] === "pullRequestFacts" && call[1] === 11), "the facts of a foreign pull request are not read");
});

// TST-1170006 · level: unit · module: MOD-implementation-pages
// guards: UC-024; CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI
// given: the product of TST-734001 with the open pull request #7 of a job, on a server whose repositoryInfo gives greenToMerge false — its default branch has no rule that requires a check before a merge
// input: the route implement's render
// expect: the page says, in <p data-green-to-merge>, that the server does not enforce "merge only on green", and links the server's page for branch protection, the host's webLinks branchProtection (https://github.com/acme/product/settings/branches); repositoryInfo is asked as often as on the page of a server that gives greenToMerge null, which says nothing of it; known positive: #7 is shown with Merge offered
test("a server that does not enforce green CI before a merge is named on the implement page, with its page for branch protection", async () => {
  const pull = pullOf({ number: 7, item: "ITM-005", jobId: "JOB-20260916-0900-a1b2", digit: "1" });
  const { target, calls } = await render([pull], { greenToMerge: false });
  assert.ok(found(shown(target, 7), `[data-merge-pull="7"]`)[0], "known positive: the page is drawn, Merge offered");
  const note = found(target, "[data-green-to-merge]");
  assert.equal(note.length, 1, "the page names the missing branch protection once");
  assert.match(text(note[0]), /does not enforce/);
  assert.match(text(note[0]), /merge only on green/);
  assert.deepEqual(found(note[0], "a").map((link) => link.getAttribute("href")), [BRANCH_PROTECTION]);
  const silent = await render([pullOf({ number: 7, item: "ITM-005", jobId: "JOB-20260916-0900-a1b2", digit: "1" })], { greenToMerge: null });
  const asked = (each) => each.filter((call) => call[0] === "repositoryInfo").length;
  assert.equal(asked(calls), asked(silent.calls), "saying it asks repositoryInfo no more often");
});

// TST-1170007 · level: unit · module: MOD-implementation-pages
// guards: UC-024
// given: the product of TST-1170006, on a server whose repositoryInfo gives greenToMerge true (a rule requires a check), and on one that gives null (the token may not read the rule)
// input: the route implement's render, once for each
// expect: neither page has <p data-green-to-merge> nor a link to the page for branch protection; known positive: #7 is shown on each
test("a server that enforces green CI, or whose rule the token cannot read, is not named on the implement page", async () => {
  for (const greenToMerge of [true, null]) {
    const pull = pullOf({ number: 7, item: "ITM-005", jobId: "JOB-20260916-0900-a1b2", digit: "1" });
    const { target } = await render([pull], { greenToMerge });
    shown(target, 7);
    assert.equal(found(target, "[data-green-to-merge]").length, 0, `greenToMerge ${greenToMerge}: nothing is said`);
    assert.ok(!found(target, "a").some((link) => link.getAttribute("href") === BRANCH_PROTECTION), `greenToMerge ${greenToMerge}: no link to branch protection`);
  }
});
