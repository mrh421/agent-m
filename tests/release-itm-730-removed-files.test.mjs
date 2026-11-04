// Release tests of ITM-730 — UC-023 step 5 on the architecture's Review all: a decision or module file removed since its acceptance is listed with its last accepted text against the empty text and its impact list, counted in *Accept all N shown*, and its removal is recorded in the same commit with the empty text's blob; a removal is left out as "changed since shown"
// when the head holds a file of its identifier again. The behaviour is UC-023 (docs/use-cases/UC-023-restructure-the-architecture.md, step 5: "every changed file with its difference and its impact list, every new file in full, every removed decision with its impact list, and **Accept all N shown** for all of them in one commit"),
// as docs/architecture/MOD-review-pages.md (`<k>/all`: "It also lists every decision or module file that `removedFiles` names, each with its impact list (`architectureImpact` with `after: null`) and the empty text as the text shown, so that *Accept all N shown* counts it and records its removal in the same commit") and docs/architecture/MOD-approvals.md
// (`removedFiles`; `acceptShown`: "A shown file with the empty text's blob is a removal: it is recorded, naming the empty text's blob, while the head holds no file of its identifier, and left out as "changed since shown" when the head holds one") state it.
// Run: node --test tests/release-itm-730-removed-files.test.mjs
//
// Module: MOD-review-pages
// Module: MOD-approvals
// Guards: AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; UC-023
// Level: release
//
// Written for the release testing of sprint 125 by a participant who implemented none of ITM-730 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The world is the one of the page tests (tests/app-harness.mjs: the real app src/site-frame/dashboard-app.mjs over a counting fake GitHub that serves the history of the approval records, the batch request and the commit a person's click makes), opened
// at #decision/id=all as a person opens the architecture's Review all, with a stored token; the product is built from the fixture tests/fixtures/architecture (SPEC, two use cases, ARC-001, MOD-reader) with a module MOD-counter that is new, MOD-reader accepted in an earlier text and edited since, and MOD-shelf, accepted and then removed, its code file src/shelf/index.mjs still in its folder.
// The implementer's cases (tests/approvals-removed-files.test.mjs, tests/review-pages-removed-files.test.mjs) take hosts of their own; these cases end at the page a person reads and at the commit the fake received. Readings the texts leave open, which the cases state:
//   - A file "of Review all" is a <section class="review-file"> of the page, told by its heading; the impact list is its <section class="change-impact">, which names the modules and "Code files — <paths>".
//   - "the head holds a file of its identifier again" is a file MOD-shelf.md put on the default branch after the page was drawn and before the click, which the fake takes as a commit of someone else.
//   - A file put back after its removal was accepted is not asserted here: the texts leave that case to an item of its own.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { blobSha } from "../src/text-tools/index.mjs";
import { repoServer, openDashboard } from "./app-harness.mjs";
import { recordText, approvalPath, reviewedRecord } from "./approval-records.mjs";

// ---------------------------------------------------------------- the product

const FIX = fileURLToPath(new URL("./fixtures/architecture/", import.meta.url));
const fixture = (path) => readFileSync(new URL(path, `file://${FIX}`), "utf8");
const EMPTY = "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391";
const UC1 = "docs/use-cases/UC-001-read-a-file.md", UC2 = "docs/use-cases/UC-002-show-the-status.md";
const ARC = "docs/architecture/ARC-001-static-client.md", READER = "docs/architecture/MOD-reader.md", COUNTER = "docs/architecture/MOD-counter.md", SHELF = "docs/architecture/MOD-shelf.md";
const module_ = (id, folder, sentence) => ["---", `id: ${id}`, `title: ${id} title`, `folder: ${folder}`, "realises:", "  - RULE ONE", "follows:", "  - ARC-001", "uses:", "provides:", "  - f", "---", `# ${id} ${id} title`, "",
  "## Responsibility", "", sentence, "", "## Parts", "", "- `index.mjs`", "", "## Data", "", "Nothing.", "", "## Interfaces", "", "- `f`", "", "## Files", "", "None.", "", "## Uses", "", "Nothing.", ""].join("\n");
const READER_NOW = fixture("docs/architecture/MOD-reader.md");
const READER_ACCEPTED = READER_NOW.replace("Reads the product's files", "Reads files");
const SHELF_TEXT = module_("MOD-shelf", "src/shelf/", "It keeps the books on a shelf.");
const COUNTER_TEXT = module_("MOD-counter", "src/counter/", "It counts the loans.");

/** The product: UC-001, UC-002 and ARC-001 accepted; MOD-reader accepted in an earlier text and edited since; MOD-counter new; MOD-shelf accepted and, unless `kept`, removed since (its earlier text is the server's history). */
async function product({ kept = false } = {}) {
  const files = { "SPEC.md": fixture("SPEC.md"), [UC1]: fixture(UC1), [UC2]: fixture(UC2), [ARC]: fixture(ARC), [READER]: READER_NOW, [COUNTER]: COUNTER_TEXT,
    "src/shelf/index.mjs": "export const f = 1;\n", "src/reader/index.mjs": "export const readFile = 1;\n", ...(kept ? { [SHELF]: SHELF_TEXT } : {}) };
  for (const [id, path, text] of [["UC-001", UC1, files[UC1]], ["UC-002", UC2, files[UC2]], ["ARC-001", ARC, files[ARC]], ["MOD-reader", READER, READER_ACCEPTED], ["MOD-shelf", SHELF, SHELF_TEXT]]) {
    files[approvalPath(id, await blobSha(text))] = recordText(reviewedRecord(path, await blobSha(text)));
  }
  return { files, history: [READER_ACCEPTED, SHELF_TEXT] };
}
const opened = async (options) => {
  const { files, history } = await product(options);
  const server = await repoServer({ files, history });
  return { server, page: await openDashboard({ server, hash: "#decision/id=all" }) };
};

// The files of Review all as the page draws them: heading -> the HTML of its section.
function filesOf(main) {
  const parts = main.split('<section class="review-file">').slice(1);
  return Object.fromEntries(parts.map((part) => [/<h3>(MOD-[a-z]+|ARC-\d+|UC-\d+)/.exec(part)[1], part]));
}
const impactOf = (section) => /<section class="change-impact">[\s\S]*?<\/section>/.exec(section)?.[0] ?? "";
// The records a commit holds: path -> text.
const recordsOf = (write) => Object.fromEntries(Object.entries(write.files).filter(([path]) => path.startsWith("docs/approvals/")));
const SHELF_RECORD = "docs/approvals/MOD-shelf-e69de29bb2d1.md";

// TST-730301 · level: release · module: MOD-review-pages
// guards: AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; UC-023
// given: a restructuring on main — MOD-reader changed since acceptance, MOD-counter new, MOD-shelf accepted and then removed, its code file src/shelf/index.mjs still in its folder —, ARC-001, UC-001 and UC-002 accepted, and a token; known positive first — the same product where MOD-shelf's file stands, accepted
// input: a person opens #decision/id=all
// expect: Review all shows MOD-counter in full, MOD-reader with its difference to its accepted text and its impact list, and MOD-shelf with the badge "removed since acceptance", its last accepted text as removed lines and nothing added, and its impact list naming MOD-shelf and the code file src/shelf/index.mjs; the button reads "Accept all 3 shown"; known positive — where MOD-shelf's file stands, the page shows MOD-counter and MOD-reader alone, no removed file, and the button reads "Accept all 2 shown"
// Planted fault: Review all listing no removed file (`const removed = kind.whole ? removedFiles(snapshot) : []` replaced by `const removed = []` in showAll of src/review-pages/flow.mjs) shows two files and "Accept all 2 shown", and the case fails on the files shown.
// Planted fault: the removed file drawn without its impact list (the `section.append(impact.problem ?? impact.shown)` of its branch left out) fails the case on the impact list naming the module.
// Planted fault: the removed file drawn against its own text in place of the empty one (`showDifference(last.text, "", WHOLE)` replaced by `showDifference(last.text, last.text, WHOLE)`) shows no removed line, and the case fails on the difference.
test("TST-730301 the architecture's Review all lists a removed module with its removed text and its impact list, and counts it", async () => {
  const kept = await opened({ kept: true });
  const keptFiles = filesOf(kept.page.main());
  assert.deepEqual(Object.keys(keptFiles).sort(), ["MOD-counter", "MOD-reader"], "known positive: with MOD-shelf's file standing, the page shows the two files that changed");
  assert.match(kept.page.main(), /Accept all 2 shown/, "known positive: the button counts the two");
  assert.doesNotMatch(kept.page.main(), /removed since acceptance/, "known positive: no file is removed");

  const { page } = await opened();
  const main = page.main();
  const shown = filesOf(main);
  assert.deepEqual(Object.keys(shown).sort(), ["MOD-counter", "MOD-reader", "MOD-shelf"]);
  assert.match(shown["MOD-counter"], /It counts the loans\./, "the new module file in full");
  assert.doesNotMatch(shown["MOD-counter"], /accepted-diff|change-impact/, "a new file has no difference and no impact list");
  assert.match(shown["MOD-reader"], /<h4>Changed since it was last accepted<\/h4>/, "the changed module file with its difference");
  assert.match(impactOf(shown["MOD-reader"]), /Impact of this change/, "and its impact list");
  const shelf = shown["MOD-shelf"];
  assert.match(shelf, /<span class="badge b-removed">removed since acceptance<\/span>/);
  assert.match(shelf, /<span class="ddel">- It keeps the books on a shelf\.<\/span>/, "its last accepted text as removed lines");
  assert.doesNotMatch(shelf, /<span class="dadd">/, "nothing added: the text shown is empty");
  assert.match(impactOf(shelf), /<strong>MOD-shelf<\/strong>/, "its impact list names the module");
  assert.match(impactOf(shelf), /Code files — src\/shelf\/index\.mjs/, "and the code file that still lies in its folder");
  assert.match(main, /Accept all 3 shown/);
});

// TST-730302 · level: release · module: MOD-review-pages
// guards: SEVERAL FILES ARE ACCEPTED IN ONE CLICK; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; UC-023
// given: the restructuring of TST-730301 on the default branch, and a token
// input: a person opens #decision/id=all and clicks "Accept all 3 shown"; then opens #decision/id=all again in a new load
// expect: one commit holds exactly three approval records — MOD-counter's and MOD-reader's, each naming its file and the blob shown, and docs/approvals/MOD-shelf-e69de29bb2d1.md of the three lines kind module, file docs/architecture/MOD-shelf.md and blob e69de29bb2d1d6434b8b29ae775ad8c2e48c5391, the empty text's —, and no other file; the page drawn after it shows no file; the new load shows no removed file and nothing to review
// Planted fault: the removal recorded with the blob of its last text (`blob: empty` replaced by `blob: await blobSha(last.text)` in the entry of the removed file in showAll of src/review-pages/flow.mjs) shown to acceptShown with another blob writes no record of the removal, and the case fails on the records of the commit (TST-730303 fails on its known positive).
// Planted fault: removedFiles not counting a record of the empty text as the acceptance of the removal (the `EMPTY_BLOB` test in removedFiles of src/approvals/status.mjs left out) lists MOD-shelf again in the page drawn after the commit, and the case fails there.
// Planted fault: the removal left out of the click's files (`records.push` of the removed branch of showAll left out) writes two records, and the case fails on the records of the commit (TST-730303 fails on its known positive).
test("TST-730302 Accept all records the removal with the empty text's blob in the same commit, and the removed file is listed no more", async () => {
  const { server, page } = await opened();
  assert.match(page.main(), /Accept all 3 shown/, "known positive: the three files are shown");
  await page.click("button.accept-all");

  assert.equal(server.writes.length, 1, "one commit");
  const records = recordsOf(server.writes[0]);
  const blob = (text) => blobSha(text);
  assert.deepEqual(Object.keys(records).sort(), [approvalPath("MOD-counter", await blob(COUNTER_TEXT)), approvalPath("MOD-reader", await blob(READER_NOW)), SHELF_RECORD].sort(), "one record for each of the three files shown");
  assert.equal(Object.keys(server.writes[0].files).length, 3, "and no other file");
  assert.equal(records[SHELF_RECORD], `kind: module\nfile: ${SHELF}\nblob: ${EMPTY}\n`, "the removal names the empty text's blob");
  assert.match(records[approvalPath("MOD-reader", await blob(READER_NOW))], new RegExp(`blob: ${await blob(READER_NOW)}`), "a changed file names the blob shown");
  assert.doesNotMatch(page.main(), /review-file/, "the page drawn after the commit shows no file");

  const again = await openDashboard({ server, hash: "#decision/id=all" });
  assert.doesNotMatch(again.main(), /removed since acceptance|MOD-shelf/, "the new load lists no removed file");
  assert.match(again.main(), /Nothing to review/);
});

// TST-730303 · level: release · module: MOD-approvals
// guards: SEVERAL FILES ARE ACCEPTED IN ONE CLICK; AN APPROVAL NAMES THE EXACT TEXT; UC-023
// given: the restructuring of TST-730301, shown to a person; before the click, another writer puts a file MOD-shelf.md on the default branch again; known positive first — the same page with nobody putting it back
// input: a person clicks "Accept all 3 shown"
// expect: with the file put back, one commit holds the records of MOD-counter and MOD-reader and none of MOD-shelf: docs/approvals/MOD-shelf-e69de29bb2d1.md is on the default branch nowhere, and the page names MOD-shelf as left out because it changed since it was shown; known positive — where nobody put the file back, the same click writes MOD-shelf's removal
// Planted fault: acceptShown recording a removal whatever the head holds (the check that the head holds no file of the identifier left out of the removal branch of acceptShown in src/approvals/accept.mjs) writes MOD-shelf's removal over the file put back, and the case fails on the commit.
test("TST-730303 a shown removal is left out as changed since shown when the head holds a file of its identifier again", async () => {
  const quiet = await opened();
  await quiet.page.click("button.accept-all");
  assert.ok(SHELF_RECORD in recordsOf(quiet.server.writes[0]), "known positive: with nobody putting the file back, the removal is recorded");

  const { server, page } = await opened();
  assert.match(page.main(), /Accept all 3 shown/);
  await server.change(SHELF, SHELF_TEXT);
  await page.click("button.accept-all");

  assert.equal(server.writes.length, 1, "one commit, of the files that stand");
  const records = recordsOf(server.writes[0]);
  assert.deepEqual(Object.keys(records).sort(), [approvalPath("MOD-counter", await blobSha(COUNTER_TEXT)), approvalPath("MOD-reader", await blobSha(READER_NOW))].sort(), "MOD-counter's and MOD-reader's records alone");
  assert.equal(SHELF_RECORD in server.files, false, "no record of MOD-shelf's removal on the default branch");
  assert.match(page.main(), /docs\/architecture\/MOD-shelf\.md was left out: changed since shown\./, "the page names MOD-shelf as left out because it changed since it was shown");
});
