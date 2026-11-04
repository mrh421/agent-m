// Release tests of UC-032 Maintain the backlog — the backlog and its items: that it lives in the product repository (THE BACKLOG LIVES IN THE PRODUCT REPOSITORY), that each item names what it realises and the modules it
// changes (A BACKLOG ITEM NAMES WHAT IT REALISES, A BACKLOG ITEM NAMES THE MODULES IT CHANGES), that it has an identifier no history holds (EVERY ARTIFACT HAS AN IDENTIFIER) and names its origin (EVERY ARTIFACT NAMES
// ITS ORIGIN). The cases walk the Product Owner's path across the dashboard's route `backlog` — + Item, Add to backlog, Start sprint — over the real MOD-repository-hosts host behind a fake of GitHub's API, and read what
// the repository holds afterwards; they never read the code files.
// Run: node --test tests/release-uc-032-the-backlog-and-its-items.test.mjs
//
// Module: MOD-implementation-pages
// Module: MOD-work-plans
// Guards: UC-032; THE BACKLOG LIVES IN THE PRODUCT REPOSITORY; A BACKLOG ITEM NAMES WHAT IT REALISES; A BACKLOG ITEM NAMES THE MODULES IT CHANGES; EVERY ARTIFACT HAS AN IDENTIFIER; EVERY ARTIFACT NAMES ITS ORIGIN
// Level: release
//
// Written for the release testing of sprint 129 by developer-sonnet-l, who implemented none of ITM-681, ITM-782, ITM-783, ITM-784 or ITM-1316 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The release team works from the
// use case and the SPEC's requirements; the system test (tests/system-uc-032-maintain-the-backlog.test.mjs) walks the flows, these cases check each requirement the use case realises across the whole path. A person's click is the page's
// own listener called with a trusted event; a script's click one whose isTrusted is false; no input event of the operating system is made. Readings the texts leave open, which the cases state:
//   - "the backlog lives in the product repository" is read as: the items the page lists are exactly the files `docs/backlog/ITM-<nnn>-<slug>.md` the repository holds, and what the page writes goes under `docs/backlog/`.
//   - "names the modules of the architecture" is read as the check the page makes: a module the architecture files do not describe is refused.
//   - "no history holds" is read from MOD-work-plans' saveItems: the identifier after every one the head's paths and the default branch's history hold, a withdrawn one among them.

import test from "node:test";
import assert from "node:assert/strict";
import { saveItems } from "../src/work-plans/index.mjs";
import { COMPLETE_ITEM, backlogWrites, buttons, classed, clickOn, documentsOf, drafted, entry, fillItem, found, itemForm, itemPath, itemsOf, listOf, memoryHost, open, product, textOf, waitFor } from "./uc-032-harness.mjs";

const backlogFiles = (files) => Object.keys(files).filter((path) => /^docs\/backlog\/ITM-\d{3}-[a-z0-9-]+\.md$/.test(path)).sort();

// TST-803101 · level: release · module: MOD-implementation-pages
// guards: UC-032; THE BACKLOG LIVES IN THE PRODUCT REPOSITORY
// given: the product of tests/uc-032-harness.mjs — ten items under docs/backlog/ —, with a file docs/other/ITM-051-elsewhere.md that is an item but stands elsewhere and a note docs/backlog/NOTES.md that is no item; known positive first — the ten items are listed
// input: the Product Owner opens Backlog; adds an item with + Item; plans team2's sprint and presses Start sprint; one file of the backlog is taken out of the repository and the page is drawn again
// expect: the page lists the ten files of docs/backlog/ and neither ITM-051 nor the note; + Item writes one file under docs/backlog/ named ITM-052-<slug>.md, the identifier after ITM-051 of the file that stands elsewhere, Start sprint one file under docs/backlog/sprints/team2/; the items listed afterwards are the files docs/backlog/ITM-<nnn>-<slug>.md the repository holds, and with ITM-005's file gone the page lists nine
test("TST-803101: UC-032 the backlog is the files docs/backlog/ITM-<nnn>-<slug>.md of the product repository and what the page writes goes under docs/backlog/", async () => {
  const stray = { "docs/other/ITM-051-elsewhere.md": (await product())[itemPath(5)].replaceAll("ITM-005", "ITM-051"), "docs/backlog/NOTES.md": "# Notes\n" };
  const files = await product({ files: stray });
  const page = await open("backlog", {}, { files });
  try {
    assert.deepEqual(itemsOf(page), backlogFiles(files).map((path) => /ITM-\d{3}/.exec(path)[0]), "known positive: the ten items are listed");
    assert.equal(itemsOf(page).length, 10);
    assert.ok(!itemsOf(page).includes("ITM-051"), "an item file outside docs/backlog/ is no item of the backlog");
    const form = await itemForm(page);
    await fillItem(form, COMPLETE_ITEM);
    const before = page.srv.writes.length;
    await clickOn(form.add());
    await waitFor(() => classed(page.target, "item-added").length > 0);
    assert.deepEqual(page.srv.writes.slice(before).map((write) => Object.keys(write.files)), [["docs/backlog/ITM-052-show-the-second-rule-by-hand.md"]]);
    const again = await open("backlog", {}, { files: page.srv.files });
    try {
      assert.deepEqual(itemsOf(again), backlogFiles(page.srv.files).map((path) => /ITM-\d{3}/.exec(path)[0]), "the items listed are the files the repository holds");
      assert.ok(itemsOf(again).includes("ITM-052"));
      await again.press(found(again.target, '[data-plan="team2"]')[0]);
      found(again.target, "[data-sprint-goal]")[0].value = "Mail";
      found(again.target, "[data-sprint-closer]")[0].value = "bob";
      found(again.target, '[data-select-item="ITM-003"]')[0].checked = true;
      const writes = again.srv.writes.length;
      await again.press(found(again.target, "[data-start-sprint]")[0]);
      assert.deepEqual(again.srv.writes.slice(writes).map((write) => Object.keys(write.files)), [["docs/backlog/sprints/team2/01.md"]]);
    } finally { again.done(); }
  } finally { page.done(); }
  const withoutFive = { ...files };
  delete withoutFive[itemPath(5)];
  const taken = await open("backlog", {}, { files: withoutFive });
  try { assert.equal(itemsOf(taken).length, 9, "the page lists what the repository holds, nine without ITM-005's file"); assert.ok(!itemsOf(taken).includes("ITM-005")); } finally { taken.done(); }
});

// TST-803102 · level: release · module: MOD-implementation-pages
// guards: UC-032; A BACKLOG ITEM NAMES WHAT IT REALISES
// given: the product of tests/uc-032-harness.mjs; ep1 answers a draft that realises nothing and one that realises RULE TWO; a complete item of the Product Owner
// input: the Product Owner presses + Item and fills the form with everything but what the item realises, then with RULE TWO; and proposes items and reads the two drafts
// expect: without what it realises Add is disabled and an error stands in the form naming the field; with RULE TWO Add is enabled and the error is gone; of the drafts the one that realises nothing has the error "realises nothing", the other none, and while the faulty one is kept Add to backlog is disabled; nothing is written to docs/backlog/ before an item names what it realises
test("TST-803102: UC-032 an item that realises nothing can be neither written nor added", async () => {
  const page = await open("backlog", {}, { files: await product() });
  try {
    const form = await itemForm(page);
    await fillItem(form, { ...COMPLETE_ITEM, realises: "" });
    assert.equal(form.add().disabled, true, "no requirement or use case is named");
    assert.match(form.errors(), /realises/i);
    await fillItem(form, { realises: "RULE TWO" });
    assert.equal(form.add().disabled, false, `known positive: the item is complete: ${form.errors()}`);
    assert.doesNotMatch(form.errors(), /realises/i);
    assert.deepEqual(backlogWrites(page), [], "nothing is written before the click");
  } finally { page.done(); }
  const { page: proposal } = await drafted(await product(), { items: [entry("Realise nothing", { realises: [] }), entry("Realise RULE TWO")] });
  try {
    const boxes = found(proposal.target, "[data-draft]");
    assert.match(classed(boxes[0], "error").map(textOf).join(" "), /realises nothing/);
    assert.equal(classed(boxes[1], "error").length, 0, "the other draft is sound");
    assert.equal(buttons(proposal.target, "Add to backlog")[0].disabled, true);
    assert.deepEqual(backlogWrites(proposal), []);
  } finally { proposal.done(); }
});

// TST-803103 · level: release · module: MOD-implementation-pages
// guards: UC-032; A BACKLOG ITEM NAMES THE MODULES IT CHANGES
// given: the product of tests/uc-032-harness.mjs, whose architecture describes MOD-store, MOD-pages, MOD-mail, MOD-feed, MOD-news and MOD-report; a complete item of the Product Owner; ep1 answers a draft that changes MOD-new, which the architecture does not describe
// input: the Product Owner presses + Item and fills the form without a module, then with MOD-new, then with MOD-news; and proposes items and reads the draft
// expect: without a module and with MOD-new Add is disabled and the error says the item names no module the architecture describes; with MOD-news Add is enabled; the draft that changes MOD-new has that error and Add to backlog is disabled; nothing is written to docs/backlog/ until an item names a module the architecture describes
test("TST-803103: UC-032 an item that names no module, or one the architecture does not describe, can be neither written nor added", async () => {
  const page = await open("backlog", {}, { files: await product() });
  try {
    const form = await itemForm(page);
    await fillItem(form, { ...COMPLETE_ITEM, modules: "" });
    assert.equal(form.add().disabled, true, "no module is named");
    assert.match(form.errors(), /module/i);
    await fillItem(form, { modules: "MOD-new" });
    assert.equal(form.add().disabled, true, "a module the architecture does not describe");
    assert.match(form.errors(), /names no module the architecture describes/);
    await fillItem(form, { modules: "MOD-news" });
    assert.equal(form.add().disabled, false, `known positive: the item is complete: ${form.errors()}`);
    assert.deepEqual(backlogWrites(page), []);
  } finally { page.done(); }
  const { page: proposal } = await drafted(await product(), { items: [entry("Change a module that is not there", { modules: ["MOD-new"] })] });
  try {
    assert.match(classed(found(proposal.target, "[data-draft]")[0], "error").map(textOf).join(" "), /names no module the architecture describes/);
    assert.equal(buttons(proposal.target, "Add to backlog")[0].disabled, true);
    assert.deepEqual(backlogWrites(proposal), []);
  } finally { proposal.done(); }
});

// TST-803104 · level: release · module: MOD-work-plans
// guards: UC-032; EVERY ARTIFACT HAS AN IDENTIFIER
// given: the product of tests/uc-032-harness.mjs, held in memory with ITM-010 the highest of its items; known positive first — ITM-010 is removed and its file is gone
// input: saveItems removes ITM-010; then two items are added in one save, and a third in another; and, on the page, two drafts are added in one click
// expect: the items added take ITM-011, ITM-012 and ITM-013, never ITM-010, whose identifier the history holds after its file is gone; each file's name and its `id` front matter carry the same identifier; no two items of the repository share one; on the page the two drafts added together are ITM-011 and ITM-012, each an identifier of the scheme ITM-<nnn>
test("TST-803104: UC-032 each item takes an identifier that no history holds, and a withdrawn identifier is never given again", async () => {
  const mem = memoryHost(await product());
  const { architecture } = documentsOf(mem.files);
  const item = (title) => ({ fields: { title, level: "module", realises: ["RULE TWO"], modules: ["MOD-news"], tests: ["unit"], origin: ["the Product Owner"] }, sections: [{ heading: "## Outcome", text: "An outcome." }, { heading: "## Acceptance", text: "- a test." }] });
  await saveItems(mem.host, { items: [], removed: ["ITM-010"] }, { architecture, head: mem.head, trailers: [] });
  assert.ok(!Object.hasOwn(mem.files, itemPath(10)), "known positive: ITM-010 is withdrawn");
  const first = await saveItems(mem.host, { items: [item("First thing"), item("Second thing")], removed: [] }, { architecture, head: mem.head, trailers: [] });
  const second = await saveItems(mem.host, { items: [item("Third thing")], removed: [] }, { architecture, head: mem.head, trailers: [] });
  assert.deepEqual([...first.written, ...second.written], ["docs/backlog/ITM-011-first-thing.md", "docs/backlog/ITM-012-second-thing.md", "docs/backlog/ITM-013-third-thing.md"]);
  const ids = backlogFiles(mem.files).map((path) => {
    const named = /ITM-\d{3}/.exec(path)[0];
    assert.equal(/^id: (.+)$/m.exec(mem.files[path])[1].trim(), named, `${path}: its name and its id agree`);
    return named;
  });
  assert.equal(new Set(ids).size, ids.length, "no two items share an identifier");
  const { page } = await drafted(await product(), { items: [entry("One draft"), entry("Another draft", { modules: ["MOD-pages"] })] });
  try {
    await page.press(buttons(page.target, "Add to backlog")[0]);
    await waitFor(() => classed(page.target, "drafts-added").length > 0);
    assert.deepEqual(Object.keys(backlogWrites(page)[0].files).map((path) => /ITM-\d{3}/.exec(path)[0]), ["ITM-011", "ITM-012"]);
  } finally { page.done(); }
});

// TST-803105 · level: release · module: MOD-implementation-pages
// guards: UC-032; EVERY ARTIFACT NAMES ITS ORIGIN
// given: the product of tests/uc-032-harness.mjs, in which every item names its origin; a complete item of the Product Owner; ep1 answers one draft
// input: the Product Owner presses + Item and fills the form without an origin, then with one; and proposes items and adds the draft
// expect: without an origin Add is disabled and an error stands in the form naming it; with "the Product Owner" Add is enabled, and the file written names it under origin; the item added from the draft names an origin too; every item file of the repository after both holds an origin
test("TST-803105: UC-032 an item that names no origin cannot be written, and every item written names one", async () => {
  const page = await open("backlog", {}, { files: await product() });
  try {
    const form = await itemForm(page);
    await fillItem(form, { ...COMPLETE_ITEM, origin: "" });
    assert.equal(form.add().disabled, true, "no origin is named");
    assert.match(form.errors(), /origin/i);
    await fillItem(form, { origin: "the Product Owner" });
    assert.equal(form.add().disabled, false, `known positive: the item is complete: ${form.errors()}`);
    await clickOn(form.add());
    await waitFor(() => classed(page.target, "item-added").length > 0);
    assert.deepEqual(listOf(page.srv.files["docs/backlog/ITM-011-show-the-second-rule-by-hand.md"], "origin"), ["the Product Owner"]);
    for (const path of backlogFiles(page.srv.files)) assert.ok(listOf(page.srv.files[path], "origin").length > 0, `${path} names its origin`);
  } finally { page.done(); }
  const { page: proposal } = await drafted(await product(), { items: [entry("A drafted thing")] });
  try {
    await proposal.press(buttons(proposal.target, "Add to backlog")[0]);
    await waitFor(() => classed(proposal.target, "drafts-added").length > 0);
    const [path] = Object.keys(backlogWrites(proposal)[0].files);
    assert.ok(listOf(proposal.srv.files[path], "origin").length > 0, `${path} names its origin`);
  } finally { proposal.done(); }
});
