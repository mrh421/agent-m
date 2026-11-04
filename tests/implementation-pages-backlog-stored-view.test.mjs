// MOD-implementation-pages' route `backlog` draws the view stored for its commit (ITM-1260), as the accepted text of docs/architecture/MOD-implementation-pages.md states it:
// "The route `backlog` draws the view stored for the head (MOD-progress-measures' `storedView`) and reads no record, no facts and no pull request …; while the head's view is not
// stored yet, it draws the view stored last, with the line `storedView` gives, and only where the repository stores no view does it derive the same view in the page
// (`backlogView`, from the facts of the scope `work`). *Plan sprint* and *Cancel* draw from the view read. *Start sprint* is offered on the head's own view only: on the click it
// reads the declaration, the declared model, the module files and the team's running sprint at the view's commit, and hands them with the view's states and holds to
// `startSprint`, which writes on that commit."
// Run: node --test tests/implementation-pages-backlog-stored-view.test.mjs
//
// Module: MOD-implementation-pages
// Guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-032; ONE CLICK PER DECISION
// Level: component
//
// The product is the fixture of tests/implementation-pages-sprints.mjs with two module files, served by its counting fake of GitHub (renderOverGitHub); the views on overview-cache
// are those backlogView gives for the fixture's files (storedViewBytes). Where the texts leave a reading open, the test states the one it takes: a file is read when its path
// stands in a request of the fake — by itself (`file <path>`) or in a batch —; the model's file is read at the commit the declaration names. Each test states its input and its
// expected result before it runs (given / input / expect). Counter-proof, recorded in the pull request: today's route lists the pull requests and fails the first case.

import test from "node:test";
import assert from "node:assert/strict";
import { COMMIT, DECLARATION_AT_HEAD, TEAM1_RUNNING, batchReads, cacheReads, factsReads, found, part, productFiles, pullsReads, renderOverGitHub, storedViewBytes } from "./implementation-pages-sprints.mjs";

const C0 = "0c".repeat(20);
const moduleFile = (id) => ["---", `id: ${id}`, `title: The module ${id}`, `folder: src/${id.slice(4)}/`, "realises:", "  - RULE ONE", "follows:", "  - ARC-001", "uses: []", "provides:",
  "  - read", "---", `# ${id} The module ${id}`, ""].join("\n");
const MODULES = ["docs/architecture/MOD-store.md", "docs/architecture/MOD-pages.md"];
const files = () => productFiles({ "docs/process.md": DECLARATION_AT_HEAD, [MODULES[0]]: moduleFile("MOD-store"), [MODULES[1]]: moduleFile("MOD-pages") });
const stored = async () => ({ [`${COMMIT}.backlog.json.gz`]: await storedViewBytes("backlog", files()) });
const rows = (html) => [...part(html, 'data-part="backlog"').matchAll(/<tr data-item="(ITM-\d{3})"/g)].map((match) => match[1]);
// The paths the requests from `at` on read: each `file <path>`, and each path of the batches sent since.
const readSince = (srv, at, batchesAt) => [...srv.requests.slice(at).filter((r) => r.startsWith("file ")).map((r) => r.slice(5)), ...srv.batches.slice(batchesAt).flat()];

// TST-1260201 · level: component · module: MOD-implementation-pages
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-032
// given: overview-cache holding the backlog view of the head ccc…c
// input: the route backlog's render
// expect: the backlog lists ITM-001 to ITM-005, ITM-001 done; team1's and team2's panels stand; its requests hold one read of overview-cache, no request about pull requests, none for a facts file and no batch of files
test("#backlog draws the head's stored view, with one read of overview-cache and no pull request, facts file or batch", async () => {
  const page = await renderOverGitHub("backlog", {}, { files: files(), overview: await stored() });
  try {
    const html = page.html();
    assert.deepEqual(rows(html), ["ITM-001", "ITM-002", "ITM-003", "ITM-004", "ITM-005"]);
    assert.match(part(html, 'data-item="ITM-001"').slice(0, 2000), /done/);
    assert.ok(html.includes('data-team="team1"') && html.includes('data-team="team2"'));
    const requests = page.srv.requests;
    assert.equal(cacheReads(requests).length, 1, requests.join("\n"));
    assert.deepEqual(pullsReads(requests), []);
    assert.deepEqual(factsReads(requests), []);
    assert.deepEqual(batchReads(requests), []);
  } finally { page.done(); }
});

// TST-1260202 · level: component · module: MOD-implementation-pages
// guards: ONE CLICK PER DECISION; UC-032
// given: the page drawn from the head's stored view
// input: the person's clicks on Plan sprint of team2, then on Cancel
// expect: the planning of team2 opens and closes again; neither click sends a request
test("#backlog — Plan sprint and Cancel draw from the view read and send no request", async () => {
  const page = await renderOverGitHub("backlog", {}, { files: files(), overview: await stored() });
  try {
    const before = page.srv.requests.length;
    await page.press(found(page.target, '[data-plan="team2"]')[0]);
    assert.match(page.html(), /data-plan-team="team2"/, "known positive: the planning is open");
    await page.press(found(page.target, "[data-cancel-plan]")[0]);
    assert.doesNotMatch(page.html(), /data-plan-team=/);
    assert.equal(page.srv.requests.length, before, page.srv.requests.slice(before).join("\n"));
  } finally { page.done(); }
});

// TST-1260203 · level: component · module: MOD-implementation-pages
// guards: ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; UC-032
// given: the page drawn from the head's stored view; team1's sprint 03 runs with ITM-001 and ITM-002
// input: Change the selection of team1, ITM-005 ticked besides, a goal and the closer alice given, Start sprint
// expect: the click reads the declaration, the model's file, the two module files and team1's running sprint docs/backlog/sprints/team1/03.md; one commit is written, changing that sprint's record with a ## Selection naming ITM-005, on the head ccc…c the view is of
test("#backlog — Start sprint on the head's view reads the declaration, the model, the module files and the running sprint, and commits on the view's commit", async () => {
  const page = await renderOverGitHub("backlog", {}, { files: files(), overview: await stored() });
  try {
    await page.press(found(page.target, '[data-plan="team1"]')[0]);
    found(page.target, '[data-select-item="ITM-005"]')[0].checked = true;
    found(page.target, "[data-sprint-goal]")[0].value = "Store, show and news";
    found(page.target, "[data-sprint-closer]")[0].value = "alice";
    const at = page.srv.requests.length, batchesAt = page.srv.batches.length;
    await page.press(found(page.target, '[data-start-sprint="team1"]')[0]);
    const read = readSince(page.srv, at, batchesAt);
    for (const path of ["docs/process.md", "docs/process-models/fixture.md", ...MODULES, TEAM1_RUNNING]) assert.ok(read.includes(path), `${path} is read: ${read.join(", ")}`);
    assert.equal(page.srv.writes.length, 1, page.srv.requests.slice(at).join("\n"));
    assert.match(page.srv.writes[0].files[TEAM1_RUNNING], /## Selection[\s\S]*ITM-005/);
    assert.ok(page.srv.requests.slice(at).includes(`commit object`), "the commit is made on the head the view is of");
  } finally { page.done(); }
});

// TST-1260204 · level: component · module: MOD-implementation-pages
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-032
// given: overview-cache holding no view of the head, latest.json naming 0c0c…0c and the backlog view of 0c0c…0c
// input: the route backlog's render, and the click on Plan sprint of team2
// expect: the line "As of 0c0c0c0: the view of the newest commit is being stored."; the items listed; three reads of overview-cache; the planning opens and offers no Start sprint
test("#backlog draws the view stored last while the head's is stored, and offers no Start sprint on it", async () => {
  const overview = { "latest.json": `${JSON.stringify({ commit: C0 })}\n`, [`${C0}.backlog.json.gz`]: await storedViewBytes("backlog", files(), C0) };
  const page = await renderOverGitHub("backlog", {}, { files: files(), overview });
  try {
    assert.match(page.html(), /As of 0c0c0c0: the view of the newest commit is being stored\./);
    assert.deepEqual(rows(page.html()), ["ITM-001", "ITM-002", "ITM-003", "ITM-004", "ITM-005"]);
    assert.equal(cacheReads(page.srv.requests).length, 3, page.srv.requests.join("\n"));
    await page.press(found(page.target, '[data-plan="team2"]')[0]);
    assert.match(page.html(), /data-plan-team="team2"/, "known positive: the planning is open");
    assert.doesNotMatch(page.html(), /data-start-sprint/);
  } finally { page.done(); }
});

// TST-1260205 · level: component · module: MOD-implementation-pages
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-032
// given: a repository without the branch overview-cache, and the same product with its head's view stored
// input: the route backlog's render, both ways
// expect: without the branch, the page derives the view from the facts of the scope `work` — it reads the pull requests — and shows the same backlog panel as the page drawn from the stored view
test("#backlog derives the same view in the page where the repository stores none", async () => {
  const drawn = async (overview) => {
    const page = await renderOverGitHub("backlog", {}, { files: files(), overview });
    try { return { html: page.html(), requests: [...page.srv.requests] }; } finally { page.done(); }
  };
  const derived = await drawn({});
  const fromStore = await drawn(await stored());
  assert.ok(pullsReads(derived.requests).length > 0, "known positive: the derived page reads the pull requests");
  assert.deepEqual(rows(derived.html), ["ITM-001", "ITM-002", "ITM-003", "ITM-004", "ITM-005"]);
  assert.equal(part(derived.html, 'data-part="backlog"'), part(fromStore.html, 'data-part="backlog"'));
});
