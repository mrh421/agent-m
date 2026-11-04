// MOD-implementation-pages' route `progress` draws the view stored for its commit (ITM-1260), as the accepted text of docs/architecture/MOD-implementation-pages.md states it:
// "It draws the view stored for the head (MOD-progress-measures' `storedView`) and reads no record, no facts and no pull request, and it names no first wave (`reads`); while the
// head's view is not stored yet, it draws the view stored last, with the line `storedView` gives, and only where the repository stores no view does it derive the same view in
// the page (`progressView`, from the facts of the scope `work`). *End sprint* is offered on the head's own view only, and writes on its commit."
// Run: node --test tests/implementation-pages-progress-stored-view.test.mjs
//
// Module: MOD-implementation-pages
// Guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-035
// Level: component
//
// The product is the fixture of tests/implementation-pages-sprints.mjs, served by its counting fake of GitHub (renderOverGitHub); the views on overview-cache are those
// progressView gives for the fixture's files (storedViewBytes). Where the texts leave a reading open, the test states the one it takes: the line of a view stored last is
// `As of <7 characters>: the view of the newest commit is being stored.`, as MOD-progress-measures' storedView names it. Each test states its input and its expected result before
// it runs (given / input / expect). Counter-proof, recorded in the pull request: today's route lists the pull requests and fails the first case.

import test from "node:test";
import assert from "node:assert/strict";
import { COMMIT, DECLARATION_AT_HEAD, batchReads, cacheReads, factsReads, part, productFiles, pullsReads, renderOverGitHub, row, storedViewBytes } from "./implementation-pages-sprints.mjs";

const C0 = "0c".repeat(20);
const files = () => productFiles({ "docs/process.md": DECLARATION_AT_HEAD });

// TST-1260101 · level: component · module: MOD-implementation-pages
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-035
// given: overview-cache holding the progress view of the head ccc…c
// input: the route progress's render
// expect: team1's panel names team1/03 and its goal, lists ITM-001 done with MOD-store and ITM-002 in progress, holds the burn-down — 2 left at its start, 1 after the merge — and offers End sprint; team2's panel says it runs no sprint and links #backlog/plan=team2; no row of ITM-003, ITM-004 or ITM-005; its requests hold one read of overview-cache, no request about pull requests, none for a facts file and no batch of files
test("#progress draws the head's stored view, with one read of overview-cache and no pull request, facts file or batch", async () => {
  const page = await renderOverGitHub("progress", {}, { files: files(), overview: { [`${COMMIT}.progress.json.gz`]: await storedViewBytes("progress", files()) } });
  try {
    const html = page.html();
    const team1 = part(html, 'data-team="team1"');
    assert.match(team1, /team1\/03/);
    assert.match(team1, /Store and show/);
    assert.match(row(team1, "ITM-001"), /done/);
    assert.match(row(team1, "ITM-001"), /MOD-store/);
    assert.match(row(team1, "ITM-002"), /in progress/);
    assert.match(team1, /line \[2, 1/);
    assert.match(team1, /data-end-sprint="team1"/);
    const team2 = part(html, 'data-team="team2"');
    assert.match(team2, /no running sprint/i);
    assert.match(team2, /href="#backlog\/plan=team2"/);
    for (const outside of ["ITM-003", "ITM-004", "ITM-005"]) assert.ok(!html.includes(`data-item="${outside}"`), outside);
    const requests = page.srv.requests;
    assert.equal(cacheReads(requests).length, 1, requests.join("\n"));
    assert.deepEqual(pullsReads(requests), []);
    assert.deepEqual(factsReads(requests), []);
    assert.deepEqual(batchReads(requests), []);
  } finally { page.done(); }
});

// TST-1260102 · level: component · module: MOD-implementation-pages
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-035
// given: overview-cache holding no view of the head, latest.json naming 0c0c…0c and the progress view of 0c0c…0c
// input: the route progress's render
// expect: the line "As of 0c0c0c0: the view of the newest commit is being stored."; team1's running sprint team1/03 drawn; three reads of overview-cache; no End sprint
test("#progress draws the view stored last while the head's is stored, with its line and without End sprint", async () => {
  const overview = { "latest.json": `${JSON.stringify({ commit: C0 })}\n`, [`${C0}.progress.json.gz`]: await storedViewBytes("progress", files(), C0) };
  const page = await renderOverGitHub("progress", {}, { files: files(), overview });
  try {
    const html = page.html();
    assert.match(html, /As of 0c0c0c0: the view of the newest commit is being stored\./);
    assert.match(part(html, 'data-team="team1"'), /team1\/03/, "known positive: the view is drawn");
    assert.equal(cacheReads(page.srv.requests).length, 3, page.srv.requests.join("\n"));
    assert.doesNotMatch(html, /data-end-sprint/);
  } finally { page.done(); }
});

// TST-1260103 · level: component · module: MOD-implementation-pages
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-035
// given: a repository without the branch overview-cache, and the same product with its head's view stored
// input: the route progress's render, both ways
// expect: without the branch, the page derives the view from the facts of the scope `work` — it reads the pull requests — and shows the same rows of team1 (ITM-001, ITM-002) and the same panel of team2 as the page drawn from the stored view
test("#progress derives the same view in the page where the repository stores none", async () => {
  const drawn = async (overview) => {
    const page = await renderOverGitHub("progress", {}, { files: files(), overview });
    try { return { html: page.html(), requests: [...page.srv.requests] }; } finally { page.done(); }
  };
  const derived = await drawn({});
  const stored = await drawn({ [`${COMMIT}.progress.json.gz`]: await storedViewBytes("progress", files()) });
  assert.ok(pullsReads(derived.requests).length > 0, "known positive: the derived page reads the pull requests");
  for (const id of ["ITM-001", "ITM-002"]) {
    assert.ok(row(part(derived.html, 'data-team="team1"'), id).length > 0, `${id} is drawn`);
    assert.equal(row(part(derived.html, 'data-team="team1"'), id), row(part(stored.html, 'data-team="team1"'), id), id);
  }
  assert.equal(part(derived.html, 'data-team="team2"'), part(stored.html, 'data-team="team2"'));
});
