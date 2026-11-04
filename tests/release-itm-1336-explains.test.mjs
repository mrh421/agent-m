// Release test of ITM-1336 — the panel Blocked of a model without sprints carries a folded explanation. Written from UC-035 step 4 ("A panel **Blocked** lists every item or plan entry that cannot move — in a model with sprints, every item a running sprint holds that cannot move —, each with its reason") and from the SPEC's EVERY STEP EXPLAINS ITSELF.
// Run: node --test tests/release-itm-1336-explains.test.mjs
//
// Module: MOD-implementation-pages
// Guards: EVERY STEP EXPLAINS ITSELF; UC-035
// Level: release
//
// Written for the release testing of sprint team1/134 by a participant who implemented none of ITM-1336 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The reader reaches the page as the existing tests of the route do (tests/implementation-pages-sprints.mjs: the product held in memory behind a host that records its calls, the route `progress` of MOD-implementation-pages drawn into a DOM), with the V-model of the instance's catalogue or the Kanban fixture (tests/fixtures/flow/kanban.md) as the product's process model. The marks read are those of the page's panels: the panel is `data-part="blocked"`, an entry of it `data-blocked="<item>"`.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { found, productFiles, render } from "./implementation-pages-sprints.mjs";

const withModel = (path, edit = (text) => text) => productFiles({ "docs/process-models/fixture.md": edit(readFileSync(new URL(path, import.meta.url), "utf8")) });

// TST-1336104 · level: release · module: MOD-implementation-pages
// guards: EVERY STEP EXPLAINS ITSELF; UC-035
// given: the V-model product and the Kanban product with nothing blocked, and the Kanban product with the limit 1, which blocks ITM-004 and ITM-005
// input: the reader opens Progress of each
// expect: in each page the panel Blocked holds a `details` with the summary "What is this?" that is not open and says what the panel lists (it names "reason"), whether the panel lists entries or says that none is blocked; the page with entries lists two (known positive)
// Planted fault: the explanation left out of the panel (`${whatIsThis(...)}` removed from blockedPanel in src/implementation-pages/progress.mjs) fails the case on "no folded What is this?".
test("TST-1336104 the panel Blocked of a model without sprints carries a folded explanation", async () => {
  const cases = [["V-model", withModel("../src/model-catalogue/models/v-model.md"), 0], ["Kanban", withModel("./fixtures/flow/kanban.md"), 0],
    ["Kanban, limit 1", withModel("./fixtures/flow/kanban.md", (text) => text.replace("| WIP limit | 2 |", "| WIP limit | 1 |")), 2]];
  for (const [name, files, listed] of cases) {
    const page = await render("progress", {}, { files });
    try {
      assert.equal(found(page.target, "[data-blocked]").length, listed, `known positive: ${name} lists ${listed}`);
      const panel = found(page.target, "[data-part]").find((each) => each.getAttribute("data-part") === "blocked");
      assert.ok(panel, `${name}: the panel stands`);
      const explain = found(panel, "[class]").filter((each) => each.localName === "details");
      assert.ok(explain.length >= 1 && /What is this\?/.test(explain[0].textContent) && explain[0].getAttribute("open") === null, `failure node: ${name}'s panel Blocked has no folded What is this?`);
      assert.match(explain[0].textContent, /reason/, `${name}: the explanation says what the panel lists`);
    } finally { page.done(); }
  }
});
