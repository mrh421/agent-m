// Release tests of ITM-1317 — "A CHANGE IS PROPOSED UNDER THE EXISTING NAME" (SPEC.md: "A candidate that changes an existing requirement is proposed as a change to that requirement, under its name") and
// "EXACT DUPLICATES ARE FOUND WITHOUT A MODEL", with docs/architecture/MOD-documents.md (classifyCandidates: "a candidate whose normalised key equals that of an existing artifact other than the one its
// participant proposed it as a change of is a duplicate of it, whatever class its participant proposed, decided by rule ... since a change stands under the name of what it changes") and UC-023 2:
// "The participant returns changes under the existing identifiers". A module's key is its identifier and a decision's its title (THE DERIVATION RULES HOLD FOR ARCHITECTURE).
// Run: node --test tests/release-itm-1317-change-under-own-name.test.mjs
//
// Module: MOD-documents
// Module: MOD-job-runner
// Guards: UC-023; A CHANGE IS PROPOSED UNDER THE EXISTING NAME; EXACT DUPLICATES ARE FOUND WITHOUT A MODEL; THE DERIVATION RULES HOLD FOR ARCHITECTURE
// Level: release
//
// Written for the release testing of sprint 127 by developer-sonnet-l, who implemented none of ITM-1317 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The unit cases of the item
// (tests/documents-change-under-own-key.test.mjs) give classifyCandidates candidates and compare classes; these cases run the architecture change of UC-023 on the real page (the harness of
// tests/uc-023-harness.mjs: MOD-site-frame's real page, the real bar, MOD-job-runner's correction loop, GitHub and the participants served in memory) and read what the author is left with, and then give
// the module's interface requirements and the SPEC's own words for the classes. No real input event is made. Readings the texts leave open, which the cases state:
//   - "proposed as a change of" an artifact is read as: class `change` with `of` naming it; a candidate proposed new, as a duplicate or as a conflict is not exempt.
//   - "no finding is left" is read as the page's list of findings left after the correction loop (`li.left`) being empty for the draft.

import test from "node:test";
import assert from "node:assert/strict";
import { classifyCandidates } from "../src/documents/index.mjs";
import { ARC1, ARC1_PATH, DESK, SYNC, SYNC_PATH, all, onFile, pageText, review, scenario, send } from "./uc-023-harness.mjs";

// MOD-sync with its sentence changed, its identifier kept; ARC-001 with its sentence changed, its title kept.
const SYNC_SAME_ID = SYNC.replace("It synchronises the loans.", "It synchronises the loans, one way.");
const ARC1_SAME_TITLE = ARC1.replace("one synchronisation module.", "one synchronisation module, which retries.");
const ARC1_NEW_TITLE = ARC1_SAME_TITLE.replace("# ARC-001 Lending is synchronised", "# ARC-001 Lending is synchronised and retried").replace("title: Lending is synchronised", "title: Lending is synchronised and retried");
const leftOf = (s) => all(s.target, "li", "left").map((node) => node.textContent);
async function drafted(files, instruction = "Let the sync retry") {
  const s = await scenario({ answers: [{ files }] });
  await onFile(s, "decision", "ARC-001");
  await send(s, instruction, { participant: "drafter" });
  await review(s);
  return s;
}

// TST-1317101 · level: release · module: MOD-job-runner
// guards: UC-023; A CHANGE IS PROPOSED UNDER THE EXISTING NAME; THE DERIVATION RULES HOLD FOR ARCHITECTURE
// given: the library product with ARC-001 "Lending is synchronised" and MOD-sync accepted; the drafter answers a change of ARC-001 that keeps its title and a change of MOD-sync that keeps its identifier, each classed change of what it changes; known positive first — the same decision change under a new title
// input: the author describes the change in the bar, presses Send and then Review the draft
// expect: known positive — the draft with a new title shows no finding left; the draft of both files under their own names shows no finding left either and both files as drafts on the page, as UC-023 2 says the participant returns changes under the existing identifiers
test("TST-1317101: UC-023 2 a decision that keeps its title and a module that keeps its identifier, classed changes, are not refused as duplicates of themselves", async () => {
  const known = await drafted([{ path: ARC1_PATH, text: ARC1_NEW_TITLE, class: "change", of: "ARC-001" }]);
  assert.deepEqual(leftOf(known), [], "known positive: a changed title passes");

  const s = await drafted([{ path: ARC1_PATH, text: ARC1_SAME_TITLE, class: "change", of: "ARC-001" }, { path: SYNC_PATH, text: SYNC_SAME_ID, class: "change", of: "MOD-sync" }]);
  assert.deepEqual(leftOf(s), [], `no finding is left: ${pageText(s).slice(0, 500)}`);
  assert.equal(all(s.target, "div", "draft").length, 2, "both files are drafts on the page");
});

// TST-1317102 · level: release · module: MOD-job-runner
// guards: UC-023; EXACT DUPLICATES ARE FOUND WITHOUT A MODEL; THE DERIVATION RULES HOLD FOR ARCHITECTURE
// given: the product of TST-1317101; the drafter answers the same two files, but classed new instead of change (the counter-proof), and, in a second page, a file that carries the identifier of the existing module MOD-desk, classed a change of MOD-sync
// input: the author describes the change, presses Send and then Review the draft
// expect: counter-proof — proposed new, the decision that keeps its title is left with an error that it duplicates ARC-001 and the module that keeps its identifier with one that it duplicates MOD-sync, decided by rule, so the draft is not shown clean; a file with MOD-desk's identifier, though proposed as a change of MOD-sync, is left with an error that it duplicates MOD-desk: the exemption is for the artifact it changes only
test("TST-1317102: UC-023 2 the same files proposed new, or a file under another module's identifier, are still duplicates of what already exists", async () => {
  const asNew = await drafted([{ path: ARC1_PATH, text: ARC1_SAME_TITLE, class: "new", of: null }, { path: SYNC_PATH, text: SYNC_SAME_ID, class: "new", of: null }]);
  const found = leftOf(asNew).join(" | ");
  assert.ok(leftOf(asNew).length >= 1, `counter-proof: the draft is not clean: ${pageText(asNew).slice(0, 400)}`);
  assert.match(found, /duplicate of ARC-001/, found);
  assert.match(found, /duplicate of MOD-sync/, found);

  const other = await drafted([{ path: SYNC_PATH, text: DESK, class: "change", of: "MOD-sync" }]);
  assert.match(leftOf(other).join(" | "), /duplicate of MOD-desk/, `another module's identifier is a duplicate of that module: ${leftOf(other).join(" | ")}`);
});

// TST-1317103 · level: release · module: MOD-documents
// guards: A CHANGE IS PROPOSED UNDER THE EXISTING NAME; EXACT DUPLICATES ARE FOUND WITHOUT A MODEL
// given: the existing requirements A LOAN HAS A DUE DATE and A MEMBER CAN RENEW ONCE, each keyed by its name and its rule text, the rule deciding, as the caller gives them; a candidate under the name of the first with the rule changed, proposed a change of it; one with the second's rule under another name, proposed new; the same proposed a change of the first; and one with the first's rule under another name, proposed new
// input: classifyCandidates of each, one run each, against the two requirements
// expect: the change under the name of what it changes is a change of A LOAN HAS A DUE DATE, decided by the participant; a candidate whose rule equals the second's is a duplicate of A MEMBER CAN RENEW ONCE by rule, proposed new and also proposed a change of the first, so that a change exempts only the artifact it changes; a restatement of the first's rule under another name, proposed new, proposed a duplicate of the first or a conflict with it, is a duplicate of A LOAN HAS A DUE DATE decided by rule (counter-proofs: only a change is exempt)
test("TST-1317103: classifyCandidates a change under the name of what it changes keeps its class, and a candidate with an existing rule is a duplicate of it by rule", () => {
  const existing = [{ id: "A LOAN HAS A DUE DATE", keys: ["a loan has a due date", "every loan states its due date."] }, { id: "A MEMBER CAN RENEW ONCE", keys: ["a member can renew once", "a member renews a loan once."] }];
  const one = (candidate) => classifyCandidates([candidate], existing).map(({ class: cls, of, decidedBy }) => [cls, of, decidedBy]);
  const proposed = (cls, of) => ({ class: cls, of });
  assert.deepEqual(one({ ref: "c1", keys: ["A LOAN HAS A DUE DATE", "Every loan states its due date, visibly."], from: ["p1"], proposed: proposed("change", "A LOAN HAS A DUE DATE") }),
    [["change", "A LOAN HAS A DUE DATE", "participant"]], "known positive: a change under the name of what it changes");
  const second = ["A MEMBER RENEWS", "A member RENEWS a loan once."];
  assert.deepEqual(one({ ref: "c2", keys: second, from: ["p2"], proposed: proposed("new", null) }), [["duplicate", "A MEMBER CAN RENEW ONCE", "rule"]]);
  assert.deepEqual(one({ ref: "c3", keys: second, from: ["p3"], proposed: proposed("change", "A LOAN HAS A DUE DATE") }), [["duplicate", "A MEMBER CAN RENEW ONCE", "rule"]],
    "proposed a change of the first, it is exempt from the first only");
  assert.deepEqual(one({ ref: "c4", keys: ["A DUE DATE IS STATED", "Every loan states its due date."], from: ["p4"], proposed: proposed("new", null) }), [["duplicate", "A LOAN HAS A DUE DATE", "rule"]],
    "counter-proof: a restatement of the first's rule, proposed new, is not exempt");
  for (const cls of ["duplicate", "conflict"]) {
    assert.deepEqual(one({ ref: "c5", keys: ["A DUE DATE IS STATED", "Every loan states its due date."], from: ["p5"], proposed: proposed(cls, "A LOAN HAS A DUE DATE") }), [["duplicate", "A LOAN HAS A DUE DATE", "rule"]],
      `counter-proof: proposed ${cls} of the first, it is decided by rule: only a change is exempt`);
  }
});
