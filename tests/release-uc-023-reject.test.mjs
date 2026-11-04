// Release tests of UC-023 Modify the architecture, on rejecting a change (alternative flow 5b): the dashboard offers Reject beside Accept for a decision and for a module file and writes the
// rejection only once a reason is typed (A PROPOSAL IS REJECTED WITH A REASON), and a rejection is one commit under the rejecting person's account, with the reason in its message, that returns a
// changed file to the text its most recent approval record names and takes a file that was never accepted out of the working tree (A REJECTION REMOVES THE PROPOSAL).
// Run: node --test tests/release-uc-023-reject.test.mjs
//
// Module: MOD-review-pages
// Module: MOD-approvals
// Guards: UC-023
// Level: release
//
// Written for the release testing of sprint 126 by developer-sonnet-l (ITM-739), who implemented none of ITM-724, ITM-728, ITM-729, ITM-730 or ITM-731 (RELEASE TESTS ARE NOT WRITTEN BY THE
// IMPLEMENTER). The world is the harness of tests/uc-023-harness.mjs: the real page over the real review pages, GitHub served in memory; a deletion is done on its files as GitHub's does it.
// Readings the texts leave open, which the cases state:
//   - "types a reason" is the text of <textarea class="reject-reason"> of the page's Reject section; a reason of blanks only is no reason.
//   - A file "put back after its accepted removal" is not asserted here: the texts leave that case to an item of its own.

import test from "node:test";
import assert from "node:assert/strict";
import { buttonsNamed } from "./review-pages-draft-world.mjs";
import { ACCEPTED, SYNC, SYNC_PATH, all, decision, goTo, lines, module_, namedButton, onFile, one, pageText, press, rest, scenario } from "./uc-023-harness.mjs";

const SYNC_CHANGED = SYNC.replace("It synchronises the loans.", "It synchronises the loans, one way.");
const EXTRA_PATH = "docs/architecture/MOD-extra.md", ARC3_PATH = "docs/architecture/ARC-003-retry.md";
const EXTRA = module_("MOD-extra", "Extra", "src/extra/", { follows: "ARC-001" });
const reasonField = (s) => one(s.target, "textarea", "reject-reason");
const reject = async (s, reason) => {
  reasonField(s).value = reason;
  await press(s, namedButton(s.target, "Reject"));
};
const approvalWrites = (s) => s.product.writes.filter((write) => Object.keys(write.files).some((path) => path.startsWith("docs/approvals/")));

// TST-739121 · level: release · module: MOD-review-pages
// guards: A PROPOSAL IS REJECTED WITH A REASON; UC-023
// given: ARC-002 and MOD-sync changed since their acceptance, MOD-desk accepted, a token
// input: the reviewer opens each file; presses Reject with the field empty, then with blanks only, then with a reason
// expect: the changed decision and the changed module file each offer Reject beside Accept, with a field for the reason, and the accepted file offers no Reject; Reject with no reason and with blanks writes nothing and says so; with a reason it makes one commit
test("TST-739121: UC-023 5b Reject is offered beside Accept and writes only once a reason is typed", async () => {
  const s = await scenario({ now: { [SYNC_PATH]: SYNC_CHANGED, "docs/architecture/ARC-002-shelving.md": ACCEPTED["docs/architecture/ARC-002-shelving.md"].replace("A shelf module keeps the books.", "A shelf module keeps books.") } });
  await onFile(s, "decision", "ARC-002");
  assert.equal(buttonsNamed(s.target, "Accept").length, 1);
  assert.equal(buttonsNamed(s.target, "Reject").length, 1, "the decision offers Reject");
  await onFile(s, "module", "MOD-desk");
  assert.equal(buttonsNamed(s.target, "Reject").length, 0, "the accepted file offers none");
  await onFile(s, "module", "MOD-sync");
  assert.equal(buttonsNamed(s.target, "Accept").length, 1);
  assert.equal(buttonsNamed(s.target, "Reject").length, 1, "the module file offers Reject");
  await reject(s, "");
  assert.equal(s.product.writes.length, 0, "no reason, nothing written");
  assert.match(pageText(s), /Type the reason for rejecting first: nothing was written\./);
  await reject(s, "   ");
  assert.equal(s.product.writes.length, 0, "blanks are no reason");
  await reject(s, "the interface is still needed");
  assert.equal(s.product.writes.length, 1, "a reason makes one commit");
});

// TST-739122 · level: release · module: MOD-approvals
// guards: A REJECTION REMOVES THE PROPOSAL; UC-023
// given: MOD-sync changed since its acceptance; MOD-extra never accepted; a token named "github.com/reviewer"
// input: the reviewer rejects MOD-sync with the reason "the interface is still needed"; then rejects MOD-extra with the reason "not wanted"
// expect: MOD-sync's rejection is one commit holding MOD-sync's file alone, with the text its approval record names and no record; its message names MOD-sync, the person ("Rejected by github.com/reviewer.") and the reason; MOD-sync is then accepted; MOD-extra's rejection is one commit that deletes MOD-extra's file and writes nothing else, with its reason in the message, and the list of module files no longer holds MOD-extra; every write carries the reviewer's token
test("TST-739122: UC-023 5b a rejection restores the accepted text, or takes a never-accepted file away, in one commit with the reason", async () => {
  const s = await scenario({ now: { [SYNC_PATH]: SYNC_CHANGED }, extra: { [EXTRA_PATH]: EXTRA } });
  await onFile(s, "module", "MOD-sync");
  await reject(s, "the interface is still needed");
  assert.equal(s.product.writes.length, 1, "one commit");
  assert.deepEqual(s.product.writes[0].files, { [SYNC_PATH]: ACCEPTED[SYNC_PATH] }, "the text the record names, and no record");
  assert.deepEqual(lines(s.product.writes[0].message).slice(0, 5), ["reject MOD-sync (Agent M dashboard)", "", "Rejected by github.com/reviewer.", "", "Reason: the interface is still needed"]);
  assert.equal(s.product.files[SYNC_PATH], ACCEPTED[SYNC_PATH]);
  await goTo(s, `#module/product=${encodeURIComponent(s.address)}`);
  assert.match(all(s.target, "tr").find((row) => row.getAttribute("data-id") === "MOD-sync").textContent, /accepted/);

  await onFile(s, "module", "MOD-extra");
  await reject(s, "not wanted");
  assert.equal(s.product.writes.length, 2, "one commit more");
  assert.deepEqual(s.product.writes[1].deleted, [EXTRA_PATH], "the file is deleted");
  assert.deepEqual(s.product.writes[1].files, {}, "and nothing else is written");
  assert.match(s.product.writes[1].message, /Reason: not wanted/);
  assert.equal(EXTRA_PATH in s.product.files, false);
  assert.equal(approvalWrites(s).length, 0, "a rejection writes no record");
  const writes = s.authorized.filter((request) => request.method !== "GET");
  assert.ok(writes.length > 0 && writes.every((request) => /github_pat_FIXTURE_PRODUCT_0123456789$/.test(request.authorization ?? "")), "the reviewer's own token");
});

// TST-739123 · level: release · module: MOD-approvals
// guards: A REJECTION REMOVES THE PROPOSAL; A PROPOSAL IS REJECTED WITH A REASON; UC-023
// given: ARC-003, a decision never accepted, and MOD-sync changed since its acceptance, each shown to the reviewer; before the click, another writer changes the file on the default branch
// input: the reviewer presses Reject with a reason
// expect: nothing is written; the page says the file changed after it was shown and is drawn again with the text as it stands now
test("TST-739123: UC-023 5b a file that changed after it was shown is not rejected", async () => {
  const s = await scenario({ now: { [SYNC_PATH]: SYNC_CHANGED }, extra: { [ARC3_PATH]: decision("ARC-003", "Loans are retried", ["A LOAN HAS A DUE DATE"], ["MOD-extra"], "Loans are retried.") } });
  for (const [route, id, path, newer] of [["module", "MOD-sync", SYNC_PATH, SYNC_CHANGED.replace("one way.", "both ways.")], ["decision", "ARC-003", ARC3_PATH, decision("ARC-003", "Loans are retried", ["A LOAN HAS A DUE DATE"], ["MOD-extra"], "Loans are retried twice.")]]) {
    await onFile(s, route, id);
    reasonField(s).value = "not wanted";
    await s.product.change(path, newer);
    await press(s, namedButton(s.target, "Reject"));
    assert.equal(s.product.writes.length, 0, `${id}: nothing is written`);
    assert.match(pageText(s), new RegExp(`${id} changed after it was shown, so nothing was written`));
  }
});
