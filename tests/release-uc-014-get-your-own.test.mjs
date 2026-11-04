// Independent release tests of UC-014 steps 1 to 5 and alternative flow 3a, and of EVERY STEP EXPLAINS ITSELF, through MOD-settings-pages' route `get-your-own` as the frame renders it.
// Written by developer-sonnet-h, who implemented none of the route (ITM-587) and none of GitHub's web links it uses (ITM-950). Each test states its input and its expected result in its own
// text (given / input / expect); every expected value is taken from the use case's step or from the requirement's rule as quoted in the test, none from the code and none read from a
// document when the test runs. The page is found by what the use case names — the headings "Step 1 · Fork", "Step 2 · Turn on the dashboard", "Step 3 · Turn on the workflows — optional
// now" and "Step 4 · Open your dashboard", the button "Later", the folded explanations — never by the route's class names or ids. The route is rendered as the module's own tests render
// it, over tests/settings-pages-harness.mjs (a fixture DOM and finders) and tests/settings-pages-setup.d/dom.mjs (a fake localStorage with the store opened over it, a context as the frame
// hands it, and a fake of fetch that records every request); nothing reaches the network.
// Run: node --test tests/release-uc-014-get-your-own.test.mjs
//
// Module: MOD-settings-pages
// Guards: UC-014; EVERY STEP EXPLAINS ITSELF; AN INSTANCE IS A FORK OF AGENT M; THE PAGES ROOT IS THE REPOSITORY ROOT; AGENT M IS MIT-LICENSED
// Level: release

import test from "node:test";
import assert from "node:assert/strict";
import { byTag, elements, type, turn } from "./settings-pages-harness.mjs";
import { installDocument, attachedTarget, press, freshStore, storedKeys, contextOf, withServer } from "./settings-pages-setup.d/dom.mjs";

installDocument();
const { view } = await import("../src/settings-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "get-your-own");

const TITLES = ["Step 1 · Fork", "Step 2 · Turn on the dashboard", "Step 3 · Turn on the workflows — optional now", "Step 4 · Open your dashboard"];

// Renders the route on a fresh browser of the original dashboard's instance (no owner known); with `name`, the person types it into the field asking for it.
async function open(name) {
  const store = freshStore();
  const context = contextOf(store);
  const target = attachedTarget();
  await route.render(target, context, {});
  if (name !== undefined) { type(nameField(target), name); await turn(); }
  return { target, context, store };
}
const nameField = (target) => byTag(target, "input").find((input) => input.type === "text");
const stepTitled = (target, title) => byTag(target, "section").find((section) => byTag(section, "h3")[0]?.textContent === title);
const foldedIn = (node) => byTag(node, "details");
const withoutFolded = (node) => foldedIn(node).reduce((text, folded) => text.replace(folded.textContent, ""), node.textContent);
const linksIn = (node) => byTag(node, "a").map((anchor) => anchor.href);
const button = (node, pattern) => byTag(node, "button").find((candidate) => pattern.test(candidate.textContent));

// TST-587101 · level: release · module: MOD-settings-pages
// guards: UC-014
// given: a fresh browser on the original dashboard (no owner known); known positive — the page has all four steps
// input: render the route `get-your-own`; read the field and the text around it
// expect: UC-014 step 1 "A guided page opens; it asks for the person's GitHub name (or the organisation to fork into — one used for nothing else is recommended, with the reason folded underneath)": a text field is on the page, labelled with "GitHub name" and "organisation"; the field is empty; beside it a folded explanation (not open) with a body of more than forty characters; the four steps stand in the order Step 1 to Step 4
test("release · UC-014 1: the guided page asks for the GitHub name or the organisation, with the recommendation folded underneath", async () => {
  const { target } = await open();
  assert.deepEqual(byTag(target, "h3").map((heading) => heading.textContent).filter((text) => TITLES.includes(text)), TITLES, "known positive: the four steps stand in order");
  const field = nameField(target);
  assert.ok(field, "a text field asks for the name");
  assert.equal(field.value, "", "no name is known on the original dashboard");
  const label = byTag(target, "label").find((candidate) => byTag(candidate, "input").includes(field));
  assert.ok(label, "the field has a label");
  assert.match(label.textContent, /GitHub name/);
  assert.match(label.textContent, /organisation/);
  const outside = elements(target, () => true).filter((node) => node.localName === "details" && !TITLES.some((title) => stepTitled(target, title)?.textContent.includes(node.textContent)));
  const folded = outside.find((node) => node.textContent.length > 40);
  assert.ok(folded, "a folded explanation of the recommendation stands outside the four steps");
  assert.equal(folded.hasAttribute("open"), false, "folded");
});

// TST-587102 · level: release · module: MOD-settings-pages
// guards: UC-014
// given: a fresh browser on the original dashboard
// input: read Step 1 · Fork
// expect: UC-014 step 2 "A button opens GitHub's fork page for akmaier/agent-m; the person presses Create fork": Step 1 holds a link to github.com/akmaier/agent-m/fork, available before any name is entered, and its words name "Create fork"
test("release · UC-014 2: Step 1 · Fork opens GitHub's fork page for akmaier/agent-m", async () => {
  const { target } = await open();
  const step = stepTitled(target, TITLES[0]);
  assert.ok(step, "Step 1 · Fork stands on the page");
  const forks = linksIn(step).map((href) => new URL(href)).filter((url) => url.origin === "https://github.com" && url.pathname.replace(/\/$/, "") === "/akmaier/agent-m/fork");
  assert.equal(forks.length, 1, "one link to GitHub's fork page of akmaier/agent-m");
  assert.match(withoutFolded(step), /Create fork/);
});

// TST-587103 · level: release · module: MOD-settings-pages
// guards: UC-014
// given: a fresh browser on the original dashboard; the person types the name alice, then the organisation my-org
// input: read Step 2 · Turn on the dashboard before any name, after alice and after my-org
// expect: UC-014 step 3 "Now that the owner is known, a button opens exactly github.com/<owner>/agent-m/settings/pages": before a name the step holds no link; with alice exactly one link, https://github.com/alice/agent-m/settings/pages; with my-org exactly https://github.com/my-org/agent-m/settings/pages
test("release · UC-014 3: Step 2 opens exactly the Pages settings of <owner>/agent-m once the owner is known", async () => {
  const { target } = await open();
  assert.deepEqual(linksIn(stepTitled(target, TITLES[1])), [], "no link while the owner is unknown");
  for (const owner of ["alice", "my-org"]) {
    type(nameField(target), owner);
    await turn();
    assert.deepEqual(linksIn(stepTitled(target, TITLES[1])), [`https://github.com/${owner}/agent-m/settings/pages`], owner);
  }
});

// TST-587104 · level: release · module: MOD-settings-pages
// guards: UC-014
// given: the page with the name alice entered
// input: read the text of Step 2 · Turn on the dashboard outside its folded explanation
// expect: UC-014 step 3 "the page says what to choose there — Deploy from a branch, main, / (root), Save. GitHub lets no one but the owner switch this on": the text contains "Deploy from a branch", "main", "/ (root)", "Save" and "no one but the owner"
test("release · UC-014 3: Step 2 says what to choose on the Pages settings", async () => {
  const { target } = await open("alice");
  const text = withoutFolded(stepTitled(target, TITLES[1]));
  for (const part of ["Deploy from a branch", "main", "/ (root)", "Save", "no one but the owner"]) assert.ok(text.includes(part), `${part}: ${text}`);
});

// TST-587105 · level: release · module: MOD-settings-pages
// guards: UC-014
// given: the page with the name alice entered
// input: read Step 3 · Turn on the workflows — optional now outside its folded explanation
// expect: UC-014 step 4 "needed only to fetch EU legal texts (UC-004) and to write an accepted change of the instance's own SPEC without a token; the page says so and offers Later. When a feature first needs them, the dashboard shows this step again. A button opens github.com/<owner>/agent-m/actions; the person presses I understand my workflows, go ahead and enable them. GitHub disables workflows on every fork until its owner does": the text names "EU legal texts" and "without a token", says the step is shown again when a feature first needs the workflows, contains "I understand my workflows, go ahead and enable them" and says GitHub disables workflows on every fork until the owner enables them; a button "Later" stands in the step; exactly one link, https://github.com/alice/agent-m/actions
test("release · UC-014 4: Step 3 says the workflows are optional now, offers Later and opens the Actions page of <owner>/agent-m", async () => {
  const { target } = await open("alice");
  const step = stepTitled(target, TITLES[2]);
  assert.ok(step, "Step 3 stands on the page");
  const text = withoutFolded(step);
  assert.match(text, /EU legal texts/);
  assert.match(text, /without a token/);
  assert.match(text, /again when a feature first needs them/);
  assert.ok(text.includes("I understand my workflows, go ahead and enable them"), text);
  assert.match(text, /disables workflows on every fork/);
  assert.ok(button(step, /^Later$/), "Later is offered in the step");
  assert.deepEqual(linksIn(step), ["https://github.com/alice/agent-m/actions"]);
});

// TST-587106 · level: release · module: MOD-settings-pages
// guards: UC-014
// given: the page with the name alice entered
// input: press Later in Step 3
// expect: UC-014 step 4 "offers Later": the person can go on without the workflows — Step 4 · Open your dashboard is still on the page with its link, nothing is stored and no request is sent
test("release · UC-014 4: pressing Later leaves Step 4 on the page and stores and sends nothing", async () => {
  const { target } = await open("alice");
  let requests;
  requests = await withServer(() => undefined, async () => { await press(button(stepTitled(target, TITLES[2]), /^Later$/)); });
  const step = stepTitled(target, TITLES[3]);
  assert.ok(step, "Step 4 stands on the page");
  assert.equal(linksIn(step).length, 1, "with its link");
  assert.deepEqual(storedKeys(), []);
  assert.deepEqual(requests, []);
});

// TST-587107 · level: release · module: MOD-settings-pages
// guards: UC-014; THE PAGES ROOT IS THE REPOSITORY ROOT
// given: the page with the name alice entered, then my-org
// input: read Step 4 · Open your dashboard
// expect: UC-014 step 5 "A button opens https://<owner>.github.io/agent-m/": exactly one link, https://alice.github.io/agent-m/, then https://my-org.github.io/agent-m/; before any name the step holds no link; "with a folded note that GitHub needs about a minute after Step 2 before the address answers": among the step's details a folded one (not open) says "about a minute after" Step 2 (or the Pages step, which is Step 2) "before the address answers"
test("release · UC-014 5: Step 4 opens https://<owner>.github.io/agent-m/ with a folded note that GitHub needs about a minute", async () => {
  const { target } = await open();
  assert.deepEqual(linksIn(stepTitled(target, TITLES[3])), [], "no link while the owner is unknown");
  for (const owner of ["alice", "my-org"]) {
    type(nameField(target), owner);
    await turn();
    assert.deepEqual(linksIn(stepTitled(target, TITLES[3])), [`https://${owner}.github.io/agent-m/`], owner);
  }
  const note = foldedIn(stepTitled(target, TITLES[3])).find((folded) => /minute/.test(folded.textContent));
  assert.ok(note, "a folded note in Step 4 says that GitHub needs about a minute");
  assert.equal(note.hasAttribute("open"), false, "folded");
  assert.match(note.textContent, /about a minute after (Step 2|the Pages step)/, "after the step that turns the dashboard on");
  assert.match(note.textContent, /before the address answers/);
});

// TST-587108 · level: release · module: MOD-settings-pages
// guards: UC-014
// given: a fresh browser; a fake of fetch that would answer 404 to every address (Pages is not turned on)
// input: render the route, enter the name alice, press Later
// expect: UC-014 3a "The address answers 404; nothing else is affected": the page does not look at the dashboard's address — no request at all is sent; all four steps stay on the page with the links of Steps 2 to 4; nothing is stored
test("release · UC-014 3a: the page never asks the dashboard's address, so a 404 there affects nothing else", async () => {
  const store = freshStore();
  const target = attachedTarget();
  const requests = await withServer(() => ({ status: 404, body: {} }), async () => {
    await route.render(target, contextOf(store), {});
    type(nameField(target), "alice");
    await turn();
    await press(button(target, /^Later$/));
  });
  assert.deepEqual(requests, [], "no request is sent");
  assert.deepEqual(TITLES.map((title) => linksIn(stepTitled(target, title)).length), [1, 1, 1, 1], "every step keeps its link");
  assert.deepEqual(storedKeys(), []);
});

// TST-587109 · level: release · module: MOD-settings-pages
// guards: EVERY STEP EXPLAINS ITSELF; UC-014
// given: the page with the name alice entered
// input: read the folded explanations in each of the four steps
// expect: EVERY STEP EXPLAINS ITSELF "Every step that asks something of the person carries an explanation that can be expanded, written for someone new to GitHub": each of Step 1 to Step 4 holds a details element, not open, with a summary and a body of more than forty characters beyond it
test("release · EVERY STEP EXPLAINS ITSELF: each of the four steps carries a folded explanation", async () => {
  const { target } = await open("alice");
  for (const title of TITLES) {
    const step = stepTitled(target, title);
    assert.ok(step, `${title} stands on the page`);
    const folded = foldedIn(step).filter((node) => node.textContent.length - (byTag(node, "summary")[0]?.textContent.length ?? 0) > 40);
    assert.ok(folded.length >= 1, `${title} holds a folded explanation with a body`);
    assert.ok(folded.every((node) => !node.hasAttribute("open") && byTag(node, "summary")[0]), `${title}: folded, with a summary`);
  }
});

// TST-587110 · level: release · module: MOD-settings-pages
// guards: UC-014; AGENT M IS MIT-LICENSED; EVERY STEP EXPLAINS ITSELF
// given: a fresh browser
// input: read the page for the licence
// expect: UC-014 "Agent M's MIT licence, shown with a folded explanation, is what allows the fork and leaves the licence of every product to the person": a section outside the four steps names "MIT", says that the licence of every product stays with the person, and holds a folded explanation (not open) with a body of more than forty characters
test("release · UC-014: the MIT licence is shown with a folded explanation", async () => {
  const { target } = await open();
  const section = byTag(target, "section").find((candidate) => /MIT/.test(candidate.textContent) && !TITLES.includes(byTag(candidate, "h3")[0]?.textContent));
  assert.ok(section, "a section names the MIT licence");
  assert.match(withoutFolded(section), /licence of every product/);
  const folded = foldedIn(section).find((node) => node.textContent.length > 40);
  assert.ok(folded, "with a folded explanation");
  assert.equal(folded.hasAttribute("open"), false, "folded");
});
