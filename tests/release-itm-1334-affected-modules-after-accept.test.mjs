// Release test of ITM-1334, after Accept the affected modules are listed, each with its plan steps and backlog items — what the reviewer reads on the review pages of the Architecture view: AN ARCHITECTURE CHANGE IS NOT
// ACCEPTED WITHOUT AN IMPACT LIST says that before a change to an accepted architecture decision is accepted, "the modules it designs, their code files and tests, and the requirements that reference it are shown beside the
// change", and UC-023 step 6 says "Agent M lists the affected modules, each with the steps of the implementation plan or the backlog items that name it". The case is the world of tests/uc-023-harness.mjs: MOD-site-frame's real page
// over the real review pages, GitHub served in memory; it ends at what the reviewer reads on the page and at the commit the fake received, and reads no code file.
// Run: node --test tests/release-itm-1334-affected-modules-after-accept.test.mjs
//
// Module: MOD-review-pages
// Guards: UC-023; AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST
// Level: release
//
// Written for the release testing of sprint 131 by developer-sonnet-l, who implemented none of ITM-1334 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). Readings the texts leave open, which the case states:
//   - "beside the change" is read as the section <section class="change-impact"> of the file's page, as the release tests of UC-023 (tests/release-uc-023-review-pages.test.mjs) read it.
//   - "each with the steps of the implementation plan or the backlog items that name it" is read as one list entry per affected module that names the module and, after a dash, the items that name it: here MOD-desk with the plan step
//     ITM-902 and not the backlog item ITM-901, and MOD-sync with ITM-901 and not ITM-902.
//   - Accept is read for one file (the Accept of its page) and for several (Accept all N shown on the page of the whole architecture); the list stands after each.

import test from "node:test";
import assert from "node:assert/strict";
import { DESK_PATH, LOAN, SYNC_PATH, all, impactOf, module_, namedButton, onFile, press, scenario } from "./uc-023-harness.mjs";

// MOD-sync without the interface `pull`, which MOD-desk uses; and MOD-desk without its use of it.
const SYNC_WITHOUT_PULL = module_("MOD-sync", "Synchronising loans", "src/sync/", { provides: ["push"], interfaces: ["- `push(loan) -> receipt` — sends a loan to the shelf."], sentence: "It synchronises the loans." });
const DESK_WITHOUT_PULL = module_("MOD-desk", "The desk", "src/desk/", { realises: [LOAN, "UC-001"], provides: ["lend"], interfaces: ["- `lend(book) -> loan` — lends a book."] });

const entries = (s) => all(s.target, "li").map((node) => node.textContent).filter((text) => /^MOD-[\w-]+ — ITM-/.test(text));
const impactLines = (s) => impactOf(s).childNodes.filter((node) => node.nodeType === 1 && node.localName === "p" && node.className.split(" ").includes("small")).map((node) => node.textContent);

// TST-1334101 · level: release · module: MOD-review-pages
// guards: UC-023; AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST
// given: the accepted module MOD-sync, which provides push and pull, with MOD-desk, which uses pull, and MOD-report, which uses push; the backlog item ITM-901, which names MOD-sync, and the plan step ITM-902, which names MOD-desk; MOD-sync changed so that it no longer provides pull; known positive first — before Accept the impact list beside the change names MOD-desk with its code file and test, and the items ITM-901 and ITM-902
// input: the reviewer opens MOD-sync and presses Accept; then, in a second world in which MOD-sync and MOD-desk are both changed, opens the review of the whole architecture and presses Accept all 2 shown
// expect: known positive — before Accept the impact list names MOD-desk, src/desk/index.mjs and "Items — ITM-901, ITM-902"; after Accept of MOD-sync the page lists the affected modules, each with its items: one entry "MOD-desk — ITM-902" and one "MOD-sync — ITM-901", and no entry that pairs a module with the item of the other; after Accept all 2 shown the page lists the same two entries; Accept made one commit holding the record of the text shown
test("TST-1334101: AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST — after Accept, of one file and of several, the affected modules are listed, each with the plan steps and backlog items that name it", async () => {
  const one = await scenario({ now: { [SYNC_PATH]: SYNC_WITHOUT_PULL } });
  await onFile(one, "module", "MOD-sync");
  assert.ok(impactOf(one), "known positive: the impact list stands beside the change");
  assert.match(impactOf(one).textContent, /MOD-desk/, "known positive: it names MOD-desk");
  assert.match(impactOf(one).textContent, /src\/desk\/index\.mjs/, "known positive: with its code file");
  assert.deepEqual(impactLines(one).slice(-1), ["Items — ITM-901, ITM-902"], "known positive: and the items");
  assert.deepEqual(entries(one), [], "known positive: no module is listed with its items before Accept");
  const writes = one.product.writes.length;
  await press(one, namedButton(one.target, "Accept"));
  assert.equal(one.product.writes.length, writes + 1, "Accept is one commit");
  assert.deepEqual(entries(one), ["MOD-desk — ITM-902", "MOD-sync — ITM-901"], "after Accept each affected module is listed with the items that name it");

  const several = await scenario({ now: { [SYNC_PATH]: SYNC_WITHOUT_PULL, [DESK_PATH]: DESK_WITHOUT_PULL } });
  await onFile(several, "decision", "all");
  assert.deepEqual(entries(several), [], "known positive: before Accept all nothing is listed");
  const commits = several.product.writes.length;
  await press(several, namedButton(several.target, "Accept all 2 shown"));
  assert.equal(several.product.writes.length, commits + 1, "Accept all is one commit");
  assert.deepEqual(entries(several), ["MOD-desk — ITM-902", "MOD-sync — ITM-901"], "after Accept all the same two modules are listed, each with its items");
});
