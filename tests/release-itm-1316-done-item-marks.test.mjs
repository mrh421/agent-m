// Release tests of ITM-1316 — a done item whose requirement is withdrawn or changed is marked, and the Product Owner points it at the replacing requirement or removes it. The behaviour is UC-032 1a,
// "A requirement an item realises is withdrawn or changed. The item is marked. Agent M offers to point it at the replacing requirement, or to remove it. Nothing changes until the Product Owner
// decides.", with the SPEC's A BACKLOG ITEM NAMES WHAT IT REALISES, A RENAMED REQUIREMENT IS WITHDRAWN AND ADDED and A PERSON'S OWN INPUT IS COMMITTED DIRECTLY. The cases walk the backlog page of a
// product (MOD-implementation-pages' route `backlog`, over MOD-work-plans' itemStates) from the SPEC's change to the Product Owner's decision and draw the page again over the repository the decision
// wrote; they never read the code files.
// Run: node --test tests/release-itm-1316-done-item-marks.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-032; A BACKLOG ITEM NAMES WHAT IT REALISES; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
// Level: release
//
// Written for the release testing of sprint 128 by developer-sonnet-l, who implemented none of ITM-1316 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The product is the fixture of
// tests/implementation-pages-sprints.mjs, held in memory behind a host that applies a commit to its files, so that a decision is seen on the page drawn again. A click is the page's own listener called
// with a trusted event, as the unit tests of the route do; no input event of the operating system is made. Readings the texts leave open, which the cases state:
//   - an item is "done" by a merged pull request of its own (ITM-001 and ITM-003 of the fixture) or by the commit its `built_by` names; the other items of the fixture are not done and are never marked;
//   - "the requirement is withdrawn" is read as the SPEC no longer holding its name, which is how a renamed requirement is withdrawn (A RENAMED REQUIREMENT IS WITHDRAWN AND ADDED);
//   - "changed" is read against the text that holds now (the item's reading): a use case is changed while its file differs from the text its newest approval record names.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { found, productFiles, render, row } from "./implementation-pages-sprints.mjs";

const lines = (...rows) => `${rows.join("\n")}\n`;
// The blob the fixture host gives a file: tests/implementation-pages-sprints.mjs takes the SHA-1 of the content.
const blob = (text) => createHash("sha1").update(text).digest("hex");
const ITEM_1 = "docs/backlog/ITM-001-item-1.md", ITEM_3 = "docs/backlog/ITM-003-item-3.md";
const spec = (...names) => lines("# SPEC", "", "## 1. Rules", "", ...names.flatMap((name) => [`**${name}** *(PO, 2026-09-01)*`, "A rule.", "*Check:* no automatic check; at review.", ""]));
const moduleFile = (id) => lines("---", `id: ${id}`, `title: The module ${id}`, `folder: src/${id.slice(4)}/`, "realises:", "  - RULE ONE", "follows:", "  - ARC-001", "uses: []", "provides:", "  - read", "---",
  `# ${id} The module ${id}`);
// The modules the fixture's items name, so that saveItems finds each.
const MODULES = Object.fromEntries(["MOD-store", "MOD-pages", "MOD-mail", "MOD-feed", "MOD-news"].map((id) => [`docs/architecture/${id}.md`, moduleFile(id)]));
const realising = (files, path, names) => files[path].replace(/realises:\n(?: {2}- .*\n)+/, `realises:\n${names.map((name) => `  - ${name}`).join("\n")}\n`);
const backlogOf = (page) => page.html().slice(page.html().indexOf('data-part="backlog"'));
const by = (page, attribute, value) => found(page.target, `[${attribute}="${value}"]`);
const marked = (page, id) => by(page, "data-point-at", id).length === 1 && by(page, "data-remove-item", id).length === 1;
const unmarked = (page, id) => by(page, "data-point-at", id).length === 0 && by(page, "data-remove-item", id).length === 0;

// The product after a requirement is renamed: the SPEC holds RULE ONE TOO and no RULE ONE; the merged ITM-001 and ITM-003 realise RULE ONE, the open ITM-002 and the items in no sprint too.
const renamed = () => productFiles({ "SPEC.md": spec("RULE ONE TOO"), ...MODULES });

// TST-1316201 · level: release · module: MOD-implementation-pages
// guards: UC-032; A BACKLOG ITEM NAMES WHAT IT REALISES
// given: a product whose SPEC holds RULE ONE TOO and no RULE ONE; ITM-001 and ITM-003 merged and realising RULE ONE, ITM-002 with an open pull request and ITM-004 and ITM-005 not started, all realising RULE ONE; a control product whose SPEC still holds RULE ONE
// input: the backlog page of each product is drawn
// expect: in the renamed product ITM-001 and ITM-003 are done with "RULE ONE is not accepted" and each offers Point at and Remove; ITM-002, ITM-004 and ITM-005 offer neither (they are not done), and nothing is written; in the control product (counter-proof) no row offers either
test("TST-1316201: UC-032 1a a done item that realises a requirement the SPEC withdrew is marked and offers Point at and Remove; no other row does", async () => {
  const page = await render("backlog", {}, { files: renamed() });
  try {
    for (const id of ["ITM-001", "ITM-003"]) {
      assert.match(row(backlogOf(page), id), /done/, `${id} is done`);
      assert.match(row(backlogOf(page), id), /RULE ONE is not accepted/, `known positive: ${id} is marked with its cause`);
      assert.ok(marked(page, id), `${id} offers Point at and Remove`);
    }
    for (const id of ["ITM-002", "ITM-004", "ITM-005"]) assert.ok(unmarked(page, id), `${id} is not done and offers neither`);
    assert.equal(page.host.commits.length, 0, "nothing changes until the Product Owner decides");
  } finally { page.done(); }
  const control = await render("backlog", {}, { files: productFiles({ ...MODULES }) });
  try {
    for (const id of ["ITM-001", "ITM-002", "ITM-003", "ITM-004", "ITM-005"]) assert.ok(unmarked(control, id), `counter-proof: ${id} stays unmarked while its requirement stands`);
    assert.doesNotMatch(control.html(), /is not accepted/);
  } finally { control.done(); }
});

// TST-1316202 · level: release · module: MOD-implementation-pages
// guards: UC-032; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; A BACKLOG ITEM NAMES WHAT IT REALISES
// given: the renamed product of TST-1316201; the Product Owner types RULE ONE TOO beside ITM-001 and presses Point at, and presses Remove beside ITM-003
// input: the two clicks, one after the other, and the backlog page drawn again over the repository they wrote
// expect: Point at writes one commit that rewrites ITM-001's file alone, which now realises RULE ONE TOO and not RULE ONE, with its title, module and outcome as they were; Remove writes one commit that deletes ITM-003's file alone; the page drawn again shows ITM-001 done and unmarked, ITM-003 gone, ITM-002 and the rest as they were; a click on Point at with the field empty (counter-proof) writes nothing
test("TST-1316202: UC-032 1a the Product Owner points a marked item at the replacing requirement or removes it, each in one commit, and the page no longer marks it", async () => {
  const files = renamed();
  const page = await render("backlog", {}, { files });
  const before = files[ITEM_1];
  try {
    await page.press(by(page, "data-point-at", "ITM-001")[0]);
    assert.equal(page.host.commits.length, 0, "counter-proof: Point at with no replacing requirement named writes nothing");
    by(page, "data-point-to", "ITM-001")[0].value = "RULE ONE TOO";
    await page.press(by(page, "data-point-at", "ITM-001")[0]);
    assert.equal(page.host.commits.length, 1, JSON.stringify(page.host.calls));
    assert.deepEqual(page.host.commits[0].files.map((file) => file.path), [ITEM_1], "one file");
    const written = page.host.commits[0].files[0].text;
    assert.match(written, /realises:\n {2}- RULE ONE TOO\nmodules:/, "it realises the replacing requirement alone, the withdrawn name is gone");
    for (const kept of ["title: The work of item 1", "  - MOD-store", "What item 1 delivers."]) assert.ok(written.includes(kept), `known positive: the item keeps ${kept}`);
    assert.notEqual(written, before);
  } finally { page.done(); }

  const again = await render("backlog", {}, { files });
  try {
    assert.ok(unmarked(again, "ITM-001"), "pointed at a requirement that stands, ITM-001 is no longer marked");
    assert.match(row(backlogOf(again), "ITM-001"), /done/, "and is still done");
    assert.ok(marked(again, "ITM-003"), "nothing was decided about ITM-003, which is still marked");
    await again.press(by(again, "data-remove-item", "ITM-003")[0]);
    assert.equal(again.host.commits.length, 1, JSON.stringify(again.host.calls));
    assert.deepEqual(again.host.commits[0].files.map((file) => ({ path: file.path, delete: file.delete === true })), [{ path: ITEM_3, delete: true }]);
  } finally { again.done(); }

  const last = await render("backlog", {}, { files });
  try {
    assert.equal(row(backlogOf(last), "ITM-003"), "", "ITM-003 is gone from the backlog");
    assert.ok(!Object.hasOwn(files, ITEM_3));
    for (const id of ["ITM-001", "ITM-002", "ITM-004", "ITM-005"]) assert.notEqual(row(backlogOf(last), id), "", `${id} stays`);
    assert.ok(unmarked(last, "ITM-001"));
  } finally { last.done(); }
});

// TST-1316203 · level: release · module: MOD-implementation-pages
// guards: UC-032; A BACKLOG ITEM NAMES WHAT IT REALISES
// given: the product of the fixture, whose SPEC holds RULE ONE; ITM-001, merged, builds on ITM-005, which is not done; UC-001 is accepted by an approval record that names its text and ITM-003, merged, realises it; then UC-001's file changes after the record
// input: the backlog page is drawn with UC-001 as accepted, and again with its file changed
// expect: with ITM-005 not done, ITM-001 is done and marked "ITM-005 is not done" and offers Point at and Remove; ITM-003 realising the accepted UC-001 offers neither (counter-proof); once UC-001's file differs from the text its record names, ITM-003 is marked "UC-001 is changed, not accepted"; ITM-002, which is not done, offers neither in either page; nothing is written
test("TST-1316203: UC-032 1a a done item is marked when the item it builds on is not done, or when the use case it realises has changed since it was accepted", async () => {
  const uc = (sentence) => lines("---", "id: UC-001", "title: Lend", "area: lending", "actors:", "  - Member", "realises:", "  - RULE ONE", "---", "# UC-001 Lend", "", `**Goal.** ${sentence}`);
  const accepted = uc("Lend a book.");
  const record = `docs/approvals/UC-001-${blob(accepted).slice(0, 12)}.md`;
  const base = (text) => {
    const files = productFiles({ ...MODULES, "docs/use-cases/UC-001-lend.md": text, [record]: lines("kind: use-case", "file: docs/use-cases/UC-001-lend.md", `blob: ${blob(accepted)}`) });
    files[ITEM_1] = files[ITEM_1].replace("builds_on: []", "builds_on:\n  - ITM-005");
    files[ITEM_3] = realising(files, ITEM_3, ["UC-001"]);
    return files;
  };
  const stands = await render("backlog", {}, { files: base(accepted) });
  try {
    assert.match(row(backlogOf(stands), "ITM-001"), /ITM-005 is not done/, "known positive: the prerequisite that is not done is named");
    assert.ok(marked(stands, "ITM-001"));
    assert.ok(unmarked(stands, "ITM-003"), "counter-proof: ITM-003 realises a use case whose record names its text");
    assert.ok(unmarked(stands, "ITM-002"));
    assert.equal(stands.host.commits.length, 0);
  } finally { stands.done(); }
  const changed = await render("backlog", {}, { files: base(uc("Lend a book, twice.")) });
  try {
    assert.match(row(backlogOf(changed), "ITM-003"), /UC-001 is changed, not accepted/);
    assert.ok(marked(changed, "ITM-003"), "a changed use case marks the item");
    assert.ok(unmarked(changed, "ITM-002"));
    assert.equal(changed.host.commits.length, 0, "nothing changes until the Product Owner decides");
  } finally { changed.done(); }
});
