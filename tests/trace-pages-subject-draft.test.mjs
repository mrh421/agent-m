// MOD-trace-pages' specification view gives the prompt bar the review pages' draft route in the review pages' own form, and sends nothing without the person's source (ITM-558),
// as the accepted texts state it. MOD-prompt-bar: "`draftRoute` the route of the review pages that shows a draft of this subject". UC-019 4b: "A change of requirements, and the
// author has no source of their own that the product links. Nothing is sent. Agent M says so and links registering the author as a source (UC-004) and linking it to the product (UC-015)."
// MOD-review-pages: "`draft` — the draft of the conversation: MOD-prompt-bar's `latestDraft` for the subject the person came from" and "without one, the prompt bar sends nothing and names
// the step that is missing". The form of the route is the one the review pages write (src/review-pages/subjects.mjs, `draft/subject=${encoded(key)}`) and read back
// (src/review-pages/conversation-draft.mjs, `params.subject`).
// Run: node --test tests/trace-pages-subject-draft.test.mjs
//
// Module: MOD-trace-pages
// Guards: UC-019; UC-049; THE PERSON WHO PROMPTS IS A SOURCE
// Level: unit
//
// This imports the shared small DOM of tests/site-frame-dom.mjs unchanged and calls the public `trace` Route: `render(target, context, params)`, then `subject(params, context)`
// with the same context, as the frame does. The Hosts are the test's own, read-only, and the tests run under a `fetch` spy. Where the texts leave a reading open, the test states the
// one it takes, and the pull request names it:
//   - "encoded by `encodeURIComponent`" is read as: the route is `draft/subject=` followed by `encodeURIComponent(subject.key)`, with nothing after it; the address part `subject=<value>`
//     is read back as the frame reads a part, by decoding the value once, and gives the subject's key.
//   - "the person's own source" is absent when the product's links file names none of the instance's register for the person's account, and when the instance cannot be read or is not
//     given: the page that cannot say gives `source: null`, which the subject refuses at `paramsFor`.
//   - The refusal is raised by `paramsFor`, not by `subject`: the subject itself is still given, so that the bar can show the error and the page opens.
//   - A subject at a released version (kind `converse`) needs no source of the person and does not refuse.
// The counter-proofs are recorded in the pull request.

import "./site-frame-dom.mjs";
import test from "node:test";
import assert from "node:assert/strict";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const LOAN = "A LOAN HAS A DUE DATE", SHELF = "A BOOK IS SHELVED", CARD = "A MEMBER HAS A CARD";
const SPEC = `# Library — Specification

## 1. Lending

**${LOAN}** *(Product Owner)*
Every loan states the date by which the book is returned.
*Check:* \`tests/loan.test.mjs\`

**${SHELF}** *(Product Owner)*
Every book stands on one shelf.
*Check:* \`tests/shelf.test.mjs\`

## 2. Membership

**${CARD}** *(Product Owner)*
Every member holds a card.
*Check:* \`tests/card.test.mjs\`
`;

const SHA = "0".repeat(64);
const GROUPS = `- 1. Lending\n  - ${LOAN}\n  - ${SHELF}\n- 2. Membership\n  - ${CARD}\n`;
const PERSON = "SRC-acme-person";
const personEntry = (id, identifier) => `---\nid: ${id}\ntitle: A person\nkind: person\nauthority: normative\nlicence: may be republished — fixture\nidentifier: ${identifier}\n---\n# ${id} A person\n\nA fixture source.\n\n## Versions\n\n| Version | Date | Edition | Read from | Files |\n|---|---|---|---|---|\n| \`2026-10-11\` | 2026-10-11 | the fixture | this repository | one file, hashed only |\n`;
const linksText = (...ids) => `# The sources this product meets\n\n| Source | Version | Hash | Part |\n|---|---|---|---|\n${ids.map((id) => `| ${id} | 2026-10-11 | ${SHA} | |`).join("\n")}\n`;

function productHost({ links = linksText(PERSON) } = {}) {
  return {
    async readSnapshot(ref) {
      const files = { "SPEC.md": SPEC, "docs/groups/requirements.md": GROUPS, "docs/sources.md": links };
      return { ref, commit: ref, paths: Object.keys(files), read: async (path) => files[path] ?? null, blob: () => null };
    },
    async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: false, archived: false, description: "" }; },
    async listTags() { return []; },
  };
}
function instanceHost(entries = [[PERSON, "github.com/acme"]]) {
  const files = Object.fromEntries(entries.map(([id, account]) => [`docs/sources/${id}.md`, personEntry(id, account)]));
  return {
    async readSnapshot(ref) {
      return { ref, commit: ref, repository: { server: "github", origin: "https://github.com", path: "acme/agent-m", web: "https://github.com/acme/agent-m" },
        paths: Object.keys(files), read: async (path) => files[path] ?? null, blob: () => null };
    },
    async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: false, archived: false, description: "" }; },
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

async function shown({ ref = "main", product = productHost(), context = contextOf(product) } = {}) {
  const target = document.createElement("div");
  document.body.append(target);
  const params = { key: "specification", ref };
  await route.render(target, context, params);
  return { target, subject: () => route.subject(params, context) };
}
const PARTICIPANT = { name: "po-opus" };

// What the frame does with the address part `subject=<value>`: the value, decoded once (src/site-frame/routing.mjs routeOf).
const subjectParamOf = (draftRoute) => {
  const [name, ...parts] = draftRoute.split("/");
  assert.equal(name, "draft", "the route is the review pages' route draft");
  assert.equal(parts.length, 1, "the route holds the part subject=<key> and nothing after it");
  assert.ok(parts[0].startsWith("subject="), "the part is subject=<key>");
  return decodeURIComponent(parts[0].slice("subject=".length));
};

const LOAN_KEY = "trace/key=specification/ref=main/requirement=A%20LOAN%20HAS%20A%20DUE%20DATE/product=https%3A%2F%2Fgithub.com%2Facme%2Flibrary";
const LOAN_DRAFT_ROUTE = "draft/subject=trace%2Fkey%3Dspecification%2Fref%3Dmain%2Frequirement%3DA%2520LOAN%2520HAS%2520A%2520DUE%2520DATE%2Fproduct%3Dhttps%253A%252F%252Fgithub.com%252Facme%252Flibrary";
const LENDING_KEY = "trace/key=specification/ref=main/requirements=%5B%22A%20LOAN%20HAS%20A%20DUE%20DATE%22%2C%22A%20BOOK%20IS%20SHELVED%22%5D/product=https%3A%2F%2Fgithub.com%2Facme%2Flibrary";
const LENDING_DRAFT_ROUTE = "draft/subject=trace%2Fkey%3Dspecification%2Fref%3Dmain%2Frequirements%3D%255B%2522A%2520LOAN%2520HAS%2520A%2520DUE%2520DATE%2522%252C%2522A%2520BOOK%2520IS%2520SHELVED%2522%255D%2Fproduct%3Dhttps%253A%252F%252Fgithub.com%252Facme%252Flibrary";

const STEPS = "The author has no personal source linked to this product. Register the person as a source (#library) and link that source to the product (#sources), then ask again.";

// TST-558001 · level: unit · module: MOD-trace-pages
// guards: UC-019; UC-049
// given: the specification of a library on its default branch main, product https://github.com/acme/library; the requirement A LOAN HAS A DUE DATE opened
// input: route.subject(params, context)
// expect: key "trace/key=specification/ref=main/requirement=A%20LOAN%20HAS%20A%20DUE%20DATE/product=https%3A%2F%2Fgithub.com%2Facme%2Flibrary"; draftRoute exactly "draft/subject=" + encodeURIComponent(key), written out: "draft/subject=trace%2Fkey%3Dspecification%2Fref%3Dmain%2Frequirement%3DA%2520LOAN%2520HAS%2520A%2520DUE%2520DATE%2Fproduct%3Dhttps%253A%252F%252Fgithub.com%252Facme%252Flibrary"; the part subject=<value> read back as the frame reads it gives the key
test("TST-558001 the draft route of an open requirement is draft/subject=<the key, encoded>, and reads back as the key", async () => {
  const page = await shown();
  click(named(page.target, LOAN));
  const subject = page.subject();
  assert.equal(subject.key, LOAN_KEY);
  assert.equal(subject.draftRoute, LOAN_DRAFT_ROUTE);
  assert.equal(subjectParamOf(subject.draftRoute), subject.key);
});

// TST-558002 · level: unit · module: MOD-trace-pages
// guards: UC-019; UC-049
// given: the same specification; the group "1. Lending" (holding A LOAN HAS A DUE DATE then A BOOK IS SHELVED) opened; then A BOOK IS SHELVED opened inside it
// input: route.subject for the group, then with the requirement open
// expect: group: key "trace/key=specification/ref=main/requirements=%5B%22A%20LOAN%20HAS%20A%20DUE%20DATE%22%2C%22A%20BOOK%20IS%20SHELVED%22%5D/product=https%3A%2F%2Fgithub.com%2Facme%2Flibrary" and draftRoute "draft/subject=trace%2Fkey%3Dspecification%2Fref%3Dmain%2Frequirements%3D%255B%2522A%2520LOAN%2520HAS%2520A%2520DUE%2520DATE%2522%252C%2522A%2520BOOK%2520IS%2520SHELVED%2522%255D%2Fproduct%3Dhttps%253A%252F%252Fgithub.com%252Facme%252Flibrary", read back as the key; with the requirement open: the draft route of A BOOK IS SHELVED, which differs from the group's and reads back as that subject's own key
test("TST-558002 the draft route of an open group is draft/subject=<its key, encoded>, and the narrower subject has a route of its own", async () => {
  const page = await shown();
  click(toggled(page.target, "1. Lending"));
  const group = page.subject();
  assert.equal(group.key, LENDING_KEY);
  assert.equal(group.draftRoute, LENDING_DRAFT_ROUTE);
  assert.equal(subjectParamOf(group.draftRoute), group.key);

  click(named(page.target, SHELF));
  const narrower = page.subject();
  assert.notEqual(narrower.draftRoute, group.draftRoute);
  assert.equal(subjectParamOf(narrower.draftRoute), narrower.key);
  assert.ok(narrower.key.includes(`requirement=${encodeURIComponent(SHELF)}`), narrower.key);
});

// TST-558003 · level: unit · module: MOD-trace-pages
// guards: UC-019; THE PERSON WHO PROMPTS IS A SOURCE
// given: a requirement open on main; the known positive: the product links the person's source SRC-acme-person; then (a) the links file holds no row for the person, (b) the register holds only a person of another account, (c) the context has no instance, (d) the instance's Host fails
// input: route.subject, then subject.paramsFor(participant), under a fetch spy
// expect: known positive: the parameters hold requirements [LOAN] and source "SRC-acme-person"; (a) to (d): the subject is still given, names no kind, and paramsFor refuses nothing — it gives requirements [LOAN] and no source, since a subject is context only and a change of requirements refuses by its own precondition (MOD-spec-changes' person-source); no fetch is made
test("TST-558003 without the person's source linked by the product, the subject gives the requirement and no source, and refuses nothing", async () => {
  const before = globalThis.fetch;
  const requests = [];
  globalThis.fetch = (...args) => { requests.push(args); throw new Error("a subject must not send a request"); };
  try {
    const positive = await shown();
    click(named(positive.target, LOAN));
    const known = positive.subject().paramsFor(PARTICIPANT);
    assert.deepEqual([known.requirements, known.source], [[LOAN], PERSON], "known positive");

    const failing = { async readSnapshot() { throw Object.assign(new Error("unreachable"), { name: "Unreachable" }); }, async repositoryInfo() { throw Object.assign(new Error("unreachable"), { name: "Unreachable" }); } };
    const cases = {
      "no link": contextOf(productHost({ links: linksText() })),
      "another account": contextOf(productHost(), instanceHost([["SRC-other-person", "github.com/other"]])),
      "no instance": contextOf(productHost(), null),
      "instance fails": contextOf(productHost(), failing),
    };
    for (const [what, context] of Object.entries(cases)) {
      const page = await shown({ context });
      click(named(page.target, LOAN));
      assert.ok(named(page.target, LOAN).parentNode.parentNode.nextSibling.textContent.includes(LOAN), `${what}: the requirement opens`);
      const subject = page.subject();
      assert.equal(subject.kind, undefined, what);
      const given = subject.paramsFor(PARTICIPANT);
      assert.deepEqual(given.requirements, [LOAN], what);
      assert.equal("source" in given, false, what);
    }
  } finally {
    globalThis.fetch = before;
  }
  assert.deepEqual(requests, []);
});

// TST-558004 · level: unit · module: MOD-trace-pages
// guards: UC-019; THE PERSON WHO PROMPTS IS A SOURCE
// given: the product's links file holds no row for the person; the group "1. Lending" opened
// input: route.subject, then subject.paramsFor(participant); the same at the released version v1.0 with a requirement open (a subject that needs no source)
// expect: the group's subject gives the group's names as requirements and no source, and refuses nothing; at v1.0 the subject gives its parameters, the single key "page"; neither names a kind
test("TST-558004 a group without the person's source gives no source and refuses nothing, and a subject at a released version gives its page", async () => {
  const page = await shown({ product: productHost({ links: linksText() }) });
  click(toggled(page.target, "1. Lending"));
  const group = page.subject();
  assert.equal(group.kind, undefined);
  assert.equal("source" in group.paramsFor(PARTICIPANT), false);
  assert.ok(Array.isArray(group.paramsFor(PARTICIPANT).requirements));

  const released = await shown({ ref: "v1.0", product: productHost({ links: linksText() }) });
  click(named(released.target, LOAN));
  const subject = released.subject();
  assert.equal(subject.kind, undefined);
  assert.deepEqual(Object.keys(subject.paramsFor(PARTICIPANT)), ["page"]);
});
