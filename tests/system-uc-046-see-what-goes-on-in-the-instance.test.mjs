// System coverage for UC-046 See what goes on in the instance, walked through the start page as index.html serves it: the main flow, steps 1 to 5, and the alternative flows 3a, 3b, 3c, 4a and 4b, and the postcondition. The page is started
// as the browser starts it (tests/uc-046-harness.mjs): the script tag of index.html loads src/site-frame/start.mjs, MOD-site-frame's real frame starts MOD-main-page's real view (routes.mjs, which imports the route `home` when the frame
// first shows it) over the real MOD-progress-measures, MOD-job-ledger, MOD-runtimes, MOD-repository-hosts and MOD-browser-store, behind a counting fake of GitHub and of two Bridges. No request leaves the process; nothing sleeps.
// Run: node --test tests/system-uc-046-see-what-goes-on-in-the-instance.test.mjs
//
// Module: MOD-main-page
// Module: MOD-progress-measures
// Guards: UC-046
// Level: system
//
// Authored by developer-sonnet-k (ITM-1062), who built none of UC-046's items (no commit of src/main-page/ or src/progress-measures/ carries the trailer `Agent-M-Participant: developer-sonnet-k`; known positive: ITM-1190's commit carries
// developer-opus-e's). Where the page and UC-046 disagree the case follows UC-046 and is marked { todo } with the finding it reports; every other case is green. The findings still open:
//   UC046-S1  step 3: "Every share is derived when the page is shown, from the product's repository and its records; none is stored." The card is drawn from the overview the workflow stored on the branch overview-cache for the head, not derived.
//   UC046-S2  step 4: "a step or an item moves on to *done* when its pull request is merged." An open page reads the jobs' records again and nothing else (reread.mjs), so the step stays in the build until the page is loaded again.
//   UC046-S3  alternative flow 4a: "The card says that jobs running there are not shown." The card lists the job with its record's state and marks it "not reachable"; it says nothing of jobs not shown.
// Each test states its input and its expected values in its own text; none reads an expected result from the SPEC, a use case or an architecture file, but the flow map (TST-1062001), which holds the expected passages itself and checks that
// UC-046 still says them. A person's click is the page's own listener called; the address a click writes is read from the fixture location. Readings the texts leave open, which the cases state:
//   - "the stage the product is in" is the first stage whose share is not full (MOD-progress-measures' currentStage); "a click on a stage opens that stage's page" is read of the link the stage is: its address is the menu's entry of the same place in the process.
//   - "the page under docs/ where that stage's work is reviewed and done" is the address docs/index.html#<entry>, with /product=<the product's address, percent-encoded> for a product.
//   - "the card says which" (3b) is read of the reason the card shows: a private repository without a stored token is "not found", a server that does not answer "could not be reached".
//   - "keeps them current" (step 4) is read of the build's rows: the page reads the jobs' states again once a minute while a token is stored (MOD-main-page, Data).

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  INSTANCE, MISSING_URL, NOW, OTHER, OTHER_TOKEN, OTHER_URL, PRODUCT, PRODUCT_TOKEN, PRODUCT_URL,
  buildOf, byClass, cardsOf, click, currentOf, endedJob, find, headOf, instanceWithModel, pullOf, runningJob, shelf, smallProduct, stagesOf, startMain, timers, waitsOf,
} from "./uc-046-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const exists = (path) => existsSync(new URL(`../${path}`, import.meta.url));
const UC = "docs/use-cases/UC-046-see-what-goes-on-in-the-instance.md";
const SELF = "tests/system-uc-046-see-what-goes-on-in-the-instance.test.mjs";
const SITE_USABILITY = "tests/site-usability.test.mjs";
const RELEASE_MENU = "tests/release-uc-046-menu-build-and-documents.test.mjs";
const RELEASE_DOCS = "tests/release-uc-046-documents-under-docs.test.mjs";

// ---------------------------------------------------------------- the flow map

// The passages of UC-046 the system test walks, each with the tests that walk it; a passage the page does otherwise is a finding, a todo test that fails now and names what the page does instead.
const FLOW_EVIDENCE = {
  "main-1-greeting": { uc: "The main page greets them: the logo of the Pattern Recognition Lab, Agent M's name, one sentence on what Agent M is", evidence: [[SELF, "TST-1062002"]] },
  "main-1-what-first": { uc: "and what to do first, with a folded **What is this?** for people new to it.", evidence: [[SELF, "TST-1062002"]] },
  "main-2-order": { uc: "The menu leads through the process in its order", evidence: [[SELF, "TST-1062003"], [RELEASE_MENU, "TST-1062101"]] },
  "main-2-every-page": { uc: "Every page of the site carries the same menu;", evidence: [[SITE_USABILITY, "TST-920001"], [SITE_USABILITY, "TST-920002"]] },
  "main-2-docs": { uc: "each entry opens the page under `docs/` where that stage's work is reviewed and done, for the product chosen.", evidence: [[SELF, "TST-1062003"], [SELF, "TST-1062004"], [RELEASE_MENU, "TST-1062102"], [RELEASE_DOCS, "TST-1062104"]] },
  "main-2-narrow": { uc: "On a screen up to 760 px wide, the menu is one button: a click unfolds the eight entries, and a second click folds them again.", evidence: [[SELF, "TST-1062003"], [SITE_USABILITY, "TST-920001"]] },
  "main-2-wide": { uc: "On a wider screen the entries stand in a row.", evidence: [[SITE_USABILITY, "TST-1191002"]] },
  "main-3-cards": { uc: "one card per product this browser manages (UC-001): its name, its process model, and its progress", evidence: [[SELF, "TST-1062005"]] },
  "main-3-bar": { uc: "as one bar of the six stages of the table above, each filled by its share;", evidence: [[SELF, "TST-1062005"], [SELF, "TST-1062006"], [SELF, "TST-1062007"]] },
  "main-3-marked": { uc: "the stage the product is in is marked, and a click on a stage opens that stage's page for the product.", evidence: [[SELF, "TST-1062005"], [SELF, "TST-1062006"]] },
  "main-3-from-the-repository": { uc: "from the product's repository and its records", evidence: [[SELF, "TST-1062006"], [SELF, "TST-1062008"]] },
  "main-4-build": { uc: "the card shows the steps of its implementation plan or its backlog items in progress, each with the job working on it", evidence: [[SELF, "TST-1062010"], [RELEASE_MENU, "TST-1062103"]] },
  "main-4-participant": { uc: "its participant, its state and its elapsed time (UC-036)", evidence: [[SELF, "TST-1062010"]] },
  "main-4-current": { uc: "and keeps them current while the page is shown;", evidence: [[SELF, "TST-1062011"]] },
  "main-5-jobs": { uc: "a link **Jobs** opens the page of every job and of what waits for a person (UC-036).", evidence: [[SELF, "TST-1062013"]] },
  "main-5-no-waits": { uc: "The main page itself does not list what waits.", evidence: [[SELF, "TST-1062013"]] },
  "3a-own-progress": { uc: "The main page shows Agent M's own progress in the same bar of six stages, derived from Agent M's repository; the bar is full once Agent M's", evidence: [[SELF, "TST-1062014"]] },
  "3a-add-product": { uc: "Beside it stands **+ Add product** (UC-001).", evidence: [[SELF, "TST-1062014"]] },
  "3b-says-which": { uc: "Its card says which, and links to the token's setting (UC-042); the other cards are shown.", evidence: [[SELF, "TST-1062015"]] },
  "3c-no-model": { uc: "Its implementation stage says that the process is configured when implementation starts (UC-024, step 1).", evidence: [[SELF, "TST-1062016"]] },
  "4b-read-once": { uc: "The card is read once, when the page is drawn, and its build is not kept current while the page is shown. Reloading the page reads it", evidence: [[SELF, "TST-1062018"]] },
  "post-nothing-written": { uc: "Nothing was written; everything shown was derived at the moment it was shown.", evidence: [[SELF, "TST-1062019"]] },
};
const FLOW_FINDINGS = {
  "main-3-none-is-stored": { uc: "none is stored.", finding: "UC046-S1", file: SELF, test: "TST-1062009" },
  "main-4-moves-to-done": { uc: "a step or an item moves on to *done* when its pull request is merged.", finding: "UC046-S2", file: SELF, test: "TST-1062012" },
  "4a-jobs-not-shown": { uc: "The card says that jobs running there are not shown (UC-036).", finding: "UC046-S3", file: SELF, test: "TST-1062017" },
};

// TST-1062001 · level: system · module: system
// guards: UC-046
// given: UC-046 as committed text, the executable tests named in FLOW_EVIDENCE and the findings named in FLOW_FINDINGS
// input: compare every passage of the main flow and of the alternative flows 3a, 3b, 3c, 4a and 4b with its executable evidence or its finding
// expect: every named passage stands in UC-046; every evidence file exists and contains its TST id; every finding's test stands in its file with the todo naming the finding; every alternative flow UC-046 names is among the passages; known positive — UC-046 names exactly the alternative flows 3a, 3b, 3c, 4a and 4b
// Planted fault: a passage of UC-046 reworded (docs/use-cases/UC-046-see-what-goes-on-in-the-instance.md saying "all is stored." for "none is stored.") fails the case at the passage main-3-none-is-stored.
test("TST-1062001: UC-046 system coverage names the main flow and every alternative flow", () => {
  const uc = read(UC).replace(/\s+/g, " ");
  for (const [flow, { uc: needle, evidence }] of Object.entries(FLOW_EVIDENCE)) {
    assert.ok(uc.includes(needle.replace(/\s+/g, " ")), `${flow}: UC-046 contains ${needle}`);
    assert.ok(evidence.length > 0, `${flow}: evidence is named`);
    for (const [file, id] of evidence) {
      assert.ok(exists(file), `${flow}: evidence file exists: ${file}`);
      assert.ok(read(file).includes(`// ${id} `), `${flow}: ${file} contains ${id}`);
    }
  }
  for (const [flow, { uc: needle, finding, file, test: id }] of Object.entries(FLOW_FINDINGS)) {
    assert.ok(uc.includes(needle.replace(/\s+/g, " ")), `${flow}: UC-046 contains ${needle}`);
    assert.ok(exists(file), `${flow}: ${file} exists`);
    assert.ok(read(file).includes(`// ${id} `), `${flow}: ${id} stands in ${file}`);
    assert.ok(read(file).includes(`todo: "FINDING ${finding} `), `${flow}: the todo of ${id} names FINDING ${finding}`);
  }
  const named = [...uc.matchAll(/\*\*(\d[a-z])\. /g)].map((m) => m[1]).sort();
  assert.deepEqual(named, ["3a", "3b", "3c", "4a", "4b"], "known positive: UC-046 names these five alternative flows");
  const walked = new Set([...Object.keys(FLOW_EVIDENCE), ...Object.keys(FLOW_FINDINGS)].map((key) => key.slice(0, 2)));
  assert.deepEqual(named.filter((flow) => !walked.has(flow)), [], "each alternative flow is among the passages");
  const steps = ["main-1", "main-2", "main-3", "main-4", "main-5"];
  assert.deepEqual(steps.filter((step) => ![...walked, ...Object.keys(FLOW_EVIDENCE), ...Object.keys(FLOW_FINDINGS)].some((key) => key.startsWith(step))), [], "each step of the main flow is among the passages");
});

// ---------------------------------------------------------------- the world of the cases

const JOB = "JOB-20261016-1000-ffff";
const RUNNING = runningJob({ id: JOB, by: "lab-pc-4" });
const encoded = encodeURIComponent(PRODUCT_URL);
const STAGES = ["Requirements", "Use cases", "Architecture", "Implementation", "Tests", "Release"];
const ENTRIES = ["requirements", "use-cases", "architecture", "implementation", "tests", "releases", "maintenance", "settings"];
const LABELS = ["Requirements", "Use cases", "Architecture", "Implementation", "Tests", "Releases", "Maintenance", "Settings"];

let page = null;
afterEach(() => {
  page?.stop();
  page = null;
});
// Starts the page; the page of an earlier start in the same case is ended first.
async function open(options) {
  page?.stop();
  page = await startMain(options);
  return page;
}
// The product alice/product of tests/uc-046-harness.mjs' shelf and the instance holding the process model it declares.
const world = async (shelfOptions = {}) => ({ [PRODUCT]: await shelf(shelfOptions), [INSTANCE]: instanceWithModel() });
const firstCard = () => cardsOf(page.route)[0];
// What the browser's localStorage holds: its keys, and each value.
const storage = () => Object.fromEntries([...Array(globalThis.localStorage.length).keys()].map((at) => globalThis.localStorage.key(at)).map((key) => [key, globalThis.localStorage.getItem(key)]));
// The keys of the settings the harness gives the browser: its products, the instance's token, the product's token and two Bridges, under the instance's prefix.
const GIVEN_KEYS = ["products", "github-token", `github-token:${PRODUCT}`, "bridge:lab-pc-4", "bridge:lab-pc-5"].map((key) => `agent-m:alice/agent-m:${key}`).sort();
// The requests to GitHub's API that write: every request of the fake that is not a read — a GET, or the batch of reads, a POST to /graphql.
const writes = () => page.net.server.log.filter((entry) => !/^GET /.test(entry.what) && entry.what !== "POST /graphql").map((entry) => entry.what);
const hrefs = (card) => find(card, (node) => node.localName === "a" && node.className === "stage-link").map((link) => link.getAttribute("href"));

// An overview as the workflow stores it for `commit`, with stages that no derivation from the shelf's files gives.
const STORED = (commit, over = {}) => JSON.stringify({ commit, waiting: [], shares: [
  { stage: "Requirements", share: 1, detail: "stored requirements" }, { stage: "Use cases", share: 0.25, detail: "stored use cases" }, { stage: "Architecture", share: 0, detail: "stored architecture" },
  { stage: "Implementation", share: 0.5, detail: "stored implementation" }, { stage: "Tests", share: null, detail: "stored tests" }, { stage: "Release", share: 0, detail: "stored release" }],
  model: "fixture-scrum-wip", build: { states: [], records: [] }, queues: [], ...over });

// ---------------------------------------------------------------- step 1: the greeting

// TST-1062002 · level: system · module: system
// guards: UC-046; THE MAIN PAGE SHOWS WHAT GOES ON IN THE INSTANCE; EVERY STEP EXPLAINS ITSELF
// given: the instance alice/agent-m, whose site is served from the root of its repository (index.html), and a browser that keeps the product alice/product
// input: the visitor opens the instance's address: index.html loads src/site-frame/start.mjs with data-page="main" and data-views="main-page"
// expect: known positive — the script tag of index.html names the entry src/site-frame/start.mjs with data-page="main" and data-views="main-page"; the header holds the logo of the Pattern Recognition Lab (an image with that text alternative, whose file exists) and the name Agent M; the route area holds a greeting whose heading is "Welcome to Agent M", one sentence that Agent M is requirements-driven software engineering with people and agents, a sentence on what to do first (start with the requirements and the use cases, then add the repository of a product), the link "Review the use cases" to docs/index.html#use-cases, and a folded "What is this?" with an explanation in it
// Planted fault: the greeting not drawn (`greeting` left out of target.replaceChildren in src/main-page/home.mjs) leaves no heading, and the case fails at "Welcome to Agent M".
test("TST-1062002: UC-046 1 the visitor opens the instance's address and is greeted: the lab's logo, Agent M's name, what Agent M is, what to do first, a folded What is this?", async () => {
  const html = read("index.html");
  assert.match(html, /<script type="module" src="src\/site-frame\/start\.mjs" data-page="main" data-views="main-page"><\/script>/, "known positive: the root entry starts the main page");
  await open({ repos: await world() });
  const logo = find(page.body, (node) => node.localName === "img")[0];
  assert.equal(logo.getAttribute("alt"), "Pattern Recognition Lab");
  assert.ok(existsSync(fileURLToPath(logo.getAttribute("src"))), "the logo's file exists");
  assert.equal(byClass(page.body, "name")[0].textContent, "Agent M");
  const greeting = byClass(page.route, "greeting")[0];
  assert.equal(find(greeting, (node) => node.localName === "h1")[0].textContent, "Welcome to Agent M");
  assert.match(byClass(greeting, "lead")[0].textContent, /^Agent M is requirements-driven software engineering with people and agents:/);
  assert.match(byClass(greeting, "first")[0].textContent, /^Start with the requirements and the use cases: each is reviewed and accepted on its own page\. Then add the repository of a product you build\.$/);
  const review = find(greeting, (node) => node.localName === "a" && node.textContent === "Review the use cases");
  assert.deepEqual(review.map((link) => link.getAttribute("href")), ["docs/index.html#use-cases"]);
  const [fold, ...more] = byClass(greeting, "explain");
  assert.equal(more.length, 0, "one folded explanation");
  assert.equal(fold.localName, "details");
  assert.equal(fold.getAttribute("open"), null, "folded");
  assert.equal(find(fold, (node) => node.localName === "summary")[0].textContent, "What is this?");
  assert.match(fold.children[1].innerHTML, /This page shows where each product of this instance stands on its way through the process: one bar of six stages/, "an explanation stands in it");
});

// ---------------------------------------------------------------- step 2: the menu

// TST-1062003 · level: system · module: system
// guards: UC-046; THE MENU FOLLOWS THE PROCESS
// given: the page of TST-1062002, whose browser keeps no product chosen
// input: the visitor reads the menu; the button that folds it is clicked, then clicked again
// expect: the menu has eight entries, in this order, Requirements, Use cases, Architecture, Implementation, Tests, Releases, Maintenance, Settings, each a link to docs/index.html# and the entry's name (requirements, use-cases, architecture, implementation, tests, releases, maintenance, settings); beside it one button named Menu that controls the menu and says it is folded (aria-expanded "false"); a click says it is unfolded ("true"), a second click folded again ("false"); counter-proof — a menu in the order of the stages with two swapped is not this menu
// Planted fault: two entries of the menu swapped (the entries Tests and Releases in ENTRIES of src/site-frame/menu.mjs) fails the case at the order of the eight entries.
test("TST-1062003: UC-046 2 the menu leads through the process in its order, eight entries each opening the page under docs/, folded behind one button", async () => {
  await open({ repos: await world() });
  const entries = page.menu.children;
  assert.deepEqual(entries.map((entry) => entry.textContent), LABELS);
  assert.deepEqual(entries.map((entry) => entry.getAttribute("data-entry")), ENTRIES);
  assert.deepEqual(entries.map((entry) => entry.getAttribute("href")), ENTRIES.map((entry) => `docs/index.html#${entry}`));
  const swapped = [...LABELS];
  [swapped[4], swapped[5]] = [swapped[5], swapped[4]];
  assert.notDeepEqual(entries.map((entry) => entry.textContent), swapped, "counter-proof: two swapped stages are another menu");
  const [button, ...more] = find(page.body, (node) => node.localName === "button" && node.className.split(/\s+/).includes("menu-button"));
  assert.equal(more.length, 0, "one button");
  assert.equal(button.textContent.replace(/\s+/g, " ").trim().replace(/^\S+ /, ""), "Menu");
  assert.equal(button.getAttribute("aria-controls"), page.menu.getAttribute("id"));
  assert.equal(button.getAttribute("aria-expanded"), "false");
  click(button);
  assert.equal(button.getAttribute("aria-expanded"), "true", "a click unfolds");
  click(button);
  assert.equal(button.getAttribute("aria-expanded"), "false", "a second click folds again");
});

// TST-1062004 · level: system · module: system
// guards: UC-046; THE MENU FOLLOWS THE PROCESS
// given: a browser that keeps the product alice/product; the page of TST-1062003 on the instance
// input: the product selector in the header offers the instance, the product and + Add product; the visitor chooses the product, then the instance again
// expect: the selector's options read, in this order, alice/agent-m, https://github.com/alice/product and + Add product; with the product chosen the fragment reads #home/product=<the product's address, percent-encoded> and each of the eight entries opens docs/index.html#<entry>/product=<the address, encoded>; the instance chosen again, the fragment reads #home and the entries open docs/index.html#<entry> as before
// Planted fault: the menu drawn for no product (`menuOf(page, [...served], product)` replaced by `menuOf(page, [...served], null)` in drawMenu of src/site-frame/index.mjs) leaves the entries without /product= and fails the case at the chosen product's entries.
test("TST-1062004: UC-046 2 each entry opens the page under docs/ for the product chosen", async () => {
  await open({ repos: await world() });
  assert.deepEqual(page.selector.children.map((option) => option.textContent), ["alice/agent-m", PRODUCT_URL, "+ Add product"]);
  page.selector.value = PRODUCT_URL;
  page.selector.dispatchEvent(new Event("change"));
  assert.equal(page.location.hash, `#home/product=${encoded}`);
  await page.follow();
  assert.deepEqual(page.menu.children.map((entry) => entry.getAttribute("href")), ENTRIES.map((entry) => `docs/index.html#${entry}/product=${encoded}`));
  page.selector.value = "";
  page.selector.dispatchEvent(new Event("change"));
  assert.equal(page.location.hash, "#home");
  await page.follow();
  assert.deepEqual(page.menu.children.map((entry) => entry.getAttribute("href")), ENTRIES.map((entry) => `docs/index.html#${entry}`));
});

// ---------------------------------------------------------------- step 3: one card per product

// TST-1062005 · level: system · module: system
// guards: UC-046; THE MAIN PAGE SHOWS EACH PRODUCT'S PROGRESS BY STAGE; THE MAIN PAGE SHOWS WHAT GOES ON IN THE INSTANCE
// given: a browser that keeps alice/product, which declares a process model, and bob/other, which declares none, each with a token of its own; the product's use cases are accepted three of four
// input: the page opened
// expect: two cards, in the order the products are kept and none for Agent M itself; the first named alice/product with its address github.com/alice/product, "Developed with fixture-scrum-wip" and a bar of six stages in the order Requirements, Use cases, Architecture, Implementation, Tests, Release, the stage Use cases marked as the one the product is in; the second named bob/other with "Its process is chosen when implementation starts"; the nth stage of each card links to the menu's nth entry for that card's product: docs/index.html#<entry>/product=<the card's address, encoded>; known positive — each card has six stages
// Planted fault: the stage link written without the card's product (`menuOf("main", [], own ? null : address)` replaced by `menuOf("main", [], null)` in productCard of src/main-page/cards.mjs) leaves the stage links without /product= and fails the case at the first card's links.
test("TST-1062005: UC-046 3 the page draws one card per product this browser keeps: its name, its process model, a bar of six stages, the stage it is in marked, each stage a link for the product", async () => {
  await open({ repos: { ...(await world()), [OTHER]: smallProduct() }, products: [PRODUCT_URL, OTHER_URL], tokens: { [PRODUCT]: PRODUCT_TOKEN, [OTHER]: OTHER_TOKEN } });
  const cards = cardsOf(page.route);
  assert.deepEqual(cards.map((card) => card.getAttribute("data-card")), [PRODUCT_URL, OTHER_URL]);
  assert.deepEqual(cards.map((card) => byClass(card, "card-head")[0].children[0].textContent), ["alice/product", "bob/other"]);
  assert.deepEqual(cards.map((card) => stagesOf(card).length), [6, 6], "known positive: six stages each");
  for (const card of cards) assert.deepEqual(stagesOf(card).map(([stage]) => stage), STAGES);
  assert.deepEqual(byClass(cards[0], "card-repo").map((link) => link.textContent), ["github.com/alice/product"]);
  assert.deepEqual(cards.map((card) => byClass(card, "card-model")[0].textContent), ["Developed with fixture-scrum-wip", "Its process is chosen when implementation starts"]);
  assert.deepEqual(currentOf(cards[0]), ["Use cases"]);
  const address = (card) => encodeURIComponent(card.getAttribute("data-card"));
  for (const card of cards) assert.deepEqual(hrefs(card), ENTRIES.slice(0, 6).map((entry) => `docs/index.html#${entry}/product=${address(card)}`));
});

// TST-1062006 · level: system · module: system
// guards: UC-046; THE MAIN PAGE SHOWS EACH PRODUCT'S PROGRESS BY STAGE; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the product alice/product with a declared model, three of its four use cases accepted, one of its two module files accepted, one of its two backlog items done (its pull request merged) and the other in progress, a passing test that guards one of its two requirements and no release tag; its branch overview-cache holds nothing
// input: the page opened; the fourth use case then accepted in the repository and the page loaded again
// expect: the six stages read Requirements 100 % (2 requirements, no change open), Use cases 75 % (3 of 4 accepted), Architecture 50 % (1 of 2 files accepted), Implementation 50 % (1 of 2 items done), Tests 50 % (1 of 2 requirements guarded by a passing test), Release 0 % (no release yet), and Use cases is the stage the product is in; loaded again, Use cases reads 100 % (4 of 4 accepted) and Architecture is the stage the product is in; the browser's localStorage holds the settings it was given and nothing more, in both loads
// Planted fault: the Use cases share taken from a count held in the browser (`accepted / files.length` replaced by a constant in acceptedStage of src/progress-measures/stages.mjs) leaves 75 % after the repository changed, and the case fails at the second load.
test("TST-1062006: UC-046 3 every share is derived from the product's repository when the page is shown: accepting a use case moves its stage, and nothing is stored", async () => {
  const merged = { [PRODUCT]: [pullOf(8, "ITM-0901", { merged: "2026-10-16T11:00:00Z" })] };
  const options = async (useCases) => ({ repos: await world({ useCases, jobs: [RUNNING] }), bridgeLists: JOB, pulls: merged, results: { [PRODUCT]: "passed" } });
  await open(await options(3));
  assert.deepEqual(stagesOf(firstCard()), [
    ["Requirements", "100 %", "2 requirements, no change open"], ["Use cases", "75 %", "3 of 4 accepted"], ["Architecture", "50 %", "1 of 2 files accepted"],
    ["Implementation", "50 %", "1 of 2 items done"], ["Tests", "50 %", "1 of 2 requirements guarded by a passing test"], ["Release", "0 %", "no release yet"]]);
  assert.deepEqual(currentOf(firstCard()), ["Use cases"]);
  const settings = storage();
  assert.deepEqual(Object.keys(settings).sort(), GIVEN_KEYS, "the page stored nothing");
  await open(await options(4));
  assert.deepEqual(stagesOf(firstCard())[1], ["Use cases", "100 %", "4 of 4 accepted"]);
  assert.deepEqual(currentOf(firstCard()), ["Architecture"]);
  assert.deepEqual(storage(), settings, "nor in the second load");
});

// TST-1062007 · level: system · module: system
// guards: UC-046; THE MAIN PAGE SHOWS EACH PRODUCT'S PROGRESS BY STAGE
// given: the product alice/product of TST-1062006 with, in turn, a change of its SPEC open in a queue; its only test failing; a candidate tag v2026.1.0-rc1 and no release tag; and the tag v2026.1.0
// input: the page opened for each
// expect: with a change open Requirements reads 0 % (1 change open) and is the stage the product is in; with the test failing Tests reads 0 % (0 of 2 requirements guarded by a passing test), counter-proof to its passing at 50 %; with a candidate tag Release reads 0 % (no release yet) and with the tag v2026.1.0 it reads 100 % (v2026.1.0 tagged)
// Planted fault: a candidate tag counted as a release (the pattern `RELEASE_TAG` of src/progress-measures/stages.mjs without its `$`) fails the case at Release 0 % with the candidate tag.
test("TST-1062007: UC-046 3 the stages follow the table: an open change, a failing test, a candidate tag and a release tag each give the share the table names", async () => {
  await open({ repos: await world({ queue: true }) });
  assert.deepEqual(stagesOf(firstCard())[0], ["Requirements", "0 %", "1 change open"]);
  assert.deepEqual(currentOf(firstCard()), ["Requirements"]);
  await open({ repos: await world(), results: { [PRODUCT]: "failed" } });
  assert.deepEqual(stagesOf(firstCard())[4], ["Tests", "0 %", "0 of 2 requirements guarded by a passing test"]);
  await open({ repos: await world(), results: { [PRODUCT]: "passed" } });
  assert.deepEqual(stagesOf(firstCard())[4], ["Tests", "50 %", "1 of 2 requirements guarded by a passing test"], "counter-proof: the same test passing");
  await open({ repos: await world(), tags: { [PRODUCT]: ["v2026.1.0-rc1"] } });
  assert.deepEqual(stagesOf(firstCard())[5], ["Release", "0 %", "no release yet"]);
  await open({ repos: await world(), tags: { [PRODUCT]: ["v2026.1.0-rc1", "v2026.1.0"] } });
  assert.deepEqual(stagesOf(firstCard())[5], ["Release", "100 %", "v2026.1.0 tagged"]);
});

// TST-1062008 · level: system · module: system
// guards: UC-046; THE MAIN PAGE SHOWS EACH PRODUCT'S PROGRESS BY STAGE; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the product alice/product whose branch overview-cache holds the overview of its head (six stored stages, ITM-0900 in progress with the job JOB-20261016-1000-ffff and that job's record); then a product whose branch holds only the overview stored last, of the commit aaaaaaa…
// input: the page opened for each
// expect: the card shows the six stored stages ("Use cases 25 % stored use cases", …) and the build row ITM-0900, JOB-20261016-1000-ffff, dev-cli, running, 2h 0m 0s; the page asked the product for its repository, the commit and tree of its default branch and that overview, and nothing else (no file, no batch but greenToMerge's GraphQL request beside the repository, which reads no file — ITM-1170 —, no pull requests, no tags, no CI runs); known positive — requests to the product were made; for the overview stored last, the card shows the same stages and says "As of aaaaaaa: the overview of the newest commit is being stored.", after two requests more (latest.json and the overview it names); for a product whose branch holds none the card is derived from the files (Use cases 75 %) and the page read files and the pull requests of the product
// Planted fault: the overview ignored (the three `stored ?` of cardOf in src/main-page/home.mjs replaced by `false ?`) derives the card from the files, and the case fails at the stored stages and at the files read.
test("TST-1062008: UC-046 3 a card is drawn from the overview the workflow stored for the head, or the one stored last, and reads nothing else of the product", async () => {
  const commit = headOf(PRODUCT), last = "a".repeat(40);
  const build = { states: [{ item: "ITM-0900", state: "in progress", reason: `job ${JOB} is running`, job: JOB, pullRequest: null }], records: [{ path: RUNNING.path, text: RUNNING.text }] };
  // What the page asked of alice/product: the paths of the API below the repository, and how many files it read from the raw host or by the batch query with the product's token.
  const asked = () => ({
    api: page.net.requests.map((request) => new URL(request.url)).filter((url) => url.host === "api.github.com" && url.pathname.startsWith("/repos/alice/product")).map((url) => url.pathname.slice("/repos/alice/product".length)),
    files: page.net.requests.filter((request) => request.url.includes("raw.githubusercontent.com/alice/product/") || (request.url.endsWith("/graphql") && request.authorization === `Bearer ${PRODUCT_TOKEN}`)).length,
  });
  const STORED_STAGES = [["Requirements", "100 %", "stored requirements"], ["Use cases", "25 %", "stored use cases"], ["Architecture", "0 %", "stored architecture"], ["Implementation", "50 %", "stored implementation"],
    ["Tests", "?", "stored tests"], ["Release", "0 %", "stored release"]];
  await open({ repos: await world({ jobs: [RUNNING] }), bridgeLists: JOB, overviews: { [PRODUCT]: { [commit]: STORED(commit, { build }) } } });
  assert.ok(asked().api.length > 0, "known positive: the count sees the requests to the product");
  assert.deepEqual(stagesOf(firstCard()), STORED_STAGES);
  assert.deepEqual(buildOf(firstCard()), [["ITM-0900", JOB, "dev-cli", "running", "2h 0m 0s"]]);
  // ITM-1170: `files` counts every POST /graphql with the product's token; the one is greenToMerge's beside the repository, which reads no file.
  assert.deepEqual(asked(), { api: ["", "/commits/main", `/git/trees/${commit}`, `/contents/${commit}.json`], files: 1 }, "the repository, its commit and tree and the overview: no pull request and no file");
  assert.equal(byClass(firstCard(), "card-as-of").length, 0);
  await open({ repos: await world({ jobs: [RUNNING] }), bridgeLists: JOB, overviews: { [PRODUCT]: { [last]: STORED(last, { build }), latest: `${JSON.stringify({ commit: last })}\n` } } });
  assert.deepEqual(stagesOf(firstCard()), STORED_STAGES);
  assert.deepEqual(byClass(firstCard(), "card-as-of").map((node) => node.textContent), ["As of aaaaaaa: the overview of the newest commit is being stored."]);
  assert.deepEqual(asked(), { api: ["", "/commits/main", `/git/trees/${commit}`, `/contents/${commit}.json`, "/contents/latest.json", `/contents/${last}.json`], files: 1 }, "and two requests more: latest.json and the overview it names");
  await open({ repos: await world({ jobs: [RUNNING] }), bridgeLists: JOB });
  assert.deepEqual(stagesOf(firstCard())[1], ["Use cases", "75 %", "3 of 4 accepted"], "a branch that holds none: the card is derived from the files");
  assert.ok(asked().files > 0 && asked().api.includes("/pulls"), "and the files and the pull requests are read");
});

// TST-1062009 · level: system · module: system
// guards: UC-046; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the product alice/product of TST-1062006 (three of four use cases accepted: 75 %), whose branch overview-cache holds, for its head, an overview that says the use cases are 25 % accepted
// input: the page opened
// expect: known positive first — with no overview the card reads Use cases 75 % (3 of 4 accepted); UC-046 step 3 says every share is derived when the page is shown, from the product's repository and its records, and none is stored: with the overview present the card reads Use cases 75 % (3 of 4 accepted), derived from the files, and not the stored 25 %.
// FINDING: the card is drawn from the stored overview alone (src/main-page/home.mjs cardOf → storedFor → stored.shares), so it reads 25 % (stored use cases)
// Counter-proof: a page that derives the card from the files even where an overview is stored (the three `stored ?` of cardOf in src/main-page/home.mjs replaced by `false ?`) passes the case.
test("TST-1062009: UC-046 3 a share is derived when the page is shown, not read from a stored file",
  { todo: "FINDING UC046-S1 — src/main-page/home.mjs (cardOf: `const shares = stored ? stored.shares : await stageShares(facts)`) draws the six shares of a card from the overview the workflow stored on the branch overview-cache for the head (MOD-main-page, Interfaces: home: \"the page never derives what the workflow computes\"), so UC-046 step 3, \"Every share is derived when the page is shown, from the product's repository and its records; none is stored.\", is not what the page does; the accepted architecture and the page agree, the use case does not — for the Product Owner and akmaier" }, async () => {
  await open({ repos: await world() });
  assert.deepEqual(stagesOf(firstCard())[1], ["Use cases", "75 %", "3 of 4 accepted"], "known positive: derived from the files");
  const commit = headOf(PRODUCT);
  await open({ repos: await world(), overviews: { [PRODUCT]: { [commit]: STORED(commit) } } });
  assert.deepEqual(stagesOf(firstCard())[1], ["Use cases", "75 %", "3 of 4 accepted"], "derived from the files, not the stored 25 %");
});

// ---------------------------------------------------------------- step 4: the build

// TST-1062010 · level: system · module: system
// guards: UC-046; THE BUILD IS SHOWN AS IT HAPPENS
// given: the product alice/product, in implementation: ITM-0900 is worked on by the job JOB-20261016-1000-ffff of the participant dev-cli, which the Bridge lab-pc-4 lists as running since 10:00 UTC, and ITM-0901 is done (its pull request merged); the clock stands at 12:00 UTC; and a product with no job
// input: the page opened for each
// expect: the first card holds a section "The build" with one row, the step ITM-0900, the job JOB-20261016-1000-ffff, the participant dev-cli, the state running and the elapsed time 2h 0m 0s; ITM-0901, which is done, is not listed; the card of the product with no job holds no "The build"
// Planted fault: the job's participant left out (`participant: row.record.participant` replaced by `participant: null` in buildInProgress of src/progress-measures/stored.mjs) fails the case at the row's participant, which reads "participant not named".
test("TST-1062010: UC-046 4 for a product in implementation the card shows the items in progress, each with the job working on it, its participant, its state and its elapsed time", async () => {
  await open({ repos: await world({ jobs: [RUNNING] }), bridgeLists: JOB, pulls: { [PRODUCT]: [pullOf(8, "ITM-0901", { merged: "2026-10-16T11:00:00Z" })] } });
  assert.deepEqual(buildOf(firstCard()), [["ITM-0900", JOB, "dev-cli", "running", "2h 0m 0s"]]);
  assert.deepEqual(byClass(firstCard(), "build").map((section) => section.children[0].textContent), ["The build"]);
  await open({ repos: await world() });
  assert.deepEqual(buildOf(firstCard()), []);
  assert.deepEqual(byClass(firstCard(), "build"), [], "counter-proof: a product with no job in progress has no build");
});

// TST-1062011 · level: system · module: system
// guards: UC-046; THE BUILD IS SHOWN AS IT HAPPENS; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the page of TST-1062010 with its token for the product; known positive first — the page set one timer of a minute for reading the jobs' states again
// input: the timer fires a minute later; then the Bridge no longer lists the job; then the job's record in the repository ends as done
// expect: after a minute the row reads running, 2h 1m 0s; when the Bridge no longer lists the job, ended without record, 0h 0m 0s; when the record ends as done, done, 1h 0m 0s; the stages stay as drawn, and the next reading is set (one timer held)
// Planted fault: the readings not made (`readAgain({ target, cards, nodes, held, store })` left out at the end of render in src/main-page/home.mjs) sets no timer and fails the case at the known positive.
test("TST-1062011: UC-046 4 the page keeps the build current while it is shown: the elapsed time, the runtime's state and the job's record move the row", async () => {
  await open({ repos: await world({ jobs: [RUNNING] }), bridgeLists: JOB });
  assert.equal(timers.waiting.length, 1, "known positive: one timer of a minute");
  const stages = stagesOf(firstCard());
  await page.fire(NOW + 60000);
  assert.deepEqual(buildOf(firstCard()), [["ITM-0900", JOB, "dev-cli", "running", "2h 1m 0s"]]);
  page.net.bridgeLists = null;
  await page.fire(NOW + 120000);
  assert.deepEqual(buildOf(firstCard()), [["ITM-0900", JOB, "dev-cli", "ended without record", "0h 0m 0s"]]);
  page.change(PRODUCT, await shelf({ jobs: [endedJob({ id: JOB, by: "lab-pc-4", state: "done" })] }));
  await page.fire(NOW + 180000);
  assert.deepEqual(buildOf(firstCard()), [["ITM-0900", JOB, "dev-cli", "done", "1h 0m 0s"]]);
  assert.deepEqual(stagesOf(firstCard()), stages, "the stages stay as drawn");
  assert.equal(timers.waiting.length, 1, "the next reading is set");
});

// TST-1062012 · level: system · module: system
// guards: UC-046; THE BUILD IS SHOWN AS IT HAPPENS
// given: the page of TST-1062011 drawn with ITM-0900 in progress, its job running and its pull request open; known positive first — a page loaded after the pull request is merged and the job's record ended lists no step in progress
// input: the pull request of ITM-0900 is merged and the job's record ends as done while the page is shown; the page reads the jobs' states again
// expect: known positive — the freshly loaded page lists no step; UC-046 step 4 says a step moves on to done when its pull request is merged, while the page keeps the build current: the page shown lists no step in progress after its next reading.
// FINDING: the page shown still lists ITM-0900 (state done), since a reading reads the jobs' records and nothing else
// Counter-proof: a page whose readings drop a step whose job has ended (`buildInProgress(card.entry.facts)` followed by `.filter((row) => row.state !== 'done')` in tick of src/main-page/reread.mjs, a stand-in for asking the pull requests) passes the case.
test("TST-1062012: UC-046 4 a step moves on to done when its pull request is merged, while the page is shown",
  { todo: "FINDING UC046-S2 — src/main-page/reread.mjs (jobsAgain: the reading lists the records of the jobs the card was drawn with; tick: `buildInProgress(card.entry.facts)` over `plan.states` as drawn) never asks a pull request, so the step whose pull request is merged stays in the build, with its job's state, until the page is loaded again; MOD-main-page, Data: \"the records of the jobs the cards were drawn with, and nothing else\" says so, UC-046 step 4 says the step moves on to done — for the Product Owner and akmaier" }, async () => {
  const pulls = { [PRODUCT]: [pullOf(7, "ITM-0900")] };
  const merged = pullOf(7, "ITM-0900", { merged: "2026-10-16T12:00:30Z" });
  const ended = endedJob({ id: JOB, by: "lab-pc-4", state: "done" });
  await open({ repos: await world({ jobs: [ended] }), pulls: { [PRODUCT]: [merged] } });
  assert.deepEqual(buildOf(firstCard()), [], "known positive: a page loaded after the merge lists no step in progress");
  await open({ repos: await world({ jobs: [RUNNING] }), bridgeLists: JOB, pulls });
  assert.deepEqual(buildOf(firstCard()).map((row) => row[0]), ["ITM-0900"], "drawn with its pull request open the step is in the build");
  pulls[PRODUCT] = [merged];
  page.net.bridgeLists = null;
  page.change(PRODUCT, await shelf({ jobs: [ended] }));
  await page.fire(NOW + 60000);
  assert.deepEqual(buildOf(firstCard()), [], "the merged step has moved on");
});

// ---------------------------------------------------------------- step 5: Jobs

// TST-1062013 · level: system · module: system
// guards: UC-046; ONE DASHBOARD SHOWS EVERY JOB
// given: the product alice/product with its fourth use case open, so that one use case waits for a person
// input: the visitor reads the main page; presses the link Jobs; the page draws the route the fragment names; then presses Open beside what waits
// expect: the main page holds one button "Jobs" below the cards and no list of what waits (no section of what waits, no waiting item); pressing it writes the fragment #jobs; the route drawn is headed "Every job" and begins with "What waits for a person", which names the use case UC-004 with its product alice/product; Open beside it writes the address https://alice.github.io/agent-m/docs/index.html#use-case/id=UC-004/product=<the address, encoded>, the page where it is decided
// Planted fault: the main page drawing a list of what waits (`el("section", "waits")` added to the children of the route in render of src/main-page/home.mjs) fails the case at "no list of what waits".
test("TST-1062013: UC-046 5 the link Jobs opens the page of every job and of what waits for a person; the main page itself lists nothing that waits", async () => {
  await open({ repos: await world() });
  assert.deepEqual(waitsOf(page.route), [], "no waiting item on the main page");
  assert.deepEqual(byClass(page.route, "waits"), [], "and no list of it");
  const [jobs, ...more] = byClass(page.route, "jobs-link");
  assert.equal(more.length, 0, "one link");
  assert.equal(jobs.textContent, "Jobs");
  click(jobs);
  assert.equal(page.location.hash, "#jobs");
  await page.follow();
  assert.equal(find(page.route, (node) => node.localName === "h2")[0].textContent, "Every job");
  assert.deepEqual(waitsOf(page.route), ["use case: UC-004 · alice/product"]);
  assert.equal(byClass(page.route, "waits")[0].children[0].textContent, "What waits for a person");
  click(byClass(page.route, "wait-link")[0]);
  assert.equal(page.location.href, `https://alice.github.io/agent-m/docs/index.html#use-case/id=UC-004/product=${encoded}`);
});

// ---------------------------------------------------------------- 3a: no product

// TST-1062014 · level: system · module: system
// guards: UC-046; WITHOUT A PRODUCT, THE MAIN PAGE SHOWS AGENT M'S OWN PROGRESS
// given: a browser that keeps no product; the instance alice/agent-m, with the files of the product of TST-1062006, and in turn no tag, the candidate tag v2026.1.0-rc1, and the tag v2026.1.0
// input: the page opened for each; then the same browser keeping alice/product
// expect: one card, named Agent M, with the address github.com/alice/agent-m and the six stages as the files give them (Use cases 75 %); beside it one button "+ Add product", which writes the address https://alice.github.io/agent-m/docs/index.html#add-product; with no tag or a candidate tag the bar is not full, with the tag v2026.1.0 all six stages read 100 %; counter-proof — with the product kept, the one card is alice/product's, there is no card for Agent M and no "+ Add product"
// Planted fault: Agent M's own bar not full at its release (`full` left false in stageShares of src/progress-measures/stages.mjs) fails the case at the six stages of 100 %.
test("TST-1062014: UC-046 3a with no product kept the page shows Agent M's own progress in the same bar, full once its first release is tagged, and + Add product beside it", async () => {
  const own = async () => ({ [INSTANCE]: await shelf({ declared: false }) });
  await open({ repos: await own(), products: [], tokens: {} });
  const [card, ...rest] = cardsOf(page.route);
  assert.equal(rest.length, 0, "one card");
  assert.equal(byClass(card, "card-head")[0].children[0].textContent, "Agent M");
  assert.deepEqual(byClass(card, "card-repo").map((link) => link.textContent), ["github.com/alice/agent-m"]);
  assert.deepEqual(stagesOf(card).map(([stage]) => stage), STAGES);
  assert.deepEqual(stagesOf(card)[1], ["Use cases", "75 %", "3 of 4 accepted"]);
  assert.notDeepEqual(stagesOf(card).map(([, share]) => share), Array(6).fill("100 %"), "with no tag the bar is not full");
  const [add, ...more] = byClass(page.route, "add-product");
  assert.equal(more.length, 0);
  assert.equal(add.textContent, "+ Add product");
  click(add);
  assert.equal(page.location.href, "https://alice.github.io/agent-m/docs/index.html#add-product");
  await open({ repos: await own(), products: [], tokens: {}, tags: { [INSTANCE]: ["v2026.1.0-rc1"] } });
  assert.notDeepEqual(stagesOf(firstCard()).map(([, share]) => share), Array(6).fill("100 %"), "a candidate is no release");
  await open({ repos: await own(), products: [], tokens: {}, tags: { [INSTANCE]: ["v2026.1.0"] } });
  assert.deepEqual(stagesOf(firstCard()).map(([, share]) => share), Array(6).fill("100 %"), "full once the first release is tagged");
  await open({ repos: { ...(await world()), ...(await own()) }, products: [PRODUCT_URL] });
  assert.deepEqual(cardsOf(page.route).map((one) => one.getAttribute("data-card")), [PRODUCT_URL], "counter-proof: with a product kept, its card");
  assert.deepEqual(byClass(page.route, "add-product"), []);
});

// ---------------------------------------------------------------- 3b: a repository cannot be read

// TST-1062015 · level: system · module: system
// guards: UC-046; THE MAIN PAGE SHOWS WHAT GOES ON IN THE INSTANCE
// given: a browser that keeps alice/product and carol/missing, a repository the server does not find (a private one, for which no token is stored); and a browser that keeps alice/product, whose server does not answer, and bob/other
// input: the page opened for each; the button of the unreadable card pressed
// expect: known positive — the card of alice/product in the first browser has its six stages and is no error card; carol/missing's card says "https://github.com/carol/missing was not found — a private repository is found only with a token that reaches it." and holds one button "Open the token's setting"; in the second browser alice/product's card says "https://api.github.com could not be reached: Failed to fetch" and bob/other's is drawn with its six stages; pressing the button writes the address https://alice.github.io/agent-m/docs/index.html#settings, the page of the settings
// Planted fault: the card of a repository that cannot be read left out (`errorCard` replaced by `readingCard` in cardOf's catch of src/main-page/home.mjs) fails the case at the reason of the card.
test("TST-1062015: UC-046 3b a repository that cannot be read has a card that says which reason and links the token's setting, and the other cards are shown", async () => {
  await open({ repos: { ...(await world()) }, products: [PRODUCT_URL, MISSING_URL], tokens: { [PRODUCT]: PRODUCT_TOKEN } });
  const [good, bad, ...rest] = cardsOf(page.route);
  assert.equal(rest.length, 0);
  assert.equal(good.className.includes("is-error"), false, "known positive");
  assert.equal(stagesOf(good).length, 6);
  assert.equal(bad.className.includes("is-error"), true);
  assert.deepEqual(byClass(bad, "warn").map((node) => node.textContent), [`${MISSING_URL} was not found — a private repository is found only with a token that reaches it.`]);
  const [setting, ...more] = byClass(bad, "token-setting");
  assert.equal(more.length, 0);
  assert.equal(setting.textContent, "Open the token's setting");
  click(setting);
  assert.equal(page.location.href, "https://alice.github.io/agent-m/docs/index.html#settings");
  await open({ repos: { ...(await world()), [OTHER]: smallProduct() }, products: [PRODUCT_URL, OTHER_URL], tokens: { [PRODUCT]: PRODUCT_TOKEN, [OTHER]: OTHER_TOKEN }, down: { [PRODUCT]: true } });
  const [silent, answering] = cardsOf(page.route);
  assert.equal(silent.className.includes("is-error"), true);
  assert.deepEqual(byClass(silent, "warn").map((node) => node.textContent), ["https://api.github.com could not be reached: Failed to fetch"]);
  assert.equal(byClass(silent, "token-setting").length, 1);
  assert.equal(answering.className.includes("is-error"), false);
  assert.equal(stagesOf(answering).length, 6);
});

// ---------------------------------------------------------------- 3c: no process model

// TST-1062016 · level: system · module: system
// guards: UC-046; THE MAIN PAGE SHOWS EACH PRODUCT'S PROGRESS BY STAGE
// given: the product bob/other, which has declared no process model, and alice/product, which has
// input: the page opened
// expect: bob/other's card says "Its process is chosen when implementation starts" and its Implementation stage has no share ("?") and says "the process is configured when implementation starts"; counter-proof — alice/product's card says "Developed with fixture-scrum-wip" and its Implementation stage reads 0 % (0 of 2 items done)
// Planted fault: the implementation stage given a share without a declared model (`facts.model === null` branch of implementationStage in src/progress-measures/stages.mjs removed) fails the case at the stage "?".
test("TST-1062016: UC-046 3c a product that has not declared its process model says that the process is configured when implementation starts", async () => {
  await open({ repos: { ...(await world()), [OTHER]: smallProduct() }, products: [OTHER_URL, PRODUCT_URL], tokens: { [PRODUCT]: PRODUCT_TOKEN, [OTHER]: OTHER_TOKEN } });
  const [undeclared, declared] = cardsOf(page.route);
  assert.deepEqual(stagesOf(undeclared)[3], ["Implementation", "?", "the process is configured when implementation starts"]);
  assert.equal(byClass(undeclared, "card-model")[0].textContent, "Its process is chosen when implementation starts");
  assert.equal(byClass(declared, "card-model")[0].textContent, "Developed with fixture-scrum-wip");
  assert.deepEqual(stagesOf(declared)[3], ["Implementation", "0 %", "0 of 2 items done"]);
});

// ---------------------------------------------------------------- 4a: a job's runtime cannot be reached

// TST-1062017 · level: system · module: system
// guards: UC-046; THE BUILD IS SHOWN AS IT HAPPENS
// given: the product alice/product, whose job JOB-20261016-1000-ffff works on ITM-0900 and is taken by the Bridge lab-pc-5, which refuses the connection (the Bridge of another machine); known positive first — the job is a row of the build
// input: the page opened
// expect: known positive — the build lists ITM-0900 with the job and the state its record gives (running); UC-046 4a says the card says that jobs running there are not shown: the card names the Bridge or says that jobs running there are not shown.
// FINDING: the card lists the job and marks the row "not reachable"; it says nothing of jobs not shown
// Counter-proof: a card that says "not reachable; jobs running there are not shown" beside the row (cards.mjs buildList, the text of the `not-reachable` span) passes the case.
test("TST-1062017: UC-046 4a the card says that jobs running on a runtime that cannot be reached are not shown",
  { todo: "FINDING UC046-S3 — src/main-page/cards.mjs (buildList: `if (!row.reachable) line.append(\" \", el(\"span\", \"not-reachable\", \"not reachable\"))`) lists the job of a runtime that does not answer with the state its record gives and the words \"not reachable\", as MOD-progress-measures' buildInProgress states it (\"a job whose runtime does not answer is listed as not reachable\"); UC-046 4a says the card says that jobs running there are not shown (UC-036 1a: \"it says that jobs there are not shown\") — for the Product Owner and akmaier" }, async () => {
  await open({ repos: await world({ jobs: [runningJob({ id: JOB, by: "lab-pc-5" })] }) });
  assert.deepEqual(buildOf(firstCard()).map((row) => [row[0], row[1], row[3]]), [["ITM-0900", JOB, "running"]], "known positive: the job is a row of the build");
  assert.match(firstCard().textContent, /jobs running (there|on lab-pc-5) are not shown/);
});

// ---------------------------------------------------------------- 4b: no token

// TST-1062018 · level: system · module: system
// guards: UC-046; THE BUILD IS SHOWN AS IT HAPPENS
// given: the product alice/product with a running job and no token stored for it; and Agent M's own card with no token stored for the instance; known positive — the same product with its token stored
// input: the page opened for each; the job's record in the repository ends as done and a minute passes; the page loaded again
// expect: known positive — with the token one timer of a minute is held; with no token for the product the card is drawn (ITM-0900 running, 2h 0m 0s) and no timer is set, and the page asks the product nothing more after it was drawn; the card still reads running; the page loaded again reads the repository again and the card reads done, 1h 0m 0s; Agent M's own card with no instance token is drawn and sets no timer
// Planted fault: the cards read again whether or not a token is stored (`entry?.source.tokenStored === true` replaced by `entry !== undefined` in readAgain of src/main-page/reread.mjs) sets a timer without the token and fails the case at "no timer".
test("TST-1062018: UC-046 4b a card whose repository this browser keeps no token for is read once, when the page is drawn; reloading the page reads it again", async () => {
  await open({ repos: await world({ jobs: [RUNNING] }), bridgeLists: JOB });
  assert.equal(timers.waiting.length, 1, "known positive: with the token one timer is held");
  await open({ repos: await world({ jobs: [RUNNING] }), bridgeLists: JOB, tokens: {} });
  assert.deepEqual(buildOf(firstCard()), [["ITM-0900", JOB, "dev-cli", "running", "2h 0m 0s"]]);
  assert.equal(timers.waiting.length, 0, "no timer is set");
  const toProduct = () => page.net.requests.filter((request) => request.url.includes("/repos/alice/product") || request.url.includes("alice/product/")).length;
  const asked = toProduct();
  page.change(PRODUCT, await shelf({ jobs: [endedJob({ id: JOB, by: "lab-pc-4", state: "done" })] }));
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.deepEqual(buildOf(firstCard()).map((row) => row[3]), ["running"], "the card still reads running");
  assert.equal(toProduct(), asked, "the product was asked nothing more");
  await open({ repos: await world({ jobs: [endedJob({ id: JOB, by: "lab-pc-4", state: "done" })] }), tokens: {} });
  assert.deepEqual(buildOf(firstCard()), [["ITM-0900", JOB, "dev-cli", "done", "1h 0m 0s"]], "reloaded, the card reads the repository again");
  await open({ repos: { [INSTANCE]: await shelf({ declared: false }) }, products: [], tokens: {}, instanceToken: null });
  assert.equal(cardsOf(page.route).length, 1);
  assert.equal(timers.waiting.length, 0, "Agent M's own card with no instance token is read once");
});

// ---------------------------------------------------------------- the postcondition

// TST-1062019 · level: system · module: system
// guards: UC-046; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the page of TST-1062006 with its job running
// input: the visitor opens the page, chooses the product, presses Jobs, and the page reads the jobs' states again
// expect: known positive — the fake GitHub answered reads (requests to alice/product were made); no request of the fake writes (every one is a read, a GET or the batch of reads, a POST to /graphql); the browser's localStorage holds the settings it was given and nothing more, none changed
// Planted fault: the page writing the card it drew (`localStorage.setItem` of the shares in cardOf of src/main-page/home.mjs) adds a key to localStorage and fails the case at "nothing more".
test("TST-1062019: UC-046 postcondition nothing was written: the page reads the repositories and the runtimes and stores nothing", async () => {
  await open({ repos: await world({ jobs: [RUNNING] }), bridgeLists: JOB });
  const settings = storage();
  page.selector.value = PRODUCT_URL;
  page.selector.dispatchEvent(new Event("change"));
  await page.follow();
  click(byClass(page.route, "jobs-link")[0]);
  await page.follow();
  await page.go("#home");
  await page.fire(NOW + 60000);
  assert.ok(page.net.server.log.some((entry) => entry.what.includes("/repos/alice/product")), "known positive: requests to the product were made");
  assert.deepEqual(writes(), [], "no request of the fake writes");
  assert.deepEqual(Object.keys(storage()).sort(), GIVEN_KEYS, "the page stored nothing");
  assert.deepEqual(storage(), settings, "and changed no setting");
});
