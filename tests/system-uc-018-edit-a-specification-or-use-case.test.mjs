// System coverage for UC-018 Edit a specification or a use case in the dashboard, walked through the dashboard: the flow map (TST-376201) names, for every step of the main flow and every alternative flow, the
// executable tests that walk it, and the cases walk what no test walked as a whole — a use case opened from its page and edited with its marks and preview (1, 2, 3), saved and shown again (5, 6, 7); a requirement
// opened from the specification browser (1) and edited with its marks, Why and impact list (2, 3, 4), saved as an entry of the person's queue and opened beside the current section (5, 6, 7); the person's queue of
// the day (6); an open entry edited in place (1a); a rename (3a); a changed identifier (3b); a mark left (3c); a new requirement (3d); groups (3e); no token (4a); GitLab (4b); a text changed meanwhile (5a); another
// open proposal (6a); no write access (6b); leaving with unsaved changes (7a); and the folded What is this? of each editor. The pages are the real routes of MOD-review-pages and MOD-trace-pages over the real
// MOD-repository-hosts host of GitHub or of a GitLab server, MOD-spec-changes, MOD-artifact-edits and MOD-markdown-render, behind the fixture servers of tests/uc-018-harness.mjs and tests/uc-008-harness.mjs.
// No request leaves the process.
// Run: node --test tests/system-uc-018-edit-a-specification-or-use-case.test.mjs
//
// Module: MOD-review-pages
// Module: MOD-spec-changes
// Module: MOD-artifact-edits
// Module: MOD-trace-pages
// Guards: UC-018
// Level: system
//
// Authored by developer-opus-e (ITM-376), who built, among the code UC-018's flow runs, ITM-1273 (an entry's page and a requirement's editor read their own queue and the waiting queues: the other open
// proposals of 6a and the entry page of step 7) and ITM-1266 (a review page reads only the folders it shows); RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER binds level release, so these system cases may
// walk that behaviour, and the release file leaves it to the release tests other writers wrote. Where the dashboard and UC-018 disagree the case follows UC-018 and is marked `todo` with the word FINDING (named
// in FLOW_FINDINGS). Each case states its input and its expected values in its own text; none reads an expected result from the SPEC, a use case or an architecture file, but the flow map, which holds the
// expected passages itself and checks that UC-018 still says them. A person's click is an event dispatched on the element (tests/review-pages-harness.mjs marks it trusted); a script's is `scripted()`.
// Readings the texts leave open, which the cases state:
//   - "opens the new entry in the approval view" (7) is read as: the page links the new entry, and the entry's page shows the current section, the proposal and their difference.
//   - "the mark stays visible to the reviewer" (3c) is read as: a mark is derived from the text, so the editor opened again on the saved text shows it again.
//   - "each with its text on the clipboard" (4a) is read, for a requirement, as: each file's text stands beside its GitHub page, ready to copy.
//   - "the commit becomes a pull request that counts once merged" (6b) is GitHub's work once its page is open; the dashboard's part is to offer GitHub's pages and to write nothing.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { CARD, GROUPS, GROUPS_PATH, LENDING, LENDING_HEADING, LIBRARY_SPEC, LOAN, MEMBERSHIP, MEMBERSHIP_HEADING, SHELF, SPEC_HEAD, SPEC_TOKEN, UC1_PATH, areaOf, blobOf, byClass, click, explainedOf, find,
  fullUseCase, linksOf, marksOf, paramsOf, queueFiles, queueWrites, resultOf, saveOf, scripted, specWorld, textOf, today, typeInto, until, whyOf } from "./uc-018-harness.mjs";
import { P41, P42, UC41, UC42, TOKENS, badgeOf, world as useCaseWorld } from "./uc-008-harness.mjs";
import { view } from "../src/review-pages/index.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const UC = "docs/use-cases/UC-018-edit-a-specification-or-use-case.md";
const SELF = "tests/system-uc-018-edit-a-specification-or-use-case.test.mjs";
const UC008 = "tests/system-uc-008-review-and-accept-a-use-case.test.mjs";
const REQ = "tests/review-pages-edit-requirement.test.mjs";
const REQ_PAGES = "tests/review-pages-edit-requirement-pages.test.mjs";
const ENTRY = "tests/review-pages-edit-entry.test.mjs";
const USE_CASES = "tests/review-pages-use-cases.test.mjs";
const LINKS = "tests/trace-pages-edit-links.test.mjs";
const LEAVE = "tests/review-pages-leave.test.mjs";
const PROPOSE = "tests/spec-changes-propose-section.test.mjs";
const RULE_AND = "Every loan states the date by which the book is returned and the shelf it came from.";
const FULL41 = fullUseCase("UC-041", "Check out a book", [LOAN]);
const settle = () => new Promise((resolve) => setTimeout(resolve, 300));

// ---------------------------------------------------------------- the flow map

// The passages of UC-018 the system tests walk, each with the executable tests that walk it; a passage the dashboard does otherwise is a finding, a `todo` case that fails now and names what it does instead.
const FLOW_EVIDENCE = {
  "main-1-use-case": { uc: "a use case in the review list (UC-008) and presses **Edit**", evidence: [[SELF, "TST-376202"], [UC008, "TST-372207"]] },
  "main-1-requirement": { uc: "The author opens a requirement in the specification browser (UC-020)", evidence: [[SELF, "TST-376204"], [LINKS, "TST-360001"]] },
  "main-2-editor": { uc: "The dashboard opens the editor on the same page: Markdown on the left, live preview on the right, including rendered Mermaid diagrams.", evidence: [[SELF, "TST-376202"]] },
  "main-2-sha": { uc: "It notes the blob SHA of what it opened", evidence: [[SELF, "TST-376216"], [USE_CASES, "TST-358003"]] },
  "main-3-requirement-marks": { uc: "for a requirement: a missing one of the four fields, and a conjunction in the rule", evidence: [[SELF, "TST-376204"], [REQ, "TST-472626"]] },
  "main-3-use-case-marks": { uc: "for a use case: a missing actor, precondition, main flow, alternative flows or postcondition, and a name under `realises` that matches no requirement.", evidence: [[SELF, "TST-376202"]] },
  "main-4-why": { uc: "the editor shows a **Why** field", evidence: [[SELF, "TST-376204"], [REQ, "TST-472629"]] },
  "main-4-impact": { uc: "Agent M lists beside it every artifact that names it — the impact list.", evidence: [[SELF, "TST-376204"], [REQ, "TST-472627"]] },
  "main-5-save": { uc: "The author presses **Save** — one click.", evidence: [[SELF, "TST-376203"], [SELF, "TST-376205"]] },
  "main-6-use-case": { uc: "Agent M commits the edited file to the default branch under the author's own account.", evidence: [[SELF, "TST-376203"], [UC008, "TST-372207"]] },
  "main-6-open-queue": { uc: "Agent M adds an entry to the section's queue", evidence: [[SELF, "TST-376206"]] },
  "main-6-requirement": { uc: "with the complete SPEC section as edited, its rationale from the *Why* field, its impact list, and the index line naming the section it replaces", evidence: [[SELF, "TST-376205"], [PROPOSE, "TST-472984"]] },
  "main-6-spec-untouched": { uc: "`SPEC.md` is not touched.", evidence: [[SELF, "TST-376205"]] },
  "main-7-link": { uc: "The dashboard shows the commit as a link.", evidence: [[SELF, "TST-376203"], [SELF, "TST-376205"]] },
  "main-7-entry": { uc: "For a requirement it opens the new entry in the approval view", evidence: [[SELF, "TST-376205"]] },
  "main-explain": { uc: "Each step carries a folded **What is this?**", evidence: [[SELF, "TST-376221"]] },
  "1a-entry": { uc: "**1a. The author edits an open proposal**", evidence: [[SELF, "TST-376207"], [ENTRY, "TST-397003"]] },
  "3a-rename": { uc: "**3a. The author changes a requirement's name.**", evidence: [[SELF, "TST-376208"], [REQ, "TST-472631"]] },
  "3b-id": { uc: "**3b. The author changes a use case's `id`.**", evidence: [[SELF, "TST-376209"], [USE_CASES, "TST-358002"]] },
  "3c-mark": { uc: "**3c. A mark from step 3 remains.**", evidence: [[SELF, "TST-376210"]] },
  "3d-new": { uc: "**3d. The author adds a new requirement**", evidence: [[SELF, "TST-376211"], [LINKS, "TST-360002"], [REQ, "TST-472630"]] },
  "3d-empty-fields": { uc: "opens the editor with the four fields empty", evidence: [[SELF, "TST-376222"]] },
  "3e-text-only": { uc: "the editor changes text only, never a group", evidence: [[SELF, "TST-376212"]] },
  "3e-link": { uc: "A link opens the arrangement (UC-021)", evidence: [[SELF, "TST-376213"]] },
  "4a-no-token": { uc: "**4a. No token is stored (GitHub).**", evidence: [[SELF, "TST-376214"], [UC008, "TST-372208"], [REQ_PAGES, "TST-592002"]] },
  "4b-gitlab": { uc: "**4b. The product is on GitLab and no token for it is stored.**", evidence: [[SELF, "TST-376215"]] },
  "5a-changed": { uc: "**5a. The file or the SPEC section changed since step 2.** Nothing is written. The editor keeps the author's text and shows the newer version beside it", evidence: [[SELF, "TST-376216"]] },
  "5a-again": { uc: "the comparison is now against the newer SHA", evidence: [[SELF, "TST-376217"]] },
  "6a-other": { uc: "**6a. Another open proposal already replaces the same SPEC section.**", evidence: [[SELF, "TST-376218"], [REQ, "TST-472632"]] },
  "6b-no-write": { uc: "**6b. The author has no write access.**", evidence: [[SELF, "TST-376219"], [USE_CASES, "TST-358005"]] },
  "7a-leave": { uc: "**7a. The author leaves the editor with unsaved changes.**", evidence: [[SELF, "TST-376220"], [LEAVE, "TST-603020"]] },
};
// The passages the dashboard does otherwise: the finding, its case, and the module it points to.
const FLOW_FINDINGS = {};

// TST-376201 · level: system · module: system
// guards: UC-018
// given: UC-018 as committed text, the executable tests named in FLOW_EVIDENCE and the findings named in FLOW_FINDINGS
// input: compare every passage of the main flow, steps 1 to 7, and of the alternative flows with its executable evidence or its finding
// expect: every named passage stands in UC-018; every evidence file exists and declares its TST id; every finding's case stands in its file with the todo naming FINDING and its module; every alternative flow UC-018 names is among the passages; known positive: UC-018 names exactly the twelve alternative flows 1a, 3a, 3b, 3c, 3d, 3e, 4a, 4b, 5a, 6a, 6b and 7a, and each of the seven main steps has a passage
test("TST-376201: UC-018 every passage of the main flow and of each alternative flow has an executable test or a finding", () => {
  const uc = read(UC).replace(/\s+/g, " ");
  for (const [name, { uc: needle, evidence }] of Object.entries(FLOW_EVIDENCE)) {
    assert.ok(uc.includes(needle.replace(/\s+/g, " ")), `${name}: UC-018 says "${needle}"`);
    assert.ok(evidence.length > 0, `${name}: a test is named`);
    for (const [file, id] of evidence) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${name}: ${file} exists`);
      assert.ok(testDeclarations(file, read(file)).some((each) => each.id === id), `${name}: ${id} is declared in ${file}`);
    }
  }
  for (const [name, { uc: needle, finding, file, test: id, module }] of Object.entries(FLOW_FINDINGS)) {
    assert.ok(uc.includes(needle), `${name}: UC-018 says "${needle}"`);
    assert.ok(read(file).includes(`// ${id} `), `${name}: ${id} stands in ${file}`);
    assert.ok(read(file).includes(`todo: "FINDING ${finding} (${module})`), `${name}: the todo of ${id} names FINDING ${finding} and ${module}`);
  }
  const flows = [...uc.matchAll(/- \*\*(\d+[a-z])\. /g)].map((match) => match[1]).sort();
  assert.deepEqual(flows, ["1a", "3a", "3b", "3c", "3d", "3e", "4a", "4b", "5a", "6a", "6b", "7a"], "known positive: UC-018 names these twelve alternative flows");
  const walked = new Set(Object.keys({ ...FLOW_EVIDENCE, ...FLOW_FINDINGS }).map((key) => key.split("-")[0]));
  assert.deepEqual(flows.filter((flow) => !walked.has(flow)), [], "each alternative flow is among the passages");
  const steps = new Set(Object.keys({ ...FLOW_EVIDENCE, ...FLOW_FINDINGS }).filter((key) => key.startsWith("main-")).map((key) => Number(key.split("-")[1])).filter(Number.isInteger));
  assert.deepEqual([...steps].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7], "each step of the main flow is among the passages");
});

// ---------------------------------------------------------------- a use case: steps 1 to 7

// TST-376202 · level: system · module: system
// guards: UC-018; EDITS ARE PREPARED ON THE DASHBOARD; A USE CASE HAS ACTOR, PRECONDITION, FLOW AND POSTCONDITION
// given: the product alice/thesis-tool on GitHub (tests/uc-008-harness.mjs) whose UC-041, open, holds its five sections and a Mermaid diagram and realises A LOAN HAS A DUE DATE, a requirement of the SPEC; the author's token stored
// input: the author opens UC-041's page and follows its Edit; then types the text without its section ## Precondition and with NO SUCH RULE under realises
// expect: the page of UC-041 offers Edit, leading to use-case/id=UC-041/edit=1; the editor holds the file byte for byte, its preview beside it holds the diagram handed to the renderer, and no mark stands; after the typing the preview follows the text, and the marks name the missing section ## Precondition under A USE CASE HAS ACTOR, PRECONDITION, FLOW AND POSTCONDITION and "NO SUCH RULE", which matches no requirement; Save stays offered; nothing is written
test("TST-376202: UC-018 1, 2, 3 a use case opens from its page in an editor with a live preview, and the marks name a missing section and an unknown requirement", async () => {
  const w = await useCaseWorld({ files: { [P41]: FULL41 } });
  const page = await w.draw({ id: "UC-041" });
  await w.quiet();
  const edit = linksOf(page, "edit-link")[0];
  assert.ok(edit, "Edit is offered");
  const { route, params } = paramsOf(edit.getAttribute("href"));
  assert.deepEqual([route, params.id, params.edit], ["use-case", "UC-041", "1"]);
  const target = await w.draw(params);
  await w.quiet();
  assert.equal(areaOf(target).value, FULL41, "the editor holds the file byte for byte");
  const preview = byClass(target, "div", "preview")[0];
  assert.match(textOf(preview), /sequenceDiagram|This diagram is not drawn/, "the diagram is handed to the renderer in the preview");
  assert.deepEqual(marksOf(target), [], "known positive: a complete use case has no mark");
  const broken = FULL41.replace("## Precondition\n", "## Before\n").replace(`  - ${LOAN}`, "  - NO SUCH RULE");
  typeInto(target, broken);
  assert.match(textOf(byClass(target, "div", "preview")[0]), /Before/, "the preview follows the text");
  const marks = marksOf(target).join("\n");
  assert.match(marks, /## Precondition is required, and missing \[A USE CASE HAS ACTOR, PRECONDITION, FLOW AND POSTCONDITION\]/);
  assert.match(marks, /realises "NO SUCH RULE", which matches no requirement/);
  assert.equal(saveOf(target).disabled, false, "the marks block nothing");
  assert.deepEqual(w.writes(), []);
});

// TST-376203 · level: system · module: system
// guards: UC-018; A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN; ONE CLICK PER DECISION; STATUS IS DERIVED FROM THE RECORDS
// given: the product alice/thesis-tool on GitHub whose UC-042 is accepted (an approval record names its text); the author's token stored
// input: the author opens UC-042's editor, changes "extends a loan once." to "extends a loan once, at the desk.", and clicks Save once
// expect: one commit of exactly docs/use-cases/UC-042-extend-a-loan.md with the edited text and no approval record, with the author's token; the page shows UC-042 again, as changed since acceptance, with a link to the commit
test("TST-376203: UC-018 5, 6, 7 a saved use case is committed under the author's account and shown again as changed since acceptance, with the commit linked", async () => {
  const w = await useCaseWorld();
  const target = await w.draw({ id: "UC-042", edit: "1" });
  await w.quiet();
  const edited = UC42.replace("extends a loan once.", "extends a loan once, at the desk.");
  typeInto(target, edited);
  click(saveOf(target));
  await until(() => w.writes().length === 1 && !areaOf(target), "the save and the page shown again");
  await w.quiet();
  assert.deepEqual(w.writes()[0].files, { [P42]: edited }, "the use case alone, and no approval record");
  assert.deepEqual([...new Set(w.writers().map((each) => each.authorization))], [`Bearer ${TOKENS.github.value}`]);
  assert.equal(badgeOf(target), "changed since acceptance");
  assert.ok(linksOf(target).some((link) => link.getAttribute("href") === `https://github.com/alice/thesis-tool/commit/${w.head()}`), "the commit is linked");
});

// ---------------------------------------------------------------- a requirement: steps 1 to 7

// TST-376204 · level: system · module: system
// guards: UC-018; A REQUIREMENT HAS FOUR FIELDS; ONE STATEMENT PER REQUIREMENT; A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST
// given: the library alice/library on GitHub (tests/uc-018-harness.mjs): its SPEC's section "## 1. Lending" holds A LOAN HAS A DUE DATE, which UC-001 realises, and A BOOK IS SHELVED; the author's token stored
// input: the author opens the specification browser on the default branch and follows Edit beside A LOAN HAS A DUE DATE; then gives its rule a conjunction and removes the check of A BOOK IS SHELVED
// expect: Edit leads to requirement/name=A LOAN HAS A DUE DATE; the editor holds the section "## 1. Lending" byte for byte, with no mark, a Why field and an empty impact list; after the typing the marks name the conjunction under ONE STATEMENT PER REQUIREMENT and the missing check under A REQUIREMENT HAS FOUR FIELDS, and the impact list names A LOAN HAS A DUE DATE changed, named by UC-001; Save stays offered; nothing is written
test("TST-376204: UC-018 1 to 4 a requirement opens from the specification browser on its section, with the marks of its fields, a Why field and the impact list", async () => {
  const w = await specWorld();
  const browser = await w.trace();
  const edit = linksOf(browser, "requirement-edit").find((link) => paramsOf(link.getAttribute("href")).params.name === LOAN);
  assert.ok(edit, "Edit stands beside the requirement");
  const { route, params } = paramsOf(edit.getAttribute("href"));
  assert.equal(route, "requirement");
  const target = await w.draw(route, params);
  assert.equal(areaOf(target).value, LENDING, "the editor holds the section byte for byte");
  assert.deepEqual(marksOf(target), [], "known positive: no mark on the section as it stands");
  assert.ok(whyOf(target), "a Why field");
  assert.equal(byClass(target, "ul", "impact")[0].childNodes.length, 0);
  typeInto(target, LENDING.replace("Every loan states the date by which the book is returned.", RULE_AND).replace("*Check:* `tests/shelf.test.mjs`\n", ""));
  const marks = marksOf(target).join("\n");
  assert.match(marks, /the rule contains "and" \[ONE STATEMENT PER REQUIREMENT\]/);
  assert.match(marks, /\[A REQUIREMENT HAS FOUR FIELDS\]/);
  assert.match(textOf(byClass(target, "ul", "impact")[0]), new RegExp(`${LOAN} — changed, named by UC-001`));
  assert.equal(saveOf(target).disabled, false);
  assert.deepEqual(w.writes(), []);
});

// TST-376205 · level: system · module: system
// guards: UC-018; A SPEC EDIT IS SAVED AS A PROPOSAL; A SPECIFICATION CHANGE IS APPROVED BEFORE IT IS WRITTEN; NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT; ONE CLICK PER DECISION
// given: the library on GitHub, the author's token stored, no queue in the repository
// input: the author edits the rule of A LOAN HAS A DUE DATE to "… is returned, or renewed.", writes "A loan may be renewed." in Why and clicks Save once; then follows the link to the new entry
// expect: one commit under the author's token starting the section's queue docs/spec-freigaben/lending — its index with the row naming "## 1. Lending", its decisions, the proposal (the section as edited, byte for byte) and its rationale with the Why and the impact list naming A LOAN HAS A DUE DATE and UC-001 —, and no SPEC.md; SPEC.md is byte-identical; the page links the commit and the entry spec-<queue>-01; the entry's page shows the section now in the SPEC, the proposal and their difference
test("TST-376205: UC-018 5, 6, 7 a saved requirement is one commit of a queue entry, SPEC.md untouched, and the entry opens beside the current section", async () => {
  const w = await specWorld();
  const target = await w.draw("requirement", { name: LOAN });
  const edited = LENDING.replace("is returned.", "is returned, or renewed.");
  typeInto(target, edited);
  whyOf(target).value = "A loan may be renewed.";
  click(saveOf(target));
  await until(() => byClass(target, "p", "entry").length === 1, "the entry");
  assert.equal(w.writes().length, 1, "one commit");
  const files = w.writes()[0].files, folder = "docs/spec-freigaben/lending";
  assert.deepEqual(Object.keys(files).sort(), [`${folder}/01-lending.begruendung.md`, `${folder}/01-lending.md`, `${folder}/entscheidungen.md`, `${folder}/index.md`]);
  assert.equal(files[`${folder}/01-lending.md`], edited, "the proposal is the section as edited");
  assert.match(files[`${folder}/index.md`], new RegExp(`\\| 01 \\| \`SPEC.md\` \\| ${LENDING_HEADING} \\|`));
  const rationale = files[`${folder}/01-lending.begruendung.md`];
  assert.match(rationale, /A loan may be renewed\./);
  assert.match(rationale, new RegExp(`${LOAN}: changed; named by UC-001`));
  assert.equal(w.files()["SPEC.md"], LIBRARY_SPEC, "SPEC.md is byte-identical");
  assert.deepEqual([...new Set(w.writers().map((each) => each.authorization))], [`Bearer ${SPEC_TOKEN.value}`]);
  const links = linksOf(byClass(target, "p", "entry")[0]).map((link) => link.getAttribute("href"));
  assert.ok(links.includes(`https://github.com/alice/library/commit/${w.head()}`), links.join(" "));
  const entry = links.find((href) => href.startsWith("#spec-entry/"));
  const { params } = paramsOf(entry);
  assert.equal(params.id, "spec-lending-01");
  const shown = await w.draw("spec-entry", { id: params.id });
  assert.match(textOf(byClass(shown, "section", "current")[0]), /is returned\./);
  assert.match(textOf(byClass(shown, "section", "proposal")[0]), /is returned, or renewed\./);
  assert.match(textOf(byClass(shown, "section", "difference")[0]), /or renewed/);
});

// TST-376206 · level: system · module: system
// guards: UC-018
// given: the library on GitHub, the author's token stored (named "Agent M · library", as the settings page names a product's token), no queue in the repository
// input: the author saves an edit of A LOAN HAS A DUE DATE; then a second edit of the same section A LOAN HAS A DUE DATE
// expect: the first save starts the queue of the section under docs/spec-freigaben/ with entry 01; the second save adds entry 02 to that queue, in one commit, and writes neither entry 01 nor a second queue
test("TST-376206: UC-018 6 an edit of a section adds an entry to the section's queue, and a second edit of the same section adds another", async () => {
  const w = await specWorld();
  const save = async (body, why) => {
    const target = await w.draw("requirement", { name: LOAN });
    typeInto(target, body);
    whyOf(target).value = why;
    const before = w.writes().length;
    click(saveOf(target));
    await until(() => w.writes().length === before + 1, `the save of ${LOAN}`);
  };
  await save(LENDING.replace("is returned.", "is returned, or renewed."), "A loan may be renewed.");
  const first = Object.keys(w.writes()[0].files).find((path) => path.endsWith("/index.md")).replace(/\/index\.md$/, "");
  assert.ok(Object.keys(w.writes()[0].files).includes(`${first}/01-lending.md`), "the first edit is entry 01 of the queue");
  await save(LENDING.replace("is returned.", "is returned, or renewed twice."), "A loan may be renewed twice.");
  const second = Object.keys(w.writes()[1].files);
  assert.ok(second.includes(`${first}/02-lending.md`), "the second edit adds entry 02 to the section's queue");
  assert.ok(!second.includes(`${first}/01-lending.md`), "entry 01 is not replaced");
  assert.ok(second.every((path) => path.startsWith(`${first}/`)), "the second edit writes in the same queue");
});

// ---------------------------------------------------------------- 1a

// TST-376207 · level: system · module: system
// guards: UC-018; A SPEC EDIT IS SAVED AS A PROPOSAL
// given: the library on GitHub with bob's open queue 2026-10-30_bobs, whose entry 01 proposes "## 2. Membership" with "a card, always."; the author's token stored
// input: the author opens the entry's page, follows its Edit, changes the proposal to "a card, at all times.", gives a Why and clicks Save
// expect: the entry's page offers Edit leading to spec-entry/id=spec-2026-10-30_bobs-01/edit=1; the editor holds the proposal; one commit changes exactly that entry's proposal and its rationale in bob's queue; no new queue is made; SPEC.md is byte-identical
test("TST-376207: UC-018 1a an open entry is edited in place, in its own queue", async () => {
  const proposal = MEMBERSHIP.replace("a card.", "a card, always.");
  const bobs = queueFiles("2026-10-30_bobs", [{ nr: 1, anchor: MEMBERSHIP_HEADING, proposal }]);
  const w = await specWorld({ files: bobs, authors: Object.fromEntries(Object.keys(bobs).map((path) => [path, "bob"])) });
  const id = "spec-2026-10-30_bobs-01";
  const page = await w.draw("spec-entry", { id });
  const edit = linksOf(page, "edit-link")[0];
  assert.ok(edit, "Edit is offered");
  const { params } = paramsOf(edit.getAttribute("href"));
  assert.deepEqual([params.id, params.edit], [id, "1"]);
  const target = await w.draw("spec-entry", params);
  assert.equal(areaOf(target).value, proposal);
  typeInto(target, MEMBERSHIP.replace("a card.", "a card, at all times."));
  whyOf(target).value = "Clearer.";
  click(saveOf(target));
  await until(() => w.writes().length === 1, "the save");
  assert.deepEqual(Object.keys(w.writes()[0].files).sort(), ["docs/spec-freigaben/2026-10-30_bobs/01-entry.begruendung.md", "docs/spec-freigaben/2026-10-30_bobs/01-entry.md"]);
  assert.match(w.files()["docs/spec-freigaben/2026-10-30_bobs/01-entry.md"], /a card, at all times\./);
  assert.equal(w.files()["SPEC.md"], LIBRARY_SPEC);
});

// ---------------------------------------------------------------- 3a, 3b, 3c

// TST-376208 · level: system · module: system
// guards: UC-018; A RENAMED REQUIREMENT IS WITHDRAWN AND ADDED; THE NAME IS THE ID AND IT SURVIVES
// given: the library on GitHub; UC-001 realises A LOAN HAS A DUE DATE; the author's token stored
// input: the author renames A LOAN HAS A DUE DATE to A LOAN IS DUE in its editor, gives a Why and saves
// expect: before the rename no notice; after it the page says the name is the identifier, and the impact list names A LOAN HAS A DUE DATE withdrawn, named by UC-001, and A LOAN IS DUE added; the saved proposal holds A LOAN IS DUE and not A LOAN HAS A DUE DATE, and its rationale names both
test("TST-376208: UC-018 3a a renamed requirement is shown as the identifier changing and saved as the old name withdrawn and the new one added", async () => {
  const w = await specWorld();
  const target = await w.draw("requirement", { name: LOAN });
  assert.equal(byClass(target, "p", "rename").length, 0, "known positive: no notice before the rename");
  typeInto(target, LENDING.replace(LOAN, "A LOAN IS DUE"));
  assert.match(textOf(byClass(target, "p", "rename")[0]), /The name is the identifier/);
  const impact = textOf(byClass(target, "ul", "impact")[0]);
  assert.match(impact, new RegExp(`${LOAN} — withdrawn, named by UC-001`));
  assert.match(impact, /A LOAN IS DUE — added/);
  whyOf(target).value = "Shorter.";
  click(saveOf(target));
  await until(() => w.writes().length === 1, "the save");
  const files = w.writes()[0].files;
  const proposal = Object.entries(files).find(([path]) => /\/01-[^/]+\.md$/.test(path) && !path.endsWith(".begruendung.md"))[1];
  assert.ok(proposal.includes("**A LOAN IS DUE**") && !proposal.includes(LOAN), proposal);
  const rationale = Object.entries(files).find(([path]) => path.endsWith(".begruendung.md"))[1];
  assert.ok(rationale.includes(LOAN) && rationale.includes("A LOAN IS DUE"), rationale);
});

// TST-376209 · level: system · module: system
// guards: UC-018; AN EDITED FILE KEEPS ITS IDENTIFIER
// given: the product alice/thesis-tool on GitHub, UC-041 open; the author's token stored
// input: the author changes the id of UC-041 to UC-099 in its editor and clicks Save; then sets it back
// expect: Save is disabled and the page says the identifier changed from UC-041 to UC-099 and to keep UC-041; the click writes nothing; with the id set back Save is offered again
test("TST-376209: UC-018 3b a changed use-case id disables Save with the reason", async () => {
  const w = await useCaseWorld();
  const target = await w.draw({ id: "UC-041", edit: "1" });
  await w.quiet();
  typeInto(target, UC41.replace("id: UC-041", "id: UC-099"));
  assert.equal(saveOf(target).disabled, true);
  assert.match(resultOf(target), /Save is disabled: the identifier changed from UC-041 to UC-099; keep UC-041\./);
  click(saveOf(target));
  await settle();
  assert.deepEqual(w.writes(), []);
  typeInto(target, UC41);
  assert.equal(saveOf(target).disabled, false, "known positive: the identifier kept, Save is offered");
});

// TST-376210 · level: system · module: system
// guards: UC-018; A USE CASE HAS ACTOR, PRECONDITION, FLOW AND POSTCONDITION; ONE STATEMENT PER REQUIREMENT
// given: UC-041 (complete, with its diagram) in alice/thesis-tool, and the library's section "## 1. Lending", each with the author's token
// input: the author removes UC-041's section ## Postcondition and saves; reopens UC-041's editor; in the library the author gives A LOAN HAS A DUE DATE a rule with "and", a Why, and saves
// expect: the use case is saved as typed, in one commit, and the editor opened again on the saved text shows the mark of the missing ## Postcondition; the requirement is saved as one entry whose proposal holds the rule with "and"
test("TST-376210: UC-018 3c a text with a mark is saved anyway, and the mark stands again on the saved text", async () => {
  const w = await useCaseWorld({ files: { [P41]: FULL41 } });
  const target = await w.draw({ id: "UC-041", edit: "1" });
  await w.quiet();
  const without = FULL41.replace("## Postcondition\n- The loan is recorded.\n\n", "");
  typeInto(target, without);
  assert.match(marksOf(target).join("\n"), /## Postcondition is required/);
  click(saveOf(target));
  await until(() => w.writes().length === 1, "the save");
  assert.deepEqual(w.writes()[0].files, { [P41]: without });
  await w.quiet();
  const again = await w.draw({ id: "UC-041", edit: "1" });
  await w.quiet();
  assert.equal(areaOf(again).value, without);
  assert.match(marksOf(again).join("\n"), /## Postcondition is required/, "the mark stands on the saved text");
  const library = await specWorld();
  const edit = await library.draw("requirement", { name: LOAN });
  const conjunction = LENDING.replace("Every loan states the date by which the book is returned.", RULE_AND);
  typeInto(edit, conjunction);
  assert.match(marksOf(edit).join("\n"), /ONE STATEMENT PER REQUIREMENT/);
  whyOf(edit).value = "Both belong together.";
  click(saveOf(edit));
  await until(() => library.writes().length === 1, "the save of the requirement");
  assert.ok(queueWrites(library.writes()).some(([path, body]) => /\/01-lending\.md$/.test(path) && body === conjunction));
});

// ---------------------------------------------------------------- 3d, 3e

// TST-376211 · level: system · module: system
// guards: UC-018; A REQUIREMENT HAS FOUR FIELDS; A SPEC EDIT IS SAVED AS A PROPOSAL
// given: the library on GitHub, its section "## 2. Membership" holding A MEMBER HAS A CARD; the author's token stored
// input: the author follows + Requirement beside "2. Membership" in the specification browser; writes the requirement A MEMBER IS REGISTERED into the empty fields, a Why, and saves
// expect: the link leads to requirements/section=## 2. Membership; the editor holds the section followed by the four empty fields; after the writing the impact list names A MEMBER IS REGISTERED added; Save writes one entry anchored at "## 2. Membership" whose proposal is the section with the new requirement; SPEC.md is byte-identical
test("TST-376211: UC-018 3d + Requirement opens the editor with the four fields empty in its section, and saving proposes the section with the addition", async () => {
  const w = await specWorld();
  const browser = await w.trace();
  const add = linksOf(browser, "requirement-new").find((link) => paramsOf(link.getAttribute("href")).params.section === MEMBERSHIP_HEADING);
  assert.ok(add, "+ Requirement stands beside the section");
  const { route, params } = paramsOf(add.getAttribute("href"));
  assert.equal(route, "requirements");
  const target = await w.draw(route, params);
  assert.equal(areaOf(target).value, `${MEMBERSHIP}\n****\n\n*Check:*\n`);
  const written = `${MEMBERSHIP}\n**A MEMBER IS REGISTERED** *(Product Owner)*\nEvery member is registered.\n*Check:* \`tests/member.test.mjs\`\n`;
  typeInto(target, written);
  assert.match(textOf(byClass(target, "ul", "impact")[0]), /A MEMBER IS REGISTERED — added/);
  whyOf(target).value = "A new rule.";
  click(saveOf(target));
  await until(() => w.writes().length === 1, "the save");
  const [[, proposal]] = queueWrites(w.writes()).filter(([path]) => /\/01-[^/]+\.md$/.test(path) && !path.endsWith(".begruendung.md"));
  assert.equal(proposal, written);
  assert.ok(queueWrites(w.writes()).some(([path, body]) => path.endsWith("/index.md") && body.includes(`| 01 | \`SPEC.md\` | ${MEMBERSHIP_HEADING} |`)));
  assert.equal(w.files()["SPEC.md"], LIBRARY_SPEC);
});

// TST-376222 · level: system · module: system
// guards: UC-018; A REQUIREMENT HAS FOUR FIELDS
// given: the library on GitHub, whose section "## 2. Membership" holds A MEMBER HAS A CARD with its four fields; the author's token stored
// input: the author opens + Requirement for "## 2. Membership" and leaves the four fields empty; then writes only the name A MEMBER IS REGISTERED into them; then the name, its source and its rule, but no check
// expect: step 3 "a missing one of the four fields" is marked in each: the empty fields, and the name without source, rule and check, each carry a mark under A REQUIREMENT HAS FOUR FIELDS; known positive: the requirement without its check is marked "no check"
test("TST-376222: UC-018 3, 3d the four empty fields of a new requirement, and a name given alone, are marked as missing fields", async () => {
  const w = await specWorld();
  const target = await w.draw("requirements", { section: MEMBERSHIP_HEADING });
  typeInto(target, `${MEMBERSHIP}\n**A MEMBER IS REGISTERED** *(Product Owner)*\nEvery member is registered.\n`);
  assert.match(marksOf(target).join("\n"), /no check \[A REQUIREMENT HAS FOUR FIELDS\]/, "known positive: a missing check is marked");
  typeInto(target, `${MEMBERSHIP}\n****\n\n*Check:*\n`);
  assert.match(marksOf(target).join("\n"), /\[A REQUIREMENT HAS FOUR FIELDS\]/, "the empty fields are marked");
  typeInto(target, `${MEMBERSHIP}\n**A MEMBER IS REGISTERED**\n\n*Check:*\n`);
  assert.match(marksOf(target).join("\n"), /\[A REQUIREMENT HAS FOUR FIELDS\]/, "a name given alone is marked");
});

// TST-376212 · level: system · module: system
// guards: UC-018; REGROUPING LEAVES THE GROUPED FILE UNCHANGED
// given: the library on GitHub whose docs/groups/requirements.md places A LOAN HAS A DUE DATE in the group Lending; UC-001 in alice/library; the author's token stored
// input: the author saves an edit of A LOAN HAS A DUE DATE, and an edit of UC-001
// expect: neither commit holds docs/groups/requirements.md, and the group file is byte-identical afterwards
test("TST-376212: UC-018 3e an edit changes text only, never a group", async () => {
  const w = await specWorld();
  const requirement = await w.draw("requirement", { name: LOAN });
  typeInto(requirement, LENDING.replace("is returned.", "is returned, or renewed."));
  whyOf(requirement).value = "Renewal.";
  click(saveOf(requirement));
  await until(() => w.writes().length === 1, "the requirement's save");
  const useCase = await w.draw("use-case", { id: "UC-001", edit: "1" });
  typeInto(useCase, areaOf(useCase).value.replace("at the desk.", "at the front desk."));
  click(saveOf(useCase));
  await until(() => w.writes().length === 2, "the use case's save");
  assert.deepEqual(w.writes().map((write) => Object.keys(write.files).includes(GROUPS_PATH)), [false, false]);
  assert.ok(Object.keys(w.writes()[1].files).includes(UC1_PATH), "known positive: the use case's commit holds its file");
  assert.equal(w.files()[GROUPS_PATH], GROUPS);
});

// TST-376213 · level: system · module: system
// guards: UC-018
// given: the library on GitHub; the author's token stored
// input: the author opens the editor of A LOAN HAS A DUE DATE, and the editor of UC-001
// expect: 3e "A link opens the arrangement (UC-021)": each editor holds a link to the arrangement, #arrange/kind=requirements for the requirement and #arrange/kind=use-cases for the use case
test("TST-376213: UC-018 3e the editor links the arrangement of its kind", async () => {
  const w = await specWorld();
  const requirement = await w.draw("requirement", { name: LOAN });
  assert.ok(linksOf(requirement).some((link) => paramsOf(link.getAttribute("href")).route === "arrange" && paramsOf(link.getAttribute("href")).params.kind === "requirements"));
  const useCase = await w.draw("use-case", { id: "UC-001", edit: "1" });
  assert.ok(linksOf(useCase).some((link) => paramsOf(link.getAttribute("href")).route === "arrange" && paramsOf(link.getAttribute("href")).params.kind === "use-cases"));
});

// ---------------------------------------------------------------- 4a, 4b

// TST-376214 · level: system · module: system
// guards: UC-018; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; NO TEXT TRAVELS IN A URL
// given: the library on GitHub with no token of its own stored in this browser (the instance's token is stored, and is none for this product)
// input: the author edits the rule of A LOAN HAS A DUE DATE to "… or renewed.", gives a Why and clicks Save
// expect: nothing is written and no request that writes is sent; the page offers one GitHub page of https://github.com/alice/library for each file of the entry — the queue's index, its decisions, the proposal and its rationale —, each with its text beside it, the proposal's byte for byte; no page's address holds a word of the edit
test("TST-376214: UC-018 4a without a token Save offers GitHub's page for each file of the entry, each text beside it and none in a link", async () => {
  const w = await specWorld({ token: false });
  const target = await w.draw("requirement", { name: LOAN });
  const edited = LENDING.replace("is returned.", "is returned, or renewed.");
  typeInto(target, edited);
  whyOf(target).value = "Renewal.";
  click(saveOf(target));
  await until(() => linksOf(target, "github-page").length === 4, "GitHub's pages");
  assert.deepEqual(w.writes(), []);
  assert.deepEqual(w.writers(), []);
  const items = find(byClass(target, "ul", "pages")[0], (node) => node.localName === "li");
  const shown = items.map((item) => ({ href: linksOf(item, "github-page")[0].getAttribute("href"), text: textOf(byClass(item, "pre", "clipboard-text")[0]) }));
  for (const page of shown) {
    assert.ok(page.href.startsWith("https://github.com/alice/library/"), page.href);
    assert.ok(!decodeURIComponent(page.href).includes("renewed"), `no text in ${page.href}`);
  }
  assert.ok(shown.some((page) => page.text === edited), "the proposal's text, byte for byte, beside its page");
  const folder = "docs/spec-freigaben/lending";
  assert.deepEqual(shown.map((page) => new URL(page.href).searchParams.get("filename")).sort(), [`${folder}/01-lending.begruendung.md`, `${folder}/01-lending.md`, `${folder}/entscheidungen.md`, `${folder}/index.md`]);
});

// TST-376215 · level: system · module: system
// guards: UC-018; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN
// given: the product team/product on gitlab.example.org (tests/uc-008-harness.mjs) with no token for it stored: its SPEC holds A LOAN HAS A DUE DATE, its use cases UC-041
// input: the author opens the editor of A LOAN HAS A DUE DATE, and the editor of UC-041
// expect: neither page holds an editor or Save; each shows the text it would edit and links the step that stores the project's token (#add with the product's address); nothing is written
test("TST-376215: UC-018 4b on GitLab without a token there is no Save, and the token's step is linked", async () => {
  const w = await useCaseWorld({ server: "gitlab", token: false });
  for (const [params, name, shown] of [[{ name: LOAN }, "requirement", LOAN], [{ id: "UC-041", edit: "1" }, "use-case", "borrows a book at the desk"]]) {
    const target = await w.draw(params, name);
    await w.quiet();
    assert.match(textOf(target), new RegExp(shown), `${name}: the text is shown`);
    assert.equal(areaOf(target), undefined, `${name}: no editor`);
    assert.equal(saveOf(target), undefined, `${name}: no Save`);
    assert.ok(linksOf(target).some((link) => link.getAttribute("href") === `#add/${encodeURIComponent(w.address)}`), `${name}: the token's step`);
  }
  assert.deepEqual(w.writes(), []);
});

// ---------------------------------------------------------------- 5a

// TST-376216 · level: system · module: system
// guards: UC-018; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; A REFUSED SAVE KEEPS THE EDIT
// given: the editor of A LOAN HAS A DUE DATE in the library, and of UC-041 in alice/thesis-tool, each opened with the author's token; then another writer changes the section's rule to "… returned on time." and UC-041's "at the desk." to "at the front desk."
// input: the author's edits ("… or renewed.", "at the desk, with a receipt."), and Save on each
// expect: nothing is written in either; each editor keeps the author's text; beside it the newer version is shown, with "returned on time." and "at the front desk." respectively
test("TST-376216: UC-018 5a a save on a text that changed meanwhile writes nothing, keeps the edit and shows the newer version beside it", async () => {
  const w = await specWorld();
  const target = await w.draw("requirement", { name: LOAN });
  const edited = LENDING.replace("is returned.", "is returned, or renewed.");
  typeInto(target, edited);
  whyOf(target).value = "Renewal.";
  await w.land({ "SPEC.md": SPEC_HEAD + LENDING.replace("is returned.", "is returned on time.") + MEMBERSHIP });
  click(saveOf(target));
  await until(() => /returned on time\./.test(textOf(byClass(target, "div", "newer")[0])), "the newer version");
  assert.equal(w.writes().length, 0);
  assert.equal(areaOf(target).value, edited);
  const u = await useCaseWorld();
  const page = await u.draw({ id: "UC-041", edit: "1" });
  await u.quiet();
  const receipt = UC41.replace("at the desk.", "at the desk, with a receipt.");
  typeInto(page, receipt);
  await u.land({ [P41]: UC41.replace("at the desk.", "at the front desk.") });
  click(saveOf(page));
  await until(() => /at the front desk\./.test(textOf(byClass(page, "div", "newer")[0])), "the newer use case");
  assert.deepEqual(u.writes(), []);
  assert.equal(areaOf(page).value, receipt);
});

// TST-376217 · level: system · module: system
// guards: UC-018; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE
// given: the situation of TST-376216 after the refused save: the editor of A LOAN HAS A DUE DATE shows the newer section ("… returned on time."); and of UC-041 the newer text ("at the front desk.")
// input: the author merges by hand ("… returned on time, or renewed.", "at the front desk, with a receipt.") and presses Save again
// expect: 5a "the comparison is now against the newer SHA": each save commits once, the merged section as an entry, the merged use case as the file
test("TST-376217: UC-018 5a after a refused save, the save of the merged text compares with the newer version and is written", async () => {
  const w = await specWorld();
  const target = await w.draw("requirement", { name: LOAN });
  typeInto(target, LENDING.replace("is returned.", "is returned, or renewed."));
  whyOf(target).value = "Renewal.";
  await w.land({ "SPEC.md": SPEC_HEAD + LENDING.replace("is returned.", "is returned on time.") + MEMBERSHIP });
  click(saveOf(target));
  await until(() => /returned on time\./.test(textOf(byClass(target, "div", "newer")[0])), "the newer version");
  typeInto(target, LENDING.replace("is returned.", "is returned on time, or renewed."));
  click(saveOf(target));
  await settle();
  assert.equal(w.writes().length, 1, "the merged section is saved");
  const u = await useCaseWorld();
  const page = await u.draw({ id: "UC-041", edit: "1" });
  await u.quiet();
  typeInto(page, UC41.replace("at the desk.", "at the desk, with a receipt."));
  await u.land({ [P41]: UC41.replace("at the desk.", "at the front desk.") });
  click(saveOf(page));
  await until(() => /at the front desk\./.test(textOf(byClass(page, "div", "newer")[0])), "the newer use case");
  typeInto(page, UC41.replace("at the desk.", "at the front desk, with a receipt."));
  click(saveOf(page));
  await settle();
  assert.equal(u.writes().length, 1, "the merged use case is saved");
});

// ---------------------------------------------------------------- 6a, 6b

// TST-376218 · level: system · module: system
// guards: UC-018; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE
// given: the library on GitHub with bob's open queue 2026-10-30_bobs, whose entry 01 proposes "## 1. Lending"; the author's token stored
// input: the author opens the editor of A LOAN HAS A DUE DATE, edits it, gives a Why and saves
// expect: the editor names spec-2026-10-30_bobs-01 among the other open proposals on the section, linked; the new entry is written anyway, in the section's queue docs/spec-freigaben/lending, and the page names bob's entry as also replacing the section; bob's queue is unchanged
test("TST-376218: UC-018 6a another open proposal on the section is named, and the new entry is written anyway", async () => {
  const bobs = queueFiles("2026-10-30_bobs", [{ nr: 1, anchor: LENDING_HEADING, proposal: LENDING.replace("is returned.", "is returned in a week.") }]);
  const w = await specWorld({ files: bobs, authors: Object.fromEntries(Object.keys(bobs).map((path) => [path, "bob"])) });
  const target = await w.draw("requirement", { name: LOAN });
  const others = byClass(target, "ul", "others")[0];
  assert.match(textOf(others), /spec-2026-10-30_bobs-01/);
  assert.equal(paramsOf(linksOf(others)[0].getAttribute("href")).params.id, "spec-2026-10-30_bobs-01");
  typeInto(target, LENDING.replace("is returned.", "is returned, or renewed."));
  whyOf(target).value = "Renewal.";
  click(saveOf(target));
  await until(() => byClass(target, "ul", "also").length === 1 && w.writes().length === 1, "the save");
  assert.match(textOf(byClass(target, "ul", "also")[0]), /spec-2026-10-30_bobs-01/);
  assert.ok(Object.keys(w.writes()[0].files).every((path) => !path.includes("2026-10-30_bobs")), "bob's queue is not written");
  assert.ok(Object.keys(w.writes()[0].files).some((path) => path.startsWith("docs/spec-freigaben/lending/")));
});

// TST-376219 · level: system · module: system
// guards: UC-018; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK
// given: a token stored that may not write: for the library, GitHub reports the push permission and refuses the commit's writes with 403; for alice/thesis-tool it reports no push permission and refuses every write with 403
// input: the author saves an edit of A LOAN HAS A DUE DATE with a Why; and an edit of UC-041
// expect: nothing is committed in either; the requirement's page offers GitHub's page for each file of the entry; the use case's page offers GitHub's editor of docs/use-cases/UC-041-check-out-a-book.md with the edited text beside it
test("TST-376219: UC-018 6b without write access the commit is refused and GitHub's pages are offered", async () => {
  const w = await specWorld({ refuseWrites: true });
  const target = await w.draw("requirement", { name: LOAN });
  typeInto(target, LENDING.replace("is returned.", "is returned, or renewed."));
  whyOf(target).value = "Renewal.";
  click(saveOf(target));
  await until(() => linksOf(target, "github-page").length === 4, "GitHub's pages");
  assert.deepEqual(w.writes(), []);
  const u = await useCaseWorld({ denyWrites: true });
  const page = await u.draw({ id: "UC-041", edit: "1" });
  await u.quiet();
  const edited = UC41.replace("at the desk.", "at the desk, with a receipt.");
  typeInto(page, edited);
  click(saveOf(page));
  await until(() => linksOf(page, "github-page").length === 1, "GitHub's editor");
  assert.equal(linksOf(page, "github-page")[0].getAttribute("href"), `https://github.com/alice/thesis-tool/edit/main/${P41}`);
  assert.equal(textOf(byClass(page, "pre", "clipboard-text")[0]), edited);
  assert.deepEqual(u.writes(), []);
});

// ---------------------------------------------------------------- 7a, What is this?

// TST-376220 · level: system · module: system
// guards: UC-018; EDITS ARE PREPARED ON THE DASHBOARD
// given: the editor of UC-041 in alice/thesis-tool and of A LOAN HAS A DUE DATE in the library, each with an edit not saved; the browser's confirmation answers first "no", then "yes"
// input: the frame asks each route's leave, twice
// expect: each time the person is asked "Discard unsaved changes?"; on "no" leave answers false and the editor stays; on "yes" it answers true and the editor is gone; an editor never changed is left without asking
test("TST-376220: UC-018 7a leaving an editor with unsaved changes asks first", async () => {
  const asked = [], answers = [];
  const confirm = globalThis.confirm;
  globalThis.confirm = (question) => { asked.push(question); return answers.shift(); };
  try {
    const u = await useCaseWorld();
    const page = await u.draw({ id: "UC-041", edit: "1" });
    await u.quiet();
    const route = await view.routes.find((each) => each.name === "use-case").module();
    typeInto(page, UC41.replace("at the desk.", "at the desk!"));
    answers.push(false, true);
    assert.equal(route.leave(), false);
    assert.ok(areaOf(page), "the editor stays");
    assert.equal(route.leave(), true);
    assert.equal(areaOf(page), undefined, "the editor is gone");
    const w = await specWorld();
    const target = await w.draw("requirement", { name: LOAN });
    const requirement = await w.route("requirement");
    typeInto(target, LENDING.replace("is returned.", "is returned!"));
    answers.push(false, true);
    assert.equal(requirement.leave(), false);
    assert.equal(requirement.leave(), true);
    assert.deepEqual(asked, Array(4).fill("Discard unsaved changes?"));
    await w.draw("requirement", { name: LOAN });
    assert.equal(requirement.leave(), true, "known positive: an editor never changed is left");
    assert.equal(asked.length, 4, "without asking");
  } finally { globalThis.confirm = confirm; }
});

// TST-376221 · level: system · module: system
// guards: UC-018; EVERY STEP EXPLAINS ITSELF
// given: the editor of A LOAN HAS A DUE DATE in the library, and of UC-001 in the library
// input: the author reads the folded What is this? of each
// expect: the requirement's explains that a SPEC edit is written as a proposal into a change queue under docs/spec-freigaben/ and accepted before it is written, while a use case is saved at once; the use case's explains the blob SHA an approval record names and that an edit after acceptance shows the file as changed since acceptance
test("TST-376221: UC-018 each editor carries a folded What is this? on why a SPEC edit waits, what a blob SHA is and why an edit reopens the review", async () => {
  const w = await specWorld();
  const requirement = explainedOf(await w.draw("requirement", { name: LOAN })).join("\n");
  assert.match(requirement, /^What is this\?/);
  assert.match(requirement, /change\s+queue under docs\/spec-freigaben\//);
  assert.match(requirement, /A use case is different: it is a draft to be read and corrected, so its file is saved at once\./);
  const useCase = explainedOf(await w.draw("use-case", { id: "UC-001", edit: "1" })).join("\n");
  assert.match(useCase, /blob SHA/);
  assert.match(useCase, /changed\s+since acceptance/);
});
