// Release tests of UC-033 "Move an issue into the backlog", on the issue's page: each requirement UC-033 realises, checked from what the Product Owner reads on the page and from the requests the fixture server received — the backlog in
// the product repository, what an item realises and the modules it changes as the page prefills them, nothing implemented before it is accepted, evolution through the specification, the origin of the item, the reference by identifier, the
// person's own input committed directly, and one click per decision. TST-804301 maps every requirement UC-033 realises to a release test that guards it.
// Run: node --test tests/release-uc-033-move-an-issue-into-the-backlog.test.mjs
//
// Module: MOD-maintenance-pages
// Module: MOD-issue-handling
// Module: MOD-work-plans
// Guards: UC-033
// Level: release
//
// Written for the release testing of sprint 141 by developer-sonnet-j (ITM-804), who implemented none of ITM-582, ITM-583, ITM-584, ITM-617, ITM-1250 and ITM-1256 and no UC-033 production behaviour but ITM-817, MOD-work-plans'
// `backlogFindings`, and by developer-sonnet-l, who implemented none of it. RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER: developer-sonnet-j therefore wrote no case that exercises `backlogFindings` — the report of an item that names no
// module or a module the architecture does not describe (A BACKLOG ITEM NAMES THE MODULES IT CHANGES), the report of a circle of items that build on one another, and `saveItems`' refusal to write an item with an error finding, from UC-033
// step 3 — and developer-sonnet-l wrote TST-804311 to TST-804313, which do. The world is tests/uc-033-harness.mjs. The release team works from the specification and the page: each case ends at what a person reads on the page and at the request a fixture received. Readings the texts leave open,
// which the cases state:
//   - A BACKLOG ITEM NAMES THE MODULES IT CHANGES, read for what this file tests (UC-033 step 2, "modules: the modules of the architecture the fix or the change will touch, as UC-012's analysis and the architecture name them; the Product
//     Owner confirms or corrects them"): the modules of the architecture whose folder holds a file the analysis names as wrong are prefilled, and what the person types is what is written.
//   - NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED names no automatic check on the page. It is read through MOD-work-plans' itemStates and startable over the item the page wrote, given the names the product has accepted.
//   - A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION: the comment and the page name the item by the identifier its file holds, and never by a position among the items.
//   - A PERSON'S OWN INPUT IS COMMITTED DIRECTLY: Add is read as one commit on the default branch, authorised by the token stored for the product, with no branch and no pull request.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { moveToBacklog } from "../src/issue-handling/index.mjs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { backlogFindings } from "../src/work-plans/index.mjs";
import { ADDRESS, EXISTING, PRODUCT_URL, addOf, analysed, buttonsOf, byClass, decided, errorsOf, fieldOf, flush, issueNow, issuesOf, itemFiles, itemOfFile, itemPath, itemText, moveOf, moved, one, openIssue, pressAdd,
  queueOf, recordWrites, restoreWorld, startWorld, stateOf, textOf, trusted, typed, waitFor, writeLog, writtenFiles } from "./uc-033-harness.mjs";
import { PRODUCT_TOKEN } from "./uc-012-harness.mjs";

// The map reads files only and draws no page, so that there is no world to put back after it.
afterEach(() => { if (globalThis.document) restoreWorld(); });

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const UC = "docs/use-cases/UC-033-move-an-issue-into-the-backlog.md";
const SELF = "tests/release-uc-033-move-an-issue-into-the-backlog.test.mjs";

// ---------------------------------------------------------------- the map

// Each requirement UC-033 realises, with the release tests of this file that guard it. A BACKLOG ITEM NAMES THE MODULES IT CHANGES holds the cases that exercise backlogFindings besides TST-804304 (see the header).
const EVIDENCE = {
  "THE BACKLOG LIVES IN THE PRODUCT REPOSITORY": [[SELF, "TST-804302"]],
  "A BACKLOG ITEM NAMES WHAT IT REALISES": [[SELF, "TST-804303"]],
  "A BACKLOG ITEM NAMES THE MODULES IT CHANGES": [[SELF, "TST-804304"], [SELF, "TST-804311"], [SELF, "TST-804312"], [SELF, "TST-804313"]],
  "NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED": [[SELF, "TST-804305"]],
  "EVOLUTION ENTERS THROUGH THE SPECIFICATION": [[SELF, "TST-804306"]],
  "EVERY ARTIFACT NAMES ITS ORIGIN": [[SELF, "TST-804307"]],
  "A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION": [[SELF, "TST-804308"]],
  "A PERSON'S OWN INPUT IS COMMITTED DIRECTLY": [[SELF, "TST-804309"]],
  "ONE CLICK PER DECISION": [[SELF, "TST-804310"]],
};

// TST-804301 · level: release · module: system
// guards: UC-033
// given: UC-033 as committed text, whose `realises` lists nine requirements, and the release tests named in EVIDENCE
// input: read UC-033's list of the requirements it realises, and the declarations of the test files named for each
// expect: known positive — UC-033 realises these nine requirements; each has at least one test named; each test named stands in its file with the level release and guards that requirement
test("TST-804301: UC-033 every requirement it realises has a release test that guards it", () => {
  const front = /^realises:\n((?:  - .*\n)+)/m.exec(read(UC))?.[1] ?? "";
  const realised = front.split("\n").filter(Boolean).map((line) => line.replace(/^ {2}- /, ""));
  assert.equal(realised.length, 9, "known positive: UC-033 realises nine requirements");
  assert.deepEqual([...realised].sort(), Object.keys(EVIDENCE).sort(), "the map holds exactly the requirements UC-033 realises");
  for (const [requirement, tests] of Object.entries(EVIDENCE)) {
    assert.ok(tests.length > 0, `${requirement}: a test is named`);
    for (const [file, id] of tests) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${requirement}: ${file} exists`);
      const declared = testDeclarations(file, read(file)).find((each) => each.id === id);
      assert.ok(declared, `${requirement}: ${id} is declared in ${file}`);
      assert.equal(declared.level, "release", `${id} is a release test`);
      assert.ok((declared.guards ?? []).includes(requirement), `${id} guards ${requirement}`);
    }
  }
});

// ---------------------------------------------------------------- the fixtures of the cases

const AS_BUG = { class: "bug", reasoning: "FIRST RULE holds, and the code breaks it: the export drops pages.", wrong: ["src/store/read.mjs"] };
const LINK = (path) => `${PRODUCT_URL}/blob/main/${path}`;
const NOTE = (id, path) => `Backlog item \`${id}\` added: ${LINK(path)}`;
const idOf = (entry) => /^docs\/backlog\/(ITM-\d{3,})-/.exec(entry.path)[1];
const treePaths = (write) => JSON.parse(write.body).tree.map((entry) => entry.path);
const rule = (name, text, check) => ({ name, text, check });
const FIRST = rule("FIRST RULE", "The first rule holds.", "`tests/unit.test.mjs`");
const FIRST_CHANGED = rule("FIRST RULE", "The first rule holds on every page.", "`tests/unit.test.mjs`");
const SECOND = rule("SECOND RULE", "The second rule holds.", "no automatic check; at review.");
const SECOND_CHANGED = rule("SECOND RULE", "The second rule holds for every export.", "no automatic check; at review.");
const THIRD = rule("THIRD RULE", "The third rule holds.", "no automatic check; at review.");
/** The queues of the product: issue 7's changes FIRST RULE and adds THIRD RULE; issue 6's, which no item of issue 7 may name, changes SECOND RULE. */
const QUEUES = { ...queueOf("2026-10-20a_export", 7, [FIRST_CHANGED, SECOND, THIRD]), ...queueOf("2026-10-20c_other-issue", 6, [FIRST, SECOND_CHANGED]) };

/** The issue `number` opened, Move to backlog pressed, and the form returned with realises and modules typed as given (left alone where null). */
async function filled(w, number, realises = null, modules = null) {
  const detail = await openIssue(w, number);
  const form = await moved(detail);
  if (realises !== null) await typed(fieldOf(form, "realises"), realises);
  if (modules !== null) await typed(fieldOf(form, "modules"), modules);
  return { detail, form };
}

// ---------------------------------------------------------------- the backlog lives in the product repository

// TST-804302 · level: release · module: system
// guards: THE BACKLOG LIVES IN THE PRODUCT REPOSITORY; UC-033
// given: the product's backlog holds ITM-0900 and ITM-800; a file of the item schema stands elsewhere, docs/other/ITM-950-elsewhere.md, and one in the plan, docs/plan/ITM-960-step.md; the open issue 6, a bug; known positive first — ITM-0900 and ITM-800 are offered for the issue to be added to
// input: the Product Owner presses Move to backlog on issue 6, names FIRST RULE and MOD-store, and presses Add
// expect: the items offered for the issue to be added to are ITM-0900 and ITM-800 alone — neither the file elsewhere nor the plan step is an item of the backlog; Move to backlog writes nothing; Add writes one file of the product's repository, docs/backlog/ITM-<nnn>-export-drops-the-last-page.md, and no other, its identifier none of 900, 950 and 960
test("TST-804302: UC-033 the item is written under docs/backlog/ of the product's repository, and only the files there are its backlog", async () => {
  const strays = { "docs/other/ITM-950-elsewhere.md": itemText({ id: "ITM-950", title: "Elsewhere" }), "docs/plan/ITM-960-step.md": itemText({ id: "ITM-960", title: "Step" }) };
  const w = startWorld({ product: strays });
  const detail = await openIssue(w, 6);
  const before = writtenFiles(w).length;
  const form = await moved(detail);
  assert.equal(writtenFiles(w).length, before, "Move to backlog writes nothing");
  await waitFor(() => byClass(moveOf(detail), "existing-item").length > 0);
  const offered = [...new Set(byClass(moveOf(detail), "existing-item").map((node) => node.getAttribute("data-item")))];
  assert.deepEqual(offered.sort(), ["ITM-0900", EXISTING.id].sort(), "known positive: the two items of the backlog are offered, the files elsewhere are not");
  await typed(fieldOf(form, "realises"), "FIRST RULE");
  await typed(fieldOf(form, "modules"), "MOD-store");
  const recorder = recordWrites();
  try { await pressAdd(detail, form); } finally { recorder.stop(); }
  const trees = recorder.writes.filter((write) => write.path === "/git/trees");
  assert.equal(trees.length, 1);
  assert.equal(treePaths(trees[0]).length, 1);
  const [path] = treePaths(trees[0]);
  assert.match(path, /^docs\/backlog\/ITM-\d{3,}-export-drops-the-last-page\.md$/);
  assert.ok(!["ITM-0900", "ITM-800", "ITM-950", "ITM-960"].includes(idOf({ path })), `${idOf({ path })} is a new identifier`);
  assert.deepEqual(itemFiles(w).map((entry) => entry.path), [path]);
});

// ---------------------------------------------------------------- what an item realises

// TST-804303 · level: release · module: system
// guards: A BACKLOG ITEM NAMES WHAT IT REALISES; UC-033
// given: the open issue 6, a bug; the open issue 7, a change, whose queue changes FIRST RULE and adds THIRD RULE and repeats SECOND RULE unchanged, and issue 6's queue, which changes SECOND RULE; the SPEC holds FIRST RULE and SECOND RULE
// input: the Product Owner presses Move to backlog on issue 6, on which no analysis was run, and on issue 7
// expect: for the bug the item realises nothing yet and Add is disabled; once FIRST RULE is named, Add is enabled and the item written realises FIRST RULE; for the change the item is prefilled with realises FIRST RULE, THIRD RULE in the order of the entry — the requirements its queue changes or adds — and not SECOND RULE, which issue 7's queue repeats unchanged and issue 6's queue changes, and the item written realises exactly those two
test("TST-804303: UC-033 an item realises what the Product Owner names for a bug and the requirements the issue's queue changes for a change, and no item realises nothing", async () => {
  const w = startWorld({ product: QUEUES });
  const bug = await openIssue(w, 6);
  const bugForm = await moved(bug);
  assert.equal(fieldOf(bugForm, "realises").value, "");
  assert.equal(addOf(bugForm).disabled, true, "an item that realises nothing is not offered for Add");
  await typed(fieldOf(bugForm, "modules"), "MOD-store");
  assert.equal(addOf(bugForm).disabled, true, "naming the module does not make it complete");
  await typed(fieldOf(bugForm, "realises"), "FIRST RULE");
  assert.equal(addOf(bugForm).disabled, false, errorsOf(bugForm));
  await pressAdd(bug, bugForm);
  assert.deepEqual(itemOfFile(itemFiles(w)[0]).fields.realises, ["FIRST RULE"]);

  const change = await openIssue(w, 7);
  const changeForm = await moved(change);
  assert.equal(fieldOf(changeForm, "realises").value, "FIRST RULE, THIRD RULE");
  await typed(fieldOf(changeForm, "modules"), "MOD-store");
  assert.equal(addOf(changeForm).disabled, false, errorsOf(changeForm));
  await pressAdd(change, changeForm);
  assert.deepEqual(itemOfFile(itemFiles(w)[1]).fields.realises, ["FIRST RULE", "THIRD RULE"]);
});

// ---------------------------------------------------------------- the modules an item changes

// TST-804304 · level: release · module: system
// guards: A BACKLOG ITEM NAMES THE MODULES IT CHANGES; UC-033
// given: the architecture describes MOD-store (src/store/), MOD-pages (src/pages/) and MOD-mail (src/mail/); the open issue 6, a bug; the analysis names as wrong src/pages/view.mjs, src/mail/send.mjs, src/storefront/cart.mjs and src/other/x.mjs
// input: the Product Owner has local-llm analyse issue 6, confirms the bug, presses Move to backlog, reads the modules, corrects them to MOD-pages and presses Add; and on issue 9, never analysed, presses Move to backlog
// expect: the modules prefilled are the modules of the architecture whose folder holds a file the analysis names — MOD-mail, MOD-pages —, not MOD-store for src/storefront/cart.mjs, which does not lie in src/store/, and none for src/other/, whose folder no module has; the item written names exactly the modules the person corrected them to, MOD-pages; for issue 9, which has no analysis, the page prefills no module
test("TST-804304: UC-033 the item is prefilled with the modules whose folders hold the files the analysis names, and the person's correction is what is written", async () => {
  const wrong = ["src/pages/view.mjs", "src/mail/send.mjs", "src/storefront/cart.mjs", "src/other/x.mjs"];
  const w = startWorld({ analysis: { ...AS_BUG, wrong } });
  const detail = await analysed(await openIssue(w, 6));
  await decided(detail, "bug");
  await waitFor(() => moveOf(detail) !== undefined && buttonsOf(moveOf(detail), "Move to backlog").length === 1);
  const form = await moved(detail);
  assert.equal(fieldOf(form, "modules").value, "MOD-mail, MOD-pages");
  await typed(fieldOf(form, "modules"), "MOD-pages");
  await typed(fieldOf(form, "realises"), "FIRST RULE");
  assert.equal(addOf(form).disabled, false, errorsOf(form));
  await pressAdd(detail, form);
  assert.deepEqual(itemOfFile(itemFiles(w)[0]).fields.modules, ["MOD-pages"]);

  const unanalysed = await openIssue(w, 9);
  const second = await moved(unanalysed);
  assert.equal(fieldOf(second, "modules").value, "", "no analysis, no module guessed");
});

// ---------------------------------------------------------------- nothing is implemented before it is accepted

// TST-804305 · level: release · module: system
// guards: NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED; UC-033
// given: the product has accepted FIRST RULE and SECOND RULE; the open issues 6 (a bug) and 7 (a change whose queue adds THIRD RULE and changes FIRST RULE), each moved into the backlog by the Product Owner with MOD-store
// input: the items the two Adds wrote are given to MOD-work-plans' itemStates and startable with the names the product has accepted, then with THIRD RULE accepted too
// expect: the bug's item, which realises FIRST RULE, is ready and nothing keeps its start for want of acceptance; the change's item is waiting for acceptance, the reason names THIRD RULE, and a job for it cannot start, the refusal naming THIRD RULE; once THIRD RULE is accepted the same item, unchanged, is ready and its refusal for want of acceptance is gone
test("TST-804305: UC-033 no job can start for a change's item before the requirements it names are accepted, and it is ready by itself after", async () => {
  const w = startWorld({ product: QUEUES });
  const bug = await filled(w, 6, "FIRST RULE", "MOD-store");
  await pressAdd(bug.detail, bug.form);
  const change = await filled(w, 7, null, "MOD-store");
  await pressAdd(change.detail, change.form);
  const [bugItem, changeItem] = itemFiles(w).map(itemOfFile);
  assert.deepEqual(bugItem.fields.realises, ["FIRST RULE"]);
  assert.deepEqual(changeItem.fields.realises, ["FIRST RULE", "THIRD RULE"]);

  const accepted = ["FIRST RULE", "SECOND RULE"];
  const bugState = stateOf(bugItem, accepted);
  assert.equal(bugState.state, "ready");
  assert.ok(!(bugState.verdict.reasons ?? []).some((reason) => /not accepted/.test(reason)));
  const waiting = stateOf(changeItem, accepted);
  assert.equal(waiting.state, "waiting for acceptance");
  assert.match(waiting.reason, /THIRD RULE/);
  assert.equal(waiting.verdict.startable, false);
  assert.match(waiting.verdict.reasons.join("\n"), /THIRD RULE.*not accepted/);
  const ready = stateOf(changeItem, [...accepted, "THIRD RULE"]);
  assert.equal(ready.state, "ready");
  assert.ok(!(ready.verdict.reasons ?? []).some((reason) => /not accepted/.test(reason)));
});

// ---------------------------------------------------------------- evolution enters through the specification

// TST-804306 · level: release · module: system
// guards: EVOLUTION ENTERS THROUGH THE SPECIFICATION; UC-033
// given: the open issues 6 (a bug) and 7 (a change whose queue changes FIRST RULE and adds THIRD RULE); the product's SPEC and queues
// input: the Product Owner moves issue 7, and then issue 6, into the backlog
// expect: each Add writes the item file alone — neither SPEC.md nor a file of docs/spec-freigaben/ is written by it —; the item of the change realises the requirements of its queue, FIRST RULE and THIRD RULE, which the specification change has still to bring into the SPEC, so that it waits for their acceptance; the item of the bug realises FIRST RULE, a requirement the SPEC already holds, and needs no specification change (the counter-proof: no queue is written for it)
test("TST-804306: UC-033 moving an issue into the backlog writes no SPEC and no specification change, and a change's item is bound to the specification change", async () => {
  const w = startWorld({ product: QUEUES });
  const before = writtenFiles(w).length;
  const change = await filled(w, 7, null, "MOD-store");
  await pressAdd(change.detail, change.form);
  const bug = await filled(w, 6, "FIRST RULE", "MOD-store");
  await pressAdd(bug.detail, bug.form);
  const written = writtenFiles(w).slice(before).map((entry) => entry.path);
  assert.equal(written.length, 2);
  assert.ok(written.every((path) => /^docs\/backlog\/ITM-\d{3,}-[^/]+\.md$/.test(path)), `only items: ${written}`);
  assert.ok(!written.includes("SPEC.md"));
  assert.deepEqual(written.filter((path) => path.startsWith("docs/spec-freigaben/")), []);
  const [changeItem, bugItem] = itemFiles(w).map(itemOfFile);
  assert.deepEqual(changeItem.fields.realises, ["FIRST RULE", "THIRD RULE"]);
  assert.equal(stateOf(changeItem, ["FIRST RULE", "SECOND RULE"]).state, "waiting for acceptance");
  assert.deepEqual(bugItem.fields.realises, ["FIRST RULE"]);
});

// ---------------------------------------------------------------- every artifact names its origin

// TST-804307 · level: release · module: system
// guards: EVERY ARTIFACT NAMES ITS ORIGIN; UC-033
// given: the open issues 6 and 9, both bugs describing the same work, and the backlog's ITM-0900 and ITM-800
// input: the Product Owner moves issue 6 into the backlog; clears the origin of the prefilled item of issue 9 and writes it again; adds issue 9 to the item of issue 6, and presses the same button once more
// expect: the item of issue 6 names https://github.com/alice/product/issues/6 as its origin and the issue's comment names the item and links its file; an item with no origin is not offered for Add (disabled, the error names the origin); after issue 9 is added to that item its origins are issue 6's address and issue 9's, in that order, and a second press of the button leaves the origins as they were
test("TST-804307: UC-033 the item names the issue it came from, a second issue is added to its origins, and an item with no origin is not added", async () => {
  const w = startWorld();
  const six = await filled(w, 6, "FIRST RULE", "MOD-store");
  await pressAdd(six.detail, six.form);
  const [file] = itemFiles(w);
  const id = idOf(file);
  assert.deepEqual(itemOfFile(file).fields.origin, [ADDRESS(6)]);
  assert.deepEqual(issueNow(w, 6).comments, [NOTE(id, file.path)]);

  const nine = await openIssue(w, 9);
  const form = await moved(nine);
  await typed(fieldOf(form, "realises"), "FIRST RULE");
  await typed(fieldOf(form, "modules"), "MOD-store");
  await typed(fieldOf(form, "origin"), "");
  assert.equal(addOf(form).disabled, true, "an item without an origin is not offered for Add");
  assert.match(errorsOf(form), /origin/);
  await typed(fieldOf(form, "origin"), ADDRESS(9));
  assert.equal(addOf(form).disabled, false, errorsOf(form));

  await waitFor(() => byClass(moveOf(nine), "existing-item").some((node) => node.getAttribute("data-item") === id));
  await trusted(buttonsOf(moveOf(nine), `Add to ${id}`)[0]);
  await waitFor(() => byClass(moveOf(nine), "move-added").length > 0 || byClass(moveOf(nine), "issue-problem").length > 0);
  assert.equal(byClass(moveOf(nine), "issue-problem").length, 0, textOf(moveOf(nine)));
  assert.deepEqual(itemOfFile(itemFiles(w).at(-1)).fields.origin, [ADDRESS(6), ADDRESS(9)]);

  const again = await openIssue(w, 9);
  await moved(again);
  await waitFor(() => byClass(moveOf(again), "existing-item").some((node) => node.getAttribute("data-item") === id));
  await trusted(buttonsOf(moveOf(again), `Add to ${id}`)[0]);
  await waitFor(() => byClass(moveOf(again), "move-added").length > 0 || byClass(moveOf(again), "issue-problem").length > 0);
  assert.deepEqual(itemOfFile(itemFiles(w).at(-1)).fields.origin, [ADDRESS(6), ADDRESS(9)], "the same issue is named once");
});

// ---------------------------------------------------------------- a reference names the identifier

// TST-804308 · level: release · module: system
// guards: A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION; UC-033
// given: the backlog holds ITM-0900 and ITM-800; the history of the default branch holds a withdrawn item, ITM-901, whose file is gone — the form of the next move offers ITM-901 as its provisional identifier —; the open issues 6 and 9, bugs
// input: the Product Owner moves issue 6 into the backlog, and then issue 9
// expect: the item written for issue 6 holds an identifier that the paths of the backlog and the history leave free, not ITM-901 and not one of the two items of the backlog; the comment on issue 6 and the page name the item by that identifier, and the comment is exactly "Backlog item `<identifier>` added: <the item's file in the product's repository>", no position among the items; the item written for issue 9 holds a further identifier, none that is held
test("TST-804308: UC-033 the comment and the page name the item by the identifier its file holds, which no history held", async () => {
  const withdrawn = { commit: "6".repeat(40), parents: [], author: { account: "alice", name: "Alice" }, date: "2026-10-30T10:00:00Z", message: "Withdraw ITM-901", changes: [{ path: "docs/backlog/ITM-901-withdrawn.md", change: "deleted" }] };
  const w = startWorld();
  w.context.product.host.readHistory = async () => [withdrawn];
  const six = await filled(w, 6, "FIRST RULE", "MOD-store");
  assert.equal(fieldOf(six.form, "id").value, "ITM-901", "the form's identifier is provisional");
  await pressAdd(six.detail, six.form);
  const first = itemFiles(w)[0];
  const id = idOf(first);
  assert.ok(!["ITM-0900", "ITM-800", "ITM-901"].includes(id), `${id} is held by neither the paths nor the history`);
  assert.equal(itemOfFile(first).id, id);
  assert.equal(textOf(one(moveOf(six.detail), "move-added")), `Added ${id} to the backlog.`);
  assert.deepEqual(issueNow(w, 6).comments, [NOTE(id, first.path)]);

  const nine = await filled(w, 9, "FIRST RULE", "MOD-store");
  await pressAdd(nine.detail, nine.form);
  const second = idOf(itemFiles(w)[1]);
  assert.ok(![id, "ITM-0900", "ITM-800", "ITM-901"].includes(second), `${second} is a further identifier`);
  assert.deepEqual(issueNow(w, 9).comments, [NOTE(second, itemFiles(w)[1].path)]);
});

// ---------------------------------------------------------------- a person's own input is committed directly

// TST-804309 · level: release · module: system
// guards: A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; UC-033
// given: the open issue 6, a bug; the token stored for the product in this browser
// input: the Product Owner presses Move to backlog, names FIRST RULE and MOD-store, and presses Add
// expect: the item is committed to the default branch main itself: a tree, a commit and the move of the ref heads/main; no branch is created and no pull request opened; every request that changed something — the commit, the comment and the label — carries the token stored for the product; the comment and the label follow the commit
test("TST-804309: UC-033 Add commits the item to the default branch with the person's own token, and opens no branch and no pull request", async () => {
  const w = startWorld();
  const { detail, form } = await filled(w, 6, "FIRST RULE", "MOD-store");
  const recorder = recordWrites();
  try { await pressAdd(detail, form); } finally { recorder.stop(); }
  const made = recorder.writes.map((write) => `${write.method} ${write.path}`);
  assert.deepEqual(made, ["POST /git/trees", "POST /git/commits", "PATCH /git/refs/heads/main", "POST /issues/6/comments", "POST /issues/6/labels"]);
  assert.ok(!made.some((entry) => /\/pulls|\/git\/refs$/.test(entry)), "no pull request, no new ref");
  for (const write of recorder.writes) assert.equal(write.authorization, `Bearer ${PRODUCT_TOKEN}`, `${write.method} ${write.path} carries the product's token`);
});

// ---------------------------------------------------------------- one click per decision

// TST-804310 · level: release · module: system
// guards: ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; UC-033
// given: the open issue 6, a bug, and the open issue 9, a bug; the backlog's ITM-0900 and ITM-800
// input: on issue 6 a script clicks Move to backlog and then the person does; the person types FIRST RULE and MOD-store; a script clicks Add and then the person does; on issue 9 the person presses Move to backlog and "Add to ITM-800"
// expect: the script's click on Move to backlog draws no form; the person's click draws it and writes nothing; the script's click on Add writes nothing; the person's one click on Add commits the item once and writes the comment and the label, and the page asks for no further click; on issue 9 the person's one click on "Add to ITM-800" writes the item's file once, the comment and the label
test("TST-804310: UC-033 Move to backlog draws and Add writes, each on one click of the person, and nothing follows that asks for another", async () => {
  const w = startWorld();
  const detail = await openIssue(w, 6);
  const before = writtenFiles(w).length;
  const move = buttonsOf(moveOf(detail), "Move to backlog")[0];
  move.dispatchEvent(new Event("click"));
  await flush();
  assert.equal(byClass(moveOf(detail), "schema-form").length, 0, "a script's click draws no form");
  const form = await moved(detail);
  assert.equal(writtenFiles(w).length, before, "the person's click draws the form and writes nothing");
  await typed(fieldOf(form, "realises"), "FIRST RULE");
  await typed(fieldOf(form, "modules"), "MOD-store");
  const writes = () => w.kept.github.filter((request) => request.method !== "GET").length;
  const open = writes();
  addOf(form).dispatchEvent(new Event("click"));
  await flush();
  assert.equal(writes(), open, "a script's click on Add writes nothing");
  const recorder = recordWrites();
  try { await pressAdd(detail, form); } finally { recorder.stop(); }
  assert.equal(recorder.writes.filter((write) => write.path === "/git/commits").length, 1, "one commit");
  assert.equal(recorder.writes.filter((write) => /\/issues\/6\/(comments|labels)$/.test(write.path)).length, 2, "the comment and the label");
  assert.equal(buttonsOf(moveOf(detail), "Add").length, 0, "no further click is asked for");
  assert.deepEqual(issueNow(w, 6).labels.sort(), ["backlog", "defect"]);

  const nine = await openIssue(w, 9);
  await moved(nine);
  await waitFor(() => byClass(moveOf(nine), "existing-item").some((node) => node.getAttribute("data-item") === EXISTING.id));
  const second = recordWrites();
  try {
    await trusted(buttonsOf(moveOf(nine), `Add to ${EXISTING.id}`)[0]);
    await waitFor(() => byClass(moveOf(nine), "move-added").length > 0 || byClass(moveOf(nine), "issue-problem").length > 0);
  } finally { second.stop(); }
  assert.equal(second.writes.filter((write) => write.path === "/git/commits").length, 1);
  assert.equal(second.writes.filter((write) => /\/issues\/9\/(comments|labels)$/.test(write.path)).length, 2);
  assert.deepEqual(issueNow(w, 9).labels.sort(), ["backlog", "defect"]);
});

// ---------------------------------------------------------------- the findings of step 3 that backlogFindings gives

// TST-804311 · level: release · module: system
// guards: A BACKLOG ITEM NAMES THE MODULES IT CHANGES; UC-033
// given: the architecture describes MOD-store, MOD-pages and MOD-mail and not MOD-ghost; the open issue 6, a bug; the backlog's ITM-0900 and ITM-800
// input: the Product Owner presses Move to backlog on issue 6, names FIRST RULE and no module; then names the modules MOD-store and MOD-ghost; then, as the counter-proof, MOD-store and MOD-pages, and presses Add
// expect: with no module the form reports that the item names no module the architecture describes, Add is disabled; with MOD-store and MOD-ghost it reports that the item names MOD-ghost, which the architecture does not describe, and no other module, Add is disabled; in both nothing is written; the counter-proof item, which names only described modules, has no error, Add is enabled, and Add writes the item with the modules MOD-store and MOD-pages
test("TST-804311: UC-033 an item that names no module, or a module the architecture does not describe, is reported and not added, and one that names described modules is", async () => {
  const w = startWorld();
  const detail = await openIssue(w, 6);
  const form = await moved(detail);
  await typed(fieldOf(form, "realises"), "FIRST RULE");
  assert.match(errorsOf(form), /names no module the architecture describes/, "known positive: the item, as prefilled, names no module and is reported");
  assert.equal(addOf(form).disabled, true, "an item naming no module is not offered for Add");
  await typed(fieldOf(form, "modules"), "MOD-store, MOD-ghost");
  assert.match(errorsOf(form), /names MOD-ghost, which the architecture does not describe/);
  assert.ok(!errorsOf(form).includes("MOD-store"), "the described module is not reported");
  assert.equal(addOf(form).disabled, true, "an item naming an undescribed module is not offered for Add");
  assert.deepEqual(writeLog(w), [], "nothing is written");
  assert.equal(writtenFiles(w).length, 0);

  await typed(fieldOf(form, "modules"), "MOD-store, MOD-pages");
  assert.equal(errorsOf(form), "", "counter-proof: an item naming described modules has no error");
  assert.equal(addOf(form).disabled, false);
  await pressAdd(detail, form);
  assert.deepEqual(itemOfFile(itemFiles(w)[0]).fields.modules, ["MOD-store", "MOD-pages"]);
});

// TST-804312 · level: release · module: system
// guards: A BACKLOG ITEM NAMES THE MODULES IT CHANGES; UC-033
// given: the backlog holds ITM-810, which builds on ITM-811, and ITM-811, which builds on ITM-901, the identifier the form offers for the item of issue 6; ITM-0900 and ITM-800 build on nothing; the open issue 6, a bug
// input: the Product Owner presses Move to backlog on issue 6, names FIRST RULE and MOD-store, and makes the item build on ITM-810, which closes a circle of three items; then, as the counter-proof, on ITM-800; and MOD-work-plans' backlogFindings is given the three items of the circle, and then the same three with ITM-811 building on nothing
// expect: the form reports that the item builds on ITM-810, which builds on it in turn, naming ITM-901 and ITM-810, Add is disabled and nothing is written; backlogFindings reports each of the three items — ITM-901, ITM-810 and ITM-811 — as an error that names the item it builds on and says that this one builds on it in turn; for the counter-proof the form reports nothing and Add is enabled, and backlogFindings reports no error for the chain with ITM-811 building on nothing
test("TST-804312: UC-033 a circle of items that build on one another is reported with its items named, and the item is not added", async () => {
  const link = (id, title, buildsOn) => itemText({ id, title, buildsOn });
  const circle = { [itemPath("ITM-810", "Ten")]: link("ITM-810", "Ten", ["ITM-811"]), [itemPath("ITM-811", "Eleven")]: link("ITM-811", "Eleven", ["ITM-901"]) };
  const w = startWorld({ product: circle });
  const detail = await openIssue(w, 6);
  const form = await moved(detail);
  assert.equal(fieldOf(form, "id").value, "ITM-901", "known positive: the form offers the identifier that ITM-811 builds on");
  await typed(fieldOf(form, "realises"), "FIRST RULE");
  await typed(fieldOf(form, "modules"), "MOD-store");
  assert.equal(errorsOf(form), "", "known positive: nothing fails before the item builds on another");
  await typed(fieldOf(form, "builds_on"), "ITM-810");
  assert.match(errorsOf(form), /the item builds on ITM-810, which builds on it in turn/);
  assert.match(errorsOf(form), /remove ITM-901 from the items ITM-810 builds on, or ITM-810 from the items ITM-901 builds on/);
  assert.equal(addOf(form).disabled, true, "an item in a circle is not offered for Add");
  assert.deepEqual(writeLog(w), [], "nothing is written");
  assert.equal(writtenFiles(w).length, 0);

  await typed(fieldOf(form, "builds_on"), EXISTING.id);
  assert.equal(errorsOf(form), "", "counter-proof: an item that builds on one that does not build on it has no error");
  assert.equal(addOf(form).disabled, false);

  const item = (id, title, buildsOn) => itemOfFile({ path: itemPath(id, title), content: link(id, title, buildsOn) });
  const architecture = [{ kind: "module", id: "MOD-store" }];
  const errors = (items) => backlogFindings(items, architecture).filter((one) => one.kind === "error");
  const closed = errors([item("ITM-901", "Nine", ["ITM-810"]), item("ITM-810", "Ten", ["ITM-811"]), item("ITM-811", "Eleven", ["ITM-901"])]);
  assert.deepEqual(closed.map((one) => one.artifact).sort(), ["ITM-810", "ITM-811", "ITM-901"], "each item of the circle is reported");
  const named = { "ITM-901": "ITM-810", "ITM-810": "ITM-811", "ITM-811": "ITM-901" };
  for (const [id, on] of Object.entries(named)) {
    assert.ok(closed.some((one) => one.artifact === id && one.what === `the item builds on ${on}, which builds on it in turn`), `${id} is reported with ${on} named`);
  }
  assert.deepEqual(errors([item("ITM-901", "Nine", ["ITM-810"]), item("ITM-810", "Ten", ["ITM-811"]), item("ITM-811", "Eleven", [])]), [], "counter-proof: the chain is no circle");
});

// TST-804313 · level: release · module: system
// guards: A BACKLOG ITEM NAMES THE MODULES IT CHANGES; UC-033
// given: the open issue 6, a bug, labelled defect, with no comment; the architecture describes MOD-store and not MOD-ghost; an item for it that names FIRST RULE, and, forced past the form, no module and then MOD-store and MOD-ghost
// input: moveToBacklog is called with each of the two items, the page's form not being used; then, as the counter-proof, with the item that names MOD-store
// expect: each of the two calls throws ItemsRefused, whose findings are errors of A BACKLOG ITEM NAMES THE MODULES IT CHANGES and, for the second, name MOD-ghost; the product's server receives no request that changes something, no file is written, the issue keeps no comment and only its label defect; the counter-proof call returns the item, writes its one file and one commit, and then the issue has the comment that names the item and the label backlog
test("TST-804313: UC-033 saving an item with an error finding is refused whatever the form showed, and writes nothing, comments nothing and labels nothing", async () => {
  const w = startWorld();
  const host = w.context.product.host;
  const issue = { number: 6, address: ADDRESS(6) };
  const sections = [{ heading: "## Outcome", text: "\nThe export keeps its first page.\n\n" }, { heading: "## Acceptance", text: "\n- A unit test passes.\n" }];
  const forced = (modules) => ({ fields: { title: "Export drops the last page", level: "module", realises: ["FIRST RULE"], modules, tests: ["unit"], origin: [ADDRESS(6)] }, sections });
  const refused = async (modules, named) => {
    await assert.rejects(moveToBacklog(host, issue, forced(modules), null), (failure) => {
      assert.equal(failure.name, "ItemsRefused");
      assert.ok(failure.findings.length > 0 && failure.findings.every((one) => one.kind === "error" && one.rule === "A BACKLOG ITEM NAMES THE MODULES IT CHANGES"), JSON.stringify(failure.findings));
      assert.ok(failure.findings.some((one) => one.what.includes(named)), `a finding names ${named}`);
      return true;
    });
    assert.deepEqual(writeLog(w), [], "no request that changes something");
    assert.equal(writtenFiles(w).length, 0);
    assert.deepEqual(issueNow(w, 6).comments, [], "no comment");
    assert.deepEqual(issueNow(w, 6).labels, ["defect"], "no label");
  };
  await refused([], "names no module");
  await refused(["MOD-store", "MOD-ghost"], "MOD-ghost");

  const done = await moveToBacklog(host, issue, forced(["MOD-store"]), null);
  assert.equal(itemFiles(w).length, 1, "counter-proof: the item that names a described module is written");
  assert.deepEqual(itemOfFile(itemFiles(w)[0]).fields.modules, ["MOD-store"]);
  assert.deepEqual(issueNow(w, 6).comments, [NOTE(done.item, itemFiles(w)[0].path)]);
  assert.deepEqual(issueNow(w, 6).labels.sort(), ["backlog", "defect"]);
});
