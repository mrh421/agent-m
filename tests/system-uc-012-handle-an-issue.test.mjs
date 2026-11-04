// System tests of UC-012 "Handle an issue: bug fix or specification change": the main flow's change path, from the issue opened, analysed and its class confirmed to the change saved as a queue naming the issue and the
// issue moved into the backlog with the requirements that queue changes; the correction of a proposed class; the alternative flows 3a, 4a and 5a; and the class not reproducible. The bug path of the main flow and the
// alternative flow 5b are walked by tests/system-uc-012-fix-a-bug.test.mjs (TST-583401, TST-583402); TST-585201 maps every flow of UC-012 to the system test that walks it.
// Run: node --test tests/system-uc-012-handle-an-issue.test.mjs
//
// Module: MOD-maintenance-pages
// Module: MOD-issue-handling
// Guards: UC-012
// Level: system
//
// Written for ITM-585 by developer-opus-e, who implemented none of UC-012's items. The world is tests/uc-012-harness.mjs: the real route `issue` of MOD-maintenance-pages over the real MOD-issue-handling, MOD-job-catalogue,
// MOD-job-runner, MOD-runtimes, MOD-spec-changes and MOD-repository-hosts, behind a fake GitHub of alice/product and a model endpoint that answers as the participant local-llm. Each test states its input and its expected
// result in its own text (given / input / expect) from UC-012, before it runs; none reads an expected value from the page. The counter-proofs are recorded in the pull request. Readings the texts leave open, which the
// cases state:
//   - "the issue moves to the backlog (UC-033)" (step 6) is walked up to the item the move prefills from the saved queue; adding it is UC-033's, and accepting the queue UC-006's.
//   - 3a "the participant cannot tell bug from change" is read as an issue that names no requirement, so that the participant receives the whole SPEC, and whose case it covers none of: the kind's instruction tells it that
//     a missing requirement is a change, it proposes change, and the issue then takes the change path.
//   - 5a "the author sees the old and the new expectation side by side before merging" is read on the issue's page, from the fix job's open pull request.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { ADDRESS, PRODUCT_URL, analysed, buttonsOf, byClass, changeOf, decided, drafted, fixOf, flush, issueNow, issueOf, issueWrites, jobFiles, one, open, queueFiles, queued,
  restoreWorld, saved, start, textOf, trusted, waitFor, walk, writtenFiles } from "./uc-012-harness.mjs";

// The map reads files only and draws no page, so that there is no world to put back after it.
afterEach(() => { if (globalThis.document) restoreWorld(); });

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const SELF = "tests/system-uc-012-handle-an-issue.test.mjs";
const BUG = "tests/system-uc-012-fix-a-bug.test.mjs";

// ---------------------------------------------------------------- the map

// Each flow of UC-012, with the system test that walks it.
const FLOWS = {
  "main flow, bug (steps 1 to 5)": [[BUG, "TST-583401"]],
  "main flow, change (steps 1 to 4 and 6)": [[SELF, "TST-585202"]],
  "step 4, a class corrected": [[SELF, "TST-585203"]],
  "step 3, not reproducible": [[SELF, "TST-585206"]],
  "3a": [[SELF, "TST-585204"]],
  "4a": [[SELF, "TST-585205"]],
  "5a": [[SELF, "TST-585207"]],
  "5b": [[BUG, "TST-583402"]],
};

// TST-585201 · level: system · module: system
// guards: UC-012
// given: UC-012 as committed text, whose alternative flows are 3a, 5a, 5b and 4a, and the system tests named in FLOWS
// input: read UC-012's alternative flows, and the declarations of the test files named for each flow
// expect: known positive — UC-012 names the four alternative flows 3a, 5a, 5b and 4a; FLOWS holds each of them and the main flow's bug and change paths; each test named stands in its file with the level system and guards UC-012
test("TST-585201: UC-012 every flow has a system test that walks it", () => {
  const text = read("docs/use-cases/UC-012-turn-an-issue-into-a-specification-change.md");
  const alternatives = [...text.matchAll(/^- \*\*(\d+[a-z])\. /gm)].map((match) => match[1]);
  assert.deepEqual(alternatives, ["3a", "5a", "5b", "4a"], "known positive: UC-012's alternative flows");
  for (const flow of alternatives) assert.ok(Object.keys(FLOWS).includes(flow), `${flow} has a system test`);
  for (const [flow, tests] of Object.entries(FLOWS)) {
    for (const [file, id] of tests) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${flow}: ${file} exists`);
      const declared = testDeclarations(file, read(file)).find((each) => each.id === id);
      assert.ok(declared, `${flow}: ${id} is declared in ${file}`);
      assert.equal(declared.level, "system", `${id} is a system test`);
      assert.ok((declared.guards ?? []).includes("UC-012"), `${id} guards UC-012`);
    }
  }
});

// ---------------------------------------------------------------- the main flow, the change path

const NAMING = "The export is cut off after the second page; FIRST RULE says nothing about page counts (UC-001, TST-001).";
const CANDIDATE = { name: "EVERY EXPORT KEEPS ALL PAGES", rule: "An export holds every page of the document.", check: "tests/unit.test.mjs", constrains: "product", passage: "the export is cut off after the second page", class: "new" };
const PROPOSE_CHANGE = { class: "change", reasoning: "The SPEC says nothing about how many pages an export keeps: a requirement is missing." };

// TST-585202 · level: system · module: system
// guards: UC-012; EVOLUTION ENTERS THROUGH THE SPECIFICATION; EVERY ARTIFACT NAMES ITS ORIGIN
// given: the open issue 5 of alice/product, not classified, whose text names FIRST RULE, UC-001 and TST-001; local-llm analyses it as a change and drafts the new requirement EVERY EXPORT KEEPS ALL PAGES; the product links the person's own source SRC-alice
// input: step 2 — the author opens the issue and has local-llm analyse it; step 4 — confirms the class change with one click; step 6 — drafts the change with local-llm and saves it; then Move to backlog
// expect: step 2: the analysis sends the issue's title and text, FIRST RULE's rule "The first rule holds.", the use case UC-001's file and the test file of TST-001; step 3: the page shows "The participant proposes: change" and the reasoning; step 4: the issue carries the label change and neither defect nor not-reproducible, the page says "Confirmed as change."; it offers the change and no fix; step 6: Save writes one queue under docs/spec-freigaben/ whose index names "**Issue:** #5 of https://github.com/alice/product" and whose entry holds EVERY EXPORT KEEPS ALL PAGES; SPEC.md is not written; the issue stays open; the move then prefills an item whose origin is https://github.com/alice/product/issues/5 and which realises EVERY EXPORT KEEPS ALL PAGES
test("TST-585202: UC-012 a change is analysed, confirmed with one click, saved as a queue naming the issue, and moved to the backlog with what it changes", async () => {
  const w = start({ issues: [issueOf(5, NAMING)], analysis: PROPOSE_CHANGE, change: { candidates: [CANDIDATE] } });
  const detail = await analysed(await open(w, 5));
  const sent = JSON.stringify(w.kept.endpoint[0].body);
  for (const wanted of ["Export loses pages 5", "cut off after the second page", "The first rule holds.", "# UC-001 First", "a store reads"]) assert.ok(sent.includes(wanted), `the analysis receives ${wanted}`);
  assert.equal(textOf(one(detail, "proposed-class")), "The participant proposes: change");
  assert.equal(textOf(one(detail, "proposed-reasoning")), PROPOSE_CHANGE.reasoning);

  await decided(detail, "change");
  assert.deepEqual([...issueNow(w, 5).labels].sort(), ["change"]);
  assert.equal(textOf(one(detail, "issue-classified")), "Confirmed as change.");
  await waitFor(() => changeOf(detail) !== undefined);
  assert.ok(changeOf(detail), "the change is offered");
  assert.equal(fixOf(detail), undefined, "no fix is offered for a change");

  await saved(await drafted(detail));
  const files = queueFiles(w);
  const index = files.find((entry) => entry.path.endsWith("/index.md"));
  assert.ok(index, `a queue is written: ${files.map((entry) => entry.path)}`);
  assert.ok(files.some((entry) => entry.path.endsWith(".begruendung.md") && entry.content.includes(`**Issue:** #5 of ${PRODUCT_URL}`)), "the entry's rationale names the issue");
  assert.ok(files.some((entry) => /\/\d\d-[^/]*\.md$/.test(entry.path) && !entry.path.endsWith(".begruendung.md") && entry.content.includes(CANDIDATE.name)), "the entry holds the requirement");
  assert.ok(!writtenFiles(w).some((entry) => entry.path === "SPEC.md"), "the SPEC is not written");
  assert.equal(issueNow(w, 5).state, "open");

  const move = byClass(detail, "issue-move")[0];
  await trusted(buttonsOf(move, "Move to backlog")[0]);
  await waitFor(() => byClass(move, "schema-form").length > 0 || byClass(move, "issue-problem").length > 0);
  assert.equal(byClass(move, "issue-problem").length, 0, textOf(move));
  const field = (key) => walk(walk(move, (node) => node.getAttribute?.("data-key") === key)[0], (node) => node.localName === "input")[0];
  assert.equal(field("origin").value, ADDRESS(5));
  assert.equal(field("realises").value, CANDIDATE.name);
});

// ---------------------------------------------------------------- step 4: a class corrected

const PROPOSE_BUG = { class: "bug", reasoning: "FIRST RULE holds, and the code breaks it: the export drops pages.", wrong: ["src/store/read.mjs"] };

// TST-585203 · level: system · module: system
// guards: UC-012; ONE CLICK PER DECISION
// given: the open issue 5, not classified; local-llm analyses it as a bug that src/store/read.mjs causes
// input: the author has local-llm analyse it, and corrects the class to change with one click
// expect: before the click the page offers "Confirm bug", "Correct to change" and "Correct to not reproducible"; after it the issue carries the label change alone, the page says "Corrected to change; the participant proposed bug." and offers the change and no fix; the click's requests to the issue only set its labels — the label change added, defect and not-reproducible removed — and it wrote no file
test("TST-585203: UC-012 the author corrects the class the participant proposed with one click", async () => {
  const w = start({ issues: [issueOf(5, NAMING)], analysis: PROPOSE_BUG });
  const detail = await analysed(await open(w, 5));
  assert.deepEqual(byClass(detail, "set-class").map(textOf), ["Confirm bug", "Correct to change", "Correct to not reproducible"]);
  const writes = issueWrites(w).length;
  const files = writtenFiles(w).length;
  await decided(detail, "change");
  assert.deepEqual([...issueNow(w, 5).labels].sort(), ["change"]);
  assert.equal(textOf(one(detail, "issue-classified")), "Corrected to change; the participant proposed bug.");
  await waitFor(() => changeOf(detail) !== undefined);
  assert.ok(changeOf(detail), "the change is offered");
  assert.equal(fixOf(detail), undefined, "no fix");
  assert.deepEqual(issueWrites(w).slice(writes).map(([method, path]) => `${method} ${path}`), ["POST /issues/5/labels", "DELETE /issues/5/labels/defect", "DELETE /issues/5/labels/not-reproducible"]);
  assert.equal(writtenFiles(w).length, files, "no file is written by the click");
});

// ---------------------------------------------------------------- 3a: the participant cannot tell bug from change

const SILENT = "Exports to the new archive format fail; nothing describes that format.";

// TST-585204 · level: system · module: system
// guards: UC-012; EVOLUTION ENTERS THROUGH THE SPECIFICATION
// given: the open issue 8, not classified, whose text names no requirement, use case or test; the SPEC covers no archive format; local-llm answers that the SPEC says nothing about the case and proposes change
// input: the author has local-llm analyse it and confirms the class change
// expect: the analysis receives the whole SPEC — FIRST RULE's and SECOND RULE's rules — and the kind's instruction that a missing requirement is a change, not a bug; the page proposes change; after the click the issue carries the label change, and the page offers the change and no fix
test("TST-585204: UC-012 3a a case the SPEC says nothing about is a change", async () => {
  const w = start({ issues: [issueOf(8, SILENT, { title: "Archive export fails" })], analysis: { class: "change", reasoning: "The SPEC says nothing about the archive format: a requirement is missing, so this is a change." } });
  const detail = await analysed(await open(w, 8));
  const sent = JSON.stringify(w.kept.endpoint[0].body);
  for (const wanted of ["The first rule holds.", "The second rule holds.", "a missing requirement is a change, not a bug"]) assert.ok(sent.includes(wanted), `the analysis receives ${wanted}`);
  assert.equal(textOf(one(detail, "proposed-class")), "The participant proposes: change");
  await decided(detail, "change");
  assert.deepEqual([...issueNow(w, 8).labels].sort(), ["change"]);
  await waitFor(() => changeOf(detail) !== undefined);
  assert.ok(changeOf(detail), "the change is offered");
  assert.equal(fixOf(detail), undefined, "no fix");
});

// ---------------------------------------------------------------- 4a: the author rejects the issue

// TST-585205 · level: system · module: system
// guards: UC-012; ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the open issue 9, labelled change, with no comment
// input: the author opens it; Reject issue with the reason blank; the reason "Out of scope for this product." typed; Reject issue clicked by a script, then by the person
// expect: with the reason blank Reject issue is disabled; the script's click changes nothing; after the person's click the issue is closed with exactly one comment, the reason, and its labels unchanged (change); the requests that changed the issue are, in this order, the comment and the state closed, and no file was written to the product; the page says "The issue is closed with the reason: Out of scope for this product." and offers neither analysis nor decision
test("TST-585205: UC-012 4a a rejected issue is closed with its reason and nothing else changes", async () => {
  const w = start({ issues: [issueOf(9, NAMING, { labels: ["change"] })] });
  const detail = await open(w, 9);
  await waitFor(() => byClass(detail, "reject").length > 0);
  const reject = () => one(detail, "reject");
  assert.equal(reject().disabled, true, "no reason, no rejection");
  const reason = one(detail, "reject-reason");
  reason.value = "Out of scope for this product.";
  reason.dispatchEvent(new Event("input"));
  assert.equal(reject().disabled, false);
  reject().dispatchEvent(new Event("click"));
  await flush();
  assert.deepEqual(issueWrites(w), [], "a script's click writes nothing");
  await trusted(reject());
  await waitFor(() => byClass(detail, "issue-rejected").length > 0 || byClass(detail, "issue-problem").length > 0);
  const now = issueNow(w, 9);
  assert.equal(now.state, "closed");
  assert.deepEqual(now.comments, ["Out of scope for this product."]);
  assert.deepEqual(now.labels, ["change"]);
  assert.deepEqual(issueWrites(w).map(([method, path]) => `${method} ${path}`), ["POST /issues/9/comments", "PATCH /issues/9"]);
  assert.deepEqual(writtenFiles(w), [], "no file is written to the product");
  assert.equal(textOf(one(detail, "issue-rejected")), "The issue is closed with the reason: Out of scope for this product.");
  assert.equal(byClass(detail, "issue-analysis").length + byClass(detail, "issue-decision").length, 0);
});

// ---------------------------------------------------------------- step 3: not reproducible

// TST-585206 · level: system · module: system
// guards: UC-012
// given: the open issue 5, not classified; local-llm answers that it could not reproduce the issue and says what it tried
// input: the author has local-llm analyse it and confirms the class not reproducible
// expect: the page shows "The participant proposes: not reproducible" with what the participant tried; after the click the issue carries the label not-reproducible alone and stays open; the page offers neither the change, nor the fix, nor the move into the backlog
test("TST-585206: UC-012 not reproducible — the participant says what it tried, and the confirmed class starts no change and no fix", async () => {
  const tried = "I exported documents of one, two and ten pages with the current code; every page was kept.";
  const w = start({ issues: [issueOf(5, NAMING)], analysis: { class: "not-reproducible", reasoning: tried } });
  const detail = await analysed(await open(w, 5));
  assert.equal(textOf(one(detail, "proposed-class")), "The participant proposes: not reproducible");
  assert.equal(textOf(one(detail, "proposed-reasoning")), tried);
  await decided(detail, "not-reproducible");
  assert.deepEqual(issueNow(w, 5).labels, ["not-reproducible"]);
  assert.equal(issueNow(w, 5).state, "open");
  assert.equal(changeOf(detail), undefined);
  assert.equal(fixOf(detail), undefined);
  assert.equal(byClass(detail, "issue-move").length, 0);
});

// ---------------------------------------------------------------- 5a: the test was wrong, not the code

const declared = (id, guards, expect) => [`// ${id} · level: unit · module: MOD-store`, `// guards: ${guards}`, "// given: a store of three pages", "// input: the export", `// expect: ${expect}`, `test("${id}", () => {});`, ""].join("\n");
const TEXTS = {
  base: { "tests/store.test.mjs": declared("TST-100", "FIRST RULE", "the export holds two pages") },
  head: { "tests/store.test.mjs": declared("TST-100", "FIRST RULE", "the export holds three pages") },
};
const pullOf = (branch, state) => ({ number: 9, title: `${branch}: fix-bug`, branch, base: "main", head: "2".repeat(40), mergeCommit: state === "merged" ? "3".repeat(40) : null, state, draft: false,
  url: `${PRODUCT_URL}/pull/9`, opened: "2026-10-29T09:10:00Z", merged: state === "merged" ? "2026-10-29T09:50:00Z" : null, closed: state === "merged" ? "2026-10-29T09:50:00Z" : null, body: `Job: ${branch}` });

// TST-585207 · level: system · module: system
// guards: UC-012
// given: the open issue 5; local-llm analyses it as a bug; ci-bot can run code and tests; the fix's pull request #9, open, changes only the test file tests/store.test.mjs, whose TST-100 (guards FIRST RULE) expected "the export holds two pages" and now expects "the export holds three pages"
// input: the author confirms the bug and queues its fix with ci-bot (step 5); opens the issue again while #9 is open
// expect: the page names pull request #9 as open and shows one row: TST-100, FIRST RULE, "the export holds two pages" beside "the export holds three pages", the old before the new; it offers no Close with links before the merge
test("TST-585207: UC-012 5a the test was wrong — before the merge the author sees its old and new expectation side by side", async () => {
  const w = start({ issues: [issueOf(5, NAMING)], analysis: PROPOSE_BUG, pulls: (branch) => (/^JOB-/.test(branch ?? "") ? pullOf(branch, "open") : null),
    facts: async () => ({ pullRequest: pullOf("JOB", "open"), commits: [], files: [{ path: "tests/store.test.mjs", change: "modified" }], reviews: [], checks: [], read: async (path, side) => TEXTS[side][path] ?? null }) });
  const detail = await analysed(await open(w, 5));
  await decided(detail, "bug");
  await queued(detail);
  assert.equal(jobFiles(w).filter((entry) => entry.content.includes("kind: fix-bug")).length, 1, "the fix is queued");

  const again = await open(w, 5);
  await waitFor(() => byClass(again, "fix-expectations").length > 0 || byClass(again, "fix-no-expectation").length > 0 || byClass(again, "issue-problem").length > 0);
  assert.equal(byClass(again, "issue-problem").length, 0, textOf(one(again, "issue-problem") ?? again));
  assert.match(textOf(one(again, "fix-pull")), /pull request #9 is open/);
  const rows = walk(one(again, "fix-expectations"), (node) => node.localName === "tr" && node.getAttribute?.("data-test"));
  assert.deepEqual(rows.map((row) => walk(row, (node) => node.localName === "td").map(textOf).map((text) => text.trim())), [["TST-100", "FIRST RULE", "the export holds two pages", "the export holds three pages"]]);
  assert.equal(byClass(again, "close-with-links").length, 0, "no closing before the merge");
});
