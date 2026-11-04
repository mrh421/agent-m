// Release tests of UC-046 See what goes on in the instance, for the requirements it realises that no release test guarded: THE MENU FOLLOWS THE PROCESS and THE BUILD IS SHOWN AS IT HAPPENS (DOCUMENTS ARE REVIEWED AND EDITED UNDER DOCS is in
// tests/release-uc-046-documents-under-docs.test.mjs, which loads another fixture page). The requirements UC-046 realises whose check is "at review" (THE SITE WEARS THE PATTERN RECOGNITION LAB'S LOOK) have no release test; the others have one already
// (tests/release-itm-1190-jobs-page-waiting.test.mjs, release-itm-1261-progress-by-stage.test.mjs, release-itm-1281-start-page-instance-reads.test.mjs, release-uc-014-get-your-own.test.mjs, release-sprint-09-uc-001-add-product.test.mjs,
// release-itm-1280-jobs-list-batches.test.mjs and the release tests of PROGRESS AND JOB STATE ARE DERIVED, NOT STORED and STATUS IS DERIVED FROM THE RECORDS).
// Run: node --test tests/release-uc-046-menu-build-and-documents.test.mjs
//
// Module: MOD-main-page
// Module: MOD-progress-measures
// Guards: THE MENU FOLLOWS THE PROCESS; THE BUILD IS SHOWN AS IT HAPPENS; UC-046
// Level: release
//
// Written by developer-sonnet-k (ITM-1062), who built none of UC-046's items (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER; no commit of src/main-page/ or src/progress-measures/ carries the trailer `Agent-M-Participant: developer-sonnet-k`; known
// positive: ITM-1190's commit carries developer-opus-e's), from the SPEC's two requirements and their checks, and from UC-046. The world is the start page as index.html serves it (tests/uc-046-harness.mjs) over a counting fake of GitHub. Each case ends
// at what a person reads on the page. Readings the texts leave open, which the cases state:
//   - "lists the requirements, the use cases, the architecture, the implementation, the tests and the releases in this order, followed by the maintenance — issues and mail — and the settings" is read of the eight entries of the menu the page draws, by their
//     names and in this order; "issues and mail" is read of the routes the entry Maintenance opens, which are the page of issues and the page of mail.
//   - "shows the job beside its step" (THE BUILD IS SHOWN AS IT HAPPENS) is read of a row of the build: the step, then the job working on it, its participant, its state and its elapsed time.
//   - "the step shows done" is read, as tests/test_main_page.py reads it, of the job's state in the step's row once the job has ended, and, once the step's pull request is merged, of the step leaving the build as done: it is counted in the
//     Implementation stage's items done.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { INSTANCE, PRODUCT, buildOf, cardsOf, endedJob, find, instanceWithModel, pullOf, runningJob, shelf, stagesOf, startMain } from "./uc-046-harness.mjs";

const JOB = "JOB-20261016-1000-ffff";
const RUNNING = runningJob({ id: JOB, by: "lab-pc-4" });
const ENTRIES = ["requirements", "use-cases", "architecture", "implementation", "tests", "releases", "maintenance", "settings"];
let page = null;
afterEach(() => {
  page?.stop();
  page = null;
});
async function open(options) {
  page?.stop();
  page = await startMain(options);
  return page;
}
const world = async (shelfOptions = {}) => ({ [PRODUCT]: await shelf(shelfOptions), [INSTANCE]: instanceWithModel() });
const firstCard = () => cardsOf(page.route)[0];
const text = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// ---------------------------------------------------------------- THE MENU FOLLOWS THE PROCESS

// TST-1062101 · level: release · module: system
// guards: THE MENU FOLLOWS THE PROCESS; UC-046
// given: the instance's site served from the root of its repository (index.html), the page opened by a visitor
// input: the menu of the page read, entry by entry
// expect: eight entries, in this order: Requirements, Use cases, Architecture, Implementation, Tests, Releases, Maintenance, Settings; the six stages come first and are followed by the maintenance and the settings; counter-proof — the same entries with two stages swapped (Tests and Releases) are not this order, and an entry list that puts the settings before the maintenance is not either
// Planted fault: two entries swapped (Tests and Releases in ENTRIES of src/site-frame/menu.mjs) fails the case at the order of the eight entries, and the case names the entry that stands in the wrong place.
test("TST-1062101: THE MENU FOLLOWS THE PROCESS the menu lists the requirements, the use cases, the architecture, the implementation, the tests and the releases in this order, then the maintenance and the settings", async () => {
  await open({ repos: await world() });
  const names = page.menu.children.map((entry) => entry.textContent);
  const process = ["Requirements", "Use cases", "Architecture", "Implementation", "Tests", "Releases"];
  assert.deepEqual(names.slice(0, 6), process, "the six stages in the order of the process");
  assert.deepEqual(names.slice(6), ["Maintenance", "Settings"], "followed by the maintenance and the settings");
  assert.deepEqual(names, [...process, "Maintenance", "Settings"]);
  const swapped = [...names];
  [swapped[4], swapped[5]] = [swapped[5], swapped[4]];
  assert.notDeepEqual(swapped, [...process, "Maintenance", "Settings"], "counter-proof: a menu with two stages swapped is not the order of the process");
  assert.notDeepEqual([...process, "Settings", "Maintenance"], names, "counter-proof: the settings before the maintenance is not either");
});

// TST-1062102 · level: release · module: system
// guards: THE MENU FOLLOWS THE PROCESS; UC-046
// given: the start page with a product kept, and the page docs/index.html, which the menu's entries open; the views that docs/index.html names in its script tag (data-views)
// input: the menu's eight addresses and the six stage links of the product's card read; the routes of the views that docs/index.html names asked for the entry each address names
// expect: every address is docs/index.html#<entry> for the entries requirements, use-cases, architecture, implementation, tests, releases, maintenance and settings, and every one of them is served by a route of those views (none is "not built yet"); the entry maintenance is served by the pages of issues and of mail; the six stage links of the card are the first six addresses, with the product's address; counter-proof — an entry no view serves (billing) is found by the same reading to be served by none
// Planted fault: the view that serves the entry Maintenance not named by the review page (`maintenance-pages` taken out of data-views in docs/index.html) fails the case at the entry maintenance, which no route of the views serves; the stage links written without the product (`menuOf("main", [], own ? null : address)` replaced by `menuOf("main", [], null)` in productCard of src/main-page/cards.mjs) fail it at the card's links.
test("TST-1062102: THE MENU FOLLOWS THE PROCESS each entry of the menu opens a page under docs/ that is built, and each stage of a card leads to the entry of its place in the process", async () => {
  await open({ repos: await world() });
  const addresses = page.menu.children.map((entry) => entry.getAttribute("href"));
  assert.deepEqual(addresses, ENTRIES.map((entry) => `docs/index.html#${entry}`));
  const slugs = /data-views="([^"]*)"/.exec(text("docs/index.html"))[1].split(/\s+/).filter(Boolean);
  assert.ok(slugs.length >= 6, `known positive: docs/index.html names its views: ${slugs.join(" ")}`);
  const served = new Map();
  for (const slug of slugs) {
    const { view } = await import(new URL(`../src/${slug}/routes.mjs`, import.meta.url));
    for (const route of view.routes) if (route.entry) served.set(route.entry, [...(served.get(route.entry) ?? []), route.name]);
  }
  for (const entry of ENTRIES) assert.ok(served.has(entry), `${entry} is served by a route of the review pages: ${[...served.keys()].join(", ")}`);
  assert.ok(["issues", "mail"].every((name) => served.get("maintenance").includes(name)), `the maintenance is issues and mail: ${served.get("maintenance")}`);
  assert.equal(served.has("billing"), false, "counter-proof: an entry no view serves is found to be served by none");
  const product = encodeURIComponent("https://github.com/alice/product");
  const links = find(firstCard(), (node) => node.localName === "a" && node.className === "stage-link").map((link) => link.getAttribute("href"));
  assert.deepEqual(links, ENTRIES.slice(0, 6).map((entry) => `docs/index.html#${entry}/product=${product}`), "each stage leads to the entry of its place in the process, for the product");
});

// ---------------------------------------------------------------- THE BUILD IS SHOWN AS IT HAPPENS

// TST-1062103 · level: release · module: system
// guards: THE BUILD IS SHOWN AS IT HAPPENS; UC-046
// given: a fixture product that declares a model and holds two backlog items, ITM-0900 and ITM-0901; a job of the participant dev-cli works on ITM-0900 and is running on the Bridge lab-pc-4 since 10:00 UTC, the clock standing at 12:00 UTC; and, as the counter-proof, the same job ended (its record ends as done), first with no pull request and then with the pull request of ITM-0900 merged
// input: the page opened for each
// expect: with the running job the card shows a build with one row, the step ITM-0900 beside the job JOB-20261016-1000-ffff, dev-cli, running, 2h 0m 0s, and the Implementation stage reads 0 % (0 of 2 items done); counter-proof — once the job has ended the row reads done (1h 0m 0s), and once the pull request is merged the step has left the build and the Implementation stage reads 50 % (1 of 2 items done)
// Planted fault: the job not shown beside its step (`state.state === "in progress" && rows.has(state.job)` replaced by `state.state === "in progress" && false` in buildStates of src/progress-measures/stored.mjs) fails the case at the row of the running job; a build that ignores the merge (`state.state === "in progress" && rows.has(state.job)` replaced by `rows.has(state.job)`) fails it at the merged step.
test("TST-1062103: THE BUILD IS SHOWN AS IT HAPPENS a fixture product with a running job shows the job beside its step, and once the job has ended the step shows done", async () => {
  await open({ repos: await world({ jobs: [RUNNING] }), bridgeLists: JOB });
  assert.deepEqual(buildOf(firstCard()), [["ITM-0900", JOB, "dev-cli", "running", "2h 0m 0s"]]);
  assert.deepEqual(stagesOf(firstCard())[3], ["Implementation", "0 %", "0 of 2 items done"]);
  const ended = endedJob({ id: JOB, by: "lab-pc-4", state: "done" });
  await open({ repos: await world({ jobs: [ended] }) });
  assert.deepEqual(buildOf(firstCard()), [["ITM-0900", JOB, "dev-cli", "done", "1h 0m 0s"]], "counter-proof: once the job has ended the step shows done");
  await open({ repos: await world({ jobs: [ended] }), pulls: { [PRODUCT]: [pullOf(7, "ITM-0900", { merged: "2026-10-16T11:30:00Z" })] } });
  assert.deepEqual(buildOf(firstCard()), [], "the step whose pull request is merged has left the build");
  assert.deepEqual(stagesOf(firstCard())[3], ["Implementation", "50 %", "1 of 2 items done"], "and counts as done");
});
