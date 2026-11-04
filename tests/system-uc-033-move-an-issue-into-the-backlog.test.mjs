// System tests of UC-033 "Move an issue into the backlog": the main flow for a bug and for a change, as the dashboard's route `issue` reaches it — from the issue analysed and its class confirmed (UC-012) to the item prefilled, checked, added, and
// derived as ready or waiting for acceptance; the alternative flows 1a, 2a, 2b, 4a, 4b and 1b; the step that checks the item; and, once the item's pull request is merged, the issue closed with a link to it and to the item (step 6).
// TST-804201 maps every flow of UC-033 to the system test that walks it.
// Run: node --test tests/system-uc-033-move-an-issue-into-the-backlog.test.mjs
//
// Module: MOD-maintenance-pages
// Module: MOD-issue-handling
// Module: MOD-work-plans
// Guards: UC-033
// Level: system
//
// Written for ITM-804 by developer-sonnet-j, who implemented none of ITM-582, ITM-583, ITM-584, ITM-617, ITM-1250 and ITM-1256 and no UC-033 production behaviour but ITM-817 (MOD-work-plans' `backlogFindings`, the findings the form of step 3 shows);
// RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER binds the release file, which holds no case that exercises `backlogFindings`. The world is tests/uc-033-harness.mjs over tests/uc-012-harness.mjs: the real route `issue` of MOD-maintenance-pages over the
// real MOD-issue-handling, MOD-work-plans, MOD-spec-changes, MOD-job-runner and MOD-repository-hosts, behind a fake GitHub of alice/product and a model endpoint that answers as the participant local-llm. Each case states its input and its expected
// result in its own text (given / input / expect) from UC-033, before it runs; none reads an expected value from the page. The counter-proofs are recorded in the pull request. Readings the texts leave open, which the cases state:
//   - "the item appears in the backlog (UC-032): a bug item is ready, a change item is waiting for acceptance until every requirement it names is accepted, then ready by itself, because its state is derived" is read through MOD-work-plans'
//     itemStates over the item the page wrote, given the names the product has accepted; nothing about the item changes between the two states.
//   - 2a and 2b: "Agent M marks it, and offers to remove it" and "Agent M updates the item's realises when the Product Owner confirms" are read as a line on the issue's page that says the item names a rejected requirement (2a) or one accepted under another
//     name (2b), naming it, and a button of the person's click whose text starts with "Remove" or "Update". No text names the control; the cases are findings against the page, not against a particular wording.
//   - 1b: "there is no backlog" is read as: the page offers no Move to backlog for a bug or a change of a product whose process declaration names a model that plans its work in advance, and the bug is fixed directly (UC-012 step 5).
//   - Step 6: "the issue is closed with a link to the pull request and the item" is read as the note MOD-mail-records gives for it, "Closed with <pull request>; item `ITM-nnn`.", written by the page's *Close with links* once the item's job has a merged pull request.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { ADDRESS, BODY, EXISTING, PRODUCT_URL, addOf, analysed, buttonsOf, byClass, decided, drafted, errorsOf, fieldOf, flush, issueNow, issuesOf, itemFiles, itemOfFile, itemPath, itemText, jobRecord, moveOf, moved, one, openIssue,
  pressAdd, pullOf, queueFiles, queueOf, recordWrites, restoreWorld, saved, startWorld, stateOf, textOf, trusted, typed, waitFor, warningsOf, writtenFiles } from "./uc-033-harness.mjs";

// The map reads files only and draws no page, so that there is no world to put back after it.
afterEach(() => { if (globalThis.document) restoreWorld(); });

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const SELF = "tests/system-uc-033-move-an-issue-into-the-backlog.test.mjs";

// ---------------------------------------------------------------- the map

// Each flow of UC-033, with the system test that walks it.
const FLOWS = {
  "main flow, bug (steps 1 to 5)": [[SELF, "TST-804202"]],
  "main flow, change (steps 1 to 5)": [[SELF, "TST-804203"]],
  "step 2, a bug's realises": [[SELF, "TST-804212"]],
  "step 3": [[SELF, "TST-804204"]],
  "step 6": [[SELF, "TST-804211"]],
  "1a": [[SELF, "TST-804205"]],
  "2a": [[SELF, "TST-804206"]],
  "2b": [[SELF, "TST-804207"]],
  "4a": [[SELF, "TST-804208"]],
  "4b": [[SELF, "TST-804209"]],
  "1b": [[SELF, "TST-804210"]],
};

// TST-804201 · level: system · module: system
// guards: UC-033
// given: UC-033 as committed text, whose alternative flows are 1a, 2a, 2b, 4a, 4b and 1b, and the system tests named in FLOWS
// input: read UC-033's alternative flows, and the declarations of the test files named for each flow
// expect: known positive — UC-033 names the six alternative flows 1a, 2a, 2b, 4a, 4b and 1b; FLOWS holds each of them, the main flow's bug and change paths, the step that prefills a bug's realises, the step that checks the item and step 6; each test named stands in its file with the level system and guards UC-033
test("TST-804201: UC-033 every flow has a system test that walks it", () => {
  const text = read("docs/use-cases/UC-033-move-an-issue-into-the-backlog.md");
  const alternatives = [...text.matchAll(/^- \*\*(\d+[a-z])\. /gm)].map((match) => match[1]);
  assert.deepEqual(alternatives, ["1a", "2a", "2b", "4a", "4b", "1b"], "known positive: UC-033's alternative flows");
  for (const flow of alternatives) assert.ok(Object.keys(FLOWS).includes(flow), `${flow} has a system test`);
  for (const [flow, tests] of Object.entries(FLOWS)) {
    for (const [file, id] of tests) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${flow}: ${file} exists`);
      const declared = testDeclarations(file, read(file)).find((each) => each.id === id);
      assert.ok(declared, `${flow}: ${id} is declared in ${file}`);
      assert.equal(declared.level, "system", `${id} is a system test`);
      assert.ok((declared.guards ?? []).includes("UC-033"), `${id} guards UC-033`);
    }
  }
});

// ---------------------------------------------------------------- the fixtures of the cases

const AS_BUG = { class: "bug", reasoning: "FIRST RULE holds, and the code breaks it: the export drops pages.", wrong: ["src/store/read.mjs"] };
const AS_CHANGE = { class: "change", reasoning: "The SPEC says nothing about page counts: a requirement is missing." };
const NEW = { name: "EVERY EXPORT KEEPS ALL PAGES", rule: "An export holds every page of the document.", check: "tests/unit.test.mjs", constrains: "product", passage: "cut off after the second page", class: "new" };
const LINK = (path) => `${PRODUCT_URL}/blob/main/${path}`;
const NOTE = (id, path) => `Backlog item \`${id}\` added: ${LINK(path)}`;
const idOf = (entry) => /^docs\/backlog\/(ITM-\d{3,})-/.exec(entry.path)[1];
const treePaths = (write) => JSON.parse(write.body).tree.map((entry) => entry.path);
const methods = (writes) => writes.map((write) => `${write.method} ${write.path}`);

/** The issue `number` analysed by local-llm and its class `cls` confirmed by the person's click, and its move section waited for. */
async function classified(w, number, cls) {
  const detail = await analysed(await openIssue(w, number));
  await decided(detail, cls);
  await waitFor(() => moveOf(detail) !== undefined && buttonsOf(moveOf(detail), "Move to backlog").length === 1);
  return detail;
}

// ---------------------------------------------------------------- the main flow, a bug

// TST-804202 · level: system · module: system
// guards: UC-033; ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the open issue 5 of alice/product, not classified, whose text is "The export is cut off after the second page; FIRST RULE says nothing about page counts."; the architecture describes MOD-store (src/store/) and MOD-pages (src/pages/); the backlog holds ITM-0900 and ITM-800; local-llm analyses the issue as a bug that src/store/read.mjs causes
// input: steps 1 to 4 — the Product Owner has local-llm analyse the issue and confirms the class bug (UC-012), presses Move to backlog, reads the item, names the requirement FIRST RULE, and presses Add
// expect: before the confirmation the page offers no Move to backlog; after it the click writes nothing and shows the item prefilled — title "Export loses pages" from the issue, origin https://github.com/alice/product/issues/5, modules MOD-store (the module whose folder holds the file the analysis names), realises empty —, Add disabled with an error that names what it realises; once FIRST RULE is named, Add is enabled; Add writes in this order one tree and one commit to the default branch main, the comment and the label, and nothing else; the item file docs/backlog/ITM-<nnn>-export-loses-pages.md (the identifier after ITM-0900) holds title, level module, realises FIRST RULE, modules MOD-store, origin the issue's address and the issue's text as its outcome; the issue carries the labels defect and backlog and the comment "Backlog item `ITM-<nnn>` added: <the item file in the product's repository>"; the page says the item was added; the item is ready once FIRST RULE is accepted, and waits for acceptance while it is not
test("TST-804202: UC-033 a confirmed bug is moved into the backlog with one Add, and its item is ready", async () => {
  const w = startWorld({ analysis: AS_BUG });
  const detail = await analysed(await openIssue(w, 5));
  assert.equal(buttonsOf(detail, "Move to backlog").length, 0, "not offered before the class is confirmed");
  await decided(detail, "bug");
  await waitFor(() => moveOf(detail) !== undefined && buttonsOf(moveOf(detail), "Move to backlog").length === 1);
  const before = writtenFiles(w).length;
  const form = await moved(detail);
  assert.equal(writtenFiles(w).length, before, "Move to backlog writes nothing");
  assert.equal(fieldOf(form, "title").value, "Export loses pages");
  assert.equal(fieldOf(form, "origin").value, ADDRESS(5));
  assert.equal(fieldOf(form, "modules").value, "MOD-store");
  assert.equal(fieldOf(form, "realises").value, "");
  assert.equal(addOf(form).disabled, true, "an item that realises nothing is not offered for Add");
  assert.match(errorsOf(form), /realises/);
  await typed(fieldOf(form, "realises"), "FIRST RULE");
  assert.equal(addOf(form).disabled, false, errorsOf(form));

  const recorder = recordWrites();
  try { await pressAdd(detail, form); } finally { recorder.stop(); }
  assert.deepEqual(methods(recorder.writes), ["POST /git/trees", "POST /git/commits", "PATCH /git/refs/heads/main", "POST /issues/5/comments", "POST /issues/5/labels"]);
  const files = itemFiles(w);
  assert.equal(files.length, 1);
  const id = idOf(files[0]);
  assert.ok(Number(id.slice(4)) > 900, `${id} comes after ITM-0900`);
  assert.equal(files[0].path, `docs/backlog/${id}-export-loses-pages.md`);
  const item = itemOfFile(files[0]);
  assert.equal(item.fields.title, "Export loses pages");
  assert.equal(item.fields.level, "module");
  assert.deepEqual(item.fields.realises, ["FIRST RULE"]);
  assert.deepEqual(item.fields.modules, ["MOD-store"]);
  assert.deepEqual(item.fields.origin, [ADDRESS(5)]);
  assert.ok(item.sections.some((section) => section.text.includes(BODY)), "the issue's text is the item's outcome");
  assert.deepEqual(issueNow(w, 5).labels.sort(), ["backlog", "defect"]);
  assert.deepEqual(issueNow(w, 5).comments, [NOTE(id, files[0].path)]);
  assert.equal(textOf(one(moveOf(detail), "move-added")), `Added ${id} to the backlog.`);
  assert.equal(stateOf(item, ["FIRST RULE"]).state, "ready", "a bug item is ready");
  assert.equal(stateOf(item, []).state, "waiting for acceptance", "counter-proof: while FIRST RULE is not accepted it waits");
});

// ---------------------------------------------------------------- the main flow, a change

// TST-804203 · level: system · module: system
// guards: UC-033; EVOLUTION ENTERS THROUGH THE SPECIFICATION; EVERY ARTIFACT NAMES ITS ORIGIN; NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED
// given: the open issue 5, not classified; local-llm analyses it as a change and drafts the new requirement EVERY EXPORT KEEPS ALL PAGES; the product links the person's own source SRC-alice; another issue of the product, 6, has a queue of its own that changes SECOND RULE
// input: the Product Owner confirms the class change (UC-012 step 4), drafts the change and saves it as a queue naming the issue (UC-012 step 6); presses Move to backlog, names the module MOD-store, and presses Add
// expect: the form is prefilled with realises EVERY EXPORT KEEPS ALL PAGES, the entry of the queue that names issue 5, and not SECOND RULE, which the queue of issue 6 changes, and with origin the issue's address; Add writes the item file alone, SPEC.md and the queues unchanged by it; the item is waiting for acceptance, the reason names EVERY EXPORT KEEPS ALL PAGES, and no job can start for it, the reason naming it; once the product has accepted EVERY EXPORT KEEPS ALL PAGES the same item is ready, by itself, and nothing of its file changed
test("TST-804203: UC-033 a change is moved into the backlog with the requirements its queue changes, waits for their acceptance, and is ready by itself once they are accepted", async () => {
  const other = queueOf("2026-10-20c_other-issue", 6, [{ name: "FIRST RULE", text: "The first rule holds." }, { name: "SECOND RULE", text: "The second rule holds on every page." }]);
  const w = startWorld({ analysis: AS_CHANGE, change: { candidates: [NEW] }, product: other });
  const detail = await analysed(await openIssue(w, 5));
  await decided(detail, "change");
  await saved(await drafted(detail));
  assert.ok(queueFiles(w).some((entry) => entry.content.includes(`**Issue:** #5 of ${PRODUCT_URL}`)), "the queue names the issue");
  await waitFor(() => moveOf(detail) !== undefined && buttonsOf(moveOf(detail), "Move to backlog").length === 1);
  const form = await moved(detail);
  assert.equal(fieldOf(form, "realises").value, NEW.name);
  assert.equal(fieldOf(form, "origin").value, ADDRESS(5));
  assert.equal(fieldOf(form, "modules").value, "", "no module is named: the Product Owner names it");
  assert.equal(addOf(form).disabled, true);
  await typed(fieldOf(form, "modules"), "MOD-store");
  assert.equal(addOf(form).disabled, false, errorsOf(form));

  const recorder = recordWrites();
  try { await pressAdd(detail, form); } finally { recorder.stop(); }
  const trees = recorder.writes.filter((write) => write.path === "/git/trees");
  assert.equal(trees.length, 1, "one tree");
  const files = itemFiles(w);
  assert.equal(files.length, 1);
  assert.deepEqual(treePaths(trees[0]), [files[0].path], "Add writes the item file alone");
  assert.ok(!writtenFiles(w).some((entry) => entry.path === "SPEC.md"), "the SPEC is not written");
  const item = itemOfFile(files[0]);
  assert.deepEqual(item.fields.realises, [NEW.name]);
  assert.deepEqual(item.fields.origin, [ADDRESS(5)]);
  assert.deepEqual(item.fields.modules, ["MOD-store"]);
  assert.deepEqual(issueNow(w, 5).labels.sort(), ["backlog", "change"]);
  assert.deepEqual(issueNow(w, 5).comments, [NOTE(idOf(files[0]), files[0].path)]);

  const waiting = stateOf(item, ["FIRST RULE"]);
  assert.equal(waiting.state, "waiting for acceptance");
  assert.match(waiting.reason, /EVERY EXPORT KEEPS ALL PAGES/);
  assert.equal(waiting.verdict.startable, false);
  assert.match(waiting.verdict.reasons.join("\n"), /EVERY EXPORT KEEPS ALL PAGES.*not accepted/);
  const ready = stateOf(item, ["FIRST RULE", NEW.name]);
  assert.equal(ready.state, "ready", "once accepted, ready by itself");
  assert.ok(!ready.verdict.reasons?.some((reason) => /not accepted/.test(reason)), "nothing keeps it for want of acceptance");
  assert.equal(itemFiles(w).length, 1, "the item's file was not written again");
});

// ---------------------------------------------------------------- step 3: the item is checked

// TST-804204 · level: system · module: system
// guards: UC-033; A BACKLOG ITEM NAMES WHAT IT REALISES; A BACKLOG ITEM NAMES THE MODULES IT CHANGES; EVERY ARTIFACT NAMES ITS ORIGIN
// given: the open issues 6 (defect) and 10 (defect, titled like ITM-800, "Keep the first page of an export"); the architecture describes MOD-store and MOD-pages and not MOD-ghost; the backlog holds ITM-0900 and ITM-800
// input: step 3 — on issue 6 the Product Owner presses Move to backlog; names FIRST RULE and the modules "MOD-store, MOD-ghost"; corrects the modules to MOD-store; clears the origin and writes it again; presses Add. On issue 10 the Product Owner presses Move to backlog and names FIRST RULE and MOD-store
// expect: the item as prefilled names what fails — realises and modules —, Add disabled; with MOD-ghost the error names MOD-ghost and Add is disabled; with MOD-store alone no error remains and Add is enabled; with the origin cleared the error names the origin and Add is disabled, and with it written again Add is enabled; nothing is written before Add; the item of issue 10 is flagged as restating ITM-800 by a warning that names ITM-800, and Add stays enabled (a flag, not a refusal)
test("TST-804204: UC-033 the item is checked and what fails is named, the Product Owner corrects it, and an item that restates another is flagged, not refused", async () => {
  const restating = { number: 10, title: EXISTING.title, body: "Keep the first page of an export.", state: "open", labels: ["defect"], comments: [] };
  const w = startWorld({ issues: [...issuesOf(), restating] });
  const before = writtenFiles(w).length;
  const six = await openIssue(w, 6);
  const form = await moved(six);
  assert.equal(addOf(form).disabled, true);
  assert.match(errorsOf(form), /realises/);
  assert.match(errorsOf(form), /module/);
  await typed(fieldOf(form, "realises"), "FIRST RULE");
  await typed(fieldOf(form, "modules"), "MOD-store, MOD-ghost");
  assert.match(errorsOf(form), /MOD-ghost/, "the module the architecture does not describe is named");
  assert.equal(addOf(form).disabled, true);
  await typed(fieldOf(form, "modules"), "MOD-store");
  assert.equal(errorsOf(form), "", "known positive: nothing fails now");
  assert.equal(addOf(form).disabled, false);
  await typed(fieldOf(form, "origin"), "");
  assert.match(errorsOf(form), /origin/);
  assert.equal(addOf(form).disabled, true);
  await typed(fieldOf(form, "origin"), ADDRESS(6));
  assert.equal(addOf(form).disabled, false, errorsOf(form));
  assert.equal(writtenFiles(w).length, before, "nothing is written before Add");

  const ten = await openIssue(w, 10);
  const second = await moved(ten);
  await typed(fieldOf(second, "realises"), "FIRST RULE");
  await typed(fieldOf(second, "modules"), "MOD-store");
  assert.match(warningsOf(second), /ITM-800/, "the restated item is named");
  assert.equal(errorsOf(second), "");
  assert.equal(addOf(second).disabled, false, "a warning refuses nothing");
});

// ---------------------------------------------------------------- 1a: the issue is not classified yet

// TST-804205 · level: system · module: system
// guards: UC-033; ONE CLICK PER DECISION
// given: the open issues 5 (not classified), 6 (defect) and 8 (not reproducible); known positive first — issue 6 is offered Move to backlog
// input: the Product Owner opens issue 5, presses the lead "UC-012, step 2", and then confirms the class bug; opens issue 8
// expect: issue 5 offers no Move to backlog and says it is not classified, leading to "UC-012, step 2"; the lead goes once, to the use case UC-012 of the instance itself; after the click on Bug the move is offered and the lead is gone; issue 8, whose class is not reproducible, is classified and offers neither the move nor the lead
test("TST-804205: UC-033 1a an issue not classified yet is not offered the move and is led to UC-012", async () => {
  const w = startWorld();
  const six = await openIssue(w, 6);
  assert.equal(buttonsOf(moveOf(six), "Move to backlog").length, 1, "known positive: a classified bug is offered the move");

  const five = await openIssue(w, 5);
  assert.equal(buttonsOf(five, "Move to backlog").length, 0);
  assert.match(textOf(one(five, "move-not-offered")), /not classified/i);
  assert.equal(textOf(one(five, "uc-012")), "UC-012, step 2");
  assert.deepEqual(w.context.went, []);
  await trusted(one(five, "uc-012"));
  assert.deepEqual(w.context.went, [["use-case", { id: "UC-012", product: "" }]]);
  await trusted(byClass(five, "set-class").find((node) => node.getAttribute("data-class") === "bug"));
  await waitFor(() => buttonsOf(five, "Move to backlog").length === 1);
  assert.equal(buttonsOf(five, "Move to backlog").length, 1);
  assert.equal(byClass(five, "uc-012").length, 0, "the lead is gone");

  const eight = await openIssue(w, 8, { offered: false });
  assert.equal(buttonsOf(eight, "Move to backlog").length, 0);
  assert.equal(byClass(eight, "uc-012").length, 0);
});

// ---------------------------------------------------------------- 2a: the change's entries are rejected

const REJECTION = { commit: "5".repeat(40), parents: [], author: { account: "alice", name: "Alice" }, date: "2026-10-30T10:00:00Z", message: `Reject ${NEW.name}: out of scope for this product.`,
  changes: [{ path: "docs/spec-freigaben/2026-10-20a_export/01-section.md", change: "deleted" }] };
const ITEM_OF_SEVEN = { id: "ITM-901", title: "Export should keep all pages", realises: [NEW.name], modules: ["MOD-store"], origin: [ADDRESS(7)] };
const BACKLOGGED = { number: 7, title: ITEM_OF_SEVEN.title, body: BODY, state: "open", labels: ["change", "backlog"], comments: [NOTE("ITM-901", itemPath(ITEM_OF_SEVEN.id, ITEM_OF_SEVEN.title))] };

// TST-804206 · level: system · module: system
// guards: UC-033; EVOLUTION ENTERS THROUGH THE SPECIFICATION
// given: UC-033 alternative flow 2a. the open issue 7, a change moved into the backlog as ITM-901, which realises EVERY EXPORT KEEPS ALL PAGES; the entry of its queue was rejected (UC-006) and left its queue — the commit that rejected it stands in the history —, and the SPEC does not hold the name
// input: the Product Owner opens issue 7
// expect: the page marks the item: it says that ITM-901 names a requirement that will never be accepted, EVERY EXPORT KEEPS ALL PAGES, as a rejected one; and it offers a button of the person's click whose text starts with "Remove" for the item and the closing of the issue with a link to the rejected entry
test("TST-804206: UC-033 2a an item that names a rejected requirement is marked and its removal and the issue's closing are offered", { todo: "FINDING UC033-F2 — alternative flow 2a is built nowhere: the route issue draws the move section from the issue's class alone (src/maintenance-pages/issues.mjs:556-562, drawMove) and reads neither the rejection of a queue's entry nor the requirements an item of the issue names, so an item that names a requirement that will never be accepted is not marked, and neither its removal nor the closing of the issue with a link to the rejected entry is offered; MOD-maintenance-pages.md and MOD-issue-handling.md state neither — an item for MOD-maintenance-pages, with the texts it needs" }, async () => {
  const w = startWorld({ issues: [BACKLOGGED], product: { [itemPath(ITEM_OF_SEVEN.id, ITEM_OF_SEVEN.title)]: itemText(ITEM_OF_SEVEN) } });
  w.context.product.host.readHistory = async () => [REJECTION];
  const detail = await openIssue(w, 7);
  await flush();
  assert.match(textOf(detail), /ITM-901/);
  assert.match(textOf(detail), /rejected/i, "the item is marked as naming a rejected requirement");
  assert.ok(textOf(detail).includes(NEW.name), "the rejected requirement is named");
  assert.ok(walkButtons(detail).some((text) => /^Remove/.test(text)), "a button that starts with Remove is offered");
});

/** The text of every button below `root`. */
function walkButtons(root) {
  const found = [];
  (function visit(node) { for (const child of node.children ?? []) { if (typeof child === "string") continue; if (child.localName === "button") found.push(textOf(child)); visit(child); } })(root);
  return found;
}

// ---------------------------------------------------------------- 2b: the change is accepted under another name

// TST-804207 · level: system · module: system
// guards: UC-033; A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION
// given: UC-033 alternative flow 2b. the open issue 7, moved into the backlog as ITM-901, which realises EVERY EXPORT KEEPS ALL PAGES; the change was accepted under the name EVERY EXPORT KEEPS EVERY PAGE — the SPEC holds that name and not the first, and the queue's decision names the entry it accepted
// input: the Product Owner opens issue 7 and presses the button whose text starts with "Update"
// expect: the page says that ITM-901 names EVERY EXPORT KEEPS ALL PAGES, which was accepted as EVERY EXPORT KEEPS EVERY PAGE, and offers the update; after the person's click the item file realises EVERY EXPORT KEEPS EVERY PAGE and nothing else of it changed
test("TST-804207: UC-033 2b an item follows the name under which its change was accepted, when the Product Owner confirms", { todo: "FINDING UC033-F3 — alternative flow 2b is built nowhere: the route issue neither reads the decision of a queue nor compares the requirements an item of the issue names with the SPEC (src/maintenance-pages/issues.mjs:556-562, drawMove), and no function of MOD-issue-handling rewrites an item's realises (src/issue-handling/backlog.mjs:78-93, moveToBacklog rewrites only an item's origins), so an item stays waiting for a name the SPEC will never hold — an item for MOD-maintenance-pages and MOD-issue-handling, with the texts they need" }, async () => {
  const decision = "# Decisions\n\nAppend-only.\n\n- Entry 01 accepted as EVERY EXPORT KEEPS EVERY PAGE (proposed as EVERY EXPORT KEEPS ALL PAGES).\n";
  const w = startWorld({ issues: [BACKLOGGED], product: { [itemPath(ITEM_OF_SEVEN.id, ITEM_OF_SEVEN.title)]: itemText(ITEM_OF_SEVEN), "docs/spec-freigaben/2026-10-20a_export/entscheidungen.md": decision } });
  const detail = await openIssue(w, 7);
  await flush();
  assert.match(textOf(detail), /EVERY EXPORT KEEPS EVERY PAGE/, "the name the change was accepted under is named");
  const update = walkButtons(detail).find((text) => /^Update/.test(text));
  assert.ok(update, "an update is offered");
  await trusted(buttonsOf(detail, update)[0]);
  await flush();
  const written = itemFiles(w).at(-1);
  assert.ok(written, "the item is written");
  assert.deepEqual(itemOfFile(written).fields.realises, ["EVERY EXPORT KEEPS EVERY PAGE"]);
});

// ---------------------------------------------------------------- 4a: several issues describe the same work

// TST-804208 · level: system · module: system
// guards: UC-033; EVERY ARTIFACT NAMES ITS ORIGIN; ONE CLICK PER DECISION
// given: UC-033 alternative flow 4a. the backlog holds ITM-0900 and ITM-800, the latter with the origin https://github.com/alice/product/issues/1; the open issue 9 (defect) describes the same work
// input: the Product Owner opens issue 9, presses Move to backlog, and presses "Add to ITM-800"
// expect: the product receives one write of one file, ITM-800's own, whose text is the former text with the address of issue 9 added after the first origin and nothing else changed; no new item file is written; issue 9 carries one comment "Backlog item `ITM-800` added: <the file of ITM-800 in the product's repository>" and the label backlog; the page says issue 9 was added to ITM-800
test("TST-804208: UC-033 4a a second issue is added to an existing item, which then names both as origins, and the second issue gets the comment", async () => {
  const w = startWorld();
  const existingPath = itemPath(EXISTING.id, EXISTING.title);
  const former = itemText(EXISTING);
  const detail = await openIssue(w, 9);
  await moved(detail);
  await waitFor(() => byClass(moveOf(detail), "existing-item").length > 0);
  assert.ok(byClass(moveOf(detail), "existing-item").some((node) => node.getAttribute("data-item") === EXISTING.id), "the items of the backlog are offered");
  const recorder = recordWrites();
  try {
    await trusted(buttonsOf(moveOf(detail), `Add to ${EXISTING.id}`)[0]);
    await waitFor(() => byClass(moveOf(detail), "move-added").length > 0 || byClass(moveOf(detail), "issue-problem").length > 0);
  } finally { recorder.stop(); }
  assert.equal(byClass(moveOf(detail), "issue-problem").length, 0, textOf(moveOf(detail)));
  const trees = recorder.writes.filter((write) => write.path === "/git/trees");
  assert.equal(trees.length, 1);
  assert.deepEqual(treePaths(trees[0]), [existingPath], "one file, ITM-800's own");
  assert.deepEqual(itemFiles(w).map((entry) => entry.path), [existingPath]);
  assert.equal(itemFiles(w)[0].content, former.replace("origin:\n  - https://github.com/alice/product/issues/1\n", `origin:\n  - https://github.com/alice/product/issues/1\n  - ${ADDRESS(9)}\n`), "only the origins differ");
  assert.deepEqual(issueNow(w, 9).comments, [NOTE(EXISTING.id, existingPath)]);
  assert.deepEqual(issueNow(w, 9).labels.sort(), ["backlog", "defect"]);
  assert.equal(textOf(one(moveOf(detail), "move-added")), "Added this issue to ITM-800.");
});

// ---------------------------------------------------------------- 4b: the token may not comment

const withClipboard = () => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const copied = [];
  Object.defineProperty(globalThis, "navigator", { configurable: true, writable: true, value: { clipboard: { writeText: async (text) => { copied.push(text); } }, userAgent: "node" } });
  return { copied, restore: () => { if (prior) Object.defineProperty(globalThis, "navigator", prior); else delete globalThis.navigator; } };
};

// TST-804209 · level: system · module: system
// guards: UC-033; ONE CLICK PER DECISION
// given: UC-033 alternative flow 4b. the open issue 6 (defect); the product's tracker answers 403 to a comment (the token may not comment)
// input: the Product Owner presses Move to backlog on issue 6, names FIRST RULE and MOD-store, presses Add, and then Copy comment
// expect: the item is committed once; issue 6 has no comment and no label backlog; the page shows the comment text "Backlog item `ITM-<nnn>` added: <the item file in the product's repository>" beside the address of issue 6, with the button Copy comment, whose click puts exactly that text on the clipboard
test("TST-804209: UC-033 4b where the token may not comment the item is committed and the comment is shown with a copy button", async () => {
  const clipboard = withClipboard();
  try {
    const w = startWorld({ commentStatus: 403 });
    const detail = await openIssue(w, 6);
    const form = await moved(detail);
    await typed(fieldOf(form, "realises"), "FIRST RULE");
    await typed(fieldOf(form, "modules"), "MOD-store");
    await pressAdd(detail, form);
    assert.equal(byClass(detail, "issue-problem").length, 0, textOf(moveOf(detail)));
    const files = itemFiles(w);
    assert.equal(files.length, 1, "the item is committed once");
    assert.deepEqual(issueNow(w, 6).comments, []);
    assert.deepEqual(issueNow(w, 6).labels, ["defect"]);
    const wanted = NOTE(idOf(files[0]), files[0].path);
    assert.equal(textOf(one(moveOf(detail), "comment-text")), wanted);
    assert.equal(one(moveOf(detail), "comment-issue").getAttribute("href"), ADDRESS(6));
    await trusted(buttonsOf(moveOf(detail), "Copy comment")[0]);
    assert.deepEqual(clipboard.copied, [wanted]);
  } finally { clipboard.restore(); }
});

// ---------------------------------------------------------------- 1b: the product works from a plan

const PLAN_DECLARATION = "---\nmodel: v-model\nmodel_file: docs/process-models/v-model.md\nmodel_version: 0fb048a1bac50be9beb68fb798e226f8ca2c7f00\n---\n# How the fixture product is developed\n\n## Practices\n\n- none\n\n## Branches\n\n| Phase or time box | Branch |\n|---|---|\n\n## Definition of Done\n\nThe job rules hold.\n";

// TST-804210 · level: system · module: system
// guards: UC-033
// given: UC-033 alternative flow 1b. the product's process declaration docs/process.md names the V-model, which plans its work in advance — the product has a plan and no backlog —; the open issue 6, a bug, confirmed
// input: the Product Owner opens issue 6
// expect: the page offers no Move to backlog and writes nothing under docs/backlog/; the bug is fixed directly — the fix section of UC-012 step 5 is offered
test("TST-804210: UC-033 1b a product that works from a plan has no backlog, and its bug is fixed directly", { todo: "FINDING UC033-F4 — alternative flow 1b is built nowhere: the route issue offers the move whatever model the product declares (src/maintenance-pages/issues.mjs:556-562, drawMove, and :322, moveSection) and reads no process declaration, and MOD-maintenance-pages' Uses (docs/architecture/MOD-maintenance-pages.md:7-83) name no function of MOD-product-process that reads it, so a product that plans its work is offered a backlog it does not have — an item for MOD-maintenance-pages, with the text it needs" }, async () => {
  const w = startWorld({ product: { "docs/process.md": PLAN_DECLARATION } });
  const detail = await openIssue(w, 6);
  await waitFor(() => byClass(detail, "issue-fix").length > 0);
  assert.ok(byClass(detail, "issue-fix").length > 0, "the fix is offered");
  assert.equal(buttonsOf(detail, "Move to backlog").length, 0, "no backlog, no move");
});

// ---------------------------------------------------------------- step 2: a bug's realises

// TST-804212 · level: system · module: system
// guards: UC-033; A BACKLOG ITEM NAMES WHAT IT REALISES
// given: the open issue 5, whose text names FIRST RULE; local-llm analyses it as a bug that src/store/read.mjs causes and names FIRST RULE as the requirement violated
// input: the Product Owner confirms the class bug and presses Move to backlog
// expect: step 2 — for a bug the item is prefilled with realises FIRST RULE, "the requirement that UC-012's analysis named as violated"; Add is enabled once nothing fails (the module MOD-store is prefilled from the file the analysis names)
test("TST-804212: UC-033 step 2 a bug's item is prefilled with the requirement the analysis named as violated", async () => {
  const w = startWorld({ analysis: { ...AS_BUG, violated: "FIRST RULE" } });
  const detail = await classified(w, 5, "bug");
  const form = await moved(detail);
  assert.equal(fieldOf(form, "realises").value, "FIRST RULE");
  assert.equal(fieldOf(form, "modules").value, "MOD-store");
  assert.equal(addOf(form).disabled, false, errorsOf(form));
});

// ---------------------------------------------------------------- step 6: the item's pull request is merged

const JOB = "JOB-20261029-0900-a1b2";
const FIX = "JOB-20261029-0905-c3d4";

// TST-804211 · level: system · module: system
// guards: UC-033; ONE CLICK PER DECISION
// given: the open issues 6 and 9, both bugs; issue 6 was moved into the backlog as ITM-901, whose job JOB-20261029-0900-a1b2 (kind implement, working on ITM-901) has the merged pull request #9; issue 9 has a fix job JOB-20261029-0905-c3d4 (kind fix-bug, working on issue 9) whose pull request #9 is merged — the known positive
// input: the Product Owner opens issue 9 and then issue 6, and presses Close with links on each
// expect: known positive first — issue 9 offers Close with links, and after the click it is closed with the comment "Closed with https://github.com/alice/product/pull/9."; step 6 — issue 6 offers Close with links as well, and after the click it is closed with the comment "Closed with https://github.com/alice/product/pull/9; item `ITM-901`.", a link to the pull request and the item
test("TST-804211: UC-033 step 6 once the item's pull request is merged the issue is closed with a link to the pull request and the item", async () => {
  const w = startWorld({ pulls: (branch) => (/^JOB-/.test(branch ?? "") ? pullOf(branch, "merged") : null), facts: async () => ({ pullRequest: null, commits: [], files: [], reviews: [], checks: [], read: async () => null }),
    product: { [itemPath("ITM-901", "Export drops the last page")]: itemText({ id: "ITM-901", title: "Export drops the last page", origin: [ADDRESS(6)] }), [`docs/jobs/${JOB}.md`]: jobRecord(JOB, "implement", "ITM-901"), [`docs/jobs/${FIX}.md`]: jobRecord(FIX, "fix-bug", ADDRESS(9)) } });
  const nine = await openIssue(w, 9);
  assert.equal(byClass(nine, "close-with-links").length, 1, "known positive: the fix of a bug offers the close");
  await trusted(one(nine, "close-with-links"));
  await waitFor(() => issueNow(w, 9).state === "closed");
  assert.deepEqual(issueNow(w, 9).comments, [`Closed with ${PRODUCT_URL}/pull/9.`]);

  const six = await openIssue(w, 6);
  assert.equal(byClass(six, "close-with-links").length, 1, "the item's merged pull request offers the close");
  await trusted(one(six, "close-with-links"));
  await waitFor(() => issueNow(w, 6).state === "closed");
  assert.deepEqual(issueNow(w, 6).comments, [`Closed with ${PRODUCT_URL}/pull/9; item \`ITM-901\`.`]);
});
