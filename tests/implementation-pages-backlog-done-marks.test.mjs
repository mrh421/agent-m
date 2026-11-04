// MOD-implementation-pages' route `backlog` offers, on the row of a done item that carries a reason, to point it at a replacing requirement or to remove it (ITM-1316), as the accepted text of
// docs/architecture/MOD-implementation-pages.md states it: "`backlog`, `board` — the items, … *Add to backlog*, which lets them go on as edited; *+ Item*, an item pointed at a replacing requirement or
// removed, with `saveItems`", and as UC-032 1a states it: "A requirement an item realises is withdrawn or changed. The item is marked. Agent M offers to point it at the replacing requirement, or to
// remove it. Nothing changes until the Product Owner decides."
// Run: node --test tests/implementation-pages-backlog-done-marks.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-032; ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
// Level: unit
//
// The product is the fixture of tests/implementation-pages-sprints.mjs, held in memory behind that file's host, which applies a commit to its files; the item ITM-001 is merged and realises GONE, a
// requirement the SPEC does not hold, and the module file MOD-store is added so that saveItems finds the module the item names. Nothing reaches the network. Readings the texts leave open, which the
// tests state (the pull request names them): the controls of a marked row are the buttons `data-point-at="<item>"` and `data-remove-item="<item>"` and the field `data-point-to="<item>"`, which names
// the replacing requirement; *Point at* replaces the names its row's reason names among the item's `realises` with the name typed and keeps the others; a field left empty writes nothing. Each test
// states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { found, render, productFiles, row } from "./implementation-pages-sprints.mjs";

const ITEM_1 = "docs/backlog/ITM-001-item-1.md";
const moduleFile = (id) => ["---", `id: ${id}`, `title: The module ${id}`, `folder: src/${id.slice(4)}/`, "realises:", "  - RULE ONE", "follows:", "  - ARC-001", "uses: []", "provides:", "  - read", "---",
  `# ${id} The module ${id}`, ""].join("\n");
const withGone = (realises = ["GONE"]) => {
  const files = productFiles({ "docs/architecture/MOD-store.md": moduleFile("MOD-store") });
  files[ITEM_1] = files[ITEM_1].replace("realises:\n  - RULE ONE", `realises:\n${realises.map((name) => `  - ${name}`).join("\n")}`);
  return files;
};
const backlogOf = (page) => page.html().slice(page.html().indexOf('data-part="backlog"'));
const by = (page, attribute, value) => found(page.target, `[${attribute}="${value}"]`);

// TST-1316101 · level: unit · module: MOD-implementation-pages
// guards: UC-032; ONE CLICK PER DECISION
// given: ITM-001, merged, realising GONE, which the SPEC does not hold; ITM-003, merged, realising RULE ONE, which stands
// input: the route backlog's render
// expect: ITM-001's row names "GONE is not accepted" beside its state done, and holds Point at and Remove; ITM-003's row is done with no reason and holds neither; no commit is made
test("#backlog — a done row with a reason offers Point at and Remove, a done row without one offers neither, and a render writes nothing", async () => {
  const page = await render("backlog", {}, { files: withGone() });
  try {
    const marked = row(backlogOf(page), "ITM-001");
    assert.match(marked, /done/);
    assert.match(marked, /GONE is not accepted/);
    assert.equal(by(page, "data-point-at", "ITM-001").length, 1, "known positive: Point at stands on the marked row");
    assert.equal(by(page, "data-remove-item", "ITM-001").length, 1, "Remove stands on the marked row");
    assert.match(by(page, "data-point-at", "ITM-001")[0].textContent, /Point at/);
    assert.match(by(page, "data-remove-item", "ITM-001")[0].textContent, /Remove/);
    const standing = row(backlogOf(page), "ITM-003");
    assert.match(standing, /done/);
    assert.doesNotMatch(standing, /data-point-at|data-remove-item/, "counter-proof: a done item whose requirement stands is not offered");
    assert.equal(page.host.commits.length, 0, "nothing is written before the click");
  } finally { page.done(); }
});

// TST-1316102 · level: unit · module: MOD-implementation-pages
// guards: UC-032; ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the marked row of ITM-001 on the page
// input: the person's click on Remove of ITM-001
// expect: exactly one commit is written, which deletes docs/backlog/ITM-001-item-1.md and writes nothing else; the items ITM-002 to ITM-005 stay
test("#backlog — Remove writes one commit through saveItems that deletes the item's file", async () => {
  const page = await render("backlog", {}, { files: withGone() });
  try {
    await page.press(by(page, "data-remove-item", "ITM-001")[0]);
    assert.equal(page.host.commits.length, 1, JSON.stringify(page.host.calls));
    assert.deepEqual(page.host.commits[0].files.map((file) => ({ path: file.path, delete: file.delete === true })), [{ path: ITEM_1, delete: true }]);
    assert.match(page.host.commits[0].message, /ITM-001/);
    assert.ok(!Object.hasOwn(page.files, ITEM_1), "the file is gone from the repository");
    assert.ok(Object.hasOwn(page.files, "docs/backlog/ITM-002-item-2.md"), "the other items stay");
  } finally { page.done(); }
});

// TST-1316103 · level: unit · module: MOD-implementation-pages
// guards: UC-032; ONE CLICK PER DECISION; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
// given: the marked row of ITM-001, which realises GONE, and RULE ONE typed into its field as the replacing requirement
// input: the person's click on Point at of ITM-001
// expect: exactly one commit is written, which rewrites docs/backlog/ITM-001-item-1.md only; its realises is RULE ONE and not GONE, its title, modules and outcome are as they were
test("#backlog — Point at writes one commit through saveItems that replaces the withdrawn requirement with the one typed", async () => {
  const page = await render("backlog", {}, { files: withGone() });
  try {
    const before = page.files[ITEM_1];
    by(page, "data-point-to", "ITM-001")[0].value = "RULE ONE";
    await page.press(by(page, "data-point-at", "ITM-001")[0]);
    assert.equal(page.host.commits.length, 1, JSON.stringify(page.host.calls));
    assert.deepEqual(page.host.commits[0].files.map((file) => file.path), [ITEM_1]);
    const written = page.host.commits[0].files[0].text;
    assert.match(written, /realises:\n {2}- RULE ONE\n/);
    assert.doesNotMatch(written, /GONE/);
    assert.notEqual(written, before, "known positive: the file changed");
    for (const kept of ["title: The work of item 1", "  - MOD-store", "What item 1 delivers."]) assert.ok(written.includes(kept), `the item keeps ${kept}`);
  } finally { page.done(); }
});

// TST-1316104 · level: unit · module: MOD-implementation-pages
// guards: UC-032; ONE CLICK PER DECISION
// given: ITM-001 realising RULE ONE, which stands, and GONE; RULE TWO typed as the replacing requirement
// input: the person's click on Point at of ITM-001
// expect: one commit; the item's realises is RULE ONE and RULE TWO: the name its reason names is replaced, the one that stands is kept
test("#backlog — Point at replaces only the names the row's reason names", async () => {
  const page = await render("backlog", {}, { files: withGone(["RULE ONE", "GONE"]) });
  try {
    by(page, "data-point-to", "ITM-001")[0].value = "RULE TWO";
    await page.press(by(page, "data-point-at", "ITM-001")[0]);
    assert.equal(page.host.commits.length, 1, JSON.stringify(page.host.calls));
    assert.match(page.host.commits[0].files[0].text, /realises:\n {2}- RULE ONE\n {2}- RULE TWO\n/);
    assert.doesNotMatch(page.host.commits[0].files[0].text, /GONE/);
  } finally { page.done(); }
});

// TST-1316105 · level: unit · module: MOD-implementation-pages
// guards: UC-032; ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the marked row of ITM-001, the field for the replacing requirement left empty
// input: the person's click on Point at of ITM-001
// expect: no commit is written, and the page asks for the replacing requirement
test("#backlog — Point at with no replacing requirement named writes nothing", async () => {
  const page = await render("backlog", {}, { files: withGone() });
  try {
    await page.press(by(page, "data-point-at", "ITM-001")[0]);
    assert.equal(page.host.commits.length, 0);
    assert.match(page.html(), /Name the replacing requirement/);
    assert.equal(by(page, "data-point-at", "ITM-001").length, 1, "known positive: the control is still there");
  } finally { page.done(); }
});
