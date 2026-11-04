// Release tests of UC-023 Modify the architecture, on the pages of the Architecture view: the requirements UC-023 realises whose check is a test and which the review pages carry —
// the impact list before a change is accepted, one file for each decision and module, the sections of a decision, a module as a folder, the origin of an artifact, the status derived from
// the records, the acceptance as the accepting person's commit, the dashboard's writes only on a click, the editor, the explanations and the identifier that survives a move.
// Run: node --test tests/release-uc-023-review-pages.test.mjs
//
// Module: MOD-review-pages
// Module: MOD-approvals
// Module: MOD-trace-graph
// Guards: UC-023
// Level: release
//
// Written for the release testing of sprint 126 by developer-sonnet-l (ITM-739), who implemented none of ITM-724, ITM-728, ITM-729, ITM-730 or ITM-731 (RELEASE TESTS ARE NOT WRITTEN BY THE
// IMPLEMENTER). The world is the harness of tests/uc-023-harness.mjs: MOD-site-frame's real page over the real review pages, GitHub and the participants served in memory. The release team
// works from the specification and the pages: each case ends at what a person reads on the page and at the commit the fake received. Readings the texts leave open, which the cases state:
//   - "the modules it designs, their code files and tests, and the requirements that reference it are shown beside the change" (AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST) is read as the
//     section <section class="change-impact"> of the page of a file changed since acceptance, which names the modules, their code files, their tests with what they guard, the requirements named
//     and no longer named, and the items.
//   - A file is a reviewed file of its kind where the Architecture view lists it as a row (<tr data-id>) of the kind's list.
//   - "the explanation that can be expanded" is a <details class="explain"> whose summary reads "What is this?".

import test from "node:test";
import assert from "node:assert/strict";
import { buttonsNamed } from "./review-pages-draft-world.mjs";
import { scripted } from "./review-pages-harness.mjs";
import { blobSha } from "../src/text-tools/index.mjs";
import { ACCEPTED, ARC1, ARC1_PATH, ARC2, ARC2_PATH, DESK_PATH, LOAN, SHELF, SYNC, SYNC_PATH, UC3, UC3_PATH, all, decision, edit, goTo, impactOf, lines, module_, namedButton, onFile, one, pageText,
  press, record, review, rest, scenario, send, typeInto } from "./uc-023-harness.mjs";

const SYNC_CHANGED = SYNC.replace("It synchronises the loans.", "It synchronises the loans, one way.");
const ARC1_CHANGED = ARC1.replace("one synchronisation module.", "one synchronisation module, with a retry.");
const rowsOf = (s) => all(s.target, "tr").map((row) => row.getAttribute("data-id")).filter(Boolean);
const statusOfRows = (s) => Object.fromEntries(all(s.target, "tr").filter((row) => row.getAttribute("data-id")).map((row) => [row.getAttribute("data-id"), all(row, "span", "badge")[0].textContent]));
const marksOf = (s) => all(s.target, "ol", "marks")[0]?.textContent ?? "";
const modulesOf = (impact) => all(impact, "li", "module").map((item) => [item.getAttribute("data-id"), all(item, "span", "module-head")[0].textContent,
  all(item, "p", "code-files")[0].textContent, all(item, "p", "tests")[0].textContent]);
const linesOfImpact = (impact) => impact.childNodes.filter((node) => node.nodeType === 1 && node.localName === "p" && node.className.split(" ").includes("small")).map((node) => node.textContent);
const acceptButtons = (s) => buttonsNamed(s.target, "Accept").filter((button) => !button.disabled);
const approvalOf = async (id, body) => `docs/approvals/${id}-${(await blobSha(body)).slice(0, 12)}.md`;

// TST-739101 · level: release · module: MOD-review-pages
// guards: AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST; UC-023
// given: ARC-001, which designs MOD-sync, MOD-desk and MOD-report, changed since its acceptance; code files, two tests that guard requirements, a backlog item and a plan step that name modules; known positive first — ARC-002 accepted and unchanged
// input: the reviewer opens ARC-001; and, where the graph of the commit is not stored on the branch trace-cache, opens it again
// expect: known positive — ARC-002's page shows no impact list and no Accept; ARC-001's page shows beside the change its modules MOD-desk, MOD-report and MOD-sync, each "changed", with their code files and their tests and what these guard (TST-9002 guards A BOOK IS SHELVED, TST-9001 guards A LOAN HAS A DUE DATE, MOD-report no test), the requirements named and no longer named (none) and the items ITM-901 and ITM-902; without the stored graph the page says the impact list could not be derived and offers no Accept
test("TST-739101: UC-023 an architecture change shows its impact list beside it, and is not offered for acceptance without it", async () => {
  const known = await scenario({ now: { [ARC1_PATH]: ARC1_CHANGED } });
  await onFile(known, "decision", "ARC-002");
  assert.equal(impactOf(known), null, "known positive: an unchanged decision has no impact list");
  assert.equal(acceptButtons(known).length, 0);

  await onFile(known, "decision", "ARC-001");
  const impact = impactOf(known);
  assert.ok(impact, "the impact list is on the page");
  assert.deepEqual(modulesOf(impact), [
    ["MOD-desk", "MOD-desk — changed", "Code files — src/desk/index.mjs", "Tests — TST-9002 (guards A BOOK IS SHELVED)"],
    ["MOD-report", "MOD-report — changed", "Code files — src/report/index.mjs", "Tests — none"],
    ["MOD-sync", "MOD-sync — changed", "Code files — src/sync/index.mjs, src/sync/pull.mjs", "Tests — TST-9001 (guards A LOAN HAS A DUE DATE)"],
  ]);
  assert.deepEqual(linesOfImpact(impact), ["Affected modules", "Requirements and use cases — newly named: — · no longer named: —", "Items — ITM-901, ITM-902"]);
  assert.equal(acceptButtons(known).length, 1, "with the list, Accept is offered");

  const without = await scenario({ now: { [ARC1_PATH]: ARC1_CHANGED }, graph: false });
  await onFile(without, "decision", "ARC-001");
  assert.match(pageText(without), /The impact list could not be derived/);
  assert.equal(acceptButtons(without).length, 0, "without the list the change is not offered for acceptance");
});

// TST-739102 · level: release · module: MOD-review-pages
// guards: ONE ARCHITECTURE DECISION, ONE FILE; ONE MODULE, ONE FILE; UC-023
// given: a product whose architecture is two decisions, ARC-001-sync.md and ARC-002-shelving.md, and four modules, each in docs/architecture/MOD-<slug>.md, and two files in that folder that follow neither name, notes.md and ARC-extra.md
// input: the reviewer opens the list of the architecture decisions and the list of the module files
// expect: the decisions are listed as ARC-001 and ARC-002, each by the identifier of its file, and the module files as MOD-desk, MOD-report, MOD-shelf and MOD-sync, each reviewed as the module its file's name gives; notes.md and ARC-extra.md are listed in neither
test("TST-739102: UC-023 each decision and each module is one file named by its identifier", async () => {
  const s = await scenario({ extra: { "docs/architecture/notes.md": "# Notes\n", "docs/architecture/ARC-extra.md": "# ARC-extra\n" } });
  await goTo(s, `#decision/product=${encodeURIComponent(s.address)}`);
  assert.deepEqual(rowsOf(s), ["ARC-001", "ARC-002"]);
  await goTo(s, `#module/product=${encodeURIComponent(s.address)}`);
  assert.deepEqual(rowsOf(s), ["MOD-desk", "MOD-report", "MOD-shelf", "MOD-sync"]);
  await onFile(s, "module", "MOD-sync");
  assert.match(pageText(s), /MOD-sync Synchronising loans/, "the file docs/architecture/MOD-sync.md is the module MOD-sync");
});

// TST-739103 · level: release · module: MOD-review-pages
// guards: A MODULE FILE IS REVIEWED AS AN ARCHITECTURE DECISION IS; STATUS IS DERIVED FROM THE RECORDS; UC-023
// given: ARC-002 changed since its acceptance and ARC-003 new, MOD-sync changed and MOD-extra new, the others accepted; a token
// input: the reviewer opens the list of decisions, the list of module files, and the page of the new and of the changed file of each
// expect: both lists give the same three statuses in the same words — accepted, open for the new file, changed since acceptance for the changed one; the changed file of each kind shows its difference to its last accepted text, and the new file of each none; the page of each new and each changed file offers Accept and Reject
test("TST-739103: UC-023 a module file is reviewed as a decision is: open, accepted, changed, with a difference, Accept and Reject", async () => {
  const ARC3_PATH = "docs/architecture/ARC-003-retry.md", EXTRA_PATH = "docs/architecture/MOD-extra.md";
  const s = await scenario({ now: { [ARC2_PATH]: ARC2.replace("A shelf module keeps the books.", "A shelf module keeps the books on shelves."), [SYNC_PATH]: SYNC_CHANGED },
    extra: { [ARC3_PATH]: decision("ARC-003", "Loans are retried", [LOAN], ["MOD-extra"], "Loans are retried."), [EXTRA_PATH]: module_("MOD-extra", "Extra", "src/extra/", { follows: "ARC-003" }) } });
  await goTo(s, `#decision/product=${encodeURIComponent(s.address)}`);
  assert.deepEqual(statusOfRows(s), { "ARC-001": "accepted", "ARC-002": "changed since acceptance", "ARC-003": "open" });
  await goTo(s, `#module/product=${encodeURIComponent(s.address)}`);
  assert.deepEqual(statusOfRows(s), { "MOD-desk": "accepted", "MOD-extra": "open", "MOD-report": "accepted", "MOD-shelf": "accepted", "MOD-sync": "changed since acceptance" });
  for (const [route, changed, fresh] of [["decision", "ARC-002", "ARC-003"], ["module", "MOD-sync", "MOD-extra"]]) {
    await onFile(s, route, changed);
    assert.equal(all(s.target, "section", "accepted-diff").length, 1, `${changed}: its difference`);
    assert.equal(acceptButtons(s).length, 1, `${changed}: Accept`);
    assert.equal(buttonsNamed(s.target, "Reject").length, 1, `${changed}: Reject`);
    await onFile(s, route, fresh);
    assert.equal(all(s.target, "section", "accepted-diff").length, 0, `${fresh}: no difference`);
    assert.equal(acceptButtons(s).length, 1, `${fresh}: Accept`);
    assert.equal(buttonsNamed(s.target, "Reject").length, 1, `${fresh}: Reject`);
  }
});

// TST-739104 · level: release · module: MOD-approvals
// guards: ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS; UC-023
// given: ARC-002 changed so that it is forced by UC-003, whose text no approval record names; then the same with a record naming UC-003
// input: the reviewer opens ARC-002 and, on the review page of the whole architecture, presses "Accept all 1 shown"
// expect: the page names UC-003 as what ARC-002 rests on and offers no Accept that can be pressed; the click on the review page writes nothing and names UC-003 as the reason ARC-002 was left out; with a record naming UC-003 (counter-proof) the page names nothing it rests on and Accept can be pressed
test("TST-739104: UC-023 a decision that names a use case that is not accepted cannot be accepted", async () => {
  const forced = ARC2.replace("  - UC-002\n", "  - UC-003\n");
  const s = await scenario({ now: { [ARC2_PATH]: forced } });
  await onFile(s, "decision", "ARC-002");
  assert.deepEqual(all(one(s.target, "section", "rests-on"), "li", "open-name").map((node) => node.textContent), ["UC-003"]);
  assert.equal(acceptButtons(s).length, 0);
  await onFile(s, "decision", "all");
  await press(s, namedButton(s.target, "Accept all 1 shown"));
  assert.equal(s.product.writes.length, 0);
  assert.match(pageText(s), /ARC-002: rests on what is not accepted \(UC-003\)/);

  const [recordPath, recordText] = await record("UC-003", "use-case", UC3_PATH, UC3);
  const accepted = await scenario({ now: { [ARC2_PATH]: forced }, extra: { [recordPath]: recordText } });
  await onFile(accepted, "decision", "ARC-002");
  assert.equal(all(accepted.target, "section", "rests-on").length, 0, "counter-proof: nothing it rests on is open");
  assert.equal(acceptButtons(accepted).length, 1);
});

// TST-739105 · level: release · module: MOD-review-pages
// guards: THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; UC-023
// given: MOD-sync changed since its acceptance, a token
// input: the pages of the list, of the file, of the review of the whole architecture and of the editor are drawn; a script clicks Accept; then a person clicks Accept
// expect: drawing the pages writes nothing; the script's click writes nothing; the person's click makes one commit
test("TST-739105: UC-023 the dashboard writes only as the result of a person's click", async () => {
  const s = await scenario({ now: { [SYNC_PATH]: SYNC_CHANGED } });
  for (const fragment of [`#decision/product=${encodeURIComponent(s.address)}`, `#module/id=MOD-sync/product=${encodeURIComponent(s.address)}`,
    `#decision/id=all/product=${encodeURIComponent(s.address)}`, `#module/id=MOD-sync/edit=1/product=${encodeURIComponent(s.address)}`]) {
    await goTo(s, fragment);
  }
  assert.equal(s.product.writes.length, 0, "drawing writes nothing");
  await onFile(s, "module", "MOD-sync");
  namedButton(s.target, "Accept").dispatchEvent(scripted());
  await rest(s);
  assert.equal(s.product.writes.length, 0, "a script's click writes nothing");
  await press(s, namedButton(s.target, "Accept"));
  assert.equal(s.product.writes.length, 1, "a person's click makes one commit");
});

// TST-739106 · level: release · module: MOD-approvals
// guards: STATUS IS DERIVED FROM THE RECORDS; UC-023
// given: MOD-sync accepted by a record that names its text; a token
// input: the reviewer saves MOD-sync with another text in the editor, reads the list; saves it again with the text the record names, reads the list
// expect: the list gives MOD-sync accepted before the first save, changed since acceptance after it, and accepted again after the second, with no record added by either save: a file counts as accepted exactly when a record names its current text
test("TST-739106: UC-023 a file is accepted exactly when a record names its current text", async () => {
  const s = await scenario({});
  const statusNow = async () => { await goTo(s, `#module/product=${encodeURIComponent(s.address)}`); return statusOfRows(s)["MOD-sync"]; };
  assert.equal(await statusNow(), "accepted");
  await edit(s, "module", "MOD-sync", () => SYNC_CHANGED);
  await press(s, namedButton(s.target, "Save"));
  assert.equal(await statusNow(), "changed since acceptance");
  await edit(s, "module", "MOD-sync", () => SYNC);
  await press(s, namedButton(s.target, "Save"));
  assert.equal(await statusNow(), "accepted");
  assert.ok(s.product.writes.every((write) => !Object.keys(write.files).some((path) => path.startsWith("docs/approvals/"))), "no save adds a record");
});

// TST-739107 · level: release · module: MOD-review-pages
// guards: A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN; UC-023
// given: a drafter that answers a new module file MOD-extra; a token
// input: the author describes a new module in the bar, presses Send, Review the draft and Save
// expect: Save makes one commit on the default branch main, holding MOD-extra's file and no approval record; the list of module files then gives MOD-extra as open
test("TST-739107: UC-023 a drafted module file enters the default branch as open", async () => {
  const extra = module_("MOD-extra", "Extra", "src/extra/", { follows: "ARC-001" });
  const s = await scenario({ answers: [{ files: [{ path: "docs/architecture/MOD-extra.md", text: extra, class: "new" }] }] });
  await onFile(s, "module", "MOD-sync");
  await send(s, "Add a module for extras", { participant: "drafter" });
  await review(s);
  await press(s, namedButton(s.target, "Save"));
  assert.equal(s.product.writes.length, 1);
  assert.deepEqual(Object.keys(s.product.writes[0].files), ["docs/architecture/MOD-extra.md"]);
  assert.ok(s.authorized.some((request) => request.path.endsWith("/git/refs/heads/main")), "on the default branch");
  await goTo(s, `#module/product=${encodeURIComponent(s.address)}`);
  assert.equal(statusOfRows(s)["MOD-extra"], "open");
});

// TST-739108 · level: release · module: MOD-approvals
// guards: ACCEPTANCE IS A COMMIT BY THE ACCEPTING PERSON; UC-023
// given: MOD-sync changed since acceptance; the reviewer's token for the product, named "github.com/reviewer"; then the same with no token for the product
// input: the reviewer presses Accept
// expect: one commit adds the approval record and nothing else, its message naming the person ("Accepted by github.com/reviewer."), and every write request carries the reviewer's token; without a token no Accept is offered, nothing is written, and GitHub's page for the record is linked (counter-proof)
test("TST-739108: UC-023 an acceptance is a commit made by the accepting person with their own token", async () => {
  const s = await scenario({ now: { [SYNC_PATH]: SYNC_CHANGED } });
  await onFile(s, "module", "MOD-sync");
  await press(s, namedButton(s.target, "Accept"));
  assert.equal(s.product.writes.length, 1);
  assert.deepEqual(Object.keys(s.product.writes[0].files), [await approvalOf("MOD-sync", SYNC_CHANGED)]);
  assert.deepEqual(lines(s.product.writes[0].message).slice(0, 3), ["accept MOD-sync (Agent M dashboard)", "", "Accepted by github.com/reviewer."]);
  const writes = s.authorized.filter((request) => request.method !== "GET");
  assert.ok(writes.length > 0 && writes.every((request) => /github_pat_FIXTURE_PRODUCT_0123456789$/.test(request.authorization ?? "")), JSON.stringify(writes));

  const without = await scenario({ now: { [SYNC_PATH]: SYNC_CHANGED }, token: false });
  await onFile(without, "module", "MOD-sync");
  assert.equal(acceptButtons(without).length, 0, "counter-proof: no token, no Accept");
  assert.equal(all(without.target, "a", "github-page").length, 1, "GitHub's page for the record is linked");
  assert.equal(without.product.writes.length, 0);
});

// TST-739109 · level: release · module: MOD-review-pages
// guards: EDITS ARE PREPARED ON THE DASHBOARD; UC-023
// given: ARC-001, accepted, whose Decision section holds a Mermaid diagram; a token
// input: the reviewer opens ARC-001 on its edit route, writes a sentence in the Decision section, and presses Save
// expect: the editor holds the file byte for byte; its live preview shows the diagram handed to the renderer, and shows the sentence once it is typed; Save makes one commit of ARC-001 alone with the edited text, and nothing was written before
test("TST-739109: UC-023 a decision is edited with a live preview, Mermaid included, and saved under the person's account", async () => {
  const s = await scenario({});
  const area = await edit(s, "decision", "ARC-001", (body) => body);
  assert.equal(area.value, ARC1);
  assert.equal(all(one(s.target, "div", "preview"), "div", "unrendered").length, 1, "the diagram is handed to the renderer");
  assert.match(all(one(s.target, "div", "preview"), "div", "unrendered")[0].textContent, /flowchart LR/);
  typeInto(area, ARC1_CHANGED);
  assert.match(one(s.target, "div", "preview").textContent, /one synchronisation module, with a retry\./, "the sentence is in the preview");
  assert.equal(s.product.writes.length, 0);
  await press(s, namedButton(s.target, "Save"));
  assert.equal(s.product.writes.length, 1);
  assert.deepEqual(s.product.writes[0].files, { [ARC1_PATH]: ARC1_CHANGED });
});

// TST-739110 · level: release · module: MOD-review-pages
// guards: EVERY STEP EXPLAINS ITSELF; UC-023
// given: MOD-sync changed since acceptance
// input: the reviewer opens the list of module files, the file, the review of the whole architecture and the editor
// expect: each of the four pages carries a folded explanation ("What is this?") with a text; the changed file's page also folds one in its difference, its impact list and its Reject
test("TST-739110: UC-023 every step of the architecture's pages carries a folded explanation", async () => {
  const s = await scenario({ now: { [SYNC_PATH]: SYNC_CHANGED } });
  const explained = (root) => all(root, "details", "explain").filter((node) => /^What is this\?/.test(node.textContent) && node.textContent.length > 60);
  for (const fragment of [`#module/product=${encodeURIComponent(s.address)}`, `#module/id=MOD-sync/product=${encodeURIComponent(s.address)}`,
    `#decision/id=all/product=${encodeURIComponent(s.address)}`, `#module/id=MOD-sync/edit=1/product=${encodeURIComponent(s.address)}`]) {
    await goTo(s, fragment);
    assert.ok(explained(s.target).length >= 1, `${fragment}: an explanation`);
  }
  await onFile(s, "module", "MOD-sync");
  assert.equal(explained(one(s.target, "section", "accepted-diff")).length, 1, "the difference explains itself");
  assert.equal(explained(impactOf(s)).length, 1, "the impact list explains itself");
  assert.equal(explained(one(s.target, "section", "reject")).length, 1, "Reject explains itself");
});

// TST-739111 · level: release · module: MOD-trace-graph
// guards: A MODULE IS A FOLDER; UC-023
// given: MOD-sync committed with the folder src/other/, which is not named after its identifier; known positive first — MOD-sync as accepted, with the folder src/sync/
// input: the author opens MOD-sync in the editor
// expect: known positive — the editor's marks name no rule of A MODULE IS A FOLDER; the marks name the module's folder as an error under A MODULE IS A FOLDER, and Save is still offered
test("TST-739111: UC-023 a module whose folder is not named after it is marked", async () => {
  const known = await scenario({});
  await edit(known, "module", "MOD-sync", (body) => body);
  assert.doesNotMatch(marksOf(known), /A MODULE IS A FOLDER/);

  const s = await scenario({ now: { [SYNC_PATH]: SYNC.replace("folder: src/sync/", "folder: src/other/") } });
  await edit(s, "module", "MOD-sync", (body) => body);
  assert.match(marksOf(s), /MOD-sync:\d+: error: .*\[A MODULE IS A FOLDER\]/);
  assert.equal(buttonsNamed(s.target, "Save")[0].disabled ?? false, false, "Save is still offered");
});

// TST-739112 · level: release · module: MOD-trace-graph
// guards: EVERY ARTIFACT NAMES ITS ORIGIN; UC-023
// given: ARC-001 committed so that it is forced by a name that no requirement and no use case has; known positive first — ARC-001 as accepted
// input: the author opens ARC-001 in the editor
// expect: known positive — no mark under EVERY ARTIFACT NAMES ITS ORIGIN; the editor marks the unknown name as an error under EVERY ARTIFACT NAMES ITS ORIGIN at its line, and Save is still offered
test("TST-739112: UC-023 a decision forced by a name that matches nothing is marked", async () => {
  const known = await scenario({});
  await edit(known, "decision", "ARC-001", (body) => body);
  assert.doesNotMatch(marksOf(known), /EVERY ARTIFACT NAMES ITS ORIGIN/);

  const s = await scenario({ now: { [ARC1_PATH]: ARC1.replace("  - A LOAN HAS A DUE DATE\n", "  - A RULE NO ONE WROTE\n") } });
  await edit(s, "decision", "ARC-001", (body) => body);
  assert.match(marksOf(s), /ARC-001:\d+: error: .*A RULE NO ONE WROTE.*\[EVERY ARTIFACT NAMES ITS ORIGIN\]/);
  assert.equal(buttonsNamed(s.target, "Save")[0].disabled ?? false, false);
});

// TST-739113 · level: release · module: MOD-review-pages
// guards: AN ARCHITECTURE DECISION STATES CONTEXT, DECISION, ALTERNATIVES AND CONSEQUENCES; UC-023
// given: ARC-002 accepted, in the editor
// input: the author deletes the section Alternatives from the text; then writes it back
// expect: with the section gone the editor marks the decision as an error that names the missing section; with it back the mark is gone, and Save is offered throughout
test("TST-739113: UC-023 a decision without one of its four sections is marked", async () => {
  const s = await scenario({});
  const area = await edit(s, "decision", "ARC-002", (body) => body);
  assert.doesNotMatch(marksOf(s), /Alternatives/, "known positive: the text as it stands has no such mark");
  typeInto(area, ARC2.replace(/## Alternatives\n\nOne module\.\n\n/, ""));
  assert.match(marksOf(s), /ARC-002:\d+: error: the section ## Alternatives is required, and missing \[AN ARCHITECTURE DECISION STATES CONTEXT, DECISION, ALTERNATIVES AND CONSEQUENCES\]/);
  assert.equal(buttonsNamed(s.target, "Save")[0].disabled ?? false, false);
  typeInto(area, ARC2);
  assert.doesNotMatch(marksOf(s), /Alternatives/);
});

// TST-739114 · level: release · module: MOD-approvals
// guards: THE NAME IS THE ID AND IT SURVIVES; UC-023
// given: ARC-001 accepted, its file moved to docs/architecture/ARC-001-synchronising.md with the same text and the same identifier
// input: the reviewer opens the list of decisions and the review of the whole architecture
// expect: ARC-001 is listed once, accepted, and the review page has nothing to review and lists no removed file: the identifier travelled with the artifact to the new file
test("TST-739114: UC-023 an identifier travels with its decision when the file is moved", async () => {
  const s = await scenario({ remove: [ARC1_PATH], extra: { "docs/architecture/ARC-001-synchronising.md": ARC1 } });
  await goTo(s, `#decision/product=${encodeURIComponent(s.address)}`);
  assert.deepEqual(statusOfRows(s), { "ARC-001": "accepted", "ARC-002": "accepted" });
  await onFile(s, "decision", "all");
  assert.match(pageText(s), /Nothing to review/);
  assert.doesNotMatch(pageText(s), /removed since acceptance/);
});
