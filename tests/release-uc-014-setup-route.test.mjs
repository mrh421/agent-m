// Independent release tests of UC-014 steps 7 to 9 and of A TOKEN IS SCOPED TO WHAT IT WRITES, through MOD-settings-pages' route `setup` as the frame renders it. Written by
// developer-sonnet-b, who implemented none of MOD-settings-pages' route `setup` (ITM-588) or the add-product page (ITM-575). Each test states its input and its expected result in its
// own text (given / input / expect); every expected value is taken from the use case's step or from the requirement's rule as quoted in the test, none from the code and none read from
// a document when the test runs. The page is found by what the use case names — the headings "Step A · Create your key on GitHub" and "Step B · Give the key to Agent M", the tick
// "I have read this", the buttons "Store and check", "Import settings" and "+ Add product", the field types password and date — never by the route's class names or ids.
// The route is rendered as the module's own tests render it, over the helpers tests/settings-pages-harness.mjs (a fixture DOM and finders) and tests/settings-pages-setup.d/dom.mjs
// (a fake localStorage with the store opened over it, a context as the frame hands it, and a fake of fetch that records every request); nothing reaches the network.
// Run: node --test tests/release-uc-014-setup-route.test.mjs
//
// Module: MOD-settings-pages
// Guards: UC-014; A TOKEN IS SCOPED TO WHAT IT WRITES; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; ONE GITHUB TOKEN SERVES EVERY FEATURE; THE SHARED PAGES ORIGIN IS DISCLOSED; EVERY STEP EXPLAINS ITSELF; CONFIGURATION LIVES IN THE BROWSER
// Level: release

import test from "node:test";
import assert from "node:assert/strict";
import { byTag, elements } from "./settings-pages-harness.mjs";
import { installDocument, attachedTarget, press, tick, freshStore, storedKeys, contextOf, withServer } from "./settings-pages-setup.d/dom.mjs";

installDocument();
const { view } = await import("../src/settings-pages/index.mjs");
const { readSetting } = await import("../src/browser-store/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "setup");

const API_REPO = "https://api.github.com/repos/akmaier/agent-m";
const TOKEN = "github_pat_RELEASE0123456789abcdefgh";
const inDays = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

// GitHub's own parameters of the link, which name no permission: the token's name, description, expiry in days and the owner whose repositories are offered.
const NOT_PERMISSIONS = ["name", "description", "expires_in", "target_name"];
// UC-014 step 7: "Contents to save and accept, Issues for reports that become issues, Pull requests for the jobs' changes, Actions to start a run, Workflows for a generated CI
// configuration"; with the access each has (read and write, or read). The use case gives Metadata no purpose, only "read"; the requirement asks for "why each part is needed".
const WHY = [
  ["Contents", "read and write", "to save and accept"],
  ["Issues", "read and write", "for reports that become issues"],
  ["Pull requests", "read and write", "for the jobs' changes"],
  ["Actions", "read and write", "to start a run"],
  ["Workflows", "read and write", "for a generated CI configuration"],
  ["Metadata", "read", null],
];

async function open() {
  const store = freshStore();
  const context = contextOf(store);
  const target = attachedTarget();
  await route.render(target, context, {});
  return { target, context, store };
}
const stepTitled = (target, title) => byTag(target, "section").find((section) => byTag(section, "h3")[0]?.textContent === title);
const stepA = (target) => stepTitled(target, "Step A · Create your key on GitHub");
const stepB = (target) => stepTitled(target, "Step B · Give the key to Agent M");
const foldedIn = (step) => byTag(step, "details");
const withoutFolded = (step) => foldedIn(step).reduce((text, folded) => text.replace(folded.textContent, ""), step.textContent);
const inputOfType = (target, type) => byTag(target, "input").find((input) => input.type === type);
const button = (target, pattern) => byTag(target, "button").find((candidate) => pattern.test(candidate.textContent));
const tokenLink = (target) => byTag(stepA(target), "a").map((anchor) => new URL(anchor.href)).find((url) => url.origin + url.pathname === "https://github.com/settings/personal-access-tokens/new");
const sentenceFrom = (text, name) => { const at = text.indexOf(name); return at < 0 ? null : text.slice(at).split(".")[0]; };
const reachable = (priv) => () => ({ status: 200, body: { private: priv, default_branch: "main", permissions: { push: true } } });
async function storeToken(page, { token = TOKEN, expires, answer = reachable(false) } = {}) {
  await tick(inputOfType(page.target, "checkbox"));
  inputOfType(page.target, "password").value = token;
  if (expires !== undefined) inputOfType(page.target, "date").value = expires;
  return withServer(answer, () => press(button(page.target, /^Store and check$/)));
}
// The sentence of `text` that names a permission must give its access, and its purpose where the use case states one, or a reason of at least eight letters where it does not.
function assertPermissionWithWhy(text) {
  for (const [name, access, purpose] of WHY) {
    const sentence = sentenceFrom(text, name);
    assert.ok(sentence, `${name} is named`);
    assert.ok(sentence.includes(`(${access})`), `${name} (${access}): ${sentence}`);
    if (purpose) assert.ok(sentence.includes(purpose), `${name}: ${purpose} — ${sentence}`);
    else assert.ok(sentence.replace(`${name} (${access})`, "").replace(/[^A-Za-z]/g, "").length >= 8, `${name} has a reason: ${sentence}`);
  }
}

// TST-627001 · level: release · module: MOD-settings-pages
// guards: UC-014; THE TOKEN LINK IS PREFILLED
// given: a fresh browser; the instance akmaier/agent-m; no token stored; known positive — the page has both steps
// input: render the route `setup`; read Step A's link
// expect: UC-014 step 7 "A button opens GitHub's token page with name, description, expiry ... prefilled": Step A holds a link to https://github.com/settings/personal-access-tokens/new whose query carries a non-empty name, a non-empty description, and expires_in 90 (UC-014 step 8 "the 90 days of the prefilled link")
test("release · UC-014 7: Step A opens GitHub's new-token page with name, description and 90 days prefilled", async () => {
  const { target } = await open();
  assert.ok(stepA(target) && stepB(target), "known positive: both steps stand on the page");
  const link = tokenLink(target);
  assert.ok(link, "Step A holds a link to GitHub's new-token page");
  assert.ok(link.searchParams.get("name")?.trim(), "a name is prefilled");
  assert.ok(link.searchParams.get("description")?.trim(), "a description is prefilled");
  assert.equal(link.searchParams.get("expires_in"), "90");
});

// TST-627002 · level: release · module: MOD-settings-pages
// guards: UC-014; ONE GITHUB TOKEN SERVES EVERY FEATURE
// given: the page of TST-627001
// input: read every parameter of Step A's link other than name, description, expires_in and target_name (GitHub's owner parameter)
// expect: exactly Contents, Issues and Pull requests write; Actions and Workflows write; Metadata read — six permissions, none more, none less, none with another access (ONE GITHUB TOKEN SERVES EVERY FEATURE: "Contents, Issues and Pull requests read and write, Actions and Workflows read and write, Metadata read")
test("release · UC-014 7: the prefilled link asks for exactly the permissions every feature needs and no other", async () => {
  const { target } = await open();
  const link = tokenLink(target);
  assert.ok(link, "Step A holds the link");
  const asked = Object.fromEntries([...link.searchParams].filter(([key]) => !NOT_PERMISSIONS.includes(key)));
  assert.deepEqual(asked, { contents: "write", issues: "write", pull_requests: "write", actions: "write", workflows: "write", secrets: "write", metadata: "read" });
});

// TST-627003 · level: release · module: MOD-settings-pages
// guards: UC-014; THE REPOSITORY CHOICE IS SPELLED OUT
// given: the page of TST-627001
// input: read the text of Step A that stands outside its folded explanation
// expect: UC-014 step 7 "Underneath, what to do there: choose Only select repositories, pick <owner>/agent-m — only the instance ..., press Generate token, copy it": the text names "Only select repositories", the instance akmaier/agent-m with "nothing else" or "only the instance", "Generate token" and "copy"
test("release · UC-014 7: underneath, Step A says to choose Only select repositories, pick the instance alone, press Generate token and copy it", async () => {
  const { target } = await open();
  const text = withoutFolded(stepA(target));
  assert.match(text, /Only select repositories/);
  assert.match(text, /akmaier\/agent-m/);
  assert.match(text, /nothing else|only the instance/i);
  assert.match(text, /Generate token/);
  assert.match(text, /[Cc]opy/);
});

// TST-627004 · level: release · module: MOD-settings-pages
// guards: UC-014; EVERY STEP EXPLAINS ITSELF
// given: the page of TST-627001
// input: read the folded explanations in Step A, however many there are and in whatever order
// expect: UC-014 step 7 "A folded ... says what each is for": among Step A's details there is one, not open, whose text, for each of Contents (read and write), Issues (read and write), Pull requests (read and write), Actions (read and write) and Workflows (read and write), gives the access in the same sentence as the purpose "to save and accept", "for reports that become issues", "for the jobs' changes", "to start a run", "for a generated CI configuration"; Metadata (read) is named with a reason of at least eight letters. The number of details and their order are not asserted. A Step A with the permissions in no details fails
test("release · UC-014 7: Step A carries a folded explanation of what each permission is for", async () => {
  const { target } = await open();
  const saysWhat = (folded) => { try { assertPermissionWithWhy(folded.textContent); return true; } catch { return false; } };
  const found = foldedIn(stepA(target)).find(saysWhat);
  assert.ok(found, "among Step A's folded explanations, one says what each permission is for");
  assert.equal(found.hasAttribute("open"), false, "folded");
});

// TST-627005 · level: release · module: MOD-settings-pages
// guards: A TOKEN IS SCOPED TO WHAT IT WRITES
// given: the page of TST-627001
// input: read the whole text of Step A, folded explanation included
// expect: A TOKEN IS SCOPED TO WHAT IT WRITES, "the configuration screen states the minimum scope and why each part is needed": the step names "Only select repositories", the instance akmaier/agent-m, and each of the six permissions with its access and a reason (the purposes of TST-627004, and for Metadata a reason of at least eight letters)
test("release · A TOKEN IS SCOPED TO WHAT IT WRITES: the step states Only select repositories, the instance, and each permission with why it is needed", async () => {
  const { target } = await open();
  const text = stepA(target).textContent;
  assert.match(text, /Only select repositories/);
  assert.match(text, /akmaier\/agent-m/);
  assertPermissionWithWhy(text);
});

// TST-627006 · level: release · module: MOD-settings-pages
// guards: UC-014; EVERY STEP EXPLAINS ITSELF
// given: the page of TST-627001
// input: read the details elements of Step A and of Step B
// expect: UC-014 "Both steps carry a folded What is this?": among its details each step holds one whose summary reads "What is this?", folded (no open attribute), with a body of more than forty characters beyond the summary. UC-014 step 7 "A folded Why these? says what each is for": among its details Step A also holds one whose summary reads "Why these?", folded, whose body names Contents, Issues, Pull requests, Actions, Workflows and Metadata; the fold of Step A that names all six permissions has the summary "Why these?" and no other
test("release · UC-014 7–8: both steps carry a folded What is this?, and Step A a folded Why these?", async (t) => {
  const { target } = await open();
  const foldedTitled = (step, summary) => foldedIn(step).find((folded) => byTag(folded, "summary")[0]?.textContent === summary);
  for (const [title, step] of [["Step A", stepA(target)], ["Step B", stepB(target)]]) {
    const folded = foldedTitled(step, "What is this?");
    assert.ok(folded, `${title} holds a folded What is this?`);
    assert.equal(folded.hasAttribute("open"), false, `${title}: folded`);
    assert.ok(folded.textContent.length > "What is this?".length + 40, `${title}: a body`);
  }
  await t.test("the fold of Step A that names the permissions reads Why these?", () => {
    const naming = foldedIn(stepA(target)).find((folded) => WHY.every(([name]) => folded.textContent.includes(name)));
    assert.ok(naming, "Step A holds a fold that names every permission");
    assert.equal(byTag(naming, "summary")[0]?.textContent, "Why these?", "the fold naming the permissions reads Why these?");
    assert.equal(naming.hasAttribute("open"), false, "Why these?: folded");
  });
});

// TST-627007 · level: release · module: MOD-settings-pages
// guards: UC-014; THE SHARED PAGES ORIGIN IS DISCLOSED; CONFIGURATION LIVES IN THE BROWSER
// given: a fresh browser; no acknowledgement stored; a server that would answer 200 for the instance
// input: render the route; read Step B; paste a valid token into the field without ticking "I have read this"; press Store and check
// expect: THE SHARED PAGES ORIGIN IS DISCLOSED "states, before a token or key is stored, that every GitHub Pages site under the same <owner>.github.io domain can read what Agent M stores in the browser": Step B states that every GitHub Pages site under the same akmaier.github.io domain can read it, and the statement stands before the token field on the page; after rendering nothing is stored; the tick is not ticked and the token field, the date field and Store and check are shut; after the press nothing is stored and no request is sent
test("release · UC-014 8: the shared-origin notice stands before the token field, and nothing is stored or sent before I have read this is ticked", async () => {
  const { target } = await open();
  assert.match(stepB(target).textContent, /every GitHub Pages site under that same akmaier\.github\.io domain can read/);
  const everything = elements(target, () => true);
  const notice = everything.find((node) => node.textContent.startsWith("Everything Agent M stores in this browser") && byTag(node, "input").length === 0);
  assert.ok(notice, "the notice stands on the page");
  assert.ok(everything.indexOf(notice) < everything.indexOf(inputOfType(target, "password")), "the notice comes before the token field");
  assert.deepEqual(storedKeys(), [], "rendering stores nothing");
  assert.equal(inputOfType(target, "checkbox").checked, false);
  assert.deepEqual([inputOfType(target, "password").disabled, inputOfType(target, "date").disabled, button(target, /^Store and check$/).disabled], [true, true, true]);
  inputOfType(target, "password").value = TOKEN;
  const requests = await withServer(reachable(false), () => press(button(target, /^Store and check$/)));
  assert.deepEqual(storedKeys(), [], "nothing is stored before the tick");
  assert.deepEqual(requests, [], "nothing is sent before the tick");
});

// TST-627008 · level: release · module: MOD-settings-pages
// guards: UC-014; CONFIGURATION LIVES IN THE BROWSER
// given: a fresh browser; the page rendered on a day D
// input: read the date field of Step B
// expect: UC-014 step 8 "confirms its expiry date — preset to the 90 days of the prefilled link": the date field holds the date 90 days after D (UTC date)
test("release · UC-014 8: the expiry date is preset to 90 days from today", async () => {
  const { target } = await open();
  assert.equal(inputOfType(target, "date").value, inDays(90));
});

// TST-627009 · level: release · module: MOD-settings-pages
// guards: UC-014; CONFIGURATION LIVES IN THE BROWSER
// given: a fresh browser; the tick ticked; the date left at its preset; a public repository akmaier/agent-m that the server answers with its default branch
// input: paste the token github_pat_RELEASE0123456789abcdefgh; press Store and check
// expect: UC-014 step 8 "Agent M stores both in localStorage and checks that the token reaches the instance": the store holds the setting github-token with the pasted token as its value and the preset date 90 days from today as its expires; the page shows the check as reached ("✓" and the instance akmaier/agent-m); a GET of https://api.github.com/repos/akmaier/agent-m was sent carrying "Bearer " and the token
test("release · UC-014 8: Store and check keeps the token and its expiry date in this browser and reads the instance with the token", async () => {
  const page = await open();
  const requests = await storeToken(page);
  const kept = readSetting(page.store, "github-token");
  assert.equal(kept?.value, TOKEN, "the token is kept");
  assert.equal(kept?.expires, inDays(90), "with its expiry date");
  assert.ok(requests.some((request) => request.url === API_REPO && request.method === "GET" && request.authorization === `Bearer ${TOKEN}`), "the instance is read with the token");
  assert.match(page.target.textContent, /✓ akmaier\/agent-m/);
});

// TST-627010 · level: release · module: MOD-settings-pages
// guards: UC-014; CONFIGURATION LIVES IN THE BROWSER
// given: a fresh browser; the tick ticked; a private repository akmaier/agent-m
// input: set the date to 2027-01-15 ("to be corrected if they changed it on GitHub"); paste the token; press Store and check
// expect: the stored expires is 2027-01-15, not the preset
test("release · UC-014 8: a corrected expiry date is the one that is kept", async () => {
  const page = await open();
  await storeToken(page, { expires: "2027-01-15", answer: reachable(true) });
  assert.equal(readSetting(page.store, "github-token")?.value, TOKEN);
  assert.equal(readSetting(page.store, "github-token")?.expires, "2027-01-15");
});

// TST-627011 · level: release · module: MOD-settings-pages
// guards: UC-014
// given: a fresh browser; the tick ticked; a server that answers 200 for the instance
// input: paste a token; press Store and check; then press the button that says the instance is ready; then press "+ Add product"
// expect: UC-014 step 9 "The main page shows the instance, ready: ... and + Add product (UC-001)": after the read the page offers a button whose label contains "ready" and a button "+ Add product" (or "+ Add a product"); the first leads to the page `main`, the second to the page `add-product`, each once
test("release · UC-014 9: after a successful read the instance is shown ready, leading to the main page and to + Add product", async () => {
  const page = await open();
  await storeToken(page);
  const ready = button(page.target, /ready/i);
  const add = button(page.target, /^\+ Add (a )?product$/);
  assert.ok(ready, "the instance is shown ready");
  assert.ok(add, "+ Add product is offered");
  await press(ready);
  await press(add);
  assert.deepEqual(page.context.went, [["main", {}], ["add-product", {}]]);
});

// TST-627012 · level: release · module: MOD-settings-pages
// guards: UC-014
// given: a fresh browser; the tick ticked; the server answers 401 (a token that does not reach the instance), then, on a fresh page, 404
// input: paste a token; press Store and check
// expect: UC-014 step 8 "checks that the token reaches the instance" and step 9 shows the instance ready only after it does: with 401 and with 404 the page shows no button saying the instance is ready and no "+ Add product"; a "✗" stands on the page
test("release · UC-014 8–9: the instance is not shown ready when the read with the token fails", async () => {
  for (const status of [401, 404]) {
    const page = await open();
    await storeToken(page, { answer: () => ({ status, body: { message: "refused" } }) });
    assert.equal(button(page.target, /ready/i), undefined, `${status}: not ready`);
    assert.equal(button(page.target, /^\+ Add (a )?product$/), undefined, `${status}: no + Add product`);
    assert.match(page.target.textContent, /✗/, `${status}: the failure is shown`);
  }
});

// TST-627013 · level: release · module: MOD-settings-pages
// guards: UC-014
// given: a fresh browser; the page rendered
// input: press Import settings (UC-014 7a: "Import settings beside it")
// expect: Import settings stands in the same paragraph as Store and check; pressing it leads to the page `settings` and stores nothing
test("release · UC-014 7a: Import settings stands beside Store and check and leads to the settings page", async () => {
  const { target, context } = await open();
  const imp = button(target, /^Import settings$/);
  assert.ok(imp, "Import settings is offered");
  assert.equal(imp.parentNode, button(target, /^Store and check$/).parentNode, "beside Store and check");
  await press(imp);
  assert.deepEqual(context.went, [["settings", {}]]);
  assert.deepEqual(storedKeys(), []);
});
