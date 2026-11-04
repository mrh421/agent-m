// ITM-1336 — the panel Blocked on the progress page of a model without sprints, as UC-035 step 4 states it: "A panel Blocked lists every item or plan entry that cannot move — in a model with sprints, every item a running sprint holds that cannot move —, each with its reason".
// Run: node --test tests/implementation-pages-progress-blocked.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-035
// Level: unit
//
// The product is the fixture of tests/implementation-pages-sprints.mjs, held in memory, with the instance's V-model or the Kanban fixture (tests/fixtures/flow/kanban.md) as its process model. Nothing reaches the network.
// Readings the texts leave open, which the tests state (the pull request names them): the panel is the element `data-part="blocked"`, an entry of it `data-blocked="<item>"`; for a model without sprints the panel's line for "none is blocked" says
// "No item or plan entry is blocked." and does not speak of a running sprint; for a model with sprints it stays "No item a running sprint holds is blocked."
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { found, productFiles, render, part } from "./implementation-pages-sprints.mjs";

const withModel = (path, edit = (text) => text, extra = {}) => productFiles({ "docs/process-models/fixture.md": edit(readFileSync(new URL(path, import.meta.url), "utf8")), ...extra });
const vModel = (extra) => withModel("../src/model-catalogue/models/v-model.md", undefined, extra);
const kanban = (edit) => withModel("./fixtures/flow/kanban.md", edit);
const panels = (page) => found(page.target, "[data-part]").filter((each) => each.getAttribute("data-part") === "blocked");
const entries = (page) => found(page.target, "[data-blocked]");
const explains = (page) => /<details class="explain"><summary>What is this\?<\/summary>/.test(part(page.html(), 'data-part="blocked"'));
const unaccepted = () => vModel({ "docs/backlog/ITM-004-item-4.md": productFiles()["docs/backlog/ITM-004-item-4.md"].replace("  - RULE ONE\nmodules", "  - RULE NOT YET\nmodules") });

// TST-1336001 · level: unit · module: MOD-implementation-pages
// guards: UC-035
// given: the fixture product whose model is the Kanban fixture with the work-in-progress limit lowered to 1; ITM-002 is in progress, ITM-004 and ITM-005 are ready
// input: the route progress's render
// expect: one panel Blocked stands on the page, with an entry for ITM-004 and one for ITM-005, each naming the reason "work-in-progress limit" and that ITM-002 is in progress, none for ITM-001, ITM-002 or ITM-003, and a folded "What is this?"
test("#progress — a Kanban product's page lists the items that its limit blocks, each with its reason", async () => {
  const page = await render("progress", {}, { files: kanban((text) => text.replace("| WIP limit | 2 |", "| WIP limit | 1 |")) });
  try {
    assert.equal(found(page.target, "[data-card]").length, 5, "known positive: the page is the Kanban model's");
    assert.equal(panels(page).length, 1, "one Blocked panel");
    assert.deepEqual(entries(page).map((each) => each.getAttribute("data-blocked")).sort(), ["ITM-004", "ITM-005"]);
    for (const each of entries(page)) assert.match(each.textContent, /work-in-progress limit[\s\S]*ITM-002 is in progress/, each.getAttribute("data-blocked"));
    assert.ok(explains(page), "a folded What is this?");
  } finally { page.done(); }
});

// TST-1336002 · level: unit · module: MOD-implementation-pages
// guards: UC-035
// given: the fixture product whose model is the V-model, with ITM-004 realising RULE NOT YET, which the SPEC does not hold
// input: the route progress's render
// expect: one panel Blocked stands on the page, with an entry for ITM-004 only, naming the reason "requirement not accepted" and RULE NOT YET, next to the grid of the V-model, and a folded "What is this?"
test("#progress — a V-model product's page lists the plan entry that waits for an unaccepted requirement, with its reason", async () => {
  const page = await render("progress", {}, { files: unaccepted() });
  try {
    assert.ok(found(page.target, "[data-cell]").length >= 7, "known positive: the page is the V-model's");
    assert.equal(panels(page).length, 1, "one Blocked panel");
    assert.deepEqual(entries(page).map((each) => each.getAttribute("data-blocked")), ["ITM-004"]);
    assert.match(entries(page)[0].textContent, /requirement not accepted[\s\S]*RULE NOT YET/);
    assert.ok(explains(page), "a folded What is this?");
  } finally { page.done(); }
});

// TST-1336003 · level: unit · module: MOD-implementation-pages
// guards: UC-035
// given: the fixture product whose model is the V-model, and the one whose model is the Kanban fixture with its limit of 2; nothing is blocked in either
// input: the route progress's render of each
// expect: each page holds one panel Blocked with no entry, saying "No item or plan entry is blocked." and not speaking of a running sprint, with a folded "What is this?"
test("#progress — a model without sprints with nothing blocked says so, without a running sprint", async () => {
  for (const files of [vModel(), kanban()]) {
    const page = await render("progress", {}, { files });
    try {
      assert.equal(panels(page).length, 1, "one Blocked panel");
      assert.equal(entries(page).length, 0);
      const panel = part(page.html(), 'data-part="blocked"');
      assert.match(panel, /No item or plan entry is blocked\./);
      assert.doesNotMatch(panel.slice(0, panel.indexOf("<details")), /running sprint/);
      assert.ok(explains(page), "a folded What is this?");
    } finally { page.done(); }
  }
});

// TST-1336004 · level: unit · module: MOD-implementation-pages
// guards: UC-035
// given: the fixture product with sprints (the Scrum fixture with a work-in-progress limit), where no item a running sprint holds is blocked
// input: the route progress's render
// expect: one panel Blocked stands on the page, with no entry and the line "No item a running sprint holds is blocked." word for word
test("#progress — a product with sprints keeps its panel Blocked as it is", async () => {
  const page = await render("progress", {});
  try {
    assert.ok(found(page.target, "[data-team]").length >= 2, "known positive: the page is the Scrum model's");
    assert.equal(panels(page).length, 1, "one Blocked panel");
    assert.equal(entries(page).length, 0);
    assert.match(part(page.html(), 'data-part="blocked"'), /<p class="muted">No item a running sprint holds is blocked\.<\/p>/);
  } finally { page.done(); }
});
