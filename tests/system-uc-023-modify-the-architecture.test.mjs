// System coverage for UC-023 Modify the architecture, walked through the dashboard: the main flow by the route Edit and by the route Describe the change, and the alternative
// flows 1b, 2a, 4a, 4b, 4c and 5a. The page is MOD-site-frame's real `startPage` over MOD-review-pages, with the real prompt bar, MOD-job-runner, MOD-approvals and MOD-trace-graph
// over a fixture repository host and fixture participants (tests/uc-023-harness.mjs); no request leaves the process.
// Run: node --test tests/system-uc-023-modify-the-architecture.test.mjs
//
// Module: MOD-review-pages
// Module: MOD-approvals
// Module: MOD-trace-graph
// Module: MOD-job-runner
// Guards: UC-023
// Level: system
//
// Authored by developer-sonnet-l (ITM-739), who implemented none of ITM-724, ITM-728, ITM-729, ITM-730 or ITM-731.
// Where the pages and UC-023 disagree the case follows UC-023 and is marked { todo } with the finding it reports (UC023-S4); every other case is green. The findings:
//   UC023-S4  after Accept no list of the affected modules, each with the plan steps and backlog items that name it, is shown.
// Each test states its input and its expected values in its own text; none reads an expected result from the SPEC, a use case or an architecture file, but the flow map (TST-739001),
// which holds the expected passages itself and checks that UC-023 still says them.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { blobSha } from "../src/text-tools/index.mjs";
import { buttonsNamed, until } from "./review-pages-draft-world.mjs";
import { ACCEPTED, ARC1, ARC1_PATH, ARC2, ARC2_PATH, DESK, DESK_PATH, LOAN, REPORT, REPORT_PATH, SHELF_MOD, SHELF_PATH, SPEC, SYNC, SYNC_PATH, UC1, UC2, UC3, all, barOf, edit,
  goTo, impactOf, lines, module_, namedButton, onFile, one, pageText, press, readOriginal, review, scenario, send, statusOf, typeInto } from "./uc-023-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const exists = (path) => existsSync(new URL(`../${path}`, import.meta.url));
const UC = "docs/use-cases/UC-023-modify-the-architecture.md";
const SELF = "tests/system-uc-023-modify-the-architecture.test.mjs";
const RELEASE = "tests/release-uc-023-review-pages.test.mjs";
const RELEASE_JOB = "tests/release-uc-023-described-change.test.mjs";

// ---------------------------------------------------------------- the texts of the changes

const PULL_LINE = "- `pull(since) -> loans` — reads the loans since a time.";
// MOD-sync without the interface `pull`; MOD-desk, which uses it, is left as it was.
const SYNC_WITHOUT_PULL = module_("MOD-sync", "Synchronising loans", "src/sync/", { provides: ["push"], interfaces: ["- `push(loan) -> receipt` — sends a loan to the shelf."], sentence: "It synchronises the loans." });
// MOD-desk without its use of `pull`.
const DESK_WITHOUT_PULL = module_("MOD-desk", "The desk", "src/desk/", { realises: [LOAN, "UC-001"], provides: ["lend"], interfaces: ["- `lend(book) -> loan` — lends a book."] });
const ACCEPTED_BLOB = (path) => blobSha(ACCEPTED[path]);
const approvalOf = async (id, path, body) => `docs/approvals/${id}-${(await blobSha(body)).slice(0, 12)}.md`;
const writtenPaths = (write) => Object.keys(write.files).sort();
const modulesOf = (impact) => all(impact, "li", "module").map((item) => [item.getAttribute("data-id"), all(item, "span", "module-head")[0].textContent,
  all(item, "p", "code-files")[0].textContent, all(item, "p", "tests")[0].textContent]);
const linesOfImpact = (impact) => impact.childNodes.filter((node) => node.nodeType === 1 && node.localName === "p" && node.className.split(" ").includes("small")).map((node) => node.textContent);
const sentTo = (request) => request.body.messages.map((message) => message.content).join("\n");
// The bar's participant is also the reviewer of a change described in the bar (NO REVIEWER IS THE DRAFTER), so the one endpoint is asked in both parts. A request is the reviewer's
// when it carries the first sentence of review-architecture's prompt; `drafting(...drafts)` answers it with no finding and the drafter's requests with the drafts in turn.
const REVIEW_PROMPT = "You review a complete architecture draft against the whole SPEC";
const asReviewer = (request) => sentTo(request).includes(REVIEW_PROMPT);
const drafting = (...drafts) => [(requests) => (asReviewer(requests.at(-1)) ? { findings: [] }
  : drafts[Math.min(requests.filter((request) => !asReviewer(request)).length - 1, drafts.length - 1)])];
const headingOf = (path) => read(path).split("\n").find((line) => /^# Chapter/.test(line));

// ---------------------------------------------------------------- the flow map

// The passages of UC-023 the system test walks, each with the tests that walk it; the parts the pages do otherwise are findings, each a todo test that fails now and names what the page does instead.
const FLOW_EVIDENCE = {
  "main-1-edit": { uc: "**Edit** — the dashboard's editor with live preview, Mermaid included;", evidence: [[SELF, "TST-739002"], [RELEASE, "TST-739109"]] },
  "main-1-describe": { uc: "**Describe the change** — a text field", evidence: [[SELF, "TST-739003"]] },
  "main-2-whole-project": { uc: "Agent M sends the description with the entire project", evidence: [[SELF, "TST-739003"], [RELEASE_JOB, "TST-739204"]] },
  "main-3-save": { uc: "presses **Save** — one click.", evidence: [[SELF, "TST-739002"], [SELF, "TST-739003"]] },
  "main-4-impact-list": { uc: "**The impact list.** When a reviewer opens a changed decision", evidence: [[SELF, "TST-739002"], [RELEASE, "TST-739101"]] },
  "main-5-accept": { uc: "The reviewer presses **Accept** — one click.", evidence: [[SELF, "TST-739002"]] },
  "main-5-restructuring": { uc: "**Accept all N shown** for all of them in one commit", evidence: [[SELF, "TST-739004"]] },
  "2-changes-under-existing-identifiers": { uc: "The participant returns changes under the existing identifiers", evidence: [[SELF, "TST-739010"]] },
  "2-reviewing-participant": { uc: "in the prompt bar, the bar's participant derives and reviews the change", evidence: [[SELF, "TST-739011"]] },
  "2-checked-as-a-whole": { uc: "a change that concerns more than one module together with the whole architecture", evidence: [[RELEASE_JOB, "TST-739209"]] },
  "1b-split-or-merge": { uc: "**1b. The author splits or merges modules.**", evidence: [[SELF, "TST-739004"]] },
  "2a-new-identifier": { uc: "**2a. The participant proposes a new identifier for something that exists.**", evidence: [[SELF, "TST-739005"]] },
  "4a-breaks": { uc: "marked *breaks*; accepting stays possible", evidence: [[SELF, "TST-739006"]] },
  "4b-not-accepted": { uc: "**4b. The changed file names a requirement or use case that is not accepted.**", evidence: [[SELF, "TST-739007"]] },
  "4b-accept-disabled": { uc: "*Accept* stays disabled and names it.", evidence: [[SELF, "TST-739012"]] },
  "4c-no-code-yet": { uc: "The list says \"no code yet\"", evidence: [[SELF, "TST-739008"]] },
  "5a-edit-before-accepting": { uc: "**5a. The reviewer edits before accepting.**", evidence: [[SELF, "TST-739009"]] },
  "6-affected-modules-with-their-steps": { uc: "Agent M lists the affected modules, each with the steps of the implementation plan or the backlog items that name it.", evidence: [[SELF, "TST-739013"]] },
  "postcondition-code-unchanged": { uc: "Code still reflects the old architecture until an implementation job changes it.", evidence: [[SELF, "TST-739002"], [SELF, "TST-739004"]] },
};
const FLOW_FINDINGS = {
};

// TST-739001 · level: system · module: MOD-review-pages
// guards: UC-023
// given: UC-023 as committed text, the executable tests named in FLOW_EVIDENCE and the findings named in FLOW_FINDINGS
// input: compare every passage of the main flow and of the alternative flows 1b, 2a, 4a, 4b, 4c and 5a with its executable evidence or its finding
// expect: every named passage stands in UC-023; every evidence file exists and contains its TST id; every finding's test stands in its file with the todo naming the finding
test("TST-739001: UC-023 system coverage names the main flow and each required alternative", () => {
  const uc = read(UC).replace(/\s+/g, " ");
  for (const [flow, { uc: needle, evidence }] of Object.entries(FLOW_EVIDENCE)) {
    assert.ok(uc.includes(needle), `${flow}: UC-023 contains ${needle}`);
    assert.ok(evidence.length > 0, `${flow}: evidence is named`);
    for (const [file, id] of evidence) {
      assert.ok(exists(file), `${flow}: evidence file exists: ${file}`);
      assert.ok(read(file).includes(`// ${id} `), `${flow}: ${file} contains ${id}`);
    }
  }
  for (const [flow, { uc: needle, finding, file, test: id }] of Object.entries(FLOW_FINDINGS)) {
    assert.ok(uc.includes(needle), `${flow}: UC-023 contains ${needle}`);
    assert.ok(exists(file), `${flow}: ${file} exists`);
    assert.ok(read(file).includes(`// ${id} `), `${flow}: ${id} stands in ${file}`);
    assert.ok(read(file).includes(`todo: "FINDING ${finding} `), `${flow}: the todo of ${id} names FINDING ${finding}`);
  }
});

// ---------------------------------------------------------------- the main flow

// TST-739002 · level: system · module: MOD-review-pages
// guards: UC-023; EDITS ARE PREPARED ON THE DASHBOARD; AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST; ACCEPTANCE IS A COMMIT BY THE ACCEPTING PERSON; ONE CLICK PER DECISION
// given: the accepted module MOD-sync, which provides push and pull, with the module MOD-desk that uses pull and MOD-report that uses push, code files, two tests, a backlog item and a plan step that name modules, and a token of the author for the product
// input: the author opens MOD-sync, chooses Edit, removes the interface pull, presses Save; the reviewer opens MOD-sync again and presses Accept
// expect: nothing is written before Save; Save makes one commit on the head the editor opened, with the edited MOD-sync alone and no record, and MOD-sync is then changed since acceptance; the page shows the removed line against the accepted text and the impact list — MOD-desk first, marked breaks, with its code file and test, then MOD-sync, MOD-report not at all, ITM-901 and the plan step ITM-902 as items —; Accept makes one commit holding the record of the text shown and no code file, made with the reviewer's token and naming the reviewer; the old record stays; MOD-sync is then accepted
test("TST-739002: UC-023 1, 3, 4, 5 the author edits a module file and saves, the reviewer reads the impact list and accepts", async () => {
  const s = await scenario({});
  await onFile(s, "module", "MOD-sync");
  assert.equal(pageText(s).includes("accepted"), true);
  assert.equal(all(s.target, "a", "edit-link").length, 1, "the file offers the route Edit");
  await edit(s, "module", "MOD-sync", (body) => body.replace("  - pull\n", "").replace(`${PULL_LINE}\n`, ""));
  assert.equal(s.product.writes.length, 0, "nothing is written before Save");
  assert.ok(!one(s.target, "div", "preview").textContent.includes("pull(since)"), "the live preview shows the text as edited");
  const opened = s.product.head;
  await press(s, namedButton(s.target, "Save"));
  assert.equal(s.product.writes.length, 1, "Save is one click and one commit");
  assert.deepEqual(writtenPaths(s.product.writes[0]), [SYNC_PATH], "the edited file alone, no record");
  assert.equal(s.product.files[SYNC_PATH], SYNC_WITHOUT_PULL, "the text as edited");
  assert.notEqual(s.product.head, opened, "the default branch moved on");

  await onFile(s, "module", "MOD-sync");
  assert.match(pageText(s), /changed since acceptance/);
  const diff = one(s.target, "section", "accepted-diff");
  assert.deepEqual(all(diff, "span", "ddel").map((node) => node.textContent), ["-   - pull", `- ${PULL_LINE}`], "the lines removed against the accepted text");
  const impact = impactOf(s);
  assert.ok(impact, "the impact list is on the page");
  assert.deepEqual(modulesOf(impact), [
    ["MOD-desk", "MOD-desk breaks — uses an interface that is removed", "Code files — src/desk/index.mjs", "Tests — TST-9002 (guards A BOOK IS SHELVED)"],
    ["MOD-sync", "MOD-sync — changed", "Code files — src/sync/index.mjs, src/sync/pull.mjs", "Tests — TST-9001 (guards A LOAN HAS A DUE DATE)"],
  ]);
  assert.deepEqual(linesOfImpact(impact), ["Affected modules", "Requirements and use cases — newly named: — · no longer named: —", "Items — ITM-901, ITM-902"]);

  const shown = await blobSha(SYNC_WITHOUT_PULL);
  const written = s.product.writes.length;
  await press(s, namedButton(s.target, "Accept"));
  assert.equal(s.product.writes.length, written + 1, "Accept is one click and one commit");
  const accept = s.product.writes.at(-1);
  assert.deepEqual(writtenPaths(accept), [await approvalOf("MOD-sync", SYNC_PATH, SYNC_WITHOUT_PULL)], "the record alone, and no code file");
  assert.equal(accept.files[await approvalOf("MOD-sync", SYNC_PATH, SYNC_WITHOUT_PULL)], `kind: module\nfile: ${SYNC_PATH}\nblob: ${shown}\n`);
  assert.deepEqual(lines(accept.message).slice(0, 3), ["accept MOD-sync (Agent M dashboard)", "", "Accepted by github.com/reviewer."]);
  const writes = s.authorized.filter((request) => request.method !== "GET");
  assert.ok(writes.length > 0 && writes.every((request) => /github_pat_FIXTURE_PRODUCT_0123456789$/.test(request.authorization ?? "")), `every write carries the reviewer's token for the product: ${JSON.stringify(writes)}`);
  assert.ok(await approvalOf("MOD-sync", SYNC_PATH, ACCEPTED[SYNC_PATH]) in s.product.files, "the record of the old text stays");
  assert.equal(s.product.files["src/sync/pull.mjs"], ACCEPTED["src/sync/pull.mjs"], "no code changed");
  await onFile(s, "module", "MOD-sync");
  assert.equal(all(s.target, "span", "badge").map((node) => node.textContent)[0], "accepted");
});

// TST-739003 · level: system · module: MOD-review-pages
// guards: UC-023; THE ARCHITECTURE'S PARTICIPANTS RECEIVE THE WHOLE PROJECT; AN ARCHITECTURE JOB RECEIVES THE CHAPTERS ON MODELING, ARCHITECTURE, DESIGN AND IMPLEMENTATION; THE PAGE NAMES WHERE IT SENDS; A DRAFTED CHANGE IS SHOWN AGAINST THE CURRENT TEXT; AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT
// given: the accepted product of TST-739002; the participants drafter (model-a) and reviewer (model-b) offered by the bar; the drafter answers a change of MOD-sync (pull removed) and MOD-desk (no longer using pull), both under their existing identifiers
// input: the author opens MOD-sync, writes "Remove pull from MOD-sync; the desk no longer uses it" in the bar, presses Send with drafter, presses Review the draft, then Save
// expect: before Send nothing is sent; the bar names "drafter — this machine" as the destination; the one request to the drafter holds the whole SPEC, every use case, every architecture decision and module file and chapters 9 to 12 of the book, and not chapter 13; nothing is written until Save; the draft page shows both files against their current text, each with its impact list; Save is one commit holding both files, its message ending with Agent-M-Kind change-architecture, the participant drafter and its model model-a and no word of the instruction; MOD-sync and MOD-desk are then changed since acceptance
test("TST-739003: UC-023 1, 2, 3 the author describes the change, the participant drafts it with the whole project, the author saves it", async () => {
  const instruction = "Remove pull from MOD-sync; the desk no longer uses it";
  const s = await scenario({ answers: [{ files: [{ path: SYNC_PATH, text: SYNC_WITHOUT_PULL, class: "change", of: "MOD-sync" }, { path: DESK_PATH, text: DESK_WITHOUT_PULL, class: "change", of: "MOD-desk" }] }] });
  await onFile(s, "module", "MOD-sync");
  assert.equal(s.endpointRequests.length, 0);
  await send(s, instruction, { participant: "drafter" });
  assert.match(statusOf(s).textContent, /^Sent to:drafter — this machine/);
  assert.ok(s.endpointRequests.length >= 1, "the drafter is asked");
  const sent = sentTo(s.endpointRequests[0]);
  for (const [what, held] of [["the SPEC", SPEC], ["UC-001", UC1], ["UC-002", UC2], ["UC-003", UC3], ["ARC-001", ARC1], ["ARC-002", ARC2], ["MOD-sync", SYNC], ["MOD-desk", DESK], ["MOD-report", REPORT], ["MOD-shelf", SHELF_MOD]]) {
    assert.ok(sent.includes(held), `${what} is in what the drafter is sent`);
  }
  for (const chapter of ["09_system-modeling.md", "10_architectural-design.md", "11_agentic-design-and-control-patterns.md", "12_implementation-and-version-control.md"]) {
    assert.ok(sent.includes(headingOf(`docs/sources/SRC-vibe-coding/2026-10-05/${chapter}`)), `${chapter} is in what the drafter is sent`);
  }
  assert.ok(!sent.includes(headingOf("docs/sources/SRC-vibe-coding/2026-10-05/13_software-testing.md")), "chapter 13 is not");
  assert.equal(s.product.writes.length, 0, "nothing is written by Send");

  await review(s);
  assert.match(s.location.hash, /^#draft\//);
  assert.equal(all(s.target, "div", "draft").length, 2, "both files are drafts on the page");
  assert.equal(all(s.target, "section", "change-impact").length, 2, "each with its impact list");
  assert.equal(s.product.writes.length, 0, "nothing is written before Save");
  await press(s, namedButton(s.target, "Save"));
  assert.equal(s.product.writes.length, 1, "Save is one commit");
  const [write] = s.product.writes;
  assert.deepEqual(writtenPaths(write), [DESK_PATH, SYNC_PATH]);
  assert.equal(write.files[SYNC_PATH], SYNC_WITHOUT_PULL);
  assert.equal(write.files[DESK_PATH], DESK_WITHOUT_PULL);
  const trailers = lines(write.message).filter((line) => /^Agent-M-/.test(line));
  assert.ok(trailers.includes("Agent-M-Kind: change-architecture") && trailers.includes("Agent-M-Participant: drafter") && trailers.includes("Agent-M-Model: model-a"), write.message);
  assert.ok(!write.message.includes("Remove pull"), "no word of the instruction");
  for (const path of [SYNC_PATH, DESK_PATH]) {
    await goTo(s, `#module/id=${path.slice(path.lastIndexOf("/") + 1, -3)}/product=${encodeURIComponent(s.address)}`);
    assert.match(pageText(s), /changed since acceptance/, path);
  }
});

// ---------------------------------------------------------------- the alternative flows

// The restructuring of 1b: MOD-sync is split into a reader and a writer. MOD-sync's file leaves the working tree and its code files stay in its folder; the two new modules have folders and
// identifiers of their own; ARC-001 designs them, MOD-desk uses the reader's pull and MOD-report the writer's push.
const READER = module_("MOD-sync-reader", "Reading loans", "src/sync-reader/", { provides: ["pull"], interfaces: ["- `pull(since) -> loans` — reads the loans since a time."], sentence: "It reads the loans." });
const WRITER = module_("MOD-sync-writer", "Writing loans", "src/sync-writer/", { provides: ["push"], interfaces: ["- `push(loan) -> receipt` — sends a loan to the shelf."], sentence: "It writes the loans." });
const READER_PATH = "docs/architecture/MOD-sync-reader.md", WRITER_PATH = "docs/architecture/MOD-sync-writer.md";
const ARC1_SPLIT = ARC1.replace("  - MOD-sync\n", "  - MOD-sync-reader\n  - MOD-sync-writer\n");
const DESK_ON_READER = DESK.replaceAll("MOD-sync.pull", "MOD-sync-reader.pull");
const REPORT_ON_WRITER = REPORT.replaceAll("MOD-sync.push", "MOD-sync-writer.push");
const EMPTY_BLOB = "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391";

// TST-739004 · level: system · module: MOD-review-pages
// guards: UC-023; AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; THE NAME IS THE ID AND IT SURVIVES
// given: MOD-sync split into MOD-sync-reader and MOD-sync-writer: its file removed, the two new module files, ARC-001, MOD-desk and MOD-report changed; the code files of src/sync/ and the test TST-9001 that names MOD-sync still stand
// input: the reviewer opens the review page of the whole architecture (#decision/id=all) and presses "Accept all 6 shown"
// expect: the page shows the six files — the three changed ones with their difference and impact list, the two new ones in full, MOD-sync as removed since acceptance with its accepted text as removed lines and an impact list that names every code file of src/sync/ and TST-9001; one click makes one commit holding six records, MOD-sync's naming the empty text's blob, and no code file; the old record of MOD-sync stays; no file carries the identifier MOD-sync again; the page then has nothing to review
test("TST-739004: UC-023 1b and 5 a split of a module is reviewed as a whole and accepted in one commit, its code untouched", async () => {
  const s = await scenario({ remove: [SYNC_PATH], now: { [ARC1_PATH]: ARC1_SPLIT, [DESK_PATH]: DESK_ON_READER, [REPORT_PATH]: REPORT_ON_WRITER }, extra: { [READER_PATH]: READER, [WRITER_PATH]: WRITER } });
  await onFile(s, "decision", "all");
  const sections = Object.fromEntries(all(s.target, "section", "review-file").map((node) => [node.getAttribute("data-id"), node]));
  assert.deepEqual(Object.keys(sections).sort(), ["ARC-001", "MOD-desk", "MOD-report", "MOD-sync", "MOD-sync-reader", "MOD-sync-writer"]);
  for (const id of ["ARC-001", "MOD-desk", "MOD-report"]) {
    assert.equal(all(sections[id], "section", "accepted-diff").length, 1, `${id}: its difference to the accepted text`);
    assert.equal(all(sections[id], "section", "change-impact").length, 1, `${id}: its impact list`);
  }
  for (const id of ["MOD-sync-reader", "MOD-sync-writer"]) {
    assert.equal(all(sections[id], "section", "accepted-diff").length, 0, `${id}: new, so no difference`);
    assert.match(sections[id].textContent, /It (reads|writes) the loans\./, `${id}: in full`);
  }
  const removed = sections["MOD-sync"];
  assert.equal(all(removed, "span", "badge")[0].textContent, "removed since acceptance");
  assert.ok(all(removed, "span", "ddel").some((node) => node.textContent === "- It synchronises the loans."), "its accepted text as removed lines");
  assert.equal(all(removed, "span", "dadd").length, 0, "and nothing added");
  const impact = one(removed, "section", "change-impact");
  assert.match(impact.textContent, /MOD-sync\s*— changed/);
  assert.match(impact.textContent, /Code files — src\/sync\/index\.mjs, src\/sync\/pull\.mjs/, "every code file of the folder");
  assert.match(impact.textContent, /Tests — TST-9001 \(guards A LOAN HAS A DUE DATE\)/, "and every test that still names it");

  await press(s, namedButton(s.target, "Accept all 6 shown"));
  assert.equal(s.product.writes.length, 1, "one click, one commit");
  const records = Object.entries(s.product.writes[0].files);
  assert.equal(records.length, 6, "six records and nothing else");
  assert.ok(records.every(([path]) => path.startsWith("docs/approvals/")), "no code file");
  assert.equal(s.product.writes[0].files["docs/approvals/MOD-sync-e69de29bb2d1.md"], `kind: module\nfile: ${SYNC_PATH}\nblob: ${EMPTY_BLOB}\n`, "the removal names the empty text");
  assert.ok(await approvalOf("MOD-sync", SYNC_PATH, ACCEPTED[SYNC_PATH]) in s.product.files, "the old record stays");
  assert.deepEqual(Object.keys(s.product.files).filter((path) => /\/MOD-sync\.md$/.test(path)), [], "the identifier is given to nothing else");
  assert.equal(s.product.files["src/sync/pull.mjs"], ACCEPTED["src/sync/pull.mjs"], "moving the code files is an implementation job");
  await onFile(s, "decision", "all");
  assert.match(pageText(s), /Nothing to review/);
});

const asDecision = (id, title) => ARC1.replace("id: ARC-001", `id: ${id}`).replace("title: Lending is synchronised", `title: ${title}`).replace("# ARC-001 Lending is synchronised", `# ${id} ${title}`);
const ARC1_RETRY = ARC1.replace("one synchronisation module.", "one synchronisation module, which retries.").replace("title: Lending is synchronised", "title: Lending is synchronised with a retry")
  .replace("# ARC-001 Lending is synchronised", "# ARC-001 Lending is synchronised with a retry");
const ARC9_PATH = "docs/architecture/ARC-009-lending-sync.md";

// TST-739005 · level: system · module: MOD-job-runner
// guards: UC-023; THE DERIVATION RULES HOLD FOR ARCHITECTURE; EXACT DUPLICATES ARE FOUND WITHOUT A MODEL; A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT; A CHANGE IS PROPOSED UNDER THE EXISTING NAME
// given: the accepted product; the drafter first answers a new decision ARC-009 with the title of ARC-001 and the class new, then, once told, ARC-001 itself changed
// input: the author opens ARC-001, describes the change in the bar, presses Send and then Review the draft
// expect: the endpoint is asked three times, twice as the drafter and once as the reviewer of the change, which the bar's own participant is (UC-023 2: in the prompt bar, the bar's participant derives and reviews the change; the reviewer answers no finding) — the first draft, a decision that refines no decision, lacks the decision stating the whole architecture, so no review starts for it, and the reviewer checks the corrected draft; the second request to the drafter carries the finding that ARC-009 states the title of the existing ARC-001, in the compiler's form; the draft the author sees holds ARC-001 alone, with the change, and no ARC-009; it shows two correction rounds and no finding left; Save commits ARC-001 alone
test("TST-739005: UC-023 2a a new identifier for something that exists is sent back and the author sees the change under the existing identifier", async () => {
  const s = await scenario({ answers: drafting({ files: [{ path: ARC9_PATH, text: asDecision("ARC-009", "Lending is synchronised"), class: "new" }] }, { files: [{ path: ARC1_PATH, text: ARC1_RETRY, class: "change", of: "ARC-001" }] }) });
  await onFile(s, "decision", "ARC-001");
  await send(s, "Let the sync retry", { participant: "drafter" });
  const asked = s.endpointRequests.filter((request) => !asReviewer(request)), reviewed = s.endpointRequests.filter(asReviewer);
  assert.deepEqual([asked.length, reviewed.length], [2, 1], "the drafter is asked once more, and the same participant reviews the corrected draft only: the first lacks the decision stating the whole architecture");
  assert.ok(sentTo(reviewed[0]).includes("one synchronisation module, which retries."), "the review is of the corrected draft");
  const again = sentTo(asked[1]);
  assert.ok(again.includes(`${ARC9_PATH}:1: error: "${ARC9_PATH}" states the title of the existing "ARC-001" and is classed new [EXACT DUPLICATES ARE FOUND WITHOUT A MODEL] — class it as duplicate of ARC-001`), again.slice(-1500));
  await review(s);
  assert.equal(all(s.target, "div", "draft").length, 1, "one file is drafted");
  assert.ok(!all(s.target, "div", "draft")[0].textContent.includes("ARC-009"), "the new identifier is in no draft");
  assert.match(pageText(s), /Correction rounds: 2/);
  assert.equal(all(s.target, "li", "left").length, 0, "no finding is left");
  assert.match(pageText(s), /one synchronisation module, which retries\./);
  await press(s, namedButton(s.target, "Save"));
  assert.deepEqual(writtenPaths(s.product.writes[0]), [ARC1_PATH], "ARC-001 alone is saved");
});

// TST-739006 · level: system · module: MOD-trace-graph
// guards: UC-023; AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST
// given: MOD-sync changed so that it no longer provides pull; MOD-desk uses pull, MOD-report uses push
// input: the reviewer opens MOD-sync and presses Accept
// expect: the impact list names MOD-desk first, marked breaks (one mark), then MOD-sync, and not MOD-report; Accept is offered and enabled; one click commits the record of the text shown
test("TST-739006: UC-023 4a a removed interface lists the module that uses it first, marked breaks, and accepting stays possible", async () => {
  const s = await scenario({ now: { [SYNC_PATH]: SYNC_WITHOUT_PULL } });
  await onFile(s, "module", "MOD-sync");
  const impact = impactOf(s);
  assert.deepEqual(modulesOf(impact).map(([id]) => id), ["MOD-desk", "MOD-sync"], "the breaking module first, the module that uses push not at all");
  assert.equal(all(impact, "span", "breaks").length, 1);
  const accept = buttonsNamed(s.target, "Accept");
  assert.equal(accept.length, 1);
  assert.ok(!accept[0].disabled, "Accept is enabled");
  await press(s, accept[0]);
  assert.deepEqual(writtenPaths(s.product.writes[0]), [await approvalOf("MOD-sync", SYNC_PATH, SYNC_WITHOUT_PULL)]);
});

const SHELF_ON_OPEN = SHELF_MOD.replace("  - A BOOK IS SHELVED\n", "  - A BOOK IS SHELVED\n  - UC-003\n");

// TST-739007 · level: system · module: MOD-approvals
// guards: UC-023; ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS; A MODULE FILE IS REVIEWED AS AN ARCHITECTURE DECISION IS
// given: MOD-shelf changed to realise UC-003, whose text no approval record names; known positive first — the same page for MOD-sync changed, which names nothing open
// input: the reviewer opens MOD-shelf, and presses "Accept all 1 shown" on the review page of the whole architecture
// expect: known positive — MOD-sync's page offers an enabled Accept and no section of what it rests on; MOD-shelf's page names UC-003 as what it rests on and offers no enabled Accept; nothing is written; the review page's click writes nothing and names UC-003 as the reason MOD-shelf was left out
test("TST-739007: UC-023 4b a file that names a use case that is not accepted cannot be accepted and names it", async () => {
  const known = await scenario({ now: { [SYNC_PATH]: SYNC_WITHOUT_PULL } });
  await onFile(known, "module", "MOD-sync");
  assert.equal(all(known.target, "section", "rests-on").length, 0);
  assert.equal(buttonsNamed(known.target, "Accept").filter((button) => !button.disabled).length, 1, "known positive: an enabled Accept");

  const s = await scenario({ now: { [SHELF_PATH]: SHELF_ON_OPEN } });
  await onFile(s, "module", "MOD-shelf");
  const rests = one(s.target, "section", "rests-on");
  assert.deepEqual(all(rests, "li", "open-name").map((node) => node.textContent), ["UC-003"]);
  assert.equal(buttonsNamed(s.target, "Accept").filter((button) => !button.disabled).length, 0, "no Accept can be pressed");
  await onFile(s, "decision", "all");
  await press(s, namedButton(s.target, "Accept all 1 shown"));
  assert.equal(s.product.writes.length, 0, "nothing is written");
  assert.match(pageText(s), /MOD-shelf: rests on what is not accepted \(UC-003\)/);
});

// TST-739008 · level: system · module: MOD-trace-graph
// guards: UC-023; AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST
// given: MOD-shelf changed in one sentence; its folder src/shelf/ holds no code file and no test exercises it; known positive first — MOD-sync changed, whose folder holds two code files
// input: the reviewer opens MOD-shelf
// expect: known positive — MOD-sync's list names its two code files; MOD-shelf's list names MOD-shelf as the one module, "Code files — no code yet" and "Tests — none"
test("TST-739008: UC-023 4c a module folder without code says no code yet", async () => {
  const known = await scenario({ now: { [SYNC_PATH]: SYNC_WITHOUT_PULL } });
  await onFile(known, "module", "MOD-sync");
  assert.equal(modulesOf(impactOf(known)).find(([id]) => id === "MOD-sync")[2], "Code files — src/sync/index.mjs, src/sync/pull.mjs");

  const s = await scenario({ now: { [SHELF_PATH]: SHELF_MOD.replace("It does one thing.", "It keeps the books.") } });
  await onFile(s, "module", "MOD-shelf");
  assert.deepEqual(modulesOf(impactOf(s)), [["MOD-shelf", "MOD-shelf — changed", "Code files — no code yet", "Tests — none"]]);
});

const SYNC_RETRY = SYNC.replace("It synchronises the loans.", "It synchronises the loans, and retries.");

// TST-739009 · level: system · module: MOD-review-pages
// guards: UC-023; EDITS ARE PREPARED ON THE DASHBOARD; AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST; AN APPROVAL NAMES THE EXACT TEXT
// given: MOD-sync changed so that it no longer provides pull, so that its list names MOD-desk as breaking
// input: the reviewer opens MOD-sync, edits it back to provide pull with a new sentence, presses Save, and presses Accept on the page that follows
// expect: before the edit the list names MOD-desk marked breaks; Save is one commit of MOD-sync alone; the list drawn again names MOD-sync alone, unmarked, with the sentence added against the accepted text; Accept records the blob of the edited text, not that of the text first changed
test("TST-739009: UC-023 5a an edit before accepting is saved as in step 3 and the impact list is derived again for the new text", async () => {
  const s = await scenario({ now: { [SYNC_PATH]: SYNC_WITHOUT_PULL } });
  await onFile(s, "module", "MOD-sync");
  assert.deepEqual(modulesOf(impactOf(s)).map(([id]) => id), ["MOD-desk", "MOD-sync"], "before the edit");
  await edit(s, "module", "MOD-sync", () => SYNC_RETRY);
  await press(s, namedButton(s.target, "Save"));
  assert.equal(s.product.writes.length, 1, "Save is one commit");
  assert.deepEqual(writtenPaths(s.product.writes[0]), [SYNC_PATH]);
  await onFile(s, "module", "MOD-sync");
  const impact = impactOf(s);
  assert.deepEqual(modulesOf(impact).map(([id, head]) => [id, head]), [["MOD-sync", "MOD-sync — changed"]], "derived again for the new text");
  assert.equal(all(impact, "span", "breaks").length, 0);
  assert.deepEqual(all(one(s.target, "section", "accepted-diff"), "span", "dadd").map((node) => node.textContent), ["+ It synchronises the loans, and retries."]);
  await press(s, namedButton(s.target, "Accept"));
  assert.deepEqual(writtenPaths(s.product.writes.at(-1)), [await approvalOf("MOD-sync", SYNC_PATH, SYNC_RETRY)], "the record names the edited text");
});

// ---------------------------------------------------------------- the findings

// TST-739010 · level: system · module: MOD-job-runner
// guards: UC-023; THE DERIVATION RULES HOLD FOR ARCHITECTURE; A CHANGE IS PROPOSED UNDER THE EXISTING NAME
// given: the drafter answers ARC-001 changed under its own identifier, class change of ARC-001, its title kept; known positive first — the same change with the title changed passes the check
// input: the author describes the change in the bar, presses Send and then Review the draft
// expect: known positive — the draft with a new title shows no finding left; the draft that keeps the title shows no finding left either, as UC-023 2 says the participant returns changes under the existing identifiers.
test("TST-739010: UC-023 2 a change returned under the existing identifier is not refused as a duplicate of itself", async () => {
  const known = await scenario({ answers: [{ files: [{ path: ARC1_PATH, text: ARC1_RETRY, class: "change", of: "ARC-001" }] }] });
  await onFile(known, "decision", "ARC-001");
  await send(known, "Let the sync retry", { participant: "drafter" });
  await review(known);
  assert.equal(all(known.target, "li", "left").length, 0, "known positive: a changed title passes");

  const kept = ARC1.replace("one synchronisation module.", "one synchronisation module, which retries.");
  const s = await scenario({ answers: [{ files: [{ path: ARC1_PATH, text: kept, class: "change", of: "ARC-001" }] }] });
  await onFile(s, "decision", "ARC-001");
  await send(s, "Let the sync retry", { participant: "drafter" });
  await review(s);
  assert.equal(all(s.target, "li", "left").length, 0, `no finding is left: ${pageText(s).slice(0, 600)}`);
});

// TST-739011 · level: system · module: MOD-review-pages
// guards: UC-023; AN ARCHITECTURE DRAFT IS CHECKED BEFORE A PERSON SEES IT; NO REVIEWER IS THE DRAFTER
// given: the participants drafter (model-a) and reviewer (model-b) offered by the bar, the drafter's endpoint answering the draft as the deriving participant and no finding as the reviewing one; known positive first — the drafter is asked
// input: the author describes a change in the bar, chooses drafter and presses Send; the page is read before the draft is opened
// expect: known positive — the drafter received the instruction; the bar's own model, drafter at model-a, is asked again as the reviewer of review-architecture, with the draft in what it is sent, before the author opens the draft, as UC-023 2 says in the prompt bar the bar's participant derives and reviews the change; no second participant is asked: the endpoint of reviewer (model-b) receives no request
test("TST-739011: UC-023 2 the change is checked by the bar's own participant as its reviewer before the author sees it", async () => {
  const s = await scenario({ answers: drafting({ files: [{ path: ARC1_PATH, text: ARC1_RETRY, class: "change", of: "ARC-001" }] }) });
  await onFile(s, "decision", "ARC-001");
  await send(s, "Let the sync retry", { participant: "drafter" });
  assert.ok(s.endpointRequests.some((request) => !asReviewer(request) && sentTo(request).includes("Let the sync retry")), "known positive: the drafter received the instruction");
  const reviewed = s.endpointRequests.filter(asReviewer);
  assert.ok(reviewed.length >= 1, "the bar's own participant is asked as the reviewer");
  assert.ok(sentTo(reviewed[0]).includes("which retries"), "with the draft, before the author has opened it");
  assert.deepEqual(s.reviewerRequests, [], "no second participant is asked");
});

// TST-739012 · level: system · module: MOD-review-pages
// guards: UC-023; ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS
// given: MOD-shelf changed to realise UC-003, which is not accepted; known positive first — the page names UC-003
// input: the reviewer opens MOD-shelf
// expect: known positive — the page names UC-003 as what is not accepted; UC-023 4b says Accept stays disabled and names it: a button Accept is on the page and is disabled
test("TST-739012: UC-023 4b Accept stays on the page, disabled, and names the use case", async () => {
  const s = await scenario({ now: { [SHELF_PATH]: SHELF_ON_OPEN } });
  await onFile(s, "module", "MOD-shelf");
  assert.deepEqual(all(one(s.target, "section", "rests-on"), "li", "open-name").map((node) => node.textContent), ["UC-003"], "known positive");
  const accept = buttonsNamed(s.target, "Accept");
  assert.equal(accept.length, 1, "Accept is on the page");
  assert.equal(accept[0].disabled, true, "and disabled");
});

// TST-739013 · level: system · module: MOD-review-pages
// guards: UC-023; AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST
// given: MOD-sync changed so that it no longer provides pull; ITM-901 (backlog) names MOD-sync and the plan step ITM-902 names MOD-desk; known positive first — before Accept the list names both items
// input: the reviewer presses Accept on MOD-sync
// expect: known positive — before Accept the list names "Items — ITM-901, ITM-902"; after Accept the page lists the affected modules, each with the item or plan step that names it: one list entry that names MOD-desk and ITM-902 and not ITM-901, and one that names MOD-sync and ITM-901 and not ITM-902
test("TST-739013: UC-023 6 after Accept the affected modules are listed, each with the plan steps or backlog items that name it", async () => {
  const s = await scenario({ now: { [SYNC_PATH]: SYNC_WITHOUT_PULL } });
  await onFile(s, "module", "MOD-sync");
  assert.deepEqual(linesOfImpact(impactOf(s)).slice(-1), ["Items — ITM-901, ITM-902"], "known positive");
  await press(s, namedButton(s.target, "Accept"));
  const entries = all(s.target, "li").map((node) => node.textContent);
  assert.ok(entries.some((entry) => entry.includes("MOD-desk") && entry.includes("ITM-902") && !entry.includes("ITM-901")), "MOD-desk with its plan step");
  assert.ok(entries.some((entry) => entry.includes("MOD-sync") && entry.includes("ITM-901") && !entry.includes("ITM-902")), "MOD-sync with its backlog item");
});
