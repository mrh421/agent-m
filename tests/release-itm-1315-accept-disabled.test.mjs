// Release tests of ITM-1315 — UC-023 4b: "The changed file names a requirement or use case that is not accepted. *Accept* stays disabled and names it." (docs/use-cases/UC-023-modify-the-architecture.md,
// alternative flow 4b) and docs/architecture/MOD-review-pages.md (the page of one file lists *Accept*): a file that rests on what no approval record names shows the section "Rests on what is not accepted"
// with the names and, beside it, *Accept* disabled, whose click writes nothing; once every name is accepted *Accept* is offered as it was and its click writes the record.
// Run: node --test tests/release-itm-1315-accept-disabled.test.mjs
//
// Module: MOD-review-pages
// Module: MOD-approvals
// Guards: UC-023; ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS; ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// Level: release
//
// Written for the release testing of sprint 127 by developer-sonnet-l, who implemented none of ITM-1315 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The world is the harness of
// tests/uc-023-harness.mjs: MOD-site-frame's real page over the real review pages, GitHub served in memory. No real input event is made: a person's click is an Event whose isTrusted is true, a script's
// click an Event marked scripted, both dispatched on the page's own button. Each case ends at what the page shows and at the commits the fake host received. Readings the texts leave open, which the cases state:
//   - "*Accept* stays disabled and names it" is read as a button *Accept* with the attribute disabled, drawn after the section that names what the file rests on.
//   - "its click writes nothing" is read of a click on the disabled button as a browser's script or a person could still dispatch it: no commit, and the page shows what it showed.

import test from "node:test";
import assert from "node:assert/strict";
import { buttonsNamed } from "./review-pages-draft-world.mjs";
import { scripted } from "./review-pages-harness.mjs";
import { blobSha } from "../src/text-tools/index.mjs";
import { ARC2, ARC2_PATH, SHELF_MOD, SHELF_PATH, SYNC, SYNC_PATH, UC3, UC3_PATH, all, goTo, namedButton, onFile, one, pageText, press, record, rest, scenario, trustedClick } from "./uc-023-harness.mjs";

// MOD-shelf realises UC-003, whose text no approval record names; MOD-sync changed names nothing open; ARC-002 forced by UC-003.
const SHELF_ON_OPEN = SHELF_MOD.replace("  - A BOOK IS SHELVED\n", "  - A BOOK IS SHELVED\n  - UC-003\n");
const SYNC_CHANGED = SYNC.replace("It synchronises the loans.", "It synchronises the loans, one way.");
const ARC2_ON_OPEN = ARC2.replace("  - UC-002\n", "  - UC-003\n");
const accepts = (s) => buttonsNamed(s.target, "Accept");
const enabled = (s) => accepts(s).filter((button) => !button.disabled);
const namesOf = (s) => all(one(s.target, "section", "rests-on"), "li", "open-name").map((node) => node.textContent);
// Whether `later` stands after `earlier` in the page's document order.
const after = (root, earlier, later) => {
  const order = [];
  (function visit(node) { order.push(node); for (const child of node.childNodes ?? []) visit(child); })(root);
  return order.indexOf(later) > order.indexOf(earlier);
};

// TST-1315101 · level: release · module: MOD-review-pages
// guards: UC-023; ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS; ONE CLICK PER DECISION
// given: MOD-shelf changed to realise UC-003, whose text no approval record names, and a token; known positive first — MOD-sync changed, which names nothing open
// input: the reviewer opens MOD-sync, then MOD-shelf
// expect: known positive — MOD-sync's page has no section of what it rests on and one Accept, enabled; MOD-shelf's page has the section naming exactly UC-003 and, after it in the page, exactly one button Accept, which is disabled; it is the only Accept
test("TST-1315101: UC-023 4b a module that rests on a use case not accepted shows the section naming it and Accept disabled beside it", async () => {
  const known = await scenario({ now: { [SYNC_PATH]: SYNC_CHANGED } });
  await onFile(known, "module", "MOD-sync");
  assert.equal(all(known.target, "section", "rests-on").length, 0, "known positive: nothing open");
  assert.equal(accepts(known).length, 1);
  assert.equal(enabled(known).length, 1, "known positive: its Accept is enabled");

  const s = await scenario({ now: { [SHELF_PATH]: SHELF_ON_OPEN } });
  await onFile(s, "module", "MOD-shelf");
  assert.deepEqual(namesOf(s), ["UC-003"], "the page names what it rests on");
  assert.equal(accepts(s).length, 1, "exactly one Accept is on the page");
  assert.equal(accepts(s)[0].disabled, true, "and it is disabled");
  assert.ok(after(s.target, one(s.target, "section", "rests-on"), accepts(s)[0]), "it stands after the section that names what is open");
});

// TST-1315102 · level: release · module: MOD-review-pages
// guards: UC-023; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the page of MOD-shelf, which rests on UC-003, not accepted, and its Accept disabled
// input: a script's click and a person's click on that Accept; then the reviewer's click on the Accept of MOD-sync, which names nothing open (counter-proof)
// expect: neither click writes a commit; the page still names UC-003 and still holds one disabled Accept; counter-proof — the person's click on MOD-sync's Accept makes one commit, so the fixture does write when a click is allowed
test("TST-1315102: UC-023 4b a click on the disabled Accept writes nothing", async () => {
  const s = await scenario({ now: { [SHELF_PATH]: SHELF_ON_OPEN } });
  await onFile(s, "module", "MOD-shelf");
  const accept = accepts(s)[0];
  assert.ok(accept && accept.disabled, "known positive: the disabled Accept is there");
  accept.dispatchEvent(scripted());
  await rest(s);
  accept.dispatchEvent(trustedClick());
  await rest(s);
  assert.equal(s.product.writes.length, 0, "no click wrote");
  assert.deepEqual(namesOf(s), ["UC-003"], "the page still names what is open");
  assert.equal(accepts(s).length, 1);
  assert.equal(enabled(s).length, 0, "and still holds no Accept that can be pressed");

  const counter = await scenario({ now: { [SYNC_PATH]: SYNC_CHANGED } });
  await onFile(counter, "module", "MOD-sync");
  await press(counter, namedButton(counter.target, "Accept"));
  assert.equal(counter.product.writes.length, 1, "counter-proof: a person's click on an Accept that is enabled writes one commit");
});

// TST-1315103 · level: release · module: MOD-approvals
// guards: UC-023; ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS; STATUS IS DERIVED FROM THE RECORDS
// given: MOD-shelf changed to realise UC-003; then the same with a record that names UC-003's text
// input: the reviewer opens MOD-shelf in each, and in the second presses Accept
// expect: without the record Accept is disabled; with it the page has no section of what it rests on and one Accept, enabled, whose click makes one commit that adds one approval record docs/approvals/MOD-shelf-<12 hex of its blob>.md naming docs/architecture/MOD-shelf.md and its blob
test("TST-1315103: UC-023 4b once what it rests on is accepted, Accept is offered and its click writes the record", async () => {
  const closed = await scenario({ now: { [SHELF_PATH]: SHELF_ON_OPEN } });
  await onFile(closed, "module", "MOD-shelf");
  assert.equal(enabled(closed).length, 0, "known positive: without a record Accept cannot be pressed");

  const [recordPath, recordText] = await record("UC-003", "use-case", UC3_PATH, UC3);
  const s = await scenario({ now: { [SHELF_PATH]: SHELF_ON_OPEN }, extra: { [recordPath]: recordText } });
  await onFile(s, "module", "MOD-shelf");
  assert.equal(all(s.target, "section", "rests-on").length, 0, "nothing it rests on is open");
  assert.equal(accepts(s).length, 1);
  assert.equal(enabled(s).length, 1, "and Accept is enabled");
  await press(s, namedButton(s.target, "Accept"));
  assert.equal(s.product.writes.length, 1, "one commit");
  const blob = await blobSha(SHELF_ON_OPEN);
  const recordsWritten = Object.keys(s.product.writes[0].files);
  assert.deepEqual(recordsWritten, [`docs/approvals/MOD-shelf-${blob.slice(0, 12)}.md`]);
  const text = s.product.writes[0].files[recordsWritten[0]];
  assert.ok(text.includes(`file: ${SHELF_PATH}`) && text.includes(`blob: ${blob}`), text);
});

// TST-1315104 · level: release · module: MOD-review-pages
// guards: UC-023; ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS
// given: ARC-002 changed so that it is forced by UC-003, whose text no approval record names
// input: the reviewer opens ARC-002, and on the review page of the whole architecture presses "Accept all 1 shown"
// expect: ARC-002's page names UC-003 and holds one Accept, disabled; Accept all writes nothing and names UC-003 as the reason ARC-002 was left out (the review page keeps leaving it out); the disabled Accept changed nothing of that
test("TST-1315104: UC-023 4b a decision that rests on a use case not accepted shows Accept disabled, and Accept all still leaves it out", async () => {
  const s = await scenario({ now: { [ARC2_PATH]: ARC2_ON_OPEN } });
  await onFile(s, "decision", "ARC-002");
  assert.deepEqual(namesOf(s), ["UC-003"]);
  assert.equal(accepts(s).length, 1);
  assert.equal(accepts(s)[0].disabled, true);
  await goTo(s, `#decision/id=all/product=${encodeURIComponent(s.address)}`);
  await press(s, namedButton(s.target, "Accept all 1 shown"));
  assert.equal(s.product.writes.length, 0, "Accept all wrote nothing");
  assert.match(pageText(s), /ARC-002: rests on what is not accepted \(UC-003\)/);
});
