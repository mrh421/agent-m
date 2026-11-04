// MOD-trace-pages' specification view gives the prompt bar its subject (ITM-508), as docs/architecture/MOD-trace-pages.md states it: "Its subject for the
// prompt bar is context only (MOD-prompt-bar's `Subject`): the page and, on the default branch, the open requirement, or the group with the names it holds,
// as `requirements`, the person's own source where the product links one, and the review pages' `draft` as its draft route (UC-019 step 1); at a released
// version, the requirement as it read there, and no draft route (UC-020 1a, UC-049 2a)" and "every other view's the frame's default with the version shown among its page".
// Run: node --test tests/trace-pages-subject.test.mjs
//
// Module: MOD-trace-pages
// Guards: UC-049; UC-019; UC-020; THE PERSON WHO PROMPTS IS A SOURCE
// Level: unit
//
// This imports the shared small DOM of tests/site-frame-dom.mjs unchanged, as the other tests of the views do, and calls the public `trace` Route:
// `render(target, context, params)`, then `subject(params, context)` with the same context, as the frame does for the route shown. The Hosts are the
// test's own; they keep to MOD-repository-hosts' interface (repositoryInfo, readSnapshot), have no write, and the tests run under a `fetch` spy.
// Where the texts leave a reading open, the test states the one it takes, and the pull request names it:
//   - A released version is any ref that is not the default branch the Host names; a Host that cannot name it is read as not the default branch.
//   - "The open requirement" is the requirement whose detail was opened last and is still open; "the group" is the group of the group file whose list was opened last and
//     is still open. A requirement open beats a group open; with neither open, and on every key but `specification`, the subject is the frame's default
//     (no kind of its own, the route's title, a page holding the title, the product, the version shown and the text the route has drawn); on `specification` it carries the person's
//     source beside the page. A subject names no kind: it is context only, and the bar runs `converse` on every page (MOD-prompt-bar, Subject).
//   - The person is the owner of the instance repository: the account `<host of the instance's origin>/<owner>`, as the review pages' prompt route reads it.
//     A person whose source cannot be found, or read, has none: the subject is still given, and its `paramsFor` gives no source and refuses nothing.
//   - A subject at a released version offers no draft route (`null`): a change is drafted only against the current text.
// The counter-proofs are recorded in the pull request.

import "./site-frame-dom.mjs";
import test from "node:test";
import assert from "node:assert/strict";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const OUTSIDE = "A LIBRARY LENDS BOOKS", LOAN = "A LOAN HAS A DUE DATE", SHELF = "A BOOK IS SHELVED", CARD = "A MEMBER HAS A CARD";
const specText = (loanRule) => `# Library — Specification

**${OUTSIDE}** *(Product Owner)*
The library lends books to its members.
*Check:* at review.

## 1. Lending

**${LOAN}** *(Product Owner)*
${loanRule}
*Check:* \`tests/loan.test.mjs\`

**${SHELF}** *(Product Owner)*
Every book stands on one shelf.
*Check:* \`tests/shelf.test.mjs\`

## 2. Membership

**${CARD}** *(Product Owner)*
Every member holds a card.
*Check:* \`tests/card.test.mjs\`
`;
// The group file of the library (ITM-595: the groups of the tree are the group file's): the group "1. Lending" holds A LOAN HAS A DUE DATE then A BOOK IS SHELVED, "2. Membership" A MEMBER HAS A CARD.
const GROUPS = `- 1. Lending\n  - ${LOAN}\n  - ${SHELF}\n- 2. Membership\n  - ${CARD}\n`;
const CURRENT_RULE = "Every loan states the date by which the book is returned.";
const TAG_RULE = "Every loan is returned within fourteen days.";
const SPEC_AT = { main: specText(CURRENT_RULE), "v1.0": specText(TAG_RULE) };

const SHA = "0".repeat(64);
const PERSON = "SRC-acme-person";
const personEntry = (id, identifier) => `---\nid: ${id}\ntitle: A person\nkind: person\nauthority: normative\nlicence: may be republished — fixture\nidentifier: ${identifier}\n---\n# ${id} A person\n\nA fixture source.\n\n## Versions\n\n| Version | Date | Edition | Read from | Files |\n|---|---|---|---|---|\n| \`2026-10-11\` | 2026-10-11 | the fixture | this repository | one file, hashed only |\n`;
const linksText = (...ids) => `# The sources this product meets\n\n| Source | Version | Hash | Part |\n|---|---|---|---|\n${ids.map((id) => `| ${id} | 2026-10-11 | ${SHA} | |`).join("\n")}\n`;

// The calls every Host receives, to show that nothing but reads is asked of them.
const calls = [];
// The product's Host: the default branch main, a SPEC at main and at the tag v1.0, the links file as given, and no write.
function productHost({ defaultBranch = "main", links = linksText(PERSON) } = {}) {
  const host = {
    async readSnapshot(ref) {
      calls.push(["product.readSnapshot", ref]);
      const files = { "SPEC.md": SPEC_AT[ref] ?? SPEC_AT.main, "docs/groups/requirements.md": GROUPS, "docs/sources.md": links };
      return { ref, commit: ref, paths: Object.keys(files), read: async (path) => files[path] ?? null, blob: () => null };
    },
    async repositoryInfo() { calls.push(["product.repositoryInfo"]); return { defaultBranch, visibility: "public", canWrite: false, archived: false, description: "" }; },
    async listTags() { return []; },
  };
  return host;
}
// The instance's Host: the repository acme/agent-m on GitHub, whose register holds the entries given by id and account.
function instanceHost(entries = [[PERSON, "github.com/acme"]]) {
  const files = Object.fromEntries(entries.map(([id, account]) => [`docs/sources/${id}.md`, personEntry(id, account)]));
  return {
    async readSnapshot(ref) {
      calls.push(["instance.readSnapshot", ref]);
      return { ref, commit: ref, repository: { server: "github", origin: "https://github.com", path: "acme/agent-m", web: "https://github.com/acme/agent-m" },
        paths: Object.keys(files), read: async (path) => files[path] ?? null, blob: () => null };
    },
    async repositoryInfo() { calls.push(["instance.repositoryInfo"]); return { defaultBranch: "main", visibility: "public", canWrite: false, archived: false, description: "" }; },
  };
}
const ADDRESS = "https://github.com/acme/library";
const contextOf = (product, instance = instanceHost()) => ({ page: "review", instance: instance && { repository: "acme/agent-m", host: instance },
  product: { address: ADDRESS, kind: "github", host: product }, store: {}, go() {} });

const find = (root, match) => {
  const found = [];
  (function walk(node) { for (const kid of node.childNodes) { if (kid.nodeType === 1) { if (match(kid)) found.push(kid); walk(kid); } } })(root);
  return found;
};
const named = (target, name) => find(target, (node) => node.localName === "button" && node.className.includes("requirement-name") && node.textContent === name)[0];
const toggled = (target, heading) => find(target, (node) => node.localName === "button" && node.className.includes("spec-group-toggle") && node.textContent === heading)[0];
const click = (button) => button.dispatchEvent(new Event("click"));

// Renders the route and returns what the frame holds while it is shown: the target, the params and context it was rendered with, and the subject at this moment.
async function shown({ key = "specification", ref = "main", product = productHost(), context = contextOf(product) } = {}) {
  const target = document.createElement("div");
  document.body.append(target);
  const params = { key, ref };
  await route.render(target, context, params);
  return { target, params, context, subject: () => route.subject(params, context) };
}
const PARTICIPANT = { name: "po-opus" };
// The parameters of a subject but its page, which every subject gives as context.
const withoutPage = ({ page, ...rest }) => rest;

// TST-600150 · level: unit · module: MOD-trace-pages
// guards: UC-049; UC-019; THE PERSON WHO PROMPTS IS A SOURCE
// given: the specification of a library on its default branch main; the instance acme/agent-m, whose register holds SRC-acme-person, a person of the account github.com/acme, which the product links
// input: the route rendered at main, then the requirement A LOAN HAS A DUE DATE opened through its requirement-name control, then route.subject(params, context)
// expect: no kind of its own; draftRoute "draft/subject=" followed by encodeURIComponent of the subject's key (ITM-558); withhold null; refuses []; paramsFor gives the page — which names the requirement — and else exactly { requirements: ["A LOAN HAS A DUE DATE"], source: "SRC-acme-person" }; a key that is a non-empty string
test("TST-600150 on the default branch the open requirement is the subject, with the person's source and the draft route, as context", async () => {
  assert.equal(typeof route.subject, "function", "the route gives a subject");
  const page = await shown();
  click(named(page.target, LOAN));
  const subject = page.subject();
  assert.equal(subject.kind, undefined);
  assert.equal(subject.draftRoute, `draft/subject=${encodeURIComponent(subject.key)}`);
  assert.equal(subject.withhold, null);
  assert.deepEqual(subject.refuses, []);
  assert.ok(subject.paramsFor(PARTICIPANT).page.includes(LOAN), "the page names what is open");
  assert.deepEqual(withoutPage(subject.paramsFor(PARTICIPANT)), { requirements: [LOAN], source: PERSON });
  assert.equal(typeof subject.key, "string");
  assert.notEqual(subject.key, "");
});

// TST-600151 · level: unit · module: MOD-trace-pages
// guards: UC-049; UC-019; THE PERSON WHO PROMPTS IS A SOURCE
// given: the same specification on main, whose group "1. Lending" holds A LOAN HAS A DUE DATE then A BOOK IS SHELVED and whose group "2. Membership" holds A MEMBER HAS A CARD
// input: the group "1. Lending" opened through its spec-group-toggle control; then A BOOK IS SHELVED opened inside it; then that requirement closed; then the group closed
// expect: group open: requirements [LOAN, SHELF] in group order, source "SRC-acme-person", draftRoute "draft"; requirement open inside it: requirements [SHELF] (the narrower subject wins); requirement closed: the group again; group closed: the frame's default, draftRoute null, the page and the person's source; the group's draftRoute is "draft/subject=" followed by encodeURIComponent of its key (ITM-558)
test("TST-600151 an open group gives the names it holds in group order, an open requirement in it narrows the subject, and closing them gives it back", async () => {
  const page = await shown();
  click(toggled(page.target, "1. Lending"));
  let subject = page.subject();
  assert.equal(subject.kind, undefined);
  assert.equal(subject.draftRoute, `draft/subject=${encodeURIComponent(subject.key)}`);
  assert.deepEqual(withoutPage(subject.paramsFor(PARTICIPANT)), { requirements: [LOAN, SHELF], source: PERSON });
  const groupKey = subject.key;

  click(named(page.target, SHELF));
  subject = page.subject();
  assert.deepEqual(withoutPage(subject.paramsFor(PARTICIPANT)), { requirements: [SHELF], source: PERSON });
  assert.notEqual(subject.key, groupKey, "the requirement is another subject than its group");

  click(named(page.target, SHELF));
  subject = page.subject();
  assert.deepEqual(withoutPage(subject.paramsFor(PARTICIPANT)), { requirements: [LOAN, SHELF], source: PERSON });
  assert.equal(subject.key, groupKey);

  click(toggled(page.target, "1. Lending"));
  subject = page.subject();
  assert.equal(subject.kind, undefined);
  assert.equal(subject.draftRoute, null);
  assert.deepEqual(Object.keys(subject.paramsFor(PARTICIPANT)), ["page", "source"]);
});

// TST-600152 · level: unit · module: MOD-trace-pages
// guards: UC-049; UC-019
// given: the same specification on main, and two requirements opened in turn: A LOAN HAS A DUE DATE, then A MEMBER HAS A CARD
// input: route.subject after each; then A MEMBER HAS A CARD closed again
// expect: the last one opened is the subject: [LOAN], then [CARD]; once CARD is closed, LOAN, still open, is the subject again: [LOAN]; with LOAN closed too, no requirement
test("TST-600152 of several open requirements the one opened last is the subject, and closing it gives back the one still open", async () => {
  const page = await shown();
  click(named(page.target, LOAN));
  assert.deepEqual(page.subject().paramsFor(PARTICIPANT).requirements, [LOAN]);
  click(named(page.target, CARD));
  assert.deepEqual(page.subject().paramsFor(PARTICIPANT).requirements, [CARD]);
  click(named(page.target, CARD));
  assert.deepEqual(page.subject().paramsFor(PARTICIPANT).requirements, [LOAN]);
  click(named(page.target, LOAN));
  assert.equal(page.subject().paramsFor(PARTICIPANT).requirements, undefined);
});

// TST-600153 · level: unit · module: MOD-trace-pages
// guards: UC-049; UC-020
// given: a Host whose SPEC at the tag v1.0 gives A LOAN HAS A DUE DATE the rule "Every loan is returned within fourteen days." and at main "Every loan states the date by which the book is returned."; the default branch main
// input: the route rendered at v1.0, A LOAN HAS A DUE DATE opened, then route.subject; the same at main as the known positive
// expect: at v1.0: draftRoute null; paramsFor gives exactly the key "page", whose text holds "v1.0", the name, the rule as it read at the tag and not the rule at main, and the product's address; at main (known positive): a draft route and the requirement as a parameter
test("TST-600153 at a released version the requirement as it read there is the subject, as its page alone, with no draft route", async () => {
  const onMain = await shown({ ref: "main" });
  click(named(onMain.target, LOAN));
  assert.notEqual(onMain.subject().draftRoute, null, "known positive: the default branch gives a draft route");

  const onTag = await shown({ ref: "v1.0" });
  click(named(onTag.target, LOAN));
  const subject = onTag.subject();
  assert.equal(subject.kind, undefined);
  assert.equal(subject.draftRoute, null);
  assert.equal(subject.withhold, null);
  assert.deepEqual(subject.refuses, []);
  const params = subject.paramsFor(PARTICIPANT);
  assert.deepEqual(Object.keys(params), ["page"]);
  for (const part of ["v1.0", LOAN, TAG_RULE, ADDRESS]) assert.ok(params.page.includes(part), `the page holds ${part}`);
  assert.ok(!params.page.includes(CURRENT_RULE), "the page holds the rule as it read at the tag, not the rule at main");
});

// TST-600154 · level: unit · module: MOD-trace-pages
// guards: UC-049; UC-020
// given: the route rendered with the key "timeline" at v1.0 and at main — a view the specification route does not draw (the key "tests" is drawn since ITM-766) — and the specification view at main with nothing opened
// input: route.subject for each
// expect: each is the frame's default: no kind, draftRoute null, withhold null, refuses [], title "Current requirements", paramsFor giving the key "page" whose text holds the title, the product's address and the version shown — "v1.0", "main" —, and, on the specification at main, the person's source beside it; two different versions are two different keys
test("TST-600154 every other view, and the specification with nothing open, give the frame's default with the version shown", async () => {
  const tests = await shown({ key: "timeline", ref: "v1.0" });
  const audit = await shown({ key: "timeline", ref: "main" });
  const nothingOpen = await shown({ key: "specification", ref: "main" });
  for (const [page, version, keys] of [[tests, "v1.0", ["page"]], [audit, "main", ["page"]], [nothingOpen, "main", ["page", "source"]]]) {
    const subject = page.subject();
    assert.equal(subject.kind, undefined, version);
    assert.equal(subject.draftRoute, null, version);
    assert.equal(subject.withhold, null, version);
    assert.deepEqual(subject.refuses, [], version);
    assert.equal(subject.title, "Current requirements", version);
    const params = subject.paramsFor(PARTICIPANT);
    assert.deepEqual(Object.keys(params), keys, version);
    for (const part of ["Current requirements", ADDRESS, version]) assert.ok(params.page.includes(part), `${version}: the page holds ${part}`);
  }
  assert.notEqual(tests.subject().key, audit.subject().key);
  assert.ok(nothingOpen.subject().paramsFor(PARTICIPANT).page.includes(OUTSIDE), "the page holds the text the route has drawn");
});

// TST-600155 · level: unit · module: MOD-trace-pages
// guards: UC-049; UC-019; THE PERSON WHO PROMPTS IS A SOURCE
// given: the subject of an open requirement on main (known positive: source "SRC-acme-person"); then the same page where (a) the product's links file holds no row for the person, (b) the register holds only a person of another account, (c) the context has no instance at all, as in the tests of ITM-360, (d) the instance's Host fails
// input: A LOAN HAS A DUE DATE opened and route.subject for each
// expect: the known positive gives source "SRC-acme-person"; for (a) to (d) the requirement is still listed and opens, the subject is still given, and its paramsFor gives the requirement and no source, refusing nothing
test("TST-600155 a person whose source is not found, or cannot be read, gives no source and the page still opens", async () => {
  const positive = await shown();
  click(named(positive.target, LOAN));
  assert.equal(positive.subject().paramsFor(PARTICIPANT).source, PERSON, "known positive");

  const failing = { async readSnapshot() { throw Object.assign(new Error("unreachable"), { name: "Unreachable" }); }, async repositoryInfo() { throw Object.assign(new Error("unreachable"), { name: "Unreachable" }); } };
  const product = productHost({ links: linksText() });
  const cases = {
    "no link": { context: contextOf(product) },
    "another account": { context: contextOf(productHost(), instanceHost([["SRC-other-person", "github.com/other"]])) },
    "no instance": { context: contextOf(productHost(), null) },
    "instance fails": { context: contextOf(productHost(), failing) },
  };
  for (const [what, { context }] of Object.entries(cases)) {
    const page = await shown({ context });
    click(named(page.target, LOAN));
    assert.ok(named(page.target, LOAN).parentNode.parentNode.nextSibling.textContent.includes(LOAN), `${what}: the requirement opens`);
    const given = page.subject().paramsFor(PARTICIPANT);
    assert.deepEqual(given.requirements, [LOAN], what);
    assert.equal("source" in given, false, what);
  }
});

// TST-600156 · level: unit · module: MOD-trace-pages
// guards: UC-049
// given: the subjects of A LOAN HAS A DUE DATE and of A BOOK IS SHELVED on main, of A LOAN HAS A DUE DATE at v1.0, and of A LOAN HAS A DUE DATE on main of another product
// input: route.subject for each
// expect: four keys, all different; and the key of A LOAN HAS A DUE DATE on main is the same in two renderings of the same page
test("TST-600156 the key tells a requirement, a version and a product apart, and is the same for the same subject", async () => {
  const keyOf = async (name, options) => { const page = await shown(options); click(named(page.target, name)); return page.subject().key; };
  const otherProduct = contextOf(productHost());
  otherProduct.product.address = "https://github.com/acme/other";
  const keys = [await keyOf(LOAN, {}), await keyOf(SHELF, {}), await keyOf(LOAN, { ref: "v1.0" }), await keyOf(LOAN, { context: otherProduct })];
  assert.equal(new Set(keys).size, 4, `four different keys, got ${JSON.stringify(keys)}`);
  assert.equal(await keyOf(LOAN, {}), keys[0], "the same subject has the same key");
});

// TST-600157 · level: unit · module: MOD-trace-pages
// guards: NO SERVER; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the page of TST-600150 with a `fetch` that records every call, and Hosts that record every call and hold no write
// input: the route rendered at main, a requirement and a group opened and closed, the subject read at each step; the same at v1.0
// expect: no call to fetch; every call of a Host is readSnapshot or repositoryInfo (the Hosts have no other method to call)
test("TST-600157 giving the subject sends no request and writes nothing", async () => {
  const before = globalThis.fetch;
  const requests = [];
  globalThis.fetch = (...args) => { requests.push(args); throw new Error("a subject must not send a request"); };
  calls.length = 0;
  try {
    for (const ref of ["main", "v1.0"]) {
      const page = await shown({ ref });
      click(named(page.target, LOAN));
      page.subject().paramsFor(PARTICIPANT);
      click(toggled(page.target, "1. Lending"));
      page.subject().paramsFor(PARTICIPANT);
      click(named(page.target, LOAN));
      click(toggled(page.target, "1. Lending"));
      page.subject();
    }
  } finally {
    globalThis.fetch = before;
  }
  assert.deepEqual(requests, []);
  assert.ok(calls.length > 0, "known positive: the Hosts were read");
  assert.deepEqual(calls.filter(([name]) => !/^(product|instance)\.(readSnapshot|repositoryInfo)$/.test(name)), []);
});
