// System coverage for UC-032 Maintain the backlog, walked through the dashboard: the main flow, steps 1 to 7, and the alternative flows 1a, 1b, 1c, 2a, 2b, 3a, 3b, 6a, 6b, 6c, 6d and 7a. The pages are the real routes of
// MOD-implementation-pages (`backlog`, `board`, `progress`, `implement`) over the real MOD-repository-hosts host and MOD-work-plans, behind a fake of GitHub's API (tests/uc-032-harness.mjs); steps 5, 6, 6c and 6d run with
// two teams' sprints. No request leaves the process.
// Run: node --test tests/system-uc-032-maintain-the-backlog.test.mjs
//
// Module: MOD-implementation-pages
// Module: MOD-work-plans
// Guards: UC-032
// Level: system
//
// Authored by developer-sonnet-l (ITM-803), who implemented none of ITM-681, ITM-782, ITM-783, ITM-784 or ITM-1316 and no UC-032 production behaviour.
// Where the pages and UC-032 disagree the case follows UC-032 and is marked { todo } with the finding it reports; every other case is green. The finding still open:
//   UC032-S5  step 6c: Start sprint, pressed after another team committed its sprint, is refused as "main has moved on"; it names no sprint, held item or module and shows no mark anew.
// Each test states its input and its expected values in its own text; none reads an expected result from the SPEC, a use case or an architecture file, but the flow map (TST-803001), which holds the expected passages itself
// and checks that UC-032 still says them. A person's click is the page's own listener called with a trusted event; no input event of the operating system is made. Readings the texts leave open, which the cases state:
//   - "derived state" is the state a row of the backlog shows; "blocked" is shown for an item whose newest job failed.
//   - "names that sprint and its team" is read as the row naming the sprint `<team>/<nn>`, whose first part is the team.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { conflicts, endSprint, heldItems, itemStates, saveItems, sprintsToClose, startSprint } from "../src/work-plans/index.mjs";
import { HEAD, MODELS, PULL_REQUESTS, backlogOf, backlogWrites, buttons, cell, classed, clickOn, disabledOf, documentsOf, drafted, entry, fieldOf, flash, found, frozen, itemsOf, keptBy, planOf, planResult, proposing, tickOf, typeValue, itemPath, itemText, listOf, memoryHost, open, part, plain, pr, product, row, settle, specOf, sprintPath,
  sprintText, textOf, typeInto, waitFor, walk } from "./uc-032-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const exists = (path) => existsSync(new URL(`../${path}`, import.meta.url));
const UC = "docs/use-cases/UC-032-maintain-the-backlog.md";
const SELF = "tests/system-uc-032-maintain-the-backlog.test.mjs";
const RELEASE_PROPOSAL = "tests/release-uc-032-proposal-and-own-input.test.mjs";
const RELEASE_SENDS = "tests/release-uc-032-proposal-and-own-input.test.mjs";
const RELEASE_CLOSER = "tests/release-uc-032-derived-state-and-sprints.test.mjs";
const RELEASE_EXPLAINS = "tests/release-uc-032-derived-state-and-sprints.test.mjs";


// ---------------------------------------------------------------- the flow map

// The passages of UC-032 the system test walks, each with the tests that walk it; the parts the pages do otherwise are findings, each a todo test that fails now and names what the page does instead.
const FLOW_EVIDENCE = {
  "main-1-item-fields": { uc: "Each item has its identifier, title, what it realises, and a derived state:", evidence: [[SELF, "TST-803002"]] },
  "main-1-states": { uc: "*waiting for acceptance*: it names a requirement that is not yet accepted;", evidence: [[SELF, "TST-803002"]] },
  "main-1-held-item-names-its-sprint": { uc: "An item that another team's sprint holds (step 5) names that sprint and its team.", evidence: [[SELF, "TST-803011"]] },
  "main-1-last-sprint": { uc: "the page shows for each team its last sprint that has ended, linked to its record, with its final burn-down.", evidence: [[SELF, "TST-803003"]] },
  "main-2-run-panel": { uc: "The run panel names the participant and what is sent: the requirements, the use cases, the architecture and the existing items.", evidence: [[SELF, "TST-803006"], [RELEASE_SENDS, "TST-803108"]] },
  "main-3-drafts": { uc: "Agent M rejects a draft that realises nothing, names no module the architecture describes, or builds on an item that does not exist or that builds on it in turn, and flags a draft that restates an existing item.", evidence: [[SELF, "TST-803007"]] },
  "main-4-add": { uc: "edits or discards drafts and presses", evidence: [[SELF, "TST-803006"], [RELEASE_PROPOSAL, "TST-803106"]] },
  "main-5-marks": { uc: "It marks every item that cannot be selected because of one of them, naming the sprint, the held item and the module", evidence: [[SELF, "TST-803011"]] },
  "main-5-held-beside-the-backlog": { uc: "Agent M lists beside the backlog every", evidence: [[SELF, "TST-803012"]] },
  "main-5-one-team": { uc: "With one team, there is nothing to list.", evidence: [[SELF, "TST-803011"]] },
  "main-6-selection": { uc: "marked are shown but cannot be selected; an item is selected only together with, or after, the items it builds on", evidence: [[SELF, "TST-803011"], [SELF, "TST-803013"]] },
  "main-6-commit": { uc: "numbered within the team, on the branch `sprint/<team>/<nn>`", evidence: [[SELF, "TST-803013"]] },
  "main-6-check-once-more": { uc: "Agent M checks the selection once more against what the other teams' sprints hold", evidence: [[SELF, "TST-803016"]] },
  "main-6-closer": { uc: "who closes the sprint — themselves by default, or a participant such as an agent (UC-041)", evidence: [[SELF, "TST-803013"], [RELEASE_CLOSER, "TST-803112"]] },
  "main-7-wip": { uc: "can be pulled only while fewer items are in progress than the WIP limit allows. Items in *Review* count as in progress.", evidence: [[SELF, "TST-803021"]] },
  "main-7-sprints-and-wip": { uc: "in a model with sprints and a WIP limit, both hold — only selected items are pulled, and only below the limit.", evidence: [[SELF, "TST-803022"]] },
  "main-explains": { uc: "Every step carries a folded", evidence: [[SELF, "TST-803026"], [RELEASE_EXPLAINS, "TST-803111"]] },
  "main-6-plan-from-progress": { uc: "the Product Owner chooses **Plan sprint** for their team, beside the team's sprint on its progress (UC-035) or on the backlog.", evidence: [[SELF, "TST-803027"]] },
  "2a-by-hand": { uc: "2a. The Product Owner writes an item by hand.", evidence: [[SELF, "TST-803008"]] },
  "2b-built-by": { uc: "2b. An item was built without a pull request naming it", evidence: [[SELF, "TST-803009"]] },
  "3a-several-items": { uc: "3a. A requirement is too large for one item.", evidence: [[SELF, "TST-803010"]] },
  "3b-missing-module": { uc: "3b. An item needs a module the architecture does not have.", evidence: [[SELF, "TST-803007"]] },
  "6a-added-during-a-sprint": { uc: "An item is added during a running sprint.", evidence: [[SELF, "TST-803008"]] },
  "6a-checked-against-others": { uc: "An item it adds is checked against what the other teams' sprints hold", evidence: [[SELF, "TST-803014"]] },
  "6a-shows-what-it-removes-or-adds": { uc: "Changing the sprint selection is a new **Start sprint** decision, and Agent M shows what", evidence: [[SELF, "TST-803014"]] },
  "6b-end-sprint": { uc: "6b. The sprint ends", evidence: [[SELF, "TST-803018"]] },
  "6b-ended-by-the-product-owner": { uc: "which records the end with the sprint.", evidence: [[SELF, "TST-803019"]] },
  "6b-every-item-done": { uc: "when every selected item is done or the Product Owner presses", evidence: [[SELF, "TST-803020"]] },
  "6c-refused": { uc: "6c. Another team started a sprint in the meantime.", evidence: [[SELF, "TST-803016"]] },
  "6c-first-holds": { uc: "Whichever sprint is committed first holds its items.", evidence: [[SELF, "TST-803016"]] },
  "6d-no-longer-held": { uc: "6d. Items of another team's sprint are no longer held", evidence: [[SELF, "TST-803017"]] },
  "7a-limit-reached": { uc: "7a. The WIP limit is reached.", evidence: [[SELF, "TST-803021"]] },
  "1a-withdrawn": { uc: "A requirement an item realises is withdrawn or changed.", evidence: [[SELF, "TST-803023"]] },
  "1c-agent": { uc: "1c. The Product Owner is an agent.", evidence: [[SELF, "TST-803025"]] },
  "1-uncovered-at-the-top": { uc: "The top of the page shows accepted requirements and use cases that no item realises yet.", evidence: [[SELF, "TST-803004"]] },
  "1b-link-to-the-plan": { uc: "There is no backlog. Agent M links to the implementation plan (UC-045).", evidence: [[SELF, "TST-803024"]] },
};
const FLOW_FINDINGS = {
  "6c-names-the-collision": { uc: "is refused and names the sprint, the held item and the module", finding: "UC032-S5", file: SELF, test: "TST-803015" },
};

// TST-803001 · level: system · module: MOD-implementation-pages
// guards: UC-032
// given: UC-032 as committed text, the executable tests named in FLOW_EVIDENCE and the findings named in FLOW_FINDINGS
// input: compare every passage of the main flow and of the alternative flows 1a, 1b, 1c, 2a, 2b, 3a, 3b, 6a, 6b, 6c, 6d and 7a with its executable evidence or its finding
// expect: every named passage stands in UC-032; every evidence file exists and contains its TST id; every finding's test stands in its file with the todo naming the finding; every alternative flow UC-032 names is among the passages
test("TST-803001: UC-032 system coverage names the main flow and every alternative flow", () => {
  const uc = read(UC).replace(/\s+/g, " ");
  for (const [flow, { uc: needle, evidence }] of Object.entries(FLOW_EVIDENCE)) {
    assert.ok(uc.includes(needle.replace(/\s+/g, " ")), `${flow}: UC-032 contains ${needle}`);
    assert.ok(evidence.length > 0, `${flow}: evidence is named`);
    for (const [file, id] of evidence) {
      assert.ok(exists(file), `${flow}: evidence file exists: ${file}`);
      assert.ok(read(file).includes(`// ${id} `), `${flow}: ${file} contains ${id}`);
    }
  }
  for (const [flow, { uc: needle, finding, file, test: id }] of Object.entries(FLOW_FINDINGS)) {
    assert.ok(uc.includes(needle.replace(/\s+/g, " ").replaceAll("**", "")) || uc.includes(needle.replace(/\s+/g, " ")), `${flow}: UC-032 contains ${needle}`);
    assert.ok(exists(file), `${flow}: ${file} exists`);
    assert.ok(read(file).includes(`// ${id} `), `${flow}: ${id} stands in ${file}`);
    assert.ok(read(file).includes(`todo: "FINDING ${finding} `), `${flow}: the todo of ${id} names FINDING ${finding}`);
  }
  const named = [...uc.matchAll(/\*\*(\d[a-z])\. /g)].map((m) => m[1]).sort();
  assert.deepEqual(named, ["1a", "1b", "1c", "2a", "2b", "3a", "3b", "6a", "6b", "6c", "6d", "7a"], "known positive: UC-032 names these twelve alternative flows");
  const walked = new Set(Object.keys({ ...FLOW_EVIDENCE, ...FLOW_FINDINGS }).map((key) => key.slice(0, 2)));
  assert.deepEqual(named.filter((flow) => !walked.has(flow)), [], "each alternative flow is among the passages");
});

// TST-803002 · level: system · module: MOD-implementation-pages
// guards: UC-032; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; EVERY ARTIFACT HAS AN IDENTIFIER
// given: the product of tests/uc-032-harness.mjs — ten items, ITM-001 merged, ITM-002 with an open pull request, ITM-003 ready, ITM-004 building on ITM-003, ITM-006 realising RULE NOT ACCEPTED, ITM-007 whose job failed, ITM-010 whose job runs
// input: the Product Owner opens Backlog
// expect: ten rows, each item after the items it builds on; each row has the identifier linked to its file, the title and what it realises; ITM-001 done, ITM-002 in progress, ITM-003 ready, ITM-004 waiting for an item it builds on and naming ITM-003, ITM-006 waiting for acceptance and naming RULE NOT ACCEPTED, ITM-007 blocked and naming its job, ITM-010 in progress; nothing is written; the page drawn again over the same files shows the same states
test("TST-803002: UC-032 1 the backlog lists each item after the items it builds on, with its identifier, title, what it realises and its derived state", async () => {
  const files = await product();
  const page = await open("backlog", {}, { files });
  try {
    assert.deepEqual(itemsOf(page), ["ITM-001", "ITM-002", "ITM-003", "ITM-004", "ITM-005", "ITM-006", "ITM-007", "ITM-008", "ITM-009", "ITM-010"]);
    assert.ok(itemsOf(page).indexOf("ITM-001") < itemsOf(page).indexOf("ITM-002") && itemsOf(page).indexOf("ITM-003") < itemsOf(page).indexOf("ITM-004"), "each after the items it builds on");
    const rows = Object.fromEntries(itemsOf(page).map((id) => [id, row(backlogOf(page), id)]));
    assert.match(rows["ITM-001"], /href="https:\/\/github\.com\/akmaier\/agent-m\/blob\/main\/docs\/backlog\/ITM-001-item-1\.md"/, "the identifier links to the item's file");
    assert.equal(cell(rows["ITM-001"], "Title"), "The work of item 1");
    assert.equal(cell(rows["ITM-001"], "Realises"), "RULE ONE");
    const states = { "ITM-001": "done", "ITM-002": "in progress", "ITM-003": "ready", "ITM-004": "waiting for an item it builds on", "ITM-006": "waiting for acceptance", "ITM-007": "blocked", "ITM-010": "in progress" };
    for (const [id, state] of Object.entries(states)) assert.ok(cell(rows[id], "State").startsWith(state), `${id} is ${state}: ${cell(rows[id], "State")}`);
    assert.match(cell(rows["ITM-004"], "State"), /ITM-003/);
    assert.match(cell(rows["ITM-006"], "State"), /RULE NOT ACCEPTED/);
    assert.match(cell(rows["ITM-007"], "State"), /JOB-20261028-1000-f001/);
    assert.equal(page.srv.writes.length, 0, "opening the page writes nothing");
  } finally { page.done(); }
  const again = await open("backlog", {}, { files });
  try {
    assert.equal(cell(row(backlogOf(again), "ITM-002"), "State").startsWith("in progress"), true, "the same states from the same repository: none was stored");
    assert.equal(itemsOf(again).length, 10);
  } finally { again.done(); }
});

// TST-803003 · level: system · module: MOD-implementation-pages
// guards: UC-032; EVERY TEAM RUNS SPRINTS OF ITS OWN; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the product of TST-803002 in which team1 runs its sprint team1/02 and team2's sprint team2/01 (2026-10-05 to 2026-10-12, ITM-009) is closed and has ended
// input: the Product Owner opens Backlog
// expect: team1's panel says a sprint runs and that it has ended no sprint; team2's panel says it has no running sprint, names its last sprint team2/01 as ended on 2026-10-12, links the sprint's record docs/backlog/sprints/team2/01.md and draws its final burn-down — start, end, one item left —; team2 is offered Plan sprint
test("TST-803003: UC-032 1 in a model with sprints each team shows its last sprint that has ended, linked to its record, with its final burn-down", async () => {
  const ended = sprintText({ n: 1, goal: "Mail", start: "2026-10-05", end: "2026-10-12", closer: "bob", selection: ["ITM-009"], tail: ["", "## Review", "", "Nothing is done.", "", "## Unfinished items", "", "to the backlog: ITM-009",
    "into the next sprint:", "", "## Retrospective", "", "- change: smaller items."] });
  const page = await open("backlog", {}, { files: await product({ files: { [sprintPath("team2", 1)]: ended } }) });
  try {
    const team1 = part(page.html(), 'data-team="team1"'), team2 = part(page.html(), 'data-team="team2"');
    assert.match(team1, /a sprint runs/);
    assert.match(team1, /It has ended no sprint yet\./);
    assert.match(team2, /no running sprint/);
    assert.match(team2, /Its last sprint, .*team2\/01.*ended on 2026-10-12/s);
    assert.match(team2, /href="https:\/\/github\.com\/akmaier\/agent-m\/blob\/main\/docs\/backlog\/sprints\/team2\/01\.md"/, "linked to its record");
    assert.match(team2, /x-axis \[(?:&quot;|")start(?:&quot;|"), (?:&quot;|")end(?:&quot;|")\]/);
    assert.match(team2, /line \[1, 1\]/, "the item left at its start and at its end");
    assert.match(team2, /data-plan="team2"/, "team2 can plan its next sprint");
  } finally { page.done(); }
});

// TST-803004 · level: system · module: MOD-implementation-pages
// guards: UC-032
// given: the product of TST-803002, whose accepted RULE TWO and accepted UC-001 are realised by no item, and whose RULE ONE, THREE and FOUR are realised
// input: the Product Owner opens Backlog; the order of the page's parts is read
// expect: known positive — the part of what no item realises names RULE TWO and UC-001 and not RULE ONE, and offers Propose items for uncovered requirements; UC-032 step 1 says the top of the page shows them: that part stands before the backlog's table
test("TST-803004: UC-032 1 the top of the page shows the accepted requirements and use cases that no item realises yet", async () => {
  const page = await open("backlog", {}, { files: await product() });
  try {
    const uncovered = part(page.html(), 'data-part="uncovered"');
    assert.match(uncovered, /UC-001/, "known positive");
    assert.match(uncovered, /RULE TWO/);
    assert.doesNotMatch(uncovered, /RULE ONE/, "RULE ONE is realised");
    assert.equal(found(page.target, "[data-propose-items]").length, 1, "Propose items for uncovered requirements is offered");
    assert.ok(page.html().indexOf('data-part="uncovered"') < page.html().indexOf('data-part="backlog"'), "the part of what no item realises stands before the backlog's table");
  } finally { page.done(); }
});

// ---------------------------------------------------------------- steps 2 to 4


// TST-803006 · level: system · module: MOD-implementation-pages
// guards: UC-032; A GENERATED ARTIFACT IS A PROPOSAL; THE PAGE NAMES WHERE IT SENDS; ONE CLICK PER DECISION; A BACKLOG ITEM NAMES WHAT IT REALISES; A BACKLOG ITEM NAMES THE MODULES IT CHANGES
// given: the product of TST-803002, the register's drafting participants local-llm (this machine, ep1) and cloud-llm (a provider in the USA, ep2); ep1 answers two drafts — "Show RULE TWO" (RULE TWO, MOD-store) and "Cover UC-001 end to end" (UC-001, MOD-pages, building on the first by its title)
// input: the Product Owner chooses Propose items for uncovered requirements, reads the run panel, presses Run, then presses Add to backlog, and opens Backlog again
// expect: the run panel names local-llm, its model model-a and its place this machine, and the requirements, use cases, architecture and existing items it sends; before Run no endpoint is asked; Run asks ep1 alone, and what it receives holds RULE TWO, UC-001, MOD-store and the title of ITM-001; the drafts wait: no file of docs/backlog/ is written before Add to backlog; Add to backlog is one commit of two files docs/backlog/ITM-011-show-rule-two.md and docs/backlog/ITM-012-cover-uc-001-end-to-end.md, each naming what it realises, its modules and its origin, the second building on ITM-011; opened again, the backlog lists both, and the part of what no item realises names neither RULE TWO nor UC-001
test("TST-803006: UC-032 2 to 4 the Product Owner proposes items, reads what is sent and where, runs the participant and adds the drafts in one click", async () => {
  const { page, asked } = await proposing(await product(), { items: [entry("Show RULE TWO"), entry("Cover UC-001 end to end", { realises: ["UC-001"], modules: ["MOD-pages"], buildsOn: ["Show RULE TWO"] })] });
  try {
    const panel = textOf(classed(page.target, "run-panel")[0]);
    for (const named of ["local-llm", "model-a", "this machine", "RULE TWO", "UC-001", "MOD-store", "existing items"]) assert.ok(panel.includes(named), `the run panel names ${named}: ${panel}`);
    assert.equal(asked.length, 0, "nothing is sent before Run");
    await page.press(buttons(classed(page.target, "run-panel")[0], "Run")[0]);
    await waitFor(() => found(page.target, "[data-draft]").length === 2);
    assert.deepEqual([...new Set(asked.map((request) => request.origin))], ["https://ep1.example.test"], "only the endpoint of the participant named is asked");
    const sent = JSON.stringify(asked[0].body);
    for (const named of ["RULE TWO", "UC-001", "MOD-store", "The work of item 1"]) assert.ok(sent.includes(named), `what the participant receives holds ${named}`);
    assert.deepEqual(backlogWrites(page), [], "the drafts wait: nothing is written to docs/backlog/ before Add to backlog");
    await page.press(buttons(page.target, "Add to backlog")[0]);
    await waitFor(() => classed(page.target, "drafts-added").length > 0);
    const [commit, ...more] = backlogWrites(page);
    assert.equal(more.length, 0, "one click, one commit");
    assert.deepEqual(Object.keys(commit.files).sort(), ["docs/backlog/ITM-011-show-rule-two.md", "docs/backlog/ITM-012-cover-uc-001-end-to-end.md"]);
    const [first, second] = [commit.files["docs/backlog/ITM-011-show-rule-two.md"], commit.files["docs/backlog/ITM-012-cover-uc-001-end-to-end.md"]];
    assert.deepEqual([listOf(first, "realises"), listOf(first, "modules")], [["RULE TWO"], ["MOD-store"]]);
    assert.deepEqual([listOf(second, "realises"), listOf(second, "modules"), listOf(second, "builds_on")], [["UC-001"], ["MOD-pages"], ["ITM-011"]], "the second builds on the first, named by its identifier");
    assert.ok(listOf(first, "origin").length > 0 && listOf(second, "origin").length > 0, "each names its origin");
    const again = await open("backlog", {}, { files: page.srv.files });
    try {
      assert.deepEqual(itemsOf(again).slice(-2), ["ITM-011", "ITM-012"]);
      const uncovered = part(again.html(), 'data-part="uncovered"');
      assert.ok(!uncovered.includes("RULE TWO") && !uncovered.includes("UC-001"), `neither is uncovered now: ${plain(uncovered).slice(0, 200)}`);
    } finally { again.done(); }
  } finally { page.done(); }
});

// TST-803007 · level: system · module: MOD-implementation-pages
// guards: UC-032; A BACKLOG ITEM NAMES WHAT IT REALISES; A BACKLOG ITEM NAMES THE MODULES IT CHANGES
// given: the product of TST-803002; ep1 answers five drafts — a sound one, one that realises nothing, one that changes MOD-new, which the architecture does not describe (3b), one that builds on ITM-099, which does not exist, and one that restates ITM-001 by its title
// input: Propose items and Run; the faulty drafts discarded one after the other
// expect: the sound draft has no finding; the three faulty ones each an error — "realises nothing", "names no module the architecture describes", "ITM-099, which does not exist" —; the restatement a warning that it restates ITM-001 and no error; while a draft kept has an error Add to backlog is disabled and no file of docs/backlog/ is written; discarded, it is enabled; the item that needs MOD-new is not in the commit that follows (it waits until the architecture is changed)
test("TST-803007: UC-032 3 and 3b a draft that realises nothing, needs a module the architecture lacks or builds on a missing item is refused, and a restatement is flagged", async () => {
  const { page } = await drafted(await product(), { items: [entry("Show RULE TWO"), entry("Realise nothing", { realises: [] }), entry("Change a module that is not there", { modules: ["MOD-new"] }),
    entry("Build on a missing item", { buildsOn: ["ITM-099"] }), entry("The work of item 1")] });
  try {
    const boxes = found(page.target, "[data-draft]");
    assert.equal(boxes.length, 5);
    const errors = (box) => classed(box, "error").map(textOf).join(" ");
    assert.equal(errors(boxes[0]), "", "the sound draft has no error");
    assert.match(errors(boxes[1]), /realises nothing/);
    assert.match(errors(boxes[2]), /names no module the architecture describes/);
    assert.equal(found(boxes[2], '[data-draft-field="modules"]')[0].value, "MOD-new", "the draft names the gap and invents no module");
    assert.match(errors(boxes[3]), /ITM-099, which does not exist/);
    assert.equal(errors(boxes[4]), "", "a restatement is no error");
    assert.match(classed(boxes[4], "warning").map(textOf).join(" "), /restates ITM-001/);
    const add = () => buttons(page.target, "Add to backlog")[0];
    assert.equal(add().disabled, true, "a draft kept has an error");
    assert.deepEqual(backlogWrites(page), []);
    for (const box of boxes.slice(1, 4)) { const tick = found(box, "[data-draft-discard]")[0]; tick.checked = true; tick.dispatchEvent(new Event("change")); await settle(); }
    assert.equal(add().disabled, false, "the drafts kept have no error");
    await page.press(add());
    await waitFor(() => classed(page.target, "drafts-added").length > 0);
    const written = backlogWrites(page).flatMap((write) => Object.entries(write.files));
    assert.equal(written.length, 2, "the sound draft and the restatement");
    assert.ok(!written.some(([, text]) => text.includes("MOD-new")), "the item that needs MOD-new is not committed");
  } finally { page.done(); }
});

// TST-803008 · level: system · module: MOD-implementation-pages
// guards: UC-032; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; A BACKLOG ITEM NAMES WHAT IT REALISES; A BACKLOG ITEM NAMES THE MODULES IT CHANGES; EVERY ARTIFACT HAS AN IDENTIFIER
// given: the product of TST-803002, in which team1's sprint team1/02 runs; known positive first — the sprint's record names ITM-001 and ITM-002
// input: the Product Owner presses + Item, fills in the title, the outcome, RULE TWO, no module, then MOD-new, then MOD-news, and presses Add; the sprint's record and the backlog are read after it (6a: an item added during a running sprint)
// expect: with no module, and with MOD-new, an error stands in the form and Add is disabled; with MOD-news it is enabled; Add is one commit of the one file docs/backlog/ITM-011-show-the-second-rule-by-hand.md on the default branch and no job record, and the file names its origin; the sprint's record is as it was, so the item goes to the product backlog and not into the sprint; the backlog lists ITM-011 ready and held by no sprint
test("TST-803008: UC-032 2a and 6a an item written by hand is committed as the person's own input to the backlog, never into the running sprint", async () => {
  const files = await product();
  assert.deepEqual(listOf(files[sprintPath("team1", 2)], "selection"), ["ITM-001", "ITM-002"], "known positive: the running sprint's selection");
  const sprintBefore = files[sprintPath("team1", 2)];
  const page = await open("backlog", {}, { files });
  try {
    await page.press(found(page.target, "[data-add-item]")[0]);
    await waitFor(() => classed(page.target, "schema-form").length > 0);
    const form = classed(page.target, "schema-form")[0];
    const field = (key) => walk(found(form, `[data-key="${key}"]`)[0], (node) => node.localName === "input")[0];
    await typeInto(field("title"), "Show the second rule by hand");
    await typeInto(field("level"), "module");
    await typeInto(field("realises"), "RULE TWO");
    await typeInto(field("tests"), "unit");
    await typeInto(field("origin"), "the Product Owner");
    const add = () => buttons(form, "Add")[0];
    assert.equal(add().disabled, true, "no module is named");
    await typeInto(field("modules"), "MOD-new");
    assert.equal(add().disabled, true, "a module the architecture does not describe");
    assert.match(classed(form, "error").map(textOf).join(" "), /names no module the architecture describes/);
    await typeInto(field("modules"), "MOD-news");
    assert.equal(add().disabled, false, `the item is complete: ${classed(form, "error").map(textOf).join(" | ")}`);
    const before = page.srv.writes.length;
    await clickOn(add());
    await waitFor(() => classed(page.target, "item-added").length > 0);
    assert.equal(page.srv.writes.length, before + 1, "one commit");
    assert.deepEqual(Object.keys(page.srv.writes.at(-1).files), ["docs/backlog/ITM-011-show-the-second-rule-by-hand.md"], "the one file, and no job record");
    assert.ok(listOf(page.srv.writes.at(-1).files["docs/backlog/ITM-011-show-the-second-rule-by-hand.md"], "origin").length > 0, "it names its origin");
    assert.equal(page.srv.files[sprintPath("team1", 2)], sprintBefore, "the sprint's record is as it was");
    const again = await open("backlog", {}, { files: page.srv.files });
    try {
      assert.ok(itemsOf(again).includes("ITM-011"));
      assert.ok(cell(row(backlogOf(again), "ITM-011"), "State").startsWith("ready"));
      assert.equal(cell(row(backlogOf(again), "ITM-011"), "Held or kept"), "—", "held by no sprint");
    } finally { again.done(); }
  } finally { page.done(); }
});

// TST-803009 · level: system · module: MOD-implementation-pages
// guards: UC-032; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
// given: the product of TST-803002, in which ITM-003 is ready — no pull request names it — and ITM-004 builds on it and waits; known positive first — the page shows exactly that
// input: the Product Owner writes into ITM-003's file the commit that built it, as built_by, and commits it; the Product Owner opens Backlog again
// expect: known positive — before the edit ITM-003 is ready and ITM-004 waits for ITM-003; after it ITM-003 is done and names no pull request, ITM-004 is ready and no longer waits; nothing is written by the page, and no other item changes its state
test("TST-803009: UC-032 2b an item built without a pull request is done by the commits its record names, and the items that build on it stop waiting", async () => {
  const files = await product();
  const state = async (source) => {
    const page = await open("backlog", {}, { files: source });
    try { return { states: Object.fromEntries(itemsOf(page).map((id) => [id, cell(row(backlogOf(page), id), "State")])), writes: page.srv.writes.length }; } finally { page.done(); }
  };
  const before = await state(files);
  assert.ok(before.states["ITM-003"].startsWith("ready") && before.states["ITM-004"].startsWith("waiting for an item it builds on"), "known positive: ITM-004 waits for ITM-003");
  assert.match(before.states["ITM-004"], /ITM-003/);
  const built = "ab".repeat(20);
  const after = await state({ ...files, [itemPath(3)]: itemText(3, { modules: ["MOD-mail"], extra: ["built_by:", `  - ${built}`] }) });
  assert.ok(after.states["ITM-003"].startsWith("done"), `ITM-003 is done by its record: ${after.states["ITM-003"]}`);
  assert.ok(after.states["ITM-004"].startsWith("ready"), `ITM-004 no longer waits: ${after.states["ITM-004"]}`);
  assert.equal(after.writes, 0, "the page writes nothing");
  for (const id of Object.keys(before.states).filter((one) => !["ITM-003", "ITM-004"].includes(one))) assert.equal(after.states[id], before.states[id], `${id} is as it was`);
});

// TST-803010 · level: system · module: MOD-implementation-pages
// guards: UC-032; A BACKLOG ITEM NAMES WHAT IT REALISES
// given: the product of TST-803002; ep1 answers two drafts that each realise RULE TWO, the requirement being too large for one item (3a): the first changes MOD-store, the second MOD-pages and builds on the first
// input: Propose items and Run; Add to backlog; Backlog opened again
// expect: neither draft has an error; one commit adds two items that each name RULE TWO, the second building on the first; opened again, the backlog lists both with RULE TWO among what each realises, and the part of what no item realises no longer names RULE TWO
test("TST-803010: UC-032 3a a requirement too large for one item is realised by several items, each naming it", async () => {
  const { page } = await drafted(await product(), { items: [entry("Show RULE TWO, the first part"), entry("Show RULE TWO, the second part", { modules: ["MOD-pages"], buildsOn: ["Show RULE TWO, the first part"] })] });
  try {
    assert.deepEqual(found(page.target, "[data-draft]").map((box) => classed(box, "error").length), [0, 0]);
    await page.press(buttons(page.target, "Add to backlog")[0]);
    await waitFor(() => classed(page.target, "drafts-added").length > 0);
    const [commit, ...more] = backlogWrites(page);
    assert.equal(more.length, 0);
    const [first, second] = Object.entries(commit.files).sort(([a], [b]) => (a < b ? -1 : 1)).map(([, text]) => text);
    assert.deepEqual([listOf(first, "realises"), listOf(second, "realises"), listOf(second, "builds_on")], [["RULE TWO"], ["RULE TWO"], ["ITM-011"]]);
    const again = await open("backlog", {}, { files: page.srv.files });
    try {
      assert.deepEqual(itemsOf(again).slice(-2), ["ITM-011", "ITM-012"]);
      assert.equal(cell(row(backlogOf(again), "ITM-012"), "Realises"), "RULE TWO");
      assert.ok(!part(again.html(), 'data-part="uncovered"').includes("RULE TWO"));
    } finally { again.done(); }
  } finally { page.done(); }
});

// ---------------------------------------------------------------- step 5: what the other teams hold

const heldRows = (html) => Object.fromEntries([...html.matchAll(/<tr data-held="(ITM-\d{3})">([\s\S]*?)<\/tr>/g)].map(([, id, tr]) => [id, [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => plain(m[1]))]));

// TST-803011 · level: system · module: MOD-implementation-pages
// guards: UC-032; SPRINT PLANNING SHOWS WHAT THE OTHER TEAMS' SPRINTS HOLD; SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES; EVERY TEAM RUNS SPRINTS OF ITS OWN
// given: the product of TST-803002 with two teams: team1's sprint team1/02 holds ITM-002, which changes MOD-pages, which uses MOD-store (ITM-001 is merged); ITM-005 changes MOD-store, ITM-009 changes MOD-pages, ITM-008 changes MOD-report, which uses MOD-pages; ITM-003, ITM-004, ITM-007 and ITM-010 share no module with ITM-002; team2 runs no sprint
// input: the Product Owner of team2 opens Backlog and presses Plan sprint for team2; then Plan sprint for team1; and, on a product with one team, Plan sprint
// expect: the other teams' sprints hold exactly ITM-002, listed with its title, its sprint team1/02, the module it changes MOD-pages and the module those use MOD-store; ITM-002 itself (held), ITM-005 (changes the module the held item uses), ITM-009 (changes a module the held item changes) and ITM-008 (its module uses a module the held item changes) are marked kept from team2, each naming team1/02, ITM-002 and the module, and cannot be selected — their ticks are disabled with that reason —; ITM-006, waiting for acceptance, is shown and cannot be selected; ITM-003, ITM-004, ITM-007 and ITM-010 are marked by nothing and can be selected; team1's plan lists nothing held and keeps ITM-005 selectable; in a product with one team nothing is listed
test("TST-803011: UC-032 5 and 6 the plan of a team lists every item the other teams' sprints hold and marks every item that cannot be selected, naming the sprint, the held item and the module", async () => {
  const page = await open("backlog", {}, { files: await product() });
  try {
    const plan = await planOf(page, "team2");
    assert.deepEqual(heldRows(part(page.html(), 'data-part="held"')), { "ITM-002": ["ITM-002", "The work of item 2", "team1/02", "MOD-pages", "MOD-store"] }, "exactly what team1's sprint holds");
    const reasons = { "ITM-002": "MOD-pages", "ITM-005": "MOD-store", "ITM-009": "MOD-pages", "ITM-008": "MOD-pages" };
    for (const [id, module] of Object.entries(reasons)) {
      assert.match(keptBy(page, id), new RegExp(`kept from team2: team1/02 holds ITM-002 — ${module}`), `${id} is marked`);
      if (id === "ITM-002") assert.match(keptBy(page, id), /held by team1\/02/, "the held item names its sprint and so its team");
      assert.equal(disabledOf(tickOf(page, id)), true, `${id} cannot be selected`);
      assert.match(plain(row(plan, id)), new RegExp(`team1/02 holds ITM-002 — ${module}|held by team1/02`), `${id}: the plan names why`);
    }
    assert.match(plain(row(plan, "ITM-006")), /RULE NOT ACCEPTED is not accepted/);
    assert.equal(disabledOf(tickOf(page, "ITM-006")), true, "waiting for acceptance: shown, not selectable");
    for (const id of ["ITM-003", "ITM-004", "ITM-007", "ITM-010"]) {
      assert.equal(keptBy(page, id), "—", `${id} is marked by nothing`);
      assert.ok(!disabledOf(tickOf(page, id)), `${id} can be selected`);
    }
    await page.press(found(page.target, "[data-cancel-plan]")[0]);
    await planOf(page, "team1");
    assert.match(plain(part(page.html(), 'data-part="held"')), /No other team's sprint holds an item\./);
    assert.ok(!disabledOf(tickOf(page, "ITM-005")), "team1's own sprint keeps nothing from team1");
  } finally { page.done(); }
  const alone = await open("backlog", {}, { files: await product({ files: { "docs/role-assignments/team2.md": null } }) });
  try {
    await planOf(alone, "team1");
    assert.equal(found(alone.target, '[data-part="held"]').length, 0, "with one team there is nothing to list");
    assert.deepEqual(itemsOf(alone).filter((id) => /kept from/.test(keptBy(alone, id))), [], "and nothing is kept from anyone");
  } finally { alone.done(); }
});

// TST-803012 · level: system · module: MOD-implementation-pages
// guards: UC-032; SPRINT PLANNING SHOWS WHAT THE OTHER TEAMS' SPRINTS HOLD
// given: the product of TST-803011, whose team1 sprint holds ITM-002; known positive first — with Plan sprint open the held item is listed
// input: the Product Owner opens Backlog, without pressing Plan sprint
// expect: known positive — Plan sprint lists ITM-002 as held by team1/02, changing MOD-pages and using MOD-store; UC-032 step 5 says Agent M lists beside the backlog every item that another team's sprint holds, each with its sprint, team and modules: the page of the backlog, with no planning open, holds that list.
test("TST-803012: UC-032 5 the backlog lists beside it every item that another team's sprint holds", async () => {
  const page = await open("backlog", {}, { files: await product() });
  try {
    await planOf(page, "team2");
    assert.deepEqual(heldRows(part(page.html(), 'data-part="held"'))["ITM-002"] ?? null, ["ITM-002", "The work of item 2", "team1/02", "MOD-pages", "MOD-store"], "known positive");
    await page.press(found(page.target, "[data-cancel-plan]")[0]);
    assert.deepEqual(heldRows(part(page.html(), 'data-part="held"'))["ITM-002"], ["ITM-002", "The work of item 2", "team1/02", "MOD-pages", "MOD-store"], "the list stands beside the backlog");
  } finally { page.done(); }
});

// ---------------------------------------------------------------- step 6: Plan sprint and Start sprint


// TST-803013 · level: system · module: MOD-implementation-pages
// guards: UC-032; EVERY TEAM RUNS SPRINTS OF ITS OWN; A TIME BOX WORKS ONLY ON WHAT WAS SELECTED FOR IT; ONE CLICK PER DECISION; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN
// given: the product of TST-803011 whose model has a time box of two weeks; team2 has no sprint; ITM-004 builds on ITM-003, which is ready; ITM-006 waits for acceptance
// input: the Product Owner of team2 presses Plan sprint, selects ITM-004 alone, sets the goal "Mail" and the start 2026-11-02, presses Start sprint; then selects ITM-003 with it and presses Start sprint again; the backlog and the route implement are read afterwards
// expect: ITM-006 is shown and cannot be selected, and the closer stands preset to team2's Owner, bob; the first press is refused naming ITM-004, ITM-003 and that it is not done, and writes nothing and creates no branch; the second makes one commit of the one file docs/backlog/sprints/team2/01.md — sprint 1, the goal, the start, the end 2026-11-15 that the time box gives, the closer bob, the branch sprint/team2/01 and the selection ITM-003 and ITM-004 — after creating that branch from the head; the page says the sprint is started; the backlog then shows ITM-003 held by team2/01; the route implement says of ITM-005, in no sprint, that it is not selected for a sprint, and of ITM-003, selected, nothing of the kind
test("TST-803013: UC-032 6 the Product Owner plans a team's sprint and starts it in one click: the selection, the dates, the closer and the branch", async () => {
  const page = await open("backlog", {}, { files: await product({ model: MODELS.timeBox }) });
  try {
    await planOf(page, "team2");
    assert.equal(disabledOf(tickOf(page, "ITM-006")), true, "waiting for acceptance: shown, not selectable");
    assert.match(page.html(), /<input data-sprint-closer(?:="")? value="bob">/, "the closer is preset to the team's Owner");
    typeValue(page, "[data-sprint-goal]", "Mail");
    typeValue(page, "[data-sprint-start]", "2026-11-02");
    typeValue(page, "[data-sprint-closer]", "bob");
    tickOf(page, "ITM-004").checked = true;
    const writes = page.srv.writes.length;
    await page.press(found(page.target, "[data-start-sprint]")[0]);
    assert.match(planResult(page), /ITM-004 builds on ITM-003, which is not done/);
    assert.equal(page.srv.writes.length, writes, "nothing is written");
    assert.deepEqual(page.created, [], "no branch is created");
    tickOf(page, "ITM-003").checked = true;
    await page.press(found(page.target, "[data-start-sprint]")[0]);
    assert.equal(page.srv.writes.length, writes + 1, "one click, one commit");
    assert.deepEqual(Object.keys(page.srv.writes.at(-1).files), ["docs/backlog/sprints/team2/01.md"]);
    const record = page.srv.writes.at(-1).files["docs/backlog/sprints/team2/01.md"];
    assert.deepEqual(["sprint", "goal", "start", "end", "closer", "branch"].map((key) => fieldOf(record, key)), ["1", "Mail", "2026-11-02", "2026-11-15", "bob", "sprint/team2/01"]);
    assert.deepEqual(listOf(record, "selection"), ["ITM-003", "ITM-004"]);
    assert.deepEqual(page.created.map((made) => made.ref), ["refs/heads/sprint/team2/01"]);
    assert.match(flash(page), /docs\/backlog\/sprints\/team2\/01\.md is started/);
    const again = await open("backlog", {}, { files: page.srv.files });
    try { assert.match(keptBy(again, "ITM-003"), /held by team2\/01/); } finally { again.done(); }
    const implement = await open("implement", {}, { files: page.srv.files });
    try {
      assert.match(plain(row(implement.html(), "ITM-005")), /is not selected for/);
      assert.doesNotMatch(plain(row(implement.html(), "ITM-003")), /is not selected for/);
    } finally { implement.done(); }
  } finally { page.done(); }
});

// TST-803014 · level: system · module: MOD-implementation-pages
// guards: UC-032; A TIME BOX WORKS ONLY ON WHAT WAS SELECTED FOR IT; EVERY TEAM RUNS SPRINTS OF ITS OWN
// given: the product of TST-803011 in which team1's sprint team1/02 runs, and team2's sprint team2/01 runs with ITM-010, which changes MOD-news, and no time box
// input: the Product Owner of team1 presses Change the selection, reads the plan, adds ITM-003, takes ITM-002 out, and presses Start sprint
// expect: known positive — ITM-007, which changes MOD-news, cannot be selected and the plan names team2/01, ITM-010 and MOD-news; Start sprint makes one commit of team1/02's record alone, which keeps its front matter and appends ## Selection with the new selection, so that the sprint's selection is now ITM-003 and not ITM-002; UC-032 6a says Agent M shows what the new decision removes or adds: the notice names ITM-003 as added and ITM-002 as removed
test("TST-803014: UC-032 6a changing a running sprint's selection is a new Start sprint decision, and Agent M shows what it removes or adds", async () => {
  const sprint2 = sprintText({ n: 1, goal: "News", start: "2026-10-22", closer: "bob", selection: ["ITM-010"], branch: "sprint/team2/01" });
  const files = await product({ files: { [sprintPath("team2", 1)]: sprint2 } });
  const before = files[sprintPath("team1", 2)];
  const page = await open("backlog", {}, { files });
  try {
    await planOf(page, "team1");
    assert.equal(disabledOf(tickOf(page, "ITM-007")), true, "known positive: kept by the other team's sprint");
    assert.match(plain(row(part(page.html(), 'data-plan-team="team1"'), "ITM-007")), /team2\/01 holds ITM-010 — MOD-news/);
    tickOf(page, "ITM-003").checked = true;
    tickOf(page, "ITM-002").checked = false;
    typeValue(page, "[data-sprint-goal]", "Store and show");
    typeValue(page, "[data-sprint-closer]", "alice");
    const writes = page.srv.writes.length;
    await page.press(found(page.target, "[data-start-sprint]")[0]);
    assert.equal(page.srv.writes.length, writes + 1, "known positive: one commit");
    assert.deepEqual(Object.keys(page.srv.writes.at(-1).files), [sprintPath("team1", 2)], "known positive: the sprint's record alone");
    const record = page.srv.files[sprintPath("team1", 2)];
    assert.ok(record.startsWith(before.replace(/\n+$/, "\n")), "known positive: what the record held stays, the decision is appended");
    assert.match(record, /\n## Selection\n/, "known positive: the decision is appended");
    assert.equal(fieldOf(record.slice(record.indexOf("## Selection")), "selection"), "ITM-003", "known positive: the selection now");
    assert.match(flash(page), /ITM-003/, "the page names the item the decision adds");
    assert.match(flash(page), /ITM-002/, "and the item it removes");
  } finally { page.done(); }
});

// ---------------------------------------------------------------- 6c: another team started a sprint in the meantime

const TEAM1_FIRST = sprintText({ n: 1, goal: "Store", start: "2026-10-30", closer: "alice", selection: ["ITM-001"], branch: "sprint/team1/01" });

// TST-803015 · level: system · module: MOD-implementation-pages
// guards: UC-032; SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES; EVERY TEAM RUNS SPRINTS OF ITS OWN
// given: the product of TST-803011 in which no sprint runs; the Product Owner of team2 has Plan sprint open with ITM-005 (MOD-store) ready and selectable; meanwhile team1 commits its sprint team1/01 with ITM-001 (MOD-store)
// input: the Product Owner of team2 selects ITM-005, sets the goal and the closer, and presses Start sprint
// expect: known positive — before team1's sprint ITM-005 can be selected, team1's sprint stands on the default branch holding ITM-001 (whichever sprint is committed first holds its items), and a page drawn afterwards marks ITM-005 kept from team2 by team1/01, ITM-001 and MOD-store and disables its tick; UC-032 6c says Start sprint is refused and names the sprint, the held item and the module, the marks are shown anew, and nothing is written: the refusal names team1/01, ITM-001 and MOD-store, no sprint of team2 is committed, the row of ITM-005 is marked anew, and no branch sprint/team2/01 was created. FINDING: the click is refused as "main has moved on" and names none of the three
test("TST-803015: UC-032 6c Start sprint, pressed after another team started a sprint, is refused naming the sprint, the held item and the module",
  { todo: "FINDING UC032-S5 — Start sprint (src/implementation-pages/backlog.mjs, startInputs) reads the declaration, modules and sprints at the view's commit and hands startSprint the held items of that view, so the collision is not seen; the host then refuses the commit on the head the view was read at (`Moved`), and the page prints \"main has moved on … nothing was written; read it again\" without a sprint, a held item or a module, does not draw the marks again, and has created the branch sprint/team2/01 before the refusal" }, async () => {
  const files = await product({ files: { [sprintPath("team1", 2)]: null } });
  const page = await open("backlog", {}, { files, pullRequests: [], server: [await frozen(HEAD, { ...files })] });
  try {
    await planOf(page, "team2");
    assert.equal(disabledOf(tickOf(page, "ITM-005")), false, "known positive: before team1's sprint ITM-005 can be selected");
    await page.srv.change(sprintPath("team1", 1), TEAM1_FIRST);
    typeValue(page, "[data-sprint-goal]", "Store again");
    typeValue(page, "[data-sprint-closer]", "bob");
    tickOf(page, "ITM-005").checked = true;
    const fresh = await open("backlog", {}, { files: page.srv.files, pullRequests: [] });
    try {
      assert.match(keptBy(fresh, "ITM-005"), /kept from team2: team1\/01 holds ITM-001 — MOD-store/, "known positive: a page drawn after team1's commit marks ITM-005");
      await planOf(fresh, "team2");
      assert.equal(disabledOf(tickOf(fresh, "ITM-005")), true, "known positive: and cannot select it");
    } finally { fresh.done(); }
    await page.press(found(page.target, "[data-start-sprint]")[0]);
    assert.deepEqual(listOf(page.srv.files[sprintPath("team1", 1)], "selection"), ["ITM-001"], "known positive: team1's sprint stands on the default branch and holds ITM-001");
    assert.ok(!Object.hasOwn(page.srv.files, sprintPath("team2", 1)), "known positive: no sprint of team2 is committed");
    const refusal = planResult(page);
    for (const named of ["team1/01", "ITM-001", "MOD-store"]) assert.ok(refusal.includes(named), `the refusal names ${named}: ${refusal}`);
    assert.match(keptBy(page, "ITM-005"), /kept from team2: team1\/01 holds ITM-001 — MOD-store/, "the marks are shown anew");
    assert.deepEqual(page.created, [], "and no branch was created for the refused sprint");
  } finally { page.done(); }
});

// TST-803016 · level: system · module: MOD-work-plans
// guards: UC-032; SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES; A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH; EVERY TEAM RUNS SPRINTS OF ITS OWN
// given: the product of TST-803011 in which no sprint runs, held in memory; team1 starts its sprint with ITM-001; the head is then read for team2's Start sprint with ITM-005, which changes MOD-store
// input: startSprint for team1 with ITM-001; then startSprint for team2 with ITM-005 and the items the default branch holds at that moment; and, as a counter-proof, startSprint for team2 with ITM-003, which shares no module
// expect: team1's start is one commit of docs/backlog/sprints/team1/01.md; team2's start with ITM-005 is refused with SprintRefused, whose reason names team1's sprint team1/01, the held item ITM-001 and the module MOD-store, and nothing is written and no branch is created for it; counter-proof — team2's start with ITM-003 is one commit of docs/backlog/sprints/team2/01.md
test("TST-803016: UC-032 6c Agent M checks the selection once more against what the other teams' sprints hold in the default branch, and the first sprint committed holds its items", async () => {
  const mem = memoryHost(await product({ files: { [sprintPath("team1", 2)]: null } }));
  const declaration = { sections: [{ heading: "## Branches", rows: [{ cells: { "Phase or time box": "Sprint", Branch: "`sprint/<team>/<nn>`" } }] }] };
  const start = async (team, selection) => {
    const { sprints, items, architecture } = documentsOf(mem.files);
    const held = heldItems(sprints, items, architecture, []);
    return startSprint(mem.host, { team, goal: `The goal of ${team}`, start: "2026-10-30", closer: "alice", selection }, { states: selection.map((item) => ({ item, state: "ready", reason: null })),
      model: { flow: { timeBox: null } }, declaration, held, architecture, running: null, head: mem.head, trailers: [] });
  };
  const first = await start("team1", ["ITM-001"]);
  assert.equal(first.path, "docs/backlog/sprints/team1/01.md");
  assert.equal(mem.commits.length, 1, "team1's start is one commit");
  const commits = mem.commits.length, branches = mem.branches.length;
  await assert.rejects(start("team2", ["ITM-005"]), (failure) => failure.name === "SprintRefused"
    && failure.reasons.length === 1 && failure.reasons[0] === "ITM-005 cannot be selected: team1's sprint team1/01 holds ITM-001, and both concern MOD-store.", "refused, naming the sprint, the held item and the module");
  assert.equal(mem.commits.length, commits, "nothing is written");
  assert.equal(mem.branches.length, branches, "and no branch is created");
  const second = await start("team2", ["ITM-003"]);
  assert.equal(second.path, "docs/backlog/sprints/team2/01.md");
  assert.equal(mem.commits.length, commits + 1, "counter-proof: an item that shares no module is started");
});

// ---------------------------------------------------------------- 6d: items no longer held

// TST-803017 · level: system · module: MOD-implementation-pages
// guards: UC-032; A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH; SPRINT PLANNING SHOWS WHAT THE OTHER TEAMS' SPRINTS HOLD; SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES
// given: the product of TST-803011 in which team1's sprint team1/02 holds ITM-002, whose pull request is open, and team2's sprint team2/01 runs with ITM-003; known positive first — ITM-005, ITM-008 and ITM-009 are kept from team2; a second product in which team1's sprint is closed and sent ITM-002 back to the backlog
// input: Change the selection of team2 is opened; ITM-002's pull request is merged into the default branch and the page is opened again; in the second product the page is opened; then, in the first, ITM-005 is selected and Start sprint pressed
// expect: known positive — while ITM-002 is held, ITM-005, ITM-008 and ITM-009 are marked and cannot be selected; once its pull request is merged the held list says no other team's sprint holds an item, the three rows are marked by nothing and their ticks are enabled; the same when the sprint's close sent ITM-002 back to the backlog; the running sprint team2/01 then takes ITM-005 by a new Start sprint decision: one commit appending ## Selection to its record
test("TST-803017: UC-032 6d when the items another team's sprint held are merged or returned to the backlog, the marks they caused disappear and a running sprint may take the items they kept out", async () => {
  const running = sprintText({ n: 1, goal: "Mail", start: "2026-10-22", closer: "bob", selection: ["ITM-003"], branch: "sprint/team2/01" });
  const pulls = { list: [...PULL_REQUESTS] };
  const kept = (page) => ["ITM-005", "ITM-008", "ITM-009"].filter((id) => /kept from team2/.test(keptBy(page, id)));
  const files = await product({ files: { [sprintPath("team2", 1)]: running } });
  const held = await open("backlog", {}, { files, pulls });
  try {
    await planOf(held, "team2");
    assert.deepEqual(kept(held), ["ITM-005", "ITM-008", "ITM-009"], "known positive: ITM-002 is held");
    assert.ok(["ITM-005", "ITM-008", "ITM-009"].every((id) => disabledOf(tickOf(held, id))), "known positive: and they cannot be selected");
  } finally { held.done(); }
  pulls.list = [...PULL_REQUESTS.slice(0, 1), pr(2, "ITM-002", "merged", "2026-10-21T12:00:00Z", "2026-10-30T09:00:00Z")];
  const merged = await open("backlog", {}, { files, pulls });
  try {
    await planOf(merged, "team2");
    assert.match(plain(part(merged.html(), 'data-part="held"')), /No other team's sprint holds an item\./);
    assert.deepEqual(kept(merged), [], "the marks disappear");
    assert.ok(["ITM-005", "ITM-008", "ITM-009"].every((id) => !disabledOf(tickOf(merged, id))), "and the ticks are enabled");
    tickOf(merged, "ITM-003").checked = true;
    tickOf(merged, "ITM-005").checked = true;
    typeValue(merged, "[data-sprint-goal]", "Mail");
    typeValue(merged, "[data-sprint-closer]", "bob");
    const writes = merged.srv.writes.length;
    await merged.press(found(merged.target, "[data-start-sprint]")[0]);
    assert.equal(merged.srv.writes.length, writes + 1, "one commit");
    assert.deepEqual(Object.keys(merged.srv.writes.at(-1).files), [sprintPath("team2", 1)]);
    assert.equal(fieldOf(merged.srv.files[sprintPath("team2", 1)].slice(merged.srv.files[sprintPath("team2", 1)].indexOf("## Selection")), "selection"), "ITM-003, ITM-005", "the running sprint takes ITM-005 by a new decision");
  } finally { merged.done(); }
  pulls.list = [...PULL_REQUESTS];
  const closed = sprintText({ n: 2, goal: "Store and show", start: "2026-10-20", closer: "alice", selection: ["ITM-001", "ITM-002"], branch: "sprint/team1/02",
    tail: ["", "## Review", "", "ITM-002 is not done.", "", "## Unfinished items", "", "to the backlog: ITM-002", "into the next sprint:", "", "## Retrospective", "", "- change: smaller items."] });
  const returned = await open("backlog", {}, { files: await product({ files: { [sprintPath("team2", 1)]: running, [sprintPath("team1", 2)]: closed } }), pulls });
  try {
    assert.deepEqual(kept(returned), [], "returned to the backlog, ITM-002 is held no more");
    assert.ok(!cell(row(backlogOf(returned), "ITM-002"), "Held or kept").includes("held by"));
  } finally { returned.done(); }
});

// ---------------------------------------------------------------- 6b: the sprint ends

// TST-803018 · level: system · module: MOD-implementation-pages
// guards: UC-032; ONE CLICK PER DECISION; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; A TIME BOX WORKS ONLY ON WHAT WAS SELECTED FOR IT
// given: the product of TST-803011, whose model has no time box and whose team1 sprint team1/02 runs; a product whose model has a time box and whose team1 sprint ends on 2026-11-13
// input: the Product Owner opens Progress, presses End sprint for team1, and opens Progress again
// expect: End sprint is offered for team1 alone, not for team2, which runs no sprint; one click is one commit of the one file docs/backlog/sprints/team1/02.md, which gains ## Ended with the day and keeps what it held, and the page says the sprint is ended — commit; opened again, it offers no End sprint; in the product with a time box End sprint is not offered
test("TST-803018: UC-032 6b a sprint without a time box ends when every item is done or the Product Owner presses End sprint, one click, which records the end with the sprint", async () => {
  const page = await open("progress", {}, { files: await product() });
  try {
    assert.deepEqual(found(page.target, "[data-end-sprint]").map((button) => button.getAttribute("data-end-sprint")), ["team1"]);
    const before = page.srv.files[sprintPath("team1", 2)], writes = page.srv.writes.length;
    await page.script(found(page.target, "[data-end-sprint]")[0]);
    assert.equal(page.srv.writes.length, writes, "a script's click writes nothing");
    await page.press(found(page.target, "[data-end-sprint]")[0]);
    assert.equal(page.srv.writes.length, writes + 1, "one click, one commit");
    assert.deepEqual(Object.keys(page.srv.writes.at(-1).files), [sprintPath("team1", 2)]);
    const record = page.srv.files[sprintPath("team1", 2)];
    assert.ok(record.startsWith(before.replace(/\n+$/, "\n")), "what the record held stays");
    assert.match(record, /\n## Ended\n\nat: \d{4}-\d{2}-\d{2}\n/);
    assert.match(flash(page), /team1\/02.* is ended/);
    const again = await open("progress", {}, { files: page.srv.files });
    try { assert.equal(found(again.target, "[data-end-sprint]").length, 0, "no End sprint for a sprint whose end is recorded"); } finally { again.done(); }
  } finally { page.done(); }
  const boxed = await open("progress", {}, { files: await product({ model: MODELS.timeBox, files: { [sprintPath("team1", 2)]: sprintText({ n: 2, start: "2026-10-30", end: "2026-11-13", selection: ["ITM-001", "ITM-002"], branch: "sprint/team1/02" }) } }) });
  try { assert.equal(found(boxed.target, "[data-end-sprint]").length, 0, "a sprint with a time box ends at its date"); } finally { boxed.done(); }
});

// TST-803019 · level: system · module: MOD-implementation-pages
// guards: UC-032; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the product of TST-803018 in which the Product Owner has pressed End sprint for team1's sprint team1/02 today; known positive first — the record holds ## Ended with today's day and Progress offers no End sprint
// input: the Product Owner opens Progress
// expect: known positive — the record holds the end and no End sprint is offered; UC-032 6b says the click records the end with the sprint, which is then closed with its review: Progress says the sprint ended on that day and that its review and retrospective are not recorded yet, and offers no Change the selection.
test("TST-803019: UC-032 6b a sprint the Product Owner ended is shown as ended, waiting for its review and retrospective", async () => {
  const page = await open("progress", {}, { files: await product() });
  try {
    await page.press(found(page.target, "[data-end-sprint]")[0]);
    assert.match(page.srv.files[sprintPath("team1", 2)], /\n## Ended\n\nat: \d{4}-\d{2}-\d{2}\n/, "known positive: the end is recorded");
    const again = await open("progress", {}, { files: page.srv.files });
    try {
      assert.equal(found(again.target, "[data-end-sprint]").length, 0, "known positive: no End sprint is offered");
      const team1 = plain(part(again.html(), 'data-team="team1"'));
      assert.match(team1, /It ended on \d{4}-\d{2}-\d{2}; its review and retrospective are not recorded yet\./);
      assert.doesNotMatch(team1, /Change the selection/);
    } finally { again.done(); }
  } finally { page.done(); }
});

// TST-803020 · level: system · module: MOD-implementation-pages
// guards: UC-032; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the product of TST-803018 in which both items team1/02 selected are merged, ITM-002's pull request among them; known positive first — MOD-work-plans' sprintsToClose names the sprint as due because every selected item is done
// input: the Product Owner opens Progress
// expect: known positive — sprintsToClose lists team1/02 for its closer alice, because every selected item is done; UC-032 6b says a sprint without a time box ends when every selected item is done: Progress says the sprint ended and that its review and retrospective are not recorded yet, and offers no End sprint.
test("TST-803020: UC-032 6b a sprint without a time box has ended when every selected item is done", async () => {
  const { sprints } = documentsOf(await product());
  assert.deepEqual(sprintsToClose(sprints, [{ item: "ITM-001", state: "done" }, { item: "ITM-002", state: "done" }], "2026-10-30"), [{ sprint: "team1/02", closer: "alice", because: "every selected item done" }], "known positive");
  const page = await open("progress", {}, { files: await product(), pulls: { list: [...PULL_REQUESTS.slice(0, 1), pr(2, "ITM-002", "merged", "2026-10-21T12:00:00Z", "2026-10-30T09:00:00Z")] } });
  try {
    assert.match(plain(part(page.html(), 'data-team="team1"')), /its review and retrospective are not recorded yet/, "the sprint has ended");
    assert.equal(found(page.target, "[data-end-sprint]").length, 0, "and End sprint is not offered");
  } finally { page.done(); }
});

// ---------------------------------------------------------------- step 7: Kanban, the work-in-progress limit

const columnOf = (page, name) => part(page.html(), `data-column="${name}"`);
const pullOf = (page, id) => found(page.target, `[data-pull="${id}"]`)[0] ?? null;
const reasonsOf = (page, id) => plain(row(part(page.html(), 'data-column="Backlog"'), id) || (part(page.html(), 'data-column="Backlog"').split(`data-item="${id}"`)[1] ?? "").split("</li>")[0]);
const kanban = () => product({ model: MODELS.kanban, files: { "docs/role-assignments/team2.md": null, [sprintPath("team1", 2)]: null } });

// TST-803021 · level: system · module: MOD-implementation-pages
// guards: UC-032; NO JOB STARTS ABOVE THE WORK-IN-PROGRESS LIMIT; EVERY STEP EXPLAINS ITSELF
// given: a Kanban product — no sprints, the work-in-progress limit 2 — with the participant dev-a holding the implementing role; ITM-001 and ITM-003 are ready, and ITM-005 and ITM-007 are ready too
// input: the Product Owner opens the board with no pull request open; with the pull request of ITM-001 open; with the pull requests of ITM-001 and ITM-003 open; and with ITM-001's merged
// expect: the board shows the columns Backlog, Doing, Review and Done; with none open, 0 of 2 are in progress and every ready item has Pull as a link to the route implement with it selected; with one open, ITM-001 stands in Review, 1 of 2 are in progress, ITM-001 waits for review, and Pull is still a link; with two open (7a), 2 of 2 are in progress, the panel names ITM-001 and ITM-003 and says both wait for review, and Pull is disabled for every ready item, each giving the limit 2 reached and naming the two items in progress and waiting for review; with ITM-001 merged again, one is in progress, ITM-001 stands in Done, and Pull is a link again
test("TST-803021: UC-032 7 and 7a a ready item is pulled only below the work-in-progress limit; at the limit Pull is disabled and the panel names the items in progress and those waiting for review", async () => {
  const files = await kanban();
  const draw = async (pulls) => open("board", {}, { files, pulls: { list: pulls } });
  const open1 = pr(1, "ITM-001", "open", "2026-10-21T12:00:00Z"), open3 = pr(3, "ITM-003", "open", "2026-10-22T12:00:00Z");
  const none = await draw([]);
  try {
    assert.deepEqual(["Backlog", "Doing", "Review", "Done"].map((name) => found(none.target, `[data-column="${name}"]`).length), [1, 1, 1, 1], "the columns of the model");
    assert.match(plain(none.html()), /0 of 2 items in progress/);
    for (const id of ["ITM-001", "ITM-003", "ITM-005", "ITM-007"]) assert.equal(pullOf(none, id).localName, "a", `${id}: Pull is a link`);
    assert.equal(pullOf(none, "ITM-003").getAttribute("href"), "#implement/item=ITM-003", "to the route implement, the item selected");
  } finally { none.done(); }
  const one = await draw([open1]);
  try {
    assert.match(plain(columnOf(one, "Review")), /ITM-001/, "an item with a pull request open stands in Review");
    assert.match(plain(one.html()), /1 of 2 items in progress: ITM-001\. Waiting for review: ITM-001\./);
    assert.equal(pullOf(one, "ITM-003").localName, "a", "below the limit Pull is a link");
  } finally { one.done(); }
  const two = await draw([open1, open3]);
  try {
    assert.match(plain(two.html()), /2 of 2 items in progress: ITM-001, ITM-003\. Waiting for review: ITM-001, ITM-003\. No further item is pulled/);
    for (const id of ["ITM-005", "ITM-007"]) {
      assert.equal(pullOf(two, id).localName, "button", `${id}: Pull is a button`);
      assert.equal(disabledOf(pullOf(two, id)), true, `${id}: and disabled`);
      assert.match(reasonsOf(two, id), /work-in-progress limit of 2 is reached under team1: ITM-001 and ITM-003 are in progress, ITM-001 and ITM-003 waiting for review/);
    }
  } finally { two.done(); }
  const merged = await draw([pr(1, "ITM-001", "merged", "2026-10-21T12:00:00Z", "2026-10-30T09:00:00Z"), open3]);
  try {
    assert.match(plain(columnOf(merged, "Done")), /ITM-001/);
    assert.match(plain(merged.html()), /1 of 2 items in progress: ITM-003/);
    assert.equal(pullOf(merged, "ITM-005").localName, "a", "counter-proof: below the limit again, Pull is a link");
  } finally { merged.done(); }
});

// TST-803022 · level: system · module: MOD-implementation-pages
// guards: UC-032; NO JOB STARTS ABOVE THE WORK-IN-PROGRESS LIMIT; A TIME BOX WORKS ONLY ON WHAT WAS SELECTED FOR IT
// given: the product of TST-803011 with the limit 2, in which team1's sprint team1/02 holds ITM-001, ITM-002 and — as a second product — also ITM-003 and ITM-005; ITM-002's pull request is open
// input: the Product Owner opens the board of each product, and of the second product once more with ITM-003's pull request open
// expect: in the first product ITM-003, ready but in no sprint, has Pull disabled and the reason says it is not selected for team1/02; in the second 1 of 2 are in progress under team1 and both selected ready items have Pull as a link; with ITM-003's pull request open as well, 2 of 2 are in progress under team1 and ITM-005, selected, has Pull disabled for the limit: in a model with sprints and a limit, both hold
test("TST-803022: UC-032 7 in a model with sprints and a work-in-progress limit only selected items are pulled, and only below the limit", async () => {
  const first = await open("board", {}, { files: await product() });
  try {
    assert.equal(disabledOf(pullOf(first, "ITM-003")), true);
    assert.match(reasonsOf(first, "ITM-003"), /ITM-003 is not selected for team1\/02, the current sprint of team1/);
  } finally { first.done(); }
  const selected = sprintText({ n: 2, goal: "Store and show", selection: ["ITM-001", "ITM-002", "ITM-003", "ITM-005"], branch: "sprint/team1/02" });
  const files = await product({ files: { [sprintPath("team1", 2)]: selected } });
  const second = await open("board", {}, { files });
  try {
    assert.match(plain(second.html()), /1 of 2 items in progress under team1: ITM-002/);
    for (const id of ["ITM-003", "ITM-005"]) assert.equal(pullOf(second, id).localName, "a", `${id}: selected and below the limit, Pull is a link`);
  } finally { second.done(); }
  const full = await open("board", {}, { files, pulls: { list: [...PULL_REQUESTS, pr(3, "ITM-003", "open", "2026-10-22T12:00:00Z")] } });
  try {
    assert.match(plain(full.html()), /2 of 2 items in progress under team1: ITM-002, ITM-003/);
    assert.equal(disabledOf(pullOf(full, "ITM-005")), true);
    assert.match(reasonsOf(full, "ITM-005"), /work-in-progress limit of 2 is reached under team1/);
  } finally { full.done(); }
});

// ---------------------------------------------------------------- 1a, 1b and 1c

// TST-803023 · level: system · module: MOD-implementation-pages
// guards: UC-032; A BACKLOG ITEM NAMES WHAT IT REALISES; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; ONE CLICK PER DECISION
// given: the product of TST-803002 whose SPEC no longer holds RULE ONE but holds RULE ONE TOO; ITM-001, merged, realises RULE ONE; a control product whose SPEC still holds RULE ONE
// input: the Product Owner opens Backlog, presses Point at beside ITM-001 with no replacing requirement, types RULE ONE TOO and presses it, and presses Remove beside ITM-001 in a second reading of the original
// expect: ITM-001 is marked "RULE ONE is not accepted" and offers Point at and Remove; nothing is written by opening the page or by Point at with an empty field; with RULE ONE TOO typed Point at is one commit of ITM-001's file alone, which now realises RULE ONE TOO; Remove is one commit that deletes ITM-001's file; the control product marks nothing
test("TST-803023: UC-032 1a an item whose requirement is withdrawn is marked, and nothing changes until the Product Owner points it at the replacing requirement or removes it", async () => {
  const renamed = () => product({ files: { "SPEC.md": specOf("RULE ONE TOO", "RULE TWO", "RULE THREE", "RULE FOUR") } });
  const control = await open("backlog", {}, { files: await product() });
  try { assert.equal(found(control.target, '[data-point-at="ITM-001"]').length, 0, "counter-proof: while RULE ONE stands nothing is marked"); } finally { control.done(); }
  const page = await open("backlog", {}, { files: await renamed() });
  try {
    assert.match(cell(row(backlogOf(page), "ITM-001"), "State"), /RULE ONE is not accepted/);
    assert.equal(found(page.target, '[data-point-at="ITM-001"]').length + found(page.target, '[data-remove-item="ITM-001"]').length, 2, "Point at and Remove are offered");
    assert.equal(page.srv.writes.length, 0, "nothing changes until the Product Owner decides");
    await page.press(found(page.target, '[data-point-at="ITM-001"]')[0]);
    assert.equal(page.srv.writes.length, 0, "Point at with no replacing requirement writes nothing");
    found(page.target, '[data-point-to="ITM-001"]')[0].value = "RULE ONE TOO";
    await page.script(found(page.target, '[data-point-at="ITM-001"]')[0]);
    assert.equal(page.srv.writes.length, 0, "a script's click writes nothing");
    await page.press(found(page.target, '[data-point-at="ITM-001"]')[0]);
    assert.equal(page.srv.writes.length, 1, "one click, one commit");
    assert.deepEqual(Object.keys(page.srv.writes[0].files), [itemPath(1)]);
    assert.deepEqual(listOf(page.srv.writes[0].files[itemPath(1)], "realises"), ["RULE ONE TOO"]);
  } finally { page.done(); }
  const removing = await open("backlog", {}, { files: await renamed() });
  try {
    await removing.press(found(removing.target, '[data-remove-item="ITM-001"]')[0]);
    assert.equal(removing.srv.writes.length, 1, "one click, one commit");
    assert.deepEqual(Object.entries(removing.srv.writes[0].files), [[itemPath(1), undefined]], "ITM-001's file alone, as a tree entry with no content: a deletion");
  } finally { removing.done(); }
});

// TST-803024 · level: system · module: MOD-implementation-pages
// guards: UC-032
// given: a product whose model plans its work in advance; known positive first — the page says that there is no backlog
// input: the Product Owner opens Backlog
// expect: known positive — the page says that the model plans its work in advance and that there is no backlog (UC-032 1b); UC-032 1b says there is no backlog and Agent M links to the implementation plan: the page draws no table of backlog items and links the route plan.
test("TST-803024: UC-032 1b where the model works from a plan there is no backlog, and the page links to the implementation plan", async () => {
  const planned = readFileSync(new URL("./fixtures/process-models/planned.md", import.meta.url), "utf8");
  const page = await open("backlog", {}, { files: await product({ model: planned }) });
  try {
    assert.match(plain(page.html()), /plans its work in advance: there is no backlog \(UC-032 1b\)/, "known positive");
    assert.equal(found(page.target, "[data-part=\"backlog\"]").length, 0, "no table of backlog items is drawn");
    assert.ok(walk(page.target, (node) => node.localName === "a").some((link) => link.getAttribute("href") === "#plan"), "the page links the implementation plan");
  } finally { page.done(); }
});

// TST-803025 · level: system · module: MOD-work-plans
// guards: UC-032; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; ONE CLICK PER DECISION; AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT
// given: the product of TST-803011, held in memory, and an agent as Product Owner — participant po-agent, model model-x — that does steps 1 to 6 through its own runtime instead of the dashboard
// input: the agent reads the backlog (itemStates) and what the other teams' sprints hold (heldItems, conflicts) for the item it plans, adds an item (saveItems), starts team2's sprint with ITM-003 (startSprint) and ends it (endSprint), each with its provenance lines as trailers
// expect: reading writes nothing; ITM-003 is ready and ITM-005 is kept from team2 by team1/02, ITM-002 and MOD-store, so the agent selects ITM-003; the three decisions are three commits on the default branch, each at the head the agent read, each message ending with the agent's trailers Agent-M-Participant: po-agent and Agent-M-Model: model-x; the item is ITM-011; the sprint is docs/backlog/sprints/team2/01.md with its branch created; ending it appends ## Ended with the day of the call
test("TST-803025: UC-032 1c an agent as Product Owner reads, writes items, plans, starts and ends a sprint through its own runtime, each commit under its name", async () => {
  const mem = memoryHost(await product());
  const trailers = ["Agent-M-Participant: po-agent", "Agent-M-Model: model-x"];
  const read = () => {
    const { sprints, items, architecture } = documentsOf(mem.files);
    const statuses = new Map(["RULE ONE", "RULE TWO", "RULE THREE", "RULE FOUR"].map((name) => [name, { id: name, kind: "requirement", status: "accepted" }]));
    const pulls = PULL_REQUESTS.map(({ number, title, branch, base, state, opened, merged }) => ({ number, title, branch, base, state, opened, merged, head: String(number).repeat(40) }));
    return { sprints, items, architecture, states: itemStates(items, null, { statuses, queues: [], jobs: [], pullRequests: pulls, gates: [], workflow: null }), held: heldItems(sprints, items, architecture, pulls) };
  };
  const seen = read();
  assert.equal(mem.commits.length, 0, "reading writes nothing");
  assert.equal(seen.states.find((state) => state.item === "ITM-003").state, "ready");
  const kept = conflicts(seen.items.find((one) => one.id === "ITM-005"), "team2", seen.held, seen.architecture);
  assert.deepEqual(kept, [{ sprint: "team1/02", team: "team1", item: "ITM-002", module: "MOD-store" }], "ITM-005 is kept from team2");
  assert.deepEqual(conflicts(seen.items.find((one) => one.id === "ITM-003"), "team2", seen.held, seen.architecture), [], "and ITM-003 is not");

  const added = await saveItems(mem.host, { items: [{ fields: { title: "Count the loans", level: "module", realises: ["RULE TWO"], modules: ["MOD-news"], tests: ["unit"], origin: ["po-agent"] },
    sections: [{ heading: "## Outcome", text: "The loans are counted." }, { heading: "## Acceptance", text: "- a unit test." }] }], removed: [] }, { architecture: seen.architecture, head: mem.head, trailers });
  assert.deepEqual(added.written, ["docs/backlog/ITM-011-count-the-loans.md"]);
  const declaration = { sections: [{ heading: "## Branches", rows: [{ cells: { "Phase or time box": "Sprint", Branch: "`sprint/<team>/<nn>`" } }] }] };
  const again = read();
  const started = await startSprint(mem.host, { team: "team2", goal: "Mail", start: "2026-10-30", closer: "po-agent", selection: ["ITM-003"] }, { states: again.states, model: { flow: { timeBox: null } },
    declaration, held: again.held, architecture: again.architecture, running: null, head: mem.head, trailers });
  assert.equal(started.path, "docs/backlog/sprints/team2/01.md");
  assert.deepEqual(mem.branches.map((made) => made.branch), ["sprint/team2/01"], "the sprint's own branch is created");
  await endSprint(mem.host, "team2/01", { head: mem.head, now: new Date("2026-11-05T10:00:00Z"), trailers });
  assert.equal(mem.commits.length, 3, "three decisions, three commits");
  for (const commit of mem.commits) {
    assert.equal(commit.branch, "main", "on the default branch");
    assert.deepEqual(commit.message.split("\n").slice(-2), trailers, "under the agent's name");
  }
  assert.deepEqual(mem.commits.map((commit) => commit.files.map((file) => file.path)), [["docs/backlog/ITM-011-count-the-loans.md"], ["docs/backlog/sprints/team2/01.md"], ["docs/backlog/sprints/team2/01.md"]]);
  assert.match(mem.files["docs/backlog/sprints/team2/01.md"], /\n## Ended\n\nat: 2026-11-05\n/);
});

// ---------------------------------------------------------------- every step explains itself

const panelsWithoutFold = (html) => html.split('<section class="panel"').slice(1).filter((panel) => !/<details class="explain"><summary>What is this\?<\/summary>/.test(panel));

// TST-803026 · level: system · module: MOD-implementation-pages
// guards: UC-032; EVERY STEP EXPLAINS ITSELF
// given: the product of TST-803011; known negative first — a panel without its fold is found by the same reading
// input: the Product Owner opens Backlog with Plan sprint open for team2, Progress, and the board of a Kanban product
// expect: known negative — a panel written without the fold is found; every panel of Backlog and of Progress, and the head of the board, carries a folded "What is this?"; together the folds say what a backlog is for, why an item comes after the items it builds on, what a sprint, a work-in-progress limit and a held item are, and point to book ch. 7
test("TST-803026: UC-032 every step carries a folded What is this? about the backlog, the order, a sprint, a work-in-progress limit and a held item, with a pointer to book ch. 7", async () => {
  assert.equal(panelsWithoutFold('<section class="panel" data-x><h3>No fold</h3></section>').length, 1, "known negative: a panel without its fold is found");
  const backlog = await open("backlog", {}, { files: await product() });
  const folds = [];
  const foldsOf = (html) => [...html.matchAll(/<details class="explain"><summary>What is this\?<\/summary><div>([\s\S]*?)<\/div><\/details>/g)].map((m) => plain(m[1]));
  try {
    await planOf(backlog, "team2");
    assert.deepEqual(panelsWithoutFold(backlog.html()).map((panel) => panel.slice(0, 60)), [], "every panel of Backlog has its fold");
    folds.push(...foldsOf(backlog.html()));
  } finally { backlog.done(); }
  const progress = await open("progress", {}, { files: await product() });
  try {
    assert.deepEqual(panelsWithoutFold(progress.html()).map((panel) => panel.slice(0, 60)), [], "every panel of Progress has its fold");
    folds.push(...foldsOf(progress.html()));
  } finally { progress.done(); }
  const board = await open("board", {}, { files: await kanban() });
  try {
    assert.match(board.html(), /^\s*<section class="head"><h2>Board<\/h2><details class="explain"><summary>What is this\?<\/summary>/, "the board, one step, carries its fold at its head");
    folds.push(...foldsOf(board.html()));
  } finally { board.done(); }
  const said = folds.join(" ");
  for (const needle of [/The backlog is everything the product is meant to do/, /each item is listed after the items it builds on/, /A team plans, starts and closes sprints of its own/, /work-in-progress limit/, /A sprint holds the items it selected/, /book ch\. 7/]) {
    assert.match(said, needle);
  }
});

// TST-803027 · level: system · module: MOD-implementation-pages
// guards: UC-032; EVERY TEAM RUNS SPRINTS OF ITS OWN
// given: the product of TST-803011 — team1's sprint runs, team2 has none
// input: the Product Owner opens Progress, follows Plan sprint of team2 and Change the selection of team1; the Backlog is opened with the parameter plan naming the team
// expect: Progress offers Plan sprint to team2 and Change the selection to team1, each a link to the backlog with plan=<team>; the backlog opened with plan=team2 opens team2's planning and not team1's; with plan=team1 team1's
test("TST-803027: UC-032 6 Plan sprint stands beside the team's sprint on its progress and leads to the team's planning on the backlog", async () => {
  const progress = await open("progress", {}, { files: await product() });
  try {
    const links = Object.fromEntries(walk(progress.target, (node) => node.localName === "a").filter((link) => /^#backlog\/plan=/.test(link.getAttribute("href") ?? "")).map((link) => [link.getAttribute("href"), textOf(link)]));
    assert.deepEqual(links, { "#backlog/plan=team1": "Change the selection", "#backlog/plan=team2": "Plan sprint" });
  } finally { progress.done(); }
  for (const team of ["team1", "team2"]) {
    const backlog = await open("backlog", { plan: team }, { files: await product() });
    try {
      assert.deepEqual(found(backlog.target, "[data-plan-team]").map((panel) => panel.getAttribute("data-plan-team")), [team]);
    } finally { backlog.done(); }
  }
});
