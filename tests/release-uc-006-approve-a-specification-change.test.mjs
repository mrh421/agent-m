// Release tests of the requirements UC-006 "Approve a specification change" realises, each checked from what a reviewer reads on the review page of a SPEC entry and from the requests the fixture server of GitHub received and the commits a temporary git
// repository holds: the change shown beside the text it replaces, the approved text taken byte for byte, the gate recorded, the approval naming the exact text, the replaced text reachable, a stale approval not applied, the dashboard writing only on a person's
// click, one click per decision, edits prepared on the dashboard, acceptance as the accepting person's commit, the change written with its approval, the instance's workflow writing it without a token, a queue accepted in its order, several entries accepted in one
// click, a proposal rejected with a reason and a rejection removing the proposal. TST-371301 maps every requirement UC-006 realises to the release tests that guard it.
// Run: node --test tests/release-uc-006-approve-a-specification-change.test.mjs
//
// Module: MOD-review-pages
// Module: MOD-spec-changes
// Module: MOD-workflow-entries
// Guards: UC-006
// Level: release
//
// Written for the release testing of sprint 142 by developer-sonnet-j (ITM-371), who implemented none of ITM-302, ITM-312, ITM-315, ITM-339, ITM-340, ITM-364, ITM-342, ITM-357, ITM-394 and ITM-397 and no case's behaviour but three small items of UC-006's code,
// which no case guards: ITM-1274 (entryImpact; the requirement A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST is mapped to the release cases other writers wrote), ITM-1315 (Accept disabled on a file that rests on what is not accepted: no file of a SPEC
// entry) and ITM-659 (the key of a stored token: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK is therefore left for another writer, named in the map). The world is tests/uc-006-harness.mjs: the real review pages, MOD-spec-changes, MOD-approvals and
// the real MOD-repository-hosts behind a fixture server of GitHub; the release team works from the specification and the pages, so each case ends at what a person reads on the page and at the request the fixture received. Where the page and the SPEC or
// UC-006 disagree the case follows the text and is marked `todo` with the word FINDING. Readings the texts leave open, which the cases state:
//   - "who decided" (THE GATE IS RECORDED) is read as: the commit is made with the person's token and sets no author or committer of its own, so the server names the account and the time, and the history page lists that account; "when" also stands in the
//     decision row; "on which text" is read as the proposal's path and blob and the SPEC section's blob in the approval record.
//   - "a gate" of a SPEC change is read as the acceptance of an entry: it is the one passage of UC-006 at which a person decides.
//   - A RULE IS CHECKABLE and NO STATE IN THE SPECIFICATION are guarded only at review (the SPEC says: no automatic check; at review). They are read as: the page puts the proposal whole before the reviewer, no automatic check takes the decision away, and the reviewer can
//     refuse a proposal on those grounds with a reason.
//   - "Reject ... for every SPEC change entry it offers to accept" is read as: Reject stands beside every entry that is open, stale or waiting for its anchor, and beside none that is decided.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { runEntry } from "../src/workflow-entries/main.mjs";
import { E05, E06, E07, HEAD, LINKS, QUEUE, READING, READING_NEW, ADDED, ADDED_NEW, WRITING, WRITING_NEW, WRITING_OTHER, WRITE_RULE, SPEC, DECISIONS, REGISTER_ENTRY, TOKENS, areaOf, blobOf, boxOf, buttonOf, buttonsNamed, byClass, click,
  entry, entryId, fieldsOf, find, git, gitStatus, proposalPath, queueFiles, rationalePath, reasonOf, recordName, recordPath, recordText, resultOf, rowOf, scripted, sectionText, tick, typeInto, until, whyOf, withGitInstance, workflowEnv, world } from "./uc-006-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const UC = "docs/use-cases/UC-006-approve-a-specification-change.md";
const SELF = "tests/release-uc-006-approve-a-specification-change.test.mjs";
const NOW = new Date("2026-03-01T10:00:00Z");
const text = (...lines) => `${lines.join("\n")}\n`;
const scriptedClick = (node) => node.dispatchEvent(scripted("click"));
const commitsOf = (w) => w.writers().filter((request) => request.path.endsWith("/git/commits"));
const REF = (w) => w.writers().filter((request) => request.method === "PATCH");
const recordOf = (files) => Object.entries(files).find(([path]) => path.startsWith("docs/approvals/"));

// ---------------------------------------------------------------- the map

// Each requirement UC-006 realises, with the release tests that guard it: this file's, and those other writers wrote. A requirement with no test named is left, and the map says to whom.
const EVIDENCE = {
  "A SPECIFICATION CHANGE IS APPROVED BEFORE IT IS WRITTEN": [[SELF, "TST-371302"], ["tests/release-sprint-02-c-review-core.test.mjs", null]],
  "NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT": [[SELF, "TST-371303"]],
  "THE APPROVED TEXT IS TAKEN VERBATIM": [[SELF, "TST-371304"]],
  "THE GATE IS RECORDED": [[SELF, "TST-371305"]],
  "THE REPLACED TEXT STAYS REACHABLE": [[SELF, "TST-371307"]],
  "A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST": [["tests/release-uc-006-batched-reads.test.mjs", "TST-479201"], ["tests/release-itm-1274-entry-impact-without-rationale.test.mjs", "TST-1274301"]],
  "A RULE IS CHECKABLE": [[SELF, "TST-371308"]],
  "NO STATE IN THE SPECIFICATION": [[SELF, "TST-371309"]],
  "AN APPROVAL NAMES THE EXACT TEXT": [[SELF, "TST-371306"]],
  "A STALE APPROVAL IS NOT APPLIED": [[SELF, "TST-371310"]],
  "THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK": [[SELF, "TST-371311"]],
  "WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK": [],
  "ONE CLICK PER DECISION": [[SELF, "TST-371312"]],
  "EDITS ARE PREPARED ON THE DASHBOARD": [[SELF, "TST-371313"]],
  "ACCEPTANCE IS A COMMIT BY THE ACCEPTING PERSON": [[SELF, "TST-371314"]],
  "AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL": [[SELF, "TST-371315"]],
  "WITHOUT A TOKEN, THE INSTANCE'S WORKFLOW WRITES THE CHANGE": [[SELF, "TST-371316"]],
  "A QUEUE IS ACCEPTED IN ITS ORDER": [[SELF, "TST-371317"]],
  "SEVERAL FILES ARE ACCEPTED IN ONE CLICK": [[SELF, "TST-371318"]],
  "A PROPOSAL IS REJECTED WITH A REASON": [[SELF, "TST-371319"]],
  "A REJECTION REMOVES THE PROPOSAL": [[SELF, "TST-371320"]],
};
// The requirements left without a release test of this battery, and why: the writer touched the code that decides whether a token is stored.
const LEFT = { "WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK": "ITM-659, by developer-sonnet-j, changed how storedToken computes the key of the stored token, which decides whether the page offers GitHub's pages" };

// TST-371301 · level: release · module: system
// guards: UC-006
// given: UC-006 as committed text, whose `realises` lists twenty-one requirements, and the release tests named in EVIDENCE
// input: read UC-006's list of the requirements it realises, and the declarations of the test files named for each
// expect: known positive — UC-006 realises these twenty-one requirements; each has at least one release test named except the one in LEFT, which is named with why; each test named stands in its file with the level release and guards that requirement
test("TST-371301: UC-006 every requirement it realises has a release test that guards it, or is named as left for another writer", () => {
  const front = /^realises:\n((?:  - .*\n)+)/m.exec(read(UC))?.[1] ?? "";
  const realised = front.split("\n").filter(Boolean).map((line) => line.replace(/^ {2}- /, ""));
  assert.equal(realised.length, 21, "known positive: UC-006 realises twenty-one requirements");
  assert.deepEqual([...realised].sort(), Object.keys(EVIDENCE).sort(), "the map holds exactly the requirements UC-006 realises");
  assert.deepEqual(Object.keys(LEFT), ["WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK"]);
  for (const [requirement, named] of Object.entries(EVIDENCE)) {
    if (requirement in LEFT) { assert.equal(named.length, 0, `${requirement}: left, no test of this battery`); continue; }
    assert.ok(named.length > 0, `${requirement}: a test is named`);
    for (const [file, id] of named) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${requirement}: ${file} exists`);
      if (id === null) continue;
      const declared = testDeclarations(file, read(file)).find((each) => each.id === id);
      assert.ok(declared, `${requirement}: ${id} is declared in ${file}`);
      assert.equal(declared.level, "release", `${id} is a release test`);
      assert.ok((declared.guards ?? []).includes(requirement), `${id} guards ${requirement}`);
    }
  }
});

// ---------------------------------------------------------------- shown beside, approved, taken verbatim

// TST-371302 · level: release · module: system
// guards: A SPECIFICATION CHANGE IS APPROVED BEFORE IT IS WRITTEN; UC-006
// given: a product on GitHub whose queue holds the open entry 07, which changes "## 2. Writing"; the reviewer's token is stored
// input: the page of entry 07 is drawn; its editor is opened and an edit typed and saved with a Why; a script presses Accept; the reviewer presses Accept
// expect: until the reviewer's click SPEC.md at the head is the text it was (the page, the editor and the saved edit wrote only the entry's own files, never SPEC.md); the script's click writes nothing; the reviewer's click writes SPEC.md with the section the entry proposes
test("TST-371302: a SPEC change is written only after the reviewer accepts it, beside the text it replaces", async () => {
  const w = await world({ entries: [E07] });
  const page = await w.draw({ id: entryId(E07) });
  assert.match(sectionText(page, "current"), /A writer writes a file whole\./);
  assert.match(sectionText(page, "proposal"), /A writer writes a file entirely\./);
  assert.equal(w.files()["SPEC.md"], SPEC, "drawing the page wrote nothing");
  const editor = await w.draw({ id: entryId(E07), edit: "1" });
  typeInto(areaOf(editor), WRITING_NEW.replace("entirely.", "entirely, edited."));
  whyOf(editor).value = "The reviewer wants it explicit.";
  click(buttonOf(editor, "Save"));
  await w.quiet();
  assert.equal(w.writes().length, 1, "the saved edit is one commit");
  assert.deepEqual(Object.keys(w.writes()[0].files).sort(), [proposalPath(E07), rationalePath(E07)].sort());
  assert.equal(w.files()["SPEC.md"], SPEC, "the saved edit did not write the SPEC");
  const shown = await w.draw({ id: entryId(E07) });
  scriptedClick(buttonOf(shown, "Accept"));
  await w.quiet();
  assert.equal(w.writes().length, 1, "a script's click writes nothing");
  assert.equal(w.files()["SPEC.md"], SPEC);
  click(buttonOf(shown, "Accept"));
  await w.quiet();
  assert.equal(w.writes().length, 2);
  assert.equal(w.files()["SPEC.md"], HEAD + READING + WRITING_NEW.replace("entirely.", "entirely, edited."));
});

// TST-371303 · level: release · module: system
// guards: NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT; UC-006
// given: a product on GitHub whose SPEC holds "## 1. Reading" and "## 2. Writing"; the queue holds entry 07, which changes "## 2. Writing", and entry 08, which proposes the heading "## 4. Appended", which the SPEC lacks and no entry creates
// input: draw the page of entry 07; another writer changes the SPEC section "## 2. Writing" and the page is drawn again; draw the page of entry 08
// expect: the page of 07 shows the section as the SPEC holds it — its heading, rule name, sentence and check line, all of them, not a summary — beside the proposal and a difference with the removed line "- A writer writes a file whole." and the added line "+ A writer writes a file entirely."; after the other writer's change the page shows the new text of the section and not the old; the page of 08 says "There is no such section yet." instead of showing another section
test("TST-371303: the page puts the section that holds now beside the proposal, whole, and says when there is none", async () => {
  const appended = entry(8, "## 4. Appended", text("## 4. Appended", "A reader appends to a file."));
  const w = await world({ entries: [E07, appended] });
  const page = await w.draw({ id: entryId(E07) });
  const current = sectionText(page, "current");
  for (const line of [/Now in the SPEC/, /2\. Writing/, /A WRITE RULE \(Fixture PO\)/, /A writer writes a file whole\./, /no automatic check; at review/]) assert.match(current, line);
  assert.doesNotMatch(current, /entirely/, "the current text is not the proposal");
  assert.match(sectionText(page, "difference"), /- A writer writes a file whole\./);
  assert.match(sectionText(page, "difference"), /\+ A writer writes a file entirely\./);
  await w.land({ "SPEC.md": HEAD + READING + WRITING_OTHER });
  const again = await w.draw({ id: entryId(E07) });
  assert.match(sectionText(again, "current"), /A writer writes a file in one piece\./);
  assert.doesNotMatch(sectionText(again, "current"), /A writer writes a file whole\./);
  assert.match(sectionText(again, "difference"), /- A writer writes a file in one piece\./);
  const none = await w.draw({ id: entryId(appended) });
  assert.match(sectionText(none, "current"), /There is no such section yet\./);
  assert.doesNotMatch(sectionText(none, "current"), /A WRITE RULE/);
  assert.match(sectionText(none, "proposal"), /A reader appends to a file\./);
});

// The proposal of TST-371304: tab, trailing spaces, non-ASCII letters and dashes, quotation marks, markup characters and an ampersand — bytes a rewrite could change.
const TRICKY = `## 2. Writing\n\n**${WRITE_RULE}** *(Fixture PO)*\nA writer writes a file — entirely, as “asked”: <b>x</b> & &amp; é ü.  \n\tA tabbed line.\n*Check:* no automatic check; at review\n`;

// TST-371304 · level: release · module: system
// guards: THE APPROVED TEXT IS TAKEN VERBATIM; UC-006
// given: an entry whose proposal holds a tab, trailing spaces, non-ASCII letters and dashes, quotation marks, <b>, & and &amp;; a product on GitHub with the reviewer's token, and the same entry in the instance's own SPEC with a record committed on GitHub's page
// input: the reviewer presses Accept; and, apart, the instance workflow onApprovalsCommitted runs from a temporary git repository
// expect: SPEC.md after the dashboard's commit is the head of the SPEC, the section "## 1. Reading" as it was and the proposal's bytes, so that its git blob SHA is that of that text; the workflow's commit holds the same bytes; the proposal file is unchanged by it, and the section in SPEC.md equals the proposal file character for character
test("TST-371304: the approved text is written byte for byte by the dashboard and by the workflow", async () => {
  const tricky = entry(7, "## 2. Writing", TRICKY);
  const w = await world({ entries: [tricky] });
  const page = await w.draw({ id: entryId(tricky) });
  click(buttonOf(page, "Accept"));
  await w.quiet();
  const wanted = HEAD + READING + TRICKY;
  assert.equal(w.files()["SPEC.md"], wanted);
  assert.equal(blobOf(w.files()["SPEC.md"]), blobOf(wanted));
  assert.equal(w.files()[proposalPath(tricky)], TRICKY, "the proposal file is unchanged");
  assert.ok(w.files()["SPEC.md"].endsWith(TRICKY), "the section in the SPEC equals the proposal file character for character");

  const files = { ...queueFiles({ entries: [tricky] }), "docs/sources/SRC-fixture-po.md": REGISTER_ENTRY, [recordPath(tricky)]: recordText(tricky, WRITING) };
  await withGitInstance(files, async (fixture) => {
    const status = await runEntry("onApprovalsCommitted", workflowEnv(fixture), { now: NOW });
    assert.equal(status.outcome, "done");
    const after = git(fixture.origin, "rev-parse", "main");
    assert.equal(`${git(fixture.origin, "show", `${after}:SPEC.md`)}\n`, wanted);
    assert.equal(`${git(fixture.origin, "show", `${after}:${proposalPath(tricky)}`)}\n`, TRICKY);
  });
});

// ---------------------------------------------------------------- the gate, the exact text, the replaced text

// TST-371305 · level: release · module: system
// guards: THE GATE IS RECORDED; UC-006
// given: a product on GitHub with the open entry 07; the reviewer's token is stored; the clock runs
// input: the reviewer presses Accept on entry 07; then a stale acceptance is tried apart (another writer changes the proposal after it was shown and the reviewer presses Accept); then History of SPEC change entries is drawn
// expect: the commit is made with the reviewer's token and its body sets no author and no committer, so that the server names the account and the time; the queue's decision row carries the day and minute of the click in UTC, the entry's number, the word uebernommen and the name of the approval record; the record names the proposal's path, its blob and the blob of the section it replaced; the history lists the record with the account alice and a date; a refused acceptance records nothing
test("TST-371305: the gate is recorded: who decided, when, and on which text", async () => {
  const w = await world({ entries: [E07] });
  const page = await w.draw({ id: entryId(E07) });
  const from = Date.now();
  click(buttonOf(page, "Accept"));
  await w.quiet();
  const to = Date.now();
  const [commit] = w.writes();
  const body = commitsOf(w)[0].body;
  assert.equal(commitsOf(w)[0].authorization, `Bearer ${TOKENS.product.value}`);
  assert.equal("author" in body || "committer" in body, false, "the dashboard names no author and no committer: the server names the account");
  const row = new RegExp(`^\\| (\\d{4}-\\d{2}-\\d{2}) (\\d{2}):(\\d{2}) UTC \\| 7 \\| uebernommen \\| approval:${recordName(E07)} \\|$`, "m").exec(commit.files[`${QUEUE}/entscheidungen.md`]);
  assert.ok(row, "the decision row names the entry and the record");
  const decided = Date.parse(`${row[1]}T${row[2]}:${row[3]}:00Z`);
  assert.ok(decided >= from - 60000 && decided <= to, "the row carries the minute of the click");
  const record = fieldsOf(commit.files[recordPath(E07)]);
  assert.deepEqual([record.proposal, record.blob, record.section], [proposalPath(E07), blobOf(WRITING_NEW), blobOf(WRITING)]);
  const history = find(await w.draw({ id: "history" }), (node) => node.localName === "tr" && node.getAttribute("data-id")).map((each) => each.textContent);
  assert.equal(history.length, 1);
  assert.match(history[0], /alice/);
  assert.match(history[0], /\d{4}-\d{2}-\d{2}/);

  const stale = await world({ entries: [E07] });
  const shown = await stale.draw({ id: entryId(E07) });
  await stale.land({ [proposalPath(E07)]: WRITING_NEW.replace("entirely.", "completely.") });
  click(buttonOf(shown, "Accept"));
  await stale.quiet();
  assert.deepEqual(stale.writes(), [], "a refused acceptance records nothing");
  assert.deepEqual(Object.keys(stale.files()).filter((path) => path.startsWith("docs/approvals/")), []);
});

// TST-371306 · level: release · module: system
// guards: AN APPROVAL NAMES THE EXACT TEXT; UC-006
// given: a product on GitHub with the open entry 07, edited once so that its proposal is not the text the queue first held; the reviewer's token is stored
// input: the reviewer presses Accept on the page that shows the edited proposal; and, apart, another writer changes the section the reviewer was shown and the reviewer presses Accept
// expect: the record names the file it approves (the proposal's path) and the git blob SHA of the text that was shown, computed here from the text; the record's file name carries the first twelve characters of that blob; it also names the SHA of the SPEC section that was shown; when the section changed after it was shown no record is written and the page names the entry
test("TST-371306: the approval record names the file and the blob SHA of the text the reviewer saw", async () => {
  const w = await world({ entries: [E07] });
  const edited = WRITING_NEW.replace("entirely.", "entirely, edited.");
  const editor = await w.draw({ id: entryId(E07), edit: "1" });
  typeInto(areaOf(editor), edited);
  whyOf(editor).value = "Edited before the decision.";
  click(buttonOf(editor, "Save"));
  await w.quiet();
  click(buttonOf(editor, "Accept"));
  await w.quiet();
  const [path, body] = recordOf(w.writes()[1].files);
  const record = fieldsOf(body);
  assert.equal(record.proposal, proposalPath(E07));
  assert.equal(record.blob, blobOf(edited));
  assert.notEqual(record.blob, blobOf(WRITING_NEW), "not the text the queue first held");
  assert.equal(path, `docs/approvals/spec-2026-03-01_sample-07-${blobOf(edited).slice(0, 12)}.md`);
  assert.equal(record.section, blobOf(WRITING));

  const moved = await world({ entries: [E07] });
  const shown = await moved.draw({ id: entryId(E07) });
  await moved.land({ "SPEC.md": HEAD + READING + WRITING_OTHER });
  click(buttonOf(shown, "Accept"));
  await moved.quiet();
  assert.deepEqual(moved.writes(), []);
  assert.deepEqual(Object.keys(moved.files()).filter((p) => p.startsWith("docs/approvals/")), []);
  assert.match(resultOf(shown), /entry 07 of 2026-03-01_sample: the SPEC section changed after it was shown/);
});

// TST-371307 · level: release · module: system
// guards: THE REPLACED TEXT STAYS REACHABLE; UC-006
// given: the instance's own SPEC with the entry 07 and the approval record a person committed on GitHub's page, in a temporary git repository; and a product on GitHub with the reviewer's token
// input: the instance workflow onApprovalsCommitted runs; and, apart, the reviewer presses Accept on the product's page
// expect: in the git repository the replaced section ("A writer writes a file whole.") is read with git show at the commit before the workflow's, which is the workflow commit's parent; no file of the new commit holds it (git grep finds none); on GitHub the commit's parent is the head it was written on and the branch is moved without force, and no file of the new tree holds the replaced section
test("TST-371307: the replaced section stays reachable through the git history and has no second copy in the tree", async () => {
  const files = { ...queueFiles({ entries: [E07] }), "docs/sources/SRC-fixture-po.md": REGISTER_ENTRY, [recordPath(E07)]: recordText(E07, WRITING) };
  await withGitInstance(files, async (fixture) => {
    const status = await runEntry("onApprovalsCommitted", workflowEnv(fixture), { now: NOW });
    assert.equal(status.outcome, "done");
    const after = git(fixture.origin, "rev-parse", "main");
    assert.equal(git(fixture.origin, "rev-parse", `${after}^`), fixture.head, "the commit's parent is the commit before");
    assert.match(git(fixture.origin, "show", `${fixture.head}:SPEC.md`), /A writer writes a file whole\./, "the replaced section is read at the earlier commit");
    assert.equal(gitStatus(fixture.origin, "grep", "-q", "A writer writes a file whole.", after).status, 1, "no file of the new commit holds the replaced section");
    assert.equal(gitStatus(fixture.origin, "grep", "-q", "A writer writes a file entirely.", after).status, 0, "known positive: git grep finds the new section");
  });
  const w = await world({ entries: [E07] });
  const page = await w.draw({ id: entryId(E07) });
  const head = w.head();
  click(buttonOf(page, "Accept"));
  await w.quiet();
  assert.deepEqual(commitsOf(w)[0].body.parents, [head]);
  assert.equal(REF(w).length, 1);
  assert.equal(REF(w)[0].body.force ?? false, false, "the branch is moved without force");
  assert.deepEqual(Object.entries(w.files()).filter(([, body]) => body.includes("A writer writes a file whole.")).map(([path]) => path), []);
});

// ---------------------------------------------------------------- the review is the person's

// The review of a proposal whose rule the SPEC leaves to the reviewer: the page shows the proposal whole, Accept and Reject are offered with no mark that blocks them, and Reject with a reason removes the entry.
async function reviewedByPerson(rule, reason) {
  const proposal = text("## 2. Writing", "", `**${WRITE_RULE}** *(Fixture PO)*`, rule, "*Check:* no automatic check; at review");
  const item = entry(7, "## 2. Writing", proposal);
  const w = await world({ entries: [item, E05] });
  const page = await w.draw({ id: entryId(item) });
  assert.match(sectionText(page, "proposal"), new RegExp(rule.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.ok(buttonOf(page, "Accept"), "no automatic check withholds Accept");
  assert.ok(buttonOf(page, "Reject"), "Reject is offered beside it");
  assert.deepEqual(w.writes(), [], "nothing is decided until the person decides");
  reasonOf(page).value = reason;
  click(buttonOf(page, "Reject"));
  await w.quiet();
  assert.equal(w.writes().length, 1);
  assert.match(w.writes()[0].message, new RegExp(`Reason: ${reason.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  assert.equal(w.files()["SPEC.md"], SPEC, "the SPEC is as it was");
  assert.deepEqual(w.writes()[0].deleted.sort(), [proposalPath(item), rationalePath(item)].sort());
}

// TST-371308 · level: release · module: system
// guards: A RULE IS CHECKABLE; UC-006
// given: a product on GitHub whose queue holds the entry 05 and the entry 07, which proposes the rule "A writer is pleased with a file." (nothing can show that it holds or not); the reviewer's token is stored
// input: the page of entry 07 is drawn; the reviewer types "The rule cannot be shown to hold." as the reason and presses Reject
// expect: the page shows the rule whole; Accept and Reject are both offered, since no automatic check decides (the SPEC says: at review); nothing is written until the click; the click makes one commit with the reason in its message that deletes the entry's proposal and rationale and removes its row from the queue's index, and SPEC.md is as it was
test("TST-371308: a rule that cannot be shown to hold is put before the reviewer, who may refuse it with a reason", async () => {
  await reviewedByPerson("A writer is pleased with a file.", "The rule cannot be shown to hold.");
});

// TST-371309 · level: release · module: system
// guards: NO STATE IN THE SPECIFICATION; UC-006
// given: a product on GitHub whose queue holds the entry 05 and the entry 07, which proposes the rule "The product holds three modules at present." (a current condition, not a target); the reviewer's token is stored
// input: the page of entry 07 is drawn; the reviewer types "The rule states the present state." as the reason and presses Reject
// expect: the page shows the rule whole; Accept and Reject are both offered, since no automatic check decides (the SPEC says: at review); nothing is written until the click; the click makes one commit with the reason in its message that deletes the entry's proposal and rationale, and SPEC.md is as it was
test("TST-371309: a rule that states the present condition is put before the reviewer, who may refuse it with a reason", async () => {
  await reviewedByPerson("The product holds three modules at present.", "The rule states the present state.");
});

// ---------------------------------------------------------------- a stale approval

// TST-371310 · level: release · module: system
// guards: A STALE APPROVAL IS NOT APPLIED; UC-006
// given: a product on GitHub with the open entry 07; and the instance's own SPEC with approval records in a temporary git repository: one that names the section the SPEC holds, one that names an earlier section, one that names an earlier proposal
// input: the reviewer presses Accept after another writer changed the proposal; after another writer changed the SPEC section; and the instance workflow onApprovalsCommitted runs on each record
// expect: the dashboard writes nothing in either case and names the entry; the workflow writes nothing for the record that names an earlier section or an earlier proposal, ends failed and names the refusal, and applies the record that names the texts the repository holds (known positive: SPEC.md then holds the proposal)
test("TST-371310: a proposal or a section that differs from the record's blobs is not applied, on the dashboard and in the workflow", async () => {
  for (const [what, land, said] of [["proposal", { [proposalPath(E07)]: WRITING_NEW.replace("entirely.", "completely.") }, /the proposal changed after it was shown/],
    ["section", { "SPEC.md": HEAD + READING + WRITING_OTHER }, /the SPEC section changed after it was shown/]]) {
    const w = await world({ entries: [E07] });
    const page = await w.draw({ id: entryId(E07) });
    await w.land(land);
    click(buttonOf(page, "Accept"));
    await w.quiet();
    assert.deepEqual(w.writes(), [], `${what}: nothing is written`);
    assert.match(resultOf(page), said);
    assert.match(resultOf(page), /entry 07/);
  }
  const base = { ...queueFiles({ entries: [E07] }), "docs/sources/SRC-fixture-po.md": REGISTER_ENTRY };
  const earlierProposal = { ...E07, proposal: WRITING_NEW.replace("entirely.", "otherwise.") };
  const cases = [
    ["a record that names an earlier section", { ...base, "SPEC.md": HEAD + READING + WRITING_OTHER, [recordPath(E07)]: recordText(E07, WRITING) }, "failed"],
    ["a record that names an earlier proposal", { ...base, [recordPath(E07)]: recordText(earlierProposal, WRITING) }, "failed"],
    ["a record that names the texts the repository holds", { ...base, [recordPath(E07)]: recordText(E07, WRITING) }, "done"],
  ];
  for (const [what, files, outcome] of cases) {
    await withGitInstance(files, async (fixture) => {
      const status = await runEntry("onApprovalsCommitted", workflowEnv(fixture), { now: NOW });
      assert.equal(status.outcome, outcome, what);
      const after = git(fixture.origin, "rev-parse", "main");
      if (outcome === "failed") {
        assert.match(status.summary, /refused|stale/i, what);
        assert.equal(after, fixture.head, `${what}: nothing is written`);
      } else {
        assert.equal(`${git(fixture.origin, "show", `${after}:SPEC.md`)}\n`, HEAD + READING + WRITING_NEW);
      }
    });
  }
});

// ---------------------------------------------------------------- the person's click

// TST-371311 · level: release · module: system
// guards: THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; UC-006
// given: a product on GitHub whose queue holds the entries 05 and 07; the reviewer's token is stored
// input: the list, the pages of 05 and 07, the editor of 07 with an edit and a Why, and Review all are drawn; a script presses Accept, Reject (with a reason typed), Save, Accept ticked (with 05 ticked) and Accept all shown; then the reviewer presses Accept on 07
// expect: no request that writes is sent until the reviewer's click; then exactly one commit is written, with the reviewer's token, and it holds entry 07
test("TST-371311: nothing is written while pages are drawn and edited or when a script presses a button; the reviewer's click writes once", async () => {
  const w = await world({ entries: [E05, E07] });
  const one = await w.draw({ id: entryId(E05) });
  const page = await w.draw({ id: entryId(E07) });
  const list = await w.draw({});
  const all = await w.draw({ id: "all" });
  const editor = await w.draw({ id: entryId(E07), edit: "1" });
  typeInto(areaOf(editor), WRITING_NEW.replace("entirely.", "entirely, scripted."));
  whyOf(editor).value = "A script wants this.";
  tick(boxOf(list, entryId(E05)));
  reasonOf(page).value = "A script rejects.";
  scriptedClick(buttonOf(page, "Accept"));
  scriptedClick(buttonOf(page, "Reject"));
  scriptedClick(buttonOf(editor, "Save"));
  scriptedClick(buttonOf(list, "Accept ticked (1)"));
  scriptedClick(buttonOf(all, "Accept all 2 shown"));
  scriptedClick(buttonOf(one, "Accept"));
  await w.quiet();
  assert.deepEqual(w.writers(), [], "no request that writes");
  assert.deepEqual(w.writes(), []);
  click(buttonOf(page, "Accept"));
  await w.quiet();
  assert.equal(w.writes().length, 1);
  assert.deepEqual(Object.keys(w.writes()[0].files).sort(), [recordPath(E07), `${QUEUE}/entscheidungen.md`, "SPEC.md"].sort());
  assert.ok(w.writers().every((request) => request.authorization === `Bearer ${TOKENS.product.value}`));
});

// TST-371312 · level: release · module: system
// guards: ONE CLICK PER DECISION; UC-006
// given: a product on GitHub whose queue holds the entries 05, 06 and 07; the reviewer's token is stored
// input: one click on Accept on the page of 07; one click on Save in the editor of 05 once its Why is typed; one click on Reject on the page of 06 once its reason is typed
// expect: each decision is one commit made by that one click and nothing else pressed: Accept writes record, SPEC and decision (the page says Accepted in commit); Save writes the edited proposal; Reject deletes the entry's proposal
test("TST-371312: each decision takes one click once its inputs are complete", async () => {
  const w = await world({ entries: [E05, E06, E07] });
  const seven = await w.draw({ id: entryId(E07) });
  click(buttonOf(seven, "Accept"));
  await w.quiet();
  assert.equal(w.writes().length, 1, "Accept: one click, one commit");
  assert.match(resultOf(seven), /^Accepted in commit/);

  const five = await w.draw({ id: entryId(E05), edit: "1" });
  const fiveEdit = READING_NEW.replace("or says why not.", "or says why not, plainly.") + ADDED;
  typeInto(areaOf(five), fiveEdit);
  whyOf(five).value = "Different wording.";
  click(buttonOf(five, "Save"));
  await w.quiet();
  assert.equal(w.writes().length, 2, "Save: one click, one commit");
  assert.equal(w.writes()[1].files[proposalPath(E05)], fiveEdit);

  const six = await w.draw({ id: entryId(E06) });
  reasonOf(six).value = "Not now.";
  click(buttonOf(six, "Reject"));
  await w.quiet();
  assert.equal(w.writes().length, 3, "Reject: one click, one commit");
  assert.ok(w.writes()[2].deleted.includes(proposalPath(E06)));
});

// TST-371313 · level: release · module: system
// guards: EDITS ARE PREPARED ON THE DASHBOARD; UC-006
// given: a product on GitHub with the open entry 07; the reviewer's token is stored
// input: open the editor of entry 07; type "A writer writes a file entirely, in view." into it; read the preview before pressing Save; give a Why and press Save
// expect: the editor holds the proposal as text and a preview that shows the typed sentence before any save; nothing is written before Save; Save commits the edited text, as the entry's proposal, with the reviewer's token
test("TST-371313: the editor with its live preview holds the proposal, and Save commits the edited text", async () => {
  const w = await world({ entries: [E07] });
  const editor = await w.draw({ id: entryId(E07), edit: "1" });
  assert.equal(areaOf(editor).value, WRITING_NEW);
  const preview = byClass(editor, "div", "preview")[0];
  assert.doesNotMatch(preview.textContent, /in view/);
  const edited = WRITING_NEW.replace("entirely.", "entirely, in view.");
  typeInto(areaOf(editor), edited);
  assert.match(preview.textContent, /A writer writes a file entirely, in view\./, "the preview follows the typing");
  assert.deepEqual(w.writes(), [], "nothing is written before Save");
  whyOf(editor).value = "In view.";
  click(buttonOf(editor, "Save"));
  await w.quiet();
  assert.equal(w.writes().length, 1);
  assert.equal(w.writes()[0].files[proposalPath(E07)], edited);
  assert.ok(w.writers().every((request) => request.authorization === `Bearer ${TOKENS.product.value}`));
});

// ---------------------------------------------------------------- acceptance as a person's commit

// TST-371314 · level: release · module: system
// guards: ACCEPTANCE IS A COMMIT BY THE ACCEPTING PERSON; UC-006
// given: a product on GitHub with the open entry 07, whose reviewer stores the product's token; the browser also stores the instance's token; the register of sources lives in the instance
// input: the reviewer presses Accept on entry 07
// expect: every request that writes goes to the product's repository on api.github.com, carries the authorisation of the reviewer's product token and no other, and carries no token in its address or body; the commit sets no author or committer; it adds an approval record under docs/approvals/; no request writes to the instance
test("TST-371314: the acceptance is a commit on the server that hosts the repository, made with the accepting person's own token", async () => {
  const w = await world({ entries: [E07] });
  const page = await w.draw({ id: entryId(E07) });
  click(buttonOf(page, "Accept"));
  await w.quiet();
  const writers = w.writers();
  assert.ok(writers.length >= 3, "the git-data requests of one commit");
  for (const request of writers) {
    assert.match(request.path, /^\/repos\/alice\/spec-product\//, "to the product's repository");
    assert.equal(request.authorization, `Bearer ${TOKENS.product.value}`);
    assert.equal(JSON.stringify(request.body ?? "").includes(TOKENS.product.value) || request.path.includes(TOKENS.product.value), false, "no token in the address or the body");
  }
  assert.equal(writers.some((request) => request.authorization.includes(TOKENS.instance.value)), false, "the instance's token writes nothing");
  assert.equal("author" in commitsOf(w)[0].body || "committer" in commitsOf(w)[0].body, false);
  assert.deepEqual(Object.keys(w.writes()[0].files).filter((path) => path.startsWith("docs/approvals/")), [recordPath(E07)]);
  assert.equal(w.outside.length, 0, "no request left GitHub");
});

// TST-371315 · level: release · module: system
// guards: AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; UC-006
// given: a product on GitHub with the open entry 07; and, apart, a product whose links file links no source of the requirement; the reviewer's token is stored
// input: the reviewer presses Accept on entry 07 in each
// expect: the first acceptance is one commit (one commit object, one move of the branch) that holds the approval record, SPEC.md with the approved proposal byte for byte and the queue's decision file, all three and nothing else; the second writes none of the three, since the requirement names no source the product links, and the page names the entry and the requirement
test("TST-371315: the approval record, the replaced SPEC section and the decision are one commit, and none is written alone", async () => {
  const w = await world({ entries: [E07] });
  const page = await w.draw({ id: entryId(E07) });
  click(buttonOf(page, "Accept"));
  await w.quiet();
  assert.equal(commitsOf(w).length, 1, "one commit object");
  assert.equal(REF(w).length, 1, "one move of the branch");
  assert.deepEqual(Object.keys(w.writes()[0].files).sort(), [recordPath(E07), `${QUEUE}/entscheidungen.md`, "SPEC.md"].sort());
  assert.equal(w.files()["SPEC.md"], HEAD + READING + WRITING_NEW);
  assert.match(w.files()[`${QUEUE}/entscheidungen.md`], new RegExp(`approval:${recordName(E07)}`));

  const unlinked = await world({ entries: [E07], files: { "docs/sources.md": LINKS.replace("SRC-fixture-po", "SRC-someone-else") } });
  const refused = await unlinked.draw({ id: entryId(E07) });
  click(buttonOf(refused, "Accept"));
  await unlinked.quiet();
  assert.deepEqual(unlinked.writes(), [], "no record, no SPEC section, no decision");
  assert.match(resultOf(refused), /entry 07/);
  assert.match(resultOf(refused), new RegExp(WRITE_RULE));
});

// ---------------------------------------------------------------- without a token: the workflow

// TST-371316 · level: release · module: system
// guards: WITHOUT A TOKEN, THE INSTANCE'S WORKFLOW WRITES THE CHANGE; UC-006
// given: the instance's own SPEC with the entries 05, 06 and 07 and the approval records a person committed on GitHub's page for 05 and 07, in a temporary git repository; the same repository once more with every record already named by a decision row
// input: the instance workflow onApprovalsCommitted runs on each
// expect: the first run applies the records of 05 and 07 in one commit that changes SPEC.md and the queue's decisions only, the approved sections byte for byte and the entry 06, which has no record, untouched; the approval records stand as the person committed them; the second run ends nothing to do and writes no commit
test("TST-371316: the instance's workflow writes the approved sections of the records committed without the dashboard, and only those", async () => {
  const files = { ...queueFiles({ entries: [E05, E06, E07] }), "docs/sources/SRC-fixture-po.md": REGISTER_ENTRY, [recordPath(E05)]: recordText(E05, READING), [recordPath(E07)]: recordText(E07, WRITING) };
  const applied = await withGitInstance(files, async (fixture) => {
    const status = await runEntry("onApprovalsCommitted", workflowEnv(fixture), { now: NOW });
    assert.equal(status.outcome, "done");
    const after = git(fixture.origin, "rev-parse", "main");
    assert.equal(git(fixture.origin, "rev-parse", `${after}^`), fixture.head, "one commit");
    assert.deepEqual(git(fixture.origin, "diff", "--name-only", fixture.head, after).split("\n").sort(), ["SPEC.md", `${QUEUE}/entscheidungen.md`].sort());
    assert.equal(`${git(fixture.origin, "show", `${after}:SPEC.md`)}\n`, HEAD + READING_NEW + ADDED + WRITING_NEW, "05's and 07's sections, not 06's");
    assert.equal(`${git(fixture.origin, "show", `${after}:${recordPath(E07)}`)}\n`, recordText(E07, WRITING));
    return { spec: `${git(fixture.origin, "show", `${after}:SPEC.md`)}\n`, decisions: `${git(fixture.origin, "show", `${after}:${QUEUE}/entscheidungen.md`)}\n` };
  });
  await withGitInstance({ ...files, "SPEC.md": applied.spec, [`${QUEUE}/entscheidungen.md`]: applied.decisions }, async (fixture) => {
    const status = await runEntry("onApprovalsCommitted", workflowEnv(fixture), { now: NOW });
    assert.equal(status.outcome, "nothing to do");
    assert.equal(git(fixture.origin, "rev-parse", "main"), fixture.head, "a decided record is not applied twice");
  });
});

// ---------------------------------------------------------------- queues and several entries

// TST-371317 · level: release · module: system
// guards: A QUEUE IS ACCEPTED IN ITS ORDER; UC-006
// given: a product on GitHub whose queue holds entry 05, which changes "## 1. Reading" and adds "## 1a. Added", and entry 06, which changes "## 1a. Added"; the reviewer's token is stored, and the pages of both entries were shown
// input: tick 06 and then 05 on the list and press Accept ticked once; apart, in a second product, tick 06 alone and press Accept ticked
// expect: one commit holds both sections, written in the order of the queue's index: SPEC.md holds 05's section and then 06's, and the decision rows name 05 before 06; with 06 alone nothing is written, the page says it goes with entry 05, and the page of 06 offers no Accept
test("TST-371317: entries of one queue are accepted together in the order of the queue's index, and an entry whose heading another creates is not offered alone", async () => {
  const w = await world({ entries: [E05, E06] });
  await w.draw({ id: entryId(E05) });
  await w.draw({ id: entryId(E06) });
  const list = await w.draw({});
  tick(boxOf(list, entryId(E06)));
  tick(boxOf(list, entryId(E05)));
  click(buttonOf(list, "Accept ticked (2)"));
  await w.quiet();
  assert.equal(w.writes().length, 1, "one commit");
  const [commit] = w.writes();
  assert.equal(commit.files["SPEC.md"], HEAD + READING_NEW + ADDED_NEW + WRITING);
  const decisions = commit.files[`${QUEUE}/entscheidungen.md`];
  assert.ok(decisions.indexOf(`approval:${recordName(E05)}`) >= 0 && decisions.indexOf(`approval:${recordName(E05)}`) < decisions.indexOf(`approval:${recordName(E06)}`), "05 is decided before 06");

  const alone = await world({ entries: [E05, E06] });
  const page = await alone.draw({ id: entryId(E06) });
  assert.equal(buttonOf(page, "Accept"), undefined, "no Accept for 06 alone");
  assert.match(byClass(page, "p", "waits")[0].textContent, /entry 05/);
  await alone.draw({ id: entryId(E05) });
  const second = await alone.draw({});
  tick(boxOf(second, entryId(E06)));
  click(buttonOf(second, "Accept ticked (1)"));
  await alone.quiet();
  assert.deepEqual(alone.writes(), []);
  assert.match(resultOf(second) + byClass(second, "p", "problem").map((p) => p.textContent).join(" "), /05/);
});

// TST-371318 · level: release · module: system
// guards: SEVERAL FILES ARE ACCEPTED IN ONE CLICK; UC-006
// given: a product on GitHub whose queue holds the open entries 05 and 07, and no page of either was shown; the reviewer's token is stored
// input: the list is drawn and 05 alone ticked, Accept ticked pressed; apart, the list is drawn and both ticked, Accept ticked pressed; apart, Review all is drawn for both entries and Accept all 2 shown is pressed; apart, Review all is drawn, another writer changes 07's proposal, and Accept all 2 shown is pressed
// expect: known positive — the list offers a tick for 05 and for 07, read or not; with 05 ticked the batch writes one record, 05's, naming 05's proposal blob, and none for 07, which was not ticked; with both ticked it writes one commit with one record for each, each naming its proposal's blob; Accept all writes one record for each of the two shown; counter-proof — after the change Accept all writes one commit with 05's record only and names 07 as left out because it changed after it was shown
test("TST-371318: several entries are accepted in one click, one record for each entry ticked or shown, none for one not ticked, and a changed entry is left out and named", async () => {
  const approvals = (commit) => Object.keys(commit.files).filter((path) => path.startsWith("docs/approvals/"));
  const w = await world({ entries: [E05, E07] });
  const list = await w.draw({});
  assert.equal(find(rowOf(list, entryId(E05)), (node) => node.localName === "input").length, 1, "a tick for 05, whose page was not shown");
  assert.equal(find(rowOf(list, entryId(E07)), (node) => node.localName === "input").length, 1, "a tick for 07, whose page was not shown");
  tick(boxOf(list, entryId(E05)));
  click(buttonOf(list, "Accept ticked (1)"));
  await w.quiet();
  assert.equal(w.writes().length, 1);
  assert.deepEqual(approvals(w.writes()[0]), [recordPath(E05)], "a record for 05 and none for 07, which was not ticked");
  assert.match(w.writes()[0].files[recordPath(E05)], new RegExp(`^blob: ${blobOf(E05.proposal)}$`, "m"), "05's record names the text the list read");

  const ticked = await world({ entries: [E05, E07] });
  const twice = await ticked.draw({});
  tick(boxOf(twice, entryId(E05)));
  tick(boxOf(twice, entryId(E07)));
  click(buttonOf(twice, "Accept ticked (2)"));
  await ticked.quiet();
  assert.equal(ticked.writes().length, 1, "one commit");
  assert.deepEqual(approvals(ticked.writes()[0]).sort(), [recordPath(E05), recordPath(E07)].sort());
  assert.match(ticked.writes()[0].files[recordPath(E07)], new RegExp(`^blob: ${blobOf(E07.proposal)}$`, "m"), "07's record names the text the list read");

  const both = await world({ entries: [E05, E07] });
  const all = await both.draw({ id: "all" });
  click(buttonOf(all, "Accept all 2 shown"));
  await both.quiet();
  assert.equal(both.writes().length, 1);
  assert.deepEqual(approvals(both.writes()[0]).sort(), [recordPath(E05), recordPath(E07)].sort());

  const changed = await world({ entries: [E05, E07] });
  const review = await changed.draw({ id: "all" });
  await changed.land({ [proposalPath(E07)]: WRITING_NEW.replace("entirely.", "completely.") });
  click(buttonOf(review, "Accept all 2 shown"));
  await changed.quiet();
  assert.equal(changed.writes().length, 1);
  assert.deepEqual(approvals(changed.writes()[0]), [recordPath(E05)]);
  assert.match(resultOf(review), /spec-2026-03-01_sample-07 was left out: it changed after it was shown\./);
});

// ---------------------------------------------------------------- rejecting

// TST-371319 · level: release · module: system
// guards: A PROPOSAL IS REJECTED WITH A REASON; UC-006
// given: a product on GitHub whose queue holds the open entry 07, the entry 06, which waits for the heading entry 05 creates, and the entry 05, which is accepted; the reviewer's token is stored
// input: the pages of 05 (before its acceptance), 06 and 07 and of an entry already in SPEC are drawn; Reject is pressed on 07 with no reason, with blanks as the reason, and with a reason
// expect: Reject stands beside Accept on the page of an open entry and beside an entry that waits for its anchor, and on none that is in SPEC; a click without a reason, or with blanks, writes nothing, says so and marks the field invalid; with a reason it writes one commit that holds the reason
test("TST-371319: Reject is offered beside every undecided entry and writes only once a reason is typed", async () => {
  const w = await world({ entries: [E05, E06, E07] });
  const six = await w.draw({ id: entryId(E06) });
  assert.ok(buttonOf(six, "Reject"), "Reject for an entry that waits for its anchor");
  const five = await w.draw({ id: entryId(E05) });
  click(buttonOf(five, "Accept"));
  await w.quiet();
  const decided = await w.draw({ id: entryId(E05) });
  assert.equal(buttonOf(decided, "Reject"), undefined, "no Reject for an entry in SPEC");
  assert.equal(buttonOf(decided, "Accept"), undefined);
  const before = w.writes().length;
  const page = await w.draw({ id: entryId(E07) });
  assert.ok(buttonOf(page, "Accept") && buttonOf(page, "Reject"), "Reject stands beside Accept");
  click(buttonOf(page, "Reject"));
  reasonOf(page).value = "   ";
  click(buttonOf(page, "Reject"));
  await w.quiet();
  assert.equal(w.writes().length, before, "no reason, no write");
  assert.match(byClass(page, "div", "reject-result")[0].textContent, /Type the reason for rejecting first: nothing was written\./);
  assert.equal(reasonOf(page).getAttribute("aria-invalid"), "true");
  reasonOf(page).value = "Reason given.";
  click(buttonOf(page, "Reject"));
  await w.quiet();
  assert.equal(w.writes().length, before + 1);
  assert.match(w.writes().at(-1).message, /Reason: Reason given\./);
});

// TST-371320 · level: release · module: system
// guards: A REJECTION REMOVES THE PROPOSAL; UC-006
// given: a product on GitHub whose queue holds the open entries 05, 06 and 07; the reviewer's token is stored
// input: Reject is pressed on 05 with the reason "Not now." after its page was shown; then a second world: another writer changes the proposal of 07 after it was shown and Reject is pressed on it
// expect: one commit with the reason in its message deletes the proposal and the rationale of 05 and rewrites the queue's index without the row 05 and with every other byte as it was; no approval record and no decision row is written and SPEC.md is untouched; 06, whose heading 05 created, is then refused with the reason that its heading is in no entry of the queue; an entry that changed after it was shown is not removed
test("TST-371320: a rejection takes the entry out of its queue in one commit with the reason in its message", async () => {
  const w = await world({ entries: [E05, E06, E07] });
  const before = w.files();
  const page = await w.draw({ id: entryId(E05) });
  reasonOf(page).value = "Not now.";
  click(buttonOf(page, "Reject"));
  await w.quiet();
  assert.equal(w.writes().length, 1);
  const [commit] = w.writes();
  assert.match(commit.message, /Reason: Not now\./);
  assert.deepEqual(commit.deleted.sort(), [proposalPath(E05), rationalePath(E05)].sort());
  assert.deepEqual(Object.keys(commit.files), [`${QUEUE}/index.md`]);
  assert.equal(commit.files[`${QUEUE}/index.md`], before[`${QUEUE}/index.md`].split("\n").filter((line) => !line.startsWith("| 05 |")).join("\n"), "every other byte of the index is as it was");
  const after = w.files();
  assert.equal(after["SPEC.md"], SPEC);
  assert.equal(after[`${QUEUE}/entscheidungen.md`], DECISIONS);
  assert.deepEqual(Object.keys(after).filter((path) => path.startsWith("docs/approvals/")), []);
  const six = await w.draw({ id: entryId(E06) });
  click(buttonOf(six, "Accept"));
  await w.quiet();
  assert.equal(w.writes().length, 1, "06, whose heading 05 created, cannot be accepted once 05 has left");
  assert.match(resultOf(six), /its heading “## 1a\. Added” is not in SPEC\.md, and no entry of the queue creates it/);

  const moved = await world({ entries: [E05, E07] });
  const shown = await moved.draw({ id: entryId(E07) });
  await moved.land({ [proposalPath(E07)]: WRITING_NEW.replace("entirely.", "completely.") });
  reasonOf(shown).value = "Too late.";
  click(buttonOf(shown, "Reject"));
  await moved.quiet();
  assert.deepEqual(moved.writes(), []);
  assert.ok(proposalPath(E07) in moved.files(), "the changed entry is still in its queue");
});
