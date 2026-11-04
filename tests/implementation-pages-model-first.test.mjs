// MOD-implementation-pages' routes `plan` and `board` read the declared model first (ITM-1260), as the accepted text of docs/architecture/MOD-implementation-pages.md states it:
// "`plan` — first the declaration and the declared model's file at the commit the declaration names, read with MOD-repository-hosts' `readFileAt`: for a model that works from a
// backlog, a link to `backlog`, and nothing else is read (UC-045 1a)"; and "The route `board` reads the declaration and the declared model's file first, as `plan` does: for a
// model without a work-in-progress limit it says so and reads nothing else; with one, it reads the product's facts with the scope `work`, every pull request among them."
// Run: node --test tests/implementation-pages-model-first.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-045; UC-032; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// Level: component
//
// The product is the fixture of tests/implementation-pages-sprints.mjs, served by its counting fake of GitHub (renderOverGitHub), its model the Scrum of
// tests/fixtures/flow/scrum.md — no work-in-progress limit — or, for the counter-proof, the Scrum with a limit of tests/fixtures/flow/scrum-wip.md. Where the texts leave a reading
// open, the test states the one it takes: the route is given the branch it shows (`ref`), as the live page gives it, so it asks no repository information; the declaration is read
// from the snapshot by itself (`file docs/process.md`), and the model's file at the commit the declaration names in one batch. Each test states its input and its expected result
// before it runs (given / input / expect). Counter-proof, recorded in the pull request: today's routes read the product's facts and the pull requests and fail the first case.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DECLARATION_AT_HEAD, productFiles, pullsReads, renderOverGitHub } from "./implementation-pages-sprints.mjs";

const MODEL = "docs/process-models/fixture.md";
const files = (fixture) => productFiles({ "docs/process.md": DECLARATION_AT_HEAD, [MODEL]: readFileSync(new URL(`./fixtures/flow/${fixture}.md`, import.meta.url), "utf8") });

// TST-1260301 · level: component · module: MOD-implementation-pages
// guards: UC-045; UC-032; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a product whose declared model is Scrum without a work-in-progress limit
// input: the routes plan and board, each rendered
// expect: plan links #backlog; board says there is no board and links #backlog; each sends, beyond the commit and the tree, the read of docs/process.md and one batch holding the model's file and nothing else — no request about pull requests, none of overview-cache or trace-cache
for (const name of ["plan", "board"]) {
  test(`#${name} reads the declaration and the model's file first, and nothing else for Scrum without a limit`, async () => {
    const page = await renderOverGitHub(name, {}, { files: files("scrum") });
    try {
      const html = page.html();
      assert.match(html, /href="#backlog"/);
      if (name === "board") assert.match(html, /no board/i);
      const requests = page.srv.requests;
      assert.deepEqual(requests.filter((r) => r !== "commit" && r !== "tree"), ["file docs/process.md", "batch 1"], requests.join("\n"));
      assert.deepEqual(page.srv.batches.at(-1), [MODEL]);
      assert.deepEqual(pullsReads(requests), []);
      assert.deepEqual(requests.filter((r) => /overview-cache|trace-cache|stored graph/.test(r)), []);
    } finally { page.done(); }
  });
}

// TST-1260302 · level: component · module: MOD-implementation-pages
// guards: UC-032
// given: a product whose declared model is Scrum with a work-in-progress limit of 2
// input: the route board's render
// expect: the board is drawn — its columns Backlog, Doing, Review and Done, and the limit of 2 —, read with the product's facts, the pull requests among them
test("#board draws the board for a model with a limit", async () => {
  const page = await renderOverGitHub("board", {}, { files: files("scrum-wip") });
  try {
    const html = page.html();
    for (const column of ["Backlog", "Doing", "Review", "Done"]) assert.match(html, new RegExp(`data-column="${column}"`), column);
    assert.match(html, /of 2 items in progress/);
    assert.ok(pullsReads(page.srv.requests).length > 0, "the facts are read, every pull request among them");
  } finally { page.done(); }
});
