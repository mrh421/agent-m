// MOD-implementation-pages' route `implement` judges its items from the backlog's view of the head (ITM-1264), as the accepted text of docs/architecture/MOD-implementation-pages.md
// states it: "In a model that works from a backlog, it takes every item's state, hold and what keeps it from a team from the backlog's view of the head (MOD-progress-measures'
// `storedView`, `asOf` null), and reads besides only the declaration, the declared model's file, the role assignments and the running sprints' records, from which `startable`
// judges each item; while the head's view is not stored yet, it says so and offers no *Start jobs*, and where the repository stores no view, it derives the same view in the page
// from the facts of the scope `work`. … The pull requests it shows are the open ones that name a job (`listPullRequests` with the state `open`), and the records of those jobs, in
// one batch; whether the Definition of Done holds is the result of the check `agent-m done` among the runs of the head (MOD-workflow-entries' `onDoneCheck`), and no gate record
// or module file is read for it."
// Run: node --test tests/implementation-pages-implement-stored-view.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-034; A PAGE LOAD READS THE REPOSITORY IN BATCHES; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS
// Level: component
//
// The product is the one-team fixture of tests/implementation-pages-implement.test.mjs — team1's running sprint 01 selects ITM-004, ITM-005 and ITM-006 —, here served by the
// counting fake of GitHub of tests/implementation-pages-sprints.mjs (renderOverGitHub), the product being the instance itself at the commit ccc…c. Three job records stand under
// docs/jobs/: JOB-…-a7a7 and JOB-…-b8b8, whose open pull requests #7 and #8 name them, and JOB-…-c9c9, which no open pull request names; one gate record stands under docs/gates/.
// This file's own handlers answer what the page asks of the two pull requests: #7's head passed the check `agent-m done`, #8's failed it. The views on overview-cache are those
// backlogView gives for these files and pull requests (storedViewBytes). The strategies the kind `implement` names are stand-ins, as in tests/implementation-pages-implement.test.mjs.
// Readings the texts leave open, which the tests state (the pull request names them):
//   - A file is read when its path stands in a request of the fake: by itself (`file <path>`) or in a batch. A listing of pull requests is a request of /pulls with a query.
//   - "one batch of at most 100 files (declaration, model, role assignments, running sprints)" is read as one batch of the product that holds the declaration, the role assignments
//     and the running sprints' records; the declared model's file is read at the commit the declaration names, which only the declaration gives, so it is not in that batch.
//   - The check `agent-m done` of the head is its run: <p data-done data-holds="true|false"> links it; Merge (<button data-merge-pull>) is offered only where it passed.
// Each test states its input and its expected result before it runs (given / input / expect).

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COMMIT, GITHUB_ADDRESS, cacheReads, factsReads, found, renderOverGitHub, storedViewBytes } from "./implementation-pages-sprints.mjs";
import { REPO } from "./app-harness.mjs";
import { endedJob, REJECTED } from "./implementation-pages-ended-job.mjs";

const { registerStrategies } = await import("../src/job-runner/index.mjs");
const { startRecord } = await import("../src/job-ledger/index.mjs");

// ---------------------------------------------------------------- the strategies the kind names: stand-ins
const part = (name) => ({ name, text: name, size: 0, sources: [], required: true });
registerStrategies("tests/implementation-pages-implement-stored-view.test.mjs", {
  recipes: { "implementation-inputs": async (_, params) => [part(`inputs of ${(params.items ?? []).join(", ")}`)], "chapters-for-implementation": async () => [part("chapters 9, 11, 12 and 13")],
    "resource-pins": async () => [] },
  preconditions: { "rests-on-accepted": async () => [] },
  writers: { "branch-and-pull-request": async () => ({ commits: [], files: [], pullRequest: null, shown: null, notes: [] }) },
});

// ---------------------------------------------------------------- the fixture product
const lines = (...rows) => `${rows.join("\n")}\n`;
const C0 = "0c".repeat(20);
const SPEC = lines("# SPEC", "", "## 1. Rules", "", "**RULE ONE** *(PO, 2026-09-01)*", "The first rule.", "*Check:* no automatic check; at review.");
const DECLARATION = lines("---", "model: fixture-scrum-wip", "model_file: docs/process-models/fixture.md", `model_version: ${COMMIT}`, "---", "# How the fixture product is developed", "", "## Practices", "",
  "- none", "", "## Branches", "", "| Phase or time box | Branch |", "|---|---|", "| Sprint | `sprint/<team>/<nn>` |", "", "## Definition of Done", "", "The job rules hold.");
const ASSIGNMENT = lines("# team1", "", "## Roles", "", "| Role | Participants |", "|---|---|", "| Owner | alice |", "| Builders | dev-a |", "| Checker | dev-a |");
const moduleFile = (id, uses) => lines("---", `id: ${id}`, `title: The module ${id}`, `folder: src/${id.slice(4)}/`, "realises:", "  - RULE ONE", "follows:", "  - ARC-001", `uses:${uses.length ? `\n${uses.map((use) => `  - ${use}`).join("\n")}` : " []"}`,
  "provides:", "  - read", "---", `# ${id} The module ${id}`);
const id = (n) => `ITM-${String(n).padStart(3, "0")}`;
const itemPath = (n) => `docs/backlog/${id(n)}-item-${n}.md`;
const itemText = (n, { modules, buildsOn = [], realises = ["RULE ONE"] }) => lines("---", `id: ${id(n)}`, `title: The work of item ${n}`, "level: module", "realises:", ...realises.map((name) => `  - ${name}`), "modules:",
  ...modules.map((module) => `  - ${module}`), ...(buildsOn.length ? ["builds_on:", ...buildsOn.map((dependency) => `  - ${dependency}`)] : ["builds_on: []"]), "tests:", "  - unit", "origin:", "  - RULE ONE", "---",
  `# ${id(n)} The work of item ${n}`, "", "## Outcome", "", `What item ${n} delivers.`, "", "## Acceptance", "", "- a unit test.");
const SPRINT = "docs/backlog/sprints/team1/01.md";
const sprint = (selection) => lines("---", "sprint: 1", "goal: Store and show", "start: 2026-09-14", "end:", "closer: alice", "branch:", "selection:", ...selection.map((each) => `  - ${each}`), "---", "# team1 Sprint 01");
const HEAD = readFileSync(new URL("../docs/participants.md", import.meta.url), "utf8").split("\n").filter((row, at, all) => at <= all.findIndex((each) => each.startsWith("|---"))).join("\n");
const REGISTER = `${HEAD}\n| dev-a | model endpoint | model-a | 200000 | — | read the repository, write to the repository, run code and tests, use tools | this machine | ci hosted secret DEV_KEY |\n`;
const JOB = { 7: "JOB-20261021-1200-a7a7", 8: "JOB-20261021-1200-b8b8", unnamed: "JOB-20261021-1200-c9c9" };
const jobFile = (jobId, item) => startRecord({ id: jobId, kind: "implement", worksOn: [item], participant: "dev-a", model: "model-a", route: "ci hosted", run: null, retries: null, startedBy: "alice",
  start: new Date("2026-10-21T09:00:00Z"), agentM: { version: "2026.10.0", commit: COMMIT }, inputs: [], limit: 5, destinations: [], params: { items: [item], merges: "person" } }).text;
const GATE = "docs/gates/20261021-1000-building-checking-aaaa.md";
const gateFile = lines("---", "gate: Building → Checking", "decider: alice", "role: Owner", "decision: passed", "on:", `  - ${COMMIT}`, "date: 2026-10-21 10:00 UTC", "---", "# Building → Checking");

const FILES = {
  "SPEC.md": SPEC, "docs/process.md": DECLARATION, "docs/process-models/fixture.md": readFileSync(new URL("./fixtures/flow/scrum-wip.md", import.meta.url), "utf8"),
  "docs/participants.md": REGISTER, "docs/role-assignments/team1.md": ASSIGNMENT,
  "docs/architecture/MOD-store.md": moduleFile("MOD-store", []), "docs/architecture/MOD-pages.md": moduleFile("MOD-pages", ["MOD-store.read"]), "docs/architecture/MOD-mail.md": moduleFile("MOD-mail", []),
  [itemPath(1)]: itemText(1, { modules: ["MOD-store"] }), [itemPath(2)]: itemText(2, { modules: ["MOD-pages"], buildsOn: ["ITM-001"] }),
  [itemPath(3)]: itemText(3, { modules: ["MOD-mail"] }), [itemPath(4)]: itemText(4, { modules: ["MOD-pages"], buildsOn: ["ITM-003"] }),
  [itemPath(5)]: itemText(5, { modules: ["MOD-store"] }), [itemPath(6)]: itemText(6, { modules: ["MOD-mail"], realises: ["RULE NOT ACCEPTED"] }),
  [SPRINT]: sprint(["ITM-004", "ITM-005", "ITM-006"]),
  ".github/workflows/agent-m-jobs.yml": "name: agent-m jobs\n",
  [`docs/jobs/${JOB[7]}.md`]: jobFile(JOB[7], "ITM-001"), [`docs/jobs/${JOB[8]}.md`]: jobFile(JOB[8], "ITM-002"), [`docs/jobs/${JOB.unnamed}.md`]: jobFile(JOB.unnamed, "ITM-002"),
  [GATE]: gateFile,
};

// ---------------------------------------------------------------- the two open pull requests of jobs, and what GitHub answers of them
const FIRST = { 7: "7a".repeat(20), 8: "8a".repeat(20) }, LAST = { 7: "7b".repeat(20), 8: "8b".repeat(20) };
const DONE = { 7: "success", 8: "failure" };
const doneRun = (n) => `${GITHUB_ADDRESS}/actions/runs/${n}01/job/${n}02`;
const PULLS = [7, 8].map((n) => ({ number: n, title: `${JOB[n]}: the work`, branch: `job/${JOB[n]}`, base: "main", head: LAST[n], state: "open", draft: false, url: `${GITHUB_ADDRESS}/pull/${n}`,
  opened: "2026-10-21T12:00:00Z", merged: null, closed: null, body: `Job: ${JOB[n]}\nKind: implement\n`, updated: "2026-10-21T12:00:00Z", mergeCommit: null }));
const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
const numberOf = (sha) => [7, 8].find((n) => FIRST[n] === sha || LAST[n] === sha);
const commitOf = (sha, message, parent) => ({ sha, commit: { message, committer: { date: "2026-10-21T11:00:00Z" } }, parents: [{ sha: parent }] });
// "Get a pull request", its commits, files and reviews; each commit's check runs, statuses and changed files; the Actions runs of a commit.
function pullRequestServer(url) {
  if (url.origin !== "https://api.github.com" || !url.pathname.startsWith(`/repos/${REPO}/`)) return undefined;
  const p = url.pathname.slice(`/repos/${REPO}`.length);
  let m;
  if ((m = /^\/pulls\/(\d+)$/.exec(p))) {
    const pull = PULLS.find((each) => each.number === Number(m[1]));
    return json({ number: pull.number, title: pull.title, head: { ref: pull.branch, sha: pull.head }, base: { ref: "main", sha: COMMIT }, state: "open", merged_at: null, merge_commit_sha: null,
      created_at: pull.opened, updated_at: pull.updated, closed_at: null, draft: false, html_url: pull.url, body: pull.body });
  }
  if ((m = /^\/pulls\/(\d+)\/commits$/.exec(p))) return json([commitOf(FIRST[m[1]], "tests", COMMIT), commitOf(LAST[m[1]], "code", FIRST[m[1]])]);
  if (/^\/pulls\/\d+\/(files|reviews)$/.test(p)) return json([]);
  if ((m = /^\/commits\/([0-9a-f]{40})\/check-runs$/.exec(p)) && numberOf(m[1])) {
    const n = numberOf(m[1]);
    return json({ total_count: 1, check_runs: m[1] === LAST[n] ? [{ name: "agent-m done", status: "completed", conclusion: DONE[n], html_url: doneRun(n) }] : [] });
  }
  if ((m = /^\/commits\/([0-9a-f]{40})\/statuses$/.exec(p)) && numberOf(m[1])) return json([]);
  if ((m = /^\/commits\/([0-9a-f]{40})$/.exec(p)) && numberOf(m[1])) return json({ sha: m[1], files: [] });
  if (p === "/actions/runs") {
    const sha = url.searchParams.get("head_sha"), n = numberOf(sha);
    const runs = !n ? [] : [{ id: Number(`${n}0${sha === FIRST[n] ? 0 : 1}`), path: ".github/workflows/agent-m-tests.yml", head_sha: sha, event: "pull_request", status: "completed",
      conclusion: sha === FIRST[n] ? "failure" : DONE[n], html_url: `${GITHUB_ADDRESS}/actions/runs/${n}0${sha === FIRST[n] ? 0 : 1}`, run_started_at: "2026-10-21T11:00:00Z", updated_at: "2026-10-21T11:05:00Z" }];
    return json({ total_count: runs.length, workflow_runs: runs });
  }
  return undefined;
}

const stored = async (commit = COMMIT) => storedViewBytes("backlog", FILES, commit, PULLS);
const drawn = async (overview) => {
  const page = await renderOverGitHub("implement", {}, { files: FILES, overview, pullRequests: PULLS, server: [pullRequestServer] });
  try { return { html: page.html(), target: page.target, requests: [...page.srv.requests], batches: page.srv.batches.map((batch) => [...batch]) }; } finally { page.done(); }
};
// Every path a request of the page read: those read by themselves, and those of every batch.
const readPaths = ({ requests, batches }) => [...requests.filter((r) => r.startsWith("file ")).map((r) => r.slice(5)), ...batches.flat()];
const listings = (requests) => requests.filter((r) => /\/pulls\?/.test(r));
const rowsOf = (target) => found(target, "[data-item]").map((row) => ({ item: row.getAttribute("data-item"), state: row.getAttribute("data-state"), startable: row.getAttribute("data-startable"),
  reasons: found(row, "[data-reasons]").map((node) => node.textContent.replace(/\s+/g, " ").trim()).join(" ") }));
const rowOf = (target, item) => rowsOf(target).find((row) => row.item === item);

// TST-1264001 · level: component · module: MOD-implementation-pages
// guards: UC-034; A PAGE LOAD READS THE REPOSITORY IN BATCHES; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: overview-cache holding the backlog view of the head ccc…c; the fixture with the job records and the gate record named above, and the open pull requests #7 and #8
// input: the route implement's render
// expect: the rows tests/implementation-pages-implement.test.mjs expects — ITM-005 ready and startable; ITM-003 not startable, not selected; ITM-006 not startable, naming RULE NOT ACCEPTED; ITM-004 not startable, naming ITM-003 —; its requests hold one read of overview-cache; one batch of at most 100 files holds docs/process.md, team1's role assignment and the running sprint docs/backlog/sprints/team1/01.md; one listing of pull requests, with state=open, and none with state=all; no .facts.json; no file under docs/gates/, no backlog item; of the job records only those of #7 and #8
test("TST-1264001 #implement judges the items from the head's stored view, and reads the declaration, the assignments and the running sprint in one batch, the open pull requests and their jobs", async () => {
  const page = await drawn({ [`${COMMIT}.backlog.json.gz`]: await stored() });
  assert.deepEqual([rowOf(page.target, "ITM-005")?.state, rowOf(page.target, "ITM-005")?.startable], ["ready", "true"], page.html.slice(0, 3000));
  assert.equal(rowOf(page.target, "ITM-003").startable, "false");
  assert.match(rowOf(page.target, "ITM-003").reasons, /not selected/);
  assert.equal(rowOf(page.target, "ITM-006").startable, "false");
  assert.match(rowOf(page.target, "ITM-006").reasons, /RULE NOT ACCEPTED/);
  assert.equal(rowOf(page.target, "ITM-004").startable, "false");
  assert.match(rowOf(page.target, "ITM-004").reasons, /ITM-003/);
  assert.equal(cacheReads(page.requests).length, 1, page.requests.join("\n"));
  const batch = page.batches.find((each) => each.includes("docs/process.md"));
  assert.ok(batch, `the declaration is read in a batch: ${JSON.stringify(page.batches)}`);
  for (const path of ["docs/role-assignments/team1.md", SPRINT]) assert.ok(batch.includes(path), `${path} is in the declaration's batch: ${batch.join(", ")}`);
  assert.ok(batch.length <= 100);
  assert.equal(listings(page.requests).length, 1, page.requests.join("\n"));
  assert.match(listings(page.requests)[0], /state=open/);
  assert.equal(page.requests.some((r) => /\/pulls\?state=all/.test(r)), false);
  assert.deepEqual(factsReads(page.requests), []);
  const read = readPaths(page);
  assert.deepEqual(read.filter((path) => path.startsWith("docs/gates/")), [], "no gate record is read");
  assert.deepEqual(read.filter((path) => path.startsWith("docs/backlog/ITM-")), [], "no backlog item is read");
  assert.deepEqual([...new Set(read.filter((path) => path.startsWith("docs/jobs/")))].sort(), [`docs/jobs/${JOB[7]}.md`, `docs/jobs/${JOB[8]}.md`]);
});

// TST-1264002 · level: component · module: MOD-implementation-pages
// guards: A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS; UC-034
// given: the page of TST-1264001; #7's head passed the check agent-m done, #8's head failed it
// input: the route implement's render
// expect: #7 says the Definition of Done holds, links its run of agent-m done and offers Merge; #8 says it does not hold, links its run of agent-m done and offers no Merge
test("TST-1264002 a job's pull request offers Merge where the head's agent-m done passed, and links that run; where it failed, no Merge", async () => {
  const page = await drawn({ [`${COMMIT}.backlog.json.gz`]: await stored() });
  const box = (n) => found(page.target, `[data-pull="${n}"]`)[0];
  assert.ok(box(7) && box(8), page.html.slice(-3000));
  const done = (n) => found(box(n), "[data-done]")[0];
  assert.equal(done(7).getAttribute("data-holds"), "true");
  assert.equal(found(done(7), "[href]")[0]?.getAttribute("href"), doneRun(7));
  assert.ok(found(box(7), '[data-merge-pull="7"]')[0], "Merge is offered for #7");
  assert.equal(done(8).getAttribute("data-holds"), "false");
  assert.equal(found(done(8), "[href]")[0]?.getAttribute("href"), doneRun(8));
  assert.equal(found(box(8), "[data-merge-pull]").length, 0, "no Merge for #8");
});

// TST-1264003 · level: component · module: MOD-implementation-pages
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-034
// given: overview-cache holding no view of the head, latest.json naming 0c0c…0c and the backlog view of 0c0c…0c
// input: the route implement's render
// expect: the line "As of 0c0c0c0: the view of the newest commit is being stored."; no Start jobs
test("TST-1264003 #implement says so while the head's view is being stored, and offers no Start jobs", async () => {
  const page = await drawn({ "latest.json": `${JSON.stringify({ commit: C0 })}\n`, [`${C0}.backlog.json.gz`]: await stored(C0) });
  assert.match(page.html, /As of 0c0c0c0: the view of the newest commit is being stored\./);
  assert.equal(found(page.target, "[data-start-jobs]").length, 0, "no Start jobs");
});

// TST-1264004 · level: component · module: MOD-implementation-pages
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-034
// given: the same product without the branch overview-cache, and with its head's view stored
// input: the route implement's render, both ways
// expect: without the branch, the page derives the view — it reads the pull requests with state=all — and lists the same rows, with the same states and reasons, as the page drawn from the stored view; besides, it lists the open pull requests once, with state=open
test("TST-1264004 #implement derives the same rows in the page where the repository stores no view", async () => {
  const derived = await drawn({});
  const fromStore = await drawn({ [`${COMMIT}.backlog.json.gz`]: await stored() });
  assert.ok(derived.requests.some((r) => /\/pulls\?state=all/.test(r)), "known positive: the derived page reads every pull request");
  assert.equal(listings(derived.requests).filter((r) => /state=open/.test(r)).length, 1, derived.requests.join("\n"));
  assert.ok(rowsOf(fromStore.target).length >= 4);
  assert.deepEqual(rowsOf(derived.target), rowsOf(fromStore.target));
});

// TST-1421004 · level: component · module: MOD-implementation-pages
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-034
// given: overview-cache holding no view of the head, latest.json naming 0c0c…0c and the backlog view of 0c0c…0c, in which the only job of ITM-005 ended failed at a rejected gate, its End reason "the gate Building → Checking was rejected by docs/gates/20261102-0900-building-checking-1421.md: The review found no test."
// input: the route implement's render
// expect: the line "As of 0c0c0c0: …"; ITM-005 stands in the table as ready and carries that reason in <p data-returned>; ITM-006, which is not ready, has none
test("TST-1421004 #implement draws the reason of a ready item from the view stored last, while the head's view is being stored", async () => {
  const files = { ...FILES, ...endedJob("ITM-005", REJECTED) };
  const page = await drawn({ "latest.json": `${JSON.stringify({ commit: C0 })}\n`, [`${C0}.backlog.json.gz`]: await storedViewBytes("backlog", files, C0, PULLS) });
  assert.match(page.html, /As of 0c0c0c0: the view of the newest commit is being stored\./, "known positive: the stored-last view is drawn");
  assert.equal(rowOf(page.target, "ITM-005").state, "ready");
  const returned = (item) => found(found(page.target, `[data-item="${item}"]`)[0], "[data-returned]").map((node) => node.textContent.replace(/\s+/g, " ").trim());
  assert.deepEqual(returned("ITM-005"), [REJECTED]);
  assert.notEqual(rowOf(page.target, "ITM-006").state, "ready");
  assert.deepEqual(returned("ITM-006"), []);
});
