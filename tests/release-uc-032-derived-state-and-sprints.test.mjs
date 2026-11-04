// Release tests of UC-032 Maintain the backlog — what is derived and what explains itself, and who closes a sprint: that no state is stored (PROGRESS AND JOB STATE ARE DERIVED, NOT STORED), that every step that asks something of the
// person carries a folded explanation (EVERY STEP EXPLAINS ITSELF) and that closing a sprint can be assigned to a participant (CLOSING A SPRINT CAN BE ASSIGNED TO A PARTICIPANT). The cases walk the Product Owner's path across the
// dashboard's routes `backlog`, `progress` and `board` over the real MOD-repository-hosts host behind a fake of GitHub's API, and read what the repository holds afterwards; they never read the code files.
// Run: node --test tests/release-uc-032-derived-state-and-sprints.test.mjs
//
// Module: MOD-implementation-pages
// Module: MOD-work-plans
// Guards: UC-032; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; EVERY STEP EXPLAINS ITSELF; CLOSING A SPRINT CAN BE ASSIGNED TO A PARTICIPANT
// Level: release
//
// Written for the release testing of sprint 129 by developer-sonnet-l, who implemented none of ITM-681, ITM-782, ITM-783, ITM-784 or ITM-1316 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). A person's click is the page's own
// listener called with a trusted event; no input event of the operating system is made. Readings the texts leave open, which the cases state:
//   - "no state is stored" is read as: no file of the backlog or of a sprint holds a field that states a state, and the states a page shows follow from the repository's files and its pull requests alone.
//   - "a step that asks something of the person" is read as a control the person presses or fills: Propose items, + Item, Start sprint, End sprint, Pull and Point at; its explanation is the folded "What is this?" of the
//     panel it stands in.
//   - "a participant of the product" is read as a name the instance's register lists and a role assignment of the product gives a role.

import test from "node:test";
import assert from "node:assert/strict";
import { sprintsToClose } from "../src/work-plans/index.mjs";
import { COMPLETE_ITEM, MODELS, PULL_REQUESTS, STORE, backlogOf, classed, clickOn, documentsOf, fieldOf, fillItem, found, itemForm, cell, open, planOf, pr, product, row, specOf, sprintPath, tickOf, typeValue, waitFor } from "./uc-032-harness.mjs";

const FRONT = (text) => [...(/^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? "").matchAll(/^([a-z_]+):/gm)].map((m) => m[1]);
const ITEM_KEYS = ["id", "title", "level", "realises", "modules", "builds_on", "tests", "origin", "built_by"], SPRINT_KEYS = ["sprint", "goal", "start", "end", "closer", "branch", "selection"];
const stateOf = (page, id) => cell(row(backlogOf(page), id), "State");

// TST-803110 · level: release · module: MOD-implementation-pages
// guards: UC-032; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the product of tests/uc-032-harness.mjs, in which ITM-002 has an open pull request and ITM-003 is ready; the same files and a second pull request listing in which ITM-002's pull request is merged and ITM-003's is open
// input: the Product Owner opens Backlog with the first listing, with the second, and again with the first in a browser whose settings are empty; then writes an item with + Item and starts team2's sprint
// expect: ITM-002 is in progress and ITM-003 ready with the first listing, ITM-002 done and ITM-003 in progress with the second, the files unchanged and nothing written; with empty browser settings the table of the backlog is the one it was; no item file and no sprint record of the repository, before or after the item and the sprint are written, holds a field other than those of an item and of a sprint — none states a state or a status
test("TST-803110: UC-032 the state of an item is derived from the repository and its pull requests, and no file of the backlog or of a sprint stores one", async () => {
  const files = await product();
  const first = await open("backlog", {}, { files, store: STORE });
  let table;
  try { table = backlogOf(first); assert.ok(stateOf(first, "ITM-002").startsWith("in progress") && stateOf(first, "ITM-003").startsWith("ready")); assert.equal(first.srv.writes.length, 0); } finally { first.done(); }
  const second = await open("backlog", {}, { files, pullRequests: [PULL_REQUESTS[0], pr(2, "ITM-002", "merged", "2026-10-21T12:00:00Z", "2026-10-30T09:00:00Z"), pr(3, "ITM-003", "open", "2026-10-30T10:00:00Z")] });
  try {
    assert.ok(stateOf(second, "ITM-002").startsWith("done") && stateOf(second, "ITM-003").startsWith("in progress"), "the states follow the pull requests");
    assert.equal(second.srv.writes.length, 0, "and nothing is written");
  } finally { second.done(); }
  const empty = await open("backlog", {}, { files, store: {} });
  try { assert.equal(backlogOf(empty), table, "with the browser's settings empty the table is the same"); } finally { empty.done(); }
  const writing = await open("backlog", {}, { files });
  let written;
  try {
    const form = await itemForm(writing);
    await fillItem(form, COMPLETE_ITEM);
    await clickOn(form.add());
    await waitFor(() => classed(writing.target, "item-added").length > 0);
    written = writing.srv.files;
  } finally { writing.done(); }
  const starting = await open("backlog", {}, { files: written });
  try {
    await planOf(starting, "team2");
    typeValue(starting, "[data-sprint-goal]", "Mail");
    typeValue(starting, "[data-sprint-closer]", "bob");
    tickOf(starting, "ITM-003").checked = true;
    await starting.press(found(starting.target, "[data-start-sprint]")[0]);
    for (const [path, text] of Object.entries(starting.srv.files)) {
      if (/^docs\/backlog\/ITM-\d+-[^/]+\.md$/.test(path)) assert.deepEqual(FRONT(text).filter((key) => !ITEM_KEYS.includes(key)), [], `${path} holds no field that states a state`);
      if (/^docs\/backlog\/sprints\/[^/]+\/\d+\.md$/.test(path)) assert.deepEqual(FRONT(text).filter((key) => !SPRINT_KEYS.includes(key)), [], `${path} holds no field that states a state`);
    }
    assert.ok(Object.hasOwn(starting.srv.files, "docs/backlog/ITM-011-show-the-second-rule-by-hand.md") && Object.hasOwn(starting.srv.files, sprintPath("team2", 1)), "known positive: the item and the sprint are written");
  } finally { starting.done(); }
});

const panelOf = (html, control) => html.split('<section class="panel"').slice(1).find((panel) => panel.includes(control)) ?? null;
const folded = (panel) => /<details class="explain"><summary>What is this\?<\/summary><div>[\s\S]+?<\/div><\/details>/.test(panel ?? "");

// TST-803111 · level: release · module: MOD-implementation-pages
// guards: UC-032; EVERY STEP EXPLAINS ITSELF
// given: the product of tests/uc-032-harness.mjs; a Kanban product for the board; a done item whose requirement was renamed for Point at; known negative first — a panel written without its fold is found by the reading
// input: the Product Owner opens Backlog with the plan of team2 open, Progress, the board, and Backlog of the product with the renamed requirement
// expect: known negative — a panel without its fold is not folded; the panel that holds Propose items, + Item, Start sprint, End sprint, Pull and Point at each carries a folded "What is this?" with a text of its own
test("TST-803111: UC-032 every control that asks something of the person — Propose items, + Item, Start sprint, End sprint, Pull, Point at — stands in a panel with a folded explanation", async () => {
  assert.equal(folded(panelOf('<section class="panel" data-x><h3>No fold</h3><button data-x-control>Go</button></section>', "data-x-control")), false, "known negative");
  const backlog = await open("backlog", {}, { files: await product() });
  try {
    await planOf(backlog, "team2");
    for (const control of ["data-propose-items", "data-add-item", "data-start-sprint"]) assert.ok(folded(panelOf(backlog.html(), control)), `${control}: its panel carries the fold`);
  } finally { backlog.done(); }
  const progress = await open("progress", {}, { files: await product() });
  try { assert.ok(folded(panelOf(progress.html(), "data-end-sprint")), "End sprint: its panel carries the fold"); } finally { progress.done(); }
  const board = await open("board", {}, { files: await product({ model: MODELS.kanban, files: { "docs/role-assignments/team2.md": null, [sprintPath("team1", 2)]: null } }) });
  try {
    assert.ok(found(board.target, "[data-pull]").length > 0, "known positive: the board offers Pull");
    assert.match(board.html(), /^\s*<section class="head"><h2>Board<\/h2><details class="explain"><summary>What is this\?<\/summary><div>[\s\S]+?<\/div><\/details>/, "Pull: the board carries the fold at its head");
  } finally { board.done(); }
  const marked = await open("backlog", {}, { files: await product({ files: { "SPEC.md": specOf("RULE ONE TOO", "RULE TWO", "RULE THREE", "RULE FOUR") } }) });
  try { assert.ok(folded(panelOf(marked.html(), "data-point-at")), "Point at: its panel carries the fold"); } finally { marked.done(); }
});

// TST-803112 · level: release · module: MOD-implementation-pages
// guards: UC-032; CLOSING A SPRINT CAN BE ASSIGNED TO A PARTICIPANT
// given: the product of tests/uc-032-harness.mjs whose model has a time box of two weeks, and the register's participants bob (the Owner of team2, a person) and dev-b (a model endpoint, Builders of team2)
// input: the Product Owner of team2 plans a sprint starting 2026-11-02 and presses Start sprint with the closer preset; then does so with the closer dev-b; and asks MOD-work-plans' sprintsToClose which sprint is due on 2026-11-10 and on 2026-11-16
// expect: the closer is preset to the Owner, bob, and the sprint's record names bob; with dev-b typed the record names dev-b, an agent of the product; for the sprint ending 2026-11-15 sprintsToClose names no sprint on 2026-11-10 and, on 2026-11-16, team2/01 with its closer dev-b because its time box ended
test("TST-803112: UC-032 closing a sprint is assigned by the Product Owner to themselves by default, or to a participant such as an agent, whom the sprint's record names", async () => {
  const start = async (closer) => {
    const page = await open("backlog", {}, { files: await product({ model: MODELS.timeBox }) });
    try {
      await planOf(page, "team2");
      assert.match(page.html(), /<input data-sprint-closer(?:="")? value="bob">/, "the closer is preset to the Owner");
      typeValue(page, "[data-sprint-goal]", "Mail");
      typeValue(page, "[data-sprint-start]", "2026-11-02");
      typeValue(page, "[data-sprint-closer]", closer);
      tickOf(page, "ITM-003").checked = true;
      await page.press(found(page.target, "[data-start-sprint]")[0]);
      return page.srv.files[sprintPath("team2", 1)];
    } finally { page.done(); }
  };
  const byDefault = await start("bob");
  assert.equal(fieldOf(byDefault, "closer"), "bob", "by default the Product Owner themselves");
  const byAgent = await start("dev-b");
  assert.equal(fieldOf(byAgent, "closer"), "dev-b", "assigned to an agent of the product");
  const { sprints } = documentsOf({ ...(await product({ model: MODELS.timeBox })), [sprintPath("team2", 1)]: byAgent });
  assert.deepEqual(sprintsToClose(sprints, [], "2026-11-10"), [], "counter-proof: nothing is due before the time box ends");
  assert.deepEqual(sprintsToClose(sprints, [], "2026-11-16").filter((due) => due.sprint === "team2/01"), [{ sprint: "team2/01", closer: "dev-b", because: "time box ended" }]);
});

// TST-803113 · level: release · module: MOD-implementation-pages
// guards: UC-032; CLOSING A SPRINT CAN BE ASSIGNED TO A PARTICIPANT
// given: the product of TST-803112; the closer "nobody", a name the instance's register does not list and no role assignment gives a role; known positive first — dev-b, a participant of the product, is accepted
// input: the Product Owner of team2 plans a sprint with ITM-003 and presses Start sprint with the closer dev-b, and, in a second reading, with the closer nobody
// expect: known positive — with dev-b one commit writes team2's record, and its closer is dev-b; akmaier ruled that a closer need not be a participant: with "nobody" Start sprint is accepted, one commit writes team2's record, and its closer is nobody
test("TST-803113: UC-032 a sprint's closer who is no participant of the product is accepted and the record names them", async () => {
  const start = async (closer) => {
    const page = await open("backlog", {}, { files: await product({ model: MODELS.timeBox }) });
    try {
      await planOf(page, "team2");
      typeValue(page, "[data-sprint-goal]", "Mail");
      typeValue(page, "[data-sprint-closer]", closer);
      tickOf(page, "ITM-003").checked = true;
      const writes = page.srv.writes.length;
      await page.press(found(page.target, "[data-start-sprint]")[0]);
      return { written: page.srv.writes.length - writes, record: page.srv.files[sprintPath("team2", 1)] ?? null };
    } finally { page.done(); }
  };
  const known = await start("dev-b");
  assert.equal(known.written, 1, "known positive");
  assert.equal(fieldOf(known.record, "closer"), "dev-b");
  const nobody = await start("nobody");
  assert.equal(nobody.written, 1, "a closer who is no participant is accepted: one commit writes the record");
  assert.equal(fieldOf(nobody.record, "closer"), "nobody", "the record names that closer");
});
