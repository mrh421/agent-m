// Release test of ITM-1336 — a plan entry that waits for an unaccepted requirement is reported in the panel Blocked and nothing is forbidden. Written from UC-035 step 4 ("A panel **Blocked** lists every item or plan entry that cannot move — in a model with sprints, every item a running sprint holds that cannot move —, each with its reason") and from the SPEC's UNREALISED REQUIREMENTS ARE REPORTED, NOT FORBIDDEN.
// Run: node --test tests/release-itm-1336-unrealised.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UNREALISED REQUIREMENTS ARE REPORTED, NOT FORBIDDEN; UC-035
// Level: release
//
// Written for the release testing of sprint team1/134 by a participant who implemented none of ITM-1336 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The reader reaches the page as the existing tests of the route do (tests/implementation-pages-sprints.mjs: the product held in memory behind a host that records its calls, the route `progress` of MOD-implementation-pages drawn into a DOM), with the V-model of the instance's catalogue or the Kanban fixture (tests/fixtures/flow/kanban.md) as the product's process model. The marks read are those of the page's panels: the panel is `data-part="blocked"`, an entry of it `data-blocked="<item>"`.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { found, productFiles, render } from "./implementation-pages-sprints.mjs";

const vModel = (extra) => productFiles({ "docs/process-models/fixture.md": readFileSync(new URL("../src/model-catalogue/models/v-model.md", import.meta.url), "utf8"), ...extra });
const waiting = () => vModel({ "docs/backlog/ITM-004-item-4.md": productFiles()["docs/backlog/ITM-004-item-4.md"].replace("  - RULE ONE\nmodules", "  - RULE NOT YET\nmodules") });
const entries = (page) => found(page.target, "[data-blocked]");

// TST-1336103 · level: release · module: MOD-implementation-pages
// guards: UNREALISED REQUIREMENTS ARE REPORTED, NOT FORBIDDEN; UC-035
// given: the V-model product whose item ITM-004 realises RULE NOT YET, which the SPEC does not hold; known positive: the same product with ITM-004 realising RULE ONE lists no entry
// input: the reader opens Progress of each
// expect: the page of the first lists exactly ITM-004 in the panel Blocked with the reason "requirement not accepted" and RULE NOT YET, and is complete beside it (the grid cells, the gates and the who-works-on-what panels stand), so the unrealised requirement is reported and the page forbids nothing; the page of the second lists no entry
// Planted fault: the reason "requirement not accepted" never given (the branch `waiting for acceptance` of blocked in src/progress-measures/overviews.mjs removed) fails the case on "ITM-004 is reported".
test("TST-1336103 an item that waits for an unaccepted requirement is reported in the panel Blocked, and the page stays whole", async () => {
  const fine = await render("progress", {}, { files: vModel() });
  try { assert.equal(entries(fine).length, 0, "known positive: nothing is blocked while the requirement is accepted"); } finally { fine.done(); }
  const page = await render("progress", {}, { files: waiting() });
  try {
    assert.deepEqual(entries(page).map((each) => each.getAttribute("data-blocked")), ["ITM-004"], "failure node: ITM-004 is reported");
    assert.match(entries(page)[0].textContent, /requirement not accepted[\s\S]*RULE NOT YET/);
    const parts = found(page.target, "[data-part]").map((each) => each.getAttribute("data-part"));
    assert.ok(found(page.target, "[data-cell]").length >= 7 && ["gates", "blocked", "who", "measure"].every((each) => parts.includes(each)), `the page stands whole (${parts})`);
  } finally { page.done(); }
});
