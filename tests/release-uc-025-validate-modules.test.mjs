// Release tests of UC-025 Validate modules against specification and tests: one or more for each requirement UC-025 realises whose check is a test,
// each walked through the modules page as the reviewer reads it — the real route `trace` of MOD-trace-pages with the key `modules` over the real
// MOD-trace-graph and the fixture product of tests/uc-025-harness.mjs — and against what the product's repository holds. The cases never read the code files.
// UC-025's requirements guarded only at review (A MODULE STATES ITS RESPONSIBILITY AND ITS INTERFACES, A MODULE BELONGS TO ONE SUBSYSTEM) have no case here.
// Run: node --test tests/release-uc-025-validate-modules.test.mjs
//
// Module: MOD-trace-pages
// Module: MOD-trace-graph
// Guards: UC-025; MODULE GAPS ARE REPORTED, NOT FORBIDDEN; THE TRACEABILITY MATRIX IS DERIVED; EVERY ARTIFACT NAMES ITS ORIGIN; ONE ARCHITECTURE DECISION, ONE FILE; A MODULE IS A FOLDER; ONE MODULE, ONE FILE; ONE REVIEW LAYOUT FOR EVERY PRODUCT; STATUS IS DERIVED FROM THE RECORDS; A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION; THE NAME IS THE ID AND IT SURVIVES; DIAGRAMS ARE MERMAID IN MARKDOWN; A RUN EXECUTES THE PROCESS MODEL OVER A SELECTION; A RUN ENDS WITH THE VALIDATION OF ITS MODULES
// Level: release
//
// Written by developer-opus-f (ITM-741), who implemented none of ITM-692, ITM-720, ITM-721, ITM-210, ITM-735 and ITM-736 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER).
// Where the page and UC-025 disagree the case follows UC-025 and is marked { todo } with the finding it reports. The finding:
//   UC025-R1  the modules view cannot be drawn for a run's selection: it shows every module of the version.
// Readings the texts leave open, which the cases state:
//   - A RUN EXECUTES THE PROCESS MODEL OVER A SELECTION and A RUN ENDS WITH THE VALIDATION OF ITS MODULES are UC-025's through its goal, "A run (UC-043) ends
//     with this view for the modules it built": the view is asked for a selection through its params, as MOD-trace-pages gives a view its version and
//     filters in its `params`; `modules`, the modules of the selection separated by commas, is the name read here.
//   - THE TRACEABILITY MATRIX IS DERIVED: the module rows are the view's part of the matrix; derived means they follow from the files of the version shown.

import test from "node:test";
import assert from "node:assert/strict";
import { ADDRESS, ARC_002, MODULE_FILES, approvalPath, byClass, cellOf, click, find, gapsOf, hostOf, itemsOf, moduleDoc, open, product, rowOf, rowsOf, testFile, textOf } from "./uc-025-harness.mjs";

const gapKinds = (target) => gapsOf(target).map((gap) => `${gap.kind} ${gap.text.split(" — ")[0]}`);
const WRITES = ["commitFiles", "createBranch", "openPullRequest", "mergePullRequest", "startWorkflow", "createIssue", "createTag"];

// TST-741101 · level: release · module: system
// guards: UC-025; MODULE GAPS ARE REPORTED, NOT FORBIDDEN
// given: the fixture product, which has gaps of five kinds, behind a Host that records a call of any function that writes
// input: the reviewer opens Modules at main and presses each next step a gap offers
// expect: every gap is listed, the row of every module — those with a gap among them — and the diagram are drawn; each next step is a link to a route (#implement, or #decision ending in /product=<the product's address, percent-encoded>, ITM-1364) and starts nothing; no function that writes is called
test("TST-741101: UC-025 a module gap is shown and blocks nothing", async () => {
  const host = hostOf();
  const written = [];
  for (const name of WRITES) host[name] = async () => { written.push(name); };
  const { target, diagrams } = await open(host);
  assert.ok(gapsOf(target).length >= 5, gapKinds(target).join("; "));
  assert.deepEqual(rowsOf(target), ["MOD-mail", "MOD-news", "MOD-pages", "MOD-store"]);
  assert.equal(diagrams.length, 1);
  const links = byClass(target, "li", "module-gap").flatMap((item) => find(item, (node) => node.localName === "a"));
  assert.ok(links.length > 0, "known positive: a gap offers its next step");
  for (const link of links) {
    assert.ok(["#implement", `#decision/product=${encodeURIComponent(ADDRESS)}`].includes(link.getAttribute("href")), link.getAttribute("href"));
    await click(link);
  }
  assert.deepEqual(written, []);
});

// TST-741102 · level: release · module: system
// guards: UC-025; THE TRACEABILITY MATRIX IS DERIVED
// given: the fixture product, in which no test exercises MOD-mail; then the same product with tests/mail.test.mjs, which exercises MOD-mail; the product holds no matrix file
// input: the reviewer opens Modules at main for each version of the files
// expect: first MOD-mail's tests are none and the gap module-without-test of MOD-mail is listed; then its tests are TST-9004 and that gap is gone — the rows follow the files of the version shown, and neither version holds a file that stores them
test("TST-741102: UC-025 the module rows are derived from the files of the version, never stored", async () => {
  const before = product();
  const first = await open(hostOf(before));
  assert.deepEqual(itemsOf(cellOf(first.target, "MOD-mail", "module-tests")), []);
  assert.ok(gapKinds(first.target).includes("module-without-test MOD-mail"));
  const after = product({ "tests/mail.test.mjs": testFile("9004", "MOD-mail", "RULE ONE") });
  const second = await open(hostOf(after));
  assert.deepEqual(itemsOf(cellOf(second.target, "MOD-mail", "module-tests")), ["TST-9004"]);
  assert.ok(!gapKinds(second.target).includes("module-without-test MOD-mail"));
  for (const files of [before, after]) assert.deepEqual(Object.keys(files).filter((path) => /matrix|trace/i.test(path)), []);
});

// TST-741103 · level: release · module: system
// guards: UC-025; EVERY ARTIFACT NAMES ITS ORIGIN
// given: the fixture product, whose tests name the module they exercise (tests/store.test.mjs names MOD-store, tests/pages.test.mjs MOD-pages); and the same product in which MOD-news's file names RULE GHOST, which is no requirement
// input: the reviewer opens Modules at main for each
// expect: each test stands in the row of the module it names (TST-9001 for MOD-store, TST-9002 for MOD-pages) and in no other row; with RULE GHOST, the gap unknown-name of MOD-news names RULE GHOST
test("TST-741103: UC-025 a test is shown with the module it names, and a name that matches nothing is a gap", async () => {
  const { target } = await open();
  assert.deepEqual(itemsOf(cellOf(target, "MOD-store", "module-tests")), ["TST-9001"]);
  assert.deepEqual(itemsOf(cellOf(target, "MOD-pages", "module-tests")), ["TST-9002"]);
  assert.deepEqual(rowsOf(target).filter((id) => itemsOf(cellOf(target, id, "module-tests")).includes("TST-9001")), ["MOD-store"]);
  const ghost = await open(hostOf(product({ "docs/architecture/MOD-news.md": moduleDoc("MOD-news", { realises: ["RULE TWO", "RULE GHOST"], follows: ["ARC-002"] }) })));
  const gap = gapsOf(ghost.target).find((each) => each.kind === "unknown-name");
  assert.ok(gap, gapKinds(ghost.target).join("; "));
  assert.match(gap.text, /^MOD-news — [^]*RULE GHOST/);
});

// TST-741104 · level: release · module: system
// guards: UC-025; ONE ARCHITECTURE DECISION, ONE FILE
// given: the fixture product, in which ARC-002 is the one file docs/architecture/ARC-002-store-and-pages.md, accepted by a record naming its blob, and ARC-003 the one file docs/architecture/ARC-003-mail.md, open
// input: the reviewer opens Modules at main
// expect: a module's subsystem is the decision named by its identifier, with the status of that decision's one file: MOD-store "ARC-002 — accepted", MOD-mail "ARC-003 — open"
test("TST-741104: UC-025 a module's subsystem is a decision of one file, shown with that file's status", async () => {
  const { target } = await open();
  assert.equal(cellOf(target, "MOD-store", "module-subsystem").textContent, "ARC-002 — accepted");
  assert.equal(cellOf(target, "MOD-mail", "module-subsystem").textContent, "ARC-003 — open");
});

// TST-741105 · level: release · module: system
// guards: UC-025; A MODULE IS A FOLDER
// given: the fixture product with a second code file src/store/cache.mjs in MOD-store's folder and src/stray.mjs in no module's folder
// input: the reviewer opens Modules at main
// expect: MOD-store's code is src/store/cache.mjs and src/store/index.mjs, the files of its folder; src/stray.mjs is the gap code-without-module and in no row
test("TST-741105: UC-025 a module's code is the files of its folder; a file in no folder is a gap", async () => {
  const { target } = await open(hostOf(product({ "src/store/cache.mjs": "export const cache = 1;\n", "src/stray.mjs": "export const stray = 1;\n" })));
  assert.deepEqual(itemsOf(cellOf(target, "MOD-store", "module-code")), ["src/store/cache.mjs", "src/store/index.mjs"]);
  assert.ok(gapKinds(target).includes("code-without-module src/stray.mjs"), gapKinds(target).join("; "));
  for (const id of rowsOf(target)) assert.ok(!itemsOf(cellOf(target, id, "module-code")).includes("src/stray.mjs"), id);
});

// TST-741106 · level: release · module: system
// guards: UC-025; ONE MODULE, ONE FILE
// given: the fixture product, each module described by one file docs/architecture/MOD-<slug>.md
// input: the reviewer opens Modules at main and presses MOD-pages's name
// expect: each row's file is docs/architecture/<its identifier>.md; the opened row shows the text of that file ("The module MOD-pages", "Its one responsibility.")
test("TST-741106: UC-025 each module is described by its one file, which its row opens", async () => {
  const { target } = await open();
  for (const id of rowsOf(target)) assert.match(cellOf(target, id, "module-file").textContent, new RegExp(`^docs/architecture/${id}\\.md — `));
  await click(byClass(rowOf(target, "MOD-pages"), "button", "module-name")[0]);
  const opened = textOf(byClass(target, "tr", "module-opened")[0]);
  assert.match(opened, /The module MOD-pages/);
  assert.match(opened, /Its one responsibility\./);
});

// TST-741107 · level: release · module: system
// guards: UC-025; ONE REVIEW LAYOUT FOR EVERY PRODUCT
// given: the fixture product, with a further module file MOD-extra written at docs/modules/MOD-extra.md, outside docs/architecture/, and its approval record under docs/approvals/
// input: the reviewer opens Modules at main
// expect: the rows are the modules under docs/architecture/ — MOD-mail, MOD-news, MOD-pages, MOD-store —, MOD-extra is no row; MOD-store's status is read from its record under docs/approvals/ ("accepted")
test("TST-741107: UC-025 the view reads the modules and their records where the review layout puts them", async () => {
  const extra = moduleDoc("MOD-extra", { realises: ["RULE ONE"], follows: ["ARC-002"] });
  const { target } = await open(hostOf(product({ "docs/modules/MOD-extra.md": extra, [approvalPath("MOD-extra", extra)]: "kind: module\n" })));
  assert.deepEqual(rowsOf(target), ["MOD-mail", "MOD-news", "MOD-pages", "MOD-store"]);
  assert.equal(cellOf(target, "MOD-store", "module-file").textContent, "docs/architecture/MOD-store.md — accepted");
});

// TST-741108 · level: release · module: system
// guards: UC-025; STATUS IS DERIVED FROM THE RECORDS
// given: the fixture product, in which a record names the blob of MOD-store's file and of ARC-002's; then the same product with MOD-store's file and ARC-002's file changed after those records; then the product with the records removed
// input: the reviewer opens Modules at main for each
// expect: first MOD-store's file "accepted" and its subsystem "ARC-002 — accepted"; with the files changed "changed since acceptance" for both; with no record "open" for both
test("TST-741108: UC-025 the status of a module's file and of its subsystem follows the approval records", async () => {
  const accepted = await open();
  assert.equal(cellOf(accepted.target, "MOD-store", "module-file").textContent, "docs/architecture/MOD-store.md — accepted");
  assert.equal(cellOf(accepted.target, "MOD-store", "module-subsystem").textContent, "ARC-002 — accepted");
  const changedFiles = product({ "docs/architecture/MOD-store.md": `${MODULE_FILES["MOD-store"]}\nA line added.\n`,
    "docs/architecture/ARC-002-store-and-pages.md": `${ARC_002}\nA line added.\n` });
  const changed = await open(hostOf(changedFiles));
  assert.equal(cellOf(changed.target, "MOD-store", "module-file").textContent, "docs/architecture/MOD-store.md — changed since acceptance");
  assert.equal(cellOf(changed.target, "MOD-store", "module-subsystem").textContent, "ARC-002 — changed since acceptance");
  const unrecorded = await open(hostOf(product({ [approvalPath("MOD-store", MODULE_FILES["MOD-store"])]: null, [approvalPath("ARC-002", ARC_002)]: null })));
  assert.equal(cellOf(unrecorded.target, "MOD-store", "module-file").textContent, "docs/architecture/MOD-store.md — open");
  assert.equal(cellOf(unrecorded.target, "MOD-store", "module-subsystem").textContent, "ARC-002 — open");
});

// TST-741109 · level: release · module: system
// guards: UC-025; A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION
// given: the fixture product with its gaps (known positive: the page lists gaps and rows)
// input: the reviewer opens Modules at main
// expect: every gap begins with the identifier or the path of the artifact it concerns, and no row or gap names a section number, a "§" or a line number
test("TST-741109: UC-025 rows and gaps name artifacts by identifier, never by position", async () => {
  const { target } = await open();
  const gaps = gapsOf(target);
  assert.ok(gaps.length > 0 && rowsOf(target).length > 0, "known positive");
  for (const gap of gaps) assert.match(gap.text, /^(?:MOD-[a-z0-9-]+|ARC-\d+|TST-\d+|[A-Z][A-Z ]+[A-Z]|[\w./-]+\.\w+) — /, gap.text);
  const shown = [...gaps.map((gap) => gap.text), ...byClass(target, "tr", "module-row").map(textOf)].join("\n");
  assert.doesNotMatch(shown, /§|\bsection \d|\bline \d|:\d+\b/i);
});

// TST-741110 · level: release · module: system
// guards: UC-025; THE NAME IS THE ID AND IT SURVIVES
// given: the fixture product, in which MOD-store's file is moved to docs/architecture/MOD-store-renamed.md with its identifier MOD-store unchanged
// input: the reviewer opens Modules at main
// expect: the module keeps its row MOD-store, with its code src/store/index.mjs and its test TST-9001; its file is the new path; the use of MOD-store.read by MOD-pages still ends in its box (MOD_pages --> MOD_store) and no row or box is named after the file
test("TST-741110: UC-025 a module moved to another file keeps its identifier, and with it its row and its links", async () => {
  const { target, diagrams } = await open(hostOf(product({ "docs/architecture/MOD-store.md": null, "docs/architecture/MOD-store-renamed.md": MODULE_FILES["MOD-store"] })));
  assert.deepEqual(rowsOf(target), ["MOD-mail", "MOD-news", "MOD-pages", "MOD-store"]);
  assert.match(cellOf(target, "MOD-store", "module-file").textContent, /^docs\/architecture\/MOD-store-renamed\.md — /);
  assert.deepEqual(itemsOf(cellOf(target, "MOD-store", "module-code")), ["src/store/index.mjs"]);
  assert.deepEqual(itemsOf(cellOf(target, "MOD-store", "module-tests")), ["TST-9001"]);
  assert.match(diagrams[0], /\n {2}MOD_pages --> MOD_store\n/);
  assert.doesNotMatch(diagrams[0], /renamed/);
});

// TST-741111 · level: release · module: system
// guards: UC-025; DIAGRAMS ARE MERMAID IN MARKDOWN
// given: the fixture product
// input: the reviewer opens Modules at main
// expect: the component diagram is handed to Mermaid as one text that begins "flowchart LR", stands in the page in an element of class mermaid, and the page holds no image element and loads no image file for it
test("TST-741111: UC-025 the component diagram is Mermaid text, not an image file", async () => {
  const { target, diagrams } = await open();
  assert.equal(diagrams.length, 1);
  assert.match(diagrams[0], /^flowchart LR\n/);
  assert.equal(byClass(target, "div", "mermaid").length + byClass(target, "pre", "mermaid").length, 1);
  assert.deepEqual(find(target, (node) => node.localName === "img"), []);
});

// TST-741112 · level: release · module: system
// guards: UC-025; A RUN EXECUTES THE PROCESS MODEL OVER A SELECTION; A RUN ENDS WITH THE VALIDATION OF ITS MODULES
// given: the fixture product, and a run whose selection is MOD-store and MOD-pages (known positive: without a selection the view shows all four modules)
// input: the view a run ends with: Modules at main with the params' selection modules=MOD-store,MOD-pages
// expect: UC-025's goal, "A run (UC-043) ends with this view for the modules it built": the rows are MOD-pages and MOD-store alone, and no gap concerns MOD-mail or MOD-news. FINDING: the view takes no selection and shows every module
test("TST-741112: UC-025 a run ends with the view for the modules of its selection", { todo: "FINDING UC025-R1 — the modules view (src/trace-pages/flow.mjs, drawModules) reads only `key` and `ref` of its params and its descriptor (src/trace-pages/views.mjs) has no filter, so it cannot be drawn for a run's selection: it shows MOD-mail and MOD-news with their gaps too" }, async () => {
  assert.equal(rowsOf((await open()).target).length, 4, "known positive");
  const { target } = await open(hostOf(), { key: "modules", ref: "main", modules: "MOD-store,MOD-pages" });
  assert.deepEqual(rowsOf(target), ["MOD-pages", "MOD-store"]);
  assert.deepEqual(gapsOf(target).filter((gap) => /^MOD-(mail|news) — /.test(gap.text)), []);
});

