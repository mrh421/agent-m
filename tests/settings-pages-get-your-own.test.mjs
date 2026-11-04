// MOD-settings-pages' route `get-your-own` — the fork, Pages and Actions steps of getting one's own Agent M (UC-014 steps 1 to 5), as
// docs/architecture/MOD-settings-pages.md states it: "the fork, Pages and Actions steps with their direct links once the owner is known". The route is
// rendered into the fixture DOM of tests/settings-pages-harness.mjs (with the part of a browser that the frame's explain needs) and the helpers of
// tests/settings-pages-setup.d/dom.mjs; the pages the steps open are MOD-repository-hosts' own `webLinks` and MOD-identifiers' own `pagesAddress`, but every
// expected address below is written out in this file's own text. Nothing is requested: the route writes nothing and reads nothing, which the last test checks.
// Run: node --test tests/settings-pages-get-your-own.test.mjs
//
// Module: MOD-settings-pages
// Guards: UC-014; EVERY STEP EXPLAINS ITSELF; AN INSTANCE IS A FORK OF AGENT M; THE PAGES ROOT IS THE REPOSITORY ROOT; AGENT M IS MIT-LICENSED; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// Level: unit
//
// Each test states its input and its expected result in its own text before it runs (given / input / expect); no expected value is read from a document.
// The counter-proofs (a planted fault in src/settings-pages/ and the test's failing result) are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { installDocument, byClass, byTag, type } from "./settings-pages-harness.mjs";
import { attachedTarget, buttonLabelled, press, freshStore, storedKeys, contextOf, withServer } from "./settings-pages-setup.d/dom.mjs";

installDocument();
const { view } = await import("../src/settings-pages/index.mjs");
const { explain } = await import("../src/site-frame/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "get-your-own");

const FORK_PAGE = "https://github.com/akmaier/agent-m/fork";
const STEPS = ["Step 1 · Fork", "Step 2 · Turn on the dashboard", "Step 3 · Turn on the workflows — optional now", "Step 4 · Open your dashboard"];

// The instance the page is served from: the original dashboard by default, or a person's own fork.
async function open({ params = {}, repository = "akmaier/agent-m" } = {}) {
  assert.ok(route, "the view serves the route get-your-own");
  const store = freshStore();
  const context = contextOf(store, repository);
  const target = attachedTarget();
  await route.render(target, context, params);
  return { target, context };
}
const stepTitled = (target, prefix) => byClass(target, "step").find((step) => byTag(step, "h3")[0]?.textContent.startsWith(prefix));
const linkIn = (step) => byTag(step, "a").find((anchor) => /^https:/.test(anchor.href ?? ""));
const hrefsIn = (step) => byTag(step, "a").map((anchor) => anchor.href);
const current = (target) => byClass(target, "step").filter((step) => step.getAttribute("aria-current") === "step").map((step) => byTag(step, "h3")[0].textContent);

// TST-587001 · level: unit · module: MOD-settings-pages
// guards: UC-014; AN INSTANCE IS A FORK OF AGENT M
// given: known positive — the route setup, which the same view serves, renders; the original dashboard akmaier/agent-m; no owner named in the address
// input: render the route get-your-own with no parameters
// expect: the route stands in the view's routes, under the entry settings; the page is headed "Get your own Agent M"; it asks for the person's GitHub name in a text field that is empty and has the focus; it holds the four steps "Step 1 · Fork", "Step 2 · Turn on the dashboard", "Step 3 · Turn on the workflows — optional now" and "Step 4 · Open your dashboard", in this order, and Step 1 is the current one
test("get-your-own — the page asks for the GitHub name and holds the four steps, the first one current", async () => {
  assert.ok(view.routes.find((candidate) => candidate.name === "setup"), "known positive: the view serves the route setup");
  assert.ok(route, "the view serves the route get-your-own");
  assert.equal(route.entry, "settings");
  const { target } = await open();
  assert.equal(byTag(target, "h2")[0].textContent, "Get your own Agent M");
  const field = byClass(target, "owner")[0];
  assert.equal(field.localName, "input");
  assert.equal(field.value, "");
  assert.equal(document.activeElement, field, "the first open field has the focus");
  assert.deepEqual(byClass(target, "step").map((step) => byTag(step, "h3")[0].textContent), STEPS);
  assert.deepEqual(current(target), [STEPS[0]]);
});

// TST-587002 · level: unit · module: MOD-settings-pages
// guards: UC-014; AN INSTANCE IS A FORK OF AGENT M
// given: the original dashboard akmaier/agent-m, no owner known
// input: render the route get-your-own
// expect: Step 1 holds one link, "Open GitHub's fork page ↗", to exactly https://github.com/akmaier/agent-m/fork, opened in a new tab with rel noopener; Steps 2, 3 and 4 hold no link to GitHub and say that the GitHub name comes first
test("get-your-own — without an owner, Step 1 opens GitHub's fork page of akmaier/agent-m and Steps 2 to 4 hold no link", async () => {
  const { target } = await open();
  const fork = byTag(stepTitled(target, STEPS[0]), "a").find((anchor) => anchor.textContent === "Open GitHub's fork page ↗");
  assert.equal(fork?.href, FORK_PAGE);
  assert.equal(fork.target, "_blank");
  assert.equal(fork.rel, "noopener");
  for (const title of STEPS.slice(1)) {
    const step = stepTitled(target, title);
    assert.deepEqual(byTag(step, "a").filter((anchor) => /^https?:/.test(anchor.href ?? "")), [], `${title} has no link before the owner is known`);
    assert.match(step.textContent, /Enter your GitHub name first/, `${title} says the GitHub name comes first`);
  }
});

// TST-587003 · level: unit · module: MOD-settings-pages
// guards: UC-014; THE PAGES ROOT IS THE REPOSITORY ROOT
// given: the original dashboard; the owner acme named in the address (#get-your-own/owner=acme)
// input: render the route get-your-own with the parameter owner = acme
// expect: the field holds acme; Step 2 opens exactly https://github.com/acme/agent-m/settings/pages, Step 3 exactly https://github.com/acme/agent-m/actions, and Step 4 exactly https://acme.github.io/agent-m/; each in a new tab with rel noopener; Step 1 still opens the fork page of akmaier/agent-m
test("get-your-own — with the owner known, each step opens its exact GitHub page", async () => {
  const { target } = await open({ params: { owner: "acme" } });
  assert.equal(byClass(target, "owner")[0].value, "acme");
  const links = STEPS.map((title) => byTag(stepTitled(target, title), "a").find((anchor) => /^https:\/\/(github\.com|acme\.github\.io)\//.test(anchor.href ?? "")));
  assert.deepEqual(links.map((anchor) => anchor.href), [
    FORK_PAGE,
    "https://github.com/acme/agent-m/settings/pages",
    "https://github.com/acme/agent-m/actions",
    "https://acme.github.io/agent-m/",
  ]);
  for (const anchor of links) assert.deepEqual([anchor.target, anchor.rel], ["_blank", "noopener"]);
});

// TST-587004 · level: unit · module: MOD-settings-pages
// guards: UC-014
// given: the original dashboard; the owner acme
// input: render the route get-your-own with owner = acme; read Step 2's words
// expect: Step 2 says what to choose on GitHub's page: "Deploy from a branch", the branch "main", the folder "/ (root)" and "Save"
test("get-your-own — Step 2 says what to choose on the Pages settings page", async () => {
  const { target } = await open({ params: { owner: "acme" } });
  const words = stepTitled(target, STEPS[1]).textContent;
  for (const phrase of ["Deploy from a branch", "main", "/ (root)", "Save"]) assert.ok(words.includes(phrase), `Step 2 names ${phrase}`);
});

// TST-587005 · level: unit · module: MOD-settings-pages
// guards: UC-014
// given: the original dashboard; the owner acme
// input: render the route get-your-own with owner = acme; read Step 3's words and buttons
// expect: Step 3 says the workflows are needed only to fetch EU legal texts and to write an accepted change of the instance's own SPEC without a token; it says GitHub disables workflows on every fork until the owner enables them, and names the button "I understand my workflows, go ahead and enable them"; and it offers a button "Later"
test("get-your-own — Step 3 says what the workflows are for and offers Later", async () => {
  const { target } = await open({ params: { owner: "acme" } });
  const step = stepTitled(target, STEPS[2]);
  const words = step.textContent;
  assert.match(words, /EU legal texts/);
  assert.match(words, /accepted change of the instance's own SPEC/);
  assert.match(words, /without a token/);
  assert.match(words, /I understand my workflows, go ahead and enable them/);
  assert.match(words, /disables? workflows on every fork/);
  assert.ok(buttonLabelled(step, "Later"), "Step 3 offers Later");
});

// TST-587006 · level: unit · module: MOD-settings-pages
// guards: UC-014
// given: the original dashboard; the owner acme; Step 3 current (step = actions)
// input: press Later
// expect: Step 4 becomes the current step and Step 3 is not; the page navigated nowhere (context.go was not called) and stored nothing in this browser
test("get-your-own — Later moves on to Step 4, navigates nowhere and stores nothing", async () => {
  const { target, context } = await open({ params: { owner: "acme", step: "actions" } });
  assert.deepEqual(current(target), [STEPS[2]]);
  await press(buttonLabelled(stepTitled(target, STEPS[2]), "Later"));
  assert.deepEqual(current(target), [STEPS[3]]);
  assert.deepEqual(context.went, []);
  assert.deepEqual(storedKeys(), []);
});

// TST-587007 · level: unit · module: MOD-settings-pages
// guards: UC-014; EVERY STEP EXPLAINS ITSELF
// given: the instance acme/agent-m, a person's own fork; the address #get-your-own/step=actions as the review pages link it, with no owner in it
// input: render the route get-your-own with the parameter step = actions
// expect: the Actions step, Step 3, is the one current step, and no other; the field holds acme, the owner of the instance; Step 3 opens exactly https://github.com/acme/agent-m/actions
test("get-your-own — the address with step=actions opens the Actions step, the owner read from the person's own instance", async () => {
  const { target } = await open({ params: { step: "actions" }, repository: "acme/agent-m" });
  assert.deepEqual(current(target), [STEPS[2]]);
  assert.equal(byClass(target, "owner")[0].value, "acme");
  assert.equal(linkIn(stepTitled(target, STEPS[2])).href, "https://github.com/acme/agent-m/actions");
});

// TST-587008 · level: unit · module: MOD-settings-pages
// guards: UC-014
// given: the original dashboard; known positive — step = actions makes Step 3 current; counter-proofs — step = pages, step = open, step = fork and an unknown step
// input: render the route with each of the parameters step = pages, open, fork and nonsense
// expect: pages makes Step 2 the one current step, open Step 4, fork Step 1, and the unknown name Step 1
test("get-your-own — each step name opens its step, and an unknown name opens the first", async () => {
  assert.deepEqual(current((await open({ params: { step: "actions" } })).target), [STEPS[2]]);
  const opened = {};
  for (const step of ["pages", "open", "fork", "nonsense"]) opened[step] = current((await open({ params: { step } })).target);
  assert.deepEqual(opened, { pages: [STEPS[1]], open: [STEPS[3]], fork: [STEPS[0]], nonsense: [STEPS[0]] });
});

// TST-587009 · level: unit · module: MOD-settings-pages
// guards: UC-014; EVERY STEP EXPLAINS ITSELF
// given: the original dashboard; no owner
// input: type acme into the field, then acme corp/evil, then an empty name
// expect: after acme the links of Steps 2 to 4 are those of acme (settings/pages, actions, acme.github.io/agent-m/) and say nothing of entering a name first; after acme corp/evil they hold no link and the page says a GitHub name has letters, digits and single hyphens; after the empty name they hold no link again
test("get-your-own — typing the GitHub name fills the links of Steps 2 to 4, and a name GitHub does not allow fills none", async () => {
  const { target } = await open();
  const field = byClass(target, "owner")[0];
  type(field, "acme");
  assert.deepEqual([1, 2, 3].map((at) => hrefsIn(stepTitled(target, STEPS[at])).filter((href) => /^https:\/\/(github\.com|acme\.github\.io)\//.test(href))), [
    ["https://github.com/acme/agent-m/settings/pages"], ["https://github.com/acme/agent-m/actions"], ["https://acme.github.io/agent-m/"]]);
  assert.doesNotMatch(stepTitled(target, STEPS[1]).textContent, /Enter your GitHub name first/);
  type(field, "acme corp/evil");
  for (const title of STEPS.slice(1)) assert.deepEqual(hrefsIn(stepTitled(target, title)).filter((href) => /^https:/.test(href)), [], `${title}: no link for a name GitHub does not allow`);
  assert.match(target.textContent, /A GitHub name has letters, digits and single hyphens/);
  type(field, "");
  assert.deepEqual(hrefsIn(stepTitled(target, STEPS[1])).filter((href) => /^https:/.test(href)), []);
});

// TST-587010 · level: unit · module: MOD-settings-pages
// guards: UC-014; EVERY STEP EXPLAINS ITSELF
// given: known positive — explain("repository") is a folded details of class explain; the frame's topics get-your-own-fork, get-your-own-pages, get-your-own-actions and get-your-own-open, each non-empty
// input: render the route get-your-own with owner = acme; read the folded explanations of each step
// expect: each of the four steps holds exactly one <details class="explain">, folded, which is the frame's explain of its own topic: Step 1 get-your-own-fork, Step 2 get-your-own-pages, Step 3 get-your-own-actions, Step 4 get-your-own-open; none is built by the route
test("get-your-own — every step carries the frame's folded explanation of its topic", async () => {
  assert.equal(explain("repository").localName, "details", "known positive: the frame gives a folded explanation for a topic it holds");
  const topics = ["get-your-own-fork", "get-your-own-pages", "get-your-own-actions", "get-your-own-open"];
  const { target } = await open({ params: { owner: "acme" } });
  STEPS.forEach((title, at) => {
    const given = explain(topics[at]);
    assert.equal(given.localName, "details", `the frame holds the topic ${topics[at]}`);
    assert.ok(given.textContent.length > "What is this?".length, `the topic ${topics[at]} has a body`);
    const folded = byTag(stepTitled(target, title), "details");
    assert.equal(folded.length, 1, `${title} holds one folded explanation`);
    assert.equal(folded[0].className, "explain");
    assert.equal(folded[0].hasAttribute("open"), false, "folded");
    assert.equal(folded[0].innerHTML, given.innerHTML, `${title} shows the frame's explanation of ${topics[at]}`);
  });
});

// TST-587011 · level: unit · module: MOD-settings-pages
// guards: UC-014; AGENT M IS MIT-LICENSED; EVERY STEP EXPLAINS ITSELF
// given: the original dashboard
// input: render the route get-your-own; read the licence's words and fold
// expect: the page says Agent M is MIT-licensed and that the licence of every product stays the person's; beside it a folded explanation, the frame's explain of the topic get-your-own-licence under the summary "What is this?", outside the four steps
test("get-your-own — the MIT licence is stated with a folded explanation", async () => {
  const { target } = await open();
  const licence = byClass(target, "licence")[0];
  assert.ok(licence, "the page holds the licence's paragraph");
  assert.match(licence.textContent, /MIT/);
  assert.match(licence.textContent, /licence of every product/);
  const folded = byTag(licence, "details");
  assert.equal(folded.length, 1);
  assert.equal(folded[0].innerHTML, explain("get-your-own-licence").innerHTML);
  assert.ok(byClass(target, "step").every((step) => byClass(step, "licence").length === 0), "the licence is no step");
});

// TST-587017 · level: unit · module: MOD-settings-pages
// guards: UC-014; EVERY STEP EXPLAINS ITSELF
// given: the original dashboard
// input: render the route get-your-own; read the paragraph of the GitHub name
// expect: the field has a label "Your GitHub name — or the organisation to fork into"; beneath it a folded explanation, the frame's explain of the topic get-your-own-owner; it is outside the four steps
test("get-your-own — the GitHub name carries the folded reason for an account used for nothing else", async () => {
  const { target } = await open();
  const name = byClass(target, "owner-field")[0];
  assert.ok(name, "the page holds the paragraph of the GitHub name");
  assert.match(byTag(name, "label")[0].textContent, /Your GitHub name — or the organisation to fork into/);
  const folded = byTag(name, "details");
  assert.equal(folded.length, 1);
  assert.equal(folded[0].innerHTML, explain("get-your-own-owner").innerHTML);
  assert.ok(byClass(target, "step").every((step) => byClass(step, "owner-field").length === 0), "the name is no step");
});

// TST-587012 · level: unit · module: MOD-settings-pages
// guards: UC-014; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; CONFIGURATION LIVES IN THE BROWSER
// given: the original dashboard; a fake of fetch that records every request; an empty store
// input: render the route with owner = acme, type bravo into the field, press Later
// expect: no request was made, and nothing is stored in this browser
test("get-your-own — the page requests nothing and stores nothing", async () => {
  const requests = await withServer(() => ({ status: 599, body: {} }), async () => {
    const { target } = await open({ params: { owner: "acme", step: "actions" } });
    type(byClass(target, "owner")[0], "bravo");
    await press(buttonLabelled(stepTitled(target, STEPS[2]), "Later"));
  });
  assert.deepEqual(requests, []);
  assert.deepEqual(storedKeys(), []);
});
