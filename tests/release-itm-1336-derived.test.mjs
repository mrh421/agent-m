// Release test of ITM-1336 — what the Blocked panel lists follows the repository and the page writes nothing. Written from UC-035 step 4 ("A panel **Blocked** lists every item or plan entry that cannot move — in a model with sprints, every item a running sprint holds that cannot move —, each with its reason") and from the SPEC's PROGRESS AND JOB STATE ARE DERIVED, NOT STORED.
// Run: node --test tests/release-itm-1336-derived.test.mjs
//
// Module: MOD-implementation-pages
// Guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-035
// Level: release
//
// Written for the release testing of sprint team1/134 by a participant who implemented none of ITM-1336 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The reader reaches the page as the existing tests of the route do (tests/implementation-pages-sprints.mjs: the product held in memory behind a host that records its calls, the route `progress` of MOD-implementation-pages drawn into a DOM), with the V-model of the instance's catalogue or the Kanban fixture (tests/fixtures/flow/kanban.md) as the product's process model. The marks read are those of the page's panels: the panel is `data-part="blocked"`, an entry of it `data-blocked="<item>"`.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { found, productFiles, render } from "./implementation-pages-sprints.mjs";

const kanban = (limit) => productFiles({ "docs/process-models/fixture.md": readFileSync(new URL("./fixtures/flow/kanban.md", import.meta.url), "utf8").replace("| WIP limit | 2 |", `| WIP limit | ${limit} |`) });
const blockedItems = (page) => found(page.target, "[data-blocked]").map((each) => each.getAttribute("data-blocked")).sort();

// TST-1336102 · level: release · module: MOD-implementation-pages
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-035
// given: the Kanban product whose model sets the work-in-progress limit to 1, with ITM-002 in progress (its pull request is open) and ITM-004 and ITM-005 ready; known positive: the same product with the limit 2 blocks nothing
// input: the reader opens Progress; then the limit is changed in the repository to 2 and the reader opens Progress again, on a page with no state carried over from the first
// expect: the first page lists ITM-004 and ITM-005 as blocked (and no other item) and wrote nothing (the host saw no commit); the second lists none, so the panel follows the repository and nothing stored
// Planted fault: the entries kept across renders (`const found = ctx.view.blocked;` of blockedPanel in src/implementation-pages/progress.mjs replaced by `const found = (blockedPanel.last ??= ctx.view.blocked);`) fails the case on "the second page still lists".
test("TST-1336102 the panel Blocked follows the repository and the page writes nothing", async () => {
  const first = await render("progress", {}, { files: kanban(1) });
  try {
    assert.deepEqual(blockedItems(first), ["ITM-004", "ITM-005"], "known positive: the limit blocks the ready items");
    assert.deepEqual(first.host.calls.filter(([name]) => name === "commitFiles"), [], "failure node: the page wrote");
    assert.deepEqual(first.host.commits, []);
  } finally { first.done(); }
  const second = await render("progress", {}, { files: kanban(2) });
  try {
    assert.deepEqual(blockedItems(second), [], "failure node: the second page still lists what the repository no longer blocks");
    assert.equal(found(second.target, "[data-part]").filter((each) => each.getAttribute("data-part") === "blocked").length, 1, "the panel itself stands");
  } finally { second.done(); }
});
