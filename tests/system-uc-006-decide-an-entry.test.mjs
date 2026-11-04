// System coverage for UC-006 Approve a specification change, walked through the review page of a SPEC entry: the flow map (TST-371201) that names, for every step of the main flow and every alternative flow, the executable tests that walk it, and the cases
// the three older system files leave out — opening an entry from the list, the reviewer's check of a rule, the entry shown as in SPEC, different wording and then Accept, Reject (4a), the fallback of an edit and a rejection without a token (4b), the
// approval of the instance committed on GitHub's page and written by the workflow (4c), an entry that waits for the heading another creates (4d), an entry that changed since it was shown (5a), and the postcondition's history. The page is the route
// `spec-entry` of MOD-review-pages over the real MOD-repository-hosts host of GitHub, MOD-spec-changes and MOD-approvals, behind the fixture server of tests/uc-006-harness.mjs (git-data commits included); the instance workflow of 4c runs from a temporary
// git repository. No request leaves the process.
// Run: node --test tests/system-uc-006-decide-an-entry.test.mjs
//
// Module: MOD-review-pages
// Module: MOD-spec-changes
// Module: MOD-workflow-entries
// Guards: UC-006
// Level: system
//
// Authored by developer-sonnet-j (ITM-371), who built, among the code of UC-006, only ITM-1274 (entryImpact, entryView's read of an entry's files), ITM-1315 (Accept disabled on a file that rests on what is not accepted) and ITM-659 (the key of a stored
// token); no case here guards one of those. Where the page and UC-006 disagree the case follows UC-006 and is marked `todo` with the word FINDING. Each case states its input and its expected values in its own text; none reads an expected result from the SPEC,
// a use case or an architecture file, but the flow map, which holds the expected passages itself and checks that UC-006 still says them. A person's click is the page's own listener called with a trusted event; a script's click is made by `scripted()`.
// Readings the texts leave open, which the cases state:
//   - "The reviewer opens the dashboard and selects an open entry" is read as: the list of the SPEC changes (#spec-entry) links each entry, and the link leads to the entry's page.
//   - "The reviewer checks that each rule is a single checkable statement" is read as: the page puts the whole proposal before the reviewer, and the editor of the entry marks a rule that holds "and" (ONE STATEMENT PER REQUIREMENT) without taking the decision away.
//   - "the dashboard shows the new state" (5a) is read as: the page is drawn again from the repository with the newer text and the state it has now, and Accept is offered again.
//   - "The commit history shows who approved, when, and which text" is read as: the page History of SPEC change entries lists the approval records with the person who committed each and the date, and the commit names the record.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { runEntry } from "../src/workflow-entries/main.mjs";
import { E05, E06, E07, HEAD, LINKS, QUEUE, REGISTER_ENTRY, READING, READING_NEW, ADDED, ADDED_NEW, WRITING, WRITING_NEW, WRITING_OTHER, SPEC, DECISIONS, PRODUCT_ADDRESS, TOKENS, areaOf, badgeOf, blobOf, boxOf, buttonOf, byClass, click, entry, entryId, fieldsOf,
  find, git, linksOf, proposalPath, queueFiles, rationalePath, reasonOf, recordPath, recordText, resultOf, rowOf, scripted, sectionText, tick, typeInto, until, whyOf, withGitInstance, workflowEnv, world } from "./uc-006-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const UC = "docs/use-cases/UC-006-approve-a-specification-change.md";
const SELF = "tests/system-uc-006-decide-an-entry.test.mjs";
const OLD = "tests/system-uc-006-approve-spec-change.test.mjs";
const READS = "tests/system-uc-006-batched-reads.test.mjs";
const REGISTER = "tests/system-uc-006-instance-register-batch.test.mjs";
const NOW = new Date("2026-03-01T10:00:00Z");

// ---------------------------------------------------------------- the flow map

// The passages of UC-006 the system tests walk, each with the tests that walk it.
const FLOW_EVIDENCE = {
  "main-1-select": { uc: "The reviewer opens the dashboard and selects an open entry.", evidence: [[READS, "TST-479102"], [SELF, "TST-371202"]] },
  "main-2-shows": { uc: "The dashboard shows the current SPEC section beside the proposal", evidence: [[OLD, "TST-371001"], [READS, "TST-479101"]] },
  "main-3-check": { uc: "The reviewer checks that each rule is a single checkable statement", evidence: [[SELF, "TST-371203"]] },
  "main-4-accept": { uc: "The reviewer presses **Accept** — one click.", evidence: [[OLD, "TST-371001"]] },
  "main-5-shas": { uc: "The dashboard checks, on the commit it writes on, that the proposal and the SPEC section still have", evidence: [[OLD, "TST-371004"], [SELF, "TST-371212"]] },
  "main-6-one-commit": { uc: "In **one** commit under the reviewer's own account, it adds the approval record, replaces the SPEC", evidence: [[OLD, "TST-371001"]] },
  "main-7-in-spec": { uc: "The dashboard shows the entry as *in SPEC*.", evidence: [[SELF, "TST-371204"]] },
  "3a-edit": { uc: "**3a. The reviewer wants different wording.**", evidence: [[OLD, "TST-371002"]] },
  "3a-shown-again": { uc: "step 2 with the new text, and **Accept** applies to that text.", evidence: [[SELF, "TST-371205"]] },
  "3b-impact": { uc: "**3b. The change touches an existing requirement.**", evidence: [[READS, "TST-479101"], [READS, "TST-479104"], [OLD, "TST-371001"]] },
  "4a-reject": { uc: "**4a. The reviewer rejects.**", evidence: [[SELF, "TST-371206"], [SELF, "TST-371207"]] },
  "4b-no-token": { uc: "**4b. No token is stored.**", evidence: [[OLD, "TST-371005"], [SELF, "TST-371208"], [READS, "TST-479105"]] },
  "4c-workflow": { uc: "**4c. The instance's own SPEC, without a token.**", evidence: [[OLD, "TST-371006"], [SELF, "TST-371209"]] },
  "4d-several": { uc: "**4d. The reviewer accepts several entries of one queue.**", evidence: [[OLD, "TST-371003"], [SELF, "TST-371210"], [SELF, "TST-371211"]] },
  "5a-changed": { uc: "**5a. The proposal or the SPEC section changed since the reviewer opened it.**", evidence: [[OLD, "TST-371004"], [SELF, "TST-371212"]] },
  "postcondition-history": { uc: "The commit history shows who approved, when, and which text", evidence: [[SELF, "TST-371212"]] },
  "postcondition-text": { uc: "The SPEC contains exactly the approved text.", evidence: [[OLD, "TST-371001"], [SELF, "TST-371212"]] },
  "register": { uc: "**Reviewer** — has write access to the product repository.", evidence: [[REGISTER, "TST-844201"]] },
};

// TST-371201 · level: system · module: system
// guards: UC-006
// given: UC-006 as committed text, the executable tests named in FLOW_EVIDENCE
// input: compare every passage of the main flow, of the alternative flows 3a, 3b, 4a, 4b, 4c, 4d and 5a and of the postcondition with its executable evidence
// expect: every named passage stands in UC-006; every evidence file exists and declares its TST id with the level system; every alternative flow UC-006 names is among the passages; known positive: UC-006 names exactly these seven alternative flows
test("TST-371201: UC-006 every passage of the main flow and of each alternative flow has an executable test", () => {
  const text = read(UC);
  for (const [name, { uc }] of Object.entries(FLOW_EVIDENCE)) assert.ok(text.includes(uc), `${name}: UC-006 says "${uc}"`);
  for (const [name, { evidence }] of Object.entries(FLOW_EVIDENCE)) {
    assert.ok(evidence.length > 0, `${name}: a test is named`);
    for (const [file, id] of evidence) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${name}: ${file} exists`);
      const declared = testDeclarations(file, read(file)).find((each) => each.id === id);
      assert.ok(declared, `${name}: ${id} is declared in ${file}`);
      assert.equal(declared.level, "system", `${id} is a system test`);
    }
  }
  const flows = [...text.matchAll(/^- \*\*(\d+[a-z])\. /gm)].map((match) => match[1]);
  assert.deepEqual([...flows].sort(), ["3a", "3b", "4a", "4b", "4c", "4d", "5a"], "known positive: UC-006 names these alternative flows");
  for (const flow of flows) assert.ok(Object.keys(FLOW_EVIDENCE).some((name) => name.startsWith(flow)), `${flow} is among the passages`);
});

// ---------------------------------------------------------------- step 1: select an open entry

// TST-371202 · level: system · module: system
// guards: UC-006
// given: a product on GitHub whose queue 2026-03-01_sample holds the open entries 05 and 07 and the entry 06, which waits for the heading entry 05 creates; the reviewer's token is stored
// input: the reviewer opens the list of the SPEC changes, follows the link of entry 07, and the page of that address is drawn
// expect: step 1: the list names the three entries with the states open, waiting for its anchor and open and a link for each, the link of 07 leading to #spec-entry/id=spec-2026-03-01_sample-07/product=<the product's address>; the page that address leads to is headed "2026-03-01_sample · entry 07", shows the state open and holds the sections Now in the SPEC, The proposal, Difference, Why and Impact list; the list and the page write nothing
test("TST-371202: UC-006 1 the list links each open entry and the link leads to the entry's page", async () => {
  const w = await world();
  const list = await w.draw({});
  const states = Object.fromEntries([E05, E06, E07].map((item) => [entryId(item), badgeOf(rowOf(list, entryId(item)))]));
  assert.deepEqual(states, { [entryId(E05)]: "open", [entryId(E06)]: "waiting for its anchor", [entryId(E07)]: "open" });
  const hrefOf = (item) => find(rowOf(list, entryId(item)), (node) => node.localName === "a").map((link) => link.getAttribute("href"))[0];
  assert.equal(hrefOf(E07), `#spec-entry/id=${entryId(E07)}/product=${encodeURIComponent(PRODUCT_ADDRESS)}`);
  assert.deepEqual([E05, E06].map(hrefOf), [`#spec-entry/id=${entryId(E05)}/product=${encodeURIComponent(PRODUCT_ADDRESS)}`, `#spec-entry/id=${entryId(E06)}/product=${encodeURIComponent(PRODUCT_ADDRESS)}`]);
  const id = /#spec-entry\/id=([^/]+)\//.exec(hrefOf(E07))[1];
  const page = await w.draw({ id });
  assert.equal(find(page, (node) => node.localName === "h2")[0].textContent, "2026-03-01_sample · entry 07");
  assert.equal(badgeOf(page), "open");
  assert.deepEqual(find(page, (node) => node.localName === "h3" && node.parentNode.localName === "section").slice(0, 5).map((node) => node.textContent),
    ["Now in the SPEC", "The proposal", "Difference", "Why", "Impact list"]);
  assert.deepEqual(w.writes(), [], "opening writes nothing");
});

// ---------------------------------------------------------------- step 3: the reviewer's check of a rule

// TST-371203 · level: system · module: system
// guards: UC-006; A RULE IS CHECKABLE; ONE STATEMENT PER REQUIREMENT
// given: a product on GitHub whose entry 07 proposes "A writer writes a file entirely and flushes it." for A WRITE RULE, and another world whose entry 07 proposes "A writer writes a file entirely." (one statement); the reviewer's token is stored
// input: open the page of entry 07 and then its editor, in each world
// expect: step 3: the page shows the proposal whole, the rule included; the editor's marks name A WRITE RULE with a warning under ONE STATEMENT PER REQUIREMENT for the rule that holds "and" and none for the rule of one statement; in both worlds Accept is still offered, since the decision stays the reviewer's, and nothing is written
test("TST-371203: UC-006 3 the reviewer reads the whole proposal, and a rule that holds \"and\" is marked while Accept stays offered", async () => {
  const two = entry(7, "## 2. Writing", WRITING_NEW.replace("entirely.", "entirely and flushes it."));
  const withAnd = await world({ entries: [two] });
  const page = await withAnd.draw({ id: entryId(two) });
  assert.match(sectionText(page, "proposal"), /A writer writes a file entirely and flushes it\./);
  assert.ok(buttonOf(page, "Accept"), "Accept is offered beside a marked rule");
  const marked = await withAnd.draw({ id: entryId(two), edit: "1" });
  assert.match(byClass(marked, "ol", "marks")[0].textContent, /A WRITE RULE:\d+: warning: the rule contains "and" \[ONE STATEMENT PER REQUIREMENT\]/);
  const single = await world({ entries: [E07] });
  assert.ok(buttonOf(await single.draw({ id: entryId(E07) }), "Accept"));
  const clean = await single.draw({ id: entryId(E07), edit: "1" });
  assert.doesNotMatch(byClass(clean, "ol", "marks")[0].textContent, /ONE STATEMENT PER REQUIREMENT/, "a rule of one statement is not marked");
  assert.deepEqual([...withAnd.writes(), ...single.writes()], []);
});

// ---------------------------------------------------------------- step 7: the entry in SPEC

// TST-371204 · level: system · module: system
// guards: UC-006; A SPECIFICATION CHANGE IS APPROVED BEFORE IT IS WRITTEN
// given: a product on GitHub with the open entry 07; the reviewer's token is stored
// input: the reviewer presses Accept on the page of entry 07; then the page of entry 07 and the list are drawn again from the repository
// expect: step 7: the page, drawn again by the click, shows the state in SPEC, names the commit, and offers neither Accept, Edit nor Reject; the entry's page drawn anew shows in SPEC, and the list shows 07 as in SPEC without a tick while 05 stays open
test("TST-371204: UC-006 7 after Accept the entry is shown as in SPEC, on its page and on the list", async () => {
  const w = await world();
  const page = await w.draw({ id: entryId(E07) });
  click(buttonOf(page, "Accept"));
  await w.quiet();
  assert.match(resultOf(page), /^Accepted in commit [0-9a-f]{7}\.$/);
  assert.equal(badgeOf(page), "in SPEC");
  assert.equal(w.writes().length, 1);
  const again = await w.draw({ id: entryId(E07) });
  assert.equal(badgeOf(again), "in SPEC");
  for (const label of ["Accept", "Reject"]) assert.equal(buttonOf(again, label), undefined, `${label} is not offered for an entry in SPEC`);
  assert.equal(find(again, (node) => node.localName === "a" && node.className.split(" ").includes("edit-link")).length, 0, "Edit is not offered");
  const list = await w.draw({});
  assert.equal(badgeOf(rowOf(list, entryId(E07))), "in SPEC");
  assert.equal(badgeOf(rowOf(list, entryId(E05))), "open");
});

// ---------------------------------------------------------------- 3a: different wording, then Accept

// TST-371205 · level: system · module: system
// guards: UC-006; EDITS ARE PREPARED ON THE DASHBOARD; A SPECIFICATION CHANGE IS APPROVED BEFORE IT IS WRITTEN
// given: a product on GitHub with the open entry 07, whose proposal says "A writer writes a file entirely."; the reviewer's token is stored
// input: open the edit page of entry 07, change the proposal to "A writer writes a file entirely, without paraphrase.", give a Why, press Save; then press Accept on the entry
// expect: 3a: the Save commits the proposal and the rationale only; the entry is shown again from step 2 — the state open, the proposal "A writer writes a file entirely, without paraphrase.", the current section still "A writer writes a file whole." and the difference holding the new line; Accept then writes the edited text byte for byte into SPEC.md, and the record names the edited proposal's blob, not the first one's
test("TST-371205: UC-006 3a after Save the entry is shown from step 2 with the new text, and Accept applies to that text", async () => {
  const w = await world();
  const edited = WRITING_NEW.replace("entirely.", "entirely, without paraphrase.");
  const editor = await w.draw({ id: entryId(E07), edit: "1" });
  typeInto(areaOf(editor), edited);
  whyOf(editor).value = "The reviewer wants the exact wording to be explicit.";
  click(buttonOf(editor, "Save"));
  await w.quiet();
  assert.equal(w.writes().length, 1);
  assert.deepEqual(Object.keys(w.writes()[0].files).sort(), [proposalPath(E07), rationalePath(E07)].sort());
  assert.match(byClass(editor, "p", "entry")[0].textContent, /^Saved in place: spec-2026-03-01_sample-07 in this commit\.$/);
  assert.equal(badgeOf(editor), "open");
  assert.match(sectionText(editor, "proposal"), /A writer writes a file entirely, without paraphrase\./);
  assert.match(sectionText(editor, "current"), /A writer writes a file whole\./);
  assert.match(sectionText(editor, "difference"), /\+ A writer writes a file entirely, without paraphrase\./);
  click(buttonOf(editor, "Accept"));
  await w.quiet();
  const [, accepted] = w.writes();
  assert.equal(accepted.files["SPEC.md"], HEAD + READING + edited, "the edited text is written byte for byte");
  const record = fieldsOf(Object.entries(accepted.files).find(([path]) => path.startsWith("docs/approvals/"))[1]);
  assert.equal(record.blob, blobOf(edited), "the record names the edited text");
  assert.notEqual(record.blob, blobOf(WRITING_NEW));
});

// ---------------------------------------------------------------- 4a: reject

// TST-371206 · level: system · module: system
// guards: UC-006; A PROPOSAL IS REJECTED WITH A REASON; A REJECTION REMOVES THE PROPOSAL
// given: a product on GitHub whose queue holds the entries 05, 06 and 07; the reviewer's token is stored
// input: the reviewer presses Reject on the page of entry 07 with no reason typed; then types "The wording is wrong." and presses Reject; then the list is drawn
// expect: 4a: the first click writes nothing and says the reason is missing; the second makes one commit with the reason in its message, under the token the reviewer stored, that deletes the proposal and the rationale of entry 07 and rewrites only the queue's index without the row 07 (rows 05 and 06 stay); it writes no approval record and no decision row and leaves SPEC.md as it was; the page says "Rejected in commit" and the list no longer holds 07
test("TST-371206: UC-006 4a Reject with a reason removes the entry from its queue in one commit and writes no record", async () => {
  const w = await world();
  const before = w.files();
  const page = await w.draw({ id: entryId(E07) });
  click(buttonOf(page, "Reject"));
  await w.quiet();
  assert.match(byClass(page, "div", "reject-result")[0].textContent, /Type the reason for rejecting first: nothing was written\./);
  assert.deepEqual(w.writes(), []);
  reasonOf(page).value = "The wording is wrong.";
  click(buttonOf(page, "Reject"));
  await w.quiet();
  assert.equal(w.writes().length, 1, "one commit");
  const [commit] = w.writes();
  assert.match(commit.message, /Reason: The wording is wrong\./);
  assert.deepEqual(commit.deleted.sort(), [proposalPath(E07), rationalePath(E07)].sort());
  assert.deepEqual(Object.keys(commit.files), [`${QUEUE}/index.md`], "only the index is rewritten");
  const index = commit.files[`${QUEUE}/index.md`];
  assert.doesNotMatch(index, /\| 07 \|/);
  assert.match(index, /\| 05 \|[^\n]*## 1\. Reading/);
  assert.match(index, /\| 06 \|[^\n]*## 1a\. Added/);
  assert.deepEqual(w.writers().map((request) => request.authorization), Array(3).fill(`Bearer ${TOKENS.product.value}`), "the commit is made with the reviewer's token");
  const after = w.files();
  assert.equal(after["SPEC.md"], before["SPEC.md"], "the SPEC is unchanged");
  assert.equal(after[`${QUEUE}/entscheidungen.md`], DECISIONS, "no decision row");
  assert.deepEqual(Object.keys(after).filter((path) => path.startsWith("docs/approvals/")), [], "no approval record");
  assert.match(resultOf(page), /^Rejected in commit [0-9a-f]{7}\.$/);
  const list = await w.draw({});
  assert.equal(rowOf(list, entryId(E07)), undefined);
  assert.equal(badgeOf(rowOf(list, entryId(E05))), "open");
});

// TST-371207 · level: system · module: system
// guards: UC-006; A REJECTION REMOVES THE PROPOSAL; A STALE APPROVAL IS NOT APPLIED
// given: a product on GitHub whose queue holds the one entry 07; then another product whose queue holds 05 and 07, where another writer changes the proposal of 07 after the page showed it; the reviewer's token is stored
// input: reject the only entry with the reason "Not wanted."; in the other world press Reject on the shown page of 07 with the reason "Too late." after the change
// expect: 4a: rejecting the queue's last entry deletes every file of the queue's folder (index, decisions, proposal, rationale) in one commit and leaves SPEC.md; an entry whose proposal changed after it was shown is not rejected: nothing is written, the page says 07 changed after it was shown and shows the newer proposal
test("TST-371207: UC-006 4a rejecting the last entry takes the whole queue, and an entry that changed after it was shown is not rejected", async () => {
  const last = await world({ entries: [E07] });
  const page = await last.draw({ id: entryId(E07) });
  reasonOf(page).value = "Not wanted.";
  click(buttonOf(page, "Reject"));
  await last.quiet();
  assert.equal(last.writes().length, 1);
  assert.deepEqual(last.writes()[0].deleted.sort(), [`${QUEUE}/entscheidungen.md`, `${QUEUE}/index.md`, proposalPath(E07), rationalePath(E07)].sort());
  assert.equal(last.files()["SPEC.md"], SPEC);
  assert.deepEqual(Object.keys(last.files()).filter((path) => path.startsWith("docs/spec-freigaben/")), []);

  const moved = await world();
  const shown = await moved.draw({ id: entryId(E07) });
  await moved.land({ [proposalPath(E07)]: WRITING_NEW.replace("entirely.", "completely.") });
  reasonOf(shown).value = "Too late.";
  click(buttonOf(shown, "Reject"));
  await moved.quiet();
  assert.deepEqual(moved.writes(), [], "nothing is written for an entry that changed after it was shown");
  assert.match(resultOf(shown), /spec-2026-03-01_sample-07 changed after it was shown, so nothing was written\./);
  assert.match(sectionText(shown, "proposal"), /A writer writes a file completely\./);
});

// ---------------------------------------------------------------- 4b: no token

// TST-371208 · level: system · module: system
// guards: UC-006; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; NO TEXT TRAVELS IN A URL
// given: the instance's own SPEC with the open entry 07 and no token stored; the clipboard and the window of the browser are recorded
// input: open the edit page of entry 07, change the proposal to "A writer writes a file entirely, as shown.", give a Why, press Save; then on the entry's page type the reason "No." and press Reject
// expect: 4b: nothing is written from the dashboard; the edited proposal is on the clipboard and GitHub's editor is opened once, for the proposal's file (…/edit/main/<queue>/07-entry-7.md) with no text in the address; GitHub's pages for the proposal and the rationale are linked; Reject, too, writes nothing and hands back GitHub's pages for the files it deletes with the message to commit them with, which names the reason
test("TST-371208: UC-006 4b without a token an edit opens GitHub's editor with the text on the clipboard, and a rejection hands back GitHub's pages", async () => {
  const w = await world({ mode: "instance", token: false, entries: [E07] });
  const asked = { clipboard: [], opened: [] };
  Object.defineProperty(globalThis, "navigator", { value: { clipboard: { writeText: async (written) => { asked.clipboard.push(written); } } }, configurable: true, writable: true });
  globalThis.open = (url) => { asked.opened.push(url); return null; };
  const edited = WRITING_NEW.replace("entirely.", "entirely, as shown.");
  const editor = await w.draw({ id: entryId(E07), edit: "1" });
  typeInto(areaOf(editor), edited);
  whyOf(editor).value = "GitHub's editor should carry the proposal.";
  click(buttonOf(editor, "Save"));
  await until(() => byClass(editor, "a", "github-page").length === 2, "GitHub's pages for the entry's two files");
  assert.deepEqual(asked.clipboard, [edited], "the edited proposal is on the clipboard");
  assert.equal(asked.opened.length, 1);
  assert.equal(asked.opened[0].startsWith("https://github.com/akmaier/agent-m/edit/main/"), true);
  assert.ok(asked.opened[0].endsWith(`/edit/main/${proposalPath(E07)}`), asked.opened[0]);
  assert.deepEqual(byClass(editor, "a", "github-page").map((link) => link.textContent).sort(), [`Open GitHub's page for ${proposalPath(E07)}`, `Open GitHub's page for ${rationalePath(E07)}`].sort());
  for (const link of byClass(editor, "a", "github-page")) assert.ok(!decodeURIComponent(link.getAttribute("href")).includes("as shown"), "no text in the address");
  assert.deepEqual(w.writes(), []);

  const page = await w.draw({ id: entryId(E07) });
  reasonOf(page).value = "No.";
  click(buttonOf(page, "Reject"));
  await w.quiet();
  assert.deepEqual(w.writes(), [], "Reject writes nothing without a token");
  assert.match(byClass(page, "pre", "commit-message")[0].textContent, /^reject spec-2026-03-01_sample-07\n\nReason: No\.\n$/);
  const deleting = byClass(page, "a", "github-page").map((link) => link.getAttribute("href")).filter((href) => href.includes("/delete/main/"));
  assert.deepEqual(deleting.sort(), [`${QUEUE}/entscheidungen.md`, `${QUEUE}/index.md`, proposalPath(E07), rationalePath(E07)].map((path) => `https://github.com/akmaier/agent-m/delete/main/${path}`).sort(),
    "GitHub's page that deletes each file of the queue, since 07 is its last entry");
});

// ---------------------------------------------------------------- 4c: the instance's workflow

// TST-371209 · level: system · module: system
// guards: UC-006; WITHOUT A TOKEN, THE INSTANCE'S WORKFLOW WRITES THE CHANGE; A STALE APPROVAL IS NOT APPLIED
// given: the instance's own SPEC with the entry 07 and the approval record a person committed on GitHub's page, no decision row naming it; no token stored; the instance workflow's checkout in a temporary git repository
// input: draw the page of entry 07; run the workflow entry onApprovalsCommitted; draw the page of entry 07 over the files the workflow's commit holds; and, apart, run the workflow where the requirement of the proposal names a source the instance does not link, and where only the record of entry 06 stands although entry 05 creates its heading
// expect: 4c: before the workflow the page shows the state approved with the note that the apply workflow writes it, offers no Accept, and SPEC.md is unchanged; the workflow ends done and writes SPEC.md and the decisions only; after it the page shows in SPEC; the same checks apply: a requirement that names no linked source is refused, the outcome failed, and nothing is written; the record of 06 alone is refused naming entry 05, and the records of 05 and 06 together are applied in that order
test("TST-371209: UC-006 4c an approval committed on GitHub's page is shown as approved until the workflow writes it, and the workflow applies the same checks", async () => {
  const files = { ...queueFiles({ entries: [E07] }), "docs/sources/SRC-fixture-po.md": REGISTER_ENTRY, [recordPath(E07)]: recordText(E07, WRITING) };
  const before = await world({ mode: "instance", token: false, entries: [E07], files: { [recordPath(E07)]: recordText(E07, WRITING) } });
  const waiting = await before.draw({ id: entryId(E07) });
  assert.equal(badgeOf(waiting), "approved");
  assert.match(byClass(waiting, "p", "approved-note")[0].textContent, /the apply workflow writes it/);
  assert.equal(buttonOf(waiting, "Accept"), undefined);
  assert.equal(before.files()["SPEC.md"], SPEC);

  const written = await withGitInstance(files, async (fixture) => {
    const status = await runEntry("onApprovalsCommitted", workflowEnv(fixture), { now: NOW });
    assert.equal(status.outcome, "done");
    const after = git(fixture.origin, "rev-parse", "main");
    assert.deepEqual(git(fixture.origin, "diff", "--name-only", fixture.head, after).split("\n").sort(), ["SPEC.md", `${QUEUE}/entscheidungen.md`].sort());
    return { "SPEC.md": `${git(fixture.origin, "show", `${after}:SPEC.md`)}\n`, [`${QUEUE}/entscheidungen.md`]: `${git(fixture.origin, "show", `${after}:${QUEUE}/entscheidungen.md`)}\n` };
  });
  assert.equal(written["SPEC.md"], HEAD + READING + WRITING_NEW);
  const done = await world({ mode: "instance", token: false, entries: [E07], files: { [recordPath(E07)]: recordText(E07, WRITING), ...written } });
  assert.equal(badgeOf(await done.draw({ id: entryId(E07) })), "in SPEC");

  await withGitInstance({ ...files, "docs/sources.md": LINKS.replace("SRC-fixture-po", "SRC-someone-else") }, async (fixture) => {
    const status = await runEntry("onApprovalsCommitted", workflowEnv(fixture), { now: NOW });
    assert.equal(status.outcome, "failed", "a requirement that names no linked source is refused, as on the dashboard");
    assert.match(status.summary, /a requirement of its proposal names no source the product links: A WRITE RULE/);
    assert.equal(git(fixture.origin, "rev-parse", "main"), fixture.head, "nothing is written");
  });

  const pair = { ...queueFiles({ entries: [E05, E06] }), "docs/sources/SRC-fixture-po.md": REGISTER_ENTRY };
  await withGitInstance({ ...pair, [recordPath(E06)]: recordText(E06, ADDED) }, async (fixture) => {
    const status = await runEntry("onApprovalsCommitted", workflowEnv(fixture), { now: NOW });
    assert.equal(status.outcome, "failed");
    assert.match(status.summary, /“## 1a\. Added” is created by entry 05 of the queue — it goes only with or after entry 05/);
    assert.equal(git(fixture.origin, "rev-parse", "main"), fixture.head, "06 alone writes nothing");
  });
  await withGitInstance({ ...pair, [recordPath(E05)]: recordText(E05, READING), [recordPath(E06)]: recordText(E06, ADDED) }, async (fixture) => {
    const status = await runEntry("onApprovalsCommitted", workflowEnv(fixture), { now: NOW });
    assert.equal(status.outcome, "done");
    assert.equal(`${git(fixture.origin, "show", `${git(fixture.origin, "rev-parse", "main")}:SPEC.md`)}\n`, HEAD + READING_NEW + ADDED_NEW + WRITING, "05, then 06, in the queue's order");
  });
});

// ---------------------------------------------------------------- 4d: an entry whose heading another creates

// TST-371210 · level: system · module: system
// guards: UC-006; A QUEUE IS ACCEPTED IN ITS ORDER; A STALE APPROVAL IS NOT APPLIED
// given: a product on GitHub whose queue holds entry 05, which changes "## 1. Reading" and adds the heading "## 1a. Added", and entry 06, which changes "## 1a. Added"; the reviewer's token is stored
// input: open the page of entry 06; then press Accept on the page of entry 05 alone; then draw 06 again and press Accept on it
// expect: 4d: 06 is shown as waiting for its anchor, names entry 05 ("It goes only with or after entry 05") and offers no Accept; after 05 alone is accepted, 06 is open and its Accept writes the section "## 1a. Added" as entry 06 proposes it, on top of what 05 wrote
test("TST-371210: UC-006 4d an entry that waits for a heading is offered only after the entry that creates it, and the page names that entry", async () => {
  const w = await world({ entries: [E05, E06] });
  const waiting = await w.draw({ id: entryId(E06) });
  assert.equal(badgeOf(waiting), "waiting for its anchor");
  assert.match(byClass(waiting, "p", "waits")[0].textContent, /It goes only with or after entry 05, which creates its heading/);
  assert.equal(buttonOf(waiting, "Accept"), undefined);
  const first = await w.draw({ id: entryId(E05) });
  click(buttonOf(first, "Accept"));
  await w.quiet();
  assert.equal(w.writes().length, 1);
  assert.equal(w.files()["SPEC.md"], HEAD + READING_NEW + ADDED + WRITING);
  const second = await w.draw({ id: entryId(E06) });
  assert.equal(badgeOf(second), "open");
  click(buttonOf(second, "Accept"));
  await w.quiet();
  assert.equal(w.writes().length, 2);
  assert.equal(w.files()["SPEC.md"], HEAD + READING_NEW + ADDED_NEW + WRITING);
});

// ---------------------------------------------------------------- 5a: the proposal or the section changed

// TST-371211 · level: system · module: system
// guards: UC-006; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A QUEUE IS ACCEPTED IN ITS ORDER
// given: a product on GitHub whose queue holds the open entries 05 and 07; the reviewer's token is stored
// input: open the list, open the pages of 05 and 07 so that both are shown, tick only 05 and press Accept ticked
// expect: 4d: one commit that writes entry 05 only — one approval record (05's), the decision row for 05, the SPEC section of 05 — and none for 07, which was shown and not ticked; the list afterwards shows 05 in SPEC and 07 still open
test("TST-371211: UC-006 4d Accept ticked writes the ticked entry only, in one commit with its record", async () => {
  const w = await world({ entries: [E05, E07] });
  await w.draw({ id: entryId(E05) });
  await w.draw({ id: entryId(E07) });
  const list = await w.draw({});
  tick(boxOf(list, entryId(E05)));
  click(buttonOf(list, "Accept ticked (1)"));
  await w.quiet();
  assert.equal(w.writes().length, 1);
  assert.deepEqual(Object.keys(w.writes()[0].files).sort(), [recordPath(E05), `${QUEUE}/entscheidungen.md`, "SPEC.md"].sort());
  assert.equal(w.writes()[0].files["SPEC.md"], HEAD + READING_NEW + ADDED + WRITING, "07's section is untouched");
  const after = await w.draw({});
  assert.equal(badgeOf(rowOf(after, entryId(E05))), "in SPEC");
  assert.equal(badgeOf(rowOf(after, entryId(E07))), "open");
});

// TST-371212 · level: system · module: system
// guards: UC-006; A STALE APPROVAL IS NOT APPLIED; THE REPLACED TEXT STAYS REACHABLE; THE GATE IS RECORDED
// given: a product on GitHub with the open entry 07; the reviewer's token is stored
// input: press Accept on the shown page of 07 after another writer changed 07's proposal; again after another writer changed the SPEC section "## 2. Writing"; then, on the page drawn from the newest state, press Accept; then draw History of SPEC change entries
// expect: 5a: each first click writes nothing and says what changed; the page is drawn again with the newer text and Accept offered; the click on the current text writes one commit whose record names the proposal's and the section's blobs as they were then; postcondition: the commit's parent is the head it was written on and the branch is moved without force, the replaced section stands in no file of the new tree, and History of SPEC change entries lists the record with the person who committed it (alice) and the day
test("TST-371212: UC-006 5a an entry changed after it was shown is decided anew on the current text, and the history names who, when and which text", async () => {
  const w = await world({ entries: [E07] });
  const first = await w.draw({ id: entryId(E07) });
  await w.land({ [proposalPath(E07)]: WRITING_NEW.replace("entirely.", "completely.") });
  click(buttonOf(first, "Accept"));
  await w.quiet();
  assert.deepEqual(w.writes(), []);
  assert.match(resultOf(first), /entry 07 of 2026-03-01_sample: the proposal changed after it was shown/);
  assert.match(sectionText(first, "proposal"), /A writer writes a file completely\./);
  assert.ok(buttonOf(first, "Accept"), "Accept is offered again");
  const second = await w.draw({ id: entryId(E07) });
  await w.land({ "SPEC.md": HEAD + READING + WRITING_OTHER });
  click(buttonOf(second, "Accept"));
  await w.quiet();
  assert.deepEqual(w.writes(), []);
  assert.match(resultOf(second), /the SPEC section changed after it was shown/);
  assert.match(sectionText(second, "current"), /A writer writes a file in one piece\./);

  const head = w.head();
  click(buttonOf(second, "Accept"));
  await w.quiet();
  assert.equal(w.writes().length, 1);
  const completely = WRITING_NEW.replace("entirely.", "completely.");
  const [commit] = w.writes();
  assert.equal(commit.files["SPEC.md"], HEAD + READING + completely);
  const record = fieldsOf(Object.entries(commit.files).find(([path]) => path.startsWith("docs/approvals/"))[1]);
  assert.equal(record.blob, blobOf(completely));
  assert.equal(record.section, blobOf(WRITING_OTHER));
  const made = w.writers().filter((request) => request.path.endsWith("/git/commits")).at(-1).body, moved = w.writers().at(-1);
  assert.deepEqual(made.parents, [head], "the commit's parent is the head it was written on");
  assert.equal(moved.body.force ?? false, false, "the branch is moved without force");
  assert.deepEqual(Object.entries(w.files()).filter(([, body]) => body.includes("A writer writes a file in one piece.")).map(([path]) => path), [], "the replaced section stands in no file of the new tree");
  const history = await w.draw({ id: "history" });
  const rows = find(history, (node) => node.localName === "tr" && node.getAttribute("data-id")).map((row) => row.textContent);
  assert.equal(rows.length, 1);
  assert.match(rows[0], /alice/);
  assert.match(rows[0], /2026-11-01/);
});
